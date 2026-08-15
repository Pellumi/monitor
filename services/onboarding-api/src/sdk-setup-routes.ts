import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { EnvironmentType, type PrismaClient } from '@sots/db';

type SetupRequest = Request & { user?: { id: string; email: string } };
type Middleware = (req: SetupRequest, res: Response, next: NextFunction) => unknown;

const FRONTEND_SOURCES = ['frontend-sdk', 'react-sdk', 'browser'];
const BACKEND_SOURCES = ['backend-sdk', 'node-sdk', 'server'];
const HANDOFF_TTL_MS = 15 * 60 * 1_000;

function digest(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function issueKey() {
  const secret = crypto.randomBytes(32).toString('hex');
  return { rawKey: `sots_${secret}`, keyHash: digest(`sots_${secret}`), keyPrefix: `sots_${secret.slice(0, 8)}` };
}

function defaultGatewayEndpoint(): string {
  return (process.env.TELLANN_PUBLIC_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

function validateGatewayEndpoint(value: unknown): { value: string | null } | { error: string } {
  const candidate = String(value ?? '').trim();
  if (!candidate) return { value: null };
  try {
    const parsed = new URL(candidate);
    const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
      return { error: 'Gateway endpoints must use HTTPS. HTTP is allowed only for localhost development.' };
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      return { error: 'Gateway endpoints cannot contain credentials, query parameters, or fragments.' };
    }
    return { value: candidate.replace(/\/$/, '') };
  } catch {
    return { error: 'Enter a valid gateway URL.' };
  }
}

async function readiness(prisma: PrismaClient, applicationId: string, environmentId: string) {
  const [sessions, configuredPlans] = await Promise.all([
    prisma.session.findMany({
      where: { applicationId, environmentId },
      select: { startTime: true, events: { select: { eventType: true, source: true, timestamp: true } } },
    }),
    prisma.instrumentationPlan.findMany({
      where: {
        environmentId,
        status: { in: ['APPLIED', 'COMPLETED', 'VALIDATION_FAILED'] },
        workspace: { applicationId },
      },
      select: { adapterId: true, status: true, planJson: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);
  const events = sessions.flatMap((session) => session.events);
  const configuredKinds = new Set<'FRONTEND' | 'BACKEND'>();
  for (const plan of configuredPlans) {
    const packageChanges = Array.isArray((plan.planJson as { packageChanges?: unknown[] } | null)?.packageChanges)
      ? (plan.planJson as { packageChanges: Array<{ packageName?: string }> }).packageChanges
      : [];
    if (packageChanges.some((change) => change.packageName === '@sots/frontend-sdk')) configuredKinds.add('FRONTEND');
    if (packageChanges.some((change) => change.packageName === '@sots/backend-sdk')) configuredKinds.add('BACKEND');
    if (packageChanges.length === 0) {
      configuredKinds.add(['react-vite', 'nextjs'].includes(plan.adapterId) ? 'FRONTEND' : 'BACKEND');
    }
  }
  const buildTarget = (targetId: string, kind: 'FRONTEND' | 'BACKEND', sources: string[]) => {
    const targetEvents = events.filter((event) => sources.includes(event.source));
    const test = targetEvents.some((event) => event.eventType === 'SOTS_ONBOARDING_TEST');
    return {
      targetId, kind, source: sources[0], configured: configuredKinds.has(kind), processHealthy: targetEvents.length > 0,
      sessionObserved: targetEvents.length > 0, eventObserved: targetEvents.length > 0,
      installationTestPassed: test, verified: test,
      lastEventAt: [...targetEvents].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp.toISOString() ?? null,
    };
  };
  const targets = [buildTarget('frontend', 'FRONTEND', FRONTEND_SOURCES), buildTarget('backend', 'BACKEND', BACKEND_SOURCES)];
  const installationTestPassed = events.some((event) => event.eventType === 'SOTS_ONBOARDING_TEST');
  const codeConfigured = targets.some((target) => target.configured);
  return {
    applicationId, environmentId, connected: sessions.length > 0 && installationTestPassed,
    codeConfigured,
    readyForDemonstration: sessions.length > 0 && events.length > 0 && installationTestPassed,
    sessionObserved: sessions.length > 0, eventObserved: events.length > 0, installationTestPassed, targets,
  };
}

function snippets(endpoint: string, applicationId: string, environmentId: string) {
  const shared = `endpoint: '${endpoint}',\n    apiKey: process.env.TELLANN_INGESTION_KEY,\n    applicationId: '${applicationId}',\n    environmentId: '${environmentId}'`;
  return [
    {
      id: 'frontend', kind: 'FRONTEND', label: 'Browser application', packageName: '@sots/frontend-sdk', packageVersion: '^0.1.0',
      installCommands: { npm: 'npm install @sots/frontend-sdk', pnpm: 'pnpm add @sots/frontend-sdk', yarn: 'yarn add @sots/frontend-sdk', bun: 'bun add @sots/frontend-sdk' },
      environmentVariables: { endpoint: 'NEXT_PUBLIC_TELLANN_GATEWAY_URL or VITE_TELLANN_GATEWAY_URL', key: 'NEXT_PUBLIC_TELLANN_INGESTION_KEY or VITE_TELLANN_INGESTION_KEY' },
      snippet: `import { SOTS } from '@sots/frontend-sdk';\n\nSOTS.initialize({\n    ${shared.replace('process.env.TELLANN_INGESTION_KEY', 'process.env.NEXT_PUBLIC_TELLANN_INGESTION_KEY')}\n});\nvoid SOTS.verifyInstallation();`,
    },
    {
      id: 'backend', kind: 'BACKEND', label: 'Node.js server', packageName: '@sots/backend-sdk', packageVersion: '^0.1.0',
      installCommands: { npm: 'npm install @sots/backend-sdk', pnpm: 'pnpm add @sots/backend-sdk', yarn: 'yarn add @sots/backend-sdk', bun: 'bun add @sots/backend-sdk' },
      environmentVariables: { endpoint: 'TELLANN_GATEWAY_URL', key: 'TELLANN_INGESTION_KEY' },
      snippet: `import { SOTS } from '@sots/backend-sdk';\n\nSOTS.initialize({\n    ${shared}\n});\nawait SOTS.verifyInstallation();`,
    },
  ];
}

export function createSdkSetupRouter(input: { prisma: PrismaClient; verifyJwt: Middleware; verifyAppOwnership: Middleware }) {
  const { prisma, verifyJwt, verifyAppOwnership } = input;
  const router = Router();

  router.get('/applications/:appId/sdk-setup', verifyJwt, verifyAppOwnership, async (req: SetupRequest, res: Response) => {
    const application = await prisma.application.findUnique({ where: { id: req.params.appId }, include: { environments: { orderBy: { createdAt: 'asc' }, include: { apiKeys: { where: { revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 } } } } });
    if (!application?.organizationId) return res.status(404).json({ error: 'Application not found' });
    const environment = req.query.environmentId
      ? application.environments.find((item) => item.id === req.query.environmentId)
      : application.environments.find((item) => item.isDefault) ?? application.environments[0];
    if (!environment) return res.status(404).json({ error: 'Environment not found' });
    const status = await readiness(prisma, application.id, environment.id);
    const endpoint = environment.telemetryGatewayUrl ?? defaultGatewayEndpoint();
    if (status.codeConfigured || status.sessionObserved || status.installationTestPassed) {
      await prisma.applicationOnboardingProgress.updateMany({ where: { applicationId: application.id }, data: {
        sdkTargetsConfigured: status.codeConfigured,
        sessionObserved: status.sessionObserved,
        installationTestPassed: status.installationTestPassed,
        sdkConnected: status.connected,
      } });
    }
    const key = environment.apiKeys[0];
    res.json({ applicationId: application.id, applicationName: application.name, organizationId: application.organizationId, environmentId: environment.id, environmentName: environment.name, environmentType: environment.type, baseUrl: environment.baseUrl, gatewayEndpoint: endpoint, gatewayEndpointCustomized: Boolean(environment.telemetryGatewayUrl), hasActiveKey: Boolean(key), keyPrefix: key?.keyPrefix ?? null, targets: snippets(endpoint, application.id, environment.id), readiness: status });
  });

  router.patch('/applications/:appId/environments/:environmentId/sdk-settings', verifyJwt, verifyAppOwnership, async (req: SetupRequest, res: Response) => {
    const environment = await prisma.environment.findFirst({
      where: { id: req.params.environmentId, applicationId: req.params.appId },
      select: { id: true },
    });
    if (!environment) return res.status(404).json({ error: 'Environment not found' });
    const validated = validateGatewayEndpoint(req.body?.telemetryGatewayUrl);
    if ('error' in validated) return res.status(400).json({ error: 'INVALID_GATEWAY_ENDPOINT', message: validated.error });
    const updated = await prisma.environment.update({
      where: { id: environment.id },
      data: { telemetryGatewayUrl: validated.value },
      select: { id: true, telemetryGatewayUrl: true },
    });
    res.json({ ...updated, gatewayEndpoint: updated.telemetryGatewayUrl ?? defaultGatewayEndpoint(), customized: Boolean(updated.telemetryGatewayUrl) });
  });

  router.patch('/applications/:appId/sdk-setup/method', verifyJwt, verifyAppOwnership, async (req: SetupRequest, res: Response) => {
    const method = String(req.body?.method ?? '');
    if (!['MANUAL', 'DESKTOP'].includes(method)) return res.status(400).json({ error: 'INVALID_CONNECTION_METHOD' });
    const updated = await prisma.applicationOnboardingProgress.updateMany({
      where: { applicationId: req.params.appId },
      data: { connectionMethodSelected: method },
    });
    if (updated.count !== 1) return res.status(404).json({ error: 'ONBOARDING_PROGRESS_NOT_FOUND' });
    const progress = await prisma.applicationOnboardingProgress.findUnique({ where: { applicationId: req.params.appId } });
    res.json(progress);
  });

  router.post('/applications/:appId/sdk-setup/key', verifyJwt, verifyAppOwnership, async (req: SetupRequest, res: Response) => {
    const environment = await prisma.environment.findFirst({ where: { id: String(req.body?.environmentId ?? ''), applicationId: req.params.appId }, include: { application: true } });
    if (!environment || environment.type === EnvironmentType.PRODUCTION) return res.status(403).json({ error: 'AUTOMATED_SETUP_REQUIRES_NON_PRODUCTION_ENVIRONMENT' });
    const generated = issueKey();
    const record = await prisma.apiKey.create({ data: { environmentId: environment.id, keyHash: generated.keyHash, keyPrefix: generated.keyPrefix, label: 'SDK setup key', createdByUserId: req.user!.id } });
    await prisma.applicationOnboardingProgress.updateMany({ where: { applicationId: req.params.appId }, data: { sdkTargetsConfigured: true } });
    res.status(201).json({ id: record.id, keyPrefix: record.keyPrefix, rawKey: generated.rawKey, environmentId: environment.id });
  });

  router.post('/applications/:appId/sdk-setup/handoffs', verifyJwt, verifyAppOwnership, async (req: SetupRequest, res: Response) => {
    const environment = await prisma.environment.findFirst({ where: { id: String(req.body?.environmentId ?? ''), applicationId: req.params.appId }, include: { application: true } });
    if (!environment?.application.organizationId) return res.status(404).json({ error: 'Environment not found' });
    if (environment.type === EnvironmentType.PRODUCTION) return res.status(403).json({ error: 'PRODUCTION_OBSERVATION_ONLY' });
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS);
    await prisma.desktopSetupHandoff.create({ data: { tokenHash: digest(token), userId: req.user!.id, organizationId: environment.application.organizationId, applicationId: req.params.appId, environmentId: environment.id, expiresAt } });
    await prisma.applicationOnboardingProgress.updateMany({ where: { applicationId: req.params.appId }, data: { connectionMethodSelected: 'DESKTOP' } });
    res.status(201).json({ handoffToken: token, expiresAt: expiresAt.toISOString(), deepLink: `tellann://connect?handoff=${encodeURIComponent(token)}`, applicationId: req.params.appId, environmentId: environment.id });
  });

  router.post('/desktop/setup-handoffs/claim', verifyJwt, async (req: SetupRequest, res: Response) => {
    const token = String(req.body?.handoffToken ?? '');
    const deviceSessionId = String(req.body?.deviceSessionId ?? '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(404).json({ error: 'HANDOFF_NOT_FOUND' });
    const handoff = await prisma.desktopSetupHandoff.findUnique({ where: { tokenHash: digest(token) }, include: { application: true, environment: true } });
    if (!handoff || handoff.userId !== req.user!.id) return res.status(404).json({ error: 'HANDOFF_NOT_FOUND' });
    if (handoff.cancelledAt || handoff.consumedAt || handoff.expiresAt <= new Date()) return res.status(410).json({ error: 'HANDOFF_EXPIRED_OR_CONSUMED' });
    const device = await prisma.deviceSession.findFirst({ where: { id: deviceSessionId, userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!device) return res.status(403).json({ error: 'ACTIVE_DEVICE_REQUIRED' });
    const claim = await prisma.desktopSetupHandoff.updateMany({
      where: {
        id: handoff.id,
        userId: req.user!.id,
        consumedAt: null,
        cancelledAt: null,
        expiresAt: { gt: new Date() },
        OR: [{ claimedDeviceSessionId: null }, { claimedDeviceSessionId: device.id }],
      },
      data: { claimedDeviceSessionId: device.id, claimedAt: new Date() },
    });
    if (claim.count !== 1) return res.status(409).json({ error: 'HANDOFF_ALREADY_CLAIMED' });
    const claimed = await prisma.desktopSetupHandoff.findUniqueOrThrow({ where: { id: handoff.id } });
    res.json({ id: claimed.id, applicationId: handoff.applicationId, applicationName: handoff.application.name, environmentId: handoff.environmentId, environmentName: handoff.environment.name, environmentType: handoff.environment.type, expiresAt: handoff.expiresAt.toISOString() });
  });

  router.get('/applications/:appId/sdk-setup/handoffs/:id', verifyJwt, verifyAppOwnership, async (req: SetupRequest, res: Response) => {
    const handoff = await prisma.desktopSetupHandoff.findFirst({ where: { id: req.params.id, applicationId: req.params.appId, userId: req.user!.id } });
    if (!handoff) return res.status(404).json({ error: 'HANDOFF_NOT_FOUND' });
    res.json({ id: handoff.id, applicationId: handoff.applicationId, environmentId: handoff.environmentId, expiresAt: handoff.expiresAt.toISOString(), claimedAt: handoff.claimedAt?.toISOString() ?? null, consumedAt: handoff.consumedAt?.toISOString() ?? null, cancelledAt: handoff.cancelledAt?.toISOString() ?? null });
  });

  router.post('/desktop/setup-handoffs/:id/consume', verifyJwt, async (req: SetupRequest, res: Response) => {
    const deviceSessionId = String(req.body?.deviceSessionId ?? '');
    const device = await prisma.deviceSession.findFirst({
      where: { id: deviceSessionId, userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!device) return res.status(403).json({ error: 'ACTIVE_DEVICE_REQUIRED' });
    const updated = await prisma.desktopSetupHandoff.updateMany({ where: { id: req.params.id, userId: req.user!.id, claimedDeviceSessionId: deviceSessionId, consumedAt: null, cancelledAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
    if (updated.count !== 1) return res.status(409).json({ error: 'HANDOFF_CANNOT_BE_CONSUMED' });
    res.json({ success: true });
  });

  router.delete('/applications/:appId/sdk-setup/handoffs/:id', verifyJwt, verifyAppOwnership, async (req: SetupRequest, res: Response) => {
    const cancelled = await prisma.desktopSetupHandoff.updateMany({ where: { id: req.params.id, applicationId: req.params.appId, userId: req.user!.id, consumedAt: null }, data: { cancelledAt: new Date() } });
    if (cancelled.count !== 1) return res.status(404).json({ error: 'HANDOFF_NOT_FOUND' });
    res.status(204).send();
  });

  return router;
}
