import { patternsOverlap } from './keys';
import type { ControlDescriptor, ExecutableState } from './types';

/**
 * Whether a published Flow's terminal pages are actually distinguishable from its
 * intermediate ones, declared up front — the static half of sustainability criterion 3.
 *
 * A route pattern a TERMINAL state and a NORMAL/INITIAL state could both match is not, on
 * its own, a defect: plenty of applications show a success banner and a form error on the
 * same route, told apart by what the page actually contains. It only becomes a problem when
 * the Flow has declared nothing else — no SDK signal, no heading, no text, no required
 * element — that would let a run (or a person reading the Flow) tell the two states apart
 * at runtime. `recognizer.ts` hits exactly this blind spot reactively, at the moment a read
 * ties between two states; this is the same question asked before anything runs.
 */

export interface RouteCollisionFinding {
  code: 'ROUTE_COLLISION_UNDISAMBIGUATED' | 'ROUTE_COLLISION_DISAMBIGUATED';
  /** The terminal state first, then the intermediate one it collides with. */
  stateKeys: [string, string];
  pattern: string;
  severity: 'CRITICAL' | 'INFO';
  detail: string;
}

/** A stable, comparable signature for a required element: what a Flow declared, not how it was matched. */
function elementSignature(element: ControlDescriptor): string {
  return [element.testId ?? '', element.domId ?? '', element.actionAnchor ?? '', [...element.labels].sort().join('|')].join('::');
}

/** Whether two declared sets of evidence differ — identical sets (including both empty) tell a recognizer nothing. */
function setsDiffer(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 && b.length === 0) return false;
  if (a.length !== b.length) return true;
  const left = new Set(a);
  return b.some((value) => !left.has(value));
}

/**
 * Whether the Flow declared anything, beyond the colliding route itself, that would tell
 * these two states apart at runtime: a different SDK signal, heading, visible text, or
 * required element. Any one of these differing is enough — a run only needs one piece of
 * evidence the recognizer can actually check.
 */
function hasDistinguishingEvidence(a: ExecutableState, b: ExecutableState): boolean {
  if (setsDiffer(a.sdkStateSignals, b.sdkStateSignals)) return true;
  if (setsDiffer(a.headings ?? [], b.headings ?? [])) return true;
  if (setsDiffer(a.texts ?? [], b.texts ?? [])) return true;
  const aElements = a.requiredElements.map(elementSignature).filter(Boolean);
  const bElements = b.requiredElements.map(elementSignature).filter(Boolean);
  return setsDiffer(aElements, bElements);
}

/**
 * Every TERMINAL/non-TERMINAL state pair whose declared route patterns could match the
 * same concrete path. One finding per colliding pair, `ROUTE_COLLISION_DISAMBIGUATED`
 * (informational) when the Flow also declares other evidence that tells them apart,
 * `ROUTE_COLLISION_UNDISAMBIGUATED` (critical) when it does not.
 */
export function findRouteCollisions(states: ExecutableState[]): RouteCollisionFinding[] {
  const terminals = states.filter((state) => state.role === 'TERMINAL');
  const others = states.filter((state) => state.role !== 'TERMINAL');
  const findings: RouteCollisionFinding[] = [];

  for (const terminal of terminals) {
    for (const other of others) {
      for (const pattern of terminal.routePatterns) {
        const collidingPattern = other.routePatterns.find((candidate) => patternsOverlap(pattern, candidate));
        if (!collidingPattern) continue;
        const disambiguated = hasDistinguishingEvidence(terminal, other);
        findings.push({
          code: disambiguated ? 'ROUTE_COLLISION_DISAMBIGUATED' : 'ROUTE_COLLISION_UNDISAMBIGUATED',
          stateKeys: [terminal.key, other.key],
          pattern,
          severity: disambiguated ? 'INFO' : 'CRITICAL',
          detail: disambiguated
            ? `"${terminal.name}" (terminal) and "${other.name}" share a route pattern (${pattern}), but the Flow declares other evidence that tells them apart.`
            : `"${terminal.name}" (terminal) and "${other.name}" share a route pattern (${pattern}) and nothing else declared on either state would tell a run which one the page actually is.`,
        });
        break;
      }
    }
  }

  return findings;
}
