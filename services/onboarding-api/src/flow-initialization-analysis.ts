import crypto from 'node:crypto';

type JsonRecord = Record<string, any>;

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object') : [];
}

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function repositoryEvidence(repository: JsonRecord): Array<{ file: string | null; symbol: string | null; text: string; kind: string }> {
  const sources = [
    ['route', repository.routeSummary], ['endpoint', repository.endpointSummary], ['component', repository.frameworkSummary],
  ] as const;
  return sources.flatMap(([kind, value]) => records(value).map((item) => ({
    file: typeof item.file === 'string' ? item.file : typeof item.relativePath === 'string' ? item.relativePath : null,
    symbol: typeof item.symbol === 'string' ? item.symbol : typeof item.name === 'string' ? item.name : null,
    text: [item.path, item.route, item.name, item.symbol, item.file, item.relativePath].filter(Boolean).join(' '), kind,
  })));
}

function bestMapping(label: string, evidence: ReturnType<typeof repositoryEvidence>) {
  const key = normalized(label);
  const candidates = evidence.map((item) => {
    const haystack = normalized(item.text);
    const confidence = key && haystack.includes(key) ? 0.9 : key && [...new Set(key.match(/[a-z]+/g) ?? [])].some((part) => part.length > 3 && haystack.includes(part)) ? 0.68 : 0.2;
    return { ...item, confidence };
  }).sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  return { file: best?.file ?? null, symbol: best?.symbol ?? null, confidence: best?.confidence ?? 0, rationale: best && best.confidence >= 0.65 ? `Matched declared behavior to ${best.kind} evidence.` : 'No confident repository location was found.' };
}

function enumeratePaths(initialId: string, terminalIds: Set<string>, transitions: JsonRecord[]) {
  const byFrom = new Map<string, JsonRecord[]>();
  for (const transition of transitions) {
    const from = String(transition.fromStateId ?? transition.fromNodeId ?? transition.source ?? '');
    if (!byFrom.has(from)) byFrom.set(from, []);
    byFrom.get(from)!.push(transition);
  }
  const paths: string[][] = [];
  const reachable = new Set<string>();
  const visit = (stateId: string, path: string[], seen: Set<string>) => {
    reachable.add(stateId);
    if (terminalIds.has(stateId)) { paths.push([...path, stateId]); return; }
    for (const edge of byFrom.get(stateId) ?? []) {
      const next = String(edge.toStateId ?? edge.toNodeId ?? edge.target ?? '');
      if (!next || seen.has(next)) continue;
      visit(next, [...path, stateId], new Set([...seen, next]));
    }
  };
  visit(initialId, [], new Set([initialId]));
  return { paths, reachable };
}

