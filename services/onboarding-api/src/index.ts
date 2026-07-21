import { initTracing } from '@sots/telemetry';
initTracing('onboarding-api');

import express, { Request, Response, NextFunction } from 'express';
import { AuditAction, EmailCategory, EnvironmentType, MemberRole, NotificationFrequency, PrismaClient, aggregateAiUsageDaily, aiUsageDateRangeForDays, backfillAiUsageDaily, utcDayStart } from '@sots/db';
import { Feature, Services } from '@sots/shared';
import { EntitlementChecker } from '@sots/entitlement-checker';
import { NotificationEmailService, appUrl, buildIdempotencyKey, docsUrl } from '@sots/email';
import { generateAiFlowDraft } from '@sots/ai';
import { getActiveRulesets, getDomainTemplate, inferDomain, inferDomainTemplate } from '@sots/rules';
import { writeAuditLog, extractAuditContext } from '@sots/authz';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sots-default-jwt-secret-change-in-production';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// Helper functions for slug generation
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

// JWT verification middleware
async function verifyJwt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token && req.headers['cookie']) {
    const cookies = Object.fromEntries(
      req.headers['cookie'].split(';').map(c => {
        const parts = c.trim().split('=');
        return [parts[0], parts.slice(1).join('=')];
      })
    );
    token = cookies['access_token'];
  }

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

// Organization membership verification middleware
async function verifyOrgMembership(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const orgId = req.params.orgId || req.params.id || req.body.organizationId;
  if (!orgId) {
    return next();
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  try {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not a member of this organization' });
    }

    next();
  } catch (err) {
    console.error('[verifyOrgMembership] Error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getOrgMembership(userId: string, organizationId: string) {
  return prisma.organizationMembership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });
}

function isOrgManager(role: MemberRole | null | undefined) {
  return role === MemberRole.OWNER || role === MemberRole.ADMIN;
}

// Application ownership verification middleware
async function verifyAppOwnership(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const appId = req.params.id || req.params.appId || req.body.applicationId;
  if (!appId) return next();

  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  try {
    const app = await prisma.application.findUnique({
      where: { id: appId },
      select: { organizationId: true }
    });

    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: app.organizationId as string
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not a member of the organization owning this application' });
    }

    next();
  } catch (err) {
    console.error('[verifyAppOwnership] Error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Environment ownership verification middleware
async function verifyEnvOwnership(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const envId = req.params.envId || req.body.environmentId;
  if (!envId) return next();

  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  try {
    const env = await prisma.environment.findUnique({
      where: { id: envId },
      include: {
        application: {
          select: { organizationId: true }
        }
      }
    });

    if (!env) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: env.application.organizationId as string
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not a member of the organization owning this environment' });
    }

    next();
  } catch (err) {
    console.error('[verifyEnvOwnership] Error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// API Key ownership verification middleware
async function verifyApiKeyOwnership(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  try {
    const key = await prisma.apiKey.findUnique({
      where: { id },
      include: {
        environment: {
          include: {
            application: {
              select: { organizationId: true }
            }
          }
        }
      }
    });

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: key.environment.application.organizationId as string
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not a member of the organization owning this API key' });
    }

    next();
  } catch (err) {
    console.error('[verifyApiKeyOwnership] Error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

const app = express();
const prisma = new PrismaClient();
const aiUsageAggregationRuns = new Map<string, Promise<void>>();

async function ensureAiUsageAggregated(startDate: Date, endDate: Date, organizationId?: string): Promise<void> {
  const key = [startDate.toISOString(), endDate.toISOString(), organizationId ?? 'all'].join('|');
  const existing = aiUsageAggregationRuns.get(key);
  if (existing) {
    await existing;
    return;
  }

  const run = aggregateAiUsageDaily({ prisma, startDate, endDate, organizationId })
    .then(() => undefined)
    .finally(() => aiUsageAggregationRuns.delete(key));
  aiUsageAggregationRuns.set(key, run);
  await run;
}

const entitlementChecker = new EntitlementChecker(prisma);
const emailService = new NotificationEmailService(prisma);
app.use(express.json());

// Enable CORS for dashboard queries
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-sots-user-id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = `sots_${rawKey.slice(0, 8)}`;
  return { rawKey, keyHash, keyPrefix };
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function emitActivationEvent(
  organizationId: string,
  applicationId: string | null,
  environmentId: string | null,
  eventName: string,
  metadata?: any
) {
  try {
    await prisma.activationEvent.create({
      data: {
        organizationId,
        applicationId,
        environmentId,
        eventName,
        metadata: metadata ?? {},
      }
    });
    console.log(`[ActivationEvent] Logged ${eventName} for org ${organizationId}`);
  } catch (err) {
    console.error(`[ActivationEvent] Failed to log ${eventName}`, err);
  }
}

async function getUserEmail(userId: string): Promise<{ email: string; displayName: string | null } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true },
  });
}

// ─────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'onboarding-api' });
});

// ─────────────────────────────────────────────────────────────
// Organizations
// ─────────────────────────────────────────────────────────────

