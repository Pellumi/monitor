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

export type LiveEvidence = {
  id: string;
  kind: 'CONSOLE' | 'NETWORK' | 'PAGE' | 'ACCESSIBILITY' | 'INTERACTION' | 'STORAGE' | 'PERFORMANCE' | 'FLOW';
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: string;
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

export type GuidedRunState = {
  runId: string;
  sessionId: string;
  traceId: string;
  applicationId: string;
  environmentId: string;
  expectedGraphVersionId: string | null;
  mode: 'GUIDED' | 'OBSERVATION_ONLY';
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  phase: 'PRE_BOUNDARY' | 'IN_FLOW' | 'FINALIZING' | 'COMPLETE';
  interactionMode: QAInteractionMode;
  currentFlowStateKey: string | null;
  evidenceCounts: Record<string, number>;
  targetUrl: string;
  evidence: LiveEvidence[];
  observations: BrowserObservation[];
  observedTransitions: BrowserObservedTransition[];
  findings: BrowserFinding[];
  artifactDirectory: string;
  startedAt: string;
  endedAt: string | null;
};

export type LocalAnnotationInput = CreateQARunAnnotation & { screenshotPath: string | null };

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
  browser: Browser;
  context: BrowserContext;
  page: Page;
  observationTimer: ReturnType<typeof setInterval>;
  stopping: boolean;
  paused: boolean;
  sequence: number;
  applicationOrigin: string;
  requests: Map<Request, RequestRecord>;
  /** Requests this observer aborted itself under observation-only policy. */
  blockedByPolicy: WeakSet<Request>;
  recentCause: { eventId: string; interactionGroupId: string | null; at: number } | null;
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
  'QA_RUNTIME_ERROR', 'QA_PAGE_CRASH', 'QA_FLOW_EVENT', 'QA_CAPTURE_DEGRADED',
]);
const SAFE_REQUEST_HEADERS = new Set([
  'accept', 'content-type', 'content-length', 'origin', 'referer', 'user-agent', 'x-requested-with',
]);
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

export function sanitizeCapturedUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const names = [...new Set([...url.searchParams.keys()])].sort();
    url.search = names.length ? `?${names.map((name) => `${encodeURIComponent(name)}=`).join('&')}` : '';
    url.hash = '';
    return url.toString();
  } catch { return raw.split(/[?#]/, 1)[0].slice(0, 2_000); }
}

function safeMessage(raw: string): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&][^=\s]+)=([^&\s]+)/g, '$1=')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[PSEUDONYMIZED EMAIL]')
    .slice(0, 2_000);
}

function normalizedRoute(urlValue: string): string | null {
  try { return new URL(urlValue).pathname || '/'; } catch { return null; }
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
  const pathParts = url.pathname.split('/').filter(Boolean)
    .map((part) => (/^[0-9a-f-]{16,}$/i.test(part) || /^\d+$/.test(part) ? 'DETAIL' : part));
  const route = pathParts.length ? pathParts.join('_') : 'HOME';
  void titleValue;
  return { stateName: route.replace(/[^a-z0-9]+/gi, '_').toUpperCase().slice(0, 100), category: 'NAVIGATION' };
}

export class BrowserObserver {
  private active: RunController | null = null;

  constructor(private readonly options: {
    executablePath?: string;
    headless?: boolean;
    onUnexpectedTermination?: (state: GuidedRunState) => Promise<void> | void;
    onObservation?: (runId: string, observation: BrowserObservation) => Promise<void> | void;
    onEvidenceEvent?: (event: QAEvidenceEvent) => Promise<void> | void;
    onAnnotation?: (runId: string, annotation: LocalAnnotationInput) => Promise<unknown> | unknown;
    searchMentionableMembers?: (runId: string, query: string) => Promise<QAMentionableMember[]>;
  } = {}) {}

