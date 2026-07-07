import { initTracing } from '@sots/telemetry';
initTracing('graph-engine');

import { Kafka, EachMessagePayload } from 'kafkajs';
import { Services, Topics, ConsumerGroups, SotsEvent } from '@sots/shared';
import { PrismaClient } from '@sots/db';
import { getRuleSet, ApplicationRuleSet, reconstructRuleSet } from '@sots/rules';

const prisma = new PrismaClient();

const kafka = new Kafka({
  clientId: 'sots-graph-engine',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { retries: 5, initialRetryTime: 300 },
});

const consumer = kafka.consumer({ groupId: ConsumerGroups.GRAPH_ENGINE });

// Phase 1.5A: Config-driven State Extraction
function extractState(event: SotsEvent, ruleSet: ApplicationRuleSet | null): { name: string, category: string } | null {
  if (event.eventType === 'STATE_ENTERED') {
    const stateName = typeof event.metadata.stateName === 'string'
      ? event.metadata.stateName.trim()
      : '';
    if (stateName) {
      return {
        name: stateName.toUpperCase().replace(/\s+/g, '_'),
        category: typeof event.metadata.category === 'string'
          ? event.metadata.category.toUpperCase()
          : 'BUSINESS',
      };
    }
  }

  if (!ruleSet || !ruleSet.stateExtractors) return null;

  // Precedence 1: Business Event
  const eventRules = ruleSet.stateExtractors.filter(r => r.type === 'event');
  for (const rule of eventRules) {
    if (rule.type === 'event' && event.eventType === 'BUSINESS_EVENT' && event.metadata.businessEventType === rule.eventType) {
      return { name: rule.state, category: 'BUSINESS' };
    }
    if (rule.type === 'event' && event.eventType === rule.eventType) {
      return { name: rule.state, category: 'BUSINESS' };
    }
  }

  // Precedence 2: Metadata Match
  const metadataRules = ruleSet.stateExtractors.filter(r => r.type === 'metadata');
  for (const rule of metadataRules) {
    if (rule.type === 'metadata' && event.metadata[rule.field] === rule.equals) {
      return { name: rule.state, category: 'BUSINESS' };
    }
  }

  if (event.eventType === 'PAGE_VIEW') {
    const url = (event.metadata.url as string) || '';

    // Precedence 3: Regex Route
    const regexRules = ruleSet.stateExtractors.filter(r => r.type === 'routePattern');
    for (const rule of regexRules) {
      if (rule.type === 'routePattern' && rule.pattern.test(url)) {
        return { name: rule.state, category: 'BUSINESS' };
      }
    }

    // Precedence 4: Exact Route
    const exactRules = ruleSet.stateExtractors.filter(r => r.type === 'exactRoute');
    for (const rule of exactRules) {
      if (rule.type === 'exactRoute' && url.includes(rule.route)) {
        return { name: rule.state, category: 'BUSINESS' };
      }
    }
  }

  return null;
}

function extractExplicitTransition(event: SotsEvent): { fromState: string, toState: string, action: string } | null {
  if (event.eventType !== 'STATE_TRANSITION') return null;

  const fromState = typeof event.metadata.fromState === 'string'
    ? event.metadata.fromState.trim().toUpperCase().replace(/\s+/g, '_')
    : '';
  const toState = typeof event.metadata.toState === 'string'
    ? event.metadata.toState.trim().toUpperCase().replace(/\s+/g, '_')
    : '';

  if (!fromState || !toState) return null;

  return {
    fromState,
    toState,
    action: typeof event.metadata.action === 'string' && event.metadata.action.trim()
      ? event.metadata.action.trim().toUpperCase().replace(/\s+/g, '_')
      : 'NAVIGATE',
  };
}

async function upsertObservedState(applicationId: string, name: string, category: string, sessionId: string, event: SotsEvent) {
  let state = await prisma.state.findFirst({
    where: { applicationId, name }
  });

  if (!state) {
    state = await prisma.state.create({
      data: {
        applicationId,
        name,
        category,
        visitCount: 1
      }
    });
  } else {
    state = await prisma.state.update({
      where: { id: state.id },
      data: { visitCount: state.visitCount + 1 }
    });
  }

  await prisma.stateObservation.create({
    data: {
      stateId: state.id,
      sessionId,
      eventId: event.eventId,
      timestamp: new Date(event.timestamp)
    }
  });

  return state;
}

async function upsertObservedTransition(
  applicationId: string,
  fromStateId: string,
  toStateId: string,
  action: string,
  sessionId: string,
  fromEventId: string,
  toEventId: string,
  timestamp: Date
) {
  let transition = await prisma.transition.findFirst({
    where: {
      applicationId,
      fromStateId,
      toStateId,
      action
    }
  });

  if (!transition) {
    transition = await prisma.transition.create({
      data: {
        applicationId,
        fromStateId,
        toStateId,
        action,
        frequency: 1
      }
    });
  } else {
    transition = await prisma.transition.update({
      where: { id: transition.id },
      data: { frequency: transition.frequency + 1 }
    });
  }

  await prisma.transitionObservation.create({
    data: {
      transitionId: transition.id,
      sessionId,
      fromEventId,
      toEventId,
      timestamp
    }
  });

  return transition;
}

