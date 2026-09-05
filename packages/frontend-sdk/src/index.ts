import { v4 as uuidv4 } from 'uuid';
import type { EventType, TellannEvent } from './event-types';
export type { EventType, TellannEvent } from './event-types';
import { WorkflowTracker } from './workflow-tracker.js';
import { setupAutoTrack, sanitizeMetadata } from './auto-track.js';

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

  initialize(config: TellannConfig) {
    this.config = {
      autoTrackClicks: true,
      autoTrackForms: true,
      autoTrackRoutes: true,
      errorTracking: true,
      debug: false,
      flushIntervalMs: 5000,
      maxBufferSize: 200,
      ...config
    };

    this.startSession();
    this.startFlushInterval();

    // Set up auto-tracking
    this.teardownAutoTrack = setupAutoTrack(this, {
      autoTrackClicks: this.config.autoTrackClicks,
      autoTrackForms: this.config.autoTrackForms,
      autoTrackRoutes: this.config.autoTrackRoutes,
      errorTracking: this.config.errorTracking
    });

    if (this.config.debug) {
      console.log('[Tellann] Initialized and auto-tracking started', this.config);
    }
  }

  startSession() {
    this.sessionId = this.config?.sessionId ?? uuidv4();
    this.trackEvent('PAGE_VIEW', {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
    });
  }

  endSession() {
    this.sessionId = null;
    this.flush();
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
      eventVersion: '1.0',
      eventType,
      timestamp: new Date().toISOString(),
      metadata: sanitizedMetadata,
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

  identifyUser(userId: string, traits?: Record<string, any>) {
    this.trackEvent('BUSINESS_EVENT', {
      businessEventType: 'USER_IDENTIFIED',
      userId,
      traits: traits || {},
    });
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

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.config.apiKey) {
        headers.Authorization = `Bearer ${this.config.apiKey}`;
      }
      if (this.config.environmentId) {
        headers['x-tellann-environment-id'] = this.config.environmentId;
      }
      if (this.config.runId) headers['x-tellann-run-id'] = this.config.runId;
      if (this.sessionId) headers['x-tellann-session-id'] = this.sessionId;
      if (this.config.traceId) headers['x-tellann-trace-id'] = this.config.traceId;

      // sendBeacon cannot set auth headers, so only use it for unauthenticated direct collector targets.
      if (!this.config.apiKey && !this.config.environmentId && navigator.sendBeacon && typeof Blob !== 'undefined') {
        const blob = new Blob([payload], { type: 'application/json' });
        const success = navigator.sendBeacon(`${this.config.endpoint}/v1/events/batch`, blob);
        if (!success) {
          throw new Error('sendBeacon returned false');
        }
      } else {
        // Fallback to fetch
        await fetch(`${this.config.endpoint}/v1/events/batch`, {
          method: 'POST',
          headers,
          body: payload,
          keepalive: true, // Use keepalive for page unloads if beacon is unavailable
        });
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
