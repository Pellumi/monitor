import { initTracing } from '@sots/telemetry';
initTracing('demonstration-api');

import express, { Request, Response } from 'express';
import { MemberRole, PrismaClient } from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';
import { Feature, Services } from '@sots/shared';
import { NotificationEmailService, appUrl, buildIdempotencyKey } from '@sots/email';
import crypto from 'crypto';

const app = express();
const prisma = new PrismaClient();
const entitlementChecker = new EntitlementChecker(prisma);
const emailService = new NotificationEmailService(prisma);
app.use(express.json());

async function analyzeDemonstration(req: Request, res: Response, id: string, expectedGraphId?: string | null, analysisMode?: string | null) {
  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  const demo = await prisma.demonstration.findUnique({
    where: { id },
    include: { application: true },
  });
  if (!demo) {
    return res.status(404).json({ error: 'Demonstration not found' });
  }

  const response = await fetch(`http://localhost:${Services.COVERAGE_ENGINE || 3003}/coverage/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicationId: demo.applicationId,
      environmentId: demo.environmentId
    })
  });

  if (!response.ok) {
    throw new Error(`Coverage Engine returned ${response.status}`);
  }

  const coverageReport = await response.json();
  let reconciliationReports = null;

  if (expectedGraphId || analysisMode === 'EXPECTED_VS_OBSERVED') {
    const reconciliationResponse = await fetch(
      `http://localhost:${Services.FDRS_API}/applications/${demo.applicationId}/reconciliation/run`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environmentId: demo.environmentId,
          expectedGraphId: expectedGraphId || undefined,
          demonstrationId: demo.id,
        }),
      }
    );

    if (!reconciliationResponse.ok) {
      throw new Error(`FDRS reconciliation returned ${reconciliationResponse.status}`);
    }
    reconciliationReports = await reconciliationResponse.json();
  }

  await prisma.demonstration.update({
    where: { id },
    data: { reportId: coverageReport.snapshotId }
  });

  const orgId = (req.headers['x-sots-org-id'] as string) || demo.application.organizationId;
  if (orgId) {
    void emailService.sendToOrganizationMembers({
      templateKey: 'demo-report-ready',
      organizationId: orgId,
      applicationId: demo.applicationId,
      eventType: 'DEMO_REPORT_READY',
      variables: {
        applicationName: demo.application.name,
        environmentName: demo.environmentId || 'Default',
        coverageScore: coverageReport.metrics?.stateCoverage || '0%',
        missingFlowCount: coverageReport.metrics?.missingFlows || 0,
        reportUrl: appUrl(`/reports?applicationId=${demo.applicationId}`),
        dashboardUrl: appUrl(`/reports?applicationId=${demo.applicationId}`),
      },
      idempotencyKey: buildIdempotencyKey(['demo-report-ready', demo.id, coverageReport.snapshotId]),
      roles: [MemberRole.OWNER, MemberRole.ADMIN],
    }).catch((err) => console.error('[Email] demo-report-ready failed', err));
  }

  return res.json({
    success: true,
    snapshotId: coverageReport.snapshotId,
    expectedGraphId: expectedGraphId || null,
    analysisMode: analysisMode || (expectedGraphId ? 'EXPECTED_VS_OBSERVED' : 'OBSERVED_ONLY'),
    reconciliationReports,
  });
}

