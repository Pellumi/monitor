import { contextBridge, ipcRenderer, webUtils } from 'electron';

// Mirrors WINDOW_CHANNELS in main/window-chrome.ts.
const WINDOW_IPC = {
  state: 'tellann:window:state',
  getState: 'tellann:window:state:get',
  navigate: 'tellann:window:navigate',
  command: 'tellann:window:command',
  consumeCommand: 'tellann:window:command:consume',
  contextMenu: 'tellann:window:context-menu',
  confirm: 'tellann:window:confirm',
  setMode: 'tellann:window:mode',
} as const;

function subscribe<T>(channel: string, callback: (value: T) => void) {
  const subscription = (_: unknown, data: T) => callback(data);
  ipcRenderer.on(channel, subscription);
  return () => {
    ipcRenderer.removeListener(channel, subscription);
  };
}

const IPC = {
  getVersion: 'tellann:version',
  copyText: 'tellann:system:copy-text',
  getSession: 'tellann:auth:session',
  getAvatarDataUri: 'tellann:auth:avatar',
  claimSetupHandoff: 'tellann:setup:handoff:claim',
  consumeSetupHandoff: 'tellann:setup:handoff:consume',
  getSdkSetup: 'tellann:setup:sdk:get',
  issueSdkSetupKey: 'tellann:setup:sdk:key',
  signIn: 'tellann:auth:sign-in',
  reopenSignIn: 'tellann:auth:reopen-sign-in',
  cancelSignIn: 'tellann:auth:cancel-sign-in',
  signOut: 'tellann:auth:sign-out',
  getApplications: 'tellann:cloud:applications',
  getOrganizations: 'tellann:cloud:organizations',
  createApplication: 'tellann:cloud:applications:create',
  appUpdated: 'tellann:cloud:app-updated',
  listRuns: 'tellann:cloud:runs:list',
  getRun: 'tellann:cloud:runs:get',
  getRunReplay: 'tellann:cloud:runs:replay',
  getRunBackendEvidence: 'tellann:cloud:runs:backend-evidence',
  getRunProtectedValues: 'tellann:cloud:runs:protected-values',
  getRunReport: 'tellann:cloud:runs:report',
  saveRunReportDownload: 'tellann:cloud:runs:report:download',
  renameRun: 'tellann:cloud:runs:rename',
  archiveRun: 'tellann:cloud:runs:archive',
  restoreRun: 'tellann:cloud:runs:restore',
  deleteRun: 'tellann:cloud:runs:delete',
  getDeclaredFlows: 'tellann:cloud:intent:list',
  getDeclaredFlow: 'tellann:cloud:intent:get',
  createDeclaredFlow: 'tellann:cloud:intent:create',
  addDeclaredState: 'tellann:cloud:intent:state:add',
  updateDeclaredState: 'tellann:cloud:intent:state:update',
  deleteDeclaredState: 'tellann:cloud:intent:state:delete',
  addDeclaredTransition: 'tellann:cloud:intent:transition:add',
  completeDeclaredFlow: 'tellann:cloud:intent:complete',
  reopenDeclaredFlow: 'tellann:cloud:intent:reopen',
  // Mirrors DELETE_DECLARED_FLOW_CHANNEL in main.ts.
  deleteDeclaredFlow: 'tellann:cloud:intent:delete',
  // Mirrors FLOW_EDITOR_CHANNELS in main.ts.
  updateDeclaredTransition: 'tellann:cloud:intent:transition:update',
  deleteDeclaredTransition: 'tellann:cloud:intent:transition:delete',
  updateDeclaredFlow: 'tellann:cloud:intent:update',
  getFlowDraftHistory: 'tellann:cloud:intent:draft-history:list',
  restoreFlowDraft: 'tellann:cloud:intent:draft-history:restore',
  dismissFlowSuggestion: 'tellann:cloud:intent:suggestions:dismiss',
  resolveAiFlowDraft: 'tellann:cloud:intent:ai-draft:resolve',
  generateFlowSuggestions: 'tellann:cloud:intent:suggestions:generate',
  getFlowSuggestions: 'tellann:cloud:intent:suggestions:list',
  acceptFlowSuggestion: 'tellann:cloud:intent:suggestions:accept',
  rejectFlowSuggestion: 'tellann:cloud:intent:suggestions:reject',
  previewFlowReview: 'tellann:cloud:intent:review:preview',
  applyFlowReview: 'tellann:cloud:intent:review:apply',
  declineFlowReview: 'tellann:cloud:intent:review:decline',
  getFlowDiagrams: 'tellann:cloud:flow:diagrams',
  initializeFlow: 'tellann:flow:initialize',
  getFlowInitialization: 'tellann:flow:initialization:get',
  getFlowInitializationProgress: 'tellann:flow:initialization:progress',
  analyzeFlowInitialization: 'tellann:flow:initialization:analyze',
  retryFlowMappingResolution: 'tellann:flow:initialization:mapping:retry',
  confirmFlowMapping: 'tellann:flow:initialization:mapping:confirm',
  confirmFlowMappings: 'tellann:flow:initialization:mapping:confirm-many',
  resetFlowMappingConsent: 'tellann:flow:initialization:mapping:consent:reset',
  setFlowInitializationMode: 'tellann:flow:initialization:mode',
  updateFlowRoadmapStep: 'tellann:flow:initialization:roadmap:step',
  startFlowVerification: 'tellann:flow:initialization:verification:start',
  verifyFlowCheckpointsInCode: 'tellann:flow:initialization:verification:code-scan',
  getFlowVerification: 'tellann:flow:initialization:verification:get',
  rescanFlow: 'tellann:flow:rescan',
  approveFlowInitialization: 'tellann:flow:initialization:approve',
  applyFlowInitialization: 'tellann:flow:initialization:apply',
  validateFlowInitialization: 'tellann:flow:initialization:validate',
  importDocuments: 'tellann:documents:import',
  listDocuments: 'tellann:documents:list',
  getDocumentJob: 'tellann:documents:job:get',
  createIntentDraft: 'tellann:intent:draft:create',
  listIntentDraftJobs: 'tellann:intent:draft:jobs:list',
  getIntentDraftJob: 'tellann:intent:draft:job:get',
  cancelIntentDraftJob: 'tellann:intent:draft:job:cancel',
  listIntentDrafts: 'tellann:intent:draft:list',
  getIntentDraft: 'tellann:intent:draft:get',
  reviewIntentDraft: 'tellann:intent:draft:review',
  deleteIntentDraft: 'tellann:intent:draft:delete',
  correctIntentDraft: 'tellann:intent:draft:correct',
  // Mirror the document import channel names defined in main.ts.
  applyIntentConflictAnswers: 'tellann:intent:draft:apply-answers',
  getDocumentImport: 'tellann:documents:import:get',
  resumeDocumentImport: 'tellann:documents:import:resume',
  cancelDocumentImport: 'tellann:documents:import:cancel',
  dismissDocumentImport: 'tellann:documents:import:dismiss',
  generateFromDocumentVersions: 'tellann:documents:import:generate',
  documentImportProgress: 'tellann:documents:import:progress',
  openExternal: 'tellann:system:open-external',
  openPath: 'tellann:system:open-path',
  openProfile: 'tellann:system:open-profile',
  chooseWorkspace: 'tellann:workspace:choose',
  getLocalWorkspace: 'tellann:workspace:local-state',
  scanWorkspace: 'tellann:workspace:scan',
  beginWorkspaceAnalysis: 'tellann:workspace:analysis:begin',
  getCodebaseAnalysis: 'tellann:workspace:analysis:get',
  cancelCodebaseAnalysis: 'tellann:workspace:analysis:cancel',
  rescanCodebase: 'tellann:workspace:analysis:rescan',
  codebaseQuery: 'tellann:workspace:analysis:query',
  openCodebaseEvidence: 'tellann:workspace:analysis:evidence:open',
  saveCodebaseRiskReport: 'tellann:workspace:analysis:risk-report:save',
  cloneWorkspace: 'tellann:workspace:clone',
  getBranchCompliance: 'tellann:workspace:branch:compliance',
  setBranchAgentCheckout: 'tellann:workspace:branch:agent-checkout',
  grantQaBranchCheckout: 'tellann:workspace:branch:grant',
  switchToQaBranch: 'tellann:workspace:branch:switch',
  restoreWorkspaceBranch: 'tellann:workspace:branch:restore',
  uploadConsentRequested: 'tellann:workspace:upload-consent:request',
  uploadConsentResolve: 'tellann:workspace:upload-consent:resolve',
  startGuidedRun: 'tellann:run:start',
  pauseGuidedRun: 'tellann:run:pause',
  resumeGuidedRun: 'tellann:run:resume',
  setRunInteractionMode: 'tellann:run:interaction-mode',
  retryRunSynchronization: 'tellann:run:synchronization:retry',
  revealRunProtectedValue: 'tellann:run:protected-value:reveal',
  getArtifactDownloadUrl: 'tellann:run:artifact:download-url',
  searchRunMentionableMembers: 'tellann:run:members:search',
  runLifecycleEvent: 'tellann:run:lifecycle',
  endGuidedRun: 'tellann:run:end',
  getRunState: 'tellann:run:state',
  focusRunBrowser: 'tellann:run:browser:focus',
  reopenRunBrowser: 'tellann:run:browser:reopen',
  getRunRelayConnection: 'tellann:run:relay:connection',
  listIngestionKeys: 'tellann:run:ingestion-keys:list',
  createIngestionKey: 'tellann:run:ingestion-keys:create',
  getEvidenceEvent: 'tellann:run:evidence-events:get',
  checkSdkVersions: 'tellann:run:sdk-versions:check',
  runStateChanged: 'tellann:run:state-changed',
  openRunPanelWindow: 'tellann:run:panel:open',
  closeRunPanelWindow: 'tellann:run:panel:close',
  getRunPanelWindowState: 'tellann:run:panel:state',
  runPanelWindowChanged: 'tellann:run:panel:changed',
  detectInstrumentation: 'tellann:instrumentation:detect',
  proposeInstrumentation: 'tellann:instrumentation:propose',
  listInstrumentationPlans: 'tellann:instrumentation:plans:list',
  getInstrumentationPlan: 'tellann:instrumentation:plans:get',
  renameInstrumentationPlan: 'tellann:instrumentation:plans:rename',
  archiveInstrumentationPlan: 'tellann:instrumentation:plans:archive',
  restoreInstrumentationPlan: 'tellann:instrumentation:plans:restore',
  approveInstrumentation: 'tellann:instrumentation:approve',
  rejectInstrumentation: 'tellann:instrumentation:reject',
  applyInstrumentation: 'tellann:instrumentation:apply',
  // Mirrors the channel names defined in main.ts.
  instrumentationProgress: 'tellann:instrumentation:progress',
  getInstrumentationProgress: 'tellann:instrumentation:progress:get',
  validateInstrumentation: 'tellann:instrumentation:validate',
  rollbackInstrumentation: 'tellann:instrumentation:rollback',
  getLocalInstrumentationResult: 'tellann:instrumentation:local-result',
  generateInstrumentationReport: 'tellann:instrumentation:report:generate',
  notificationsSetActiveOrg: 'tellann:notifications:set-active-org',
  notificationsFetch: 'tellann:notifications:fetch',
  notificationMarkRead: 'tellann:notifications:mark-read',
  notificationMarkAllRead: 'tellann:notifications:mark-all-read',
  notificationDismiss: 'tellann:notifications:dismiss',
  notificationOpen: 'tellann:notifications:open',
  notificationReceived: 'tellann:notifications:received',
  notificationUnreadCount: 'tellann:notifications:unread-count',
} as const;

