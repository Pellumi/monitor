import { PrismaClient } from '@sots/db';

const prisma = new PrismaClient();

async function test() {
  const applicationId = '196bdb26-c743-4448-b8e3-bddb17574cec';
  console.log('Testing connection & query for application:', applicationId);
  try {
    const application = await prisma.application.findUnique({ where: { id: applicationId } });
    console.log('Application:', application);
    if (!application) {
      console.log('Application not found');
      return;
    }

    const devEnv = await prisma.environment.findFirst({
      where: { applicationId, isDefault: true }
    });
    console.log('Default dev environment:', devEnv);

    const targetEnvId = devEnv?.id;
    console.log('Target environment ID:', targetEnvId);

    const workflowCount = await prisma.workflow.count({ where: { applicationId } });
    console.log('Workflow count:', workflowCount);

    const sessionCount = await prisma.session.count({
      where: { 
        applicationId,
        environmentId: targetEnvId || undefined
      }
    });
    console.log('Session count:', sessionCount);

    const latestSnapshot = await prisma.coverageSnapshot.findFirst({
      where: { 
        applicationId,
        environmentId: targetEnvId || undefined
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log('Latest snapshot:', latestSnapshot);

    const reconciliationReports = await prisma.reconciliationReport.findMany({
      where: {
        applicationId,
        environmentId: targetEnvId || undefined
      },
      orderBy: { generatedAt: 'desc' }
    });
    console.log('Reconciliation reports:', reconciliationReports.length);

    const expectedCoverageScore = reconciliationReports.length === 0
      ? null
      : reconciliationReports.reduce((sum, report) => sum + report.expectedCoverageScore, 0) / reconciliationReports.length;
    console.log('Expected coverage score:', expectedCoverageScore);

    const workflows = await prisma.workflow.findMany({
      where: { applicationId },
      orderBy: { executionCount: 'desc' },
      take: 10
    });
    console.log('Workflows:', workflows.length);

    const missingStates = await prisma.missingState.findMany({
      where: { applicationId }
    });
    console.log('Missing states:', missingStates.length);

    const missingFlows = await prisma.missingFlow.findMany({
      where: { applicationId }
    });
    console.log('Missing flows:', missingFlows.length);

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
    console.log('Report generation successful!', JSON.stringify(report, null, 2));

  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
