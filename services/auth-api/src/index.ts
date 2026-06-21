import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { PrismaClient, OtpPurpose, AuditAction, MemberRole, SubscriptionStatus } from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';

const app = express();
const prisma = new PrismaClient();
const entitlementChecker = new EntitlementChecker(prisma);

const PORT = process.env.PORT || 3013;
const JWT_SECRET = process.env.JWT_SECRET || 'sots-default-jwt-secret-change-in-production';

// Helpers
export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

type PreferredAuthMode = 'OTP' | 'PASSWORD';

const preferredAuthModes = new Set<PreferredAuthMode>(['OTP', 'PASSWORD']);

function normalizePreferredAuthMode(value: unknown): PreferredAuthMode | null {
  return typeof value === 'string' && preferredAuthModes.has(value as PreferredAuthMode)
    ? value as PreferredAuthMode
    : null;
}

function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number';
  }
  return null;
}

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  if (!storedHash) return false;
  const [scheme, salt, expected] = storedHash.split(':');
  if (scheme !== 'scrypt' || !salt || !expected) return false;

  const actual = await scryptAsync(password, salt);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

async function getUniqueOrgSlug(baseName: string): Promise<string> {
  const baseSlug = generateSlug(baseName);
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }
  return slug;
}

async function writeAuditLog(
  userId: string | null,
  orgId: string | null,
  action: AuditAction,
  req: Request,
  metadata?: any
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId: orgId,
        action,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
        metadata: metadata || {},
      },
    });
  } catch (err) {
    console.error(`[AuditLog] Failed to write audit log for ${action}`, err);
  }
}

async function emitActivationEvent(organizationId: string, eventName: string) {
  try {
    await prisma.activationEvent.create({
      data: {
        organizationId,
        eventName,
        metadata: {},
      },
    });
    console.log(`[ActivationEvent] Logged ${eventName} for org ${organizationId}`);
  } catch (err) {
    console.error(`[ActivationEvent] Failed to log ${eventName}`, err);
  }
}

// Cookie Options
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN || process.env.COOKIE_DOMAIN;
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  ...(cookieDomain ? { domain: cookieDomain } : {}),
};

async function issueAuthSession(req: Request, res: Response, user: any, isNewUser = false) {
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await writeAuditLog(user.id, user.memberships?.[0]?.organizationId || null, AuditAction.LOGIN_SUCCESS, req);

  const accessToken = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
  const rawRefresh = crypto.randomBytes(64).toString('hex');
  const refreshHash = sha256(rawRefresh);
  const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: refreshHash,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || null,
      expiresAt: refreshExpires,
    },
  });

  res.cookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', rawRefresh, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    preferredAuthMode: user.preferredAuthMode,
    hasPassword: Boolean(user.passwordHash),
    isNew: isNewUser,
  };
}

// Express Middlewares
app.use(express.json());
app.use(cookieParser());

// Dynamic CORS configuration to allow credential sharing with the gateway and dashboard
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
}));

// Rate Limiters
const otpEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body.email || req.ip || '',
  message: { error: 'OTP_RATE_LIMITED', message: 'Too many OTP requests for this email. Please try again after 15 minutes.' }
});

const otpIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || '',
  message: { error: 'IP_RATE_LIMITED', message: 'Too many requests from this IP. Please try again later.' }
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body.email || req.ip || '',
  message: { error: 'VERIFICATION_LOCKED', message: 'Too many failed verification attempts. Lockout active for 15 minutes.' }
});

// Auth Middleware for protected routes
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

async function verifyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies['access_token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'No access token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
    req.user = {
      id: decoded.sub,
      email: decoded.email,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'TOKEN_EXPIRED_OR_INVALID', message: 'Invalid or expired access token' });
  }
}

// ─────────────────────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'auth-api' });
});

// Identify user check
app.post('/auth/identify', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'EMAIL_REQUIRED', message: 'Email address is required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    res.json({
      exists: !!user,
      preferredAuthMode: user?.preferredAuthMode || 'OTP',
      hasPassword: Boolean(user?.passwordHash),
    });
  } catch (err) {
    console.error('[Identify] Error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Identify check failed' });
  }
});

// Send OTP
app.post('/auth/send-otp', otpEmailLimiter, otpIpLimiter, async (req: Request, res: Response) => {
  const { email, purpose } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'EMAIL_REQUIRED', message: 'Email is required' });
  }
  if (!purpose || !Object.values(OtpPurpose).includes(purpose as OtpPurpose)) {
    return res.status(400).json({ error: 'INVALID_PURPOSE', message: 'Invalid OTP purpose' });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create OTP record in database
    await prisma.otpCode.create({
      data: {
        email: cleanEmail,
        codeHash,
        purpose: purpose as OtpPurpose,
        expiresAt,
        ipAddress: req.ip,
      },
    });

    // Write audit log
    await writeAuditLog(null, null, AuditAction.OTP_SENT, req, { email: cleanEmail, purpose });

    // Developer fallback logic for local development if no mailer configured
    console.log(`\n==================================================\n[OTP FLOW - LOCAL DEV] Sent OTP: ${code} to email: ${cleanEmail}\n==================================================\n`);

    res.json({ sent: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('[Send OTP] Error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to send OTP' });
  }
});

