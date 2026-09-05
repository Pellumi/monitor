import {
  EmailCategory,
  PrismaClient,
  QAReportJobStatus,
  QAReportStatus,
} from '@tellann/db';
import { resolveAiProvider } from '@tellann/ai';
import { EntitlementChecker } from '@tellann/entitlement-checker';
import { NotificationEmailService, NotificationOrchestrator, appUrl } from '@tellann/email';
import { Feature } from '@tellann/shared';
import { z } from 'zod';

const AiImprovementSchema = z.object({
  suggestions: z.array(z.object({
    priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
    impact: z.string().max(1_000),
    confidence: z.number().min(0).max(1),
    rationale: z.string().max(2_000),
    suggestedAction: z.string().max(2_000),
    expectedOutcome: z.string().max(1_000),
    affectedState: z.string().nullable(),
    affectedTransition: z.string().nullable(),
    evidenceIds: z.array(z.string()).max(20),
  })).max(20),
});

const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
export const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export type ScopedImprovement = { scope?: string | null; priority?: string };

/**
 * Section 3 of the report is in-Flow only. A finding with no recorded scope
 * must not pass as in-Flow by default, so callers resolve an absent scope from
 * the run's boundary before filtering.
 */
export function resolveFindingScope(
  scope: string | null | undefined,
  boundaryStarted: boolean,
): 'IN_FLOW' | 'PRE_BOUNDARY' {
  if (scope === 'IN_FLOW' || scope === 'PRE_BOUNDARY') return scope;
  return boundaryStarted ? 'IN_FLOW' : 'PRE_BOUNDARY';
}

export function isInFlow(item: ScopedImprovement): boolean {
  return item.scope !== 'PRE_BOUNDARY';
}

/**
 * Strips references the model invented. Evidence ids, state keys and
 * transitions must resolve to something this run actually produced; a
 * suggestion left with no verifiable anchor at all is dropped rather than
 * published as if it were evidence-backed.
 */
export function anchorAiSuggestion<T extends {
  evidenceIds: string[];
  affectedState: string | null;
  affectedTransition: string | null;
}>(
  suggestion: T,
  known: {
    evidenceIds: Set<string>;
    findingIds: Set<string>;
    stateKeys: Set<string>;
    transitionKeys: Set<string>;
  },
): T | null {
  const evidenceIds = suggestion.evidenceIds.filter(
    (id) => known.evidenceIds.has(id) || known.findingIds.has(id),
  );
  const affectedState = suggestion.affectedState && known.stateKeys.has(normalize(suggestion.affectedState))
    ? normalize(suggestion.affectedState)
    : null;
  const transitionKey = normalize(suggestion.affectedTransition).replace('_', '>');
  const affectedTransition = suggestion.affectedTransition && known.transitionKeys.has(transitionKey)
    ? suggestion.affectedTransition
    : null;
  if (!evidenceIds.length && affectedState === null && affectedTransition === null) return null;
  return { ...suggestion, evidenceIds, affectedState, affectedTransition };
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/https?:\/\/\S+/g, '[URL]').replace(/[A-Za-z0-9_-]{24,}/g, '[REDACTED]').slice(0, 500);
}

function routeFromUrl(value: string | null): string | null {
  if (!value) return null;
  try { return new URL(value).pathname || '/'; } catch { return null; }
}

async function claimJob(prisma: PrismaClient) {
  const candidate = await prisma.qAReportGenerationJob.findFirst({
    where: { status: QAReportJobStatus.QUEUED, scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: 'asc' },
  });
  if (!candidate) return null;
  const claimed = await prisma.qAReportGenerationJob.updateMany({
    where: { id: candidate.id, status: QAReportJobStatus.QUEUED },
    data: { status: QAReportJobStatus.PROCESSING, attempts: { increment: 1 }, startedAt: new Date(), failureReasonSafe: null },
  });
  return claimed.count === 1
    ? prisma.qAReportGenerationJob.findUnique({ where: { id: candidate.id } })
    : null;
}

