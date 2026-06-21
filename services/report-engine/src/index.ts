import express, { Request, Response } from 'express';
import { PrismaClient } from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';
import { Feature, FeatureTier, Services } from '@sots/shared';
import { getRuleSet } from '@sots/rules';
import { NotificationEmailService, appUrl, buildIdempotencyKey } from '@sots/email';
import PDFDocument from 'pdfkit';
const app = express();
const prisma = new PrismaClient();
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

// 1. Generate Report
async function ensureFeatureAccess(
  applicationId: string,
  feature: Feature,
  res: Response
): Promise<{ allowed: true; organizationId: string | null } | { allowed: false }> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { organizationId: true },
  });
  if (!application) {
    res.status(404).json({ error: 'Application not found' });
    return { allowed: false };
  }
  if (!application.organizationId) return { allowed: true, organizationId: null };

  const allowed = await entitlementChecker.canAccess(application.organizationId, feature);
  if (!allowed) {
    res.status(403).json({
      error: 'FEATURE_NOT_ENTITLED',
      feature,
      message: 'Your current plan does not include this feature.',
    });
    return { allowed: false };
  }

  return { allowed: true, organizationId: application.organizationId };
}

async function ensureExportAccess(
  applicationId: string,
  format: string,
  res: Response
): Promise<boolean> {
  const access = await ensureFeatureAccess(applicationId, Feature.REPORT_EXPORT, res);
  if (!access.allowed) return false;
  if (!access.organizationId) return true;

  const entitlement = await entitlementChecker.getEntitlement(access.organizationId);
  const tier = entitlement.features[Feature.REPORT_EXPORT];
  const normalized = format.toLowerCase();
  const allowedFormats = tier === FeatureTier.ALL_FORMATS
    ? ['json', 'pdf', 'csv', 'html']
    : tier === FeatureTier.JSON_PDF
      ? ['json', 'pdf']
      : ['json'];

  if (!allowedFormats.includes(normalized)) {
    res.status(403).json({
      error: 'EXPORT_FORMAT_NOT_ENTITLED',
      feature: Feature.REPORT_EXPORT,
      tier,
      allowedFormats,
    });
    return false;
  }

  return true;
}

