import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Worker } from 'node:worker_threads';
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, net, Notification as ElectronNotification, screen, session, shell } from 'electron';
import { CreateApplicationInputSchema, INSTRUMENTATION_FRAMEWORK_IDS, InstrumentationPlanFiltersSchema, IPC, QAInteractionModeSchema, REPOSITORY_MISMATCH_CODE, StartGuidedRunInputSchema, type BackendEvidenceQuery, type BlastRadiusResult, type BranchPolicy, type InstrumentationFrameworkId, type CodebaseAnalysis, type CodebaseUploadConsentRequest, type CodeEntity, type CreateQARunAnnotation, type DeclaredFlowDetail, type DesktopApplication, type QAEvidenceEvent, type RepositorySnapshotSummary, type RunLifecycleEvent } from '@tellann/desktop-contracts';
import { resolveWithinWorkspace } from '@tellann/agent-policy';
import type { InstrumentationProgressUpdate } from './instrumentation-controller';
import {
  answerFromAnalysis,
  blastRadiusInAnalysis,
  compareAnalyses,
  describeEntity,
  hierarchyChildren,
  projectAnalysis,
  redactSecrets,
  resolveAnnotationSource,
  scanWorkspace,
  workingTreeIdentity,
  type previewSanitizedSourceArchive,
  type SanitizedArchive,
} from '@tellann/project-intelligence';
import {
  BrowserObserver,
  normalizeFlowKey,
  type GuidedRunState,
  type RunFlowPlan,
  type RunFlowPlanState,
  type RunFlowPlanTransition,
} from '@tellann/browser-observer';
import { DesktopCloudClient, cloudApiUrl } from './cloud-client';
import { loadDesktopSession } from './secure-store';
import { checkSdkVersions } from './sdk-version-check';
import { distinctMarkers, scanWorkspaceForFlowMarkers } from './flow-marker-scan';
import { initializeUpdater } from './update-manager';
import { closeLocalStore, deleteLocalState, listLocalStateKeys, readLocalState, writeLocalState } from './local-store';
import { extractDocument } from '@tellann/document-intelligence';
import { InstrumentationController, type SelectedWorkspace } from './instrumentation-controller';
import { documentSourceKey, workspaceLocalId } from './device-identity';
import { DocumentImportManager, isActiveDocumentImportStage } from './document-import-manager';
import {
  evaluateCompliance,
  restoreWorkspaceBranch,
  switchToQaBranch,
  type QaBranchCheckpoint,
} from './qa-branch';
import { LocalRunRelay, type BufferedRelayRequest } from '@tellann/local-relay';
import { LocalApplicationLauncher } from './application-launcher';
import { renderValidationReportPdf, type ValidationReportInput } from './validation-report';
import { renderQualityReport, qualityReportFileBase, type QualityReportFormat } from './quality-report-document';
import { renderCodebaseRiskReportPdf } from './codebase-risk-report';
import { loadDesktopEnvironment } from './environment';
import { DesktopNotificationClient } from './notification-client';
import { packagedBrowserExecutable } from './browser-executable';
import { cancelCodebaseAnalysisRun } from './codebase-analysis-cancellation';
import {
  attachWindowChrome,
  handleSecondInstanceArgv,
  noteBackgroundNotification,
  onEndRunRequested,
  registerWindowIpc,
  rendererQuery,
  secondaryWindowOptions,
  requestAttention,
  setRunIndicator,
  themedWindowIconPath,
  windowOptions,
} from './window-chrome';

loadDesktopEnvironment();

let mainWindow: BrowserWindow | null = null;
/** A live run panel the operator can pop out of the run page into its own window. */
type RunPanelId = 'guide' | 'evidence';
/**
 * The run panels currently popped out. Each renders the same panel from the
 * same renderer bundle, driven by the same pushed run state, so nothing about
 * the run changes when the operator detaches or reattaches one.
 */
const runPanelWindows = new Map<RunPanelId, BrowserWindow>();
let quittingAfterRunCleanup = false;
const cloud = new DesktopCloudClient();
const notificationClient = new DesktopNotificationClient({
  apiUrl: process.env.TELLANN_API_URL ?? 'http://127.0.0.1:3000',
  appVersion: app.getVersion(),
  getWindow: () => mainWindow,
  onBackgroundNotification: noteBackgroundNotification,
});

/**
 * Point both live streams — the notification feed and the application-event
 * broadcast — at one organisation. Called whenever we learn or re-learn which
 * organisation this window is working in, so a newly created application and
 * its notification reach the renderer without a restart.
 */
async function applyActiveOrganization(organizationId: string | null): Promise<void> {
  if (!organizationId) return;
  activeOrganizationId = organizationId;
  cloud.setAppEventsOrganization(organizationId);
  await notificationClient.setActiveOrganization(organizationId);
}

async function syncNotificationOrganization(): Promise<void> {
  try {
    const apps = await cloud.applications();
    const organizationId = apps.find((entry) => entry.organizationId)?.organizationId ?? null;
    if (organizationId) {
      await applyActiveOrganization(organizationId);
      return;
    }
    // No applications yet — the member still belongs to an organisation, and
    // that is exactly the case where they are about to create their first one.
    const organizations = await cloud.organizations();
    await applyActiveOrganization(organizations[0]?.id ?? null);
  } catch {
    // Not signed in yet, or offline — a later sign-in / focus retries.
  }
}
const relay = new LocalRunRelay();
const applicationLauncher = new LocalApplicationLauncher();
const selectedWorkspaces = new Map<string, SelectedWorkspace>();
const codebaseWorkers = new Map<string, Worker>();

/**
 * Cooperative cancellation for the stage before a cloud analysis job exists.
 *
 * Preparing and uploading the snapshot is the longest part of an attach, and
 * there is no job id to cancel yet — so Cancel has to be answered by this
 * process: the token is flipped here, `abort` stops the archive worker, and the
 * upload stops between parts.
 */
type SnapshotUploadCancellation = { cancelled: boolean; abort: (() => void) | null };
const snapshotUploads = new Map<string, SnapshotUploadCancellation>();
const SNAPSHOT_UPLOAD_CANCELLED = 'CODEBASE_SNAPSHOT_UPLOAD_CANCELLED';

/**
 * Callers waiting on a local analysis that is already running.
 *
 * The analysis lives in a worker thread this process owns, so its completion is
 * an event — waiting for it by re-reading the stored record once a second was
 * polling something we are holding the other end of, and paid for the whole
 * record on every tick to learn one field.
 */
const localAnalysisWaiters = new Map<string, Array<(outcome: { ok: boolean; message?: string }) => void>>();

function settleLocalAnalysis(applicationId: string, outcome: { ok: boolean; message?: string }): void {
  const waiters = localAnalysisWaiters.get(applicationId);
  if (!waiters) return;
  localAnalysisWaiters.delete(applicationId);
  for (const waiter of waiters) waiter(outcome);
}

function whenLocalAnalysisSettles(applicationId: string): Promise<{ ok: boolean; message?: string }> {
  return new Promise((resolve) => {
    const existing = localAnalysisWaiters.get(applicationId);
    if (existing) existing.push(resolve);
    else localAnalysisWaiters.set(applicationId, [resolve]);
  });
}
let pendingSetupHandoffToken: string | null = null;
let pendingQARunDeepLink: string | null = null;
let activeOrganizationId: string | null = null;
const execFileAsync = promisify(execFile);
const instrumentation = new InstrumentationController(
  cloud,
  (applicationId) => selectedWorkspaces.get(applicationId) ?? null,
  applicationLauncher,
  // The same scan-and-register as attaching the folder, so a new plan and the
  // cloud's snapshot both describe the project's current commit and files.
  //
  // Only when the folder has actually moved, though. The scan exists to catch a
  // commit, branch switch or install since the folder was attached, and that
  // question is answered by one `git status` plus a stat per changed file —
  // where the scan itself reads every source file in the project. Paying the
  // second to learn the first made every instrumentation proposal re-read the
  // whole tree.
  async (applicationId) => {
    const stored = readLocalState<StoredWorkspace>(localWorkspaceKey(applicationId));
    if (!stored || !existsSync(stored.path)) return;
    if (selectedWorkspaces.has(applicationId) && stored.snapshot.workingTreeHash) {
      try {
        if (workingTreeIdentity(stored.path) === stored.snapshot.workingTreeHash) return;
      } catch {
        // Git could not be read, so fall through and scan rather than guess.
      }
    }
    await registerSelectedWorkspace(applicationId, stored.path);
  },
);

function captureTellannDeepLink(values: string[]): void {
  const candidate = values.find((value) => value.startsWith('tellann://'));
  if (!candidate) return;
  try {
    const url = new URL(candidate);
    if (url.hostname === 'connect') {
      const token = url.searchParams.get('handoff');
      if (token && token.length >= 32) pendingSetupHandoffToken = token;
      return;
    }
    if (url.hostname !== 'qa-runs' || url.pathname !== '/new') return;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const applicationId = url.searchParams.get('applicationId') ?? url.searchParams.get('appId');
    if (!applicationId || !uuid.test(applicationId)) return;
    const params = new URLSearchParams();
    for (const key of ['environmentId', 'flowId', 'workflowId']) {
      const value = url.searchParams.get(key);
      if (value && uuid.test(value)) params.set(key, value);
    }
    const mode = url.searchParams.get('mode');
    if (mode && ['GUIDED', 'ASSISTED', 'OBSERVATION_ONLY'].includes(mode)) params.set('mode', mode);
    const target = url.searchParams.get('targetUrl');
    if (target) {
      try {
        const parsedTarget = new URL(target);
        if (['http:', 'https:'].includes(parsedTarget.protocol) && !parsedTarget.username && !parsedTarget.password) {
          const names = [...new Set(parsedTarget.searchParams.keys())].sort();
          parsedTarget.search = names.length ? `?${names.map((name) => `${encodeURIComponent(name)}=`).join('&')}` : '';
          parsedTarget.hash = '';
          params.set('targetUrl', parsedTarget.toString().slice(0, 2048));
        }
      } catch {
        // Ignore an invalid target; the run form will fall back to the environment URL.
      }
    }
    if (!params.has('flowId') && params.has('workflowId')) params.set('flowId', params.get('workflowId')!);
    pendingQARunDeepLink = `/applications/${applicationId}/qa-runs/new${params.size ? `?${params.toString()}` : ''}`;
  } catch {
    // Ignore malformed external protocol input.
  }
}

function deliverPendingQARunDeepLink(): void {
  if (!pendingQARunDeepLink || !mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isLoading()) return;
  mainWindow.webContents.send(IPC.notificationOpen, { deepLink: pendingQARunDeepLink });
  pendingQARunDeepLink = null;
}

captureTellannDeepLink(process.argv);
const evidenceQueues = new Map<string, QAEvidenceEvent[]>();
const evidenceFlushes = new Map<string, Promise<void>>();
/**
 * Rollout gate for the V2 capture pipeline (evidence spool and upload, Inspect
 * mode, durable report). Defaults on so existing installs are unaffected; set
 * `QA_CAPTURE_V2=false` to fall back to route observations and the legacy
 * report assembler while V2 is validated for an organization.
 *
 * Route observations and findings are written either way, so the dual-write
 * validation period described in the rollout plan works with the gate off.
 */
const QA_CAPTURE_V2_ENABLED = process.env.QA_CAPTURE_V2 !== 'false';
let evidenceFlushTimer: NodeJS.Timeout | null = null;
let boundaryPollTimer: NodeJS.Timeout | null = null;

function evidenceQueueKey(runId: string): string { return `qa-evidence-queue:${runId}`; }

/**
 * Applying a setup task can take minutes (package install, build, waiting for
 * the app's first event). Progress is kept per plan so the task page shows where
 * it has got to even after navigating away and back, and the member is told
 * when it finishes if they are not looking at Tellann.
 *
 * Channel names live here and in preload rather than in the shared contracts:
 * the desktop loads that package's prebuilt output at runtime.
 */
const INSTRUMENTATION_PROGRESS_CHANNEL = 'tellann:instrumentation:progress';
const INSTRUMENTATION_PROGRESS_GET_CHANNEL = 'tellann:instrumentation:progress:get';

type InstrumentationApplyProgress = {
  applicationId: string;
  planId: string;
  outcome: 'RUNNING' | 'SUCCEEDED' | 'NEEDS_ATTENTION' | 'FAILED';
  summary: string | null;
  startedAt: string;
  finishedAt: string | null;
  events: InstrumentationProgressUpdate[];
};

const instrumentationApplyProgress = new Map<string, InstrumentationApplyProgress>();
// Held until closed: a notification garbage-collected early loses its click handler.
const shownNotifications = new Set<ElectronNotification>();

function publishApplyProgress(progress: InstrumentationApplyProgress): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(INSTRUMENTATION_PROGRESS_CHANNEL, progress);
}

// Document imports run here rather than in the page that started them, so an
// upload keeps going (and stays visible) after the member navigates away.
// Channel names are local for the same reason as the instrumentation ones.
const DOCUMENT_IMPORT_PROGRESS_CHANNEL = 'tellann:documents:import:progress';
const DOCUMENT_IMPORT_GET_CHANNEL = 'tellann:documents:import:get';
const DOCUMENT_IMPORT_RESUME_CHANNEL = 'tellann:documents:import:resume';
const DOCUMENT_IMPORT_CANCEL_CHANNEL = 'tellann:documents:import:cancel';
const DOCUMENT_IMPORT_DISMISS_CHANNEL = 'tellann:documents:import:dismiss';
const DOCUMENT_IMPORT_GENERATE_CHANNEL = 'tellann:documents:import:generate';
const INTENT_DRAFT_APPLY_ANSWERS_CHANNEL = 'tellann:intent:draft:apply-answers';

const documentImports = new DocumentImportManager({
  cloud,
  publish: (view) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(DOCUMENT_IMPORT_PROGRESS_CHANNEL, view);
  },
  notify: (input) => notifyWhenAway(input),
  repositorySnapshotId: (applicationId) => selectedWorkspaces.get(applicationId)?.snapshotId,
  safeError: (error) => safeDesktopError(error),
  sourceKey: (filePath) => documentSourceKey(filePath),
});

/** A native notification, only when the member is not looking at Tellann; clicking opens `deepLink`. */
function notifyWhenAway(input: { title: string; body: string; deepLink: string }): void {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) return;
  if (!ElectronNotification.isSupported()) return;
  const notification = new ElectronNotification({ title: input.title, body: input.body });
  shownNotifications.add(notification);
  const release = () => shownNotifications.delete(notification);
  notification.on('click', () => {
    release();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send(IPC.notificationOpen, { deepLink: input.deepLink });
  });
  notification.on('close', release);
  notification.show();
}

async function applyInstrumentationWithProgress(applicationId: string, planId: string) {
  if (instrumentationApplyProgress.get(planId)?.outcome === 'RUNNING') {
    throw new Error('INSTRUMENTATION_APPLY_IN_PROGRESS');
  }
  const progress: InstrumentationApplyProgress = {
    applicationId, planId, outcome: 'RUNNING', summary: null,
    startedAt: new Date().toISOString(), finishedAt: null, events: [],
  };
  instrumentationApplyProgress.set(planId, progress);
  publishApplyProgress(progress);
  const finish = (outcome: Exclude<InstrumentationApplyProgress['outcome'], 'RUNNING'>, title: string, summary: string) => {
    progress.outcome = outcome;
    progress.summary = summary;
    progress.finishedAt = new Date().toISOString();
    publishApplyProgress(progress);
    notifyWhenAway({ title, body: summary, deepLink: `/applications/${applicationId}/instrumentation/plans/${planId}` });
  };
  try {
    const result = await instrumentation.apply(applicationId, planId, (update) => {
      progress.events = [...progress.events, update].slice(-200);
      publishApplyProgress(progress);
    });
    if (result.validation.valid) {
      finish('SUCCEEDED', 'Tellann setup finished', 'Tellann is installed in your project and every check passed.');
    } else {
      finish('NEEDS_ATTENTION', 'Tellann setup needs a look', 'Tellann applied the changes, but some checks need your attention.');
    }
    return result;
  } catch (error) {
    finish('FAILED', 'Tellann setup stopped', 'Setup stopped before finishing, and any changes Tellann made were undone. Open the task to see why.');
    throw error;
  }
}

function emitRunLifecycle(state: GuidedRunState, input: Partial<RunLifecycleEvent> = {}): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const ended = input.phase === 'COMPLETE' || input.localStatus === 'CHROMIUM_CLOSED' || input.localStatus === 'FAILED';
  setRunIndicator(ended ? 'idle' : input.cloudStatus === 'PAUSED' ? 'paused' : 'running');
  if (input.localStatus === 'CHROMIUM_CLOSED' || input.localStatus === 'FAILED') requestAttention();
  const event: RunLifecycleEvent = {
    runId: state.runId,
    applicationId: state.applicationId,
    phase: state.phase,
    localStatus: state.status,
    cloudStatus: null,
    completionReason: null,
    terminalStateKey: null,
    evidenceCounts: state.evidenceCounts,
    reportStatus: null,
    safeError: null,
    captureTracks: state.captureTracks,
    timestamp: new Date().toISOString(),
    ...input,
  };
  // A detached panel follows the same run, so it has to hear a run end as
  // promptly as the page does rather than waiting for the next reconcile.
  for (const target of [mainWindow, ...runPanelWindows.values()]) {
    if (!target || target.isDestroyed()) continue;
    target.webContents.send(IPC.runLifecycleEvent, event);
  }
}

function enqueueEvidence(event: QAEvidenceEvent): void {
  if (!QA_CAPTURE_V2_ENABLED) return;
  const queue = evidenceQueues.get(event.runId) ?? readLocalState<QAEvidenceEvent[]>(evidenceQueueKey(event.runId)) ?? [];
  queue.push(event);
  if (queue.length > 5_000) {
    const removed = queue.splice(0, queue.length - 4_999);
    const template = removed[0] ?? event;
    queue.unshift({
      ...template,
      eventId: crypto.randomUUID(),
      eventType: 'QA_CAPTURE_DEGRADED',
      privacyClassification: 'INTERNAL',
      interactionGroupId: null,
      causedByEventId: null,
      metadata: { reason: 'LOCAL_SPOOL_QUOTA', droppedEventCount: removed.length, maximumEvents: 5_000 },
      protectedValues: [],
    });
  }
  evidenceQueues.set(event.runId, queue);
  scheduleSpoolPersist(event.runId);
  // Upload failures are recoverable because the evidence remains in the local
  // spool. Avoid turning a missing/temporarily unavailable cloud encryption
  // configuration into an unhandled-rejection loop while a run is active.
  if (queue.length >= 100) void flushEvidence(event.runId).catch(() => undefined);
}

/**
 * Persisting the spool is coalesced rather than done per event. `writeLocalState`
 * runs `safeStorage.encryptString` over the whole queue plus a synchronous
 * SQLite write, so writing on every captured event re-encrypted the entire
 * backlog each time and stalled the main process during interaction-heavy runs.
 * The spool only has to survive a crash or restart, and at most `SPOOL_PERSIST_MS`
 * of already-uploaded-or-recoverable events can be lost.
 */
const SPOOL_PERSIST_MS = 1_000;
const spoolPersistTimers = new Map<string, NodeJS.Timeout>();

function persistSpoolNow(runId: string): void {
  const pending = spoolPersistTimers.get(runId);
  if (pending) { clearTimeout(pending); spoolPersistTimers.delete(runId); }
  const queue = evidenceQueues.get(runId);
  try {
    if (queue?.length) writeLocalState(evidenceQueueKey(runId), queue);
    else deleteLocalState(evidenceQueueKey(runId));
  } catch { /* spool persistence is best-effort; uploads remain authoritative */ }
}

function scheduleSpoolPersist(runId: string): void {
  if (spoolPersistTimers.has(runId)) return;
  const timer = setTimeout(() => persistSpoolNow(runId), SPOOL_PERSIST_MS);
  timer.unref();
  spoolPersistTimers.set(runId, timer);
}

function stopRunMaintenance(): void {
  if (evidenceFlushTimer) clearInterval(evidenceFlushTimer);
  if (boundaryPollTimer) clearTimeout(boundaryPollTimer);
  evidenceFlushTimer = null;
  boundaryPollTimer = null;
}

function startRunMaintenance(runId: string): void {
  stopRunMaintenance();
  evidenceFlushTimer = setInterval(() => void flushEvidence(runId).catch(() => undefined), 2_000);
  evidenceFlushTimer.unref();
  // Fallback path for boundaries accepted through the SDK rather than the
  // relay. Backs off from 1.5s to 15s while nothing changes so a long run does
  // not hammer the API, and resets the moment the boundary actually moves.
  const MIN_POLL_MS = 1_500;
  const MAX_POLL_MS = 15_000;
  let pollDelay = MIN_POLL_MS;
  const poll = async () => {
    const local = observer.getState();
    if (!local || local.runId !== runId || runCompletionInProgress) return;
    const remote = await cloud.boundaryStatus(runId);
    const started = Boolean(remote.boundaryStartedAt);
    const completed = Boolean(remote.boundaryCompletedAt) && remote.completionReason === 'TERMINAL_STATE_REACHED';
    if (started && local.phase === 'PRE_BOUNDARY') {
      pollDelay = MIN_POLL_MS;
      await observer.acceptBoundaryOutcome({
        accepted: true,
        phase: 'IN_FLOW',
        stateKey: typeof remote.lastObservedStateKey === 'string' ? remote.lastObservedStateKey : undefined,
      });
      const updated = observer.getState();
      if (updated) emitRunLifecycle(updated, { cloudStatus: 'BOUNDARY_ACCEPTED_BY_SDK' });
    } else {
      pollDelay = Math.min(MAX_POLL_MS, Math.round(pollDelay * 1.5));
    }
    if (completed) await completeActiveRun('TERMINAL_STATE_REACHED');
  };
  const schedule = () => {
    boundaryPollTimer = setTimeout(() => {
      void poll().catch(() => undefined).finally(() => {
        if (boundaryPollTimer) schedule();
      });
    }, pollDelay);
    boundaryPollTimer.unref();
  };
  schedule();
}

async function flushEvidence(runId: string, drain = false): Promise<void> {
  const existing = evidenceFlushes.get(runId);
  if (existing) return existing;
  const operation = (async () => {
    const queue = evidenceQueues.get(runId) ?? readLocalState<QAEvidenceEvent[]>(evidenceQueueKey(runId)) ?? [];
    evidenceQueues.set(runId, queue);
    do {
      if (!queue.length) break;
      const batch: QAEvidenceEvent[] = [];
      let bytes = 0;
      for (const event of queue.slice(0, 100)) {
        const eventBytes = Buffer.byteLength(JSON.stringify(event));
        if (batch.length && bytes + eventBytes > 4.5 * 1024 * 1024) break;
        batch.push(event);
        bytes += eventBytes;
      }
      if (!batch.length) break;
      await cloud.uploadEvidenceBatch(runId, batch);
      queue.splice(0, batch.length);
      persistSpoolNow(runId);
    } while (drain && queue.length);
  })().finally(() => evidenceFlushes.delete(runId));
  evidenceFlushes.set(runId, operation);
  return operation;
}

const RECOVERY_KEY_PREFIX = 'qa-run-recovery:';

/**
 * Completes any run whose Chromium closed cleanly but whose evidence upload or
 * cloud completion was interrupted — a crash, a quit, or a network outage.
 * Every step is idempotent (`/complete` returns the existing run, and evidence
 * batches deduplicate on `eventId`), so replaying is safe and never produces a
 * duplicate run, report, finding, annotation or email.
 */
