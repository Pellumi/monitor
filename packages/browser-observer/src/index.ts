import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Frame, type Page, type Request } from 'playwright';
import { assertEnvironmentActionAllowed } from '@tellann/agent-policy';
import type {
  BrowserFinding,
  CreateQARunAnnotation,
  QAEvidenceEvent,
  QAInteractionMode,
  QAMentionableMember,
  QAPendingProtectedValue,
  StartGuidedRunInput,
} from '@tellann/desktop-contracts';
import { installQaRecorder } from './injected-recorder';

export type LiveEvidenceKind =
  'CONSOLE' | 'NETWORK' | 'PAGE' | 'ACCESSIBILITY' | 'INTERACTION' | 'STORAGE' | 'PERFORMANCE' | 'FLOW'
  // Backend track. `REQUEST` is a request the application's own server
  // handled, which is a different thing from `NETWORK` — a request the managed
  // browser made — and the two are never mixed in one pane.
  | 'REQUEST' | 'SERVER' | 'DATA';

export type LiveEvidence = {
  id: string;
  kind: LiveEvidenceKind;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  details?: Array<{ label: string; value: string }>;
  /**
   * Ties a row to the interaction that caused it, so the live log can group a
   * click with the requests and state changes it set off.
   */
  groupId?: string | null;
  /**
   * False for a row observed while the run was paused. The browser keeps
   * reporting, but nothing is written to the evidence spool, and the panel has
   * to say so rather than implying the event was captured.
   */
  recorded: boolean;
  timestamp: string;
};

/** One state of the accepted graph this run reconciles against. */
export type RunFlowPlanState = {
  /** Normalised the same way the server's boundary evaluator normalises keys. */
  key: string;
  name: string;
  role: 'INITIAL' | 'NORMAL' | 'TERMINAL';
  terminalKind: string | null;
  category: string | null;
};

export type RunFlowPlanTransition = { from: string; to: string; action: string | null };

export type RunFlowPlan = {
  flowId: string | null;
  flowName: string | null;
  versionId: string | null;
  version: number | null;
  purpose: string | null;
  initialStateKey: string | null;
  terminalStateKeys: string[];
  states: RunFlowPlanState[];
  transitions: RunFlowPlanTransition[];
};

/** An accepted flow event, in order, for the run timeline. */
export type FlowStateVisit = {
  stateKey: string;
  eventType: string;
  fromStateKey: string | null;
  timestamp: string;
};

export type RunCoverage = {
  expectedStates: number;
  visitedStateKeys: string[];
  remainingStateKeys: string[];
  /** Accepted states that are not in the plan, which should never happen. */
  offPlanStateKeys: string[];
  expectedTransitions: number;
  takenTransitionKeys: string[];
  terminalReached: boolean;
};

/** A flow event the server refused, with the reason it gave. */
export type BoundaryRejection = {
  eventType: string;
  stateKey: string | null;
  reason: string;
  timestamp: string;
};

export type RunStateArtifact = {
  stateKey: string | null;
  route: string;
  title: string;
  timestamp: string;
  screenshotFile: string | null;
  accessibilityFile: string | null;
  accessibilityViolations: number | null;
  /** 1-based order of capture, so a report can read the run as a sequence. */
  sequence: number;
  /** Why this moment was captured, carried through to the report card. */
  captureReason: RunCaptureReason;
};

export type RunCaptureReason =
  | 'STATE_SETTLED'
  | 'RUN_FINAL'
  | 'INSPECT_ANNOTATION'
  | 'FINDING';

/**
 * What a stored artifact depicts. Uploaded alongside the bytes so the report
 * can label a capture with the state and route it came from rather than
 * falling back to "Capture 3".
 */
export type ArtifactCaptureContext = {
  stateKey: string | null;
  route: string | null;
  title: string | null;
  sequence: number | null;
  captureReason: RunCaptureReason;
  accessibilityViolations: number | null;
  capturedAt: string | null;
};

export type BrowserWindowResolution = {
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  orientation: string | null;
};

export type BrowserObservation = {
  eventId: string;
  stateName: string;
  category: 'NAVIGATION' | 'UI';
  url: string;
  title: string;
  timestamp: string;
};

export type BrowserObservedTransition = {
  fromEventId: string;
  toEventId: string;
  fromState: string;
  toState: string;
  action: 'NAVIGATE' | 'UI_CHANGE';
  timestamp: string;
};

/**
 * One server route the run has exercised, keyed by method and route template.
 *
 * Aggregated in the desktop rather than recomputed from the evidence spool on
 * every push: a busy backend produces thousands of request events, and the run
 * page only ever shows the table, never the individual rows behind it.
 */
export type BackendEndpointStat = {
  key: string;
  method: string;
  /** Route template where the framework exposes one, else the sanitized path. */
  route: string;
  requests: number;
  errors: number;
  /** Server-side handler duration, in milliseconds. */
  totalDurationMs: number;
  slowestMs: number;
  p95Ms: number;
  lastStatus: number | null;
  lastAt: string;
  /** Data models this endpoint touched, by name. */
  models: string[];
};

/** One persistence model the run has seen written or read. */
export type BackendModelStat = {
  model: string;
  reads: number;
  writes: number;
  /** Operation names as the ORM reported them, most recent first. */
  operations: string[];
  /** Endpoint keys that touched this model. */
  endpoints: string[];
  lastAt: string;
};

/** Everything the backend track knows about the run so far. */
export type BackendRunSummary = {
  requests: number;
  errors: number;
  /** 4xx alone, so a validation-heavy API is not read as a broken one. */
  clientErrors: number;
  serverErrors: number;
  unhandledErrors: number;
  dataOperations: number;
  totalDurationMs: number;
  p50Ms: number | null;
  p95Ms: number | null;
  slowestMs: number | null;
  requestBytes: number;
  responseBytes: number;
  lastRequestAt: string | null;
  endpoints: BackendEndpointStat[];
  models: BackendModelStat[];
};

/** Whether the managed browser is available to be shown, and why not. */
export type BrowserAvailability = 'ACTIVE' | 'CLOSED' | 'NONE';

export type GuidedRunState = {
  runId: string;
  sessionId: string;
  traceId: string;
  applicationId: string;
  environmentId: string;
  environmentType: StartGuidedRunInput['environmentType'];
  expectedGraphVersionId: string | null;
  mode: 'GUIDED' | 'ASSISTED' | 'OBSERVATION_ONLY';
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  phase: 'PRE_BOUNDARY' | 'IN_FLOW' | 'FINALIZING' | 'COMPLETE';
  interactionMode: QAInteractionMode;
  /** What this run captures. A run without FRONTEND never opens a browser. */
  captureTracks: Array<'FRONTEND' | 'BACKEND'>;
  /**
   * `NONE` for a backend-only run, `CLOSED` once the operator closes the
   * managed window. `CLOSED` is recoverable: the browser process is still up
   * and `reopenBrowser` puts a page back on the same context.
   */
  browserStatus: BrowserAvailability;
  /** Present only while the backend track is on. */
  backend: BackendRunSummary | null;
  currentFlowStateKey: string | null;
  evidenceCounts: Record<string, number>;
  targetUrl: string;
  /** Updated by the injected recorder on initial load and every resize. */
  windowResolution?: BrowserWindowResolution | null;
  evidence: LiveEvidence[];
  /** Live rows dropped off the head of the ring buffer, so the panel can say so. */
  evidenceTrimmed: number;
  /** Cumulative live counts per kind. Unlike `evidence`, trimming never lowers these. */
  liveCounts: Record<LiveEvidenceKind, number>;
  /** Newest live row's timestamp, which is what stall detection reads. */
  lastEvidenceAt: string | null;
  observations: BrowserObservation[];
  observedTransitions: BrowserObservedTransition[];
  findings: BrowserFinding[];
  /** The accepted graph this run reconciles against, resolved when the run starts. */
  flowPlan: RunFlowPlan | null;
  /** Recomputed from `flowStateHistory` every time the server accepts a flow event. */
  coverage: RunCoverage | null;
  flowStateHistory: FlowStateVisit[];
  /** The last flow event the server refused. Cleared once the boundary is accepted. */
  boundaryRejection: BoundaryRejection | null;
  /** Inspect comments saved during this run. */
  annotationCount: number;
  /** Per-state screenshots, aria snapshots and accessibility scans. */
  stateArtifacts: RunStateArtifact[];
  /** Evidence events still queued for upload. The main process fills this in. */
  syncBacklog: number;
  artifactDirectory: string;
  startedAt: string;
  endedAt: string | null;
};

export type LocalAnnotationInput = CreateQARunAnnotation & { screenshotPath: string | null };

export function initialCapturePhase(mode: 'GUIDED' | 'ASSISTED' | 'OBSERVATION_ONLY', expectedGraphVersionId?: string | null): 'PRE_BOUNDARY' | 'IN_FLOW' {
  return mode === 'GUIDED' && Boolean(expectedGraphVersionId) ? 'PRE_BOUNDARY' : 'IN_FLOW';
}

/** Installed before application code so observation-only runs cannot mutate via clicks, forms, or socket-backed handlers. */
export function installReadOnlyInteractionGuard(): void {
  const block = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const type of [
    'click', 'dblclick', 'auxclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup',
    'touchstart', 'touchend', 'keydown', 'keyup', 'beforeinput', 'input', 'change', 'submit',
  ]) {
    globalThis.addEventListener(type, block, { capture: true });
  }
}

/** Prevents application code from emitting socket mutations during production observation. */
export function installReadOnlySocketGuard(): void {
  if (typeof globalThis.WebSocket === 'undefined') return;
  Object.defineProperty(globalThis.WebSocket.prototype, 'send', {
    configurable: false,
    writable: false,
    value() { throw new DOMException('WebSocket sends are blocked during production observation', 'SecurityError'); },
  });
}

type RequestRecord = {
  startedAt: number;
  method: string;
  url: string;
  resourceType: string;
  redirectedFrom: string | null;
  safeHeaders: Record<string, string>;
  metadataBody?: unknown;
  protectedValues: QAPendingProtectedValue[];
  interactionGroupId: string | null;
  causedByEventId: string | null;
};

type RunController = {
  state: GuidedRunState;
  /** Null for a backend-only run, which never launches a browser at all. */
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
  /**
   * Puts the listeners, bindings and capture state onto a page. Held on the
   * controller so `reopenBrowser` can wire a replacement page exactly the way
   * `start` wired the first one.
   */
  attachPage: ((page: Page) => void) | null;
  /** Re-derives the observed route from whichever page is current. */
  refreshObservation: (() => Promise<void>) | null;
  observationTimer: ReturnType<typeof setInterval> | null;
  stopping: boolean;
  paused: boolean;
  sequence: number;
  applicationOrigin: string;
  requests: Map<Request, RequestRecord>;
  /** Requests this observer aborted itself under observation-only policy. */
  blockedByPolicy: WeakSet<Request>;
  recentCause: { eventId: string; interactionGroupId: string | null; at: number } | null;
  /** `flowStateKey|route|epoch` triples already snapshotted, so a settle does not refire. */
  capturedStateKeys: Set<string>;
  /** Serialises state snapshots so two settles cannot screenshot at once. */
  snapshotInFlight: boolean;
  /**
   * Bumped by every interaction that can change what is on screen. Part of the
   * snapshot dedupe key so a multi-step flow that never changes route is
   * captured step by step instead of collapsing to a single screenshot.
   */
  interactionEpoch: number;
  /**
   * Structure hash of the last captured snapshot. A settle that produces an
   * identical page — a click that did nothing — is skipped rather than spending
   * a screenshot on it.
   */
  lastCaptureSignature: string | null;
  /** Screenshots taken at the moment a finding was raised. */
  findingArtifacts: Array<{ file: string; context: ArtifactCaptureContext }>;
  /** Finding dedupe keys already given a screenshot. */
  capturedFindingKeys: Set<string>;
  /** Per-endpoint durations, for percentiles the running totals cannot give. */
  backendDurations: Map<string, number[]>;
  /** Every backend duration, for the run-wide percentiles. */
  backendAllDurations: number[];
  /** Backend request ids already counted, so a retried delivery is not double-counted. */
  backendSeenRequests: Set<string>;
  /** Performance rows already spent on each endpoint. */
  backendSlowRows: Map<string, number>;
};

type BridgePayload = {
  eventId?: string;
  type?: string;
  metadata?: Record<string, unknown>;
  value?: string;
  valueKind?: 'ORDINARY' | 'DIRECT_IDENTIFIER' | 'SECRET';
  valuePath?: string;
  interactionGroupId?: string;
  causedByEventId?: string;
};

const PRE_BOUNDARY_TYPES = new Set<QAEvidenceEvent['eventType']>([
  'QA_ROUTE_CHANGED', 'QA_VIEWPORT_CHANGED', 'QA_REQUEST', 'QA_CONSOLE',
  'QA_RUNTIME_ERROR', 'QA_PAGE_CRASH', 'QA_PAGE_PERFORMANCE', 'QA_FLOW_EVENT', 'QA_CAPTURE_DEGRADED',
  'QA_CONTROL_CLICKED', 'QA_FORM_SUBMIT_INTENT',
  // Backend evidence before the boundary is metadata only: the recorder gates
  // payload capture on IN_FLOW itself, so what reaches here is route, status,
  // timing and the models touched - the same shape the browser track keeps.
  'QA_BACKEND_REQUEST', 'QA_BACKEND_ERROR', 'QA_BACKEND_DATA_ACCESS',
]);
const PRE_BOUNDARY_INTERACTION_TYPES = new Set<QAEvidenceEvent['eventType']>([
  'QA_CONTROL_CLICKED', 'QA_FORM_SUBMIT_INTENT',
]);
const SAFE_REQUEST_HEADERS = new Set([
  'accept', 'content-type', 'content-length', 'origin', 'referer', 'user-agent', 'x-requested-with',
]);
/**
 * When a backend request is worth a performance row of its own.
 *
 * Two rules, because "slow" means different things for different endpoints. An
 * absolute floor catches anything a user would notice waiting for; a multiple
 * of the endpoint's own established median catches a route that is normally
 * fast and suddenly is not, which an absolute floor never would.
 */
const SLOW_BACKEND_REQUEST_MS = 1_000;
const SLOW_BACKEND_BASELINE_MULTIPLE = 3;
/** Samples before an endpoint's median is worth comparing against. */
const BACKEND_BASELINE_MIN_SAMPLES = 5;
/** Rows one endpoint may contribute, so a uniformly slow route cannot flood. */
const MAX_SLOW_ROWS_PER_ENDPOINT = 10;
/** A request this slow is reported as a finding, not only as a row. */
const CRITICALLY_SLOW_BACKEND_REQUEST_MS = 5_000;
/** Rows kept in the live panel. Older rows are counted in `evidenceTrimmed`. */
const MAX_LIVE_EVIDENCE = 500;
/** Per-state screenshot/aria/axe captures kept for one run. */
const MAX_STATE_ARTIFACTS = 60;
/** Separate from the state ceiling so a noisy page cannot crowd out flow evidence. */
const MAX_FINDING_ARTIFACTS = 20;
/** Coalescing window for state pushes to the renderer. */
const STATE_PUSH_INTERVAL_MS = 250;
const LIVE_EVIDENCE_KINDS: LiveEvidenceKind[] = [
  'CONSOLE', 'NETWORK', 'PAGE', 'ACCESSIBILITY', 'INTERACTION', 'STORAGE', 'PERFORMANCE', 'FLOW',
  'REQUEST', 'SERVER', 'DATA',
];
/**
 * Token-based, mirroring the server classifier in `qa-privacy`. Raw substring
 * matching misfires on ordinary names (`profile` contains `file`, `company`
 * contains `pan`), and a false SECRET silently discards a legitimate value.
 * The server re-derives its own floor regardless; this is the first pass.
 */
