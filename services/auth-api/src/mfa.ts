/**
 * Gap 5 — MFA / TOTP Service
 *
 * Implements TOTP enrollment (setup/verify), daily authentication (challenge/verify),
 * and backup code generation and consumption.
 *
 * Security notes:
 *   - TOTP secrets are AES-256-GCM encrypted using MFA_ENCRYPTION_KEY before storage.
 *   - Backup codes are 8-character cryptographically random strings stored as bcrypt hashes.
 *   - Challenge tokens are short-lived (5 min), single-use, stored as SHA-256 hashes.
 *   - All operations are rate-limited at the route level by the existing rate limiter.
 */

import crypto from 'crypto';
import { PrismaClient } from '@tellann/db';
import * as OTPAuth from 'otpauth';
import * as bcrypt from 'bcryptjs';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

// ─── Constants ────────────────────────────────────────────────────────────────

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const BACKUP_CODE_COUNT     = 8;
const CHALLENGE_TTL_MS      = 5 * 60 * 1000;  // 5 minutes
const MAX_CHALLENGE_ATTEMPTS = 5;
const TOTP_ISSUER           = 'Tellann';

// ─── Encryption helpers ───────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const keyHex = process.env.MFA_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('MFA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(24 hex) + tag(32 hex) + ciphertext(hex)
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}

export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const iv        = Buffer.from(ciphertext.slice(0, 24), 'hex');
  const tag       = Buffer.from(ciphertext.slice(24, 56), 'hex');
  const encrypted = Buffer.from(ciphertext.slice(56), 'hex');
  const decipher  = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ─── TOTP helpers ─────────────────────────────────────────────────────────────

function createTOTP(secret: string, email: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

// ─── Backup codes ─────────────────────────────────────────────────────────────

export async function generateBackupCodes(): Promise<{ plain: string[]; hashed: string[] }> {
  const plain: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
    plain.push(code);
    hashed.push(await bcrypt.hash(code, 10));
  }

  return { plain, hashed };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Step 1: Generate a TOTP secret, persist it as *pending*, and return everything
 * the enrolment screen needs.
 *
 * The secret is stored encrypted with `totpEnabled` still false, so step 2 can
 * verify against a server-held value. Accepting the secret back from the client
 * would let a caller bind an authenticator of their choosing.
 *
 * The QR code is rendered here rather than by a third-party chart service: the
 * otpauth URI contains the shared secret and must not leave our infrastructure.
 */
export async function generateTOTPSetup(userId: string, email: string): Promise<{
  secret: string;      // base32 secret, for manual entry
  uri: string;         // otpauth:// URI
  qrDataUrl: string;   // data: URL holding the QR image
}> {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const totp = createTOTP(secret, email);
  const uri = totp.toString();

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: encryptSecret(secret),
      totpEnabled: false,
      totpEnabledAt: null,
    },
  });

  const qrDataUrl = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  });

  return { secret, uri, qrDataUrl };
}

/**
 * Step 2: Verify a code against the pending secret stored by `generateTOTPSetup`,
 * then activate TOTP and issue backup codes.
 */
export async function enableTOTP(
  userId: string,
  email: string,
  token: string,
): Promise<{ backupCodes: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user?.totpSecret) {
    throw Object.assign(new Error('Start MFA setup first'), { code: 'MFA_SETUP_NOT_STARTED' });
  }
  if (user.totpEnabled) {
    throw Object.assign(new Error('TOTP already enabled'), { code: 'MFA_ALREADY_ENABLED' });
  }

  const totp = createTOTP(decryptSecret(user.totpSecret), email);
  if (totp.validate({ token, window: 1 }) === null) {
    throw Object.assign(new Error('Invalid TOTP token'), { code: 'MFA_INVALID_TOKEN' });
  }

  const { plain, hashed } = await generateBackupCodes();

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpEnabled: true,
      totpEnabledAt: new Date(),
      totpBackupCodes: hashed,
      mfaMethod: 'TOTP',
    },
  });

  return { backupCodes: plain };
}

/** Abandons a started-but-unconfirmed enrolment. */
export async function cancelPendingTOTP(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabled: false, totpEnabledAt: null },
  });
}

/** Validates a TOTP code against the user's active secret. */
export async function verifyTOTPForUser(userId: string, email: string, token: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user?.totpEnabled || !user.totpSecret) return false;
  const totp = createTOTP(decryptSecret(user.totpSecret), email);
  return totp.validate({ token, window: 1 }) !== null;
}

/** Turns off every second factor, whichever method was active. */
export async function clearMfa(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpEnabled: false,
      totpSecret: null,
      totpEnabledAt: null,
      totpBackupCodes: [],
      mfaMethod: 'NONE',
    },
  });
}

/** Activates email-OTP as the second factor. The code is verified by the caller. */
export async function enableEmailOtpMfa(userId: string): Promise<{ backupCodes: string[] }> {
  const { plain, hashed } = await generateBackupCodes();
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaMethod: 'EMAIL_OTP',
      totpBackupCodes: hashed,
      // A stale enrolment secret must not linger once another method is chosen.
      totpEnabled: false,
      totpSecret: null,
      totpEnabledAt: null,
    },
  });
  return { backupCodes: plain };
}

