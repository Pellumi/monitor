import express, { Request, Response } from 'express';
import { PrismaClient, FlowStatus, StateCategory, StateProvenance, GraphType, GraphSourceType } from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';
import { Feature, Services } from '@sots/shared';
import { normalizeIntent, getSuggestions } from '@sots/derivation-engine';
import { compileFlowRuleset } from './compiler';
import { runReconciliation } from './reconciliation';
import { reconstructRuleSet } from '@sots/rules';

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
    const flow = await prisma.behaviorGraph.create({
      data: {
        applicationId,
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
        category: category.toUpperCase().trim() as StateCategory,
        provenance: provenance.toUpperCase().trim() as StateProvenance,
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
        provenance: provenance.toUpperCase().trim() as StateProvenance,
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

    // Update Suggestion status
    const updatedSuggestion = await prisma.declaredStateSuggestion.update({
      where: { id: sid },
      data: { status: 'ACCEPTED' },
    });

    // Write SuggestionOutcome
    await prisma.suggestionOutcome.create({
      data: {
        suggestionId: sid,
        patternId: suggestion.patternId || 'unknown_pattern',
        applicationId,
        outcome: 'ACCEPTED',
      },
    });

    // Add node automatically
    const canonicalBehavior = await normalizeIntent(suggestion.suggestedStateName, applicationId);
    const newNode = await prisma.behaviorGraphNode.create({
      data: {
        graphId: flowId,
        stateName: suggestion.suggestedStateName,
        behaviorKey: canonicalBehavior,
        category: suggestion.category as StateCategory,
        provenance: StateProvenance.SUGGESTED_ACCEPTED,
        canonicalBehavior,
      },
    });

    // Also trigger suggestions for this new node
    const suggestionsList = await getSuggestions(suggestion.suggestedStateName, applicationId);
    const newSuggestions = [];
    for (const sug of suggestionsList) {
      const dbSug = await prisma.declaredStateSuggestion.create({
        data: {
          parentStateId: newNode.id,
          suggestedStateName: sug.suggestedStateName,
          category: sug.category,
          sourceTier: sug.sourceTier,
          rationale: sug.rationale,
          confidence: sug.confidence,
          patternId: sug.patternId,
        },
      });
      newSuggestions.push(dbSug);
    }

    res.json({
      suggestion: updatedSuggestion,
      state: newNode,
      suggestions: newSuggestions,
    });
  } catch (err) {
    console.error('[FDRS] Accept suggestion error:', err);
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
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Update Suggestion status
    const updatedSuggestion = await prisma.declaredStateSuggestion.update({
      where: { id: sid },
      data: { status: 'REJECTED' },
    });

    // Write SuggestionOutcome
    await prisma.suggestionOutcome.create({
      data: {
        suggestionId: sid,
        patternId: suggestion.patternId || 'unknown_pattern',
        applicationId,
        outcome: 'REJECTED',
        rejectionReason: rejectionReason || null,
      },
    });

    res.json({ suggestion: updatedSuggestion });
  } catch (err) {
    console.error('[FDRS] Reject suggestion error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
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

  try {
    const reports = await runReconciliation(applicationId, environmentId);
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
// Start Server
// ─────────────────────────────────────────────────────────────
const PORT = Services.FDRS_API;

app.listen(PORT, () => {
  console.log(`[FDRSAPI] Running on port ${PORT}`);
});