app.get('/reports/:applicationId/latest', async (req: Request, res: Response) => {
  const { applicationId } = req.params;
  const environmentId = req.query.environmentId as string | undefined;

  try {
    const access = await ensureFeatureAccess(applicationId, Feature.REPORT_GENERATION, res);
    if (!access.allowed) return;

    const application = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    let targetEnvId = environmentId;
    if (!targetEnvId) {
      const devEnv = await prisma.environment.findFirst({
        where: { applicationId, isDefault: true }
      });
      targetEnvId = devEnv?.id;
    }

    const workflowCount = await prisma.workflow.count({ where: { applicationId } });
    const sessionCount = await prisma.session.count({
      where: { 
        applicationId,
        environmentId: targetEnvId || undefined
      }
    });

    const latestSnapshot = await prisma.coverageSnapshot.findFirst({
      where: { 
        applicationId,
        environmentId: targetEnvId || undefined
      },
      orderBy: { createdAt: 'desc' }
    });

    const reconciliationReports = await prisma.reconciliationReport.findMany({
      where: {
        applicationId,
        environmentId: targetEnvId || undefined
      },
      orderBy: { generatedAt: 'desc' }
    });
    const expectedCoverageScore = reconciliationReports.length === 0
      ? null
      : reconciliationReports.reduce((sum, report) => sum + report.expectedCoverageScore, 0) / reconciliationReports.length;

    const workflows = await prisma.workflow.findMany({
      where: { applicationId },
      orderBy: { executionCount: 'desc' },
      take: 10
    });

    const missingStates = await prisma.missingState.findMany({
      where: { applicationId }
    });

    const missingFlows = await prisma.missingFlow.findMany({
      where: { applicationId }
    });

    const report = {
      application: application.name,
      summary: {
        workflowCount,
        sessionCount
      },
      coverage: {
        stateCoverage: latestSnapshot ? latestSnapshot.coveragePercent : 0,
        transitionCoverage: latestSnapshot ? latestSnapshot.transitionCoverage : 0,
        flowCoverage: latestSnapshot ? latestSnapshot.flowCoverage : 0,
        expectedCoverage: expectedCoverageScore === null ? null : expectedCoverageScore * 100
      },
      workflows: workflows.map(w => ({
        name: w.name,
        path: w.path,
        executionCount: w.executionCount
      })),
      missingStates: missingStates.map(m => ({
        stateName: m.stateName,
        confidence: m.confidence,
        reason: m.reason
      })),
      missingFlows: missingFlows.map(m => ({
        path: m.suggestedFlow as string[],
        confidence: m.confidence,
        reason: m.reason
      })),
      generatedAt: new Date().toISOString()
    };

    res.json(report);
  } catch (error) {
    console.error('[ReportEngine] Error generating report', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Behavioral Graph Export
app.get('/applications/:id/graph', async (req: Request, res: Response) => {
  const { id: applicationId } = req.params;

  try {
    const states = await prisma.state.findMany({ where: { applicationId } });
    const transitions = await prisma.transition.findMany({ where: { applicationId } });
    const workflows = await prisma.workflow.findMany({ where: { applicationId } });

    res.json({
      states: states.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        visitCount: s.visitCount
      })),
      transitions: transitions.map(t => ({
        id: t.id,
        fromStateId: t.fromStateId,
        toStateId: t.toStateId,
        action: t.action,
        frequency: t.frequency
      })),
      workflows: workflows.map(w => ({
        id: w.id,
        name: w.name,
        path: w.path,
        executionCount: w.executionCount
      }))
    });
  } catch (error) {
    console.error('[ReportEngine] Error fetching graph', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Workflows List API
app.get('/applications/:id/workflows', async (req: Request, res: Response) => {
  const { id: applicationId } = req.params;
  try {
    const workflows = await prisma.workflow.findMany({ 
      where: { applicationId },
      orderBy: { executionCount: 'desc' }
    });
    
    res.json(workflows.map(w => ({
      id: w.id,
      name: w.name,
      path: w.path,
      executionCount: w.executionCount
    })));
  } catch (error) {
    console.error('[ReportEngine] Error fetching workflows', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Session List
app.get('/applications/:id/sessions', async (req: Request, res: Response) => {
  const { id: applicationId } = req.params;
  const page  = Math.max(1, parseInt(req.query.page  as string ?? '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit as string ?? '20', 10));
  const from  = req.query.from as string | undefined;
  const to    = req.query.to   as string | undefined;

  try {
    const where: any = { applicationId };
    if (from || to) {
      where.startTime = {};
      if (from) where.startTime.gte = new Date(from);
      if (to)   where.startTime.lte = new Date(to);
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: { statistics: true },
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.session.count({ where }),
    ]);

    res.json({
      sessions: sessions.map((s) => ({
        id:          s.id,
        startTime:   s.startTime,
        endTime:     s.endTime,
        durationMs:  s.statistics?.durationMs ?? null,
        eventCount:  s.statistics?.eventCount ?? null,
        errorCount:  s.statistics?.errorCount ?? null,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error('[ReportEngine] Error listing sessions', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Session Replay Timeline
app.get('/sessions/:sessionId/replay', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        events:     { orderBy: { timestamp: 'asc' } },
        statistics: true,
      },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    const replayAccess = await ensureFeatureAccess(session.applicationId, Feature.SESSION_REPLAY, res);
    if (!replayAccess.allowed) return;

    const startMs = session.startTime.getTime();
    const durationMs = session.endTime.getTime() - startMs;

    // Reconstruct workflow path using the application rule set
    let workflowPath: string[] = [];
    try {
      const profile = await prisma.applicationProfile.findUnique({
        where: { applicationId: session.applicationId },
      });
      const ruleSet = getRuleSet(profile?.profileType ?? 'ECOMMERCE');

      if (ruleSet) {
        for (const event of session.events) {
          const sotsEvent = {
            eventId:       event.id,
            sessionId:     event.sessionId,
            tenantId:      session.tenantId,
            applicationId: session.applicationId,
            source:        event.source,
            eventVersion:  event.eventVersion,
            eventType:     event.eventType as any,
            timestamp:     event.timestamp.toISOString(),
            metadata:      event.metadata as Record<string, any>,
          };

          // Simple state extraction: check each extractor type
          for (const rule of ruleSet.stateExtractors) {
            let matched = false;
            if (rule.type === 'exactRoute' && sotsEvent.eventType === 'PAGE_VIEW') {
              const url = (sotsEvent.metadata.url as string) ?? '';
              if (url.includes(rule.route)) {
                const last = workflowPath[workflowPath.length - 1];
                if (last !== rule.state) workflowPath.push(rule.state);
                matched = true;
              }
            } else if (rule.type === 'event' && sotsEvent.eventType === 'BUSINESS_EVENT') {
              if (sotsEvent.metadata.businessEventType === rule.eventType) {
                const last = workflowPath[workflowPath.length - 1];
                if (last !== rule.state) workflowPath.push(rule.state);
                matched = true;
              }
            }
            if (matched) break;
          }
        }
      }
    } catch {
      // Workflow path is best-effort — don't fail the request
    }

    const timeline = session.events.map((e) => ({
      offset:    e.timestamp.getTime() - startMs,
      eventType: e.eventType,
      metadata:  e.metadata,
      timestamp: e.timestamp,
    }));

    const apiCalls = timeline
      .filter((e) => e.eventType === 'API_REQUEST')
      .map((e) => ({
        endpoint:   (e.metadata as any).endpoint,
        method:     (e.metadata as any).method,
        statusCode: (e.metadata as any).statusCode,
        durationMs: (e.metadata as any).durationMs,
        offset:     e.offset,
      }));

    const errors = timeline
      .filter((e) => e.eventType === 'ERROR_EVENT')
      .map((e) => ({
        message: (e.metadata as any).message,
        stack:   (e.metadata as any).stack,
        offset:  e.offset,
      }));

    res.json({
      sessionId,
      applicationId: session.applicationId,
      startTime:     session.startTime,
      endTime:       session.endTime,
      durationMs,
      eventCount:    session.events.length,
      workflowPath,
      timeline,
      apiCalls,
      errors,
    });
  } catch (err) {
    console.error('[ReportEngine] Error fetching session replay', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Endpoint Intelligence proxy
app.get('/reports/:applicationId/endpoint-intelligence', async (req: Request, res: Response) => {
  const { applicationId } = req.params;
  try {
    const upstream = await fetch(
      `http://localhost:${Services.ENDPOINT_ENGINE}/endpoints/${applicationId}/analysis`
    );
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Endpoint Engine unavailable' });
    }
    const data = await upstream.json();
    res.json(data);
  } catch {
    res.status(503).json({ error: 'Endpoint Engine unavailable' });
  }
});

// 7. Report Export (HTML/JSON/CSV/PDF)
app.get('/reports/:applicationId/export', async (req: Request, res: Response) => {
  const { applicationId } = req.params;
  const format = (req.query.format as string ?? 'json').toLowerCase();
  const environmentId = req.query.environmentId as string | undefined;

  try {
    if (!(await ensureExportAccess(applicationId, format, res))) return;

    // 1. Gather all data
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { organization: true },
    });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    let targetEnvId = environmentId;
    if (!targetEnvId) {
      const devEnv = await prisma.environment.findFirst({
        where: { applicationId, isDefault: true }
      });
      targetEnvId = devEnv?.id;
    }

    const workflowCount = await prisma.workflow.count({ where: { applicationId } });
    const sessionCount = await prisma.session.count({
      where: { 
        applicationId,
        environmentId: targetEnvId || undefined
      }
    });

    const latestSnapshot = await prisma.coverageSnapshot.findFirst({
      where: { 
        applicationId,
        environmentId: targetEnvId || undefined
      },
      orderBy: { createdAt: 'desc' }
    });

    const reconciliationReports = await prisma.reconciliationReport.findMany({
      where: {
        applicationId,
        environmentId: targetEnvId || undefined
      },
      orderBy: { generatedAt: 'desc' }
    });
    const expectedCoverageScore = reconciliationReports.length === 0
      ? null
      : reconciliationReports.reduce((sum, report) => sum + report.expectedCoverageScore, 0) / reconciliationReports.length;

    const workflows = await prisma.workflow.findMany({
      where: { applicationId },
      orderBy: { executionCount: 'desc' },
    });

    const missingStates = await prisma.missingState.findMany({
      where: { applicationId }
    });

    const missingFlows = await prisma.missingFlow.findMany({
      where: { applicationId }
    });

    // Fetch clickhouse endpoint metrics from endpoint-engine
    let endpoints: any[] = [];
    try {
      const upstream = await fetch(
        `http://localhost:${Services.ENDPOINT_ENGINE}/endpoints/${applicationId}/analysis`
      );
      if (upstream.ok) {
        const payload = await upstream.json();
        endpoints = payload.endpoints || [];
      }
    } catch {
      // Offline fallback
    }

    const reportData = {
      appName: application.name,
      orgName: application.organization?.name ?? 'Demo Org',
      generatedAt: new Date().toLocaleDateString(),
      summary: { workflowCount, sessionCount },
      coverage: {
        state: latestSnapshot ? latestSnapshot.coveragePercent : 0,
        transition: latestSnapshot ? latestSnapshot.transitionCoverage : 0,
        flow: latestSnapshot ? latestSnapshot.flowCoverage : 0,
        expected: expectedCoverageScore === null ? null : expectedCoverageScore * 100,
      },
      workflows: workflows.map(w => ({ name: w.name, path: w.path, count: w.executionCount })),
      missingStates: missingStates.map(m => ({ name: m.stateName, confidence: m.confidence, reason: m.reason })),
      missingFlows: missingFlows.map(f => ({ path: f.suggestedFlow as string[], confidence: f.confidence, reason: f.reason })),
      endpoints,
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `sots-report-${applicationId}-${dateStr}`;

    if (req.query.notifyEmail === 'true') {
      const userId = req.headers['x-sots-user-id'] as string | undefined;
      if (userId && application.organizationId) {
        void prisma.user.findUnique({ where: { id: userId } }).then((user) => {
          if (!user) return;
          return emailService.sendTransactional({
            templateKey: 'report-export-ready',
            to: user.email,
            userId,
            organizationId: application.organizationId,
            applicationId,
            eventType: 'REPORT_EXPORT_READY',
            variables: {
              applicationName: application.name,
              format: format.toUpperCase(),
              reportUrl: appUrl(`/reports?applicationId=${applicationId}`),
            },
            idempotencyKey: buildIdempotencyKey(['report-export-ready', applicationId, format, userId, dateStr]),
          });
        }).catch((err) => console.error('[Email] report-export-ready failed', err));
      }
    }

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.setHeader('Content-Type', 'application/json');
      return res.send(JSON.stringify(reportData, null, 2));
    }

    if (format === 'csv') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.setHeader('Content-Type', 'text/csv');
      let csv = 'Type,Item,Confidence/Count,Details/Path\n';
      
      // Add summary
      csv += `Summary,Workflow Count,${reportData.summary.workflowCount},Total workflows discovered\n`;
      csv += `Summary,Session Count,${reportData.summary.sessionCount},Total sessions analyzed\n`;
      csv += `Coverage,State Coverage,${reportData.coverage.state.toFixed(1)}%,\n`;
      csv += `Coverage,Transition Coverage,${reportData.coverage.transition.toFixed(1)}%,\n`;
      csv += `Coverage,Flow Coverage,${reportData.coverage.flow.toFixed(1)}%,\n`;

      // Workflows
      for (const w of reportData.workflows) {
        const pathStr = Array.isArray(w.path) ? (w.path as string[]).join(' -> ') : '';
        csv += `Workflow,"${w.name}",${w.count},"${pathStr}"\n`;
      }
      // Missing states
      for (const ms of reportData.missingStates) {
        csv += `Missing State,"${ms.name}",${(ms.confidence*100).toFixed(0)}%,"${ms.reason || ''}"\n`;
      }
      // Missing flows
      for (const mf of reportData.missingFlows) {
        csv += `Missing Flow,"${mf.path.join(' -> ')}",${(mf.confidence*100).toFixed(0)}%,"${mf.reason || ''}"\n`;
      }
      // Endpoints
      for (const ep of reportData.endpoints) {
        csv += `Endpoint,"${ep.method} ${ep.endpoint}",${ep.requestCount},"Avg: ${ep.avgMs}ms, P95: ${ep.p95Ms}ms, Error: ${(ep.errorRate*100).toFixed(1)}%"\n`;
      }

      return res.send(csv);
    }

    if (format === 'html') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`);
      res.setHeader('Content-Type', 'text/html');
      
      const html = `
      <!DOCTYPE html>
      <html lang="en" class="dark bg-neutral-950 text-neutral-50">
      <head>
        <meta charset="UTF-8">
        <title>SOTS Report - ${reportData.appName}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        </style>
      </head>
      <body class="p-8 max-w-5xl mx-auto space-y-8 bg-neutral-950 text-neutral-50">
        <div class="flex items-center justify-between border-b border-neutral-800 pb-6">
          <div>
            <h1 class="text-4xl font-extrabold tracking-tight">${reportData.appName}</h1>
            <p class="text-neutral-400 mt-1">Organization: ${reportData.orgName} · Report Generated on ${reportData.generatedAt}</p>
          </div>
          <div class="text-right">
            <span class="text-sm font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">SOTS Coverage Report</span>
          </div>
        </div>

        <!-- Metric Cards -->
        <div class="grid grid-cols-3 gap-6">
          <div class="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 backdrop-blur-xl">
            <h3 class="text-sm font-medium text-neutral-400">State Coverage</h3>
            <p class="mt-2 text-4xl font-bold text-white">${reportData.coverage.state.toFixed(1)}%</p>
          </div>
          <div class="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 backdrop-blur-xl">
            <h3 class="text-sm font-medium text-neutral-400">Transition Coverage</h3>
            <p class="mt-2 text-4xl font-bold text-white">${reportData.coverage.transition.toFixed(1)}%</p>
          </div>
          <div class="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 backdrop-blur-xl">
            <h3 class="text-sm font-medium text-neutral-400">Flow Coverage</h3>
            <p className="mt-2 text-4xl font-bold text-white">${reportData.coverage.flow.toFixed(1)}%</p>
          </div>
        </div>

        <!-- Summary Statistics -->
        <div class="grid grid-cols-2 gap-6">
          <div class="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h3 class="text-lg font-semibold text-white mb-4">Discovered Workflows (${reportData.workflows.length})</h3>
            <div class="space-y-4 max-h-96 overflow-y-auto">
              ${reportData.workflows.map(w => `
                <div class="border-b border-neutral-800 pb-2 last:border-0">
                  <div class="flex justify-between items-center">
                    <span class="font-semibold text-sm text-neutral-200">${w.name}</span>
                    <span class="text-xs text-neutral-500">${w.count} executions</span>
                  </div>
                  <div class="mt-1 text-xs text-neutral-400 font-mono">${Array.isArray(w.path) ? (w.path as string[]).join(' → ') : ''}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h3 class="text-lg font-semibold text-white mb-4">Endpoint Performance</h3>
            <div class="space-y-4 max-h-96 overflow-y-auto">
              ${reportData.endpoints.map(ep => `
                <div class="border-b border-neutral-800 pb-2 last:border-0 flex justify-between items-center text-sm">
                  <div>
                    <span class="font-mono text-neutral-200">${ep.endpoint}</span>
                    <span class="text-[10px] uppercase font-semibold text-blue-400 ml-2">${ep.method}</span>
                  </div>
                  <div class="text-right text-xs text-neutral-400">
                    <span class="font-medium text-neutral-200">${ep.avgMs}ms</span> avg · ${(ep.errorRate*100).toFixed(1)}% err
                  </div>
                </div>
              `).join('')}
              ${reportData.endpoints.length === 0 ? '<p class="text-neutral-500 text-sm">No endpoint metrics collected.</p>' : ''}
            </div>
          </div>
        </div>

        <!-- Missing Coverage details -->
        <div class="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
          <h3 class="text-lg font-semibold text-white mb-4">Missing Behavioral Coverage</h3>
          
          <div class="space-y-6">
            <div>
              <h4 class="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-2">Unreached States</h4>
              <ul class="space-y-2">
                ${reportData.missingStates.map(ms => `
                  <li class="flex justify-between items-center text-sm bg-neutral-950 p-3 rounded-lg border border-neutral-900">
                    <div>
                      <span class="font-mono text-red-400 font-medium">${ms.name}</span>
                      <p class="text-xs text-neutral-500 mt-0.5">${ms.reason || 'Expected state never executed.'}</p>
                    </div>
                    <span class="text-xs text-neutral-400 font-semibold bg-neutral-900 px-2.5 py-1 rounded">Confidence: ${(ms.confidence*100).toFixed(0)}%</span>
                  </li>
                `).join('')}
                ${reportData.missingStates.length === 0 ? '<p class="text-neutral-500 text-sm">No missing states detected.</p>' : ''}
              </ul>
            </div>

            <div>
              <h4 class="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-2">Uncovered Paths / Flows</h4>
              <ul class="space-y-2">
                ${reportData.missingFlows.map(mf => `
                  <li class="flex justify-between items-center text-sm bg-neutral-950 p-3 rounded-lg border border-neutral-900">
                    <div>
                      <div class="font-mono text-amber-400 font-medium">${mf.path.join(' → ')}</div>
                      <p class="text-xs text-neutral-500 mt-1">${mf.reason || 'Suggested flow path not covered.'}</p>
                    </div>
                    <span class="text-xs text-neutral-400 font-semibold bg-neutral-900 px-2.5 py-1 rounded">Confidence: ${(mf.confidence*100).toFixed(0)}%</span>
                  </li>
                `).join('')}
                ${reportData.missingFlows.length === 0 ? '<p class="text-neutral-500 text-sm">No missing flows detected.</p>' : ''}
              </ul>
            </div>
          </div>
        </div>
      </body>
      </html>
      `;
      return res.send(html);
    }

    if (format === 'pdf') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.setHeader('Content-Type', 'application/pdf');

      const doc = new PDFDocument({ margin: 50, bufferPages: true });
      doc.pipe(res);

      // --- PAGE 1: Cover Page ---
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#09090b');
      doc.fillColor('#3b82f6').fontSize(14).text('SOFTWARE OBSERVABILITY & TESTING SYSTEM (SOTS)', 50, 200);
      doc.fillColor('#ffffff').fontSize(36).text('Behavioral Quality Analysis Report', { lineGap: 10 });
      doc.fontSize(16).fillColor('#a1a1aa').text(`Application: ${reportData.appName}`, { lineGap: 10 });
      doc.text(`Organization: ${reportData.orgName}`);
      doc.text(`Date: ${reportData.generatedAt}`);

      doc.fillColor('#71717a').fontSize(10).text('Generated by SOTS Platform · Confidential', 50, doc.page.height - 80);

      // --- PAGE 2: Summary and Metrics ---
      doc.addPage({ margin: 50 });
      doc.fillColor('#000000').fontSize(22).text('Coverage Summary', 50, 50);
      doc.strokeColor('#e4e4e7').lineWidth(1).moveTo(50, 80).lineTo(doc.page.width - 50, 80).stroke();

      doc.fontSize(12).fillColor('#27272a').text('Below are the behavioral coverage metrics analyzed across testing sessions:', 50, 105);

      // State Coverage Box
      doc.rect(50, 140, 150, 80).fill('#f4f4f5');
      doc.fillColor('#71717a').fontSize(10).text('STATE COVERAGE', 65, 155);
      doc.fillColor('#3b82f6').fontSize(24).text(`${reportData.coverage.state.toFixed(1)}%`, 65, 175);

      // Transition Coverage Box
      doc.rect(220, 140, 150, 80).fill('#f4f4f5');
      doc.fillColor('#71717a').fontSize(10).text('TRANSITION COVERAGE', 235, 155);
      doc.fillColor('#3b82f6').fontSize(24).text(`${reportData.coverage.transition.toFixed(1)}%`, 235, 175);

      // Flow Coverage Box
      doc.rect(390, 140, 150, 80).fill('#f4f4f5');
      doc.fillColor('#71717a').fontSize(10).text('FLOW COVERAGE', 405, 155);
      doc.fillColor('#3b82f6').fontSize(24).text(`${reportData.coverage.flow.toFixed(1)}%`, 405, 175);

      // Session and Workflow summary
      doc.fillColor('#000000').fontSize(14).text('Session Metrics', 50, 250);
      doc.fontSize(11).fillColor('#3f3f46')
         .text(`Total Sessions Analyzed: ${reportData.summary.sessionCount}`, 50, 275)
         .text(`Total Discovered Workflows: ${reportData.summary.workflowCount}`, 50, 295);

      // --- PAGE 3: Discovered Workflows ---
      doc.addPage();
      doc.fillColor('#000000').fontSize(20).text('Discovered Workflows', 50, 50);
      doc.strokeColor('#e4e4e7').moveTo(50, 75).lineTo(doc.page.width - 50, 75).stroke();

      let y = 100;
      for (const w of reportData.workflows.slice(0, 12)) {
        doc.fillColor('#18181b').fontSize(11).font('Helvetica-Bold').text(w.name, 50, y);
        doc.fillColor('#71717a').fontSize(9).font('Helvetica').text(`${w.count} executions`, doc.page.width - 150, y, { align: 'right' });
        const pathStr = Array.isArray(w.path) ? (w.path as string[]).join(' -> ') : '';
        doc.fillColor('#52525b').fontSize(9).text(pathStr, 50, y + 15, { width: doc.page.width - 100 });
        y += 40;
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
        }
      }

      // --- PAGE 4: Missing States & Flows ---
      doc.addPage();
      doc.fillColor('#000000').fontSize(20).text('Unreached / Missing Coverage', 50, 50);
      doc.strokeColor('#e4e4e7').moveTo(50, 75).lineTo(doc.page.width - 50, 75).stroke();

      doc.fillColor('#18181b').fontSize(14).text('Missing States', 50, 95);
      y = 120;
      for (const ms of reportData.missingStates.slice(0, 10)) {
        doc.fillColor('#b91c1c').fontSize(10).text(ms.name, 60, y);
        doc.fillColor('#71717a').fontSize(9).text(`Confidence: ${(ms.confidence*100).toFixed(0)}%`, doc.page.width - 180, y, { align: 'right' });
        if (ms.reason) {
          doc.fillColor('#52525b').fontSize(8.5).text(`Reason: ${ms.reason}`, 60, y + 12);
          y += 30;
        } else {
          y += 20;
        }
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
        }
      }

      y += 20;
      doc.fillColor('#18181b').fontSize(14).text('Missing Workflow Flows', 50, y);
      y += 25;
      for (const mf of reportData.missingFlows.slice(0, 8)) {
        doc.fillColor('#d97706').fontSize(9.5).text(mf.path.join(' -> '), 60, y);
        doc.fillColor('#71717a').fontSize(9).text(`Confidence: ${(mf.confidence*100).toFixed(0)}%`, doc.page.width - 180, y, { align: 'right' });
        if (mf.reason) {
          doc.fillColor('#52525b').fontSize(8.5).text(`Reason: ${mf.reason}`, 60, y + 12);
          y += 30;
        } else {
          y += 20;
        }
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
        }
      }

      // --- PAGE 5: Endpoint performance ---
      doc.addPage();
      doc.fillColor('#000000').fontSize(20).text('Endpoint Performance Analysis', 50, 50);
      doc.strokeColor('#e4e4e7').moveTo(50, 75).lineTo(doc.page.width - 50, 75).stroke();

      y = 100;
      doc.fillColor('#71717a').fontSize(9)
         .text('ENDPOINT', 50, y)
         .text('METHOD', 250, y)
         .text('REQUESTS', 320, y)
         .text('AVG LATENCY', 400, y)
         .text('ERROR RATE', 480, y);
      
      doc.strokeColor('#e4e4e7').moveTo(50, y + 12).lineTo(doc.page.width - 50, y + 12).stroke();
      y += 20;

      for (const ep of reportData.endpoints.slice(0, 15)) {
        doc.fillColor('#18181b').fontSize(9.5)
           .text(ep.endpoint, 50, y, { width: 190, height: 12, ellipsis: true })
           .text(ep.method, 250, y)
           .text(ep.requestCount.toString(), 320, y)
           .text(`${ep.avgMs}ms`, 400, y)
           .text(`${(ep.errorRate*100).toFixed(1)}%`, 480, y);
        
        y += 22;
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
        }
      }

      // Add simple footers on all pages
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        if (i > 0) {
          doc.fillColor('#a1a1aa').fontSize(8)
             .text(`SOTS behavioral QA analysis report · page ${i + 1} of ${pages.count}`, 50, doc.page.height - 35, { align: 'center' });
        }
      }

      doc.end();
      return;
    }

    res.status(400).json({ error: 'Unsupported format. Use html, csv, pdf, or json.' });
  } catch (error) {
    console.error('[ReportEngine] Export failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

void emailService.syncBuiltinTemplates().catch((err) => console.error('[Email] Template sync failed', err));

const PORT = Services.REPORT_ENGINE || 3004;

app.listen(PORT, () => {
  console.log(`Report Engine running on port ${PORT}`);
});
