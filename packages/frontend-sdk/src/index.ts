import { v4 as uuidv4 } from 'uuid';
import type { EventType, TellannEvent } from './event-types';
export type { EventType, TellannEvent } from './event-types';
import { WorkflowTracker } from './workflow-tracker.js';
import { setupAutoTrack, sanitizeMetadata } from './auto-track.js';
import { setupNetworkTracking } from './network-track.js';
import { captureClientContext } from './client-context.js';
import {
  clearStoredSession,
  rememberIdentity,
  resolveAnonymousId,
  resolveSession,
  touchSession,
} from './session-store.js';
import type { ClientContext } from './event-types.js';

const CLIENT_STATE_SECRET_KEY = /password|passwd|passcode|secret|token|authorization|cookie|session|auth|private.?key|cvv|cvc|card/i;

/** Shape-only description; always safe to send regardless of environment. */
function describeClientStateValue(value: unknown) {
  return {
    type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
    length: typeof value === 'string' || Array.isArray(value) ? value.length : null,
    populated: value !== null && value !== undefined && value !== '',
  };
}

/**
 * True only while a desktop QA run credential is present on the page. Outside a
 * run — and in any observation-only run — client state values never leave the
 * page at all.
 */
function qaRunActive(): boolean {
  const run = (globalThis as Record<string, any>).__TELLANN_RUN__;
  return Boolean(run && run.runId && run.relayToken);
}

/**
 * The local relay the desktop observer injected for this run, if any.
 *
 * While a guided run is active every event has to travel through the relay:
 * only the relay attaches the run-ingestion credential, and the collector
 * advances the Flow boundary solely for credentialed events. A
 * `FLOW_INITIAL_STATE` flushed straight to the configured gateway is ingested
 * as ordinary telemetry, so the run would sit at "Waiting for
 * FLOW_INITIAL_STATE" no matter how many times the page emits it.
 */
function activeRunRelay(): { endpoint: string; token: string } | null {
  const run = (globalThis as Record<string, any>).__TELLANN_RUN__;
  if (!run || typeof run.runId !== 'string' || typeof run.relayToken !== 'string') return null;
  const endpoint = typeof run.relayEndpoint === 'string' ? run.relayEndpoint.replace(/\/$/, '') : '';
  return endpoint ? { endpoint, token: run.relayToken } : null;
}

function serializeCandidate(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value.slice(0, 16_384);
  try { return JSON.stringify(value)?.slice(0, 16_384); } catch { return undefined; }
}

/**
 * Attaches candidate protected values for the QA pipeline. These are proposals,
 * not decisions: the browser observer re-derives a classification and the
 * ingestion API applies the authoritative server-side floor before persisting.
 * Anything whose key looks like a secret is dropped here as well, so a secret
 * never leaves the page even as a candidate.
 */
function qaCandidateValues(key: string, previous: unknown, next: unknown) {
  if (!qaRunActive() || CLIENT_STATE_SECRET_KEY.test(String(key))) return {};
  const previousValue = serializeCandidate(previous);
  const nextValue = serializeCandidate(next);
  if (previousValue === undefined && nextValue === undefined) return {};
  return {
    qaProtectedCandidates: [
      ...(previousValue === undefined ? [] : [{ keyPath: `clientState.${key}.previousValue`, value: previousValue }]),
      ...(nextValue === undefined ? [] : [{ keyPath: `clientState.${key}.newValue`, value: nextValue }]),
    ],
  };
}

function safeState(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Top-level slice keys whose reference actually changed. */
function changedSlicePaths(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => before[key] !== after[key]);
}

function pickPaths(source: Record<string, unknown>, paths: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const path of paths.slice(0, 50)) result[path] = source[path];
  return result;
}

export interface TellannConfig {
  endpoint: string;
  tenantId?: string;
  applicationId: string;
  apiKey?: string;
  environmentId?: string;
  autoTrackClicks?: boolean;
  autoTrackForms?: boolean;
  autoTrackRoutes?: boolean;
  errorTracking?: boolean;
  debug?: boolean;
  flushIntervalMs?: number;
  maxBufferSize?: number;
  runId?: string;
  sessionId?: string;
  traceId?: string;
  agentVersion?: string;
  instrumentationManifestVersion?: string;
  /**
   * The build of the customer's application. Makes "did this start with the
   * Tuesday deploy?" answerable, which nothing in the product could ask before.
   */
  releaseVersion?: string;
  /**
   * Fraction of sessions to capture, 0..1. Decided once per session, never per
   * event: an event-sampled session is uninterpretable as a funnel.
   */
  sampleRate?: number;
  /** Capture the application's own fetch/XHR calls. Default true. */
  autoTrackNetwork?: boolean;
  /**
   * Extra origins that count as the application -- an API on another subdomain.
   * Same-origin is always included; anything else is left alone, because the
   * session id is ours to know and not a third party's.
   */
  networkOrigins?: string[];
}

