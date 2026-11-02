import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { AutonomousInterventionStatus, AutonomousRunStatus, EnvironmentType } from '@tellann/db';
import { autonomousLimitsFrom, createDesktopRouter } from './desktop-routes';

/**
 * A minimal in-memory stand-in for the handful of Prisma models these routes touch, following the
 * same harness shape `notification-routes.test.ts` uses: a real Express app and router, real HTTP
 * calls over a real socket, and a fake `prisma` object rather than a mocking library.
 */
function harness(options: { entitled?: boolean } = {}) {
  let qaRunSeq = 0;
  let autonomousRunSeq = 0;
  const environments = new Map<string, any>();
  const qaRuns = new Map<string, any>();
  const autonomousRuns = new Map<string, any>();
  const planVersions: any[] = [];
  const scenarios: any[] = [];
  const interventions = new Map<string, any>();

  const ORG_ID = 'org-1';
  const APP_ID = 'app-1';
  environments.set('env-1', { id: 'env-1', applicationId: APP_ID, type: EnvironmentType.STAGING, application: { organizationId: ORG_ID } });
  environments.set('env-prod', { id: 'env-prod', applicationId: APP_ID, type: EnvironmentType.PRODUCTION, application: { organizationId: ORG_ID } });

  const prisma: any = {
    environment: {
      findFirst: async ({ where }: any) => {
        const env = environments.get(where.id);
        return env && env.applicationId === where.applicationId ? env : null;
      },
    },
    qARun: {
      create: async ({ data, include }: any) => {
        const id = `run-${++qaRunSeq}`;
        const nested = data.autonomousRun?.create;
        const run = { id, organizationId: data.organizationId, applicationId: data.applicationId, environmentId: data.environmentId, mode: data.mode, targetUrl: data.targetUrl, createdByUserId: data.createdByUserId };
        qaRuns.set(id, run);
        let autonomousRun: any = null;
        if (nested) {
          const autonomousId = `autonomous-${++autonomousRunSeq}`;
          autonomousRun = {
            id: autonomousId, runId: id, goal: nested.goal, constraints: nested.constraints,
            maxActions: nested.maxActions, maxModelCalls: nested.maxModelCalls, maxDurationMs: nested.maxDurationMs,
            planVersion: 0, status: AutonomousRunStatus.PLANNING, cancelRequestedAt: null, createdAt: new Date(),
          };
          autonomousRuns.set(autonomousId, autonomousRun);
        }
        return include?.autonomousRun ? { ...run, autonomousRun } : run;
      },
    },
    autonomousRun: {
      findMany: async ({ where }: any) => {
        return [...autonomousRuns.values()].filter((row) => {
          const run = qaRuns.get(row.runId);
          if (where.run?.applicationId && run?.applicationId !== where.run.applicationId) return false;
          if (where.status && row.status !== where.status) return false;
          return true;
        }).map((row) => ({ ...row, run: qaRuns.get(row.runId) }));
      },
      findFirst: async ({ where }: any) => {
        const row = [...autonomousRuns.values()].find((candidate) => candidate.runId === where.runId);
        return row ? { ...row, run: qaRuns.get(row.runId) } : null;
      },
      update: async ({ where, data }: any) => {
        const row = autonomousRuns.get(where.id);
        Object.assign(row, data);
        return row;
      },
    },
    autonomousPlanVersion: {
      create: async ({ data }: any) => {
        const row = { id: `plan-${planVersions.length + 1}`, ...data, createdAt: new Date() };
        planVersions.push(row);
        return row;
      },
      findFirst: async ({ where }: any) => {
        return planVersions.filter((row) => row.autonomousRunId === where.autonomousRunId).sort((a, b) => b.version - a.version)[0] ?? null;
      },
    },
    autonomousScenario: {
      createMany: async ({ data }: any) => {
        scenarios.push(...data.map((row: any, index: number) => ({ id: `scenario-${scenarios.length + index + 1}`, status: 'NOT_RUN', ...row })));
        return { count: data.length };
      },
      groupBy: async ({ where }: any) => {
        const rows = scenarios.filter((row) => row.autonomousRunId === where.autonomousRunId && row.planVersion === where.planVersion);
        const counts = new Map<string, number>();
        for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
        return [...counts.entries()].map(([status, count]) => ({ status, _count: { _all: count } }));
      },
    },
    autonomousIntervention: {
      findFirst: async ({ where }: any) => {
        const row = interventions.get(where.id);
        return row && row.autonomousRunId === where.autonomousRunId ? row : null;
      },
      update: async ({ where, data }: any) => {
        const row = interventions.get(where.id);
        Object.assign(row, data);
        return row;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };

  // A test seeds an intervention directly, since nothing in this route set creates one yet
  // (that happens once the autonomous sequencer itself is wired into a live run, Stage 4+).
  (prisma as any).__seedIntervention = (row: any) => interventions.set(row.id, row);

  const verifyJwt = (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] ?? 'user-1', email: 'u@x.test' };
    next();
  };
  const verifyAppOwnership = (_req: any, _res: any, next: any) => next();
  const entitlementChecker = { canAccess: async () => options.entitled ?? true } as any;

  const app = express();
  app.use(express.json());
  app.use(createDesktopRouter({
    prisma, entitlementChecker, verifyJwt, verifyAppOwnership, jwtSecret: 'test', storage: {} as never,
  }));
  return { app, prisma, ORG_ID, APP_ID };
}

