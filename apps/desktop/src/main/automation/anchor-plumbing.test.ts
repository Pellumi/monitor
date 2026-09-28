import assert from "node:assert/strict";
import test from "node:test";
import { anchorTargetsOfPlan, verifiedAnchors } from "./anchor-plumbing";
import type { PlanLike } from "./anchor-plumbing";

const anchorOp = (transitionId: string, relativePath: string, value = `tellann:${transitionId}`) => ({
  id: `anchor:${transitionId}`, transformId: "tellann.action.anchor", relativePath, startLine: 10, endLine: 12,
  anchorAttribute: { name: "data-tellann-action", value, element: "button" },
});
const plan = (...operations: ReturnType<typeof anchorOp>[]): PlanLike & { operations: typeof operations } => ({
  operations: [{ id: "package-sdk", transformId: "tellann.package", relativePath: "package.json" } as never, ...operations],
});
const files = (map: Record<string, string>) => (path: string) => map[path] ?? null;

test("an anchor is claimed only if it is in the file it was applied to, exactly once", () => {
  const anchors = verifiedAnchors([plan(anchorOp("t-create", "src/Course.tsx"), anchorOp("t-save", "src/Form.tsx"))], files({
    "src/Course.tsx": `<button data-tellann-action="tellann:t-create" onClick={go}>Create</button>`,
    "src/Form.tsx": `<button onClick={save}>Save</button>`,
  }));
  assert.deepEqual(anchors, { "t-create": "tellann:t-create" }, "t-save was rolled back or displaced, so it is not claimed");
});

test("an anchor that appears twice is ambiguous and is not trusted", () => {
  const twice = `<a data-tellann-action="tellann:t-create">A</a><b data-tellann-action="tellann:t-create">B</b>`;
  assert.deepEqual(verifiedAnchors([plan(anchorOp("t-create", "src/A.tsx"))], files({ "src/A.tsx": twice })), {});
});

test("a file that cannot be read claims nothing", () => {
  assert.deepEqual(verifiedAnchors([plan(anchorOp("t-create", "src/Gone.tsx"))], files({})), {});
});

test("anchors from more than one plan are combined, and a plan with none is harmless", () => {
  const anchors = verifiedAnchors(
    [plan(anchorOp("t-a", "src/A.tsx")), plan(), plan(anchorOp("t-b", "src/B.tsx"))],
    files({ "src/A.tsx": `<i data-tellann-action="tellann:t-a"/>`, "src/B.tsx": `<i data-tellann-action="tellann:t-b"/>` }),
  );
  assert.deepEqual(anchors, { "t-a": "tellann:t-a", "t-b": "tellann:t-b" });
});

test("an operation that is not an anchor is never mistaken for one", () => {
  const notAnchor = { id: "anchor:t-x", transformId: "tellann.semantic.checkpoint", relativePath: "src/X.tsx", startLine: 1, endLine: 1, anchorAttribute: { name: "data-tellann-action", value: "tellann:t-x", element: null } };
  assert.deepEqual(verifiedAnchors([{ operations: [notAnchor] }], files({ "src/X.tsx": `data-tellann-action="tellann:t-x"` })), {});
});

test("what a plan applied is described the way the adapter checks it", () => {
  assert.deepEqual(anchorTargetsOfPlan(plan(anchorOp("t-create", "src/Course.tsx"))), [
    { transitionId: "t-create", value: "tellann:t-create", file: "src/Course.tsx", startLine: 10, endLine: 12, element: "button", label: null },
  ]);
  assert.deepEqual(anchorTargetsOfPlan(plan()), []);
});