const SECRET_TOKENS = new Set([
  'password', 'passwd', 'passcode', 'passphrase', 'secret', 'token', 'jwt', 'bearer',
  'authorization', 'cookie', 'cvv', 'cvc', 'pin', 'otp', 'credential', 'credentials', 'pan',
]);
const SECRET_PHRASES = [
  'cardnumber', 'cardnum', 'creditcard', 'debitcard', 'securitycode',
  'filecontent', 'filecontents', 'filedata',
  'sessionid', 'sessiontoken', 'sessionkey', 'privatekey', 'secretkey', 'apikey',
  'accesstoken', 'refreshtoken', 'idtoken', 'clientsecret',
];
const IDENTIFIER_TOKENS = new Set(['email', 'phone', 'mobile', 'msisdn', 'ssn']);
const IDENTIFIER_PHRASES = ['userid', 'accountid', 'customerid', 'emailaddress', 'phonenumber'];

function keyPathTokens(keyPath: string): string[][] {
  return keyPath.split('.').filter(Boolean).map((segment) => segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase()));
}

export function isSecretKeyPath(keyPath: string): boolean {
  return keyPathTokens(keyPath).some((tokens) =>
    tokens.some((token) => SECRET_TOKENS.has(token))
    || SECRET_PHRASES.some((phrase) => tokens.join('').includes(phrase)));
}

export function isIdentifierKeyPath(keyPath: string): boolean {
  return keyPathTokens(keyPath).some((tokens) =>
    tokens.some((token) => IDENTIFIER_TOKENS.has(token))
    || IDENTIFIER_PHRASES.some((phrase) => tokens.join('').includes(phrase)));
}

function uuid(): string { return crypto.randomUUID(); }
function checksum(file: string): string { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

/**
 * A capture that failed part-way can still leave the destination file behind —
 * Playwright creates it before writing the image, and an empty aria snapshot
 * redacts down to an empty string. Existence alone is therefore not enough to
 * call an artifact captured: the upload endpoint rejects a zero-byte body, and
 * one rejection aborts the whole run completion.
 */
function hasContent(file: string): boolean {
  try { return fs.statSync(file).size > 0; } catch { return false; }
}

function identifierLikePathSegment(part: string): boolean {
  const decoded = (() => { try { return decodeURIComponent(part); } catch { return part; } })();
  return decoded.includes('@') || /^\+?[\d ().-]{7,}$/.test(decoded)
    || /^[0-9a-f-]{16,}$/i.test(decoded) || /^\d+$/.test(decoded)
    || decoded.length > 40 || /(?:token|secret|reset|invite|verify)[_-]/i.test(decoded);
}

const SAFE_ROUTE_SEGMENTS = new Set([
  'admin', 'app', 'account', 'accounts', 'auth', 'callback', 'dashboard', 'home', 'login', 'logout',
  'orders', 'order', 'products', 'product', 'projects', 'project', 'reports', 'report', 'settings',
  'users', 'user', 'customers', 'customer', 'teams', 'team', 'workspaces', 'workspace', 'new', 'edit',
  'search', 'profile', 'billing', 'checkout', 'cart', 'notifications', 'help', 'support', 'flows', 'qa-runs',
]);

function privacySafePathname(pathname: string): string {
  let visibleIndex = 0;
  return pathname.split('/').map((part) => {
    if (!part) return part;
    const decoded = (() => { try { return decodeURIComponent(part); } catch { return part; } })();
    const normalized = decoded.toLowerCase();
    const safe = !identifierLikePathSegment(part) && (visibleIndex === 0 || SAFE_ROUTE_SEGMENTS.has(normalized));
    visibleIndex += 1;
    return safe ? part : 'DETAIL';
  }).join('/');
}

export function sanitizeCapturedUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.pathname = privacySafePathname(url.pathname);
    const names = [...new Set([...url.searchParams.keys()])].sort();
    url.search = names.length ? `?${names.map((name) => `${encodeURIComponent(name)}=`).join('&')}` : '';
    url.hash = '';
    return url.toString();
  } catch { return raw.split(/[?#]/, 1)[0].slice(0, 2_000); }
}

export function scopeEvidenceForCapturePhase(
  phase: 'PRE_BOUNDARY' | 'IN_FLOW',
  type: QAEvidenceEvent['eventType'],
  metadata: Record<string, unknown>,
  protectedValues: QAPendingProtectedValue[],
): { metadata: Record<string, unknown>; protectedValues: QAPendingProtectedValue[] } {
  if (phase !== 'PRE_BOUNDARY' || !PRE_BOUNDARY_INTERACTION_TYPES.has(type)) {
    return { metadata, protectedValues };
  }
  // Login and setup interactions are useful boundary evidence, but their
  // labels, targets and field values can contain credentials or identifiers.
  return {
    metadata: { interactionType: type === 'QA_FORM_SUBMIT_INTENT' ? 'FORM_SUBMIT' : 'CONTROL_CLICK' },
    protectedValues: [],
  };
}

export function sanitizeBridgeMetadata(type: string | undefined, metadata: Record<string, unknown> = {}): Record<string, unknown> {
  if (type !== 'route') return metadata;
  return {
    ...metadata,
    url: metadata.url ? sanitizeCapturedUrl(String(metadata.url)) : null,
    title: null,
  };
}

function safeMessage(raw: string): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, '$1=')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[PSEUDONYMIZED EMAIL]')
    .slice(0, 2_000);
}

/**
 * Mirrors `normalizeQaFlowKey` in `@tellann/db`, which is what the server's
 * boundary evaluator compares against. Matching it here means the desktop's
 * coverage view and the server's acceptance decision agree on what a state is.
 */
export function normalizeFlowKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Strips captured field content out of an aria snapshot before it is written.
 *
 * Playwright renders a field's value inline after the role and accessible name
 * (`- textbox "Email": someone@example.test`), and sometimes as an indented
 * block beneath it. The role and the name are the structure a reviewer needs;
 * the value is exactly what must not reach an artifact, so it is replaced in
 * both positions rather than only in the nested one.
 */
export function redactAriaSnapshot(snapshot: string): string {
  const valueBearing = /^(\s*-?\s*(?:textbox|combobox|searchbox|spinbutton|password)(?:\s+"[^"]*")?)\s*:?.*$/i;
  const lines = snapshot.split('\n');
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = valueBearing.exec(line);
    if (!match) {
      kept.push(line);
      continue;
    }
    kept.push(`${match[1]}: [PROTECTED]`);
    // Anything indented under the field is part of the same value.
    const indent = line.length - line.trimStart().length;
    while (index + 1 < lines.length) {
      const next = lines[index + 1];
      if (!next.trim()) break;
      if (next.length - next.trimStart().length <= indent) break;
      index += 1;
    }
  }
  return kept.join('\n');
}

function normalizedRoute(urlValue: string): string | null {
  try { return new URL(urlValue).pathname || '/'; } catch { return null; }
}

function detail(label: string, value: unknown): { label: string; value: string } | null {
  if (value === null || value === undefined || value === '') return null;
  return { label, value: safeMessage(String(value)) };
}

function compactDetails(
  items: Array<{ label: string; value: string } | null>,
): Array<{ label: string; value: string }> {
  return items.filter((item): item is { label: string; value: string } => Boolean(item));
}

/**
 * Converts recorder messages into a privacy-safe live row. Raw field, storage,
 * request, and framework-state values are intentionally never copied here.
 */
export function liveEvidenceForBridgePayload(
  payload: BridgePayload,
): Omit<LiveEvidence, 'id' | 'timestamp' | 'recorded'> | null {
  const metadata = payload.metadata ?? {};
  const type = String(payload.type ?? '');
  const target = safeMessage(String(
    metadata.accessibleName ?? metadata.label ?? metadata.name ?? metadata.id ?? metadata.tag ?? 'unnamed element',
  ));
  if (type === 'route') {
    const url = sanitizeCapturedUrl(String(metadata.url ?? ''));
    return {
      kind: 'PAGE', level: 'INFO',
      message: `Navigated to ${normalizedRoute(url) ?? url ?? 'unknown route'}`,
      details: compactDetails([
        detail('Navigation', metadata.kind), detail('Title', metadata.title), detail('URL', url),
      ]),
    };
  }
  if (type === 'viewport') {
    return {
      kind: 'ACCESSIBILITY', level: 'INFO',
      message: `Window ${metadata.innerWidth ?? '?'} × ${metadata.innerHeight ?? '?'} CSS px`,
      details: compactDetails([
        detail('Outer window', metadata.outerWidth != null && metadata.outerHeight != null
          ? `${metadata.outerWidth} × ${metadata.outerHeight}` : null),
        detail('Screen', metadata.screenWidth != null && metadata.screenHeight != null
          ? `${metadata.screenWidth} × ${metadata.screenHeight}` : null),
        detail('Pixel ratio', metadata.devicePixelRatio), detail('Orientation', metadata.orientation),
      ]),
    };
  }
  if (type === 'click') {
    const action = metadata.type === 'submit' ? 'Submit form' : metadata.role === 'link' || metadata.tag === 'a' ? 'Navigate' : 'Activate control';
    return {
      kind: 'INTERACTION', level: 'INFO', message: `Clicked ${target}`,
      details: compactDetails([
        detail('Action', action), detail('Element', metadata.tag), detail('Role', metadata.role),
        detail('ID', metadata.id), detail('Name', metadata.name), detail('Form', metadata.formId),
      ]),
    };
  }
  if (type === 'submit_intent' || type === 'submit') {
    return {
      kind: 'INTERACTION', level: 'INFO',
      message: type === 'submit_intent' ? `Form submission started${target === 'unnamed element' ? '' : ` from ${target}`}` : 'Form submitted',
      details: compactDetails([
        detail('Form ID', metadata.formId), detail('Form name', metadata.formName),
        detail('Method', metadata.method), detail('Action', metadata.action), detail('Valid', metadata.valid),
      ]),
    };
  }
  if (type === 'field') {
    return {
      kind: 'INTERACTION', level: 'INFO', message: `Field changed: ${target}`,
      details: compactDetails([
        detail('Type', metadata.type), detail('ID', metadata.id), detail('Name', metadata.name),
        detail('Form', metadata.formId), detail('Populated', metadata.populated),
        detail('Length', metadata.valueLength), detail('Valid', metadata.valid),
        detail('Protection', payload.valueKind === 'SECRET' ? 'Not captured' : payload.valueKind === 'DIRECT_IDENTIFIER' ? 'Pseudonymized' : 'Encrypted'),
      ]),
    };
  }
  if (type === 'storage') {
    return {
      kind: 'STORAGE', level: 'INFO',
      message: `${metadata.store ?? 'Browser storage'} ${metadata.operation ?? 'changed'}${metadata.key ? `: ${metadata.key}` : ''}`,
      details: compactDetails([
        detail('Previous length', metadata.previousLength), detail('New length', metadata.valueLength),
        detail('Protection', payload.valueKind === 'SECRET' ? 'Not captured' : payload.valueKind === 'DIRECT_IDENTIFIER' ? 'Pseudonymized' : payload.valueKind ? 'Encrypted' : 'Metadata only'),
      ]),
    };
  }
  if (type === 'performance') {
    // Interactions settle too, so the observer can screenshot a modal or an
    // inline error. Those settles exist to drive capture, not to be read: a
    // live row per click would bury the events the reviewer is watching for.
    if (metadata.trigger === 'interaction') return null;
    return {
      kind: 'PERFORMANCE', level: 'INFO',
      message: `Performance snapshot for ${metadata.route ?? 'current route'}`,
      details: compactDetails([
        detail('Data ready', metadata.dataReadyMs != null ? `${metadata.dataReadyMs} ms` : null),
        detail('Visually stable', metadata.visuallyStableMs != null ? `${metadata.visuallyStableMs} ms` : null),
        detail('DOM content loaded', metadata.domContentLoadedMs != null ? `${metadata.domContentLoadedMs} ms` : null),
        detail('Page load', metadata.loadMs != null ? `${metadata.loadMs} ms` : null),
        detail('TTFB', metadata.ttfbMs != null ? `${metadata.ttfbMs} ms` : null),
        detail('FCP', metadata.fcp != null ? `${Math.round(Number(metadata.fcp))} ms` : null),
        detail('LCP', metadata.lcp != null ? `${Math.round(Number(metadata.lcp))} ms` : null),
        detail('CLS', metadata.cls),
        detail('INP', metadata.inpMs != null ? `${metadata.inpMs} ms over ${metadata.interactionCount ?? 0} interactions` : null),
        detail('Blocking time', metadata.longTaskMs ? `${Math.round(Number(metadata.longTaskMs))} ms across ${metadata.longTasks} long tasks` : null),
        detail('Longest task', metadata.longestTaskMs ? `${metadata.longestTaskMs} ms${metadata.longestTaskAttribution ? ` in ${metadata.longestTaskAttribution}` : ''}` : null),
        detail('Resources', metadata.resourceCount),
        detail('Failed resources', metadata.failedResourceCount || null),
        detail('Hidden for', metadata.hiddenMs ? `${metadata.hiddenMs} ms` : null),
      ]),
    };
  }
  if (type === 'runtime_error') {
    return { kind: 'PAGE', level: 'ERROR', message: safeMessage(String(metadata.message ?? 'Runtime error')) };
  }
  return null;
}

export function liveEvidenceForNetworkRequest(input: {
  method: string;
  url: string;
  status: number | null;
  failed: boolean;
  blockedByPolicy: boolean;
  durationMs: number;
  resourceType: string;
  transferredBytes: number | null;
  failure?: string | null;
}): Omit<LiveEvidence, 'id' | 'timestamp' | 'recorded'> {
  const outcome = input.blockedByPolicy
    ? 'blocked by observation policy'
    : input.failed
      ? input.failure || 'failed'
      : String(input.status ?? 'completed');
  const level: LiveEvidence['level'] = input.failed || (input.status ?? 0) >= 500
    ? 'ERROR'
    : (input.status ?? 0) >= 400
      ? 'WARN'
      : 'INFO';
  return {
    kind: 'NETWORK', level,
    message: `${input.method} ${sanitizeCapturedUrl(input.url)} — ${outcome}`,
    details: compactDetails([
      detail('Type', input.resourceType), detail('Duration', `${input.durationMs} ms`),
      detail('Transferred', input.transferredBytes == null ? null : `${input.transferredBytes} bytes`),
    ]),
  };
}

export function emptyBackendSummary(): BackendRunSummary {
  return {
    requests: 0, errors: 0, clientErrors: 0, serverErrors: 0, unhandledErrors: 0,
    dataOperations: 0, totalDurationMs: 0, p50Ms: null, p95Ms: null, slowestMs: null,
    requestBytes: 0, responseBytes: 0, lastRequestAt: null, endpoints: [], models: [],
  };
}

