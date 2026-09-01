# @tellann/backend-sdk

Server-side telemetry and QA-run correlation SDK for Tellann. Tracks API requests,
server errors, state transitions, and workflow lifecycle events, and correlates them
with a frontend session/run/trace via inbound headers. Ships optional Express and
Fastify integrations.

## Install

```bash
npm install @tellann/backend-sdk
# or
pnpm add @tellann/backend-sdk
```

`express` and `fastify` are optional peer dependencies — install whichever framework
you use. The core API works without either.

## Quick start

```ts
import { TELLANN } from '@tellann/backend-sdk';

TELLANN.initialize({
  endpoint: 'https://collector.example.com',
  applicationId: 'my-api',
  environmentId: 'production',
  apiKey: '<server-key>', // optional
});

await TELLANN.trackApi({
  endpoint: '/orders',
  method: 'POST',
  statusCode: 201,
  durationMs: 42,
  sessionId, // optional, from x-tellann-session-id
});

await TELLANN.captureError({ error, eventType: 'SERVER_ERROR' });
await TELLANN.trackState({ /* TrackStateOptions */ });
```

Standalone helper functions are also exported and operate on the initialized singleton:

```ts
import { trackApi, captureError, trackState } from '@tellann/backend-sdk';
```

### Configuration (`TellannBackendConfig`)

| Option | Type | Notes |
| --- | --- | --- |
| `endpoint` | `string` | Collector base URL. |
| `applicationId` | `string` | Identifies the service. |
| `tenantId` | `string` | Optional; defaults to `'unknown'`. |
| `environmentId` | `string` | Optional environment identifier. |
| `apiKey` | `string` | Optional; sent as a bearer token. |
| `runId` / `sessionId` / `traceId` | `string` | Optional correlation IDs. |
| `agentVersion` / `instrumentationManifestVersion` | `string` | Optional correlation metadata. |

Individual events are capped at 32 KB.

## Express integration

```ts
import express from 'express';
import {
  tellannExpressMiddleware,
  tellannExpressErrorHandler,
} from '@tellann/backend-sdk';

const app = express();

app.use(tellannExpressMiddleware());     // extracts correlation context, times requests
// ... your routes ...
app.use(tellannExpressErrorHandler());   // captures errors (mount last)
```

The middleware populates `req.tellann` with `{ sessionId, runId, traceId }` extracted
from `x-tellann-session-id`, `x-tellann-run-id`, `x-tellann-trace-id`, and W3C
`traceparent` headers.

## Fastify integration

```ts
import Fastify from 'fastify';
import { tellannFastifyPlugin } from '@tellann/backend-sdk';

const fastify = Fastify();
await fastify.register(tellannFastifyPlugin);
```

The plugin adds `onResponse` and `onError` hooks that emit `API_REQUEST` and
`SERVER_ERROR` events with timing and correlation data.

## Workflows

```ts
const id = TELLANN.startWorkflow('nightly-reconcile', sessionId);
await TELLANN.completeWorkflow(id, sessionId);
// or failWorkflow(id, sessionId, reason)
```

## TypeScript

Types ship with the package. `TellannBackendConfig`, `TrackApiOptions`,
`CaptureErrorOptions`, `TrackStateOptions`, `EventType`, and `TellannEvent` are exported.

## License

`UNLICENSED` — see the repository for terms.
