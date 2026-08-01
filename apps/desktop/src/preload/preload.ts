import { contextBridge, ipcRenderer } from 'electron';

const IPC = {
  getVersion: 'tellann:version',
  getSession: 'tellann:auth:session',
  signIn: 'tellann:auth:sign-in',
  signOut: 'tellann:auth:sign-out',
  getApplications: 'tellann:cloud:applications',
  listRuns: 'tellann:cloud:runs:list',
  getRun: 'tellann:cloud:runs:get',
  getRunReport: 'tellann:cloud:runs:report',
  getDeclaredFlows: 'tellann:cloud:intent:list',
  importDocuments: 'tellann:documents:import',
  listDocuments: 'tellann:documents:list',
  createIntentDraft: 'tellann:intent:draft:create',
  listIntentDrafts: 'tellann:intent:draft:list',
  getIntentDraft: 'tellann:intent:draft:get',
  reviewIntentDraft: 'tellann:intent:draft:review',
  correctIntentDraft: 'tellann:intent:draft:correct',
  openExternal: 'tellann:system:open-external',
  openProfile: 'tellann:system:open-profile',
  chooseWorkspace: 'tellann:workspace:choose',
  getLocalWorkspace: 'tellann:workspace:local-state',
  scanWorkspace: 'tellann:workspace:scan',
  startGuidedRun: 'tellann:run:start',
  pauseGuidedRun: 'tellann:run:pause',
  endGuidedRun: 'tellann:run:end',
  getRunState: 'tellann:run:state',
} as const;

contextBridge.exposeInMainWorld('tellann', {
  auth: {
    getSession: () => ipcRenderer.invoke(IPC.getSession),
    signIn: () => ipcRenderer.invoke(IPC.signIn),
    signOut: () => ipcRenderer.invoke(IPC.signOut),
  },
  projects: {
    list: () => ipcRenderer.invoke(IPC.getApplications),
    getLocalWorkspace: (applicationId: string) => ipcRenderer.invoke(IPC.getLocalWorkspace, applicationId),
    chooseWorkspace: () => ipcRenderer.invoke(IPC.chooseWorkspace),
    scanWorkspace: (input: { path: string; workspaceId: string; applicationId: string }) =>
      ipcRenderer.invoke(IPC.scanWorkspace, input),
  },
  intent: {
    listDeclaredFlows: (applicationId: string) => ipcRenderer.invoke(IPC.getDeclaredFlows, applicationId),
    listDrafts: (applicationId: string) => ipcRenderer.invoke(IPC.listIntentDrafts, applicationId),
    getDraft: (applicationId: string, draftId: string) => ipcRenderer.invoke(IPC.getIntentDraft, { applicationId, draftId }),
    createDraft: (applicationId: string, documentVersionIds: string[]) => ipcRenderer.invoke(IPC.createIntentDraft, { applicationId, documentVersionIds }),
    reviewDraft: (applicationId: string, draftId: string, review: unknown) => ipcRenderer.invoke(IPC.reviewIntentDraft, { applicationId, draftId, review }),
    correctDraft: (applicationId: string, draftId: string, correction: string) => ipcRenderer.invoke(IPC.correctIntentDraft, { applicationId, draftId, correction }),
  },
  documents: {
    list: (applicationId: string) => ipcRenderer.invoke(IPC.listDocuments, applicationId),
    import: (applicationId: string) => ipcRenderer.invoke(IPC.importDocuments, applicationId),
  },
  runs: {
    list: (applicationId: string) => ipcRenderer.invoke(IPC.listRuns, applicationId),
    get: (runId: string) => ipcRenderer.invoke(IPC.getRun, runId),
    getReport: (runId: string) => ipcRenderer.invoke(IPC.getRunReport, runId),
    start: (input: unknown) => ipcRenderer.invoke(IPC.startGuidedRun, input),
    pause: () => ipcRenderer.invoke(IPC.pauseGuidedRun),
    end: () => ipcRenderer.invoke(IPC.endGuidedRun),
    getActive: () => ipcRenderer.invoke(IPC.getRunState),
  },
  system: {
    getVersion: () => ipcRenderer.invoke(IPC.getVersion),
    openExternal: (url: string) => ipcRenderer.invoke(IPC.openExternal, url),
    openProfile: () => ipcRenderer.invoke(IPC.openProfile),
  },
});
