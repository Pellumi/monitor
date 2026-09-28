import { PrismaClient } from '@tellann/db';
import { normalizeIntent } from '@tellann/derivation-engine';
// Pure scoring over the daily rollups, so it lives with them rather than here.
import { declarationPriority, type StateTrafficWeight } from '@tellann/session-core';
import { Services } from '@tellann/shared';
import {
  buildObservedDestinations, classifyAutomatedStateGap, classifyAutomatedTransitionGap,
} from './automated-reconciliation';
import type { AutomatedRunContext } from './automated-reconciliation';

const prisma = new PrismaClient();

export interface ReconciliationReportResult {
  flowId: string;
  confirmedCount: number;
  trueGapCount: number;
  undeclaredCount: number;
  expectedCoverageScore: number;
  trueGaps: any[];
  undeclared: any[];
  confirmedTransitions: number;
  trueGapTransitions: number;
  undeclaredTransitions: number;
  transitionCoverageScore: number;
  trueGapTransitionsList: any[];
  undeclaredTransitionsList: any[];
}

/** How far back the weighting looks. Long enough to be stable, short enough to be current. */
const TRAFFIC_WINDOW_DAYS = 30;

/**
 * Recent traffic per observed state name.
 *
 * `undeclared` entries carried `observationCount` -- State.visitCount, a monotone lifetime
 * total. So a path used once a year ranked alongside one used hourly, and a broken path
 * ranked alongside a healthy one. Reading the daily rollups instead makes "declare this
 * next" a judgement about volume and breakage rather than about mere existence.
 *
 * Returns an empty map when the rollups have not run yet, and every caller falls back to the
 * lifetime count -- degraded ordering rather than no reconciliation.
 */
