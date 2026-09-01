# @tellann/frontend-sdk

Browser telemetry and QA-run correlation SDK for Tellann. Captures page views, clicks,
form submissions, route changes, errors, workflow lifecycle events, and custom business
events, then batches them to a Tellann collector endpoint.

## Install

```bash
npm install @tellann/frontend-sdk
# or
pnpm add @tellann/frontend-sdk
```

This is an ES module and targets modern browsers (`fetch`, `navigator.sendBeacon`, `Blob`).

## Quick start

```ts
import { TELLANN } from '@tellann/frontend-sdk';

TELLANN.initialize({
  endpoint: 'https://collector.example.com',
  applicationId: 'my-web-app',
  environmentId: 'production',
  apiKey: '<publishable-key>', // optional
  autoTrackClicks: true,   // default true
  autoTrackForms: true,    // default true
  autoTrackRoutes: true,   // default true
  errorTracking: true,     // default true
  debug: false,
});
```

`initialize` starts a session (emitting a `PAGE_VIEW`), wires up auto-tracking, and
begins a flush interval (`flushIntervalMs`, default 5000). Events are also flushed
immediately when the buffer reaches `maxBufferSize` (default 200).

## Configuration

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `endpoint` | `string` | – | Collector base URL. Events POST to `${endpoint}/v1/events/batch`. |
| `applicationId` | `string` | – | Identifies the app sending events. |
| `tenantId` | `string` | `'unknown'` | Optional tenant identifier. |
| `environmentId` | `string` | `null` | Sent as `x-tellann-environment-id`. |
| `apiKey` | `string` | – | Sent as `Authorization: Bearer`. Disables `sendBeacon` fallback. |
| `runId` / `sessionId` / `traceId` | `string` | generated | QA-run / trace correlation IDs. |
| `agentVersion` / `instrumentationManifestVersion` | `string` | `null` | Correlation metadata. |
| `autoTrackClicks` / `autoTrackForms` / `autoTrackRoutes` | `boolean` | `true` | DOM auto-instrumentation. |
| `errorTracking` | `boolean` | `true` | Capture uncaught errors and rejections. |
| `flushIntervalMs` | `number` | `5000` | Batch flush cadence. |
| `maxBufferSize` | `number` | `200` | Force a flush at this many buffered events. |
| `debug` | `boolean` | `false` | Verbose console logging. |

## Manual tracking API

```ts
TELLANN.trackEvent('PAGE_VIEW', { url: location.href });
TELLANN.trackBusinessEvent({ type: 'checkout_completed', payload: { total: 42 } });

TELLANN.trackState('cart_open', 'BUSINESS');
TELLANN.trackTransition('cart_open', 'checkout', 'NAVIGATE');

const wf = TELLANN.startWorkflow('signup');
TELLANN.completeWorkflow(wf);           // or failWorkflow(wf, reason) / cancelWorkflow(wf)

TELLANN.captureException(err, { route: '/checkout' });
TELLANN.captureMessage('payment provider slow', 'warning');
TELLANN.identifyUser('user_123', { plan: 'pro' });

await TELLANN.verifyInstallation();     // emits TELLANN_INITIALIZED and flushes
```

Call `TELLANN.teardown()` on unmount / page teardown to clear the flush interval,
detach auto-tracking listeners, and flush remaining events.

### Payload limits

- Standard event: 32 KB (oversized events are dropped with a console error).
- Replay events (`eventType` containing `REPLAY`): 128 KB.
- Batch payload: 5 MB (oversized batches are dropped).

Metadata is sanitized before send (privacy-by-default).

## TypeScript

Types ship with the package. `TellannConfig`, `EventType`, and `TellannEvent` are exported.

## License

`UNLICENSED` — see the repository for terms.
