import { PageAutomationDriver } from "@tellann/browser-observer";
import type { BrowserObserver, GuidedRunState } from "@tellann/browser-observer";
import { describeStopReason } from "@tellann/desktop-contracts";
import type { AutomatedRunStatus, AutomationPhaseUpdate, AutomationStopReason, ContractSummary, QAEvidenceEvent, RunLifecycleEvent, StartGuidedRunInput } from "@tellann/desktop-contracts";
import type { LocalRunRelay } from "@tellann/local-relay";
import type { AutomatedRunHost, BrowserSession, FinishOutcome, OpenedRun } from "./automated-run-manager";

/**
 * The real host of an Automated Run: the cloud, the relay, the observer and the evidence spool, in the order the
 * guided path already uses them. Nothing here decides anything about the run; that is the manager's job. What lives
 * here is which call comes first, and what has to be cleaned up if one of them fails.
 *
 * It takes those collaborators as a bag rather than importing them, because they are `main.ts`'s own singletons,
 * and so the sequence can be read (and its cleanup checked) on its own.
 */

export interface AutomatedRunHostDeps {
  cloud: {
    createRun(input: Record<string, unknown>): Promise<Record<string, unknown>>;
    startRun(runId: string, sessionId: string, traceId: string): Promise<{ credential: { credential: string } }>;
    completeRun(state: GuidedRunState & { completionReason?: string; automationStopReason?: string }): Promise<unknown>;
    completeRunWithoutEvidence(input: { runId: string; sessionId: string; traceId: string; completionReason: string; automationStopReason: string }): Promise<unknown>;
    failRun(runId: string, reason: string): Promise<unknown>;
    reportAutomationPhase(runId: string, update: Record<string, unknown>): Promise<unknown>;
  };
  relay: Pick<LocalRunRelay, "start" | "emit" | "stop">;
  observer: BrowserObserver;
  artifactRoot(): string;
  agentVersion: string;
  collectorBaseUrl(): string;
  captureVersion: "1.0" | "2.0";
  selectedWorkspace(applicationId: string): { cloudId: string; snapshotId: string } | null;
  /** Handles what the application's instrumentation reports through the relay. */
  onRelayedEvents(events: Array<Record<string, unknown>>): Promise<void>;
  readRelayQueue(runId: string): unknown[];
  writeRelayQueue(runId: string, queue: unknown[]): void;
  setActiveRelay(connection: { runId: string; endpoint: string; relayToken: string } | null): void;
  evidence: {
    /** Loads any spooled events for the run and starts uploading. */
    open(runId: string): void;
    flush(runId: string, drain?: boolean): Promise<void>;
    persist(runId: string): void;
    forget(runId: string): void;
  };
  maintenance: { start(runId: string): void; stop(): void };
  backendStream: { start(runId: string): void; stop(): void };
  recovery: { write(runId: string, record: { state: GuidedRunState; completionReason: string; automationStopReason?: string }): void; delete(runId: string): void };
  lifecycle(state: GuidedRunState, input: Partial<RunLifecycleEvent>): void;
  afterBrowserOpened(state: GuidedRunState, start: StartGuidedRunInput): void;
  notify(note: { title: string; body: string }): void;
  publish(status: AutomatedRunStatus): void;
}

export interface CreatedAutomatedHost {
  host: AutomatedRunHost;
  /** The observer reported that the browser went away by itself. Its final state is what evidence is settled from. */
  browserTerminated(state: GuidedRunState): void;
}

