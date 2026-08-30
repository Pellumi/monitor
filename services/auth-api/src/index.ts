import { initTracing } from '@tellann/telemetry';
initTracing('auth-api');

import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { PrismaClient, OtpPurpose, AuditAction, MemberRole, SubscriptionStatus } from '@tellann/db';
import { EntitlementChecker } from '@tellann/entitlement-checker';
import { Feature } from '@tellann/shared';
import { NotificationEmailService, appUrl, buildIdempotencyKey } from '@tellann/email';
import { permissionsForRole } from '@tellann/authz';
import {
  createOIDCProvider,
  deleteOIDCProvider,
  findOIDCProviderByEmailDomain,
  getOIDCProviderForOrg,
  updateOIDCProvider,
} from './oidc';

const app = express();
const prisma = new PrismaClient();
const entitlementChecker = new EntitlementChecker(prisma);
const emailService = new NotificationEmailService(prisma);

const PORT = process.env.PORT || 3013;
const JWT_SECRET = process.env.JWT_SECRET || 'tellann-default-jwt-secret-change-in-production';

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

function base64UrlSha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('base64url');
}

function issueDesktopAccessToken(user: { id: string; email: string }, deviceSessionId: string) {
  return jwt.sign(
    { sub: user.id, email: user.email, deviceSessionId, client: 'desktop' },
    JWT_SECRET,
    { expiresIn: '15m' },
  );
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
  const userAgent = req.headers['user-agent'] || null;
  const ipAddress = req.ip || null;
  const seenDevice = await prisma.userSession.findFirst({
    where: {
      userId: user.id,
      userAgent,
      ipAddress,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await writeAuditLog(user.id, user.memberships?.[0]?.organizationId || null, AuditAction.LOGIN_SUCCESS, req);

  const adminRecord = await prisma.systemAdmin.findFirst({
    where: {
      userId: user.id,
      revokedAt: null,
    },
    select: { id: true },
  });
  const isSystemAdmin = adminRecord !== null;

  const accessToken = jwt.sign({ sub: user.id, email: user.email, isSystemAdmin }, JWT_SECRET, { expiresIn: '15m' });
  const rawRefresh = crypto.randomBytes(64).toString('hex');
  const refreshHash = sha256(rawRefresh);
  const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: refreshHash,
      userAgent,
      ipAddress,
      expiresAt: refreshExpires,
    },
  });

  if (!isNewUser && !seenDevice) {
    void emailService.sendTransactional({
      templateKey: 'security-new-device',
      to: user.email,
      userId: user.id,
      organizationId: user.memberships?.[0]?.organizationId || null,
      eventType: 'SECURITY_NEW_DEVICE',
      severity: 'HIGH',
      variables: {
        ipAddress: ipAddress || 'Unknown IP',
        userAgent: userAgent || 'Unknown browser',
        securityUrl: appUrl('/settings/profile'),
      },
      idempotencyKey: buildIdempotencyKey(['security-new-device', user.id, ipAddress, userAgent]),
    }).catch((err) => console.error('[Email] security-new-device failed', err));
  }

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
    isSystemAdmin,
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
    const activeUser = await prisma.user.findUnique({ where: { id: decoded.sub }, select: { deletedAt: true, deletionStatus: true } });
    if (!activeUser || activeUser.deletedAt) {
      return res.status(403).json({ error: 'ACCOUNT_DELETION_PENDING', message: 'This account is scheduled for deletion. Contact support before the purge date to request restoration.' });
    }
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

app.post('/auth/desktop/authorize', async (req: Request, res: Response) => {
  const { codeChallenge, deviceIdentifier, deviceName, platform, appVersion, scopes } = req.body ?? {};
  if (
    typeof codeChallenge !== 'string' ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge) ||
    typeof deviceIdentifier !== 'string' ||
    typeof deviceName !== 'string' ||
    typeof platform !== 'string' ||
    typeof appVersion !== 'string'
  ) {
    return res.status(400).json({ error: 'INVALID_DESKTOP_AUTH_REQUEST' });
  }
  const requestedScopes = Array.isArray(scopes)
    ? scopes.filter((scope: unknown): scope is string => typeof scope === 'string').slice(0, 20)
    : ['desktop:guided-runs'];
  const requestToken = crypto.randomBytes(48).toString('base64url');
  const authorization = await prisma.desktopAuthorizationRequest.create({
    data: {
      requestTokenHash: sha256(requestToken),
      codeChallenge,
      challengeMethod: 'S256',
      deviceIdentifier: deviceIdentifier.slice(0, 200),
      deviceName: deviceName.slice(0, 120),
      platform: platform.slice(0, 50),
      appVersion: appVersion.slice(0, 50),
      scopes: requestedScopes,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  res.status(201).json({
    requestId: authorization.id,
    requestToken,
    authorizeUrl: appUrl(`/auth/login?desktopRequest=${encodeURIComponent(requestToken)}`),
    expiresAt: authorization.expiresAt.toISOString(),
    pollingIntervalSeconds: 2,
  });
});

app.post('/auth/desktop/authorize/complete', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const requestToken = typeof req.body?.requestToken === 'string' ? req.body.requestToken : '';
  const authorization = await prisma.desktopAuthorizationRequest.findUnique({
    where: { requestTokenHash: sha256(requestToken) },
  });
  if (!authorization || authorization.expiresAt <= new Date() || authorization.consumedAt) {
    return res.status(400).json({ error: 'DESKTOP_AUTH_REQUEST_EXPIRED' });
  }
  await prisma.desktopAuthorizationRequest.update({
    where: { id: authorization.id },
    data: { userId: req.user!.id, authorizedAt: new Date() },
  });
  res.json({ success: true });
});

app.post('/auth/desktop/token', async (req: Request, res: Response) => {
  const requestToken = typeof req.body?.requestToken === 'string' ? req.body.requestToken : '';
  const codeVerifier = typeof req.body?.codeVerifier === 'string' ? req.body.codeVerifier : '';
  const authorization = await prisma.desktopAuthorizationRequest.findUnique({
    where: { requestTokenHash: sha256(requestToken) },
  });
  if (!authorization) return res.status(400).json({ error: 'INVALID_DESKTOP_AUTH_REQUEST' });
  if (!authorization.authorizedAt || !authorization.userId) {
    return res.status(428).json({ error: 'AUTHORIZATION_PENDING' });
  }
  if (authorization.expiresAt <= new Date() || authorization.consumedAt) {
    return res.status(400).json({ error: 'DESKTOP_AUTH_REQUEST_EXPIRED' });
  }
  if (base64UrlSha256(codeVerifier) !== authorization.codeChallenge) {
    return res.status(400).json({ error: 'PKCE_VERIFICATION_FAILED' });
  }
  const user = await prisma.user.findUnique({ where: { id: authorization.userId } });
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  const rawRefreshToken = crypto.randomBytes(64).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const device = await prisma.$transaction(async (tx) => {
    await tx.desktopAuthorizationRequest.update({
      where: { id: authorization.id },
      data: { consumedAt: new Date() },
    });
    return tx.deviceSession.upsert({
      where: {
        userId_deviceIdentifier: {
          userId: user.id,
          deviceIdentifier: authorization.deviceIdentifier,
        },
      },
      create: {
        userId: user.id,
        deviceIdentifier: authorization.deviceIdentifier,
        deviceName: authorization.deviceName,
        platform: authorization.platform,
        appVersion: authorization.appVersion,
        scopes: authorization.scopes,
        refreshTokenHash: sha256(rawRefreshToken),
        expiresAt,
      },
      update: {
        deviceName: authorization.deviceName,
        platform: authorization.platform,
        appVersion: authorization.appVersion,
        scopes: authorization.scopes,
        refreshTokenHash: sha256(rawRefreshToken),
        expiresAt,
        revokedAt: null,
        lastSeenAt: new Date(),
      },
    });
  });
  res.json({
    accessToken: issueDesktopAccessToken(user, device.id),
    refreshToken: rawRefreshToken,
    expiresIn: 15 * 60,
    deviceSessionId: device.id,
    user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl },
  });
});

app.post('/auth/desktop/refresh', async (req: Request, res: Response) => {
  const rawRefreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
  const session = await prisma.deviceSession.findUnique({
    where: { refreshTokenHash: sha256(rawRefreshToken) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return res.status(401).json({ error: 'DESKTOP_SESSION_INVALID' });
  }
  const nextRefreshToken = crypto.randomBytes(64).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.deviceSession.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: sha256(nextRefreshToken),
      expiresAt,
      lastSeenAt: new Date(),
    },
  });
  res.json({
    accessToken: issueDesktopAccessToken(session.user, session.id),
    refreshToken: nextRefreshToken,
    expiresIn: 15 * 60,
  });
});

