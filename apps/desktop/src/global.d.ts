import type {
  DeclaredFlowDetail,
  DeclaredFlowSummary,
  FlowReviewPreview,
  FlowSuggestionsResponse,
  DocumentAccess,
  DesktopApplication,
  DesktopSession,
  QARunSummary,
  QualityReport,
  RepositorySnapshotSummary,
  StartGuidedRunInput,
  SourceDocumentSummary,
  IntentDraft,
  DocumentImportResult,
  DocumentProcessingJob,
  IntentDraftJob,
  IntentDraftJobCreated,
  InstrumentationDetection,
  InstrumentationValidationResult,
} from '@tellann/desktop-contracts';
import type { GuidedRunState } from '@tellann/browser-observer';

declare global {
  interface Window {
    tellann?: {
      auth: {
        getSession(): Promise<DesktopSession>;
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
        getLocalWorkspace(applicationId: string): Promise<{
          id: string;
          path: string;
          name: string;
          snapshot: RepositorySnapshotSummary;
        } | null>;
        chooseWorkspace(): Promise<{ path: string; name: string } | null>;
        scanWorkspace(input: { path: string; workspaceId: string; applicationId: string }): Promise<RepositorySnapshotSummary>;
        onAppUpdated(callback: (event: { action: string; applicationId: string; name?: string; summary?: string }) => void): () => void;
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
      };
      documents: {
        list(applicationId: string): Promise<DocumentAccess>;
        import(applicationId: string): Promise<DocumentImportResult[]>;
        getJob(applicationId: string, jobId: string): Promise<DocumentProcessingJob>;
      };
      runs: {
        list(applicationId: string): Promise<QARunSummary[]>;
        get(runId: string): Promise<Record<string, unknown>>;
        getReplay(runId: string): Promise<Record<string, unknown>>;
        getReport(runId: string): Promise<QualityReport>;
        start(input: StartGuidedRunInput): Promise<GuidedRunState>;
        pause(): Promise<GuidedRunState>;
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
        apply(applicationId: string, planId: string): Promise<Record<string, unknown>>;
        validate(applicationId: string, planId: string): Promise<InstrumentationValidationResult>;
        rollback(applicationId: string, planId: string): Promise<Record<string, unknown>>;
      };
      system: {
        getVersion(): Promise<string>;
        copyText(value: string): Promise<{ copied: true }>;
        openExternal(url: string): Promise<void>;
        openProfile(): Promise<void>;
      };
    };
  }
}

export {};