const MAX_EVENT_SIZE_BYTES = 32 * 1024; // 32 KB limit for standard events
const MAX_REPLAY_SIZE_BYTES = 128 * 1024; // 128 KB limit for replay events (e.g. if eventType is a replay event)

class TellannFrontendSDK {
  private config: TellannConfig | null = null;
  private sessionId: string | null = null;
  private eventBuffer: TellannEvent[] = [];
  private flushInterval: number | null = null;
  private workflowTracker = new WorkflowTracker();
  private teardownAutoTrack: (() => void) | null = null;
  private teardownNetworkTrack: (() => void) | null = null;
  private teardownLifecycle: (() => void) | null = null;

  /** Stable per-browser id. Null when localStorage is unusable. */
  private anonymousId: string | null = null;
  /** The identity in force, carried in the envelope rather than in metadata. */
  private endUserExternalId: string | null = null;
  private endUserTraits: Record<string, any> | null = null;
  private clientContext: ClientContext = {};
  /** Whether this session was selected for capture, and with what probability. */
  private sampled = true;
  private sampleRate = 1;

  initialize(config: TellannConfig) {
    this.config = {
      autoTrackClicks: true,
      autoTrackForms: true,
      autoTrackRoutes: true,
      errorTracking: true,
      debug: false,
      flushIntervalMs: 5000,
      maxBufferSize: 200,
      autoTrackNetwork: true,
      sampleRate: 1,
      ...config
    };

    this.anonymousId = resolveAnonymousId(uuidv4);
    this.clientContext = captureClientContext(this.config.releaseVersion ?? null);
    this.resolveSampling();
    this.startSession();
    this.startFlushInterval();

    // Set up auto-tracking
    this.teardownAutoTrack = setupAutoTrack(this, {
      autoTrackClicks: this.config.autoTrackClicks,
      autoTrackForms: this.config.autoTrackForms,
      autoTrackRoutes: this.config.autoTrackRoutes,
      errorTracking: this.config.errorTracking
    });

    // Nothing patched fetch or XHR before, so API_REQUEST only existed where the
    // customer had also installed the backend SDK -- and the correlation header that
    // SDK reads was never sent, so the join both halves were built for never
    // happened by default.
    if (this.config.autoTrackNetwork !== false) {
      this.teardownNetworkTrack = setupNetworkTracking({
        endpoint: this.config.endpoint,
        allowedOrigins: this.config.networkOrigins,
        track: (eventType, metadata) => this.trackEvent(eventType, metadata),
        sessionId: () => this.sessionId,
      });
    }

    this.installLifecycleHandlers();

    if (this.config.debug) {
      console.log('[Tellann] Initialized and auto-tracking started', this.config);
    }
  }

  /**
   * Decides once, per session, whether this session is captured.
   *
   * Per-session and not per-event: a session whose events were sampled individually
   * cannot be read as a funnel, because the gaps are indistinguishable from steps the
   * user never took.
   */
  private resolveSampling(): void {
    const rate = Math.min(1, Math.max(0, this.config?.sampleRate ?? 1));
    this.sampleRate = rate;
    this.sampled = rate >= 1 ? true : Math.random() < rate;
  }

  /**
   * Starts or resumes the session for this page load.
   *
   * Previously this minted a fresh uuid every time with nothing persisted, so every
   * page load was a new session: one journey through a multi-page app became a dozen
   * disconnected four-event sessions, each closed by the server idle timeout mid-task.
   */
  startSession() {
    const resolution = resolveSession({
      newId: uuidv4,
      pinnedId: this.config?.sessionId ?? null,
      identity: this.endUserExternalId,
    });
    this.sessionId = resolution.sessionId;

    if (resolution.isNew) {
      this.trackEvent('SESSION_STARTED', {
        reason: resolution.reason,
        url: window.location.href,
        referrer: document.referrer,
      });
    }

    this.trackEvent('PAGE_VIEW', {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
    });
  }

