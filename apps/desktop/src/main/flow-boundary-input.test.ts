import assert from "node:assert/strict";
import test from "node:test";
import { boundaryRequestFor, isAdapterMarker, markerStateKey } from "./flow-boundary-input";

const PINNED = "33333333-3333-4333-8333-333333333333";
const active = { expectedGraphVersionId: PINNED };

const adapterMarker = (over: Record<string, unknown> = {}) => ({
  eventId: "e1", eventType: "FLOW_STATE_REACHED", timestamp: "2026-01-01T00:00:00.000Z",
  metadata: { checkpointId: "state:s-form", stateId: "s-form", transitionId: null, terminalKind: null, flowInitializationId: "init-1", source: "tellann-adapter", ...over },
});

test("an adapter marker, which names no Flow, is sent for the one Flow version the run is pinned to", () => {
  const { request, stateKey } = boundaryRequestFor(adapterMarker(), active);
  assert.equal(request.flowVersionId, PINNED);
  assert.equal(stateKey, "s-form", "the state it names, by id");
  assert.equal(request.stateKey, "s-form");
  assert.equal(request.eventType, "FLOW_STATE_REACHED");
  assert.equal(request.metadata.checkpointId, "state:s-form", "the marker itself is passed through untouched");
});

test("a marker that names a Flow version keeps it, even if it is the wrong one", () => {
  const { request } = boundaryRequestFor(adapterMarker({ flowVersionId: "some-other-version" }), active);
  assert.equal(request.flowVersionId, "some-other-version", "the platform refuses it; this does not correct it");
});

test("a marker that names its Flow by slug is left for the platform to match against the run's Flow", () => {
  const slug = { eventId: "e2", eventType: "FLOW_STATE_REACHED", metadata: { flow: "another-flow", state: "exam-form", source: "tellann-adapter" } };
  assert.equal(boundaryRequestFor(slug, active).request.flowVersionId, undefined, "not filled in: a slug for a different Flow must not be accepted by being given this run's version");
  const typed = { eventId: "e3", eventType: "FLOW_STATE_REACHED", metadata: { flowKey: "lms-flow", state: "exam-form" } };
  assert.equal(boundaryRequestFor(typed, active).request.flowVersionId, undefined);
});

test("only the adapter's own markers are given a version; a marker of unknown origin is not", () => {
  const stranger = { eventId: "e4", eventType: "FLOW_STATE_REACHED", metadata: { stateId: "s-form" } };
  assert.equal(boundaryRequestFor(stranger, active).request.flowVersionId, undefined);
  assert.equal(isAdapterMarker({ source: "tellann-adapter" }), true);
  assert.equal(isAdapterMarker({ source: "frontend-sdk" }), false);
  assert.equal(isAdapterMarker({}), false);
});

test("without a pinned version there is nothing to fill in", () => {
  assert.equal(boundaryRequestFor(adapterMarker(), { expectedGraphVersionId: null }).request.flowVersionId, undefined);
  assert.equal(boundaryRequestFor(adapterMarker(), {}).request.flowVersionId, undefined);
  assert.equal(boundaryRequestFor(adapterMarker(), { expectedGraphVersionId: "   " }).request.flowVersionId, undefined);
});

test("the state is read in the order the platform reads it", () => {
  assert.equal(markerStateKey({ stateKey: "a", toStateKey: "b", state: "c", stateId: "d" }), "a");
  assert.equal(markerStateKey({ stateKey: "  ", toStateKey: "b", state: "c" }), "b");
  assert.equal(markerStateKey({ state: "c", stateId: "d" }), "c");
  assert.equal(markerStateKey({ stateId: "d" }), "d");
  assert.equal(markerStateKey({}), "");
  assert.equal(markerStateKey({ stateId: 7 }), "7");
});

test("a transition marker keeps its from and to states", () => {
  const { request, stateKey } = boundaryRequestFor(
    { eventId: "e5", eventType: "FLOW_TRANSITION", metadata: { flowVersionId: PINNED, fromStateKey: "a", toStateKey: "b", action: "Save" } },
    active,
  );
  assert.equal(stateKey, "b");
  assert.equal(request.fromStateKey, "a");
  assert.equal(request.toStateKey, "b");
});

test("an event with no metadata at all does not throw", () => {
  const { request, stateKey } = boundaryRequestFor({ eventId: "e6", eventType: "FLOW_STATE_REACHED" }, active);
  assert.equal(stateKey, "");
  assert.equal(request.flowVersionId, undefined);
  assert.deepEqual(request.metadata, {});
});
