import assert from "node:assert/strict";
import test from "node:test";

import {
  buildQARunDesktopDeepLink,
  resolveQARunEnvironment,
  sanitizeQARunTargetUrl,
} from "./qa-run-handoff";

test("desktop handoff preserves the complete QA run context", () => {
  assert.equal(
    buildQARunDesktopDeepLink({
      applicationId: "app / one",
      environmentId: "env-1",
      workflowId: "flow&1",
      mode: "ASSISTED",
      targetUrl: "https://staging.example.test/orders?filter=open",
    }),
    "tellann://qa-runs/new?applicationId=app+%2F+one&environmentId=env-1&flowId=flow%261&mode=ASSISTED&targetUrl=https%3A%2F%2Fstaging.example.test%2Forders%3Ffilter%3D",
  );
});

test("handoff target URLs cannot carry credentials or query values", () => {
  assert.equal(sanitizeQARunTargetUrl("https://user:secret@example.test"), undefined);
  assert.equal(
    sanitizeQARunTargetUrl("https://example.test/path?token=secret&next=home#private"),
    "https://example.test/path?next=&token=",
  );
});

test("desktop handoff omits unavailable optional context", () => {
  assert.equal(
    buildQARunDesktopDeepLink({
      applicationId: "app-1",
      mode: "OBSERVATION_ONLY",
    }),
    "tellann://qa-runs/new?applicationId=app-1&mode=OBSERVATION_ONLY",
  );
});

const environments = [
  {
    id: "env-dev",
    name: "Development",
    type: "DEVELOPMENT",
    baseUrl: "http://localhost:3000",
    isDefault: true,
  },
  {
    id: "env-stage",
    name: "Staging",
    type: "STAGING",
    baseUrl: "https://staging.example.test",
    isDefault: false,
  },
];

test("explicit valid environment wins over the default", () => {
  assert.equal(
    resolveQARunEnvironment(environments, "env-stage")?.id,
    "env-stage",
  );
});

test("invalid or missing environment falls back to default then first", () => {
  assert.equal(resolveQARunEnvironment(environments, "unknown")?.id, "env-dev");
  assert.equal(
    resolveQARunEnvironment(
      environments.map((environment) => ({ ...environment, isDefault: false })),
    )?.id,
    "env-dev",
  );
});
