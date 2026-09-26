/**
 * `GET /applications/:id/dashboard-overview` — the whole dashboard in one call.
 *
 * This replaces eight browser-side requests whose results were stitched together
 * by ~250 lines of untyped mapping in a React component. That arrangement had
 * two failure modes this endpoint is built to remove:
 *
 *   1. `Promise.allSettled` cannot reject, so a total backend outage produced a
 *      plausible-looking response with every field absent — which the client
 *      read as "SDK not connected" and answered with an onboarding wizard.
 *      Here, a database failure is a 500 and the client shows an error.
 *   2. Fields the API never sent were filled in by the client with `0`, `"ERROR"`
 *      or `"Application Flow"`. Everything returned here comes from a row, or
 *      is explicitly NOT_MEASURED.
 *
 * Only the endpoint-engine call is allowed to degrade: it is a separate service
 * over HTTP, and losing API latency data should not take the page down with it.
 */

import { Router, type Response } from 'express';
import type { PrismaClient } from '@tellann/db';
import { getRuleSet, reconstructRuleSet, type ApplicationRuleSet } from '@tellann/rules';
import {
  Feature,
  type DashboardOverviewResponse,
  type DiscoveredWorkflow,
  type GraphEdgeSummary,
  type GraphNodeSummary,
  type MissingFlowCategory,
  type MissingFlowFinding,
  type MissingStateCategory,
  type MissingStateFinding,
  type ObservedEndpoint,
  type CoverageOpportunity,
  type MeasuredSummary,
  type PrivacyStatus,
  resolveQaRunTitle,
} from '@tellann/shared';

import type { CallerRequest } from './auth';
import {
  COVERAGE_HISTORY_LIMIT,
  classifyGraphNodes,
  combineFindingCounts,
  deriveAnalysisStatus,
  deriveBehaviorSummary,
  deriveErrorCoverage,
  deriveFlowChangeFeed,
  deriveExpectedCoverage,
  deriveExpectedVsObserved,
  deriveHealthIssues,
  deriveLifecycle,
  deriveMaturity,
  derivePlanUsage,
  deriveWorkflowCoverage,
  measured,
  normaliseSeverity,
  notMeasured,
  pickDeltaBaseline,
  ratioPercent,
  resolveRangeWindow,
  latestReconciliationPerFlow,
  toActivityEntries,
  toCoverageHistory,
  toObservedFindings,
  toReportSummaries,
  topNodesByVisits,
  transitionKey,
  windowDays,
  withBasisDelta,
  type DeltaBasis,
  type ReconciliationRow,
  type SnapshotPoint,
} from './dashboard-derivation';

/** Most-visited states kept for the topology preview. */
const GRAPH_NODE_LIMIT = 150;
/** Recent sessions listed on the overview. */
const SESSION_LIMIT = 10;
/** Findings returned; the cards show fewer and link out for the rest. */
const FINDING_LIMIT = 25;
/** Activity rows returned; the card shows fewer and links out. */
const ACTIVITY_LIMIT = 20;

type Middleware = (req: CallerRequest, res: Response, next: () => void) => unknown;

export interface DashboardOverviewDeps {
  prisma: PrismaClient;
  entitlementChecker: { getEntitlement: (orgId: string) => Promise<{
    planType: string;
    features: Record<string, boolean | string>;
    limits: { applications: number; storageGb: number; retentionDays: number };
  }> };
  verifyCaller: Middleware;
  requireApplicationAccess: (param?: string) => Middleware;
  ensureFeatureAccess: (
    applicationId: string,
    feature: Feature,
    res: Response,
  ) => Promise<{ allowed: true; organizationId: string | null } | { allowed: false }>;
  resolveEnvironmentScope: (applicationId: string, requested: string | undefined) => Promise<string | null>;
  endpointAnalysisUrl: (applicationId: string) => string;
  endpointEngineHeaders: () => Record<string, string>;
}

interface ObservedEdgeRow {
  fromName: string;
  toName: string;
  lastAt: Date;
}

interface ObservedNodeRow {
  name: string;
  visits: number;
  lastAt: Date;
}