app.get('/auth/desktop/devices', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const devices = await prisma.deviceSession.findMany({
    where: { userId: req.user!.id },
    orderBy: { lastSeenAt: 'desc' },
    select: {
      id: true,
      deviceName: true,
      platform: true,
      appVersion: true,
      scopes: true,
      lastSeenAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  res.json(devices);
});

app.delete('/auth/desktop/devices/:deviceId', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const device = await prisma.deviceSession.findUnique({ where: { id: req.params.deviceId } });
  if (!device || device.userId !== req.user!.id) return res.status(404).json({ error: 'DEVICE_NOT_FOUND' });
  await prisma.deviceSession.update({ where: { id: device.id }, data: { revokedAt: new Date() } });
  res.status(204).send();
});

async function requireEnterpriseIdentityManager(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  const orgId = req.params.orgId;
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: req.user!.id, organizationId: orgId } },
  });
  if (!membership || (membership.role !== MemberRole.OWNER && membership.role !== MemberRole.ADMIN)) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Only organization Owners and Admins may configure SSO.' });
    return false;
  }
  const allowed = await entitlementChecker.canAccess(orgId, Feature.OIDC);
  if (!allowed) {
    const entitlement = await entitlementChecker.getEntitlement(orgId);
    res.status(403).json({
      error: 'FEATURE_NOT_ENTITLED',
      feature: Feature.OIDC,
      currentPlan: entitlement.planType,
      minimumPlan: 'ENTERPRISE',
      upgradeUrl: '/settings/billing',
    });
    return false;
  }
  return true;
}

