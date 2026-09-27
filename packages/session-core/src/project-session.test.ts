import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@tellann/db';
import { getRuleSet } from '@tellann/rules';
import type { ApplicationRuleSet } from '@tellann/rules';
import {
  extractAction,
  extractExplicitTransition,
  extractState,
  projectSessionIntoGraph,
} from './project-session';
import type { SessionAnnouncement } from './deps';

// ─────────────────────────────────────────────────────────────────────────────
// An in-memory stand-in that honours the unique indexes the migration creates.
// That is the whole point: the counters are only correct because those indexes
// make a repeated observation a no-op, so a fake that let duplicates through
// would pass tests the database would fail.
// ─────────────────────────────────────────────────────────────────────────────

interface GraphWorld {
  states: Map<string, { id: string; applicationId: string; environmentId: string | null; name: string; category: string; visitCount: number }>;
  transitions: Map<string, { id: string; applicationId: string; environmentId: string | null; fromStateId: string; toStateId: string; action: string; frequency: number }>;
  stateObservations: Set<string>;
  transitionObservations: Set<string>;
  workflows: Map<string, { id: string; applicationId: string; name: string; path: string[]; executionCount: number }>;
  workflowExecutions: Set<string>;
  ruleSet: ApplicationRuleSet | null;
  fdrsTriggers: string[];
  facetUpdates: Array<{ where: any; data: any }>;
  seq: number;
}

function newWorld(ruleSet: ApplicationRuleSet | null = null): GraphWorld {
  return {
    states: new Map(),
    transitions: new Map(),
    stateObservations: new Set(),
    transitionObservations: new Set(),
    workflows: new Map(),
    workflowExecutions: new Set(),
    ruleSet,
    fdrsTriggers: [],
    facetUpdates: [],
    seq: 0,
  };
}

const envKey = (environmentId: string | null) => environmentId ?? '-';

