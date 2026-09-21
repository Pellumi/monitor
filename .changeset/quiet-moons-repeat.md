---
"@tellann/backend-sdk": minor
---

Add Koa and hapi integrations: `tellannKoaMiddleware()` and the
`tellannHapiPlugin` object, both reporting the matched route pattern rather
than the concrete request path so identifiers in URLs stay out of telemetry
and `/users/:id` remains one endpoint.

Both frameworks are typed structurally rather than against `@types/koa` and
`@hapi/hapi`, so installing this SDK still pulls in neither.

This release is required by the Koa and hapi instrumentation adapters, whose
generated module imports these two symbols from the published package.