app.post('/auth/oidc/identify', async (req: Request, res: Response) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'EMAIL_REQUIRED' });
  const provider = await findOIDCProviderByEmailDomain(email);
  res.json(provider ? { available: true, provider: { displayName: provider.displayName, providerPreset: provider.providerPreset } } : { available: false });
});

app.get('/auth/organizations/:orgId/oidc-provider', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!await requireEnterpriseIdentityManager(req, res)) return;
  res.json(await getOIDCProviderForOrg(req.params.orgId));
});

app.post('/auth/organizations/:orgId/oidc-provider', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!await requireEnterpriseIdentityManager(req, res)) return;
  const provider = await createOIDCProvider(req.params.orgId, req.body);
  await writeAuditLog(req.user!.id, req.params.orgId, AuditAction.SSO_PROVIDER_CONFIGURED, req, { providerId: provider.id });
  res.status(201).json(provider);
});

app.patch('/auth/organizations/:orgId/oidc-provider', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!await requireEnterpriseIdentityManager(req, res)) return;
  await updateOIDCProvider(req.params.orgId, req.body);
  await writeAuditLog(req.user!.id, req.params.orgId, AuditAction.SSO_PROVIDER_CONFIGURED, req);
  res.json(await getOIDCProviderForOrg(req.params.orgId));
});

app.delete('/auth/organizations/:orgId/oidc-provider', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!await requireEnterpriseIdentityManager(req, res)) return;
  await deleteOIDCProvider(req.params.orgId);
  await writeAuditLog(req.user!.id, req.params.orgId, AuditAction.SSO_PROVIDER_REMOVED, req);
  res.json({ success: true });
});

