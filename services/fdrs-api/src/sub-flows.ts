/**
 * Reusing a flow inside another.
 *
 * A state can stand for a whole other flow (`subFlowId`): "SIGN_IN" is declared once
 * and every flow that starts signed in uses it, instead of redrawing
 * GUEST → LOGIN_PAGE → DASHBOARD each time.
 *
 * The reference lives on the draft. At publish it is *expanded*: the states of the
 * reused flow's published version are copied into this flow's snapshot, so a
 * published version is self-contained. That is what makes it safe to run, initialise
 * and diff exactly as any other flow, and it is why a reused flow can be edited and
 * republished later without changing a flow that already used it (that flow keeps the
 * version it expanded until it is published again).
 *
 * Expansion rules:
 *   - the call state disappears; its copy of the reused flow takes its place
 *   - every edge that led into the call state now leads into the reused flow's start
 *   - every edge that left the call state now leaves each of the reused flow's
 *     successful endings, so a failed sign-in stays a dead end inside the flow
 *   - the reused flow's start is this flow's start only if the call state was
 *   - copied states are named `<CALL>_<STATE>` so nothing collides
 *
 * Only published versions are expanded, and a published version is already
 * expanded, so nesting needs no recursion and a cycle cannot form.
 */

export interface GraphNodeRow {
  id: string;
  stateName: string;
  role?: string | null;
  terminalKind?: string | null;
  subFlowId?: string | null;
  [column: string]: unknown;
}

export interface GraphEdgeRow {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  [column: string]: unknown;
}

export interface SubFlowSource {
  flowId: string;
  name: string;
  versionId: string;
  version: number;
  states: GraphNodeRow[];
  transitions: GraphEdgeRow[];
}

export interface SubFlowIssue {
  code: 'SUBFLOW_SELF_REFERENCE' | 'SUBFLOW_NOT_PUBLISHED' | 'SUBFLOW_NO_ENTRY' | 'SUBFLOW_NO_EXIT';
  message: string;
  nodeIds: string[];
}

export interface ExpandedSubFlow {
  nodeId: string;
  stateName: string;
  flowId: string;
  name: string;
  versionId: string;
  version: number;
}

export interface ExpandedGraph {
  states: GraphNodeRow[];
  transitions: GraphEdgeRow[];
  subFlows: ExpandedSubFlow[];
  issues: SubFlowIssue[];
}

const isSuccessEnd = (node: GraphNodeRow) => node.role === 'TERMINAL' && (node.terminalKind ?? 'SUCCESS') === 'SUCCESS';

export function expandSubFlows(
  graph: { id: string; nodes: GraphNodeRow[]; edges: GraphEdgeRow[] },
  sources: ReadonlyMap<string, SubFlowSource>,
): ExpandedGraph {
  const calls = graph.nodes.filter((node) => node.subFlowId);
  if (calls.length === 0) return { states: graph.nodes, transitions: graph.edges, subFlows: [], issues: [] };

  const issues: SubFlowIssue[] = [];
  const subFlows: ExpandedSubFlow[] = [];
  const copiedStates: GraphNodeRow[] = [];
  const copiedEdges: GraphEdgeRow[] = [];
  const entryOf = new Map<string, string>();
  const exitsOf = new Map<string, string[]>();
  /** Call states that could not be expanded stay as ordinary states so the graph is still whole. */
  const unexpanded = new Set<string>();

  for (const call of calls) {
    const problem = (code: SubFlowIssue['code'], message: string) => {
      issues.push({ code, message, nodeIds: [call.id] });
      unexpanded.add(call.id);
    };
    if (call.subFlowId === graph.id) {
      problem('SUBFLOW_SELF_REFERENCE', `${call.stateName} uses the flow it belongs to.`);
      continue;
    }
    const source = sources.get(call.subFlowId!);
    if (!source) {
      problem('SUBFLOW_NOT_PUBLISHED', `${call.stateName} uses a flow that is not published. Publish it first, or remove the reference.`);
      continue;
    }
    const starts = source.states.filter((node) => node.role === 'INITIAL');
    if (starts.length !== 1) {
      problem('SUBFLOW_NO_ENTRY', `${source.name} has no single start state, so ${call.stateName} cannot enter it.`);
      continue;
    }
    const continues = graph.edges.some((edge) => edge.fromNodeId === call.id);
    const ends = source.states.filter(isSuccessEnd);
    if (continues && ends.length === 0) {
      problem('SUBFLOW_NO_EXIT', `${source.name} has no successful ending, so nothing can follow ${call.stateName}.`);
      continue;
    }

    const idOf = new Map(source.states.map((node) => [node.id, `${call.id}:${node.id}`]));
    const name = (node: GraphNodeRow) => `${call.stateName}_${node.stateName}`.toUpperCase();
    for (const node of source.states) {
      const isStart = node.role === 'INITIAL';
      const leaves = continues && isSuccessEnd(node);
      const role = isStart ? (call.role === 'INITIAL' ? 'INITIAL' : 'NORMAL') : leaves || node.role !== 'TERMINAL' ? 'NORMAL' : 'TERMINAL';
      copiedStates.push({
        ...node,
        id: idOf.get(node.id)!,
        graphId: graph.id,
        stateName: name(node),
        behaviorKey: name(node),
        canonicalBehavior: name(node),
        role,
        terminalKind: role === 'TERMINAL' ? node.terminalKind ?? 'SUCCESS' : null,
        subFlowId: null,
      });
    }
    for (const edge of source.transitions) {
      const from = idOf.get(edge.fromNodeId);
      const to = idOf.get(edge.toNodeId);
      if (from && to) copiedEdges.push({ ...edge, id: `${call.id}:${edge.id}`, graphId: graph.id, fromNodeId: from, toNodeId: to });
    }
    entryOf.set(call.id, idOf.get(starts[0].id)!);
    exitsOf.set(call.id, ends.map((node) => idOf.get(node.id)!));
    subFlows.push({ nodeId: call.id, stateName: call.stateName, flowId: source.flowId, name: source.name, versionId: source.versionId, version: source.version });
  }

  const expandedCalls = new Set(entryOf.keys());
  const states = [
    ...graph.nodes.filter((node) => !expandedCalls.has(node.id)).map((node) => (unexpanded.has(node.id) ? node : { ...node, subFlowId: null })),
    ...copiedStates,
  ];
  const parentEdges: GraphEdgeRow[] = [];
  for (const edge of graph.edges) {
    const fromIds = expandedCalls.has(edge.fromNodeId) ? exitsOf.get(edge.fromNodeId)! : [edge.fromNodeId];
    const toIds = expandedCalls.has(edge.toNodeId) ? [entryOf.get(edge.toNodeId)!] : [edge.toNodeId];
    const fan = fromIds.length * toIds.length > 1;
    for (const fromNodeId of fromIds) {
      for (const toNodeId of toIds) {
        parentEdges.push({ ...edge, id: fan ? `${edge.id}:${fromNodeId}:${toNodeId}` : edge.id, fromNodeId, toNodeId });
      }
    }
  }
  return { states, transitions: [...parentEdges, ...copiedEdges], subFlows, issues };
}