export function createAutomatedRunHost(deps: AutomatedRunHostDeps): CreatedAutomatedHost {
  /** The observer's final state for each run, kept from the moment the browser closes until the platform has been told. */
  const ended = new Map<string, GuidedRunState>();

  const safeFailure = (error: unknown) => (error instanceof Error ? error.message : "The automated run could not start").split(/\r?\n/)[0]!.slice(0, 300);

  const host: AutomatedRunHost = {
    async openRun(start: StartGuidedRunInput, _contract: ContractSummary): Promise<OpenedRun> {
      const workspace = deps.selectedWorkspace(start.applicationId);
      const run = await deps.cloud.createRun({
        applicationId: start.applicationId,
        environmentId: start.environmentId,
        workspaceId: workspace?.cloudId ?? null,
        repositorySnapshotId: workspace?.snapshotId ?? null,
        expectedGraphVersionId: start.expectedGraphVersionId,
        flowId: start.flowId,
        flowBindingId: start.flowBindingId,
        flowInitializationId: start.flowInitializationId,
        flowScanId: start.flowScanId,
        flowDriftId: start.flowDriftId ?? null,
        captureTracks: start.captureTracks,
        timeoutSeconds: start.timeoutSeconds,
        patchSetId: start.patchSetId ?? null,
        mode: "AUTOMATED",
        automation: start.automation,
        targetUrl: start.targetUrl,
        captureVersion: deps.captureVersion,
      });
      const runId = String(run.id);
      if (typeof run.organizationId !== "string") {
        await deps.cloud.failRun(runId, "The run did not come back with an organization").catch(() => undefined);
        throw new Error("RUN_ORGANIZATION_CONTEXT_MISSING");
      }
      const sessionId = globalThis.crypto.randomUUID();
      const traceId = globalThis.crypto.randomUUID();
      try {
        const started = await deps.cloud.startRun(runId, sessionId, traceId);
        deps.evidence.open(runId);
        const relaySession = await deps.relay.start({
          collectorBaseUrl: deps.collectorBaseUrl(),
          runCredential: started.credential.credential,
          allowedOrigin: new URL(start.targetUrl).origin,
          correlation: { runId, sessionId, traceId, organizationId: run.organizationId, applicationId: start.applicationId, environmentId: start.environmentId },
          initialQueue: deps.readRelayQueue(runId) as never,
          onQueueChanged: (queue) => deps.writeRelayQueue(runId, queue as unknown[]),
          onEvents: deps.onRelayedEvents,
        });
        deps.setActiveRelay({ runId, endpoint: relaySession.endpoint, relayToken: relaySession.relayToken });
        if (start.captureTracks?.includes("BACKEND")) deps.backendStream.start(runId);
        await deps.relay.emit("QA_RUN_STARTED", { mode: "AUTOMATED" });
        return { runId, sessionId, traceId, organizationId: run.organizationId, relay: { endpoint: relaySession.endpoint, relayToken: relaySession.relayToken } };
      } catch (error) {
        // Nothing of this run may outlive the failure to start it.
        await deps.relay.emit("QA_RUN_FAILED", { reason: "automated_run_start_failed" }).catch(() => undefined);
        await deps.relay.stop().catch(() => undefined);
        deps.setActiveRelay(null);
        deps.backendStream.stop();
        await deps.cloud.failRun(runId, safeFailure(error)).catch(() => undefined);
        throw error;
      }
    },

    async openBrowser(run, start, hooks): Promise<BrowserSession> {
      const state = await deps.observer.start({
        ...start,
        runId: run.runId, sessionId: run.sessionId, traceId: run.traceId,
        relayEndpoint: run.relay.endpoint, relayToken: run.relay.relayToken,
        agentVersion: deps.agentVersion,
      }, deps.artifactRoot());
      const page = deps.observer.getAutomationPage();
      if (!page) throw new Error("The managed browser did not open a page to drive.");
      deps.maintenance.start(run.runId);
      deps.lifecycle(state, { cloudStatus: "RECORDING" });
      deps.afterBrowserOpened(state, start);
      const driver = new PageAutomationDriver(page, {
        sdkStates: async () => hooks.sdkStates(),
        beforeAction: hooks.beforeAction,
      });
      return {
        browser: deps.observer,
        driver,
        // Only the observer is paused, so nothing a person types is recorded; the relay keeps forwarding the
        // application's own markers, which carry no typed values, so the run can see where the application says it is.
        setCapturePaused: async (paused) => { await deps.observer.pause(paused); },
        bringToFront: async () => { await deps.observer.focusBrowser(); },
      };
    },

    async endBrowser(run) {
      try {
        if (deps.observer.getState()?.runId === run.runId && !ended.has(run.runId)) ended.set(run.runId, await deps.observer.end());
      } catch {
        /* the browser is already gone; its last state was kept when it went */
      }
      deps.maintenance.stop();
      deps.evidence.persist(run.runId);
    },

    async finishRun(run: OpenedRun, outcome: FinishOutcome) {
      const state = ended.get(run.runId) ?? null;
      const stopReason: AutomationStopReason = outcome.stopReason;
      const summary = describeStopReason(stopReason, null);
      try {
        if (outcome.kind === "FAIL") {
          await deps.relay.emit("QA_RUN_FAILED", { reason: stopReason }).catch(() => undefined);
          await deps.relay.stop().catch(() => undefined);
          deps.setActiveRelay(null);
          deps.backendStream.stop();
          await deps.evidence.flush(run.runId, true).catch(() => undefined);
          if (state) deps.lifecycle(state, { phase: "COMPLETE", localStatus: "FAILED", safeError: outcome.message });
          await deps.cloud.failRun(run.runId, outcome.message);
          deps.notify({ title: "Automated run stopped", body: outcome.message });
          return;
        }

        if (state) {
          deps.recovery.write(run.runId, { state, completionReason: outcome.completionReason, automationStopReason: stopReason });
          deps.lifecycle(state, { phase: "COMPLETE", localStatus: "CHROMIUM_CLOSED", cloudStatus: "UPLOADING", completionReason: outcome.completionReason, terminalStateKey: outcome.completionReason === "TERMINAL_STATE_REACHED" ? state.currentFlowStateKey : null, reportStatus: "PENDING" });
        }
        await deps.relay.emit("QA_RUN_COMPLETED", { observationCount: state?.observations.length ?? 0, findingCount: state?.findings.length ?? 0, completionReason: outcome.completionReason }).catch(() => undefined);
        await deps.relay.stop().catch(() => undefined);
        deps.setActiveRelay(null);
        deps.backendStream.stop();
        await deps.evidence.flush(run.runId, true);
        if (state) await deps.cloud.completeRun({ ...state, completionReason: outcome.completionReason, automationStopReason: stopReason });
        else await deps.cloud.completeRunWithoutEvidence({ runId: run.runId, sessionId: run.sessionId, traceId: run.traceId, completionReason: outcome.completionReason, automationStopReason: stopReason });
        deps.recovery.delete(run.runId);
        deps.evidence.forget(run.runId);
        if (state) deps.lifecycle(state, { cloudStatus: "SYNCHRONIZED", completionReason: outcome.completionReason, reportStatus: "PENDING" });
        deps.notify({ title: summary.title, body: stopReason === "TERMINAL_STATE_REACHED" ? "Your QA report is being prepared." : summary.message });
      } finally {
        // Kept only while evidence still has to reach the platform; a failed sync leaves the recovery record for a later launch.
        ended.delete(run.runId);
      }
    },

    async reportPhase(runId: string, update: AutomationPhaseUpdate) {
      await deps.cloud.reportAutomationPhase(runId, update as Record<string, unknown>);
    },

    notify: (note) => deps.notify(note),
    publish: (status) => deps.publish(status),
  };

  return {
    host,
    browserTerminated: (state) => { ended.set(state.runId, state); },
  };
}

export type { QAEvidenceEvent };
