import assert from "node:assert/strict";
import test from "node:test";
import { unresolvedOnPath } from "@tellann/automation-engine";
import type { CodebaseAnalysis } from "@tellann/desktop-contracts";
import { ContractPipelineError, prepareContract } from "./contract-pipeline";
import type { ContractInputs, ContractPipelineDeps, FlowVersionDocument, InitializationManifest } from "./contract-pipeline";
import type { KeyValueStore } from "./persona-store";

function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    read: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    write: (key, value) => { data.set(key, JSON.parse(JSON.stringify(value))); },
    list: (prefix) => [...data.keys()].filter((key) => key.startsWith(prefix)),
    delete: (key) => { data.delete(key); },
  };
}

const entity = (over: Record<string, unknown>) => ({ language: null, endLine: null, evidence: [], confidence: 0.9, startLine: 1, metadata: {}, ...over });

const analysis = (over: Partial<CodebaseAnalysis> = {}): CodebaseAnalysis => ({
  id: "analysis-1", status: "COMPLETED", contentHash: "c".repeat(64), graphVersion: "2.2.0",
  entities: [
    entity({ id: "route-course", type: "ui_route", name: "/courses/{param}", path: "src/pages/Course.tsx", metadata: { route: "/courses/{param}" } }),
    entity({ id: "route-form", type: "ui_route", name: "/courses/{param}/exams/new", path: "src/pages/NewExam.tsx", metadata: { route: "/courses/{param}/exams/new" } }),
    entity({ id: "route-created", type: "ui_route", name: "/courses/{param}/exams/{param}", path: "src/pages/Created.tsx", metadata: { route: "/courses/{param}/exams/{param}" } }),
    entity({ id: "route-login", type: "ui_route", name: "/login", path: "src/pages/Login.tsx", metadata: { route: "/login" } }),
    entity({ id: "form-login", type: "ui_form", name: "login", path: "src/pages/Login.tsx", metadata: { hasPasswordField: true, fields: [{ name: "email", label: "Email" }, { name: "password", label: "Password" }], submitControl: { labels: ["Sign in"] } } }),
    entity({ id: "action-create", type: "ui_action", name: "CreateExamButton", path: "src/pages/Course.tsx", startLine: 40, endLine: 42, metadata: { labels: ["Create Exam"], element: "button", event: "onClick" } }),
    entity({ id: "action-save", type: "ui_action", name: "SaveExamButton", path: "src/pages/NewExam.tsx", startLine: 60, endLine: 62, metadata: { labels: ["Save exam"], testId: "submit-exam", element: "button", event: "onClick" } }),
    entity({ id: "endpoint-exams", type: "endpoint", name: "POST /api/exams", path: "src/server/exams.ts", metadata: { method: "POST", route: "/api/exams" } }),
  ],
  relationships: [{ id: "r1", source: "action-save", target: "endpoint-exams", type: "CALLS", confidence: 1, evidence: [] }],
  ...over,
} as unknown as CodebaseAnalysis);

const versionDoc = (): FlowVersionDocument => ({
  states: [
    { id: "s-course", stateName: "Course Details", behaviorKey: "course_details", role: "INITIAL" },
    { id: "s-form", stateName: "Exam Form", behaviorKey: "exam_form", role: "NORMAL" },
    { id: "s-created", stateName: "Exam Created", behaviorKey: "exam_created", role: "TERMINAL", terminalKind: "SUCCESS" },
  ],
  transitions: [
    { id: "t-create", fromStateId: "s-course", toStateId: "s-form", action: "Create Exam" },
    { id: "t-submit", fromStateId: "s-form", toStateId: "s-created", action: "Save exam", expectedInput: [{ name: "title", label: "Title", dataKey: "examTitle" }] },
  ],
});

const checkpoint = (id: string, entityId: string | null, status = "RESOLVED") => ({ id, mapping: { status, entityId, file: "src/x.tsx", symbol: "x" } });
const manifest = (): InitializationManifest => ({
  checkpoints: [
    checkpoint("state:s-course", "route-course"), checkpoint("state:s-form", "route-form"), checkpoint("state:s-created", "route-created"),
    checkpoint("transition:t-create", "action-create"), checkpoint("transition:t-submit", "action-save"),
  ],
});

