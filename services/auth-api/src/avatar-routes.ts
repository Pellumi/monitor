// ─────────────────────────────────────────────────────────────────────────────
// Profile picture (avatar) routes.
//
// Every account has an avatar. With nothing configured it is a DiceBear
// "notionists-neutral" image seeded from the email, computed on the fly — no
// storage, no database write. Users may instead:
//   • pick a DiceBear-generated avatar (a customised seed / background)  → stored
//     as an external URL in `User.avatarUrl`
//   • upload their own image                                            → stored
//     in object storage, its key in `User.avatarKey` (wins over avatarUrl)
//
// `resolveAvatarUrl` turns those columns into a single directly-usable URL for
// API responses; `GET /auth/users/:userId/avatar` 302-redirects to the same,
// for consumers that only hold a user id (team member lists, the desktop app).
// ─────────────────────────────────────────────────────────────────────────────

import express, { NextFunction, Request, Response, Router } from 'express';
import crypto from 'crypto';
import type { PrismaClient } from '@tellann/db';
import { createStorageClient, StorageClient } from '@tellann/storage';

const DICEBEAR_HOST = 'api.dicebear.com';
const DICEBEAR_STYLE = 'notionists-neutral';
const DICEBEAR_VERSION = '10.x';

/** A DiceBear avatar URL for `seed`, with any extra query params (e.g. backgroundColor). */
export function dicebearAvatarUrl(seed: string, params: Record<string, string> = {}): string {
  const url = new URL(`https://${DICEBEAR_HOST}/${DICEBEAR_VERSION}/${DICEBEAR_STYLE}/svg`);
  url.searchParams.set('seed', seed || 'tellann');
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

/** True when `value` is an https URL pointing at the DiceBear API. */
export function isDicebearUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === DICEBEAR_HOST;
  } catch {
    return false;
  }
}

type AvatarUser = {
  id: string;
  email: string;
  avatarUrl: string | null;
  avatarKey: string | null;
};

/**
 * Collapses the avatar columns into one URL a browser can render directly.
 * Uploaded images are presigned fresh on every call (short TTL) — every client
 * that shows this re-fetches the profile often enough that expiry never bites.
 */
