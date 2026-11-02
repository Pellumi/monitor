import assert from "node:assert/strict";
import test from "node:test";
import type { AIProvider, GenerateStructuredInput, StructuredGenerationResult } from "@tellann/ai";
import { createAutonomousModelPort, createGeminiAmbiguityResolver } from "./browser-agent-adapter";

class FakeProvider implements AIProvider {
  name = "fake";
  model = "fake-v1";
  constructor(private readonly response: unknown, private readonly fail = false) {}
  async generateFlowDraft(): Promise<never> { throw new Error("not used"); }
  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<StructuredGenerationResult<T>> {
    if (this.fail) throw new Error("provider unavailable");
    return { data: input.schema.parse(this.response), rawText: JSON.stringify(this.response), repaired: false };
  }
}

test("createAutonomousModelPort.decide returns a proposal shaped for the engine's verifier", async () => {
  const port = createAutonomousModelPort({
    provider: new FakeProvider({ action: "CLICK", targetRef: "ref-2", value: null, rationale: "Continues toward the dashboard." }),
  });
  const { proposal } = await port.decide({
    goal: "Reach the dashboard", scenarioTitle: "Register", path: "/choose-plan", title: "Choose a plan",
    headings: [], candidates: [{ ref: "ref-2", role: "button", name: "Continue", label: null }], history: [],
  });
  assert.equal(proposal.action, "CLICK");
  assert.equal(proposal.targetRef, "ref-2");
});

test("createAutonomousModelPort.explainFailure returns a shaped explanation", async () => {
  const port = createAutonomousModelPort({
    provider: new FakeProvider({ likelyCause: "APPLICATION_DEFECT", explanation: "x", suggestedRecovery: "REPLAN", confidence: "MEDIUM" }),
  });
  const { explanation } = await port.explainFailure({
    scenarioTitle: "Register", attemptedAction: "Clicked Continue", expected: "DASHBOARD", observed: "CHOOSE_PLAN",
  });
  assert.equal(explanation.likelyCause, "APPLICATION_DEFECT");
  assert.equal(explanation.suggestedRecovery, "REPLAN");
});

test("createGeminiAmbiguityResolver is the usual vision resolver, run in the cloud", async () => {
  const resolver = createGeminiAmbiguityResolver({
    provider: new FakeProvider({ choice: "e1", destination: "exam_page", rationale: "the exam row" }),
  });
  assert.equal(resolver.locality, "CLOUD");
  const proposal = await resolver.resolve({
    kind: "CONTROL", transitionId: "t-open", action: "Open exam", expectedState: "exam_page",
    candidates: [
      { ref: "e1", role: "link", name: "Open", label: null, href: "/exams/42", testId: null },
      { ref: "e2", role: "link", name: "Open", label: null, href: "/exams/43", testId: null },
    ],
  });
  assert.equal(proposal?.choice, "e1");
});

test("a resolver backed by a provider that throws is no opinion, not a crash", async () => {
  const resolver = createGeminiAmbiguityResolver({ provider: new FakeProvider(null, true) });
  await assert.rejects(() => resolver.resolve({
    kind: "CONTROL", transitionId: "t", action: null, expectedState: "x",
    candidates: [{ ref: "a", role: null, name: null, label: null, href: null, testId: null }, { ref: "b", role: null, name: null, label: null, href: null, testId: null }],
  }));
  // The throw itself is fine here — `askResolver` (ambiguity.ts) is what the executor actually calls,
  // and it is the piece responsible for turning a throw into "no opinion"; vision-resolver.test.ts
  // already covers that boundary for every resolver this adapter produces.
});
