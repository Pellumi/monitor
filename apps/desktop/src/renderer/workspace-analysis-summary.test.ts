import assert from "node:assert/strict";
import test from "node:test";
import { workspaceAnalysisSummary } from "./workspace-analysis-summary";

const snapshot = {
  routes: ["/old-a", "/old-b"],
  endpoints: [],
  documentation: ["README.md"],
};

test("uses current project analysis and documents instead of attach-time scan counts", () => {
  const summary = workspaceAnalysisSummary(snapshot, {
    status: "COMPLETED",
    entities: [
      { id: "route-a", type: "ui_route", name: "/courses" },
      { id: "route-a-copy", type: "ui_route", name: "/courses" },
      { id: "route-b", type: "ui_route", name: "/courses/:id" },
      { id: "endpoint", type: "endpoint", name: "GET /courses" },
    ],
    summary: { endpoints: 7 },
  }, 4);

  assert.deepEqual(summary, { routes: 2, endpoints: 7, documents: 4 });
});

test("keeps safe scan fallbacks until current project data is available", () => {
  assert.deepEqual(workspaceAnalysisSummary(snapshot, null, null), {
    routes: 2,
    endpoints: 0,
    documents: 1,
  });
  assert.deepEqual(workspaceAnalysisSummary(snapshot, {
    status: "PARSING",
    entities: [{ id: "partial", type: "ui_route", name: "/partial" }],
    summary: { endpoints: 9 },
  }, null), {
    routes: 2,
    endpoints: 0,
    documents: 1,
  });
});
