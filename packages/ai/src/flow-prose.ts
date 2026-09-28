import { LanguageState, LanguageTransition, compactActionName, compactStateName, placeKeyFromPhrase, toSnakeKey } from './flow-language';
import { sanitizeControl, sanitizeEffects, sanitizeInputs, sanitizeRecognizer, type FlowRequires, type TransitionControl, type TransitionEffect, type TransitionInput } from './flow-spec';

/**
 * Reads a journey out of plain prose, without an AI provider.
 *
 * "The admin opens the system and lands on the login page, they input their email
 * and password. On successful authentication they are carried to their dashboard."
 * becomes GUEST → LOGIN_PAGE → DASHBOARD, with OPEN_APP and SUBMIT_CREDENTIALS
 * between them. It looks for the two things a journey is made of: the moment the
 * user arrives somewhere (a page, screen, modal, dashboard ...) and the thing they
 * did to get there (a click, a submitted form ...). Sentences that contain neither
 * are context, not steps, and are left out.
 *
 * This is a heuristic and is treated as one: callers give its result low
 * confidence and ask a person to check it.
 */

export interface ProseSegment {
  id: string;
  text: string;
}

type DerivedState = LanguageState & { key: string; evidenceIds: string[]; confidence: number };
type DerivedTransition = LanguageTransition & { evidenceIds: string[]; confidence: number };

export interface DerivedJourney {
  states: DerivedState[];
  transitions: DerivedTransition[];
  /** Who the journey signs in as, when the text says so. */
  requires?: FlowRequires;
}

const CONFIDENCE = 0.5;

const ARRIVAL = /\b(?:lands?|landed|carried|taken|redirected|routed|navigated|directed|sent|brought|appears?|shown|displayed?|displays|shows?|refreshe?s?|opens?|loads?|presented|arrives?|sees?|views?|(?:goes|go|heads?)\s+to)\b/i;
const CLICK = /\b(?:clicks?|clicked|taps?|presses|press|selects?)\b/i;
const INPUT = /\b(?:inputs?|enters?|types?|fills?(?:\s+in)?|provides?|submits?)\b/i;
const OPEN_APP = /\b(?:opens?|visits?|launch(?:es)?|starts?|goes\s+to)\s+(?:the\s+)?(?:system|app|application|site|website|platform|portal|store|shop)\b/i;
const CREDENTIALS = /\b(?:e-?mail|password|credentials?|username|log\s?in|sign\s?in)\b/i;
const SUCCESS_CUE = /\b(?:on|upon|after)\s+(?:a\s+)?success(?:ful)?\b|\bsuccessful(?:ly)?\b|\bif\s+(?:it|they|everything)\s+succeed/i;
const FAILURE_CUE = /\b(?:invalid|incorrect|wrong|fails?|failed|failure|declined|denied|rejected|unsuccessful|error)\b/i;
const FAILURE_SURFACE = /\b(?:message|banner|alert|toast|error|warning)\b/i;
const ACTOR = /\b(admin(?:istrator)?|student|teacher|instructor|customer|guest|visitor|member|manager|user|shopper|buyer|seller|patient|doctor)\b/i;
const ENTRY_PLACE = /LOGIN|SIGN_IN|SIGN_UP|REGISTER|LANDING|WELCOME|HOME/;
const CONTROL_NOUNS = 'link|button|tab|icon|menu item|option|toggle|checkbox|dropdown';
const SUBMIT_LABEL = /^(?:create|save|submit|confirm|add|update|send|ok|done|continue|next|sign in|sign up|log in|login|register|apply|finish|publish|pay|purchase|place|buy|verify|book|post)\b/i;
const BARE_CLICK_TARGET = /\b(?:clicks?|clicked|taps?|presses|press|selects?)\s+(?:on\s+)?(?:the\s+)?([A-Z][\w-]*(?:\s+[A-Z][\w-]*){0,2})/;
const INPUT_VERB = /\b(?:inputs?|enters?|types?|fills?(?:\s+in)?|provides?)\b/i;
const FIELD_END = /\b(?:and\s+)?(?:clicks?|presses|press|taps?|selects?)\b|\bto\s+(?:be|create|log|sign|submit|authenticate|continue|proceed|see|make)\b|\bin order to\b|[.;]/i;
const FIELD_FILLER = /\b(?:the|their|his|her|its|your|a|an|own|new|then|will|they)\b/gi;
const CREDENTIAL_NAME = /^(?:e-?mail|email address|username|user name|login|password|passcode)$/i;
const PATH_IN_TEXT = /(?:^|[\s(])((?:https?:\/\/[^\s/]+)?\/[A-Za-z0-9_\-/{}:[\]]*[A-Za-z0-9_\]}])/;
const EFFECT_IN_TEXT = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s,;)]+)(?:\s*(?:->|=>|→|returns?|returning|responds?(?:\s+with)?|responding(?:\s+with)?|with status)\s*(\d{3}))?/;
const HEADING_IN_TEXT = /\b(?:titled|headed|heading|headline|says|reads|saying)\s+(?:it\s+)?(«\d+»)/i;
const CONTROL_ROLE_BY_NOUN: Record<string, TransitionControl['role']> = {
  link: 'link', button: 'button', tab: 'tab', 'menu item': 'menuitem', option: 'menuitem', checkbox: 'checkbox', toggle: 'checkbox', dropdown: 'select', icon: 'button',
};
const PLACE_BARE = /^(?:MODAL|DIALOG|POPUP|FORM|DRAWER|WINDOW|PANEL)$/;
const PLACE_SUFFIX = /_(?:PAGE|SCREEN|MODAL|DIALOG|POPUP|FORM|DASHBOARD|OVERVIEW|VIEW)$/;

