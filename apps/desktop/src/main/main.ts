import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, session, shell } from 'electron';
import { IPC, StartGuidedRunInputSchema, type BranchPolicy, type RepositorySnapshotSummary } from '@tellann/desktop-contracts';
import { resolveWithinWorkspace } from '@tellann/agent-policy';
import { scanWorkspace } from '@tellann/project-intelligence';
import { BrowserObserver } from '@tellann/browser-observer';
import { DesktopCloudClient } from './cloud-client';
import { initializeUpdater } from './update-manager';
import { closeLocalStore, deleteLocalState, readLocalState, writeLocalState } from './local-store';
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

let mainWindow: BrowserWindow | null = null;
let quittingAfterRunCleanup = false;
const packagedChromiumPath = path.join(process.resourcesPath, 'chromium', 'chrome-win64', 'chrome.exe');
const cloud = new DesktopCloudClient();
const relay = new LocalRunRelay();
const applicationLauncher = new LocalApplicationLauncher();
const selectedWorkspaces = new Map<string, SelectedWorkspace>();
let pendingSetupHandoffToken: string | null = null;
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
const observer = new BrowserObserver({
  executablePath: app.isPackaged ? packagedChromiumPath : undefined,
  // Headless mode is reserved for deterministic installed-application
  // acceptance. Normal desktop runs always show the managed browser.
  headless: process.env.TELLANN_BROWSER_HEADLESS === 'true',
  onUnexpectedTermination: async (state) => {
    await relay.emit('QA_RUN_FAILED', { reason: 'managed_browser_terminated' }).catch(() => undefined);
    await applicationLauncher.stop().catch(() => undefined);
    await relay.stop().catch(() => undefined);
    await cloud.failRun(state.runId, 'Managed browser terminated unexpectedly').catch(() => undefined);
  },
  onObservation: async (runId, observation) => {
    const boundary = await cloud.boundaryEvent(runId, {
      eventId: observation.eventId,
      stateKey: observation.stateName,
      stateName: observation.stateName,
      timestamp: observation.timestamp,
      source: 'DESKTOP_BROWSER',
    }).catch(() => undefined) as { shouldStop?: boolean } | undefined;
    if (boundary?.shouldStop) setTimeout(() => void completeActiveRun('TERMINAL_STATE_REACHED'), 0);
  },
});
let runCompletionInProgress = false;

async function completeActiveRun(completionReason: 'TERMINAL_STATE_REACHED' | 'MANUAL_STOP_BEFORE_TERMINAL') {
  if (runCompletionInProgress || !observer.getState()) return null;
  runCompletionInProgress = true;
  try {
    const state = await observer.end();
    await relay.emit('QA_RUN_COMPLETED', { observationCount: state.observations.length, findingCount: state.findings.length, completionReason });
    await applicationLauncher.stop();
    await relay.stop();
    await cloud.completeRun({ ...state, completionReason });
    return state;
  } catch (error) {
    const state = observer.getState();
    if (state) await cloud.failRun(state.runId, error instanceof Error ? error.message : 'Run synchronization failed').catch(() => undefined);
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
  const registered = await cloud.registerWorkspace(applicationId, workspaceId, snapshot);
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
    return cloud.signIn();
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
    await cloud.signOut();
    selectedWorkspaces.clear();
  });
  ipcMain.handle(IPC.getApplications, async (event) => {
    assertTrustedSender(event);
    return cloud.applications();
  });
  cloud.subscribeToAppEvents((appEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.appUpdated, appEvent);
    }
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
    });
    const runId = String(run.id);
    if (typeof run.organizationId !== 'string') throw new Error('RUN_ORGANIZATION_CONTEXT_MISSING');
    const sessionId = crypto.randomUUID();
    const traceId = crypto.randomUUID();
    const started = await cloud.startRun(runId, sessionId, traceId);
    const queueKey = `run-relay-queue:${runId}`;
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
      return await observer.start({
        ...parsed,
        runId,
        sessionId,
        traceId,
        relayEndpoint: relaySession.endpoint,
        relayToken: relaySession.relayToken,
        agentVersion: app.getVersion(),
      }, path.join(app.getPath('userData'), 'qa-runs'));
    } catch (error) {
      await applicationLauncher.stop().catch(() => undefined);
      await relay.emit('QA_RUN_FAILED', { reason: 'browser_start_failed' }).catch(() => undefined);
      await relay.stop().catch(() => undefined);
      await cloud.failRun(runId, error instanceof Error ? error.message : 'Managed browser failed to start').catch(() => undefined);
      throw error;
    }
  });
  ipcMain.handle(IPC.pauseGuidedRun, async (event) => {
    assertTrustedSender(event);
    return observer.pause();
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

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
