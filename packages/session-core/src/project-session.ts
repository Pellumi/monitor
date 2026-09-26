import type { PrismaClient } from '@tellann/db';
import type { TellannEvent } from '@tellann/shared';
import { getRuleSet, reconstructRuleSet, type ApplicationRuleSet } from '@tellann/rules';
import { depsLogger, type SessionAnnouncement, type SessionCoreDeps } from './deps';
import { loadSessionEvents } from './load-session';

/**
 * Turning one completed session into observed states, transitions and workflows.
 *
 * Moved out of services/graph-engine so the Postgres transport can run it too.
 * graph-engine was a Kafka consumer with no HTTP surface at all, so the
 * alternative — having a worker call it over the network — would have meant
 * inventing a server, an auth convention and a second failure mode to reach code
 * that is already nothing but Prisma and @tellann/rules.
 *
 * Everything here is idempotent, which it previously was not. `visitCount + 1`,
 * `frequency + 1` and `executionCount + 1` were already inflated by every consumer
 * rebalance (`fromBeginning: true` replays the whole topic); now that a Kafka
 * consumer *and* a Postgres worker can both complete a session, and outbox
 * delivery is at-least-once, a repeat is the normal case rather than an accident.
 * So counters move only when an observation row is genuinely inserted.
 */

// ── State extraction (unchanged semantics, lifted verbatim) ──────────────────

export function extractState(
  event: TellannEvent,
  ruleSet: ApplicationRuleSet | null,
): { name: string; category: string } | null {
  if (event.eventType === 'STATE_ENTERED') {
    const stateName = typeof event.metadata.stateName === 'string' ? event.metadata.stateName.trim() : '';
    if (stateName) {
      return {
        name: normalizeStateName(stateName),
        category: typeof event.metadata.category === 'string'
          ? event.metadata.category.toUpperCase()
          : 'BUSINESS',
      };
    }
  }

  if (!ruleSet?.stateExtractors) return null;

  // Precedence 1: business event
  for (const rule of ruleSet.stateExtractors) {
    if (rule.type !== 'event') continue;
    if (event.eventType === 'BUSINESS_EVENT' && event.metadata.businessEventType === rule.eventType) {
      return { name: rule.state, category: 'BUSINESS' };
    }
    if (event.eventType === rule.eventType) {
      return { name: rule.state, category: 'BUSINESS' };
    }
  }

  // Precedence 2: metadata match
  for (const rule of ruleSet.stateExtractors) {
    if (rule.type === 'metadata' && event.metadata[rule.field] === rule.equals) {
      return { name: rule.state, category: 'BUSINESS' };
    }
  }

  if (event.eventType === 'PAGE_VIEW') {
    const url = (event.metadata.url as string) || '';

    // Precedence 3: regex route
    for (const rule of ruleSet.stateExtractors) {
      if (rule.type === 'routePattern' && rule.pattern.test(url)) {
        return { name: rule.state, category: 'BUSINESS' };
      }
    }

    // Precedence 4: exact route (substring, historically)
    for (const rule of ruleSet.stateExtractors) {
      if (rule.type === 'exactRoute' && url.includes(rule.route)) {
        return { name: rule.state, category: 'BUSINESS' };
      }
    }
  }

  return null;
}

export function normalizeStateName(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '_');
}

export function extractExplicitTransition(
  event: TellannEvent,
): { fromState: string; toState: string; action: string } | null {
  if (event.eventType !== 'STATE_TRANSITION') return null;

  const fromState = typeof event.metadata.fromState === 'string' ? normalizeStateName(event.metadata.fromState) : '';
  const toState = typeof event.metadata.toState === 'string' ? normalizeStateName(event.metadata.toState) : '';
  if (!fromState || !toState) return null;

  return {
    fromState,
    toState,
    action: typeof event.metadata.action === 'string' && event.metadata.action.trim()
      ? normalizeStateName(event.metadata.action)
      : 'NAVIGATE',
  };
}

export function extractAction(event: TellannEvent): string {
  if (event.eventType === 'BUTTON_CLICK') {
    return event.metadata.buttonName || event.metadata.elementId || event.metadata.id || 'BUTTON_CLICK';
  }
  if (event.eventType === 'FORM_SUBMIT' || event.eventType === 'FORM_SUBMITTED') {
    return event.metadata.formName || event.metadata.formId || event.metadata.id || 'FORM_SUBMIT';
  }
  return 'NAVIGATE';
}

// ── Idempotent upserts ───────────────────────────────────────────────────────

interface StateRow {
  id: string;
  inserted: boolean;
}

/**
 * The observed state for a name, created if absent.
 *
 * Was `findFirst` then `create`, which is a race: two sessions reaching a new state
 * at the same moment created two rows for it, and every later visit incremented
 * whichever one `findFirst` happened to return. `ON CONFLICT` against the unique
 * index makes the identity real.
 *
 * `xmax = 0` is the standard way to learn whether `ON CONFLICT` inserted or
 * updated, which is what decides below whether a counter may move.
 */
