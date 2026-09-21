# tellann (Python SDK)

Behaviour telemetry for Python services, matching `@tellann/backend-sdk` event
for event. A Flow that crosses a React page and a Django view reaches the
collector as one sequence.

```bash
python -m pip install tellann
```

## Initialize

```python
from tellann import TELLANN

TELLANN.initialize(
    endpoint="https://gateway.example.com",
    application_id="...",
    environment_id="...",
    api_key="...",
)
TELLANN.verify_installation()
```

Every argument falls back to an environment variable — `TELLANN_GATEWAY_URL`,
`TELLANN_INGESTION_KEY`, `TELLANN_APPLICATION_ID`, `TELLANN_ENVIRONMENT_ID` —
so `TELLANN.initialize()` with no arguments works wherever those are set. If
the endpoint or application id is missing the SDK disables itself rather than
raising: telemetry that is not configured must not stop an application booting.

## Frameworks

**Django** — add the middleware and initialize from `settings.py`:

```python
from tellann.integrations.django_middleware import instrument_django

instrument_django()

MIDDLEWARE = [
    "tellann.integrations.django_middleware.TellannMiddleware",
    # ... your middleware
]
```

**Flask** — attach to the application, including inside a factory:

```python
from tellann import instrument_flask

app = Flask(__name__)
instrument_flask(app)
```

**FastAPI / Starlette** — attach to the application:

```python
from tellann import instrument_fastapi

app = FastAPI()
instrument_fastapi(app)
```

Each integration reports the matched **route template** (`/invoices/{pk}`),
never the concrete path, so identifiers in URLs stay out of telemetry and the
graph sees one endpoint instead of one per request.

## Primitives

```python
TELLANN.track_api("POST", "/invoices/{pk}", 201, duration_ms=12.5)
TELLANN.track_state("AWAITING_PAYMENT", previous_state="DRAFT")
TELLANN.capture_error(error)
TELLANN.track_event("BUSINESS_EVENT", {"plan": "pro"})

with TELLANN.workflow("checkout") as workflow_id:
    charge(...)          # failure fails the workflow and re-raises
```

## Behaviour under load and failure

Delivery runs on a daemon thread behind a bounded queue. A collector that is
down, slow or unreachable costs a dropped event and nothing else — no blocked
request, no raised exception, no unbounded memory. Events larger than the
collector's 32 KB limit are dropped locally with a warning rather than sent and
discarded on the other side.

The package has **no runtime dependencies**; delivery uses only the standard
library, so it never conflicts with the versions an application has pinned.

## Development

```bash
python -m unittest discover -s tests
```
