import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Worker } from 'node:worker_threads';
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, Notification as ElectronNotification, session, shell } from 'electron';
import { CreateApplicationInputSchema, IPC, QAInteractionModeSchema, REPOSITORY_MISMATCH_CODE, StartGuidedRunInputSchema, type BranchPolicy, type CodebaseAnalysis, type CodebaseUploadConsentRequest, type CodeEntity, type QAEvidenceEvent, type RepositorySnapshotSummary, type RunLifecycleEvent } from '@tellann/desktop-contracts';
import { resolveWithinWorkspace } from '@tellann/agent-policy';
import {
  answerFromAnalysis,
  blastRadiusInAnalysis,
  buildSanitizedSourceArchive,
  compareAnalyses,
  describeEntity,
  hierarchyChildren,
  previewSanitizedSourceArchive,
  projectAnalysis,
  scanWorkspace,
} from '@tellann/project-intelligence';
import { BrowserObserver, type GuidedRunState } from '@tellann/browser-observer';
import { DesktopCloudClient } from './cloud-client';
import { distinctMarkers, scanWorkspaceForFlowMarkers } from './flow-marker-scan';
import { initializeUpdater } from './update-manager';
import { closeLocalStore, deleteLocalState, listLocalStateKeys, readLocalState, writeLocalState } from './local-store';
import { extractDocument } from '@tellann/document-intelligence';
import { InstrumentationController, type SelectedWorkspace } from './instrumentation-controller';
import { workspaceLocalId } from './device-identity';
import {
  evaluateCompliance,
  restoreWorkspaceBranch,
  switchToQaBranch,
  type QaBranchCheckpoint,
} from './qa-branch';
import { LocalRunRelay, type BufferedRelayRequest } from '@tellann/local-relay';
import { LocalApplicationLauncher } from './application-launcher';
import { renderValidationReportPdf, type ValidationReportInput } from './validation-report';
import { loadDesktopEnvironment } from './environment';
import { DesktopNotificationClient } from './notification-client';

loadDesktopEnvironment();

let mainWindow: BrowserWindow | null = null;
let quittingAfterRunCleanup = false;
const packagedChromiumPath = path.join(process.resourcesPath, 'chromium', 'chrome-win64', 'chrome.exe');
const cloud = new DesktopCloudClient();
const notificationClient = new DesktopNotificationClient({
  apiUrl: process.env.TELLANN_API_URL ?? 'http://127.0.0.1:3000',
  appVersion: app.getVersion(),
  getWindow: () => mainWindow,
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
let pendingSetupHandoffToken: string | null = null;
let activeOrganizationId: string | null = null;
const execFileAsync = promisify(execFile);
const instrumentation = new InstrumentationController(
  cloud,
  (applicationId) => selectedWorkspaces.get(applicationId) ?? null,
  applicationLauncher,
);

function captureSetupDeepLink(values: string[]): void {
  const candidate = values.find((value) => value.startsWith('tellann://'));
  if (!candidate) return;
  try {
    const url = new URL(candidate);
    if (url.hostname !== 'connect') return;
    const token = url.searchParams.get('handoff');
    if (token && token.length >= 32) pendingSetupHandoffToken = token;
  } catch {
    // Ignore malformed external protocol input.
  }
}

captureSetupDeepLink(process.argv);
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

function emitRunLifecycle(state: GuidedRunState, input: Partial<RunLifecycleEvent> = {}): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(IPC.runLifecycleEvent, {
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
    timestamp: new Date().toISOString(),
    ...input,
  } satisfies RunLifecycleEvent);
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
  if (queue.length >= 100) void flushEvidence(event.runId);
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
    if (!supported.has(eventType)) continue;
    const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata as Record<string, unknown> : {};
    await observer.recordFlowEvent(event);
    const stateKey = String(metadata.stateKey ?? metadata.toStateKey ?? '');
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
    await observer.acceptBoundaryOutcome({ accepted: Boolean(boundary.accepted), phase: boundary.phase, stateKey });
    const updated = observer.getState();
    if (updated) emitRunLifecycle(updated, { cloudStatus: boundary.accepted ? 'ACCEPTED' : `QUARANTINED:${boundary.reason ?? 'unknown'}` });
    if (boundary.shouldStop) setTimeout(() => void completeActiveRun('TERMINAL_STATE_REACHED'), 0);
  }
}

