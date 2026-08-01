import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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

export type LocalWorkspace = {
  id: string;
  path: string;
  name: string;
  snapshot: RepositorySnapshotSummary;
};

type DesktopContextValue = {
  bridgeAvailable: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  cloudAvailable: boolean;
  session: DesktopSession | null;
  applications: DesktopApplication[];
  workspaces: Record<string, LocalWorkspace>;
  runs: Record<string, QARunSummary[]>;
  activeRun: GuidedRunState | null;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  refreshApplications(): Promise<DesktopApplication[]>;
  attachWorkspace(applicationId: string): Promise<LocalWorkspace | null>;
  refreshRuns(applicationId: string): Promise<QARunSummary[]>;
  getRun(runId: string): Promise<Record<string, unknown>>;
  getReport(runId: string): Promise<QualityReport>;
  getDeclaredFlows(applicationId: string): Promise<DeclaredFlowSummary[]>;
  getDocuments(applicationId: string): Promise<SourceDocumentSummary[]>;
  importDocuments(applicationId: string): Promise<Record<string, unknown>[]>;
  getIntentDrafts(applicationId: string): Promise<IntentDraft[]>;
  getIntentDraft(applicationId: string, draftId: string): Promise<IntentDraft>;
  createIntentDraft(applicationId: string, documentVersionIds: string[]): Promise<Record<string, unknown>>;
  reviewIntentDraft(applicationId: string, draftId: string, review: Record<string, unknown>): Promise<Record<string, unknown>>;
  correctIntentDraft(applicationId: string, draftId: string, correction: string): Promise<Record<string, unknown>>;
  startRun(input: StartGuidedRunInput): Promise<GuidedRunState>;
  pauseRun(): Promise<GuidedRunState>;
  endRun(): Promise<GuidedRunState>;
  clearError(): void;
};

const DesktopContext = createContext<DesktopContextValue | null>(null);

function bridge() {
  if (!window.tellann) throw new Error('Desktop features require the Tellann Electron application.');
  return window.tellann;
}