  endSession() {
    if (this.sessionId) this.trackEvent('SESSION_ENDED', { reason: 'EXPLICIT' });
    clearStoredSession();
    this.sessionId = null;
    this.flush();
  }

  /**
   * Flushes on the events that actually precede a page going away.
   *
   * `beforeunload` is unreliable on mobile, where a backgrounded tab is often killed
   * without it. `pagehide` and a `visibilitychange` to hidden are the pair that do
   * fire -- and they are exactly when the last actions before a crash would otherwise
   * be lost from the buffer.
   */
  private installLifecycleHandlers(): void {
    const onHide = () => {
      touchSession();
      void this.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };

    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);

    this.teardownLifecycle = () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  teardown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    if (this.teardownAutoTrack) {
      this.teardownAutoTrack();
      this.teardownAutoTrack = null;
    }
    // Restoring the fetch/XHR patches matters more than the listeners: leaving them
    // installed after teardown would keep a reference to a torn-down SDK alive and
    // keep decorating the application's requests.
    if (this.teardownNetworkTrack) {
      this.teardownNetworkTrack();
      this.teardownNetworkTrack = null;
    }
    if (this.teardownLifecycle) {
      this.teardownLifecycle();
      this.teardownLifecycle = null;
    }
    this.endSession();
  }

  trackEvent(eventType: EventType, metadata: Record<string, any> = {}) {
    if (!this.config || !this.sessionId) {
      if (this.config?.debug) {
        console.warn('[Tellann] SDK not initialized or session not started');
      }
      return;
    }

    // Enforce the contract against the caller's payload before redaction. A
    // multi-kilobyte value must not become an apparently valid tiny event just
    // because the privacy layer replaced it with a marker.
    try {
      const rawPayload = JSON.stringify({ eventType, metadata });
      const rawSize = typeof Blob !== 'undefined' ? new Blob([rawPayload]).size : rawPayload.length;
      const rawLimit = eventType.includes('REPLAY') ? MAX_REPLAY_SIZE_BYTES : MAX_EVENT_SIZE_BYTES;
      if (rawSize > rawLimit) {
        console.error(`[Tellann] Event of type "${eventType}" discarded. Size (${rawSize} bytes) exceeds limit of ${rawLimit} bytes.`);
        return;
      }
    } catch (err) {
      console.error('[Tellann] Failed to compute size of event, discarding', err);
      return;
    }

    // Apply privacy-by-default metadata sanitization
    const sanitizedMetadata = sanitizeMetadata(metadata);

    const event: TellannEvent = {
      eventId: uuidv4(),
      sessionId: this.sessionId,
      tenantId: this.config.tenantId ?? 'unknown',
      applicationId: this.config.applicationId,
      environmentId: this.config.environmentId ?? null,
      runId: this.config.runId ?? null,
      traceId: this.config.traceId ?? null,
      agentVersion: this.config.agentVersion ?? null,
      instrumentationManifestVersion: this.config.instrumentationManifestVersion ?? null,
      source: 'frontend-sdk',
      eventVersion: '1.1',
      eventType,
      timestamp: new Date().toISOString(),
      metadata: sanitizedMetadata,

      // Envelope, not metadata -- which is the whole point. sanitizeMetadata never
      // sees these, so identity survives; and because it never sees them, the
      // server-side privacy floor is what governs them.
      anonymousId: this.anonymousId,
      endUserExternalId: this.endUserExternalId,
      endUserTraits: this.endUserTraits,
      // Repeated on every event rather than sent once: a scheme that relied on the
      // first event surviving fails the moment a page load produces two batches and
      // the first is rejected. ~220 bytes against a 32 KB limit.
      context: this.clientContext,
      sampled: this.sampled,
      sampleRate: this.sampleRate,
    };

    // Payload Size Enforcement
    try {
      const eventJson = JSON.stringify(event);
      const eventSize = typeof Blob !== 'undefined' 
        ? new Blob([eventJson]).size 
        : eventJson.length;

      const limit = eventType.includes('REPLAY') ? MAX_REPLAY_SIZE_BYTES : MAX_EVENT_SIZE_BYTES;
      if (eventSize > limit) {
        console.error(
          `[Tellann] Event of type "${eventType}" discarded. Size (${eventSize} bytes) exceeds limit of ${limit} bytes.`
        );
        return;
      }
    } catch (err) {
      console.error('[Tellann] Failed to compute size of event, discarding', err);
      return;
    }

    // A session that was not selected for capture produces nothing at all. Checked
    // here rather than at flush time so an unsampled session costs no memory either.
    if (!this.sampled) return;

    this.eventBuffer.push(event);

    // If max buffer size reached, flush immediately
    const maxBuffer = this.config.maxBufferSize ?? 200;
    if (this.eventBuffer.length >= maxBuffer) {
      this.flush();
    }
  }

  async verifyInstallation(): Promise<void> {
    this.trackEvent('TELLANN_INITIALIZED', {
      source: 'manual_verification',
      verificationKind: 'BOOTSTRAP_INITIALIZED',
      instrumentationManifestVersion: this.config?.instrumentationManifestVersion ?? null,
      agentVersion: this.config?.agentVersion ?? null,
    });
    await this.flush();
  }

  trackBusinessEvent(config: { type: string, payload?: Record<string, any> }) {
    this.trackEvent('BUSINESS_EVENT', {
      businessEventType: config.type,
      ...(config.payload || {})
    });
  }

  // Missing Frontend SDK methods
  trackState(stateName: string, category?: string) {
    this.trackEvent('STATE_ENTERED', {
      stateName,
      category: category || 'BUSINESS',
    });
  }

  trackTransition(fromState: string, toState: string, action?: string) {
    this.trackEvent('STATE_TRANSITION', {
      fromState,
      toState,
      action: action || 'NAVIGATE',
    });
  }

  trackFlowInitialState(flowVersionId: string, stateKey: string) {
    this.trackEvent('FLOW_INITIAL_STATE', { flowVersionId, stateKey });
  }

  trackFlowStateReached(flowVersionId: string, stateKey: string) {
    this.trackEvent('FLOW_STATE_REACHED', { flowVersionId, stateKey });
  }

  trackFlowTransition(
    flowVersionId: string,
    fromStateKey: string,
    toStateKey: string,
    action: string,
  ) {
    this.trackEvent('FLOW_TRANSITION', { flowVersionId, stateKey: toStateKey, fromStateKey, toStateKey, action });
  }

  trackFlowTerminalState(flowVersionId: string, stateKey: string) {
    this.trackEvent('FLOW_TERMINAL_STATE', { flowVersionId, stateKey });
  }

  /**
   * Explicit adapter for Zustand, MobX, custom Context, and other stores.
   *
   * Shape metadata (type, length, populated) always travels. Actual values are
   * only attached while a QA run credential is present on the page and the run
   * is not observation-only, and even then they are carried as *candidate*
   * protected values: the browser observer and the ingestion API both classify
   * and encrypt them before anything is persisted. Nothing raw is ever written
   * to the generic telemetry wire.
   */
  trackClientState(store: string, key: string, previous: unknown, next: unknown) {
    this.trackEvent('BUSINESS_EVENT', {
      businessEventType: 'QA_CLIENT_STATE_MUTATION',
      store: String(store).slice(0, 100),
      key: String(key).slice(0, 200),
      previous: describeClientStateValue(previous),
      next: describeClientStateValue(next),
      ...qaCandidateValues(key, previous, next),
    });
  }

  /**
   * Redux middleware. Records the action type, which top-level slice paths
   * actually changed, and protected before/after values for those slices.
   *
   *   const store = configureStore({
   *     reducer,
   *     middleware: (get) => get().concat(TELLANN.createReduxMiddleware()),
   *   });
   */
  createReduxMiddleware() {
    const sdk = this;
    return (store: { getState(): unknown }) =>
      (next: (action: unknown) => unknown) =>
        (action: unknown) => {
          const before = safeState(store.getState());
          const result = next(action);
          const after = safeState(store.getState());
          const type = String((action as { type?: unknown } | null)?.type ?? 'UNKNOWN_ACTION');
          const changed = changedSlicePaths(before, after);
          if (changed.length) {
            sdk.trackEvent('BUSINESS_EVENT', {
              businessEventType: 'QA_CLIENT_STATE_MUTATION',
              store: 'redux',
              key: type.slice(0, 200),
              actionType: type.slice(0, 200),
              changedSlicePaths: changed.slice(0, 50),
              previous: describeClientStateValue(before),
              next: describeClientStateValue(after),
              ...qaCandidateValues(
                type,
                pickPaths(before, changed),
                pickPaths(after, changed),
              ),
            });
          }
          return result;
        };
  }

  /**
   * React Context adapter. Only providers explicitly identified and approved in
   * the validated Flow instrumentation manifest should call this — there is no
   * blanket interception of React internals, because that cannot be done
   * reliably and would misreport what was actually captured.
   *
   *   useEffect(() => TELLANN.trackContextValue('AuthContext', 'user', value), [value]);
   */
  trackContextValue(providerName: string, key: string, value: unknown) {
    this.trackClientState(`context:${providerName}`, key, undefined, value);
  }

  /**
   * Wraps an approved `useState` setter so Flow-relevant state changes are
   * recorded. Intended to be applied to the specific setters identified during
   * static analysis, not to every setter in the application.
   *
   *   const [email, setEmail] = useState('');
   *   const setTracked = TELLANN.trackStateSetter('CheckoutForm', 'email', setEmail, email);
   */
  trackStateSetter<T>(
    componentName: string,
    key: string,
    setter: (value: T) => void,
    current?: T,
  ): (value: T) => void {
    let previous = current;
    return (value: T) => {
      const resolved = typeof value === 'function'
        ? (value as unknown as (prior: T | undefined) => T)(previous)
        : value;
      this.trackClientState(`useState:${componentName}`, key, previous, resolved);
      previous = resolved;
      setter(resolved);
    };
  }

  startWorkflow(workflowName: string): string {
    const id = this.workflowTracker.start(workflowName);
    this.trackEvent('WORKFLOW_STARTED', {
      workflowId: id,
      workflowName,
    });
    return id;
  }

  completeWorkflow(workflowId: string) {
    const result = this.workflowTracker.complete(workflowId);
    if (result) {
      this.trackEvent('WORKFLOW_COMPLETED', {
        workflowId,
        workflowName: result.name,
        durationMs: result.durationMs,
      });
    }
  }

  failWorkflow(workflowId: string, reason?: string) {
    const result = this.workflowTracker.fail(workflowId);
    if (result) {
      this.trackEvent('WORKFLOW_FAILED', {
        workflowId,
        workflowName: result.name,
        durationMs: result.durationMs,
        reason: reason || 'Unknown error',
      });
    }
  }

  abandonWorkflow(workflowId: string) {
    this.workflowTracker.abandon(workflowId);
  }

  cancelWorkflow(workflowId: string, reason?: string) {
    const result = this.workflowTracker.fail(workflowId);
    if (result) {
      this.trackEvent('WORKFLOW_CANCELLED', {
        workflowId,
        workflowName: result.name,
        durationMs: result.durationMs,
        reason: reason ?? 'Cancelled',
      });
    }
  }

  captureException(error: Error | unknown, context?: Record<string, any>) {
    const err = error instanceof Error ? error : new Error(String(error));
    this.trackEvent('ERROR_OCCURRED', {
      message: err.message,
      stack: err.stack || null,
      name: err.name,
      context: context || {},
    });
  }

  captureMessage(message: string, severity: 'info' | 'warning' | 'error' = 'error') {
    this.trackEvent('CLIENT_ERROR', {
      message,
      severity,
    });
  }

  /**
   * Associates this session with one of the application's own users.
   *
   * This used to write `{ businessEventType: 'USER_IDENTIFIED', userId }` into a
   * BUSINESS_EVENT's metadata -- where `sanitizeMetadata`'s identifier rule matched
   * `'userId'.toLowerCase() === 'userid'` and replaced it with the literal string
   * `'[PSEUDONYMIZED BY QA INGESTION]'`. Identity was destroyed in the page, before
   * it was ever sent, for as long as the method existed.
   *
   * The fix is layering, not a weaker rule: that rule protects customers who put
   * identifiers into arbitrary business-event payloads and stays exactly as it was.
   * Identity is envelope data, which the sanitizer does not touch -- and therefore
   * the server-side privacy floor is what decides whether it is stored raw, hashed,
   * or not at all.
   */
  identifyUser(externalId: string, traits?: Record<string, any>) {
    const next = String(externalId).slice(0, 256);
    const changed = this.endUserExternalId !== null && this.endUserExternalId !== next;

    this.endUserExternalId = next;
    this.endUserTraits = traits ?? null;

    // A different person on the same browser is a different visit. Blending them
    // would attribute one person's behaviour to another, which is worse than an
    // extra session.
    if (changed) {
      this.trackEvent('SESSION_ENDED', { reason: 'IDENTITY_CHANGED' });
      void this.flush();
      clearStoredSession();
      this.startSession();
    }

    rememberIdentity(next);
    this.trackEvent('USER_IDENTIFIED', {});
  }

  /** Forgets the identity, leaving the browser anonymous again. */
  resetIdentity() {
    this.endUserExternalId = null;
    this.endUserTraits = null;
    rememberIdentity(null);
    this.trackEvent('SESSION_ENDED', { reason: 'IDENTITY_RESET' });
    void this.flush();
    clearStoredSession();
    this.startSession();
  }

  private startFlushInterval() {
    const intervalMs = this.config?.flushIntervalMs || 5000;
    this.flushInterval = window.setInterval(() => {
      this.flush();
    }, intervalMs);
  }

  private async flush() {
    if (this.eventBuffer.length === 0 || !this.config) return;

    const eventsToSend = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      const payload = JSON.stringify(eventsToSend);
      // Enforce 5 MB batch limit
      const payloadSize = typeof Blob !== 'undefined' 
        ? new Blob([payload]).size 
        : payload.length;

      if (payloadSize > 5 * 1024 * 1024) {
        console.error(
          `[Tellann] Batch payload size of ${payloadSize} bytes exceeds the 5 MB limit. Dropping batch.`
        );
        return;
      }

      const relay = activeRunRelay();
      const target = relay ? relay.endpoint : this.config.endpoint;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (relay) {
        headers.Authorization = `Bearer ${relay.token}`;
      } else if (this.config.apiKey) {
        headers.Authorization = `Bearer ${this.config.apiKey}`;
      }
      // The relay re-derives the environment from the run correlation, and its
      // CORS allow-list does not carry this header — sending it would fail the
      // preflight and lose the batch.
      if (!relay && this.config.environmentId) {
        headers['x-tellann-environment-id'] = this.config.environmentId;
      }
      if (this.config.runId) headers['x-tellann-run-id'] = this.config.runId;
      if (this.sessionId) headers['x-tellann-session-id'] = this.sessionId;
      if (this.config.traceId) headers['x-tellann-trace-id'] = this.config.traceId;

      // sendBeacon cannot set auth headers, so only use it for unauthenticated direct collector targets.
      if (!relay && !this.config.apiKey && !this.config.environmentId && navigator.sendBeacon && typeof Blob !== 'undefined') {
        const blob = new Blob([payload], { type: 'application/json' });
        const success = navigator.sendBeacon(`${target}/v1/events/batch`, blob);
        if (!success) {
          throw new Error('sendBeacon returned false');
        }
      } else {
        // Fallback to fetch
        const response = await fetch(`${target}/v1/events/batch`, {
          method: 'POST',
          headers,
          body: payload,
          keepalive: true, // Use keepalive for page unloads if beacon is unavailable
        });

        // `fetch` only rejects on a network failure, so a rejected batch used to
        // land here as a success: the catch below never ran, the events were
        // never re-buffered, and nothing was logged outside debug mode. A
        // collector that answered 400 — which is what an unrecognised envelope
        // field or one malformed event in two hundred produces — silently lost
        // the whole batch.
        //
        // A 4xx will not pass on a retry, so re-sending is pointless; say so
        // loudly instead. A 5xx or a 429 is transient, so it goes back in the
        // buffer for the next flush.
        if (!response.ok) {
          if (response.status >= 500 || response.status === 429) {
            throw new Error(`Collector responded ${response.status}`);
          }
          console.error(
            `[Tellann] Collector rejected ${eventsToSend.length} event(s) with `
            + `${response.status}. The batch was dropped; it would not succeed on a retry.`,
          );
          return;
        }
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('[Tellann] Failed to flush events', error);
      }
      // Re-add to buffer on failure
      this.eventBuffer = [...eventsToSend, ...this.eventBuffer];
    }
  }
}

export const TELLANN = new TellannFrontendSDK();
export { TellannFrontendSDK };
