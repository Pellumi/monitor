import { AuditAction, Prisma, type PrismaClient } from '@tellann/db';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import {
  DEFAULT_IDENTITY_MODE,
  clearPrivacyFloorCache,
  eraseEndUser,
  generateIdentitySalt,
  type IdentityMode,
} from '@tellann/session-core';

/**
 * What an application is allowed to have stored about its users.
 *
 * These routes exist because of a layering change, not as a feature bolted alongside
 * one. `identify()` used to route its user id through the SDK's metadata sanitizer,
 * which destroyed it; moving identity into the envelope fixed that but also took
 * traits out of the sanitizer's reach. The server-side floor is what replaces it, so
 * the default is HASHED and turning on RAW is an explicit, audited act.
 */

const IDENTITY_MODES: IdentityMode[] = ['RAW', 'HASHED', 'DISABLED'];

/** Trait keys that are never storable, whatever an operator puts in the allow-list. */
const FORBIDDEN_TRAIT_KEY = /password|passwd|secret|token|ssn|social.?security|card|cvv|cvc|auth|private.?key/i;

interface PrivacyRouterDeps {
  prisma: PrismaClient;
  verifyJwt: RequestHandler;
  /** Also proves the caller's organization owns the application in the path. */
  verifyAppOwnership: RequestHandler;
}

export function createPrivacyRouter(deps: PrivacyRouterDeps): Router {
  const { prisma, verifyJwt, verifyAppOwnership } = deps;
  const router = Router();
  const guards = [verifyJwt, verifyAppOwnership];
  const actorId = (req: Request): string | undefined =>
    (req as Request & { user?: { id?: string } }).user?.id;

  /** The current floor, created on first read so the salt is stable from then on. */
  async function loadSetting(applicationId: string) {
    return prisma.applicationPrivacySetting.upsert({
      where: { applicationId },
      create: {
        applicationId,
        identityMode: DEFAULT_IDENTITY_MODE,
        identitySalt: generateIdentitySalt(),
        allowedTraitKeys: [],
      },
      update: {},
    });
  }

  router.get('/applications/:id/privacy', ...guards, async (req: Request, res: Response) => {
    try {
      const setting = await loadSetting(req.params.id);
      // The salt is never returned. It is the key that makes the hashes
      // non-enumerable, so it has no business leaving the server.
      res.json({
        applicationId: setting.applicationId,
        identityMode: setting.identityMode,
        allowedTraitKeys: setting.allowedTraitKeys,
        updatedAt: setting.updatedAt,
      });
    } catch (err) {
      console.error('[PrivacyRoutes] Failed to read privacy setting', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/applications/:id/privacy', ...guards, async (req: Request, res: Response) => {
    const applicationId = req.params.id;
    const { identityMode, allowedTraitKeys } = req.body ?? {};

    if (identityMode !== undefined && !IDENTITY_MODES.includes(identityMode)) {
      return res.status(400).json({
        error: 'INVALID_IDENTITY_MODE',
        message: `identityMode must be one of ${IDENTITY_MODES.join(', ')}.`,
      });
    }

    let keys: string[] | undefined;
    if (allowedTraitKeys !== undefined) {
      if (!Array.isArray(allowedTraitKeys) || allowedTraitKeys.some((k) => typeof k !== 'string')) {
        return res.status(400).json({
          error: 'INVALID_TRAIT_KEYS',
          message: 'allowedTraitKeys must be an array of strings.',
        });
      }
      const forbidden = allowedTraitKeys.filter((key: string) => FORBIDDEN_TRAIT_KEY.test(key));
      if (forbidden.length > 0) {
        // An allow-list still has a floor under it: no configuration should be able to
        // opt an application into storing a password or a card number.
        return res.status(400).json({
          error: 'FORBIDDEN_TRAIT_KEYS',
          message: 'These trait keys can never be captured.',
          keys: forbidden,
        });
      }
      keys = [...new Set(allowedTraitKeys.map((key: string) => key.trim()).filter(Boolean))].slice(0, 50);
    }

    try {
      const before = await loadSetting(applicationId);
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { organizationId: true },
      });

      const updated = await prisma.applicationPrivacySetting.update({
        where: { applicationId },
        data: {
          ...(identityMode !== undefined ? { identityMode } : {}),
          ...(keys !== undefined ? { allowedTraitKeys: keys } : {}),
        },
      });

      // The ingest path caches the floor for a minute; a deliberate change should not
      // wait that long, least of all a tightening one.
      clearPrivacyFloorCache(applicationId);

      if (application?.organizationId) {
        const entries: Array<{ action: AuditAction; metadata: Prisma.InputJsonValue }> = [];
        if (identityMode !== undefined && identityMode !== before.identityMode) {
          entries.push({
            action: AuditAction.PRIVACY_IDENTITY_MODE_CHANGED,
            metadata: { applicationId, from: before.identityMode, to: identityMode },
          });
        }
        if (keys !== undefined && keys.join(',') !== before.allowedTraitKeys.join(',')) {
          entries.push({
            action: AuditAction.PRIVACY_TRAIT_ALLOWLIST_CHANGED,
            metadata: { applicationId, from: before.allowedTraitKeys, to: keys },
          });
        }
        for (const entry of entries) {
          await prisma.auditLog.create({
            data: {
              organizationId: application.organizationId,
              userId: actorId(req),
              action: entry.action,
              metadata: entry.metadata,
            },
          });
        }
      }

      res.json({
        applicationId,
        identityMode: updated.identityMode,
        allowedTraitKeys: updated.allowedTraitKeys,
        updatedAt: updated.updatedAt,
      });
    } catch (err) {
      console.error('[PrivacyRoutes] Failed to update privacy setting', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Erases one end user and everything derived from them.
   *
   * Retention is purely time-based, so before this there was no way to answer a
   * data-subject request except by waiting for the window to expire.
   */
  router.delete('/applications/:id/end-users/:endUserId', ...guards, async (req: Request, res: Response) => {
    const { id: applicationId, endUserId } = req.params;

    try {
      const endUser = await prisma.endUser.findFirst({
        where: { id: endUserId, applicationId },
        select: { id: true },
      });
      // 404 rather than 403 for something in another tenant: the existence of another
      // customer's user is not a fact to confirm.
      if (!endUser) return res.status(404).json({ error: 'End user not found' });

      const result = await eraseEndUser(prisma, applicationId, endUserId);

      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { organizationId: true },
      });
      if (application?.organizationId) {
        await prisma.auditLog.create({
          data: {
            organizationId: application.organizationId,
            userId: actorId(req),
            action: AuditAction.END_USER_ERASED,
            metadata: { applicationId, endUserId, sessionsDeleted: result.sessions },
          },
        });
      }

      res.json({ erased: true, ...result });
    } catch (err) {
      console.error('[PrivacyRoutes] Failed to erase end user', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