  private addLive(state: GuidedRunState, evidence: Omit<LiveEvidence, 'id' | 'timestamp'>) {
    state.evidence.push({ id: uuid(), timestamp: new Date().toISOString(), ...evidence });
    if (state.evidence.length > 500) state.evidence.shift();
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
    const pageUrl = input.pageUrl ?? (controller.page?.isClosed() ? null : sanitizeCapturedUrl(controller.page.url()));
    const eventId = input.eventId || uuid();
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
      viewport: controller.page?.isClosed() ? null : controller.page.viewportSize(),
      interactionGroupId: input.interactionGroupId ?? null,
      causedByEventId: input.causedByEventId ?? null,
      metadata,
      protectedValues: input.protectedValues ?? [],
    };
    state.evidenceCounts[type] = (state.evidenceCounts[type] ?? 0) + 1;
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
    const protectedValues: QAPendingProtectedValue[] = [];
    if (payload.valueKind && payload.valuePath) {
      protectedValues.push({
        keyPath: payload.valuePath,
        kind: payload.valueKind,
        value: payload.valueKind === 'SECRET' || controller.state.mode === 'OBSERVATION_ONLY' ? undefined : payload.value,
        valueLength: payload.value?.length ?? Number(payload.metadata?.valueLength ?? 0),
      });
    }
    const eventId = this.emit(controller, type, payload.metadata ?? {}, {
      eventId: payload.eventId,
      protectedValues,
      interactionGroupId: payload.interactionGroupId ?? null,
      causedByEventId: payload.causedByEventId ?? null,
    });
    if (eventId && ['click', 'submit_intent', 'submit', 'route'].includes(String(payload.type))) {
      controller.recentCause = { eventId, interactionGroupId: payload.interactionGroupId ?? null, at: Date.now() };
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
    const browser = await chromium.launch({
      headless,
      ...(this.options.executablePath ? { executablePath: this.options.executablePath } : {}),
    });
    const applicationOrigin = new URL(input.targetUrl).origin;
    const context = await browser.newContext({
      viewport: browserContextViewport(headless),
      locale: 'en-US',
      colorScheme: 'light',
      recordVideo: undefined,
    });
    const state: GuidedRunState = {
      runId, sessionId, traceId, applicationId: input.applicationId, environmentId: input.environmentId,
      expectedGraphVersionId: input.expectedGraphVersionId,
      mode: observationOnly ? 'OBSERVATION_ONLY' : 'GUIDED',
      status: 'RUNNING', phase: 'PRE_BOUNDARY', interactionMode: 'NAVIGATE', currentFlowStateKey: null,
      evidenceCounts: {}, targetUrl: input.targetUrl, evidence: [], observations: [], observedTransitions: [],
      findings: [], artifactDirectory, startedAt: new Date().toISOString(), endedAt: null,
    };
    const controller: RunController = {
      state, browser, context, page: null as unknown as Page,
      observationTimer: null as unknown as ReturnType<typeof setInterval>, stopping: false, paused: false,
      sequence: 0, applicationOrigin, requests: new Map(), blockedByPolicy: new WeakSet(), recentCause: null,
    };
    this.active = controller;
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
      const screenshotPath = path.join(artifactDirectory, `inspect-${Date.now()}.png`);
      await controller.page.evaluate(() => (globalThis as any).__tellannQaScreenshotMode?.(true)).catch(() => undefined);
      const mask = controller.page.locator('input, textarea, select, [contenteditable="true"], [data-tellann-sensitive]');
      await controller.page.screenshot({ path: screenshotPath, fullPage: true, mask: [mask], maskColor: '#111827' }).catch(() => undefined);
      await controller.page.evaluate(() => (globalThis as any).__tellannQaScreenshotMode?.(false)).catch(() => undefined);
      return this.options.onAnnotation?.(runId, {
        ...annotation,
        screenshotPath: fs.existsSync(screenshotPath) ? screenshotPath : null,
      });
    });
    await context.addInitScript(installQaRecorder, {
      bridge: bridgeName, members: memberName, annotations: annotationName,
      origin: applicationOrigin, production: observationOnly,
    });
    // Protected values can be captured during IN_FLOW, so DOM/screenshot trace
    // snapshots intentionally remain disabled for this V2 observer.
    const page = await context.newPage();
    controller.page = page;

    const captureObservation = async () => {
      if (page.isClosed()) return;
      const url = page.url();
      if (!/^https?:\/\//.test(url)) return;
      const title = await page.title().catch(() => '');
      const derived = deriveBrowserState(url, title);
      const previous = state.observations[state.observations.length - 1];
      const safeUrl = sanitizeCapturedUrl(url);
      if (previous?.stateName === derived.stateName && previous.url === safeUrl) return;
      const observation: BrowserObservation = {
        eventId: uuid(), ...derived, url: safeUrl, title: safeMessage(title), timestamp: new Date().toISOString(),
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
        state.findings.push({
          id: uuid(), runId, category: 'BROWSER_CONSOLE_ERROR', severity: 'MEDIUM', confidence: 0.95,
          title: 'Browser console error', description: text, url: originUrl,
          viewport: origin && !origin.isClosed() ? origin.viewportSize() : null,
          evidenceArtifactIds: [], reproductionSteps: ['Open the captured route', 'Repeat the linked interaction'],
          recommendation: 'Resolve the client runtime error and rerun the affected Flow state.',
          scope: state.phase === 'IN_FLOW' ? 'IN_FLOW' : 'PRE_BOUNDARY',
          dedupeKey: `console:${crypto.createHash('sha1').update(text).digest('hex')}`, generatorSource: 'BROWSER',
        });
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
      this.emit(controller, 'QA_REQUEST', {
        method: record.method, url: record.url, resourceType: record.resourceType,
        redirectedFrom: record.redirectedFrom, status, failed, blockedByPolicy,
        failure: failed ? safeMessage(request.failure()?.errorText ?? 'Request failed') : null,
        durationMs: Date.now() - record.startedAt, timing: request.timing(),
        responseContentType: contentType.slice(0, 200),
        // Prefer the driver's real transfer size (which accounts for
        // compression and headers) and fall back to Content-Length only when
        // sizes are unavailable, e.g. for a failed request.
        transferredBytes: await request.sizes()
          .then((sizes) => sizes.responseBodySize + sizes.responseHeadersSize)
          .catch(() => Number(response?.headers()['content-length'] ?? 0) || null),
        headers: record.safeHeaders,
        ...(record.metadataBody === undefined ? {} : { requestBody: record.metadataBody }),
        ...(responseBody === undefined ? {} : { responseBody }),
      }, {
        pageUrl: record.url, protectedValues: record.protectedValues,
        interactionGroupId: record.interactionGroupId, causedByEventId: record.causedByEventId,
      });
      // A request this observer aborted under observation-only policy is an
      // expected outcome of the capture track, never an application defect.
      if (!blockedByPolicy && (failed || (status !== null && status >= 400))) {
        const severity = failed || (status ?? 0) >= 500 ? 'HIGH' : 'MEDIUM';
        const description = `${record.method} ${record.url} — ${failed ? request.failure()?.errorText ?? 'failed' : status}`;
        this.addLive(state, { kind: 'NETWORK', level: severity === 'HIGH' ? 'ERROR' : 'WARN', message: description });
        state.findings.push({
          id: uuid(), runId, category: failed ? 'NETWORK_REQUEST_FAILED' : 'HTTP_ERROR_RESPONSE', severity,
          confidence: 0.98, title: failed ? 'Network request failed' : `Request returned ${status}`,
          description, url: originPage?.url() || null, viewport: originPage?.viewportSize() ?? null, evidenceArtifactIds: [],
          reproductionSteps: ['Open the captured route', 'Repeat the linked interaction'],
          recommendation: 'Check service availability, request construction, authorization, and server handling.',
          scope: state.phase === 'IN_FLOW' ? 'IN_FLOW' : 'PRE_BOUNDARY',
          dedupeKey: `request:${record.method}:${normalizedRoute(record.url)}:${status ?? 'failed'}`,
          generatorSource: 'BROWSER',
        });
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
        this.emit(controller, 'QA_ROUTE_CHANGED', {
          kind: frame === target.mainFrame() ? 'document' : 'frame', url: sanitizeCapturedUrl(frame.url()),
        }, { pageUrl: frame.url() });
        if (frame === target.mainFrame() && target === controller.page) void captureObservation();
        // A frame that attaches or navigates after the boundary was accepted
        // starts at the recorder's PRE_BOUNDARY/NAVIGATE defaults, so replay
        // the current capture state into it.
        void this.syncFrameState(controller, frame);
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
    this.emit(this.active, 'QA_FLOW_EVENT', {
      eventType: String(event.eventType ?? ''), stateKey: String(metadata.stateKey ?? ''),
      fromStateKey: metadata.fromStateKey ? String(metadata.fromStateKey) : null,
      action: metadata.action ? String(metadata.action) : null,
      flowVersionId: String(metadata.flowVersionId ?? ''),
    }, { eventId });
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
    fn: (argument: any) => void,
    argument: unknown,
  ): Promise<void> {
    if (!this.active) return;
    const frames = this.active.context.pages()
      .filter((page) => !page.isClosed())
      .flatMap((page) => page.frames());
    await Promise.all(frames.map((frame) => frame.evaluate(fn, argument).catch(() => undefined)));
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
    this.emit(controller, 'QA_CLIENT_STATE_MUTATION', {
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
  }

  async acceptBoundaryOutcome(input: {
    accepted: boolean;
    phase?: 'PRE_BOUNDARY' | 'IN_FLOW';
    stateKey?: string | null;
  }): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    if (input.accepted && input.phase === 'IN_FLOW') {
      this.active.state.phase = 'IN_FLOW';
      if (input.stateKey) this.active.state.currentFlowStateKey = input.stateKey;
      await this.broadcastToFrames(
        ({ phase, stateKey }: { phase: string; stateKey: string | null }) =>
          (globalThis as any).__tellannQaSetPhase?.(phase, stateKey),
        { phase: 'IN_FLOW', stateKey: input.stateKey ?? null },
      );
    }
    return this.snapshot();
  }

  async setInteractionMode(mode: QAInteractionMode): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    this.active.state.interactionMode = mode;
    await this.broadcastToFrames((next: QAInteractionMode) => (globalThis as any).__tellannQaSetMode?.(next), mode);
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
    clearInterval(observationTimer);
    const screenshot = path.join(state.artifactDirectory, 'final-sanitized.png');
    const accessibility = path.join(state.artifactDirectory, 'accessibility.txt');
    const manifest = path.join(state.artifactDirectory, 'manifest.json');
    if (page && !page.isClosed()) {
      const mask = page.locator('input, textarea, select, [contenteditable="true"], [data-tellann-sensitive]');
      await page.screenshot({ path: screenshot, fullPage: true, mask: [mask], maskColor: '#111827' }).catch(() => undefined);
      const aria = await page.locator('body').ariaSnapshot().catch(() => 'Accessibility snapshot unavailable');
      fs.writeFileSync(accessibility, aria.replace(/((?:textbox|combobox|password)[^\n]*)(?:\n\s*-.*)?/gi, '$1 [PROTECTED]'), 'utf8');
    }
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    state.phase = 'COMPLETE';
    const artifactFiles = [screenshot, accessibility].filter((file) => fs.existsSync(file));
    fs.writeFileSync(manifest, JSON.stringify({
      runId: state.runId, sessionId: state.sessionId, traceId: state.traceId,
      applicationId: state.applicationId, environmentId: state.environmentId,
      expectedGraphVersionId: state.expectedGraphVersionId, mode: state.mode,
      status: state.status, phase: state.phase, targetUrl: sanitizeCapturedUrl(state.targetUrl),
      evidenceCounts: state.evidenceCounts, observations: state.observations,
      observedTransitions: state.observedTransitions, findings: state.findings,
      startedAt: state.startedAt, endedAt: state.endedAt,
      artifacts: artifactFiles.map((file) => ({
        name: path.basename(file), bytes: fs.statSync(file).size, checksum: checksum(file),
      })),
    }, null, 2));
    const result = JSON.parse(JSON.stringify(state)) as GuidedRunState;
    this.active = null;
    return result;
  }
}