/** POST /organizations — create a new organization */
app.post('/organizations', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  const userId = req.user!.id;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: '`name` is required' });
  }
  try {
    const orgSlug = await getUniqueOrgSlug(name);
    const org = await prisma.$transaction(async (tx) => {
      const newOrg = await tx.organization.create({
        data: {
          name: name.trim(),
          slug: orgSlug,
          createdByUserId: userId
        }
      });
      await tx.organizationMembership.create({
        data: {
          userId,
          organizationId: newOrg.id,
          role: MemberRole.OWNER
        }
      });
      return newOrg;
    });

    // Auto-resolve entitlement (assigns Free plan)
    await entitlementChecker.resolveEntitlement(org.id);
    
    // Emit ORG_CREATED activation event
    await emitActivationEvent(org.id, null, null, 'ORG_CREATED');

    const user = await getUserEmail(userId);
    if (user) {
      void emailService.sendTransactional({
        templateKey: 'org-created',
        to: user.email,
        userId,
        organizationId: org.id,
        eventType: 'ORG_CREATED',
        variables: {
          organizationName: org.name,
          dashboardUrl: appUrl('/onboarding'),
        },
        idempotencyKey: buildIdempotencyKey(['org-created', org.id, userId]),
      }).catch((err) => console.error('[Email] org-created failed', err));
    }

    res.status(201).json(org);
  } catch (err) {
    console.error('[Onboarding] Create org error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /organizations — list all organizations */
app.get('/organizations', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const orgs = await prisma.organization.findMany({
      where: {
        memberships: {
          some: {
            userId
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orgs);
  } catch (err) {
    console.error('[Onboarding] List orgs error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /organizations/:id — get organization details */
app.get('/organizations/:id', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        applications: {
          include: {
            environments: true,
            onboardingProgress: true
          }
        }
      },
    });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    
    // Find active api keys scoped to any environment under organization's apps
    const keys = await prisma.apiKey.findMany({
      where: {
        environment: {
          application: {
            organizationId: org.id
          }
        },
        revokedAt: null
      }
    });

    const safeOrg = {
      ...org,
      apiKeys: keys.map(({ keyHash: _h, ...k }) => k),
    };
    res.json(safeOrg);
  } catch (err) {
    console.error('[Onboarding] Get org error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /organizations/:orgId/activation-events — get activation events */
app.get('/organizations/:orgId/activation-events', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId } = req.params;
  try {
    const events = await prisma.activationEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { occurredAt: 'asc' }
    });
    res.json(events);
  } catch (err) {
    console.error('[Onboarding] Get activation events error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /organizations/:orgId/notification-preferences - current user's email preferences */
app.get('/organizations/:orgId/notification-preferences', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId } = req.params;
  const userId = req.user!.id;

  try {
    const existing = await prisma.notificationPreference.findMany({
      where: { organizationId: orgId, userId },
      orderBy: { category: 'asc' },
    });

    const byCategory = new Map(existing.map((preference) => [preference.category, preference]));
    res.json(Object.values(EmailCategory).map((category) => byCategory.get(category) ?? {
      id: null,
      userId,
      organizationId: orgId,
      category,
      emailEnabled: true,
      inAppEnabled: true,
      webhookEnabled: false,
      frequency: category === EmailCategory.DIGEST ? NotificationFrequency.WEEKLY_DIGEST : NotificationFrequency.IMMEDIATE,
    }));
  } catch (err) {
    console.error('[Onboarding] Get notification preferences error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /organizations/:orgId/notification-preferences/:category - update current user's preference */
app.put('/organizations/:orgId/notification-preferences/:category', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId, category } = req.params;
  const userId = req.user!.id;
  const normalizedCategory = category.toUpperCase();
  if (!Object.values(EmailCategory).includes(normalizedCategory as EmailCategory)) {
    return res.status(400).json({ error: 'INVALID_CATEGORY', categories: Object.values(EmailCategory) });
  }

  const frequency = req.body.frequency ?? NotificationFrequency.IMMEDIATE;
  if (!Object.values(NotificationFrequency).includes(frequency)) {
    return res.status(400).json({ error: 'INVALID_FREQUENCY', frequencies: Object.values(NotificationFrequency) });
  }

  const criticalCategories: EmailCategory[] = [EmailCategory.SECURITY, EmailCategory.BILLING, EmailCategory.COMPLIANCE];
  const critical = criticalCategories.includes(normalizedCategory as EmailCategory);
  const emailEnabled = critical ? true : req.body.emailEnabled !== false;

  try {
    const preference = await prisma.notificationPreference.upsert({
      where: {
        userId_organizationId_category: {
          userId,
          organizationId: orgId,
          category: normalizedCategory as EmailCategory,
        },
      },
      update: {
        emailEnabled,
        inAppEnabled: req.body.inAppEnabled !== false,
        webhookEnabled: req.body.webhookEnabled === true,
        frequency,
      },
      create: {
        userId,
        organizationId: orgId,
        category: normalizedCategory as EmailCategory,
        emailEnabled,
        inAppEnabled: req.body.inAppEnabled !== false,
        webhookEnabled: req.body.webhookEnabled === true,
        frequency,
      },
    });

    res.json(preference);
  } catch (err) {
    console.error('[Onboarding] Update notification preference error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /organizations/:orgId/invitations - invite a team member and email the invite */
app.post('/organizations/:orgId/invitations', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId } = req.params;
  const { email, role } = req.body;
  const userId = req.user!.id;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'EMAIL_REQUIRED', message: 'Invitee email is required' });
  }

  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) {
    return res.status(400).json({ error: 'EMAIL_REQUIRED', message: 'Invitee email is required' });
  }

  const inviteRole = role && Object.values(MemberRole).includes(role) ? role as MemberRole : MemberRole.MEMBER;
  if (inviteRole === MemberRole.OWNER) {
    return res.status(400).json({ error: 'INVALID_ROLE', message: 'Use ownership transfer for OWNER role.' });
  }

  try {
    const [org, actorMembership] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      getOrgMembership(userId, orgId),
    ]);

    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (!isOrgManager(actorMembership?.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only Owners and Admins may invite members.' });
    }

    const [hasTeamAccess, entitlement] = await Promise.all([
      entitlementChecker.canAccess(orgId, Feature.TEAM_COLLABORATION),
      entitlementChecker.getEntitlement(orgId),
    ]);
    if (!hasTeamAccess) {
      return res.status(403).json({ error: 'TEAM_COLLABORATION_REQUIRED', message: 'Upgrade to a Team plan before inviting members.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail }, select: { id: true } });
    if (existingUser) {
      const existingMembership = await prisma.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId: orgId } },
      });
      if (existingMembership) {
        return res.status(409).json({ error: 'ALREADY_MEMBER', message: 'That user is already a member of this organization.' });
      }
    }

    const now = new Date();
    const existingInvitation = await prisma.organizationInvitation.findFirst({
      where: { organizationId: orgId, email: cleanEmail, acceptedAt: null, expiresAt: { gt: now } },
    });
    if (existingInvitation) {
      return res.status(409).json({ error: 'INVITATION_EXISTS', message: 'A pending invitation already exists for this email.' });
    }

    const [currentMembers, pendingInvitations] = await Promise.all([
      prisma.organizationMembership.count({ where: { organizationId: orgId } }),
      prisma.organizationInvitation.count({ where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: now } } }),
    ]);
    const userLimit = Number(entitlement.limits?.users ?? 1);
    if (Number.isFinite(userLimit) && currentMembers + pendingInvitations >= userLimit) {
      return res.status(409).json({
        error: 'USER_LIMIT_REACHED',
        message: `This plan allows ${userLimit} organization member${userLimit === 1 ? '' : 's'}. Upgrade before inviting more people.`,
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await prisma.organizationInvitation.create({
      data: {
        organizationId: orgId,
        email: cleanEmail,
        role: inviteRole,
        tokenHash: sha256(token),
        createdByUserId: userId,
        expiresAt,
      },
    });

    const { ipAddress, userAgent } = extractAuditContext(req);
    void writeAuditLog(prisma, {
      action: AuditAction.MEMBER_INVITED,
      userId,
      organizationId: orgId,
      ipAddress,
      userAgent,
      metadata: { invitationId: invitation.id, email: cleanEmail, role: inviteRole },
    });

    void emailService.sendTransactional({
      templateKey: 'team-invite',
      to: cleanEmail,
      organizationId: orgId,
      eventType: 'TEAM_INVITE_SENT',
      variables: {
        organizationName: org.name,
        role: inviteRole,
        invitedBy: req.user!.email,
        expiresAt: expiresAt.toISOString(),
        inviteUrl: appUrl(`/auth/login?invite=${token}`),
      },
      idempotencyKey: buildIdempotencyKey(['team-invite', invitation.id]),
    }).catch((err) => console.error('[Email] team-invite failed', err));

    res.status(201).json({
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      status: 'PENDING',
      createdByUserId: invitation.createdByUserId,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    });
  } catch (err) {
    console.error('[Onboarding] Create invitation error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
/** POST /organizations/invitations/accept - accept an invite for the signed-in user */
app.post('/organizations/invitations/accept', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'TOKEN_REQUIRED', message: 'Invitation token is required' });
  }

  try {
    const tokenHash = sha256(token);
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash },
      include: { organization: true },
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: 'INVITE_INVALID', message: 'Invite is invalid, expired, or already accepted' });
    }
    if (invitation.email.toLowerCase() !== req.user!.email.toLowerCase()) {
      return res.status(403).json({ error: 'INVITE_EMAIL_MISMATCH', message: 'Sign in with the invited email address.' });
    }

    const membership = await prisma.$transaction(async (tx) => {
      const result = await tx.organizationMembership.upsert({
        where: {
          userId_organizationId: {
            userId: req.user!.id,
            organizationId: invitation.organizationId,
          },
        },
        update: { role: invitation.role },
        create: {
          userId: req.user!.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
          invitedByUserId: invitation.createdByUserId,
        },
      });
      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return result;
    });

    const { ipAddress, userAgent } = extractAuditContext(req);
    void writeAuditLog(prisma, {
      action: AuditAction.MEMBER_JOINED,
      userId: req.user!.id,
      organizationId: invitation.organizationId,
      ipAddress,
      userAgent,
      metadata: { invitationId: invitation.id, role: invitation.role },
    });

    res.json({ membership, organization: invitation.organization });
  } catch (err) {
    console.error('[Onboarding] Accept invitation error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Entitlements and Subscriptions
// ─────────────────────────────────────────────────────────────

/** GET /organizations/:orgId/entitlement — get resolved entitlement */
app.get('/organizations/:orgId/entitlement', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId } = req.params;
  try {
    const entitlement = await entitlementChecker.getEntitlement(orgId);
    res.json(entitlement);
  } catch (err: any) {
    console.error('[Onboarding] Get entitlement error', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/** GET /organizations/:orgId/subscription — get subscription details */
app.get('/organizations/:orgId/subscription', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId } = req.params;
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: orgId },
      include: { plan: true },
    });
    if (!subscription) {
      await entitlementChecker.resolveEntitlement(orgId);
      const sub = await prisma.subscription.findUnique({
        where: { organizationId: orgId },
        include: { plan: true },
      });
      return res.json(sub);
    }
    res.json(subscription);
  } catch (err) {
    console.error('[Onboarding] Get subscription error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Applications & Environments
// ─────────────────────────────────────────────────────────────

/** POST /organizations/:orgId/applications — create application */
app.post('/organizations/:orgId/applications', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId } = req.params;
  const { name, profileType } = req.body;
  if (!name) return res.status(400).json({ error: '`name` is required' });

  try {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Check application limit
    const limitCheck = await entitlementChecker.canCreateApplication(orgId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: 'Application limit reached for your plan',
        limit: limitCheck.limit,
        current: limitCheck.current,
        message: 'Please upgrade your plan to onboard more applications.'
      });
    }

    const application = await prisma.application.create({
      data: { name: name.trim(), organizationId: orgId },
    });

    // Create default Development environment
    const devEnv = await prisma.environment.create({
      data: {
        applicationId: application.id,
        name: 'Development',
        type: EnvironmentType.DEVELOPMENT,
        isDefault: true,
      }
    });

    // Initialize onboarding progress
    await prisma.applicationOnboardingProgress.create({
      data: {
        applicationId: application.id,
      }
    });

    // Auto-create ApplicationProfile if profileType provided
    if (profileType) {
      await prisma.applicationProfile.create({
        data: { applicationId: application.id, profileType: profileType.toUpperCase() },
      });
    }

    // Emit APP_CREATED activation event
    await emitActivationEvent(orgId, application.id, devEnv.id, 'APP_CREATED');

    const user = await getUserEmail(req.user!.id);
    if (user) {
      void emailService.sendTransactional({
        templateKey: 'app-created',
        to: user.email,
        userId: req.user!.id,
        organizationId: orgId,
        applicationId: application.id,
        eventType: 'APP_CREATED',
        variables: {
          applicationName: application.name,
          organizationName: org.name,
          environmentName: devEnv.name,
          dashboardUrl: appUrl(`/declare?applicationId=${application.id}&environmentId=${devEnv.id}`),
        },
        idempotencyKey: buildIdempotencyKey(['app-created', application.id, req.user!.id]),
      }).catch((err) => console.error('[Email] app-created failed', err));
    }

    res.status(201).json(application);
  } catch (err) {
    console.error('[Onboarding] Create app error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /organizations/:orgId/applications — list org applications */
app.get('/organizations/:orgId/applications', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const apps = await prisma.application.findMany({
      where: { organizationId: req.params.orgId },
      include: { profile: true, environments: true, onboardingProgress: true },
      orderBy: { name: 'asc' },
    });
    res.json(apps);
  } catch (err) {
    console.error('[Onboarding] List apps error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /applications — list all applications in the system */
app.get('/applications', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const apps = await prisma.application.findMany({
      where: {
        organization: {
          memberships: {
            some: {
              userId
            }
          }
        }
      },
      include: { profile: true, organization: true, environments: true, onboardingProgress: true },
      orderBy: { name: 'asc' },
    });
    res.json(apps);
  } catch (err) {
    console.error('[Onboarding] List all apps error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /applications/:id — get a single application */
app.get('/applications/:id', verifyJwt, verifyAppOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const app = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { profile: true, organization: true, environments: true, onboardingProgress: true },
    });
    if (!app) return res.status(404).json({ error: 'Application not found' });
    res.json(app);
  } catch (err) {
    console.error('[Onboarding] Get app error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /applications/:appId/environments — create a new environment */
app.post('/applications/:appId/environments', verifyJwt, verifyAppOwnership, async (req: AuthenticatedRequest, res: Response) => {
  const { appId } = req.params;
  const { name, type } = req.body;
  if (!name) return res.status(400).json({ error: '`name` is required' });
  if (!type || !Object.values(EnvironmentType).includes(type)) {
    return res.status(400).json({ error: `Valid environment 'type' is required: ${Object.values(EnvironmentType).join(', ')}` });
  }

  try {
    const app = await prisma.application.findUnique({
      where: { id: appId },
      select: { organizationId: true }
    });
    if (!app) return res.status(404).json({ error: 'Application not found' });

    // Check environment limit
    const limitCheck = await entitlementChecker.canCreateEnvironment(appId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: 'Environment limit reached for this application',
        limit: limitCheck.limit,
        current: limitCheck.current,
        message: 'Please upgrade your plan to add more environments.'
      });
    }

    const env = await prisma.environment.create({
      data: {
        applicationId: appId,
        name: name.trim(),
        type: type as EnvironmentType,
        isDefault: false,
      }
    });

    res.status(201).json(env);
  } catch (err) {
    console.error('[Onboarding] Create environment error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /applications/:appId/environments — list environments */
app.get('/applications/:appId/environments', verifyJwt, verifyAppOwnership, async (req: AuthenticatedRequest, res: Response) => {
  const { appId } = req.params;
  try {
    const envs = await prisma.environment.findMany({
      where: { applicationId: appId },
      include: { apiKeys: { select: { id: true, keyPrefix: true, label: true, createdAt: true, lastUsedAt: true, expiresAt: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.json(envs);
  } catch (err) {
    console.error('[Onboarding] List environments error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// API Keys
// ─────────────────────────────────────────────────────────────

/**
 * POST /environments/:envId/api-keys — generate a new API key.
 * Returns rawKey ONCE.
 */
app.post('/environments/:envId/api-keys', verifyJwt, verifyEnvOwnership, async (req: AuthenticatedRequest, res: Response) => {
  const { envId } = req.params;
  const { label, expiresAt } = req.body;
  const userId = req.user!.id;

  try {
    const env = await prisma.environment.findUnique({
      where: { id: envId },
      include: { application: true }
    });
    if (!env) return res.status(404).json({ error: 'Environment not found' });
    const orgId = env.application.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Environment application has no organization' });

    // Check limit
    const limitCheck = await entitlementChecker.canCreateApiKey(envId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: 'API Key limit reached for this environment',
        limit: limitCheck.limit,
        current: limitCheck.current,
        message: 'Please upgrade your plan to generate more API keys.'
      });
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        environmentId: envId,
        keyHash,
        keyPrefix,
        label: label ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdByUserId: userId,
      },
    });

    const user = await getUserEmail(userId);
    if (user) {
      const dashboardUrl = appUrl(`/declare?applicationId=${env.application.id}&environmentId=${env.id}`);
      void emailService.sendTransactional({
        templateKey: 'api-key-created',
        to: user.email,
        userId,
        organizationId: orgId,
        applicationId: env.application.id,
        eventType: 'API_KEY_CREATED',
        severity: 'HIGH',
        variables: {
          applicationName: env.application.name,
          environmentName: env.name,
          keyPrefix: apiKey.keyPrefix,
          dashboardUrl,
        },
        idempotencyKey: buildIdempotencyKey(['api-key-created', apiKey.id, userId]),
      }).catch((err) => console.error('[Email] api-key-created failed', err));

      void emailService.sendTransactional({
        templateKey: 'sdk-install-guide',
        to: user.email,
        userId,
        organizationId: orgId,
        applicationId: env.application.id,
        eventType: 'SDK_INSTALL_GUIDE',
        variables: {
          applicationName: env.application.name,
          environmentName: env.name,
          dashboardUrl,
          docsUrl: docsUrl('/quickstart'),
        },
        idempotencyKey: buildIdempotencyKey(['sdk-install-guide', apiKey.id, userId]),
      }).catch((err) => console.error('[Email] sdk-install-guide failed', err));
    }

    // Audit: API key created
    const { ipAddress, userAgent } = extractAuditContext(req);
    await writeAuditLog(prisma, {
      action: AuditAction.API_KEY_CREATED,
      userId,
      organizationId: orgId,
      applicationId: env.application.id,
      metadata: { apiKeyId: apiKey.id, keyPrefix: apiKey.keyPrefix, environmentId: envId, label: apiKey.label },
      ipAddress,
      userAgent,
    });

    res.status(201).json({
      id: apiKey.id,
      keyPrefix: apiKey.keyPrefix,
      label: apiKey.label,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      rawKey, // returned ONCE
    });
  } catch (err) {
    console.error('[Onboarding] Create API key error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /environments/:envId/api-keys — list active keys for an environment */
app.get('/environments/:envId/api-keys', verifyJwt, verifyEnvOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { environmentId: req.params.envId, revokedAt: null },
      select: { id: true, keyPrefix: true, label: true, createdAt: true, lastUsedAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(keys);
  } catch (err) {
    console.error('[Onboarding] List API keys error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /organizations/:orgId/api-keys — list active keys (legacy organization level) */
app.get('/organizations/:orgId/api-keys', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: {
        environment: {
          application: {
            organizationId: req.params.orgId
          }
        },
        revokedAt: null
      },
      select: { id: true, keyPrefix: true, label: true, createdAt: true, lastUsedAt: true, expiresAt: true, environmentId: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(keys);
  } catch (err) {
    console.error('[Onboarding] List legacy API keys error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /api-keys/:id — revoke an API key */
app.delete('/api-keys/:id', verifyJwt, verifyApiKeyOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const key = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
    if (!key) return res.status(404).json({ error: 'API key not found' });
    if (key.revokedAt) return res.status(409).json({ error: 'API key already revoked' });

    await prisma.apiKey.update({
      where: { id: req.params.id },
      data: { revokedAt: new Date() },
    });

    // Audit: API key revoked
    const { ipAddress, userAgent } = extractAuditContext(req);
    await writeAuditLog(prisma, {
      action: AuditAction.API_KEY_REVOKED,
      userId: req.user?.id ?? null,
      metadata: { apiKeyId: key.id, keyPrefix: key.keyPrefix, environmentId: key.environmentId },
      ipAddress,
      userAgent,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Onboarding] Revoke API key error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Profile & Flow Templates Seeding
// ─────────────────────────────────────────────────────────────

app.post('/applications/:appId/profile', async (req: Request, res: Response) => {
  const { appId } = req.params;
  const { profileType, description, selectedDomainKey, templateId } = req.body;

  if (!profileType) {
    return res.status(400).json({ error: '`profileType` is required' });
  }

  try {
    const requestedProfileType = String(profileType).toUpperCase();
    const selectedTemplateKey = String(selectedDomainKey || templateId || '').toUpperCase();
    const isPromptRuleBased = requestedProfileType === 'PROMPT' || requestedProfileType === 'PROMPT_RULE_BASED';
    const isPromptAiExperimental = requestedProfileType === 'PROMPT_AI_EXPERIMENTAL';
    const isDefaultTemplate = requestedProfileType === 'DEFAULT_TEMPLATE';
    const isCustomBlank = requestedProfileType === 'CUSTOM' || requestedProfileType === 'CUSTOM_BLANK';

    const template = isPromptRuleBased || isPromptAiExperimental
      ? inferDomainTemplate(String(description ?? ''))
      : isDefaultTemplate
        ? getDomainTemplate(selectedTemplateKey || 'GENERIC_CRUD')
        : isCustomBlank
          ? getDomainTemplate('CUSTOM')
          : getDomainTemplate(requestedProfileType);
    const normalizedProfileType = template.id;

    const app = await prisma.application.findUnique({
      where: { id: appId },
      include: { organization: { include: { entitlement: true } } }
    });
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const orgId = app.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Application has no organization' });

    // Upsert Profile
    await prisma.applicationProfile.upsert({
      where: { applicationId: appId },
      update: { profileType: normalizedProfileType },
      create: { applicationId: appId, profileType: normalizedProfileType },
    });

    const devEnv = await prisma.environment.findFirst({
      where: { applicationId: appId, isDefault: true }
    });
    const envId = devEnv?.id || null;

    let templateSelected = true;
    let expectedFlowsDefined = false;
    let graphId: string | null = null;

    if (isPromptAiExperimental) {
      if (process.env.AI_FEATURES_ENABLED !== 'true' || process.env.AI_FLOW_GENERATION_ENABLED !== 'true') {
        return res.status(403).json({ error: 'AI_FEATURE_DISABLED' });
      }
      const features = app.organization?.entitlement?.features;
      const hasOrgEntitlement = features && typeof features === 'object'
        ? (features as Record<string, unknown>).experimentalAiFlowGeneration === true
        : false;
      if (!hasOrgEntitlement && process.env.AI_ALLOW_WITHOUT_ORG_ENTITLEMENT !== 'true') {
        return res.status(403).json({ error: 'AI_ORG_ENTITLEMENT_REQUIRED' });
      }

      const inference = await inferDomain({
        description: String(description ?? ''),
        selectedDomainKey: selectedTemplateKey || undefined,
        organizationId: orgId,
        applicationId: appId,
        prisma,
      });
      const rulesets = await getActiveRulesets({
        organizationId: orgId,
        applicationId: appId,
        domainKey: inference.domainKey,
        prisma,
      });

      // Privacy: sanitize the description before storing or sending to AI
      const { sanitizeAiInputFull } = await import('@sots/ai').then((m) => ({ sanitizeAiInputFull: m.sanitizeAiInputFull })).catch(() => ({ sanitizeAiInputFull: (s: string) => ({ sanitizedText: s, redactions: [], riskLevel: 'LOW' as const, promptInjectionRisk: false, injectionPatterns: [], originalHash: '' }) }));
      const sanitized = sanitizeAiInputFull(String(description ?? ''));

      const startedAt = Date.now();

      // Phase 7: AI failure must NEVER block onboarding
      let result: Awaited<ReturnType<typeof generateAiFlowDraft>> | null = null;
      let aiStatus: 'CREATED' | 'FAILED_NON_BLOCKING' | 'SKIPPED' = 'SKIPPED';
      let aiErrorMessage: string | null = null;

      try {
        result = await generateAiFlowDraft({
          productDescription: sanitized.sanitizedText,
          domainKey: inference.domainKey,
          rulesets,
        });
        aiStatus = 'CREATED';
      } catch (aiErr) {
        aiStatus = 'FAILED_NON_BLOCKING';
        aiErrorMessage = aiErr instanceof Error ? aiErr.message : 'AI provider unavailable';
        console.warn('[Onboarding] AI flow draft failed (non-blocking):', {
          appId,
          orgId,
          error: aiErrorMessage,
        });

        // Log the failure for observability
        try {
          await prisma.aIInvocationLog.create({
            data: {
              organizationId: orgId,
              applicationId: appId,
              feature: 'FLOW_GENERATION',
              provider: 'unknown',
              model: 'unknown',
              promptHash: crypto.createHash('sha256').update(sanitized.sanitizedText).digest('hex'),
              status: 'FAILED',
              errorMessage: aiErrorMessage,
              latencyMs: Date.now() - startedAt,
            },
          });
        } catch (_logErr) {
          console.error('[Onboarding] Failed to log AI invocation failure', _logErr);
        }
      }

      // Build the response — onboarding succeeds regardless of AI outcome
      if (result) {
        try {
          const invocation = await prisma.aIInvocationLog.create({
            data: {
              organizationId: orgId,
              applicationId: appId,
              feature: 'FLOW_GENERATION',
              provider: result.provider,
              model: result.model,
              promptHash: result.promptHash,
              inputSummaryJson: {
                domainKey: inference.domainKey,
                descriptionLength: sanitized.sanitizedText.length,
                selectedDomainKey: selectedTemplateKey || null,
                riskLevel: sanitized.riskLevel,
                redactionCount: sanitized.redactions.length,
              },
              outputSummaryJson: {
                workflowCount: result.draft.workflows.length,
                suggestionCount: result.draft.suggestions.length,
                confidence: result.draft.confidence,
              },
              status: result.validation.valid ? 'SUCCESS' : 'VALIDATION_FAILED',
              latencyMs: Date.now() - startedAt,
            },
          });

          const draft = await prisma.aIFlowDraft.create({
            data: {
              organizationId: orgId,
              applicationId: appId,
              environmentId: envId,
              source: 'ONBOARDING_PROMPT',
              status: 'PENDING_REVIEW',
              // Privacy: store only the redacted description
              productDescription: sanitized.sanitizedText,
              inferredDomainKey: inference.domainKey,
              rulesetVersionIds: rulesets.flatMap((ruleset) => ruleset.rulesetVersionId ? [ruleset.rulesetVersionId] : []),
              promptHash: result.promptHash,
              provider: result.provider,
              model: result.model,
              aiInvocationId: invocation.id,
              draftJson: result.draft as any,
              validationJson: result.validation as any,
              confidence: result.draft.confidence,
            },
          });

          await prisma.applicationOnboardingProgress.upsert({
            where: { applicationId: appId },
            update: { templateSelected, expectedFlowsDefined },
            create: { applicationId: appId, templateSelected, expectedFlowsDefined }
          });
          await emitActivationEvent(orgId, appId, envId, 'AI_FLOW_DRAFT_CREATED', {
            profileType: inference.domainKey,
            draftId: draft.id,
            workflowCount: result.draft.workflows.length,
          });

          return res.json({
            success: true,
            mode: 'PROMPT_AI_EXPERIMENTAL',
            profileType: inference.domainKey,
            templateSelected,
            expectedFlowsDefined,
            draftId: draft.id,
            confidence: draft.confidence,
            workflows: result.draft.workflows,
            assumptions: result.draft.assumptions,
            validation: result.validation,
            aiStatus,
          });
        } catch (persistErr) {
          console.error('[Onboarding] Failed to persist AI draft (non-blocking)', persistErr);
        }
      }

      // AI failed or persistence failed — return a successful onboarding response
      // without the AI draft, so the user can continue manually
      await prisma.applicationOnboardingProgress.upsert({
        where: { applicationId: appId },
        update: { templateSelected },
        create: { applicationId: appId, templateSelected }
      });

      return res.json({
        success: true,
        mode: 'PROMPT_AI_EXPERIMENTAL',
        profileType: inference.domainKey,
        templateSelected,
        expectedFlowsDefined: false,
        aiStatus,
        aiUnavailable: aiStatus === 'FAILED_NON_BLOCKING',
        message: aiStatus === 'FAILED_NON_BLOCKING'
          ? 'AI draft generation is temporarily unavailable. You can continue setup manually.'
          : undefined,
      });
    }

    if (devEnv && template.states.length > 0) {
      // Deactivate previous graphs.
      await prisma.behaviorGraph.updateMany({
        where: { applicationId: appId, environmentId: devEnv.id, graphType: 'DECLARED' },
        data: { isActive: false }
      });

      const latestGraph = await prisma.behaviorGraph.findFirst({
        where: { applicationId: appId, environmentId: devEnv.id, graphType: 'DECLARED' },
        orderBy: { version: 'desc' },
      });

      const graph = await prisma.behaviorGraph.create({
        data: {
          applicationId: appId,
          environmentId: devEnv.id,
          name: `${template.name} Expected Flow`,
          workflowType: template.workflowType,
          graphType: 'DECLARED',
          sourceType: 'USER_DECLARATION',
          isActive: true,
          version: (latestGraph?.version ?? 0) + 1,
        }
      });
      graphId = graph.id;

      const createdNodes: Record<string, any> = {};
      for (const state of template.states) {
        const node = await prisma.behaviorGraphNode.create({
          data: {
            graphId: graph.id,
            stateName: state.name,
            behaviorKey: state.name,
            canonicalBehavior: state.name,
            category: state.category,
            provenance: 'USER_AUTHORED',
          }
        });
        createdNodes[state.name] = node;
      }

      for (const transition of template.transitions) {
        const fromNode = createdNodes[transition.from];
        const toNode = createdNodes[transition.to];
        if (!fromNode || !toNode) continue;

        await prisma.behaviorGraphEdge.create({
          data: {
            graphId: graph.id,
            fromNodeId: fromNode.id,
            toNodeId: toNode.id,
            action: transition.action ?? null,
            provenance: 'USER_AUTHORED',
          }
        });
      }

      for (const edgeCase of template.edgeCases) {
        const parentNode = createdNodes[edgeCase.trigger];
        if (!parentNode) continue;

        await prisma.declaredStateSuggestion.create({
          data: {
            parentStateId: parentNode.id,
            suggestedStateName: edgeCase.name,
            category: edgeCase.category,
            sourceTier: 'TEMPLATE',
            rationale: edgeCase.reason,
            confidence: edgeCase.confidence,
            patternId: `${template.id.toLowerCase()}-${edgeCase.name.toLowerCase().replace(/_/g, '-')}`,
            status: 'SUGGESTED',
          },
        });
      }

      const compiledRules = [];
      for (const state of template.states) {
        compiledRules.push({
          ruleId: `r_state_${crypto.randomUUID()}`,
          type: 'EXPECTED_STATE',
          stateName: state.name,
          source: 'USER_AUTHORED',
          confidence: 1.0,
        });
      }
      for (const transition of template.transitions) {
        compiledRules.push({
          ruleId: `r_trans_${crypto.randomUUID()}`,
          type: 'EXPECTED_TRANSITION',
          fromState: transition.from,
          toState: transition.to,
          action: transition.action ?? undefined,
          source: 'USER_AUTHORED',
        });
      }

      await prisma.compiledRuleset.upsert({
        where: {
          flowId_version: {
            flowId: graph.id,
            version: graph.version,
          },
        },
        update: {
          rules: compiledRules as any,
          ruleCount: compiledRules.length,
          compiledAt: new Date(),
        },
        create: {
          flowId: graph.id,
          applicationId: appId,
          version: graph.version,
          rules: compiledRules as any,
          ruleCount: compiledRules.length,
          compiledAt: new Date(),
        },
      });
    }

    // Update progress
    await prisma.applicationOnboardingProgress.upsert({
      where: { applicationId: appId },
      update: {
        templateSelected,
        expectedFlowsDefined,
      },
      create: {
        applicationId: appId,
        templateSelected,
        expectedFlowsDefined,
      }
    });

    const eventName = template.states.length > 0 ? 'TEMPLATE_SELECTED' : 'BLANK_CANVAS_SELECTED';
    await emitActivationEvent(orgId, appId, envId, eventName, {
      profileType: normalizedProfileType,
      requestedProfileType,
      descriptionProvided: Boolean(description),
    });

    if (template.states.length > 0) {
      await emitActivationEvent(orgId, appId, envId, 'FLOW_DRAFTED', {
        profileType: normalizedProfileType,
        source: requestedProfileType === 'PROMPT' ? 'prompt' : 'template',
        stateCount: template.states.length,
        edgeCaseSuggestionCount: template.edgeCases.length,
      });
    }

    res.json({
      success: true,
      profileType: normalizedProfileType,
      templateSelected,
      expectedFlowsDefined,
      seededStates: template.states.length,
      seededTransitions: template.transitions.length,
      seededSuggestions: template.edgeCases.length,
      graphId,
    });
  } catch (err) {
    console.error('[Onboarding] Profile selection error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Onboarding Progress API
// ─────────────────────────────────────────────────────────────

app.get('/applications/:appId/onboarding-progress', async (req: Request, res: Response) => {
  const { appId } = req.params;
  try {
    const progress = await prisma.applicationOnboardingProgress.findUnique({
      where: { applicationId: appId }
    });
    if (!progress) return res.status(404).json({ error: 'Onboarding progress not found' });
    res.json(progress);
  } catch (err) {
    console.error('[Onboarding] Get onboarding progress error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/applications/:appId/onboarding-progress', async (req: Request, res: Response) => {
  const { appId } = req.params;
  const updateData = req.body;

  try {
    const existing = await prisma.applicationOnboardingProgress.findUnique({
      where: { applicationId: appId }
    });
    if (!existing) return res.status(404).json({ error: 'Onboarding progress not found' });

    const merged = { ...existing, ...updateData };

    const isCompleted = merged.organizationCreated &&
      merged.applicationCreated &&
      merged.expectedFlowsDefined &&
      merged.installationTestPassed &&
      merged.sdkConnected &&
      merged.demonstrationCompleted &&
      merged.firstReportGenerated &&
      merged.valueRealized;

    const completedAt = isCompleted ? (existing.completedAt || new Date()) : null;

    const progress = await prisma.applicationOnboardingProgress.update({
      where: { applicationId: appId },
      data: {
        ...updateData,
        completedAt
      }
    });

    // Resolve org & environment contexts for emitting activation events
    const app = await prisma.application.findUnique({
      where: { id: appId },
      select: { organizationId: true, environments: { where: { isDefault: true } } }
    });
    const orgId = app?.organizationId;
    const envId = app?.environments?.[0]?.id ?? null;

    if (orgId) {
      if (updateData.expectedFlowsDefined === true && !existing.expectedFlowsDefined) {
        await emitActivationEvent(orgId, appId, envId, 'FLOW_SAVED', { source: 'manual' });
      }
      if (updateData.demonstrationCompleted === true && !existing.demonstrationCompleted) {
        await emitActivationEvent(orgId, appId, envId, 'DEMO_COMPLETED');
      }
      if (updateData.firstReportGenerated === true && !existing.firstReportGenerated) {
        await emitActivationEvent(orgId, appId, envId, 'REPORT_GENERATED');
      }
    }

    res.json(progress);
  } catch (err) {
    console.error('[Onboarding] Update onboarding progress error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// SDK Readiness Check
// ─────────────────────────────────────────────────────────────

app.get('/applications/:appId/environments/:envId/sdk-readiness', async (req: Request, res: Response) => {
  const { appId, envId } = req.params;

  try {
    const app = await prisma.application.findUnique({
      where: { id: appId },
      select: { organizationId: true }
    });
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const orgId = app.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Application organization missing' });

    // Lookup sessions in this environment
    const sessionCount = await prisma.session.count({
      where: { environmentId: envId }
    });

    const eventCount = await prisma.sessionEvent.count({
      where: { session: { environmentId: envId } }
    });

    const testEvent = await prisma.sessionEvent.findFirst({
      where: {
        eventType: 'SOTS_ONBOARDING_TEST',
        session: { environmentId: envId }
      }
    });

    const installationTestPassed = !!testEvent;
    const connected = sessionCount > 0;
    const sessionTracking = sessionCount > 0;
    const eventTracking = eventCount > 0;
    const telemetryReceived = eventCount > 0;
    const readyForDemonstration = connected && eventTracking && installationTestPassed;

    if (installationTestPassed) {
      const progress = await prisma.applicationOnboardingProgress.findUnique({
        where: { applicationId: appId }
      });
      if (progress && (!progress.installationTestPassed || !progress.sdkConnected)) {
        await prisma.applicationOnboardingProgress.update({
          where: { applicationId: appId },
          data: {
            installationTestPassed: true,
            sdkConnected: true
          }
        });

        if (!progress.sdkConnected) {
          await emitActivationEvent(orgId, appId, envId, 'SDK_CONNECTED');
          void emailService.sendToOrganizationMembers({
            templateKey: 'sdk-first-event',
            organizationId: orgId,
            applicationId: appId,
            eventType: 'SDK_FIRST_EVENT',
            variables: {
              applicationName: (await prisma.application.findUnique({ where: { id: appId }, select: { name: true } }))?.name || 'Application',
              dashboardUrl: appUrl(`/declare?applicationId=${appId}&environmentId=${envId}`),
            },
            idempotencyKey: buildIdempotencyKey(['sdk-first-event', appId, envId]),
            roles: [MemberRole.OWNER, MemberRole.ADMIN],
          }).catch((err) => console.error('[Email] sdk-first-event failed', err));
        }
        if (!progress.installationTestPassed) {
          await emitActivationEvent(orgId, appId, envId, 'INSTALL_TEST_PASSED');
        }
      }
    }

    res.json({
      connected,
      sessionTracking,
      eventTracking,
      environmentResolved: connected,
      applicationResolved: connected,
      telemetryReceived,
      installationTestPassed,
      readyForDemonstration
    });
  } catch (err) {
    console.error('[Onboarding] Get SDK readiness error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Demonstration Validation
// ─────────────────────────────────────────────────────────────

app.get('/applications/:appId/environments/:envId/demo-status', async (req: Request, res: Response) => {
  const { appId, envId } = req.params;

  try {
    const activeGraph = await prisma.behaviorGraph.findFirst({
      where: { applicationId: appId, environmentId: envId, graphType: 'DECLARED', isActive: true },
      include: { nodes: true }
    });

    const expectedStateCount = activeGraph ? activeGraph.nodes.length : 0;
    const minStatesRequired = Math.max(3, Math.ceil(expectedStateCount * 0.25));

    // Get latest demonstration session
    const latestDemo = await prisma.demonstration.findFirst({
      where: { applicationId: appId, environmentId: envId },
      orderBy: { startedAt: 'desc' }
    });

    let observedStates = 0;
    let observedTransitions = 0;

    if (latestDemo) {
      const uniqueObservedStates = await prisma.stateObservation.groupBy({
        by: ['stateId'],
        where: { sessionId: latestDemo.sessionId }
      });
      observedStates = uniqueObservedStates.length;

      const uniqueObservedTransitions = await prisma.transitionObservation.groupBy({
        by: ['transitionId'],
        where: { sessionId: latestDemo.sessionId }
      });
      observedTransitions = uniqueObservedTransitions.length;
    }

    const readyForAnalysis = observedStates >= minStatesRequired;

    // Log DEMO_THRESHOLD_MET if threshold reached
    if (readyForAnalysis && latestDemo) {
      const app = await prisma.application.findUnique({
        where: { id: appId },
        select: { organizationId: true }
      });
      if (app && app.organizationId) {
        // Find if this event was already emitted for this session
        const existingEvent = await prisma.activationEvent.findFirst({
          where: {
            organizationId: app.organizationId,
            eventName: 'DEMO_THRESHOLD_MET',
            environmentId: envId,
          }
        });
        if (!existingEvent) {
          await emitActivationEvent(app.organizationId, appId, envId, 'DEMO_THRESHOLD_MET', {
            sessionId: latestDemo.sessionId,
            observedStates,
            minStatesRequired
          });
        }
      }
    }

    res.json({
      observedStates,
      observedTransitions,
      expectedStates: expectedStateCount,
      minStatesRequired,
      readyForAnalysis
    });
  } catch (err) {
    console.error('[Onboarding] Get demo status error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// System-Derived valueRealized post-report webhook
// ─────────────────────────────────────────────────────────────

app.post('/internal/applications/:appId/reconcile-value', async (req: Request, res: Response) => {
  const { appId } = req.params;

  try {
    const latestReport = await prisma.reconciliationReport.findFirst({
      where: { applicationId: appId },
      orderBy: { generatedAt: 'desc' }
    });

    if (!latestReport) {
      return res.status(404).json({ error: 'No reconciliation reports found for this application' });
    }

    const hasGap = latestReport.trueGapCount > 0 ||
                   latestReport.undeclaredCount > 0 ||
                   latestReport.trueGapTransitions > 0 ||
                   latestReport.undeclaredTransitions > 0;

    if (hasGap) {
      const reason = latestReport.trueGapCount > 0 ? 'MISSING_STATE_FOUND' :
                     latestReport.undeclaredCount > 0 ? 'UNDECLARED_STATE_OBSERVED' :
                     latestReport.trueGapTransitions > 0 ? 'MISSING_TRANSITION_FOUND' : 'UNDECLARED_TRANSITION_OBSERVED';

      await prisma.applicationOnboardingProgress.upsert({
        where: { applicationId: appId },
        create: {
          applicationId: appId,
          valueRealized: true,
          valueRealizedReason: reason
        },
        update: {
          valueRealized: true,
          valueRealizedReason: reason
        }
      });

      const app = await prisma.application.findUnique({
        where: { id: appId },
        select: { organizationId: true }
      });

      if (app && app.organizationId) {
        // Emit VALUE_REALIZED activation event
        const existingEvent = await prisma.activationEvent.findFirst({
          where: {
            organizationId: app.organizationId,
            eventName: 'VALUE_REALIZED',
          }
        });
        if (!existingEvent) {
          await emitActivationEvent(app.organizationId, appId, null, 'VALUE_REALIZED', { reason });
        }
      }

      return res.json({ valueRealized: true, reason });
    }

    res.json({ valueRealized: false, message: 'No behavioral gaps detected yet.' });
  } catch (err) {
    console.error('[Onboarding] Reconcile value error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Internal: API key validation endpoint (called by API Gateway)
// ─────────────────────────────────────────────────────────────

/**
 * POST /internal/validate-key
 * Body: { keyHash: string }
 * Returns the resolved org + application context, or 401.
 */
app.post('/internal/validate-key', async (req: Request, res: Response) => {
  const { keyHash } = req.body;
  if (!keyHash) return res.status(400).json({ error: 'keyHash required' });

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        environment: {
          include: {
            application: {
              include: {
                organization: {
                  include: {
                    entitlement: true
                  }
                }
              }
            }
          }
        }
      },
    });

    if (!apiKey || apiKey.revokedAt) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return res.status(401).json({ error: 'API key has expired' });
    }

    // Update lastUsedAt asynchronously (fire-and-forget)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    const env = apiKey.environment;
    const app = env.application;
    const org = app.organization;
    const planType = org?.entitlement?.planType || 'FREE';

    res.json({
      organizationId: app.organizationId,
      organizationName: org?.name || '',
      applicationId: app.id,
      environment: {
        id: env.id,
        name: env.name,
        type: env.type,
      },
      planType,
    });
  } catch (err) {
    console.error('[Onboarding] Validate key error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/notifications/email/webhooks/resend', async (req: Request, res: Response) => {
  const expectedSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (expectedSecret) {
    const actual = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-resend-webhook-secret'];
    if (actual !== expectedSecret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
  }

  try {
    await emailService.applyResendWebhook(req.body);
    res.json({ received: true });
  } catch (err) {
    console.error('[Onboarding] Resend webhook failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Organization audit log endpoint
app.get('/organizations/:orgId/audit-logs', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string ?? '25', 10)));
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';

  if (action && !Object.values(AuditAction).includes(action as AuditAction)) {
    return res.status(400).json({ error: 'INVALID_ACTION', message: 'Unsupported audit action filter.' });
  }

  try {
    const hasAuditAccess = await entitlementChecker.canAccess(orgId, Feature.AUDIT_LOGS);
    if (!hasAuditAccess) {
      return res.status(403).json({ error: 'AUDIT_LOGS_REQUIRED', message: 'Audit logs are available on Business and Enterprise plans.' });
    }

    const where: any = {
      organizationId: orgId,
      ...(action ? { action: action as AuditAction } : {}),
    };

    if (q) {
      const matchingActions = Object.values(AuditAction).filter((value) => value.toLowerCase().includes(q.toLowerCase()));
      where.OR = [
        { userId: { contains: q, mode: 'insensitive' } },
        { user: { is: { email: { contains: q, mode: 'insensitive' } } } },
        { user: { is: { displayName: { contains: q, mode: 'insensitive' } } } },
        ...matchingActions.map((value) => ({ action: value })),
      ];
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { email: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ data, total, page, limit });
  } catch (err) {
    console.error('[OnboardingAPI] Organization audit logs error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// System Admin Endpoints (Sprint 3 — isSystemAdmin JWT claim)
// ─────────────────────────────────────────────────────────────

async function verifySystemAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    if (!decoded.isSystemAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'System admin access required.' });
    }
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch {
    res.status(401).json({ error: 'TOKEN_INVALID' });
  }
}

/** GET /admin/audit-logs — paginated audit log with action + search filter */
app.get('/admin/audit-logs', verifySystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit as string ?? '25', 10));
  const q      = req.query.q as string | undefined;
  const action = req.query.action as string | undefined;

  try {
    const where: any = {
      ...(action ? { action } : {}),
      ...(q ? {
        OR: [
          { userId: { contains: q } },
          { organizationId: { contains: q } },
          { action: { contains: q } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { email: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ data, total, page, limit });
  } catch (err) {
    console.error('[Admin] Audit logs error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /admin/ai-usage - summary across all orgs */
app.get('/admin/ai-usage', verifySystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { days, startDate, endDate } = aiUsageDateRangeForDays(req.query.days);

  try {
    // Only aggregate today's logs dynamically to ensure real-time accuracy and prevent loading the entire history.
    const todayStart = utcDayStart(new Date());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    await ensureAiUsageAggregated(todayStart, todayEnd);

    const aggregates = await prisma.aIUsageDailyAggregate.findMany({
      where: { date: { gte: startDate, lt: endDate } },
      orderBy: { date: 'desc' },
    });

    const totals = aggregates.reduce((acc, r) => ({
      totalCalls: acc.totalCalls + r.totalCalls,
      totalInputTokens: acc.totalInputTokens + r.totalInputTokens,
      totalOutputTokens: acc.totalOutputTokens + r.totalOutputTokens,
      totalCostUsd: acc.totalCostUsd + Number(r.totalCostUsd),
    }), { totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0 });

    const byProvider: Record<string, any> = {};
    for (const r of aggregates) {
      if (!byProvider[r.provider]) {
        byProvider[r.provider] = { provider: r.provider, calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
      }
      byProvider[r.provider].calls += r.totalCalls;
      byProvider[r.provider].inputTokens += r.totalInputTokens;
      byProvider[r.provider].outputTokens += r.totalOutputTokens;
      byProvider[r.provider].estimatedCostUsd += Number(r.totalCostUsd);
    }

    res.json({
      ...totals,
      avgCallsPerDay: days > 0 ? totals.totalCalls / days : 0,
      byProvider: Object.values(byProvider),
    });
  } catch (err) {
    console.error('[Admin] AI usage error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /admin/ai-usage/daily */
app.get('/admin/ai-usage/daily', verifySystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate } = aiUsageDateRangeForDays(req.query.days);

  try {
    // Only aggregate today's logs dynamically to ensure real-time accuracy and prevent loading the entire history.
    const todayStart = utcDayStart(new Date());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    await ensureAiUsageAggregated(todayStart, todayEnd);

    const data = await prisma.aIUsageDailyAggregate.findMany({
      where: { date: { gte: startDate, lt: endDate } },
      orderBy: { date: 'desc' },
      take: 500,
    });

    res.json({
      data: data.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        provider: r.provider,
        modelId: r.model,
        calls: r.totalCalls,
        inputTokens: r.totalInputTokens,
        outputTokens: r.totalOutputTokens,
        estimatedCostUsd: Number(r.totalCostUsd),
      })),
    });
  } catch (err) {
    console.error('[Admin] AI usage daily error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /admin/ai-usage/backfill */
app.post('/admin/ai-usage/backfill', verifySystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const days = Math.min(90, parseInt(req.query.days as string ?? '30', 10));
  try {
    const result = await backfillAiUsageDaily({ prisma, days });
    res.json(result);
  } catch (err) {
    console.error('[Admin] AI usage backfill error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
/** GET /admin/rulesets — list DomainRulesetVersions (DRAFT/ACTIVE) across all domains */
app.get('/admin/rulesets', verifySystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit  = Math.min(100, parseInt(req.query.limit as string ?? '30', 10));

  try {
    const data = await prisma.domainRulesetVersion.findMany({
      where: status ? { status: status as any } : undefined,
      include: { ruleset: { select: { name: true, key: true, applicationId: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      data: data.map((r) => ({
        id: r.id,
        applicationId: r.ruleset.applicationId,
        applicationName: r.ruleset.name,
        version: r.version,
        status: r.status,
        compiledAt: r.createdAt,
        rules: [],
        ruleCount: (r as any)._count?.patterns ?? 0,
        profileType: r.ruleset.key,
      })),
    });
  } catch (err) {
    console.error('[Admin] Rulesets list error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /admin/rulesets/:id/promote — promote DomainRulesetVersion from DRAFT to PUBLISHED */
app.post('/admin/rulesets/:id/promote', verifySystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const actorId = req.user!.id;

  try {
    const version = await prisma.domainRulesetVersion.findUnique({
      where: { id },
      include: { ruleset: true },
    });
    if (!version) return res.status(404).json({ error: 'RULESET_NOT_FOUND' });
    if (version.status !== 'DRAFT') return res.status(409).json({ error: 'NOT_DRAFT', message: 'Only DRAFT rulesets can be promoted.' });

    const updated = await prisma.domainRulesetVersion.update({
      where: { id },
      data: { status: 'ACTIVE' as const, promotedBy: actorId, promotedAt: new Date() },
    });

    void writeAuditLog(prisma, {
      action: AuditAction.RULESET_VERSION_PROMOTED,
      userId: actorId,
      applicationId: version.ruleset.applicationId || undefined,
      metadata: { rulesetVersionId: id, version: version.version, rulesetId: version.rulesetId },
    });

    res.json({ id: updated.id, status: updated.status });
  } catch (err) {
    console.error('[Admin] Ruleset promote error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /admin/rule-candidates — paginated list */
app.get('/admin/rule-candidates', verifySystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const limit  = Math.min(100, parseInt(req.query.limit as string ?? '20', 10));
  const cursor = req.query.cursor as string | undefined;
  const status = req.query.status as string | undefined;

  try {
    const where: any = status ? { status } : undefined;
    const data = await prisma.ruleCandidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = data.length > limit;
    const page = hasMore ? data.slice(0, limit) : data;

    res.json({
      data: page.map((c) => ({
        id: c.id,
        applicationId: c.applicationId,
        ruleName: `${c.source} candidate`,
        ruleType: c.source,
        confidence: c.confidence,
        status: c.status,
        proposedRule: c.candidateJson,
        createdAt: c.createdAt,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (err) {
    console.error('[Admin] Rule candidates list error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /admin/rule-candidates/:id/approve */
app.post('/admin/rule-candidates/:id/approve', verifySystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const actorId = req.user!.id;

  try {
    const candidate = await prisma.ruleCandidate.findUnique({ where: { id } });
    if (!candidate) return res.status(404).json({ error: 'NOT_FOUND' });

    const updated = await prisma.ruleCandidate.update({
      where: { id },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: actorId },
    });

    void writeAuditLog(prisma, {
      action: AuditAction.AI_SUGGESTION_ACCEPTED,
      userId: actorId,
      applicationId: candidate.applicationId || undefined,
      metadata: { ruleCandidateId: id, source: candidate.source },
    });

    res.json({ id: updated.id, status: updated.status });
  } catch (err) {
    console.error('[Admin] Approve rule candidate error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /admin/rule-candidates/:id/reject */
app.post('/admin/rule-candidates/:id/reject', verifySystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const actorId = req.user!.id;

  try {
    const candidate = await prisma.ruleCandidate.findUnique({ where: { id } });
    if (!candidate) return res.status(404).json({ error: 'NOT_FOUND' });

    const updated = await prisma.ruleCandidate.update({
      where: { id },
      data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: actorId },
    });

    res.json({ id: updated.id, status: updated.status });
  } catch (err) {
    console.error('[Admin] Reject rule candidate error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Member Management (Sprint 3 — Role-gated)
// ─────────────────────────────────────────────────────────────

/** GET /organizations/:orgId/members — list members, optionally filtered by role */
app.get('/organizations/:orgId/members', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId } = req.params;
  const roleFilter = req.query.role as string | undefined;

  try {
    const memberships = await prisma.organizationMembership.findMany({
      where: {
        organizationId: orgId,
        ...(roleFilter ? { role: roleFilter as MemberRole } : {}),
      },
      include: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true } } },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    res.json(memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      createdAt: m.joinedAt,
      user: m.user,
    })));
  } catch (err) {
    console.error('[OnboardingAPI] List members error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /organizations/:orgId/members/:userId/role — change a member's role (OWNER only) */
app.put('/organizations/:orgId/members/:userId/role', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId, userId: targetUserId } = req.params;
  const { role } = req.body as { role: string };
  const actorId = req.user!.id;

  if (!Object.values(MemberRole).includes(role as MemberRole)) {
    return res.status(400).json({ error: 'INVALID_ROLE', message: `Role must be one of: ${Object.values(MemberRole).join(', ')}` });
  }

  try {
    // Only OWNERs may change roles
    const actorMembership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: actorId, organizationId: orgId } },
    });
    if (actorMembership?.role !== MemberRole.OWNER) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only Owners may change member roles.' });
    }

    const targetMembership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!targetMembership) {
      return res.status(404).json({ error: 'MEMBER_NOT_FOUND', message: 'User is not a member of this organization.' });
    }

    // Guard: cannot demote the last OWNER
    if (targetMembership.role === MemberRole.OWNER && role !== MemberRole.OWNER) {
      const ownerCount = await prisma.organizationMembership.count({
        where: { organizationId: orgId, role: MemberRole.OWNER },
      });
      if (ownerCount <= 1) {
        return res.status(409).json({ error: 'LAST_OWNER', message: 'Cannot demote the last Owner. Assign another Owner first.' });
      }
    }

    const updated = await prisma.organizationMembership.update({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
      data: { role: role as MemberRole },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });

    void writeAuditLog(prisma, {
      action: AuditAction.ROLE_CHANGED,
      userId: actorId,
      organizationId: orgId,
      metadata: { targetUserId, from: targetMembership.role, to: role },
    });

    res.json({ id: updated.id, userId: updated.userId, role: updated.role, user: updated.user });
  } catch (err) {
    console.error('[OnboardingAPI] Change member role error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /organizations/:orgId/members/:userId — remove a member (OWNER only) */
app.delete('/organizations/:orgId/members/:userId', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId, userId: targetUserId } = req.params;
  const actorId = req.user!.id;

  try {
    // Only OWNERs may remove members
    const actorMembership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: actorId, organizationId: orgId } },
    });
    if (actorMembership?.role !== MemberRole.OWNER) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only Owners may remove members.' });
    }

    const targetMembership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!targetMembership) {
      return res.status(404).json({ error: 'MEMBER_NOT_FOUND', message: 'User is not a member of this organization.' });
    }

    // Guard: cannot remove the last OWNER
    if (targetMembership.role === MemberRole.OWNER) {
      const ownerCount = await prisma.organizationMembership.count({
        where: { organizationId: orgId, role: MemberRole.OWNER },
      });
      if (ownerCount <= 1) {
        return res.status(409).json({ error: 'LAST_OWNER', message: 'Cannot remove the last Owner.' });
      }
    }

    await prisma.organizationMembership.delete({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });

    void writeAuditLog(prisma, {
      action: AuditAction.MEMBER_REMOVED,
      userId: actorId,
      organizationId: orgId,
      metadata: { targetUserId, removedRole: targetMembership.role },
    });

    res.json({ success: true, userId: targetUserId });
  } catch (err) {
    console.error('[OnboardingAPI] Remove member error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ─────────────────────────────────────────────────────────────
// Gap 7: Pending Invitations
// GET    /organizations/:orgId/invitations/pending
// DELETE /organizations/:orgId/invitations/:invitationId
// ─────────────────────────────────────────────────────────────

app.get('/organizations/:orgId/invitations/pending', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId } = req.params;
  const actorId = req.user!.id;

  try {
    const actorMembership = await getOrgMembership(actorId, orgId);
    if (!isOrgManager(actorMembership?.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only Owners and Admins may view pending invitations.' });
    }

    const invitations = await prisma.organizationInvitation.findMany({
      where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        createdByUserId: true,
      },
    });

    const creatorIds = [...new Set(invitations.map((invitation) => invitation.createdByUserId))];
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, email: true, displayName: true },
    });
    const creatorsById = new Map(creators.map((creator) => [creator.id, creator]));

    res.json({
      success: true,
      data: invitations.map((invitation) => ({
        ...invitation,
        status: 'PENDING',
        invitedBy: creatorsById.get(invitation.createdByUserId) ?? null,
      })),
    });
  } catch (err) {
    console.error('[OnboardingAPI] Pending invitations error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/organizations/:orgId/invitations/:invitationId', verifyJwt, verifyOrgMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { orgId, invitationId } = req.params;
  const actorId = req.user!.id;

  try {
    const actorMembership = await getOrgMembership(actorId, orgId);
    if (!isOrgManager(actorMembership?.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only Owners and Admins may rescind invitations.' });
    }

    const invitation = await prisma.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId: orgId, acceptedAt: null },
    });
    if (!invitation) {
      return res.status(404).json({ error: 'INVITATION_NOT_FOUND', message: 'Pending invitation not found.' });
    }

    await prisma.organizationInvitation.delete({ where: { id: invitation.id } });
    res.json({ success: true, invitationId });
  } catch (err) {
    console.error('[OnboardingAPI] Rescind invitation error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Start
// ─────────────────────────────────────────────────────────────



void emailService.syncBuiltinTemplates().catch((err) => console.error('[Email] Template sync failed', err));

const PORT = Number(process.env.PORT || Services.ONBOARDING_API);

app.listen(PORT, () => {
  console.log(`[OnboardingAPI] Running on port ${PORT}`);
});