function extractAction(event: SotsEvent): string {
  if (event.eventType === 'BUTTON_CLICK') {
    return event.metadata.buttonName || event.metadata.elementId || event.metadata.id || 'BUTTON_CLICK';
  }
  if (event.eventType === 'FORM_SUBMIT' || event.eventType === 'FORM_SUBMITTED') {
    return event.metadata.formName || event.metadata.formId || event.metadata.id || 'FORM_SUBMIT';
  }
  return 'NAVIGATE';
}

async function processCompletedSession({ message }: EachMessagePayload) {
  if (!message.value) return;

  try {
    const sessionData = JSON.parse(message.value.toString());
    const events: SotsEvent[] = sessionData.events;
    const applicationId = sessionData.applicationId;

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

    if (!events || events.length === 0) return;

    let previousStateId: string | null = null;
    let previousEventId: string | null = null;

    for (const event of events) {
      const explicitTransition = extractExplicitTransition(event);
      if (explicitTransition) {
        const fromState = await upsertObservedState(
          applicationId,
          explicitTransition.fromState,
          'BUSINESS',
          sessionData.sessionId,
          { ...event, eventId: `${event.eventId}:from`, timestamp: event.timestamp }
        );
        const toState = await upsertObservedState(
          applicationId,
          explicitTransition.toState,
          'BUSINESS',
          sessionData.sessionId,
          event
        );

        await upsertObservedTransition(
          applicationId,
          fromState.id,
          toState.id,
          explicitTransition.action,
          sessionData.sessionId,
          `${event.eventId}:from`,
          event.eventId,
          new Date(event.timestamp)
        );

        previousStateId = toState.id;
        previousEventId = event.eventId;
        continue;
      }

      const stateInfo = extractState(event, ruleSet);
      if (!stateInfo) continue;

      const { name: stateName, category } = stateInfo;

      const state = await upsertObservedState(applicationId, stateName, category, sessionData.sessionId, event);

      // Phase 8B: Upsert Transition
      if (previousStateId && previousEventId) {
        const action = extractAction(event);

        await upsertObservedTransition(
          applicationId,
          previousStateId,
          state.id,
          action,
          sessionData.sessionId,
          previousEventId,
          event.eventId,
          new Date(event.timestamp)
        );
      }

      previousStateId = state.id;
      previousEventId = event.eventId;
    }
    
    // Workflow Discovery
    const pathNames: string[] = [];
    for (const event of events) {
      const explicitTransition = extractExplicitTransition(event);
      if (explicitTransition) {
        if (pathNames.length === 0 || pathNames[pathNames.length - 1] !== explicitTransition.fromState) {
          pathNames.push(explicitTransition.fromState);
        }
        if (pathNames[pathNames.length - 1] !== explicitTransition.toState) {
          pathNames.push(explicitTransition.toState);
        }
        continue;
      }

      const stateInfo = extractState(event, ruleSet);
      if (stateInfo) {
        if (pathNames.length === 0 || pathNames[pathNames.length - 1] !== stateInfo.name) {
          pathNames.push(stateInfo.name);
        }
      }
    }

    if (pathNames.length > 0) {
      const workflowName = `${pathNames[pathNames.length - 1]} Workflow`;
      
      const existingWorkflow = await prisma.workflow.findFirst({
        where: { applicationId, path: { equals: pathNames } }
      });

      if (!existingWorkflow) {
        await prisma.workflow.create({
          data: {
            applicationId,
            name: workflowName,
            path: pathNames,
            stateCount: pathNames.length,
            transitionCount: pathNames.length > 1 ? pathNames.length - 1 : 0,
            executionCount: 1
          }
        });
        console.log(`[GraphEngine] Discovered new workflow: ${workflowName}`);
      } else {
        await prisma.workflow.update({
          where: { id: existingWorkflow.id },
          data: { executionCount: existingWorkflow.executionCount + 1 }
        });
        console.log(`[GraphEngine] Updated workflow execution count: ${workflowName}`);
      }
    }

    // FDRS: Trigger auto-reconciliation incrementally (Phase D)
    globalThis.fetch(`http://localhost:${Services.FDRS_API}/applications/${applicationId}/reconciliation/run`, {
      method: 'POST',
    }).catch((err: any) => {
      console.warn('[GraphEngine] Failed to trigger auto-reconciliation:', err.message);
    });

    console.log(`[GraphEngine] Processed session ${sessionData.sessionId} into States, Transitions, & Workflows`);
  } catch (error) {
    console.error('[GraphEngine] Failed to process session', error);
  }
}

async function start() {
  if (process.env.KAFKA_ENABLED === 'false') {
    console.log('[GraphEngine] KAFKA_ENABLED=false — Kafka consumer not started (set KAFKA_ENABLED=true to enable)');
    return;
  }

  await consumer.connect();
  await consumer.subscribe({ topic: Topics.SESSIONS_COMPLETED, fromBeginning: true });

  console.log(`[GraphEngine] Started consuming ${Topics.SESSIONS_COMPLETED}`);

  await consumer.run({
    eachMessage: processCompletedSession,
  });

  process.on('SIGTERM', async () => {
    console.log('[GraphEngine] SIGTERM — disconnecting consumer');
    await consumer.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });
}

start().catch(console.error);
