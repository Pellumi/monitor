import { initTracing } from '@sots/telemetry';
initTracing('fdrs-api');

import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient, FlowStatus, StateCategory, StateProvenance, GraphType, GraphSourceType, AuditAction } from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';
import { Feature, Services } from '@sots/shared';
import { normalizeIntent, getSuggestions } from '@sots/derivation-engine';
import { compileFlowRuleset } from './compiler';
import { runReconciliation } from './reconciliation';
import { generateAiFlowDraft, generateFlowSuggestions } from '@sots/ai';
import { validateGeneratedGraph } from '@sots/graph-validation';
import { getActiveRulesets, inferDomain, generateRuleBasedFlow, suggestFlowGaps, reconstructRuleSet } from '@sots/rules';
import { writeAuditLog, extractAuditContext, makeRequireSystemAdmin } from '@sots/authz';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sots-default-jwt-secret-change-in-production';

/** Map legacy/alias provenance values to valid StateProvenance enum members */
function normalizeProvenance(raw: string): StateProvenance {
  const upper = (raw || '').toUpperCase().trim();
  const map: Record<string, StateProvenance> = {
    MANUAL: StateProvenance.USER_AUTHORED,
    USER_AUTHORED: StateProvenance.USER_AUTHORED,
    SUGGESTED_ACCEPTED: StateProvenance.SUGGESTED_ACCEPTED,
    DEMONSTRATION_PROMOTED: StateProvenance.DEMONSTRATION_PROMOTED,
    TELEMETRY_OBSERVED: StateProvenance.TELEMETRY_OBSERVED,
  };
  return map[upper] ?? StateProvenance.USER_AUTHORED;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

const app = express();
const prisma = new PrismaClient();
const entitlementChecker = new EntitlementChecker(prisma);
const requireSystemAdmin = makeRequireSystemAdmin(prisma);
app.use(express.json());

async function verifyJwt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // NOTE: x-sots-org-id is a gateway hint header, not an auth bypass.
  // JWT is ALWAYS required regardless of internal headers.
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

// System admin check is now DB-backed via makeRequireSystemAdmin(prisma) above.
// The legacy env-var approach has been replaced.

// requireSystemAdmin is now provided by makeRequireSystemAdmin(prisma) — see above.


async function verifyAppOwnership(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // x-sots-org-id is a gateway context header — it does NOT bypass ownership checks.
  // If the gateway supplies x-sots-application-id, validate against the route param only.
  if (req.headers['x-sots-org-id']) {
    const gatewayAppId = req.headers['x-sots-application-id'] as string | undefined;
    // The appId is resolved from route params only — never from the request body.
    const appId = req.params.appId || req.params.id;
    if (gatewayAppId && appId && gatewayAppId !== appId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Application ID mismatch' });
    }
    // Still fall through to check membership below — gateway does not grant ownership.
  }

  const appId = req.params.appId || req.params.id || req.body.applicationId;
  if (!appId) return next();

  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  try {
    const appRecord = await prisma.application.findUnique({
      where: { id: appId },
      select: { organizationId: true }
    });

    if (!appRecord) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: appRecord.organizationId as string
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

// Global authentication and authorization check
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  verifyJwt(req as AuthenticatedRequest, res, () => {
    verifyAppOwnership(req as AuthenticatedRequest, res, next);
  });
});

type SuggestionStatusValue = 'SUGGESTED' | 'ACCEPTED' | 'REJECTED' | 'EDITED';
const STATE_CATEGORIES = new Set(['NAVIGATION', 'UI', 'BUSINESS', 'ERROR', 'SYSTEM']);
const SUGGESTION_STATUS_PENDING = new Set(['PENDING', 'SUGGESTED', 'EDITED']);

function normalizeStateCategory(category: unknown): StateCategory {
  const normalized = typeof category === 'string' ? category.trim().toUpperCase() : '';
  return (STATE_CATEGORIES.has(normalized) ? normalized : 'BUSINESS') as StateCategory;
}

function isEnabledFlag(name: string): boolean {
  return String(process.env[name] || '').toLowerCase() === 'true';
}

function hashJson(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function getApplicationContext(applicationId: string) {
  return prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      organization: {
        include: {
          entitlement: true,
        },
      },
      environments: {
        where: { isDefault: true },
        take: 1,
      },
    },
  });
}

function entitlementAllows(features: unknown, key: 'experimentalAiFlowGeneration' | 'experimentalAiFlowSuggestions'): boolean {
  if (!features || typeof features !== 'object') return false;
  return (features as Record<string, unknown>)[key] === true;
}

async function requireAiAccess(applicationId: string, key: 'experimentalAiFlowGeneration' | 'experimentalAiFlowSuggestions') {
  const appRecord = await getApplicationContext(applicationId);
  if (!appRecord) {
    return { allowed: false, status: 404, error: 'Application not found' as const };
  }

  const globalFlag = key === 'experimentalAiFlowGeneration'
    ? isEnabledFlag('AI_FLOW_GENERATION_ENABLED')
    : isEnabledFlag('AI_FLOW_SUGGESTIONS_ENABLED');
  const globallyEnabled = isEnabledFlag('AI_FEATURES_ENABLED') && globalFlag;
  if (!globallyEnabled) {
    return {
      allowed: false,
      status: 403,
      error: 'AI_FEATURE_DISABLED' as const,
      appRecord,
    };
  }

  const orgAllowed = entitlementAllows(appRecord.organization?.entitlement?.features, key)
    || isEnabledFlag('AI_ALLOW_WITHOUT_ORG_ENTITLEMENT');
  if (!orgAllowed) {
    return {
      allowed: false,
      status: 403,
      error: 'AI_ORG_ENTITLEMENT_REQUIRED' as const,
      appRecord,
    };
  }

  return { allowed: true, appRecord };
}

async function createGraphFromWorkflow(params: {
  applicationId: string;
  environmentId?: string | null;
  workflow: {
    key: string;
    name: string;
    workflowType?: string;
    states: Array<{ key?: string; name: string; category?: string }>;
    transitions: Array<{ from: string; to: string; action?: string }>;
  };
  sourceType: GraphSourceType;
  declaredById?: string | null;
}) {
  await prisma.behaviorGraph.updateMany({
    where: {
      applicationId: params.applicationId,
      environmentId: params.environmentId || null,
      graphType: GraphType.DECLARED,
      isActive: true,
    },
    data: { isActive: false },
  });

  const latestGraph = await prisma.behaviorGraph.findFirst({
    where: {
      applicationId: params.applicationId,
      environmentId: params.environmentId || null,
      graphType: GraphType.DECLARED,
    },
    orderBy: { version: 'desc' },
  });

  const graph = await prisma.behaviorGraph.create({
    data: {
      applicationId: params.applicationId,
      environmentId: params.environmentId || null,
      name: params.workflow.name,
      workflowType: params.workflow.workflowType || params.workflow.key,
      graphType: GraphType.DECLARED,
      sourceType: params.sourceType,
      isActive: true,
      version: (latestGraph?.version ?? 0) + 1,
      declaredById: params.declaredById || null,
    },
  });

  const nodesByKey = new Map<string, { id: string }>();
  for (const state of params.workflow.states) {
    const key = (state.key || state.name).toUpperCase().trim();
    const node = await prisma.behaviorGraphNode.create({
      data: {
        graphId: graph.id,
        stateName: key,
        behaviorKey: key,
        category: normalizeStateCategory(state.category),
        provenance: params.sourceType === GraphSourceType.SYSTEM_GENERATED
          ? StateProvenance.SUGGESTED_ACCEPTED
          : StateProvenance.USER_AUTHORED,
        canonicalBehavior: key,
        declaredById: params.declaredById || null,
      },
    });
    nodesByKey.set(key, node);
  }

  for (const transition of params.workflow.transitions) {
    const fromNode = nodesByKey.get(transition.from.toUpperCase().trim());
    const toNode = nodesByKey.get(transition.to.toUpperCase().trim());
    if (!fromNode || !toNode) continue;
    await prisma.behaviorGraphEdge.create({
      data: {
        graphId: graph.id,
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        action: transition.action || null,
        provenance: params.sourceType === GraphSourceType.SYSTEM_GENERATED
          ? StateProvenance.SUGGESTED_ACCEPTED
          : StateProvenance.USER_AUTHORED,
      },
    });
  }

  return graph;
}

async function ensureSuggestionPattern(patternId: string, suggestion: {
  parentState?: { canonicalBehavior?: string | null; stateName?: string | null; category?: string | null };
  suggestedStateName: string;
  category: string;
  confidence: number;
  rationale: string;
}) {
  await prisma.patternLibraryEntry.upsert({
    where: { patternId },
    update: {},
    create: {
      patternId,
      triggerCanonicals: suggestion.parentState?.canonicalBehavior || suggestion.parentState?.stateName || 'UNKNOWN',
      triggerCategory: suggestion.parentState?.category || 'BUSINESS',
      suggestedStateName: suggestion.suggestedStateName,
      category: suggestion.category,
      confidence: suggestion.confidence,
      rationale: suggestion.rationale,
      libraryVersion: 'template-v1',
      active: true,
    },
  });
}

async function recordSuggestionOutcome(params: {
  suggestionId: string;
  applicationId: string;
  outcome: 'ACCEPTED' | 'REJECTED' | 'EDITED';
  rejectionReason?: string | null;
  suggestion: {
    patternId?: string | null;
    parentState?: { canonicalBehavior?: string | null; stateName?: string | null; category?: string | null };
    suggestedStateName: string;
    category: string;
    confidence: number;
    rationale: string;
  };
}) {
  const patternId = params.suggestion.patternId || `manual-${params.suggestionId}`;
  await ensureSuggestionPattern(patternId, params.suggestion);
  await prisma.suggestionOutcome.create({
    data: {
      suggestionId: params.suggestionId,
      patternId,
      applicationId: params.applicationId,
      outcome: params.outcome,
      rejectionReason: params.rejectionReason || null,
    },
  });
}

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
// Health Check
// ─────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'fdrs-api' });
});

