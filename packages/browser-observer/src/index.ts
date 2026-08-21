import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { assertEnvironmentActionAllowed } from '@sots/agent-policy';
import type { BrowserFinding, StartGuidedRunInput } from '@sots/desktop-contracts';

export type LiveEvidence = {
  id: string;
  kind: 'CONSOLE' | 'NETWORK' | 'PAGE' | 'ACCESSIBILITY';
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
  expectedGraphVersionId: string | null;
  mode: 'GUIDED' | 'OBSERVATION_ONLY';
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  targetUrl: string;
  evidence: LiveEvidence[];
  observations: BrowserObservation[];
  observedTransitions: BrowserObservedTransition[];
  findings: BrowserFinding[];
  artifactDirectory: string;
  startedAt: string;
  endedAt: string | null;
};

type RunController = {
  state: GuidedRunState;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  observationTimer: ReturnType<typeof setInterval>;
  stopping: boolean;
};

function uuid(): string {
  return crypto.randomUUID();
}

function checksum(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function isObservationOnlyRequestAllowed(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

export function deriveBrowserState(urlValue: string, titleValue = ''): {
  stateName: string;
  category: 'NAVIGATION' | 'UI';
} {
  const url = new URL(urlValue);
  const pathParts = url.pathname
    .split('/')
    .filter(Boolean)
    .map((part) => (/^[0-9a-f-]{16,}$/i.test(part) || /^\d+$/.test(part) ? 'DETAIL' : part));
  const route = pathParts.length ? pathParts.join('_') : 'HOME';
  const safeTitle = titleValue
    .replace(/\s+[|–—-]\s+.*$/, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const normalizedRoute = route.replace(/[^a-z0-9]+/gi, '_').toUpperCase();
  void safeTitle;
  return { stateName: normalizedRoute.slice(0, 100), category: 'NAVIGATION' };
}

export class BrowserObserver {
  private active: RunController | null = null;

  constructor(private readonly options: {
    executablePath?: string;
    headless?: boolean;
    onUnexpectedTermination?: (state: GuidedRunState) => Promise<void> | void;
    onObservation?: (runId: string, observation: BrowserObservation) => Promise<void> | void;
  } = {}) {}

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
    const browser = await chromium.launch({
      headless: this.options.headless ?? false,
      ...(this.options.executablePath ? { executablePath: this.options.executablePath } : {}),
    });
    const applicationOrigin = new URL(input.targetUrl).origin;
    const correlationHeaders = {
      'x-tellann-run-id': runId,
      'x-tellann-session-id': sessionId,
      'x-tellann-trace-id': traceId,
      'x-tellann-environment-id': input.environmentId,
    };
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
      colorScheme: 'light',
      recordVideo: undefined,
    });
    await context.route('**/*', async (route) => {
      const requestUrl = route.request().url();
      let sameApplicationOrigin = false;
      try { sameApplicationOrigin = new URL(requestUrl).origin === applicationOrigin; } catch { /* non-URL requests remain unmodified */ }
      if (observationOnly && !isObservationOnlyRequestAllowed(route.request().method())) {
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue(sameApplicationOrigin ? { headers: { ...route.request().headers(), ...correlationHeaders } } : undefined);
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
          relayEndpoint: input.relayEndpoint,
          relayToken: input.relayToken,
          applicationId: input.applicationId,
          environmentId: input.environmentId,
          runId,
          sessionId,
          traceId,
          agentVersion: input.agentVersion ?? 'desktop-dev',
        },
      });
    }
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    const page = await context.newPage();
    const state: GuidedRunState = {
      runId,
      sessionId,
      traceId,
      expectedGraphVersionId: input.expectedGraphVersionId,
      mode: observationOnly ? 'OBSERVATION_ONLY' : 'GUIDED',
      status: 'RUNNING',
      targetUrl: input.targetUrl,
      evidence: [],
      observations: [],
      observedTransitions: [],
      findings: [],
      artifactDirectory,
      startedAt: new Date().toISOString(),
      endedAt: null,
    };
    const addEvidence = (evidence: Omit<LiveEvidence, 'id' | 'timestamp'>) => {
      state.evidence.push({ id: uuid(), timestamp: new Date().toISOString(), ...evidence });
      if (state.evidence.length > 500) state.evidence.shift();
    };
    const captureObservation = async () => {
      if (page.isClosed()) return;
      const url = page.url();
      if (!/^https?:\/\//.test(url)) return;
      const title = await page.title().catch(() => '');
      const derived = deriveBrowserState(url, title);
      const previous = state.observations[state.observations.length - 1];
      if (previous?.stateName === derived.stateName) return;
      const observation: BrowserObservation = {
        eventId: uuid(),
        ...derived,
        url,
        title: title.slice(0, 200),
        timestamp: new Date().toISOString(),
      };
      state.observations.push(observation);
      void this.options.onObservation?.(runId, observation);
      if (previous) {
        state.observedTransitions.push({
          fromEventId: previous.eventId,
          toEventId: observation.eventId,
          fromState: previous.stateName,
          toState: observation.stateName,
          action: previous.url === observation.url ? 'UI_CHANGE' : 'NAVIGATE',
          timestamp: observation.timestamp,
        });
      }
      addEvidence({ kind: 'PAGE', level: 'INFO', message: `Observed state ${observation.stateName}` });
    };
    page.on('console', (message) => {
      const type = message.type();
      const level = type === 'error' ? 'ERROR' : type === 'warning' ? 'WARN' : 'INFO';
      addEvidence({ kind: 'CONSOLE', level, message: message.text() });
      if (level === 'ERROR') {
        state.findings.push({
          id: uuid(),
          runId,
          category: 'BROWSER_CONSOLE_ERROR',
          severity: 'MEDIUM',
          confidence: 0.95,
          title: 'Browser console error',
          description: message.text(),
          url: page.url() || null,
          viewport: page.viewportSize(),
          evidenceArtifactIds: [],
          reproductionSteps: ['Open the captured page', 'Review the console during the guided run'],
          recommendation: 'Investigate the client runtime error and rerun the affected flow.',
        });
      }
    });
    page.on('requestfailed', (request) => {
      const description = `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`;
      addEvidence({ kind: 'NETWORK', level: 'ERROR', message: description });
      state.findings.push({
        id: uuid(),
        runId,
        category: 'NETWORK_REQUEST_FAILED',
        severity: 'HIGH',
        confidence: 0.98,
        title: 'Network request failed',
        description,
        url: page.url() || null,
        viewport: page.viewportSize(),
        evidenceArtifactIds: [],
        reproductionSteps: ['Open the captured page', `Trigger ${request.method()} ${request.url()}`],
        recommendation: 'Check service availability, CORS, authentication, and request construction.',
      });
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        addEvidence({
          kind: 'NETWORK',
          level: response.status() >= 500 ? 'ERROR' : 'WARN',
          message: `${response.status()} ${response.request().method()} ${response.url()}`,
        });
      }
    });
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        addEvidence({ kind: 'PAGE', level: 'INFO', message: `Navigated to ${frame.url()}` });
        void captureObservation();
      }
    });
    const observationTimer = setInterval(() => void captureObservation(), 1_500);
    this.active = { state, browser, context, page, observationTimer, stopping: false };
    page.on('crash', () => {
      if (!this.active || this.active.stopping) return;
      state.status = 'FAILED';
      state.endedAt = new Date().toISOString();
      addEvidence({ kind: 'PAGE', level: 'ERROR', message: 'Managed browser page crashed' });
      void this.handleUnexpectedTermination();
    });
    browser.on('disconnected', () => {
      if (!this.active || this.active.stopping) return;
      state.status = 'FAILED';
      state.endedAt = new Date().toISOString();
      addEvidence({ kind: 'PAGE', level: 'ERROR', message: 'Managed browser disconnected unexpectedly' });
      void this.handleUnexpectedTermination();
    });
    try {
      await page.goto(input.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await captureObservation();
      addEvidence({ kind: 'PAGE', level: 'INFO', message: `Guided run started at ${input.targetUrl}` });
      return this.snapshot();
    } catch (error) {
      state.status = 'FAILED';
      state.endedAt = new Date().toISOString();
      addEvidence({ kind: 'PAGE', level: 'ERROR', message: error instanceof Error ? error.message : 'Navigation failed' });
      await this.stopAndPersist();
      throw error;
    }
  }

  async pause(): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    this.active.state.status = this.active.state.status === 'PAUSED' ? 'RUNNING' : 'PAUSED';
    return this.snapshot();
  }

  async end(): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    this.active.state.status = 'COMPLETED';
    this.active.state.endedAt = new Date().toISOString();
    return this.stopAndPersist();
  }

  async abort(reason = 'Guided run interrupted'): Promise<GuidedRunState> {
    if (!this.active) throw new Error('NO_ACTIVE_RUN');
    this.active.state.status = 'FAILED';
    this.active.state.endedAt = new Date().toISOString();
    this.active.state.evidence.push({
      id: uuid(),
      kind: 'PAGE',
      level: 'ERROR',
      message: reason.slice(0, 1_000),
      timestamp: new Date().toISOString(),
    });
    return this.stopAndPersist();
  }

  getState(): GuidedRunState | null {
    return this.active ? this.snapshot() : null;
  }

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
    clearInterval(observationTimer);
    const screenshot = path.join(state.artifactDirectory, 'final.png');
    const trace = path.join(state.artifactDirectory, 'trace.zip');
    const accessibility = path.join(state.artifactDirectory, 'accessibility.txt');
    const manifest = path.join(state.artifactDirectory, 'manifest.json');
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
    const aria = await page.locator('body').ariaSnapshot().catch(() => 'Accessibility snapshot unavailable');
    fs.writeFileSync(accessibility, aria, 'utf8');
    await context.tracing.stop({ path: trace }).catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    const artifactFiles = [screenshot, trace, accessibility].filter((file) => fs.existsSync(file));
    fs.writeFileSync(manifest, JSON.stringify({
      ...state,
      artifacts: artifactFiles.map((file) => ({
        name: path.basename(file),
        bytes: fs.statSync(file).size,
        checksum: checksum(file),
      })),
    }, null, 2));
    const result = JSON.parse(JSON.stringify(state)) as GuidedRunState;
    this.active = null;
    return result;
  }
}
