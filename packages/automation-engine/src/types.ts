/**
 * Shared shapes for the Automated Run engine.
 *
 * Nothing here knows about Electron, Playwright or the network. The engine is a
 * deterministic core: it is handed structured observations (a `SemanticSnapshot`)
 * and returns decisions (which control to act on, whether a state was reached,
 * when to stop). The desktop supplies the browser; the engine supplies the judgement.
 */

/** Ordered by how much damage the action can do. The policy engine gates on this. */
export type ActionClass =
  | 'READ'
  | 'CLIENT_STATE_MUTATION'
  | 'SERVER_MUTATION'
  | 'EXTERNAL_SIDE_EFFECT'
  | 'DESTRUCTIVE';

export type EnvironmentKind = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

// ---------------------------------------------------------------------------
// What the browser reports
// ---------------------------------------------------------------------------

/**
 * How an element is actually rendered: where it is, whether a person could reach it, and what it looks like.
 *
 * This is the "screen analysis" half of recognition, and it is deliberately measurement rather than pixels. The
 * engine stays deterministic — every decision it makes from this is a number compared with a number, reproducible
 * from the same page — while gaining the two things the DOM alone cannot tell it:
 *
 *   - whether the control it picked is one a person could actually click (on screen, not covered by an overlay,
 *     not a zero-sized box), which is a whole class of failure it previously could not see;
 *   - what the page looks like, which is what every judgement about legibility, tap targets, contrast and the
 *     weight of a button is made from.
 *
 * It never leaves the machine as itself. What travels is the findings drawn from it.
 */
export interface ElementGeometry {
  /** In CSS pixels, relative to the viewport. */
  rect: { x: number; y: number; width: number; height: number };
  /** Whether any part of the element is inside the viewport as it stands. */
  inViewport: boolean;
  /**
   * Whether the element at the centre of `rect` is this element, or inside it. False means something is on top
   * of it — a modal, a sticky header, a cookie banner — so a click aimed here would land on that instead.
   */
  hitTestOk: boolean;
  fontSizePx: number | null;
  fontWeight: number | null;
  /** Resolved colours, as the browser reports them (`rgb(...)` / `rgba(...)`). */
  color: string | null;
  /** The nearest ancestor's non-transparent background, which is what the text is actually read against. */
  backgroundColor: string | null;
  borderWidthPx: number | null;
  borderStyle: string | null;
  cursor: string | null;
  opacity: number | null;
  /**
   * How much visual weight the element carries, which is what tells a primary action from a secondary one:
   * `FILLED` has a background of its own, `OUTLINED` only a border, `TEXT` neither.
   */
  emphasis: 'FILLED' | 'OUTLINED' | 'TEXT' | 'UNKNOWN';
}

/** One interactive or identifying element, reduced to what recognition and ranking need. */
export interface SemanticElement {
  /** Stable within one snapshot; how the browser adapter finds the element again. */
  ref: string;
  tag: string;
  /** ARIA role, explicit or implicit (a `<button>` is `button`, an `<a href>` is `link`). */
  role: string | null;
  /** Accessible name. */
  name: string | null;
  /** Associated `<label>` text, for form controls. */
  label: string | null;
  testId: string | null;
  domId: string | null;
  href: string | null;
  /** `data-tellann-action`, when instrumentation has placed one. */
  actionAnchor: string | null;
  /** Form control name / type, for inputs. */
  fieldName: string | null;
  inputType: string | null;
  visible: boolean;
  enabled: boolean;
  /** Checkbox, radio or switch: whether it is currently on, when the element reports one. Never read from a text field. */
  checked?: boolean | null;
  /** A native `<select>`: the choices it offers, so a value it does not offer is caught before anything is done. */
  options?: string[] | null;
  /** The `value` of each of those options, so a data value may name either the label or the value. */
  optionValues?: string[] | null;
  /** A `<select multiple>`. */
  multiple?: boolean;
  /** The `value` attribute of a radio or checkbox: static markup naming the choice, never something a person typed. */
  optionValue?: string | null;
  /** `aria-haspopup`, which marks a custom combobox or listbox. */
  popup?: string | null;
  /** The `autocomplete` token (for example `one-time-code`), which marks fields whose value belongs to the person, not to us. */
  autocomplete?: string | null;
  /** The name of the radio group, checkbox group or fieldset the element sits in: what a Flow calls the field, as opposed to the choice. */
  group?: string | null;
  /**
   * How the element is rendered. Absent when the adapter was not asked to measure (and on every snapshot a test
   * writes by hand), so nothing that reads it may require it: a decision that cannot be made without geometry
   * falls back to the one the engine made before geometry existed.
   */
  geometry?: ElementGeometry;
}

