import type { DeclaredFlowSummary, RuleBasedSuggestionItem } from './schema';

// ─────────────────────────────────────────────────────────────
// Flow suggestions prompt builder
//
// IMPORTANT: Only sanitized, minimal context is sent.
// Do NOT include: raw replay payloads, form values, API bodies,
// tokens, secrets, personal data, or raw user text.
// ─────────────────────────────────────────────────────────────

export function buildFlowSuggestionsPrompt(input: {
  applicationDomain: string;
  declaredFlows: DeclaredFlowSummary[];
  observedGraphSummary?: string;
  existingRuleSuggestions: RuleBasedSuggestionItem[];
  userDefinedGoals?: string[];
  graphVersion?: number;
  graphHash?: string;
  latestMutation?: string;
}): string {
  const flowSummaries = input.declaredFlows.map((flow) => {
    const states = flow.states.map((s) => `${s.name}(${s.category})`).join(', ');
    const transitions = flow.transitions
      .map((t) => `${t.from}→${t.to}${t.action ? `[${t.action}]` : ''}`)
      .join(', ');
    const stateList = states || 'none';
    const transitionList = transitions || 'none';
    return [
      `Flow: ${flow.name}`,
      `  States: ${stateList}`,
      `  Transitions: ${transitionList}`,
    ].join('\n');
  });

  const ruleSuggestions = input.existingRuleSuggestions
    .slice(0, 10) // cap to avoid token explosion
    .map((s, i) => `  ${i + 1}. [${s.type}] ${s.title} (confidence: ${s.confidence.toFixed(2)}): ${s.rationale}`)
    .join('\n');

  const goals = (input.userDefinedGoals ?? [])
    .slice(0, 5)
    .join('; ') || 'Not specified';

  const observedSummary = input.observedGraphSummary
    ? `\nObserved graph summary (anonymized): ${input.observedGraphSummary.slice(0, 400)}`
    : '';

  return [
    'You are an expert application behavior flow advisor.',
    'Analyze the declared application flows below and suggest improvements.',
    'Return ONLY valid JSON. No explanation outside the JSON structure.',
    '',
    'RESPONSE FORMAT:',
    '{',
    '  "suggestions": [',
    '    {',
    '      "type": "PREREQUISITE_STATE" | "VALIDATION_CONSTRAINT" | "POSTREQUISITE_FLOW" | "MISSING_FAILURE_PATH" | "MISSING_RECOVERY_PATH" | "MISSING_EMPTY_STATE" | "MISSING_LOADING_STATE",',
    '      "title": "Short title (3-120 chars)",',
    '      "description": "What to add and why (10-500 chars)",',
    '      "severity": "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",',
    '      "confidence": 0.0-1.0,',
    '      "rationale": "Why this is needed (max 500 chars)",',
    '      "evidence": ["optional supporting observations"],',
    '      "targetNodeId": "optional: which state this applies to",',
    '      "targetFlowId": "optional: which flow this applies to",',
    '      "suggestedState": "optional: exact state name to add",',
    '      "suggestedTransition": "optional: transition to add"',
    '    }',
    '  ]',
    '}',
    '',
    `APPLICATION DOMAIN: ${input.applicationDomain}`,
    `GRAPH REVISION: ${input.graphVersion ?? 'unknown'} (${input.graphHash ?? 'unknown'})`,
    `LATEST MUTATION: ${input.latestMutation ?? 'manual analysis'}`,
    `USER GOALS: ${goals}`,
    '',
    'DECLARED FLOWS:',
    flowSummaries.join('\n\n') || 'No flows declared yet.',
    observedSummary,
    '',
    'EXISTING RULE-BASED SUGGESTIONS (do not duplicate these):',
    ruleSuggestions || '  None yet.',
    '',
    'INSTRUCTIONS:',
    '- Return at most 10 new suggestions.',
    '- Focus on gaps NOT already covered by the rule-based suggestions above.',
    '- Do NOT suggest adding states that already exist.',
    '- Do NOT include any user credentials, tokens, personal data, or raw form values.',
    '- Mark AI-only suggestions with confidence ≤ 0.75.',
    '- Prioritize HIGH severity gaps first.',
    '- Consider alternate outcomes, validation failures, system failures, actor/authorization variants, recovery paths, and downstream flows.',
    '- Return an empty suggestions array when there is no distinct, useful gap.',
  ].join('\n');
}

/**
 * Repair prompt for the flow suggestions response.
 */
export function buildFlowSuggestionsRepairPrompt(invalidJson: string, errors: string): string {
  const truncated = invalidJson.length > 6000
    ? invalidJson.slice(0, 6000) + '\n...[truncated]'
    : invalidJson;

  return [
    'You are a JSON repair service.',
    'Return ONLY valid JSON matching the schema below. No explanation. No markdown.',
    '',
    'REQUIRED SCHEMA:',
    '{ "suggestions": [{ "type": string, "title": string, "description": string,',
    '  "severity": "INFO"|"LOW"|"MEDIUM"|"HIGH"|"CRITICAL",',
    '  "confidence": number, "rationale": string, "evidence": string[] }] }',
    '',
    'VALIDATION ERRORS:',
    errors,
    '',
    'INVALID JSON:',
    truncated,
  ].join('\n');
}
