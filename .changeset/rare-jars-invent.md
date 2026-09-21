---
"@tellann/frontend-sdk": minor
---

Route batched events through the desktop observer's local relay while a guided
run is active. Only the relay attaches the run-ingestion credential, and the
collector advances the Flow boundary solely for credentialed events, so a
`FLOW_INITIAL_STATE` flushed straight to the configured gateway was ingested as
ordinary telemetry and the run stayed at "Waiting for FLOW_INITIAL_STATE".

When `__TELLANN_RUN__.relayEndpoint` is present the SDK now targets the relay,
sends the run's bearer token instead of the configured API key, omits the
`x-tellann-environment-id` header (the relay re-derives it from the run
correlation, and sending it fails the relay's CORS preflight), and skips the
`sendBeacon` path since it cannot set auth headers.
