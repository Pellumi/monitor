import express, { Request, Response } from 'express';
import { Kafka } from 'kafkajs';
import { SotsEventSchema, EventBatchSchema, Topics } from '@sots/shared';

const app = express();
app.use(express.json({ limit: '5mb' }));

const MAX_EVENT_SIZE = 32 * 1024; // 32 KB
const MAX_REPLAY_SIZE = 128 * 1024; // 128 KB

const kafka = new Kafka({
  clientId: 'sots-event-collector',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092']
});

const producer = kafka.producer();

function applyGatewayIdentity<T extends { tenantId: string; applicationId: string }>(
  event: T,
  req: Request
): T & { environmentId: string | null } {
  const orgId = req.headers['x-sots-org-id'] as string | undefined;
  const applicationId = req.headers['x-sots-application-id'] as string | undefined;
  const environmentId = req.headers['x-sots-environment-id'] as string | undefined;

  return {
    ...event,
    tenantId: orgId || event.tenantId,
    applicationId: applicationId || event.applicationId,
    environmentId: environmentId || null,
  };
}

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy' });
});

app.post('/v1/events', async (req: Request, res: Response) => {
  try {
    const eventJson = JSON.stringify(req.body);
    const eventSize = Buffer.byteLength(eventJson, 'utf8');
    const eventType = req.body?.eventType;
    const limit = (typeof eventType === 'string' && eventType.includes('REPLAY')) 
      ? MAX_REPLAY_SIZE 
      : MAX_EVENT_SIZE;

    if (eventSize > limit) {
      return res.status(413).json({ 
        error: `Event payload size (${eventSize} bytes) exceeds limit of ${limit} bytes` 
      });
    }

    const event = SotsEventSchema.parse(req.body);
    const eventWithEnv = applyGatewayIdentity(event, req);
    
    await producer.send({
      topic: Topics.TELEMETRY_EVENTS,
      messages: [
        { key: event.sessionId, value: JSON.stringify(eventWithEnv) }
      ],
    });
    
    res.status(202).json({ accepted: true, eventCount: 1 });
  } catch (error) {
    res.status(400).json({ error: 'Invalid event payload' });
  }
});

app.post('/v1/events/batch', async (req: Request, res: Response) => {
  try {
    const events = EventBatchSchema.parse(req.body);
    
    if (events.length === 0) {
      return res.status(202).json({ accepted: true, eventCount: 0 });
    }

    const validEvents = events.filter(event => {
      const eventJson = JSON.stringify(event);
      const eventSize = Buffer.byteLength(eventJson, 'utf8');
      const limit = event.eventType.includes('REPLAY') ? MAX_REPLAY_SIZE : MAX_EVENT_SIZE;
      if (eventSize > limit) {
        console.warn(
          `[Collector] Discarding event of type ${event.eventType} in batch: size ${eventSize} bytes exceeds limit of ${limit} bytes`
        );
        return false;
      }
      return true;
    });

    if (validEvents.length === 0) {
      return res.status(413).json({ error: 'All events in batch exceeded size limit constraints' });
    }

    const messages = validEvents.map(event => ({
      key: event.sessionId,
      value: JSON.stringify(applyGatewayIdentity(event, req))
    }));

    await producer.send({
      topic: Topics.TELEMETRY_EVENTS,
      messages,
    });
    
    res.status(202).json({ accepted: true, eventCount: validEvents.length });
  } catch (error) {
    res.status(400).json({ error: 'Invalid event batch payload' });
  }
});

const PORT = process.env.PORT || 3001;

async function start() {
  await producer.connect();
  app.listen(PORT, () => {
    console.log(`Event Collector running on port ${PORT}`);
  });
}

start().catch(console.error);
