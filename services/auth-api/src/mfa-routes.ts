/**
 * MFA HTTP surface.
 *
 * Enrolment and management live under `/auth/mfa/*` and require a session.
 * The login challenge (`/auth/mfa/challenge/*`) deliberately does not: the
 * caller has passed the first factor but holds no session yet, so it is
 * authenticated by the short-lived `mfa_challenge` cookie instead.
 */

import { Request, Response, Router } from 'express';
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { AuditAction, OtpPurpose, PrismaClient } from '@tellann/db';
import { NotificationEmailService, buildIdempotencyKey, appUrl } from '@tellann/email';
import {
  cancelPendingTOTP,
  clearMfa,
  enableEmailOtpMfa,
  enableTOTP,
  generateTOTPSetup,
  issueMfaChallengeToken,
  verifyBackupCode,
  verifyTOTPForUser,
} from './mfa';

/** Name of the cookie carrying an in-flight login challenge. */
export const MFA_CHALLENGE_COOKIE = 'mfa_challenge';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const EMAIL_OTP_TTL_MINUTES = 10;

export interface MfaRouterDeps {
  prisma: PrismaClient;
  emailService: NotificationEmailService;
  /** Session guard used by the rest of auth-api. */
  verifyAuth: RequestHandler;
  /** Issues the real session once the second factor passes. */
  issueAuthSession: (req: Request, res: Response, user: any, isNewUser?: boolean) => Promise<any>;
  cookieOptions: (maxAgeMs: number) => Record<string, unknown>;
  sha256: (value: string) => string;
  /** auth-api's own audit helper, which carries the request context for us. */
  writeAuditLog: (
    userId: string | null,
    orgId: string | null,
    action: AuditAction,
    req: Request,
    metadata?: unknown,
  ) => Promise<void>;
}

interface AuthedRequest extends Request {
  user?: { id: string; email: string };
}