async function call(app: express.Express, method: string, path: string, opts: { body?: unknown; user?: string } = {}) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(opts.user ? { 'x-test-user': opts.user } : {}) },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as any };
  } finally {
    server.close();
  }
}

test('autonomousLimitsFrom defaults sensibly and rejects out-of-bounds values', () => {
  assert.deepEqual(autonomousLimitsFrom({}), { maxActions: 50, maxModelCalls: 30, maxDurationMs: 1_800_000 });
  assert.deepEqual(autonomousLimitsFrom({ maxActions: 10 }), { maxActions: 10, maxModelCalls: 30, maxDurationMs: 1_800_000 });
  assert.equal(autonomousLimitsFrom({ maxActions: 0 }), null, 'below the floor');
  assert.equal(autonomousLimitsFrom({ maxActions: 501 }), null, 'above the ceiling');
  assert.equal(autonomousLimitsFrom({ maxDurationMs: 'soon' }), null, 'not a number');
});

test('creating an autonomous run creates the QARun and AutonomousRun together', async () => {
  const { app } = harness();
  const res = await call(app, 'POST', '/applications/app-1/autonomous-runs', {
    body: { environmentId: 'env-1', targetUrl: 'http://localhost:3000', goal: 'Register and reach the dashboard' },
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.runId);
  assert.ok(res.body.autonomousRunId);
  assert.equal(res.body.status, 'PLANNING');
});

test('production environments refuse an autonomous run', async () => {
  const { app } = harness();
  const res = await call(app, 'POST', '/applications/app-1/autonomous-runs', {
    body: { environmentId: 'env-prod', targetUrl: 'http://localhost:3000', goal: 'Register' },
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'PRODUCTION_ACTIVE_CONTROL_BLOCKED');
});

test('an unentitled organization is refused', async () => {
  const { app } = harness({ entitled: false });
  const res = await call(app, 'POST', '/applications/app-1/autonomous-runs', {
    body: { environmentId: 'env-1', targetUrl: 'http://localhost:3000', goal: 'Register' },
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'FEATURE_NOT_ENTITLED');
});

test('an empty or oversized goal is rejected before anything is created', async () => {
  const { app } = harness();
  const empty = await call(app, 'POST', '/applications/app-1/autonomous-runs', {
    body: { environmentId: 'env-1', targetUrl: 'http://localhost:3000', goal: '' },
  });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error, 'INVALID_GOAL');
});

test('listing autonomous runs filters by status', async () => {
  const { app } = harness();
  await call(app, 'POST', '/applications/app-1/autonomous-runs', { body: { environmentId: 'env-1', targetUrl: 'http://localhost:3000', goal: 'A' } });
  const list = await call(app, 'GET', '/applications/app-1/autonomous-runs?status=PLANNING');
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].status, 'PLANNING');
  const none = await call(app, 'GET', '/applications/app-1/autonomous-runs?status=RUNNING');
  assert.equal(none.body.length, 0);
});

