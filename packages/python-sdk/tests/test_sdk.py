"""Tests for the Python SDK.

They run against a fake opener rather than a live collector, so what is checked
is the contract the collector relies on: the envelope's shape, the headers, the
size limit, and the promise that instrumentation never raises into the
application it is instrumenting.
"""

from __future__ import annotations

import json
import sys
import threading
import unittest
from pathlib import Path
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from tellann import TELLANN, TellannBackend  # noqa: E402
from tellann.transport import EventTransport  # noqa: E402


class RecordingOpener:
    """Stands in for `urllib.request.urlopen`."""

    def __init__(self, fail: bool = False) -> None:
        self.requests: List[Any] = []
        self.fail = fail
        self.received = threading.Event()

    def __call__(self, request: Any, timeout: float | None = None) -> Any:
        self.requests.append(request)
        self.received.set()
        if self.fail:
            raise OSError("collector unreachable")

        class _Response:
            def __enter__(self_inner):
                return self_inner

            def __exit__(self_inner, *args):
                return False

        return _Response()

    def bodies(self) -> List[Dict[str, Any]]:
        """Bodies posted to the main event endpoint.

        Excludes the QA-evidence relay requests a request/error event can
        also produce (see `evidence_bodies`) so every existing assertion
        about "the event this call sent" keeps meaning exactly that, rather
        than also picking up its QA-evidence side effect.
        """
        return [
            json.loads(request.data.decode("utf-8"))
            for request in self.requests
            if request.full_url.endswith("/v1/events")
        ]

    def evidence_bodies(self) -> List[Dict[str, Any]]:
        """Events posted to the QA-evidence relay endpoint, if any.

        Flattened out of the `{"events": [...]}` batch envelope so a test can
        assert on one event the way it does for `bodies()`.
        """
        return [
            event
            for request in self.requests
            if "/qa-evidence/batch" in request.full_url
            for event in json.loads(request.data.decode("utf-8"))["events"]
        ]


def configured(opener: RecordingOpener) -> TellannBackend:
    client = TellannBackend()
    client.initialize(
        endpoint="https://gateway.example.com/",
        application_id="app-1",
        environment_id="env-1",
        api_key="tellann_secret",
        session_id="session-1",
        transport=EventTransport("https://gateway.example.com", "tellann_secret", opener=opener),
    )
    return client


