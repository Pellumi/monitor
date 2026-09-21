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
        return [json.loads(request.data.decode("utf-8")) for request in self.requests]


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


if __name__ == "__main__":
    unittest.main()
