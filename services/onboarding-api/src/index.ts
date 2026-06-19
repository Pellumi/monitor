import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient, EnvironmentType, MemberRole } from '@sots/db';
import { Services } from '@sots/shared';
import { EntitlementChecker } from '@sots/entitlement-checker';
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
const entitlementChecker = new EntitlementChecker(prisma);
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
  const { profileType } = req.body; // ECOMMERCE, LMS, or CUSTOM

  if (!profileType) {
    return res.status(400).json({ error: '`profileType` is required' });
  }

  try {
    const app = await prisma.application.findUnique({
      where: { id: appId },
      include: { organization: true }
    });
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const orgId = app.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Application has no organization' });

    // Upsert Profile
    await prisma.applicationProfile.upsert({
      where: { applicationId: appId },
      update: { profileType: profileType.toUpperCase() },
      create: { applicationId: appId, profileType: profileType.toUpperCase() },
    });

    const devEnv = await prisma.environment.findFirst({
      where: { applicationId: appId, isDefault: true }
    });
    const envId = devEnv?.id || null;

    let templateSelected = false;
    let expectedFlowsDefined = false;

    if (profileType === 'ECOMMERCE' || profileType === 'LMS') {
      templateSelected = true;
      expectedFlowsDefined = true;

      if (devEnv) {
        // Deactivate previous graphs
        await prisma.behaviorGraph.updateMany({
          where: { applicationId: appId, environmentId: devEnv.id, graphType: 'DECLARED' },
          data: { isActive: false }
        });

        // Create new BehaviorGraph version
        const graph = await prisma.behaviorGraph.create({
          data: {
            applicationId: appId,
            environmentId: devEnv.id,
            name: `Declared Graph (${profileType})`,
            graphType: 'DECLARED',
            sourceType: 'USER_DECLARATION',
            isActive: true,
            version: 1,
          }
        });

        const states = profileType === 'ECOMMERCE'
          ? ['Anonymous', 'Browse Products', 'View Product', 'Add To Cart', 'Checkout', 'Payment Success']
          : ['Anonymous', 'View Courses', 'Select Course', 'Enroll', 'Start Lesson', 'Complete Lesson'];

        // Create nodes
        const createdNodes: Record<string, any> = {};
        for (const name of states) {
          const node = await prisma.behaviorGraphNode.create({
            data: {
              graphId: graph.id,
              stateName: name,
              category: name === 'Anonymous' ? 'NAVIGATION' : 'BUSINESS',
              provenance: 'USER_AUTHORED',
            }
          });
          createdNodes[name] = node;
        }

        // Create edges
        for (let i = 0; i < states.length - 1; i++) {
          const fromNode = createdNodes[states[i]];
          const toNode = createdNodes[states[i + 1]];
          await prisma.behaviorGraphEdge.create({
            data: {
              graphId: graph.id,
              fromNodeId: fromNode.id,
              toNodeId: toNode.id,
              action: `Go to ${states[i + 1]}`,
              provenance: 'USER_AUTHORED',
            }
          });
        }
      }
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

    const eventName = templateSelected ? 'TEMPLATE_SELECTED' : 'BLANK_CANVAS_SELECTED';
    await emitActivationEvent(orgId, appId, envId, eventName, { profileType });

    if (templateSelected) {
      await emitActivationEvent(orgId, appId, envId, 'FLOW_SAVED', { profileType, source: 'template' });
    }

    res.json({ success: true, profileType, templateSelected, expectedFlowsDefined });
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

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────

const PORT = Services.ONBOARDING_API;

app.listen(PORT, () => {
  console.log(`[OnboardingAPI] Running on port ${PORT}`);
});
