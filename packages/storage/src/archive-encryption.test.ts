import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  ARCHIVE_ENCRYPTION_NONE, ARCHIVE_ENCRYPTION_VERSION, ArchiveEncryptionKeyError,
  decryptArchive, encryptArchive, isArchiveEncryptionConfigured, isEncryptedArchive,
  resolveArchiveKey, resolveRetentionDays, retentionDeadline,
} from './archive-encryption';

const KEY_HEX = crypto.randomBytes(32).toString('hex');
const withKey = { CODEBASE_ARCHIVE_ENCRYPTION_KEY: KEY_HEX } as NodeJS.ProcessEnv;
const withoutKey = {} as NodeJS.ProcessEnv;

test('encrypts and decrypts an archive round trip', () => {
  const plaintext = Buffer.from('{"format":"tellann-codebase-v1","files":[]}');
  const encrypted = encryptArchive(plaintext, withKey);

  assert.equal(encrypted.encryptionVersion, ARCHIVE_ENCRYPTION_VERSION);
  assert.equal(isEncryptedArchive(encrypted.buffer), true);
  assert.equal(encrypted.buffer.includes(plaintext), false, 'the plaintext must not survive in the ciphertext');
  assert.deepEqual(decryptArchive(encrypted.buffer, withKey), plaintext);
});

test('produces a different ciphertext each time for the same input', () => {
  const plaintext = Buffer.from('the same source snapshot twice');
  const first = encryptArchive(plaintext, withKey);
  const second = encryptArchive(plaintext, withKey);
  assert.notDeepEqual(first.buffer, second.buffer, 'a fresh IV must be used per archive');
  assert.deepEqual(decryptArchive(second.buffer, withKey), plaintext);
});

test('rejects a tampered archive rather than returning altered source', () => {
  const encrypted = encryptArchive(Buffer.from('original contents'), withKey);
  const tampered = Buffer.from(encrypted.buffer);
  tampered[tampered.length - 1] ^= 0xff;
  assert.throws(() => decryptArchive(tampered, withKey));
});

test('rejects decryption under the wrong key', () => {
  const encrypted = encryptArchive(Buffer.from('original contents'), withKey);
  const otherKey = { CODEBASE_ARCHIVE_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex') } as NodeJS.ProcessEnv;
  assert.throws(() => decryptArchive(encrypted.buffer, otherKey));
});

test('reports plainly when no key is configured instead of claiming encryption', () => {
  const plaintext = Buffer.from('no key configured');
  const result = encryptArchive(plaintext, withoutKey);
  assert.equal(result.encryptionVersion, ARCHIVE_ENCRYPTION_NONE);
  assert.deepEqual(result.buffer, plaintext);
  assert.equal(isArchiveEncryptionConfigured(withoutKey), false);
  assert.equal(isArchiveEncryptionConfigured(withKey), true);
});

test('still reads archives written before a key was configured', () => {
  const plaintext = Buffer.from('legacy plaintext archive');
  assert.deepEqual(decryptArchive(plaintext, withKey), plaintext);
});

test('refuses an encrypted archive when the key has gone missing', () => {
  const encrypted = encryptArchive(Buffer.from('secret'), withKey);
  assert.throws(() => decryptArchive(encrypted.buffer, withoutKey), ArchiveEncryptionKeyError);
});

test('rejects a key of the wrong length', () => {
  assert.throws(
    () => resolveArchiveKey({ CODEBASE_ARCHIVE_ENCRYPTION_KEY: 'abcd' } as NodeJS.ProcessEnv),
    ArchiveEncryptionKeyError,
  );
  assert.ok(resolveArchiveKey({ CODEBASE_ARCHIVE_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64') } as NodeJS.ProcessEnv));
});

test('clamps retention to a sane window and honours the organisation setting', () => {
  assert.equal(resolveRetentionDays(null, {} as NodeJS.ProcessEnv), 30);
  assert.equal(resolveRetentionDays(7, {} as NodeJS.ProcessEnv), 7);
  assert.equal(resolveRetentionDays(0, {} as NodeJS.ProcessEnv), 30);
  assert.equal(resolveRetentionDays(10_000, {} as NodeJS.ProcessEnv), 365);
  assert.equal(resolveRetentionDays(null, { CODEBASE_SNAPSHOT_RETENTION_DAYS: '14' } as NodeJS.ProcessEnv), 14);
});

test('computes a retention deadline in the future', () => {
  const from = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(retentionDeadline(30, from).toISOString(), '2026-01-31T00:00:00.000Z');
});
