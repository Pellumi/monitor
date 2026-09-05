import { contextBridge, ipcRenderer } from 'electron';

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
  getRunReport: 'tellann:cloud:runs:report',
  getDeclaredFlows: 'tellann:cloud:intent:list',
  getDeclaredFlow: 'tellann:cloud:intent:get',
  createDeclaredFlow: 'tellann:cloud:intent:create',
  addDeclaredState: 'tellann:cloud:intent:state:add',
  updateDeclaredState: 'tellann:cloud:intent:state:update',
  deleteDeclaredState: 'tellann:cloud:intent:state:delete',
  addDeclaredTransition: 'tellann:cloud:intent:transition:add',
  completeDeclaredFlow: 'tellann:cloud:intent:complete',
  reopenDeclaredFlow: 'tellann:cloud:intent:reopen',
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
  analyzeFlowInitialization: 'tellann:flow:initialization:analyze',
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
  searchRunMentionableMembers: 'tellann:run:members:search',
  runLifecycleEvent: 'tellann:run:lifecycle',
  endGuidedRun: 'tellann:run:end',
  getRunState: 'tellann:run:state',
  detectInstrumentation: 'tellann:instrumentation:detect',
  proposeInstrumentation: 'tellann:instrumentation:propose',
  listInstrumentationPlans: 'tellann:instrumentation:plans:list',
  getInstrumentationPlan: 'tellann:instrumentation:plans:get',
  approveInstrumentation: 'tellann:instrumentation:approve',
  rejectInstrumentation: 'tellann:instrumentation:reject',
  applyInstrumentation: 'tellann:instrumentation:apply',
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
    createDeclaredFlow: (applicationId: string, name: string, workflowType: string, purpose: string, scopeStatement: string) => ipcRenderer.invoke(IPC.createDeclaredFlow, { applicationId, name, workflowType, purpose, scopeStatement }),
    addDeclaredState: (applicationId: string, flowId: string, stateName: string, category: string, role?: string, terminalKind?: string | null) => ipcRenderer.invoke(IPC.addDeclaredState, { applicationId, flowId, stateName, category, role, terminalKind }),
    updateDeclaredState: (applicationId: string, flowId: string, stateId: string, stateName: string, category: string, role?: string, terminalKind?: string | null) => ipcRenderer.invoke(IPC.updateDeclaredState, { applicationId, flowId, stateId, stateName, category, role, terminalKind }),
    deleteDeclaredState: (applicationId: string, flowId: string, stateId: string) => ipcRenderer.invoke(IPC.deleteDeclaredState, { applicationId, flowId, stateId }),
    addDeclaredTransition: (applicationId: string, flowId: string, fromStateId: string, toStateId: string, action?: string) => ipcRenderer.invoke(IPC.addDeclaredTransition, { applicationId, flowId, fromStateId, toStateId, action }),
    completeDeclaredFlow: (applicationId: string, flowId: string) => ipcRenderer.invoke(IPC.completeDeclaredFlow, { applicationId, flowId }),
    reopenDeclaredFlow: (applicationId: string, flowId: string) => ipcRenderer.invoke(IPC.reopenDeclaredFlow, { applicationId, flowId }),
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
    analyzeFlowInitialization: (initializationId: string) => ipcRenderer.invoke(IPC.analyzeFlowInitialization, initializationId),
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
  },
  documents: {
    list: (applicationId: string) => ipcRenderer.invoke(IPC.listDocuments, applicationId),
    import: (applicationId: string) => ipcRenderer.invoke(IPC.importDocuments, applicationId),
    getJob: (applicationId: string, jobId: string) => ipcRenderer.invoke(IPC.getDocumentJob, { applicationId, jobId }),
  },
  runs: {
    list: (applicationId: string) => ipcRenderer.invoke(IPC.listRuns, applicationId),
    get: (runId: string) => ipcRenderer.invoke(IPC.getRun, runId),
    getReplay: (runId: string) => ipcRenderer.invoke(IPC.getRunReplay, runId),
    getReport: (runId: string) => ipcRenderer.invoke(IPC.getRunReport, runId),
    start: (input: unknown) => ipcRenderer.invoke(IPC.startGuidedRun, input),
    pause: () => ipcRenderer.invoke(IPC.pauseGuidedRun),
    resume: () => ipcRenderer.invoke(IPC.resumeGuidedRun),
    setInteractionMode: (mode: 'NAVIGATE' | 'INSPECT') => ipcRenderer.invoke(IPC.setRunInteractionMode, mode),
    retrySynchronization: (runId: string) => ipcRenderer.invoke(IPC.retryRunSynchronization, runId),
    revealProtectedValue: (runId: string, valueId: string) =>
      ipcRenderer.invoke(IPC.revealRunProtectedValue, { runId, valueId }),
    searchMentionableMembers: (runId: string, query: string) => ipcRenderer.invoke(IPC.searchRunMentionableMembers, { runId, query }),
    onLifecycleEvent: (callback: (event: unknown) => void) => {
      const subscription = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on(IPC.runLifecycleEvent, subscription);
      return () => ipcRenderer.removeListener(IPC.runLifecycleEvent, subscription);
    },
    end: () => ipcRenderer.invoke(IPC.endGuidedRun),
    getActive: () => ipcRenderer.invoke(IPC.getRunState),
  },
  instrumentation: {
    detect: (input: unknown) => ipcRenderer.invoke(IPC.detectInstrumentation, input),
    propose: (input: unknown) => ipcRenderer.invoke(IPC.proposeInstrumentation, input),
    list: (applicationId: string) => ipcRenderer.invoke(IPC.listInstrumentationPlans, applicationId),
    get: (applicationId: string, planId: string) => ipcRenderer.invoke(IPC.getInstrumentationPlan, { applicationId, planId }),
    getLocalResult: (applicationId: string, planId: string) => ipcRenderer.invoke(IPC.getLocalInstrumentationResult, { applicationId, planId }),
    generateReport: (applicationId: string, planId: string, applicationName: string, environmentName: string) => ipcRenderer.invoke(IPC.generateInstrumentationReport, { applicationId, planId, applicationName, environmentName }),
    approve: (input: unknown) => ipcRenderer.invoke(IPC.approveInstrumentation, input),
    reject: (applicationId: string, planId: string, reason?: string) => ipcRenderer.invoke(IPC.rejectInstrumentation, { applicationId, planId, reason }),
    apply: (applicationId: string, planId: string) => ipcRenderer.invoke(IPC.applyInstrumentation, { applicationId, planId }),
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
  },
});