// Verify OTP
app.post('/auth/verify-otp', verifyLimiter, async (req: Request, res: Response) => {
  const { email, code, purpose } = req.body;
  if (!email || !code || !purpose) {
    return res.status(400).json({ error: 'FIELDS_REQUIRED', message: 'Email, code, and purpose are required' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const hashedInput = sha256(code);

  try {
    // Find active unused OTP code
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        email: cleanEmail,
        purpose: purpose as OtpPurpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord || otpRecord.codeHash !== hashedInput) {
      await writeAuditLog(null, null, AuditAction.OTP_FAILED, req, { email: cleanEmail, purpose });
      return res.status(400).json({ error: 'INVALID_OTP', message: 'The OTP code is invalid or has expired' });
    }

    // Mark as used
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    await writeAuditLog(null, null, AuditAction.OTP_VERIFIED, req, { email: cleanEmail, purpose });

    let user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { memberships: true },
    });

    let isNewUser = false;

    if (!user) {
      if (purpose !== OtpPurpose.SIGNUP) {
        return res.status(400).json({ error: 'USER_NOT_FOUND', message: 'Registration required' });
      }
      isNewUser = true;

      // Handle new user creation and auto-org provisioning
      const baseOrgName = `${cleanEmail.split('@')[0]} Org`;
      const orgSlug = await getUniqueOrgSlug(baseOrgName);

      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: { email: cleanEmail },
        });

        const newOrg = await tx.organization.create({
          data: {
            name: baseOrgName,
            slug: orgSlug,
            createdByUserId: newUser.id,
          },
        });

        await tx.organizationMembership.create({
          data: {
            userId: newUser.id,
            organizationId: newOrg.id,
            role: MemberRole.OWNER,
          },
        });

        return tx.user.findUniqueOrThrow({
          where: { id: newUser.id },
          include: { memberships: true },
        });
      });

      // Assign Free plan to the newly created Organization
      const firstOrg = user.memberships[0].organizationId;
      await entitlementChecker.resolveEntitlement(firstOrg);
      await emitActivationEvent(firstOrg, 'ORG_CREATED');
      await writeAuditLog(user.id, firstOrg, AuditAction.USER_CREATED, req);
    }

    res.json({ user: await issueAuthSession(req, res, user, isNewUser) });
  } catch (err) {
    console.error('[Verify OTP] Error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Verification failed' });
  }
});

// Password login
app.post('/auth/login-password', verifyLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'FIELDS_REQUIRED', message: 'Email and password are required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { memberships: true },
    });

    const isValid = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !isValid) {
      await writeAuditLog(user?.id || null, user?.memberships?.[0]?.organizationId || null, AuditAction.LOGIN_FAILED, req, { email: cleanEmail, method: 'PASSWORD' });
      return res.status(400).json({ error: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' });
    }

    res.json({ user: await issueAuthSession(req, res, user, false) });
  } catch (err) {
    console.error('[Password Login] Error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Password login failed' });
  }
});