async function upsertObservedState(
  prisma: PrismaClient,
  applicationId: string,
  environmentId: string | null,
  name: string,
  category: string,
): Promise<StateRow> {
  const rows = await prisma.$queryRaw<Array<{ id: string; inserted: boolean }>>`
    INSERT INTO "State" ("id", "applicationId", "environmentId", "name", "category", "visitCount", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${applicationId}, ${environmentId}, ${name}, ${category}, 0, NOW(), NOW())
    ON CONFLICT ("applicationId", COALESCE("environmentId", '-'), "name")
      DO UPDATE SET "updatedAt" = NOW()
    RETURNING "id", (xmax = 0) AS "inserted"
  `;
  return { id: rows[0].id, inserted: rows[0].inserted };
}

async function upsertObservedTransition(
  prisma: PrismaClient,
  applicationId: string,
  environmentId: string | null,
  fromStateId: string,
  toStateId: string,
  action: string,
): Promise<StateRow> {
  const rows = await prisma.$queryRaw<Array<{ id: string; inserted: boolean }>>`
    INSERT INTO "Transition" ("id", "applicationId", "environmentId", "fromStateId", "toStateId", "action", "frequency", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${applicationId}, ${environmentId}, ${fromStateId}, ${toStateId}, ${action}, 0, NOW(), NOW())
    ON CONFLICT ("applicationId", COALESCE("environmentId", '-'), "fromStateId", "toStateId", COALESCE("action", ''))
      DO UPDATE SET "updatedAt" = NOW()
    RETURNING "id", (xmax = 0) AS "inserted"
  `;
  return { id: rows[0].id, inserted: rows[0].inserted };
}

/**
 * Records that a session observed a state, and moves `visitCount` only if that
 * observation is new.
 *
 * The observation is the fact; the counter is a cache of how many facts there are.
 * Incrementing unconditionally is what made a replayed topic inflate every number
 * in the product.
 */
async function recordStateObservation(
  prisma: PrismaClient,
  stateId: string,
  sessionId: string,
  eventId: string,
  timestamp: Date,
): Promise<boolean> {
  const { count } = await prisma.stateObservation.createMany({
    data: [{ stateId, sessionId, eventId, timestamp }],
    skipDuplicates: true,
  });
  if (count === 0) return false;
  await prisma.state.update({ where: { id: stateId }, data: { visitCount: { increment: 1 } } });
  return true;
}

async function recordTransitionObservation(
  prisma: PrismaClient,
  transitionId: string,
  sessionId: string,
  fromEventId: string,
  toEventId: string,
  timestamp: Date,
): Promise<boolean> {
  const { count } = await prisma.transitionObservation.createMany({
    data: [{ transitionId, sessionId, fromEventId, toEventId, timestamp }],
    skipDuplicates: true,
  });
  if (count === 0) return false;
  await prisma.transition.update({ where: { id: transitionId }, data: { frequency: { increment: 1 } } });
  return true;
}

// ── Rule set resolution ──────────────────────────────────────────────────────

async function resolveRuleSet(
  prisma: PrismaClient,
  applicationId: string,
): Promise<ApplicationRuleSet | null> {
  const profile = await prisma.applicationProfile.findUnique({ where: { applicationId } });
  const latestRuleset = await prisma.compiledRuleset.findFirst({
    where: { applicationId },
    orderBy: { compiledAt: 'desc' },
  });

  if (latestRuleset) {
    return reconstructRuleSet(latestRuleset.rules as any[], profile?.profileType || 'ECOMMERCE');
  }
  return getRuleSet(profile?.profileType || 'ECOMMERCE');
}

// ── The projection ───────────────────────────────────────────────────────────

export interface ProjectionResult {
  sessionId: string;
  statesObserved: number;
  transitionsObserved: number;
  newStates: number;
  newTransitions: number;
  workflowName: string | null;
  workflowIsNewExecution: boolean;
  skipped: boolean;
}

export interface ProjectionDeps extends Pick<SessionCoreDeps, 'prisma' | 'logger'> {
  /** Called after a successful projection. Absent in tests and in dry runs. */
  onProjected?: (applicationId: string) => void;
}

