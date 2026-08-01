import type {
  DeclaredFlowSummary,
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
        listDrafts(applicationId: string): Promise<IntentDraft[]>;
        getDraft(applicationId: string, draftId: string): Promise<IntentDraft>;
        createDraft(applicationId: string, documentVersionIds: string[]): Promise<Record<string, unknown>>;
        reviewDraft(applicationId: string, draftId: string, review: Record<string, unknown>): Promise<Record<string, unknown>>;
        correctDraft(applicationId: string, draftId: string, correction: string): Promise<Record<string, unknown>>;
      };
      documents: {
        list(applicationId: string): Promise<SourceDocumentSummary[]>;
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
