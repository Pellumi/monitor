import crypto from 'node:crypto';

/**
 * Application-layer encryption for uploaded source archives.
 *
 * Bucket-level encryption protects the disk; this protects the object. A source
 * snapshot is the customer's entire codebase, so it is encrypted before it
 * reaches the storage provider and the key never leaves this process.
 */
const ALGORITHM = 'aes-256-gcm';
const MAGIC = Buffer.from('TLNARC01', 'utf8');
const IV_BYTES = 12;
const TAG_BYTES = 16;

export const ARCHIVE_ENCRYPTION_VERSION = 'aes-256-gcm-v1';
export const ARCHIVE_ENCRYPTION_NONE = 'plaintext-v0';

export class ArchiveEncryptionKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveEncryptionKeyError';
  }
}

/**
 * Key from `CODEBASE_ARCHIVE_ENCRYPTION_KEY`: 32 bytes, hex or base64. Returns
 * null when unset so a deployment that has not configured one is told plainly
 * rather than silently storing plaintext under an "encrypted" label.
 */
export function resolveArchiveKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env.CODEBASE_ARCHIVE_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const decoded = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (decoded.length !== 32) {
    throw new ArchiveEncryptionKeyError(
      'CODEBASE_ARCHIVE_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex characters, or base64).',
    );
  }
  return decoded;
}

export function isArchiveEncryptionConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveArchiveKey(env) !== null;
}

export type EncryptedArchive = { buffer: Buffer; encryptionVersion: string };

/** Layout: MAGIC | iv(12) | tag(16) | ciphertext. */
export function encryptArchive(plaintext: Buffer, env: NodeJS.ProcessEnv = process.env): EncryptedArchive {
  const key = resolveArchiveKey(env);
  if (!key) return { buffer: plaintext, encryptionVersion: ARCHIVE_ENCRYPTION_NONE };
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    buffer: Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]),
    encryptionVersion: ARCHIVE_ENCRYPTION_VERSION,
  };
}

export function isEncryptedArchive(buffer: Buffer): boolean {
  return buffer.length > MAGIC.length + IV_BYTES + TAG_BYTES
    && buffer.subarray(0, MAGIC.length).equals(MAGIC);
}

/**
 * Decrypt, tolerating archives written before a key was configured so an
 * existing deployment keeps working after encryption is switched on.
 */
export function decryptArchive(buffer: Buffer, env: NodeJS.ProcessEnv = process.env): Buffer {
  if (!isEncryptedArchive(buffer)) return buffer;
  const key = resolveArchiveKey(env);
  if (!key) {
    throw new ArchiveEncryptionKeyError(
      'This source archive is encrypted but CODEBASE_ARCHIVE_ENCRYPTION_KEY is not configured.',
    );
  }
  const iv = buffer.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = buffer.subarray(MAGIC.length + IV_BYTES, MAGIC.length + IV_BYTES + TAG_BYTES);
  const ciphertext = buffer.subarray(MAGIC.length + IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Retention window for stored source archives, in days. */
export function resolveRetentionDays(
  organizationSetting: number | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const configured = organizationSetting ?? Number(env.CODEBASE_SNAPSHOT_RETENTION_DAYS ?? '30');
  if (!Number.isFinite(configured) || configured <= 0) return 30;
  return Math.min(Math.max(Math.round(configured), 1), 365);
}

export function retentionDeadline(days: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1_000);
}
