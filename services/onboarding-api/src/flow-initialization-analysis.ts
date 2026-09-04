import crypto from 'node:crypto';

type JsonRecord = Record<string, any>;

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object') : [];
}

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * A checkpoint's human-facing name. This is what a developer types into their own
 * code, so it has to be readable and stable — never a raw id. Anything that would
 * slugify to nothing (an id-only state, a symbol-only action) falls back to a short
 * hash of the source text rather than an empty marker.
 */
export function markerSlug(value: unknown): string {
  const slug = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/g, '');
  if (slug && !/^[0-9-]+$/.test(slug)) return slug;
  const source = String(value ?? '').trim();
  return source ? `x-${crypto.createHash('sha1').update(source).digest('hex').slice(0, 8)}` : 'unnamed';
}

// Two declared states can carry the same name ("Failed" under two branches), and
// markers are matched by name, so a duplicate would make one checkpoint shadow the
// other during a code scan. Suffix collisions instead.
function uniqueMarkerSlugs(entries: Array<[string, string]>): Map<string, string> {
  const used = new Set<string>();
  const result = new Map<string, string>();
  for (const [id, label] of entries) {
    const base = markerSlug(label);
    let slug = base;
    for (let suffix = 2; used.has(slug); suffix += 1) slug = `${base}-${suffix}`;
    used.add(slug);
    result.set(id, slug);
  }
  return result;
}

export type FlowMarker = { flow: string; state: string | null; transition: string | null };

/** The single line a developer pastes into their code for one checkpoint. */
export function checkpointSnippet(eventType: string, marker: FlowMarker): string {
  const target = marker.transition ? `transition: '${marker.transition}'` : `state: '${marker.state ?? ''}'`;
  return `TELLANN.trackEvent('${eventType}', { flow: '${marker.flow}', ${target} });`;
}

// Declared-flow snapshots have used a few different field names for a transition's
// endpoints over time (fromStateId/toStateId, fromNodeId/toNodeId, source/target).
// Every reader must accept the same set in the same order, or a transition that
// resolves fine for path traversal can still come out with empty from/to ids
// wherever a narrower fallback chain is used.
function transitionEndpoints(transition: JsonRecord): { from: string; to: string } {
  return {
    from: String(transition.fromStateId ?? transition.fromNodeId ?? transition.source ?? ''),
    to: String(transition.toStateId ?? transition.toNodeId ?? transition.target ?? ''),
  };
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
    const { from } = transitionEndpoints(transition);
    if (!byFrom.has(from)) byFrom.set(from, []);
    byFrom.get(from)!.push(transition);
  }
  const paths: string[][] = [];
  const reachable = new Set<string>();
  const visit = (stateId: string, path: string[], seen: Set<string>) => {
    reachable.add(stateId);
    if (terminalIds.has(stateId)) { paths.push([...path, stateId]); return; }
    for (const edge of byFrom.get(stateId) ?? []) {
      const { to: next } = transitionEndpoints(edge);
      if (!next || seen.has(next)) continue;
      visit(next, [...path, stateId], new Set([...seen, next]));
    }
  };
  visit(initialId, [], new Set([initialId]));
  return { paths, reachable };
}