/**
 * Disable TOTP for the user (requires current TOTP token to confirm identity).
 */
export async function disableTOTP(
  userId: string,
  email: string,
  token: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpSecret: true } });
  if (!user?.totpSecret) throw Object.assign(new Error('TOTP not enabled'), { code: 'MFA_NOT_ENABLED' });

  const plainSecret = decryptSecret(user.totpSecret);
  const totp        = createTOTP(plainSecret, email);
  const delta       = totp.validate({ token, window: 1 });

  if (delta === null) {
    throw Object.assign(new Error('Invalid TOTP token'), { code: 'MFA_INVALID_TOKEN' });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpEnabled:     false,
      totpSecret:      null,
      totpEnabledAt:   null,
      totpBackupCodes: [],
    },
  });
}

/**
 * Issue a short-lived MFA challenge token after first-factor verification.
 * Returns the raw challenge token (to be sent to the client as a cookie/response).
 */
export async function issueMfaChallengeToken(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  // Invalidate any existing un-used challenge tokens for this user
  await (prisma as any).mfaChallengeToken.deleteMany({
    where: { userId, usedAt: null },
  });

  await (prisma as any).mfaChallengeToken.create({
    data: { userId, tokenHash, expiresAt, ipAddress, userAgent },
  });

  return rawToken;
}

/**
 * Verify a TOTP token against an active MFA challenge.
 * On success, marks the challenge as used and returns the userId.
 */
export async function verifyMfaChallenge(
  rawChallengeToken: string,
  totpToken: string,
): Promise<{ userId: string }> {
  const tokenHash = crypto.createHash('sha256').update(rawChallengeToken).digest('hex');

  const challenge = await (prisma as any).mfaChallengeToken.findUnique({
    where: { tokenHash },
  });

  if (!challenge) {
    throw Object.assign(new Error('Invalid challenge token'), { code: 'MFA_INVALID_CHALLENGE' });
  }
  if (challenge.usedAt) {
    throw Object.assign(new Error('Challenge already used'), { code: 'MFA_CHALLENGE_USED' });
  }
  if (new Date() > challenge.expiresAt) {
    throw Object.assign(new Error('Challenge expired'), { code: 'MFA_CHALLENGE_EXPIRED' });
  }
  if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) {
    throw Object.assign(new Error('Too many attempts'), { code: 'MFA_TOO_MANY_ATTEMPTS' });
  }

  // Increment attempts before validating (prevents time-race abuse)
  await (prisma as any).mfaChallengeToken.update({
    where: { tokenHash },
    data: { attempts: { increment: 1 } },
  });

  const user = await prisma.user.findUnique({
    where: { id: challenge.userId },
    select: { totpSecret: true, email: true, id: true },
  });

  if (!user?.totpSecret) {
    throw Object.assign(new Error('TOTP not configured'), { code: 'MFA_NOT_CONFIGURED' });
  }

  const plainSecret = decryptSecret(user.totpSecret);
  const totp = createTOTP(plainSecret, user.email);
  const delta = totp.validate({ token: totpToken, window: 1 });

  if (delta === null) {
    throw Object.assign(new Error('Invalid TOTP token'), { code: 'MFA_INVALID_TOKEN' });
  }

  // Mark challenge as used
  await (prisma as any).mfaChallengeToken.update({
    where: { tokenHash },
    data: { usedAt: new Date() },
  });

  return { userId: user.id };
}

/**
 * Verify and consume a backup code for MFA.
 * Each code can only be used once.
 */
export async function verifyBackupCode(
  userId: string,
  rawChallengeToken: string,
  backupCode: string,
): Promise<{ userId: string }> {
  const tokenHash = crypto.createHash('sha256').update(rawChallengeToken).digest('hex');
  const challenge = await (prisma as any).mfaChallengeToken.findUnique({ where: { tokenHash } });

  if (!challenge || challenge.usedAt || new Date() > challenge.expiresAt) {
    throw Object.assign(new Error('Invalid or expired challenge token'), { code: 'MFA_INVALID_CHALLENGE' });
  }

  if (challenge.userId !== userId) {
    throw Object.assign(new Error('Challenge user mismatch'), { code: 'MFA_USER_MISMATCH' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpBackupCodes: true },
  });

  if (!user || user.totpBackupCodes.length === 0) {
    throw Object.assign(new Error('No backup codes available'), { code: 'MFA_NO_BACKUP_CODES' });
  }

  // Find and consume the matching backup code
  let matchIndex = -1;
  for (let i = 0; i < user.totpBackupCodes.length; i++) {
    if (await bcrypt.compare(backupCode.toUpperCase(), user.totpBackupCodes[i])) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) {
    throw Object.assign(new Error('Invalid backup code'), { code: 'MFA_INVALID_BACKUP_CODE' });
  }

  // Remove used backup code
  const updatedCodes = user.totpBackupCodes.filter((_, i) => i !== matchIndex);
  await prisma.user.update({
    where: { id: userId },
    data: { totpBackupCodes: updatedCodes },
  });

  // Mark challenge as used
  await (prisma as any).mfaChallengeToken.update({
    where: { tokenHash },
    data: { usedAt: new Date() },
  });

  return { userId };
}