const observer = new BrowserObserver({
  executablePath: app.isPackaged ? packagedChromiumPath : undefined,
  // Headless mode is reserved for deterministic installed-application
  // acceptance. Normal desktop runs always show the managed browser.
  headless: process.env.TELLANN_BROWSER_HEADLESS === 'true',
  onUnexpectedTermination: async (state) => {
    stopRunMaintenance();
    emitRunLifecycle(state, { localStatus: 'FAILED', safeError: 'Managed Chromium closed unexpectedly.' });
    await relay.emit('QA_RUN_FAILED', { reason: 'managed_browser_terminated' }).catch(() => undefined);
    await applicationLauncher.stop().catch(() => undefined);
    await relay.stop().catch(() => undefined);
    await cloud.failRun(state.runId, 'Managed browser terminated unexpectedly').catch(() => undefined);
  },
  onObservation: async () => undefined,
  onEvidenceEvent: async (event) => enqueueEvidence(event),
  searchMentionableMembers: (runId, query) => cloud.mentionableMembers(runId, query),
  onAnnotation: (runId, annotation) => cloud.saveAnnotation(runId, annotation),
});
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
        body: 'Chromium was closed and your QA report is being prepared.',
      }).show();
    }
    await relay.emit('QA_RUN_COMPLETED', { observationCount: state.observations.length, findingCount: state.findings.length, completionReason: resolvedReason });
    await applicationLauncher.stop();
    await relay.stop();
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
  updatedAt: string;
  /** Present for local analyses; a cloud analysis is fetched from the API. */
  analysis: CodebaseAnalysis | null;
  uploadProgress: { sent: number; total: number } | null;
};

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
  writeLocalState(codebaseAnalysisKey(applicationId), { ...state, updatedAt: new Date().toISOString() });
}