export function createDashboardOverviewRouter(deps: DashboardOverviewDeps): Router {
  const {
    prisma,
    entitlementChecker,
    verifyCaller,
    requireApplicationAccess,
    ensureFeatureAccess,
    resolveEnvironmentScope,
    endpointAnalysisUrl,
    endpointEngineHeaders,
  } = deps;

  const router = Router();

  router.get(
    '/applications/:id/dashboard-overview',
    verifyCaller as never,
    requireApplicationAccess('id') as never,
    async (req: CallerRequest, res: Response) => {
      const applicationId = req.params.id;

      try {
        // DASHBOARD_ACCESS, not REPORT_GENERATION: a plan without report
        // generation still gets a dashboard, and gating on the wrong feature
        // would 403 the entire page.
        const access = await ensureFeatureAccess(applicationId, Feature.DASHBOARD_ACCESS, res);
        if (!access.allowed) return;

        const application = await prisma.application.findUnique({
          where: { id: applicationId },
          select: { id: true, name: true, organizationId: true },
        });
        if (!application) return res.status(404).json({ error: 'Application not found' });

        const environmentId = await resolveEnvironmentScope(
          applicationId,
          typeof req.query.environmentId === 'string' ? req.query.environmentId : undefined,
        );
        const environment = environmentId
          ? await prisma.environment.findUnique({
              where: { id: environmentId },
              select: { id: true, name: true, type: true },
            })
          : null;

        const now = new Date();
        const window = resolveRangeWindow(
          typeof req.query.range === 'string' ? req.query.range : undefined,
          typeof req.query.from === 'string' ? req.query.from : undefined,
          typeof req.query.to === 'string' ? req.query.to : undefined,
          now,
        );

        const sessionWhere = {
          applicationId,
          ...(environmentId ? { environmentId } : {}),
          ...(window.fromDate || window.toDate
            ? {
                startTime: {
                  ...(window.fromDate ? { gte: window.fromDate } : {}),
                  ...(window.toDate ? { lte: window.toDate } : {}),
                },
              }
            : {}),
        };

        const [
          progress,
          sessionCount,
          recentSessions,
          sessionTotals,
          lastSession,
          observedNodes,
          observedEdges,
          workflows,
          openMissingStates,
          openMissingFlows,
          runs,
          snapshotSeries,
          reconciliationRows,
          profile,
          compiledRuleset,
          graphStates,
          missingStateGroups,
          missingFlowGroups,
          declaredGraphs,
          organizationApplicationCount,
          storageTotals,
          entitlement,
          activationEvents,
          browserFindings,
          rankedTransitions,
          protectedValueGroups,
        ] = await Promise.all([
          prisma.applicationOnboardingProgress.findUnique({ where: { applicationId } }),
          prisma.session.count({ where: sessionWhere }),
          prisma.session.findMany({
            where: sessionWhere,
            include: { statistics: true },
            orderBy: { startTime: 'desc' },
            take: SESSION_LIMIT,
          }),
          prisma.sessionStatistic.aggregate({
            _sum: { eventCount: true },
            where: { session: sessionWhere },
          }),
          prisma.session.aggregate({ _max: { endTime: true }, where: { applicationId, ...(environmentId ? { environmentId } : {}) } }),
          observedNodesInScope(prisma, applicationId, environmentId, window.fromDate, window.toDate),
          observedEdgesInScope(prisma, applicationId, environmentId, window.fromDate, window.toDate),
          prisma.workflow.findMany({ where: { applicationId }, orderBy: { executionCount: 'desc' } }),
          prisma.missingState.findMany({
            where: openFindingWhere(applicationId, environmentId),
            orderBy: { detectedAt: 'desc' },
            take: FINDING_LIMIT,
          }),
          prisma.missingFlow.findMany({
            where: openFindingWhere(applicationId, environmentId),
            include: { workflow: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: FINDING_LIMIT,
          }),
          prisma.qARun.findMany({
            where: { applicationId, archivedAt: null, ...(environmentId ? { environmentId } : {}) },
            select: {
              id: true, status: true, title: true, createdAt: true, startedAt: true,
              boundaryStartedAt: true, endedAt: true, failureReasonSafe: true,
              // Whether flow progress events can exist for this run at all.
              expectedGraphVersionId: true,
              // A one-to-one on a unique column: one extra IN query, not 25.
              report: { select: { id: true, status: true, generatedAt: true, failureReasonSafe: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 25,
          }),
          // One query serves the latest snapshot, the delta baseline and the
          // whole trend. +1 so a full-length chart still has a row behind it.
          prisma.coverageSnapshot.findMany({
            where: { applicationId, ...(environmentId ? { environmentId } : {}) },
            orderBy: { createdAt: 'desc' },
            take: COVERAGE_HISTORY_LIMIT + 1,
            select: {
              id: true, createdAt: true, coveragePercent: true, transitionCoverage: true,
              flowCoverage: true, observedStates: true, observedTransitions: true,
              openFindings: true,
            },
          }),
          // Scalar counts only. trueGaps/undeclared are Json blobs that can hold
          // hundreds of entries; the count columns carry everything shown here,
          // and the detail lives behind the /reconciliation link.
          prisma.reconciliationReport.findMany({
            where: { applicationId, ...(environmentId ? { environmentId } : {}) },
            orderBy: { generatedAt: 'desc' },
            take: 20,
            select: {
              id: true, flowId: true, qaRunId: true, generatedAt: true,
              expectedCoverageScore: true, transitionCoverageScore: true,
              trueGapCount: true, trueGapTransitions: true,
              undeclaredCount: true, undeclaredTransitions: true,
              flow: { select: { id: true, name: true } },
            },
          }),
          prisma.applicationProfile.findUnique({ where: { applicationId } }),
          prisma.compiledRuleset.findFirst({ where: { applicationId }, orderBy: { compiledAt: 'desc' } }),
          prisma.state.findMany({
            where: { applicationId },
            orderBy: { visitCount: 'desc' },
            take: GRAPH_NODE_LIMIT,
            select: { id: true, name: true, visitCount: true },
          }),
          // The findings tally must count every open finding, not the 25 the
          // lists above are capped at. Grouping gives the severity split and
          // the true total in one query per table.
          prisma.missingState.groupBy({
            by: ['severity'],
            where: openFindingWhere(applicationId, environmentId),
            _count: { _all: true },
          }),
          prisma.missingFlow.groupBy({
            by: ['severity'],
            where: openFindingWhere(applicationId, environmentId),
            _count: { _all: true },
          }),
          // Declared behaviour. Relation counts rather than materialising every
          // node and edge only to read .length off them.
          prisma.behaviorGraph.findMany({
            where: {
              applicationId,
              ...(environmentId ? { environmentId } : {}),
              graphType: 'DECLARED',
              status: 'COMPLETE',
            },
            select: { id: true, name: true, _count: { select: { nodes: true, edges: true } } },
          }),
          // Organisation-wide usage. Both are read directly rather than through
          // the entitlement checker's convenience helpers: canCreateApplication
          // short-circuits to a zero count on an inactive subscription, which
          // would render "0 applications" for a suspended org and then feed a
          // false plan-limit banner.
          application.organizationId
            ? prisma.application.count({ where: { organizationId: application.organizationId } })
            : Promise.resolve(0),
          application.organizationId
            ? prisma.storageLedgerEntry.aggregate({
                where: { organizationId: application.organizationId, deletedAt: null },
                _sum: { bytes: true, reservedBytes: true },
              })
            : Promise.resolve(null),
          // Read once here for plan name and limits. ensureFeatureAccess also
          // resolves an entitlement, but sharing it would mean changing a guard
          // four other routes depend on; this is one extra read, and the
          // drift-repair write it can trigger is rare and self-healing.
          application.organizationId
            ? entitlementChecker.getEntitlement(application.organizationId).catch(() => null)
            : Promise.resolve(null),
          // Activity. Served by the index added for exactly this read; the
          // pre-existing one leads with the organisation and event name.
          prisma.activationEvent.findMany({
            where: {
              applicationId,
              ...(environmentId ? { environmentId } : {}),
              ...(window.fromDate || window.toDate
                ? {
                    occurredAt: {
                      ...(window.fromDate ? { gte: window.fromDate } : {}),
                      ...(window.toDate ? { lte: window.toDate } : {}),
                    },
                  }
                : {}),
            },
            select: { id: true, eventName: true, occurredAt: true },
            orderBy: { occurredAt: 'desc' },
            take: ACTIVITY_LIMIT,
          }),
          // Observed defects from runs. Scoped through the run, which is the
          // only route: a finding carries no application of its own.
          prisma.browserFinding.findMany({
            where: {
              run: {
                applicationId,
                archivedAt: null,
                ...(environmentId ? { environmentId } : {}),
                ...(window.fromDate || window.toDate
                  ? {
                      createdAt: {
                        ...(window.fromDate ? { gte: window.fromDate } : {}),
                        ...(window.toDate ? { lte: window.toDate } : {}),
                      },
                    }
                  : {}),
              },
            },
            select: {
              id: true, runId: true, category: true, severity: true, title: true,
              description: true, recommendation: true, relatedStateName: true, createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: FINDING_LIMIT,
          }),
          // Transitions between the states already fetched, for the hot/cold
          // path view. `frequency` is the only behavioural counter there is.
          prisma.transition.findMany({
            where: { applicationId },
            select: {
              frequency: true,
              fromState: { select: { name: true } },
              toState: { select: { name: true } },
            },
            orderBy: { frequency: 'desc' },
            take: GRAPH_NODE_LIMIT,
          }),
          // Privacy: protected values recorded against this application's runs.
          // Bounded by the same window as everything else — both so the card
          // agrees with the rest of the page, and because an all-time count
          // walks every evidence row the application has ever produced.
          prisma.qARunProtectedValue.groupBy({
            by: ['kind'],
            where: {
              evidenceEvent: {
                run: {
                  applicationId,
                  ...(environmentId ? { environmentId } : {}),
                  archivedAt: null,
                  ...(window.fromDate || window.toDate
                    ? {
                        createdAt: {
                          ...(window.fromDate ? { gte: window.fromDate } : {}),
                          ...(window.toDate ? { lte: window.toDate } : {}),
                        },
                      }
                    : {}),
                },
              },
            },
            _count: { _all: true },
          }),
        ]);

        // The endpoint engine is a separate service. It is the one dependency
        // allowed to fail without failing the page.
        const endpointAnalysis = await fetchEndpointAnalysis(
          endpointAnalysisUrl(applicationId),
          endpointEngineHeaders(),
          environmentId,
          windowDays(window, now),
        );

        const observedStateNames = new Set(observedNodes.map((node) => node.name));
        const observedTransitionKeys = new Set(
          observedEdges.map((edge) => transitionKey(edge.fromName, edge.toName)),
        );
        const scopeHasObservations = observedEdges.length > 0 || observedNodes.length > 0;

        // ── Workflows ────────────────────────────────────────────
        const lastDemonstratedByWorkflow = lastDemonstratedPerWorkflow(workflows, observedEdges, observedNodes);
        const discoveredWorkflows: DiscoveredWorkflow[] = workflows.map((wf) =>
          deriveWorkflowCoverage({
            id: wf.id,
            name: wf.name,
            path: wf.path,
            stateCount: wf.stateCount,
            transitionCount: wf.transitionCount,
            executionCount: wf.executionCount,
            lastDemonstratedAt: lastDemonstratedByWorkflow.get(wf.id) ?? null,
            observedTransitions: observedTransitionKeys,
            scopeHasObservations,
          }),
        );

        // ── Findings ─────────────────────────────────────────────
        const workflowNameByPath = new Map(workflows.map((wf) => [JSON.stringify(wf.path), wf.name]));

        const missingStates: MissingStateFinding[] = openMissingStates.map((row) => ({
          id: row.id,
          stateName: row.stateName,
          // `sourceState` is a real observed state. The workflow it belongs to
          // is not recorded, so this reports what is known rather than the
          // "Application Workflow" placeholder it used to invent.
          workflowName: row.sourceState || null,
          category: (row.category as MissingStateCategory | null) ?? null,
          severity: normaliseSeverity(row.severity),
          evidence: row.reason ?? 'Not observed in the analysed sessions.',
          detectedAt: row.detectedAt.toISOString(),
        }));

        const missingFlows: Array<MissingFlowFinding & { sourceWorkflowId: string | null }> =
          openMissingFlows.map((row) => {
          const path = Array.isArray(row.suggestedFlow) ? (row.suggestedFlow as unknown[]).map(String) : [];
          return {
            sourceWorkflowId: row.workflowId,
            id: row.id,
            flowName: path.length ? path[path.length - 1] : 'Unobserved path',
            workflowName: row.workflow?.name ?? workflowNameByPath.get(JSON.stringify(row.sourceFlow)) ?? null,
            path,
            category: (row.category as MissingFlowCategory | null) ?? null,
            severity: normaliseSeverity(row.severity),
            evidence: row.reason,
            detectedAt: row.createdAt.toISOString(),
          };
        });

        const opportunities: CoverageOpportunity[] = missingFlows
          .filter((flow) => flow.path.length > 0)
          .slice(0, 2)
          .map((flow) => ({
            id: `opportunity-${flow.id}`,
            workflowId: flow.sourceWorkflowId,
            workflowName: flow.workflowName,
            title: `Demonstrate ${flow.flowName}`,
            description: flow.evidence,
            unobservedPathsCount: flow.path.length,
            suggestedSteps: flow.path.map((step, position) =>
              position === 0 ? `Start at ${step}` : `Continue to ${step}`,
            ),
          }));

        // Severity order is a rank, not an alphabet. Applied after mapping
        // because the database column is free text.
        missingStates.sort(bySeverityThenRecency);
        missingFlows.sort(bySeverityThenRecency);

        // ── Graph ────────────────────────────────────────────────
        const stateIds = graphStates.map((state) => state.id);
        const graphTransitions = stateIds.length
          ? await prisma.transition.findMany({
              where: { applicationId, fromStateId: { in: stateIds }, toStateId: { in: stateIds } },
              select: { id: true, fromStateId: true, toStateId: true, action: true },
            })
          : [];

        const edges: GraphEdgeSummary[] = graphTransitions.map((t) => ({
          id: t.id,
          source: t.fromStateId,
          target: t.toStateId,
          label: t.action ?? undefined,
        }));
        const classification = classifyGraphNodes(graphStates, edges);
        const allNodes: GraphNodeSummary[] = graphStates.map((state) => ({
          id: state.id,
          label: state.name,
          type: classification.get(state.id) ?? 'state',
          visitCount: state.visitCount,
        }));

        // ── Coverage ─────────────────────────────────────────────
        const ruleSet: ApplicationRuleSet | null = compiledRuleset
          ? reconstructRuleSet(compiledRuleset.rules as never, profile?.profileType || 'ECOMMERCE')
          : getRuleSet(profile?.profileType || 'ECOMMERCE');

        const errorCoverage = deriveErrorCoverage({
          expectedErrorStates: expectedErrorStates(ruleSet),
          observedStateNames,
        });

        // ── Snapshots, deltas and trend ──────────────────────────
        const series: SnapshotPoint[] = snapshotSeries.map((row) => ({
          id: row.id,
          createdAt: row.createdAt,
          coveragePercent: row.coveragePercent,
          transitionCoverage: row.transitionCoverage,
          flowCoverage: row.flowCoverage,
          observedStates: row.observedStates,
          observedTransitions: row.observedTransitions,
          openFindings: row.openFindings,
        }));
        const latestSnapshot = series[0] ?? null;
        const { baseline, basis } = pickDeltaBaseline(series, window.fromDate);
        const coverageHistory = toCoverageHistory(series);

        /**
         * Whether the observed counts may be differenced against a snapshot.
         *
         * They may not when the window has a lower bound. This response counts
         * states and transitions inside the requested window; a snapshot counts
         * them for all time. Differencing the two is a category error dressed as
         * a trend, so with a bounded window the honest answer is no delta.
         */
        const observedCountsComparable = window.fromDate === null;

        // ── Findings, counted rather than sampled ────────────────
        const findingTally = tallyFindingGroups([...missingStateGroups, ...missingFlowGroups]);

        // ── Usage ────────────────────────────────────────────────
        const usage =
          entitlement && application.organizationId
            ? derivePlanUsage({
                planName: entitlement.planType,
                applicationsUsed: organizationApplicationCount,
                applicationsLimit: entitlement.limits.applications ?? null,
                storageBytes:
                  (storageTotals?._sum.bytes ?? 0n) + (storageTotals?._sum.reservedBytes ?? 0n),
                storageLimitGb: entitlement.limits.storageGb ?? null,
                retentionDays: entitlement.limits.retentionDays ?? null,
              })
            : null;

        // ── Expected vs observed ─────────────────────────────────
        const reconciliations: ReconciliationRow[] = reconciliationRows.map((row) => ({
          id: row.id,
          flowId: row.flowId,
          flowName: row.flow?.name ?? 'Declared flow',
          qaRunId: row.qaRunId,
          generatedAt: row.generatedAt,
          expectedCoverageScore: row.expectedCoverageScore,
          transitionCoverageScore: row.transitionCoverageScore,
          trueGapCount: row.trueGapCount,
          trueGapTransitions: row.trueGapTransitions,
          undeclaredCount: row.undeclaredCount,
          undeclaredTransitions: row.undeclaredTransitions,
        }));
        const expectedVsObserved = deriveExpectedVsObserved({
          graphs: declaredGraphs.map((graph) => ({
            id: graph.id,
            name: graph.name,
            nodeCount: graph._count.nodes,
            edgeCount: graph._count.edges,
          })),
          reconciliations,
        });

        const analysisCount = runs.filter(
          (run) => run.status === 'COMPLETED' || run.status === 'COMPLETED_INCOMPLETE',
        ).length;
        const activeRun = runs.find((run) =>
          ['RECORDING', 'RUNNING', 'PROCESSING'].includes(run.status),
        );
        const pendingRun = runs.find((run) =>
          ['CREATED', 'ARMED', 'WAITING_FOR_INITIAL'].includes(run.status),
        );
        const newestTerminal = runs.find((run) =>
          ['COMPLETED', 'COMPLETED_INCOMPLETE', 'FAILED'].includes(run.status),
        );

        // The newest terminal run, and only that one — a failure three runs ago
        // that has since succeeded is not a current problem.
        const latestFailure =
          newestTerminal &&
          (newestTerminal.status === 'FAILED' || newestTerminal.report?.status === 'FAILED')
            ? {
                runId: newestTerminal.id,
                reportId: newestTerminal.report?.id ?? null,
                failedAt: newestTerminal.endedAt,
                // Prefer the report's reason when the run itself succeeded.
                reason:
                  newestTerminal.status === 'FAILED'
                    ? newestTerminal.failureReasonSafe
                    : newestTerminal.report?.failureReasonSafe ?? null,
              }
            : null;

        // ── Wave B: only for a genuinely live run ────────────────
        // Gated on the same statuses deriveLifecycle treats as live, so the
        // hero and these counts cannot disagree. An armed-but-idle run pays
        // nothing, and neither does every mature application.
        const liveRun =
          activeRun && (activeRun.status === 'RECORDING' || activeRun.status === 'RUNNING')
            ? activeRun
            : null;

        let liveDemonstration: DashboardOverviewResponse['liveDemonstration'] = null;
        if (liveRun) {
          const [eventCount, apiCallCount, errorCount, stateGroups, transitionCount] =
            await Promise.all([
              prisma.qARunEvidenceEvent.count({ where: { runId: liveRun.id } }),
              prisma.qARunEvidenceEvent.count({
                where: { runId: liveRun.id, eventType: { in: LIVE_API_EVENT_TYPES } },
              }),
              prisma.qARunEvidenceEvent.count({
                where: { runId: liveRun.id, eventType: { in: LIVE_ERROR_EVENT_TYPES } },
              }),
              prisma.qARunProgressEvent.groupBy({
                by: ['stateKey'],
                where: { runId: liveRun.id, accepted: true, stateKey: { not: null } },
              }),
              prisma.qARunProgressEvent.count({
                where: { runId: liveRun.id, accepted: true, eventType: 'FLOW_TRANSITION' },
              }),
            ]);

          // Flow progress is only recorded against a declared flow version.
          // Without one every progress event is quarantined, so reporting 0
          // would say "no progress" where the truth is "nothing to measure".
          const tracksFlow = liveRun.expectedGraphVersionId !== null;

          liveDemonstration = {
            id: liveRun.id,
            startedAt: (
              liveRun.startedAt ?? liveRun.boundaryStartedAt ?? liveRun.createdAt
            ).toISOString(),
            eventCount,
            stateCount: tracksFlow ? stateGroups.length : null,
            transitionCount: tracksFlow ? transitionCount : null,
            apiCallCount,
            errorCount,
          };
        }

        const frontendConnected = Boolean(progress?.sdkConnected) || sessionCount > 0;
        const backendConnected = (endpointAnalysis?.totalEndpoints ?? 0) > 0;

        const lifecycle = deriveLifecycle({
          hasApplication: true,
          frontendConnected,
          backendConnected,
          demonstrationCompleted: Boolean(progress?.demonstrationCompleted),
          firstAnalysisReviewed: Boolean(progress?.firstAnalysisReviewed),
          analysisCount,
          activeRunStatus: activeRun?.status ?? null,
        });

        const totalEndpoints = endpointAnalysis?.totalEndpoints ?? 0;
        const unhealthy = (endpointAnalysis?.slowEndpoints ?? 0) + (endpointAnalysis?.errorEndpoints ?? 0);

        // ── Change feed, activity, behaviour, observed findings ──
        const flowChanges = deriveFlowChangeFeed(reconciliations);
        const observedFindings = toObservedFindings(browserFindings);

        // Team-gated per the spec. A plan without team features gets an empty
        // array rather than a card it cannot use.
        const canSeeActivity = Boolean(entitlement?.features?.[Feature.TEAM_COLLABORATION]);
        const activity = canSeeActivity ? toActivityEntries(activationEvents) : [];

        const behavior = deriveBehaviorSummary({
          states: graphStates.map((state) => ({
            name: state.name,
            visitCount: state.visitCount,
          })),
          transitions: rankedTransitions.map((transition) => ({
            from: transition.fromState.name,
            to: transition.toState.name,
            frequency: transition.frequency,
          })),
          declaredButNeverObserved: reconciliations.length
            ? latestReconciliationPerFlow(reconciliations).reduce(
                (sum, row) => sum + row.trueGapTransitions,
                0,
              )
            : null,
        });

        const payload: DashboardOverviewResponse = {
          lifecycle,
          maturity: deriveMaturity(analysisCount, sessionCount),
          window: { range: window.range, from: window.from, to: window.to },
          application: {
            id: application.id,
            name: application.name,
            // Read from the resolved environment. The client used to read
            // `environment.type` off an application payload that only carries
            // `environments` (plural), so this always said "development".
            environment: (environment?.type ?? 'DEVELOPMENT').toLowerCase(),
            environmentId: environment?.id ?? null,
            plan: entitlement?.planType?.toLowerCase() ?? 'unknown',
          },
          onboarding: {
            applicationCreated: true,
            frontendConnected,
            backendConnected,
            telemetryVerified: Boolean(progress?.installationTestPassed),
            firstDemonstrationCompleted: Boolean(progress?.demonstrationCompleted),
            firstAnalysisGenerated: Boolean(progress?.analysisGenerated) || analysisCount > 0,
            firstAnalysisReviewed: Boolean(progress?.firstAnalysisReviewed),
          },
          telemetry: {
            frontendStatus: sessionCount > 0 ? 'ACTIVE' : frontendConnected ? 'INACTIVE' : 'NOT_CONFIGURED',
            backendStatus: backendConnected ? 'ACTIVE' : 'NOT_CONFIGURED',
            lastEventAt: lastSession._max.endTime?.toISOString() ?? null,
            eventCount: sessionTotals._sum.eventCount ?? 0,
          },
          analysis: {
            status: deriveAnalysisStatus({
              activeRunStatus: activeRun?.status ?? null,
              pendingRunStatus: pendingRun?.status ?? null,
              terminalRunStatus: newestTerminal?.status ?? null,
              terminalReportStatus: newestTerminal?.report?.status ?? null,
              terminalHasReport: Boolean(newestTerminal?.report),
            }),
            analysisCount,
            latestAnalysisId: newestTerminal?.report?.id ?? newestTerminal?.id,
            // An ISO timestamp, not a locale string formatted on a server whose
            // locale has nothing to do with the reader's.
            lastAnalysisAt: newestTerminal?.endedAt?.toISOString(),
            error: latestFailure?.reason ?? undefined,
          },
          summary: {
            workflowsDiscovered: measured(workflows.length),
            statesObserved: observedCountsComparable
              ? withBasisDelta(measured(observedNodes.length), baseline?.observedStates, basis)
              : measured(observedNodes.length),
            transitionsObserved: observedCountsComparable
              ? withBasisDelta(measured(observedEdges.length), baseline?.observedTransitions, basis)
              : measured(observedEdges.length),
            sessionCount: measured(sessionCount),
            // Both origins under one headline, with the split preserved so
            // "12 findings" cannot hide that eleven are rule inferences.
            findingsCount: applyTallyDelta(
              measured(combineFindingCounts(findingTally, observedFindings)),
              baseline?.openFindings,
              basis,
            ),
          },
          coverage: {
            workflowCoverage: withBasisDelta(
              latestSnapshot ? measured(round1(latestSnapshot.flowCoverage)) : notMeasured(),
              baseline?.flowCoverage,
              basis,
            ),
            stateCoverage: withBasisDelta(
              latestSnapshot ? measured(round1(latestSnapshot.coveragePercent)) : notMeasured(),
              baseline?.coveragePercent,
              basis,
            ),
            transitionCoverage: withBasisDelta(
              latestSnapshot ? measured(round1(latestSnapshot.transitionCoverage)) : notMeasured(),
              baseline?.transitionCoverage,
              basis,
            ),
            errorCoverage,
            // The mean of the newest score per declared flow. Taking a single
            // newest report presented one flow's score as the application's.
            expectedCoverage: deriveExpectedCoverage(reconciliations),
            // The coverage engine silently substitutes the reconciliation score
            // for transition coverage when a declared flow exists. Saying so is
            // what stops one tile meaning two different things.
            transitionCoverageFromDeclaredFlow: reconciliations.length > 0,
          },
          workflows: discoveredWorkflows,
          missingStates,
          missingFlows,
          opportunities,
          graph: {
            nodeCount: allNodes.length,
            edgeCount: edges.length,
            workflowCount: workflows.length,
            entryPointCount: [...classification.values()].filter((kind) => kind === 'entry').length,
            exitPointCount: [...classification.values()].filter((kind) => kind === 'exit').length,
            nodes: topNodesByVisits(allNodes),
            edges,
          },
          sessions: recentSessions.map((session) => ({
            id: session.id,
            durationSeconds: session.statistics?.durationMs != null
              ? Math.round(session.statistics.durationMs / 1000)
              : null,
            eventCount: session.statistics?.eventCount ?? null,
            errorCount: session.statistics?.errorCount ?? null,
            qaRunId: session.qaRunId,
            timestamp: session.startTime.toISOString(),
          })),
          endpoints: endpointAnalysis
            ? {
                observedCount: measured(totalEndpoints),
                averageLatencyMs: endpointAnalysis.endpoints.length
                  ? measured(
                      Math.round(
                        endpointAnalysis.endpoints.reduce((sum, e) => sum + (e.avgMs ?? 0), 0) /
                          endpointAnalysis.endpoints.length,
                      ),
                    )
                  : notMeasured(),
                healthyPercentage: ratioPercent(Math.max(0, totalEndpoints - unhealthy), totalEndpoints),
                // The engine's own rankings, which apply a minimum call volume
                // and thresholds aligned with the QA report. The client used to
                // re-rank with different thresholds of its own.
                slowEndpoints: (endpointAnalysis.slowest ?? []).slice(0, 3).map(toObservedEndpoint),
                errorProneEndpoints: (endpointAnalysis.errorProne ?? []).slice(0, 3).map(toObservedEndpoint),
              }
            : null,
          reports: toReportSummaries(
            runs.map((run) => ({
              id: run.id,
              title: run.title,
              createdAt: run.createdAt,
              startedAt: run.startedAt,
              environmentName: environment?.name ?? null,
              report: run.report,
            })),
            (run) =>
              resolveQaRunTitle({
                title: run.title,
                environmentName: run.environmentName,
                startedAt: run.startedAt,
                createdAt: run.createdAt,
              }),
          ),
          coverageHistory,
          coverageHistoryTruncated: snapshotSeries.length > COVERAGE_HISTORY_LIMIT,
          expectedVsObserved,
          flowChanges,
          behavior,
          activity,
          observedFindings,
          privacy: derivePrivacyStatus(protectedValueGroups),
          usage,
          liveDemonstration,
          healthIssues: deriveHealthIssues({
            now,
            lastEventAt: lastSession._max.endTime,
            hasEverReceivedData: lastSession._max.endTime !== null,
            latestFailure,
            usage,
          }),
        };

        res.setHeader('Cache-Control', 'private, no-store');
        return res.json(payload);
      } catch (error) {
        // Deliberately a 500. The client reads `isError` and shows a retry
        // state; the previous silent degradation is what showed a mature
        // account an onboarding wizard during an outage.
        console.error('[ReportEngine] Dashboard overview failed', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  return router;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

/** Most severe first, then most recent. */
function bySeverityThenRecency(
  a: { severity: string; detectedAt: string },
  b: { severity: string; detectedAt: string },
): number {
  const rank = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
  return rank !== 0 ? rank : b.detectedAt.localeCompare(a.detectedAt);
}

/** Event types that count as an API call during a live run. */
const LIVE_API_EVENT_TYPES = ['QA_REQUEST', 'QA_BACKEND_REQUEST'];
/**
 * Errors counted live. Console errors are excluded on purpose: they arrive as
 * QA_CONSOLE with the level inside `metadata`, so including them means a JSON
 * scan of the run's whole evidence on every poll.
 */
const LIVE_ERROR_EVENT_TYPES = ['QA_RUNTIME_ERROR', 'QA_PAGE_CRASH', 'QA_BACKEND_ERROR'];

type SeverityGroup = { severity: string | null; _count: { _all: number } };

/**
 * The findings breakdown, over every open finding.
 *
 * Counted by grouping rather than by summing the displayed lists, which are
 * capped — the tally used to saturate at the list limit, so an application with
 * more findings than that reported a total that could not grow.
 */
export function tallyFindingGroups(groups: SeverityGroup[]) {
  const tally = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
  for (const group of groups) {
    const count = group._count._all;
    tally.total += count;
    switch (normaliseSeverity(group.severity)) {
      case 'CRITICAL': tally.critical += count; break;
      case 'HIGH': tally.high += count; break;
      case 'MEDIUM': tally.medium += count; break;
      case 'LOW': tally.low += count; break;
      default: break;
    }
  }
  return tally;
}

/** The findings delta is the change in the total, with the same basis rules. */
function applyTallyDelta(
  current: MeasuredSummary['findingsCount'],
  previousTotal: number | null | undefined,
  basis: DeltaBasis | null,
): MeasuredSummary['findingsCount'] {
  if (current.status !== 'MEASURED' || current.value === null) return current;
  if (previousTotal === null || previousTotal === undefined || !basis) return current;
  return { ...current, delta: current.value.total - previousTotal, deltaBasis: basis };
}

/**
 * What the classifier actually protects. Read as categories rather than as a
 * configurable rule count, because no user-authored privacy rule exists.
 */
const PROTECTED_CATEGORIES = [
  'Passwords, tokens and keys',
  'Email addresses and phone numbers',
  'Request and response bodies',
];

function derivePrivacyStatus(
  groups: Array<{ kind: string; _count: { _all: number } }>,
): PrivacyStatus {
  let secrets = 0;
  let identifiers = 0;
  for (const group of groups) {
    if (group.kind === 'SECRET') secrets += group._count._all;
    if (group.kind === 'DIRECT_IDENTIFIER') identifiers += group._count._all;
  }
  return {
    active: true,
    protectedFieldCount: measured({ total: secrets + identifiers, secrets, identifiers }),
    captureMaskingEnabled: true,
    protectedCategories: PROTECTED_CATEGORIES,
  };
}

function openFindingWhere(applicationId: string, environmentId: string | null) {
  return {
    applicationId,
    resolvedAt: null,
    // Rows recorded before findings were environment-scoped have no
    // environment. They are shown everywhere rather than hidden, and the next
    // analysis per environment re-infers them with a real one.
    ...(environmentId ? { OR: [{ environmentId }, { environmentId: null }] } : {}),
  };
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

/**
 * Observed states in scope.
 *
 * States carry no environment of their own; the only route is through the
 * session that observed them. Done as a join rather than by collecting session
 * ids into an `IN (...)` list, whose size grows with the application's history.
 */
async function observedNodesInScope(
  prisma: PrismaClient,
  applicationId: string,
  environmentId: string | null,
  from: Date | null,
  to: Date | null,
): Promise<ObservedNodeRow[]> {
  return prisma.$queryRaw<ObservedNodeRow[]>`
    SELECT st."name"                AS "name",
           COUNT(*)::int            AS "visits",
           MAX(so."timestamp")      AS "lastAt"
      FROM "StateObservation" so
      JOIN "Session" s  ON s."id"  = so."sessionId"
      JOIN "State"   st ON st."id" = so."stateId"
     WHERE s."applicationId" = ${applicationId}
       AND (${environmentId}::text IS NULL OR s."environmentId" = ${environmentId})
       AND (${from}::timestamptz IS NULL OR s."startTime" >= ${from})
       AND (${to}::timestamptz   IS NULL OR s."startTime" <= ${to})
     GROUP BY st."name"
  `;
}

/** Observed transitions in scope. See the note on `observedNodesInScope`. */
async function observedEdgesInScope(
  prisma: PrismaClient,
  applicationId: string,
  environmentId: string | null,
  from: Date | null,
  to: Date | null,
): Promise<ObservedEdgeRow[]> {
  return prisma.$queryRaw<ObservedEdgeRow[]>`
    SELECT fs."name"           AS "fromName",
           ts."name"           AS "toName",
           MAX(tobs."timestamp") AS "lastAt"
      FROM "TransitionObservation" tobs
      JOIN "Session"    s  ON s."id"  = tobs."sessionId"
      JOIN "Transition" t  ON t."id"  = tobs."transitionId"
      JOIN "State"      fs ON fs."id" = t."fromStateId"
      JOIN "State"      ts ON ts."id" = t."toStateId"
     WHERE s."applicationId" = ${applicationId}
       AND (${environmentId}::text IS NULL OR s."environmentId" = ${environmentId})
       AND (${from}::timestamptz IS NULL OR s."startTime" >= ${from})
       AND (${to}::timestamptz   IS NULL OR s."startTime" <= ${to})
     GROUP BY fs."name", ts."name"
  `;
}

/** Newest observation touching any step of each workflow's path. */
function lastDemonstratedPerWorkflow(
  workflows: Array<{ id: string; path: unknown }>,
  edges: ObservedEdgeRow[],
  nodes: ObservedNodeRow[],
): Map<string, Date> {
  const edgeTimes = new Map<string, Date>();
  for (const edge of edges) edgeTimes.set(transitionKey(edge.fromName, edge.toName), edge.lastAt);
  const nodeTimes = new Map<string, Date>();
  for (const node of nodes) nodeTimes.set(node.name, node.lastAt);

  const result = new Map<string, Date>();
  for (const workflow of workflows) {
    const path = Array.isArray(workflow.path) ? (workflow.path as unknown[]).map(String) : [];
    let newest: Date | null = null;
    for (let i = 0; i < path.length; i += 1) {
      const candidates = [nodeTimes.get(path[i])];
      if (i < path.length - 1) candidates.push(edgeTimes.get(transitionKey(path[i], path[i + 1])));
      for (const candidate of candidates) {
        if (candidate && (!newest || candidate > newest)) newest = candidate;
      }
    }
    if (newest) result.set(workflow.id, newest);
  }
  return result;
}

/**
 * Error and recovery states the active ruleset expects to exist.
 *
 * Same rule groups that drive missing-state detection, so the coverage tile and
 * the findings list are two views of one calculation.
 */
function expectedErrorStates(ruleSet: ApplicationRuleSet | null): string[] {
  if (!ruleSet) return [];
  return ruleSet.missingStates
    .filter((rule) => rule.category === 'ERROR' || rule.category === 'RECOVERY')
    .map((rule) => rule.candidate);
}

interface EndpointEngineRow {
  route?: string;
  endpoint?: string;
  method?: string;
  requestCount?: number;
  avgMs?: number;
  p95Ms?: number;
  errorRate?: number;
}

interface EndpointEngineResponse {
  totalEndpoints: number;
  slowEndpoints: number;
  errorEndpoints: number;
  endpoints: EndpointEngineRow[];
  slowest?: EndpointEngineRow[];
  errorProne?: EndpointEngineRow[];
}

function toObservedEndpoint(row: EndpointEngineRow, index: number): ObservedEndpoint {
  return {
    id: `${row.method ?? 'GET'}-${row.route ?? row.endpoint ?? index}`,
    method: row.method ?? 'GET',
    path: row.route ?? row.endpoint ?? '/',
    p95Ms: Math.round(row.p95Ms ?? 0),
    averageLatencyMs: Math.round(row.avgMs ?? 0),
    callCount: row.requestCount ?? 0,
    errorRatePercentage: Number(((row.errorRate ?? 0) * 100).toFixed(1)),
  };
}

async function fetchEndpointAnalysis(
  baseUrl: string,
  headers: Record<string, string>,
  environmentId: string | null,
  days: number | null,
): Promise<EndpointEngineResponse | null> {
  const url = new URL(baseUrl);
  if (environmentId) url.searchParams.set('environmentId', environmentId);
  if (days) url.searchParams.set('windowDays', String(days));
  try {
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) return null;
    return (await response.json()) as EndpointEngineResponse;
  } catch {
    // Backend telemetry is optional, and a second service being down is not a
    // reason to fail the page.
    return null;
  }
}
