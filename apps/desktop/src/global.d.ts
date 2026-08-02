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
      system: {
        getVersion(): Promise<string>;
        openExternal(url: string): Promise<void>;
        openProfile(): Promise<void>;
      };
    };
  }
}

export {};
