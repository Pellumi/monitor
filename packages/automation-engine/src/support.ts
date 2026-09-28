import { planFlowPath } from './flow-path';
import type { PolicyOptions } from './policy';
import type { EnvironmentKind, ExecutableContract } from './types';

/**
 * Whether Automated Run understands an application well enough to run it, decided before anything starts.
 *
 * Tellann derives what to click from the application's own code: which control performs a Flow transition, and how
 * the application moves between pages. That derivation exists for React (JSX controls) and, for moving between
 * pages, for React Router and Next.js. Applications written in other frameworks are not something it can read yet.
 * Running them would only end in "no control found", which is true and useless: it reads as a fault in the person's
 * application when the limit is ours.
 *
 * So the limit is stated up front, as what it is: a framework we have not built support for yet, with a way forward
 * (Guided and Assisted modes work with any application). It is never reported as an error, it is never reported as
 * a finding, and no run is created for it.
 *
 * Pure, and driven by the framework names the workspace scan reports, so it can say the same thing from the
 * start form, before a run exists, as from a run that discovers a gap partway.
 */

export type AutomationSupportLevel =
  /** Controls and navigation can both be derived. */
  | 'SUPPORTED'
  /** Controls can be derived, but getting to the Flow's first page may need a route Tellann cannot see. */
  | 'PARTIAL'
  /** A UI framework Automated Run does not read yet. */
  | 'NOT_YET_SUPPORTED'
  /** A backend with no user interface of its own to drive. */
  | 'NOT_APPLICABLE'
  /** Nothing recognisable was found. */
  | 'UNKNOWN';

export interface AutomationSupport {
  level: AutomationSupportLevel;
  /** Whether a run may be started. `PARTIAL` may; the rest may not. */
  canRun: boolean;
  /** The frameworks the assessment was based on, as the scan named them. */
  frameworks: string[];
  /** The ones that are the reason it cannot run, when it cannot. */
  unsupported: string[];
  title: string;
  /** Plain language, safe to show as it is. */
  message: string;
  /** The modes that do work for this application. */
  alternatives: Array<'GUIDED' | 'ASSISTED'>;
}

const norm = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** UI frameworks whose controls the code analysis reads (JSX). */
const READABLE_UI = new Set(['react', 'nextjs', 'remix']);
/** …and among them, those whose page-to-page navigation it also reads. */
const READABLE_NAVIGATION = new Set(['react', 'nextjs']);
/** UI frameworks that are not read yet, with the names we show for them. */
const NOT_YET_UI: Record<string, string> = {
  vue: 'Vue', nuxt: 'Nuxt', svelte: 'Svelte', sveltekit: 'SvelteKit', angular: 'Angular', astro: 'Astro',
};
/** Frameworks that serve no interface of their own. */
const BACKEND_ONLY = new Set(['express', 'fastify', 'nestjs', 'koa', 'hapi', 'django', 'flask', 'fastapi', 'starlette']);
/** Tooling that says nothing about the UI on its own. */
const TOOLING = new Set(['vite']);

const ALTERNATIVES: AutomationSupport['alternatives'] = ['GUIDED', 'ASSISTED'];
const ELSEWHERE = 'Guided and Assisted runs work with any application, so you can still test this Flow that way in the meantime.';

export function assessAutomationSupport(detected: string[]): AutomationSupport {
  const frameworks = [...new Set(detected.map((name) => name.trim()).filter(Boolean))];
  const keys = new Map(frameworks.map((name) => [norm(name), name]));
  const readable = [...keys.keys()].filter((key) => READABLE_UI.has(key));
  const unread = [...keys.keys()].filter((key) => key in NOT_YET_UI);
  const backend = [...keys.keys()].filter((key) => BACKEND_ONLY.has(key));
  const shown = (key: string) => NOT_YET_UI[key] ?? keys.get(key) ?? key;

  if (readable.length > 0 && unread.length === 0) {
    // React on its own says nothing about its router; Remix's file routes are not read.
    const partial = !readable.some((key) => READABLE_NAVIGATION.has(key)) || (readable.includes('remix') && !readable.includes('nextjs'));
    return {
      level: partial ? 'PARTIAL' : 'SUPPORTED', canRun: true, frameworks, unsupported: [],
      title: partial ? 'Automated Run works here, with one limit' : 'Automated Run supports this application',
      message: partial
        ? 'Tellann can find the controls of this application. It cannot yet read how Remix moves between pages, so if the Flow starts somewhere other than the first page, the run may not be able to get there on its own.'
        : 'Tellann can read this application\'s controls and how it moves between pages.',
      alternatives: ALTERNATIVES,
    };
  }

  if (unread.length > 0) {
    const names = unread.map(shown);
    // A mixed repository (React plus something else) is judged on the part we cannot read: that is the part that would fail.
    return {
      level: 'NOT_YET_SUPPORTED', canRun: false, frameworks, unsupported: names,
      title: `Automated Run does not support ${joinNames(names)} yet`,
      message: `Automated Run cannot read ${joinNames(names)} applications yet. We are working on it and it is coming soon. ${ELSEWHERE}`,
      alternatives: ALTERNATIVES,
    };
  }

  if (backend.length > 0 && readable.length === 0) {
    const names = backend.map(shown);
    return {
      level: 'NOT_APPLICABLE', canRun: false, frameworks, unsupported: names,
      title: 'This looks like a backend service',
      message: `${joinNames(names)} serves an API rather than a user interface, and Automated Run works by driving a web interface. Run the Flow in Guided or Assisted mode with the backend capture track to see what the service does.`,
      alternatives: ALTERNATIVES,
    };
  }

  const known = [...keys.keys()].filter((key) => !TOOLING.has(key));
  return {
    level: 'UNKNOWN', canRun: false, frameworks, unsupported: known.map(shown),
    title: 'Automated Run could not recognise this application',
    message: `Tellann could not tell what this application is built with, and Automated Run needs to read its code to know what to click. Support for more kinds of application is coming soon. ${ELSEWHERE}`,
    alternatives: ALTERNATIVES,
  };
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * A second look once the Flow's contract has been compiled: an application we believe we can read whose Flow has no
 * derived control on the path to the target. That is a mapping gap (a checkpoint that points nowhere useful), not a
 * framework we have not built, and it is said as one.
 */
export function describeMissingControls(missing: Array<{ action: string | null; from: string }>): string | null {
  if (missing.length === 0) return null;
  const first = missing[0]!;
  const what = first.action ? `"${first.action}"` : `the step out of ${first.from}`;
  return `Tellann could not work out from the code which control performs ${what}${missing.length > 1 ? ` (and ${missing.length - 1} more)` : ''}. The Flow's mapping to code for ${missing.length > 1 ? 'those steps' : 'that step'} is missing or unclear. Re-running the Flow's code mapping usually fixes this.`;
}

/**
 * The steps on the way to the target that have no control derived from the code. These are the ones a run would stop on
 * with "no control found", so they are worth knowing about *before* it starts anything. Returns null when there is no
 * permitted route to the target at all (a different problem, reported as such by the planner).
 */
export function unresolvedOnPath(
  contract: ExecutableContract,
  targetStateKey: string,
  environment: EnvironmentKind,
  policy?: PolicyOptions,
): Array<{ id: string; action: string | null; from: string }> | null {
  const plan = planFlowPath(contract, contract.initialStateKey, targetStateKey, environment, policy);
  if (!plan.ok) return null;
  return plan.transitions.filter((transition) => transition.control === null).map((transition) => ({ id: transition.id, action: transition.action, from: transition.from }));
}
