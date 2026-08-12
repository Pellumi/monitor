import type {
  DeclaredFlowDetail,
  DeclaredFlowSummary,
  DocumentAccess,
  DesktopApplication,
  DesktopSession,
  QARunSummary,
  QualityReport,
  RepositorySnapshotSummary,
  StartGuidedRunInput,
  SourceDocumentSummary,
  IntentDraft,
  InstrumentationDetection,
  InstrumentationValidationResult,
} from '@sots/desktop-contracts';
import type { GuidedRunState } from '@sots/browser-observer';

declare global {
  interface Window {
    tellann?: {
      auth: {
        getSession(): Promise<DesktopSession>;
        signIn(): Promise<DesktopSession>;
        signOut(): Promise<void>;
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
      };
      intent: {
        listDeclaredFlows(applicationId: string): Promise<DeclaredFlowSummary[]>;
        getDeclaredFlow(applicationId: string, flowId: string): Promise<DeclaredFlowDetail>;
        createDeclaredFlow(applicationId: string, name: string, workflowType: string): Promise<DeclaredFlowSummary>;
        addDeclaredState(applicationId: string, flowId: string, stateName: string, category: string): Promise<Record<string, unknown>>;
        addDeclaredTransition(applicationId: string, flowId: string, fromStateId: string, toStateId: string, action?: string): Promise<Record<string, unknown>>;
        completeDeclaredFlow(applicationId: string, flowId: string): Promise<Record<string, unknown>>;
        reopenDeclaredFlow(applicationId: string, flowId: string): Promise<Record<string, unknown>>;
        listDrafts(applicationId: string): Promise<IntentDraft[]>;
        getDraft(applicationId: string, draftId: string): Promise<IntentDraft>;
        createDraft(applicationId: string, documentVersionIds: string[]): Promise<Record<string, unknown>>;
        reviewDraft(applicationId: string, draftId: string, review: Record<string, unknown>): Promise<Record<string, unknown>>;
        correctDraft(applicationId: string, draftId: string, correction: string): Promise<Record<string, unknown>>;
      };
      documents: {
        list(applicationId: string): Promise<DocumentAccess>;
        import(applicationId: string): Promise<Record<string, unknown>[]>;
      };
      runs: {
        list(applicationId: string): Promise<QARunSummary[]>;
        get(runId: string): Promise<Record<string, unknown>>;
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
        approve(input: { applicationId: string; environmentId: string; environmentType: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION'; planId: string; approvedFileScopes: string[]; approvedCommandIds: string[] }): Promise<Record<string, unknown>>;
        reject(applicationId: string, planId: string, reason?: string): Promise<Record<string, unknown>>;
        apply(applicationId: string, planId: string): Promise<Record<string, unknown>>;
        validate(applicationId: string, planId: string): Promise<InstrumentationValidationResult>;
        rollback(applicationId: string, planId: string): Promise<Record<string, unknown>>;
      };
      system: {
        getVersion(): Promise<string>;
        openExternal(url: string): Promise<void>;
        openProfile(): Promise<void>;
      };
    };
  }
}

export {};