class EventEnvelopeTest(unittest.TestCase):
    def test_event_matches_the_javascript_envelope(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        client.track_event("BUSINESS_EVENT", {"plan": "pro"})
        client.flush(timeout=3)

        (body,) = opener.bodies()
        self.assertEqual(body["eventType"], "BUSINESS_EVENT")
        self.assertEqual(body["applicationId"], "app-1")
        self.assertEqual(body["environmentId"], "env-1")
        self.assertEqual(body["sessionId"], "session-1")
        self.assertEqual(body["source"], "python-sdk")
        self.assertEqual(body["eventVersion"], "1.0")
        self.assertEqual(body["metadata"], {"plan": "pro"})
        self.assertTrue(body["timestamp"].endswith("Z"))
        # Every key the collector reads must be present, even when null.
        for key in ("eventId", "tenantId", "runId", "traceId", "agentVersion"):
            self.assertIn(key, body)
        client.teardown()

    def test_request_carries_the_correlation_headers(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        client.track_api("post", "/invoices/{pk}", 201, 12.5)
        client.flush(timeout=3)

        request = opener.requests[0]
        self.assertEqual(request.full_url, "https://gateway.example.com/v1/events")
        self.assertEqual(request.get_header("Authorization"), "Bearer tellann_secret")
        self.assertEqual(request.get_header("X-tellann-environment-id"), "env-1")
        self.assertEqual(request.get_header("X-tellann-session-id"), "session-1")

        body = opener.bodies()[0]
        self.assertEqual(body["eventType"], "API_REQUEST")
        self.assertEqual(body["metadata"]["method"], "POST")
        self.assertEqual(body["metadata"]["statusCode"], 201)
        client.teardown()

    def test_verify_installation_sends_the_initialization_event(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        client.verify_installation()
        client.flush(timeout=3)
        self.assertEqual(opener.bodies()[0]["eventType"], "TELLANN_INITIALIZED")
        client.teardown()


class QaEvidenceRelayTest(unittest.TestCase):
    """A process configured with a standing ingestion key — the case a
    deployed server is in, since it is never restarted just to hand the SDK a
    fresh per-run credential — also relays its backend evidence so a QA run
    picks it up without the server ever learning which run is in progress."""

    def test_a_request_is_relayed_as_qa_backend_request_evidence(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        client.track_api("post", "/invoices/{pk}", 201, 12.5, request_id="req-1")
        client.flush(timeout=3)

        (evidence,) = opener.evidence_bodies()
        self.assertEqual(evidence["eventType"], "QA_BACKEND_REQUEST")
        self.assertEqual(evidence["applicationId"], "app-1")
        self.assertEqual(evidence["environmentId"], "env-1")
        self.assertEqual(evidence["metadata"]["method"], "POST")
        self.assertEqual(evidence["metadata"]["statusCode"], 201)
        self.assertNotIn("runId", evidence)  # left for the server to resolve
        client.teardown()

    def test_a_server_error_is_relayed_as_qa_backend_error_evidence(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        client.capture_error(ValueError("boom"))
        client.flush(timeout=3)

        (evidence,) = opener.evidence_bodies()
        self.assertEqual(evidence["eventType"], "QA_BACKEND_ERROR")
        self.assertEqual(evidence["metadata"]["message"], "boom")
        client.teardown()

    def test_data_access_is_relayed_as_qa_backend_data_access_evidence(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        client.track_data_access("Invoice", "update")
        client.flush(timeout=3)

        (evidence,) = opener.evidence_bodies()
        self.assertEqual(evidence["eventType"], "QA_BACKEND_DATA_ACCESS")
        self.assertEqual(evidence["metadata"]["model"], "Invoice")
        client.teardown()

    def test_a_process_pointed_at_the_desktops_local_relay_is_not_relayed_twice(self) -> None:
        # The local relay only ever binds to loopback (`LocalRunRelay.start`);
        # its own `/v1/events` handling already turns this into evidence, so a
        # second post here would double it.
        opener = RecordingOpener()
        client = TellannBackend()
        client.initialize(
            endpoint="http://127.0.0.1:54832",
            application_id="app-1",
            environment_id="env-1",
            api_key="run-credential",
            session_id="session-1",
            transport=EventTransport("http://127.0.0.1:54832", "run-credential", opener=opener),
        )
        client.track_api("get", "/invoices", 200, 4.0)
        client.flush(timeout=3)

        self.assertEqual(opener.evidence_bodies(), [])
        client.teardown()


class ResilienceTest(unittest.TestCase):
    def test_an_uninitialized_client_is_silent_rather_than_raising(self) -> None:
        client = TellannBackend()
        self.assertFalse(client.is_initialized())
        client.track_event("BUSINESS_EVENT", {"a": 1})
        client.capture_error(ValueError("boom"))
        client.verify_installation()  # no endpoint configured; must not raise

    def test_missing_configuration_disables_rather_than_raises(self) -> None:
        client = TellannBackend()
        client.initialize(endpoint=None, application_id=None)
        self.assertFalse(client.is_initialized())

    def test_a_failing_collector_does_not_surface_to_the_caller(self) -> None:
        opener = RecordingOpener(fail=True)
        client = configured(opener)
        client.track_event("BUSINESS_EVENT", {})
        client.flush(timeout=3)
        self.assertEqual(client._transport.stats.failed, 1)
        client.teardown()

    def test_oversized_events_are_dropped_not_sent(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        client.track_event("BUSINESS_EVENT", {"blob": "x" * (33 * 1024)})
        client.flush(timeout=3)
        self.assertEqual(opener.requests, [])
        self.assertEqual(client._transport.stats.dropped_oversized, 1)
        client.teardown()

    def test_unserializable_metadata_is_dropped_not_raised(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        client.track_event("BUSINESS_EVENT", {"socket": object()})
        client.flush(timeout=3)
        self.assertEqual(opener.requests, [])
        client.teardown()


class WorkflowTest(unittest.TestCase):
    def test_a_workflow_reports_start_and_completion_with_a_duration(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        with client.workflow("checkout") as workflow_id:
            self.assertTrue(workflow_id)
        client.flush(timeout=3)

        started, completed = opener.bodies()
        self.assertEqual(started["eventType"], "WORKFLOW_STARTED")
        self.assertEqual(completed["eventType"], "WORKFLOW_COMPLETED")
        self.assertEqual(completed["metadata"]["workflowName"], "checkout")
        self.assertGreaterEqual(completed["metadata"]["durationMs"], 0)
        client.teardown()

    def test_a_raising_workflow_is_failed_and_the_error_still_propagates(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        with self.assertRaises(ValueError):
            with client.workflow("checkout"):
                raise ValueError("card declined")
        client.flush(timeout=3)

        failed = opener.bodies()[-1]
        self.assertEqual(failed["eventType"], "WORKFLOW_FAILED")
        self.assertEqual(failed["metadata"]["reason"], "card declined")
        client.teardown()


class CheckpointTest(unittest.TestCase):
    def test_checkpoint_carries_the_flow_identifiers(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        client.checkpoint(
            "cp-1",
            event_type="FLOW_INITIAL_STATE",
            state_id="state-1",
            flow_initialization_id="init-1",
        )
        client.flush(timeout=3)

        body = opener.bodies()[0]
        self.assertEqual(body["eventType"], "FLOW_INITIAL_STATE")
        self.assertEqual(body["metadata"]["checkpointId"], "cp-1")
        self.assertEqual(body["metadata"]["stateId"], "state-1")
        self.assertEqual(body["metadata"]["flowInitializationId"], "init-1")
        client.teardown()


class EnvironmentConfigurationTest(unittest.TestCase):
    def test_initialize_reads_the_environment_the_instrumenter_writes(self) -> None:
        import os

        previous = {key: os.environ.get(key) for key in (
            "TELLANN_GATEWAY_URL", "TELLANN_APPLICATION_ID", "TELLANN_ENVIRONMENT_ID"
        )}
        os.environ["TELLANN_GATEWAY_URL"] = "https://gateway.example.com"
        os.environ["TELLANN_APPLICATION_ID"] = "app-from-env"
        os.environ["TELLANN_ENVIRONMENT_ID"] = "env-from-env"
        try:
            client = TellannBackend()
            client.initialize()
            config = client.get_config()
            self.assertIsNotNone(config)
            self.assertEqual(config["application_id"], "app-from-env")
            self.assertEqual(config["environment_id"], "env-from-env")
            client.teardown()
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value


class SingletonTest(unittest.TestCase):
    def test_the_module_singleton_exists_and_starts_uninitialized(self) -> None:
        self.assertIsInstance(TELLANN, TellannBackend)


class AsgiMiddlewareTest(unittest.TestCase):
    def test_the_asgi_middleware_reports_the_route_template_and_status(self) -> None:
        import asyncio

        from tellann.integrations.asgi_middleware import TellannASGIMiddleware

        opener = RecordingOpener()
        client = configured(opener)

        class Route:
            path_format = "/invoices/{invoice_id}"

        async def application(scope, receive, send):
            scope["route"] = Route()
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"{}"})

        sent: List[Dict[str, Any]] = []

        async def send(message):
            sent.append(message)

        async def receive():
            return {"type": "http.request"}

        # The middleware reads the singleton, so the configured client is it.
        import tellann.integrations.asgi_middleware as module

        original = module.TELLANN
        module.TELLANN = client
        try:
            asyncio.run(
                TellannASGIMiddleware(application)(
                    {"type": "http", "method": "GET", "path": "/invoices/42"}, receive, send
                )
            )
            client.flush(timeout=3)
        finally:
            module.TELLANN = original

        self.assertEqual(sent[0]["status"], 200)
        body = opener.bodies()[0]
        self.assertEqual(body["eventType"], "API_REQUEST")
        self.assertEqual(body["metadata"]["route"], "/invoices/{invoice_id}")
        self.assertEqual(body["metadata"]["statusCode"], 200)
        client.teardown()

    def test_a_raising_application_still_propagates_through_the_middleware(self) -> None:
        import asyncio

        from tellann.integrations.asgi_middleware import TellannASGIMiddleware

        opener = RecordingOpener()
        client = configured(opener)

        async def application(scope, receive, send):
            raise RuntimeError("view exploded")

        async def send(message):
            return None

        async def receive():
            return {"type": "http.request"}

        import tellann.integrations.asgi_middleware as module

        original = module.TELLANN
        module.TELLANN = client
        try:
            with self.assertRaises(RuntimeError):
                asyncio.run(
                    TellannASGIMiddleware(application)(
                        {"type": "http", "method": "GET", "path": "/boom"}, receive, send
                    )
                )
            client.flush(timeout=3)
        finally:
            module.TELLANN = original

        kinds = [body["eventType"] for body in opener.bodies()]
        self.assertIn("SERVER_ERROR", kinds)
        client.teardown()


class DjangoMiddlewareTest(unittest.TestCase):
    def test_the_django_middleware_reports_the_matched_route(self) -> None:
        from tellann.integrations.django_middleware import TellannMiddleware

        opener = RecordingOpener()
        client = configured(opener)

        class Match:
            route = "invoices/<int:pk>/"

        class Request:
            method = "GET"
            path = "/invoices/42/"
            resolver_match = Match()

        class Response:
            status_code = 200

        import tellann.integrations.django_middleware as module

        original = module.TELLANN
        module.TELLANN = client
        try:
            response = TellannMiddleware(lambda request: Response())(Request())
            client.flush(timeout=3)
        finally:
            module.TELLANN = original

        self.assertEqual(response.status_code, 200)
        body = opener.bodies()[0]
        self.assertEqual(body["metadata"]["route"], "/invoices/<int:pk>/")
        client.teardown()


class BackendCaptureTest(unittest.TestCase):
    """What a backend QA run records about one handled request."""

    def test_a_request_carries_its_payload_without_its_credentials(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        client.track_api(
            "post",
            "/api/orders/<int:pk>",
            201,
            91.4,
            endpoint="/api/orders/8213",
            handler="orders.views.update",
            framework="django",
            query={"include": "items", "api_key": "live_abc123"},
            request_body={"note": "rush", "password": "hunter2"},
            response_body={"id": 8213, "status": "created"},
            request_headers={"content-type": "application/json", "cookie": "sid=1"},
            response_headers={"content-type": "application/json", "set-cookie": "sid=2"},
        )
        client.flush(timeout=3)

        metadata = opener.bodies()[0]["metadata"]
        self.assertEqual(metadata["route"], "/api/orders/<int:pk>")
        self.assertEqual(metadata["endpoint"], "/api/orders/8213")
        self.assertEqual(metadata["method"], "POST")
        self.assertEqual(metadata["handler"], "orders.views.update")
        self.assertEqual(metadata["responseBody"]["status"], "created")
        self.assertGreater(metadata["requestBytes"], 0)
        self.assertGreater(metadata["responseBytes"], 0)

        # Credentials never leave the process, wherever they appear.
        self.assertEqual(metadata["requestBody"]["password"], "[REDACTED]")
        self.assertEqual(metadata["query"]["api_key"], "[REDACTED]")
        self.assertEqual(metadata["requestBody"]["note"], "rush")
        self.assertNotIn("cookie", metadata["requestHeaders"])
        self.assertNotIn("set-cookie", metadata["responseHeaders"])
        self.assertEqual(metadata["requestHeaders"]["content-type"], "application/json")
        client.teardown()

    def test_capture_can_be_narrowed_without_losing_the_request(self) -> None:
        opener = RecordingOpener()
        client = TellannBackend()
        client.initialize(
            endpoint="https://gateway.example.com/",
            application_id="app-1",
            capture={"request_body": False, "response_body": False, "headers": False},
            transport=EventTransport("https://gateway.example.com", None, opener=opener),
        )
        client.track_api(
            "GET", "/api/orders", 200, 12,
            request_body={"note": "rush"},
            response_body=[{"id": 1}],
            request_headers={"content-type": "application/json"},
        )
        client.flush(timeout=3)

        metadata = opener.bodies()[0]["metadata"]
        self.assertNotIn("requestBody", metadata)
        self.assertNotIn("responseBody", metadata)
        self.assertNotIn("requestHeaders", metadata)
        # Sizes survive, so throughput is still reportable.
        self.assertGreater(metadata["requestBytes"], 0)
        client.teardown()

    def test_models_touched_while_a_request_is_in_flight_are_attached_to_it(self) -> None:
        from tellann.request_context import (
            enter_request_context,
            exit_request_context,
            new_request_context,
        )

        opener = RecordingOpener()
        client = configured(opener)
        context = new_request_context(method="POST", route="/api/orders/<int:pk>")
        token = enter_request_context(context)
        try:
            client.track_data_access("Order", "update", records=1)
            client.track_data_access("Order", "update", records=2)
            client.track_data_access("Payment", "select", records=3)
            client.flush(timeout=3)
            # Nothing is sent while the request is running: a view that queries
            # in a loop would otherwise produce a request's worth of events.
            self.assertEqual(opener.bodies(), [])
            client.track_api("POST", "/api/orders/<int:pk>", 200, 40)
            client.flush_data_access(context)
        finally:
            exit_request_context(token)
        client.flush(timeout=3)

        bodies = opener.bodies()
        request = next(body for body in bodies if body["eventType"] == "API_REQUEST")
        # One entry per model and operation, with the record counts summed.
        self.assertEqual(request["metadata"]["models"], [
            {"model": "Order", "operation": "update", "records": 3, "count": 2, "mutation": True},
            {"model": "Payment", "operation": "select", "records": 3, "count": 1, "mutation": False},
        ])

        data_events = [body for body in bodies if body["eventType"] == "BUSINESS_EVENT"]
        self.assertEqual(len(data_events), 2)
        self.assertEqual(data_events[0]["metadata"]["businessEventType"], "QA_BACKEND_DATA_ACCESS")
        self.assertEqual(data_events[0]["metadata"]["model"], "Order")
        self.assertEqual(data_events[0]["metadata"]["count"], 2)
        self.assertEqual(data_events[0]["metadata"]["records"], 3)
        self.assertTrue(data_events[0]["metadata"]["mutation"])
        self.assertEqual(data_events[0]["metadata"]["route"], "/api/orders/<int:pk>")
        self.assertFalse(data_events[1]["metadata"]["mutation"])
        client.teardown()

    def test_flushing_twice_does_not_double_report(self) -> None:
        from tellann.request_context import (
            enter_request_context,
            exit_request_context,
            new_request_context,
        )

        opener = RecordingOpener()
        client = configured(opener)
        context = new_request_context(method="GET", route="/api/orders")
        token = enter_request_context(context)
        try:
            client.track_data_access("Order", "select")
            client.flush_data_access(context)
            client.flush(timeout=3)
            self.assertEqual(len(opener.bodies()), 1)
            client.flush_data_access(context)
            client.flush(timeout=3)
            self.assertEqual(len(opener.bodies()), 1)
        finally:
            exit_request_context(token)
        client.teardown()

    def test_data_access_outside_a_request_is_reported_without_a_route(self) -> None:
        opener = RecordingOpener()
        client = configured(opener)
        # No request to attach to and nothing to flush it later, so it is sent now.
        client.track_data_access("Invoice", "delete", records=4)
        client.flush(timeout=3)
        metadata = opener.bodies()[0]["metadata"]
        self.assertIsNone(metadata["route"])
        self.assertTrue(metadata["mutation"])
        self.assertEqual(metadata["count"], 1)
        client.teardown()

    def test_an_oversized_payload_is_described_rather_than_truncated(self) -> None:
        from tellann.capture import resolve_capture_config, sanitize_payload

        capture = resolve_capture_config({"max_body_bytes": 256})
        clipped = sanitize_payload({"rows": [{"value": "x" * 100} for _ in range(20)]}, capture)
        self.assertTrue(clipped["truncated"])
        self.assertEqual(clipped["keys"], ["rows"])


class DjangoReadHookTest(unittest.TestCase):
    """Reads are taken from the shape of a statement and nothing else."""

    def test_a_select_reports_the_table_it_reads(self) -> None:
        from tellann.integrations.django_orm import table_read_by

        self.assertEqual(
            table_read_by('SELECT "orders_order"."id" FROM "orders_order" WHERE "orders_order"."id" = %s'),
            "orders_order",
        )
        self.assertEqual(table_read_by("select a.id from `orders` a"), "orders")

    def test_nothing_but_the_table_name_is_taken_from_a_statement(self) -> None:
        from tellann.integrations.django_orm import table_read_by

        # A literal in the statement must never come back out of it.
        table = table_read_by(
            "SELECT id FROM customers WHERE email = 'person@example.com' AND token = 'abc123'"
        )
        self.assertEqual(table, "customers")
        self.assertNotIn("person@example.com", table or "")
        self.assertNotIn("abc123", table or "")

    def test_writes_and_bookkeeping_are_left_to_the_signals(self) -> None:
        from tellann.integrations.django_orm import table_read_by

        # Writes come from model signals, which name the model rather than the
        # table, so the statement wrapper stays out of their way.
        for statement in (
            'INSERT INTO "orders_order" (id) VALUES (1)',
            'UPDATE "orders_order" SET total = 1',
            'DELETE FROM "orders_order"',
            "BEGIN",
            "COMMIT",
            "SAVEPOINT s1",
        ):
            self.assertIsNone(table_read_by(statement), statement)

        # Django's own tables are not the application's models.
        self.assertIsNone(table_read_by("SELECT * FROM django_session"))
        self.assertIsNone(table_read_by("SELECT 1"))
        self.assertIsNone(table_read_by(""))

    def test_a_read_is_recorded_against_the_request_and_never_sent_on_its_own(self) -> None:
        from tellann.integrations.django_orm import read_wrapper
        from tellann.request_context import (
            enter_request_context,
            exit_request_context,
            new_request_context,
        )

        opener = RecordingOpener()
        client = configured(opener)
        context = new_request_context(method="GET", route="/orders")
        token = enter_request_context(context)
        try:
            executed = []

            def execute(sql, params, many, ctx):
                executed.append(sql)
                return "rows"

            for _ in range(40):
                result = read_wrapper(execute, 'SELECT id FROM "orders_order"', None, False, {})
                self.assertEqual(result, "rows", "the wrapper returns what the query returned")

            self.assertEqual(len(executed), 40, "every statement still ran")
            client.flush(timeout=3)
            self.assertEqual(opener.bodies(), [], "reads are recorded, not sent one by one")

            client.flush_data_access(context)
            client.flush(timeout=3)
            bodies = opener.bodies()
            self.assertEqual(len(bodies), 1, "forty reads of one table are one row")
            self.assertEqual(bodies[0]["metadata"]["model"], "orders_order")
            self.assertEqual(bodies[0]["metadata"]["count"], 40)
            self.assertFalse(bodies[0]["metadata"]["mutation"])
        finally:
            exit_request_context(token)
        client.teardown()


if __name__ == "__main__":
    unittest.main()