async function resumeInterruptedRunSynchronization(): Promise<void> {
  let keys: string[] = [];
  try {
    keys = listLocalStateKeys(RECOVERY_KEY_PREFIX);
  } catch { return; }
  for (const key of keys) {
    const runId = key.slice(RECOVERY_KEY_PREFIX.length);
    if (!runId) continue;
    try {
      const recovery = readLocalState<{ state: GuidedRunState; completionReason: string }>(key);
      if (!recovery) { deleteLocalState(key); continue; }
      evidenceQueues.set(runId, readLocalState<QAEvidenceEvent[]>(evidenceQueueKey(runId)) ?? []);
      await flushEvidence(runId, true);
      await cloud.completeRun({ ...recovery.state, completionReason: recovery.completionReason });
      deleteLocalState(key);
      evidenceQueues.delete(runId);
      emitRunLifecycle(recovery.state, {
        phase: 'COMPLETE',
        localStatus: 'CHROMIUM_CLOSED',
        cloudStatus: 'SYNCHRONIZED',
        completionReason: recovery.completionReason,
        reportStatus: 'PENDING',
      });
    } catch {
      // Leave the journal in place: the user can retry from run detail, and the
      // next launch will try again.
    }
  }
}

/** Errors the backend SDK reports, whichever name its integration used. */
const BACKEND_ERROR_EVENT_TYPES = new Set(['SERVER_ERROR', 'ERROR_EVENT', 'ERROR_OCCURRED', 'UNHANDLED_EXCEPTION']);

/**
 * Where a process the operator starts themselves reports into the active run.
 *
 * Held here rather than on the run state because the run state is written to
 * the recovery journal and uploaded on completion, and a run credential must
 * be in neither. It lives exactly as long as the relay does.
 */
let activeRelayConnection: { runId: string; endpoint: string; relayToken: string } | null = null;

/**
 * Live push for backend evidence a standing-ingestion-key server sent
 * straight to onboarding-api rather than through the local relay above — the
 * only path a server the desktop did not start can reach. Without this the
 * evidence still lands correctly against the run (onboarding-api resolves it
 * server-side), it just never reaches this process until the run ends and
 * the report reads it back. Scoped to one run at a time, same as the relay.
 */
let qaRunEventsAbort: AbortController | null = null;

function stopQaRunEventsStream(): void {
  qaRunEventsAbort?.abort();
  qaRunEventsAbort = null;
}

