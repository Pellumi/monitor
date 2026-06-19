import express, { Request, Response } from 'express';
import { PrismaClient } from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';
import { Feature, Services } from '@sots/shared';
import crypto from 'crypto';

const app = express();
const prisma = new PrismaClient();
const entitlementChecker = new EntitlementChecker(prisma);
app.use(express.json());

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
    }

    res.json({ success: true, completedAt: demo.completedAt });
  } catch (error) {
    console.error('[DemonstrationAPI] Error stopping demo', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Analyze Demonstration
app.post('/demonstrations/analyze', async (req: Request, res: Response) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  try {
    const demo = await prisma.demonstration.findUnique({ where: { id } });
    if (!demo) {
      return res.status(404).json({ error: 'Demonstration not found' });
    }

    // Trigger synchronous coverage generation
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

    // Link report ID
    await prisma.demonstration.update({
      where: { id },
      data: { reportId: coverageReport.snapshotId }
    });

    res.json({ success: true, snapshotId: coverageReport.snapshotId });
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

const PORT = Services.DEMONSTRATION_API || 3005;

app.listen(PORT, () => {
  console.log(`Demonstration API running on port ${PORT}`);
});