export function analyzeFlowInitialization(snapshot: JsonRecord, repository: JsonRecord, graphVersionId: string, graphHash?: string, flowName?: string) {
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
  // Transition endpoints are internal state ids (often UUIDs) — resolve them to the
  // declared state name wherever they're shown to a person.
  const stateNameById = new Map(states.map((state) => [stateId(state), String(state.stateName ?? state.name ?? state.behaviorKey ?? stateId(state))]));
  const stateLabel = (id: string) => stateNameById.get(id) ?? id;
  const transitionFindings = transitions.map((transition) => {
    const { from, to } = transitionEndpoints(transition);
    const id = String(transition.id ?? `${from}-${to}`);
    const mapping = bestMapping(String(transition.action ?? transition.event ?? id), evidence);
    return { transitionId: id, fromStateId: from, toStateId: to, action: transition.action ?? null, implemented: mapping.confidence >= 0.65, mapping };
  });
  // Markers are what the developer writes by hand, so they are named after the
  // declared flow and state — never after an internal id.
  const flowKey = markerSlug(flowName ?? snapshot.name ?? snapshot.flowName ?? 'flow');
  const stateMarkers = uniqueMarkerSlugs(states.map((state) => [stateId(state), String(state.stateName ?? state.name ?? state.behaviorKey ?? stateId(state))] as [string, string]));
  const transitionMarkers = uniqueMarkerSlugs(transitionFindings.map((finding) => [
    finding.transitionId,
    String(finding.action ?? `${stateLabel(finding.fromStateId)}-to-${stateLabel(finding.toStateId)}`),
  ] as [string, string]));
  // Only the boundaries are required: one initial state tells Tellann where the
  // flow begins in the code and one terminal state tells it where it ends. Every
  // state and transition in between is offered but optional, so a long declared
  // flow does not turn into a long plotting exercise before the first QA run.
  const checkpoints = [
    ...stateFindings.map((finding) => ({ id: `state:${finding.stateId}`, kind: 'STATE', stateId: finding.stateId, transitionId: null, stateRole: finding.role, terminalKind: finding.terminalKind, eventType: finding.role === 'INITIAL' ? 'FLOW_INITIAL_STATE' : finding.role === 'TERMINAL' ? 'FLOW_TERMINAL_STATE' : 'FLOW_STATE_REACHED', expectedState: finding.stateId, fromCheckpointId: null, toCheckpointId: null, required: finding.role === 'INITIAL' || finding.role === 'TERMINAL', label: String(finding.stateName ?? stateLabel(finding.stateId)), marker: { flow: flowKey, state: stateMarkers.get(finding.stateId) ?? markerSlug(finding.stateId), transition: null }, mapping: finding.mapping })),
    ...transitionFindings.map((finding) => ({ id: `transition:${finding.transitionId}`, kind: 'TRANSITION', stateId: null, transitionId: finding.transitionId, stateRole: null, terminalKind: null, eventType: 'FLOW_TRANSITION', expectedState: finding.toStateId, fromCheckpointId: `state:${finding.fromStateId}`, toCheckpointId: `state:${finding.toStateId}`, required: false, label: String(finding.action ?? `${stateLabel(finding.fromStateId)} → ${stateLabel(finding.toStateId)}`), marker: { flow: flowKey, state: null, transition: transitionMarkers.get(finding.transitionId) ?? markerSlug(finding.transitionId) }, mapping: finding.mapping })),
  ];
  const now = new Date().toISOString();
  const unreachableStateIds = states.map(stateId).filter((id) => !traversal.reachable.has(id));
  const manifest = { version: '1.0' as const, graphVersionId, graphHash: graphHash ?? crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'), repositorySnapshotId: String(repository.id), flowKey, flowName: String(flowName ?? snapshot.name ?? snapshot.flowName ?? 'Flow'), initialStateId: stateId(initial), terminalStateIds: [...terminalIds], paths: traversal.paths, unreachableStateIds, checkpoints, generatedAt: now };
  const missingStates = stateFindings.filter((item) => !item.implemented);
  const incompleteTransitions = transitionFindings.filter((item) => !item.implemented);
  const report = { version: '1.0' as const, kind: 'FLOW_CODE_REVIEW' as const, generatedAt: now, engine: 'RULES_FALLBACK' as const,
    summary: { mappedStates: stateFindings.length - missingStates.length, totalStates: stateFindings.length, mappedTransitions: transitionFindings.length - incompleteTransitions.length, totalTransitions: transitionFindings.length },
    stateFindings, transitionFindings, missingStates, incompleteTransitions,
    edgeCases: unreachableStateIds.map((id) => ({ code: 'UNREACHABLE_STATE', stateId: id, severity: 'BLOCKING' })),
    uncoveredTerminalOutcomes: terminals.filter((terminal) => !traversal.paths.some((path) => path.at(-1) === stateId(terminal))).map((terminal) => ({ stateId: stateId(terminal), terminalKind: terminal.terminalKind ?? null })),
    evidence, recommendations: [
      ...missingStates.map((item) => ({
        checkpointId: `state:${item.stateId}`, kind: 'STATE' as const, action: 'Add state checkpoint',
        label: String(item.stateName ?? stateLabel(item.stateId)),
        detail: item.role === 'INITIAL'
          ? 'This is the declared initial state. Tellann could not confidently locate where it is reached in the repository.'
          : item.role === 'TERMINAL'
            ? `This is a declared terminal state${item.terminalKind ? ` (${item.terminalKind})` : ''}. Tellann could not confidently locate where it is reached in the repository.`
            : 'Tellann could not confidently locate where this declared state is reached in the repository.',
        mapping: item.mapping,
      })),
      ...incompleteTransitions.map((item) => ({
        checkpointId: `transition:${item.transitionId}`, kind: 'TRANSITION' as const, action: 'Add transition checkpoint',
        label: String(item.action ?? `${stateLabel(item.fromStateId)} → ${stateLabel(item.toStateId)}`),
        detail: `The transition from "${stateLabel(item.fromStateId)}" to "${stateLabel(item.toStateId)}" has no confident repository match.`,
        mapping: item.mapping,
      })),
    ],
    limitations: ['Static evidence is confidence-scored; activation requires correlated runtime telemetry.'],
  };
  return { manifest, report };
}

export function buildManualRoadmap(
  manifest: ReturnType<typeof analyzeFlowInitialization>['manifest'],
  revision = 1,
  report?: ReturnType<typeof analyzeFlowInitialization>['report'],
) {
  const now = new Date().toISOString();
  const stateNameById = new Map<string, string>(
    (report?.stateFindings ?? []).map((finding: any) => [String(finding.stateId), String(finding.stateName ?? finding.stateId)]),
  );
  const stateLabel = (id: string | null) => (id && stateNameById.get(id)) || id || 'this state';
  const transitionLabelById = new Map<string, string>(
    (report?.transitionFindings ?? []).map((finding: any) => [
      String(finding.transitionId),
      String(finding.action ?? `${stateLabel(finding.fromStateId)} → ${stateLabel(finding.toStateId)}`),
    ]),
  );
  const transitionLabel = (id: string | null) => (id && transitionLabelById.get(id)) || id || 'this transition';

  const groups = [
    { id: 'spine', title: 'Main path', terminalKind: null },
    ...manifest.terminalStateIds.map((id) => ({ id: `terminal:${id}`, title: `Path to "${stateLabel(id)}"`, terminalKind: null })),
  ];
  const steps: JsonRecord[] = manifest.checkpoints.map((checkpoint, index) => {
    const isTransition = checkpoint.kind === 'TRANSITION';
    const isInitial = checkpoint.stateRole === 'INITIAL';
    const isTerminal = checkpoint.stateRole === 'TERMINAL';
    const name = isTransition ? transitionLabel(checkpoint.transitionId) : stateLabel(checkpoint.stateId);
    const title = isTransition
      ? `Record the "${name}" transition`
      : isInitial
        ? `Record when the flow starts at "${name}"`
        : isTerminal
          ? `Record when the flow ends at "${name}"`
          : `Record when the flow reaches "${name}"`;
    const where = isTransition
      ? 'this transition runs'
      : isInitial
        ? 'the flow begins'
        : isTerminal
          ? 'the flow reaches this end state'
          : 'the flow reaches this state';
    const placement = checkpoint.mapping.file
      ? `Add this call in ${checkpoint.mapping.file}${checkpoint.mapping.symbol ? ` (near ${checkpoint.mapping.symbol})` : ''}, at the point where ${where}.`
      : `Tellann could not find where this happens in your code. Add this call yourself at the point where ${where}.`;
    // Boundary checkpoints are what initialization checks for; the rest are extra
    // detail the user can add later, and saying so keeps the roadmap honest about
    // how little is actually needed to get to a QA run.
    const description = (checkpoint as any).required === false
      ? `Optional — not needed to initialize this flow. ${placement}`
      : placement;
    return {
      id: checkpoint.id,
      groupId: isTerminal ? `terminal:${checkpoint.stateId}` : 'spine',
      kind: isTransition ? 'TRANSITION' : isTerminal ? 'TERMINAL' : 'STATE',
      title,
      description,
      required: (checkpoint as any).required !== false,
      marker: (checkpoint as any).marker ?? null,
      // Low mapping confidence means Tellann could not auto-locate the checkpoint,
      // not that the user is blocked from adding it — the description says as much.
      // Keep every step actionable so the manual roadmap can actually be completed.
      status: index === 0 ? 'CURRENT' : 'PENDING',
      dependencies: checkpoint.fromCheckpointId ? [checkpoint.fromCheckpointId] : [],
      file: checkpoint.mapping.file, symbol: checkpoint.mapping.symbol,
      snippet: checkpointSnippet(checkpoint.eventType, (checkpoint as any).marker ?? { flow: (manifest as any).flowKey ?? 'flow', state: checkpoint.stateId, transition: checkpoint.transitionId }),
      eventType: checkpoint.eventType, checkpointId: checkpoint.id, userCompletedAt: null, verificationEvidence: [],
    };
  });
  const requiredIds = manifest.checkpoints.filter((item) => item.required).map((item) => item.id);
  steps.push({ id: 'verify:walkthrough', groupId: 'spine', kind: 'VERIFY', title: 'Check your code for the start and finish markers', description: 'Once the start marker and at least one finish marker are in your code, Tellann searches the attached project for them. No run of your app is needed to initialize the flow.', status: 'PENDING', dependencies: requiredIds, required: true, marker: null, file: null, symbol: null, snippet: '', eventType: null, checkpointId: null, userCompletedAt: null, verificationEvidence: [] });
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

export type FlowMarkerMatch = {
  /** Repository-relative path of the file the marker was found in. */
  file: string;
  line: number;
  eventType?: string | null;
  flow?: string | null;
  state?: string | null;
  transition?: string | null;
  /** Markers written by an older Tellann carry the raw checkpoint id instead. */
  checkpointId?: string | null;
};

/**
 * Resolve the markers a code scan found against the declared manifest.
 *
 * Initialization is satisfied by the flow's boundaries alone — the declared initial
 * state and at least one declared terminal state. Anything else the scan finds is
 * recorded as observed, but never gates the flow: the point of the boundaries is
 * that they tell Tellann where the flow starts and ends in the code, which is all a
 * QA run needs to correlate the rest.
 */
export function evaluateCodeScanCoverage(
  manifest: ReturnType<typeof analyzeFlowInitialization>['manifest'],
  matches: FlowMarkerMatch[],
  scannedAt = new Date().toISOString(),
) {
  const checkpoints = (manifest.checkpoints ?? []) as Array<Record<string, any>>;
  const byMarker = new Map<string, string>();
  for (const checkpoint of checkpoints) {
    const marker = checkpoint.marker as FlowMarker | undefined;
    if (!marker) continue;
    const name = marker.transition ? `transition/${marker.transition}` : `state/${marker.state}`;
    byMarker.set(`${marker.flow}#${name}`, checkpoint.id);
  }
  const knownIds = new Set(checkpoints.map((checkpoint) => String(checkpoint.id)));
  const evidence: Array<{ checkpointId: string; file: string; line: number }> = [];
  for (const match of matches) {
    const name = match.transition ? `transition/${markerSlug(match.transition)}` : match.state ? `state/${markerSlug(match.state)}` : null;
    const resolved = match.checkpointId && knownIds.has(match.checkpointId)
      ? match.checkpointId
      : name && match.flow
        ? byMarker.get(`${markerSlug(match.flow)}#${name}`)
        : undefined;
    if (!resolved) continue;
    evidence.push({ checkpointId: resolved, file: match.file, line: match.line });
  }
  const observedCheckpointIds = [...new Set(evidence.map((item) => item.checkpointId))];
  const initialCheckpointId = `state:${manifest.initialStateId}`;
  const terminalCheckpointIds = (manifest.terminalStateIds ?? []).map((id) => `state:${id}`);
  const foundInitial = observedCheckpointIds.includes(initialCheckpointId);
  const foundTerminals = terminalCheckpointIds.filter((id) => observedCheckpointIds.includes(id));
  const missingCheckpointIds = [
    ...(foundInitial ? [] : [initialCheckpointId]),
    ...(foundTerminals.length ? [] : terminalCheckpointIds),
  ];
  return {
    status: (foundInitial && foundTerminals.length ? 'COMPLETED' : 'INCOMPLETE') as 'COMPLETED' | 'INCOMPLETE',
    method: 'STATIC_CODE_SCAN' as const,
    startedAt: scannedAt,
    observedCheckpointIds,
    missingCheckpointIds,
    reachedTerminalStateIds: foundTerminals.map((id) => id.slice('state:'.length)),
    orderingErrors: [] as Array<Record<string, unknown>>,
    verifiedPath: foundInitial && foundTerminals.length ? [initialCheckpointId, foundTerminals[0]] : [],
    codeEvidence: evidence,
    lastEventAt: null,
    scannedAt,
  };
}
