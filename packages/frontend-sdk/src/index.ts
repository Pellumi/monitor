import { v4 as uuidv4 } from 'uuid';
import { EventType, SotsEvent } from '@sots/shared';
import { WorkflowTracker } from './workflow-tracker';
import { setupAutoTrack, sanitizeMetadata } from './auto-track';

export interface SotsConfig {
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
}

const MAX_EVENT_SIZE_BYTES = 32 * 1024; // 32 KB limit for standard events
const MAX_REPLAY_SIZE_BYTES = 128 * 1024; // 128 KB limit for replay events (e.g. if eventType is a replay event)

class SotsFrontendSDK {
  private config: SotsConfig | null = null;
  private sessionId: string | null = null;
  private eventBuffer: SotsEvent[] = [];
  private flushInterval: number | null = null;
  private workflowTracker = new WorkflowTracker();
  private teardownAutoTrack: (() => void) | null = null;

  initialize(config: SotsConfig) {
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
      console.log('[SOTS] Initialized and auto-tracking started', this.config);
    }
  }

  startSession() {
    this.sessionId = uuidv4();
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
        console.warn('[SOTS] SDK not initialized or session not started');
      }
      return;
    }

    // Apply privacy-by-default metadata sanitization
    const sanitizedMetadata = sanitizeMetadata(metadata);

    const event: SotsEvent = {
      eventId: uuidv4(),
      sessionId: this.sessionId,
      tenantId: this.config.tenantId ?? 'unknown',
      applicationId: this.config.applicationId,
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
          `[SOTS] Event of type "${eventType}" discarded. Size (${eventSize} bytes) exceeds limit of ${limit} bytes.`
        );
        return;
      }
    } catch (err) {
      console.error('[SOTS] Failed to compute size of event, discarding', err);
      return;
    }

    this.eventBuffer.push(event);

    // If max buffer size reached, flush immediately
    const maxBuffer = this.config.maxBufferSize ?? 200;
    if (this.eventBuffer.length >= maxBuffer) {
      this.flush();
    }
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
          `[SOTS] Batch payload size of ${payloadSize} bytes exceeds the 5 MB limit. Dropping batch.`
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
        headers['x-sots-environment-id'] = this.config.environmentId;
      }

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
        console.error('[SOTS] Failed to flush events', error);
      }
      // Re-add to buffer on failure
      this.eventBuffer = [...eventsToSend, ...this.eventBuffer];
    }
  }
}

export const SOTS = new SotsFrontendSDK();
export { SotsFrontendSDK };