function fakePrisma(world: GraphWorld): PrismaClient {
  return {
    // The two raw upserts. `inserted` mirrors Postgres's `xmax = 0`.
    // Prisma calls a tagged-template $queryRaw as (strings, ...values), so the
    // first argument IS the TemplateStringsArray -- not an object wrapping it.
    async $queryRaw(strings: TemplateStringsArray | any, ...values: any[]) {
      const sql = Array.isArray(strings) ? strings.join('?') : String(strings?.sql ?? '');

      if (sql.includes('INSERT INTO "State"')) {
        const [applicationId, environmentId, name, category] = values;
        const key = `${applicationId}|${envKey(environmentId)}|${name}`;
        const existing = world.states.get(key);
        if (existing) return [{ id: existing.id, inserted: false }];
        world.seq += 1;
        const id = `state-${world.seq}`;
        world.states.set(key, { id, applicationId, environmentId, name, category, visitCount: 0 });
        return [{ id, inserted: true }];
      }

      if (sql.includes('INSERT INTO "Transition"')) {
        const [applicationId, environmentId, fromStateId, toStateId, action] = values;
        const key = `${applicationId}|${envKey(environmentId)}|${fromStateId}|${toStateId}|${action ?? ''}`;
        const existing = world.transitions.get(key);
        if (existing) return [{ id: existing.id, inserted: false }];
        world.seq += 1;
        const id = `transition-${world.seq}`;
        world.transitions.set(key, { id, applicationId, environmentId, fromStateId, toStateId, action, frequency: 0 });
        return [{ id, inserted: true }];
      }

      throw new Error(`unexpected raw query: ${sql.slice(0, 60)}`);
    },

    applicationProfile: { async findUnique() { return { profileType: 'LMS' }; } },
    compiledRuleset: { async findFirst() { return null; } },

    stateObservation: {
      async createMany({ data, skipDuplicates }: { data: any[]; skipDuplicates?: boolean }) {
        let count = 0;
        for (const row of data) {
          const key = `${row.sessionId}|${row.eventId}|${row.stateId}`;
          if (world.stateObservations.has(key)) {
            if (!skipDuplicates) throw new Error('UNIQUE_VIOLATION');
            continue;
          }
          world.stateObservations.add(key);
          count += 1;
        }
        return { count };
      },
    },
    transitionObservation: {
      async createMany({ data, skipDuplicates }: { data: any[]; skipDuplicates?: boolean }) {
        let count = 0;
        for (const row of data) {
          const key = `${row.sessionId}|${row.fromEventId}|${row.toEventId}`;
          if (world.transitionObservations.has(key)) {
            if (!skipDuplicates) throw new Error('UNIQUE_VIOLATION');
            continue;
          }
          world.transitionObservations.add(key);
          count += 1;
        }
        return { count };
      },
    },
    state: {
      async update({ where, data }: { where: { id: string }; data: any }) {
        for (const row of world.states.values()) {
          if (row.id === where.id) { row.visitCount += data.visitCount.increment; return row; }
        }
        throw new Error('NOT_FOUND');
      },
    },
    transition: {
      async update({ where, data }: { where: { id: string }; data: any }) {
        for (const row of world.transitions.values()) {
          if (row.id === where.id) { row.frequency += data.frequency.increment; return row; }
        }
        throw new Error('NOT_FOUND');
      },
    },
    workflow: {
      async findFirst({ where }: { where: any }) {
        const wanted = JSON.stringify(where.path.equals);
        for (const row of world.workflows.values()) {
          if (row.applicationId === where.applicationId && JSON.stringify(row.path) === wanted) return row;
        }
        return null;
      },
      async create({ data }: { data: any }) {
        world.seq += 1;
        const row = { id: `workflow-${world.seq}`, ...data, executionCount: data.executionCount ?? 0 };
        world.workflows.set(row.id, row);
        return row;
      },
      async update({ where, data }: { where: { id: string }; data: any }) {
        const row = world.workflows.get(where.id)!;
        row.executionCount += data.executionCount.increment;
        return row;
      },
    },
    workflowExecution: {
      async createMany({ data, skipDuplicates }: { data: any[]; skipDuplicates?: boolean }) {
        let count = 0;
        for (const row of data) {
          const key = `${row.workflowId}|${row.sessionId}`;
          if (world.workflowExecutions.has(key)) {
            if (!skipDuplicates) throw new Error('UNIQUE_VIOLATION');
            continue;
          }
          world.workflowExecutions.add(key);
          count += 1;
        }
        return { count };
      },
    },
    session: { async findUnique() { return null; } },
    // The projection enriches the facet with the flow-shaped fields afterwards.
    // No declared flow here, so there are no terminal states and nothing is called
    // abandoned -- which is the honest answer, not a failure.
    behaviorGraphNode: { async findMany() { return []; } },
    sessionFacet: {
      async updateMany({ where, data }: { where: any; data: any }) {
        world.facetUpdates.push({ where, data });
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
}

function deps(world: GraphWorld) {
  return {
    prisma: fakePrisma(world),
    logger: { log() {}, warn() {}, error() {} },
    onProjected: (applicationId: string) => world.fdrsTriggers.push(applicationId),
  };
}

function announcement(events: any[]): SessionAnnouncement {
  return {
    sessionId: 'session-1',
    applicationId: 'app-1',
    environmentId: 'env-1',
    tenantId: 'org-1',
    eventCount: events.length,
    startTime: events[0]?.timestamp ?? '2026-09-29T12:00:00.000Z',
    endTime: events[events.length - 1]?.timestamp ?? '2026-09-29T12:00:00.000Z',
    events,
  };
}

let clock = 0;
function evt(eventType: string, metadata: Record<string, unknown> = {}, id?: string): any {
  clock += 1000;
  return {
    eventId: id ?? `e${clock}`,
    sessionId: 'session-1',
    tenantId: 'org-1',
    applicationId: 'app-1',
    environmentId: 'env-1',
    runId: null,
    traceId: null,
    eventType,
    eventVersion: '1.0',
    source: 'frontend-sdk',
    timestamp: new Date(Date.UTC(2026, 8, 29, 12, 0, 0) + clock).toISOString(),
    metadata,
  };
}

// The real LMS rule set, resolved the way production resolves it: no compiled
// ruleset for the application, so the profile type selects a built-in.
const RULES = getRuleSet('LMS')!;

/** Points the projection's rule resolution at a profile type, or at nothing. */
function withProfile(prisma: PrismaClient, profileType: string | null): PrismaClient {
  (prisma as any).applicationProfile.findUnique = async () => (
    profileType ? { profileType } : null
  );
  (prisma as any).compiledRuleset.findFirst = async () => null;
  return prisma;
}

// ─── Extraction ──────────────────────────────────────────────────────────────

test('an explicit STATE_TRANSITION names both of its ends', () => {
  const transition = extractExplicitTransition(evt('STATE_TRANSITION', {
    fromState: 'course list', toState: 'exam create', action: 'click new',
  }));
  assert.deepEqual(transition, { fromState: 'COURSE_LIST', toState: 'EXAM_CREATE', action: 'CLICK_NEW' });
});

test('a STATE_TRANSITION missing an end is not a transition', () => {
  assert.equal(extractExplicitTransition(evt('STATE_TRANSITION', { toState: 'EXAM_CREATE' })), null);
});

test('an explicit STATE_ENTERED outranks every rule', () => {
  const state = extractState(evt('STATE_ENTERED', { stateName: 'grading queue' }), RULES);
  assert.deepEqual(state, { name: 'GRADING_QUEUE', category: 'BUSINESS' });
});

test('a business event outranks a route match', () => {
  const state = extractState(
    evt('BUSINESS_EVENT', { businessEventType: 'COURSE_PUBLISHED', url: 'https://lms.test/courses' }),
    RULES,
  );
  assert.equal(state?.name, 'COURSE_PUBLISHED');
});

test('with no rule set, nothing is a state', () => {
  // This is the coverage hole Stage 6 closes with route induction. getRuleSet
  // resolves only ECOMMERCE and LMS, so for any other application every page view
  // yields nothing and the observed graph stays empty.
  assert.equal(extractState(evt('PAGE_VIEW', { url: 'https://app.test/reports/42' }), null), null);
});

test('the action on a transition comes from the element that caused it', () => {
  assert.equal(extractAction(evt('BUTTON_CLICK', { buttonName: 'Publish' })), 'Publish');
  assert.equal(extractAction(evt('FORM_SUBMITTED', { formId: 'exam-form' })), 'exam-form');
  assert.equal(extractAction(evt('PAGE_VIEW')), 'NAVIGATE');
});

// ─── Projection ──────────────────────────────────────────────────────────────

test('a rule-driven session becomes states, a transition and a workflow', async () => {
  const world = newWorld(RULES);
  const events = [
    evt('PAGE_VIEW', { url: 'https://lms.test/courses' }),
    evt('BUTTON_CLICK', { buttonName: 'Start quiz' }),
    evt('PAGE_VIEW', { url: 'https://lms.test/quiz/start' }),
  ];
  const d = deps(world);
  const result = await projectSessionIntoGraph(
    { ...d, prisma: withProfile(d.prisma, 'LMS') },
    announcement(events),
  );

  assert.equal(result.newStates, 2);
  assert.equal(result.statesObserved, 2);
  assert.equal(result.newTransitions, 1);
  assert.equal(result.transitionsObserved, 1);
  assert.equal(result.workflowName, 'QUIZ_STARTED Workflow');
  assert.equal(result.workflowIsNewExecution, true);
  assert.deepEqual(world.fdrsTriggers, ['app-1']);
});

test('projecting the same session twice leaves every counter unchanged', async () => {
  // THE invariant of this stage. `fromBeginning: true` already replayed the topic on
  // every consumer rebalance, and now a Kafka consumer and a Postgres worker can
  // both complete one session while outbox delivery is at-least-once — so a repeat
  // is routine. It used to add 1 to visitCount, frequency and executionCount each
  // time, inflating every number the product displays.
  const world = newWorld(RULES);
  const events = [
    evt('PAGE_VIEW', { url: 'https://lms.test/courses' }),
    evt('PAGE_VIEW', { url: 'https://lms.test/quiz/start' }),
  ];
  const d = deps(world);
  const prisma = withProfile(d.prisma, 'LMS');

  const first = await projectSessionIntoGraph({ ...d, prisma }, announcement(events));
  const snapshot = {
    visits: [...world.states.values()].map((s) => s.visitCount),
    frequencies: [...world.transitions.values()].map((t) => t.frequency),
    executions: [...world.workflows.values()].map((w) => w.executionCount),
  };

  const second = await projectSessionIntoGraph({ ...d, prisma }, announcement(events));

  assert.equal(first.statesObserved, 2);
  assert.equal(second.statesObserved, 0, 'no new observations on a repeat');
  assert.equal(second.newStates, 0);
  assert.equal(second.newTransitions, 0);
  assert.equal(second.workflowIsNewExecution, false);
  assert.deepEqual([...world.states.values()].map((s) => s.visitCount), snapshot.visits);
  assert.deepEqual([...world.transitions.values()].map((t) => t.frequency), snapshot.frequencies);
  assert.deepEqual([...world.workflows.values()].map((w) => w.executionCount), snapshot.executions);
  assert.equal(world.states.size, 2, 'and no duplicate state rows');
});

test('a second, different session on the same path adds a visit but no new state', async () => {
  const world = newWorld(RULES);
  const d = deps(world);
  const prisma = withProfile(d.prisma, 'LMS');

  await projectSessionIntoGraph({ ...d, prisma }, announcement([
    evt('PAGE_VIEW', { url: 'https://lms.test/courses' }),
  ]));

  const second = announcement([evt('PAGE_VIEW', { url: 'https://lms.test/courses' })]);
  second.sessionId = 'session-2';
  second.events = second.events!.map((e) => ({ ...e, sessionId: 'session-2' }));
  const result = await projectSessionIntoGraph({ ...d, prisma }, second);

  assert.equal(result.newStates, 0);
  assert.equal(result.statesObserved, 1);
  assert.equal(world.states.size, 1);
  assert.equal([...world.states.values()][0].visitCount, 2);
});

test('an explicit transition records both ends distinguishably', async () => {
  // Both observations belong to one event, so without the `:from` suffix the
  // (sessionId, eventId, stateId) unique index would collapse them to one.
  const world = newWorld(null);
  const d = deps(world);
  const prisma = withProfile(d.prisma, null);

  const result = await projectSessionIntoGraph({ ...d, prisma }, announcement([
    evt('STATE_TRANSITION', { fromState: 'CART', toState: 'CHECKOUT', action: 'PROCEED' }),
  ]));

  assert.equal(result.newStates, 2);
  assert.equal(result.statesObserved, 2);
  assert.equal(result.newTransitions, 1);
  assert.equal(world.stateObservations.size, 2);
});

test('an application with no profile is labelled with ECOMMERCE states', async () => {
  // Not an assertion that this is right -- it is the defect Stage 6 fixes, pinned
  // so the fix is visible when it lands. `resolveRuleSet` does
  // `getRuleSet(profile?.profileType || 'ECOMMERCE')`, and getRuleSet resolves only
  // ECOMMERCE and LMS, so an application that never declared a profile has its
  // behaviour described in someone else's vocabulary.
  const world = newWorld(null);
  const d = deps(world);
  const prisma = withProfile(d.prisma, null);

  const result = await projectSessionIntoGraph({ ...d, prisma }, announcement([
    evt('PAGE_VIEW', { url: 'https://lms.test/exams/new' }),
  ]));

  assert.equal(result.statesObserved, 1);
  const names = [...world.states.values()].map((state) => state.name);
  assert.equal(names.length, 1);
  assert.notEqual(names[0], 'EXAMS_NEW', 'the state is named by a rule, not by the route');
});

test('an application with no rule set is described by its own routes', async () => {
  // This test used to assert the opposite -- that no rule set meant no observed graph at
  // all -- and that was the defect, not the contract. getRuleSet resolves only ECOMMERCE
  // and LMS, so every other application produced an empty graph. Route induction is what
  // changed, and the assertion changed with it.
  const world = newWorld(null);
  const d = deps(world);
  const prisma = withProfile(d.prisma, 'HEALTHCARE');

  const result = await projectSessionIntoGraph({ ...d, prisma }, announcement([
    evt('PAGE_VIEW', { url: 'https://clinic.test/patients/42' }),
  ]));

  assert.equal(result.statesObserved, 1);
  assert.deepEqual([...world.states.values()].map((s) => s.name), ['ROUTE_PATIENTS_PARAM']);
  assert.equal(result.workflowName, 'ROUTE_PATIENTS_PARAM Workflow');
  assert.equal(result.skipped, false);
});

test('an event with no route and no matching rule still yields nothing', async () => {
  // Induction reads a URL. A click or a business event without one is not a place.
  const world = newWorld(null);
  const d = deps(world);
  const prisma = withProfile(d.prisma, 'HEALTHCARE');

  const result = await projectSessionIntoGraph({ ...d, prisma }, announcement([
    evt('BUTTON_CLICK', { buttonName: 'Save' }),
  ]));

  assert.equal(result.statesObserved, 0);
  assert.equal(result.workflowName, null);
});

test('an announcement whose payload was nulled re-loads its events', async () => {
  // A retried outbox row has had its payload cleared by an earlier delivery, so an
  // empty events array must never be read as "this session had no events".
  const world = newWorld(RULES);
  const d = deps(world);
  const prisma = withProfile(d.prisma, 'LMS');
  (prisma as any).session.findUnique = async () => ({
    tenantId: 'org-1', applicationId: 'app-1', environmentId: 'env-1', qaRunId: null, traceId: null,
    events: [{
      id: 'reloaded-1', sessionId: 'session-1', eventType: 'PAGE_VIEW', eventVersion: '1.0',
      source: 'frontend-sdk', timestamp: new Date('2026-09-29T12:00:00.000Z'),
      metadata: { url: 'https://lms.test/courses' },
    }],
  });

  const stripped = announcement([evt('PAGE_VIEW', { url: 'https://lms.test/courses' })]);
  delete stripped.events;

  const result = await projectSessionIntoGraph({ ...d, prisma }, stripped);
  assert.equal(result.statesObserved, 1);
  assert.equal(result.skipped, false);
});

test('the projection enriches the facet with the states it observed', async () => {
  // Completion writes the facet from raw events; only the projection knows which states
  // those events mapped to, because that depends on the application's rule set.
  const world = newWorld(RULES);
  const d = deps(world);
  const result = await projectSessionIntoGraph(
    { ...d, prisma: withProfile(d.prisma, 'LMS') },
    announcement([
      evt('PAGE_VIEW', { url: 'https://lms.test/courses' }),
      evt('PAGE_VIEW', { url: 'https://lms.test/quiz/start' }),
    ]),
  );

  assert.equal(result.statesObserved, 2);
  assert.equal(world.facetUpdates.length, 1);
  const data = world.facetUpdates[0].data;
  assert.deepEqual([...data.stateNames].sort(), ['COURSE_CATALOG', 'QUIZ_STARTED']);
  assert.deepEqual(data.workflowNames, ['QUIZ_STARTED Workflow']);
  assert.ok(data.projectedAt instanceof Date);
  // No declared terminal states, so no verdict on abandonment.
  assert.equal(data.abandoned, false);
});

// ─── Route induction (Stage 6) ────────────────────────────────────────────────

test('a route nobody wrote a rule for still becomes a state', async () => {
  // The whole point of induction. getRuleSet resolves exactly ECOMMERCE and LMS, so an
  // application whose routes nobody hand-wrote rules for produced no nodes at all --
  // which is why the observed graph was empty for real customers.
  const world = newWorld(null);
  const d = deps(world);
  const prisma = withProfile(d.prisma, 'HEALTHCARE');

  const result = await projectSessionIntoGraph({ ...d, prisma }, announcement([
    evt('PAGE_VIEW', { url: 'https://clinic.test/patients/42/chart' }),
  ]));

  assert.equal(result.statesObserved, 1);
  const names = [...world.states.values()].map((state) => state.name);
  assert.deepEqual(names, ['ROUTE_PATIENTS_PARAM_CHART']);
});

test('two record ids under the same route are one state, not two', async () => {
  // canonicalRouteFromPath collapsing identifiers is what keeps induction from producing
  // an unbounded family of states -- one per row the customer's database holds.
  const world = newWorld(null);
  const d = deps(world);
  const prisma = withProfile(d.prisma, 'HEALTHCARE');

  await projectSessionIntoGraph({ ...d, prisma }, announcement([
    evt('PAGE_VIEW', { url: 'https://clinic.test/patients/42/chart' }),
    evt('PAGE_VIEW', { url: 'https://clinic.test/patients/9001/chart' }),
  ]));

  assert.equal(world.states.size, 1);
  assert.equal([...world.states.values()][0].visitCount, 2);
});

test('a rule still outranks the route it would have been induced from', async () => {
  // Induction runs only where every rule declined, so a declared vocabulary is never
  // overridden by an inferred one.
  const world = newWorld(RULES);
  const d = deps(world);
  const prisma = withProfile(d.prisma, 'LMS');

  await projectSessionIntoGraph({ ...d, prisma }, announcement([
    evt('PAGE_VIEW', { url: 'https://lms.test/courses' }),
  ]));

  const names = [...world.states.values()].map((state) => state.name);
  assert.deepEqual(names, ['COURSE_CATALOG'], 'the rule name, not ROUTE_COURSES');
});

test('an induced state is marked as inferred, not as declared', async () => {
  // So a reader, and the declaration suggestion queue, can tell the two apart.
  const world = newWorld(null);
  const d = deps(world);
  const prisma = withProfile(d.prisma, 'HEALTHCARE');

  await projectSessionIntoGraph({ ...d, prisma }, announcement([
    evt('PAGE_VIEW', { url: 'https://clinic.test/appointments' }),
  ]));

  assert.equal([...world.states.values()][0].category, 'ROUTE');
});

test('the root path gets a name rather than an empty one', async () => {
  const world = newWorld(null);
  const d = deps(world);
  const prisma = withProfile(d.prisma, 'HEALTHCARE');

  await projectSessionIntoGraph({ ...d, prisma }, announcement([
    evt('PAGE_VIEW', { url: 'https://clinic.test/' }),
  ]));

  assert.deepEqual([...world.states.values()].map((s) => s.name), ['ROUTE_ROOT']);
});
