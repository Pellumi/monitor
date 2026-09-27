import type { Express, Request, Response } from 'express';
import express from 'express';
import { Feature } from '@tellann/shared';
import type { PrismaClient } from '@tellann/db';
import type { EntitlementChecker } from '@tellann/entitlement-checker';
import { buildReplayChunkKey, type StorageClient } from '@tellann/storage';
import {
  HARD_MAX_CHUNK_BYTES,
  resolveReplayConfig,
  type EffectiveReplayConfig,
} from '@tellann/session-core';

/**
 * DOM recording ingest.
 *
 * Not on `/v1/events`: one rrweb full snapshot is 200-800 KB uncompressed against that
 * route's 32 KB ceiling. Not on report-engine either, which is the read plane guarded by
 * user JWTs and cookies, while a chunk arrives with an ingestion API key. Here, because
 * this service already sits behind the gateway hook that resolves that key into
 * `x-tellann-*` headers and already owns the ingest gate.
 *
 * The handler never parses a chunk body. That is the design property everything else
 * follows from: all metadata travels in headers, so the bytes are validated for size and
 * streamed to object storage without ever being interpreted.
 */

export interface ReplayRouteDeps {
  prisma: PrismaClient;
  storage: StorageClient;
  entitlementChecker: EntitlementChecker;
}

interface ChunkHeaders {
  sessionId: string;
  seq: number;
  startOffsetMs: number;
  endOffsetMs: number;
  eventCount: number;
  encoding: string;
  format: string;
  hasFullSnapshot: boolean;
  trigger: string;
  maskProfileHash: string | null;
}

function headerInt(req: Request, name: string, fallback: number | null = null): number | null {
  const raw = req.headers[name];
  if (typeof raw !== 'string') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function headerString(req: Request, name: string): string | null {
  const raw = req.headers[name];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function parseChunkHeaders(req: Request): ChunkHeaders | { error: string } {
  const sessionId = headerString(req, 'x-tellann-session-id');
  if (!sessionId) return { error: 'x-tellann-session-id is required' };

  const seq = headerInt(req, 'x-tellann-chunk-seq');
  if (seq === null || seq < 0) return { error: 'x-tellann-chunk-seq must be a non-negative integer' };

  const startOffsetMs = headerInt(req, 'x-tellann-chunk-start-ms', 0)!;
  const endOffsetMs = headerInt(req, 'x-tellann-chunk-end-ms', startOffsetMs)!;
  const eventCount = headerInt(req, 'x-tellann-chunk-events', 0)!;

  const encoding = headerString(req, 'x-tellann-chunk-encoding') ?? 'gzip';
  if (!['gzip', 'identity'].includes(encoding)) {
    return { error: 'x-tellann-chunk-encoding must be gzip or identity' };
  }

  const trigger = headerString(req, 'x-tellann-chunk-trigger') ?? 'CONTINUOUS';
  if (!['CONTINUOUS', 'ERROR', 'MANUAL'].includes(trigger)) {
    return { error: 'x-tellann-chunk-trigger must be CONTINUOUS, ERROR or MANUAL' };
  }

  return {
    sessionId,
    seq,
    startOffsetMs,
    endOffsetMs,
    eventCount,
    encoding,
    format: headerString(req, 'x-tellann-replay-format') ?? 'rrweb-v2',
    hasFullSnapshot: headerString(req, 'x-tellann-chunk-snapshot') === 'true',
    trigger,
    maskProfileHash: headerString(req, 'x-tellann-mask-profile-hash'),
  };
}

/** Quota verdicts, cached so an aggregate query does not run per chunk. */
const quotaCache = new Map<string, { allowed: boolean; expiresAt: number }>();
const QUOTA_CACHE_TTL_MS = 60_000;
/** How often the aggregate is actually re-run within one session's upload stream. */
const QUOTA_CHECK_EVERY = 10;

/**
 * Whether the organisation has room for this chunk.
 *
 * `canReserveStorage` sums the whole storage ledger for the organisation, so calling it
 * per chunk would put an aggregate query on the ingest hot path every few seconds per
 * active session. Checked on the first chunk and every tenth after, cached for a minute,
 * and hard-refused once tripped. Over-admitting a few hundred KB between checks is the
 * right trade against that.
 */
async function hasStorageRoom(
  deps: ReplayRouteDeps,
  organizationId: string | null,
  seq: number,
  bytes: number,
): Promise<boolean> {
  if (!organizationId) return true;

  const now = Date.now();
  const cached = quotaCache.get(organizationId);
  const mustCheck = seq === 0 || seq % QUOTA_CHECK_EVERY === 0 || !cached || cached.expiresAt <= now;
  if (!mustCheck) return cached!.allowed;

  try {
    const quota = await deps.entitlementChecker.canReserveStorage(organizationId, BigInt(bytes));
    quotaCache.set(organizationId, { allowed: quota.allowed, expiresAt: now + QUOTA_CACHE_TTL_MS });
    return quota.allowed;
  } catch (err) {
    // A quota service failure must not lose a recording. Fail open, as every other
    // entitlement check in this service does.
    console.warn('[EventCollector] Replay quota check failed (fail-open)', err);
    return true;
  }
}

async function resolveScope(
  deps: ReplayRouteDeps,
  req: Request,
): Promise<{ applicationId: string; environmentId: string | null; organizationId: string | null } | null> {
  const applicationId = headerString(req, 'x-tellann-application-id');
  if (!applicationId) return null;

  const application = await deps.prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, organizationId: true },
  });
  if (!application) return null;

  return {
    applicationId: application.id,
    environmentId: headerString(req, 'x-tellann-environment-id'),
    organizationId: application.organizationId ?? headerString(req, 'x-tellann-org-id'),
  };
}