function requireApplicationFeature(feature: Feature) {
  return async (req: Request, res: Response, next: () => void) => {
    const applicationId = req.params.id;
    try {
      const appRecord = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { organizationId: true },
      });
      if (!appRecord) return res.status(404).json({ error: 'Application not found' });
      if (appRecord.organizationId) {
        const allowed = await entitlementChecker.canAccess(appRecord.organizationId, feature);
        if (!allowed) {
          return res.status(403).json({
            error: 'FEATURE_NOT_ENTITLED',
            feature,
            message: 'Your current plan does not include this feature.',
          });
        }
      }
      next();
    } catch (err) {
      console.error('[FDRS] Entitlement check failed:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

app.use('/applications/:id/declared-flow', requireApplicationFeature(Feature.BEHAVIOR_GRAPH));
app.use('/applications/:id/reconciliation', requireApplicationFeature(Feature.COVERAGE_ANALYSIS));

// Dynamic rulesets and experimental flow intelligence.
app.get('/v1/rules/domains', async (_req: Request, res: Response) => {
  try {
    const domains = await prisma.domain.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: domains });
  } catch (err) {
    console.error('[FDRS] List domains error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/v1/rules/rulesets', async (req: Request, res: Response) => {
  try {
    const domainKey = typeof req.query.domainKey === 'string' ? req.query.domainKey : undefined;
    const rulesets = await getActiveRulesets({ domainKey, prisma });
    res.json({ success: true, data: rulesets });
  } catch (err) {
    console.error('[FDRS] List rulesets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/v1/rules/domains/:domainKey/active', async (req: Request, res: Response) => {
  try {
    const rulesets = await getActiveRulesets({ domainKey: req.params.domainKey, prisma });
    res.json({ success: true, data: rulesets });
  } catch (err) {
    console.error('[FDRS] Get active domain ruleset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/v1/admin/rules/rulesets/:rulesetId/versions', verifyJwt, requireSystemAdmin, async (req: Request, res: Response) => {
  const { rulesetId } = req.params;
  try {
    const latest = await prisma.domainRulesetVersion.findFirst({
      where: { rulesetId },
      orderBy: { version: 'desc' },
    });
    const version = await prisma.domainRulesetVersion.create({
      data: {
        rulesetId,
        version: (latest?.version ?? 0) + 1,
        status: 'DRAFT',
        changelog: typeof req.body.changelog === 'string' ? req.body.changelog : null,
        metadata: req.body.metadata ?? {},
      },
    });
    res.status(201).json({ success: true, data: version });
  } catch (err) {
    console.error('[FDRS] Create ruleset version error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/v1/admin/rules/ruleset-versions/:versionId/promote', verifyJwt, requireSystemAdmin, async (req: Request, res: Response) => {
  const { versionId } = req.params;
  const userId = (req as any).user?.id || null;
  try {
    const version = await prisma.domainRulesetVersion.findUnique({ where: { id: versionId } });
    if (!version) return res.status(404).json({ error: 'Ruleset version not found' });
    if (version.status === 'ACTIVE') {
      return res.status(400).json({ error: 'VERSION_ALREADY_ACTIVE', message: 'This version is already active' });
    }
    if (version.status === 'ARCHIVED') {
      return res.status(400).json({ error: 'VERSION_ARCHIVED', message: 'Cannot promote an archived version' });
    }
    const promoted = await prisma.$transaction(async (tx) => {
      await tx.domainRulesetVersion.updateMany({
        where: { rulesetId: version.rulesetId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });
      return tx.domainRulesetVersion.update({
        where: { id: versionId },
        data: {
          status: 'ACTIVE',
          promotedAt: new Date(),
          // Use the authenticated user's ID — never trust req.body
          promotedBy: userId,
        },
      });
    });
    // Write audit log for ruleset promotion
    const { ipAddress, userAgent } = extractAuditContext(req);
    await writeAuditLog(prisma, {
      action: AuditAction.RULESET_VERSION_PROMOTED,
      userId,
      metadata: { rulesetId: version.rulesetId, versionId, previousStatus: version.status },
      ipAddress,
      userAgent,
    });
    console.log(`[FDRS] Ruleset version ${versionId} promoted by ${userId}`);
    res.json({ success: true, data: promoted });
  } catch (err) {
    console.error('[FDRS] Promote ruleset version error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/v1/applications/:appId/flows/ai-drafts', async (req: Request, res: Response) => {
  const { appId } = req.params;
  const { productDescription, selectedDomainKey, mode } = req.body;
  if (!productDescription || typeof productDescription !== 'string') {
    return res.status(400).json({ error: 'productDescription is required' });
  }

  const access = await requireAiAccess(appId, 'experimentalAiFlowGeneration');
  if (!access.allowed) return res.status(access.status ?? 403).json({ error: access.error });

  const appRecord = access.appRecord!;
  const organizationId = appRecord.organizationId;
  if (!organizationId) return res.status(400).json({ error: 'Application has no organization' });

  // Gap 4: Always sanitize before any storage or processing
  const { sanitizeAiInputFull } = await import('@sots/ai');
  const sanitized = sanitizeAiInputFull(productDescription);
  const redactedDescription = sanitized.sanitizedText;
  const descriptionHash = sanitized.originalHash;

  if (sanitized.riskLevel === 'HIGH' && sanitized.promptInjectionRisk) {
    console.warn('[FDRS] AI draft blocked due to high-risk input', { descriptionHash, riskLevel: sanitized.riskLevel });
    return res.status(422).json({ error: 'DESCRIPTION_TOO_RISKY', message: 'Input blocked by privacy policy.' });
  }

  // Gap 8: Async mode (default) — enqueue job and return 202 immediately
  // Use ?mode=sync for backwards-compatible synchronous generation (e.g., tests)
  if (mode !== 'sync') {
    try {
      const inference = await inferDomain({
        description: redactedDescription,
        selectedDomainKey,
        organizationId,
        applicationId: appId,
        prisma,
      });
      const rulesets = await getActiveRulesets({
        organizationId,
        applicationId: appId,
        domainKey: inference.domainKey,
        prisma,
      });
      const job = await (prisma as any).aIFlowDraftJob.create({
        data: {
          organizationId,
          applicationId: appId,
          environmentId: appRecord.environments[0]?.id ?? null,
          source: mode === 'ADMIN_TEST' ? 'ADMIN_TEST' : mode === 'FLOW_BUILDER' ? 'FLOW_BUILDER' : 'ONBOARDING_PROMPT',
          productDescription: redactedDescription,
          domainKey: inference.domainKey,
          rulesetVersionIds: rulesets.flatMap((ruleset: any) => ruleset.rulesetVersionId ? [ruleset.rulesetVersionId] : []),
          status: 'QUEUED',
        },
      });
      if (sanitized.redactions.length > 0) {
        console.warn('[FDRS] AI draft job created with redactions', { descriptionHash, redactions: sanitized.redactions });
      }
      return res.status(202).json({ success: true, data: { jobId: job.id, status: 'QUEUED' } });
    } catch (err) {
      console.error('[FDRS] Failed to enqueue AI draft job', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Synchronous fallback (mode=sync)
  const startedAt = Date.now();
  const inference = await inferDomain({
    description: redactedDescription,
    selectedDomainKey,
    organizationId,
    applicationId: appId,
    prisma,
  });
  const rulesets = await getActiveRulesets({
    organizationId,
    applicationId: appId,
    domainKey: inference.domainKey,
    prisma,
  });

  let result;
  let invocationStatus: 'SUCCESS' | 'FAILED' | 'VALIDATION_FAILED' = 'SUCCESS';
  let errorMessage: string | null = null;

  try {
    result = await generateAiFlowDraft({
      productDescription: redactedDescription,
      domainKey: inference.domainKey,
      rulesets,
    });
    if (!result.validation.valid) {
      invocationStatus = 'VALIDATION_FAILED';
    }
  } catch (err) {
    invocationStatus = 'FAILED';
    errorMessage = err instanceof Error ? err.message : 'AI provider failed';
    const draft = await generateRuleBasedFlow({
      domainKey: inference.domainKey,
      productDescription: redactedDescription,
      rulesets,
    });
    const validation = validateGeneratedGraph({ workflows: draft.workflows });
    result = {
      draft: { ...draft, source: 'HYBRID' as const },
      provider: 'rule-engine-fallback',
      model: 'ruleset-fallback-v1',
      promptHash: hashJson({ productDescription: redactedDescription, domainKey: inference.domainKey }),
      validation,
    };
  }

  const invocation = await prisma.aIInvocationLog.create({
    data: {
      organizationId,
      applicationId: appId,
      feature: 'FLOW_GENERATION',
      provider: result.provider,
      model: result.model,
      promptHash: result.promptHash,
      inputSummaryJson: {
        domainKey: inference.domainKey,
        descriptionLength: productDescription.length,
        selectedDomainKey: selectedDomainKey ?? null,
      },
      outputSummaryJson: {
        workflowCount: result.draft.workflows.length,
        suggestionCount: result.draft.suggestions.length,
        confidence: result.draft.confidence,
      },
      status: invocationStatus,
      errorMessage,
      latencyMs: Date.now() - startedAt,
    },
  });

  // Gap 4 privacy: store only the sanitized description, never the raw input
  const draftRecord = await prisma.aIFlowDraft.create({
    data: {
      organizationId,
      applicationId: appId,
      environmentId: appRecord.environments[0]?.id ?? null,
      source: mode === 'ADMIN_TEST' ? 'ADMIN_TEST' : mode === 'FLOW_BUILDER' ? 'FLOW_BUILDER' : 'ONBOARDING_PROMPT',
      status: 'PENDING_REVIEW',
      productDescription: redactedDescription,
      productDescriptionHash: descriptionHash,
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

  if (sanitized.redactions.length > 0 || sanitized.promptInjectionRisk) {
    console.warn('[FDRS] AI draft (sync) created with redactions', {
      descriptionHash,
      redactions: sanitized.redactions,
      riskLevel: sanitized.riskLevel,
      promptInjectionRisk: sanitized.promptInjectionRisk,
    });
  }

  res.status(201).json({
    success: true,
    data: {
      draftId: draftRecord.id,
      status: draftRecord.status,
      confidence: draftRecord.confidence,
      workflows: result.draft.workflows,
      assumptions: result.draft.assumptions,
      warnings: result.validation.warnings,
      validation: result.validation,
    },
  });
});

/** GET /v1/applications/:appId/flows/ai-drafts/:draftId — Fetch a specific AI draft */
app.get('/v1/applications/:appId/flows/ai-drafts/:draftId', async (req: Request, res: Response) => {
  const { appId, draftId } = req.params;
  try {
    const draft = await prisma.aIFlowDraft.findUnique({ where: { id: draftId } });
    if (!draft || draft.applicationId !== appId) return res.status(404).json({ error: 'AI draft not found' });

    const draftJson = draft.draftJson as any;
    res.json({
      success: true,
      data: {
        draftId: draft.id,
        status: draft.status,
        confidence: draft.confidence,
        workflows: draftJson?.workflows ?? [],
        assumptions: draftJson?.assumptions ?? [],
        validation: draft.validationJson ?? null,
      },
    });
  } catch (err) {
    console.error('[FDRS] Fetch AI draft error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/v1/applications/:appId/flows/ai-drafts/:draftId/accept', async (req: Request, res: Response) => {
  const { appId, draftId } = req.params;
  try {
    const draft = await prisma.aIFlowDraft.findUnique({ where: { id: draftId } });
    if (!draft || draft.applicationId !== appId) return res.status(404).json({ error: 'AI draft not found' });
    if (draft.status !== 'PENDING_REVIEW') return res.status(400).json({ error: 'Draft has already been reviewed' });

    const draftJson = draft.draftJson as any;
    const workflowKeys = Array.isArray(req.body.acceptedWorkflowKeys) && req.body.acceptedWorkflowKeys.length > 0
      ? req.body.acceptedWorkflowKeys.map((key: string) => String(key).toUpperCase())
      : draftJson.workflows.map((workflow: any) => String(workflow.key).toUpperCase());
    const workflows = draftJson.workflows.filter((workflow: any) => workflowKeys.includes(String(workflow.key).toUpperCase()));
    if (workflows.length === 0) return res.status(400).json({ error: 'No matching workflows selected' });

    const validation = validateGeneratedGraph({ workflows });
    if (!validation.valid || !validation.normalizedGraph) {
      return res.status(422).json({ error: 'Generated graph failed validation', validation });
    }

    const graph = await createGraphFromWorkflow({
      applicationId: appId,
      environmentId: draft.environmentId,
      workflow: validation.normalizedGraph.workflows[0],
      sourceType: GraphSourceType.SYSTEM_GENERATED,
      declaredById: typeof req.body.acceptedBy === 'string' ? req.body.acceptedBy : null,
    });

    await prisma.aIFlowDraft.update({
      where: { id: draftId },
      data: {
        status: workflows.length === draftJson.workflows.length ? 'ACCEPTED' : 'PARTIALLY_ACCEPTED',
        reviewedBy: typeof req.body.acceptedBy === 'string' ? req.body.acceptedBy : null,
        reviewedAt: new Date(),
        validationJson: validation as any,
      },
    });

    await prisma.ruleFeedback.create({
      data: {
        organizationId: draft.organizationId,
        applicationId: appId,
        aiFlowDraftId: draftId,
        feedbackType: workflows.length === draftJson.workflows.length ? 'ACCEPTED' : 'EDITED',
        afterJson: { behaviorGraphId: graph.id, acceptedWorkflowKeys: workflowKeys } as any,
        createdBy: typeof req.body.acceptedBy === 'string' ? req.body.acceptedBy : null,
      },
    });

    // Write audit log
    const acceptedBy = typeof req.body.acceptedBy === 'string' ? req.body.acceptedBy : null;
    const { ipAddress, userAgent } = extractAuditContext(req);
    await writeAuditLog(prisma, {
      action: workflows.length === draftJson.workflows.length
        ? AuditAction.AI_DRAFT_ACCEPTED
        : AuditAction.AI_DRAFT_PARTIALLY_ACCEPTED,
      userId: acceptedBy,
      organizationId: draft.organizationId,
      applicationId: appId,
      metadata: { draftId, behaviorGraphId: graph.id, acceptedWorkflowCount: workflows.length, totalWorkflowCount: draftJson.workflows.length },
      ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      data: {
        behaviorGraphId: graph.id,
        graphVersionId: graph.id,
        acceptedWorkflows: workflows.length,
      },
    });
  } catch (err) {
    console.error('[FDRS] Accept AI draft error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/v1/applications/:appId/flows/ai-drafts/:draftId/reject', async (req: Request, res: Response) => {
  const { appId, draftId } = req.params;
  try {
    const draft = await prisma.aIFlowDraft.findUnique({ where: { id: draftId } });
    if (!draft || draft.applicationId !== appId) return res.status(404).json({ error: 'AI draft not found' });
    const updated = await prisma.aIFlowDraft.update({
      where: { id: draftId },
      data: {
        status: 'REJECTED',
        rejectionReason: typeof req.body.reason === 'string' ? req.body.reason : null,
        reviewedBy: typeof req.body.rejectedBy === 'string' ? req.body.rejectedBy : null,
        reviewedAt: new Date(),
      },
    });
    await prisma.ruleFeedback.create({
      data: {
        organizationId: draft.organizationId,
        applicationId: appId,
        aiFlowDraftId: draftId,
        feedbackType: 'REJECTED',
        comment: typeof req.body.reason === 'string' ? req.body.reason : null,
        createdBy: typeof req.body.rejectedBy === 'string' ? req.body.rejectedBy : null,
      },
    });

    // Write audit log
    const rejectedBy = typeof req.body.rejectedBy === 'string' ? req.body.rejectedBy : null;
    const { ipAddress: ip, userAgent: ua } = extractAuditContext(req);
    await writeAuditLog(prisma, {
      action: AuditAction.AI_DRAFT_REJECTED,
      userId: rejectedBy,
      organizationId: draft.organizationId,
      applicationId: appId,
      metadata: { draftId, reason: req.body.reason ?? null },
      ipAddress: ip,
      userAgent: ua,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[FDRS] Reject AI draft error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/v1/applications/:appId/declared-flows/:flowId/ai-suggestions', async (req: Request, res: Response) => {
  const { appId, flowId } = req.params;
  const access = await requireAiAccess(appId, 'experimentalAiFlowSuggestions');
  if (!access.allowed) return res.status(access.status ?? 403).json({ error: access.error });

  try {
    const flow = await prisma.behaviorGraph.findUnique({
      where: { id: flowId },
      include: { nodes: true, edges: { include: { fromNode: true, toNode: true } } },
    });
    if (!flow || flow.applicationId !== appId) return res.status(404).json({ error: 'Behavior graph not found' });
    const appRecord = access.appRecord!;
    const organizationId = appRecord.organizationId;
    if (!organizationId) return res.status(400).json({ error: 'Application has no organization' });

    const profile = await prisma.applicationProfile.findUnique({ where: { applicationId: appId } });
    const domainKey = profile?.profileType || flow.workflowType || 'GENERIC_CRUD';
    const rulesets = await getActiveRulesets({ domainKey, organizationId, applicationId: appId, prisma });
    const suggestions = await suggestFlowGaps({
      domainKey,
      currentGraph: {
        states: flow.nodes.map((node) => ({ key: node.behaviorKey || node.stateName, name: node.stateName, category: node.category })),
        transitions: flow.edges.map((edge) => ({
          from: edge.fromNode.behaviorKey || edge.fromNode.stateName,
          to: edge.toNode.behaviorKey || edge.toNode.stateName,
          action: edge.action || undefined,
        })),
      },
      rulesets,
    });

        const parentState = req.body.focusStateKey
      ? flow.nodes.find((node) => node.stateName === String(req.body.focusStateKey).toUpperCase())
      : flow.nodes[0] || null;

    const created = [];
    for (const suggestion of suggestions) {
      const suggestedName = suggestion.suggestedStates[0]?.name || suggestion.title;
      const dbSuggestion = await prisma.declaredStateSuggestion.create({
        data: {
          parentStateId: parentState?.id || null,
          organizationId,
          applicationId: appId,
          flowId,
          suggestionType: suggestion.type,
          title: suggestion.title,
          description: suggestion.rationale,
          suggestedStateName: suggestedName,
          category: suggestion.suggestedStates[0]?.category || 'BUSINESS',
          severity: suggestion.severity as any,
          sourceTier: 'HYBRID',
          rationale: suggestion.rationale,
          suggestedStatesJson: suggestion.suggestedStates as any,
          suggestedTransitionsJson: suggestion.suggestedTransitions as any,
          source: 'HYBRID',
          confidence: suggestion.confidence,
          status: 'PENDING',
          rulesetVersionIds: suggestion.rulesetVersionIds,
          rulePatternIds: suggestion.rulePatternIds,
          patternId: suggestion.rulePatternIds[0] || null,
        },
      });
      created.push(dbSuggestion);
    }

    res.status(201).json({ success: true, data: { suggestions: created } });
  } catch (err) {
    console.error('[FDRS] Generate AI suggestions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// 1. Behavior Graphs (Declared Flows) CRUD
// ─────────────────────────────────────────────────────────────

/** POST /applications/:id/declared-flow - Create a new declared flow (DRAFT) */
app.post('/applications/:id/declared-flow', async (req: Request, res: Response) => {
  const { id: applicationId } = req.params;
  const { name, workflowType } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: '`name` is required and must be a string' });
  }

  try {
    const defaultEnvironment = await prisma.environment.findFirst({
      where: { applicationId, isDefault: true },
      select: { id: true },
    });

    const flow = await prisma.behaviorGraph.create({
      data: {
        applicationId,
        environmentId: defaultEnvironment?.id || null,
        name: name.trim(),
        workflowType: workflowType || 'CUSTOM',
        status: FlowStatus.DRAFT,
        graphType: GraphType.DECLARED,
        sourceType: GraphSourceType.USER_DECLARATION,
        version: 1,
      },
    });

    res.status(201).json(flow);
  } catch (err) {
    console.error('[FDRS] Create behavior graph error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /applications/:id/declared-flow - List all declared flows for an application */
app.get('/applications/:id/declared-flow', async (req: Request, res: Response) => {
  const { id: applicationId } = req.params;

  try {
    const flows = await prisma.behaviorGraph.findMany({
      where: { applicationId, graphType: GraphType.DECLARED },
      orderBy: { createdAt: 'desc' },
    });

    res.json(flows);
  } catch (err) {
    console.error('[FDRS] List behavior graphs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /applications/:id/declared-flow/:flowId - Get details of a behavior graph */
app.get('/applications/:id/declared-flow/:flowId', async (req: Request, res: Response) => {
  const { flowId } = req.params;

  try {
    const flow = await prisma.behaviorGraph.findUnique({
      where: { id: flowId },
      include: {
        nodes: {
          include: {
            suggestions: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        edges: {
          include: {
            fromNode: true,
            toNode: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!flow) {
      return res.status(404).json({ error: 'Behavior graph not found' });
    }

    // Map fields for dashboard backward compatibility
    const responseData = {
      ...flow,
      states: flow.nodes,
      transitions: flow.edges.map((e: any) => ({
        ...e,
        fromStateId: e.fromNodeId,
        toStateId: e.toNodeId,
        fromState: e.fromNode,
        toState: e.toNode
      }))
    };

    res.json(responseData);
  } catch (err) {
    console.error('[FDRS] Get behavior graph error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// 1b. Graph Drift — Version History, Coverage History, Version Diff
// ─────────────────────────────────────────────────────────────

/** GET /applications/:id/declared-flow/:flowId/versions - List all versions of a behavior graph */
app.get('/applications/:id/declared-flow/:flowId/versions', async (req: Request, res: Response) => {
  const { flowId } = req.params;

  try {
    const versions = await prisma.behaviorGraphVersion.findMany({
      where: { graphId: flowId },
      orderBy: { version: 'asc' },
    });

    res.json(versions.map((v) => ({
      id: v.id,
      version: v.version,
      createdAt: v.createdAt.toISOString(),
      expectedStateCount: v.expectedStateCount,
      expectedTransitionCount: v.expectedTransitionCount,
      expectedCoverage: v.expectedCoverage,
    })));
  } catch (err) {
    console.error('[FDRS] List graph versions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /applications/:id/declared-flow/:flowId/coverage-history - Coverage trend over versions */
app.get('/applications/:id/declared-flow/:flowId/coverage-history', async (req: Request, res: Response) => {
  const { flowId } = req.params;

  try {
    const versions = await prisma.behaviorGraphVersion.findMany({
      where: { graphId: flowId },
      orderBy: { version: 'asc' },
    });

    res.json(versions.map((v) => ({
      versionId: v.id,
      versionNumber: v.version,
      snapshotDate: v.createdAt.toISOString(),
      stateCount: v.expectedStateCount ?? 0,
      transitionCount: v.expectedTransitionCount ?? 0,
      coverageScore: v.expectedCoverage,
    })));
  } catch (err) {
    console.error('[FDRS] Coverage history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /applications/:id/declared-flow/:flowId/versions/diff?from=X&to=Y - Deep structural diff */
app.get('/applications/:id/declared-flow/:flowId/versions/diff', async (req: Request, res: Response) => {
  const fromId = req.query.from as string | undefined;
  const toId = req.query.to as string | undefined;

  if (!fromId || !toId) {
    return res.status(400).json({ error: 'Both "from" and "to" query params are required (version IDs).' });
  }

  try {
    const [fromVersion, toVersion] = await Promise.all([
      prisma.behaviorGraphVersion.findUnique({ where: { id: fromId } }),
      prisma.behaviorGraphVersion.findUnique({ where: { id: toId } }),
    ]);

    if (!fromVersion || !toVersion) {
      return res.status(404).json({ error: 'One or both version IDs not found' });
    }

    // Parse snapshot JSON — each snapshot stores { states: [...], transitions: [...] }
    const fromSnap = (fromVersion.snapshot ?? {}) as Record<string, any>;
    const toSnap = (toVersion.snapshot ?? {}) as Record<string, any>;

    const fromStates: any[] = fromSnap.states ?? fromSnap.nodes ?? [];
    const toStates: any[] = toSnap.states ?? toSnap.nodes ?? [];
    const fromTransitions: any[] = fromSnap.transitions ?? fromSnap.edges ?? [];
    const toTransitions: any[] = toSnap.transitions ?? toSnap.edges ?? [];

    // Build state maps by stateName for comparison
    const fromStateMap = new Map(fromStates.map((s) => [s.stateName ?? s.name, s]));
    const toStateMap = new Map(toStates.map((s) => [s.stateName ?? s.name, s]));

    const addedStates: string[] = [];
    const removedStates: string[] = [];
    const modifiedStates: Array<{ stateName: string; changes: Record<string, { from: unknown; to: unknown }> }> = [];

    // Detect added and modified states
    for (const [name, toState] of toStateMap) {
      const fromState = fromStateMap.get(name);
      if (!fromState) {
        addedStates.push(name);
      } else {
        // Deep metadata comparison
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        const metaKeys = ['category', 'provenance', 'behaviorKey', 'canonicalBehavior'];
        for (const key of metaKeys) {
          const fVal = fromState[key] ?? null;
          const tVal = toState[key] ?? null;
          if (fVal !== tVal) {
            changes[key] = { from: fVal, to: tVal };
          }
        }
        if (Object.keys(changes).length > 0) {
          modifiedStates.push({ stateName: name, changes });
        }
      }
    }

    // Detect removed states
    for (const [name] of fromStateMap) {
      if (!toStateMap.has(name)) {
        removedStates.push(name);
      }
    }

    // Build transition key for comparison
    function transitionKey(t: any): string {
      const from = t.fromStateName ?? t.fromState ?? t.from ?? '';
      const to = t.toStateName ?? t.toState ?? t.to ?? '';
      const action = t.action ?? '';
      return `${from}::${to}::${action}`;
    }

    function transitionSummary(t: any): { fromState: string; toState: string; action?: string } {
      return {
        fromState: t.fromStateName ?? t.fromState ?? t.from ?? '',
        toState: t.toStateName ?? t.toState ?? t.to ?? '',
        action: t.action || undefined,
      };
    }

    const fromTransKeys = new Map(fromTransitions.map((t) => [transitionKey(t), t]));
    const toTransKeys = new Map(toTransitions.map((t) => [transitionKey(t), t]));

    const addedTransitions: Array<{ fromState: string; toState: string; action?: string }> = [];
    const removedTransitions: Array<{ fromState: string; toState: string; action?: string }> = [];

    for (const [key, t] of toTransKeys) {
      if (!fromTransKeys.has(key)) {
        addedTransitions.push(transitionSummary(t));
      }
    }

    for (const [key, t] of fromTransKeys) {
      if (!toTransKeys.has(key)) {
        removedTransitions.push(transitionSummary(t));
      }
    }

    res.json({
      addedStates,
      removedStates,
      modifiedStates,
      addedTransitions,
      removedTransitions,
      summary: {
        fromVersion: fromVersion.version,
        toVersion: toVersion.version,
        stateCountDelta: toStates.length - fromStates.length,
        transitionCountDelta: toTransitions.length - fromTransitions.length,
      },
    });
  } catch (err) {
    console.error('[FDRS] Version diff error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. Nodes & Edges Creation (States & Transitions)
// ─────────────────────────────────────────────────────────────

/** POST /applications/:id/declared-flow/:flowId/states - Add state node */
app.post('/applications/:id/declared-flow/:flowId/states', async (req: Request, res: Response) => {
  const { id: applicationId, flowId } = req.params;
  const { stateName, category, provenance, declaredById } = req.body;

  if (!stateName || typeof stateName !== 'string') {
    return res.status(400).json({ error: '`stateName` is required' });
  }
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ error: '`category` is required' });
  }
  if (!provenance || typeof provenance !== 'string') {
    return res.status(400).json({ error: '`provenance` is required' });
  }

  try {
    const canonicalBehavior = await normalizeIntent(stateName, applicationId);

    // Save BehaviorGraphNode
    const node = await prisma.behaviorGraphNode.create({
      data: {
        graphId: flowId,
        stateName: stateName.toUpperCase().trim(),
        behaviorKey: canonicalBehavior,
        category: normalizeStateCategory(category),
        provenance: normalizeProvenance(provenance),
        declaredById: declaredById || null,
        canonicalBehavior,
      },
    });

    // Generate Suggestions from Derivation Engine
    const suggestionsList = await getSuggestions(stateName, applicationId);

    // Write DeclaredStateSuggestion rows
    const suggestions = [];
    for (const sug of suggestionsList) {
      const dbSug = await prisma.declaredStateSuggestion.create({
        data: {
          parentStateId: node.id,
          suggestedStateName: sug.suggestedStateName,
          category: sug.category,
          sourceTier: sug.sourceTier,
          rationale: sug.rationale,
          confidence: sug.confidence,
          patternId: sug.patternId,
          status: 'SUGGESTED',
        },
      });
      suggestions.push(dbSug);
    }

    res.status(201).json({ state: node, suggestions });
  } catch (err) {
    console.error('[FDRS] Add state node error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /applications/:id/declared-flow/:flowId/transitions - Add transition edge */
app.post('/applications/:id/declared-flow/:flowId/transitions', async (req: Request, res: Response) => {
  const { flowId } = req.params;
  const { fromStateId, toStateId, action, provenance } = req.body;

  if (!fromStateId || !toStateId || !provenance) {
    return res.status(400).json({ error: '`fromStateId`, `toStateId`, and `provenance` are required' });
  }

  try {
    const edge = await prisma.behaviorGraphEdge.create({
      data: {
        graphId: flowId,
        fromNodeId: fromStateId,
        toNodeId: toStateId,
        action: action || null,
        provenance: normalizeProvenance(provenance),
      },
      include: {
        fromNode: true,
        toNode: true,
      },
    });

    // Compatibility format for response
    const formattedEdge = {
      ...edge,
      fromStateId: edge.fromNodeId,
      toStateId: edge.toNodeId,
      fromState: edge.fromNode,
      toState: edge.toNode
    };

    res.status(201).json(formattedEdge);
  } catch (err) {
    console.error('[FDRS] Add edge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. Suggestions Acceptance & Rejection
// ─────────────────────────────────────────────────────────────

/** POST /applications/:id/declared-flow/:flowId/suggestions/:sid/accept - Accept suggestion */
app.post('/applications/:id/declared-flow/:flowId/suggestions/:sid/accept', async (req: Request, res: Response) => {
  const { id: applicationId, flowId, sid } = req.params;

  try {
    const suggestion = await prisma.declaredStateSuggestion.findUnique({
      where: { id: sid },
      include: { parentState: true },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    const appRecord = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { organizationId: true },
    });

    // Update Suggestion status
    const updatedSuggestion = await prisma.declaredStateSuggestion.update({
      where: { id: sid },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        acceptedBy: typeof req.body.acceptedBy === 'string' ? req.body.acceptedBy : null,
      },
    });

    await recordSuggestionOutcome({
      suggestionId: sid,
      applicationId,
      outcome: 'ACCEPTED',
      suggestion: {
        ...suggestion,
        parentState: suggestion.parentState ?? undefined,
      },
    });

    const statePayload = Array.isArray(suggestion.suggestedStatesJson)
      ? suggestion.suggestedStatesJson as Array<{ name: string; category?: string }>
      : [{ name: suggestion.suggestedStateName, category: suggestion.category }];
    const existingNodes = await prisma.behaviorGraphNode.findMany({ where: { graphId: flowId } });
    const nodesByKey = new Map(existingNodes.map((node) => [node.stateName.toUpperCase(), node]));
    const createdNodes = [];

    for (const state of statePayload) {
      const stateName = String(state.name || suggestion.suggestedStateName).toUpperCase().trim();
      if (nodesByKey.has(stateName)) continue;
      const canonicalBehavior = await normalizeIntent(stateName, applicationId);
      const newNode = await prisma.behaviorGraphNode.create({
        data: {
          graphId: flowId,
          stateName,
          behaviorKey: canonicalBehavior,
          category: normalizeStateCategory(state.category || suggestion.category),
          provenance: StateProvenance.SUGGESTED_ACCEPTED,
          canonicalBehavior,
        },
      });
      nodesByKey.set(stateName, newNode);
      createdNodes.push(newNode);
    }

    const transitionPayload = Array.isArray(suggestion.suggestedTransitionsJson)
      ? suggestion.suggestedTransitionsJson as Array<{ from: string; to: string; action?: string }>
      : [];
    const createdEdges = [];
    for (const transition of transitionPayload) {
      const fromNode = nodesByKey.get(String(transition.from).toUpperCase().trim());
      const toNode = nodesByKey.get(String(transition.to).toUpperCase().trim());
      if (!fromNode || !toNode) continue;
      const edge = await prisma.behaviorGraphEdge.create({
        data: {
          graphId: flowId,
          fromNodeId: fromNode.id,
          toNodeId: toNode.id,
          action: transition.action || null,
          provenance: StateProvenance.SUGGESTED_ACCEPTED,
        },
      });
      createdEdges.push(edge);
    }

    // Also trigger suggestions for this new node
    const primaryNode = createdNodes[0] ?? nodesByKey.get(suggestion.suggestedStateName.toUpperCase());
    const suggestionsList = primaryNode ? await getSuggestions(primaryNode.stateName, applicationId) : [];
    const newSuggestions = [];
    for (const sug of suggestionsList) {
      const dbSug = await prisma.declaredStateSuggestion.create({
        data: {
          parentStateId: primaryNode?.id,
          organizationId: appRecord?.organizationId ?? null,
          applicationId,
          flowId,
          suggestedStateName: sug.suggestedStateName,
          category: sug.category,
          sourceTier: sug.sourceTier,
          rationale: sug.rationale,
          confidence: sug.confidence,
          patternId: sug.patternId,
          status: 'SUGGESTED',
        },
      });
      newSuggestions.push(dbSug);
    }

    if (appRecord?.organizationId) {
      await prisma.ruleFeedback.create({
        data: {
          organizationId: appRecord.organizationId,
          applicationId,
          suggestionId: sid,
          feedbackType: 'ACCEPTED',
          beforeJson: suggestion as any,
          afterJson: { createdNodeIds: createdNodes.map((node) => node.id), createdEdgeIds: createdEdges.map((edge) => edge.id) } as any,
          createdBy: typeof req.body.acceptedBy === 'string' ? req.body.acceptedBy : null,
        },
      });
    }

    res.json({
      suggestion: updatedSuggestion,
      state: createdNodes[0] ?? null,
      states: createdNodes,
      transitions: createdEdges,
      suggestions: newSuggestions,
    });
  } catch (err) {
    console.error('[FDRS] Accept suggestion error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PATCH /applications/:id/declared-flow/:flowId/suggestions/:sid - Edit suggestion */
app.patch('/applications/:id/declared-flow/:flowId/suggestions/:sid', async (req: Request, res: Response) => {
  const { id: applicationId, sid } = req.params;
  const { suggestedStateName, category, rationale } = req.body;

  try {
    const suggestion = await prisma.declaredStateSuggestion.findUnique({
      where: { id: sid },
      include: { parentState: true },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }
    if (suggestion.status === 'ACCEPTED' || suggestion.status === 'REJECTED') {
      return res.status(400).json({ error: 'Only suggested items can be edited before final decision' });
    }

    const nextName = typeof suggestedStateName === 'string' && suggestedStateName.trim()
      ? suggestedStateName.trim().toUpperCase().replace(/\s+/g, '_')
      : suggestion.suggestedStateName;
    const nextCategory = normalizeStateCategory(category || suggestion.category);
    const nextRationale = typeof rationale === 'string' && rationale.trim()
      ? rationale.trim()
      : suggestion.rationale;

    const updatedSuggestion = await prisma.declaredStateSuggestion.update({
      where: { id: sid },
      data: {
        suggestedStateName: nextName,
        category: nextCategory,
        rationale: nextRationale,
        status: 'EDITED' satisfies SuggestionStatusValue,
      },
    });

    await recordSuggestionOutcome({
      suggestionId: sid,
      applicationId,
      outcome: 'EDITED',
      suggestion: {
        ...suggestion,
        parentState: suggestion.parentState ?? undefined,
        suggestedStateName: nextName,
        category: nextCategory,
        rationale: nextRationale,
      },
    });

    const appRecord = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { organizationId: true },
    });
    if (appRecord?.organizationId) {
      await prisma.ruleFeedback.create({
        data: {
          organizationId: appRecord.organizationId,
          applicationId,
          suggestionId: sid,
          feedbackType: 'EDITED',
          beforeJson: suggestion as any,
          afterJson: updatedSuggestion as any,
        },
      });
    }

    res.json({ suggestion: updatedSuggestion });
  } catch (err) {
    console.error('[FDRS] Edit suggestion error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /applications/:id/declared-flow/:flowId/suggestions/:sid/reject - Reject suggestion */
app.post('/applications/:id/declared-flow/:flowId/suggestions/:sid/reject', async (req: Request, res: Response) => {
  const { id: applicationId, sid } = req.params;
  const { rejectionReason } = req.body;

  try {
    const suggestion = await prisma.declaredStateSuggestion.findUnique({
      where: { id: sid },
      include: { parentState: true },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Update Suggestion status
    const updatedSuggestion = await prisma.declaredStateSuggestion.update({
      where: { id: sid },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: typeof req.body.rejectedBy === 'string' ? req.body.rejectedBy : null,
      },
    });

    await recordSuggestionOutcome({
      suggestionId: sid,
      applicationId,
      outcome: 'REJECTED',
      rejectionReason,
      suggestion: {
        ...suggestion,
        parentState: suggestion.parentState ?? undefined,
      },
    });

    const appRecord = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { organizationId: true },
    });
    if (appRecord?.organizationId) {
      await prisma.ruleFeedback.create({
        data: {
          organizationId: appRecord.organizationId,
          applicationId,
          suggestionId: sid,
          feedbackType: 'REJECTED',
          beforeJson: suggestion as any,
          comment: rejectionReason || null,
          createdBy: typeof req.body.rejectedBy === 'string' ? req.body.rejectedBy : null,
        },
      });
    }

    res.json({ suggestion: updatedSuggestion });
  } catch (err) {
    console.error('[FDRS] Reject suggestion error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /applications/:id/declared-flow/:flowId/suggestions/:sid/dismiss - Dismiss suggestion without negative feedback */
app.post('/applications/:id/declared-flow/:flowId/suggestions/:sid/dismiss', async (req: Request, res: Response) => {
  const { id: applicationId, sid } = req.params;

  try {
    const suggestion = await prisma.declaredStateSuggestion.findUnique({
      where: { id: sid },
      include: { parentState: true },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }
    if (!SUGGESTION_STATUS_PENDING.has(suggestion.status)) {
      return res.status(400).json({ error: 'Only pending suggestions can be dismissed' });
    }

    const updatedSuggestion = await prisma.declaredStateSuggestion.update({
      where: { id: sid },
      data: { status: 'DISMISSED' },
    });

    const appRecord = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { organizationId: true },
    });
    if (appRecord?.organizationId) {
      await prisma.ruleFeedback.create({
        data: {
          organizationId: appRecord.organizationId,
          applicationId,
          suggestionId: sid,
          feedbackType: 'DISMISSED',
          beforeJson: suggestion as any,
          createdBy: typeof req.body.dismissedBy === 'string' ? req.body.dismissedBy : null,
        },
      });
    }

    res.json({ suggestion: updatedSuggestion });
  } catch (err) {
    console.error('[FDRS] Dismiss suggestion error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/v1/applications/:appId/declared-flows/:flowId/suggestions/:suggestionId/:action', async (req: Request, res: Response) => {
  const action = req.params.action;
  const target = `/applications/${req.params.appId}/declared-flow/${req.params.flowId}/suggestions/${req.params.suggestionId}${action === 'edit' ? '' : `/${action}`}`;
  req.url = target;
  if (action === 'edit') req.method = 'PATCH';
  (app as any).handle(req, res);
});

// ─────────────────────────────────────────────────────────────
// 4. Flow Completion & Reopen
// ─────────────────────────────────────────────────────────────

/** POST /applications/:id/declared-flow/:flowId/complete - Mark complete & compile ruleset */
app.post('/applications/:id/declared-flow/:flowId/complete', async (req: Request, res: Response) => {
  const { id: applicationId, flowId } = req.params;

  try {
    const flow = await prisma.behaviorGraph.findUnique({
      where: { id: flowId },
      include: { nodes: true, edges: true },
    });

    if (!flow) {
      return res.status(404).json({ error: 'Behavior graph not found' });
    }
    if (flow.status === FlowStatus.COMPLETE) {
      return res.status(400).json({ error: 'Flow is already marked COMPLETE' });
    }

    // Mark complete
    const updatedFlow = await prisma.behaviorGraph.update({
      where: { id: flowId },
      data: {
        status: FlowStatus.COMPLETE,
        completedAt: new Date(),
      },
    });

    // Save BehaviorGraphVersion snapshot (Gap #4)
    const snapshotJson = {
      states: flow.nodes,
      transitions: flow.edges,
    };

    await prisma.behaviorGraphVersion.upsert({
      where: {
        graphId_version: {
          graphId: flowId,
          version: flow.version,
        },
      },
      update: {
        snapshot: snapshotJson as any,
      },
      create: {
        graphId: flowId,
        version: flow.version,
        snapshot: snapshotJson as any,
        isBaseline: false, // will be populated and set to true on first reconciliation
      },
    });

    // Compile Ruleset
    await compileFlowRuleset(applicationId, flowId, flow.version);

    // Trigger Reconciliation immediately
    try {
      await runReconciliation(applicationId, flow.environmentId || undefined);
    } catch (recErr) {
      console.error('[FDRS] Auto-reconciliation trigger failed, will run on demand', recErr);
    }

    res.json(updatedFlow);
  } catch (err) {
    console.error('[FDRS] Complete behavior graph error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /applications/:id/declared-flow/:flowId/reopen - Reopen a completed flow (bumps version) */
app.post('/applications/:id/declared-flow/:flowId/reopen', async (req: Request, res: Response) => {
  const { flowId } = req.params;

  try {
    const flow = await prisma.behaviorGraph.findUnique({
      where: { id: flowId },
    });

    if (!flow) {
      return res.status(404).json({ error: 'Behavior graph not found' });
    }
    if (flow.status !== FlowStatus.COMPLETE) {
      return res.status(400).json({ error: 'Flow must be COMPLETE to reopen' });
    }

    const updatedFlow = await prisma.behaviorGraph.update({
      where: { id: flowId },
      data: {
        status: FlowStatus.DRAFT,
        version: flow.version + 1,
      },
    });

    res.json(updatedFlow);
  } catch (err) {
    console.error('[FDRS] Reopen behavior graph error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. Promotion Decisions
// ─────────────────────────────────────────────────────────────

/** POST /applications/:id/declared-flow/:flowId/promote - Promote an undeclared state */
app.post('/applications/:id/declared-flow/:flowId/promote', async (req: Request, res: Response) => {
  const { id: applicationId, flowId } = req.params;
  const { stateName, accepted, reason, decidedById } = req.body;

  if (!stateName || typeof stateName !== 'string') {
    return res.status(400).json({ error: '`stateName` is required' });
  }
  if (accepted === undefined) {
    return res.status(400).json({ error: '`accepted` (boolean) is required' });
  }

  try {
    // Write PromotionDecision
    const decision = await prisma.promotionDecision.create({
      data: {
        stateName,
        flowId,
        applicationId,
        accepted,
        reason: reason || null,
        decidedById: decidedById || null,
      },
    });

    let newState = null;
    if (accepted) {
      const canonicalBehavior = await normalizeIntent(stateName, applicationId);

      // Create BehaviorGraphNode in graph
      newState = await prisma.behaviorGraphNode.create({
        data: {
          graphId: flowId,
          stateName: stateName.toUpperCase().trim(),
          behaviorKey: canonicalBehavior,
          category: StateCategory.BUSINESS,
          provenance: StateProvenance.DEMONSTRATION_PROMOTED,
          canonicalBehavior,
        },
      });

      // Trigger suggestions for this promoted node
      const suggestionsList = await getSuggestions(stateName, applicationId);
      for (const sug of suggestionsList) {
        await prisma.declaredStateSuggestion.create({
          data: {
            parentStateId: newState.id,
            suggestedStateName: sug.suggestedStateName,
            category: sug.category,
            sourceTier: sug.sourceTier,
            rationale: sug.rationale,
            confidence: sug.confidence,
            patternId: sug.patternId,
            status: 'SUGGESTED',
          },
        });
      }

      // Recompile ruleset immediately (keep in sync if completed)
      const flow = await prisma.behaviorGraph.findUnique({ where: { id: flowId } });
      if (flow && flow.status === FlowStatus.COMPLETE) {
        await compileFlowRuleset(applicationId, flowId, flow.version);
        // Rerun reconciliation
        await runReconciliation(applicationId, flow.environmentId || undefined);
      }
    }

    res.json({ decision, state: newState });
  } catch (err) {
    console.error('[FDRS] Promote state error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// 6. Reconciliation API
// ─────────────────────────────────────────────────────────────

/** GET /applications/:id/reconciliation - Get latest reports */
app.get('/applications/:id/reconciliation', async (req: Request, res: Response) => {
  const { id: applicationId } = req.params;
  const environmentId = req.query.environmentId as string | undefined;

  try {
    let reports = await prisma.reconciliationReport.findMany({
      where: { 
        applicationId,
        environmentId: environmentId || undefined
      },
      include: {
        flow: true,
      },
    });

    if (reports.length === 0) {
      // Run and generate reports
      await runReconciliation(applicationId, environmentId);
      reports = await prisma.reconciliationReport.findMany({
        where: { 
          applicationId,
          environmentId: environmentId || undefined
        },
        include: {
          flow: true,
        },
      });
    }

    res.json(reports);
  } catch (err) {
    console.error('[FDRS] Get reconciliation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /applications/:id/reconciliation/export - Export reconciliation reports */
app.get('/applications/:id/reconciliation/export', async (req: Request, res: Response) => {
  const { id: applicationId } = req.params;
  const environmentId = req.query.environmentId as string | undefined;
  const format = ((req.query.format as string | undefined) || 'json').toLowerCase();

  try {
    const reports = await prisma.reconciliationReport.findMany({
      where: {
        applicationId,
        environmentId: environmentId || undefined,
      },
      include: { flow: true },
      orderBy: { generatedAt: 'desc' },
    });

    const payload = {
      applicationId,
      environmentId: environmentId || null,
      generatedAt: new Date().toISOString(),
      reports: reports.map((report) => ({
        flowId: report.flowId,
        flowName: report.flow.name,
        flowVersion: report.flow.version,
        confirmedCount: report.confirmedCount,
        trueGapCount: report.trueGapCount,
        undeclaredCount: report.undeclaredCount,
        expectedCoverageScore: report.expectedCoverageScore,
        confirmedTransitions: report.confirmedTransitions,
        trueGapTransitions: report.trueGapTransitions,
        undeclaredTransitions: report.undeclaredTransitions,
        transitionCoverageScore: report.transitionCoverageScore,
        trueGaps: report.trueGaps,
        undeclared: report.undeclared,
        trueGapTransitionsList: report.trueGapTransitionsList,
        undeclaredTransitionsList: report.undeclaredTransitionsList,
        generatedAt: report.generatedAt,
      })),
    };

    const date = new Date().toISOString().slice(0, 10);
    const filename = `sots-reconciliation-${applicationId}-${date}`;

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.setHeader('Content-Type', 'application/json');
      return res.send(JSON.stringify(payload, null, 2));
    }

    if (format === 'csv') {
      const rows = ['Flow,Version,Expected Coverage,Transition Coverage,Confirmed States,True Gap States,Undeclared States,Confirmed Transitions,True Gap Transitions,Undeclared Transitions,Generated At'];
      for (const report of payload.reports) {
        rows.push([
          report.flowName,
          report.flowVersion,
          `${(report.expectedCoverageScore * 100).toFixed(1)}%`,
          `${(report.transitionCoverageScore * 100).toFixed(1)}%`,
          report.confirmedCount,
          report.trueGapCount,
          report.undeclaredCount,
          report.confirmedTransitions,
          report.trueGapTransitions,
          report.undeclaredTransitions,
          new Date(report.generatedAt).toISOString(),
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));
      }
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.setHeader('Content-Type', 'text/csv');
      return res.send(rows.join('\n'));
    }

    res.status(400).json({ error: 'Unsupported reconciliation export format. Use json or csv.' });
  } catch (err) {
    console.error('[FDRS] Export reconciliation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /applications/:id/reconciliation/run - Manually trigger reconciliation */
app.post('/applications/:id/reconciliation/run', async (req: Request, res: Response) => {
  const { id: applicationId } = req.params;
  const environmentId = (req.body.environmentId || req.query.environmentId) as string | undefined;
  const expectedGraphId = (req.body.expectedGraphId || req.query.expectedGraphId) as string | undefined;

  try {
    const reports = await runReconciliation(applicationId, environmentId, expectedGraphId);
    res.json(reports);
  } catch (err) {
    console.error('[FDRS] Run reconciliation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// 7. Compiled Ruleset API (GET /ruleset)
// ─────────────────────────────────────────────────────────────

/** GET /applications/:id/ruleset - Return the merged runtime ruleset */
app.get('/applications/:id/ruleset', async (req: Request, res: Response) => {
  const { id: applicationId } = req.params;

  try {
    const completedFlows = await prisma.behaviorGraph.findMany({
      where: { applicationId, status: FlowStatus.COMPLETE, graphType: GraphType.DECLARED },
    });

    let allRules: any[] = [];

    if (completedFlows.length > 0) {
      // Find rules matching the current active version of all completed flows
      const rulesets = await prisma.compiledRuleset.findMany({
        where: {
          applicationId,
          OR: completedFlows.map((f: any) => ({
            flowId: f.id,
            version: f.version,
          })),
        },
      });

      for (const rs of rulesets) {
        if (Array.isArray(rs.rules)) {
          allRules = allRules.concat(rs.rules);
        }
      }
    }

    const profile = await prisma.applicationProfile.findUnique({
      where: { applicationId },
    });

    const reconstructed = reconstructRuleSet(allRules, profile?.profileType || 'ECOMMERCE');
    res.json(reconstructed);
  } catch (err) {
    console.error('[FDRS] Get ruleset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ─────────────────────────────────────────────────────────────
// Phase 8: AI-Assisted Flow Suggestions (unified pipeline)
//
// POST /v1/applications/:appId/declared-flow/:flowId/ai-suggestions
//
// Pipeline:
//   1. Load the declared graph from DB
//   2. Run rule-based suggestFlowGaps
//   3. Optionally call AI (gated by AI_FLOW_SUGGESTIONS_ENABLED)
//   4. Merge + deduplicate by type+title+targetNode
//   5. Return unified list with source labels
// ─────────────────────────────────────────────────────────────

app.post(
  '/v1/applications/:appId/declared-flow/:flowId/ai-suggestions',
  verifyJwt,
  verifyAppOwnership,
  async (req: AuthenticatedRequest, res: Response) => {
    const { appId: applicationId, flowId } = req.params;
    const { userDefinedGoals } = req.body;

    try {
      // 1. Load the declared graph
      const graph = await prisma.behaviorGraph.findUnique({
        where: { id: flowId },
        include: {
          nodes: true,
          edges: {
            include: { fromNode: true, toNode: true },
          },
        },
      });

      if (!graph) {
        return res.status(404).json({ error: 'Declared flow not found' });
      }

      // Verify the graph belongs to this application
      if (graph.applicationId !== applicationId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Flow does not belong to this application' });
      }

      // 2. Load domain + active rulesets
      const appRecord = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { organizationId: true },
      });
      const organizationId = appRecord?.organizationId ?? undefined;

      const profile = await prisma.applicationProfile.findUnique({
        where: { applicationId },
      });
      const domainKey = profile?.profileType ?? 'GENERIC';

      const rulesets = await getActiveRulesets({
        organizationId,
        applicationId,
        domainKey,
        prisma,
      });

      // 3. Run rule-based gap analysis
      const declaredStates = graph.nodes.map((n) => ({
        key: n.behaviorKey ?? n.stateName,
        name: n.stateName,
        category: n.category ?? 'BUSINESS',
      }));
      const declaredTransitions = graph.edges.map((e) => ({
        from: e.fromNode.stateName,
        to: e.toNode.stateName,
        action: e.action ?? undefined,
      }));

      const ruleSuggestions = await suggestFlowGaps({
        domainKey,
        currentGraph: {
          states: declaredStates,
          transitions: declaredTransitions,
        },
        rulesets,
      });

      // Bridge rule FlowSuggestion[] → RuleBasedSuggestionItem[]
      const ruleBasedItems = ruleSuggestions.map((s) => ({
        type: s.type,
        title: s.title,
        description: s.rationale,
        rationale: s.rationale,
        confidence: s.confidence,
        severity: s.severity,
        targetNodeId: s.suggestedStates?.[0]?.name,
        evidence: s.rulePatternIds ?? [],
      }));

      // 4. Build declared flows summary (sanitized — no raw payload data)
      const declaredFlows = [{
        flowId,
        name: graph.name ?? 'Declared Flow',
        states: declaredStates.slice(0, 50),
        transitions: declaredTransitions.slice(0, 50),
      }];

      // 5. Run AI suggestions pipeline
      const aiEnabled =
        process.env.AI_FLOW_SUGGESTIONS_ENABLED === 'true' ||
        process.env.AI_FEATURES_ENABLED === 'true';

      const result = await generateFlowSuggestions(
        {
          applicationId,
          organizationId: organizationId ?? '',
          applicationDomain: domainKey,
          declaredFlows,
          existingRuleSuggestions: ruleBasedItems,
          userDefinedGoals: Array.isArray(userDefinedGoals) ? userDefinedGoals : undefined,
        },
        { enableAi: aiEnabled },
      );

      // 6. Log AI invocation if AI was called
      if (result.aiCalled && organizationId) {
        try {
          await prisma.aIInvocationLog.create({
            data: {
              organizationId,
              applicationId,
              feature: 'FLOW_SUGGESTIONS',
              provider: result.provider ?? 'unknown',
              model: result.model ?? 'unknown',
              promptHash: result.promptHash ?? '',
              status: result.fallbackUsed ? 'FALLBACK_USED' : 'SUCCESS',
              fallbackUsed: result.fallbackUsed,
              repaired: result.aiRepaired,
              latencyMs: result.latencyMs,
            } as any,
          });
        } catch (logErr) {
          console.error('[FDRS] Failed to log AI suggestions invocation', logErr);
        }
      }

      res.json({
        success: true,
        data: {
          suggestions: result.suggestions,
          meta: {
            total: result.suggestions.length,
            aiEnabled: result.aiCalled,
            aiRepaired: result.aiRepaired,
            fallbackUsed: result.fallbackUsed,
            latencyMs: result.latencyMs,
            ruleSuggestionCount: ruleBasedItems.length,
            aiSuggestionCount: result.suggestions.filter((s) => s.sources.includes('AI_ASSISTED')).length,
          },
        },
      });
    } catch (err) {
      console.error('[FDRS] AI suggestions error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ─────────────────────────────────────────────────────────────
// Admin: AI Usage Aggregates
// All endpoints require system admin (DB-backed)
// ─────────────────────────────────────────────────────────────

app.get('/v1/admin/ai-usage', verifyJwt, requireSystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId, days = '30' } = req.query as Record<string, string>;
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    const where: any = { date: { gte: since } };
    if (organizationId) where.organizationId = organizationId;

    const aggregates = await (prisma as any).aIUsageDailyAggregate.findMany({ where });

    const summary = aggregates.reduce(
      (acc: any, row: any) => ({
        totalCalls: acc.totalCalls + row.totalCalls,
        successCalls: acc.successCalls + row.successCalls,
        failedCalls: acc.failedCalls + row.failedCalls,
        repairedCalls: acc.repairedCalls + row.repairedCalls,
        fallbackCalls: acc.fallbackCalls + row.fallbackCalls,
        totalTokens: acc.totalTokens + row.totalTokens,
        totalCostUsd: acc.totalCostUsd + Number(row.totalCostUsd),
      }),
      { totalCalls: 0, successCalls: 0, failedCalls: 0, repairedCalls: 0, fallbackCalls: 0, totalTokens: 0, totalCostUsd: 0 },
    );

    const successRate = summary.totalCalls > 0
      ? Math.round((summary.successCalls / summary.totalCalls) * 10000) / 100
      : 0;

    res.json({ success: true, data: { summary: { ...summary, successRate }, periodDays: Number(days) } });
  } catch (err) {
    console.error('[FDRS] Admin AI usage error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/v1/admin/ai-usage/daily', verifyJwt, requireSystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { organizationId, days = '30', feature, provider } = req.query as Record<string, string>;
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    const where: any = { date: { gte: since } };
    if (organizationId) where.organizationId = organizationId;
    if (feature) where.feature = feature;
    if (provider) where.provider = provider;

    const rows = await (prisma as any).aIUsageDailyAggregate.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[FDRS] Admin AI usage daily error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/v1/admin/ai-usage/providers', verifyJwt, requireSystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { days = '30' } = req.query as Record<string, string>;
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    const rows = await (prisma as any).aIUsageDailyAggregate.groupBy({
      by: ['provider', 'model'],
      where: { date: { gte: since } },
      _sum: { totalCalls: true, successCalls: true, failedCalls: true, totalCostUsd: true, totalTokens: true },
      _avg: { avgLatencyMs: true },
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[FDRS] Admin AI usage providers error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Admin: Rule Candidates
// ─────────────────────────────────────────────────────────────

app.get('/v1/admin/rule-candidates', verifyJwt, requireSystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, source, domainKey, limit = '50', cursor } = req.query as Record<string, string>;

    const where: any = {};
    if (status) where.status = status;
    if (source) where.source = source;
    if (domainKey) where.domainKey = domainKey;

    const candidates = await prisma.ruleCandidate.findMany({
      where,
      take: Math.min(Number(limit), 100),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: candidates, nextCursor: candidates[candidates.length - 1]?.id ?? null });
  } catch (err) {
    console.error('[FDRS] Admin rule candidates error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/v1/admin/rule-candidates/:candidateId/approve', verifyJwt, requireSystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidateId } = req.params;
    const userId = req.user!.id;

    const candidate = await prisma.ruleCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) return res.status(404).json({ error: 'Rule candidate not found' });
    if (candidate.status !== 'PENDING_REVIEW') {
      return res.status(409).json({ error: 'Candidate already processed', status: candidate.status });
    }

    const updated = await prisma.ruleCandidate.update({
      where: { id: candidateId },
      data: { status: 'APPROVED', reviewedBy: userId, reviewedAt: new Date() },
    });

    const { ipAddress, userAgent } = extractAuditContext(req);
    await writeAuditLog(prisma, {
      action: AuditAction.RULE_CANDIDATE_APPROVED,
      userId,
      metadata: { candidateId, domainId: candidate.domainId },
      ipAddress,
      userAgent,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[FDRS] Admin approve rule candidate error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/v1/admin/rule-candidates/:candidateId/reject', verifyJwt, requireSystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidateId } = req.params;
    const userId = req.user!.id;
    const reason = typeof req.body.reason === 'string' ? req.body.reason : null;

    const candidate = await prisma.ruleCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) return res.status(404).json({ error: 'Rule candidate not found' });
    if (candidate.status !== 'PENDING_REVIEW') {
      return res.status(409).json({ error: 'Candidate already processed', status: candidate.status });
    }

    const updated = await prisma.ruleCandidate.update({
      where: { id: candidateId },
      data: { status: 'REJECTED', reviewedBy: userId, reviewedAt: new Date() },
    });

    const { ipAddress, userAgent } = extractAuditContext(req);
    await writeAuditLog(prisma, {
      action: AuditAction.RULE_CANDIDATE_REJECTED,
      userId,
      metadata: { candidateId, domainId: candidate.domainId, reason },
      ipAddress,
      userAgent,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[FDRS] Admin reject rule candidate error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ─────────────────────────────────────────────────────────────
// Gap 3: Reconciliation Export — CSV / JSON download
// GET /applications/:id/reconciliation/export
// ─────────────────────────────────────────────────────────────

app.get('/applications/:id/reconciliation/export', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  const appId = req.params.id;
  const format = (req.query as any).format === 'csv' ? 'csv' : 'json';
  const flowId = typeof (req.query as any).flowId === 'string' ? (req.query as any).flowId : undefined;

  try {
    const where: any = { applicationId: appId };
    if (flowId) where.flowId = flowId;

    const reports = await prisma.reconciliationReport.findMany({
      where,
      include: { flow: { select: { id: true, name: true, workflowType: true, version: true } } },
      orderBy: { generatedAt: 'desc' },
    });

    const date = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const header = 'flowId,flowName,confirmedStates,trueGaps,undeclaredStates,expectedCoverage%,confirmedTransitions,trueGapTransitions,undeclaredTransitions,transitionCoverage%,generatedAt\n';
      const rows = reports.map((r) =>
        [
          r.flowId,
          `"${r.flow.name.replace(/"/g, '""')}"`,
          r.confirmedCount,
          r.trueGapCount,
          r.undeclaredCount,
          (r.expectedCoverageScore * 100).toFixed(2),
          r.confirmedTransitions,
          r.trueGapTransitions,
          r.undeclaredTransitions,
          (r.transitionCoverageScore * 100).toFixed(2),
          r.generatedAt.toISOString(),
        ].join(',')
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="reconciliation-${appId}-${date}.csv"`);
      return res.send(header + rows.join('\n'));
    }

    // JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-${appId}-${date}.json"`);
    return res.json({ applicationId: appId, exportedAt: new Date().toISOString(), reports });
  } catch (err) {
    console.error('[FDRS] Reconciliation export error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Gap 6: BehaviorGraph Version List + Diff
// GET  /applications/:id/declared-flow/:flowId/versions
// GET  /applications/:id/declared-flow/:flowId/versions/diff
// POST /applications/:id/declared-flow/:flowId/snapshot
// ─────────────────────────────────────────────────────────────

app.get('/applications/:id/declared-flow/:flowId/versions', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  const { id: appId, flowId } = req.params;
  try {
    const graph = await prisma.behaviorGraph.findUnique({ where: { id: flowId } });
    if (!graph || graph.applicationId !== appId) return res.status(404).json({ error: 'Flow not found' });

    const versions = await prisma.behaviorGraphVersion.findMany({
      where: { graphId: flowId },
      orderBy: { version: 'desc' },
      select: {
        id: true, version: true, isBaseline: true,
        expectedStateCount: true, expectedTransitionCount: true,
        expectedCoverage: true, expectedTransitionCoverage: true,
        createdAt: true,
      },
    });
    res.json({ success: true, data: versions });
  } catch (err) {
    console.error('[FDRS] List graph versions error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/applications/:id/declared-flow/:flowId/versions/diff', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  const { id: appId, flowId } = req.params;
  const fromVersion = parseInt(String((req.query as any).from), 10);
  const toVersion = parseInt(String((req.query as any).to), 10);

  if (!fromVersion || !toVersion || fromVersion === toVersion) {
    return res.status(400).json({ error: 'from and to must be distinct version numbers' });
  }

  try {
    const graph = await prisma.behaviorGraph.findUnique({ where: { id: flowId } });
    if (!graph || graph.applicationId !== appId) return res.status(404).json({ error: 'Flow not found' });

    const [vFrom, vTo] = await Promise.all([
      prisma.behaviorGraphVersion.findUnique({ where: { graphId_version: { graphId: flowId, version: fromVersion } } }),
      prisma.behaviorGraphVersion.findUnique({ where: { graphId_version: { graphId: flowId, version: toVersion } } }),
    ]);

    if (!vFrom) return res.status(404).json({ error: `Version ${fromVersion} not found` });
    if (!vTo) return res.status(404).json({ error: `Version ${toVersion} not found` });

    const snapFrom = vFrom.snapshot as any;
    const snapTo = vTo.snapshot as any;
    const statesFrom: any[] = snapFrom.states ?? [];
    const statesTo: any[] = snapTo.states ?? [];
    const edgesFrom: any[] = snapFrom.transitions ?? [];
    const edgesTo: any[] = snapTo.transitions ?? [];

    const stateKeyFrom = new Set(statesFrom.map((s: any) => s.stateName ?? s.name));
    const stateKeyTo = new Set(statesTo.map((s: any) => s.stateName ?? s.name));
    const addedNodes = statesTo.filter((s: any) => !stateKeyFrom.has(s.stateName ?? s.name));
    const removedNodes = statesFrom.filter((s: any) => !stateKeyTo.has(s.stateName ?? s.name));

    function edgeKey(e: any) {
      return `${e.fromNode?.stateName ?? e.fromStateName}-->${e.toNode?.stateName ?? e.toStateName}:${e.action ?? ''}`;
    }
    const edgeKeyFrom = new Set(edgesFrom.map(edgeKey));
    const edgeKeyTo = new Set(edgesTo.map(edgeKey));
    const addedEdges = edgesTo.filter((e: any) => !edgeKeyFrom.has(edgeKey(e)));
    const removedEdges = edgesFrom.filter((e: any) => !edgeKeyTo.has(edgeKey(e)));

    res.json({
      success: true,
      data: {
        flowId,
        from: fromVersion,
        to: toVersion,
        addedNodes,
        removedNodes,
        addedEdges,
        removedEdges,
        summary: {
          nodesAdded: addedNodes.length,
          nodesRemoved: removedNodes.length,
          edgesAdded: addedEdges.length,
          edgesRemoved: removedEdges.length,
        },
      },
    });
  } catch (err) {
    console.error('[FDRS] Graph version diff error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/applications/:id/declared-flow/:flowId/snapshot', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  const { id: appId, flowId } = req.params;
  try {
    const graph = await prisma.behaviorGraph.findUnique({
      where: { id: flowId },
      include: { nodes: true, edges: { include: { fromNode: true, toNode: true } } },
    });
    if (!graph || graph.applicationId !== appId) return res.status(404).json({ error: 'Flow not found' });

    const snapshotJson = { states: graph.nodes, transitions: graph.edges };
    const existing = await prisma.behaviorGraphVersion.findUnique({
      where: { graphId_version: { graphId: flowId, version: graph.version } },
    });

    const snapshot = existing
      ? await prisma.behaviorGraphVersion.update({
          where: { graphId_version: { graphId: flowId, version: graph.version } },
          data: { snapshot: snapshotJson as any, expectedStateCount: graph.nodes.length, expectedTransitionCount: graph.edges.length },
        })
      : await prisma.behaviorGraphVersion.create({
          data: {
            graphId: flowId, version: graph.version, snapshot: snapshotJson as any,
            isBaseline: false, expectedStateCount: graph.nodes.length, expectedTransitionCount: graph.edges.length,
          },
        });

    res.status(201).json({ success: true, data: snapshot });
  } catch (err) {
    console.error('[FDRS] Graph snapshot error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Gap 8: AI Flow Draft Async Job Queue
// POST /v1/applications/:appId/flows/ai-drafts       → 202 + jobId
// GET  /v1/applications/:appId/flows/ai-drafts/jobs/:jobId → poll status
// ─────────────────────────────────────────────────────────────

// NOTE: The existing synchronous POST /v1/applications/:appId/flows/ai-drafts is
// replaced below with the async version. The original handler is preserved for
// backwards compatibility via ?mode=sync query parameter.

app.get('/v1/applications/:appId/flows/ai-drafts/jobs/:jobId', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  const { appId, jobId } = req.params;
  try {
    const job = await (prisma as any).aIFlowDraftJob.findUnique({ where: { id: jobId } });
    if (!job || job.applicationId !== appId) return res.status(404).json({ error: 'Job not found' });

    res.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        draftId: job.draftId ?? null,
        errorMessage: job.errorMessage ?? null,
        attempts: job.attempts,
        createdAt: job.createdAt,
        startedAt: job.startedAt ?? null,
        completedAt: job.completedAt ?? null,
      },
    });
  } catch (err) {
    console.error('[FDRS] Poll AI draft job error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Admin: Audit Logs
// ─────────────────────────────────────────────────────────────


app.get('/v1/admin/audit-logs', verifyJwt, requireSystemAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      action,
      userId: filterUserId,
      organizationId: filterOrgId,
      before,
      after,
      limit = '50',
      cursor,
    } = req.query as Record<string, string>;

    const where: any = {};
    if (action) where.action = action;
    if (filterUserId) where.userId = filterUserId;
    if (filterOrgId) where.organizationId = filterOrgId;
    if (before || after) {
      where.createdAt = {};
      if (before) where.createdAt.lt = new Date(before);
      if (after) where.createdAt.gte = new Date(after);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      take: Math.min(Number(limit), 200),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, displayName: true } } },
    });

    res.json({
      success: true,
      data: logs,
      nextCursor: logs[logs.length - 1]?.id ?? null,
    });
  } catch (err) {
    console.error('[FDRS] Admin audit logs error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────
const PORT = Services.FDRS_API;

app.listen(PORT, () => {
  console.log(`[FDRSAPI] Running on port ${PORT}`);
});