// Identify user check
app.post('/auth/identify', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'EMAIL_REQUIRED', message: 'Email address is required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (user?.deletedAt) return res.status(403).json({ error: 'ACCOUNT_DELETION_PENDING', message: 'Contact support to request restoration during the retention window.' });
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
    const otpRecord = await prisma.otpCode.create({
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

    void emailService.sendTransactional({
      templateKey: 'auth-otp',
      to: cleanEmail,
      eventType: 'AUTH_OTP_SENT',
      severity: 'HIGH',
      variables: {
        code,
        purpose,
        expiresInMinutes: 10,
        appUrl: appUrl('/auth/login'),
      },
      idempotencyKey: buildIdempotencyKey(['auth-otp', otpRecord.id]),
    }).catch((err) => console.error('[Email] auth-otp failed', err));

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

    if (user?.deletedAt) {
      return res.status(403).json({ error: 'ACCOUNT_DELETION_PENDING', message: 'Contact support to request restoration during the retention window.' });
    }

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

      const org = await prisma.organization.findUnique({ where: { id: firstOrg } });
      void emailService.sendTransactional({
        templateKey: 'auth-welcome',
        to: user.email,
        userId: user.id,
        organizationId: firstOrg,
        eventType: 'AUTH_WELCOME',
        variables: {
          userName: user.displayName || user.email.split('@')[0],
          dashboardUrl: appUrl('/onboarding'),
        },
        idempotencyKey: buildIdempotencyKey(['auth-welcome', user.id]),
      }).catch((err) => console.error('[Email] auth-welcome failed', err));

      if (org) {
        void emailService.sendTransactional({
          templateKey: 'org-created',
          to: user.email,
          userId: user.id,
          organizationId: firstOrg,
          eventType: 'ORG_CREATED',
          variables: {
            organizationName: org.name,
            dashboardUrl: appUrl('/onboarding'),
          },
          idempotencyKey: buildIdempotencyKey(['org-created', firstOrg, user.id]),
        }).catch((err) => console.error('[Email] org-created failed', err));
      }
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
    if (user?.deletedAt) return res.status(403).json({ error: 'ACCOUNT_DELETION_PENDING', message: 'Contact support to request restoration during the retention window.' });
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
    const adminRecord = await prisma.systemAdmin.findFirst({
      where: {
        userId: session.userId,
        revokedAt: null,
      },
      select: { id: true },
    });
    const isSystemAdmin = adminRecord !== null;

    const accessToken = jwt.sign({ sub: session.userId, email: session.user.email, isSystemAdmin }, JWT_SECRET, { expiresIn: '15m' });

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

    const adminRecord = await prisma.systemAdmin.findFirst({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      select: { id: true },
    });
    const isSystemAdmin = adminRecord !== null;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        preferredAuthMode: user.preferredAuthMode,
        hasPassword: Boolean(user.passwordHash),
        isSystemAdmin,
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
        permissions: permissionsForRole(m.role),
      })),
    });
  } catch (err) {
    console.error('[Me] Error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve profile' });
  }
});

async function solelyOwnedOrganizationIds(userId: string): Promise<string[]> {
  const owned = await prisma.organizationMembership.findMany({
    where: { userId, role: MemberRole.OWNER }, select: { organizationId: true },
  });
  const result: string[] = [];
  for (const membership of owned) {
    const owners = await prisma.organizationMembership.count({ where: { organizationId: membership.organizationId, role: MemberRole.OWNER } });
    if (owners === 1) result.push(membership.organizationId);
  }
  return result;
}

app.get('/auth/account/deletion', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const organizationIds = await solelyOwnedOrganizationIds(req.user!.id);
  res.json({ retentionDays: 30, confirmationPhrase: 'DELETE MY ACCOUNT', solelyOwnedOrganizationIds: organizationIds, restoration: 'SUPPORT_ONLY' });
});

