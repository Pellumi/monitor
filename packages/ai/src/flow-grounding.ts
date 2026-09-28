import type { FlowLanguageIssue, NormalizedWorkflow, UntrustedWorkflow } from './flow-language';
import { canonicalRoutePattern } from './flow-spec';

/**
 * Keeping a model to what the document says.
 *
 * What a person declares about a flow (a route, a control's label, a request) outranks what the code analysis
 * derives, so a wrong declaration is worse than a missing one: an invented route makes a state that works today
 * unrecognisable. A prompt asks a model not to invent; it cannot make it so, and a model told to include what the
 * document states will, as live output showed, also "helpfully" include `/dashboard` for a page the document only
 * called a dashboard. So nothing a model declares is kept unless it can be found in the text the model was given.
 *
 * What is checked, and how strictly:
 *   route      the same canonical path must be written in the text
 *   heading    the same words must be quoted in the text, or introduced as a title ("titled Sign in", "the heading
 *              says ..."), because "Dashboard" is also just a word in "carried to their dashboard"
 *   control    the label must be quoted, or sit next to a control word ("the Courses link", "Create button"),
 *              because a label like "Login" is also just a word in "login page"
 *   effect     the request's path must be written in the text (with its method, or on its own)
 *   input      the field's words must appear in the text
 *   sub-flow   is not something a document says at all, so a model's is only kept when the caller offered flows
 *   requires   an environment must be named in the text; an actor must appear as a word
 * Anything that fails is dropped and reported, so the reviewer sees what was left out and why.
 *
 * With no text to check against (a model that read a file directly) nothing can be verified, so the details that
 * would silently override the code when wrong (routes, headings, requests, environments) are dropped outright and
 * the rest, which a reviewer can see and a run can only fail loudly on, are kept.
 */

