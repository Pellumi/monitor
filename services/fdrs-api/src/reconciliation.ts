import { PrismaClient } from '@sots/db';
import { normalizeIntent } from '@sots/derivation-engine';
import { Services } from '@sots/shared';

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
        trueGaps.push({
          stateName: node.stateName,
          provenance: node.provenance,
          declaredById: node.declaredById,
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
            } as any,
          },
        });
      }
    }

    for (const obs of observedStates) {
      if (!declaredStateNames.has(obs.name)) {
        undeclaredStates.push({
          stateName: obs.name,
          observationCount: obs.visitCount,
        });

        // Write UNDECLARED State evidence
        await prisma.recommendationEvidence.create({
          data: {
            applicationId,
            workflowId: flow.id,
            evidenceType: 'UNDECLARED',
            source: 'RECONCILIATION',
            confidence: 0.8,
            payload: {
              type: 'STATE',
              stateName: obs.name,
              observationCount: obs.visitCount,
            } as any,
          },
        });
      }
    }

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
        trueGapTransitionsList.push({
          fromStateId: dt.fromNodeId,
          toStateId: dt.toNodeId,
          fromStateName: fromNode.stateName,
          toStateName: toNode.stateName,
          action: dt.action ?? null,
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