// 1. Start Demonstration
app.post('/demonstrations/start', async (req: Request, res: Response) => {
  const orgId = req.headers['x-sots-org-id'] as string;
  const environmentId = req.headers['x-sots-environment-id'] as string;
  const applicationId = (req.headers['x-sots-application-id'] as string) || req.body.applicationId;
  
  if (!applicationId) {
    return res.status(400).json({ error: 'applicationId is required' });
  }

  try {
    const sessionId = crypto.randomUUID();

    // Ensure Application exists
    const application = await prisma.application.upsert({
      where: { id: applicationId },
      update: {},
      create: { id: applicationId, name: 'Demo Application' }
    });
    const resolvedOrgId = orgId || application.organizationId;
    if (resolvedOrgId) {
      const allowed = await entitlementChecker.canAccess(resolvedOrgId, Feature.DEMONSTRATION_MODE);
      if (!allowed) {
        return res.status(403).json({
          error: 'FEATURE_NOT_ENTITLED',
          feature: Feature.DEMONSTRATION_MODE,
          message: 'Your current plan does not include demonstration mode.',
        });
      }
      const quota = await entitlementChecker.canStartDemonstration(resolvedOrgId);
      if (!quota.allowed) {
        return res.status(403).json({
          error: 'QUOTA_EXCEEDED',
          metric: quota.metric,
          current: quota.current,
          limit: quota.limit,
          plan: quota.planType,
          resetAt: quota.resetAt?.toISOString(),
          upgradeUrl: '/settings/billing',
          message: 'Monthly demonstration limit reached. Upgrade your plan or wait for the next billing period.',
        });
      }
    }

    const demo = await prisma.demonstration.create({
      data: {
        applicationId,
        environmentId: environmentId || null,
        sessionId,
      }
    });

    if (orgId) {
      await prisma.activationEvent.create({
        data: {
          organizationId: orgId,
          applicationId,
          environmentId: environmentId || null,
          eventName: 'DEMO_STARTED',
          metadata: { sessionId }
        }
      });
    }

    res.json({ id: demo.id, sessionId });
  } catch (error) {
    console.error('[DemonstrationAPI] Error starting demo', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Stop Demonstration
app.post('/demonstrations/stop', async (req: Request, res: Response) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  try {
    const demo = await prisma.demonstration.update({
      where: { id },
      data: { completedAt: new Date() },
      include: { application: true }
    });

    // Update onboarding progress
    await prisma.applicationOnboardingProgress.upsert({
      where: { applicationId: demo.applicationId },
      update: { demonstrationCompleted: true },
      create: { applicationId: demo.applicationId, demonstrationCompleted: true }
    });

    const orgId = (req.headers['x-sots-org-id'] as string) || demo.application.organizationId;
    if (orgId) {
      await prisma.activationEvent.create({
        data: {
          organizationId: orgId,
          applicationId: demo.applicationId,
          environmentId: demo.environmentId || null,
          eventName: 'DEMO_COMPLETED',
          metadata: { sessionId: demo.sessionId }
        }
      });

      void emailService.sendToOrganizationMembers({
        templateKey: 'demo-completed-processing',
        organizationId: orgId,
        applicationId: demo.applicationId,
        eventType: 'DEMO_COMPLETED_PROCESSING',
        variables: {
          applicationName: demo.application.name,
          sessionId: demo.sessionId,
          dashboardUrl: appUrl(`/reports?applicationId=${demo.applicationId}`),
        },
        idempotencyKey: buildIdempotencyKey(['demo-completed-processing', demo.id]),
        roles: [MemberRole.OWNER, MemberRole.ADMIN],
      }).catch((err) => console.error('[Email] demo-completed-processing failed', err));
    }

    res.json({ success: true, completedAt: demo.completedAt });
  } catch (error) {
    console.error('[DemonstrationAPI] Error stopping demo', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Analyze Demonstration
app.post('/demonstrations/analyze', async (req: Request, res: Response) => {
  const { id, expectedGraphId, analysisMode } = req.body;

  try {
    return await analyzeDemonstration(req, res, id, expectedGraphId, analysisMode);
  } catch (error) {
    console.error('[DemonstrationAPI] Error analyzing demo', error);
    if (req.body?.id) {
      void prisma.demonstration.findUnique({
        where: { id: req.body.id },
        include: { application: true },
      }).then((demo) => {
        const orgId = (req.headers['x-sots-org-id'] as string) || demo?.application.organizationId;
        if (!demo || !orgId) return;
        return emailService.sendToOrganizationMembers({
          templateKey: 'demo-analysis-failed',
          organizationId: orgId,
          applicationId: demo.applicationId,
          eventType: 'DEMO_ANALYSIS_FAILED',
          severity: 'HIGH',
          variables: {
            applicationName: demo.application.name,
            sessionId: demo.sessionId,
            dashboardUrl: appUrl(`/reports?applicationId=${demo.applicationId}`),
          },
          idempotencyKey: buildIdempotencyKey(['demo-analysis-failed', demo.id]),
          roles: [MemberRole.OWNER, MemberRole.ADMIN],
        });
      }).catch((err) => console.error('[Email] demo-analysis-failed failed', err));
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/demonstrations/:id/analyze', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { expectedGraphId, analysisMode } = req.body;

  try {
    return await analyzeDemonstration(req, res, id, expectedGraphId, analysisMode);
  } catch (error) {
    console.error('[DemonstrationAPI] Error analyzing demo', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Get Demonstration Results
app.get('/demonstrations/:id/results', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const demo = await prisma.demonstration.findUnique({ where: { id } });
    if (!demo) {
      return res.status(404).json({ error: 'Demonstration not found' });
    }

    // Fetch compiled report from Report Engine
    const response = await fetch(`http://localhost:${Services.REPORT_ENGINE || 3004}/reports/${demo.applicationId}/latest`);
    
    if (!response.ok) {
      throw new Error(`Report Engine returned ${response.status}`);
    }

    const report = await response.json();
    res.json(report);
  } catch (error) {
    console.error('[DemonstrationAPI] Error fetching results', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

void emailService.syncBuiltinTemplates().catch((err) => console.error('[Email] Template sync failed', err));

const PORT = Services.DEMONSTRATION_API || 3005;

app.listen(PORT, () => {
  console.log(`Demonstration API running on port ${PORT}`);
});
