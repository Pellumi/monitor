/**
 * Rollout control for evidence-grounded Flow mapping.
 *
 * The three settings are the three stages of the rollout, not an on/off switch:
 *
 * - `shadow` runs retrieval and stores its candidates and coverage on the scan,
 *   but leaves the review report on the previous engine. It answers "would the
 *   new mapping have done better here?" against real repositories without
 *   changing anything a user sees.
 * - `on` publishes the evidence-grounded review and unlocks automated proposals.
 * - `off` refuses v2 submissions outright, so a bad retrieval release can be
 *   stopped without a deploy.
 *
 * `on` is the default because it is the intended steady state; an operator opts
 * *down* from it while a change is being watched.
 */
export type FlowMappingMode = 'off' | 'shadow' | 'on';

export function flowMappingMode(env: NodeJS.ProcessEnv = process.env): FlowMappingMode {
  const value = String(env.FLOW_CODE_MAPPING_V2 ?? '').trim().toLowerCase();
  if (value === 'off' || value === 'false' || value === '0') return 'off';
  if (value === 'shadow') return 'shadow';
  return 'on';
}
