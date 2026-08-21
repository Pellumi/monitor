export type FlowNodeInput = {
  id: string;
  stateName: string;
  behaviorKey?: string | null;
  role?: 'NORMAL' | 'INITIAL' | 'TERMINAL';
  terminalKind?: 'SUCCESS' | 'FAILURE' | 'CANCELLATION' | 'ALTERNATE' | null;
  actor?: string | null;
  system?: string | null;
};

export type FlowEdgeInput = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  action?: string | null;
  condition?: string | null;
  actor?: string | null;
  system?: string | null;
};

export type FlowValidationIssue = {
  code: string;
  message: string;
  nodeIds?: string[];
  edgeIds?: string[];
};

export type FlowValidationResult = {
  valid: boolean;
  issues: FlowValidationIssue[];
  initialNodeId: string | null;
  terminalNodeIds: string[];
};

export type FlowDiagramProjection = {
  kind: 'FLOW' | 'SEQUENCE' | 'ACTIVITY' | 'STATE_MACHINE';
  renderer: 'MERMAID';
  rendererVersion: '1.0';
  source: string;
  semanticNodeIds: string[];
  semanticEdgeIds: string[];
};

export function createConnectivityRepairTransitions(nodes: FlowNodeInput[], edges: FlowEdgeInput[]): Array<{ from: string; to: string; action: string }> {
  const initial = nodes.filter((node) => node.role === 'INITIAL');
  if (initial.length !== 1) return [];
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge.toNodeId]);
  const repairs: Array<{ from: string; to: string; action: string }> = [];
  const reachable = new Set<string>();
  const refreshReachability = () => {
    reachable.clear();
    const pending = [initial[0].id];
    while (pending.length) {
      const id = pending.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const target of outgoing.get(id) ?? []) pending.push(target);
    }
  };
  refreshReachability();
  const orderedTargets = [...nodes.filter((node) => node.role !== 'INITIAL' && node.role !== 'TERMINAL'), ...nodes.filter((node) => node.role === 'TERMINAL')];
  for (const target of orderedTargets) {
    if (reachable.has(target.id)) continue;
    const source = [...nodes].reverse().find((node) => reachable.has(node.id) && node.role !== 'TERMINAL');
    if (!source) break;
    repairs.push({ from: source.stateName, to: target.stateName, action: `continue to ${target.stateName}` });
    outgoing.set(source.id, [...(outgoing.get(source.id) ?? []), target.id]);
    refreshReachability();
  }
  return repairs;
}

