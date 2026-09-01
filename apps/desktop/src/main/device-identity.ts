import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readLocalState, writeLocalState } from './local-store';

const DEVICE_SECRET_KEY = 'device:workspace-identity-secret';

/**
 * A per-installation secret held in the encrypted local store. It never leaves
 * the machine; its only job is to make workspace identifiers deterministic here
 * while remaining opaque to the cloud.
 */
function deviceSecret(): Buffer {
  const stored = readLocalState<{ secret: string }>(DEVICE_SECRET_KEY);
  if (stored?.secret) return Buffer.from(stored.secret, 'base64');
  const secret = crypto.randomBytes(32);
  writeLocalState(DEVICE_SECRET_KEY, { secret: secret.toString('base64') });
  return secret;
}

function uuidFrom(digest: Buffer): string {
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32),
  ].join('-');
}

/**
 * The stable identity of one folder on one machine.
 *
 * Previously this was a fresh randomUUID() per attach, so re-attaching the same
 * folder created a duplicate cloud workspace row instead of updating the
 * existing one. Deriving it from the canonical path under an HMAC makes attach
 * idempotent, while the cloud still learns nothing about where the folder lives:
 * without the device secret the digest is not reversible or even comparable
 * across machines.
 */
export function workspaceLocalId(workspaceRoot: string): string {
  const canonical = fs.realpathSync.native(path.resolve(workspaceRoot));
  // Windows paths are case-insensitive, so the same folder reached through a
  // differently-cased path must not produce a different identity.
  const normalized = process.platform === 'win32' ? canonical.toLowerCase() : canonical;
  return uuidFrom(crypto.createHmac('sha256', deviceSecret()).update(normalized).digest());
}
