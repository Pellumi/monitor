type SnapshotCounts = {
  routes: unknown[];
  endpoints: unknown[];
  documentation: unknown[];
};

type AnalysisCounts = {
  status: string;
  entities: Array<{
    id: string;
    type: string;
    name: string;
    metadata?: Record<string, unknown>;
  }>;
  summary: { endpoints: number };
};

export type WorkspaceAnalysisSummary = {
  routes: number;
  endpoints: number;
  documents: number;
};

/**
 * Prefer the completed deep graph and the current project document collection.
 * The folder scan is deliberately only a fallback: it is a fast heuristic taken
 * when the folder is attached and does not change as either analysis finishes or
 * source documents are uploaded.
 */
export function workspaceAnalysisSummary(
  snapshot: SnapshotCounts,
  analysis: AnalysisCounts | null,
  documentCount: number | null,
): WorkspaceAnalysisSummary {
  const settled = analysis && ["COMPLETED", "PARTIAL"].includes(analysis.status)
    ? analysis
    : null;
  const routes = settled
    ? new Set(
        settled.entities
          .filter((entity) => entity.type === "ui_route")
          .map((entity) => {
            const route = entity.metadata?.route;
            return typeof route === "string" && route ? route : entity.name || entity.id;
          }),
      ).size
    : snapshot.routes.length;

  return {
    routes,
    endpoints: settled?.summary.endpoints ?? snapshot.endpoints.length,
    documents: documentCount ?? snapshot.documentation.length,
  };
}