test('submitting a plan records it, seeds scenarios, and moves the run to RUNNING with scope approved', async () => {
  const { app } = harness();
  const created = await call(app, 'POST', '/applications/app-1/autonomous-runs', {
    body: { environmentId: 'env-1', targetUrl: 'http://localhost:3000', goal: 'Register and reach the dashboard' },
  });
  const plan = {
    goal: 'Register and reach the dashboard',
    scenarios: [{ key: 'register', title: 'Register an account', targetStateKeys: ['DASHBOARD'], successCriteria: ['Reaches DASHBOARD'] }],
  };
  const res = await call(app, 'POST', `/qa-runs/${created.body.runId}/autonomous/plan`, { body: { plan, provider: 'gemini' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'RUNNING');
  assert.equal(res.body.planVersion, 1);
  assert.ok(res.body.scopeApprovedAt);

  const state = await call(app, 'GET', `/qa-runs/${created.body.runId}/autonomous/state`);
  assert.equal(state.body.latestPlan.version, 1);
  assert.equal(state.body.scenarioCounts.NOT_RUN, 1);
});

test('a plan missing scenarios is rejected', async () => {
  const { app } = harness();
  const created = await call(app, 'POST', '/applications/app-1/autonomous-runs', {
    body: { environmentId: 'env-1', targetUrl: 'http://localhost:3000', goal: 'g' },
  });
  const res = await call(app, 'POST', `/qa-runs/${created.body.runId}/autonomous/plan`, { body: { plan: { goal: 'g', scenarios: [] } } });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'INVALID_PLAN');
});

test('responding to an intervention validates the response and is not repeatable', async () => {
  const { app, prisma } = harness();
  const created = await call(app, 'POST', '/applications/app-1/autonomous-runs', {
    body: { environmentId: 'env-1', targetUrl: 'http://localhost:3000', goal: 'g' },
  });
  (prisma as any).__seedIntervention({
    id: 'intervention-1', autonomousRunId: created.body.autonomousRunId, category: 'HIGH_IMPACT_APPROVAL',
    question: 'Approve deleting the course?', allowedResponses: ['Approve', 'Decline'], status: AutonomousInterventionStatus.PENDING,
  });

  const invalid = await call(app, 'POST', `/qa-runs/${created.body.runId}/autonomous/interventions/intervention-1/respond`, { body: { response: 'Maybe' } });
  assert.equal(invalid.status, 400);

  const ok = await call(app, 'POST', `/qa-runs/${created.body.runId}/autonomous/interventions/intervention-1/respond`, { body: { response: 'Approve' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, 'RESOLVED');
  assert.equal(ok.body.response, 'Approve');

  const again = await call(app, 'POST', `/qa-runs/${created.body.runId}/autonomous/interventions/intervention-1/respond`, { body: { response: 'Approve' } });
  assert.equal(again.status, 409);
});

test('cancelling an autonomous run is idempotent', async () => {
  const { app } = harness();
  const created = await call(app, 'POST', '/applications/app-1/autonomous-runs', {
    body: { environmentId: 'env-1', targetUrl: 'http://localhost:3000', goal: 'g' },
  });
  const first = await call(app, 'POST', `/qa-runs/${created.body.runId}/autonomous/cancel`);
  assert.ok(first.body.cancelRequestedAt);
  const second = await call(app, 'POST', `/qa-runs/${created.body.runId}/autonomous/cancel`);
  assert.equal(second.body.cancelRequestedAt, first.body.cancelRequestedAt, 'a second cancel does not move the timestamp');
});