async function loadStateTraffic(
  applicationId: string,
  environmentId: string | undefined,
): Promise<Map<string, StateTrafficWeight>> {
  const since = new Date(Date.now() - TRAFFIC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const weights = new Map<string, StateTrafficWeight>();

  try {
    const rows = await prisma.$queryRaw<Array<{
      stateName: string;
      weightedVisits: number | null;
      uniqueEndUsers: number | null;
      uniqueSessions: number | null;
      errorCount: number | null;
      lastSeenAt: Date | null;
    }>>`
      SELECT
        st."name" AS "stateName",
        SUM(m."weightedVisits")::double precision AS "weightedVisits",
        MAX(m."uniqueEndUsers")::int AS "uniqueEndUsers",
        SUM(m."uniqueSessions")::int AS "uniqueSessions",
        SUM(m."errorCount")::int AS "errorCount",
        MAX(m."day") AS "lastSeenAt"
      FROM "ObservedStateMetric" m
      JOIN "State" st ON st."id" = m."stateId"
      WHERE m."applicationId" = ${applicationId}
        AND m."day" >= ${since}
        AND (${environmentId ?? null}::text IS NULL OR m."environmentId" = ${environmentId ?? null})
      GROUP BY st."name"
    `;

    for (const row of rows) {
      const sessions = row.uniqueSessions ?? 0;
      weights.set(row.stateName, {
        weightedVisits: row.weightedVisits ?? 0,
        uniqueEndUsers: row.uniqueEndUsers ?? 0,
        errorRate: sessions > 0 ? (row.errorCount ?? 0) / sessions : 0,
        lastSeenAt: row.lastSeenAt,
      });
    }
  } catch (err) {
    // The rollup tables may not exist yet on a database mid-migration. Reconciliation is
    // more important than the ordering of its output.
    console.warn('[FDRS] Could not load state traffic weights; falling back to lifetime counts', err);
  }

  return weights;
}

/**
 * Runs reconciliation for all completed flows of an application.
 */
export async function runReconciliation(applicationId: string, environmentId?: string, expectedGraphId?: string, runId?: string): Promise<ReconciliationReportResult[]> {
  const expectedVersion = expectedGraphId ? await prisma.behaviorGraphVersion.findFirst({
    where: { id: expectedGraphId, graph: { applicationId } },
    select: { id: true, graphId: true, snapshot: true },
  }) : null;
  let targetEnvId = environmentId;
  if (!targetEnvId) {
    const devEnv = await prisma.environment.findFirst({
      where: { applicationId, isDefault: true }
    });
    targetEnvId = devEnv?.id;
  }

  const completedFlowWhere: any = {
    applicationId,
    isActive: true,
    graphType: 'DECLARED',
  };
  if (expectedGraphId) {
    completedFlowWhere.id = expectedVersion?.graphId ?? expectedGraphId;
  } else if (targetEnvId) {
    completedFlowWhere.OR = [
      { environmentId: targetEnvId },
      { environmentId: null },
    ];
  }

  const completedFlows = await prisma.behaviorGraph.findMany({
    where: completedFlowWhere,
    include: {
      nodes: true,
      edges: {
        include: {
          fromNode: true,
          toNode: true,
        },
      },
    },
  });

  const reports: ReconciliationReportResult[] = [];

  // Recent traffic per state, so the undeclared list is ordered by what matters rather than
  // by lifetime existence.
  const stateTraffic = await loadStateTraffic(applicationId, targetEnvId);

  // Find sessions in the target environment
  const sessions = targetEnvId ? await prisma.session.findMany({
    where: { applicationId, environmentId: targetEnvId, ...(runId ? { qaRunId: runId } : {}) },
    select: { id: true }
  }) : [];
  const sessionIds = sessions.map(s => s.id);

  // Load observed graph for target environment
  const observedStates = await prisma.state.findMany({
    where: {
      applicationId,
      observations: {
        some: {
          sessionId: { in: sessionIds }
        }
      }
    },
  });

  const observedTransitions = await prisma.transition.findMany({
    where: {
      applicationId,
      observations: {
        some: {
          sessionId: { in: sessionIds }
        }
      }
    },
    include: {
      fromState: true,
      toState: true,
    },
  });

  // Write ObservedGraphSnapshot
  const observedSnapshotJson = {
    states: observedStates,
    transitions: observedTransitions,
  };

  await prisma.observedGraphSnapshot.create({
    data: {
      applicationId,
      environmentId: targetEnvId || null,
      snapshot: observedSnapshotJson as any,
      stateCount: observedStates.length,
      transitionCount: observedTransitions.length,
    },
  });

  const observedStateNames = new Set(observedStates.map((s) => s.name));

  // Automated Run context: why a gap in *this run's own target* might be explained by the run
  // itself rather than by an unrelated absence of evidence. Null for every other mode, and for an
  // Automated run that simply completed with nothing to explain.
  let automatedContext: AutomatedRunContext | null = null;
  if (runId) {
    const automatedRun = await prisma.qARun.findUnique({ where: { id: runId }, select: { mode: true, automation: true } });
    if (automatedRun?.mode === 'AUTOMATED') {
      const automation = (automatedRun.automation ?? {}) as { stopReason?: unknown; targetTerminalStateKey?: unknown };
      automatedContext = {
        stopReason: typeof automation.stopReason === 'string' ? automation.stopReason as AutomatedRunContext['stopReason'] : null,
        targetTerminalStateKey: typeof automation.targetTerminalStateKey === 'string' ? automation.targetTerminalStateKey : null,
        observedDestinationsByState: buildObservedDestinations(
          observedTransitions.map((t) => ({ fromStateName: t.fromState.name, toStateName: t.toState.name })),
        ),
      };
    }
  }

  // --- Pattern Learning: Scan Observed Transitions & Record Observations ---
  const activePatterns = await prisma.patternLibraryEntry.findMany({ where: { active: true } });
  
  for (const ot of observedTransitions) {
    const fromName = ot.fromState.name;
    const toName = ot.toState.name;
    try {
      const fromCanonical = await normalizeIntent(fromName, applicationId);
      const toCanonical = await normalizeIntent(toName, applicationId);

      const matchingPatterns = activePatterns.filter((p) => {
        const triggers = p.triggerCanonicals.split(',').map((s) => s.trim());
        if (!triggers.includes(fromCanonical)) return false;
        
        return p.suggestedStateName.toUpperCase().replace(/\s+/g, '_') === toName.toUpperCase().replace(/\s+/g, '_') ||
               p.suggestedStateName === toName;
      });

      for (const p of matchingPatterns) {
        await prisma.patternObservation.upsert({
          where: {
            applicationId_patternId_sourceBehavior_targetBehavior: {
              applicationId,
              patternId: p.patternId,
              sourceBehavior: fromCanonical,
              targetBehavior: toCanonical,
            },
          },
          update: {
            occurrences: { increment: ot.frequency },
          },
          create: {
            applicationId,
            patternId: p.patternId,
            sourceBehavior: fromCanonical,
            targetBehavior: toCanonical,
            occurrences: ot.frequency,
          },
        });
      }
    } catch (err: any) {
      console.warn(`[FDRS Reconciliation] Pattern observation error for ${fromName}->${toName}:`, err.message);
    }
  }

  for (const flow of completedFlows) {
    const versionSnapshot = expectedVersion?.graphId === flow.id ? expectedVersion.snapshot as any : null;
    const declaredNodes: any[] = Array.isArray(versionSnapshot?.states) ? versionSnapshot.states : flow.nodes;
    const declaredEdges: any[] = Array.isArray(versionSnapshot?.transitions) ? versionSnapshot.transitions : flow.edges;
    // 1. Delete previous reconciliation evidence for this flow
    await prisma.recommendationEvidence.deleteMany({
      where: {
        workflowId: flow.id,
        source: 'RECONCILIATION',
      },
    });

    const declaredStateNames = new Set(declaredNodes.map((n) => n.stateName));

    // ── State Reconciliation ──────────────────────────────────────────────────
    const confirmedStates: string[] = [];
    const trueGaps: any[] = [];
    const undeclaredStates: any[] = [];

    for (const node of declaredNodes) {
      if (observedStateNames.has(node.stateName)) {
        confirmedStates.push(node.stateName);
      } else {
        // For an Automated run, the run's own stop reason may explain *why* this is missing.
        // Additive on purpose: `evidenceType` stays TRUE_GAP so every existing reader is unaffected.
        const automatedClassification = automatedContext ? classifyAutomatedStateGap(node.stateName, automatedContext) : null;
        trueGaps.push({
          stateName: node.stateName,
          provenance: node.provenance,
          declaredById: node.declaredById,
          ...(automatedClassification ? { automatedClassification } : {}),
        });

        // Write TRUE_GAP State evidence
        await prisma.recommendationEvidence.create({
          data: {
            applicationId,
            workflowId: flow.id,
            evidenceType: 'TRUE_GAP',
            source: 'RECONCILIATION',
            confidence: 1.0,
            payload: {
              type: 'STATE',
              stateName: node.stateName,
              ...(automatedClassification ? { automatedClassification } : {}),
            } as any,
          },
        });
      }
    }

    for (const obs of observedStates) {
      if (!declaredStateNames.has(obs.name)) {
        const weight = stateTraffic.get(obs.name);
        const priority = declarationPriority(weight, obs.visitCount);

        undeclaredStates.push({
          stateName: obs.name,
          // Kept for compatibility with readers that already display it, though it is the
          // lifetime total and therefore the weakest signal here.
          observationCount: obs.visitCount,
          // What actually decides whether this is worth declaring.
          weightedVisits: weight?.weightedVisits ?? null,
          uniqueEndUsers: weight?.uniqueEndUsers ?? null,
          errorRate: weight?.errorRate ?? null,
          lastSeenAt: weight?.lastSeenAt ?? null,
          priority,
          // An inferred node is a suggestion about vocabulary as much as about coverage, and
          // a reader deciding what to declare should know which it is looking at.
          isRouteInduced: obs.category === 'ROUTE',
        });

        // Write UNDECLARED State evidence
        await prisma.recommendationEvidence.create({
          data: {
            applicationId,
            workflowId: flow.id,
            evidenceType: 'UNDECLARED',
            source: 'RECONCILIATION',
            // Confidence now reflects the traffic behind the recommendation rather than
            // being the same 0.8 for everything ever observed once.
            confidence: Math.min(0.99, 0.5 + priority / 10),
            payload: {
              type: 'STATE',
              stateName: obs.name,
              observationCount: obs.visitCount,
              weightedVisits: weight?.weightedVisits ?? null,
              errorRate: weight?.errorRate ?? null,
              priority,
              isRouteInduced: obs.category === 'ROUTE',
            } as any,
          },
        });
      }
    }

    // Most important first, so a reader working down the list is working down by impact.
    undeclaredStates.sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0));

    const confirmedCount = confirmedStates.length;
    const trueGapCount = trueGaps.length;
    const undeclaredCount = undeclaredStates.length;
    const stateDenominator = confirmedCount + trueGapCount;
    const expectedCoverageScore = stateDenominator === 0 ? 1.0 : confirmedCount / stateDenominator;

    // ── Transition Reconciliation ─────────────────────────────────────────────
    let confirmedTrans = 0;
    const trueGapTransitionsList: any[] = [];
    const undeclaredTransitionsList: any[] = [];

    // Map observed transitions to simple strings for quick lookup
    const observedTransSet = new Set(
      observedTransitions.map((t) => `${t.fromState.name}->${t.toState.name}`)
    );

    // Declared transitions reconciliation
    for (const dt of declaredEdges) {
      const fromNode = dt.fromNode ?? declaredNodes.find((node) => node.id === (dt.fromNodeId ?? dt.fromStateId));
      const toNode = dt.toNode ?? declaredNodes.find((node) => node.id === (dt.toNodeId ?? dt.toStateId));
      if (!fromNode || !toNode) continue;
      const key = `${fromNode.stateName}->${toNode.stateName}`;
      if (observedTransSet.has(key)) {
        confirmedTrans++;
      } else {
        const automatedTransitionClassification = automatedContext
          ? classifyAutomatedTransitionGap(fromNode.stateName, toNode.stateName, automatedContext)
          : null;
        trueGapTransitionsList.push({
          fromStateId: dt.fromNodeId,
          toStateId: dt.toNodeId,
          fromStateName: fromNode.stateName,
          toStateName: toNode.stateName,
          action: dt.action ?? null,
          ...(automatedTransitionClassification ? { automatedClassification: automatedTransitionClassification } : {}),
        });

        // Write TRUE_GAP Transition evidence
        await prisma.recommendationEvidence.create({
          data: {
            applicationId,
            workflowId: flow.id,
            evidenceType: 'TRUE_GAP',
            source: 'RECONCILIATION',
            confidence: 1.0,
            payload: {
              type: 'TRANSITION',
              fromStateName: fromNode.stateName,
              toStateName: toNode.stateName,
              action: dt.action ?? null,
              ...(automatedTransitionClassification ? { automatedClassification: automatedTransitionClassification } : {}),
            } as any,
          },
        });
      }
    }

    // Map declared transitions to simple strings for quick lookup
    const declaredTransSet = new Set(
      declaredEdges.flatMap((transition) => {
        const fromNode = transition.fromNode ?? declaredNodes.find((node) => node.id === (transition.fromNodeId ?? transition.fromStateId));
        const toNode = transition.toNode ?? declaredNodes.find((node) => node.id === (transition.toNodeId ?? transition.toStateId));
        return fromNode && toNode ? [`${fromNode.stateName}->${toNode.stateName}`] : [];
      })
    );

    // Observed transitions reconciliation
    for (const ot of observedTransitions) {
      const fromName = ot.fromState.name;
      const toName = ot.toState.name;
      const key = `${fromName}->${toName}`;

      // Transition is undeclared if both endpoints are declared but the edge is not
      if (declaredStateNames.has(fromName) && declaredStateNames.has(toName)) {
        if (!declaredTransSet.has(key)) {
          undeclaredTransitionsList.push({
            fromStateName: fromName,
            toStateName: toName,
            observationCount: ot.frequency,
          });

          // Write UNDECLARED Transition evidence
          await prisma.recommendationEvidence.create({
            data: {
              applicationId,
              workflowId: flow.id,
              evidenceType: 'UNDECLARED',
              source: 'RECONCILIATION',
              confidence: 0.8,
              payload: {
                type: 'TRANSITION',
                fromStateName: fromName,
                toStateName: toName,
                observationCount: ot.frequency,
              } as any,
            },
          });
        }
      }
    }

    const confirmedTransitions = confirmedTrans;
    const trueGapTransitions = trueGapTransitionsList.length;
    const undeclaredTransitions = undeclaredTransitionsList.length;
    const transDenominator = confirmedTransitions + trueGapTransitions;
    const transitionCoverageScore = transDenominator === 0 ? 1.0 : confirmedTransitions / transDenominator;

    // ── Upsert Reconciliation Report ──────────────────────────────────────────
    const reportData = {
      flowId: flow.id,
      applicationId,
      environmentId: targetEnvId || null,
      flowVersionId: expectedVersion?.id ?? null,
      qaRunId: runId ?? null,
      confirmedCount,
      trueGapCount,
      undeclaredCount,
      expectedCoverageScore,
      trueGaps: trueGaps as any,
      undeclared: undeclaredStates as any,
      confirmedTransitions,
      trueGapTransitions,
      undeclaredTransitions,
      transitionCoverageScore,
      trueGapTransitionsList: trueGapTransitionsList as any,
      undeclaredTransitionsList: undeclaredTransitionsList as any,
      generatedAt: new Date(),
    };

    await prisma.reconciliationReport.create({ data: reportData });

    // Trigger value realization check webhook asynchronously (fire-and-forget)
    fetch(`http://localhost:${Services.ONBOARDING_API}/internal/applications/${applicationId}/reconcile-value`, {
      method: 'POST'
    }).catch((err) => {
      console.error('[FDRS Reconciliation] Failed to trigger value realization check:', err.message);
    });

    // ── Behavior Graph Baseline ───────────────────────────────────────────────
    try {
      const snapshotJson = {
        states: declaredNodes,
        transitions: declaredEdges,
      };

      await prisma.behaviorGraphVersion.upsert({
        where: {
          graphId_version: {
            graphId: flow.id,
            version: flow.version,
          },
        },
        update: {
          isBaseline: true,
          expectedStateCount: declaredNodes.length,
          expectedTransitionCount: declaredEdges.length,
          expectedCoverage: expectedCoverageScore,
          expectedTransitionCoverage: transitionCoverageScore,
        },
        create: {
          graphId: flow.id,
          version: flow.version,
          snapshot: snapshotJson as any,
          isBaseline: true,
          expectedStateCount: declaredNodes.length,
          expectedTransitionCount: declaredEdges.length,
          expectedCoverage: expectedCoverageScore,
          expectedTransitionCoverage: transitionCoverageScore,
        },
      });
    } catch (baselineErr: any) {
      console.warn(`[FDRS Reconciliation] Failed to write baseline for version ${flow.version} of graph ${flow.id}:`, baselineErr.message);
    }

    reports.push(reportData);
  }

  return reports;
}