contextBridge.exposeInMainWorld('tellann', {
  auth: {
    getSession: () => ipcRenderer.invoke(IPC.getSession),
    getAvatarDataUri: () => ipcRenderer.invoke(IPC.getAvatarDataUri),
    signIn: () => ipcRenderer.invoke(IPC.signIn),
    reopenSignIn: () => ipcRenderer.invoke(IPC.reopenSignIn),
    cancelSignIn: () => ipcRenderer.invoke(IPC.cancelSignIn),
    signOut: () => ipcRenderer.invoke(IPC.signOut),
  },
  setup: {
    claimHandoff: () => ipcRenderer.invoke(IPC.claimSetupHandoff),
    consumeHandoff: (handoffId: string) => ipcRenderer.invoke(IPC.consumeSetupHandoff, handoffId),
    getSdkSetup: (applicationId: string, environmentId: string) => ipcRenderer.invoke(IPC.getSdkSetup, { applicationId, environmentId }),
    issueKey: (applicationId: string, environmentId: string) => ipcRenderer.invoke(IPC.issueSdkSetupKey, { applicationId, environmentId }),
  },
  projects: {
    list: () => ipcRenderer.invoke(IPC.getApplications),
    listOrganizations: () => ipcRenderer.invoke(IPC.getOrganizations),
    create: (input: { organizationId: string; name: string; summary?: string | null }) =>
      ipcRenderer.invoke(IPC.createApplication, input),
    getLocalWorkspace: (applicationId: string) => ipcRenderer.invoke(IPC.getLocalWorkspace, applicationId),
    chooseWorkspace: () => ipcRenderer.invoke(IPC.chooseWorkspace),
      scanWorkspace: (input: { path: string; applicationId: string }) =>
        ipcRenderer.invoke(IPC.scanWorkspace, input),
      beginWorkspaceAnalysis: (applicationId: string) =>
        ipcRenderer.invoke(IPC.beginWorkspaceAnalysis, applicationId),
      getCodebaseAnalysis: (applicationId: string) =>
      ipcRenderer.invoke(IPC.getCodebaseAnalysis, applicationId),
    cancelCodebaseAnalysis: (applicationId: string) =>
      ipcRenderer.invoke(IPC.cancelCodebaseAnalysis, applicationId),
    rescanCodebase: (applicationId: string) =>
      ipcRenderer.invoke(IPC.rescanCodebase, applicationId),
    codebaseQuery: (input: { applicationId: string; kind: string; payload?: Record<string, unknown> }) =>
      ipcRenderer.invoke(IPC.codebaseQuery, input),
    openCodebaseEvidence: (input: { applicationId: string; path: string; line?: number }) =>
      ipcRenderer.invoke(IPC.openCodebaseEvidence, input),
    saveCodebaseRiskReport: (applicationId: string) =>
      ipcRenderer.invoke(IPC.saveCodebaseRiskReport, applicationId),
    cloneWorkspace: (input: { applicationId: string; cloneUrl: string }) =>
      ipcRenderer.invoke(IPC.cloneWorkspace, input),
    getBranchCompliance: (applicationId: string) =>
      ipcRenderer.invoke(IPC.getBranchCompliance, applicationId),
    setBranchAgentCheckout: (applicationId: string, allowAgentCheckout: boolean) =>
      ipcRenderer.invoke(IPC.setBranchAgentCheckout, { applicationId, allowAgentCheckout }),
    grantQaBranchCheckout: (applicationId: string, expiresInMinutes?: number) =>
      ipcRenderer.invoke(IPC.grantQaBranchCheckout, { applicationId, expiresInMinutes }),
    switchToQaBranch: (applicationId: string) =>
      ipcRenderer.invoke(IPC.switchToQaBranch, applicationId),
    restoreWorkspaceBranch: (applicationId: string) =>
      ipcRenderer.invoke(IPC.restoreWorkspaceBranch, applicationId),
    onUploadConsentRequested: (callback: (request: any) => void) => {
      const subscription = (_: unknown, data: any) => callback(data);
      ipcRenderer.on(IPC.uploadConsentRequested, subscription);
      return () => {
        ipcRenderer.removeListener(IPC.uploadConsentRequested, subscription);
      };
    },
    resolveUploadConsent: (requestId: string, consented: boolean) =>
      ipcRenderer.invoke(IPC.uploadConsentResolve, { requestId, consented }),
    onAppUpdated: (callback: (event: any) => void) => {
      const subscription = (_: unknown, data: any) => callback(data);
      ipcRenderer.on(IPC.appUpdated, subscription);
      return () => {
        ipcRenderer.removeListener(IPC.appUpdated, subscription);
      };
    },
  },
  intent: {
    listDeclaredFlows: (applicationId: string) => ipcRenderer.invoke(IPC.getDeclaredFlows, applicationId),
    getDeclaredFlow: (applicationId: string, flowId: string) => ipcRenderer.invoke(IPC.getDeclaredFlow, { applicationId, flowId }),
    createDeclaredFlow: (applicationId: string, name: string, workflowType: string, purpose: string, scopeStatement: string, template?: string) => ipcRenderer.invoke(IPC.createDeclaredFlow, { applicationId, name, workflowType, purpose, scopeStatement, template }),
    addDeclaredState: (applicationId: string, flowId: string, stateName: string, category: string, role?: string, terminalKind?: string | null) => ipcRenderer.invoke(IPC.addDeclaredState, { applicationId, flowId, stateName, category, role, terminalKind }),
    updateDeclaredState: (applicationId: string, flowId: string, stateId: string, stateName: string, category: string, role?: string, terminalKind?: string | null) => ipcRenderer.invoke(IPC.updateDeclaredState, { applicationId, flowId, stateId, stateName, category, role, terminalKind }),
    deleteDeclaredState: (applicationId: string, flowId: string, stateId: string) => ipcRenderer.invoke(IPC.deleteDeclaredState, { applicationId, flowId, stateId }),
    addDeclaredTransition: (applicationId: string, flowId: string, fromStateId: string, toStateId: string, action?: string) => ipcRenderer.invoke(IPC.addDeclaredTransition, { applicationId, flowId, fromStateId, toStateId, action }),
    completeDeclaredFlow: (applicationId: string, flowId: string) => ipcRenderer.invoke(IPC.completeDeclaredFlow, { applicationId, flowId }),
    reopenDeclaredFlow: (applicationId: string, flowId: string) => ipcRenderer.invoke(IPC.reopenDeclaredFlow, { applicationId, flowId }),
    deleteDeclaredFlow: (applicationId: string, flowId: string) => ipcRenderer.invoke(IPC.deleteDeclaredFlow, { applicationId, flowId }),
    updateDeclaredTransition: (applicationId: string, flowId: string, transitionId: string, action: string) =>
      ipcRenderer.invoke(IPC.updateDeclaredTransition, { applicationId, flowId, transitionId, action }),
    deleteDeclaredTransition: (applicationId: string, flowId: string, transitionId: string) =>
      ipcRenderer.invoke(IPC.deleteDeclaredTransition, { applicationId, flowId, transitionId }),
    updateDeclaredFlow: (applicationId: string, flowId: string, input: unknown) =>
      ipcRenderer.invoke(IPC.updateDeclaredFlow, { applicationId, flowId, input }),
    getFlowDraftHistory: (applicationId: string, flowId: string) =>
      ipcRenderer.invoke(IPC.getFlowDraftHistory, { applicationId, flowId }),
    restoreFlowDraft: (applicationId: string, flowId: string, snapshotId: string) =>
      ipcRenderer.invoke(IPC.restoreFlowDraft, { applicationId, flowId, snapshotId }),
    dismissFlowSuggestion: (applicationId: string, flowId: string, suggestionId: string) =>
      ipcRenderer.invoke(IPC.dismissFlowSuggestion, { applicationId, flowId, suggestionId }),
    resolveAiFlowDraft: (applicationId: string, flowId: string, decision: 'accept' | 'decline') =>
      ipcRenderer.invoke(IPC.resolveAiFlowDraft, { applicationId, flowId, decision }),
    generateFlowSuggestions: (applicationId: string, flowId: string, input: unknown) => ipcRenderer.invoke(IPC.generateFlowSuggestions, { applicationId, flowId, input }),
    getFlowSuggestions: (applicationId: string, flowId: string) => ipcRenderer.invoke(IPC.getFlowSuggestions, { applicationId, flowId }),
    acceptFlowSuggestion: (applicationId: string, flowId: string, suggestionId: string) => ipcRenderer.invoke(IPC.acceptFlowSuggestion, { applicationId, flowId, suggestionId }),
    rejectFlowSuggestion: (applicationId: string, flowId: string, suggestionId: string) => ipcRenderer.invoke(IPC.rejectFlowSuggestion, { applicationId, flowId, suggestionId }),
    previewFlowReview: (applicationId: string, flowId: string, input: unknown) => ipcRenderer.invoke(IPC.previewFlowReview, { applicationId, flowId, input }),
    applyFlowReview: (applicationId: string, flowId: string, input: unknown) => ipcRenderer.invoke(IPC.applyFlowReview, { applicationId, flowId, input }),
    declineFlowReview: (applicationId: string, flowId: string, reviewId: string) => ipcRenderer.invoke(IPC.declineFlowReview, { applicationId, flowId, reviewId }),
    getFlowDiagrams: (applicationId: string, flowId: string, versionId: string) => ipcRenderer.invoke(IPC.getFlowDiagrams, { applicationId, flowId, versionId }),
    initializeFlow: (input: unknown) => ipcRenderer.invoke(IPC.initializeFlow, input),
    getFlowInitialization: (initializationId: string) => ipcRenderer.invoke(IPC.getFlowInitialization, initializationId),
    getFlowInitializationProgress: (initializationId: string) => ipcRenderer.invoke(IPC.getFlowInitializationProgress, initializationId),
    analyzeFlowInitialization: (initializationId: string) => ipcRenderer.invoke(IPC.analyzeFlowInitialization, initializationId),
    retryFlowMappingResolution: (initializationId: string) => ipcRenderer.invoke(IPC.retryFlowMappingResolution, initializationId),
    confirmFlowMapping: (initializationId: string, checkpointId: string, candidateId: string, placementKind?: string, anchorText?: string) =>
      ipcRenderer.invoke(IPC.confirmFlowMapping, { initializationId, checkpointId, candidateId, placementKind, anchorText }),
    confirmFlowMappings: (initializationId: string, confirmations: unknown[]) =>
      ipcRenderer.invoke(IPC.confirmFlowMappings, { initializationId, confirmations }),
    resetFlowMappingConsent: (applicationId: string) => ipcRenderer.invoke(IPC.resetFlowMappingConsent, applicationId),
    setFlowInitializationMode: (initializationId: string, mode: 'AUTOMATED' | 'MANUAL') => ipcRenderer.invoke(IPC.setFlowInitializationMode, { initializationId, mode }),
    updateFlowRoadmapStep: (initializationId: string, stepId: string, completed: boolean) => ipcRenderer.invoke(IPC.updateFlowRoadmapStep, { initializationId, stepId, completed }),
    startFlowVerification: (initializationId: string) => ipcRenderer.invoke(IPC.startFlowVerification, initializationId),
    verifyFlowCheckpointsInCode: (applicationId: string, initializationId: string) => ipcRenderer.invoke(IPC.verifyFlowCheckpointsInCode, { applicationId, initializationId }),
    getFlowVerification: (initializationId: string) => ipcRenderer.invoke(IPC.getFlowVerification, initializationId),
    rescanFlow: (bindingId: string, applicationId: string) => ipcRenderer.invoke(IPC.rescanFlow, { bindingId, applicationId }),
    approveFlowInitialization: (initializationId: string, instrumentationPlanId: string) => ipcRenderer.invoke(IPC.approveFlowInitialization, { initializationId, instrumentationPlanId }),
    applyFlowInitialization: (initializationId: string, patchSetId: string) => ipcRenderer.invoke(IPC.applyFlowInitialization, { initializationId, patchSetId }),
    validateFlowInitialization: (initializationId: string, input: unknown) => ipcRenderer.invoke(IPC.validateFlowInitialization, { initializationId, ...(input as object) }),
    listDrafts: (applicationId: string) => ipcRenderer.invoke(IPC.listIntentDrafts, applicationId),
    getDraft: (applicationId: string, draftId: string) => ipcRenderer.invoke(IPC.getIntentDraft, { applicationId, draftId }),
    createDraft: (applicationId: string, documentVersionIds: string[]) => ipcRenderer.invoke(IPC.createIntentDraft, { applicationId, documentVersionIds }),
    listDraftJobs: (applicationId: string) => ipcRenderer.invoke(IPC.listIntentDraftJobs, applicationId),
    getDraftJob: (applicationId: string, jobId: string) => ipcRenderer.invoke(IPC.getIntentDraftJob, { applicationId, jobId }),
    cancelDraftJob: (applicationId: string, jobId: string) => ipcRenderer.invoke(IPC.cancelIntentDraftJob, { applicationId, jobId }),
    reviewDraft: (applicationId: string, draftId: string, review: unknown) => ipcRenderer.invoke(IPC.reviewIntentDraft, { applicationId, draftId, review }),
    deleteDraft: (applicationId: string, draftId: string) => ipcRenderer.invoke(IPC.deleteIntentDraft, { applicationId, draftId }),
    correctDraft: (applicationId: string, draftId: string, correction: string) => ipcRenderer.invoke(IPC.correctIntentDraft, { applicationId, draftId, correction }),
    applyConflictAnswers: (applicationId: string, draftId: string, conflictResolutions: Record<string, string>) =>
      ipcRenderer.invoke(IPC.applyIntentConflictAnswers, { applicationId, draftId, conflictResolutions }),
  },
  documents: {
    list: (applicationId: string) => ipcRenderer.invoke(IPC.listDocuments, applicationId),
    import: (applicationId: string, options?: { generateDraft?: boolean }) =>
      ipcRenderer.invoke(IPC.importDocuments, { applicationId, generateDraft: options?.generateDraft === true }),
    getJob: (applicationId: string, jobId: string) => ipcRenderer.invoke(IPC.getDocumentJob, { applicationId, jobId }),
    getImport: (applicationId: string) => ipcRenderer.invoke(IPC.getDocumentImport, applicationId),
    resumeImport: (applicationId: string) => ipcRenderer.invoke(IPC.resumeDocumentImport, applicationId),
    cancelImport: (applicationId: string) => ipcRenderer.invoke(IPC.cancelDocumentImport, applicationId),
    dismissImport: (applicationId: string) => ipcRenderer.invoke(IPC.dismissDocumentImport, applicationId),
    generateFromVersions: (applicationId: string, documents: Array<{ versionId: string; documentId: string | null; filename: string }>) =>
      ipcRenderer.invoke(IPC.generateFromDocumentVersions, { applicationId, documents }),
    onImportProgress: (callback: (view: unknown) => void) => {
      const subscription = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on(IPC.documentImportProgress, subscription);
      return () => ipcRenderer.removeListener(IPC.documentImportProgress, subscription);
    },
  },
  runs: {
    list: (
      applicationId: string,
      filters?: { q?: string; status?: string; environmentId?: string; archived?: 'true' | 'false' | 'all'; from?: string; to?: string },
    ) => ipcRenderer.invoke(IPC.listRuns, applicationId, filters),
    get: (runId: string) => ipcRenderer.invoke(IPC.getRun, runId),
    getReplay: (runId: string) => ipcRenderer.invoke(IPC.getRunReplay, runId),
    getBackendEvidence: (runId: string, query: unknown) => ipcRenderer.invoke(IPC.getRunBackendEvidence, runId, query),
    getProtectedValues: (runId: string, query: unknown) => ipcRenderer.invoke(IPC.getRunProtectedValues, runId, query),
    getReport: (runId: string) => ipcRenderer.invoke(IPC.getRunReport, runId),
    rename: (runId: string, title: string) => ipcRenderer.invoke(IPC.renameRun, runId, title),
    archive: (runId: string) => ipcRenderer.invoke(IPC.archiveRun, runId),
    restore: (runId: string) => ipcRenderer.invoke(IPC.restoreRun, runId),
    delete: (runId: string) => ipcRenderer.invoke(IPC.deleteRun, runId),
    saveReportDownload: (runId: string, format: 'JSON' | 'PDF' | 'CSV' | 'HTML') =>
      ipcRenderer.invoke(IPC.saveRunReportDownload, { runId, format }),
    start: (input: unknown) => ipcRenderer.invoke(IPC.startGuidedRun, input),
    pause: () => ipcRenderer.invoke(IPC.pauseGuidedRun),
    resume: () => ipcRenderer.invoke(IPC.resumeGuidedRun),
    setInteractionMode: (mode: 'NAVIGATE' | 'INSPECT') => ipcRenderer.invoke(IPC.setRunInteractionMode, mode),
    retrySynchronization: (runId: string) => ipcRenderer.invoke(IPC.retryRunSynchronization, runId),
    revealProtectedValue: (runId: string, valueId: string) =>
      ipcRenderer.invoke(IPC.revealRunProtectedValue, { runId, valueId }),
    getArtifactDownloadUrl: (runId: string, artifactId: string) =>
      ipcRenderer.invoke(IPC.getArtifactDownloadUrl, { runId, artifactId }),
    searchMentionableMembers: (runId: string, query: string) => ipcRenderer.invoke(IPC.searchRunMentionableMembers, { runId, query }),
    onLifecycleEvent: (callback: (event: unknown) => void) => {
      const subscription = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on(IPC.runLifecycleEvent, subscription);
      return () => ipcRenderer.removeListener(IPC.runLifecycleEvent, subscription);
    },
    onStateChanged: (callback: (state: unknown) => void) => {
      const subscription = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on(IPC.runStateChanged, subscription);
      return () => ipcRenderer.removeListener(IPC.runStateChanged, subscription);
    },
    focusBrowser: () => ipcRenderer.invoke(IPC.focusRunBrowser),
    openPanelWindow: (panel: 'guide' | 'evidence') => ipcRenderer.invoke(IPC.openRunPanelWindow, panel),
    closePanelWindow: (panel: 'guide' | 'evidence') => ipcRenderer.invoke(IPC.closeRunPanelWindow, panel),
    getPanelWindowState: () => ipcRenderer.invoke(IPC.getRunPanelWindowState),
    onPanelWindowChanged: (
      callback: (state: { panel: 'guide' | 'evidence'; open: boolean }) => void,
    ) => subscribe(IPC.runPanelWindowChanged, callback),
    reopenBrowser: () => ipcRenderer.invoke(IPC.reopenRunBrowser),
    relayConnection: () => ipcRenderer.invoke(IPC.getRunRelayConnection),
    listIngestionKeys: (environmentId: string) => ipcRenderer.invoke(IPC.listIngestionKeys, environmentId),
    createIngestionKey: (environmentId: string, label?: string) =>
      ipcRenderer.invoke(IPC.createIngestionKey, environmentId, label),
    getEvidenceEvent: (runId: string, eventId: string) => ipcRenderer.invoke(IPC.getEvidenceEvent, runId, eventId),
    checkSdkVersions: (applicationId: string) => ipcRenderer.invoke(IPC.checkSdkVersions, applicationId),
    end: () => ipcRenderer.invoke(IPC.endGuidedRun),
    getActive: () => ipcRenderer.invoke(IPC.getRunState),
  },
  instrumentation: {
    detect: (input: unknown) => ipcRenderer.invoke(IPC.detectInstrumentation, input),
    propose: (input: unknown) => ipcRenderer.invoke(IPC.proposeInstrumentation, input),
    list: (applicationId: string, filters?: unknown) => ipcRenderer.invoke(IPC.listInstrumentationPlans, applicationId, filters),
    rename: (applicationId: string, planId: string, title: string | null) =>
      ipcRenderer.invoke(IPC.renameInstrumentationPlan, { applicationId, planId, title }),
    archive: (applicationId: string, planId: string) =>
      ipcRenderer.invoke(IPC.archiveInstrumentationPlan, { applicationId, planId }),
    restore: (applicationId: string, planId: string) =>
      ipcRenderer.invoke(IPC.restoreInstrumentationPlan, { applicationId, planId }),
    get: (applicationId: string, planId: string) => ipcRenderer.invoke(IPC.getInstrumentationPlan, { applicationId, planId }),
    getLocalResult: (applicationId: string, planId: string) => ipcRenderer.invoke(IPC.getLocalInstrumentationResult, { applicationId, planId }),
    generateReport: (applicationId: string, planId: string, applicationName: string, environmentName: string) => ipcRenderer.invoke(IPC.generateInstrumentationReport, { applicationId, planId, applicationName, environmentName }),
    approve: (input: unknown) => ipcRenderer.invoke(IPC.approveInstrumentation, input),
    reject: (applicationId: string, planId: string, reason?: string) => ipcRenderer.invoke(IPC.rejectInstrumentation, { applicationId, planId, reason }),
    apply: (applicationId: string, planId: string, options?: { confirmOffQaBranch?: boolean }) =>
      ipcRenderer.invoke(IPC.applyInstrumentation, { applicationId, planId, confirmOffQaBranch: options?.confirmOffQaBranch === true }),
    getProgress: (planId: string) => ipcRenderer.invoke(IPC.getInstrumentationProgress, planId),
    onProgress: (callback: (progress: any) => void) => {
      const subscription = (_: unknown, data: any) => callback(data);
      ipcRenderer.on(IPC.instrumentationProgress, subscription);
      return () => ipcRenderer.removeListener(IPC.instrumentationProgress, subscription);
    },
    validate: (applicationId: string, planId: string) => ipcRenderer.invoke(IPC.validateInstrumentation, { applicationId, planId }),
    rollback: (applicationId: string, planId: string) => ipcRenderer.invoke(IPC.rollbackInstrumentation, { applicationId, planId }),
  },
  notifications: {
    setActiveOrganization: (organizationId: string | null) =>
      ipcRenderer.invoke(IPC.notificationsSetActiveOrg, organizationId),
    fetch: (input?: { cursor?: string; filter?: string }) =>
      ipcRenderer.invoke(IPC.notificationsFetch, input ?? {}),
    markRead: (id: string) => ipcRenderer.invoke(IPC.notificationMarkRead, id),
    markAllRead: () => ipcRenderer.invoke(IPC.notificationMarkAllRead),
    dismiss: (id: string) => ipcRenderer.invoke(IPC.notificationDismiss, id),
    open: (id: string) => ipcRenderer.invoke(IPC.notificationOpen, id),
    onReceived: (callback: (row: any) => void) => {
      const subscription = (_: unknown, data: any) => callback(data);
      ipcRenderer.on(IPC.notificationReceived, subscription);
      return () => ipcRenderer.removeListener(IPC.notificationReceived, subscription);
    },
    onOpenDeepLink: (callback: (payload: { deepLink: string }) => void) => {
      const subscription = (_: unknown, data: any) => callback(data);
      ipcRenderer.on(IPC.notificationOpen, subscription);
      return () => ipcRenderer.removeListener(IPC.notificationOpen, subscription);
    },
  },
  system: {
    getVersion: () => ipcRenderer.invoke(IPC.getVersion),
    copyText: (value: string) => ipcRenderer.invoke(IPC.copyText, value),
    openExternal: (url: string) => ipcRenderer.invoke(IPC.openExternal, url),
    openPath: (path: string) => ipcRenderer.invoke(IPC.openPath, path),
    openProfile: () => ipcRenderer.invoke(IPC.openProfile),
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
  },
  window: {
    getState: () => ipcRenderer.invoke(WINDOW_IPC.getState),
    onStateChange: (callback: (state: unknown) => void) => subscribe(WINDOW_IPC.state, callback),
    onNavigate: (callback: (direction: 'back' | 'forward') => void) => subscribe(WINDOW_IPC.navigate, callback),
    onCommand: (callback: (command: string) => void) => subscribe(WINDOW_IPC.command, callback),
    consumePendingCommand: () => ipcRenderer.invoke(WINDOW_IPC.consumeCommand),
    setMode: (mode: 'auth' | 'main') => ipcRenderer.invoke(WINDOW_IPC.setMode, mode),
    showContextMenu: (items: unknown[]) => ipcRenderer.invoke(WINDOW_IPC.contextMenu, items),
    confirm: (input: unknown) => ipcRenderer.invoke(WINDOW_IPC.confirm, input),
  },
});