const inputs = (over: Partial<ContractInputs> = {}): ContractInputs => ({
  applicationId: "11111111-1111-4111-8111-111111111111", flowId: "f1", flowVersionId: "v1", flowInitializationId: "i1", loginRoute: null, ...over,
});

function deps(over: Partial<ContractPipelineDeps> = {}) {
  const fetched = { version: 0, manifest: 0 };
  const store = memoryStore();
  const built: ContractPipelineDeps = {
    fetchFlowVersion: async () => { fetched.version += 1; return versionDoc(); },
    fetchManifest: async () => { fetched.manifest += 1; return manifest(); },
    loadAnalysis: () => analysis(),
    cache: store,
    ...over,
  };
  return { deps: built, fetched, store };
}

test("the published Flow, its mapping and the analysis compile into a contract with a control for every step", async () => {
  const { deps: d } = deps();
  const prepared = await prepareContract(inputs(), d);
  assert.equal(prepared.contract.initialStateKey, "course_details");
  assert.deepEqual(prepared.contract.states.map((state) => state.key), ["course_details", "exam_form", "exam_created"]);
  assert.deepEqual(prepared.contract.transitions.map((transition) => [transition.id, transition.control?.labels[0]]), [["t-create", "Create Exam"], ["t-submit", "Save exam"]]);
  assert.deepEqual(unresolvedOnPath(prepared.contract, "exam_created", "STAGING"), []);
  assert.equal(prepared.contract.states[0]!.routePatterns[0], "/courses/{param}");
  assert.equal(prepared.contract.transitions[1]!.expectedApi[0]!.route, "/api/exams");
});

test("what leaves the machine about it is a hash and counts, not a name from the source", async () => {
  const { deps: d } = deps();
  const { summary } = await prepareContract(inputs(), d);
  assert.deepEqual({ ...summary, hash: "x", flowHash: "x" }, { hash: "x", flowHash: "x", analysisIdentity: "c".repeat(64), states: 3, transitions: 2, controlsDerived: 2, controlsMissing: 0, anchored: 0 });
  assert.match(summary.hash, /^[0-9a-f]{64}$/);
  const serialised = JSON.stringify(summary);
  for (const leak of ["src/", "Create Exam", "Save exam", "SaveExamButton", "submit-exam"]) assert.ok(!serialised.includes(leak), leak);
});

test("the hash is the same for the same inputs and changes when what would be run changes", async () => {
  const a = await prepareContract(inputs(), deps().deps);
  const b = await prepareContract(inputs(), deps().deps);
  assert.equal(a.summary.hash, b.summary.hash);
  const anchored = await prepareContract(inputs({ anchors: { "t-create": "tellann:t-create" } }), deps().deps);
  assert.notEqual(anchored.summary.hash, a.summary.hash);
  assert.equal(anchored.summary.anchored, 1);
  assert.equal(anchored.contract.transitions[0]!.control!.actionAnchor, "tellann:t-create");
});

test("the Flow and its mapping are fetched once, then read from this machine, because neither can change", async () => {
  const { deps: d, fetched } = deps();
  const first = await prepareContract(inputs(), d);
  const second = await prepareContract(inputs(), d);
  assert.deepEqual(fetched, { version: 1, manifest: 1 });
  assert.deepEqual(first.sources, { flowVersion: "PLATFORM", manifest: "PLATFORM" });
  assert.deepEqual(second.sources, { flowVersion: "CACHE", manifest: "CACHE" });
  assert.equal(first.summary.hash, second.summary.hash);
});

test("the cache is per Flow version and per initialization, so another run never reads the wrong one", async () => {
  const { deps: d, fetched } = deps();
  await prepareContract(inputs(), d);
  await prepareContract(inputs({ flowVersionId: "v2" }), d);
  await prepareContract(inputs({ flowInitializationId: "i2" }), d);
  assert.deepEqual(fetched, { version: 2, manifest: 2 });
});