export interface ObservedRequest {
  method: string;
  /** Canonicalised route of the request, e.g. `/api/exams/{param}`. */
  route: string;
  status: number | null;
  completed: boolean;
}

/** Facts about the page as a whole at the size it was measured at. */
export interface PageMeasurement {
  viewport: { width: number; height: number };
  /** How far the page overflows sideways. Above zero is a horizontal scrollbar somebody has to use. */
  horizontalOverflowPx: number;
  /** The smallest text a person is actually asked to read, in CSS pixels. Null when nothing was measured. */
  smallestTextPx: number | null;
  /**
   * Whether the page was saying it was busy at the moment it was read.
   *
   * Read right after an action rather than once everything has settled, because by the time a page is settled
   * any loader it showed has gone — so asking afterwards would always answer "no". This is what tells a page
   * that took a visible while and said so from one that took a visible while and looked broken.
   */
  busyIndicator?: boolean;
}

/** One of the window sizes a Flow is checked at. */
export interface Breakpoint {
  /** What to call it in a report: `mobile`, `tablet`, `laptop`. */
  name: string;
  width: number;
  height: number;
}

/** How one state looked at one window size. */
export interface ViewportSample {
  breakpoint: Breakpoint;
  page: PageMeasurement;
  /** The elements as drawn at this size, so the rules can judge them without measuring again. */
  elements: SemanticElement[];
}

/** Everything the recognizer and planner see. Deliberately not pixels. */
export interface SemanticSnapshot {
  url: string;
  /** Path portion of `url`, canonicalised by the adapter only if the app is a single-page router; raw otherwise. */
  path: string;
  title: string | null;
  headings: string[];
  elements: SemanticElement[];
  /** State keys the application's own SDK reported since the last action, most recent last. */
  sdkStates: string[];
  requests: ObservedRequest[];
  /** Console/runtime errors seen since the last snapshot. */
  errorCount: number;
  /** Hosts of the frames embedded in the page (never their content): how an embedded CAPTCHA or identity widget is recognised. */
  frameOrigins?: string[];
  /** The page as drawn, at the size it was read at. Absent when the adapter was not asked to measure. */
  page?: PageMeasurement;
}

// ---------------------------------------------------------------------------
// The executable Flow contract
// ---------------------------------------------------------------------------

/** What a control should look like in the DOM, derived from the code that handles it. */
export interface ControlDescriptor {
  /** Labels the control carries in source: button text, aria-label, etc. */
  labels: string[];
  testId: string | null;
  domId: string | null;
  /** JSX/HTML element the handler was attached to, when known. */
  element: string | null;
  /** DOM event the handler listens for. */
  event: string | null;
  /** `data-tellann-action` value instrumentation would place on it. */
  actionAnchor: string | null;
  /** Route a link/redirect control leads to, when known. */
  href: string | null;
}

/**
 * Where a typed value comes from, and what that means for how it is treated:
 *   PROTECTED  a credential or secret. Read from the run data (marked secret) or the persona's stored sign-in,
 *              typed but never recorded, and never invented.
 *   PROVIDED   an ordinary value the run data must supply. A run stops before it starts if it is missing.
 *   GENERATED  any unique value will do (a title, a name). The run data's value is used when there is one;
 *              otherwise one is made for this run, so the flow needs no data set.
 * Absent (a Flow declared before roles existed) behaves as PROVIDED.
 */
export type InputRole = 'PROTECTED' | 'PROVIDED' | 'GENERATED';

export interface FormInput {
  /** Human/field name to look for. */
  name: string;
  label: string | null;
  /** Key resolved against the run's data set. */
  dataKey: string;
  role?: InputRole;
}

export interface ApiCondition {
  method: string;
  route: string;
  /** A status the completed request is expected to carry, when declared. */
  expectStatus: number | null;
  /**
   * Declared by a person rather than derived from the code. Only a declared effect is checked after the
   * step: a request the code analysis merely thinks is made is evidence for recognition, not a promise.
   */
  declared?: boolean;
}

/** Who performs a step. AUTO: the run. CONFIRM: the run, after a person approves. MANUAL: the person, then the run verifies. */
export type StepMode = 'AUTO' | 'CONFIRM' | 'MANUAL';

/** What a run needs before it starts, as declared on the Flow. */
export interface ContractRequirements {
  /** The role the signed-in persona must have. */
  actor?: string;
  /** Environments the Flow may be run in. Empty means any environment automated runs are allowed in. */
  environments: EnvironmentKind[];
  /** Run-data keys the Flow needs. */
  data: string[];
}

export interface CodeRef {
  file: string;
  symbol: string | null;
  entityId: string | null;
}

