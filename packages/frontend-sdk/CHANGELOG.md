# @tellann/frontend-sdk

## 0.2.0

### Minor Changes

- 1b74446: Add framework-state instrumentation adapters for QA capture.
  
  - `createReduxMiddleware()` records the action type, which top-level slice paths actually changed, and protected before/after values for those slices.
  - `trackContextValue(providerName, key, value)` reports a React Context value from a provider that has been explicitly approved in the validated Flow instrumentation manifest.
  - `trackStateSetter(componentName, key, setter, current)` wraps an approved `useState` setter so Flow-relevant state changes are recorded. Both are opt-in by design: there is no blanket interception of React internals, because that cannot be done reliably and would misreport what was actually captured.
  - `trackClientState(store, key, previous, next)` now attaches candidate protected values alongside its existing shape metadata.
  
  Captured values only leave the page while a desktop QA run credential is present and the run is not observation-only. Anything whose key looks like a secret is dropped before it is sent, and every candidate is re-classified and encrypted by the browser observer and the ingestion API before it is persisted — the page never decides its own privacy classification.
  
  Also enforces the event size limit against the caller's original payload rather than the redacted one, so a multi-kilobyte value can no longer slip through as an apparently small event just because the privacy layer replaced it with a marker.
