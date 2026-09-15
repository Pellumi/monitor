import type {
  BranchPolicy,
  WorkspaceCompliance,
  QaBranchSwitchResult,
  DeclaredFlowDetail,
  DeclaredFlowSummary,
  FlowReviewPreview,
  FlowSuggestionsResponse,
  DocumentAccess,
  AppEvent,
  CodebaseUploadConsentRequest,
  CreateApplicationInput,
  DesktopApplication,
  DesktopNotification,
  DesktopOrganization,
  DesktopSession,
  QARunSummary,
  QualityReport,
  RepositorySnapshotSummary,
  CodebaseAnalysis,
  StartGuidedRunInput,
  SourceDocumentSummary,
  IntentDraft,
  DocumentImportResult,
  DocumentProcessingJob,
  IntentDraftJob,
  IntentDraftJobCreated,
  InstrumentationDetection,
  InstrumentationValidationResult,
  QAInteractionMode,
  QAMentionableMember,
  RunLifecycleEvent,
} from '@tellann/desktop-contracts';
import type { GuidedRunState } from '@tellann/browser-observer';

declare global {
  /** What the desktop knows about an analysis, whichever side is running it. */
  /** Where applying an approved instrumentation task has got to (sent by the main process). */
  type InstrumentationApplyProgress = {
    applicationId: string;
    planId: string;
    outcome: 'RUNNING' | 'SUCCEEDED' | 'NEEDS_ATTENTION' | 'FAILED';
    summary: string | null;
    startedAt: string;
    finishedAt: string | null;
    events: Array<{
      step: string;
      status: 'RUNNING' | 'DONE' | 'FAILED';
      message: string;
      /** The file or command the step is about, when there is one. */
      detail: string | null;
      at: string;
    }>;
  };

  /** A document import run by the main process (mirrors DocumentImportView in document-import-manager.ts). */
  type DocumentImportView = {
    id: string;
    applicationId: string;
    generateDraft: boolean;
    stage: 'EXTRACTING_AND_UPLOADING' | 'PROCESSING_DOCUMENTS' | 'GENERATING_DRAFT' | 'DOCUMENTS_READY' | 'DRAFT_READY' | 'FAILED' | 'CANCELLED';
    message: string | null;
    failedFileCount: number;
    files: Array<{
      id: string;
      filename: string;
      status: 'WAITING' | 'EXTRACTING' | 'UPLOADING' | 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED';
      documentId: string | null;
      jobId: string | null;
      versionId: string | null;
      deduplicated: boolean;
      errorMessageSafe: string | null;
    }>;
    draftJobId: string | null;
    draftJobStatus: string | null;
    draftId: string | null;
    startedAt: string;
    updatedAt: string;
    finishedAt: string | null;
    /** Whether the desktop is still working on it (false after a restart until it resumes). */
    running: boolean;
  };

  type CodebaseAnalysisView = {
    mode: 'cloud' | 'local';
    source: 'cloud' | 'local';
    /** A local run whose worker died with a previous desktop process. */
    interrupted: boolean;
    uploadProgress: { sent: number; total: number } | null;
    analysis: CodebaseAnalysis | null;
    job: {
      jobId: string;
      status: CodebaseAnalysis['status'];
      progress: number;
      stageMessage: string;
      attempt: number;
      maxAttempts: number;
      errorMessageSafe: string | null;
      warnings: Array<{ code: string; severity: string; message: string }>;
      stages: Array<{ stage: string; status: string; progress: number; completedAt: string | null }>;
      snapshot: { id: string; revision: string | null; branch: string | null; dirty: boolean } | null;
    } | null;
    unreachable?: string;
    /** A `.git` directory exists in or above the attached folder. */
    gitDetected?: boolean;
  };

  interface Window {
    tellann?: {
      auth: {
        getSession(): Promise<DesktopSession>;
        getAvatarDataUri(): Promise<string | null>;
        signIn(): Promise<DesktopSession>;
        reopenSignIn(): Promise<void>;
        cancelSignIn(): Promise<void>;
        signOut(): Promise<void>;
      };
      setup: {
        claimHandoff(): Promise<Record<string, unknown> | null>;
        consumeHandoff(handoffId: string): Promise<Record<string, unknown>>;
        getSdkSetup(applicationId: string, environmentId: string): Promise<Record<string, unknown>>;
        issueKey(applicationId: string, environmentId: string): Promise<{ rawKey: string; keyPrefix: string }>;
      };
      projects: {
        list(): Promise<DesktopApplication[]>;
        listOrganizations(): Promise<DesktopOrganization[]>;
        create(input: CreateApplicationInput): Promise<{ id: string; name: string; organizationId: string }>;
        getLocalWorkspace(applicationId: string): Promise<{
          id: string;
          path: string;
          name: string;
          snapshot: RepositorySnapshotSummary;
        } | null>;
        chooseWorkspace(): Promise<{ path: string; name: string } | null>;
         scanWorkspace(input: { path: string; applicationId: string }): Promise<{
            id: string;
            snapshot: RepositorySnapshotSummary;
            branchPolicy: BranchPolicy | null;
          }>;
          beginWorkspaceAnalysis(applicationId: string): Promise<void>;
          getCodebaseAnalysis(applicationId: string): Promise<CodebaseAnalysisView | null>;
        cancelCodebaseAnalysis(applicationId: string): Promise<{ cancelled: boolean }>;
        rescanCodebase(applicationId: string): Promise<{ rescanned: boolean; requiresReattach: boolean }>;
        codebaseQuery(input: {
          applicationId: string;
          kind: 'graph' | 'hierarchy' | 'entity' | 'blast-radius' | 'compare' | 'ask' | 'collection';
          payload?: Record<string, unknown>;
        }): Promise<any>;
        openCodebaseEvidence(input: { applicationId: string; path: string; line?: number }): Promise<{ opened: boolean; reason?: string }>;
        /** Writes a PDF explaining every risk in the stored analysis to a user-chosen path. */
        saveCodebaseRiskReport(applicationId: string): Promise<{ cancelled: boolean; filePath?: string; filename?: string }>;
        cloneWorkspace(input: { applicationId: string; cloneUrl: string }): Promise<{
          id: string;
          path: string;
          name: string;
          snapshot: RepositorySnapshotSummary;
        } | null>;
        getBranchCompliance(applicationId: string): Promise<WorkspaceCompliance | null>;
        setBranchAgentCheckout(applicationId: string, allowAgentCheckout: boolean): Promise<BranchPolicy>;
        grantQaBranchCheckout(applicationId: string, expiresInMinutes?: number): Promise<Record<string, unknown>>;
        switchToQaBranch(applicationId: string): Promise<QaBranchSwitchResult>;
        restoreWorkspaceBranch(applicationId: string): Promise<{
          restored: boolean;
          branch: string | null;
          stashRestored: boolean;
          reason: string | null;
        }>;
        onUploadConsentRequested(callback: (request: CodebaseUploadConsentRequest) => void): () => void;
        resolveUploadConsent(requestId: string, consented: boolean): Promise<{ resolved: boolean }>;
        onAppUpdated(callback: (event: AppEvent) => void): () => void;
      };
      intent: {
        listDeclaredFlows(applicationId: string): Promise<DeclaredFlowSummary[]>;
        getDeclaredFlow(applicationId: string, flowId: string): Promise<DeclaredFlowDetail>;
        createDeclaredFlow(applicationId: string, name: string, workflowType: string, purpose: string, scopeStatement: string): Promise<DeclaredFlowSummary>;
        addDeclaredState(applicationId: string, flowId: string, stateName: string, category: string, role?: string, terminalKind?: string | null): Promise<Record<string, unknown>>;
        updateDeclaredState(applicationId: string, flowId: string, stateId: string, stateName: string, category: string, role?: string, terminalKind?: string | null): Promise<Record<string, unknown>>;
        deleteDeclaredState(applicationId: string, flowId: string, stateId: string): Promise<Record<string, unknown>>;
        addDeclaredTransition(applicationId: string, flowId: string, fromStateId: string, toStateId: string, action?: string): Promise<Record<string, unknown>>;
        completeDeclaredFlow(applicationId: string, flowId: string): Promise<Record<string, unknown>>;
        reopenDeclaredFlow(applicationId: string, flowId: string): Promise<Record<string, unknown>>;
        generateFlowSuggestions(applicationId: string, flowId: string, input: Record<string, unknown>): Promise<FlowSuggestionsResponse>;
        getFlowSuggestions(applicationId: string, flowId: string): Promise<FlowSuggestionsResponse>;
        acceptFlowSuggestion(applicationId: string, flowId: string, suggestionId: string): Promise<Record<string, unknown>>;
        rejectFlowSuggestion(applicationId: string, flowId: string, suggestionId: string): Promise<Record<string, unknown>>;
        previewFlowReview(applicationId: string, flowId: string, input: Record<string, unknown>): Promise<FlowReviewPreview>;
        applyFlowReview(applicationId: string, flowId: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
        declineFlowReview(applicationId: string, flowId: string, reviewId: string): Promise<Record<string, unknown>>;
        getFlowDiagrams(applicationId: string, flowId: string, versionId: string): Promise<Record<string, unknown>>;
        initializeFlow(input: Record<string, unknown>): Promise<Record<string, unknown>>;
        getFlowInitialization(initializationId: string): Promise<Record<string, any>>;
        analyzeFlowInitialization(initializationId: string): Promise<Record<string, any>>;
        setFlowInitializationMode(initializationId: string, mode: 'AUTOMATED' | 'MANUAL'): Promise<Record<string, any>>;
        updateFlowRoadmapStep(initializationId: string, stepId: string, completed: boolean): Promise<Record<string, any>>;
        startFlowVerification(initializationId: string): Promise<Record<string, any>>;
        verifyFlowCheckpointsInCode(applicationId: string, initializationId: string): Promise<Record<string, any>>;
        getFlowVerification(initializationId: string): Promise<Record<string, any>>;
        rescanFlow(bindingId: string, applicationId: string): Promise<Record<string, unknown>>;
        approveFlowInitialization(initializationId: string, instrumentationPlanId: string): Promise<Record<string, unknown>>;
        applyFlowInitialization(initializationId: string, patchSetId: string): Promise<Record<string, unknown>>;
        validateFlowInitialization(initializationId: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
        listDrafts(applicationId: string): Promise<IntentDraft[]>;
        getDraft(applicationId: string, draftId: string): Promise<IntentDraft>;
        createDraft(applicationId: string, documentVersionIds: string[]): Promise<IntentDraftJobCreated>;
        listDraftJobs(applicationId: string): Promise<IntentDraftJob[]>;
        getDraftJob(applicationId: string, jobId: string): Promise<IntentDraftJob>;
        cancelDraftJob(applicationId: string, jobId: string): Promise<IntentDraftJob>;
        reviewDraft(applicationId: string, draftId: string, review: Record<string, unknown>): Promise<Record<string, unknown>>;
        deleteDraft(applicationId: string, draftId: string): Promise<void>;
        correctDraft(applicationId: string, draftId: string, correction: string): Promise<IntentDraftJobCreated>;
        applyConflictAnswers(applicationId: string, draftId: string, conflictResolutions: Record<string, string>): Promise<IntentDraftJobCreated>;
      };
      documents: {
        list(applicationId: string): Promise<DocumentAccess>;
        /** Opens the file picker; resolves to the started import, or null when no file was chosen. */
        import(applicationId: string, options?: { generateDraft?: boolean }): Promise<DocumentImportView | null>;
        getJob(applicationId: string, jobId: string): Promise<DocumentProcessingJob>;
        getImport(applicationId: string): Promise<DocumentImportView | null>;
        resumeImport(applicationId: string): Promise<DocumentImportView | null>;
        cancelImport(applicationId: string): Promise<DocumentImportView | null>;
        dismissImport(applicationId: string): Promise<void>;
        generateFromVersions(
          applicationId: string,
          documents: Array<{ versionId: string; documentId: string | null; filename: string }>,
        ): Promise<DocumentImportView>;
        onImportProgress(callback: (view: DocumentImportView) => void): () => void;
      };
      runs: {
        list(applicationId: string): Promise<QARunSummary[]>;
        get(runId: string): Promise<Record<string, unknown>>;
        getReplay(runId: string): Promise<Record<string, unknown>>;
        getReport(runId: string): Promise<QualityReport>;
        start(input: StartGuidedRunInput): Promise<GuidedRunState>;
        pause(): Promise<GuidedRunState>;
        resume(): Promise<GuidedRunState>;
        setInteractionMode(mode: QAInteractionMode): Promise<GuidedRunState>;
        retrySynchronization(runId: string): Promise<Record<string, unknown>>;
        revealProtectedValue(runId: string, valueId: string): Promise<{ valueId: string; value: string }>;
        searchMentionableMembers(runId: string, query: string): Promise<QAMentionableMember[]>;
        onLifecycleEvent(callback: (event: RunLifecycleEvent) => void): () => void;
        end(): Promise<GuidedRunState>;
        getActive(): Promise<GuidedRunState | null>;
      };
      instrumentation: {
        detect(input: { applicationId: string; environmentId: string; environmentType: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' }): Promise<{
          entitled: boolean;
          activeControlAllowed: boolean;
          detections: InstrumentationDetection[];
        }>;
        propose(input: { applicationId: string; environmentId: string; environmentType: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION'; adapterId: InstrumentationDetection['adapterId'] }): Promise<Record<string, unknown>>;
        list(applicationId: string): Promise<Record<string, unknown>[]>;
        get(applicationId: string, planId: string): Promise<Record<string, unknown>>;
        getLocalResult(applicationId: string, planId: string): Promise<Record<string, unknown> | null>;
        generateReport(applicationId: string, planId: string, applicationName: string, environmentName: string): Promise<{ cancelled: boolean; filePath?: string; filename?: string; sourceAdded?: boolean; sourceStatus?: string; sourceError?: string }>;
        approve(input: { applicationId: string; environmentId: string; environmentType: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION'; planId: string; approvedFileScopes: string[]; approvedCommandIds: string[] }): Promise<Record<string, unknown>>;
        reject(applicationId: string, planId: string, reason?: string): Promise<Record<string, unknown>>;
        /** `confirmOffQaBranch` is required when the workspace is not on the QA review branch. */
        apply(
          applicationId: string,
          planId: string,
          options?: { confirmOffQaBranch?: boolean },
        ): Promise<Record<string, unknown>>;
        /** The latest apply progress for a plan, or null if it has not been applied this session. */
        getProgress(planId: string): Promise<InstrumentationApplyProgress | null>;
        onProgress(callback: (progress: InstrumentationApplyProgress) => void): () => void;
        validate(applicationId: string, planId: string): Promise<InstrumentationValidationResult>;
        rollback(applicationId: string, planId: string): Promise<Record<string, unknown>>;
      };
      notifications: {
        setActiveOrganization(organizationId: string | null): Promise<void>;
        fetch(input?: { cursor?: string; filter?: string }): Promise<{
          notifications: DesktopNotification[];
          unreadCount: number;
          nextCursor: string | null;
        }>;
        markRead(id: string): Promise<unknown>;
        markAllRead(): Promise<unknown>;
        dismiss(id: string): Promise<unknown>;
        open(id: string): Promise<unknown>;
        /** A notification arrived while this window was in the foreground. */
        onReceived(callback: (row: DesktopNotification) => void): () => void;
        onOpenDeepLink(callback: (payload: { deepLink: string }) => void): () => void;
      };
      system: {
        getVersion(): Promise<string>;
        copyText(value: string): Promise<{ copied: true }>;
        openExternal(url: string): Promise<void>;
        openPath(path: string): Promise<string>;
        openProfile(): Promise<void>;
      };
    };
  }
}

export {};
