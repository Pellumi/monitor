import { initTracing } from '@sots/telemetry';
initTracing('coverage-engine');

import express, { Request, Response } from 'express';
import { MemberRole, PrismaClient } from '@sots/db';
import { getRuleSet, reconstructRuleSet, ApplicationRuleSet } from '@sots/rules';
import { NotificationEmailService, appUrl, buildIdempotencyKey } from '@sots/email';
import { EntitlementChecker } from '@sots/entitlement-checker';
import { Feature } from '@sots/shared';

const app = express();
const prisma = new PrismaClient();
const emailService = new NotificationEmailService(prisma);
const entitlementChecker = new EntitlementChecker(prisma);
app.use(express.json());

// Helper: Calculate Observed Flows using DFS
function countObservedFlows(transitions: any[]): number {
  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const nodes = new Set<string>();

  for (const t of transitions) {
    if (!adjList.has(t.fromState.name)) adjList.set(t.fromState.name, []);
    adjList.get(t.fromState.name)!.push(t.toState.name);
    
    inDegree.set(t.toState.name, (inDegree.get(t.toState.name) || 0) + 1);
    if (!inDegree.has(t.fromState.name)) inDegree.set(t.fromState.name, 0);
    
    nodes.add(t.fromState.name);
    nodes.add(t.toState.name);
  }

  // Find start nodes (inDegree === 0)
  const startNodes = Array.from(nodes).filter(n => inDegree.get(n) === 0);
  // If graph has cycles and no strict start, fallback to HOME or any node
  if (startNodes.length === 0) {
    if (nodes.has('HOME')) startNodes.push('HOME');
    else if (nodes.has('ANONYMOUS_HOME')) startNodes.push('ANONYMOUS_HOME');
    else if (nodes.size > 0) startNodes.push(Array.from(nodes)[0]);
  }

  let pathsCount = 0;

  function dfs(node: string, visited: Set<string>) {
    const neighbors = adjList.get(node) || [];
    if (neighbors.length === 0) {
      pathsCount++;
      return;
    }

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        dfs(neighbor, visited);
        visited.delete(neighbor);
      } else {
        // Cycle detected, count as a path endpoint for simplicity
        pathsCount++;
      }
    }
  }

  for (const start of startNodes) {
    dfs(start, new Set([start]));
  }

  return Math.max(pathsCount, 0);
}