export function analyzeFlowInitialization(snapshot: JsonRecord, repository: JsonRecord, graphVersionId: string, graphHash?: string) {
  const states = records(snapshot.states ?? snapshot.nodes);
  const transitions = records(snapshot.transitions ?? snapshot.edges);
  const initial = states.find((state) => state.role === 'INITIAL');
  const terminals = states.filter((state) => state.role === 'TERMINAL');
  if (!initial || terminals.length === 0) throw new Error('VALID_INITIAL_AND_TERMINAL_STATES_REQUIRED');
  const stateId = (state: JsonRecord) => String(state.id ?? state.key ?? state.behaviorKey ?? '');
  const terminalIds = new Set(terminals.map(stateId));
  const traversal = enumeratePaths(stateId(initial), terminalIds, transitions);
  const evidence = repositoryEvidence(repository);
  const stateFindings = states.map((state) => {
    const mapping = bestMapping(String(state.stateName ?? state.name ?? state.behaviorKey ?? ''), evidence);
    return { stateId: stateId(state), stateName: state.stateName ?? state.name, role: state.role ?? 'NORMAL', terminalKind: state.terminalKind ?? null, implemented: mapping.confidence >= 0.65, mapping };
  });
  const transitionFindings = transitions.map((transition) => {
    const id = String(transition.id ?? `${transition.fromStateId}-${transition.toStateId}`);
    const mapping = bestMapping(String(transition.action ?? transition.event ?? id), evidence);
    return { transitionId: id, fromStateId: String(transition.fromStateId ?? transition.source ?? ''), toStateId: String(transition.toStateId ?? transition.target ?? ''), action: transition.action ?? null, implemented: mapping.confidence >= 0.65, mapping };
  });
  const checkpoints = [
    ...stateFindings.map((finding) => ({ id: `state:${finding.stateId}`, kind: 'STATE', stateId: finding.stateId, transitionId: null, stateRole: finding.role, terminalKind: finding.terminalKind, eventType: finding.role === 'INITIAL' ? 'FLOW_INITIAL_STATE' : finding.role === 'TERMINAL' ? 'FLOW_TERMINAL_STATE' : 'FLOW_STATE_REACHED', expectedState: finding.stateId, fromCheckpointId: null, toCheckpointId: null, required: true, mapping: finding.mapping })),
    ...transitionFindings.map((finding) => ({ id: `transition:${finding.transitionId}`, kind: 'TRANSITION', stateId: null, transitionId: finding.transitionId, stateRole: null, terminalKind: null, eventType: 'FLOW_TRANSITION', expectedState: finding.toStateId, fromCheckpointId: `state:${finding.fromStateId}`, toCheckpointId: `state:${finding.toStateId}`, required: true, mapping: finding.mapping })),
  ];
  const now = new Date().toISOString();
  const unreachableStateIds = states.map(stateId).filter((id) => !traversal.reachable.has(id));
  const manifest = { version: '1.0' as const, graphVersionId, graphHash: graphHash ?? crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'), repositorySnapshotId: String(repository.id), initialStateId: stateId(initial), terminalStateIds: [...terminalIds], paths: traversal.paths, unreachableStateIds, checkpoints, generatedAt: now };
  const missingStates = stateFindings.filter((item) => !item.implemented);
  const incompleteTransitions = transitionFindings.filter((item) => !item.implemented);
  const report = { version: '1.0' as const, kind: 'FLOW_CODE_REVIEW' as const, generatedAt: now, engine: 'RULES_FALLBACK' as const,
    summary: { mappedStates: stateFindings.length - missingStates.length, totalStates: stateFindings.length, mappedTransitions: transitionFindings.length - incompleteTransitions.length, totalTransitions: transitionFindings.length },
    stateFindings, transitionFindings, missingStates, incompleteTransitions,
    edgeCases: unreachableStateIds.map((id) => ({ code: 'UNREACHABLE_STATE', stateId: id, severity: 'BLOCKING' })),
    uncoveredTerminalOutcomes: terminals.filter((terminal) => !traversal.paths.some((path) => path.at(-1) === stateId(terminal))).map((terminal) => ({ stateId: stateId(terminal), terminalKind: terminal.terminalKind ?? null })),
    evidence, recommendations: [...missingStates.map((item) => ({ checkpointId: `state:${item.stateId}`, action: 'Add state checkpoint', mapping: item.mapping })), ...incompleteTransitions.map((item) => ({ checkpointId: `transition:${item.transitionId}`, action: 'Add transition checkpoint', mapping: item.mapping }))],
    limitations: ['Static evidence is confidence-scored; activation requires correlated runtime telemetry.'],
  };
  return { manifest, report };
}

export function buildManualRoadmap(manifest: ReturnType<typeof analyzeFlowInitialization>['manifest'], revision = 1) {
  const now = new Date().toISOString();
  const groups = [{ id: 'spine', title: 'Declared intent', terminalKind: null }, ...manifest.terminalStateIds.map((id) => ({ id: `terminal:${id}`, title: `Terminal path · ${id}`, terminalKind: id }))];
  const steps: JsonRecord[] = manifest.checkpoints.map((checkpoint, index) => ({
    id: checkpoint.id, groupId: checkpoint.stateRole === 'TERMINAL' ? `terminal:${checkpoint.stateId}` : 'spine', kind: checkpoint.kind === 'TRANSITION' ? 'TRANSITION' : checkpoint.stateRole === 'TERMINAL' ? 'TERMINAL' : 'STATE',
    title: checkpoint.kind === 'TRANSITION' ? `Track transition ${checkpoint.transitionId}` : `Track ${checkpoint.expectedState}`,
    description: checkpoint.mapping.rationale, status: index === 0 ? 'CURRENT' : checkpoint.mapping.confidence < 0.65 ? 'BLOCKED' : 'PENDING', dependencies: checkpoint.fromCheckpointId ? [checkpoint.fromCheckpointId] : [],
    file: checkpoint.mapping.file, symbol: checkpoint.mapping.symbol,
    snippet: `TELLANN.trackEvent('${checkpoint.eventType}', { checkpointId: '${checkpoint.id}', stateId: ${JSON.stringify(checkpoint.stateId)}, transitionId: ${JSON.stringify(checkpoint.transitionId)} });`,
    eventType: checkpoint.eventType, checkpointId: checkpoint.id, userCompletedAt: null, verificationEvidence: [],
  }));
  steps.push({ id: 'verify:walkthrough', groupId: 'spine', kind: 'VERIFY', title: 'Run the initial-to-terminal walkthrough', description: 'Start the project and demonstrate one correlated path from the declared initial state to a terminal state.', status: 'PENDING', dependencies: manifest.checkpoints.filter((item) => item.required).map((item) => item.id), file: null, symbol: null, snippet: '', eventType: null, checkpointId: null, userCompletedAt: null, verificationEvidence: [] });
  return { version: '1.0' as const, revision, groups, steps, generatedAt: now };
}

export function calculateCheckpointCoverage(manifest: ReturnType<typeof analyzeFlowInitialization>['manifest'], observed: Array<{ checkpointId: string; timestamp: string }>, startedAt: string) {
  const observedIds = [...new Set(observed.map((item) => item.checkpointId))];
  const initialCheckpoint = `state:${manifest.initialStateId}`;
  const initialIndex = observed.findIndex((item) => item.checkpointId === initialCheckpoint);
  const expectedSequences = manifest.paths.map((path) => path.flatMap((stateId, index) => {
    if (index === path.length - 1) return [`state:${stateId}`];
    const nextStateId = path[index + 1];
    const transition = manifest.checkpoints.find((item) => item.kind === 'TRANSITION' && item.fromCheckpointId === `state:${stateId}` && item.toCheckpointId === `state:${nextStateId}`);
    return transition ? [`state:${stateId}`, transition.id] : [`state:${stateId}`];
  }));
  const observedSequence = observed.map((item) => item.checkpointId);
  const matchedSequence = expectedSequences.find((sequence) => {
    let cursor = 0;
    for (const checkpointId of observedSequence) if (checkpointId === sequence[cursor]) cursor += 1;
    return cursor === sequence.length;
  });
  const orderingErrors = observed.length > 0 && initialIndex < 0 ? [{ code: 'INITIAL_CHECKPOINT_REQUIRED_FIRST', firstCheckpointId: observed[0].checkpointId }] : [];
  const completed = Boolean(matchedSequence && initialIndex >= 0 && orderingErrors.length === 0);
  const required = manifest.checkpoints.filter((item) => item.required).map((item) => item.id);
  return {
    status: completed ? 'COMPLETED' : initialIndex >= 0 ? 'RECORDING' : 'WAITING_FOR_INITIAL', startedAt,
    observedCheckpointIds: observedIds, missingCheckpointIds: required.filter((id) => !observedIds.includes(id)),
    reachedTerminalStateIds: manifest.terminalStateIds.filter((id) => observedIds.includes(`state:${id}`)), orderingErrors,
    verifiedPath: matchedSequence ?? [], lastEventAt: observed.at(-1)?.timestamp ?? null,
  };
}