export function DesktopProvider({ children }: { children: ReactNode }) {
  const bridgeAvailable = Boolean(window.tellann);
  const [loading, setLoading] = useState(bridgeAvailable);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloudAvailable, setCloudAvailable] = useState(true);
  const [session, setSession] = useState<DesktopSession | null>(null);
  const [applications, setApplications] = useState<DesktopApplication[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, LocalWorkspace>>({});
  const [runs, setRuns] = useState<Record<string, QARunSummary[]>>({});
  const [activeRun, setActiveRun] = useState<GuidedRunState | null>(null);

  useEffect(() => {
    if (!window.tellann) return;
    let cancelled = false;
    void Promise.all([
      window.tellann.auth.getSession(),
      window.tellann.runs.getActive(),
    ]).then(async ([nextSession, currentRun]) => {
      if (cancelled) return;
      setSession(nextSession);
      setActiveRun(currentRun);
      if (nextSession.authenticated) {
        const nextApplications = await bridge().projects.list();
        setCloudAvailable(true);
        setApplications(nextApplications);
        const localEntries = await Promise.all(nextApplications.map(async (application) => [
          application.id,
          await bridge().projects.getLocalWorkspace(application.id),
        ] as const));
        setWorkspaces(Object.fromEntries(localEntries.filter((entry): entry is [string, LocalWorkspace] => Boolean(entry[1]))));
      }
    }).catch((cause) => {
      if (!cancelled) {
        setCloudAvailable(false);
        setError(normalizeDesktopError(cause));
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeRun || ['COMPLETED', 'FAILED'].includes(activeRun.status)) return;
    const timer = window.setInterval(() => {
      void bridge().runs.getActive().then((state) => state && setActiveRun(state)).catch(() => undefined);
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [activeRun?.status]);

  const perform = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    setBusy(true);
    setError(null);
    try {
      return await operation();
    } catch (cause) {
      const message = normalizeDesktopError(cause);
      setError(message);
      throw cause;
    } finally {
      setBusy(false);
    }
  }, []);

  const signIn = useCallback(async () => {
    await perform(async () => {
      const nextSession = await bridge().auth.signIn();
      setSession(nextSession);
      setApplications(await bridge().projects.list());
      setCloudAvailable(true);
    });
  }, [perform]);

  const refreshApplications = useCallback(async () => perform(async () => {
    const nextApplications = await bridge().projects.list();
    setApplications(nextApplications);
    setCloudAvailable(true);
    return nextApplications;
  }).catch((cause) => {
    setCloudAvailable(false);
    throw cause;
  }), [perform]);

  const signOut = useCallback(async () => {
    await perform(async () => {
      await bridge().auth.signOut();
      setSession(null);
      setApplications([]);
      setRuns({});
      setActiveRun(null);
    });
  }, [perform]);

  const attachWorkspace = useCallback(async (applicationId: string) => perform(async () => {
    const selected = await bridge().projects.chooseWorkspace();
    if (!selected) return null;
    const id = crypto.randomUUID();
    const snapshot = await bridge().projects.scanWorkspace({ ...selected, workspaceId: id, applicationId });
    const workspace = { id, ...selected, snapshot };
    setWorkspaces((current) => ({ ...current, [applicationId]: workspace }));
    return workspace;
  }), [perform]);

  const refreshRuns = useCallback(async (applicationId: string) => {
    const result = await bridge().runs.list(applicationId);
    setRuns((current) => ({ ...current, [applicationId]: result }));
    return result;
  }, []);

  const startRun = useCallback(async (input: StartGuidedRunInput) => perform(async () => {
    const next = await bridge().runs.start(input);
    setActiveRun(next);
    return next;
  }), [perform]);

  const pauseRun = useCallback(async () => {
    const next = await bridge().runs.pause();
    setActiveRun(next);
    return next;
  }, []);

  const endRun = useCallback(async () => perform(async () => {
    const next = await bridge().runs.end();
    setActiveRun(next);
    return next;
  }), [perform]);

  const value = useMemo<DesktopContextValue>(() => ({
    bridgeAvailable,
    loading,
    busy,
    error,
    cloudAvailable,
    session,
    applications,
    workspaces,
    runs,
    activeRun,
    signIn,
    signOut,
    refreshApplications,
    attachWorkspace,
    refreshRuns,
    getRun: (runId) => bridge().runs.get(runId),
    getReport: (runId) => bridge().runs.getReport(runId),
    getDeclaredFlows: (applicationId) => bridge().intent.listDeclaredFlows(applicationId),
    getDocuments: (applicationId) => bridge().documents.list(applicationId),
    importDocuments: (applicationId) => perform(() => bridge().documents.import(applicationId)),
    getIntentDrafts: (applicationId) => bridge().intent.listDrafts(applicationId),
    getIntentDraft: (applicationId, draftId) => bridge().intent.getDraft(applicationId, draftId),
    createIntentDraft: (applicationId, documentVersionIds) => perform(() => bridge().intent.createDraft(applicationId, documentVersionIds)),
    reviewIntentDraft: (applicationId, draftId, review) => perform(() => bridge().intent.reviewDraft(applicationId, draftId, review)),
    correctIntentDraft: (applicationId, draftId, correction) => perform(() => bridge().intent.correctDraft(applicationId, draftId, correction)),
    startRun,
    pauseRun,
    endRun,
    clearError: () => setError(null),
  }), [
    activeRun, applications, attachWorkspace, bridgeAvailable, busy, cloudAvailable, endRun, error, loading,
    pauseRun, perform, refreshApplications, refreshRuns, runs, session, signIn, signOut, startRun, workspaces,
  ]);

  return <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>;
}

export function useDesktop() {
  const value = useContext(DesktopContext);
  if (!value) throw new Error('useDesktop must be used inside DesktopProvider');
  return value;
}

function normalizeDesktopError(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : 'Desktop operation failed';
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '');
}