function mermaidText(value: string): string {
  return value.replace(/["\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
}

function mermaidStateDescription(value: string): string {
  // State-diagram transition descriptions are not quoted. Additional colons
  // start a new grammar token and semicolons terminate the statement.
  return mermaidText(value).replace(/[:;]/g, ' -');
}

function mermaidId(value: string): string {
  return `n_${value.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function nodeKey(node: FlowNodeInput): string {
  return (node.behaviorKey || node.stateName).trim().toLowerCase();
}

export function validateFlow(nodes: FlowNodeInput[], edges: FlowEdgeInput[]): FlowValidationResult {
  const issues: FlowValidationIssue[] = [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const initialNodes = nodes.filter((node) => node.role === 'INITIAL');
  const terminalNodes = nodes.filter((node) => node.role === 'TERMINAL');

  if (initialNodes.length !== 1) {
    issues.push({
      code: 'FLOW_INITIAL_STATE_COUNT',
      message: `A publishable Flow requires exactly one initial state; found ${initialNodes.length}.`,
      nodeIds: initialNodes.map((node) => node.id),
    });
  }

  if (terminalNodes.length === 0) {
    issues.push({
      code: 'FLOW_TERMINAL_STATE_REQUIRED',
      message: 'A publishable Flow requires at least one terminal state.',
    });
  }

  const invalidTerminalNodes = terminalNodes.filter((node) => !node.terminalKind);
  if (invalidTerminalNodes.length > 0) {
    issues.push({
      code: 'FLOW_TERMINAL_KIND_REQUIRED',
      message: 'Every terminal state must identify its completion kind.',
      nodeIds: invalidTerminalNodes.map((node) => node.id),
    });
  }

  const seenKeys = new Map<string, string>();
  const duplicateNodeIds: string[] = [];
  for (const node of nodes) {
    const key = nodeKey(node);
    const existing = seenKeys.get(key);
    if (existing) duplicateNodeIds.push(existing, node.id);
    else seenKeys.set(key, node.id);
  }
  if (duplicateNodeIds.length > 0) {
    issues.push({
      code: 'FLOW_DUPLICATE_SEMANTIC_STATE',
      message: 'State names and behavior keys must be semantically unique within a Flow.',
      nodeIds: [...new Set(duplicateNodeIds)],
    });
  }

  const invalidEdges = edges.filter((edge) => !nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId));
  if (invalidEdges.length > 0) {
    issues.push({
      code: 'FLOW_INVALID_TRANSITION_REFERENCE',
      message: 'Every transition must connect two states in the same Flow.',
      edgeIds: invalidEdges.map((edge) => edge.id),
    });
  }

  if (initialNodes.length === 1) {
    const outgoing = new Map<string, string[]>();
    for (const edge of edges) {
      if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) continue;
      const targets = outgoing.get(edge.fromNodeId) ?? [];
      targets.push(edge.toNodeId);
      outgoing.set(edge.fromNodeId, targets);
    }
    const reachable = new Set<string>();
    const pending = [initialNodes[0].id];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const next of outgoing.get(current) ?? []) pending.push(next);
    }
    const unreachable = nodes.filter((node) => !reachable.has(node.id));
    if (unreachable.length > 0) {
      issues.push({
        code: 'FLOW_UNREACHABLE_STATE',
        message: 'Every state must be reachable from the initial state.',
        nodeIds: unreachable.map((node) => node.id),
      });
    }
    const unreachableTerminals = terminalNodes.filter((node) => !reachable.has(node.id));
    if (unreachableTerminals.length > 0) {
      issues.push({
        code: 'FLOW_UNREACHABLE_TERMINAL',
        message: 'Every terminal outcome must be reachable from the initial state.',
        nodeIds: unreachableTerminals.map((node) => node.id),
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    initialNodeId: initialNodes.length === 1 ? initialNodes[0].id : null,
    terminalNodeIds: terminalNodes.map((node) => node.id),
  };
}

export function createFlowDiagrams(nodes: FlowNodeInput[], edges: FlowEdgeInput[]): FlowDiagramProjection[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const semanticNodeIds = nodes.map((node) => node.id);
  const semanticEdgeIds = edges.map((edge) => edge.id);
  const projection = (kind: FlowDiagramProjection['kind'], source: string): FlowDiagramProjection => ({
    kind,
    renderer: 'MERMAID',
    rendererVersion: '1.0',
    source,
    semanticNodeIds,
    semanticEdgeIds,
  });

  const flowLines = ['flowchart LR'];
  for (const node of nodes) {
    const label = mermaidText(node.stateName);
    const id = mermaidId(node.id);
    flowLines.push(node.role === 'TERMINAL' ? `  ${id}(("${label}"))` : `  ${id}["${label}"]`);
  }
  for (const edge of edges) {
    flowLines.push(`  ${mermaidId(edge.fromNodeId)} -->|"${mermaidText(edge.action || edge.condition || 'continues')}"| ${mermaidId(edge.toNodeId)}`);
  }

  const participants = new Map<string, string>();
  for (const node of nodes) {
    const actor = node.actor || node.system || 'Application';
    participants.set(actor, `p_${participants.size + 1}`);
  }
  for (const edge of edges) {
    for (const participant of [edge.actor, edge.system]) {
      if (participant && !participants.has(participant)) participants.set(participant, `p_${participants.size + 1}`);
    }
  }
  const sequenceLines = ['sequenceDiagram'];
  for (const [label, id] of participants) sequenceLines.push(`  participant ${id} as ${mermaidText(label)}`);
  for (const edge of edges) {
    const from = byId.get(edge.fromNodeId);
    const to = byId.get(edge.toNodeId);
    if (!from || !to) continue;
    const sourceActor = participants.get(edge.actor || from.actor || from.system || 'Application')!;
    const targetActor = participants.get(to.actor || to.system || 'Application')!;
    sequenceLines.push(`  ${sourceActor}->>${targetActor}: ${mermaidText(edge.action || `${from.stateName} to ${to.stateName}`)}`);
  }

  const activityLines = ['flowchart TD'];
  for (const node of nodes) activityLines.push(`  ${mermaidId(node.id)}["${mermaidText(node.stateName)}"]`);
  for (const edge of edges) activityLines.push(`  ${mermaidId(edge.fromNodeId)} -->|"${mermaidText(edge.condition || edge.action || 'next')}"| ${mermaidId(edge.toNodeId)}`);

  const stateLines = ['stateDiagram-v2'];
  for (const node of nodes) stateLines.push(`  state "${mermaidText(node.stateName)}" as ${mermaidId(node.id)}`);
  for (const node of nodes.filter((item) => item.role === 'INITIAL')) stateLines.push(`  [*] --> ${mermaidId(node.id)}`);
  for (const edge of edges) stateLines.push(`  ${mermaidId(edge.fromNodeId)} --> ${mermaidId(edge.toNodeId)}: ${mermaidStateDescription(edge.condition || edge.action || 'next')}`);
  for (const node of nodes.filter((item) => item.role === 'TERMINAL')) stateLines.push(`  ${mermaidId(node.id)} --> [*]`);

  return [
    projection('FLOW', flowLines.join('\n')),
    projection('SEQUENCE', sequenceLines.join('\n')),
    projection('ACTIVITY', activityLines.join('\n')),
    projection('STATE_MACHINE', stateLines.join('\n')),
  ];
}
