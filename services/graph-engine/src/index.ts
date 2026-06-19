import { Kafka, EachMessagePayload } from 'kafkajs';
import { Services, Topics, SotsEvent } from '@sots/shared';
import { PrismaClient } from '@sots/db';
import { getRuleSet, ApplicationRuleSet, reconstructRuleSet } from '@sots/rules';

const prisma = new PrismaClient();

const kafka = new Kafka({
  clientId: 'sots-graph-engine',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'graph-engine-group' });

// Phase 1.5A: Config-driven State Extraction
function extractState(event: SotsEvent, ruleSet: ApplicationRuleSet | null): { name: string, category: string } | null {
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

function extractAction(event: SotsEvent): string {
  if (event.eventType === 'BUTTON_CLICK') {
    return event.metadata.buttonName || event.metadata.id || 'BUTTON_CLICK';
  }
  if (event.eventType === 'FORM_SUBMIT') {
    return event.metadata.formName || event.metadata.id || 'FORM_SUBMIT';
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
      const stateInfo = extractState(event, ruleSet);
      if (!stateInfo) continue;

      const { name: stateName, category } = stateInfo;

      // Phase 8A: Upsert State
      let state = await prisma.state.findFirst({
        where: { applicationId, name: stateName }
      });

      if (!state) {
        state = await prisma.state.create({
          data: {
            applicationId,
            name: stateName,
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

      // Record State Observation
      await prisma.stateObservation.create({
        data: {
          stateId: state.id,
          sessionId: sessionData.sessionId,
          eventId: event.eventId,
          timestamp: new Date(event.timestamp)
        }
      });

      // Phase 8B: Upsert Transition
      if (previousStateId && previousEventId) {
        const action = extractAction(event);

        let transition = await prisma.transition.findFirst({
          where: {
            applicationId,
            fromStateId: previousStateId,
            toStateId: state.id,
            action
          }
        });

        if (!transition) {
          transition = await prisma.transition.create({
            data: {
              applicationId,
              fromStateId: previousStateId,
              toStateId: state.id,
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

        // Record Transition Observation
        await prisma.transitionObservation.create({
          data: {
            transitionId: transition.id,
            sessionId: sessionData.sessionId,
            fromEventId: previousEventId,
            toEventId: event.eventId,
            timestamp: new Date(event.timestamp)
          }
        });
      }

      previousStateId = state.id;
      previousEventId = event.eventId;
    }
    
    // Workflow Discovery
    const pathNames: string[] = [];
    for (const event of events) {
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
  await consumer.connect();
  await consumer.subscribe({ topic: Topics.SESSIONS_COMPLETED, fromBeginning: true });

  console.log(`[GraphEngine] Started consuming ${Topics.SESSIONS_COMPLETED}`);

  await consumer.run({
    eachMessage: processCompletedSession,
  });
}

start().catch(console.error);
