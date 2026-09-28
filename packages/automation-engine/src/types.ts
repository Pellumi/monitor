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
}

export interface ObservedRequest {
  method: string;
  /** Canonicalised route of the request, e.g. `/api/exams/{param}`. */
  route: string;
  status: number | null;
  completed: boolean;
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

export interface FormInput {
  /** Human/field name to look for. */
  name: string;
  label: string | null;
  /** Key resolved against the run's data set. */
  dataKey: string;
}

export interface ApiCondition {
  method: string;
  route: string;
  /** A status the completed request is expected to carry, when declared. */
  expectStatus: number | null;
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
  /** Canonical route patterns (`/courses/{param}`) that identify the state. Empty when the code gave none. */
  routePatterns: string[];
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
  /** How dangerous performing it is. Derived from the handler's evidence, conservatively. */
  actionClass: ActionClass;
  expectedApi: ApiCondition[];
  codeRefs: CodeRef[];
  derivation: DerivationStatus;
}

export interface ExecutableContract {
  flowVersionId: string;
  /** sha256 of the published version snapshot the contract was compiled from. */
  flowHash: string;
  /** Identity of the code analysis it was derived from. */
  analysisIdentity: string | null;
  initialStateKey: string;
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

export type AutomationAction =
  | { kind: 'CLICK'; ref: string }
  | { kind: 'FILL'; ref: string; value: string; secret: boolean }
  | { kind: 'NAVIGATE'; url: string };

export interface ActionOutcome {
  ok: boolean;
  error?: string;
}