function patchLocalAnalysis(applicationId: string, patch: Partial<CodebaseAnalysis>): void {
  const state = readAnalysisState(applicationId);
  if (!state?.analysis) return;
  writeAnalysisState(applicationId, { ...state, analysis: { ...state.analysis, ...patch } });
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
      if (state) writeAnalysisState(applicationId, { ...state, analysis: message.analysis });
      if (message.cache) {
        try {
          writeLocalState(codebaseCacheKey(applicationId), message.cache);
        } catch (error) {
          console.warn('[codebase-analysis] Could not persist the incremental cache', error);
        }
      }
    } else if (message.type === 'error') {
      patchLocalAnalysis(applicationId, {
        status: 'FAILED',
        stageMessage: String(message.message ?? 'Analysis failed').slice(0, 240),
        completedAt: new Date().toISOString(),
      });
    }
  });
  worker.once('exit', () => codebaseWorkers.delete(applicationId));
  worker.once('error', (error) => {
    patchLocalAnalysis(applicationId, {
      status: 'FAILED',
      stageMessage: error.message.slice(0, 240),
      completedAt: new Date().toISOString(),
    });
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
  let preview: ReturnType<typeof previewSanitizedSourceArchive>;
  try {
    preview = previewSanitizedSourceArchive(selectedPath);
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
  try {
    writeAnalysisState(applicationId, {
      mode: 'cloud',
      cloudJobId: null,
      workspaceRoot: selectedPath,
      workspaceId: registered.workspaceId,
      repositoryFingerprint: snapshot.repositoryFingerprint,
      updatedAt: new Date().toISOString(),
      analysis: pendingAnalysis(snapshot, 'Preparing the sanitized source snapshot'),
      uploadProgress: { sent: 0, total: 1 },
    });
    const archive = buildSanitizedSourceArchive(selectedPath);
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
      onProgress: (sent, total) => {
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
    const state = readAnalysisState(applicationId);
    writeAnalysisState(applicationId, {
      mode: 'cloud',
      cloudJobId: created.jobId,
      workspaceRoot: selectedPath,
      workspaceId: registered.workspaceId,
      repositoryFingerprint: snapshot.repositoryFingerprint,
      updatedAt: new Date().toISOString(),
      analysis: state?.analysis ?? pendingAnalysis(snapshot, 'Queued for analysis'),
      uploadProgress: null,
    });
  } catch (error) {
    // The upload failed, so no cloud job exists to wait for. Fall back to a
    // local analysis and say why rather than showing a job that will never move.
    console.warn('[codebase-analysis] Source upload failed; analysing locally instead', error);
    beginLocalCodebaseAnalysis(applicationId, selectedPath, snapshot);
    patchLocalAnalysis(applicationId, {
      warnings: ['The source snapshot could not be uploaded, so this analysis ran on your machine instead.'],
    });
  }
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
  const snapshot = await scanWorkspace(selectedPath, {
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
    captureSetupDeepLink(argv);
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
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
  };
}

async function createWindow(): Promise<void> {
  const showImmediately = !app.isPackaged;
  const windowIconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.resolve(__dirname, '../../../build/icon.png');
  mainWindow = new BrowserWindow({
    width: 1584,
    height: 990,
    minWidth: 1180,
    minHeight: 720,
    icon: windowIconPath,
    // In development, show the shell immediately so a renderer/preload failure
    // cannot leave Electron running invisibly behind the Vite process.
    show: showImmediately,
    backgroundColor: '#080808',
    title: 'Tellann',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#ffffff',
      height: 32,
    },
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
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) await mainWindow.loadURL(devUrl);
  else await mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
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
  ipcMain.handle(IPC.listRuns, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    return cloud.runs(applicationId);
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
  ipcMain.handle(IPC.getRunReport, async (event, runId: unknown) => {
    assertTrustedSender(event);
    if (typeof runId !== 'string') throw new Error('INVALID_RUN_ID');
    return cloud.runReport(runId);
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
    const value = input as { applicationId?: unknown; name?: unknown; workflowType?: unknown; purpose?: unknown; scopeStatement?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.name !== 'string' || typeof value.workflowType !== 'string' || typeof value.scopeStatement !== 'string') throw new Error('INVALID_DECLARED_FLOW_REQUEST');
    return cloud.createDeclaredFlow(value.applicationId, { name: value.name, workflowType: value.workflowType, purpose: typeof value.purpose === 'string' ? value.purpose : undefined, scopeStatement: value.scopeStatement });
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
    return cloud.initializeFlow(value.flowId, {
      flowVersionId: value.flowVersionId,
      workspaceId: workspace.cloudId,
      repositorySnapshotId: workspace.snapshotId,
      environmentId: value.environmentId,
      instrumentationPlanId: typeof value.instrumentationPlanId === 'string' ? value.instrumentationPlanId : null,
    });
  });
  ipcMain.handle(IPC.getFlowInitialization, async (event, initializationId: unknown) => {
    assertTrustedSender(event);
    if (typeof initializationId !== 'string') throw new Error('INVALID_FLOW_INITIALIZATION_ID');
    return cloud.flowInitialization(initializationId);
  });
  ipcMain.handle(IPC.analyzeFlowInitialization, async (event, initializationId: unknown) => {
    assertTrustedSender(event);
    if (typeof initializationId !== 'string') throw new Error('INVALID_FLOW_INITIALIZATION_ID');
    return cloud.analyzeFlowInitialization(initializationId);
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
  ipcMain.handle(IPC.importDocuments, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select product documents for local analysis', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Product documents', extensions: ['pdf', 'docx', 'md', 'markdown', 'txt', 'html', 'htm', 'json', 'yaml', 'yml'] }],
    });
    if (result.canceled) return [];
    const uploaded = [];
    for (const filePath of result.filePaths.slice(0, 20)) {
      const filename = path.basename(filePath);
      try {
        const buffer = await fs.readFile(filePath);
        const manifest = await extractDocument({ buffer, filename });
        const response = await cloud.uploadDerivedDocument(applicationId, manifest) as any;
        uploaded.push({
          filename, documentId: response.documentId ?? null, jobId: response.jobId ?? null,
          status: response.status ?? 'QUEUED', deduplicated: response.deduplicated === true,
          versionId: response.versionId ?? null, errorMessageSafe: null,
        });
      } catch (error) {
        uploaded.push({ filename, documentId: null, jobId: null, status: 'FAILED', deduplicated: false, versionId: null, errorMessageSafe: safeDesktopError(error) });
      }
    }
    return uploaded;
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
  ipcMain.handle(IPC.getLocalWorkspace, (event, applicationId: unknown) => {
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
          snapshot: scanWorkspace(stored.path, {
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
        analysis: state.analysis,
        job: null,
      };
    }

    try {
      const remote = await cloud.getCodebaseAnalysis(applicationId) as Record<string, any>;
      return {
        mode: 'cloud' as const,
        source: 'cloud' as const,
        interrupted: false,
        uploadProgress: state.uploadProgress,
        analysis: (remote.analysis as CodebaseAnalysis | null) ?? null,
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
        analysis: state.analysis,
        job: null,
        unreachable: error instanceof Error ? error.message.slice(0, 200) : 'Cloud analysis is unreachable',
      };
    }
  });
  ipcMain.handle(IPC.cancelCodebaseAnalysis, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const state = readAnalysisState(applicationId);
    if (state?.mode === 'cloud' && state.cloudJobId) {
      await cloud.cancelCloudCodebaseAnalysis(applicationId, state.cloudJobId).catch(() => undefined);
      return { cancelled: true };
    }
    const worker = codebaseWorkers.get(applicationId);
    if (!worker) return { cancelled: false };
    await worker.terminate();
    codebaseWorkers.delete(applicationId);
    patchLocalAnalysis(applicationId, {
      status: 'CANCELLED',
      stageMessage: 'Analysis cancelled',
      completedAt: new Date().toISOString(),
    });
    return { cancelled: true };
  });
  ipcMain.handle(IPC.rescanCodebase, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    const workspace = readLocalState<StoredWorkspace>(localWorkspaceKey(applicationId));
    if (!workspace) throw new Error('WORKSPACE_NOT_ATTACHED');
    const state = readAnalysisState(applicationId);
    if (state?.mode === 'cloud') {
      // Rescanning a cloud workspace means sending the current revision again;
      // re-attaching is the one path that asks for consent against real numbers.
      return { rescanned: false, requiresReattach: true };
    }
    if (!existsSync(workspace.path)) {
      throw new Error('The attached folder is no longer on this machine. Re-attach it to analyse again.');
    }
    // The QA branch is carried through so a rescan measures drift the same way
    // the original attach did, rather than silently losing it.
    const policy = workspace.branchPolicy;
    const snapshot = await scanWorkspace(workspace.path, {
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
    if (!['react-vite', 'nextjs', 'express', 'fastify', 'nestjs'].includes(String(adapterId))) throw new Error('INVALID_INSTRUMENTATION_ADAPTER');
    return instrumentation.propose({ ...context, adapterId: adapterId as 'react-vite' | 'nextjs' | 'express' | 'fastify' | 'nestjs' });
  });
  ipcMain.handle(IPC.listInstrumentationPlans, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    return instrumentation.list(applicationId);
  });
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
    return instrumentation.approve({
      ...context, planId: value.planId,
      approvedFileScopes: value.approvedFileScopes.filter((item): item is string => typeof item === 'string'),
      approvedCommandIds: value.approvedCommandIds.filter((item): item is string => typeof item === 'string'),
    });
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
      const value = input as { applicationId?: unknown; planId?: unknown };
      if (typeof value.applicationId !== 'string' || typeof value.planId !== 'string') throw new Error('INVALID_INSTRUMENTATION_ACTION');
      return instrumentation[action](value.applicationId, value.planId);
    });
  }
  ipcMain.handle(IPC.startGuidedRun, async (event, input: unknown) => {
    assertTrustedSender(event);
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
      emitRunLifecycle(state, { cloudStatus: 'WAITING_FOR_INITIAL' });
      return state;
    } catch (error) {
      stopRunMaintenance();
      await applicationLauncher.stop().catch(() => undefined);
      await relay.emit('QA_RUN_FAILED', { reason: 'browser_start_failed' }).catch(() => undefined);
      await relay.stop().catch(() => undefined);
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
    return observer.getState();
  });
}

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  app.setAppUserModelId('com.tellann.desktop');
  if (app.isPackaged) app.setAsDefaultProtocolClient('tellann');
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  registerIpc();
  await createWindow();
  // Re-arm notifications if a session is already stored, and again whenever the
  // window regains focus (the access token may have been refreshed since).
  void syncNotificationOrganization();
  mainWindow?.on('focus', () => void syncNotificationOrganization());
  void resumeInterruptedRunSynchronization();
  await initializeUpdater().catch((error) => {
    console.error('Desktop update check failed', error instanceof Error ? error.message : error);
  });
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  captureSetupDeepLink([url]);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  if (quittingAfterRunCleanup || !observer.getState()) return;
  event.preventDefault();
  quittingAfterRunCleanup = true;
  void observer.abort('Desktop application closed during a guided run')
    .then(async (state) => { await relay.emit('QA_RUN_FAILED', { reason: 'desktop_closed' }).catch(() => undefined); await applicationLauncher.stop().catch(() => undefined); await relay.stop().catch(() => undefined); return state; })
    .then((state) => cloud.failRun(state.runId, 'Desktop application closed during a guided run'))
    .catch(() => undefined)
    .finally(() => app.quit());
});

app.on('quit', () => closeLocalStore());
app.on('will-quit', () => void notificationClient.stop().catch(() => undefined));

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