export type DerivationStatus = 'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED';

export interface ExecutableState {
  /** Normalised flow state key: the same key the boundary evaluator uses. */
  key: string;
  name: string;
  role: 'INITIAL' | 'NORMAL' | 'TERMINAL';
  terminalKind: string | null;
  /** Canonical route patterns (`/courses/{param}`) that identify the state. Declared ones win; else derived; else empty. */
  routePatterns: string[];
  /** Headings (or the page title) a person declared for the state. Absent on a contract compiled before they existed. */
  headings?: string[];
  /** Visible text a person declared for the state. */
  texts?: string[];
  /** Elements that must be present for the state to be recognised. */
  requiredElements: ControlDescriptor[];
  /** Elements that raise confidence when present but never veto. */
  optionalElements: ControlDescriptor[];
  /** Keys the SDK is expected to report when the state is entered. */
  sdkStateSignals: string[];
  expectedApi: ApiCondition[];
  codeRefs: CodeRef[];
  derivation: DerivationStatus;
}

export interface ExecutableTransition {
  id: string;
  from: string;
  to: string;
  action: string | null;
  /** The control to act on. `null` when the code gave no evidence: the executor stops rather than guessing. */
  control: ControlDescriptor | null;
  inputs: FormInput[];
  /** How dangerous performing it is. Derived from the handler's evidence and any declared effects, conservatively. */
  actionClass: ActionClass;
  /** Who performs it. Absent on a contract compiled before modes existed, which means AUTO. */
  mode?: StepMode;
  /** Where `control` came from: the code analysis, a person's declaration, or both agreeing. */
  controlOrigin?: 'CODE' | 'DECLARED' | 'BOTH' | null;
  expectedApi: ApiCondition[];
  codeRefs: CodeRef[];
  derivation: DerivationStatus;
  /**
   * Where the one control that performs this transition lives in source, when the analysis found exactly one.
   * With several (one handler behind two buttons) there is no single element to anchor, so there is none here.
   */
  controlSource?: { file: string; startLine: number; endLine: number; element: string | null } | null;
}

export interface ExecutableContract {
  flowVersionId: string;
  /** sha256 of the published version snapshot the contract was compiled from. */
  flowHash: string;
  /** Identity of the code analysis it was derived from. */
  analysisIdentity: string | null;
  initialStateKey: string;
  /** What a run needs before it starts. Absent when nothing was declared. */
  requires?: ContractRequirements;
  /**
   * Every normalised name a state answers to (its key, name, id...), mapped to its key. How a marker
   * that names a state by id is understood as the state the contract knows by key. Absent on a
   * contract compiled before this existed, which then reads markers by key alone.
   */
  stateAliases?: Record<string, string>;
  states: ExecutableState[];
  transitions: ExecutableTransition[];
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export interface RecognitionEvidence {
  route: 'MATCH' | 'MISMATCH' | 'NOT_APPLICABLE';
  /** A declared heading or text against the page. Absent on evidence recorded before declarations existed. */
  heading?: 'MATCH' | 'MISMATCH' | 'NOT_APPLICABLE';
  sdk: 'MATCH' | 'CONFLICT' | 'ABSENT';
  requiredPresent: number;
  requiredTotal: number;
  optionalPresent: number;
  optionalTotal: number;
  apiMatched: number;
  apiTotal: number;
}

export interface Recognition {
  stateKey: string;
  score: number;
  confidence: Confidence;
  evidence: RecognitionEvidence;
}

export type CandidateMethod =
  | 'ACTION_ANCHOR'
  | 'TEST_ID'
  | 'ROLE_NAME'
  | 'LABEL'
  | 'HREF'
  | 'TEXT'
  | 'STRUCTURAL';

export interface ControlCandidate {
  element: SemanticElement;
  method: CandidateMethod;
  score: number;
}

/** A file to hand to a file input. Carried inline so nothing about it depends on a path on the machine. */
export interface AutomationFile {
  name: string;
  mimeType: string;
  /** Base64 of the content. */
  base64: string;
}

export type AutomationAction =
  | { kind: 'CLICK'; ref: string }
  | { kind: 'FILL'; ref: string; value: string; secret: boolean }
  /** Choose from a native `<select>` or a custom combobox/listbox: `value` names the option (several, comma-separated, for a multi-select). */
  | { kind: 'SELECT'; ref: string; value: string }
  /** Leave a checkbox, radio or switch on or off. */
  | { kind: 'SET_CHECKED'; ref: string; checked: boolean }
  | { kind: 'UPLOAD'; ref: string; file: AutomationFile }
  | { kind: 'NAVIGATE'; url: string };

export interface ActionOutcome {
  ok: boolean;
  error?: string;
}