function startQaRunEventsStream(runId: string): void {
  stopQaRunEventsStream();
  const controller = new AbortController();
  qaRunEventsAbort = controller;
  void runQaRunEventsStream(runId, controller.signal);
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

/**
 * Consumes api-gateway's SSE stream for one run's backend evidence, backing
 * off the same way the boundary poll does when the connection cannot be
 * established or drops (a desktop signed out, a blip in the gateway) rather
 * than hammering it in a tight loop.
 */
async function runQaRunEventsStream(runId: string, signal: AbortSignal): Promise<void> {
  const MIN_BACKOFF_MS = 1_000;
  const MAX_BACKOFF_MS = 15_000;
  let backoffMs = MIN_BACKOFF_MS;
  while (!signal.aborted) {
    const session = loadDesktopSession();
    if (!session) {
      await delay(backoffMs, signal);
      continue;
    }
    try {
      const response = await net.fetch(`${cloudApiUrl()}/v1/qa-runs/${runId}/events`, {
        headers: { authorization: `Bearer ${session.accessToken}`, accept: 'text/event-stream' },
        credentials: 'omit',
        signal,
      });
      if (!response.ok || !response.body) throw new Error(`QA_RUN_EVENTS_STREAM_${response.status}`);
      backoffMs = MIN_BACKOFF_MS;
      console.log(`[QaRunEvents] Connected for run ${runId}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventsReceived = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.warn(`[QaRunEvents] Stream closed by server for run ${runId} after ${eventsReceived} event(s); reconnecting`);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          try {
            const message = JSON.parse(dataLine.slice(5).trim()) as {
              type?: string;
              events?: Array<{ eventId: string; eventType: string; metadata: unknown; timestamp: string }>;
            };
            if (message.type === 'EVENTS' && Array.isArray(message.events)) {
              eventsReceived += message.events.length;
              await handleQaRunEvidencePush(runId, message.events);
            }
          } catch (error) {
            console.warn(`[QaRunEvents] Malformed SSE frame for run ${runId}`, error);
          }
        }
      }
    } catch (error) {
      if (!signal.aborted) {
        console.warn(`[QaRunEvents] Connection dropped for run ${runId}, retrying in ${backoffMs}ms`, error);
      }
    }
    if (signal.aborted) return;
    await delay(backoffMs, signal);
    backoffMs = Math.min(MAX_BACKOFF_MS, Math.round(backoffMs * 1.5));
  }
}

/**
 * Routes pushed backend evidence to the same observer methods the local
 * relay's `API_REQUEST`/`QA_BACKEND_DATA_ACCESS`/error events use, so the
 * Live evidence panel, its counts and its findings fill in identically
 * regardless of which path the evidence took to get here.
 */
async function handleQaRunEvidencePush(
  runId: string,
  events: Array<{ eventId: string; eventType: string; metadata: unknown; timestamp: string }>,
): Promise<void> {
  const active = observer.getState();
  if (!active || active.runId !== runId || !active.captureTracks?.includes('BACKEND')) {
    console.warn(`[QaRunEvents] Dropping ${events.length} event(s) for run ${runId}: active run is ${active?.runId ?? 'none'}`);
    return;
  }
  for (const event of events) {
    const record = { eventId: event.eventId, metadata: event.metadata, timestamp: event.timestamp };
    // Already persisted by onboarding-api before this push happened — skip
    // the desktop's own re-upload path so it never encrypts (and fails
    // schema validation on) metadata that has already been sanitized once.
    const options = { skipUpload: true };
    if (event.eventType === 'QA_BACKEND_REQUEST') await observer.recordBackendRequestEvent(record, options);
    else if (event.eventType === 'QA_BACKEND_DATA_ACCESS') await observer.recordBackendDataAccessEvent(record, options);
    else if (event.eventType === 'QA_BACKEND_ERROR') await observer.recordBackendErrorEvent(record, options);
  }
}

async function handleRelayedEvents(events: Array<Record<string, unknown>>): Promise<void> {
  const supported = new Set(['FLOW_INITIAL_STATE', 'FLOW_STATE_REACHED', 'FLOW_TRANSITION', 'FLOW_TERMINAL_STATE']);
  for (const event of events) {
    const eventType = String(event.eventType ?? '');
    const active = observer.getState();
    if (!active || event.runId !== active.runId) continue;
    // Framework-state evidence from the SDK instrumentation adapters (Redux,
    // approved Context providers and useState setters, trackClientState).
    const businessEventType = (event.metadata as Record<string, unknown> | undefined)?.businessEventType;
    if (eventType === 'BUSINESS_EVENT' && businessEventType === 'QA_CLIENT_STATE_MUTATION') {
      await observer.recordClientStateEvent(event);
      continue;
    }
    // The backend track. These used to be forwarded to the cloud and dropped
    // here, which is why a backend run showed the two requests the managed
    // browser made and nothing the application's own server handled.
    if (active.captureTracks?.includes('BACKEND') && String(event.source ?? '') !== 'frontend-sdk') {
      if (eventType === 'API_REQUEST') {
        await observer.recordBackendRequestEvent(event);
        continue;
      }
      if (eventType === 'BUSINESS_EVENT' && businessEventType === 'QA_BACKEND_DATA_ACCESS') {
        await observer.recordBackendDataAccessEvent(event);
        continue;
      }
      if (BACKEND_ERROR_EVENT_TYPES.has(eventType)) {
        await observer.recordBackendErrorEvent(event);
        continue;
      }
    }
    if (!supported.has(eventType)) continue;
    const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata as Record<string, unknown> : {};
    await observer.recordFlowEvent(event);
    // A marker from the instrumentation snippet names its state in
    // `metadata.state`. Without it here the desktop forwards an empty stateKey
    // and the event is refused before the boundary ever sees the marker.
    const stateKey = [metadata.stateKey, metadata.toStateKey, metadata.state, metadata.stateId]
      .map((value) => (value == null ? '' : String(value).trim()))
      .find((value) => value !== '') ?? '';
    const boundary = await cloud.boundaryEvent(active.runId, {
      eventId: event.eventId,
      eventType,
      timestamp: event.timestamp,
      flowVersionId: metadata.flowVersionId,
      stateKey,
      fromStateKey: metadata.fromStateKey,
      toStateKey: metadata.toStateKey,
      metadata,
    }) as { accepted?: boolean; shouldStop?: boolean; phase?: 'PRE_BOUNDARY' | 'IN_FLOW'; reason?: string };
    await observer.acceptBoundaryOutcome({
      accepted: Boolean(boundary.accepted), phase: boundary.phase, stateKey,
      eventType, reason: boundary.reason ?? null,
    });
    const updated = observer.getState();
    if (updated) emitRunLifecycle(updated, { cloudStatus: boundary.accepted ? 'ACCEPTED' : `QUARANTINED:${boundary.reason ?? 'unknown'}` });
    if (boundary.shouldStop) setTimeout(() => void completeActiveRun('TERMINAL_STATE_REACHED'), 0);
  }
}

const observer = new BrowserObserver({
  executablePath: app.isPackaged ? packagedBrowserExecutable(process.resourcesPath) : undefined,
  // Headless mode is reserved for deterministic installed-application
  // acceptance. Normal desktop runs always show the managed browser.
  headless: process.env.TELLANN_BROWSER_HEADLESS === 'true',
  onUnexpectedTermination: async (state) => {
    stopRunMaintenance();
    emitRunLifecycle(state, { localStatus: 'FAILED', safeError: 'Managed Chromium closed unexpectedly.' });
    await relay.emit('QA_RUN_FAILED', { reason: 'managed_browser_terminated' }).catch(() => undefined);
    await applicationLauncher.stop().catch(() => undefined);
    await relay.stop().catch(() => undefined);
    activeRelayConnection = null;
    stopQaRunEventsStream();
    await cloud.failRun(state.runId, 'Managed browser terminated unexpectedly').catch(() => undefined);
  },
  onObservation: async () => undefined,
  onEvidenceEvent: async (event) => enqueueEvidence(event),
  searchMentionableMembers: (runId, query) => cloud.mentionableMembers(runId, query),
  onAnnotation: (runId, annotation, applicationId) => {
    return cloud.saveAnnotation(runId, attachAnnotationSource(applicationId, annotation));
  },
  // Pushing the state is what lets the run page stop asking for a full copy of
  // it several times a second, which on a busy page meant serialising hundreds
  // of evidence rows across the IPC boundary for no new information.
  onStateChanged: (state) => sendRunState(state),
});

function attachAnnotationSource<T extends CreateQARunAnnotation>(applicationId: string | undefined, annotation: T): T {
  const unavailable = (
    status: 'NOT_CONNECTED' | 'ANALYSIS_UNAVAILABLE' | 'NO_MATCH',
    analysisId: string | null = null,
  ) => ({
    status, path: null, startLine: null, endLine: null, symbol: null,
    confidence: null, strategy: null, analysisId,
  } as const);
  let sourceMapping: NonNullable<CreateQARunAnnotation['elementFingerprint']['sourceMapping']>;
  if (!applicationId || !selectedWorkspaces.has(applicationId)) {
    sourceMapping = unavailable('NOT_CONNECTED');
  } else {
    const analysis = readAnalysisState(applicationId)?.analysis ?? null;
    if (!analysis || !['COMPLETED', 'PARTIAL'].includes(analysis.status)) {
      sourceMapping = unavailable('ANALYSIS_UNAVAILABLE', analysis?.id ?? null);
    } else {
      sourceMapping = resolveAnnotationSource(analysis, annotation)
        ?? unavailable('NO_MATCH', analysis.id);
    }
  }
  return {
    ...annotation,
    elementFingerprint: { ...annotation.elementFingerprint, sourceMapping },
  };
}

/**
 * Evidence still waiting to reach the cloud. A run that looks healthy while its
 * spool quietly grows is the failure mode this makes visible.
 */
function runSyncBacklog(runId: string): number {
  const queue = evidenceQueues.get(runId) ?? readLocalState<QAEvidenceEvent[]>(evidenceQueueKey(runId)) ?? [];
  return queue.length;
}

/** Decorates a snapshot with the parts of run health only the main process knows. */
function decorateRunState(state: GuidedRunState): GuidedRunState {
  return { ...state, syncBacklog: runSyncBacklog(state.runId) };
}

function sendRunState(state: GuidedRunState): void {
  const decorated = decorateRunState(state);
  for (const target of [mainWindow, ...runPanelWindows.values()]) {
    if (!target || target.isDestroyed()) continue;
    target.webContents.send(IPC.runStateChanged, decorated);
  }
}
/**
 * Resolves the published graph a run reconciles against into the shape the run
 * page renders. Failure is not fatal: the run still captures everything, it
 * just cannot show which states remain, so the page falls back to saying so.
 */
async function resolveRunFlowPlan(input: {
  applicationId: string;
  flowId: string;
  expectedGraphVersionId: string;
}): Promise<RunFlowPlan | null> {
  try {
    const graph = await cloud.flowVersionGraph(input.applicationId, input.flowId, input.expectedGraphVersionId);
    const states: RunFlowPlanState[] = (graph.states ?? []).map((raw) => {
      const record = raw as Record<string, any>;
      const name = String(record.stateName ?? record.name ?? record.behaviorKey ?? '');
      const role = record.role === 'INITIAL' || record.role === 'TERMINAL' ? record.role : 'NORMAL';
      return {
        key: normalizeFlowKey(record.behaviorKey ?? record.stateName ?? record.name),
        name: name || String(record.behaviorKey ?? 'Unnamed state'),
        role,
        terminalKind: record.terminalKind ? String(record.terminalKind) : null,
        category: record.category ? String(record.category) : null,
      };
    }).filter((state) => state.key.length > 0);
    const byId = new Map<string, string>();
    for (const raw of graph.states ?? []) {
      const record = raw as Record<string, any>;
      if (record.id) byId.set(String(record.id), normalizeFlowKey(record.behaviorKey ?? record.stateName ?? record.name));
    }
    const transitions: RunFlowPlanTransition[] = (graph.transitions ?? []).map((raw) => {
      const record = raw as Record<string, any>;
      const from = normalizeFlowKey(
        record.fromStateKey ?? record.from ?? record.sourceBehaviorKey ?? record.source
          ?? byId.get(String(record.fromStateId ?? record.fromNodeId ?? '')) ?? '',
      );
      const to = normalizeFlowKey(
        record.toStateKey ?? record.to ?? record.targetBehaviorKey ?? record.target
          ?? byId.get(String(record.toStateId ?? record.toNodeId ?? '')) ?? '',
      );
      return { from, to, action: record.action ? String(record.action) : null };
    }).filter((transition) => transition.from && transition.to);
    return {
      flowId: input.flowId,
      flowName: graph.name ?? null,
      versionId: input.expectedGraphVersionId,
      version: graph.version ?? null,
      purpose: graph.purpose ?? null,
      initialStateKey: states.find((state) => state.role === 'INITIAL')?.key ?? null,
      terminalStateKeys: states.filter((state) => state.role === 'TERMINAL').map((state) => state.key),
      states,
      transitions,
    };
  } catch {
    return null;
  }
}

let runCompletionInProgress = false;

async function completeActiveRun(completionReason: 'TERMINAL_STATE_REACHED' | 'MANUAL_STOP_BEFORE_TERMINAL') {
  if (runCompletionInProgress || !observer.getState()) return null;
  runCompletionInProgress = true;
  const before = observer.getState()!;
  const resolvedReason = completionReason === 'TERMINAL_STATE_REACHED'
    ? completionReason
    : before.phase === 'PRE_BOUNDARY' ? 'MANUAL_STOP_BEFORE_INITIAL' : 'MANUAL_STOP_BEFORE_TERMINAL';
  try {
    emitRunLifecycle(before, { phase: 'FINALIZING', localStatus: 'FINALIZING', completionReason: resolvedReason });
    const state = await observer.end();
    stopRunMaintenance();
    // Force the coalesced spool to disk before the recovery journal is written,
    // so a crash during synchronization cannot lose the final second of
    // capture — the one moment where staleness would actually cost evidence.
    persistSpoolNow(state.runId);
    writeLocalState(`qa-run-recovery:${state.runId}`, { state, completionReason: resolvedReason });
    emitRunLifecycle(state, {
      phase: 'COMPLETE', localStatus: 'CHROMIUM_CLOSED', cloudStatus: 'UPLOADING',
      completionReason: resolvedReason, terminalStateKey: resolvedReason === 'TERMINAL_STATE_REACHED' ? state.currentFlowStateKey : null,
      reportStatus: 'PENDING',
    });
    if (resolvedReason === 'TERMINAL_STATE_REACHED' && ElectronNotification.isSupported()) {
      new ElectronNotification({
        title: 'Terminal state reached',
        body: state.captureTracks?.includes('FRONTEND') === false
          ? 'Capture stopped and your QA report is being prepared.'
          : 'Chromium was closed and your QA report is being prepared.',
      }).show();
    }
    await relay.emit('QA_RUN_COMPLETED', { observationCount: state.observations.length, findingCount: state.findings.length, completionReason: resolvedReason });
    await applicationLauncher.stop();
    await relay.stop();
    activeRelayConnection = null;
    stopQaRunEventsStream();
    await flushEvidence(state.runId, true);
    await cloud.completeRun({ ...state, completionReason: resolvedReason });
    deleteLocalState(`qa-run-recovery:${state.runId}`);
    evidenceQueues.delete(state.runId);
    emitRunLifecycle(state, { cloudStatus: 'SYNCHRONIZED', completionReason: resolvedReason, reportStatus: 'PENDING' });
    return state;
  } catch (error) {
    emitRunLifecycle(before, {
      phase: 'COMPLETE', localStatus: 'CHROMIUM_CLOSED', cloudStatus: 'FAILED', completionReason: resolvedReason,
      reportStatus: 'PENDING', safeError: 'The browser closed safely, but evidence synchronization needs to be retried.',
    });
    throw error;
  } finally {
    runCompletionInProgress = false;
  }
}

function safeDesktopError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('UNSUPPORTED_DOCUMENT_TYPE')) return 'This file type is not supported.';
  if (message.includes('INVALID_DOCUMENT_SIZE')) return 'The file is empty or larger than 25 MB.';
  if (message.includes('STRUCTURED_DOCUMENT_IS_NOT_OPENAPI')) return 'JSON and YAML uploads must contain an OpenAPI document.';
  if (message.includes('FEATURE_NOT_ENTITLED')) return 'FEATURE_NOT_ENTITLED: Document flow inference is not included on this plan.';
  return message.replace(/^Error invoking remote method '[^']+':\s*/i, '').slice(0, 240) || 'Document import failed.';
}

type StoredWorkspace = {
  id: string;
  path: string;
  name: string;
  snapshot: RepositorySnapshotSummary;
  cloudId?: string;
  snapshotId?: string;
  branchPolicy?: BranchPolicy | null;
};

function qaBranchCheckpointKey(applicationId: string): string {
  return `workspace:qa-branch-checkpoint:${applicationId}`;
}

/**
 * Resolves the policy from the cloud, falling back to the copy cached with the
 * workspace so a member working offline still sees the branch requirement.
 */
async function resolveBranchPolicy(applicationId: string, cached: BranchPolicy | null | undefined) {
  try {
    return await cloud.branchPolicy(applicationId);
  } catch {
    return cached ?? null;
  }
}

/** Whether an unexpired MANAGE_QA_BRANCH grant covers this member's workspace. */
async function hasQaBranchGrant(applicationId: string, cloudWorkspaceId: string | undefined): Promise<boolean> {
  if (!cloudWorkspaceId) return false;
  try {
    const workspaces = await cloud.workspaces(applicationId);
    const mine = workspaces.find((workspace) => workspace.id === cloudWorkspaceId);
    const now = Date.now();
    return (mine?.permissions ?? []).some((grant) => (
      grant.permissionType === 'MANAGE_QA_BRANCH'
      && !grant.revokedAt
      && (!grant.expiresAt || new Date(grant.expiresAt).getTime() > now)
    ));
  } catch {
    return false;
  }
}

/** This member's workspace measured against the application's QA review branch policy. */
async function workspaceBranchCompliance(applicationId: string) {
  const stored = readLocalState<StoredWorkspace>(localWorkspaceKey(applicationId));
  if (!stored) return null;
  const policy = await resolveBranchPolicy(applicationId, stored.branchPolicy);
  return evaluateCompliance({
    workspaceRoot: stored.path,
    policy,
    agentCheckoutGranted: await hasQaBranchGrant(applicationId, stored.cloudId),
    aheadCount: stored.snapshot.aheadCount ?? null,
    behindCount: stored.snapshot.behindCount ?? null,
  });
}

function localWorkspaceKey(applicationId: string): string {
  const scope = cloud.localWorkspaceScope();
  if (!scope) throw new Error('AUTHENTICATION_REQUIRED');
  return `workspace:${scope}:${applicationId}`;
}

function codebaseAnalysisKey(applicationId: string): string {
  const scope = cloud.localWorkspaceScope();
  if (!scope) throw new Error('AUTHENTICATION_REQUIRED');
  return `codebase-analysis:${scope}:${applicationId}`;
}

/**
 * Local analysis state. Records which mode the workspace is in so a restart can
 * reconnect to a cloud job rather than silently duplicating it, and so a local
 * run that died with the process is recognised as interrupted instead of
 * reporting "parsing" for ever.
 */
type CodebaseAnalysisState = {
  mode: 'cloud' | 'local';
  cloudJobId: string | null;
  workspaceRoot: string;
  workspaceId: string;
  repositoryFingerprint: string;
  /**
   * The working tree this analysis describes, uncommitted edits included.
   *
   * `repositoryFingerprint` folds in the revision, so at a single commit it is
   * the same value for every possible set of local edits. Without this, the only
   * safe rule was "a dirty checkout is never current" — which meant anyone with
   * uncommitted work re-analysed, and re-consented, on every single Flow.
   */
  workingTreeHash: string | null;
  updatedAt: string;
  /** Present for local analyses; a cloud analysis is fetched from the API. */
  analysis: CodebaseAnalysis | null;
  uploadProgress: { sent: number; total: number } | null;
};

/**
 * The small facts about an analysis, stored apart from the analysis itself.
 *
 * Deciding whether a stored analysis still describes the folder on disk needs
 * five strings. Reading them used to mean decrypting and parsing the whole
 * record — every entity, relationship, feature and evidence excerpt of a real
 * repository — and that question is asked at the start of every Flow
 * initialization and once a second while one is waiting. The graph itself is
 * only ever needed when something is about to rank against it.
 */
type CodebaseAnalysisMeta = {
  mode: 'cloud' | 'local';
  cloudJobId: string | null;
  workspaceRoot: string;
  workspaceId: string;
  repositoryFingerprint: string;
  workingTreeHash: string | null;
  analysisId: string | null;
  graphVersion: string | null;
  contentHash: string | null;
  revision: string | null;
  branch: string | null;
  dirty: boolean;
  status: CodebaseAnalysis['status'] | null;
  updatedAt: string;
};

function codebaseAnalysisMetaKey(applicationId: string): string {
  const scope = cloud.localWorkspaceScope();
  if (!scope) throw new Error('AUTHENTICATION_REQUIRED');
  return `codebase-analysis-meta:${scope}:${applicationId}`;
}

function analysisMetaOf(state: CodebaseAnalysisState): CodebaseAnalysisMeta {
  return {
    mode: state.mode,
    cloudJobId: state.cloudJobId,
    workspaceRoot: state.workspaceRoot,
    workspaceId: state.workspaceId,
    repositoryFingerprint: state.repositoryFingerprint,
    workingTreeHash: state.workingTreeHash,
    analysisId: state.analysis?.id ?? null,
    graphVersion: state.analysis?.graphVersion ?? null,
    contentHash: state.analysis?.contentHash ?? null,
    revision: state.analysis?.revision ?? null,
    branch: state.analysis?.branch ?? null,
    dirty: Boolean(state.analysis?.dirty),
    status: state.analysis?.status ?? null,
    updatedAt: new Date().toISOString(),
  };
}

function readAnalysisMeta(applicationId: string): CodebaseAnalysisMeta | null {
  try {
    const meta = readLocalState<CodebaseAnalysisMeta>(codebaseAnalysisMetaKey(applicationId));
    if (meta) return meta;
  } catch {
    // Fall through: an older install has no meta row yet.
  }
  // Derive it once from the full record so an existing install does not
  // re-analyse simply because the cheap copy did not exist yet.
  const state = readAnalysisState(applicationId);
  if (!state) return null;
  const derived = analysisMetaOf(state);
  try {
    writeLocalState(codebaseAnalysisMetaKey(applicationId), derived);
  } catch {
    // Best effort; the next write will try again.
  }
  return derived;
}

function codebaseCacheKey(applicationId: string): string {
  const scope = cloud.localWorkspaceScope();
  if (!scope) throw new Error('AUTHENTICATION_REQUIRED');
  return `codebase-cache:${scope}:${applicationId}`;
}

/** The analysis before the current one, kept so Changes works without the cloud. */
function codebasePreviousKey(applicationId: string): string {
  const scope = cloud.localWorkspaceScope();
  if (!scope) throw new Error('AUTHENTICATION_REQUIRED');
  return `codebase-previous:${scope}:${applicationId}`;
}

function readPreviousAnalysis(applicationId: string): CodebaseAnalysis | null {
  try {
    return readLocalState<CodebaseAnalysis>(codebasePreviousKey(applicationId));
  } catch {
    return null;
  }
}

/** Entity and feature collections the views ask for, filtered the same way the API filters them. */
function localCollection(analysis: CodebaseAnalysis, collection: string, search: string): unknown[] {
  const ofType = (...types: CodeEntity['type'][]) =>
    analysis.entities.filter((entity) => types.includes(entity.type));
  const all: unknown[] =
    collection === 'features' ? analysis.features
      : collection === 'domains' ? analysis.architecture?.domains ?? []
        : collection === 'endpoints' ? ofType('endpoint')
          : collection === 'ui-routes' ? ofType('ui_route', 'ui_action')
            : collection === 'data-stores' ? ofType('database_model', 'database_table')
              : collection === 'events' ? ofType('event', 'queue', 'job')
                : collection === 'external-systems' ? ofType('external_service')
                  : collection === 'findings' ? analysis.findings
                    : collection === 'coupling' ? analysis.architecture?.coupling ?? []
                      : [];
  const needle = search.trim().toLowerCase();
  if (!needle) return all;
  return all.filter((item) => JSON.stringify(item).toLowerCase().includes(needle));
}

function readAnalysisState(applicationId: string): CodebaseAnalysisState | null {
  try {
    return readLocalState<CodebaseAnalysisState>(codebaseAnalysisKey(applicationId));
  } catch {
    return null;
  }
}

function writeAnalysisState(applicationId: string, state: CodebaseAnalysisState): void {
  const next = { ...state, updatedAt: new Date().toISOString() };
  writeLocalState(codebaseAnalysisKey(applicationId), next);
  // Written together so the cheap copy can never describe a different analysis
  // than the expensive one.
  writeLocalState(codebaseAnalysisMetaKey(applicationId), analysisMetaOf(next));
}

function patchLocalAnalysis(applicationId: string, patch: Partial<CodebaseAnalysis>): void {
  const state = readAnalysisState(applicationId);
  if (!state?.analysis) return;
  writeAnalysisState(applicationId, { ...state, analysis: { ...state.analysis, ...patch } });
}

/**
 * The tree an analysis is about to describe.
 *
 * Prefers the value the scan already computed, and measures it directly when the
 * snapshot predates that field — otherwise a folder attached before the hash
 * existed would record null, never match on the next launch, and re-analyse
 * forever.
 */
function workingTreeHashOf(root: string, snapshot: RepositorySnapshotSummary): string | null {
  if (snapshot.workingTreeHash) return snapshot.workingTreeHash;
  try {
    return workingTreeIdentity(root);
  } catch {
    return null;
  }
}

function pendingAnalysis(snapshot: RepositorySnapshotSummary, message: string): CodebaseAnalysis {
  return {
    id: `pending:${snapshot.repositoryFingerprint.slice(0, 24)}`,
    workspaceId: snapshot.workspaceId,
    repositoryFingerprint: snapshot.repositoryFingerprint,
    graphVersion: '',
    analyzerVersions: {},
    status: 'QUEUED',
    progress: 0,
    stageMessage: message,
    startedAt: new Date().toISOString(),
    completedAt: null,
    revision: snapshot.revision,
    branch: snapshot.branch,
    dirty: snapshot.dirty,
    contentHash: '',
    entities: [], relationships: [], features: [], findings: [],
    architecture: null, coverage: null, incremental: null, explanations: [],
    warnings: [], notices: [],
    summary: {
      files: 0, symbols: 0, relationships: 0, applications: 0, services: 0,
      domains: 0, features: 0, endpoints: 0, dataModels: 0, events: 0,
      externalServices: 0, tests: 0, coveragePercent: 0, confidence: 0,
    },
  };
}

/**
 * An analysis runs over a copy of the source (the worker's input, or an archive
 * extracted in the cloud) that carries no Git metadata, so the branch and
 * revision recorded when the snapshot was taken are the source of truth.
 */
function withSnapshotGitDetails<T extends CodebaseAnalysis | null>(
  analysis: T,
  snapshot: { revision?: string | null; branch?: string | null } | null | undefined,
): T {
  if (!analysis || !snapshot) return analysis;
  return {
    ...analysis,
    revision: analysis.revision ?? snapshot.revision ?? null,
    branch: analysis.branch ?? snapshot.branch ?? null,
  };
}

/**
 * Whether the folder sits inside a Git working tree, found by looking for `.git`
 * up the tree. Lets the UI tell "not a repository" from "Git could not be read"
 * (git missing from PATH, or a repository Git refuses as unsafe).
 */
function hasGitDirectory(root: string | null | undefined): boolean {
  if (!root) return false;
  let current = path.resolve(root);
  for (;;) {
    if (existsSync(path.join(current, '.git'))) return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

/**
 * Run the analyzer in a worker thread so a large repository cannot block the
 * Electron main process. Cached fragments from the previous run are handed in
 * so a rescan only re-analyses what actually changed.
 */
function beginLocalCodebaseAnalysis(
  applicationId: string,
  root: string,
  snapshot: RepositorySnapshotSummary,
): void {
  void codebaseWorkers.get(applicationId)?.terminate().catch(() => undefined);

  writeAnalysisState(applicationId, {
    mode: 'local',
    cloudJobId: null,
    workspaceRoot: root,
    workspaceId: snapshot.workspaceId,
    repositoryFingerprint: snapshot.repositoryFingerprint,
    workingTreeHash: workingTreeHashOf(root, snapshot),
    updatedAt: new Date().toISOString(),
    analysis: pendingAnalysis(snapshot, 'Queued for local analysis'),
    uploadProgress: null,
  });

  let cache: unknown = null;
  try {
    cache = readLocalState(codebaseCacheKey(applicationId));
  } catch {
    cache = null;
  }

  const worker = new Worker(path.join(__dirname, 'codebase-worker.js'), {
    workerData: {
      root,
      workspaceId: snapshot.workspaceId,
      repositoryFingerprint: snapshot.repositoryFingerprint,
      cache,
    },
  });
  codebaseWorkers.set(applicationId, worker);

  worker.on('message', (message: {
    type?: string;
    analysis?: CodebaseAnalysis;
    cache?: unknown;
    status?: CodebaseAnalysis['status'];
    progress?: number;
    stageMessage?: string;
    message?: string;
  }) => {
    if (message.type === 'progress') {
      patchLocalAnalysis(applicationId, {
        status: message.status,
        progress: message.progress,
        stageMessage: message.stageMessage,
      });
    } else if (message.type === 'complete' && message.analysis) {
      const state = readAnalysisState(applicationId);
      // Keep the analysis this one replaces, but only when it described a
      // different revision - overwriting it with a rerun of the same tree would
      // leave nothing to compare against.
      const outgoing = state?.analysis;
      if (outgoing?.entities.length && outgoing.contentHash !== message.analysis.contentHash) {
        try {
          writeLocalState(codebasePreviousKey(applicationId), outgoing);
        } catch (error) {
          console.warn('[codebase-analysis] Could not retain the previous analysis', error);
        }
      }
      if (state) {
        writeAnalysisState(applicationId, {
          ...state,
          analysis: withSnapshotGitDetails(message.analysis, snapshot),
        });
      }
      if (message.cache) {
        try {
          writeLocalState(codebaseCacheKey(applicationId), message.cache);
        } catch (error) {
          console.warn('[codebase-analysis] Could not persist the incremental cache', error);
        }
      }
      settleLocalAnalysis(applicationId, { ok: true });
    } else if (message.type === 'error') {
      patchLocalAnalysis(applicationId, {
        status: 'FAILED',
        stageMessage: String(message.message ?? 'Analysis failed').slice(0, 240),
        completedAt: new Date().toISOString(),
      });
      settleLocalAnalysis(applicationId, { ok: false, message: String(message.message ?? 'Analysis failed') });
    }
  });
  worker.once('exit', () => {
    codebaseWorkers.delete(applicationId);
    // A worker that exits without having reported either outcome died; nobody
    // waiting on it should be left waiting for the timeout to notice.
    settleLocalAnalysis(applicationId, { ok: false, message: 'FLOW_CODEBASE_ANALYSIS_FAILED' });
  });
  worker.once('error', (error) => {
    patchLocalAnalysis(applicationId, {
      status: 'FAILED',
      stageMessage: error.message.slice(0, 240),
      completedAt: new Date().toISOString(),
    });
    settleLocalAnalysis(applicationId, { ok: false, message: error.message });
  });
}

const ACTIVE_ANALYSIS = new Set([
  'QUEUED', 'INGESTING', 'PARSING', 'LINKING', 'GRAPHING',
  'DISCOVERING_FEATURES', 'ANALYZING_ARCHITECTURE', 'SUMMARIZING',
]);

/**
 * A local analysis lives in a worker thread, so it cannot outlive the process.
 * Anything still marked active on startup is finished by restarting it against
 * the same workspace, and the stage message says so. A cloud analysis needs
 * none of this: the job kept running and is simply polled again.
 */
function resumeInterruptedAnalyses(): void {
  for (const [applicationId, workspace] of selectedWorkspaces) {
    const state = readAnalysisState(applicationId);
    if (!state || state.mode !== 'local') continue;
    if (!state.analysis || !ACTIVE_ANALYSIS.has(state.analysis.status)) continue;
    if (codebaseWorkers.has(applicationId)) continue;
    if (!existsSync(workspace.root)) continue;
    patchLocalAnalysis(applicationId, {
      stageMessage: 'Restarting after the desktop was closed mid-analysis',
    });
    beginLocalCodebaseAnalysis(applicationId, workspace.root, workspace.snapshot);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * In-flight consent prompts, keyed by request id. The renderer owns the dialog,
 * so the answer arrives over IPC rather than from a blocking native call.
 */
const pendingUploadConsents = new Map<string, (consented: boolean) => void>();

/**
 * Settle every outstanding prompt as "keep local". Called when the window goes
 * away: a consent that can no longer be given must never read as given, and the
 * attach that is awaiting it must not hang forever.
 */
function cancelPendingUploadConsents(): void {
  for (const resolve of pendingUploadConsents.values()) resolve(false);
  pendingUploadConsents.clear();
}

/**
 * Ask before any source leaves the device, showing what would actually be sent:
 * compressed size, file count, what was redacted, and what was excluded. The
 * archive is planned first precisely so those numbers are real rather than a
 * general promise.
 *
 * The prompt is rendered in-app rather than as a native message box, so it can
 * lay the figures out properly and match the rest of the application. Anything
 * that prevents the question being asked and answered — no window, a preview
 * that cannot be planned, a window that closes — resolves to "keep local",
 * because the safe default is that nothing is uploaded.
 */
async function requestUploadConsent(
  applicationId: string,
  selectedPath: string,
  snapshot: RepositorySnapshotSummary,
): Promise<boolean> {
  let preview: SourceArchivePreview;
  try {
    preview = await previewSourceArchiveInWorker(selectedPath);
  } catch {
    return false;
  }
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  const requestId = crypto.randomUUID();
  const request: CodebaseUploadConsentRequest = {
    requestId,
    applicationId,
    workspaceName: path.basename(selectedPath),
    fileCount: preview.fileCount,
    compressedBytes: preview.compressedBytes,
    repositoryLabel: snapshot.repositoryOriginHash
      ? 'the repository bound to this application'
      : 'this local folder',
    branch: snapshot.branch ?? null,
    revision: snapshot.revision ?? null,
    dirty: Boolean(snapshot.dirty),
    languages: preview.languages.map((item: { language: string }) => item.language).slice(0, 5),
    redactions: preview.redactions,
    redactedFiles: preview.redactedFiles,
    exclusions: Object.entries(preview.excludedByReason)
      .filter(([, count]) => Number(count) > 0)
      .map(([reason, count]) => ({ reason: reason.replaceAll('-', ' '), count: Number(count) })),
    truncated: Boolean(preview.truncated),
    purpose: 'CODEBASE_ANALYSIS',
  };

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (consented: boolean) => {
      if (settled) return;
      settled = true;
      pendingUploadConsents.delete(requestId);
      resolve(consented);
    };
    pendingUploadConsents.set(requestId, settle);
    mainWindow!.webContents.send(IPC.uploadConsentRequested, request);
  });
}

/** One candidate's source, as it would be sent: bounded, and already redacted. */
type FlowMappingExcerpt = {
  candidateId: string;
  path: string;
  startLine: number | null;
  endLine: number | null;
  content: string;
  redactions: number;
};

/**
 * Rank the Flow and read its candidates' lines in a worker.
 *
 * Both halves are proportional to the size of the repository, and neither needs
 * the main process. Running them there froze the window for long enough that
 * Windows offered to close the app.
 */
/**
 * How much of a shortlist is worth sending.
 *
 * Retrieval returns up to eight candidates per checkpoint; a resolver only ever
 * weighs the top few, and a Flow can declare fifty checkpoints. These bounds
 * keep a large Flow's submission proportionate without narrowing the shortlist
 * the user reviews, which is rebuilt from the same candidates server-side.
 */
const MAX_CANDIDATES_PER_CHECKPOINT = 6;
/**
 * Source travels only for the candidates a resolver is actually choosing
 * between. Below the top few the excerpt is not read and not cited; it is only
 * prompt weight, and prompt weight is what made resolution fail outright.
 */
const MAX_EXCERPTS_PER_CHECKPOINT = 3;
const MAX_EXCERPT_CHARS = 3_000;

/**
 * Stable ids for the evidence a candidate rests on.
 *
 * Mirrors what the server derives when a bundle omits them, so a citation means
 * the same thing either way — but computed here, the evidence records
 * themselves no longer have to be sent to produce it.
 */
function evidenceIdsFor(candidate: { entityId?: string; id: string; path?: string; evidence?: Array<{ analyzer?: string; path?: string; startLine?: number | null }> }): string[] {
  const derived = (candidate.evidence ?? []).slice(0, 8).map((item, index) =>
    `${item.analyzer ?? 'analysis'}:${item.path ?? candidate.path ?? ''}:${item.startLine ?? index}`);
  return derived.length ? derived : [`entity:${candidate.entityId ?? candidate.id}`];
}

type FlowMappingRequest = {
  resolve: (value: { retrieval: any; excerpts: FlowMappingExcerpt[] }) => void;
  reject: (error: Error) => void;
  onProgress?: (completed: number, total: number) => void;
};

type FlowMappingWorkerEntry = {
  worker: Worker;
  /** The analysis this worker is currently holding, if any. */
  analysisId: string | null;
  pending: Map<string, FlowMappingRequest>;
};

/**
 * One mapping worker per application, kept between runs.
 *
 * A worker per run meant structured-cloning the entire analysis graph across the
 * thread boundary and rebuilding the term index from nothing, every time. That
 * is the whole reason initializing a second Flow against an unchanged codebase
 * cost as much as the first. Keeping the worker means the graph crosses once per
 * analysis and the index is built once per analysis.
 */
const flowMappingWorkers = new Map<string, FlowMappingWorkerEntry>();

function flowMappingWorkerFor(applicationId: string): FlowMappingWorkerEntry {
  const existing = flowMappingWorkers.get(applicationId);
  if (existing) return existing;

  const worker = new Worker(path.join(__dirname, 'flow-mapping-worker.js'));
  const entry: FlowMappingWorkerEntry = { worker, analysisId: null, pending: new Map() };

  const failAll = (error: Error) => {
    for (const request of entry.pending.values()) request.reject(error);
    entry.pending.clear();
    entry.analysisId = null;
    if (flowMappingWorkers.get(applicationId) === entry) flowMappingWorkers.delete(applicationId);
  };

  worker.on('message', (message: {
    type: string; requestId?: string; retrieval?: any; excerpts?: FlowMappingExcerpt[];
    message?: string; completed?: number; total?: number;
  }) => {
    if (message.type === 'analysis-ready') return;
    const request = message.requestId ? entry.pending.get(message.requestId) : undefined;
    if (!request) return;
    if (message.type === 'progress') {
      request.onProgress?.(Number(message.completed ?? 0), Number(message.total ?? 0));
      return;
    }
    entry.pending.delete(message.requestId!);
    if (message.type === 'complete') request.resolve({ retrieval: message.retrieval, excerpts: message.excerpts ?? [] });
    else request.reject(new Error(message.message ?? 'FLOW_MAPPING_RETRIEVAL_FAILED'));
  });
  worker.on('error', (error) => failAll(error));
  worker.on('exit', (code) => failAll(new Error(`FLOW_MAPPING_RETRIEVAL_FAILED:${code}`)));
  // A worker that outlives its run must not be the reason the process cannot.
  worker.unref();

  flowMappingWorkers.set(applicationId, entry);
  return entry;
}

function runFlowMappingRetrieval(input: {
  applicationId: string;
  analysisId: string;
  /** Called only when the worker is not already holding this analysis. */
  loadAnalysis: () => CodebaseAnalysis;
  flow: unknown;
  workspaceRoot: string;
  onProgress?: (completed: number, total: number) => void;
}): Promise<{ retrieval: any; excerpts: FlowMappingExcerpt[] }> {
  const entry = flowMappingWorkerFor(input.applicationId);
  if (entry.analysisId !== input.analysisId) {
    // Messages are delivered in order, so the map request below is guaranteed to
    // be handled after the analysis it needs has been loaded.
    entry.worker.postMessage({ type: 'analysis', analysisId: input.analysisId, analysis: input.loadAnalysis() });
    entry.analysisId = input.analysisId;
  }
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    entry.pending.set(requestId, { resolve, reject, onProgress: input.onProgress });
    entry.worker.postMessage({ type: 'map', requestId, flow: input.flow, workspaceRoot: input.workspaceRoot });
  });
}

/**
 * The excerpt-sharing decision, remembered for the folder it was made about.
 *
 * Scoped to the workspace rather than the application: the decision is about a
 * body of source on this device, and re-attaching a different folder is a
 * different question.
 */
function flowMappingConsentKey(applicationId: string): string {
  const scope = cloud.localWorkspaceScope();
  if (!scope) throw new Error('AUTHENTICATION_REQUIRED');
  const workspace = selectedWorkspaces.get(applicationId);
  return `flow-mapping-consent:${scope}:${workspace?.localId ?? applicationId}`;
}

function readFlowMappingConsent(applicationId: string): boolean | null {
  try {
    const stored = readLocalState<{ granted: boolean }>(flowMappingConsentKey(applicationId));
    return typeof stored?.granted === 'boolean' ? stored.granted : null;
  } catch {
    return null;
  }
}

async function requestFlowMappingAiConsent(
  applicationId: string,
  flowName: string,
  extracted: FlowMappingExcerpt[],
): Promise<boolean> {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (!extracted.length) return false;
  // Asked once per folder. The dialog names the files and line ranges that would
  // be sent, so the first answer is an informed one — but it sat in the middle
  // of every mapping run, which meant the user had to be watching for a pipeline
  // that otherwise needs nobody, on every Flow and every re-run.
  const remembered = readFlowMappingConsent(applicationId);
  if (remembered !== null) return remembered;
  // The dialog lists the files and line ranges that would be sent, so what is
  // shown is exactly what leaves the device — not a sample of it.
  const excerpts = [...new Map(extracted.map((item) => [item.path, {
    path: item.path, startLine: item.startLine, endLine: item.endLine,
  }])).values()].slice(0, 5);
  const requestId = crypto.randomUUID();
  const request: CodebaseUploadConsentRequest = {
    requestId, applicationId, workspaceName: flowName, fileCount: excerpts.length,
    compressedBytes: Buffer.byteLength(extracted.map((item) => item.content).join('\n')),
    repositoryLabel: 'the attached local-only workspace', branch: null, revision: null, dirty: true,
    languages: [], redactions: extracted.reduce((total, item) => total + item.redactions, 0),
    redactedFiles: new Set(extracted.filter((item) => item.redactions > 0).map((item) => item.path)).size,
    exclusions: [], truncated: extracted.length > excerpts.length, purpose: 'FLOW_MAPPING_AI', flowName, excerpts,
  };
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (consented: boolean) => {
      if (settled) return;
      settled = true;
      pendingUploadConsents.delete(requestId);
      try {
        writeLocalState(flowMappingConsentKey(applicationId), { granted: consented, decidedAt: new Date().toISOString() });
      } catch {
        // Failing to remember the answer only costs one more prompt.
      }
      resolve(consented);
    };
    pendingUploadConsents.set(requestId, settle);
    mainWindow!.webContents.send(IPC.uploadConsentRequested, request);
  });
}

/** Backs off rather than asking a remote job the same question every second. */
function cloudPollDelay(attempt: number): number {
  if (attempt < 3) return 2_000;
  if (attempt < 8) return 5_000;
  return 10_000;
}

async function waitForCodebaseAnalysis(applicationId: string, timeoutMs = 10 * 60_000): Promise<CodebaseAnalysisMeta> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    const meta = readAnalysisMeta(applicationId);

    if (meta?.mode === 'cloud' && meta.cloudJobId) {
      const remote = await cloud.getCodebaseAnalysis(applicationId).catch(() => null) as Record<string, any> | null;
      if (remote?.analysis && ['COMPLETED', 'PARTIAL'].includes(String(remote.status))) {
        const state = readAnalysisState(applicationId);
        if (!state) throw new Error('FLOW_CURRENT_CODEBASE_ANALYSIS_REQUIRED');
        const next = { ...state, analysis: remote.analysis as CodebaseAnalysis, uploadProgress: null };
        writeAnalysisState(applicationId, next);
        return analysisMetaOf(next);
      }
      if (remote && ['FAILED', 'CANCELLED'].includes(String(remote.status))) throw new Error('FLOW_CODEBASE_ANALYSIS_FAILED');
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, cloudPollDelay(attempt)));
      continue;
    }

    if (meta?.status && ['COMPLETED', 'PARTIAL'].includes(meta.status)) return meta;
    if (meta?.status && ['FAILED', 'CANCELLED'].includes(meta.status)) throw new Error('FLOW_CODEBASE_ANALYSIS_FAILED');

    // A local analysis is a worker this process owns, so its completion arrives
    // as an event. The timeout still applies, for a worker that hangs rather
    // than finishing or failing.
    if (codebaseWorkers.has(applicationId)) {
      const settled = await Promise.race([
        whenLocalAnalysisSettles(applicationId),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), Math.max(0, deadline - Date.now()))),
      ]);
      if (!settled) break;
      if (!settled.ok) throw new Error('FLOW_CODEBASE_ANALYSIS_FAILED');
      const current = readAnalysisMeta(applicationId);
      if (current?.status && ['COMPLETED', 'PARTIAL'].includes(current.status)) return current;
      throw new Error('FLOW_CODEBASE_ANALYSIS_FAILED');
    }

    // No worker and no finished analysis: something started it and died, or it
    // has not been written yet. Give the write a moment, then give up.
    attempt += 1;
    if (attempt > 5) throw new Error('FLOW_CODEBASE_ANALYSIS_FAILED');
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('FLOW_CODEBASE_ANALYSIS_TIMEOUT');
}

/**
 * The analysis already on disk, if it describes the tree that is there now.
 *
 * Deliberately side-effect free: the caller decides whether a miss is worth
 * starting an upload and a consent prompt for. Separating the question from the
 * action is what lets Flow initialization create its record first and do the
 * expensive part in the background.
 */
function readCurrentFlowCodebaseAnalysis(applicationId: string): CodebaseAnalysisMeta | null {
  const workspace = selectedWorkspaces.get(applicationId);
  if (!workspace?.cloudId || !workspace.snapshotId) return null;
  const meta = readAnalysisMeta(applicationId);
  if (!meta?.status || !['COMPLETED', 'PARTIAL'].includes(meta.status)) return null;
  // Measure the tree now rather than trusting the snapshot taken when the folder
  // was attached. That snapshot is restored from disk on launch and never
  // refreshed, so comparing against it would both miss real edits made between
  // sessions and — for a folder attached before this hash existed — never match,
  // re-analysing on every single run.
  let liveTree: string | null = null;
  try {
    liveTree = workingTreeIdentity(workspace.root);
  } catch {
    liveTree = null;
  }
  const current = Boolean(
    meta.repositoryFingerprint === workspace.snapshot.repositoryFingerprint
    && liveTree && meta.workingTreeHash === liveTree,
  );
  return current ? meta : null;
}

async function currentFlowCodebaseAnalysis(applicationId: string): Promise<CodebaseAnalysisMeta> {
  const workspace = selectedWorkspaces.get(applicationId);
  if (!workspace?.cloudId || !workspace.snapshotId) throw new Error('FLOW_WORKSPACE_SCAN_REQUIRED');
  // An analysis is current when it describes the tree that is on disk now. A
  // dirty checkout is allowed to be current, as long as it is the *same* dirty
  // checkout: requiring a clean tree meant anyone mid-change re-analysed, and
  // re-consented, on every Flow.
  const existing = readCurrentFlowCodebaseAnalysis(applicationId);
  if (existing) return existing;

  const meta = readAnalysisMeta(applicationId);
  // An analysis already running for this workspace is the one to wait for;
  // starting a second would throw away the first and its incremental cache.
  if (!codebaseWorkers.has(applicationId)) {
    if (meta?.mode === 'cloud') {
      await beginCodebaseAnalysisWithConsent(applicationId, workspace.root, workspace.snapshot, {
        workspaceId: workspace.cloudId, repositorySnapshotId: workspace.snapshotId,
      });
    } else {
      beginLocalCodebaseAnalysis(applicationId, workspace.root, workspace.snapshot);
    }
  }
  const settled = await waitForCodebaseAnalysis(applicationId);
  if (settled.repositoryFingerprint !== workspace.snapshot.repositoryFingerprint) {
    throw new Error('FLOW_CURRENT_CODEBASE_ANALYSIS_REQUIRED');
  }
  return settled;
}

/**
 * The document retrieval ranks against.
 *
 * Checkpoint identity comes from the initialization's own findings, because the
 * manifest the server will match against was built from the published version's
 * snapshot — using anything else risks a checkpoint id the server rejects. The
 * declared Flow supplies the semantics that snapshot does not carry forward:
 * a state's category and canonical behaviour, a transition's condition, and the
 * Flow's purpose and scope. Those are exactly the fields the query builder
 * weights context on, so leaving them null quietly halves the ranking signal.
 */
function flowInputFromInitialization(initialization: Record<string, any>, detail: DeclaredFlowDetail | null) {
  const report = initialization.codeReviewReport ?? {};
  const declaredStates = new Map((detail?.states ?? []).map((item) => [String(item.id), item]));
  const declaredTransitions = new Map((detail?.transitions ?? []).map((item) => [String(item.id), item]));
  return {
    id: String(initialization.flowId),
    name: String(detail?.name ?? initialization.manifest?.flowName ?? initialization.flow?.name ?? 'Flow'),
    purpose: detail?.purpose ?? null,
    scopeStatement: detail?.scopeStatement ?? null,
    tags: detail?.tags ?? null,
    states: (report.stateFindings ?? []).map((item: any) => {
      const declared = declaredStates.get(String(item.stateId));
      return {
        id: String(item.stateId),
        stateName: String(declared?.stateName ?? item.stateName ?? item.stateId),
        category: declared?.category ?? item.category ?? null,
        role: declared?.role ?? item.role ?? null,
        terminalKind: declared?.terminalKind ?? item.terminalKind ?? null,
        canonicalBehavior: declared?.canonicalBehavior ?? null,
      };
    }),
    transitions: (report.transitionFindings ?? []).map((item: any) => {
      const declared = declaredTransitions.get(String(item.transitionId));
      return {
        id: String(item.transitionId),
        fromStateId: String(item.fromStateId),
        toStateId: String(item.toStateId),
        action: declared?.action ?? item.action ?? null,
        condition: declared?.condition ?? null,
      };
    }),
  } as any;
}

/**
 * Tell the waiting window which stage mapping has reached.
 *
 * Analysis of a large repository runs for minutes, and a banner that never
 * changes across that reads as a hang. This is reported rather than inferred
 * because only this process knows which step it is on — and it is deliberately
 * fire-and-forget: a progress update that failed must never be the reason a
 * mapping run fails.
 */
function reportFlowMappingProgress(
  initializationId: string,
  status: 'WAITING_FOR_ANALYSIS' | 'RETRIEVING' | 'CONTEXTUALIZING' | 'RESOLVING' | 'FAILED',
  totalCheckpoints: number,
  message: string,
  completedCheckpoints = 0,
): void {
  void cloud.reportFlowMappingProgress(initializationId, {
    status, completedCheckpoints, totalCheckpoints,
    resolvedCount: 0, ambiguousCount: 0,
    unresolvedCount: Math.max(0, totalCheckpoints - completedCheckpoints), unsupportedCount: 0,
    message, updatedAt: new Date().toISOString(),
  }).catch(() => undefined);
}

/**
 * Report at most one update per interval.
 *
 * Retrieval finishes a checkpoint every few milliseconds and each report is a
 * network round trip, so sending one per checkpoint would put more load on the
 * run than the ranking it is describing. A second is well below what reads as
 * stalled and well above what reads as chatter.
 */
const FLOW_MAPPING_PROGRESS_INTERVAL_MS = 1_000;

function throttledCheckpointProgress(
  initializationId: string,
  message: (completed: number, total: number) => string,
): (completed: number, total: number) => void {
  let lastSentAt = 0;
  return (completed, total) => {
    const now = Date.now();
    // The last checkpoint always reports, so the bar never stops one short.
    if (completed < total && now - lastSentAt < FLOW_MAPPING_PROGRESS_INTERVAL_MS) return;
    lastSentAt = now;
    reportFlowMappingProgress(initializationId, 'RETRIEVING', total, message(completed, total), completed);
  };
}

/**
 * Run mapping for an initialization that already exists, without blocking the
 * caller on it.
 *
 * Every failure has to land somewhere the user can see, because nobody is
 * awaiting this promise. Progress — including the failure — is reported against
 * the initialization the window is polling, so a run that dies still changes
 * what the page says instead of leaving a banner spinning forever.
 */
function beginFlowMappingInBackground(applicationId: string, initialization: Record<string, any>): void {
  const initializationId = String(initialization.id ?? '');
  if (!initializationId) return;
  void submitCurrentFlowMappings(applicationId, initialization).catch((error) => {
    const code = error instanceof Error ? error.message : 'FLOW_MAPPING_FAILED';
    console.warn('[flow-mapping] mapping run failed', code);
    const checkpointCount = Array.isArray(initialization.manifest?.checkpoints) ? initialization.manifest.checkpoints.length : 0;
    reportFlowMappingProgress(initializationId, 'FAILED', checkpointCount, flowMappingFailureMessage(code));
  });
}

/**
 * Say what went wrong in the user's terms — and when there are no such terms,
 * say the code rather than something unactionable.
 *
 * A bare "try again" for a cause that will recur on every attempt is worse than
 * useless: it sends the user round a loop and leaves nobody, including whoever
 * has to fix it, any better informed. Codes are internal identifiers, never
 * source text, so they are safe to show.
 */
function flowMappingFailureMessage(code: string): string {
  if (code.includes('FLOW_WORKSPACE_SCAN_REQUIRED')) return 'Attach a project folder before mapping this Flow.';
  if (code.includes('FLOW_CODEBASE_ANALYSIS_TIMEOUT')) return 'Analysing your code took too long. Try again.';
  if (code.includes('FLOW_CODEBASE_ANALYSIS_FAILED')) return 'Your code could not be analysed. Try re-scanning the folder.';
  if (code.includes('FLOW_CURRENT_CODEBASE_ANALYSIS_REQUIRED')) return 'Your code changed while it was being analysed. Try again.';
  if (code.includes('FLOW_CODE_MAPPING_V2_DISABLED')) return 'Evidence-grounded mapping is turned off on this server.';
  if (code.includes('FLOW_MAPPING_BUNDLE_TOO_LARGE')) return 'This Flow produced more evidence than the server accepts. Re-run the analysis.';
  if (code.includes('ALL_FLOW_CHECKPOINT_MAPPINGS_REQUIRED')) return 'Mapping did not cover every checkpoint in this Flow. Re-run the analysis.';
  const safe = code.replace(/\s+/g, ' ').trim().slice(0, 140);
  return safe ? `Mapping could not be completed (${safe}).` : 'Mapping could not be completed. Try again.';
}

async function submitCurrentFlowMappings(applicationId: string, initialization: Record<string, any>) {
  const workspace = selectedWorkspaces.get(applicationId);
  if (!workspace?.root) throw new Error('FLOW_WORKSPACE_SCAN_REQUIRED');
  const initializationId = String(initialization.id);
  const checkpointCount = Array.isArray(initialization.manifest?.checkpoints) ? initialization.manifest.checkpoints.length : 0;
  const progress = (status: Parameters<typeof reportFlowMappingProgress>[1], message: string) =>
    reportFlowMappingProgress(initializationId, status, checkpointCount, message);
  progress('WAITING_FOR_ANALYSIS', 'Checking that the analysis matches your current code');
  try {
    const meta = await currentFlowCodebaseAnalysis(applicationId);
    if (!meta.analysisId) throw new Error('FLOW_CURRENT_CODEBASE_ANALYSIS_REQUIRED');
    return await runFlowMappingSubmission(applicationId, initialization, workspace.root, meta, progress);
  } catch (error) {
    progress('FAILED', 'Mapping could not be completed');
    throw error;
  }
}

async function runFlowMappingSubmission(
  applicationId: string,
  initialization: Record<string, any>,
  workspaceRoot: string,
  meta: CodebaseAnalysisMeta,
  progress: (status: 'WAITING_FOR_ANALYSIS' | 'RETRIEVING' | 'CONTEXTUALIZING' | 'RESOLVING' | 'FAILED', message: string) => void,
) {
  progress('RETRIEVING', 'Searching the analysed codebase for each checkpoint');
  // Enrichment only: a Flow that cannot be fetched still maps, just with less
  // context, so this must never be the thing that fails initialization.
  const detail = await cloud.declaredFlow(applicationId, String(initialization.flowId)).catch(() => null);
  const initializationId = String(initialization.id);
  const { retrieval, excerpts: extracted } = await runFlowMappingRetrieval({
    applicationId,
    analysisId: meta.analysisId!,
    // Only read when the worker does not already hold this analysis, which is
    // the point: the multi-megabyte record stays on disk for every run after the
    // first against the same tree.
    loadAnalysis: () => {
      const state = readAnalysisState(applicationId);
      if (!state?.analysis) throw new Error('FLOW_CURRENT_CODEBASE_ANALYSIS_REQUIRED');
      return state.analysis;
    },
    flow: flowInputFromInitialization(initialization, detail),
    workspaceRoot,
    onProgress: throttledCheckpointProgress(
      initializationId,
      (completed, total) => `Searching your code for each checkpoint (${completed} of ${total})`,
    ),
  });
  progress('CONTEXTUALIZING', 'Reading the shortlisted files');
  const excerpts = new Map(extracted.map((item) => [item.candidateId, item]));
  let consentMode = meta.mode === 'cloud' ? 'CLOUD_APPROVED' : 'LOCAL_GRAPH_ONLY';
  if (meta.mode === 'local') {
    // Asking is only meaningful when there is something to send. With nothing
    // extracted, skip the dialog and stay graph-only — the report records that,
    // so the absence is visible rather than looking like a refusal.
    const consented = excerpts.size > 0
      && await requestFlowMappingAiConsent(applicationId, String(initialization.manifest?.flowName ?? 'Flow'), [...excerpts.values()]);
    consentMode = consented ? 'LOCAL_EXCERPTS_APPROVED' : 'LOCAL_GRAPH_ONLY';
  }
  const shareExcerpts = consentMode.endsWith('APPROVED');
  const mappings = retrieval.mappings.map((mapping: any) => ({
    checkpointId: mapping.checkpointId,
    kind: mapping.kind,
    name: mapping.name,
    status: mapping.status,
    confidence: mapping.confidence,
    // Only the candidates' own facts travel. The retrieval result also carries
    // the query it was matched against, a score breakdown, and every candidate's
    // full evidence records including their excerpts — none of which the server
    // reads, and together enough to push a fifty-checkpoint Flow past the size
    // the submission endpoint will accept. Citations are sent as ids so the
    // claim is still traceable without shipping the evidence bodies twice.
    candidates: mapping.candidates.slice(0, MAX_CANDIDATES_PER_CHECKPOINT).map((candidate: any, index: number) => ({
      id: candidate.id,
      entityId: candidate.entityId,
      name: candidate.name,
      file: candidate.path,
      symbol: candidate.symbol,
      startLine: candidate.startLine,
      endLine: candidate.endLine,
      score: candidate.score,
      confidence: candidate.confidence,
      placementKinds: candidate.placementKinds,
      evidenceIds: evidenceIdsFor(candidate),
      rationale: candidate.rationale ?? `Ranked ${candidate.name ?? candidate.path} from codebase entities, graph relationships, and feature evidence.`,
      // Source only travels for the candidates a resolver would actually weigh
      // between, and only as much of it as the decision needs.
      excerpt: shareExcerpts && index < MAX_EXCERPTS_PER_CHECKPOINT
        ? (excerpts.get(candidate.id)?.content ?? null)?.slice(0, MAX_EXCERPT_CHARS) ?? null
        : null,
    })),
  }));
  progress('RESOLVING', 'Pinpointing where each checkpoint belongs');
  return cloud.submitFlowMappingCandidates(String(initialization.id), {
    analysis: retrieval.analysis, retrievalVersion: retrieval.retrievalVersion, consentMode, mappings,
  });
}

/**
 * Upload and queue the full analysis after the workspace attach has completed.
 *
 * This deliberately does not sit on the `scanWorkspace` IPC request. Uploads
 * can take an arbitrary amount of time (or wait on a temporarily unavailable
 * service), while attaching the already-scanned folder is a completed local
 * action and must be reflected in the renderer immediately.
 */
async function beginCloudCodebaseAnalysis(
  applicationId: string,
  selectedPath: string,
  snapshot: RepositorySnapshotSummary,
  registered: { workspaceId: string; repositorySnapshotId: string },
): Promise<void> {
  const cancellation: SnapshotUploadCancellation = { cancelled: false, abort: null };
  snapshotUploads.set(applicationId, cancellation);
  try {
    writeAnalysisState(applicationId, {
      mode: 'cloud',
      cloudJobId: null,
      workspaceRoot: selectedPath,
      workspaceId: registered.workspaceId,
      repositoryFingerprint: snapshot.repositoryFingerprint,
      workingTreeHash: workingTreeHashOf(selectedPath, snapshot),
      updatedAt: new Date().toISOString(),
      analysis: pendingAnalysis(snapshot, 'Preparing the sanitized source snapshot'),
      uploadProgress: { sent: 0, total: 1 },
    });
    const archive = await buildSourceArchiveInWorker(selectedPath, cancellation);
    if (cancellation.cancelled) throw new Error(SNAPSHOT_UPLOAD_CANCELLED);
    const created = await cloud.uploadCodebaseSnapshot(applicationId, {
      workspaceId: registered.workspaceId,
      repositorySnapshotId: registered.repositorySnapshotId,
      revision: snapshot.revision,
      branch: snapshot.branch,
      dirty: snapshot.dirty,
      repositoryFingerprint: snapshot.repositoryFingerprint,
      repositoryIdentity: snapshot.repositoryOriginHash ?? snapshot.portableManifestIdentity ?? null,
      scannerVersion: snapshot.scannerVersion,
      archive,
      shouldCancel: () => cancellation.cancelled,
      onProgress: (sent, total) => {
        // A part that lands after Cancel must not re-report progress over the
        // cancelled state the click already wrote.
        if (cancellation.cancelled) return;
        const state = readAnalysisState(applicationId);
        if (!state) return;
        writeAnalysisState(applicationId, {
          ...state,
          uploadProgress: { sent, total },
          analysis: state.analysis
            ? { ...state.analysis, stageMessage: `Uploading source snapshot (${sent} of ${total})`, progress: Math.round((sent / total) * 4) }
            : state.analysis,
        });
      },
    });
    if (cancellation.cancelled) {
      // Cancelled in the window between the last check and the job being
      // created, so the job that now exists is cancelled rather than orphaned.
      await cloud.cancelCloudCodebaseAnalysis(applicationId, created.jobId).catch(() => undefined);
      throw new Error(SNAPSHOT_UPLOAD_CANCELLED);
    }
    const state = readAnalysisState(applicationId);
    writeAnalysisState(applicationId, {
      mode: 'cloud',
      cloudJobId: created.jobId,
      workspaceRoot: selectedPath,
      workspaceId: registered.workspaceId,
      repositoryFingerprint: snapshot.repositoryFingerprint,
      workingTreeHash: workingTreeHashOf(selectedPath, snapshot),
      updatedAt: new Date().toISOString(),
      analysis: state?.analysis ?? pendingAnalysis(snapshot, 'Queued for analysis'),
      uploadProgress: null,
    });
  } catch (error) {
    // Cancelling is a decision, not a failure: it must not be answered with the
    // local analysis the upload failure path falls back to.
    if (cancellation.cancelled || (error instanceof Error && error.message === SNAPSHOT_UPLOAD_CANCELLED)) {
      markAnalysisCancelled(applicationId);
      return;
    }
    // The upload failed, so no cloud job exists to wait for. Fall back to a
    // local analysis and say why rather than showing a job that will never move.
    console.warn('[codebase-analysis] Source upload failed; analysing locally instead', error);
    beginLocalCodebaseAnalysis(applicationId, selectedPath, snapshot);
    patchLocalAnalysis(applicationId, {
      warnings: ['The source snapshot could not be uploaded, so this analysis ran on your machine instead.'],
    });
  } finally {
    if (snapshotUploads.get(applicationId) === cancellation) snapshotUploads.delete(applicationId);
  }
}

/** Record a run the member stopped, and clear the progress it was reporting. */
function markAnalysisCancelled(applicationId: string): void {
  const state = readAnalysisState(applicationId);
  if (!state) return;
  writeAnalysisState(applicationId, {
    ...state,
    // Stop polling a cancelled cloud job. A later rescan registers a fresh job.
    cloudJobId: null,
    uploadProgress: null,
    analysis: state.analysis
      ? {
        ...state.analysis,
        status: 'CANCELLED',
        stageMessage: 'Analysis cancelled',
        completedAt: new Date().toISOString(),
      }
      : state.analysis,
  });
}

/** What the consent dialog is told about the folder before anything is sent. */
type SourceArchivePreview = ReturnType<typeof previewSanitizedSourceArchive>;
type SourceArchiveWorkerMessage = {
  type: string;
  archive?: SanitizedArchive;
  preview?: SourceArchivePreview;
  message?: string;
};

/**
 * Read the folder in a worker, so the window keeps painting — and so Cancel is
 * answered while the archive is being built rather than after.
 *
 * The consent preview has no Cancel behind it, so it passes no cancellation.
 */
function runSourceArchiveWorker(
  input: { root: string; mode: 'archive' | 'preview' },
  cancellation: SnapshotUploadCancellation | null,
): Promise<SourceArchiveWorkerMessage> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'source-archive-worker.js'), {
      workerData: input,
    });
    let settled = false;
    const settle = (run: () => void) => {
      if (settled) return;
      settled = true;
      if (cancellation) cancellation.abort = null;
      void worker.terminate().catch(() => undefined);
      run();
    };
    if (cancellation) {
      cancellation.abort = () => settle(() => reject(new Error(SNAPSHOT_UPLOAD_CANCELLED)));
      if (cancellation.cancelled) {
        cancellation.abort();
        return;
      }
    }
    worker.on('message', (message: SourceArchiveWorkerMessage) => settle(() => resolve(message)));
    worker.on('error', (error) => settle(() => reject(error)));
    worker.on('exit', (code) => {
      if (code !== 0) settle(() => reject(new Error(`SOURCE_ARCHIVE_FAILED:${code}`)));
    });
  });
}

async function buildSourceArchiveInWorker(
  root: string,
  cancellation: SnapshotUploadCancellation,
): Promise<SanitizedArchive> {
  const message = await runSourceArchiveWorker({ root, mode: 'archive' }, cancellation);
  if (message.type !== 'complete' || !message.archive) {
    throw new Error(message.message ?? 'SOURCE_ARCHIVE_FAILED');
  }
  return message.archive;
}

async function previewSourceArchiveInWorker(root: string): Promise<SourceArchivePreview> {
  const message = await runSourceArchiveWorker({ root, mode: 'preview' }, null);
  if (message.type !== 'complete' || !message.preview) {
    throw new Error(message.message ?? 'SOURCE_ARCHIVE_PREVIEW_FAILED');
  }
  return message.preview;
}

/**
 * Consent and analysis are follow-up work to attachment, not part of it. Keeping
 * this whole sequence out of the scan IPC guarantees Electron can deliver the
 * attached workspace to the renderer before archive work or network requests
 * begin. It also means the consent dialog describes a folder that is already
 * visibly attached, instead of holding the UI in a misleading global busy state.
 */
async function beginCodebaseAnalysisWithConsent(
  applicationId: string,
  selectedPath: string,
  snapshot: RepositorySnapshotSummary,
  registered: { workspaceId: string; repositorySnapshotId: string },
): Promise<void> {
  const consented = await requestUploadConsent(applicationId, selectedPath, snapshot);
  if (consented) {
    await beginCloudCodebaseAnalysis(applicationId, selectedPath, snapshot, registered);
    return;
  }
  beginLocalCodebaseAnalysis(applicationId, selectedPath, snapshot);
}

/**
 * Electron drops every property but `message` when an `ipcMain.handle` rejection
 * crosses to the renderer, so the parts the renderer needs to build the
 * "wrong folder" modal — the code and the repository the application is bound
 * to — travel inside the message and are parsed back out there.
 */
function repositoryMismatchError(cause: unknown): Error {
  const details = cause as { message?: string; expectedCloneUrl?: unknown };
  return new Error(`${REPOSITORY_MISMATCH_CODE} ${JSON.stringify({
    message: details?.message ?? 'This folder belongs to a different repository than the one this application is bound to.',
    expectedCloneUrl: typeof details?.expectedCloneUrl === 'string' ? details.expectedCloneUrl : null,
  })}`);
}

/** Scan a folder in a worker, so the window keeps painting while it happens. */
function runWorkspaceScan(root: string, options: Parameters<typeof scanWorkspace>[1]): Promise<RepositorySnapshotSummary> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'workspace-scan-worker.js'), {
      workerData: { root, options },
    });
    let settled = false;
    const settle = (run: () => void) => {
      if (settled) return;
      settled = true;
      void worker.terminate().catch(() => undefined);
      run();
    };
    worker.on('message', (message: { type: string; snapshot?: RepositorySnapshotSummary; message?: string }) => {
      if (message.type === 'complete' && message.snapshot) settle(() => resolve(message.snapshot!));
      else settle(() => reject(new Error(message.message ?? 'WORKSPACE_SCAN_FAILED')));
    });
    worker.on('error', (error) => settle(() => reject(error)));
    worker.on('exit', (code) => {
      if (code !== 0) settle(() => reject(new Error(`WORKSPACE_SCAN_FAILED:${code}`)));
    });
  });
}

async function registerSelectedWorkspace(applicationId: string, selectedPath: string) {
  resolveWithinWorkspace(selectedPath, '.');
  // Derived from the folder path under a device-local secret rather than
  // randomly generated per attach, so re-attaching the same folder updates the
  // existing cloud workspace instead of leaving a duplicate row behind.
  const workspaceId = workspaceLocalId(selectedPath);
  const previous = readLocalState<StoredWorkspace>(localWorkspaceKey(applicationId));
  // Fetched before the scan so the scanner can measure how far this checkout has
  // drifted from the shared QA branch in the same pass.
  const policy = await resolveBranchPolicy(applicationId, previous?.branchPolicy);
  const snapshot = await runWorkspaceScan(selectedPath, {
    workspaceId,
    upstreamBranch: policy?.bound ? policy.qaBranchName : null,
  });
  let registered: Awaited<ReturnType<typeof cloud.registerWorkspace>>;
  try {
    registered = await cloud.registerWorkspace(applicationId, workspaceId, snapshot);
  } catch (cause) {
    // Attaching the wrong folder is a correctable choice rather than a failure
    // of the app, so it is re-thrown in a shape the renderer can turn into a
    // modal with its own "choose another folder" action.
    if ((cause as { code?: unknown })?.code === REPOSITORY_MISMATCH_CODE) throw repositoryMismatchError(cause);
    throw cause;
  }
  selectedWorkspaces.set(applicationId, {
    applicationId, localId: workspaceId, cloudId: registered.workspaceId,
    snapshotId: registered.repositorySnapshotId, root: selectedPath, snapshot,
  });
  const workspace: StoredWorkspace = {
    id: workspaceId,
    path: selectedPath,
    name: path.basename(selectedPath),
    snapshot,
    cloudId: registered.workspaceId,
    snapshotId: registered.repositorySnapshotId,
    branchPolicy: registered.branchPolicy ?? policy ?? null,
  };
  writeLocalState(localWorkspaceKey(applicationId), workspace);
  return workspace;
}

// Some Windows GPU/driver combinations render packaged transparent/composited
// Electron surfaces as black even though the renderer DOM is healthy. Tellann's
// desktop shell does not need GPU acceleration; the managed Playwright browser
// remains a separate Chromium process and is unaffected by this safeguard.
app.disableHardwareAcceleration();

// Give Windows a stable Tellann identity so taskbar grouping and shortcut icon
// resolution do not fall back to Electron's executable identity.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.tellann.desktop');
}

// Electron's development default is the shared "Electron" session directory.
// Isolate Chromium caches so another Electron-based app or stale dev process
// cannot lock Tellann's disk/GPU cache on Windows.
if (!app.isPackaged) {
  app.setPath('sessionData', path.join(app.getPath('sessionData'), 'TellannDesktopDev'));
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    captureTellannDeepLink(argv);
    handleSecondInstanceArgv(argv);
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    deliverPendingQARunDeepLink();
  });
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  // A detached panel is a window this process opened on the same preload and
  // the same renderer bundle, so it is as trusted as the main window.
  const trusted = [mainWindow, ...runPanelWindows.values()]
    .filter((target): target is BrowserWindow => Boolean(target) && !target!.isDestroyed())
    .map((target) => target.webContents.id);
  if (!trusted.includes(event.sender.id)) {
    throw new Error('UNTRUSTED_IPC_SENDER');
  }
}

function parseInstrumentationContext(input: unknown) {
  const value = input as Record<string, unknown>;
  if (typeof value?.applicationId !== 'string' || typeof value.environmentId !== 'string' || !['DEVELOPMENT', 'STAGING', 'PRODUCTION'].includes(String(value.environmentType))) {
    throw new Error('INVALID_INSTRUMENTATION_CONTEXT');
  }
  return {
    applicationId: value.applicationId,
    environmentId: value.environmentId,
    environmentType: value.environmentType as 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION',
    instrumentationPurpose: value.instrumentationPurpose === 'FLOW' ? 'FLOW' as const : 'BOOTSTRAP' as const,
    flowId: typeof value.flowId === 'string' ? value.flowId : undefined,
    flowVersionId: typeof value.flowVersionId === 'string' ? value.flowVersionId : undefined,
    flowInitializationId: typeof value.flowInitializationId === 'string' ? value.flowInitializationId : undefined,
    // Present when the user is proposing for several frameworks at once, so a
    // Flow whose checkpoints span those packages can be split between them.
    selectedAdapterIds: Array.isArray(value.selectedAdapterIds)
      ? value.selectedAdapterIds.filter((item): item is InstrumentationFrameworkId => typeof item === 'string' && (INSTRUMENTATION_FRAMEWORK_IDS as readonly string[]).includes(item))
      : undefined,
  };
}

async function createWindow(): Promise<void> {
  const showImmediately = !app.isPackaged;
  // The window chrome swaps this for the taskbar theme's variant once attached.
  const windowIconPath = themedWindowIconPath();
  mainWindow = new BrowserWindow({
    // Size, placement, title bar overlay and Mica come from the window chrome,
    // which restores the last bounds and opens compact while signed out.
    ...windowOptions(),
    icon: windowIconPath,
    // In development, show the shell immediately so a renderer/preload failure
    // cannot leave Electron running invisibly behind the Vite process.
    show: showImmediately,
    title: 'Tellann',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      devTools: !app.isPackaged,
    },
  });
  // An attach waiting on consent must not hang if the window disappears.
  mainWindow.on('closed', cancelPendingUploadConsents);
  // A detached panel must never outlive the window it was popped out of: left
  // open it would hold the application alive with nothing to drive it.
  mainWindow.on('closed', () => {
    for (const panel of runPanelWindows.values()) {
      if (!panel.isDestroyed()) panel.destroy();
    }
    runPanelWindows.clear();
  });
  mainWindow.webContents.on('render-process-gone', cancelPendingUploadConsents);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL;
    if (!allowed || !url.startsWith(allowed)) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.restore();
    mainWindow?.focus();
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl) => {
    console.error(`Desktop renderer failed to load (${errorCode}): ${errorDescription}`, validatedUrl);
    mainWindow?.show();
  });
  attachWindowChrome(mainWindow);
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const query = rendererQuery();
  if (devUrl) {
    await loadRendererUrlWithRetry(
      mainWindow,
      `${devUrl}?${new URLSearchParams(query).toString()}`,
    );
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), { query });
  }
}

/**
 * The live run's panels that can be popped out, and how each one opens: its own
 * window size, its title, and the renderer view that draws it alone.
 */
const RUN_PANEL_WINDOWS = {
  guide: { width: 380, height: 760, title: 'Run guide — Tellann', view: 'run-guide', side: 'leading' },
  evidence: { width: 520, height: 820, title: 'Live evidence — Tellann', view: 'run-evidence', side: 'trailing' },
} as const satisfies Record<RunPanelId, {
  width: number;
  height: number;
  title: string;
  view: string;
  side: 'leading' | 'trailing';
}>;

/** Narrows whatever the renderer asked for to a panel this process can open. */
function parseRunPanelId(input: unknown): RunPanelId {
  if (input === 'guide' || input === 'evidence') return input;
  throw new Error('UNKNOWN_RUN_PANEL');
}

/** Where a detached panel lands: beside the main window on its own side of it,
 *  and overlapping the main window when there is no room out there. */
function runPanelWindowPosition(panel: RunPanelId): { x: number; y: number } | Record<string, never> {
  const anchor = mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : null;
  if (!anchor) return {};
  const spec = RUN_PANEL_WINDOWS[panel];
  const beside = spec.side === 'leading' ? anchor.x - spec.width - 12 : anchor.x + anchor.width + 12;
  const display = screen.getDisplayMatching(anchor).workArea;
  const fits = beside >= display.x && beside + spec.width <= display.x + display.width;
  return {
    x: fits ? beside : anchor.x + 24,
    y: anchor.y + 24,
  };
}

/**
 * Pops one of the live run's panels out into its own window. It loads the same
 * renderer with the panel's own `view`, which draws that panel alone; run state
 * still arrives by push from this process, so the detached copy stays live
 * without a second subscription of any kind.
 */
async function openRunPanelWindow(id: RunPanelId): Promise<{ panel: RunPanelId; open: boolean }> {
  const existing = runPanelWindows.get(id);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return { panel: id, open: true };
  }
  const spec = RUN_PANEL_WINDOWS[id];
  const panel = new BrowserWindow({
    ...secondaryWindowOptions({
      width: spec.width,
      height: spec.height,
      ...runPanelWindowPosition(id),
    }),
    icon: themedWindowIconPath(),
    show: false,
    title: spec.title,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      devTools: !app.isPackaged,
    },
  });
  runPanelWindows.set(id, panel);
  panel.setMenu(null);
  panel.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  panel.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL;
    if (!allowed || !url.startsWith(allowed)) event.preventDefault();
  });
  panel.once('ready-to-show', () => {
    if (!panel.isDestroyed()) panel.show();
  });
  panel.on('closed', () => {
    if (runPanelWindows.get(id) === panel) runPanelWindows.delete(id);
    // Closing the detached window is how the operator puts the panel back, so
    // the run page has to hear about it however the window was dismissed.
    notifyRunPanelWindowState(id);
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const query = { ...rendererQuery(), view: spec.view };
  if (devUrl) {
    await loadRendererUrlWithRetry(panel, `${devUrl}?${new URLSearchParams(query).toString()}`);
  } else {
    await panel.loadFile(path.join(__dirname, '../../renderer/index.html'), { query });
  }
  return { panel: id, open: true };
}

function closeRunPanelWindow(id: RunPanelId): { panel: RunPanelId; open: boolean } {
  const panel = runPanelWindows.get(id);
  if (panel && !panel.isDestroyed()) panel.close();
  return { panel: id, open: false };
}

/** Which panels are detached right now, as the run page reads it on mount. */
function runPanelWindowState(): Record<RunPanelId, boolean> {
  return {
    guide: openRunPanelWindows().some(([id]) => id === 'guide'),
    evidence: openRunPanelWindows().some(([id]) => id === 'evidence'),
  };
}

function openRunPanelWindows(): Array<[RunPanelId, BrowserWindow]> {
  return [...runPanelWindows.entries()].filter(([, panel]) => !panel.isDestroyed());
}

/** Tells the run page that one panel detached or came back. */
function notifyRunPanelWindowState(id: RunPanelId): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(IPC.runPanelWindowChanged, {
    panel: id,
    open: runPanelWindowState()[id],
  });
}

async function loadRendererUrlWithRetry(window: BrowserWindow, url: string): Promise<void> {
  try {
    await window.loadURL(url);
  } catch (error) {
    if (app.isPackaged || window.isDestroyed() || !isTransientRendererLoadFailure(error)) {
      throw error;
    }
    console.warn(
      'Desktop renderer initial load failed; retrying once',
      error instanceof Error ? error.message : error,
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (!window.isDestroyed()) await window.loadURL(url);
  }
}

function isTransientRendererLoadFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('ERR_FAILED') || error.message.includes('ERR_ABORTED');
}

function registerIpc(): void {
  ipcMain.handle(IPC.getVersion, (event) => {
    assertTrustedSender(event);
    return app.getVersion();
  });
  ipcMain.handle(IPC.copyText, (event, value: unknown) => {
    assertTrustedSender(event);
    if (typeof value !== 'string' || value.length > 100_000) throw new Error('INVALID_CLIPBOARD_TEXT');
    clipboard.writeText(value);
    return { copied: true as const };
  });
  ipcMain.handle(IPC.getSession, (event) => {
    assertTrustedSender(event);
    return cloud.getSession();
  });
  ipcMain.handle(IPC.getAvatarDataUri, (event) => {
    assertTrustedSender(event);
    return cloud.avatarDataUri();
  });
  ipcMain.handle(IPC.claimSetupHandoff, async (event) => {
    assertTrustedSender(event);
    if (!pendingSetupHandoffToken) return null;
    const claimed = await cloud.claimSetupHandoff(pendingSetupHandoffToken);
    pendingSetupHandoffToken = null;
    return claimed;
  });
  ipcMain.handle(IPC.consumeSetupHandoff, async (event, handoffId: unknown) => {
    assertTrustedSender(event);
    if (typeof handoffId !== 'string') throw new Error('INVALID_SETUP_HANDOFF_ID');
    return cloud.consumeSetupHandoff(handoffId);
  });
  ipcMain.handle(IPC.getSdkSetup, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; environmentId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.environmentId !== 'string') throw new Error('INVALID_SDK_SETUP_REQUEST');
    return cloud.sdkSetup(value.applicationId, value.environmentId);
  });
  ipcMain.handle(IPC.issueSdkSetupKey, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; environmentId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.environmentId !== 'string') throw new Error('INVALID_SDK_SETUP_KEY_REQUEST');
    return cloud.issueSetupKey(value.applicationId, value.environmentId);
  });
  ipcMain.handle(IPC.signIn, async (event) => {
    assertTrustedSender(event);
    const result = await cloud.signIn();
    void syncNotificationOrganization();
    return result;
  });
  ipcMain.handle(IPC.reopenSignIn, async (event) => {
    assertTrustedSender(event);
    await cloud.reopenSignIn();
  });
  ipcMain.handle(IPC.cancelSignIn, (event) => {
    assertTrustedSender(event);
    cloud.cancelSignIn();
  });
  ipcMain.handle(IPC.signOut, async (event) => {
    assertTrustedSender(event);
    await notificationClient.stop().catch(() => undefined);
    await cloud.signOut();
    activeOrganizationId = null;
    cloud.setAppEventsOrganization(null);
    selectedWorkspaces.clear();
    // Document imports belong to the signed-in member; drop them and their filenames.
    documentImports.clearAll();
  });
  ipcMain.handle(IPC.getApplications, async (event) => {
    assertTrustedSender(event);
    const apps = await cloud.applications();
    // Opportunistically (re)arm the live streams now that we know an org.
    void applyActiveOrganization(
      apps.find((entry) => entry.organizationId)?.organizationId ?? null,
    );
    return apps;
  });
  ipcMain.handle(IPC.uploadConsentResolve, (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { requestId?: unknown; consented?: unknown };
    if (typeof value?.requestId !== 'string') throw new Error('INVALID_UPLOAD_CONSENT_RESPONSE');
    const settle = pendingUploadConsents.get(value.requestId);
    // A stale or duplicated answer is not an error: the prompt it belongs to
    // has already been settled (the window closed, or it was answered once).
    if (settle) settle(value.consented === true);
    return { resolved: Boolean(settle) };
  });
  ipcMain.handle(IPC.getOrganizations, async (event) => {
    assertTrustedSender(event);
    const organizations = await cloud.organizations();
    if (!activeOrganizationId) void applyActiveOrganization(organizations[0]?.id ?? null);
    return organizations;
  });
  ipcMain.handle(IPC.createApplication, async (event, input: unknown) => {
    assertTrustedSender(event);
    const parsed = CreateApplicationInputSchema.parse(input);
    const created = await cloud.createApplication({ ...parsed, name: parsed.name.trim() });
    // Arm the streams against the new application's organisation before the
    // renderer refreshes, so the `app-created` notification is not missed.
    await applyActiveOrganization(created.organizationId);
    return created;
  });
  cloud.subscribeToAppEvents((appEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.appUpdated, appEvent);
    }
  });

  // ── Notifications ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC.notificationsSetActiveOrg, async (event, organizationId: unknown) => {
    assertTrustedSender(event);
    await notificationClient.setActiveOrganization(
      typeof organizationId === 'string' && organizationId ? organizationId : null,
    );
  });
  ipcMain.handle(IPC.notificationsFetch, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = (input ?? {}) as { cursor?: string; filter?: string };
    return notificationClient.fetchFeed({ cursor: value.cursor, filter: value.filter });
  });
  ipcMain.handle(IPC.notificationMarkRead, async (event, id: unknown) => {
    assertTrustedSender(event);
    if (typeof id !== 'string') throw new Error('INVALID_ID');
    return notificationClient.markRead(id);
  });
  ipcMain.handle(IPC.notificationMarkAllRead, async (event) => {
    assertTrustedSender(event);
    return notificationClient.markAllRead();
  });
  ipcMain.handle(IPC.notificationDismiss, async (event, id: unknown) => {
    assertTrustedSender(event);
    if (typeof id !== 'string') throw new Error('INVALID_ID');
    return notificationClient.dismiss(id);
  });
  ipcMain.handle(IPC.notificationOpen, async (event, id: unknown) => {
    assertTrustedSender(event);
    if (typeof id !== 'string') throw new Error('INVALID_ID');
    return notificationClient.open(id);
  });
  ipcMain.handle(IPC.listRuns, async (event, applicationId: unknown, filters?: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    return cloud.runs(applicationId, (filters ?? {}) as Record<string, string>);
  });
  ipcMain.handle(IPC.renameRun, (event, runId: string, title: string) => {
    assertTrustedSender(event);
    return cloud.renameRun(runId, title);
  });
  ipcMain.handle(IPC.archiveRun, (event, runId: string) => {
    assertTrustedSender(event);
    return cloud.archiveRun(runId);
  });
  ipcMain.handle(IPC.restoreRun, (event, runId: string) => {
    assertTrustedSender(event);
    return cloud.restoreRun(runId);
  });
  ipcMain.handle(IPC.deleteRun, (event, runId: string) => {
    assertTrustedSender(event);
    return cloud.deleteRun(runId);
  });
  ipcMain.handle(IPC.getRun, async (event, runId: unknown) => {
    assertTrustedSender(event);
    if (typeof runId !== 'string') throw new Error('INVALID_RUN_ID');
    return cloud.run(runId);
  });
  ipcMain.handle(IPC.getRunReplay, async (event, runId: unknown) => {
    assertTrustedSender(event);
    if (typeof runId !== 'string') throw new Error('INVALID_RUN_ID');
    return cloud.runReplay(runId);
  });
  ipcMain.handle(IPC.getRunBackendEvidence, async (event, runId: unknown, query: unknown) => {
    assertTrustedSender(event);
    if (typeof runId !== 'string') throw new Error('INVALID_RUN_ID');
    if (!query || typeof query !== 'object') throw new Error('INVALID_EVIDENCE_QUERY');
    return cloud.runBackendEvidence(runId, query as BackendEvidenceQuery);
  });
  ipcMain.handle(IPC.getRunReport, async (event, runId: unknown) => {
    assertTrustedSender(event);
    if (typeof runId !== 'string') throw new Error('INVALID_RUN_ID');
    return cloud.runReport(runId);
  });
  /**
   * The report page shows the summary and the finding titles; the complete
   * report is written to a file the user saves. The plan decides which formats
   * are offered, and that is re-resolved from the cloud here rather than
   * trusted from the renderer, so a picker rendered before a downgrade cannot
   * produce a format the organisation is no longer entitled to.
   */
  ipcMain.handle(IPC.saveRunReportDownload, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { runId?: unknown; format?: unknown };
    if (typeof value.runId !== 'string') throw new Error('INVALID_RUN_ID');
    const format = String(value.format ?? 'JSON').toUpperCase() as QualityReportFormat;
    if (!['JSON', 'PDF', 'CSV', 'HTML'].includes(format)) throw new Error('UNSUPPORTED_REPORT_FORMAT');

    // A report still being generated answers with a status stub rather than the
    // payload. Writing that to a file would hand the user an empty document.
    const report = (await cloud.runReport(value.runId)) as unknown as Record<string, unknown>;
    if (!report || typeof report !== 'object' || !report.application || !report.summary) {
      throw new Error('The report is still being generated. Try the download again once it is ready.');
    }

    const applicationId = String((report.application as Record<string, unknown> | undefined)?.id ?? '');
    const applications = await cloud.applications().catch(() => [] as DesktopApplication[]);
    const application = applications.find((item) => item.id === applicationId);
    // An organisation whose entitlement could not be resolved keeps the format
    // every plan includes rather than the one that was asked for.
    const entitled = application?.entitlements?.reportFormats ?? ['JSON'];
    if (!entitled.includes(format)) {
      const error = new Error(
        entitled.length
          ? `Your plan can download this report as ${entitled.join(', ')}.`
          : 'Your plan does not include report downloads.',
      );
      (error as NodeJS.ErrnoException).code = 'REPORT_FORMAT_NOT_ENTITLED';
      throw error;
    }

    const documentInput = { report, generatedAt: new Date().toISOString() };
    const { buffer, extension, filterName } = await renderQualityReport(documentInput, format);
    const filename = `${qualityReportFileBase(documentInput)}.${extension}`;
    const save = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save quality report',
      defaultPath: path.join(app.getPath('documents'), filename),
      filters: [{ name: filterName, extensions: [extension] }],
    });
    if (save.canceled || !save.filePath) return { cancelled: true };
    await fs.writeFile(save.filePath, buffer);
    return { cancelled: false, filePath: save.filePath, filename: path.basename(save.filePath), format };
  });
  ipcMain.handle(IPC.getDeclaredFlows, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    return cloud.declaredFlows(applicationId);
  });
  ipcMain.handle(IPC.getDeclaredFlow, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string') throw new Error('INVALID_DECLARED_FLOW_REQUEST');
    return cloud.declaredFlow(value.applicationId, value.flowId);
  });
  ipcMain.handle(IPC.createDeclaredFlow, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; name?: unknown; workflowType?: unknown; purpose?: unknown; scopeStatement?: unknown; template?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.name !== 'string' || typeof value.workflowType !== 'string' || typeof value.scopeStatement !== 'string') throw new Error('INVALID_DECLARED_FLOW_REQUEST');
    return cloud.createDeclaredFlow(value.applicationId, { name: value.name, workflowType: value.workflowType, purpose: typeof value.purpose === 'string' ? value.purpose : undefined, scopeStatement: value.scopeStatement, template: typeof value.template === 'string' ? value.template : undefined });
  });
  ipcMain.handle(IPC.addDeclaredState, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; stateName?: unknown; category?: unknown; role?: unknown; terminalKind?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || typeof value.stateName !== 'string' || typeof value.category !== 'string') throw new Error('INVALID_DECLARED_STATE_REQUEST');
    return cloud.addDeclaredState(value.applicationId, value.flowId, { stateName: value.stateName, category: value.category, role: typeof value.role === 'string' ? value.role : 'NORMAL', terminalKind: typeof value.terminalKind === 'string' ? value.terminalKind : null });
  });
  ipcMain.handle(IPC.updateDeclaredState, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; stateId?: unknown; stateName?: unknown; category?: unknown; role?: unknown; terminalKind?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || typeof value.stateId !== 'string' || typeof value.stateName !== 'string' || typeof value.category !== 'string') throw new Error('INVALID_DECLARED_STATE_UPDATE_REQUEST');
    return cloud.updateDeclaredState(value.applicationId, value.flowId, value.stateId, { stateName: value.stateName, category: value.category, role: typeof value.role === 'string' ? value.role : 'NORMAL', terminalKind: typeof value.terminalKind === 'string' ? value.terminalKind : null });
  });
  ipcMain.handle(IPC.deleteDeclaredState, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; stateId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || typeof value.stateId !== 'string') throw new Error('INVALID_DECLARED_STATE_DELETE_REQUEST');
    return cloud.deleteDeclaredState(value.applicationId, value.flowId, value.stateId);
  });
  ipcMain.handle(IPC.addDeclaredTransition, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; fromStateId?: unknown; toStateId?: unknown; action?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || typeof value.fromStateId !== 'string' || typeof value.toStateId !== 'string' || (value.action !== undefined && typeof value.action !== 'string')) throw new Error('INVALID_DECLARED_TRANSITION_REQUEST');
    return cloud.addDeclaredTransition(value.applicationId, value.flowId, { fromStateId: value.fromStateId, toStateId: value.toStateId, action: value.action });
  });
  ipcMain.handle(IPC.completeDeclaredFlow, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string') throw new Error('INVALID_DECLARED_FLOW_REQUEST');
    return cloud.setDeclaredFlowComplete(value.applicationId, value.flowId, true);
  });
  ipcMain.handle(IPC.reopenDeclaredFlow, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string') throw new Error('INVALID_DECLARED_FLOW_REQUEST');
    return cloud.setDeclaredFlowComplete(value.applicationId, value.flowId, false);
  });
  // Channel mirrored in preload; kept out of the prebuilt shared contracts.
  const DELETE_DECLARED_FLOW_CHANNEL = 'tellann:cloud:intent:delete';
  ipcMain.handle(DELETE_DECLARED_FLOW_CHANNEL, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string') throw new Error('INVALID_DECLARED_FLOW_REQUEST');
    return cloud.deleteDeclaredFlow(value.applicationId, value.flowId);
  });
  // Graph editor channels, mirrored in preload; kept out of the prebuilt shared contracts.
  const FLOW_EDITOR_CHANNELS = {
    updateTransition: 'tellann:cloud:intent:transition:update',
    deleteTransition: 'tellann:cloud:intent:transition:delete',
    updateFlow: 'tellann:cloud:intent:update',
    draftHistory: 'tellann:cloud:intent:draft-history:list',
    restoreDraft: 'tellann:cloud:intent:draft-history:restore',
    dismissSuggestion: 'tellann:cloud:intent:suggestions:dismiss',
    resolveAiDraft: 'tellann:cloud:intent:ai-draft:resolve',
  } as const;
  ipcMain.handle(FLOW_EDITOR_CHANNELS.updateTransition, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; transitionId?: unknown; action?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || typeof value.transitionId !== 'string' || typeof value.action !== 'string') throw new Error('INVALID_DECLARED_TRANSITION_UPDATE_REQUEST');
    return cloud.updateDeclaredTransition(value.applicationId, value.flowId, value.transitionId, { action: value.action });
  });
  ipcMain.handle(FLOW_EDITOR_CHANNELS.deleteTransition, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; transitionId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || typeof value.transitionId !== 'string') throw new Error('INVALID_DECLARED_TRANSITION_DELETE_REQUEST');
    return cloud.deleteDeclaredTransition(value.applicationId, value.flowId, value.transitionId);
  });
  ipcMain.handle(FLOW_EDITOR_CHANNELS.updateFlow, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; input?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || !value.input || typeof value.input !== 'object') throw new Error('INVALID_DECLARED_FLOW_UPDATE_REQUEST');
    const fields = value.input as Record<string, unknown>;
    const update: { name?: string; purpose?: string; scopeStatement?: string; workflowType?: string } = {};
    for (const key of ['name', 'purpose', 'scopeStatement', 'workflowType'] as const) {
      if (typeof fields[key] === 'string') update[key] = fields[key] as string;
    }
    return cloud.updateDeclaredFlow(value.applicationId, value.flowId, update);
  });
  ipcMain.handle(FLOW_EDITOR_CHANNELS.draftHistory, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string') throw new Error('INVALID_DECLARED_FLOW_REQUEST');
    return cloud.flowDraftHistory(value.applicationId, value.flowId);
  });
  ipcMain.handle(FLOW_EDITOR_CHANNELS.restoreDraft, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; snapshotId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || typeof value.snapshotId !== 'string') throw new Error('INVALID_FLOW_DRAFT_RESTORE_REQUEST');
    return cloud.restoreFlowDraft(value.applicationId, value.flowId, value.snapshotId);
  });
  ipcMain.handle(FLOW_EDITOR_CHANNELS.dismissSuggestion, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; suggestionId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || typeof value.suggestionId !== 'string') throw new Error('INVALID_FLOW_SUGGESTION_ACTION');
    return cloud.dismissFlowSuggestion(value.applicationId, value.flowId, value.suggestionId);
  });
  ipcMain.handle(FLOW_EDITOR_CHANNELS.resolveAiDraft, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; decision?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || (value.decision !== 'accept' && value.decision !== 'decline')) throw new Error('INVALID_FLOW_AI_DRAFT_REQUEST');
    return cloud.resolveAiFlowDraft(value.applicationId, value.flowId, value.decision);
  });
  ipcMain.handle(IPC.generateFlowSuggestions, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; input?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || !value.input || typeof value.input !== 'object') throw new Error('INVALID_FLOW_SUGGESTION_REQUEST');
    return cloud.generateFlowSuggestions(value.applicationId, value.flowId, value.input as Record<string, unknown>);
  });
  ipcMain.handle(IPC.getFlowSuggestions, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string') throw new Error('INVALID_FLOW_SUGGESTION_REQUEST');
    return cloud.flowSuggestions(value.applicationId, value.flowId);
  });
  for (const [channel, action] of [[IPC.acceptFlowSuggestion, 'accept'], [IPC.rejectFlowSuggestion, 'reject']] as const) {
    ipcMain.handle(channel, async (event, input: unknown) => {
      assertTrustedSender(event);
      const value = input as { applicationId?: unknown; flowId?: unknown; suggestionId?: unknown };
      if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || typeof value.suggestionId !== 'string') throw new Error('INVALID_FLOW_SUGGESTION_ACTION');
      return action === 'accept'
        ? cloud.acceptFlowSuggestion(value.applicationId, value.flowId, value.suggestionId)
        : cloud.rejectFlowSuggestion(value.applicationId, value.flowId, value.suggestionId);
    });
  }
  for (const [channel, action] of [[IPC.previewFlowReview, 'preview'], [IPC.applyFlowReview, 'apply']] as const) {
    ipcMain.handle(channel, async (event, input: unknown) => {
      assertTrustedSender(event);
      const value = input as { applicationId?: unknown; flowId?: unknown; input?: unknown };
      if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || !value.input || typeof value.input !== 'object') throw new Error('INVALID_FLOW_REVIEW_REQUEST');
      return action === 'preview'
        ? cloud.previewFlowReview(value.applicationId, value.flowId, value.input as Record<string, unknown>)
        : cloud.applyFlowReview(value.applicationId, value.flowId, value.input as Record<string, unknown>);
    });
  }
  ipcMain.handle(IPC.declineFlowReview, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; reviewId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || typeof value.reviewId !== 'string') throw new Error('INVALID_FLOW_REVIEW_REQUEST');
    return cloud.declineFlowReview(value.applicationId, value.flowId, value.reviewId);
  });
  ipcMain.handle(IPC.getFlowDiagrams, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; flowId?: unknown; versionId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.flowId !== 'string' || typeof value.versionId !== 'string') throw new Error('INVALID_FLOW_DIAGRAM_REQUEST');
    return cloud.flowDiagrams(value.applicationId, value.flowId, value.versionId);
  });
  ipcMain.handle(IPC.initializeFlow, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { flowId?: unknown; applicationId?: unknown; environmentId?: unknown; flowVersionId?: unknown; instrumentationPlanId?: unknown };
    if (typeof value.flowId !== 'string' || typeof value.applicationId !== 'string' || typeof value.environmentId !== 'string' || typeof value.flowVersionId !== 'string') throw new Error('INVALID_FLOW_INITIALIZATION_REQUEST');
    const workspace = selectedWorkspaces.get(value.applicationId);
    if (!workspace?.cloudId || !workspace.snapshotId) throw new Error('FLOW_WORKSPACE_SCAN_REQUIRED');
    // Create the record before doing any of the expensive work.
    //
    // Analysing a repository can take minutes, and asking for upload consent
    // sits in the middle of it. Doing that before the initialization exists left
    // the user on a page with nothing to look at and no id to poll — the click
    // appeared to do nothing at all. The record is created first so the window
    // can navigate to it immediately; mapping then runs behind it and reports
    // each stage against the id the UI is already watching.
    // The identity alone, not the graph: this only records which analysed tree
    // the initialization is about.
    const analysis = readCurrentFlowCodebaseAnalysis(value.applicationId);
    const created = await cloud.initializeFlow(value.flowId, {
      flowVersionId: value.flowVersionId,
      workspaceId: workspace.cloudId,
      repositorySnapshotId: workspace.snapshotId,
      environmentId: value.environmentId,
      instrumentationPlanId: typeof value.instrumentationPlanId === 'string' ? value.instrumentationPlanId : null,
      ...(analysis ? {
        codebaseAnalysis: {
          id: analysis.analysisId, graphVersion: analysis.graphVersion, contentHash: analysis.contentHash,
          revision: analysis.revision, branch: analysis.branch, dirty: analysis.dirty,
        },
      } : {
        // No current analysis yet, but one is being produced right now. The
        // server must not publish the filename-matched fallback as a finished
        // review in the meantime.
        awaitingAnalysis: true,
      }),
    });
    const initialization = (created.initialization ?? created) as Record<string, any>;
    beginFlowMappingInBackground(value.applicationId, initialization);
    return created;
  });
  ipcMain.handle(IPC.getFlowInitialization, async (event, initializationId: unknown) => {
    assertTrustedSender(event);
    if (typeof initializationId !== 'string') throw new Error('INVALID_FLOW_INITIALIZATION_ID');
    return cloud.flowInitialization(initializationId);
  });
  ipcMain.handle(IPC.getFlowInitializationProgress, async (event, initializationId: unknown) => {
    assertTrustedSender(event);
    if (typeof initializationId !== 'string') throw new Error('INVALID_FLOW_INITIALIZATION_ID');
    return cloud.flowInitializationProgress(initializationId);
  });
  ipcMain.handle(IPC.retryFlowMappingResolution, async (event, initializationId: unknown) => {
    assertTrustedSender(event);
    if (typeof initializationId !== 'string') throw new Error('INVALID_FLOW_INITIALIZATION_ID');
    // Deliberately not a re-analysis: the shortlist and the excerpts behind it
    // are still on the scan, and a provider timeout says nothing about them.
    return cloud.retryFlowMappingResolution(initializationId);
  });
  ipcMain.handle(IPC.resetFlowMappingConsent, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    deleteLocalState(flowMappingConsentKey(applicationId));
    return { cleared: true };
  });
  ipcMain.handle(IPC.analyzeFlowInitialization, async (event, initializationId: unknown) => {
    assertTrustedSender(event);
    if (typeof initializationId !== 'string') throw new Error('INVALID_FLOW_INITIALIZATION_ID');
    const base = await cloud.analyzeFlowInitialization(initializationId);
    const applicationId = String(base.applicationId ?? '');
    if (!applicationId) throw new Error('FLOW_INITIALIZATION_APPLICATION_REQUIRED');
    // Same reasoning as the first run: hand the reset record back now and let
    // the window watch the stages, rather than holding the click open.
    beginFlowMappingInBackground(applicationId, base as Record<string, any>);
    return base;
  });
  ipcMain.handle(IPC.confirmFlowMapping, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { initializationId?: unknown; checkpointId?: unknown; candidateId?: unknown; placementKind?: unknown; anchorText?: unknown };
    if (typeof value.initializationId !== 'string' || typeof value.checkpointId !== 'string' || typeof value.candidateId !== 'string') throw new Error('INVALID_FLOW_MAPPING_CONFIRMATION');
    return cloud.confirmFlowMapping(value.initializationId, value.checkpointId, {
      candidateId: value.candidateId,
      ...(typeof value.placementKind === 'string' ? { placementKind: value.placementKind } : {}),
      ...(typeof value.anchorText === 'string' ? { anchorText: value.anchorText } : {}),
    });
  });
  ipcMain.handle(IPC.confirmFlowMappings, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { initializationId?: unknown; confirmations?: unknown };
    if (typeof value.initializationId !== 'string' || !Array.isArray(value.confirmations) || !value.confirmations.length) {
      throw new Error('INVALID_FLOW_MAPPING_CONFIRMATION');
    }
    return cloud.confirmFlowMappings(value.initializationId, value.confirmations.map((item) => {
      const entry = item as { checkpointId?: unknown; candidateId?: unknown; placementKind?: unknown; anchorText?: unknown };
      if (typeof entry.checkpointId !== 'string' || typeof entry.candidateId !== 'string') {
        throw new Error('INVALID_FLOW_MAPPING_CONFIRMATION');
      }
      return {
        checkpointId: entry.checkpointId,
        candidateId: entry.candidateId,
        ...(typeof entry.placementKind === 'string' ? { placementKind: entry.placementKind } : {}),
        ...(typeof entry.anchorText === 'string' ? { anchorText: entry.anchorText } : {}),
      };
    }) as never);
  });
  ipcMain.handle(IPC.setFlowInitializationMode, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { initializationId?: unknown; mode?: unknown };
    if (typeof value.initializationId !== 'string' || !['AUTOMATED', 'MANUAL'].includes(String(value.mode))) throw new Error('INVALID_FLOW_INITIALIZATION_MODE');
    return cloud.setFlowInitializationMode(value.initializationId, value.mode as 'AUTOMATED' | 'MANUAL');
  });
  ipcMain.handle(IPC.updateFlowRoadmapStep, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { initializationId?: unknown; stepId?: unknown; completed?: unknown };
    if (typeof value.initializationId !== 'string' || typeof value.stepId !== 'string') throw new Error('INVALID_FLOW_ROADMAP_STEP');
    return cloud.updateFlowRoadmapStep(value.initializationId, value.stepId, value.completed !== false);
  });
  ipcMain.handle(IPC.startFlowVerification, async (event, initializationId: unknown) => {
    assertTrustedSender(event);
    if (typeof initializationId !== 'string') throw new Error('INVALID_FLOW_INITIALIZATION_ID');
    return cloud.startFlowVerification(initializationId);
  });
  ipcMain.handle(IPC.getFlowVerification, async (event, initializationId: unknown) => {
    assertTrustedSender(event);
    if (typeof initializationId !== 'string') throw new Error('INVALID_FLOW_INITIALIZATION_ID');
    return cloud.flowVerification(initializationId);
  });
  /**
   * Initialize a Flow from the code that is already written, instead of waiting for
   * the user to run their project. The search happens here, on this device: only the
   * marker names and the file/line they were found at are sent to Tellann.
   */
  ipcMain.handle(IPC.verifyFlowCheckpointsInCode, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; initializationId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.initializationId !== 'string') {
      throw new Error('INVALID_FLOW_INITIALIZATION_ID');
    }
    const workspace = readLocalState<StoredWorkspace>(localWorkspaceKey(value.applicationId));
    if (!workspace) throw new Error('WORKSPACE_NOT_ATTACHED');
    if (!existsSync(workspace.path)) {
      throw new Error('The attached folder is no longer on this machine. Re-attach it to check for checkpoints.');
    }
    const scan = scanWorkspaceForFlowMarkers(workspace.path);
    const result = await cloud.submitFlowCodeScan(value.initializationId, distinctMarkers(scan.matches) as unknown as Record<string, unknown>[]);
    return { ...(result as Record<string, unknown>), filesScanned: scan.filesScanned, markersFound: scan.matches.length, truncated: scan.truncated };
  });
  ipcMain.handle(IPC.rescanFlow, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { bindingId?: unknown; applicationId?: unknown };
    if (typeof value.bindingId !== 'string' || typeof value.applicationId !== 'string') throw new Error('INVALID_FLOW_RESCAN_REQUEST');
    const workspace = selectedWorkspaces.get(value.applicationId);
    if (!workspace?.snapshotId) throw new Error('FLOW_WORKSPACE_SCAN_REQUIRED');
    return cloud.rescanFlow(value.bindingId, workspace.snapshotId);
  });
  ipcMain.handle(IPC.approveFlowInitialization, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { initializationId?: unknown; instrumentationPlanId?: unknown };
    if (typeof value.initializationId !== 'string' || typeof value.instrumentationPlanId !== 'string') throw new Error('INVALID_FLOW_INITIALIZATION_APPROVAL');
    return cloud.approveFlowInitialization(value.initializationId, value.instrumentationPlanId);
  });
  ipcMain.handle(IPC.applyFlowInitialization, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { initializationId?: unknown; patchSetId?: unknown };
    if (typeof value.initializationId !== 'string' || typeof value.patchSetId !== 'string') throw new Error('INVALID_FLOW_INITIALIZATION_APPLY');
    return cloud.applyFlowInitialization(value.initializationId, value.patchSetId);
  });
  ipcMain.handle(IPC.validateFlowInitialization, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { initializationId?: unknown } & Record<string, unknown>;
    if (typeof value.initializationId !== 'string') throw new Error('INVALID_FLOW_INITIALIZATION_ID');
    const { initializationId, ...payload } = value;
    return cloud.validateFlowInitialization(initializationId, payload);
  });
  ipcMain.handle(IPC.listDocuments, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    try {
      return { entitled: true, documents: await cloud.documents(applicationId) };
    } catch (err: any) {
      if (err?.status === 403 && String(err?.message ?? err).includes('FEATURE_NOT_ENTITLED')) {
        return { entitled: false, documents: [] };
      }
      if (err?.status === 403 && (err?.code === 'FORBIDDEN' || /not a member of the organization/i.test(String(err?.message ?? err)))) {
        return {
          entitled: true,
          documents: [],
          accessDenied: true,
          message: 'This project is no longer available to the signed-in account. Your project list has been refreshed.',
        };
      }
      throw err;
    }
  });
  // Choosing files is the only step tied to this request. Extraction, upload,
  // processing and draft generation continue in the import manager, so they
  // survive the member leaving the page.
  ipcMain.handle(IPC.importDocuments, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = (typeof input === 'string' ? { applicationId: input } : input ?? {}) as { applicationId?: unknown; generateDraft?: unknown };
    if (typeof value.applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const existing = documentImports.get(value.applicationId);
    if (existing && (existing.running || isActiveDocumentImportStage(existing.stage))) throw new Error('INTENT_IMPORT_IN_PROGRESS');
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select product documents for local analysis', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Product documents', extensions: ['pdf', 'docx', 'md', 'markdown', 'txt', 'html', 'htm', 'json', 'yaml', 'yml'] }],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return documentImports.startFromFiles(value.applicationId, result.filePaths, value.generateDraft === true);
  });
  ipcMain.handle(DOCUMENT_IMPORT_GET_CHANNEL, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    return documentImports.get(applicationId);
  });
  ipcMain.handle(DOCUMENT_IMPORT_RESUME_CHANNEL, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    return documentImports.resume(applicationId);
  });
  ipcMain.handle(DOCUMENT_IMPORT_CANCEL_CHANNEL, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    return documentImports.cancel(applicationId);
  });
  ipcMain.handle(DOCUMENT_IMPORT_DISMISS_CHANNEL, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    documentImports.dismiss(applicationId);
  });
  ipcMain.handle(DOCUMENT_IMPORT_GENERATE_CHANNEL, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = (input ?? {}) as { applicationId?: unknown; documents?: unknown };
    if (typeof value.applicationId !== 'string' || !Array.isArray(value.documents) || value.documents.length > 50) {
      throw new Error('INVALID_INTENT_DRAFT_REQUEST');
    }
    const documents = value.documents.flatMap((item) => {
      const entry = (item ?? {}) as { versionId?: unknown; documentId?: unknown; filename?: unknown };
      return typeof entry.versionId === 'string' && typeof entry.filename === 'string'
        ? [{ versionId: entry.versionId, documentId: typeof entry.documentId === 'string' ? entry.documentId : null, filename: entry.filename }]
        : [];
    });
    return documentImports.startFromVersions(value.applicationId, documents);
  });
  ipcMain.handle(INTENT_DRAFT_APPLY_ANSWERS_CHANNEL, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = (input ?? {}) as { applicationId?: unknown; draftId?: unknown; conflictResolutions?: unknown };
    const answers = value.conflictResolutions;
    if (typeof value.applicationId !== 'string' || typeof value.draftId !== 'string' || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw new Error('INVALID_INTENT_CONFLICT_ANSWERS');
    }
    const conflictResolutions = Object.fromEntries(
      Object.entries(answers as Record<string, unknown>).flatMap(([key, answer]) => (typeof answer === 'string' ? [[key, answer.slice(0, 2_000)]] : [])),
    );
    return cloud.applyIntentConflictAnswers(value.applicationId, value.draftId, conflictResolutions);
  });
  ipcMain.handle(IPC.getDocumentJob, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; jobId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.jobId !== 'string') throw new Error('INVALID_DOCUMENT_JOB_REQUEST');
    return cloud.documentJob(value.applicationId, value.jobId);
  });
  ipcMain.handle(IPC.listIntentDrafts, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    return cloud.intentDrafts(applicationId);
  });
  ipcMain.handle(IPC.getIntentDraft, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; draftId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.draftId !== 'string') throw new Error('INVALID_INTENT_DRAFT_REQUEST');
    return cloud.intentDraft(value.applicationId, value.draftId);
  });
  ipcMain.handle(IPC.createIntentDraft, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; documentVersionIds?: unknown };
    if (typeof value.applicationId !== 'string' || !Array.isArray(value.documentVersionIds)) throw new Error('INVALID_INTENT_DRAFT_REQUEST');
    return cloud.createIntentDraft(
      value.applicationId,
      value.documentVersionIds.filter((id): id is string => typeof id === 'string'),
      selectedWorkspaces.get(value.applicationId)?.snapshotId,
    );
  });
  ipcMain.handle(IPC.getIntentDraftJob, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; jobId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.jobId !== 'string') throw new Error('INVALID_INTENT_DRAFT_JOB_REQUEST');
    return cloud.intentDraftJob(value.applicationId, value.jobId);
  });
  ipcMain.handle(IPC.listIntentDraftJobs, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_INTENT_DRAFT_JOBS_REQUEST');
    return cloud.intentDraftJobs(applicationId);
  });
  ipcMain.handle(IPC.cancelIntentDraftJob, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; jobId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.jobId !== 'string') throw new Error('INVALID_INTENT_DRAFT_JOB_CANCEL');
    return cloud.cancelIntentDraftJob(value.applicationId, value.jobId);
  });
  ipcMain.handle(IPC.reviewIntentDraft, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; draftId?: unknown; review?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.draftId !== 'string' || !value.review || typeof value.review !== 'object') throw new Error('INVALID_INTENT_REVIEW');
    return cloud.reviewIntentDraft(value.applicationId, value.draftId, value.review as Record<string, unknown>);
  });
  ipcMain.handle(IPC.deleteIntentDraft, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; draftId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.draftId !== 'string') throw new Error('INVALID_INTENT_DRAFT_DELETE');
    await cloud.deleteIntentDraft(value.applicationId, value.draftId);
  });
  ipcMain.handle(IPC.correctIntentDraft, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; draftId?: unknown; correction?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.draftId !== 'string' || typeof value.correction !== 'string') throw new Error('INVALID_INTENT_CORRECTION');
    return cloud.correctIntentDraft(value.applicationId, value.draftId, value.correction);
  });
  ipcMain.handle(IPC.openExternal, async (event, url: unknown) => {
    assertTrustedSender(event);
    if (typeof url !== 'string') throw new Error('INVALID_EXTERNAL_URL');
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('EXTERNAL_URL_BLOCKED');
    await shell.openExternal(parsed.toString());
  });
  ipcMain.handle(IPC.openPath, async (event, targetPath: unknown) => {
    assertTrustedSender(event);
    if (typeof targetPath !== 'string' || !targetPath.trim()) throw new Error('INVALID_PATH');
    const normalized = path.normalize(targetPath.trim());
    const errString = await shell.openPath(normalized);
    if (errString) {
      shell.showItemInFolder(normalized);
    }
    return { success: true };
  });
  ipcMain.handle(IPC.openProfile, async (event) => {
    assertTrustedSender(event);
    const dashboardUrl = (process.env.TELLANN_DASHBOARD_URL ?? 'http://localhost:3010').replace(/\/$/, '');
    const profileUrl = new URL('/settings/profile', dashboardUrl);
    if (!['http:', 'https:'].includes(profileUrl.protocol)) throw new Error('PROFILE_URL_BLOCKED');
    await shell.openExternal(profileUrl.toString());
  });
  ipcMain.handle(IPC.chooseWorkspace, async (event) => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open a project for read-only analysis',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const selected = result.filePaths[0];
    return { path: selected, name: path.basename(selected) };
  });
  ipcMain.handle(IPC.getLocalWorkspace, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    let stored = readLocalState<{
      id: string;
      path: string;
      name: string;
      snapshot: RepositorySnapshotSummary;
      cloudId?: string;
      snapshotId?: string;
    }>(localWorkspaceKey(applicationId));
    if (stored && !stored.snapshot.suggestedApplicationUrls) {
      try {
        stored = {
          ...stored,
          snapshot: await runWorkspaceScan(stored.path, {
            workspaceId: stored.id,
            scannerVersion: stored.snapshot.scannerVersion,
          }),
        };
        writeLocalState(localWorkspaceKey(applicationId), stored);
      } catch {
        // Keep the last valid snapshot when a previously attached folder is
        // temporarily unavailable. The UI can still use the environment URL.
      }
    }
    if (stored?.cloudId && stored.snapshotId) {
      selectedWorkspaces.set(applicationId, {
        applicationId, localId: stored.id, cloudId: stored.cloudId, snapshotId: stored.snapshotId,
        root: stored.path, snapshot: stored.snapshot,
      });
    }
    if (!stored) return null;
    const { cloudId: _cloudId, snapshotId: _snapshotId, ...rendererSafe } = stored;
    return rendererSafe;
  });
  ipcMain.handle(IPC.scanWorkspace, async (event, input: unknown) => {
    assertTrustedSender(event);
    const parsed = input as { path?: unknown };
    if (typeof parsed.path !== 'string') throw new Error('INVALID_SCAN_INPUT');
    const applicationId = typeof (parsed as { applicationId?: unknown }).applicationId === 'string'
      ? String((parsed as { applicationId: string }).applicationId) : null;
    if (!applicationId) throw new Error('APPLICATION_SELECTION_REQUIRED');
    const workspace = await registerSelectedWorkspace(applicationId, parsed.path);
    return { id: workspace.id, snapshot: workspace.snapshot, branchPolicy: workspace.branchPolicy ?? null };
  });
  ipcMain.handle(IPC.beginWorkspaceAnalysis, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const workspace = readLocalState<StoredWorkspace>(localWorkspaceKey(applicationId));
    if (!workspace?.cloudId || !workspace.snapshotId) throw new Error('WORKSPACE_NOT_ATTACHED');
    await beginCodebaseAnalysisWithConsent(applicationId, workspace.path, workspace.snapshot, {
      workspaceId: workspace.cloudId,
      repositorySnapshotId: workspace.snapshotId,
    });
  });
  ipcMain.handle(IPC.getCodebaseAnalysis, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const state = readAnalysisState(applicationId);
    if (!state) return null;
    // Fills the branch and revision of analyses stored before they were carried
    // through, and reports whether the folder is a Git working tree at all.
    const workspaceSnapshot = readLocalState<StoredWorkspace>(localWorkspaceKey(applicationId))?.snapshot;
    const gitDetected = hasGitDirectory(state.workspaceRoot);

    if (state.mode === 'local' || !state.cloudJobId) {
      // A local run that is marked active with no worker behind it died with a
      // previous process; report that plainly instead of a frozen progress bar.
      const stale = state.analysis
        && ACTIVE_ANALYSIS.has(state.analysis.status)
        && !codebaseWorkers.has(applicationId)
        && state.mode === 'local';
      return {
        mode: state.mode,
        source: 'local' as const,
        interrupted: Boolean(stale),
        uploadProgress: state.uploadProgress,
        analysis: withSnapshotGitDetails(state.analysis, workspaceSnapshot),
        job: null,
        gitDetected,
      };
    }

    try {
      const remote = await cloud.getCodebaseAnalysis(applicationId) as Record<string, any>;
      return {
        mode: 'cloud' as const,
        source: 'cloud' as const,
        interrupted: false,
        uploadProgress: state.uploadProgress,
        gitDetected,
        // The snapshot the job analysed is the better source; the local one
        // covers a job record that predates it.
        analysis: withSnapshotGitDetails(
          withSnapshotGitDetails((remote.analysis as CodebaseAnalysis | null) ?? null, remote.snapshot),
          workspaceSnapshot,
        ),
        job: {
          jobId: remote.jobId,
          status: remote.status,
          progress: remote.progress,
          stageMessage: remote.stageMessage,
          attempt: remote.attempt,
          maxAttempts: remote.maxAttempts,
          errorMessageSafe: remote.errorMessageSafe,
          warnings: remote.warnings ?? [],
          stages: remote.stages ?? [],
          snapshot: remote.snapshot ?? null,
        },
      };
    } catch (error) {
      return {
        mode: 'cloud' as const,
        source: 'cloud' as const,
        interrupted: false,
        uploadProgress: state.uploadProgress,
        analysis: withSnapshotGitDetails(state.analysis, workspaceSnapshot),
        job: null,
        gitDetected,
        unreachable: error instanceof Error ? error.message.slice(0, 200) : 'Cloud analysis is unreachable',
      };
    }
  });
  ipcMain.handle(IPC.cancelCodebaseAnalysis, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const state = readAnalysisState(applicationId);
    const upload = snapshotUploads.get(applicationId);
    const worker = codebaseWorkers.get(applicationId);
    return cancelCodebaseAnalysisRun({
      state: state ? {
        mode: state.mode,
        cloudJobId: state.cloudJobId,
        status: state.analysis?.status ?? null,
      } : null,
      upload,
      stopLocalWorker: worker ? async () => {
        await worker.terminate();
        codebaseWorkers.delete(applicationId);
      } : undefined,
      cancelCloudJob: (jobId) => cloud.cancelCloudCodebaseAnalysis(applicationId, jobId),
      markCancelled: () => markAnalysisCancelled(applicationId),
    });
  });
  ipcMain.handle(IPC.rescanCodebase, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const workspace = readLocalState<StoredWorkspace>(localWorkspaceKey(applicationId));
    if (!workspace) throw new Error('WORKSPACE_NOT_ATTACHED');
    if (!existsSync(workspace.path)) {
      throw new Error('The attached folder is no longer on this machine. Re-attach it to analyse again.');
    }
    const state = readAnalysisState(applicationId);
    if (state?.mode === 'cloud') {
      // Rescanning a cloud workspace sends the current revision again, so it
      // takes the same steps as attaching, without the folder picker: a fresh
      // snapshot is registered, then consent is asked against the archive that
      // would actually be uploaded (declining analyses locally instead).
      const registered = await registerSelectedWorkspace(applicationId, workspace.path);
      if (!registered.cloudId || !registered.snapshotId) throw new Error('WORKSPACE_NOT_ATTACHED');
      // Not awaited: the renderer shows the consent prompt and polls progress.
      void beginCodebaseAnalysisWithConsent(applicationId, registered.path, registered.snapshot, {
        workspaceId: registered.cloudId,
        repositorySnapshotId: registered.snapshotId,
      }).catch((error) => {
        console.warn('[codebase-analysis] Rescan could not start', error);
      });
      return { rescanned: true, requiresReattach: false };
    }
    // The QA branch is carried through so a rescan measures drift the same way
    // the original attach did, rather than silently losing it.
    const policy = workspace.branchPolicy;
    const snapshot = await runWorkspaceScan(workspace.path, {
      workspaceId: workspace.id,
      upstreamBranch: policy?.bound ? policy.qaBranchName : null,
    });
    beginLocalCodebaseAnalysis(applicationId, workspace.path, snapshot);
    return { rescanned: true, requiresReattach: false };
  });
  ipcMain.handle(IPC.codebaseQuery, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; kind?: unknown; payload?: unknown };
    if (typeof value?.applicationId !== 'string' || typeof value?.kind !== 'string') {
      throw new Error('INVALID_CODEBASE_QUERY');
    }
    const payload = (value.payload ?? {}) as Record<string, any>;
    const applicationId = value.applicationId;
    const state = readAnalysisState(applicationId);

    // A workspace that declined the upload has no analysis on the server, so
    // asking the API would 404. Everything below is answerable from the graph
    // held on this device, and answering it here is also what keeps the user's
    // choice to keep their source local meaningful.
    if (state?.mode !== 'cloud') {
      const analysis = state?.analysis;
      if (!analysis || !analysis.entities.length) {
        throw new Error('No completed local analysis is available for this workspace yet.');
      }
      switch (value.kind) {
        case 'graph':
          return projectAnalysis(analysis, payload);
        case 'hierarchy': {
          const children = hierarchyChildren(
            analysis,
            typeof payload.parentId === 'string' ? payload.parentId : null,
          );
          const offset = Math.max(Number(payload.offset) || 0, 0);
          const limit = Math.min(Math.max(Number(payload.limit) || 200, 1), 1_000);
          return { items: children.slice(offset, offset + limit), total: children.length, offset, limit };
        }
        case 'entity': {
          const detail = describeEntity(analysis, String(payload.entityId ?? ''));
          if (!detail) throw new Error('Entity not found in this analysis.');
          return detail;
        }
        case 'blast-radius':
          return blastRadiusInAnalysis(analysis, String(payload.entityId ?? ''));
        case 'ask':
          // No model runs here: a local analysis has no provider credentials and
          // must not send code anywhere. The deterministic descriptions and their
          // citations are the answer.
          return answerFromAnalysis(analysis, String(payload.question ?? ''));
        case 'compare': {
          const previous = readPreviousAnalysis(applicationId);
          if (!previous) {
            return {
              changes: [],
              message: 'Only one analysis has been kept for this workspace so far. Rescan after making a change to compare revisions.',
            };
          }
          return compareAnalyses(previous, analysis);
        }
        case 'collection': {
          const collection = String(payload.collection ?? 'features');
          const items = localCollection(analysis, collection, String(payload.search ?? ''));
          const offset = Math.max(Number(payload.offset) || 0, 0);
          const limit = Math.min(Math.max(Number(payload.limit) || 100, 1), 1_000);
          return { items: items.slice(offset, offset + limit), total: items.length, offset, limit };
        }
        default:
          throw new Error('UNKNOWN_CODEBASE_QUERY');
      }
    }

    switch (value.kind) {
      case 'graph':
        return cloud.queryCodebaseGraph(applicationId, payload);
      case 'hierarchy':
        return cloud.codebaseHierarchy(
          applicationId,
          typeof payload.parentId === 'string' ? payload.parentId : null,
          Number(payload.offset) || 0,
          Number(payload.limit) || 200,
        );
      case 'entity':
        return cloud.codebaseEntity(applicationId, String(payload.entityId ?? ''));
      case 'blast-radius':
        return cloud.codebaseBlastRadius(applicationId, String(payload.entityId ?? ''));
      case 'compare':
        return cloud.codebaseCompare(applicationId);
      case 'ask':
        return cloud.askCodebase(applicationId, String(payload.question ?? ''));
      case 'collection':
        return cloud.codebaseCollection(
          applicationId,
          String(payload.collection ?? 'features').replace(/[^a-z-]/g, ''),
          String(payload.search ?? ''),
          Number(payload.offset) || 0,
          Number(payload.limit) || 100,
        );
      default:
        throw new Error('UNKNOWN_CODEBASE_QUERY');
    }
  });
  /**
   * Open an evidence location in the user's editor. The renderer supplies a
   * repository-relative path only; the absolute path is built here and checked
   * against the attached workspace, so a crafted path cannot reach outside it.
   */
  ipcMain.handle(IPC.openCodebaseEvidence, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; path?: unknown };
    if (typeof value?.applicationId !== 'string' || typeof value?.path !== 'string') {
      throw new Error('INVALID_EVIDENCE_REQUEST');
    }
    const workspace = readLocalState<StoredWorkspace>(localWorkspaceKey(value.applicationId));
    if (!workspace) return { opened: false, reason: 'WORKSPACE_NOT_ATTACHED' };
    let absolute: string;
    try {
      absolute = resolveWithinWorkspace(workspace.path, value.path);
    } catch {
      return { opened: false, reason: 'PATH_OUTSIDE_WORKSPACE' };
    }
    if (!existsSync(absolute)) return { opened: false, reason: 'FILE_NOT_FOUND' };
    const error = await shell.openPath(absolute);
    return error ? { opened: false, reason: error } : { opened: true };
  });
  /**
   * The desktop only lists risk titles; the explanation, affected code, reach,
   * evidence, and remediation for each one are written to a PDF the user saves.
   */
  ipcMain.handle(IPC.saveCodebaseRiskReport, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const state = readAnalysisState(applicationId);
    if (!state) throw new Error('No codebase analysis is stored for this application.');
    let analysis = state.analysis;
    if (state.mode === 'cloud' && state.cloudJobId) {
      const remote = await cloud.getCodebaseAnalysis(applicationId).catch(() => null) as Record<string, any> | null;
      analysis = (remote?.analysis as CodebaseAnalysis | null) ?? analysis;
    }
    if (!analysis?.findings?.length) throw new Error('This analysis has no risks to report.');

    let workspace: StoredWorkspace | null = null;
    try {
      workspace = readLocalState<StoredWorkspace>(localWorkspaceKey(applicationId));
    } catch {
      workspace = null;
    }

    // Reach only means something for findings about a module's dependents.
    const blastRadius: Record<string, BlastRadiusResult> = {};
    for (const finding of analysis.findings) {
      const entityId = finding.entityIds[0];
      if (!entityId || (finding.kind !== 'COUPLING' && finding.kind !== 'CYCLE')) continue;
      try {
        blastRadius[finding.id] = blastRadiusInAnalysis(analysis, entityId);
      } catch {
        // A finding whose entity is absent from this payload is reported without reach.
      }
    }

    const workspaceName = (workspace?.name ?? 'Workspace').slice(0, 120);
    const pdf = await renderCodebaseRiskReportPdf({
      workspaceName,
      mode: state.mode,
      generatedAt: new Date().toISOString(),
      analysis,
      blastRadius,
    });
    const safeName = workspaceName.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'workspace';
    const filename = `Tellann-${safeName}-codebase-risk-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    const save = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save codebase risk report',
      defaultPath: path.join(app.getPath('documents'), filename),
      filters: [{ name: 'PDF report', extensions: ['pdf'] }],
    });
    if (save.canceled || !save.filePath) return { cancelled: true };
    await fs.writeFile(save.filePath, pdf);
    return { cancelled: false, filePath: save.filePath, filename: path.basename(save.filePath) };
  });
  ipcMain.handle(IPC.cloneWorkspace, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; cloneUrl?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.cloneUrl !== 'string') {
      throw new Error('INVALID_CLONE_INPUT');
    }
    const cloneUrl = new URL(value.cloneUrl);
    if (cloneUrl.protocol !== 'https:' || cloneUrl.hostname.toLowerCase() !== 'github.com' || cloneUrl.username || cloneUrl.password) {
      throw new Error('UNTRUSTED_CLONE_URL');
    }
    const repositoryName = path.basename(cloneUrl.pathname).replace(/\.git$/i, '');
    if (!/^[a-z0-9._-]+$/i.test(repositoryName)) throw new Error('INVALID_REPOSITORY_NAME');
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: `Choose where to clone ${repositoryName}`,
      buttonLabel: 'Clone here',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const destination = path.join(result.filePaths[0], repositoryName);
    try {
      await fs.access(destination);
      throw new Error('CLONE_DESTINATION_ALREADY_EXISTS');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await execFileAsync('git', ['clone', '--', cloneUrl.toString(), destination], {
      windowsHide: true,
      timeout: 10 * 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const workspace = await registerSelectedWorkspace(value.applicationId, destination);
    const { cloudId: _cloudId, snapshotId: _snapshotId, ...rendererSafe } = workspace;
    return rendererSafe;
  });
  ipcMain.handle(IPC.getBranchCompliance, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    return workspaceBranchCompliance(applicationId);
  });

  /**
   * Owner/Admin only. Flips the org-wide "allow agent checkout" flag so the
   * member (who is also a manager) does not have to leave the desktop app for
   * the dashboard. The server re-checks the caller's role; the cached policy is
   * refreshed so offline compliance reflects the change immediately.
   */
  ipcMain.handle(IPC.setBranchAgentCheckout, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; allowAgentCheckout?: unknown };
    if (typeof value.applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    if (typeof value.allowAgentCheckout !== 'boolean') throw new Error('INVALID_ALLOW_AGENT_CHECKOUT');
    const policy = await cloud.setBranchAgentCheckout(value.applicationId, value.allowAgentCheckout);
    const stored = readLocalState<StoredWorkspace>(localWorkspaceKey(value.applicationId));
    if (stored) writeLocalState(localWorkspaceKey(value.applicationId), { ...stored, branchPolicy: policy });
    return policy;
  });

  ipcMain.handle(IPC.grantQaBranchCheckout, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; expiresInMinutes?: unknown };
    if (typeof value.applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const stored = readLocalState<StoredWorkspace>(localWorkspaceKey(value.applicationId));
    if (!stored?.cloudId) throw new Error('WORKSPACE_NOT_REGISTERED');
    const minutes = typeof value.expiresInMinutes === 'number' ? value.expiresInMinutes : undefined;
    return cloud.grantQaBranchCheckout(value.applicationId, stored.cloudId, minutes);
  });

  /**
   * Performs the switch the member explicitly asked for. The grant is re-checked
   * against the server here rather than trusted from the renderer, so a revoked
   * or expired grant cannot be replayed by a stale window.
   */
  ipcMain.handle(IPC.switchToQaBranch, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const stored = readLocalState<StoredWorkspace>(localWorkspaceKey(applicationId));
    if (!stored) throw new Error('WORKSPACE_NOT_ATTACHED');

    const policy = await resolveBranchPolicy(applicationId, stored.branchPolicy);
    if (!policy?.bound) throw new Error('NO_BRANCH_POLICY');
    if (!policy.allowAgentCheckout) throw new Error('AGENT_CHECKOUT_DISABLED');
    if (!(await hasQaBranchGrant(applicationId, stored.cloudId))) throw new Error('AGENT_CHECKOUT_NOT_GRANTED');

    const { result, checkpoint } = await switchToQaBranch(stored.path, policy);
    if (checkpoint) writeLocalState(qaBranchCheckpointKey(applicationId), checkpoint);
    // Re-scan so the cloud sees the new branch immediately rather than on the
    // member's next attach.
    if (result.switched) {
      await registerSelectedWorkspace(applicationId, stored.path).catch(() => undefined);
    }
    return result;
  });

  ipcMain.handle(IPC.restoreWorkspaceBranch, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const checkpoint = readLocalState<QaBranchCheckpoint>(qaBranchCheckpointKey(applicationId));
    if (!checkpoint) throw new Error('NO_QA_BRANCH_CHECKPOINT');
    const restored = await restoreWorkspaceBranch(checkpoint);
    if (restored.restored) {
      deleteLocalState(qaBranchCheckpointKey(applicationId));
      await registerSelectedWorkspace(applicationId, checkpoint.workspaceRoot).catch(() => undefined);
    }
    return restored;
  });

  ipcMain.handle(IPC.detectInstrumentation, async (event, input: unknown) => {
    assertTrustedSender(event);
    return instrumentation.detect(parseInstrumentationContext(input));
  });
  ipcMain.handle(IPC.proposeInstrumentation, async (event, input: unknown) => {
    assertTrustedSender(event);
    const context = parseInstrumentationContext(input);
    const adapterId = (input as { adapterId?: unknown }).adapterId;
    if (!(INSTRUMENTATION_FRAMEWORK_IDS as readonly string[]).includes(String(adapterId))) throw new Error('INVALID_INSTRUMENTATION_ADAPTER');
    return instrumentation.propose({ ...context, adapterId: adapterId as InstrumentationFrameworkId });
  });
  ipcMain.handle(IPC.listInstrumentationPlans, async (event, applicationId: unknown, filters: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const parsed = InstrumentationPlanFiltersSchema.safeParse(filters ?? {});
    if (!parsed.success) throw new Error('INVALID_INSTRUMENTATION_FILTERS');
    return instrumentation.list(applicationId, parsed.data);
  });
  ipcMain.handle(IPC.renameInstrumentationPlan, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; planId?: unknown; title?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.planId !== 'string') throw new Error('INVALID_INSTRUMENTATION_PLAN_REQUEST');
    if (value.title !== null && typeof value.title !== 'string') throw new Error('INVALID_INSTRUMENTATION_TITLE');
    return instrumentation.rename(value.applicationId, value.planId, value.title);
  });
  for (const [channel, action] of [
    [IPC.archiveInstrumentationPlan, 'archive'],
    [IPC.restoreInstrumentationPlan, 'restore'],
  ] as const) {
    ipcMain.handle(channel, async (event, input: unknown) => {
      assertTrustedSender(event);
      const value = input as { applicationId?: unknown; planId?: unknown };
      if (typeof value.applicationId !== 'string' || typeof value.planId !== 'string') throw new Error('INVALID_INSTRUMENTATION_PLAN_REQUEST');
      return instrumentation[action](value.applicationId, value.planId);
    });
  }
  ipcMain.handle(IPC.getInstrumentationPlan, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; planId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.planId !== 'string') throw new Error('INVALID_INSTRUMENTATION_PLAN_REQUEST');
    return instrumentation.get(value.applicationId, value.planId);
  });
  ipcMain.handle(IPC.getLocalInstrumentationResult, (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; planId?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.planId !== 'string') throw new Error('INVALID_INSTRUMENTATION_PLAN_REQUEST');
    return instrumentation.localResult(value.applicationId, value.planId);
  });
  ipcMain.handle(IPC.generateInstrumentationReport, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; planId?: unknown; applicationName?: unknown; environmentName?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.planId !== 'string') throw new Error('INVALID_INSTRUMENTATION_REPORT_REQUEST');
    const record = await instrumentation.get(value.applicationId, value.planId) as Record<string, any>;
    const local = instrumentation.localResult(value.applicationId, value.planId) as Record<string, any> | null;
    if (!local) throw new Error('LOCAL_VALIDATION_RESULT_NOT_FOUND');
    const plan = record.planJson as Record<string, any>;
    const reportInput: ValidationReportInput = {
      applicationName: String(value.applicationName ?? 'Tellann application').slice(0, 120),
      environmentName: String(value.environmentName ?? record.environmentId ?? 'Environment').slice(0, 120),
      planId: value.planId,
      adapterId: String(plan.adapterId ?? record.adapterId ?? 'unknown'),
      adapterVersion: String(plan.adapterVersion ?? record.adapterVersion ?? 'unknown'),
      status: String(record.status ?? 'UNKNOWN'),
      generatedAt: new Date().toISOString(),
      baseRevision: typeof plan.baseRevision === 'string' ? plan.baseRevision : null,
      repositoryFingerprint: String(plan.repositoryFingerprint ?? 'Not recorded'),
      risk: String(plan.risk ?? record.risk ?? 'UNKNOWN'),
      riskReasons: Array.isArray(plan.riskReasons) ? plan.riskReasons.map(String) : [],
      packageChanges: Array.isArray(plan.packageChanges) ? plan.packageChanges.map((change: any) => ({ packageName: String(change.packageName), version: String(change.version), kind: String(change.kind) })) : [],
      operations: Array.isArray(plan.operations) ? plan.operations.map((operation: any) => ({ id: String(operation.id), kind: String(operation.kind), relativePath: String(operation.relativePath), description: String(operation.description) })) : [],
      files: Array.isArray(local.patch?.files) ? local.patch.files.map((file: any) => ({ relativePath: String(file.relativePath), beforeHash: typeof file.beforeHash === 'string' ? file.beforeHash : null, afterHash: String(file.afterHash), changed: file.changed === true })) : [],
      patch: { checkpointId: String(local.patch?.checkpointId ?? 'Not recorded'), diffHash: String(local.patch?.diffHash ?? 'Not recorded'), appliedAt: String(local.patch?.appliedAt ?? new Date().toISOString()) },
      checkpoint: local.checkpoint && typeof local.checkpoint === 'object' ? {
        kind: String(local.checkpoint.kind ?? 'UNKNOWN'), branch: typeof local.checkpoint.branch === 'string' ? local.checkpoint.branch : null,
        previousBranch: typeof local.checkpoint.previousBranch === 'string' ? local.checkpoint.previousBranch : null,
        baseRevision: typeof local.checkpoint.baseRevision === 'string' ? local.checkpoint.baseRevision : null,
        dirty: local.checkpoint.dirty === true, reason: typeof local.checkpoint.reason === 'string' ? local.checkpoint.reason : null,
        createdAt: String(local.checkpoint.createdAt ?? new Date().toISOString()),
      } : null,
      checks: Array.isArray(local.validation?.checks) ? local.validation.checks.map((check: any) => ({ name: String(check.name), passed: check.passed === true, output: safeDesktopError(check.output) })) : [],
      commands: Array.isArray(local.commandResults) ? local.commandResults.map((command: any) => ({ id: String(command.id), purpose: String(command.purpose ?? command.id), passed: command.passed === true, exitCode: typeof command.exitCode === 'number' ? command.exitCode : null, durationMs: Number(command.durationMs ?? 0), output: String(command.output ?? '').slice(-12_000) })) : [],
    };
    const pdf = await renderValidationReportPdf(reportInput);
    const safeApplication = reportInput.applicationName.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'application';
    const filename = `Tellann-${safeApplication}-validation-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    const save = await dialog.showSaveDialog(mainWindow!, { title: 'Save Tellann validation report', defaultPath: path.join(app.getPath('documents'), filename), filters: [{ name: 'PDF report', extensions: ['pdf'] }] });
    if (save.canceled || !save.filePath) return { cancelled: true };
    await fs.writeFile(save.filePath, pdf);
    try {
      const manifest = await extractDocument({ buffer: pdf, filename: path.basename(save.filePath) });
      const source = await cloud.uploadDerivedDocument(value.applicationId, manifest) as Record<string, unknown>;
      return { cancelled: false, filePath: save.filePath, filename: path.basename(save.filePath), sourceAdded: true, sourceStatus: String(source.status ?? 'QUEUED') };
    } catch (error) {
      return { cancelled: false, filePath: save.filePath, filename: path.basename(save.filePath), sourceAdded: false, sourceError: safeDesktopError(error) };
    }
  });
  ipcMain.handle(IPC.approveInstrumentation, async (event, input: unknown) => {
    assertTrustedSender(event);
    const context = parseInstrumentationContext(input);
    const value = input as { planId?: unknown; approvedFileScopes?: unknown; approvedCommandIds?: unknown };
    if (typeof value.planId !== 'string' || !Array.isArray(value.approvedFileScopes) || !Array.isArray(value.approvedCommandIds)) throw new Error('INVALID_INSTRUMENTATION_APPROVAL');
    const approved = await instrumentation.approve({
      ...context, planId: value.planId,
      approvedFileScopes: value.approvedFileScopes.filter((item): item is string => typeof item === 'string'),
      approvedCommandIds: value.approvedCommandIds.filter((item): item is string => typeof item === 'string'),
    });
    // Start the dependency install now, while the user reads the diff.
    //
    // It is the longest step in applying a plan and it changes nothing about
    // their code, so it does not need the checkpoint or the rollback that wrap
    // the rest of `apply` — only their approval, which they have just given.
    // Deliberately unawaited and its failure deliberately ignored: `apply` runs
    // the same command when there is no recorded success, so a failure here
    // costs the time it took and is reported properly there, in the run the user
    // is watching.
    const planId = value.planId;
    void instrumentation.installDependencies(context.applicationId, planId).catch((error) => {
      console.warn('[instrumentation] Early dependency install did not complete', error);
    });
    return approved;
  });
  ipcMain.handle(IPC.rejectInstrumentation, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; planId?: unknown; reason?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.planId !== 'string') throw new Error('INVALID_INSTRUMENTATION_REJECTION');
    return instrumentation.reject(value.applicationId, value.planId, typeof value.reason === 'string' ? value.reason : undefined);
  });
  for (const [channel, action] of [
    [IPC.applyInstrumentation, 'apply'],
    [IPC.validateInstrumentation, 'validate'],
    [IPC.rollbackInstrumentation, 'rollback'],
  ] as const) {
    ipcMain.handle(channel, async (event, input: unknown) => {
      assertTrustedSender(event);
      const value = input as { applicationId?: unknown; planId?: unknown; confirmOffQaBranch?: unknown };
      if (typeof value.applicationId !== 'string' || typeof value.planId !== 'string') throw new Error('INVALID_INSTRUMENTATION_ACTION');
      // Applying writes to whatever branch the workspace is on. Off the QA review
      // branch that is allowed, but only after the member confirms it: the
      // renderer asks, and an unconfirmed request is refused here.
      if (action === 'apply' && value.confirmOffQaBranch !== true) {
        const compliance = await workspaceBranchCompliance(value.applicationId);
        if (compliance?.status === 'BRANCH_MISMATCH') throw new Error('QA_BRANCH_CONFIRMATION_REQUIRED');
      }
      if (action === 'apply') return applyInstrumentationWithProgress(value.applicationId, value.planId);
      return instrumentation[action](value.applicationId, value.planId);
    });
  }
  ipcMain.handle(INSTRUMENTATION_PROGRESS_GET_CHANNEL, (event, planId: unknown) => {
    assertTrustedSender(event);
    if (typeof planId !== 'string') throw new Error('INVALID_PLAN_ID');
    return instrumentationApplyProgress.get(planId) ?? null;
  });
  ipcMain.handle(IPC.startGuidedRun, async (event, input: unknown) => {
    assertTrustedSender(event);
    // Refused here, before anything exists. The observer refuses a second run
    // too, but only after a run row, a started session and a local relay have
    // been created for a run that can never start — and the failure path that
    // cleans those up stops the relay and the event stream, which the run
    // already recording is the one using.
    if (observer.getState()) throw new Error('RUN_ALREADY_ACTIVE');
    const parsed = StartGuidedRunInputSchema.parse(input);
    if (parsed.environmentType === 'PRODUCTION' && (parsed.mode !== 'OBSERVATION_ONLY' || !parsed.productionObservationApproved)) {
      throw new Error('PRODUCTION_OBSERVATION_APPROVAL_REQUIRED');
    }
    if (parsed.mode === 'OBSERVATION_ONLY' && parsed.launchCommandId) throw new Error('OBSERVATION_ONLY_PROCESS_LAUNCH_BLOCKED');
    const selectedWorkspace = selectedWorkspaces.get(parsed.applicationId) ?? null;
    const run = await cloud.createRun({
      applicationId: parsed.applicationId,
      environmentId: parsed.environmentId,
      workspaceId: selectedWorkspace?.cloudId ?? null,
      repositorySnapshotId: selectedWorkspace?.snapshotId ?? null,
      expectedGraphVersionId: parsed.expectedGraphVersionId,
      flowId: parsed.flowId,
      flowBindingId: parsed.flowBindingId,
      flowInitializationId: parsed.flowInitializationId,
      flowScanId: parsed.flowScanId,
      flowDriftId: parsed.flowDriftId ?? null,
      captureTracks: parsed.captureTracks,
      timeoutSeconds: parsed.timeoutSeconds,
      patchSetId: parsed.patchSetId ?? null,
      mode: parsed.mode,
      targetUrl: parsed.targetUrl,
      captureVersion: QA_CAPTURE_V2_ENABLED ? '2.0' : '1.0',
    });
    const runId = String(run.id);
    if (typeof run.organizationId !== 'string') throw new Error('RUN_ORGANIZATION_CONTEXT_MISSING');
    const sessionId = crypto.randomUUID();
    const traceId = crypto.randomUUID();
    const started = await cloud.startRun(runId, sessionId, traceId);
    const queueKey = `run-relay-queue:${runId}`;
    evidenceQueues.set(runId, readLocalState<QAEvidenceEvent[]>(evidenceQueueKey(runId)) ?? []);
    void flushEvidence(runId);
    try {
      const relaySession = await relay.start({
        collectorBaseUrl: (process.env.TELLANN_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, ''),
        runCredential: started.credential.credential,
        allowedOrigin: new URL(parsed.targetUrl).origin,
        correlation: {
          runId, sessionId, traceId,
          organizationId: run.organizationId,
          applicationId: parsed.applicationId,
          environmentId: parsed.environmentId,
        },
        initialQueue: readLocalState<BufferedRelayRequest[]>(queueKey) ?? [],
        onQueueChanged: (queue) => writeLocalState(queueKey, queue),
        onEvents: handleRelayedEvents,
      });
      activeRelayConnection = {
        runId, endpoint: relaySession.endpoint, relayToken: relaySession.relayToken,
      };
      if (parsed.captureTracks?.includes('BACKEND')) startQaRunEventsStream(runId);
      await relay.emit('QA_RUN_STARTED', { mode: parsed.mode });
      if (parsed.launchCommandId) {
        if (!parsed.launchApproved) throw new Error('APPLICATION_LAUNCH_APPROVAL_REQUIRED');
        if (!selectedWorkspace || selectedWorkspace.applicationId !== parsed.applicationId) throw new Error('MATCHING_WORKSPACE_SELECTION_REQUIRED');
        const launchCommand = selectedWorkspace.snapshot.launchCommands?.find((command) => command.id === parsed.launchCommandId);
        if (!launchCommand) throw new Error('APPLICATION_LAUNCH_COMMAND_STALE');
        await applicationLauncher.start(launchCommand, selectedWorkspace.root, {
          endpoint: relaySession.endpoint,
          relayToken: relaySession.relayToken,
          runId,
          sessionId,
          traceId,
          applicationId: parsed.applicationId,
          environmentId: parsed.environmentId,
          agentVersion: app.getVersion(),
        });
      }
      const state = await observer.start({
        ...parsed,
        runId,
        sessionId,
        traceId,
        relayEndpoint: relaySession.endpoint,
        relayToken: relaySession.relayToken,
        agentVersion: app.getVersion(),
      }, path.join(app.getPath('userData'), 'qa-runs'));
      startRunMaintenance(runId);
      emitRunLifecycle(state, { cloudStatus: parsed.mode === 'GUIDED' ? 'WAITING_FOR_INITIAL' : 'RECORDING' });
      // Resolved after the browser is up so a slow graph read never delays the
      // run itself; the page shows a generic plan until this lands.
      if (parsed.flowId && parsed.expectedGraphVersionId) {
        void resolveRunFlowPlan({
          applicationId: parsed.applicationId,
          flowId: parsed.flowId,
          expectedGraphVersionId: parsed.expectedGraphVersionId,
        }).then((plan) => {
          if (observer.getState()?.runId !== runId) return;
          sendRunState(observer.setFlowPlan(plan));
        }).catch(() => undefined);
      }
      return decorateRunState(state);
    } catch (error) {
      stopRunMaintenance();
      await applicationLauncher.stop().catch(() => undefined);
      await relay.emit('QA_RUN_FAILED', { reason: 'browser_start_failed' }).catch(() => undefined);
      await relay.stop().catch(() => undefined);
      activeRelayConnection = null;
      stopQaRunEventsStream();
      await cloud.failRun(runId, error instanceof Error ? error.message : 'Managed browser failed to start').catch(() => undefined);
      throw error;
    }
  });
  ipcMain.handle(IPC.pauseGuidedRun, async (event) => {
    assertTrustedSender(event);
    const state = observer.getState();
    if (!state) throw new Error('NO_ACTIVE_RUN');
    relay.setPaused(true);
    const local = await observer.pause(true);
    try {
      await cloud.pauseRun(state.runId);
      emitRunLifecycle(local, { cloudStatus: 'PAUSED' });
      return local;
    } catch (error) {
      relay.setPaused(false);
      await observer.pause(false);
      throw error;
    }
  });
  ipcMain.handle(IPC.resumeGuidedRun, async (event) => {
    assertTrustedSender(event);
    const state = observer.getState();
    if (!state) throw new Error('NO_ACTIVE_RUN');
    const cloudState = await cloud.resumeRun(state.runId);
    relay.setPaused(false);
    const local = await observer.pause(false);
    emitRunLifecycle(local, { cloudStatus: String(cloudState.status ?? 'RECORDING') });
    return local;
  });
  ipcMain.handle(IPC.setRunInteractionMode, async (event, input: unknown) => {
    assertTrustedSender(event);
    const mode = QAInteractionModeSchema.parse(input);
    if (mode === 'INSPECT' && !QA_CAPTURE_V2_ENABLED) throw new Error('QA_CAPTURE_V2_DISABLED');
    return observer.setInteractionMode(mode);
  });
  ipcMain.handle(IPC.retryRunSynchronization, async (event, runId: unknown) => {
    assertTrustedSender(event);
    if (typeof runId !== 'string') throw new Error('RUN_ID_REQUIRED');
    const recovery = readLocalState<{ state: GuidedRunState; completionReason: string }>(`qa-run-recovery:${runId}`);
    if (recovery) {
      await flushEvidence(runId, true);
      const completed = await cloud.completeRun({ ...recovery.state, completionReason: recovery.completionReason });
      deleteLocalState(`qa-run-recovery:${runId}`);
      evidenceQueues.delete(runId);
      return completed;
    }
    return cloud.retryReport(runId);
  });
  ipcMain.handle(IPC.revealRunProtectedValue, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { runId?: unknown; valueId?: unknown };
    if (typeof value.runId !== 'string' || typeof value.valueId !== 'string') {
      throw new Error('RUN_AND_VALUE_ID_REQUIRED');
    }
    return cloud.revealProtectedValue(value.runId, value.valueId);
  });
  ipcMain.handle(IPC.getArtifactDownloadUrl, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { runId?: unknown; artifactId?: unknown };
    if (typeof value.runId !== 'string' || typeof value.artifactId !== 'string') {
      throw new Error('RUN_AND_ARTIFACT_ID_REQUIRED');
    }
    return cloud.getArtifactDownloadUrl(value.runId, value.artifactId);
  });
  ipcMain.handle(IPC.searchRunMentionableMembers, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { runId?: unknown; query?: unknown };
    if (typeof value.runId !== 'string') throw new Error('RUN_ID_REQUIRED');
    return cloud.mentionableMembers(value.runId, typeof value.query === 'string' ? value.query : '');
  });
  ipcMain.handle(IPC.endGuidedRun, async (event) => {
    assertTrustedSender(event);
    return completeActiveRun('MANUAL_STOP_BEFORE_TERMINAL');
  });
  ipcMain.handle(IPC.getRunState, (event) => {
    assertTrustedSender(event);
    const state = observer.getState();
    return state ? decorateRunState(state) : null;
  });
  ipcMain.handle(IPC.focusRunBrowser, async (event) => {
    assertTrustedSender(event);
    return decorateRunState(await observer.focusBrowser());
  });
  ipcMain.handle(IPC.reopenRunBrowser, async (event) => {
    assertTrustedSender(event);
    return decorateRunState(await observer.reopenBrowser());
  });
  ipcMain.handle(IPC.openRunPanelWindow, async (event, panel: unknown) => {
    assertTrustedSender(event);
    const id = parseRunPanelId(panel);
    const state = await openRunPanelWindow(id);
    notifyRunPanelWindowState(id);
    return state;
  });
  ipcMain.handle(IPC.closeRunPanelWindow, (event, panel: unknown) => {
    assertTrustedSender(event);
    return closeRunPanelWindow(parseRunPanelId(panel));
  });
  ipcMain.handle(IPC.getRunPanelWindowState, (event) => {
    assertTrustedSender(event);
    return runPanelWindowState();
  });
  ipcMain.handle(IPC.getRunRelayConnection, (event) => {
    assertTrustedSender(event);
    const state = observer.getState();
    if (!state || !activeRelayConnection || activeRelayConnection.runId !== state.runId) return null;
    return {
      endpoint: activeRelayConnection.endpoint,
      relayToken: activeRelayConnection.relayToken,
      runId: state.runId,
      sessionId: state.sessionId,
      traceId: state.traceId,
      applicationId: state.applicationId,
      environmentId: state.environmentId,
    };
  });
  ipcMain.handle(IPC.listIngestionKeys, async (event, environmentId: string) => {
    assertTrustedSender(event);
    return { gatewayEndpoint: cloudApiUrl(), keys: await cloud.listIngestionKeys(environmentId) };
  });
  ipcMain.handle(IPC.createIngestionKey, async (event, environmentId: string, label?: string) => {
    assertTrustedSender(event);
    return { gatewayEndpoint: cloudApiUrl(), key: await cloud.createIngestionKey(environmentId, label) };
  });
  ipcMain.handle(IPC.getEvidenceEvent, async (event, runId: string, eventId: string) => {
    assertTrustedSender(event);
    try {
      return await cloud.evidenceEvent(runId, eventId);
    } catch (error) {
      // The desktop uploads evidence in a queue flushed every couple of
      // seconds (see `flushEvidence`), so a row clicked moments after it
      // appears can legitimately not be durable yet. That is a 404, not a
      // failure — the renderer already has friendlier copy for exactly this
      // case, gated on the call resolving to null rather than rejecting.
      if ((error as { status?: number } | undefined)?.status === 404) return null;
      throw error;
    }
  });
  ipcMain.handle(IPC.checkSdkVersions, (event, applicationId: string) => {
    assertTrustedSender(event);
    const workspace = selectedWorkspaces.get(applicationId);
    // No local workspace attached yet — nothing on disk to check.
    if (!workspace) return [];
    return checkSdkVersions(workspace.root);
  });
}

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  app.setAppUserModelId('com.tellann.desktop');
  if (app.isPackaged) app.setAsDefaultProtocolClient('tellann');
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  registerIpc();
  registerWindowIpc(assertTrustedSender);
  onEndRunRequested(() => void completeActiveRun('MANUAL_STOP_BEFORE_TERMINAL'));
  await createWindow();
  deliverPendingQARunDeepLink();
  // Re-arm notifications if a session is already stored, and again whenever the
  // window regains focus (the access token may have been refreshed since).
  void syncNotificationOrganization();
  mainWindow?.on('focus', () => void syncNotificationOrganization());
  void resumeInterruptedRunSynchronization();
  // Continue document imports the previous session left mid-way.
  documentImports.resumeAll();
  await initializeUpdater().catch((error) => {
    console.error('Desktop update check failed', error instanceof Error ? error.message : error);
  });
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  captureTellannDeepLink([url]);
  deliverPendingQARunDeepLink();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  if (quittingAfterRunCleanup || !observer.getState()) return;
  event.preventDefault();
  quittingAfterRunCleanup = true;
  void observer.abort('Desktop application closed during a guided run')
    .then(async (state) => { await relay.emit('QA_RUN_FAILED', { reason: 'desktop_closed' }).catch(() => undefined); await applicationLauncher.stop().catch(() => undefined); await relay.stop().catch(() => undefined); activeRelayConnection = null; stopQaRunEventsStream(); return state; })
    .then((state) => cloud.failRun(state.runId, 'Desktop application closed during a guided run'))
    .catch(() => undefined)
    .finally(() => app.quit());
});

app.on('quit', () => closeLocalStore());
app.on('will-quit', () => void notificationClient.stop().catch(() => undefined));

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
