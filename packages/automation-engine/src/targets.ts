import { AUTOMATION_MAX_TARGETS } from '@tellann/desktop-contracts';
import type { ExecutableContract, ExecutableState } from './types';

/**
 * What a run is pointed at.
 *
 * Today that is exactly one terminal state. The shapes around it (the config, the stored run, the
 * plan event) already carry a list, so that running to several states later is a matter of raising
 * `AUTOMATION_MAX_TARGETS` and teaching the executor to loop, not of migrating every stored run or
 * report. Until then a list of more than one is refused here rather than quietly run as its first
 * entry: a run must never be reported against a target it was not actually pointed at.
 */

export type ResolvedTargets = { ok: true; targets: string[] } | { ok: false; detail: string };

export function resolveRunTargets(config: { targetStateKey: string; targetStateKeys?: string[] }): ResolvedTargets {
  const listed = config.targetStateKeys;
  const targets = listed && listed.length > 0 ? listed : [config.targetStateKey];
  if (targets[0] !== config.targetStateKey) {
    return { ok: false, detail: 'The list of target states does not start with the run\'s target state.' };
  }
  if (new Set(targets).size !== targets.length) return { ok: false, detail: 'A target state is listed more than once.' };
  if (targets.length > AUTOMATION_MAX_TARGETS) {
    return { ok: false, detail: `Running to more than ${AUTOMATION_MAX_TARGETS} target state at a time is not supported yet.` };
  }
  return { ok: true, targets };
}

/** The states a run could be pointed at: everything the Flow declares as a way to end. */
export function terminalStatesOf(contract: ExecutableContract): ExecutableState[] {
  return contract.states.filter((state) => state.role === 'TERMINAL');
}