/** Nearest-rank percentile over durations kept for one endpoint or the run. */
export function durationPercentile(values: number[], percentile: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil((percentile / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/**
 * The route a backend request is grouped under.
 *
 * The framework's own template (`/orders/:id`) is always preferred: it is what
 * the developer wrote, and it groups correctly without guessing. Only when the
 * integration could not supply one does this fall back to the request path
 * with identifier-looking segments collapsed, which is the same rule the
 * browser track uses for page routes.
 */
export function backendRouteTemplate(route: unknown, requestPath: unknown): string {
  const template = typeof route === 'string' ? route.trim() : '';
  if (template && template !== '/' ) return template.slice(0, 300);
  const raw = typeof requestPath === 'string' ? requestPath.trim() : '';
  if (!raw) return template || '/';
  const [pathname] = raw.split('?');
  const collapsed = pathname.split('/').filter(Boolean)
    .map((segment) => (identifierLikePathSegment(segment) ? ':id' : segment))
    .join('/');
  return `/${collapsed}`.slice(0, 300);
}

/**
 * Whether a request is slow enough to report on its own, and why.
 *
 * Returns null for an ordinary request: the Requests pane already lists every
 * one of them, and repeating them under Performance would say nothing.
 */
export function classifyBackendLatency(input: {
  durationMs: number;
  /** Durations already seen for this endpoint, excluding this one. */
  baseline: number[];
}): { reason: 'ABSOLUTE' | 'BASELINE'; baselineMs: number | null; multiple: number | null } | null {
  const median = input.baseline.length >= BACKEND_BASELINE_MIN_SAMPLES
    ? durationPercentile(input.baseline, 50)
    : null;
  if (median !== null && median > 0 && input.durationMs >= median * SLOW_BACKEND_BASELINE_MULTIPLE) {
    return {
      reason: 'BASELINE',
      baselineMs: median,
      multiple: Math.round((input.durationMs / median) * 10) / 10,
    };
  }
  if (input.durationMs >= SLOW_BACKEND_REQUEST_MS) {
    return { reason: 'ABSOLUTE', baselineMs: median, multiple: null };
  }
  return null;
}

/** How a slow backend request reads in the Performance pane. */
export function liveEvidenceForBackendLatency(input: {
  method: string;
  route: string;
  durationMs: number;
  statusCode: number | null;
  reason: 'ABSOLUTE' | 'BASELINE';
  baselineMs: number | null;
  multiple: number | null;
  handler?: string | null;
  models?: string[];
}): Omit<LiveEvidence, 'id' | 'timestamp' | 'recorded'> {
  const slow = input.durationMs >= CRITICALLY_SLOW_BACKEND_REQUEST_MS;
  return {
    kind: 'PERFORMANCE',
    level: slow ? 'ERROR' : 'WARN',
    message: input.reason === 'BASELINE' && input.multiple
      ? `${input.method} ${input.route} took ${input.durationMs} ms — ${input.multiple}× its usual`
      : `${input.method} ${input.route} took ${input.durationMs} ms`,
    details: compactDetails([
      detail('Server time', `${input.durationMs} ms`),
      detail('Usual for this route', input.baselineMs == null ? null : `${Math.round(input.baselineMs)} ms median`),
      detail('Status', input.statusCode),
      detail('Handler', input.handler ?? null),
      // What a slow request touched is the first thing anyone asks next.
      detail('Models', input.models?.length ? input.models.join(', ') : null),
    ]),
  };
}

/** How a captured backend request reads in the live panel. */
export function liveEvidenceForBackendRequest(input: {
  method: string;
  route: string;
  status: number | null;
  durationMs: number | null;
  handler?: string | null;
  models?: string[];
  requestBytes?: number | null;
  responseBytes?: number | null;
}): Omit<LiveEvidence, 'id' | 'timestamp' | 'recorded'> {
  const status = input.status ?? 0;
  const level: LiveEvidence['level'] = status >= 500 || status === 0 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
  return {
    kind: 'REQUEST', level,
    message: `${input.method} ${input.route} — ${input.status ?? 'no response'}`,
    details: compactDetails([
      detail('Duration', input.durationMs == null ? null : `${input.durationMs} ms`),
      detail('Handler', input.handler ?? null),
      detail('Models', input.models?.length ? input.models.join(', ') : null),
      detail('Request', input.requestBytes == null ? null : `${input.requestBytes} bytes`),
      detail('Response', input.responseBytes == null ? null : `${input.responseBytes} bytes`),
    ]),
  };
}

function protectStructuredPayload(value: unknown, rootPath = 'payload'): {
  metadata: unknown;
  protectedValues: QAPendingProtectedValue[];
} {
  const protectedValues: QAPendingProtectedValue[] = [];
  const visit = (child: unknown, keyPath: string, depth: number): unknown => {
    if (depth > 8) return '[TRUNCATED]';
    if (child === null || typeof child === 'boolean' || typeof child === 'number') return child;
    if (typeof child === 'string') {
      const clipped = child.slice(0, 16_384);
      const kind: QAPendingProtectedValue['kind'] = isSecretKeyPath(keyPath)
        ? 'SECRET'
        : isIdentifierKeyPath(keyPath) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clipped)
          ? 'DIRECT_IDENTIFIER'
          : 'ORDINARY';
      protectedValues.push({ keyPath, kind, value: kind === 'SECRET' ? undefined : clipped, valueLength: child.length });
      return kind === 'SECRET'
        ? '[NOT CAPTURED]'
        : kind === 'DIRECT_IDENTIFIER' ? '[PSEUDONYMIZED]' : `[PROTECTED · ${child.length} characters]`;
    }
    if (Array.isArray(child)) return child.slice(0, 200).map((item, index) => visit(item, `${keyPath}.${index}`, depth + 1));
    if (typeof child === 'object') {
      return Object.fromEntries(Object.entries(child as Record<string, unknown>).slice(0, 200)
        .map(([key, item]) => [key, visit(item, `${keyPath}.${key}`, depth + 1)]));
    }
    return String(child).slice(0, 2_000);
  };
  return { metadata: visit(value, rootPath, 0), protectedValues };
}

function parseBody(raw: string | null, contentType = ''): unknown {
  if (!raw) return null;
  if (/json/i.test(contentType) || /^[\[{]/.test(raw.trim())) {
    try { return JSON.parse(raw.slice(0, 16_384)); } catch { return raw.slice(0, 16_384); }
  }
  if (/application\/x-www-form-urlencoded/i.test(contentType)) {
    return Object.fromEntries(new URLSearchParams(raw.slice(0, 16_384)).entries());
  }
  return raw.slice(0, 16_384);
}

export function isObservationOnlyRequestAllowed(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

export function browserContextViewport(headless: boolean): { width: number; height: number } | null {
  return headless ? { width: 1440, height: 900 } : null;
}

export function isRetryableTargetConnectionError(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /ERR_CONNECTION_REFUSED|ECONNREFUSED|ERR_CONNECTION_RESET|ERR_ADDRESS_UNREACHABLE/i.test(message);
}

export async function navigateToRunTarget(
  page: Pick<Page, 'goto'>,
  targetUrl: string,
  startupTimeoutMs = 0,
  retryIntervalMs = 500,
): Promise<void> {
  const deadline = Date.now() + startupTimeoutMs;
  while (true) {
    try {
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: startupTimeoutMs > 0 ? Math.max(1_000, deadline - Date.now()) : 30_000,
      });
      return;
    } catch (cause) {
      if (!isRetryableTargetConnectionError(cause) || Date.now() >= deadline) throw cause;
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }
  }
}

export function deriveBrowserState(urlValue: string, titleValue = ''): {
  stateName: string;
  category: 'NAVIGATION' | 'UI';
} {
  const url = new URL(urlValue);
  const pathParts = privacySafePathname(url.pathname).split('/').filter(Boolean)
    .map((part) => {
      const decoded = (() => { try { return decodeURIComponent(part); } catch { return part; } })();
      return identifierLikePathSegment(part) ? 'DETAIL' : decoded;
    });
  const route = pathParts.length ? pathParts.join('_') : 'HOME';
  void titleValue;
  return { stateName: route.replace(/[^a-z0-9]+/gi, '_').toUpperCase().slice(0, 100), category: 'NAVIGATION' };
}

export class BrowserObserver {
  private active: RunController | null = null;
  private statePushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: {
    executablePath?: string;
    headless?: boolean;
    onUnexpectedTermination?: (state: GuidedRunState) => Promise<void> | void;
    onObservation?: (runId: string, observation: BrowserObservation) => Promise<void> | void;
    onEvidenceEvent?: (event: QAEvidenceEvent) => Promise<void> | void;
    onAnnotation?: (runId: string, annotation: LocalAnnotationInput, applicationId: string) => Promise<unknown> | unknown;
    searchMentionableMembers?: (runId: string, query: string) => Promise<QAMentionableMember[]>;
    /**
     * Called, coalesced, whenever the run state changes. This is what lets the
     * renderer stop polling for a full state copy several times a second.
     */
    onStateChanged?: (state: GuidedRunState) => void;
  } = {}) {}

  /**
   * Coalesces state pushes: a burst of requests on one page produces one
   * notification rather than one per row.
   */
  private notifyStateChanged(): void {
    if (!this.options.onStateChanged || this.statePushTimer) return;
    this.statePushTimer = setTimeout(() => {
      this.statePushTimer = null;
      if (!this.active) return;
      try { this.options.onStateChanged?.(this.snapshot()); } catch { /* the renderer went away */ }
    }, STATE_PUSH_INTERVAL_MS);
    this.statePushTimer.unref?.();
  }

  private addLive(state: GuidedRunState, evidence: Omit<LiveEvidence, 'id' | 'timestamp' | 'recorded'> & { recorded?: boolean }) {
    // A paused run still hears from the browser, but `emit` drops everything on
    // the floor, so the row has to carry that it was never written to evidence.
    const recorded = evidence.recorded ?? !(this.active?.paused ?? false);
    const row: LiveEvidence = {
      id: uuid(),
      timestamp: new Date().toISOString(),
      ...evidence,
      recorded,
    };
    state.evidence.push(row);
    state.liveCounts[row.kind] = (state.liveCounts[row.kind] ?? 0) + 1;
    state.lastEvidenceAt = row.timestamp;
    if (state.evidence.length > MAX_LIVE_EVIDENCE) {
      const excess = state.evidence.length - MAX_LIVE_EVIDENCE;
      state.evidence.splice(0, excess);
      state.evidenceTrimmed += excess;
    }
    this.notifyStateChanged();
  }

  private emit(
    controller: RunController,
    type: QAEvidenceEvent['eventType'],
    metadata: Record<string, unknown>,
    input: {
      eventId?: string;
      pageUrl?: string | null;
      protectedValues?: QAPendingProtectedValue[];
      interactionGroupId?: string | null;
      causedByEventId?: string | null;
    } = {},
  ): string | null {
    const { state } = controller;
    if (controller.paused || state.phase === 'FINALIZING' || state.phase === 'COMPLETE') return null;
    if (state.phase === 'PRE_BOUNDARY' && !PRE_BOUNDARY_TYPES.has(type)) return null;
    // Backend evidence passes an explicit null: it has no page, and a run
    // without a browser has none to fall back to either.
    const pageUrl = input.pageUrl !== undefined
      ? input.pageUrl
      : controller.page && !controller.page.isClosed() ? sanitizeCapturedUrl(controller.page.url()) : null;
    const eventId = input.eventId || uuid();
    const scopedEvidence = scopeEvidenceForCapturePhase(
      state.phase === 'IN_FLOW' ? 'IN_FLOW' : 'PRE_BOUNDARY',
      type,
      metadata,
      input.protectedValues ?? [],
    );
    const event: QAEvidenceEvent = {
      schemaVersion: '2.0',
      eventId,
      runId: state.runId,
      sessionId: state.sessionId,
      traceId: state.traceId,
      applicationId: state.applicationId,
      environmentId: state.environmentId,
      localSequence: ++controller.sequence,
      timestamp: new Date().toISOString(),
      eventType: type,
      source: 'DESKTOP_BROWSER',
      scope: state.phase === 'IN_FLOW' ? 'IN_FLOW' : 'PRE_BOUNDARY',
      privacyClassification: 'INTERNAL',
      pageUrl,
      normalizedRoute: pageUrl ? normalizedRoute(pageUrl) : null,
      acceptedFlowStateKey: state.currentFlowStateKey,
      viewport: controller.page && !controller.page.isClosed() ? controller.page.viewportSize() : null,
      interactionGroupId: input.interactionGroupId ?? null,
      causedByEventId: input.causedByEventId ?? null,
      metadata: scopedEvidence.metadata,
      protectedValues: scopedEvidence.protectedValues,
    };
    state.evidenceCounts[type] = (state.evidenceCounts[type] ?? 0) + 1;
    this.notifyStateChanged();
    Promise.resolve(this.options.onEvidenceEvent?.(event)).catch((error) => {
      state.evidenceCounts.QA_CAPTURE_DEGRADED = (state.evidenceCounts.QA_CAPTURE_DEGRADED ?? 0) + 1;
      this.addLive(state, { kind: 'PAGE', level: 'ERROR', message: `Evidence upload deferred: ${safeMessage(String(error))}` });
    });
    return eventId;
  }

  private async handleBridge(controller: RunController, payload: BridgePayload): Promise<void> {
    const map: Record<string, QAEvidenceEvent['eventType']> = {
      route: 'QA_ROUTE_CHANGED', viewport: 'QA_VIEWPORT_CHANGED', click: 'QA_CONTROL_CLICKED',
      submit_intent: 'QA_FORM_SUBMIT_INTENT', submit: 'QA_FORM_SUBMITTED', field: 'QA_FIELD_CHANGED',
      storage: 'QA_STORAGE_MUTATION', performance: 'QA_PAGE_PERFORMANCE', runtime_error: 'QA_RUNTIME_ERROR',
    };
    const type = map[String(payload.type)];
    if (!type) return;
    if (payload.type === 'viewport') {
      const metadata = payload.metadata ?? {};
      const values = [
        metadata.innerWidth, metadata.innerHeight, metadata.outerWidth, metadata.outerHeight,
        metadata.screenWidth, metadata.screenHeight, metadata.devicePixelRatio,
      ];
      if (values.every((value) => Number.isFinite(Number(value)))) {
        controller.state.windowResolution = {
          innerWidth: Number(metadata.innerWidth), innerHeight: Number(metadata.innerHeight),
          outerWidth: Number(metadata.outerWidth), outerHeight: Number(metadata.outerHeight),
          screenWidth: Number(metadata.screenWidth), screenHeight: Number(metadata.screenHeight),
          devicePixelRatio: Number(metadata.devicePixelRatio),
          orientation: metadata.orientation == null ? null : String(metadata.orientation),
        };
      }
    }
    const protectedValues: QAPendingProtectedValue[] = [];
    if (payload.valueKind && payload.valuePath) {
      protectedValues.push({
        keyPath: payload.valuePath,
        kind: payload.valueKind,
        value: payload.valueKind === 'SECRET' || controller.state.mode === 'OBSERVATION_ONLY' ? undefined : payload.value,
        valueLength: payload.value?.length ?? Number(payload.metadata?.valueLength ?? 0),
      });
    }
    const safeMetadata = sanitizeBridgeMetadata(payload.type, payload.metadata);
    const eventId = this.emit(controller, type, safeMetadata, {
      eventId: payload.eventId,
      pageUrl: payload.type === 'route' && payload.metadata?.url
        ? sanitizeCapturedUrl(String(payload.metadata.url)) : undefined,
      protectedValues,
      interactionGroupId: payload.interactionGroupId ?? null,
      causedByEventId: payload.causedByEventId ?? null,
    });
    const liveEvidence = eventId ? liveEvidenceForBridgePayload({ ...payload, metadata: safeMetadata }) : null;
    if (liveEvidence) {
      this.addLive(controller.state, { ...liveEvidence, groupId: payload.interactionGroupId ?? null });
    }
    if (eventId && ['click', 'submit_intent', 'submit', 'route'].includes(String(payload.type))) {
      controller.recentCause = { eventId, interactionGroupId: payload.interactionGroupId ?? null, at: Date.now() };
    }
    // Opens a new snapshot window. Whether anything actually changed is decided
    // at capture time by comparing page structure, not assumed here.
    if (['click', 'submit', 'route'].includes(String(payload.type))) {
      controller.interactionEpoch += 1;
    }
    // A route that has finished settling is the point where the page is worth
    // a screenshot: the data has landed and the layout has stopped moving.
    if (payload.type === 'performance' && payload.metadata?.visuallyStableMs != null) {
      void this.captureStateArtifacts(controller).catch(() => undefined);
    }
  }

  private async handleUnexpectedTermination(): Promise<void> {
    const state = await this.stopAndPersist();
    await this.options.onUnexpectedTermination?.(state);
  }

  async start(input: StartGuidedRunInput, artifactRoot: string): Promise<GuidedRunState> {
    if (this.active) throw new Error('RUN_ALREADY_ACTIVE');
    const observationOnly = input.mode === 'OBSERVATION_ONLY' || input.environmentType === 'PRODUCTION';
    assertEnvironmentActionAllowed(input.environmentType, observationOnly ? 'OBSERVE' : 'INTERACT');
    if (input.environmentType === 'PRODUCTION' && (!observationOnly || !input.productionObservationApproved)) {
      throw new Error('PRODUCTION_OBSERVATION_APPROVAL_REQUIRED');
    }
    if (observationOnly && input.launchCommandId) throw new Error('OBSERVATION_ONLY_PROCESS_LAUNCH_BLOCKED');
    const runId = input.runId ?? uuid();
    const sessionId = input.sessionId ?? uuid();
    const traceId = input.traceId ?? uuid();
    const artifactDirectory = path.join(artifactRoot, runId);
    fs.mkdirSync(artifactDirectory, { recursive: true });
    const headless = this.options.headless ?? false;
    const captureTracks: Array<'FRONTEND' | 'BACKEND'> = input.captureTracks?.length
      ? Array.from(new Set(input.captureTracks))
      : ['FRONTEND'];
    // A run that captures only the backend has nothing to drive a browser
    // with: every event it will ever see arrives from the application's own
    // server through the relay. Launching Chromium anyway used to leave an
    // empty window over the target URL, and made the run page describe a
    // viewport and a route that had nothing to do with what was captured.
    const browserTrack = captureTracks.includes('FRONTEND');
    const applicationOrigin = new URL(input.targetUrl).origin;
    const state: GuidedRunState = {
      runId, sessionId, traceId, applicationId: input.applicationId, environmentId: input.environmentId,
      environmentType: input.environmentType,
      expectedGraphVersionId: input.expectedGraphVersionId ?? null,
      mode: observationOnly ? 'OBSERVATION_ONLY' : input.mode === 'ASSISTED' ? 'ASSISTED' : 'GUIDED',
      // Session-scoped runs have no declared initial boundary to wait for.
      // Capture is active as soon as the user explicitly starts the run.
      status: 'RUNNING', phase: initialCapturePhase(input.mode, input.expectedGraphVersionId), interactionMode: 'NAVIGATE',
      captureTracks,
      browserStatus: browserTrack ? 'ACTIVE' : 'NONE',
      backend: captureTracks.includes('BACKEND') ? emptyBackendSummary() : null,
      currentFlowStateKey: null,
      evidenceCounts: {}, targetUrl: input.targetUrl, evidence: [], observations: [], observedTransitions: [],
      windowResolution: null,
      evidenceTrimmed: 0,
      liveCounts: Object.fromEntries(LIVE_EVIDENCE_KINDS.map((kind) => [kind, 0])) as Record<LiveEvidenceKind, number>,
      lastEvidenceAt: null,
      flowPlan: null, coverage: null, flowStateHistory: [], boundaryRejection: null,
      annotationCount: 0, stateArtifacts: [], syncBacklog: 0,
      findings: [], artifactDirectory, startedAt: new Date().toISOString(), endedAt: null,
    };
    const controller: RunController = {
      state, browser: null, context: null, page: null, attachPage: null, refreshObservation: null,
      observationTimer: null, stopping: false, paused: false,
      sequence: 0, applicationOrigin, requests: new Map(), blockedByPolicy: new WeakSet(), recentCause: null,
      capturedStateKeys: new Set(), snapshotInFlight: false,
      interactionEpoch: 0, lastCaptureSignature: null,
      findingArtifacts: [], capturedFindingKeys: new Set(),
      backendDurations: new Map(), backendAllDurations: [], backendSeenRequests: new Set(),
      backendSlowRows: new Map(),
    };
    this.active = controller;
    if (!browserTrack) {
      this.addLive(state, {
        kind: 'SERVER', level: 'INFO',
        message: `Backend capture started for ${sanitizeCapturedUrl(input.targetUrl)}. Requests reported by your application appear here as they are handled.`,
      });
      return this.snapshot();
    }
    let browser: Browser;
    let context: BrowserContext;
    try {
      browser = await chromium.launch({
        headless,
        ...(this.options.executablePath ? { executablePath: this.options.executablePath } : {}),
      });
      context = await browser.newContext({
        viewport: browserContextViewport(headless),
        locale: 'en-US',
        colorScheme: 'light',
        recordVideo: undefined,
      });
    } catch (error) {
      // Nothing was captured and nothing was opened, so leave no active run
      // behind for the caller's failure path to trip over.
      this.active = null;
      throw error;
    }
    controller.browser = browser;
    controller.context = context;
    if (observationOnly) await context.addInitScript(installReadOnlyInteractionGuard);
    if (input.environmentType === 'PRODUCTION') await context.addInitScript(installReadOnlySocketGuard);
    if (input.environmentType === 'PRODUCTION') {
      await context.routeWebSocket('**/*', (socket) => socket.close());
    }
    const correlationHeaders = {
      'x-tellann-run-id': runId,
      'x-tellann-session-id': sessionId,
      'x-tellann-trace-id': traceId,
      'x-tellann-environment-id': input.environmentId,
    };
    // Interception is scoped as tightly as the policy allows. Routing every
    // request through the driver bypasses the HTTP cache and adds latency to
    // each one, which would skew the very performance metrics this run
    // collects. Only same-origin traffic needs correlation headers, and only
    // observation-only runs need to block mutating requests — so cross-origin
    // static traffic is left entirely untouched in guided runs.
    const interceptPattern = observationOnly ? '**/*' : `${applicationOrigin}/**`;
    await context.route(interceptPattern, async (route) => {
      const requestUrl = route.request().url();
      let sameOrigin = false;
      try { sameOrigin = new URL(requestUrl).origin === applicationOrigin; } catch { /* no-op */ }
      if (observationOnly && !isObservationOnlyRequestAllowed(route.request().method())) {
        // Remember that *we* blocked this, so the resulting `requestfailed`
        // does not become a fabricated NETWORK_REQUEST_FAILED finding. In an
        // observation-only run every mutating request is blocked by policy,
        // which would otherwise fill the report with critical noise.
        controller.blockedByPolicy.add(route.request());
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue(sameOrigin
        ? { headers: { ...route.request().headers(), ...correlationHeaders } }
        : undefined);
    });
    if (!observationOnly && input.relayEndpoint && input.relayToken) {
      await context.addInitScript(({ allowedOrigin, run }) => {
        if (globalThis.location?.origin !== allowedOrigin) return;
        Object.defineProperty(globalThis, '__TELLANN_RUN__', {
          value: Object.freeze(run), configurable: false, enumerable: false, writable: false,
        });
      }, {
        allowedOrigin: applicationOrigin,
        run: {
          relayEndpoint: input.relayEndpoint, relayToken: input.relayToken,
          applicationId: input.applicationId, environmentId: input.environmentId,
          runId, sessionId, traceId, agentVersion: input.agentVersion ?? 'desktop-dev',
        },
      });
    }
    const nonce = crypto.randomBytes(8).toString('hex');
    const bridgeName = `__tellann_capture_${nonce}`;
    const memberName = `__tellann_members_${nonce}`;
    const annotationName = `__tellann_annotation_${nonce}`;
    await context.exposeBinding(bridgeName, (_source, payload: BridgePayload) => this.handleBridge(controller, payload));
    await context.exposeBinding(memberName, (_source, query: string) =>
      this.options.searchMentionableMembers?.(runId, String(query).slice(0, 100)) ?? []);
    await context.exposeBinding(annotationName, async (_source, annotation: CreateQARunAnnotation) => {
      if (!controller.page || controller.page.isClosed()) throw new Error('QA_BROWSER_CLOSED');
      if (state.environmentType === 'PRODUCTION') throw new Error('PRODUCTION_VISUAL_ARTIFACT_BLOCKED');
      const screenshotPath = path.join(artifactDirectory, `inspect-${Date.now()}.png`);
      await controller.page.evaluate(() => (globalThis as any).__tellannQaScreenshotMode?.(true)).catch(() => undefined);
      const mask = controller.page.locator('input, textarea, select, [contenteditable="true"], [data-tellann-sensitive]');
      await controller.page.screenshot({ path: screenshotPath, fullPage: true, mask: [mask], maskColor: '#111827' }).catch(() => undefined);
      await controller.page.evaluate(() => (globalThis as any).__tellannQaScreenshotMode?.(false)).catch(() => undefined);
      try {
        const saved = await this.options.onAnnotation?.(runId, {
          ...annotation,
          screenshotPath: fs.existsSync(screenshotPath) ? screenshotPath : null,
        }, state.applicationId);
        state.annotationCount += 1;
        this.addLive(state, {
          kind: 'INTERACTION',
          level: 'INFO',
          message: `Inspect comment on ${safeMessage(annotation.elementFingerprint?.accessibleName || annotation.elementFingerprint?.tag || 'an element')}`,
          details: compactDetails([
            detail('Comment', annotation.comment),
            detail('Route', annotation.normalizedRoute),
            detail('Flow state', annotation.flowStateKey),
            detail('Screenshot', fs.existsSync(screenshotPath) ? path.basename(screenshotPath) : 'Not captured'),
          ]),
        });
        // Saving completes the one-shot Inspect interaction. Switch the whole
        // run back to Navigate after the page binding returns so the modal
        // cannot immediately reopen while the desktop still says Inspect.
        setTimeout(() => void this.setInteractionMode('NAVIGATE').catch(() => undefined), 0);
        return saved;
      } catch (error) {
        this.addLive(state, {
          kind: 'INTERACTION',
          level: 'ERROR',
          message: `Inspect comment could not be saved: ${safeMessage(error instanceof Error ? error.message : String(error))}`,
        });
        throw error;
      }
    });
    await context.addInitScript(installQaRecorder, {
      bridge: bridgeName, members: memberName, annotations: annotationName,
      origin: applicationOrigin, production: observationOnly,
    });
    // Protected values can be captured during IN_FLOW, so DOM/screenshot trace
    // snapshots intentionally remain disabled for this V2 observer.
    const page = await context.newPage();
    controller.page = page;

    const captureWindowResolution = async (target: Page) => {
      if (target.isClosed()) return;
      const metadata = await target.evaluate(() => ({
        innerWidth, innerHeight, outerWidth, outerHeight,
        screenWidth: screen.width, screenHeight: screen.height,
        devicePixelRatio, orientation: screen.orientation?.type ?? null,
      })).catch(() => null);
      if (!metadata) return;
      const previous = controller.state.windowResolution;
      const unchanged = previous
        && previous.innerWidth === metadata.innerWidth
        && previous.innerHeight === metadata.innerHeight
        && previous.outerWidth === metadata.outerWidth
        && previous.outerHeight === metadata.outerHeight
        && previous.screenWidth === metadata.screenWidth
        && previous.screenHeight === metadata.screenHeight
        && previous.devicePixelRatio === metadata.devicePixelRatio
        && previous.orientation === metadata.orientation;
      if (!unchanged) await this.handleBridge(controller, { type: 'viewport', metadata });
    };

    const captureObservation = async () => {
      // Reads whichever page is current rather than the one this run opened
      // with, so observation survives a popup or a reopened window.
      const target = controller.page;
      if (!target || target.isClosed()) return;
      const url = target.url();
      if (!/^https?:\/\//.test(url)) return;
      const title = await target.title().catch(() => '');
      const derived = deriveBrowserState(url, title);
      const previous = state.observations[state.observations.length - 1];
      const safeUrl = sanitizeCapturedUrl(url);
      if (previous?.stateName === derived.stateName && previous.url === safeUrl) return;
      const observation: BrowserObservation = {
        eventId: uuid(), ...derived, url: safeUrl, title: '', timestamp: new Date().toISOString(),
      };
      state.observations.push(observation);
      void this.options.onObservation?.(runId, observation);
      if (previous) {
        state.observedTransitions.push({
          fromEventId: previous.eventId, toEventId: observation.eventId,
          fromState: previous.stateName, toState: observation.stateName,
          action: previous.url === observation.url ? 'UI_CHANGE' : 'NAVIGATE', timestamp: observation.timestamp,
        });
      }
      this.addLive(state, { kind: 'PAGE', level: 'INFO', message: `Observed route candidate ${observation.stateName}` });
    };

    context.on('console', (message) => {
      const level = message.type() === 'error' ? 'ERROR' : message.type() === 'warning' ? 'WARN' : 'INFO';
      const text = safeMessage(message.text());
      // Context-level, so `message.page()` identifies which page (or popup)
      // produced it rather than assuming the run's initial page.
      const origin = message.page();
      const originUrl = origin && !origin.isClosed() ? origin.url() : null;
      this.addLive(state, { kind: 'CONSOLE', level, message: text });
      if (state.phase === 'IN_FLOW' || level === 'ERROR') {
        const location = message.location();
        this.emit(controller, 'QA_CONSOLE', {
          level: message.type(), message: text,
          location: {
            url: sanitizeCapturedUrl(location.url || originUrl || ''),
            line: location.lineNumber,
            column: location.columnNumber,
          },
        }, { pageUrl: originUrl ? sanitizeCapturedUrl(originUrl) : undefined });
      }
      if (level === 'ERROR') {
        const finding: BrowserFinding = {
          id: uuid(), runId, category: 'BROWSER_CONSOLE_ERROR', severity: 'MEDIUM', confidence: 0.95,
          title: 'Browser console error', description: text, url: originUrl,
          viewport: origin && !origin.isClosed() ? origin.viewportSize() : null,
          evidenceArtifactIds: [], evidenceChecksums: [],
          reproductionSteps: ['Open the captured route', 'Repeat the linked interaction'],
          recommendation: 'Resolve the client runtime error and rerun the affected Flow state.',
          scope: state.phase === 'IN_FLOW' ? 'IN_FLOW' : 'PRE_BOUNDARY',
          dedupeKey: `console:${crypto.createHash('sha1').update(text).digest('hex')}`, generatorSource: 'BROWSER',
        };
        state.findings.push(finding);
        void this.captureFindingEvidence(controller, finding).catch(() => undefined);
      }
    });
    context.on('request', (request) => {
      const sameOrigin = (() => { try { return new URL(request.url()).origin === applicationOrigin; } catch { return false; } })();
      const headers = Object.fromEntries(Object.entries(request.headers())
        .filter(([key]) => SAFE_REQUEST_HEADERS.has(key.toLowerCase()))
        .map(([key, value]) => [key, safeMessage(value)]));
      let metadataBody: unknown;
      let protectedValues: QAPendingProtectedValue[] = [];
      if (sameOrigin && state.phase === 'IN_FLOW' && !observationOnly) {
        const captured = protectStructuredPayload(parseBody(request.postData(), request.headers()['content-type']), 'requestBody');
        metadataBody = captured.metadata;
        protectedValues = captured.protectedValues;
      }
      const recent = controller.recentCause && Date.now() - controller.recentCause.at < 10_000
        ? controller.recentCause : null;
      controller.requests.set(request, {
        startedAt: Date.now(), method: request.method(), url: sanitizeCapturedUrl(request.url()),
        resourceType: request.resourceType(), redirectedFrom: request.redirectedFrom() ? sanitizeCapturedUrl(request.redirectedFrom()!.url()) : null,
        safeHeaders: headers, metadataBody, protectedValues,
        interactionGroupId: recent?.interactionGroupId ?? null, causedByEventId: recent?.eventId ?? null,
      });
    });
    const finishRequest = async (request: Request, failed: boolean) => {
      const record = controller.requests.get(request);
      if (!record) return;
      controller.requests.delete(request);
      const response = await request.response().catch(() => null);
      const contentType = response?.headers()['content-type'] ?? '';
      let responseBody: unknown;
      if (!failed && response && state.phase === 'IN_FLOW' && !observationOnly
        && new URL(record.url).origin === applicationOrigin && /json|x-www-form-urlencoded/i.test(contentType)) {
        const body = await response.body().catch(() => null);
        if (body && body.length <= 16 * 1024) {
          const captured = protectStructuredPayload(parseBody(body.toString('utf8'), contentType), 'responseBody');
          responseBody = captured.metadata;
          record.protectedValues.push(...captured.protectedValues);
        }
      }
      const status = response?.status() ?? null;
      const blockedByPolicy = controller.blockedByPolicy.has(request);
      // Service-worker and other frameless requests have no owning page.
      const originPage = (() => {
        try {
          const owner = request.frame().page();
          return owner.isClosed() ? null : owner;
        } catch { return null; }
      })();
      const durationMs = Date.now() - record.startedAt;
      const transferredBytes = await request.sizes()
        .then((sizes) => sizes.responseBodySize + sizes.responseHeadersSize)
        .catch(() => Number(response?.headers()['content-length'] ?? 0) || null);
      this.emit(controller, 'QA_REQUEST', {
        method: record.method, url: record.url, resourceType: record.resourceType,
        redirectedFrom: record.redirectedFrom, status, failed, blockedByPolicy,
        failure: failed ? safeMessage(request.failure()?.errorText ?? 'Request failed') : null,
        durationMs, timing: request.timing(),
        responseContentType: contentType.slice(0, 200),
        // Prefer the driver's real transfer size (which accounts for
        // compression and headers) and fall back to Content-Length only when
        // sizes are unavailable, e.g. for a failed request.
        transferredBytes,
        headers: record.safeHeaders,
        ...(record.metadataBody === undefined ? {} : { requestBody: record.metadataBody }),
        ...(responseBody === undefined ? {} : { responseBody }),
      }, {
        pageUrl: record.url, protectedValues: record.protectedValues,
        interactionGroupId: record.interactionGroupId, causedByEventId: record.causedByEventId,
      });
      this.addLive(state, { ...liveEvidenceForNetworkRequest({
        method: record.method,
        url: record.url,
        status,
        failed,
        blockedByPolicy,
        durationMs,
        resourceType: record.resourceType,
        transferredBytes,
        failure: failed ? safeMessage(request.failure()?.errorText ?? 'Request failed') : null,
      }), groupId: record.interactionGroupId });
      // A request this observer aborted under observation-only policy is an
      // expected outcome of the capture track, never an application defect.
      if (!blockedByPolicy && (failed || (status !== null && status >= 400))) {
        const severity = failed || (status ?? 0) >= 500 ? 'HIGH' : 'MEDIUM';
        const description = `${record.method} ${record.url} — ${failed ? request.failure()?.errorText ?? 'failed' : status}`;
        const finding: BrowserFinding = {
          id: uuid(), runId, category: failed ? 'NETWORK_REQUEST_FAILED' : 'HTTP_ERROR_RESPONSE', severity,
          confidence: 0.98, title: failed ? 'Network request failed' : `Request returned ${status}`,
          description, url: originPage?.url() || null, viewport: originPage?.viewportSize() ?? null,
          evidenceArtifactIds: [], evidenceChecksums: [],
          reproductionSteps: ['Open the captured route', 'Repeat the linked interaction'],
          recommendation: 'Check service availability, request construction, authorization, and server handling.',
          scope: state.phase === 'IN_FLOW' ? 'IN_FLOW' : 'PRE_BOUNDARY',
          dedupeKey: `request:${record.method}:${normalizedRoute(record.url)}:${status ?? 'failed'}`,
          generatorSource: 'BROWSER',
        };
        state.findings.push(finding);
        void this.captureFindingEvidence(controller, finding).catch(() => undefined);
      }
    };
    context.on('requestfinished', (request) => void finishRequest(request, false));
    context.on('requestfailed', (request) => void finishRequest(request, true));
    context.on('weberror', (error) => {
      const origin = error.page();
      this.emit(controller, 'QA_RUNTIME_ERROR', {
        message: safeMessage(error.error().message), kind: 'uncaught',
        source: origin && !origin.isClosed() ? sanitizeCapturedUrl(origin.url()) : null,
      });
    });
    // Websockets, frame navigation and crashes are per-page in Playwright, so
    // every page in the context — the initial one and any popup — gets its own
    // listeners rather than only the first page.
    const attachPageListeners = (target: Page) => {
      target.on('websocket', (socket) => {
      const socketUrl = sanitizeCapturedUrl(socket.url());
      this.emit(controller, 'QA_WEBSOCKET', { lifecycle: 'OPEN', url: socketUrl }, { pageUrl: socketUrl });
      socket.on('framesent', (event) => {
        const size = typeof event.payload === 'string' ? Buffer.byteLength(event.payload) : event.payload.length;
        const sameOrigin = (() => {
          try { return new URL(socket.url()).host === new URL(applicationOrigin).host; } catch { return false; }
        })();
        const captured = sameOrigin && state.phase === 'IN_FLOW' && !observationOnly && typeof event.payload === 'string'
          ? protectStructuredPayload(parseBody(event.payload, 'application/json'), 'websocketFrame')
          : { metadata: null, protectedValues: [] };
        this.emit(controller, 'QA_WEBSOCKET', {
          lifecycle: 'FRAME_SENT', url: socketUrl, bytes: size, body: captured.metadata,
        }, { pageUrl: socketUrl, protectedValues: captured.protectedValues });
      });
      socket.on('socketerror', (error) => this.emit(controller, 'QA_WEBSOCKET', {
        lifecycle: 'ERROR', url: socketUrl, error: safeMessage(error),
      }, { pageUrl: socketUrl }));
      socket.on('close', () => this.emit(controller, 'QA_WEBSOCKET', { lifecycle: 'CLOSE', url: socketUrl }, { pageUrl: socketUrl }));
      });
      target.on('framenavigated', (frame) => {
        const routeUrl = sanitizeCapturedUrl(frame.url());
        this.emit(controller, 'QA_ROUTE_CHANGED', {
          kind: frame === target.mainFrame() ? 'document' : 'frame', url: routeUrl,
        }, { pageUrl: frame.url() });
        if (/^https?:\/\//.test(routeUrl)) {
          this.addLive(state, {
            kind: 'PAGE', level: 'INFO',
            message: `${frame === target.mainFrame() ? 'Page' : 'Frame'} navigated to ${normalizedRoute(routeUrl) ?? routeUrl}`,
            details: [{ label: 'URL', value: routeUrl }],
          });
        }
        if (frame === target.mainFrame() && target === controller.page) void captureObservation();
        // A frame that attaches or navigates after the boundary was accepted
        // starts at the recorder's PRE_BOUNDARY/NAVIGATE defaults, so replay
        // the current capture state into it.
        void this.syncFrameState(controller, frame);
      });
      target.on('domcontentloaded', () => void captureWindowResolution(target));
      // Closing the managed window is a normal thing to do by accident, and it
      // does not end the run: the browser process is still up, the context
      // still holds the recorder's init scripts and bindings, and the backend
      // track (if any) keeps reporting. The run page offers to put a page back.
      target.on('close', () => {
        if (!this.active || controller.stopping) return;
        if (target !== controller.page) return;
        const survivor = context.pages().find((open) => open !== target && !open.isClosed()) ?? null;
        controller.page = survivor;
        if (survivor) return;
        state.browserStatus = 'CLOSED';
        this.addLive(state, {
          kind: 'PAGE', level: 'WARN',
          message: 'The managed browser window was closed. Capture is still running — reopen it to carry on in the same session.',
        });
        this.notifyStateChanged();
      });
      target.on('crash', () => {
        if (!this.active || controller.stopping) return;
        this.emit(controller, 'QA_PAGE_CRASH', { reason: 'Managed browser page crashed' });
        state.status = 'FAILED';
        state.endedAt = new Date().toISOString();
        this.addLive(state, { kind: 'PAGE', level: 'ERROR', message: 'Managed browser page crashed' });
        void this.handleUnexpectedTermination();
      });
    };
    controller.attachPage = attachPageListeners;
    controller.refreshObservation = captureObservation;
    attachPageListeners(page);
    context.on('page', (opened) => {
      if (opened === page) return;
      attachPageListeners(opened);
      this.emit(controller, 'QA_ROUTE_CHANGED', {
        kind: 'popup', url: sanitizeCapturedUrl(opened.url()),
      }, { pageUrl: opened.url() });
      void this.syncFrameState(controller, opened.mainFrame());
    });
    controller.observationTimer = setInterval(() => void captureObservation(), 1_500);
    browser.on('disconnected', () => {
      if (!this.active || controller.stopping) return;
      state.status = 'FAILED';
      state.endedAt = new Date().toISOString();
      this.addLive(state, { kind: 'PAGE', level: 'ERROR', message: 'Managed browser disconnected unexpectedly' });
      void this.handleUnexpectedTermination();
    });
    try {
      await navigateToRunTarget(page, input.targetUrl, input.launchCommandId ? 30_000 : 0);
      // The injected recorder normally reports this itself. This fallback also
      // covers apps whose own startup/runtime error prevents the recorder from
      // reaching its initial viewport emission.
      await captureWindowResolution(page);
      await captureObservation();
      this.addLive(state, {
        kind: 'PAGE', level: 'INFO',
        message: `QA capture started at ${sanitizeCapturedUrl(input.targetUrl)}. Waiting for the emitted initial Flow event.`,
      });
      return this.snapshot();
    } catch (error) {
      state.status = 'FAILED';
      state.endedAt = new Date().toISOString();
      this.addLive(state, { kind: 'PAGE', level: 'ERROR', message: safeMessage(error instanceof Error ? error.message : 'Navigation failed') });
      await this.stopAndPersist();
      throw error;
    }
  }

  async recordFlowEvent(event: Record<string, unknown>): Promise<void> {
    if (!this.active) return;
    const metadata = event.metadata && typeof event.metadata === 'object'
      ? event.metadata as Record<string, unknown> : {};
    const eventId = typeof event.eventId === 'string' ? event.eventId : uuid();
    const emitted = this.emit(this.active, 'QA_FLOW_EVENT', {
      eventType: String(event.eventType ?? ''), stateKey: String(metadata.stateKey ?? ''),
      fromStateKey: metadata.fromStateKey ? String(metadata.fromStateKey) : null,
      action: metadata.action ? String(metadata.action) : null,
      flowVersionId: String(metadata.flowVersionId ?? ''),
    }, { eventId });
    if (emitted) {
      this.addLive(this.active.state, {
        kind: 'FLOW', level: 'INFO',
        message: `${String(event.eventType ?? 'FLOW_EVENT')} · ${String(metadata.stateKey ?? metadata.toStateKey ?? 'unknown state')}`,
      });
    }
    if (String(event.eventType) === 'FLOW_TRANSITION') {
      this.active.recentCause = {
        eventId, interactionGroupId: this.active.recentCause?.interactionGroupId ?? null, at: Date.now(),
      };
    }
  }

  /**
   * `page.evaluate` only ever reaches the main frame. The recorder is installed
   * in every same-origin document via `addInitScript`, so control messages must
   * be broadcast frame by frame — otherwise child frames stay PRE_BOUNDARY for
   * the whole run and never enter Inspect mode.
   */
  /** Replays the run's current phase and interaction mode into one frame. */
  private async syncFrameState(controller: RunController, frame: Frame): Promise<void> {
    const { state } = controller;
    if (state.phase === 'IN_FLOW') {
      await frame.evaluate(
        ({ phase, stateKey }: { phase: string; stateKey: string | null }) =>
          (globalThis as any).__tellannQaSetPhase?.(phase, stateKey),
        { phase: 'IN_FLOW', stateKey: state.currentFlowStateKey },
      ).catch(() => undefined);
    }
    if (state.interactionMode !== 'NAVIGATE') {
      await frame.evaluate(
        (next: QAInteractionMode) => (globalThis as any).__tellannQaSetMode?.(next),
        state.interactionMode,
      ).catch(() => undefined);
    }
  }

  private async broadcastToFrames(
    fn: (argument: any) => boolean | void,
    argument: unknown,
  ): Promise<number> {
    if (!this.active?.context) return 0;
    const frames = this.active.context.pages()
      .filter((page) => !page.isClosed())
      .flatMap((page) => page.frames());
    const results = await Promise.all(
      frames.map((frame) => frame.evaluate(fn, argument).catch(() => undefined)),
    );
    // Frames without the recorder (cross-origin, or navigated away from the
    // application origin) return undefined. The count of real acknowledgements
    // is what tells us whether the command actually landed anywhere.
    return results.filter((result) => result === true).length;
  }

  /**
   * Records a framework-state mutation reported by the frontend SDK's
   * instrumentation adapters (Redux middleware, approved Context providers and
   * `useState` setters, or an explicit `trackClientState` call).
   *
   * Candidate values proposed by the page are re-classified here before they
   * leave the desktop, and the ingestion API applies the authoritative floor
   * again; anything classified SECRET loses its value entirely.
   */
  async recordClientStateEvent(event: Record<string, unknown>): Promise<void> {
    if (!this.active) return;
    const controller = this.active;
    const metadata = event.metadata && typeof event.metadata === 'object'
      ? event.metadata as Record<string, unknown> : {};
    const candidates = Array.isArray(metadata.qaProtectedCandidates)
      ? metadata.qaProtectedCandidates as Array<{ keyPath?: unknown; value?: unknown }>
      : [];
    const observationOnly = controller.state.mode === 'OBSERVATION_ONLY';
    const protectedValues: QAPendingProtectedValue[] = candidates.slice(0, 20).flatMap((candidate) => {
      const keyPath = String(candidate.keyPath ?? 'clientState.value').slice(0, 300);
      const raw = typeof candidate.value === 'string' ? candidate.value : undefined;
      if (raw === undefined) return [];
      const kind: QAPendingProtectedValue['kind'] = isSecretKeyPath(keyPath)
        ? 'SECRET'
        : isIdentifierKeyPath(keyPath) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
          ? 'DIRECT_IDENTIFIER'
          : 'ORDINARY';
      return [{
        keyPath,
        kind,
        value: kind === 'SECRET' || observationOnly ? undefined : raw.slice(0, 16_384),
        valueLength: raw.length,
      }];
    });
    const { qaProtectedCandidates: _candidates, ...safeMetadata } = metadata;
    const emitted = this.emit(controller, 'QA_CLIENT_STATE_MUTATION', {
      store: String(safeMetadata.store ?? 'unknown').slice(0, 100),
      key: String(safeMetadata.key ?? '').slice(0, 200),
      actionType: safeMetadata.actionType ? String(safeMetadata.actionType).slice(0, 200) : null,
      changedSlicePaths: Array.isArray(safeMetadata.changedSlicePaths)
        ? (safeMetadata.changedSlicePaths as unknown[]).slice(0, 50).map((path) => String(path).slice(0, 200))
        : [],
      previous: safeMetadata.previous ?? null,
      next: safeMetadata.next ?? null,
    }, {
      eventId: typeof event.eventId === 'string' ? event.eventId : undefined,
      protectedValues,
      interactionGroupId: controller.recentCause?.interactionGroupId ?? null,
      causedByEventId: controller.recentCause?.eventId ?? null,
    });
    if (emitted) {
      const store = String(safeMetadata.store ?? 'application state').slice(0, 100);
      const key = String(safeMetadata.key ?? '').slice(0, 200);
      this.addLive(controller.state, {
        kind: 'STORAGE', level: 'INFO', message: `${store} state changed${key ? `: ${key}` : ''}`,
        details: compactDetails([
          detail('Action', safeMetadata.actionType),
          detail('Changed paths', Array.isArray(safeMetadata.changedSlicePaths)
            ? (safeMetadata.changedSlicePaths as unknown[]).slice(0, 10).join(', ') : null),
          detail('Protection', protectedValues.length ? 'Protected values recorded' : 'Shape metadata only'),
        ]),
      });
    }
  }

  /**
   * Records one request the application's own server handled.
   *
   * This is the backend counterpart of the browser's `QA_REQUEST`: it arrives
   * from the backend SDK through the local relay rather than from the driver,
   * so it carries the route template the framework matched, the handler that
   * ran, the models the request touched and the server-side duration - none of
   * which the browser can see, and all of which are the point of a backend run.
   *
   * Bodies, query strings and headers go through the same protection the
   * browser track uses: every leaf is classified, secrets are dropped before
   * they leave this process, identifiers are pseudonymized and ordinary values
   * are encrypted at rest by the ingestion pipeline.
   */
  async recordBackendRequestEvent(event: Record<string, unknown>): Promise<void> {
    if (!this.active) return;
    const controller = this.active;
    const { state } = controller;
    const metadata = event.metadata && typeof event.metadata === 'object'
      ? event.metadata as Record<string, unknown> : {};
    // The SDK retries a failed delivery, and the relay replays its own spool,
    // so the same request can legitimately arrive twice. Counting it twice
    // would quietly corrupt every number on the page.
    const requestKey = String(metadata.requestId ?? event.eventId ?? uuid());
    if (controller.backendSeenRequests.has(requestKey)) return;
    controller.backendSeenRequests.add(requestKey);
    const method = String(metadata.method ?? 'GET').toUpperCase().slice(0, 12);
    const route = backendRouteTemplate(metadata.route, metadata.endpoint ?? metadata.path);
    const status = Number.isFinite(Number(metadata.statusCode)) ? Number(metadata.statusCode) : null;
    const durationMs = Number.isFinite(Number(metadata.durationMs)) ? Number(metadata.durationMs) : null;
    const observationOnly = state.mode === 'OBSERVATION_ONLY';
    const inFlow = state.phase === 'IN_FLOW' && !observationOnly;
    const protectedValues: QAPendingProtectedValue[] = [];
    const protect = (value: unknown, root: string): unknown => {
      if (value === undefined || value === null) return undefined;
      const captured = protectStructuredPayload(value, root);
      protectedValues.push(...captured.protectedValues);
      return captured.metadata;
    };
    // Payloads are only retained once the run is inside the declared Flow, the
    // same rule the browser track follows. Before that, shape and size only.
    const query = protect(metadata.query, 'query');
    const requestBody = inFlow ? protect(metadata.requestBody, 'requestBody') : undefined;
    const responseBody = inFlow ? protect(metadata.responseBody, 'responseBody') : undefined;
    const models = Array.isArray(metadata.models)
      ? (metadata.models as unknown[]).slice(0, 50).map((entry) => {
          const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
          return {
            model: String(record.model ?? entry ?? '').slice(0, 120),
            operation: record.operation ? String(record.operation).slice(0, 60) : null,
            records: Number.isFinite(Number(record.records)) ? Number(record.records) : null,
          };
        }).filter((entry) => entry.model)
      : [];
    const requestBytes = Number.isFinite(Number(metadata.requestBytes)) ? Number(metadata.requestBytes) : null;
    const responseBytes = Number.isFinite(Number(metadata.responseBytes)) ? Number(metadata.responseBytes) : null;
    const handler = metadata.handler ? String(metadata.handler).slice(0, 200) : null;
    const emitted = this.emit(controller, 'QA_BACKEND_REQUEST', {
      method, route,
      path: metadata.endpoint ? sanitizeCapturedUrl(String(metadata.endpoint)) : null,
      statusCode: status, durationMs, handler,
      framework: metadata.framework ? String(metadata.framework).slice(0, 60) : null,
      requestBytes, responseBytes,
      requestHeaders: metadata.requestHeaders ?? null,
      responseHeaders: metadata.responseHeaders ?? null,
      models,
      ...(query === undefined ? {} : { query }),
      ...(requestBody === undefined ? {} : { requestBody }),
      ...(responseBody === undefined ? {} : { responseBody }),
    }, {
      eventId: typeof event.eventId === 'string' ? event.eventId : undefined,
      // A backend request has no page, and inventing one would put a browser
      // route on evidence the browser never saw.
      pageUrl: null,
      protectedValues,
    });
    if (!emitted) return;
    const endpointKey = `${method} ${route}`;
    // Read before this request joins the window, so it is never compared
    // against itself.
    const baseline = [...(controller.backendDurations.get(endpointKey) ?? [])];
    this.applyBackendRequestToSummary(controller, {
      method, route, status, durationMs, requestBytes, responseBytes,
      models: models.map((entry) => entry.model),
      timestamp: typeof event.timestamp === 'string' ? event.timestamp : new Date().toISOString(),
    });
    this.addLive(state, liveEvidenceForBackendRequest({
      method, route, status, durationMs, handler,
      models: models.map((entry) => entry.model),
      requestBytes, responseBytes,
    }));
    if (durationMs !== null) {
      this.reportBackendLatency(controller, {
        endpointKey, method, route, durationMs, status, handler,
        models: models.map((entry) => entry.model),
        baseline,
      });
    }
    if (status !== null && status >= 400) {
      const severity = status >= 500 ? 'HIGH' : 'MEDIUM';
      const dedupeKey = `backend:${method}:${route}:${status}`;
      const finding: BrowserFinding = {
        id: uuid(), runId: state.runId,
        category: status >= 500 ? 'BACKEND_SERVER_ERROR' : 'BACKEND_CLIENT_ERROR',
        severity, confidence: 0.98,
        title: `${method} ${route} returned ${status}`,
        description: `The application's own server answered ${method} ${route} with ${status}${durationMs == null ? '' : ` after ${durationMs} ms`}.`,
        url: null, viewport: null, evidenceArtifactIds: [], evidenceChecksums: [],
        reproductionSteps: [`Call ${method} ${route}`, 'Compare the captured request payload with what the handler expects'],
        recommendation: status >= 500
          ? 'Check the handler, its dependencies and the error it raised. The captured payload and the models it touched are attached to this run.'
          : 'Check request validation, authorization and the contract this route publishes.',
        scope: state.phase === 'IN_FLOW' ? 'IN_FLOW' : 'PRE_BOUNDARY',
        dedupeKey, generatorSource: 'BROWSER',
      };
      if (!state.findings.some((existing) => existing.dedupeKey === dedupeKey)) state.findings.push(finding);
    }
  }

  /** Records an unhandled error the application's server reported. */
  async recordBackendErrorEvent(event: Record<string, unknown>): Promise<void> {
    if (!this.active) return;
    const controller = this.active;
    const { state } = controller;
    const metadata = event.metadata && typeof event.metadata === 'object'
      ? event.metadata as Record<string, unknown> : {};
    const message = safeMessage(String(metadata.message ?? metadata.error ?? 'Server error'));
    // An older SDK reported the route inside its free-form `context` bag
    // rather than beside the error, so both shapes are read.
    const context = metadata.context && typeof metadata.context === 'object'
      ? metadata.context as Record<string, unknown> : {};
    const routeSource = metadata.route ?? context.route;
    const pathSource = metadata.path ?? context.path;
    const route = routeSource || pathSource
      ? backendRouteTemplate(routeSource, pathSource)
      : null;
    const emitted = this.emit(controller, 'QA_BACKEND_ERROR', {
      message,
      name: metadata.name ? String(metadata.name).slice(0, 200) : null,
      // A stack names files and lines, never values, and it is the one thing
      // that makes a server error actionable from the run page.
      stack: metadata.stack ? safeMessage(String(metadata.stack)).slice(0, 4_000) : null,
      route,
      method: (metadata.method ?? context.method)
        ? String(metadata.method ?? context.method).toUpperCase().slice(0, 12) : null,
      statusCode: Number.isFinite(Number(metadata.statusCode)) ? Number(metadata.statusCode) : null,
      severity: metadata.severity ? String(metadata.severity).slice(0, 40) : 'error',
    }, { eventId: typeof event.eventId === 'string' ? event.eventId : undefined, pageUrl: null });
    if (!emitted) return;
    if (state.backend) state.backend.unhandledErrors += 1;
    this.addLive(state, {
      kind: 'SERVER', level: 'ERROR',
      message: route ? `${route} - ${message}` : message,
      details: compactDetails([
        detail('Type', metadata.name),
        detail('Route', route),
        detail('Status', metadata.statusCode),
      ]),
    });
    const dedupeKey = `backend-error:${route ?? 'unrouted'}:${String(metadata.name ?? 'Error')}`;
    if (!state.findings.some((existing) => existing.dedupeKey === dedupeKey)) {
      state.findings.push({
        id: uuid(), runId: state.runId, category: 'BACKEND_UNHANDLED_ERROR', severity: 'HIGH',
        confidence: 0.95, title: `Unhandled server error${route ? ` on ${route}` : ''}`,
        description: message, url: null, viewport: null,
        evidenceArtifactIds: [], evidenceChecksums: [],
        reproductionSteps: route ? [`Call ${route}`] : ['Repeat the captured request sequence'],
        recommendation: 'Handle the error in the route, or fix the condition that raises it.',
        scope: state.phase === 'IN_FLOW' ? 'IN_FLOW' : 'PRE_BOUNDARY',
        dedupeKey, generatorSource: 'BROWSER',
      });
    }
  }

  /**
   * Records one persistence operation - which model, which operation, how many
   * records - so the run can answer what a request actually changed rather
   * than only what it answered with.
   */
  async recordBackendDataAccessEvent(event: Record<string, unknown>): Promise<void> {
    if (!this.active) return;
    const controller = this.active;
    const { state } = controller;
    const metadata = event.metadata && typeof event.metadata === 'object'
      ? event.metadata as Record<string, unknown> : {};
    const model = String(metadata.model ?? '').slice(0, 120);
    if (!model) return;
    const operation = String(metadata.operation ?? 'unknown').slice(0, 60);
    const records = Number.isFinite(Number(metadata.records)) ? Number(metadata.records) : null;
    const mutation = Boolean(metadata.mutation ?? /create|update|delete|upsert|insert|write|save|remove/i.test(operation));
    const route = metadata.route || metadata.path ? backendRouteTemplate(metadata.route, metadata.path) : null;
    // The SDK collapses a request's operations before sending them, so one row
    // can stand for many. Counting rows instead of operations would report a
    // view that queries in a loop as a single read.
    const count = Math.max(1, Math.round(Number(metadata.count) || 1));
    const emitted = this.emit(controller, 'QA_BACKEND_DATA_ACCESS', {
      model, operation, records, mutation, route, count,
      durationMs: Number.isFinite(Number(metadata.durationMs)) ? Number(metadata.durationMs) : null,
      method: metadata.method ? String(metadata.method).toUpperCase().slice(0, 12) : null,
    }, { eventId: typeof event.eventId === 'string' ? event.eventId : undefined, pageUrl: null });
    if (!emitted) return;
    const summary = state.backend ?? (state.backend = emptyBackendSummary());
    summary.dataOperations += count;
    const timestamp = typeof event.timestamp === 'string' ? event.timestamp : new Date().toISOString();
    const existing = summary.models.find((entry) => entry.model === model);
    const endpointKey = route && metadata.method ? `${String(metadata.method).toUpperCase()} ${route}` : route;
    const target = existing ?? {
      model, reads: 0, writes: 0, operations: [] as string[], endpoints: [] as string[], lastAt: timestamp,
    };
    if (!existing) summary.models.push(target);
    if (mutation) target.writes += count; else target.reads += count;
    target.lastAt = timestamp;
    target.operations = [operation, ...target.operations.filter((entry) => entry !== operation)].slice(0, 12);
    if (endpointKey && !target.endpoints.includes(endpointKey)) target.endpoints = [...target.endpoints, endpointKey].slice(0, 20);
    summary.models.sort((left, right) => (right.reads + right.writes) - (left.reads + left.writes));
    this.addLive(state, {
      kind: 'DATA', level: 'INFO',
      message: `${model}.${operation}${count > 1 ? ` ×${count}` : ''}${records == null ? '' : ` - ${records} record${records === 1 ? '' : 's'}`}`,
      details: compactDetails([
        detail('Kind', mutation ? 'Write' : 'Read'),
        detail('Operations', count > 1 ? `${count} collapsed into this row` : null),
        detail('Route', route),
        detail('Duration', metadata.durationMs == null ? null : `${metadata.durationMs} ms`),
      ]),
    });
  }

  /**
   * Reports a request that took notably longer than it should have.
   *
   * A backend run has no page to measure, so this is what its Performance pane
   * is made of: the requests that stood out, with the endpoint's own baseline
   * beside them so the number means something.
   */
  private reportBackendLatency(controller: RunController, input: {
    endpointKey: string;
    method: string;
    route: string;
    durationMs: number;
    status: number | null;
    handler: string | null;
    models: string[];
    baseline: number[];
  }): void {
    const verdict = classifyBackendLatency({ durationMs: input.durationMs, baseline: input.baseline });
    if (!verdict) return;
    const spent = controller.backendSlowRows.get(input.endpointKey) ?? 0;
    if (spent >= MAX_SLOW_ROWS_PER_ENDPOINT) return;
    controller.backendSlowRows.set(input.endpointKey, spent + 1);
    const { state } = controller;
    this.addLive(state, liveEvidenceForBackendLatency({
      method: input.method,
      route: input.route,
      durationMs: input.durationMs,
      statusCode: input.status,
      reason: verdict.reason,
      baselineMs: verdict.baselineMs,
      multiple: verdict.multiple,
      handler: input.handler,
      models: input.models,
    }));
    if (input.durationMs < CRITICALLY_SLOW_BACKEND_REQUEST_MS) return;
    const dedupeKey = `backend-slow:${input.endpointKey}`;
    if (state.findings.some((existing) => existing.dedupeKey === dedupeKey)) return;
    state.findings.push({
      id: uuid(), runId: state.runId, category: 'BACKEND_SLOW_RESPONSE', severity: 'MEDIUM',
      confidence: 0.9,
      title: `${input.method} ${input.route} took ${(input.durationMs / 1_000).toFixed(1)} s`,
      description: verdict.baselineMs
        ? `Server-side handling took ${input.durationMs} ms against a median of ${Math.round(verdict.baselineMs)} ms for this route.`
        : `Server-side handling took ${input.durationMs} ms.`,
      url: null, viewport: null, evidenceArtifactIds: [], evidenceChecksums: [],
      reproductionSteps: [`Call ${input.method} ${input.route}`, 'Compare the handler timing against the models it touched'],
      recommendation: input.models.length
        ? `Check the work behind this route: it touched ${input.models.join(', ')}.`
        : 'Check the work behind this route, and wire the SDK data hooks so the run can show which models it touched.',
      scope: state.phase === 'IN_FLOW' ? 'IN_FLOW' : 'PRE_BOUNDARY',
      dedupeKey, generatorSource: 'BROWSER',
    });
  }

  /** Folds one captured request into the run's rolling backend totals. */
  private applyBackendRequestToSummary(controller: RunController, input: {
    method: string;
    route: string;
    status: number | null;
    durationMs: number | null;
    requestBytes: number | null;
    responseBytes: number | null;
    models: string[];
    timestamp: string;
  }): void {
    const { state } = controller;
    const summary = state.backend ?? (state.backend = emptyBackendSummary());
    summary.requests += 1;
    summary.lastRequestAt = input.timestamp;
    if (input.status !== null && input.status >= 500) { summary.serverErrors += 1; summary.errors += 1; }
    else if (input.status !== null && input.status >= 400) { summary.clientErrors += 1; summary.errors += 1; }
    summary.requestBytes += input.requestBytes ?? 0;
    summary.responseBytes += input.responseBytes ?? 0;
    const key = `${input.method} ${input.route}`;
    if (input.durationMs !== null) {
      summary.totalDurationMs += input.durationMs;
      controller.backendAllDurations.push(input.durationMs);
      // Percentiles need the samples, but a long run must not grow without
      // bound, so the window is the most recent 5,000 requests.
      if (controller.backendAllDurations.length > 5_000) controller.backendAllDurations.shift();
      const perEndpoint = controller.backendDurations.get(key) ?? [];
      perEndpoint.push(input.durationMs);
      if (perEndpoint.length > 1_000) perEndpoint.shift();
      controller.backendDurations.set(key, perEndpoint);
      summary.p50Ms = durationPercentile(controller.backendAllDurations, 50);
      summary.p95Ms = durationPercentile(controller.backendAllDurations, 95);
      summary.slowestMs = Math.max(summary.slowestMs ?? 0, input.durationMs);
    }
    const existing = summary.endpoints.find((entry) => entry.key === key);
    const endpoint = existing ?? {
      key, method: input.method, route: input.route, requests: 0, errors: 0,
      totalDurationMs: 0, slowestMs: 0, p95Ms: 0, lastStatus: null as number | null,
      lastAt: input.timestamp, models: [] as string[],
    };
    if (!existing) summary.endpoints.push(endpoint);
    endpoint.requests += 1;
    endpoint.lastStatus = input.status;
    endpoint.lastAt = input.timestamp;
    if (input.status !== null && input.status >= 400) endpoint.errors += 1;
    if (input.durationMs !== null) {
      endpoint.totalDurationMs += input.durationMs;
      endpoint.slowestMs = Math.max(endpoint.slowestMs, input.durationMs);
      endpoint.p95Ms = durationPercentile(controller.backendDurations.get(key) ?? [], 95) ?? endpoint.slowestMs;
    }
    for (const model of input.models) {
      if (!endpoint.models.includes(model)) endpoint.models = [...endpoint.models, model].slice(0, 20);
    }
    // Busiest first: on a run with hundreds of routes the table is read from
    // the top and the tail never matters.
    summary.endpoints.sort((left, right) => right.requests - left.requests);
    if (summary.endpoints.length > 200) summary.endpoints.length = 200;
  }

  /**
   * Records the accepted graph this run is being reconciled against. The main
   * process resolves it once, at start, so the desktop can show the states the
   * user is actually expected to visit instead of a generic checklist.
   */
  setFlowPlan(plan: RunFlowPlan | null): GuidedRunState {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    const { state } = this.active;
    state.flowPlan = plan;
    this.recomputeCoverage(state);
    if (plan) {
      const initial = plan.states.find((item) => item.key === plan.initialStateKey);
      this.addLive(state, {
        kind: 'FLOW',
        level: 'INFO',
        message: `Reconciling against ${plan.flowName ?? 'the accepted Flow'}${plan.version == null ? '' : ` v${plan.version}`}`,
        details: compactDetails([
          detail('Expected states', plan.states.length),
          detail('Starts at', initial?.name ?? plan.initialStateKey),
          detail('Ends at', plan.terminalStateKeys.join(', ')),
        ]),
      });
    }
    this.notifyStateChanged();
    return this.snapshot();
  }

  /**
   * Raises the managed browser window above the desktop app, putting a page
   * back first if the operator closed the last one. Closing the window is not
   * an error the run has to be restarted for: the browser process, the
   * context, its init scripts and its bindings all survive, so a new page
   * carries the same recorder and the same session.
   */
  async focusBrowser(): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    if (this.active.state.browserStatus === 'NONE') throw new Error('RUN_HAS_NO_BROWSER');
    const { page } = this.active;
    if (!page || page.isClosed()) return this.reopenBrowser();
    await page.bringToFront();
    return this.snapshot();
  }

  /**
   * Opens a replacement page on the run's existing context and returns the
   * browser to where the run last was.
   */
  async reopenBrowser(): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    const controller = this.active;
    const { state, context } = controller;
    if (state.browserStatus === 'NONE' || !context) throw new Error('RUN_HAS_NO_BROWSER');
    if (controller.stopping || state.status === 'COMPLETED' || state.status === 'FAILED') {
      throw new Error('RUN_IS_TERMINAL');
    }
    if (controller.browser && !controller.browser.isConnected()) throw new Error('QA_BROWSER_DISCONNECTED');
    const existing = context.pages().find((open) => !open.isClosed()) ?? null;
    const page = existing ?? await context.newPage();
    controller.page = page;
    if (!existing) controller.attachPage?.(page);
    // Back to where the run was, not to the run's starting URL: a journey
    // several steps in should not be thrown away because a window was closed.
    const target = state.observations[state.observations.length - 1]?.url || state.targetUrl;
    if (!existing) {
      await navigateToRunTarget(page, target, 0).catch(() => undefined);
    }
    await page.bringToFront().catch(() => undefined);
    state.browserStatus = 'ACTIVE';
    this.addLive(state, {
      kind: 'PAGE', level: 'INFO',
      message: `Managed browser reopened at ${sanitizeCapturedUrl(target)}. The run continued while it was closed.`,
    });
    await controller.refreshObservation?.().catch(() => undefined);
    return this.snapshot();
  }

  /** Human-readable name for a normalised state key, falling back to the key. */
  private stateLabel(state: GuidedRunState, key: string | null): string | null {
    if (!key) return null;
    return state.flowPlan?.states.find((item) => item.key === key)?.name ?? key;
  }

  /** What the run is waiting for, phrased for the person driving the browser. */
  private expectedNextLabel(state: GuidedRunState): string | null {
    const plan = state.flowPlan;
    if (!plan) return null;
    if (state.phase === 'PRE_BOUNDARY') return this.stateLabel(state, plan.initialStateKey);
    const next = plan.transitions
      .filter((transition) => transition.from === state.currentFlowStateKey)
      .map((transition) => this.stateLabel(state, transition.to))
      .filter((label): label is string => Boolean(label));
    return next.length ? next.join(' or ') : null;
  }

  private recomputeCoverage(state: GuidedRunState): void {
    const plan = state.flowPlan;
    if (!plan) {
      state.coverage = null;
      return;
    }
    const expectedKeys = plan.states.map((item) => item.key);
    const visited: string[] = [];
    const takenTransitionKeys: string[] = [];
    for (const visit of state.flowStateHistory) {
      if (!visited.includes(visit.stateKey)) visited.push(visit.stateKey);
      if (!visit.fromStateKey) continue;
      const key = `${visit.fromStateKey}->${visit.stateKey}`;
      if (!takenTransitionKeys.includes(key)) takenTransitionKeys.push(key);
    }
    state.coverage = {
      expectedStates: expectedKeys.length,
      visitedStateKeys: visited.filter((key) => expectedKeys.includes(key)),
      remainingStateKeys: expectedKeys.filter((key) => !visited.includes(key)),
      offPlanStateKeys: visited.filter((key) => !expectedKeys.includes(key)),
      expectedTransitions: plan.transitions.length,
      takenTransitionKeys,
      terminalReached: visited.some((key) => plan.terminalStateKeys.includes(key)),
    };
  }

  /**
   * Screenshots the page at the moment a finding was raised. A console error or
   * a failed request can happen at any point, with no settle and no route
   * change, so without this the most report-relevant instant of the run is the
   * one with no picture of it.
   *
   * The capture's checksum goes onto the finding as `evidenceChecksums`, which
   * the server resolves into a evidence link once the artifact has an id.
   */
  private async captureFindingEvidence(
    controller: RunController,
    finding: BrowserFinding,
  ): Promise<void> {
    const { state, page } = controller;
    if (state.environmentType === 'PRODUCTION') return;
    if (controller.stopping || controller.snapshotInFlight) return;
    if (!page || page.isClosed()) return;
    if (controller.findingArtifacts.length >= MAX_FINDING_ARTIFACTS) return;
    // One picture per distinct problem: a console error in a render loop must
    // not fill the run with identical screenshots.
    const key = finding.dedupeKey ?? finding.id;
    if (controller.capturedFindingKeys.has(key)) return;
    controller.capturedFindingKeys.add(key);
    controller.snapshotInFlight = true;
    try {
      const file = path.join(
        state.artifactDirectory,
        `finding-${String(controller.findingArtifacts.length + 1).padStart(3, '0')}-${Date.now()}.png`,
      );
      const mask = page.locator('input, textarea, select, [contenteditable="true"], [data-tellann-sensitive]');
      await page.screenshot({ path: file, fullPage: true, mask: [mask], maskColor: '#111827' })
        .catch(() => undefined);
      if (!hasContent(file)) return;
      const pageUrl = sanitizeCapturedUrl(page.url());
      controller.findingArtifacts.push({
        file,
        context: {
          stateKey: state.currentFlowStateKey,
          route: normalizedRoute(pageUrl) ?? pageUrl,
          title: finding.title,
          sequence: null,
          captureReason: 'FINDING',
          accessibilityViolations: null,
          capturedAt: new Date().toISOString(),
        },
      });
      finding.evidenceChecksums = [...(finding.evidenceChecksums ?? []), checksum(file)];
    } catch {
      // Evidence is best-effort; a failed capture must never break the run.
    } finally {
      controller.snapshotInFlight = false;
    }
  }

  /**
   * Captures the evidence a report needs for one settled state: a masked
   * screenshot, a redacted aria snapshot, and an accessibility scan. Gated on
   * IN_FLOW so the pre-boundary floor (metadata only) still holds.
   *
   * Deduplicated on flow state, route and interaction epoch, so a wizard that
   * never changes route is captured step by step — then on page structure, so
   * an interaction that changed nothing does not spend a screenshot.
   */
  private async captureStateArtifacts(controller: RunController): Promise<void> {
    const { state, page } = controller;
    if (state.environmentType === 'PRODUCTION') return;
    if (controller.stopping || controller.paused || controller.snapshotInFlight) return;
    if (state.phase !== 'IN_FLOW') return;
    if (!page || page.isClosed()) return;
    if (state.stateArtifacts.length >= MAX_STATE_ARTIFACTS) return;
    const pageUrl = sanitizeCapturedUrl(page.url());
    const route = normalizedRoute(pageUrl) ?? pageUrl;
    const dedupeKey = `${state.currentFlowStateKey ?? ''}|${route}|${controller.interactionEpoch}`;
    if (controller.capturedStateKeys.has(dedupeKey)) return;
    controller.capturedStateKeys.add(dedupeKey);
    controller.snapshotInFlight = true;
    try {
      // The aria snapshot comes first: it doubles as the change test, and a
      // screenshot is far more expensive to take and to store.
      const aria = await page.locator('body').ariaSnapshot().catch(() => null);
      const redactedAria = aria === null ? '' : redactAriaSnapshot(aria).trim();
      const signature = crypto.createHash('sha1').update(`${route}\n${redactedAria}`).digest('hex');
      if (signature === controller.lastCaptureSignature) return;
      controller.lastCaptureSignature = signature;
      const base = `state-${String(state.stateArtifacts.length + 1).padStart(3, '0')}-${Date.now()}`;
      const screenshotPath = path.join(state.artifactDirectory, `${base}.png`);
      const ariaPath = path.join(state.artifactDirectory, `${base}.aria.txt`);
      const mask = page.locator('input, textarea, select, [contenteditable="true"], [data-tellann-sensitive]');
      await page.screenshot({ path: screenshotPath, fullPage: true, mask: [mask], maskColor: '#111827' })
        .catch(() => undefined);
      if (redactedAria) fs.writeFileSync(ariaPath, redactedAria, 'utf8');
      const violations = await this.runAccessibilityScan(
        controller,
        route,
        hasContent(screenshotPath) ? checksum(screenshotPath) : null,
      );
      const title = await page.title().catch(() => '');
      const artifact: RunStateArtifact = {
        stateKey: state.currentFlowStateKey,
        route,
        title: safeMessage(title),
        timestamp: new Date().toISOString(),
        screenshotFile: hasContent(screenshotPath) ? path.basename(screenshotPath) : null,
        accessibilityFile: hasContent(ariaPath) ? path.basename(ariaPath) : null,
        accessibilityViolations: violations === null ? null : violations.length,
        sequence: state.stateArtifacts.length + 1,
        captureReason: 'STATE_SETTLED',
      };
      state.stateArtifacts.push(artifact);
      this.emit(controller, 'QA_STATE_SNAPSHOT', {
        stateKey: artifact.stateKey,
        route: artifact.route,
        title: artifact.title,
        screenshotFile: artifact.screenshotFile,
        accessibilityFile: artifact.accessibilityFile,
      }, { pageUrl });
      this.addLive(state, {
        kind: 'PAGE',
        level: 'INFO',
        message: `State snapshot captured for ${this.stateLabel(state, state.currentFlowStateKey) ?? route}`,
        details: compactDetails([
          detail('Screenshot', artifact.screenshotFile),
          detail('Accessibility tree', artifact.accessibilityFile),
          detail('Accessibility violations', artifact.accessibilityViolations),
        ]),
      });
    } finally {
      controller.snapshotInFlight = false;
    }
  }

  /**
   * Runs axe-core against the settled page. The source is evaluated as an
   * expression so the driver compiles it rather than the page, which keeps the
   * scan working under a strict Content-Security-Policy without weakening the
   * policy the application is actually being tested under. Only rule metadata
   * and target selectors are kept: the failing markup itself is page content
   * and never leaves the browser.
   */
  private async runAccessibilityScan(
    controller: RunController,
    route: string,
    /**
     * Checksum of the state screenshot this scan runs against. An accessibility
     * violation already has a picture of the page it was found on, so it links
     * to that rather than triggering a second capture of the same view.
     */
    evidenceChecksum?: string | null,
  ): Promise<Array<{ id: string; impact: string | null; help: string; nodes: number }> | null> {
    const { page, state } = controller;
    if (!page || page.isClosed()) return null;
    try {
      const axeSourcePath = require.resolve('axe-core/axe.min.js');
      const axeSource = fs.readFileSync(axeSourcePath, 'utf8');
      await page.evaluate(`${axeSource};undefined`);
      const violations = await page.evaluate(async () => {
        const axe = (globalThis as unknown as { axe?: { run: (...args: unknown[]) => Promise<unknown> } }).axe;
        if (!axe) return null;
        const results = await axe.run(document, {
          resultTypes: ['violations'],
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        }) as { violations: unknown[] };
        // Capped hard: the server rejects any single evidence event over 32 KB,
        // and a rejected event costs the whole scan rather than its tail.
        return results.violations.slice(0, 20).map((raw) => {
          const violation = raw as Record<string, any>;
          const nodes = Array.isArray(violation.nodes) ? violation.nodes : [];
          return {
            id: String(violation.id),
            impact: violation.impact ? String(violation.impact) : null,
            help: String(violation.help ?? '').slice(0, 160),
            nodes: nodes.length,
            targets: nodes.slice(0, 3).map((node: any) => String(node?.target?.[0] ?? '').slice(0, 160)),
          };
        });
      });
      if (!violations) return null;
      this.emit(controller, 'QA_ACCESSIBILITY_SCAN', {
        route,
        stateKey: state.currentFlowStateKey,
        engine: 'axe-core',
        violationCount: violations.length,
        violations,
      });
      for (const violation of violations) {
        if (violation.impact !== 'critical' && violation.impact !== 'serious') continue;
        state.findings.push({
          id: uuid(),
          runId: state.runId,
          category: 'ACCESSIBILITY_VIOLATION',
          severity: violation.impact === 'critical' ? 'HIGH' : 'MEDIUM',
          confidence: 0.9,
          title: violation.help || `Accessibility rule ${violation.id}`,
          description: `${violation.nodes} element(s) on ${route} fail ${violation.id}.`,
          url: sanitizeCapturedUrl(page.url()),
          viewport: page.viewportSize(),
          evidenceArtifactIds: [],
          evidenceChecksums: evidenceChecksum ? [evidenceChecksum] : [],
          reproductionSteps: ['Open the captured route', 'Inspect the reported elements'],
          recommendation: 'Resolve the accessibility rule failure and rerun the affected Flow state.',
          scope: 'IN_FLOW',
          dedupeKey: `a11y:${violation.id}:${route}`,
          generatorSource: 'BROWSER',
        });
      }
      return violations;
    } catch {
      // A scan that cannot run is not a run failure: the rest of the state
      // snapshot still stands, and the artifact records that it is missing.
      return null;
    }
  }

  async acceptBoundaryOutcome(input: {
    accepted: boolean;
    phase?: 'PRE_BOUNDARY' | 'IN_FLOW';
    stateKey?: string | null;
    eventType?: string | null;
    reason?: string | null;
  }): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    const { state } = this.active;
    const stateKey = input.stateKey ? normalizeFlowKey(input.stateKey) : null;
    // A rejected Flow event is otherwise indistinguishable from one that never
    // arrived: both leave the run waiting at the boundary. Say which it was, and
    // why, next to the event itself, and keep the latest refusal on the state so
    // the run page can turn it into something the user can act on.
    if (!input.accepted) {
      state.boundaryRejection = {
        eventType: input.eventType || 'FLOW_EVENT',
        stateKey,
        reason: input.reason || 'UNKNOWN',
        timestamp: new Date().toISOString(),
      };
      this.addLive(state, {
        kind: 'FLOW', level: 'WARN', recorded: true,
        message: `${input.eventType || 'Flow event'} was not accepted · ${input.reason || 'unknown reason'}`,
        details: compactDetails([
          detail('State key', input.stateKey || '(none)'),
          detail('Reason', input.reason || 'unknown'),
          detail('Expected next', this.expectedNextLabel(state)),
        ]),
      });
    }
    if (input.accepted) {
      const wasPreBoundary = state.phase === 'PRE_BOUNDARY';
      state.boundaryRejection = null;
      if (input.phase === 'IN_FLOW') {
        state.phase = 'IN_FLOW';
        if (input.stateKey) state.currentFlowStateKey = stateKey;
        await this.broadcastToFrames(
          ({ phase, stateKey: nextKey }: { phase: string; stateKey: string | null }) =>
            (globalThis as any).__tellannQaSetPhase?.(phase, nextKey),
          { phase: 'IN_FLOW', stateKey },
        );
      }
      if (stateKey) {
        const previous = state.flowStateHistory[state.flowStateHistory.length - 1];
        state.flowStateHistory.push({
          stateKey,
          eventType: input.eventType || (wasPreBoundary ? 'FLOW_INITIAL_STATE' : 'FLOW_TRANSITION'),
          fromStateKey: previous?.stateKey ?? null,
          timestamp: new Date().toISOString(),
        });
        this.recomputeCoverage(state);
      }
      if (wasPreBoundary && state.phase === 'IN_FLOW') {
        this.addLive(state, {
          kind: 'FLOW', level: 'INFO', recorded: true,
          message: 'Flow boundary accepted. Detailed capture is on for the rest of this run.',
          details: compactDetails([detail('Initial state', this.stateLabel(state, stateKey))]),
        });
      }
    }
    this.notifyStateChanged();
    return this.snapshot();
  }

  async setInteractionMode(mode: QAInteractionMode): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    // Inspect is a browser gesture: it puts an overlay on the page and saves a
    // comment against the element the operator clicks. A backend run has no
    // page, so the mode does not exist rather than silently doing nothing.
    if (this.active.state.browserStatus === 'NONE') throw new Error('RUN_HAS_NO_BROWSER');
    if (mode === 'INSPECT' && (!this.active.page || this.active.page.isClosed())) {
      throw new Error('QA_BROWSER_CLOSED');
    }
    const acknowledged = await this.broadcastToFrames(
      (next: QAInteractionMode) => (globalThis as any).__tellannQaSetMode?.(next) === true,
      mode,
    );
    // The recorder only installs on the application's own origin. If the page
    // has navigated somewhere else (an external identity provider, say), no
    // frame can host the overlay — report that instead of leaving the button
    // looking like it worked while nothing appears in the browser.
    if (!acknowledged && mode === 'INSPECT') {
      this.addLive(this.active.state, {
        kind: 'PAGE',
        level: 'WARN',
        message: `Interaction mode ${mode} could not be applied: the QA recorder is not present on the current page.`,
      });
      throw new Error('QA_RECORDER_NOT_PRESENT_ON_PAGE');
    }
    this.active.state.interactionMode = mode;
    this.addLive(this.active.state, {
      kind: 'ACCESSIBILITY', level: 'INFO',
      message: mode === 'INSPECT'
        ? 'Inspect mode active. Select an element in the managed browser to add a comment.'
        : 'Navigate mode active. Browser controls will perform their normal actions.',
    });
    if (mode === 'INSPECT') await this.active.page?.bringToFront().catch(() => undefined);
    return this.snapshot();
  }

  async pause(paused?: boolean): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    const next = paused ?? !this.active.paused;
    this.active.paused = next;
    this.active.state.status = next ? 'PAUSED' : 'RUNNING';
    return this.snapshot();
  }

  async end(): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    this.active.state.phase = 'FINALIZING';
    this.active.state.status = 'COMPLETED';
    this.active.state.endedAt = new Date().toISOString();
    return this.stopAndPersist();
  }

  async abort(reason = 'QA run interrupted'): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    this.active.state.phase = 'FINALIZING';
    this.active.state.status = 'FAILED';
    this.active.state.endedAt = new Date().toISOString();
    this.addLive(this.active.state, { kind: 'PAGE', level: 'ERROR', message: safeMessage(reason) });
    return this.stopAndPersist();
  }

  getState(): GuidedRunState | null { return this.active ? this.snapshot() : null; }

  private snapshot(): GuidedRunState {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    return JSON.parse(JSON.stringify(this.active.state)) as GuidedRunState;
  }

  private async stopAndPersist(): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    const controller = this.active;
    const { state, page, context, browser, observationTimer } = controller;
    if (controller.stopping) return this.snapshot();
    controller.stopping = true;
    state.phase = 'FINALIZING';
    if (observationTimer) clearInterval(observationTimer);
    const screenshot = path.join(state.artifactDirectory, 'final-sanitized.png');
    const accessibility = path.join(state.artifactDirectory, 'accessibility.txt');
    const manifest = path.join(state.artifactDirectory, 'manifest.json');
    if (state.environmentType !== 'PRODUCTION' && page && !page.isClosed()) {
      const mask = page.locator('input, textarea, select, [contenteditable="true"], [data-tellann-sensitive]');
      await page.screenshot({ path: screenshot, fullPage: true, mask: [mask], maskColor: '#111827' }).catch(() => undefined);
      const aria = await page.locator('body').ariaSnapshot().catch(() => '');
      // Shares the redaction rule with every per-state snapshot rather than
      // restating it, so the two can never drift apart. A page that yields
      // nothing still gets a readable placeholder — never an empty file, which
      // the artifact endpoint refuses.
      const redactedAria = redactAriaSnapshot(aria).trim();
      fs.writeFileSync(accessibility, redactedAria || 'Accessibility snapshot unavailable', 'utf8');
    }
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    if (state.browserStatus === 'ACTIVE') state.browserStatus = 'CLOSED';
    state.phase = 'COMPLETE';
    // Per-state captures ride along with the final pair so the report can show
    // each step of the Flow rather than only where the run happened to stop.
    const stateArtifactFiles = state.stateArtifacts.flatMap((artifact) => [
      artifact.screenshotFile ? path.join(state.artifactDirectory, artifact.screenshotFile) : null,
      artifact.accessibilityFile ? path.join(state.artifactDirectory, artifact.accessibilityFile) : null,
    ]).filter((file): file is string => Boolean(file));
    const findingArtifactFiles = controller.findingArtifacts.map((artifact) => artifact.file);
    const artifactFiles = [screenshot, accessibility, ...stateArtifactFiles, ...findingArtifactFiles]
      .filter(hasContent);
    // What each file depicts, keyed by basename. Uploaded with the bytes so a
    // report card can name the state and route instead of a bare filename.
    const finalRoute = sanitizeCapturedUrl(state.targetUrl);
    const captureContext = new Map<string, ArtifactCaptureContext>([
      [path.basename(screenshot), {
        stateKey: state.currentFlowStateKey ?? null,
        route: normalizedRoute(finalRoute) ?? finalRoute,
        title: 'Final state',
        sequence: state.stateArtifacts.length + 1,
        captureReason: 'RUN_FINAL',
        accessibilityViolations: null,
        capturedAt: state.endedAt ?? new Date().toISOString(),
      }],
      [path.basename(accessibility), {
        stateKey: state.currentFlowStateKey ?? null,
        route: normalizedRoute(finalRoute) ?? finalRoute,
        title: 'Final accessibility snapshot',
        sequence: state.stateArtifacts.length + 1,
        captureReason: 'RUN_FINAL',
        accessibilityViolations: null,
        capturedAt: state.endedAt ?? new Date().toISOString(),
      }],
    ]);
    for (const artifact of state.stateArtifacts) {
      const context: ArtifactCaptureContext = {
        stateKey: artifact.stateKey,
        route: artifact.route,
        title: artifact.title || artifact.route,
        sequence: artifact.sequence,
        captureReason: artifact.captureReason,
        accessibilityViolations: artifact.accessibilityViolations,
        capturedAt: artifact.timestamp,
      };
      if (artifact.screenshotFile) captureContext.set(artifact.screenshotFile, context);
      if (artifact.accessibilityFile) captureContext.set(artifact.accessibilityFile, context);
    }
    for (const artifact of controller.findingArtifacts) {
      captureContext.set(path.basename(artifact.file), artifact.context);
    }
    fs.writeFileSync(manifest, JSON.stringify({
      runId: state.runId, sessionId: state.sessionId, traceId: state.traceId,
      applicationId: state.applicationId, environmentId: state.environmentId, environmentType: state.environmentType,
      expectedGraphVersionId: state.expectedGraphVersionId, mode: state.mode,
      captureTracks: state.captureTracks, backend: state.backend,
      status: state.status, phase: state.phase, targetUrl: sanitizeCapturedUrl(state.targetUrl),
      windowResolution: state.windowResolution ?? null,
      evidenceCounts: state.evidenceCounts, observations: state.observations,
      observedTransitions: state.observedTransitions, findings: state.findings,
      flowPlan: state.flowPlan, coverage: state.coverage, flowStateHistory: state.flowStateHistory,
      stateArtifacts: state.stateArtifacts, annotationCount: state.annotationCount,
      evidenceTrimmed: state.evidenceTrimmed, liveCounts: state.liveCounts,
      startedAt: state.startedAt, endedAt: state.endedAt,
      artifacts: artifactFiles.map((file) => ({
        name: path.basename(file), bytes: fs.statSync(file).size, checksum: checksum(file),
        context: captureContext.get(path.basename(file)) ?? null,
      })),
    }, null, 2));
    const result = JSON.parse(JSON.stringify(state)) as GuidedRunState;
    this.active = null;
    return result;
  }
}