/** Quoted text is set aside so a clause split never cuts through a label (or an apostrophe). */
function protectQuotes(text: string): { text: string; restore: (value: string) => string } {
  const quoted: string[] = [];
  const keep = (_match: string, lead: string, inner: string) => {
    quoted.push(inner);
    return `${lead}«${quoted.length - 1}»`;
  };
  const masked = text
    .replace(/(^|[^\w])["“”]([^"“”]{1,80})["“”]/g, keep)
    .replace(/(^|[\s(])['‘]([^'‘’]{1,80})['’](?=[\s.,;)!?]|$)/g, keep);
  return { text: masked, restore: (value) => value.replace(/«(\d+)»/g, (_m, index: string) => quoted[Number(index)] ?? '') };
}

function clausesOf(sentence: string): string[] {
  return sentence
    // A missing full stop between sentences: "...on the system The admin opens ..."
    .replace(/([a-z0-9])\s+(?=(?:The|They|On|After|When|Once|If)\s+[a-z])/g, '$1. ')
    .split(/(?<=[.!?])\s+/)
    .flatMap((part) => part.split(/\s*;\s*|,\s*(?=(?:and\s+)?(?:they|then|which|on|after|when|once|if|a|an|the)\b)|\s+(?:and then|after which|which)\s+/i))
    .map((part) => part.replace(/[.!?]+$/, '').trim())
    .filter((part) => part.length > 3);
}

/** A control named in a clause: "the Courses link", "the "Create A Course" button", or `clicks Verify`. */
function controlIn(clause: string, restore: (value: string) => string): string | null {
  const labelled = new RegExp(`(?:the\\s+|a\\s+|an\\s+)?(«\\d+»\\s+|(?:[A-Za-z][\\w-]*\\s+){0,3}?)(${CONTROL_NOUNS})\\b`, 'i').exec(clause);
  if (labelled) {
    const label = restore(labelled[1]).trim();
    // A quoted label is the text on the control, exactly. An unquoted one may carry the sentence's own
    // lead-in words ("click on the"), which are trimmed from the front only: "Create A Course" keeps its A.
    const stripped = /^«/.test(labelled[1].trim())
      ? label
      : label.replace(/^(?:(?:the|a|an|their|on|click|clicks|see|sees|will|then|they|and|to)\s+)+/i, '');
    return `${stripped} ${labelled[2]}`.trim();
  }
  const quoted = /\b(?:clicks?|clicked|taps?|presses|press|selects?)\s+(?:on\s+)?(?:the\s+)?(«\d+»)/i.exec(clause);
  if (quoted) return restore(quoted[1]).trim();
  return BARE_CLICK_TARGET.exec(restore(clause))?.[1]?.trim() ?? null;
}

/**
 * What a control is called in an action. A button is named for what it does
 * ("Create A Course button" -> CREATE_COURSE); a link or tab is named as it appears
 * ("Courses link" -> COURSES_LINK) because that is how a person would find it.
 */
function purposeOf(control: string): string {
  const named = /\bbutton$/i.test(control.trim()) ? control.replace(/\bbutton$/i, '') : control;
  return toSnakeKey(named).split('_').filter((word) => !/^(?:A|AN|THE)$/.test(word)).join('_');
}

/** List markers ("1.", "-", "•") are not part of a sentence. */
function withoutListMarkers(text: string): string {
  return text.replace(/^[ \t]*(?:\d+[.)]|[-*•])[ \t]+/gm, '');
}

/** "Courses link" -> link "Courses"; a bare label such as "Verify" has no role to claim. */
function controlFrom(control: string | null): TransitionControl | undefined {
  if (!control) return undefined;
  const noun = new RegExp(`\\b(${CONTROL_NOUNS})$`, 'i').exec(control.trim());
  const label = (noun ? control.trim().slice(0, noun.index) : control).trim();
  return sanitizeControl({ role: noun ? CONTROL_ROLE_BY_NOUN[noun[1].toLowerCase()] : undefined, label });
}

/** The fields a clause says the user fills in: "input their email and password" -> email, password. */
function fieldsIn(clause: string): string[] {
  const verb = INPUT_VERB.exec(clause);
  if (!verb) return [];
  const tail = clause.slice(verb.index + verb[0].length).replace(/^\s*(?:in\s+)?/i, '').split(FIELD_END)[0] ?? '';
  return tail.split(/,|\band\b/i)
    .map((part) => part.replace(/«\d+»/g, '').replace(FIELD_FILLER, '').replace(/\s+/g, ' ').trim())
    .filter((part) => part && part.split(' ').length <= 4 && /^[A-Za-z][A-Za-z0-9 -]*$/.test(part));
}

export function deriveJourneyFromProse(segments: ProseSegment[]): DerivedJourney | null {
  const states: DerivedState[] = [];
  const transitions: DerivedTransition[] = [];

  let actor: string | undefined;
  let lastControl: string | null = null;
  let pendingAction: string | null = null;
  let pendingCondition: string | undefined;
  let failureAhead = false;
  let sawOpenApp = false;
  let pendingControl: TransitionControl | undefined;
  let pendingInputs: TransitionInput[] = [];
  let pendingEffects: TransitionEffect[] = [];
  /** The state the journey is on. Error states hang off it and never move it. */
  let position: DerivedState | undefined;

  const add = (state: DerivedState) => {
    states.push(state);
    return state;
  };
  const connect = (from: DerivedState, to: DerivedState, evidenceIds: string[], condition: string | undefined, consume: boolean) => {
    const action = pendingAction ?? (sawOpenApp && from.role === 'INITIAL' ? 'OPEN_APP' : null);
    transitions.push({
      from: from.key, to: to.key, action: compactActionName(action, to.key),
      ...(condition ? { condition } : {}),
      ...(pendingControl ? { control: pendingControl } : {}),
      ...(pendingInputs.length ? { inputs: pendingInputs } : {}),
      ...(pendingEffects.length ? { effects: pendingEffects } : {}),
      evidenceIds, confidence: CONFIDENCE,
    });
    if (consume) {
      pendingAction = null;
      pendingCondition = undefined;
      sawOpenApp = false;
      pendingControl = undefined;
      pendingInputs = [];
      pendingEffects = [];
    }
  };

  for (const segment of segments) {
    const protectedText = protectQuotes(withoutListMarkers(segment.text));
    const sentences = protectedText.text.split(/(?<=[.!?])\s+|\n+/).map((value) => value.trim()).filter(Boolean);
    for (const sentence of sentences) {
      for (const clause of clausesOf(sentence)) {
        const text = protectedText.restore(clause);
        const evidenceIds = [segment.id];
        actor ??= ACTOR.exec(text)?.[1]?.toUpperCase();

        if (SUCCESS_CUE.test(clause)) pendingCondition = 'ON_SUCCESS';
        const control = controlIn(clause, protectedText.restore);
        if (control) lastControl = control;
        if (OPEN_APP.test(clause)) sawOpenApp = true;

        // What the user does in this clause, remembered until they arrive somewhere.
        const fields = fieldsIn(clause);
        if (fields.length) {
          const actorKey = (actor ?? 'USER').replace(/[^A-Z0-9]+/g, '_');
          pendingInputs = sanitizeInputs(fields.map((name) => {
            const key = name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
            return CREDENTIAL_NAME.test(name)
              ? { name, dataKey: `${actorKey}_${key}`, role: 'PROTECTED' }
              : { name, dataKey: key, role: 'GENERATED' };
          }));
        }
        const effect = EFFECT_IN_TEXT.exec(text);
        if (effect) pendingEffects = sanitizeEffects([{ method: effect[1], route: effect[2], status: effect[3] }]);
        if (CLICK.test(clause)) {
          const target = control ?? lastControl;
          if (target) {
            pendingControl = controlFrom(target);
            // Filling in fields and then confirming them is one act: submitting the form.
            const submitsForm = INPUT.test(clause) && SUBMIT_LABEL.test(target);
            pendingAction = submitsForm
              ? (CREDENTIALS.test(clause) ? 'SUBMIT_CREDENTIALS' : 'SUBMIT_FORM')
              : `CLICK_${purposeOf(target) || toSnakeKey(target)}`;
          }
        } else if (INPUT.test(clause)) {
          pendingAction = CREDENTIALS.test(clause) ? 'SUBMIT_CREDENTIALS' : 'SUBMIT_FORM';
        }

        let place = ARRIVAL.test(clause) ? placeKeyFromPhrase(clause) : null;
        if (place && PLACE_BARE.test(place)) {
          // A bare "a modal appears" is named for the control that opened it.
          const purpose = lastControl ? purposeOf(lastControl) : '';
          place = purpose ? compactStateName(`${purpose}_${place}`) : place;
        }

        const failing = failureAhead || FAILURE_CUE.test(clause);
        if (!place) {
          if (FAILURE_CUE.test(clause)) failureAhead = true;
          continue;
        }

        if (!position) {
          const start = ENTRY_PLACE.test(place) ? 'GUEST' : 'START';
          position = add({ key: start, name: start, category: 'NAVIGATION', role: 'INITIAL', actor: start === 'GUEST' ? 'GUEST' : actor, evidenceIds, confidence: CONFIDENCE });
        }

        const existing = states.find((state) => state.key === place);
        if (failing && FAILURE_SURFACE.test(clause) || failing && existing && existing === position) {
          // A failure shown on the current screen is a branch, not a new step.
          const errorKey = `${place.replace(PLACE_SUFFIX, '')}_ERROR`;
          let error = states.find((state) => state.key === errorKey);
          if (!error) {
            error = add({ key: errorKey, name: errorKey, category: 'ERROR', description: text.slice(0, 200), actor, evidenceIds, confidence: CONFIDENCE });
            connect(position, error, evidenceIds, 'ON_FAILURE', false);
            transitions.push({ from: error.key, to: position.key, action: 'RETRY', evidenceIds, confidence: CONFIDENCE });
          }
          failureAhead = false;
          continue;
        }

        // Only what the text states: a route written out, a heading it quotes. Never a guess from the name.
        const written = PATH_IN_TEXT.exec(text)?.[1];
        const heading = HEADING_IN_TEXT.exec(clause)?.[1];
        const recognizer = written || heading
          ? sanitizeRecognizer({ routes: written ? [written] : [], headings: heading ? [protectedText.restore(heading)] : [] })
          : undefined;
        const arrived = existing ?? add({
          key: place, name: place,
          category: PLACE_SUFFIX.test(place) || place === 'DASHBOARD' ? 'NAVIGATION' : 'UI',
          description: text.slice(0, 200), actor, evidenceIds, confidence: CONFIDENCE,
          ...(recognizer ? { recognizer } : {}),
        });
        if (arrived !== position) connect(position, arrived, evidenceIds, pendingCondition, true);
        position = arrived;
        failureAhead = false;
      }
    }
  }

  if (states.length < 2 || !transitions.length) return null;
  for (const state of states) state.actor ??= actor;
  // Signing in as someone is a requirement of running the journey, in the person's own words.
  const signsIn = transitions.some((transition) => (transition.inputs ?? []).some((input) => input.role === 'PROTECTED'));
  return { states, transitions, ...(actor && signsIn ? { requires: { actor, environments: [], data: [] } } : {}) };
}