app.post('/auth/account/deletion', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.body?.confirmationPhrase !== 'DELETE MY ACCOUNT') {
    return res.status(400).json({ error: 'CONFIRMATION_PHRASE_REQUIRED' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || user.deletedAt) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  let reauthenticated = typeof req.body.password === 'string' && await verifyPassword(req.body.password, user.passwordHash);
  if (!reauthenticated && typeof req.body.otpCode === 'string') {
    const otp = await prisma.otpCode.findFirst({ where: { email: user.email, purpose: OtpPurpose.ACCOUNT_DELETION, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    reauthenticated = !!otp && otp.codeHash === sha256(req.body.otpCode);
    if (reauthenticated && otp) await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  }
  if (!reauthenticated) return res.status(401).json({ error: 'REAUTHENTICATION_REQUIRED' });

  const organizationIds = await solelyOwnedOrganizationIds(user.id);
  const authorization = req.headers.authorization ?? (req.cookies.access_token ? `Bearer ${req.cookies.access_token}` : '');
  const billingBase = process.env.BILLING_API_URL || 'http://localhost:3009';
  for (const organizationId of organizationIds) {
    const subscription = await prisma.subscription.findUnique({ where: { organizationId }, include: { plan: true } });
    if (subscription && subscription.plan.type !== 'FREE' && !subscription.cancelAtPeriodEnd) {
      const response = await fetch(`${billingBase}/billing/organizations/${organizationId}/subscription/cancel`, { method: 'POST', headers: { authorization, 'content-type': 'application/json', 'x-tellann-org-id': organizationId }, body: JSON.stringify({ organizationId }) });
      if (!response.ok) return res.status(409).json({ error: 'PROVIDER_CANCELLATION_FAILED', organizationId, message: 'Account deletion was not scheduled because the active subscription could not be cancelled.' });
    }
  }
  const now = new Date();
  const scheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const request = await prisma.$transaction(async (tx) => {
    const deletion = await tx.accountDeletionRequest.create({ data: {
      userId: user.id, confirmationPhrase: 'DELETE MY ACCOUNT', organizationIds, scheduledFor,
      requestedIpHash: req.ip ? sha256(req.ip) : null, requestedUserAgent: String(req.headers['user-agent'] ?? '').slice(0, 500),
    } });
    await tx.user.update({ where: { id: user.id }, data: { deletedAt: now, deletionScheduledFor: scheduledFor, deletionStatus: 'SCHEDULED' } });
    await tx.organization.updateMany({ where: { id: { in: organizationIds } }, data: { deletedAt: now, deletionScheduledFor: scheduledFor, deletionStatus: 'SCHEDULED' } });
    await tx.userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
    await tx.deviceSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
    return deletion;
  });
  res.clearCookie('access_token'); res.clearCookie('refresh_token');
  res.status(202).json({ status: request.status, scheduledFor, restoration: 'SUPPORT_ONLY' });
});

app.post('/auth/support/account-deletions/:requestId/restore', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const admin = await prisma.systemAdmin.findFirst({ where: { userId: req.user!.id, revokedAt: null } });
  if (!admin) return res.status(403).json({ error: 'SYSTEM_ADMIN_REQUIRED' });
  const deletion = await prisma.accountDeletionRequest.findUnique({ where: { id: req.params.requestId } });
  if (!deletion || deletion.status !== 'SCHEDULED' || deletion.purgeStartedAt || deletion.scheduledFor <= new Date()) {
    return res.status(409).json({ error: 'RESTORATION_WINDOW_CLOSED' });
  }
  await prisma.$transaction([
    prisma.accountDeletionRequest.update({ where: { id: deletion.id }, data: { status: 'RESTORED' } }),
    prisma.user.update({ where: { id: deletion.userId }, data: { deletedAt: null, deletionScheduledFor: null, deletionStatus: 'ACTIVE' } }),
    prisma.organization.updateMany({ where: { id: { in: deletion.organizationIds } }, data: { deletedAt: null, deletionScheduledFor: null, deletionStatus: 'ACTIVE' } }),
  ]);
  res.json({ restored: true, userId: deletion.userId, organizationIds: deletion.organizationIds });
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

const preferenceFields = [
  'theme',
  'density',
  'sidebarCollapsed',
  'reducedMotion',
  'highContrast',
  'tablePageSize',
  'persistFilters',
  'defaultLandingPage',
  'rememberLastApplication',
  'rememberLastEnvironment',
  'reportsOpenInNewTab',
  'graphPreferences',
  'replayPreferences',
  'reportPreferences',
] as const;

app.get('/auth/preferences', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const preferences = await prisma.userPreference.upsert({
    where: { userId: req.user.id },
    update: {},
    create: { userId: req.user.id },
  });
  res.json(preferences);
});

app.put('/auth/preferences', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const current = await prisma.userPreference.findUnique({ where: { userId: req.user.id } });
  if (current && req.body.version !== current.version) {
    return res.status(409).json({
      error: 'VERSION_CONFLICT',
      message: 'Preferences changed in another session. Reload and try again.',
      current,
    });
  }

  const data: Record<string, unknown> = {};
  for (const field of preferenceFields) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  if (data.tablePageSize !== undefined && ![10, 25, 50, 100].includes(Number(data.tablePageSize))) {
    return res.status(400).json({ error: 'INVALID_PAGE_SIZE', message: 'tablePageSize must be 10, 25, 50, or 100' });
  }
  const createData = { ...data };
  data.version = { increment: 1 };
  const preferences = await prisma.userPreference.upsert({
    where: { userId: req.user.id },
    create: { userId: req.user.id, ...createData, version: 1 },
    update: data,
  });
  res.json(preferences);
});

app.get('/auth/sessions', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const refreshToken = req.cookies?.refresh_token as string | undefined;
  const currentHash = refreshToken ? sha256(refreshToken) : null;
  const sessions = await prisma.userSession.findMany({
    where: { userId: req.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(sessions.map((session) => ({
    id: session.id,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    current: currentHash === session.refreshTokenHash,
  })));
});

app.delete('/auth/sessions/:sessionId', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const session = await prisma.userSession.findFirst({
    where: { id: req.params.sessionId, userId: req.user.id },
  });
  if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
  await prisma.userSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
  res.status(204).send();
});

app.delete('/auth/sessions', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const refreshToken = req.cookies?.refresh_token as string | undefined;
  const currentHash = refreshToken ? sha256(refreshToken) : '';
  const result = await prisma.userSession.updateMany({
    where: {
      userId: req.user.id,
      revokedAt: null,
      ...(currentHash ? { refreshTokenHash: { not: currentHash } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  res.json({ revoked: result.count });
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

// Local bootstrap endpoint to promote any registered user to a system administrator
app.post('/auth/bootstrap-admin', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'EMAIL_REQUIRED', message: 'Email address is required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    let user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { memberships: true },
    });

    if (!user) {
      // If they don't exist yet, we create a user.
      // Auto-provision an organization as well, matching the behavior in verify-otp signup
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

      const firstOrg = user.memberships[0].organizationId;
      await entitlementChecker.resolveEntitlement(firstOrg);
      await emitActivationEvent(firstOrg, 'ORG_CREATED');
      await writeAuditLog(user.id, firstOrg, AuditAction.USER_CREATED, req);
    }

    await prisma.systemAdmin.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        scope: 'FULL',
      },
      update: {
        revokedAt: null,
      },
    });

    await writeAuditLog(user.id, user.memberships?.[0]?.organizationId || null, AuditAction.LOGIN_SUCCESS, req, { notes: 'Bootstrapped as system admin' });

    res.json({
      success: true,
      message: `User ${email} has been successfully registered (if needed) and promoted to System Admin.`,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      }
    });
  } catch (err) {
    console.error('[Bootstrap Admin] Error', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to bootstrap admin user' });
  }
});

void emailService.syncBuiltinTemplates().catch((err) => console.error('[Email] Template sync failed', err));

app.listen(PORT, () => {
  console.log(`[AuthAPI] Service running on port ${PORT}`);
});