async function configFor(
  deps: ReplayRouteDeps,
  applicationId: string,
  organizationId: string | null,
): Promise<EffectiveReplayConfig> {
  let entitled = false;
  if (organizationId) {
    try {
      entitled = await deps.entitlementChecker.canAccess(organizationId, Feature.DOM_SESSION_REPLAY);
    } catch (err) {
      // Unlike event ingest, this fails CLOSED. Failing open would store megabytes per
      // session for an organisation that is not paying for it, which is not recoverable
      // by a later correction the way a dropped event is.
      console.warn('[EventCollector] Replay entitlement check failed — treating as unentitled', err);
      entitled = false;
    }
  }
  return resolveReplayConfig(deps.prisma, applicationId, { entitled });
}

export function registerReplayRoutes(app: Express, deps: ReplayRouteDeps): void {
  /**
   * The config the SDK must record under.
   *
   * Fetched before recording starts; the SDK does not record at all if this fails, so an
   * outage degrades to no capture rather than to capture under stale rules.
   */
  app.get('/v1/replay/config', async (req: Request, res: Response) => {
    const scope = await resolveScope(deps, req);
    if (!scope) return res.status(404).json({ error: 'Unknown application' });

    try {
      const config = await configFor(deps, scope.applicationId, scope.organizationId);
      res.json(config);
    } catch (err) {
      console.error('[EventCollector] Failed to resolve replay config', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * One chunk.
   *
   * A route-scoped raw parser, registered here rather than relying on the global
   * `express.json` — which would try to parse a gzip body and fail.
   */
  app.post(
    '/v1/replay/chunks',
    express.raw({ type: () => true, limit: HARD_MAX_CHUNK_BYTES }),
    async (req: Request, res: Response) => {
      const scope = await resolveScope(deps, req);
      if (!scope) return res.status(404).json({ error: 'Unknown application' });

      const headers = parseChunkHeaders(req);
      if ('error' in headers) return res.status(400).json({ error: headers.error });

      const body = req.body;
      if (!Buffer.isBuffer(body) || body.byteLength === 0) {
        return res.status(400).json({ error: 'Chunk body must be a non-empty binary payload' });
      }

      try {
        const config = await configFor(deps, scope.applicationId, scope.organizationId);

        // Genuine enforcement, as opposed to the masking floor: the server can always
        // decline to store.
        if (config.mode === 'OFF') {
          return res.status(403).json({
            error: 'REPLAY_DISABLED',
            message: 'Visual replay is off for this application or not included in its plan.',
          });
        }

        if (body.byteLength > config.maxChunkBytes) {
          return res.status(413).json({
            error: 'CHUNK_TOO_LARGE',
            message: `Chunk of ${body.byteLength} bytes exceeds the ${config.maxChunkBytes} byte limit.`,
          });
        }

        // Attestation. A stale hash means the SDK is recording under rules that have since
        // been tightened, so it is told to re-fetch and restart rather than having the
        // chunk quietly accepted -- which is how a tightened setting takes effect within
        // one chunk interval instead of at the customer's next deploy.
        if (headers.maskProfileHash && headers.maskProfileHash !== config.profileHash) {
          return res.status(409).json({
            error: 'REPLAY_PROFILE_STALE',
            message: 'The masking profile has changed. Re-fetch /v1/replay/config and restart recording.',
            profileHash: config.profileHash,
          });
        }

        if (!(await hasStorageRoom(deps, scope.organizationId, headers.seq, body.byteLength))) {
          return res.status(402).json({
            error: 'STORAGE_QUOTA_EXCEEDED',
            message: 'This organization has no storage left for session recordings.',
          });
        }

        const objectKey = buildReplayChunkKey(headers.sessionId, headers.seq);

        // Deterministic key, so a retry overwrites rather than duplicating. `upload`, not
        // `uploadAndPresign`: nobody is watching yet, so a signature minted here is wasted.
        await deps.storage.upload(objectKey, body, 'application/gzip');

        await deps.prisma.replayChunk.upsert({
          where: { objectKey },
          create: {
            sessionId: headers.sessionId,
            applicationId: scope.applicationId,
            environmentId: scope.environmentId,
            organizationId: scope.organizationId,
            seq: headers.seq,
            objectKey,
            bytes: BigInt(body.byteLength),
            startOffsetMs: headers.startOffsetMs,
            endOffsetMs: headers.endOffsetMs,
            eventCount: headers.eventCount,
            format: headers.format,
            encoding: headers.encoding,
            hasFullSnapshot: headers.hasFullSnapshot,
            trigger: headers.trigger,
            maskProfileHash: headers.maskProfileHash,
          },
          update: {
            bytes: BigInt(body.byteLength),
            endOffsetMs: headers.endOffsetMs,
            eventCount: headers.eventCount,
            hasFullSnapshot: headers.hasFullSnapshot,
          },
        });

        // One ledger entry per session rather than per chunk. The ledger's job is
        // accounting, and per-object granularity is only needed for deletion -- which
        // ReplayChunk already provides. Per-chunk entries would make this the
        // fastest-growing table in the schema (~20 rows per ten-minute session) and
        // retention's 500-row-per-organisation daily budget would never keep up.
        if (scope.organizationId) {
          const sessionTotal = await deps.prisma.replayChunk.aggregate({
            where: { sessionId: headers.sessionId },
            _sum: { bytes: true },
          });
          await deps.prisma.storageLedgerEntry.upsert({
            where: { objectKey: `replays/${headers.sessionId}/` },
            create: {
              organizationId: scope.organizationId,
              objectKey: `replays/${headers.sessionId}/`,
              ownerType: 'SESSION',
              ownerId: headers.sessionId,
              category: 'SESSION_REPLAY',
              bytes: sessionTotal._sum.bytes ?? BigInt(body.byteLength),
            },
            update: {
              bytes: sessionTotal._sum.bytes ?? BigInt(body.byteLength),
              reservedBytes: 0n,
              deletedAt: null,
            },
          });
        }

        res.status(202).json({ accepted: true, seq: headers.seq, bytes: body.byteLength });
      } catch (err) {
        console.error('[EventCollector] Failed to store replay chunk', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );
}