export async function projectSessionIntoGraph(
  deps: ProjectionDeps,
  announcement: SessionAnnouncement,
): Promise<ProjectionResult> {
  const { prisma } = deps;
  const logger = depsLogger(deps);
  const { sessionId, applicationId } = announcement;

  const result: ProjectionResult = {
    sessionId,
    statesObserved: 0,
    transitionsObserved: 0,
    newStates: 0,
    newTransitions: 0,
    workflowName: null,
    workflowIsNewExecution: false,
    skipped: false,
  };

  // A retried outbox row has had its payload nulled, so an empty events array means
  // "re-load", never "this session was empty".
  const events = announcement.events?.length
    ? announcement.events
    : await loadSessionEvents(prisma, sessionId);

  if (events.length === 0) {
    result.skipped = true;
    return result;
  }

  // Environment scoping is populated but not yet read (Stage 6 scopes the reads).
  // Writing it now means the backfill is already done when that lands.
  const environmentId = announcement.environmentId ?? null;
  const ruleSet = await resolveRuleSet(prisma, applicationId);

  let previousStateId: string | null = null;
  let previousEventId: string | null = null;

  for (const event of events) {
    const timestamp = new Date(event.timestamp);

    const explicit = extractExplicitTransition(event);
    if (explicit) {
      // A declared transition names both ends, so both become states. The `:from`
      // suffix keeps the two observations of one event distinguishable under the
      // (sessionId, eventId, stateId) unique index.
      const fromState = await upsertObservedState(prisma, applicationId, environmentId, explicit.fromState, 'BUSINESS');
      const toState = await upsertObservedState(prisma, applicationId, environmentId, explicit.toState, 'BUSINESS');
      if (fromState.inserted) result.newStates += 1;
      if (toState.inserted) result.newStates += 1;

      if (await recordStateObservation(prisma, fromState.id, sessionId, `${event.eventId}:from`, timestamp)) {
        result.statesObserved += 1;
      }
      if (await recordStateObservation(prisma, toState.id, sessionId, event.eventId, timestamp)) {
        result.statesObserved += 1;
      }

      const transition = await upsertObservedTransition(
        prisma, applicationId, environmentId, fromState.id, toState.id, explicit.action,
      );
      if (transition.inserted) result.newTransitions += 1;
      if (await recordTransitionObservation(
        prisma, transition.id, sessionId, `${event.eventId}:from`, event.eventId, timestamp,
      )) {
        result.transitionsObserved += 1;
      }

      previousStateId = toState.id;
      previousEventId = event.eventId;
      continue;
    }

    const stateInfo = extractState(event, ruleSet);
    if (!stateInfo) continue;

    const state = await upsertObservedState(prisma, applicationId, environmentId, stateInfo.name, stateInfo.category);
    if (state.inserted) result.newStates += 1;
    if (await recordStateObservation(prisma, state.id, sessionId, event.eventId, timestamp)) {
      result.statesObserved += 1;
    }

    if (previousStateId && previousEventId) {
      const transition = await upsertObservedTransition(
        prisma, applicationId, environmentId, previousStateId, state.id, extractAction(event),
      );
      if (transition.inserted) result.newTransitions += 1;
      if (await recordTransitionObservation(
        prisma, transition.id, sessionId, previousEventId, event.eventId, timestamp,
      )) {
        result.transitionsObserved += 1;
      }
    }

    previousStateId = state.id;
    previousEventId = event.eventId;
  }

  const workflow = await discoverWorkflow(prisma, applicationId, sessionId, events, ruleSet);
  result.workflowName = workflow.name;
  result.workflowIsNewExecution = workflow.isNewExecution;

  logger.log(
    `[session-core] Projected session ${sessionId}: `
    + `states=${result.statesObserved} (+${result.newStates} new) `
    + `transitions=${result.transitionsObserved} (+${result.newTransitions} new)`,
  );

  deps.onProjected?.(applicationId);
  return result;
}

/**
 * The path this session walked, as a workflow.
 *
 * `executionCount` is now derived from `WorkflowExecution` rather than incremented,
 * so a re-projected session cannot inflate it. The path-equality lookup this keeps
 * is the source of the workflow-row explosion Stage 6 replaces with `JourneyPath`;
 * it stays here unchanged so the existing /workflows page, coverage-engine's flow
 * counting and `MissingFlow.workflowId` keep working until their readers migrate.
 */
async function discoverWorkflow(
  prisma: PrismaClient,
  applicationId: string,
  sessionId: string,
  events: TellannEvent[],
  ruleSet: ApplicationRuleSet | null,
): Promise<{ name: string | null; isNewExecution: boolean }> {
  const pathNames: string[] = [];

  for (const event of events) {
    const explicit = extractExplicitTransition(event);
    if (explicit) {
      if (pathNames.length === 0 || pathNames[pathNames.length - 1] !== explicit.fromState) {
        pathNames.push(explicit.fromState);
      }
      if (pathNames[pathNames.length - 1] !== explicit.toState) {
        pathNames.push(explicit.toState);
      }
      continue;
    }
    const stateInfo = extractState(event, ruleSet);
    if (stateInfo && (pathNames.length === 0 || pathNames[pathNames.length - 1] !== stateInfo.name)) {
      pathNames.push(stateInfo.name);
    }
  }

  if (pathNames.length === 0) return { name: null, isNewExecution: false };

  const name = `${pathNames[pathNames.length - 1]} Workflow`;
  const existing = await prisma.workflow.findFirst({
    where: { applicationId, path: { equals: pathNames } },
  });

  const workflow = existing ?? await prisma.workflow.create({
    data: {
      applicationId,
      name,
      path: pathNames,
      stateCount: pathNames.length,
      transitionCount: pathNames.length > 1 ? pathNames.length - 1 : 0,
      executionCount: 0,
    },
  });

  const { count } = await prisma.workflowExecution.createMany({
    data: [{ workflowId: workflow.id, sessionId }],
    skipDuplicates: true,
  });
  if (count === 0) return { name: workflow.name, isNewExecution: false };

  await prisma.workflow.update({
    where: { id: workflow.id },
    data: { executionCount: { increment: 1 } },
  });
  return { name: workflow.name, isNewExecution: true };
}
