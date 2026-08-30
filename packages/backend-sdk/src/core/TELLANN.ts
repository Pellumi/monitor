import { trackApiEvent, TrackApiOptions } from './trackApi';
import { captureErrorEvent, CaptureErrorOptions } from './captureError';
import { trackStateEvent, TrackStateOptions } from './trackState';
import { BackendWorkflowTracker } from './workflowTracker';
import { v4 as uuidv4 } from 'uuid';
import type { EventType, TellannEvent } from '../event-types';

export interface TellannBackendConfig {
  endpoint: string;
  tenantId?: string;
  applicationId: string;
  apiKey?: string;
  environmentId?: string;
  runId?: string;
  sessionId?: string;
  traceId?: string;
  agentVersion?: string;
  instrumentationManifestVersion?: string;
}

export class TELLANNBackend {
  private config: TellannBackendConfig | null = null;
  private workflowTracker = new BackendWorkflowTracker();

  initialize(config: TellannBackendConfig) {
    this.config = config;
    console.log('[Tellann Backend] Initialized');
  }

  getConfig(): TellannBackendConfig | null {
    return this.config;
  }

  isInitialized(): boolean {
    return this.config !== null;
  }

  async trackApi(options: TrackApiOptions): Promise<void> {
    if (!this.config) return;
    await trackApiEvent(this.config, options);
  }

  async captureError(options: CaptureErrorOptions): Promise<void> {
    if (!this.config) return;
    await captureErrorEvent(this.config, options);
  }

  async trackState(options: TrackStateOptions): Promise<void> {
    if (!this.config) return;
    await trackStateEvent(this.config, options);
  }

  async trackEvent(
    eventType: EventType,
    metadata: Record<string, any> = {},
    sessionId?: string
  ): Promise<void> {
    await this.sendEvent(eventType, sessionId, metadata);
  }

  async verifyInstallation(sessionId?: string): Promise<void> {
    await this.trackEvent('TELLANN_INITIALIZED', {
      source: 'manual_verification',
      verificationKind: 'BOOTSTRAP_INITIALIZED',
    }, sessionId);
  }

  startWorkflow(workflowName: string, sessionId?: string): string {
    const id = this.workflowTracker.start(workflowName);
    this.sendEvent('WORKFLOW_STARTED', sessionId, {
      workflowId: id,
      workflowName,
    });
    return id;
  }

  async completeWorkflow(workflowId: string, sessionId?: string): Promise<void> {
    const result = this.workflowTracker.complete(workflowId);
    if (result) {
      await this.sendEvent('WORKFLOW_COMPLETED', sessionId, {
        workflowId,
        workflowName: result.name,
        durationMs: result.durationMs,
      });
    }
  }

  async failWorkflow(workflowId: string, reason?: string, sessionId?: string): Promise<void> {
    const result = this.workflowTracker.fail(workflowId);
    if (result) {
      await this.sendEvent('WORKFLOW_FAILED', sessionId, {
        workflowId,
        workflowName: result.name,
        durationMs: result.durationMs,
        reason: reason || 'Unknown error',
      });
    }
  }

  abandonWorkflow(workflowId: string): void {
    this.workflowTracker.abandon(workflowId);
  }

  async cancelWorkflow(workflowId: string, reason?: string, sessionId?: string): Promise<void> {
    const result = this.workflowTracker.fail(workflowId);
    if (result) {
      await this.sendEvent('WORKFLOW_CANCELLED', sessionId, {
        workflowId,
        workflowName: result.name,
        durationMs: result.durationMs,
        reason: reason ?? 'Cancelled',
      });
    }
  }

  async captureMessage(message: string, severity?: string, sessionId?: string): Promise<void> {
    await this.sendEvent('SERVER_ERROR', sessionId, {
      message,
      severity: severity || 'error',
    });
  }

  private async sendEvent(
    eventType: string,
    sessionId: string | undefined,
    metadata: Record<string, any>
  ): Promise<void> {
    if (!this.config) return;
    const event: TellannEvent = {
      eventId: uuidv4(),
      sessionId: sessionId ?? this.config.sessionId ?? uuidv4(),
      tenantId: this.config.tenantId ?? 'unknown',
      applicationId: this.config.applicationId,
      environmentId: this.config.environmentId ?? null,
      runId: this.config.runId ?? null,
      traceId: this.config.traceId ?? null,
      agentVersion: this.config.agentVersion ?? null,
      instrumentationManifestVersion: this.config.instrumentationManifestVersion ?? null,
      source: 'backend-sdk',
      eventVersion: '1.0',
      eventType: eventType as any,
      timestamp: new Date().toISOString(),
      metadata,
    };

    // Enforce size limit
    try {
      const eventJson = JSON.stringify(event);
      const eventSize = Buffer.byteLength(eventJson, 'utf8');
      if (eventSize > 32 * 1024) {
        console.error(
          `[Tellann Backend] Event of type "${eventType}" discarded. Size (${eventSize} bytes) exceeds limit of 32 KB.`
        );
        return;
      }
    } catch {
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.apiKey) {
        headers.Authorization = `Bearer ${this.config.apiKey}`;
      }
      if (this.config.environmentId) {
        headers['x-tellann-environment-id'] = this.config.environmentId;
      }
      if (this.config.runId) headers['x-tellann-run-id'] = this.config.runId;
      if (sessionId ?? this.config.sessionId) headers['x-tellann-session-id'] = sessionId ?? this.config.sessionId!;
      if (this.config.traceId) headers['x-tellann-trace-id'] = this.config.traceId;

      await fetch(`${this.config.endpoint}/v1/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
      });
    } catch {
      // Swallowed
    }
  }

  // Allow teardown to clean up intervals/tracker memory
  teardown() {
    this.workflowTracker.destroy();
    this.config = null;
  }
}

export const TELLANN = new TELLANNBackend();
export { BackendWorkflowTracker };
