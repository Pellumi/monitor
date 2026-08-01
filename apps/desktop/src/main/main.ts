import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron';
import { IPC, StartGuidedRunInputSchema } from '@sots/desktop-contracts';
import { resolveWithinWorkspace } from '@sots/agent-policy';
import { scanWorkspace } from '@sots/project-intelligence';
import { BrowserObserver } from '@sots/browser-observer';
import { DesktopCloudClient } from './cloud-client';
import { initializeUpdater } from './update-manager';
import { closeLocalStore, readLocalState, writeLocalState } from './local-store';
import { extractDocument } from '@sots/document-intelligence';

let mainWindow: BrowserWindow | null = null;
let quittingAfterRunCleanup = false;
const packagedChromiumPath = path.join(process.resourcesPath, 'chromium', 'chrome-win64', 'chrome.exe');
const cloud = new DesktopCloudClient();
const observer = new BrowserObserver({
  executablePath: app.isPackaged ? packagedChromiumPath : undefined,
  onUnexpectedTermination: async (state) => {
    await cloud.failRun(state.runId, 'Managed browser terminated unexpectedly').catch(() => undefined);
  },
});
let selectedWorkspace: { localId: string; cloudId: string; snapshotId: string } | null = null;

function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
    throw new Error('UNTRUSTED_IPC_SENDER');
  }
}

async function createWindow(): Promise<void> {
  const showImmediately = !app.isPackaged;
  mainWindow = new BrowserWindow({
    width: 1584,
    height: 990,
    minWidth: 1180,
    minHeight: 720,
    // In development, show the shell immediately so a renderer/preload failure
    // cannot leave Electron running invisibly behind the Vite process.
    show: showImmediately,
    backgroundColor: '#080808',
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
  ipcMain.handle(IPC.getSession, (event) => {
    assertTrustedSender(event);
    return cloud.getSession();
  });
  ipcMain.handle(IPC.signIn, async (event) => {
    assertTrustedSender(event);
    return cloud.signIn();
  });
  ipcMain.handle(IPC.signOut, async (event) => {
    assertTrustedSender(event);
    await cloud.signOut();
    selectedWorkspace = null;
  });
  ipcMain.handle(IPC.getApplications, async (event) => {
    assertTrustedSender(event);
    return cloud.applications();
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
  ipcMain.handle(IPC.listDocuments, async (event, applicationId: unknown) => {
    assertTrustedSender(event);
    if (typeof applicationId !== 'string') throw new Error('INVALID_APPLICATION_ID');
    return cloud.documents(applicationId);
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
      const buffer = await fs.readFile(filePath);
      const manifest = await extractDocument({ buffer, filename: path.basename(filePath) });
      uploaded.push(await cloud.uploadDerivedDocument(applicationId, manifest));
    }
    return uploaded;
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
    return cloud.createIntentDraft(value.applicationId, value.documentVersionIds.filter((id): id is string => typeof id === 'string'), selectedWorkspace?.snapshotId);
  });
  ipcMain.handle(IPC.reviewIntentDraft, async (event, input: unknown) => {
    assertTrustedSender(event);
    const value = input as { applicationId?: unknown; draftId?: unknown; review?: unknown };
    if (typeof value.applicationId !== 'string' || typeof value.draftId !== 'string' || !value.review || typeof value.review !== 'object') throw new Error('INVALID_INTENT_REVIEW');
    return cloud.reviewIntentDraft(value.applicationId, value.draftId, value.review as Record<string, unknown>);
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
    const stored = readLocalState<{
      id: string;
      path: string;
      name: string;
      snapshot: unknown;
      cloudId?: string;
      snapshotId?: string;
    }>(`workspace:${applicationId}`);
    if (stored?.cloudId && stored.snapshotId) {
      selectedWorkspace = { localId: stored.id, cloudId: stored.cloudId, snapshotId: stored.snapshotId };
    }
    if (!stored) return null;
    const { cloudId: _cloudId, snapshotId: _snapshotId, ...rendererSafe } = stored;
    return rendererSafe;
  });
  ipcMain.handle(IPC.scanWorkspace, async (event, input: unknown) => {
    assertTrustedSender(event);
    const parsed = input as { path?: unknown; workspaceId?: unknown };
    if (typeof parsed.path !== 'string' || typeof parsed.workspaceId !== 'string') {
      throw new Error('INVALID_SCAN_INPUT');
    }
    resolveWithinWorkspace(parsed.path, '.');
    const snapshot = await scanWorkspace(parsed.path, { workspaceId: parsed.workspaceId });
    const applicationId = typeof (parsed as { applicationId?: unknown }).applicationId === 'string'
      ? String((parsed as { applicationId: string }).applicationId) : null;
    if (!applicationId) throw new Error('APPLICATION_SELECTION_REQUIRED');
    const registered = await cloud.registerWorkspace(applicationId, parsed.workspaceId, snapshot);
    selectedWorkspace = { localId: parsed.workspaceId, cloudId: registered.workspaceId, snapshotId: registered.repositorySnapshotId };
    writeLocalState(`workspace:${applicationId}`, {
      id: parsed.workspaceId,
      path: parsed.path,
      name: path.basename(parsed.path),
      snapshot,
      cloudId: registered.workspaceId,
      snapshotId: registered.repositorySnapshotId,
    });
    return snapshot;
  });
  ipcMain.handle(IPC.startGuidedRun, async (event, input: unknown) => {
    assertTrustedSender(event);
    const parsed = StartGuidedRunInputSchema.parse(input);
    if (parsed.environmentType === 'PRODUCTION') {
      throw new Error('PRODUCTION_OBSERVATION_ONLY_ATTACHMENT_REQUIRED');
    }
    const run = await cloud.createRun({
      applicationId: parsed.applicationId,
      environmentId: parsed.environmentId,
      workspaceId: selectedWorkspace?.cloudId ?? null,
      repositorySnapshotId: selectedWorkspace?.snapshotId ?? null,
      expectedGraphVersionId: parsed.expectedGraphVersionId,
      mode: 'GUIDED',
      targetUrl: parsed.targetUrl,
    });
    const runId = String(run.id);
    const sessionId = crypto.randomUUID();
    const traceId = crypto.randomUUID();
    await cloud.startRun(runId, sessionId, traceId);
    try {
      return await observer.start({
        ...parsed,
        runId,
        sessionId,
        traceId,
      }, path.join(app.getPath('userData'), 'qa-runs'));
    } catch (error) {
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
    const state = await observer.end();
    try {
      await cloud.completeRun(state);
    } catch (error) {
      await cloud.failRun(state.runId, error instanceof Error ? error.message : 'Run synchronization failed').catch(() => undefined);
      throw error;
    }
    return state;
  });
  ipcMain.handle(IPC.getRunState, (event) => {
    assertTrustedSender(event);
    return observer.getState();
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.tellann.desktop');
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  registerIpc();
  await createWindow();
  await initializeUpdater().catch((error) => {
    console.error('Desktop update check failed', error instanceof Error ? error.message : error);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  if (quittingAfterRunCleanup || !observer.getState()) return;
  event.preventDefault();
  quittingAfterRunCleanup = true;
  void observer.abort('Desktop application closed during a guided run')
    .then((state) => cloud.failRun(state.runId, 'Desktop application closed during a guided run'))
    .catch(() => undefined)
    .finally(() => app.quit());
});

app.on('quit', () => closeLocalStore());

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
