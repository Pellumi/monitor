import type { PrismaClient } from '@tellann/db';
import { canonicalRouteFromPath, type TellannEvent } from '@tellann/shared';
import { getRuleSet, reconstructRuleSet, type ApplicationRuleSet } from '@tellann/rules';
import { depsLogger, type SessionAnnouncement, type SessionCoreDeps } from './deps';
import { loadSessionEvents } from './load-session';
import { computeFlowFacets } from './facets';

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

/**
 * A state derived from the route itself, when no rule recognised it.
 *
 * This is the difference between a graph and an empty graph for a real customer.
 * `getRuleSet` resolves exactly two profile types -- ECOMMERCE and LMS -- and every call
 * site falls back to ECOMMERCE, so an application whose routes nobody hand-wrote rules
 * for produced no nodes at all, or worse, produced e-commerce state names for an LMS.
 *
 * Rules keep their precedence: this only runs when every one of them declined, so a
 * declared vocabulary is never overridden by an inferred one.
 *
 * `canonicalRouteFromPath` is what makes it safe. It collapses identifier-shaped segments
 * to `{param}`, so `/exams/17/edit` and `/exams/18/edit` are one state rather than an
 * unbounded family of them. It already existed in @tellann/shared and was used only by
 * endpoint-engine -- the observed graph never touched it, which is part of why the two
 * halves of the product described the same traffic differently.
 */
export function induceStateFromRoute(event: TellannEvent): { name: string; category: string } | null {
  if (event.eventType !== 'PAGE_VIEW' && event.eventType !== 'ROUTE_CHANGE') return null;

  const metadata = event.metadata ?? {};
  const raw = typeof metadata.url === 'string'
    ? metadata.url
    : typeof metadata.to === 'string' ? metadata.to : null;
  if (!raw) return null;

  let path: string;
  try {
    path = raw.startsWith('http') ? new URL(raw).pathname : raw;
  } catch {
    return null;
  }

  const canonical = canonicalRouteFromPath(path);
  if (!canonical) return null;

  // `/` is a real place -- most applications' entry point -- and needs a name that is not
  // the empty string.
  if (canonical === '/') return { name: 'ROUTE_ROOT', category: 'ROUTE' };

  // ROUTE_ prefixed, so an inferred node is distinguishable at a glance from a declared
  // one in the graph, in reconciliation, and in a suggestion queue. `{param}` becomes
  // PARAM rather than being dropped, because /users/{param} and /users/new are different
  // places and collapsing them would merge them.
  const name = `ROUTE_${canonical
    .replace(/\{param\}/g, 'PARAM')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()}`;

  return { name: name.slice(0, 120), category: 'ROUTE' };
}

/**
 * The state an event represents: a rule if one matches, otherwise the route.
 *
 * `sourceKind` travels with it so a reader, and the declaration suggestion queue, can tell
 * an inferred node from one someone actually declared.
 */
export function resolveStateForEvent(
  event: TellannEvent,
  ruleSet: ApplicationRuleSet | null,
  options: { induceRoutes?: boolean } = {},
): { name: string; category: string; sourceKind: 'EXPLICIT' | 'RULE' | 'ROUTE_INDUCED' } | null {
  if (event.eventType === 'STATE_ENTERED') {
    const explicit = extractState(event, ruleSet);
    if (explicit) return { ...explicit, sourceKind: 'EXPLICIT' };
  }

  const byRule = extractState(event, ruleSet);
  if (byRule) return { ...byRule, sourceKind: 'RULE' };

  if (options.induceRoutes === false) return null;
  const induced = induceStateFromRoute(event);
  return induced ? { ...induced, sourceKind: 'ROUTE_INDUCED' } : null;
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
  /** Every state this session touched, for the facet's filterable arrays. */
  const observedStateNames = new Set<string>();

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

      observedStateNames.add(explicit.fromState);
      observedStateNames.add(explicit.toState);
      previousStateId = toState.id;
      previousEventId = event.eventId;
      continue;
    }

    const stateInfo = resolveStateForEvent(event, ruleSet);
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

    observedStateNames.add(stateInfo.name);
    previousStateId = state.id;
    previousEventId = event.eventId;
  }

  const workflow = await discoverWorkflow(prisma, applicationId, sessionId, events, ruleSet);
  result.workflowName = workflow.name;
  result.workflowIsNewExecution = workflow.isNewExecution;

  // Completion wrote the facet; this fills in the half only the projection knows,
  // because a session's states depend on the application's rule set rather than on its
  // raw events. `abandoned` -- entered a flow and never reached a terminal state -- is
  // the question the product promises to answer and had no column behind it before.
  await enrichSessionFacet(prisma, {
    sessionId,
    applicationId,
    environmentId,
    stateNames: [...observedStateNames],
    workflowNames: workflow.name ? [workflow.name] : [],
  });

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
    const stateInfo = resolveStateForEvent(event, ruleSet);
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

/**
 * Fills in the flow-shaped facet fields after the observations exist.
 *
 * Terminal states come from the application's declared flows, because "did this session
 * finish what it started" is only meaningful against a declaration of what finishing
 * means. With no declared flow there are no terminals, so nothing is called abandoned —
 * which is the honest answer rather than calling every session a failure.
 */
async function enrichSessionFacet(
  prisma: PrismaClient,
  input: {
    sessionId: string;
    applicationId: string;
    environmentId: string | null;
    stateNames: string[];
    workflowNames: string[];
  },
): Promise<void> {
  const terminalNodes = await prisma.behaviorGraphNode.findMany({
    where: {
      role: 'TERMINAL',
      graph: {
        applicationId: input.applicationId,
        isActive: true,
        ...(input.environmentId
          ? { OR: [{ environmentId: input.environmentId }, { environmentId: null }] }
          : {}),
      },
    },
    select: { stateName: true },
  });

  const facets = computeFlowFacets({
    stateNames: input.stateNames,
    workflowNames: input.workflowNames,
    terminalStateNames: terminalNodes.map((node) => node.stateName),
  });

  // updateMany, not update: a session whose facet has not been written yet (projection
  // racing a backfill) must not throw here. Completion owns creating the row.
  await prisma.sessionFacet.updateMany({
    where: { sessionId: input.sessionId },
    data: { ...facets, projectedAt: new Date() },
  });
}