app.post('/coverage/generate', async (req: Request, res: Response) => {
  const { applicationId, environmentId } = req.body;
  if (!applicationId) {
    return res.status(400).json({ error: 'applicationId is required' });
  }

  try {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, name: true, organizationId: true },
    });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // ── Entitlement gate: COVERAGE_ANALYSIS ──────────────────────
    if (application.organizationId) {
      let allowed = true;
      try {
        allowed = await entitlementChecker.canAccess(application.organizationId, Feature.COVERAGE_ANALYSIS);
      } catch (err) {
        console.error('[CoverageEngine] Entitlement check failed — defaulting to allow', err);
      }
      if (!allowed) {
        return res.status(403).json({
          error: 'FEATURE_NOT_ENTITLED',
          feature: Feature.COVERAGE_ANALYSIS,
          message: 'Your current plan does not include Coverage Analysis. Please upgrade to continue.',
        });
      }
    }


    const profile = await prisma.applicationProfile.findUnique({ where: { applicationId } });

    // Check if CompiledRuleset exists for this application
    const latestRuleset = await prisma.compiledRuleset.findFirst({
      where: { applicationId },
      orderBy: { compiledAt: 'desc' }
    });

    let ruleSet: ApplicationRuleSet | null = null;
    if (latestRuleset) {
      ruleSet = reconstructRuleSet(latestRuleset.rules as any[], profile?.profileType || 'ECOMMERCE');
    } else {
      ruleSet = getRuleSet(profile?.profileType || 'ECOMMERCE');
    }

    // Resolve environmentId
    let targetEnvId = environmentId;
    if (!targetEnvId) {
      const devEnv = await prisma.environment.findFirst({
        where: { applicationId, isDefault: true }
      });
      targetEnvId = devEnv?.id;
    }

    // Find sessions in the target environment
    const sessions = targetEnvId ? await prisma.session.findMany({
      where: { applicationId, environmentId: targetEnvId },
      select: { id: true }
    }) : [];
    const sessionIds = sessions.map(s => s.id);

    // 1. Load Graph (Observed States for this environment)
    const observedStates = await prisma.state.findMany({
      where: {
        applicationId,
        observations: {
          some: {
            sessionId: { in: sessionIds }
          }
        }
      }
    });
    
    const observedStateNames = new Set(observedStates.map(s => s.name));
    const newMissingStates = [];
    const newMissingFlows = [];
    
    if (ruleSet) {
      // 2a. Generate Missing States
      for (const state of observedStates) {
        const missingRules = ruleSet.missingStates.filter(r => r.trigger === state.name);
        
        for (const rule of missingRules) {
          if (!observedStateNames.has(rule.candidate)) {
            let missingStateRec = await prisma.missingState.findFirst({
              where: { applicationId, stateName: rule.candidate, sourceState: state.name }
            });
            
            if (!missingStateRec) {
              missingStateRec = await prisma.missingState.create({
                data: {
                  applicationId,
                  stateName: rule.candidate,
                  sourceState: state.name,
                  ruleName: "Missing State Inference",
                  severity: "HIGH",
                  confidence: rule.confidence,
                  reason: rule.reason
                }
              });
              newMissingStates.push(missingStateRec);
            }

            // Add to Candidate States (auto-approved for MVP)
            const existingCandidate = await prisma.candidateState.findFirst({
              where: { applicationId, stateName: rule.candidate }
            });

            if (!existingCandidate) {
              await prisma.candidateState.create({
                data: {
                  applicationId,
                  stateName: rule.candidate,
                  reason: rule.reason,
                  approved: true
                }
              });
            }
          }
        }
      }

      // Helper for pattern matching
      const matchPattern = (workflowPath: string[], pattern: string[]) => {
        if (pattern[0] === '$prefix') {
          const suffixPattern = pattern.slice(1);
          if (workflowPath.length < suffixPattern.length) return { isMatch: false, captures: {} };
          
          const tail = workflowPath.slice(workflowPath.length - suffixPattern.length);
          for (let i = 0; i < suffixPattern.length; i++) {
            if (tail[i] !== suffixPattern[i]) return { isMatch: false, captures: {} };
          }
          const prefix = workflowPath.slice(0, workflowPath.length - suffixPattern.length);
          return { isMatch: true, captures: { '$prefix': prefix } };
        }
        
        if (workflowPath.length !== pattern.length) return { isMatch: false, captures: {} };
        for (let i = 0; i < pattern.length; i++) {
          if (workflowPath[i] !== pattern[i]) return { isMatch: false, captures: {} };
        }
        return { isMatch: true, captures: {} };
      };

      // 2b. Generate Missing Flows via Patterns
      const allWorkflows = await prisma.workflow.findMany({ where: { applicationId } });

      for (const flowRule of ruleSet.missingFlows) {
        for (const existingWorkflow of allWorkflows) {
          const workflowPath = existingWorkflow.path as string[];
          const { isMatch } = matchPattern(workflowPath, flowRule.pattern);
          
          if (isMatch) {
            const suggestedFlow = workflowPath.map(s => 
              s === flowRule.transformation.replace.from ? flowRule.transformation.replace.to : s
            );

            const existingVariation = await prisma.workflow.findFirst({
              where: { applicationId, path: { equals: suggestedFlow } }
            });

            if (!existingVariation) {
              const existingMissingFlow = await prisma.missingFlow.findFirst({
                where: { applicationId, reason: flowRule.reason, sourceFlow: { equals: workflowPath } }
              });

              if (!existingMissingFlow) {
                const flow = await prisma.missingFlow.create({
                  data: {
                    applicationId,
                    sourceFlow: workflowPath,
                    suggestedFlow: suggestedFlow,
                    reason: flowRule.reason,
                    severity: "HIGH",
                    confidence: flowRule.confidence
                  }
                });
                newMissingFlows.push(flow);
              }
            }
          }
        }
      }
    }

    // 3. Load DB Aggregates
    const totalCandidates = await prisma.candidateState.count({ where: { applicationId } });
    const totalApproved = await prisma.candidateState.count({ where: { applicationId, approved: true } });
    const allMissingFlows = await prisma.missingFlow.findMany({ where: { applicationId } });
    
    const observedTransitions = await prisma.transition.findMany({
      where: {
        applicationId,
        observations: {
          some: {
            sessionId: { in: sessionIds }
          }
        }
      },
      include: { fromState: true, toState: true }
    });

    // 4. Calculate Coverage Dimensions
    const observedCount = observedStates.length;
    const stateDenominator = observedCount + totalCandidates;
    const stateCoveragePercent = stateDenominator === 0 ? 0 : (observedCount / stateDenominator) * 100;

    const observedTransCount = observedTransitions.length;
    const missingTransCount = allMissingFlows.length; // 1 missing trans per flow
    const transDenominator = observedTransCount + missingTransCount;
    let transitionCoveragePercent = transDenominator === 0 ? 0 : (observedTransCount / transDenominator) * 100;
    
    // FDRS: Overwrite transitionCoverage with the score from the latest ReconciliationReport (Phase F)
    const latestReport = await prisma.reconciliationReport.findFirst({
      where: { applicationId, environmentId: targetEnvId || undefined },
      orderBy: { generatedAt: 'desc' }
    });
    if (latestReport) {
      transitionCoveragePercent = latestReport.transitionCoverageScore * 100;
    }

    const observedFlowCount = countObservedFlows(observedTransitions);
    const missingFlowCount = allMissingFlows.length;
    const flowDenominator = observedFlowCount + missingFlowCount;
    const flowCoveragePercent = flowDenominator === 0 ? 0 : (observedFlowCount / flowDenominator) * 100;

    const previousSnapshot = await prisma.coverageSnapshot.findFirst({
      where: { applicationId, environmentId: targetEnvId || undefined },
      orderBy: { createdAt: 'desc' },
    });

    // 5. Store Snapshot
    const snapshot = await prisma.coverageSnapshot.create({
      data: {
        applicationId,
        environmentId: targetEnvId || null,
        observedStates: observedCount,
        candidateStates: totalCandidates,
        approvedStates: totalApproved,
        coveragePercent: stateCoveragePercent,
        transitionCoverage: transitionCoveragePercent,
        flowCoverage: flowCoveragePercent
      }
    });

    // 6. Return Formatting
    const report = {
      title: "Coverage Report",
      metrics: {
        stateCoverage: `${stateCoveragePercent.toFixed(1)}%`,
        transitionCoverage: `${transitionCoveragePercent.toFixed(1)}%`,
        flowCoverage: `${flowCoveragePercent.toFixed(1)}%`,
        observedStates: observedCount,
        candidateStates: totalCandidates,
        missingFlows: missingFlowCount
      },
      observed: observedStates.map(s => s.name),
      missing: await prisma.missingState.findMany({
        where: { applicationId },
        select: { stateName: true }
      }).then(ms => ms.map(m => m.stateName)),
      transitions: {
        observedCount: observedTransCount,
        edges: observedTransitions.map(t => `${t.fromState.name} -> ${t.toState.name}`)
      },
      missingFlows: allMissingFlows.map(mf => (mf.suggestedFlow as string[]).join(' -> ')),
      snapshotId: snapshot.id
    };

    if (application.organizationId) {
      const dashboardUrl = appUrl(`/reports?applicationId=${applicationId}`);
      if (previousSnapshot && previousSnapshot.coveragePercent - stateCoveragePercent >= 10) {
        void emailService.sendToOrganizationMembers({
          templateKey: 'coverage-degraded',
          organizationId: application.organizationId,
          applicationId,
          eventType: 'COVERAGE_DEGRADED',
          severity: stateCoveragePercent < 50 ? 'HIGH' : 'MEDIUM',
          variables: {
            applicationName: application.name,
            previousCoverageScore: previousSnapshot.coveragePercent.toFixed(1),
            coverageScore: stateCoveragePercent.toFixed(1),
            dashboardUrl,
          },
          idempotencyKey: buildIdempotencyKey(['coverage-degraded', snapshot.id]),
          roles: [MemberRole.OWNER, MemberRole.ADMIN],
        }).catch((err) => console.error('[Email] coverage-degraded failed', err));
      }

      if (newMissingFlows.length > 0) {
        void emailService.sendToOrganizationMembers({
          templateKey: 'missing-critical-flow',
          organizationId: application.organizationId,
          applicationId,
          eventType: 'MISSING_CRITICAL_FLOW',
          severity: 'HIGH',
          variables: {
            applicationName: application.name,
            missingFlowCount: newMissingFlows.length,
            dashboardUrl: appUrl(`/missing-flows?applicationId=${applicationId}`),
          },
          idempotencyKey: buildIdempotencyKey(['missing-critical-flow', snapshot.id]),
          roles: [MemberRole.OWNER, MemberRole.ADMIN],
        }).catch((err) => console.error('[Email] missing-critical-flow failed', err));
      }
    }

    res.status(200).json(report);

  } catch (error) {
    console.error('Error generating coverage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

void emailService.syncBuiltinTemplates().catch((err) => console.error('[Email] Template sync failed', err));

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`Coverage Engine running on port ${PORT}`);
});
