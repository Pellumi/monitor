import { createHash } from 'node:crypto';
import type { PrismaClient } from '@tellann/db';

/**
 * What an application records visually.
 *
 * The honest scope of this, stated up front because the alternative reading becomes a
 * compliance problem: a *server-enforced* masking floor is not achievable for rrweb.
 * Once a page has serialised unmasked DOM text into a chunk, enforcing a floor
 * server-side would mean gunzipping, parsing the mutation stream, walking text nodes,
 * redacting and re-serialising — a DOM-diff engine in the ingest path, wrong often
 * enough to be worse than useless.
 *
 * What is real, and what this module implements:
 *
 *  1. Client enforcement of a config the client did not choose. The SDK fetches it and
 *     will not record if the fetch fails.
 *  2. Attestation. Every chunk carries the hash of the profile it was recorded under, and
 *     the collector refuses one whose hash is stale — so tightening a setting takes
 *     effect within a chunk interval rather than at the customer's next deploy.
 *  3. Refusal at ingest, which is genuine enforcement: mode OFF, unentitled, or oversized
 *     is rejected. The server can always decline to store; it cannot retroactively clean.
 */

export type ReplayMode = 'OFF' | 'ERROR' | 'ALWAYS';

export interface EffectiveReplayConfig {
  mode: ReplayMode;
  maskAllInputs: boolean;
  maskAllText: boolean;
  blockSelectors: string[];
  maskSelectors: string[];
  recordCanvas: boolean;
  recordCrossOriginIframes: boolean;
  sampleRate: number;
  maxChunkBytes: number;
  bufferSeconds: number;
  /** sha256 of everything above. The SDK echoes it on each chunk. */
  profileHash: string;
}

/**
 * Selectors never recorded, whatever an operator configures.
 *
 * The same predicate the SDK's own `shouldIgnore` uses for event tracking, so recording
 * and tracking cannot disagree about what is sensitive — a disagreement would mean an
 * element deliberately excluded from click tracking still had its text in the DOM
 * recording.
 */
export const ALWAYS_BLOCKED_SELECTORS = [
  '[data-tellann-ignore]',
  '[data-tellann-sensitive]',
  'input[type="password"]',
];

export const DEFAULT_REPLAY_MODE: ReplayMode = 'ERROR';

/** Ceiling on a single chunk, regardless of configuration. */
export const HARD_MAX_CHUNK_BYTES = 4 * 1024 * 1024;

export interface PlanReplayLimits {
  /** From the plan's ResourceLimits. Caps whatever the application asked for. */
  replaySampleRate?: number;
}

function hashConfig(config: Omit<EffectiveReplayConfig, 'profileHash'>): string {
  // Sorted keys and sorted selector lists, so the hash is a function of the config's
  // meaning rather than of the order it happened to be written in. Otherwise a
  // reordered allow-list would invalidate every recording in flight for no reason.
  const canonical = JSON.stringify({
    mode: config.mode,
    maskAllInputs: config.maskAllInputs,
    maskAllText: config.maskAllText,
    blockSelectors: [...config.blockSelectors].sort(),
    maskSelectors: [...config.maskSelectors].sort(),
    recordCanvas: config.recordCanvas,
    recordCrossOriginIframes: config.recordCrossOriginIframes,
    sampleRate: config.sampleRate,
    maxChunkBytes: config.maxChunkBytes,
    bufferSeconds: config.bufferSeconds,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export interface ReplaySettingRow {
  mode: string;
  maskAllInputs: boolean;
  maskAllText: boolean;
  blockSelectors: string[];
  maskSelectors: string[];
  recordCanvas: boolean;
  recordCrossOriginIframes: boolean;
  sampleRate: number;
  maxChunkBytes: number;
  bufferSeconds: number;
}

/**
 * The config a client must record under: the stricter of what the application asked for
 * and what the plan and these defaults allow.
 *
 * Strictness, not merging: if the plan caps the sample rate below the application's
 * setting, the cap wins; the always-blocked selectors are unioned in rather than
 * replaced.
 */
export function resolveEffectiveReplayConfig(
  setting: ReplaySettingRow | null,
  options: { entitled: boolean; planLimits?: PlanReplayLimits } = { entitled: false },
): EffectiveReplayConfig {
  // An unentitled plan is OFF regardless of the row, so a downgrade stops capture without
  // anyone editing a setting.
  const mode: ReplayMode = !options.entitled
    ? 'OFF'
    : ((setting?.mode as ReplayMode) ?? DEFAULT_REPLAY_MODE);

  const askedRate = setting?.sampleRate ?? 1;
  const planRate = options.planLimits?.replaySampleRate ?? 1;

  const base: Omit<EffectiveReplayConfig, 'profileHash'> = {
    mode,
    // A client may make masking stricter but never looser, which is why these are ORs.
    maskAllInputs: setting ? setting.maskAllInputs !== false : true,
    maskAllText: setting?.maskAllText === true,
    blockSelectors: [...new Set([...ALWAYS_BLOCKED_SELECTORS, ...(setting?.blockSelectors ?? [])])],
    maskSelectors: [...new Set(setting?.maskSelectors ?? [])],
    recordCanvas: setting?.recordCanvas === true,
    recordCrossOriginIframes: setting?.recordCrossOriginIframes === true,
    sampleRate: Math.min(1, Math.max(0, Math.min(askedRate, planRate))),
    maxChunkBytes: Math.min(setting?.maxChunkBytes ?? 2 * 1024 * 1024, HARD_MAX_CHUNK_BYTES),
    bufferSeconds: Math.min(Math.max(setting?.bufferSeconds ?? 30, 5), 120),
  };

  return { ...base, profileHash: hashConfig(base) };
}

// ─── Reading it, with a short cache ──────────────────────────────────────────

interface CachedConfig {
  config: EffectiveReplayConfig;
  expiresAt: number;
}

const configCache = new Map<string, CachedConfig>();
const CONFIG_CACHE_TTL_MS = 60_000;

export interface ResolveReplayConfigOptions {
  /** Whether the owning organisation's plan includes DOM_SESSION_REPLAY. */
  entitled: boolean;
  planLimits?: PlanReplayLimits;
  now?: number;
}

export async function resolveReplayConfig(
  prisma: PrismaClient,
  applicationId: string,
  options: ResolveReplayConfigOptions,
): Promise<EffectiveReplayConfig> {
  const now = options.now ?? Date.now();
  const cacheKey = `${applicationId}:${options.entitled ? '1' : '0'}`;
  const cached = configCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.config;

  const setting = await prisma.applicationReplaySetting.findUnique({ where: { applicationId } });
  const config = resolveEffectiveReplayConfig(setting, {
    entitled: options.entitled,
    planLimits: options.planLimits,
  });

  // The stored hash is kept in step, so a settings screen can show what clients are
  // actually recording under rather than recomputing it and hoping they agree.
  if (setting && setting.profileHash !== config.profileHash) {
    await prisma.applicationReplaySetting.update({
      where: { applicationId },
      data: { profileHash: config.profileHash },
    }).catch(() => undefined);
  }

  configCache.set(cacheKey, { config, expiresAt: now + CONFIG_CACHE_TTL_MS });
  return config;
}

export function clearReplayConfigCache(applicationId?: string): void {
  if (!applicationId) {
    configCache.clear();
    return;
  }
  for (const key of [...configCache.keys()]) {
    if (key.startsWith(`${applicationId}:`)) configCache.delete(key);
  }
}