async function notifyReportReady(prisma: PrismaClient, reportId: string) {
  const report = await prisma.qAReport.findUnique({
    where: { id: reportId },
    include: {
      run: {
        include: {
          application: { select: { name: true } },
          flow: { select: { name: true } },
          annotations: { select: { authorId: true, mentions: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!report) return;
  const email = new NotificationEmailService(prisma);
  const notifications = new NotificationOrchestrator({ prisma, emailService: email });
  const run = report.run;
  const deepLink = `/applications/${run.applicationId}/qa-runs/${run.id}`;
  await notifications.createNotification({
    organizationId: run.organizationId,
    applicationId: run.applicationId,
    runId: run.id,
    reportId: report.id,
    type: 'QA_REPORT_READY',
    category: EmailCategory.REPORTS,
    severity: run.status === 'COMPLETED' ? 'INFO' : 'MEDIUM',
    title: 'Your QA report is ready',
    body: `${run.application.name}: review the evidence-backed recommendations from this QA run.`,
    deepLink,
    sourceEventType: 'QA_REPORT_READY',
    sourceEventId: report.id,
    recipients: [{ userId: run.createdByUserId }],
    email: {
      templateKey: 'qa-report-ready',
      variables: {
        applicationName: run.application.name,
        flowName: run.flow?.name ?? 'Selected Flow',
        reportUrl: appUrl(deepLink),
      },
    },
  });

  const mentionedIds = [...new Set(run.annotations.flatMap((annotation) => annotation.mentions.map((mention) => mention.userId)))];
  if (!mentionedIds.length) return;
  const activeMembers = await prisma.organizationMembership.findMany({
    where: { organizationId: run.organizationId, userId: { in: mentionedIds }, user: { deletedAt: null } },
    select: { userId: true },
  });
  for (const { userId } of activeMembers) {
    const annotationCount = run.annotations.filter((annotation) => annotation.mentions.some((mention) => mention.userId === userId)).length;
    await notifications.createNotification({
      organizationId: run.organizationId,
      applicationId: run.applicationId,
      runId: run.id,
      reportId: report.id,
      type: 'QA_REPORT_MENTIONED',
      category: EmailCategory.REPORTS,
      severity: 'INFO',
      title: 'You were mentioned in a QA report',
      body: `${run.application.name}: you were tagged in ${annotationCount} QA annotation${annotationCount === 1 ? '' : 's'}.`,
      deepLink: `${deepLink}#annotations`,
      sourceEventType: 'QA_REPORT_MENTIONED',
      sourceEventId: `${report.id}:${userId}`,
      recipients: [{ userId }],
      email: {
        templateKey: 'qa-report-mentioned',
        variables: {
          applicationName: run.application.name,
          flowName: run.flow?.name ?? 'Selected Flow',
          annotationCount,
          reportUrl: appUrl(`${deepLink}#annotations`),
        },
      },
    });
  }
}

async function generateReport(prisma: PrismaClient, reportId: string) {
  // The generation job owns the attempt counter (incremented on claim); the
  // report mirrors it rather than counting a second time.
  await prisma.qAReport.update({ where: { id: reportId }, data: { status: QAReportStatus.RECONCILING, startedAt: new Date() } });
  const report = await prisma.qAReport.findUnique({
    where: { id: reportId },
    include: {
      run: {
        include: {
          application: { select: { id: true, name: true } },
          environment: { select: { id: true, name: true, type: true } },
          expectedGraphVersion: { include: { graph: true } },
          repositorySnapshot: true,
          patchSet: { include: { instrumentationPlan: true } },
          progressEvents: { orderBy: { occurredAt: 'asc' } },
          observedSessions: { orderBy: { startTime: 'asc' } },
          findings: { include: { evidenceEvents: true }, orderBy: { createdAt: 'asc' } },
          artifacts: { orderBy: { capturedAt: 'asc' } },
          annotations: {
            include: {
              author: { select: { id: true, displayName: true } },
              mentions: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          evidenceEvents: {
            include: { protectedValues: { select: { id: true, keyPath: true, kind: true, displayValue: true, valueLength: true } } },
            orderBy: [{ sessionId: 'asc' }, { localSequence: 'asc' }],
          },
        },
      },
    },
  });
  if (!report) throw new Error('QA_REPORT_NOT_FOUND');
  const run = report.run;
  const snapshot = run.expectedGraphVersion?.snapshot as any;
  const declaredStates = (Array.isArray(snapshot?.states) ? snapshot.states : []).map((state: any) => ({
    key: normalize(state.behaviorKey ?? state.stateName ?? state.name),
    name: String(state.name ?? state.stateName ?? state.behaviorKey ?? ''),
    role: String(state.role ?? 'INTERMEDIATE'),
  }));
  const rawTransitions = Array.isArray(snapshot?.transitions) ? snapshot.transitions : Array.isArray(snapshot?.edges) ? snapshot.edges : [];
  const declaredTransitions = rawTransitions.map((transition: any) => ({
    from: normalize(transition.fromStateKey ?? transition.from ?? transition.sourceBehaviorKey ?? transition.source),
    to: normalize(transition.toStateKey ?? transition.to ?? transition.targetBehaviorKey ?? transition.target),
    action: String(transition.action ?? transition.label ?? 'TRANSITION'),
  }));
  const accepted = run.progressEvents.filter((event) => event.accepted);
  const quarantined = run.progressEvents.filter((event) => !event.accepted);
  const observedStateKeys = new Set(accepted.map((event) => normalize(event.stateKey)).filter(Boolean));
  const observedTransitionKeys = new Set(accepted.filter((event) => event.eventType === 'FLOW_TRANSITION').map((event) => {
    const metadata = event.metadata as any;
    return `${normalize(metadata?.fromStateKey)}>${normalize(event.stateKey)}`;
  }));
  const missingStates = declaredStates.filter((state: any) => !observedStateKeys.has(state.key));
  const missingTransitions = declaredTransitions.filter((transition: any) => !observedTransitionKeys.has(`${transition.from}>${transition.to}`));
  const unexpectedStates = [...observedStateKeys].filter((state) => !declaredStates.some((declared: any) => declared.key === state));

  await prisma.qAReport.update({ where: { id: reportId }, data: { status: QAReportStatus.ANALYZING, rulesStatus: 'RUNNING' } });
  const deterministic = [
    ...missingStates.map((state: any) => ({
      id: `missing-state:${state.key}`, priority: state.role === 'TERMINAL' ? 'HIGH' : 'MEDIUM', generator: 'RULES',
      title: `Exercise the missing ${state.name || state.key} state`,
      impact: 'The declared Flow was not fully verified in this run.', confidence: 1,
      rationale: `No accepted Flow event referenced ${state.key}.`,
      suggestedAction: `Repeat the Flow and emit the approved state event when ${state.name || state.key} is reached.`,
      expectedOutcome: 'The report can verify this state and its incoming/outgoing transitions.',
      affectedState: state.key, affectedTransition: null, evidenceIds: [], effort: 'LOW', reproductionPath: [],
    })),
    ...missingTransitions.map((transition: any) => ({
      id: `missing-transition:${transition.from}:${transition.to}`, priority: 'MEDIUM', generator: 'RULES',
      title: `Verify ${transition.from} → ${transition.to}`, impact: 'A declared transition has no accepted evidence.', confidence: 1,
      rationale: 'No accepted FLOW_TRANSITION event matched the immutable Flow version.',
      suggestedAction: `Exercise the ${transition.action} action and emit a correlated transition event.`,
      expectedOutcome: 'The transition is reproducible and supported by interaction/request evidence.',
      affectedState: transition.to, affectedTransition: `${transition.from}>${transition.to}`, evidenceIds: [], effort: 'LOW', reproductionPath: [transition.from, transition.action, transition.to],
    })),
    ...run.findings.map((finding) => ({
      id: finding.id, priority: finding.severity, generator: finding.generatorSource,
      title: finding.title, impact: finding.description, confidence: finding.confidence,
      rationale: finding.description, suggestedAction: finding.recommendation || 'Investigate the linked evidence and repeat the affected step.',
      expectedOutcome: 'The affected interaction completes reliably without the captured failure.',
      affectedState: finding.relatedStateName, affectedTransition: null,
      evidenceIds: finding.evidenceEvents.map((link) => link.evidenceEventId), effort: 'MEDIUM', reproductionPath: finding.reproductionSteps,
      // A finding with no recorded scope must not silently pass as in-Flow:
      // resolve it from the run's boundary instead.
      scope: resolveFindingScope(finding.scope, Boolean(run.boundaryStartedAt)),
    })),
  ].sort((left, right) => (severityRank[left.priority] ?? 99) - (severityRank[right.priority] ?? 99));
  // Declared-but-unobserved states and transitions are absence findings: they
  // belong to the Flow itself and carry no scope of their own.
  const inFlowDeterministic = deterministic.filter(isInFlow);
  const preBoundaryDeterministic = deterministic.filter((item) => !isInFlow(item));

  let aiSuggestions: any[] = [];
  let aiStatus = 'NOT_ENTITLED_OR_CONFIGURED';
  const entitlement = new EntitlementChecker(prisma);
  const aiEnabled = process.env.QA_REPORT_AI_ENABLED === 'true'
    && await entitlement.canAccess(run.organizationId, Feature.REPORT_GENERATION);
  if (aiEnabled) {
    const provider = resolveAiProvider();
    if (provider.name !== 'mock') {
      try {
        const safeInput = {
          flow: { states: declaredStates, transitions: declaredTransitions },
          boundary: { missingStates: missingStates.map((state: any) => state.key), missingTransitions, unexpectedStates, quarantinedCount: quarantined.length },
          // Section 3 is in-Flow only, so the synthesis input is too: out-of-Flow
          // findings must not seed recommendations that land in that section.
          deterministicFindings: inFlowDeterministic.map(({ id, priority, title, impact, confidence, suggestedAction, evidenceIds }) => ({ id, priority, title, impact, confidence, suggestedAction, evidenceIds })),
          performance: run.evidenceEvents
            .filter((event) => event.eventType === 'QA_PAGE_PERFORMANCE' && event.scope === 'IN_FLOW')
            .map((event) => ({ id: event.id, route: event.normalizedRoute, metrics: event.metadata })),
        };
        const generated = await provider.generateStructured({
          schema: AiImprovementSchema,
          timeoutMs: 20_000,
          prompt: `Produce evidence-backed QA improvements as strict JSON. Do not invent routes, states, transitions, or evidence IDs. Input:\n${JSON.stringify(safeInput)}`,
        });
        // Nothing the model returns is trusted as a reference. Evidence ids,
        // state keys and transitions are checked against what this run actually
        // produced; invented references are dropped, and a suggestion left with
        // no verifiable anchor at all is discarded rather than published.
        const knownEvidenceIds = new Set(run.evidenceEvents.map((event) => event.id));
        const knownFindingIds = new Set(run.findings.map((finding) => finding.id));
        const knownStateKeys = new Set(declaredStates.map((state: any) => state.key));
        const knownTransitionKeys = new Set(declaredTransitions.map((transition: any) => `${transition.from}>${transition.to}`));
        const existing = new Set(inFlowDeterministic.map((item) => normalize(item.suggestedAction)));
        const deduped = generated.data.suggestions
          .filter((item) => !existing.has(normalize(item.suggestedAction)));
        const anchored = deduped
          .map((item) => anchorAiSuggestion(item, {
            evidenceIds: knownEvidenceIds,
            findingIds: knownFindingIds,
            stateKeys: knownStateKeys as Set<string>,
            transitionKeys: knownTransitionKeys as Set<string>,
          }))
          .filter((item): item is NonNullable<typeof item> => item !== null);
        const discardedUnanchored = deduped.length - anchored.length;
        aiSuggestions = anchored.map((item, index) => ({
          id: `ai:${index + 1}`, title: item.suggestedAction, generator: 'AI', effort: 'MEDIUM', reproductionPath: [], ...item,
        }));
        aiStatus = discardedUnanchored
          ? `READY:${provider.name}:${provider.model}:discarded_unanchored=${discardedUnanchored}`
          : `READY:${provider.name}:${provider.model}`;
      } catch (error) {
        aiStatus = `FALLBACK_RULES_ONLY:${safeError(error)}`;
      }
    } else {
      aiStatus = 'FALLBACK_RULES_ONLY:provider_not_configured';
    }
  }

  await prisma.qAReport.update({ where: { id: reportId }, data: { status: QAReportStatus.GENERATING, rulesStatus: 'READY', aiStatus } });
  const counts = Object.fromEntries(Object.entries(run.evidenceEvents.reduce<Record<string, number>>((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] ?? 0) + 1;
    return acc;
  }, {})));
  const improvements = [...inFlowDeterministic, ...aiSuggestions];
  const criticalOutOfFlow = preBoundaryDeterministic.filter((item) => ['CRITICAL', 'HIGH'].includes(item.priority));
  // The appendix is a bounded sample, not a full dump: a long run can produce
  // tens of thousands of evidence events, and embedding every one of them with
  // full metadata made the immutable payload unbounded. Counts stay exact; the
  // events themselves remain queryable through the evidence endpoints.
  const APPENDIX_EVENT_LIMIT = 2_000;
  const appendixEvents = run.evidenceEvents.slice(0, APPENDIX_EVENT_LIMIT);
  const appendixTruncated = run.evidenceEvents.length - appendixEvents.length;
  // Report what was actually captured rather than inferring it from whether a
  // patch set happened to be attached.
  const hasClientStateEvidence = run.evidenceEvents.some((event) => event.eventType === 'QA_CLIENT_STATE_MUTATION');
  const payload = {
    id: report.id,
    runId: run.id,
    schemaVersion: '2.0',
    status: run.status,
    reportStatus: 'READY',
    generatedAt: new Date().toISOString(),
    application: run.application,
    environment: run.environment,
    flow: run.expectedGraphVersion ? {
      id: run.expectedGraphVersion.graphId,
      versionId: run.expectedGraphVersion.id,
      version: run.expectedGraphVersion.version,
      name: run.expectedGraphVersion.graph.name,
      purpose: run.expectedGraphVersion.graph.purpose,
      scopeStatement: run.expectedGraphVersion.graph.scopeStatement,
      initialStateKey: run.initialStateKey,
      terminalStateKeys: run.terminalStateKeys,
    } : null,
    boundary: {
      status: run.status,
      startedAt: run.boundaryStartedAt,
      completedAt: run.boundaryCompletedAt,
      lastObservedStateKey: run.lastObservedStateKey,
      completionReason: run.completionReason,
      timeoutAt: run.timeoutAt,
      acceptedEvents: accepted,
      quarantinedEvents: quarantined,
    },
    captureTracks: run.captureTracks,
    correlation: { runId: run.id, sessions: run.observedSessions.map((session) => ({ sessionId: session.id, traceId: session.traceId, startedAt: session.startTime, endedAt: session.endTime })) },
    repository: run.repositorySnapshot ? { revision: run.repositorySnapshot.revision, dirty: run.repositorySnapshot.dirty, scannerVersion: run.repositorySnapshot.scannerVersion, redactionSummary: run.repositorySnapshot.redactionSummary } : null,
    instrumentation: run.patchSet ? { patchSetId: run.patchSet.id, planId: run.patchSet.instrumentationPlanId, adapterId: run.patchSet.instrumentationPlan.adapterId, adapterVersion: run.patchSet.instrumentationPlan.adapterVersion, manifestVersion: run.patchSet.manifestVersion, status: run.patchSet.status, risk: run.patchSet.instrumentationPlan.risk, changedFileHashes: run.patchSet.changedFileHashes, validation: run.patchSet.validationJson, appliedAt: run.patchSet.appliedAt, validatedAt: run.patchSet.validatedAt } : null,
    expectedIntent: run.expectedGraphVersion ? { graphId: run.expectedGraphVersion.graphId, graphVersionId: run.expectedGraphVersion.id, graphName: run.expectedGraphVersion.graph.name, provenance: run.expectedGraphVersion.graph.sourceType, evidenceManifest: snapshot?.evidenceManifest ?? null, expectedStateCount: declaredStates.length, expectedTransitionCount: declaredTransitions.length } : null,
    coverage: { expected: declaredStates.length ? ((declaredStates.length - missingStates.length) / declaredStates.length) * 100 : null, reconciledFlows: 1 },
    findings: run.findings,
    artifacts: run.artifacts.map((artifact) => ({ ...artifact, bytes: artifact.bytes.toString() })),
    summary: { sessionCount: run.observedSessions.length, observedStateCount: observedStateKeys.size, observedTransitionCount: observedTransitionKeys.size, artifactCount: run.artifacts.length, findingCount: run.findings.length, criticalOrHighFindings: run.findings.filter((finding) => ['CRITICAL', 'HIGH'].includes(finding.severity)).length },
    sections: {
      flowSummary: { name: run.expectedGraphVersion?.graph.name ?? 'Selected Flow', purpose: run.expectedGraphVersion?.graph.purpose ?? null, scope: run.expectedGraphVersion?.graph.scopeStatement ?? null, initialState: run.initialStateKey, terminalStates: run.terminalStateKeys, declaredStateCount: declaredStates.length, declaredTransitionCount: declaredTransitions.length, version: run.expectedGraphVersion?.version ?? null, provenance: run.expectedGraphVersion?.graph.sourceType ?? null },
      runSummary: { url: run.targetUrl, environment: run.environment, captureTracks: run.captureTracks, instrumentationAvailable: Boolean(run.patchSet), frameworkStateEvidenceCaptured: hasClientStateEvidence, repositoryRevision: run.repositorySnapshot?.revision ?? null, durationMs: run.startedAt && run.endedAt ? run.endedAt.getTime() - run.startedAt.getTime() : null, boundaryOutcome: run.completionReason, eventCounts: counts, captureDegraded: run.findings.some((finding) => finding.category === 'CAPTURE_DEGRADED') },
      inFlowFindings: { recommendedNextActions: improvements.slice(0, 10), findings: improvements, missingStates, missingTransitions, unexpectedStates },
      criticalSystemWideFindings: criticalOutOfFlow,
      userAnnotations: run.annotations.map((annotation, index) => ({ id: annotation.id, pin: index + 1, comment: annotation.comment, author: annotation.author, timestamp: annotation.createdAt, route: annotation.normalizedRoute, flowState: annotation.flowStateKey, resolution: annotation.windowResolution, element: annotation.elementFingerprint, screenshotArtifactId: annotation.screenshotArtifactId, mentionedTeammates: annotation.mentions.map((mention) => ({ id: mention.userId, displayName: mention.displayNameSnapshot })) })),
      evidenceAppendix: {
        events: appendixEvents.map((event) => ({ id: event.id, eventId: event.eventId, type: event.eventType, source: event.source, scope: event.scope, timestamp: event.occurredAt, route: event.normalizedRoute ?? routeFromUrl(event.pageUrl), state: event.acceptedFlowStateKey, interactionGroupId: event.interactionGroupId, causedByEventId: event.causedByEventId, metadata: event.metadata, protectedValues: event.protectedValues })),
        eventTotal: run.evidenceEvents.length,
        eventsTruncated: appendixTruncated > 0 ? appendixTruncated : 0,
        acceptedFlowEvents: accepted,
        quarantinedFlowEvents: quarantined,
        limitations: [
          ...(hasClientStateEvidence
            ? []
            : ['Framework-state evidence was unavailable: no validated state instrumentation reported Redux, Context, or useState mutations during this run. Browser-level QA is unaffected.']),
          ...(run.environment.type === 'PRODUCTION' ? ['Production capture was metadata-only; values and payload bodies were not retained.'] : []),
          ...(appendixTruncated > 0 ? [`The evidence appendix lists the first ${APPENDIX_EVENT_LIMIT} of ${run.evidenceEvents.length} events; the remainder stay queryable through the evidence endpoints.`] : []),
        ],
      },
    },
  };
  await prisma.$transaction([
    prisma.qAReport.update({ where: { id: report.id }, data: { status: QAReportStatus.READY, payload, generatedAt: new Date(), rulesStatus: 'READY', aiStatus, generatorProvenance: { schemaVersion: '2.0', deterministic: true, aiStatus } } }),
    prisma.qAReportGenerationJob.update({ where: { reportId: report.id }, data: { status: QAReportJobStatus.COMPLETED, completedAt: new Date(), failureReasonSafe: null } }),
    prisma.qARun.update({ where: { id: run.id }, data: { reportId: report.id } }),
    prisma.auditLog.create({ data: { userId: run.createdByUserId, organizationId: run.organizationId, action: 'REPORT_GENERATED', metadata: { runId: run.id, reportId: report.id, schemaVersion: '2.0', aiStatus } } }),
  ]);
  await notifyReportReady(prisma, report.id);
}

export async function processQaReportJobs(prisma: PrismaClient): Promise<number> {
  const job = await claimJob(prisma);
  if (!job) return 0;
  try {
    await generateReport(prisma, job.reportId);
    return 1;
  } catch (error) {
    const message = safeError(error);
    const finalAttempt = job.attempts >= job.maxAttempts;
    await prisma.$transaction([
      prisma.qAReportGenerationJob.update({
        where: { id: job.id },
        data: {
          status: finalAttempt ? QAReportJobStatus.FAILED : QAReportJobStatus.QUEUED,
          scheduledAt: finalAttempt ? job.scheduledAt : new Date(Date.now() + Math.min(60_000, 2 ** job.attempts * 2_000)),
          failureReasonSafe: message,
          completedAt: finalAttempt ? new Date() : null,
        },
      }),
      prisma.qAReport.update({ where: { id: job.reportId }, data: { status: finalAttempt ? QAReportStatus.FAILED : QAReportStatus.PENDING, failureReasonSafe: message, attempts: job.attempts } }),
    ]);
    return 0;
  }
}