export async function resolveAvatarUrl(user: AvatarUser, storage: StorageClient): Promise<string> {
  if (user.avatarKey) {
    try {
      return await storage.presign(user.avatarKey, 3600);
    } catch (err) {
      console.warn('[avatar] presign failed, falling back to generated avatar', err);
    }
  }
  if (isDicebearUrl(user.avatarUrl)) return user.avatarUrl;
  return dicebearAvatarUrl(user.email);
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

/** Confirms the bytes actually are the image type the header claims. */
function sniffImageType(buffer: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buffer.length >= 8 && buffer.readUInt32BE(0) === 0x89504e47) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export interface AvatarRouterDeps {
  prisma: PrismaClient;
  verifyAuth: (req: Request, res: Response, next: NextFunction) => unknown;
  /** Injectable for tests; defaults to the env-configured client. */
  storage?: StorageClient;
}

export function createAvatarRouter({ prisma, verifyAuth, storage }: AvatarRouterDeps): Router {
  const router = Router();
  const store = storage ?? createStorageClient();

  // ── Public redirect: resolve a user id → their avatar image ────────────────
  // Unauthenticated on purpose so it drops straight into an <img src>. Avatars
  // are not sensitive, and the id is already known to anyone who can ask.
  router.get('/auth/users/:userId/avatar', async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { id: true, email: true, avatarUrl: true, avatarKey: true },
    });
    if (!user || (user as any).deletedAt) {
      // Still return *an* image so callers never have to special-case 404s.
      return res.redirect(302, dicebearAvatarUrl(req.params.userId));
    }
    const target = await resolveAvatarUrl(user, store);
    res.setHeader('Cache-Control', 'private, max-age=300');
    // Local dev's storage adapter "presigns" to a data: URI — HTTP clients
    // won't follow a redirect to one, so serve those bytes inline instead.
    if (target.startsWith('data:')) {
      const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(target);
      if (match) {
        const contentType = match[1] || 'application/octet-stream';
        const body = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]));
        res.setHeader('Content-Type', contentType);
        return res.send(body);
      }
    }
    return res.redirect(302, target);
  });

  // ── Upload a custom image ─────────────────────────────────────────────────
  // Raw binary body (Content-Type is the image type). The global express.json()
  // parser ignores non-JSON content types, so this route-level raw parser gets
  // the untouched stream.
  router.post(
    '/auth/me/avatar',
    verifyAuth as any,
    express.raw({ type: () => true, limit: '3mb' }),
    async (req: Request & { user?: { id: string } }, res: Response) => {
      if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });

      const declaredType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!ALLOWED_IMAGE_TYPES[declaredType]) {
        return res.status(415).json({ error: 'UNSUPPORTED_IMAGE_TYPE', message: 'Use a PNG, JPEG or WebP image.' });
      }
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (buffer.length === 0) {
        return res.status(400).json({ error: 'EMPTY_IMAGE', message: 'No image data received.' });
      }
      if (buffer.length > MAX_AVATAR_BYTES) {
        return res.status(413).json({ error: 'IMAGE_TOO_LARGE', message: 'Profile pictures must be 2 MB or smaller.' });
      }
      const sniffed = sniffImageType(buffer);
      if (!sniffed || sniffed !== declaredType) {
        return res.status(400).json({ error: 'INVALID_IMAGE', message: 'That file does not look like a valid image.' });
      }

      const ext = ALLOWED_IMAGE_TYPES[declaredType];
      const digest = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
      const key = `avatars/${req.user.id}/${digest}.${ext}`;

      const existing = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { avatarKey: true },
      });

      try {
        await store.uploadAndPresign(key, buffer, declaredType, 3600);
      } catch (err) {
        console.error('[avatar] upload failed', err);
        return res.status(502).json({ error: 'STORAGE_UNAVAILABLE', message: 'Could not store the image. Try again.' });
      }

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarKey: key, avatarUrl: null },
        select: { id: true, email: true, displayName: true, avatarUrl: true, avatarKey: true, preferredAuthMode: true, passwordHash: true },
      });

      if (existing?.avatarKey && existing.avatarKey !== key) {
        store.delete(existing.avatarKey).catch((err) => console.warn('[avatar] stale object cleanup failed', err));
      }

      return res.json(await avatarProfilePayload(updated, store));
    },
  );

  // ── Pick a generated (DiceBear) avatar ────────────────────────────────────
  router.put(
    '/auth/me/avatar/generated',
    verifyAuth as any,
    express.json(),
    async (req: Request & { user?: { id: string } }, res: Response) => {
      if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
      const { avatarUrl } = req.body ?? {};
      if (!isDicebearUrl(avatarUrl)) {
        return res.status(400).json({ error: 'INVALID_AVATAR_URL', message: 'avatarUrl must be a DiceBear image URL.' });
      }

      const existing = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { avatarKey: true },
      });

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl, avatarKey: null },
        select: { id: true, email: true, displayName: true, avatarUrl: true, avatarKey: true, preferredAuthMode: true, passwordHash: true },
      });

      if (existing?.avatarKey) {
        store.delete(existing.avatarKey).catch((err) => console.warn('[avatar] stale object cleanup failed', err));
      }

      return res.json(await avatarProfilePayload(updated, store));
    },
  );

  // ── Remove any custom avatar (back to the email-seeded default) ───────────
  router.delete(
    '/auth/me/avatar',
    verifyAuth as any,
    async (req: Request & { user?: { id: string } }, res: Response) => {
      if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });

      const existing = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { avatarKey: true },
      });

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl: null, avatarKey: null },
        select: { id: true, email: true, displayName: true, avatarUrl: true, avatarKey: true, preferredAuthMode: true, passwordHash: true },
      });

      if (existing?.avatarKey) {
        store.delete(existing.avatarKey).catch((err) => console.warn('[avatar] stale object cleanup failed', err));
      }

      return res.json(await avatarProfilePayload(updated, store));
    },
  );

  return router;
}

/** The same shape `PATCH /auth/me` returns, with the avatar resolved. */
async function avatarProfilePayload(
  user: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    avatarKey: string | null;
    preferredAuthMode: string;
    passwordHash: string | null;
  },
  storage: StorageClient,
) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: await resolveAvatarUrl(user, storage),
    hasCustomAvatar: Boolean(user.avatarKey || user.avatarUrl),
    preferredAuthMode: user.preferredAuthMode,
    hasPassword: Boolean(user.passwordHash),
  };
}
