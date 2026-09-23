const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE = /\+?\d[\d\s().-]{6,}\d/g;
const UUID_OR_LONG_ID = /\b(?:[0-9a-f]{8}-[0-9a-f-]{27,}|\d{7,})\b/gi;

/** Flow metadata is org-visible, so observed labels must not carry identifiers out of protected evidence. */
export function safeObservedStateName(value: unknown): string {
  const sanitized = String(value ?? '')
    .replace(EMAIL, '[identifier]')
    .replace(PHONE, '[identifier]')
    .replace(UUID_OR_LONG_ID, '[identifier]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return sanitized || 'Observed state';
}

export function observedDraftStateNames(observations: Array<{ stateName: string }>): string[] {
  const observed = observations
    .map((item) => safeObservedStateName(item.stateName))
    .filter((name, index, list) => index === 0 || name !== list[index - 1])
    .slice(0, 25);
  if (observed.length > 1) return observed;
  if (observed.length === 1) return [...observed, 'Session completed'];
  return ['Session started', 'Session completed'];
}

type FlowCandidate = { id: string; name: string; states: Array<{ stateName: string }> };

export function rankObservedFlowCandidates(
  observations: Array<{ stateName: string }>,
  flows: FlowCandidate[],
): Array<{ id: string; name: string; score: number }> {
  const observed = new Set(observedDraftStateNames(observations).map((name) => name.toLowerCase()));
  return flows
    .map((flow) => {
      const expected = new Set(flow.states.map((state) => safeObservedStateName(state.stateName).toLowerCase()));
      const matched = [...observed].filter((name) => expected.has(name)).length;
      return { id: flow.id, name: flow.name, score: expected.size ? matched / Math.max(observed.size, expected.size) : 0 };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
}