function sixDigitCode(): string {
  // crypto rather than Math.random: this is an authentication secret.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * The router also exposes `beginChallenge`, which the login routes call to start
 * the second-factor step. It lives here so the challenge cookie, the emailed
 * code and the verification endpoint all stay in one module.
 */
export type MfaRouterWithChallenge = Router & {
  beginChallenge: (
    req: Request,
    res: Response,
    user: { id: string; email: string; mfaMethod: string },
  ) => Promise<{ mfaRequired: true; method: string; expiresInSeconds: number }>;
};

export function createMfaRouter(deps: MfaRouterDeps): MfaRouterWithChallenge {
  const {
    prisma, emailService, verifyAuth,
    issueAuthSession, cookieOptions, sha256, writeAuditLog,
  } = deps;
  const router = Router();

  /**
   * Throttles code entry.
   *
   * Deliberately not the shared `verifyLimiter`: that keys on IP and allows five
   * requests per quarter hour, so one person fat-fingering a code would lock out
   * everyone behind the same NAT. This keys on the identity being challenged —
   * the signed-in user, or the challenge token mid-login — and only counts
   * failures, so a legitimate user is never punished for succeeding.
   *
   * The real brute-force ceiling is the per-challenge attempt counter in the
   * database; this is the outer guard.
   */
  const codeEntryLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req: Request) =>
      (req as AuthedRequest).user?.id
      || (req.cookies?.[MFA_CHALLENGE_COOKIE] ? sha256(req.cookies[MFA_CHALLENGE_COOKIE]) : '')
      || req.ip
      || '',
    message: {
      error: 'MFA_RATE_LIMITED',
      message: 'Too many incorrect codes. Wait a few minutes and try again.',
    },
  });

  /** Sends a second-factor code to the address on the account. */
  async function dispatchEmailOtp(user: { id: string; email: string }, req: Request): Promise<void> {
    const code = sixDigitCode();
    await prisma.otpCode.create({
      data: {
        email: user.email,
        codeHash: sha256(code),
        purpose: OtpPurpose.MFA,
        expiresAt: new Date(Date.now() + EMAIL_OTP_TTL_MINUTES * 60 * 1000),
        ipAddress: req.ip ?? null,
      },
    });

    void emailService.sendTransactional({
      templateKey: 'auth-otp',
      to: user.email,
      eventType: 'MFA_OTP_SENT',
      severity: 'HIGH',
      variables: {
        code,
        purpose: 'two-factor authentication',
        expiresInMinutes: EMAIL_OTP_TTL_MINUTES,
        appUrl: appUrl('/auth/login'),
      },
      idempotencyKey: buildIdempotencyKey(['mfa-otp', user.id, code]),
    }).catch((err) => console.error('[MFA] email OTP send failed', err));

    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[MFA - LOCAL DEV] Second-factor code for ${user.email}: ${code}\n`);
    }
  }

  /** Consumes a second-factor email code, or returns false. */
  async function consumeEmailOtp(email: string, code: string): Promise<boolean> {
    const record = await prisma.otpCode.findFirst({
      where: {
        email,
        purpose: OtpPurpose.MFA,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.codeHash !== sha256(code)) return false;
    await prisma.otpCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return true;
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  router.get('/auth/mfa/status', verifyAuth, async (req: AuthedRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { totpEnabled: true, mfaMethod: true, totpBackupCodes: true, totpEnabledAt: true },
    });
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    res.json({
      totpEnabled: user.totpEnabled,
      mfaMethod: user.mfaMethod,
      mfaEnabled: user.mfaMethod !== 'NONE',
      backupCodesRemaining: user.totpBackupCodes.length,
      enabledAt: user.totpEnabledAt,
    });
  });

  // ─── TOTP enrolment ────────────────────────────────────────────────────────

  router.post('/auth/mfa/setup', verifyAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const setup = await generateTOTPSetup(req.user!.id, req.user!.email);
      res.json(setup);
    } catch (err: any) {
      console.error('[MFA] setup failed', err);
      // A missing or malformed MFA_ENCRYPTION_KEY is a deployment fault, not a
      // client one, and is worth saying plainly rather than as a generic 500.
      if (String(err?.message ?? '').includes('MFA_ENCRYPTION_KEY')) {
        return res.status(503).json({
          error: 'MFA_NOT_CONFIGURED',
          message: 'Two-factor authentication is not configured on this server.',
        });
      }
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not start MFA setup' });
    }
  });

  router.post('/auth/mfa/enable', verifyAuth, codeEntryLimiter, async (req: AuthedRequest, res: Response) => {
    const token = String(req.body?.token ?? '').trim();
    if (!/^\d{6}$/.test(token)) {
      return res.status(400).json({ error: 'Enter the 6-digit code from your authenticator app' });
    }
    try {
      const { backupCodes } = await enableTOTP(req.user!.id, req.user!.email, token);
      await writeAuditLog(req.user!.id, null, AuditAction.LOGIN_SUCCESS, req, { event: 'MFA_ENABLED', method: 'TOTP' });
      res.json({ backupCodes, mfaMethod: 'TOTP' });
    } catch (err: any) {
      const status = err?.code === 'MFA_INVALID_TOKEN' ? 400 : 409;
      res.status(status).json({ error: err?.message ?? 'Could not enable MFA', code: err?.code });
    }
  });

  router.post('/auth/mfa/setup/cancel', verifyAuth, async (req: AuthedRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { totpEnabled: true },
    });
    // Never wipe a live secret through the cancel path.
    if (user?.totpEnabled) return res.status(409).json({ error: 'MFA_ALREADY_ENABLED' });
    await cancelPendingTOTP(req.user!.id);
    res.json({ ok: true });
  });

  // ─── Email-OTP enrolment ───────────────────────────────────────────────────

  router.post('/auth/mfa/email/send', verifyAuth, codeEntryLimiter, async (req: AuthedRequest, res: Response) => {
    await dispatchEmailOtp(req.user!, req);
    res.json({ sent: true, expiresInMinutes: EMAIL_OTP_TTL_MINUTES });
  });

  router.post('/auth/mfa/email/enable', verifyAuth, codeEntryLimiter, async (req: AuthedRequest, res: Response) => {
    const code = String(req.body?.code ?? '').trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Enter the 6-digit code sent to your email' });
    }
    if (!(await consumeEmailOtp(req.user!.email, code))) {
      return res.status(400).json({ error: 'That code is invalid or has expired' });
    }
    const { backupCodes } = await enableEmailOtpMfa(req.user!.id);
    await writeAuditLog(req.user!.id, null, AuditAction.LOGIN_SUCCESS, req, { event: 'MFA_ENABLED', method: 'EMAIL_OTP' });
    res.json({ backupCodes, mfaMethod: 'EMAIL_OTP' });
  });

  // ─── Disable ───────────────────────────────────────────────────────────────

  /**
   * Turning MFA off is exactly what an account thief wants, so it re-checks
   * identity: a current second-factor code, a backup code, or the password.
   */
  router.post('/auth/mfa/disable', verifyAuth, codeEntryLimiter, async (req: AuthedRequest, res: Response) => {
    const token = String(req.body?.token ?? '').trim();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, mfaMethod: true, passwordHash: true, totpBackupCodes: true },
    });
    if (!user || user.mfaMethod === 'NONE') {
      return res.status(409).json({ error: 'Two-factor authentication is not enabled' });
    }

    let confirmed = false;

    if (token) {
      if (user.mfaMethod === 'TOTP') {
        confirmed = await verifyTOTPForUser(user.id, user.email, token);
      } else if (user.mfaMethod === 'EMAIL_OTP') {
        confirmed = await consumeEmailOtp(user.email, token);
      }
      if (!confirmed) {
        // Backup codes are a valid confirmation too — a user who lost their
        // authenticator still needs a way to turn MFA off.
        confirmed = await consumeBackupCodeDirect(user.id, token);
      }
    }

    if (!confirmed && password && user.passwordHash) {
      const bcrypt = await import('bcryptjs');
      confirmed = await bcrypt.compare(password, user.passwordHash);
    }

    if (!confirmed) {
      return res.status(400).json({ error: 'That confirmation was not accepted. Try again.' });
    }

    await clearMfa(user.id);
    await writeAuditLog(user.id, null, AuditAction.LOGIN_SUCCESS, req, { event: 'MFA_DISABLED' });
    res.json({ ok: true, mfaMethod: 'NONE' });
  });

  /** Consumes a backup code outside the login-challenge flow. */
  async function consumeBackupCodeDirect(userId: string, code: string): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totpBackupCodes: true },
    });
    if (!user?.totpBackupCodes.length) return false;

    for (let i = 0; i < user.totpBackupCodes.length; i++) {
      if (await bcrypt.compare(code.toUpperCase(), user.totpBackupCodes[i])) {
        await prisma.user.update({
          where: { id: userId },
          data: { totpBackupCodes: user.totpBackupCodes.filter((_, index) => index !== i) },
        });
        return true;
      }
    }
    return false;
  }

  // ─── Login challenge ───────────────────────────────────────────────────────

  /**
   * Called by the login routes once the first factor passes. Issues the
   * challenge cookie and, for email OTP, dispatches the code immediately so the
   * user finds it waiting.
   */
  async function beginChallenge(req: Request, res: Response, user: { id: string; email: string; mfaMethod: string }) {
    const rawToken = await issueMfaChallengeToken(
      user.id,
      req.ip ?? undefined,
      req.headers['user-agent'] ?? undefined,
    );
    res.cookie(MFA_CHALLENGE_COOKIE, rawToken, cookieOptions(CHALLENGE_TTL_MS));

    if (user.mfaMethod === 'EMAIL_OTP') {
      await dispatchEmailOtp(user, req);
    }

    return {
      mfaRequired: true,
      method: user.mfaMethod,
      expiresInSeconds: Math.floor(CHALLENGE_TTL_MS / 1000),
    };
  }

  router.post('/auth/mfa/challenge/resend', codeEntryLimiter, async (req: Request, res: Response) => {
    const raw = req.cookies?.[MFA_CHALLENGE_COOKIE];
    if (!raw) return res.status(401).json({ error: 'No active sign-in challenge' });

    const challenge = await prisma.mfaChallengeToken.findUnique({
      where: { tokenHash: crypto.createHash('sha256').update(raw).digest('hex') },
    });
    if (!challenge || challenge.usedAt || new Date() > challenge.expiresAt) {
      return res.status(401).json({ error: 'This sign-in challenge has expired. Start again.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      select: { id: true, email: true, mfaMethod: true },
    });
    if (!user || user.mfaMethod !== 'EMAIL_OTP') {
      return res.status(400).json({ error: 'This account does not use emailed codes' });
    }

    await dispatchEmailOtp(user, req);
    res.json({ sent: true });
  });

  router.post('/auth/mfa/challenge/verify', codeEntryLimiter, async (req: Request, res: Response) => {
    const raw = req.cookies?.[MFA_CHALLENGE_COOKIE];
    const code = String(req.body?.code ?? '').trim();
    const useBackupCode = req.body?.useBackupCode === true;

    if (!raw) return res.status(401).json({ error: 'No active sign-in challenge. Start again.' });
    if (!code) return res.status(400).json({ error: 'Enter your verification code' });

    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const challenge = await prisma.mfaChallengeToken.findUnique({ where: { tokenHash } });
    if (!challenge || challenge.usedAt || new Date() > challenge.expiresAt) {
      return res.status(401).json({ error: 'This sign-in challenge has expired. Start again.' });
    }
    if (challenge.attempts >= 5) {
      return res.status(429).json({ error: 'Too many attempts. Start again.' });
    }
    // Count the attempt before checking, so a race cannot buy extra tries.
    await prisma.mfaChallengeToken.update({
      where: { tokenHash },
      data: { attempts: { increment: 1 } },
    });

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      include: { memberships: true },
    });
    if (!user) return res.status(401).json({ error: 'Account not found' });

    try {
      if (useBackupCode) {
        await verifyBackupCode(user.id, raw, code);
      } else if (user.mfaMethod === 'TOTP') {
        if (!(await verifyTOTPForUser(user.id, user.email, code))) {
          throw Object.assign(new Error('That code is not valid'), { code: 'MFA_INVALID_TOKEN' });
        }
        await prisma.mfaChallengeToken.update({ where: { tokenHash }, data: { usedAt: new Date() } });
      } else if (user.mfaMethod === 'EMAIL_OTP') {
        if (!(await consumeEmailOtp(user.email, code))) {
          throw Object.assign(new Error('That code is invalid or has expired'), { code: 'MFA_INVALID_TOKEN' });
        }
        await prisma.mfaChallengeToken.update({ where: { tokenHash }, data: { usedAt: new Date() } });
      } else {
        return res.status(409).json({ error: 'Two-factor authentication is not enabled for this account' });
      }
    } catch (err: any) {
      await writeAuditLog(user.id, user.memberships?.[0]?.organizationId ?? null, AuditAction.LOGIN_FAILED, req, {
        event: 'MFA_FAILED',
        method: user.mfaMethod,
      });
      return res.status(400).json({ error: err?.message ?? 'That code is not valid', code: err?.code });
    }

    // Second factor cleared — the challenge is spent and the real session issues.
    res.clearCookie(MFA_CHALLENGE_COOKIE, cookieOptions(0));
    res.json({ user: await issueAuthSession(req, res, user, false) });
  });

  return Object.assign(router, { beginChallenge }) as MfaRouterWithChallenge;
}