// Refresh token rotation
app.post('/auth/refresh', async (req: Request, res: Response) => {
  const oldRawRefresh = req.cookies['refresh_token'];
  if (!oldRawRefresh) {
    return res.status(401).json({ error: 'REFRESH_TOKEN_REQUIRED', message: 'Refresh token cookie is missing' });
  }

  const oldHash = sha256(oldRawRefresh);

  try {
    const session = await prisma.userSession.findFirst({
      where: {
        refreshTokenHash: oldHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session) {
      return res.status(401).json({ error: 'SESSION_INVALID', message: 'Invalid or expired session' });
    }

    // Revoke old session (Rotation)
    await prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await writeAuditLog(session.userId, null, AuditAction.SESSION_REFRESHED, req);

    // Issue new tokens
    const accessToken = jwt.sign({ sub: session.userId, email: session.user.email }, JWT_SECRET, { expiresIn: '15m' });

    const newRawRefresh = crypto.randomBytes(64).toString('hex');
    const newRefreshHash = sha256(newRawRefresh);
    const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.userSession.create({
      data: {
        userId: session.userId,
        refreshTokenHash: newRefreshHash,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
        expiresAt: refreshExpires,
      },
    });

    res.cookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', newRawRefresh, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.json({ success: true });
  } catch (err) {
    console.error('[Refresh] Error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Session refresh failed' });
  }
});

// Logout
app.post('/auth/logout', async (req: Request, res: Response) => {
  const refreshCookie = req.cookies['refresh_token'];
  if (refreshCookie) {
    const hash = sha256(refreshCookie);
    try {
      const session = await prisma.userSession.findUnique({ where: { refreshTokenHash: hash } });
      if (session) {
        await prisma.userSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        await writeAuditLog(session.userId, null, AuditAction.LOGOUT, req);
      }
    } catch (err) {
      console.error('[Logout] Revocation failed', err);
    }
  }

  res.clearCookie('access_token', COOKIE_OPTS);
  res.clearCookie('refresh_token', COOKIE_OPTS);
  res.json({ success: true });
});

// Get user profile (Verify session)
app.get('/auth/me', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        memberships: {
          include: {
            organization: {
              include: {
                subscription: {
                  include: {
                    plan: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User record not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        preferredAuthMode: user.preferredAuthMode,
        hasPassword: Boolean(user.passwordHash),
      },
      memberships: user.memberships.map(m => ({
        id: m.id,
        role: m.role,
        organization: {
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          subscription: m.organization.subscription ? {
            planName: m.organization.subscription.plan.name,
            planType: m.organization.subscription.plan.type,
            status: m.organization.subscription.status,
          } : null,
        },
      })),
    });
  } catch (err) {
    console.error('[Me] Error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve profile' });
  }
});

// Update profile
app.patch('/auth/me', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const { displayName } = req.body;
  if (displayName === undefined || typeof displayName !== 'string') {
    return res.status(400).json({ error: 'DISPLAY_NAME_REQUIRED', message: 'displayName must be a string' });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { displayName: displayName.trim() || null },
    });

    res.json({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      preferredAuthMode: updated.preferredAuthMode,
      hasPassword: Boolean(updated.passwordHash),
    });
  } catch (err) {
    console.error('[Patch Me] Error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Profile update failed' });
  }
});

// Set or change password and optionally switch preferred auth mode.
app.post('/auth/password', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const { currentPassword, newPassword, preferredAuthMode } = req.body;
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: 'INVALID_PASSWORD', message: passwordError });
  }

  const requestedAuthMode = normalizePreferredAuthMode(preferredAuthMode);

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { memberships: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User record not found' });
    }

    const hadPassword = Boolean(user.passwordHash);
    if (hadPassword) {
      const currentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!currentPasswordValid) {
        return res.status(400).json({ error: 'CURRENT_PASSWORD_INVALID', message: 'Current password is incorrect' });
      }
    }

    const passwordHash = await hashPassword(newPassword);
    const nextAuthMode = requestedAuthMode || user.preferredAuthMode;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date(),
        preferredAuthMode: nextAuthMode,
      },
    });

    await writeAuditLog(
      user.id,
      user.memberships[0]?.organizationId || null,
      hadPassword ? AuditAction.PASSWORD_CHANGED : AuditAction.PASSWORD_SET,
      req,
      { preferredAuthMode: nextAuthMode },
    );

    if (nextAuthMode !== user.preferredAuthMode) {
      await writeAuditLog(user.id, user.memberships[0]?.organizationId || null, AuditAction.PREFERRED_AUTH_CHANGED, req, {
        from: user.preferredAuthMode,
        to: nextAuthMode,
      });
    }

    res.json({
      id: updated.id,
      email: updated.email,
      preferredAuthMode: updated.preferredAuthMode,
      hasPassword: Boolean(updated.passwordHash),
      passwordUpdatedAt: updated.passwordUpdatedAt,
    });
  } catch (err) {
    console.error('[Password Set] Error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Password update failed' });
  }
});

// Change preferred first-factor authentication mode.
app.patch('/auth/preferred-auth-mode', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const preferredAuthMode = normalizePreferredAuthMode(req.body.preferredAuthMode);
  if (!preferredAuthMode) {
    return res.status(400).json({ error: 'INVALID_AUTH_MODE', message: 'preferredAuthMode must be OTP or PASSWORD' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { memberships: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User record not found' });
    }

    if (preferredAuthMode === 'PASSWORD' && !user.passwordHash) {
      return res.status(400).json({
        error: 'PASSWORD_REQUIRED',
        message: 'Set a password before switching your preferred authentication mode to email and password.',
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { preferredAuthMode },
    });

    if (preferredAuthMode !== user.preferredAuthMode) {
      await writeAuditLog(user.id, user.memberships[0]?.organizationId || null, AuditAction.PREFERRED_AUTH_CHANGED, req, {
        from: user.preferredAuthMode,
        to: preferredAuthMode,
      });
    }

    res.json({
      preferredAuthMode: updated.preferredAuthMode,
      hasPassword: Boolean(updated.passwordHash),
    });
  } catch (err) {
    console.error('[Preferred Auth Mode] Error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Preferred authentication update failed' });
  }
});

app.listen(PORT, () => {
  console.log(`[AuthAPI] Service running on port ${PORT}`);
});