const CONTROL_WORDS = 'link|button|tab|icon|menu item|menu|option|toggle|checkbox|dropdown|card';

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every path written in the text, canonicalised: what a declared route or request path is compared with. */
function pathsIn(text: string): Set<string> {
  const paths = new Set<string>();
  for (const match of text.matchAll(/(?:^|[\s("'`])((?:https?:\/\/[^\s/]+)?\/[A-Za-z0-9_\-/{}:[\]<>.$]*[A-Za-z0-9_\]}>])/g)) {
    const canonical = canonicalRoutePattern(match[1]);
    if (canonical) paths.add(canonical);
  }
  return paths;
}

function writtenAsControl(text: string, label: string): boolean {
  const words = norm(label);
  if (!words) return false;
  const spelled = words.split(' ').map(escapeRegExp).join('[^a-z0-9]+');
  const lowered = text.toLowerCase();
  // Quoted: "Create A Course"
  if (new RegExp(`["“'‘]\\s*${spelled}\\s*["”'’]`).test(lowered)) return true;
  // Next to a control word, either side: the Courses link / button "Create"
  return new RegExp(`(?:${spelled}[^a-z0-9]+(?:${CONTROL_WORDS})\\b)|(?:\\b(?:${CONTROL_WORDS})[^a-z0-9]+["“'‘]?${spelled}\\b)`).test(lowered);
}

/** Quoted, or introduced as something a page says or is titled: the difference between a heading and a word in a sentence. */
function writtenAsHeading(text: string, phrase: string): boolean {
  const words = norm(phrase);
  if (!words) return false;
  const spelled = words.split(' ').map(escapeRegExp).join('[^a-z0-9]+');
  const lowered = text.toLowerCase();
  return new RegExp(String.raw`["“'‘]\s*${spelled}\s*["”'’]`).test(lowered)
    || new RegExp(String.raw`\b(?:titled|headed|heading|headline|title|says|reads|saying|labell?ed|called)\b[^.]{0,20}?${spelled}\b`).test(lowered);
}

const has = (text: string, phrase: string) => {
  const needle = norm(phrase);
  return Boolean(needle) && ` ${norm(text)} `.includes(` ${needle} `);
};

const ENVIRONMENT_WORDS: Record<string, RegExp> = {
  DEVELOPMENT: /\b(dev|development|local)\b/i,
  STAGING: /\b(staging|stage|qa)\b/i,
  PRODUCTION: /\b(prod|production|live)\b/i,
};

export interface GroundingResult<W extends UntrustedWorkflow> {
  workflow: NormalizedWorkflow<W>;
  /** One warning per detail left out, in words a reviewer can act on. */
  dropped: FlowLanguageIssue[];
}

export function groundInDocument<W extends UntrustedWorkflow>(workflow: NormalizedWorkflow<W>, text: string | null): GroundingResult<W> {
  const dropped: FlowLanguageIssue[] = [];
  const drop = (target: string, what: string, why: string) => dropped.push({
    code: 'UNSUPPORTED_DETAIL', severity: 'WARNING', target,
    message: `${what} for ${target} was left out: ${why}`,
  });
  const source = text ?? '';
  const written = text === null ? new Set<string>() : pathsIn(source);
  const canCheck = text !== null;
  const noText = 'there is no text to check it against.';

  const states = workflow.states.map((state) => {
    if (!state.recognizer) return state;
    const { routes, headings, texts } = state.recognizer;
    const keptRoutes = routes.filter((route) => canCheck && written.has(route) ? true : (drop(state.key, `The route ${route}`, canCheck ? 'the document never writes it.' : noText), false));
    const keptHeadings = headings.filter((heading) => canCheck && writtenAsHeading(source, heading) ? true : (drop(state.key, `The heading “${heading}”`, canCheck ? 'the document never gives the page that heading.' : noText), false));
    const keptTexts = texts.filter((item) => canCheck && writtenAsHeading(source, item) ? true : (drop(state.key, `The text “${item}”`, canCheck ? 'the document never says it.' : noText), false));
    const { recognizer: _removed, ...rest } = state;
    return keptRoutes.length || keptHeadings.length || keptTexts.length
      ? { ...rest, recognizer: { routes: keptRoutes, headings: keptHeadings, texts: keptTexts } }
      : rest;
  });

  const transitions = workflow.transitions.map((transition) => {
    const label = `${transition.from} → ${transition.to}`;
    let next = { ...transition };
    if (transition.control?.label && canCheck && !writtenAsControl(source, transition.control.label)) {
      drop(label, `The control “${transition.control.label}”`, 'the document does not name it as a button, link or other control.');
      // A test id was a separate claim; without a label to anchor it, it cannot stand alone.
      delete next.control;
    }
    if (transition.effects?.length) {
      const kept = transition.effects.filter((effect) => {
        const ok = canCheck && written.has(effect.route);
        if (!ok) drop(label, `The request ${effect.method} ${effect.route}`, canCheck ? 'the document never writes that path.' : noText);
        return ok;
      });
      if (kept.length) next.effects = kept;
      else delete next.effects;
    }
    if (transition.inputs?.length && canCheck) {
      const kept = transition.inputs.filter((input) => {
        const ok = has(source, input.name) || has(source, input.label ?? '');
        if (!ok) drop(label, `The input “${input.name}”`, 'the document never mentions that field.');
        return ok;
      });
      if (kept.length) next.inputs = kept;
      else delete next.inputs;
    }
    return next;
  });

  let requires = workflow.requires;
  if (requires) {
    const environments = requires.environments.filter((environment) => {
      const ok = canCheck && ENVIRONMENT_WORDS[environment]?.test(source);
      if (!ok) drop('the flow', `The environment ${environment.toLowerCase()}`, canCheck ? 'the document never names it.' : noText);
      return ok;
    });
    const actor = requires.actor && (!canCheck || has(source, requires.actor)) ? requires.actor : undefined;
    if (requires.actor && !actor) drop('the flow', `The account ${requires.actor}`, 'the document never mentions it.');
    // What the steps type is added again from the surviving inputs, so a key whose input was dropped goes with it.
    const keys = new Set(transitions.flatMap((transition) => (transition.inputs ?? []).filter((input) => input.role !== 'GENERATED').map((input) => input.dataKey)));
    const data = requires.data.filter((key) => keys.has(key));
    requires = actor || environments.length || data.length ? { ...(actor ? { actor } : {}), environments, data } : undefined;
  }

  const { requires: _requires, ...rest } = workflow;
  return { workflow: { ...rest, states, transitions, ...(requires ? { requires } : {}) } as NormalizedWorkflow<W>, dropped };
}