test("the analysis is never cached: it is the folder as it is now", async () => {
  let current = analysis();
  const { deps: d } = deps({ loadAnalysis: () => current });
  const before = await prepareContract(inputs(), d);
  current = analysis({ contentHash: "d".repeat(64) } as Partial<CodebaseAnalysis>);
  const after = await prepareContract(inputs(), d);
  assert.equal(before.contract.analysisIdentity, "c".repeat(64));
  assert.equal(after.contract.analysisIdentity, "d".repeat(64));
});

test("no analysis yet, or one still running, is said plainly and nothing is fetched", async () => {
  for (const loadAnalysis of [() => null, () => analysis({ status: "PARSING" } as Partial<CodebaseAnalysis>)]) {
    const { deps: d, fetched } = deps({ loadAnalysis });
    await assert.rejects(prepareContract(inputs(), d), (error: unknown) => error instanceof ContractPipelineError && error.code === "CODE_ANALYSIS_REQUIRED" && /Analyse it from the Applications page/.test(error.message));
    assert.deepEqual(fetched, { version: 0, manifest: 0 });
  }
  const partial = deps({ loadAnalysis: () => analysis({ status: "PARTIAL" } as Partial<CodebaseAnalysis>) });
  assert.ok(await prepareContract(inputs(), partial.deps), "a partial analysis is enough to try");
});

test("a Flow that has not been mapped to the code is refused, and a miss is not remembered", async () => {
  const { deps: d, store } = deps({ fetchManifest: async () => null });
  await assert.rejects(prepareContract(inputs(), d), (error: unknown) => error instanceof ContractPipelineError && error.code === "FLOW_MAPPING_REQUIRED");
  assert.equal([...store.data.keys()].some((key) => key.startsWith("automation-flow-manifest:")), false);
  const empty = deps({ fetchManifest: async () => ({ checkpoints: [] }) });
  await assert.rejects(prepareContract(inputs(), empty.deps), /has not been mapped/);
});

test("a Flow version that cannot be read is refused", async () => {
  await assert.rejects(prepareContract(inputs(), deps({ fetchFlowVersion: async () => ({ states: [], transitions: [] }) }).deps), (error: unknown) => error instanceof ContractPipelineError && error.code === "FLOW_INVALID");
});

test("a mapping that never recorded a status, or an entity, resolves to nothing rather than to a guess", async () => {
  const legacy: InitializationManifest = { checkpoints: manifest().checkpoints.map((item) => ({ id: item.id, mapping: { file: "src/x.tsx", symbol: "x" } })) };
  const prepared = await prepareContract(inputs(), deps({ fetchManifest: async () => legacy }).deps);
  assert.equal(prepared.summary.controlsMissing, 2);
  assert.deepEqual(unresolvedOnPath(prepared.contract, "exam_created", "STAGING")!.map((step) => step.id), ["t-create", "t-submit"]);
});

test("a login route a person confirmed becomes an explicit login step; without one, none is guessed", async () => {
  const withLogin = await prepareContract(inputs({ loginRoute: "/login" }), deps().deps);
  assert.equal(withLogin.login, "BUILT");
  const edge = withLogin.navigation.edges.find((candidate) => candidate.login);
  assert.ok(edge);
  assert.equal(edge!.from, "/login");
  assert.deepEqual(edge!.login!.map((field) => field.dataKey), ["email", "password"]);
  assert.ok(withLogin.navigation.nodes.includes("/login"));

  const without = await prepareContract(inputs(), deps().deps);
  assert.equal(without.login, "NOT_CONFIGURED");
  assert.equal(without.navigation.edges.some((candidate) => candidate.login), false);
});

test("a login route with no sign-in form on it says so, instead of building a step that would type into nothing", async () => {
  const prepared = await prepareContract(inputs({ loginRoute: "/somewhere-else" }), deps().deps);
  assert.equal(prepared.login, "NO_FORM_FOUND");
  assert.equal(prepared.navigation.edges.some((candidate) => candidate.login), false);
});
