import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
  DocumentImportResult,
  DocumentProcessingJob,
  IntentDraftJob,
  IntentDraftJobCreated,
  InstrumentationDetection,
  InstrumentationValidationResult,
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
  authPending: boolean;
  error: string | null;
  cloudAvailable: boolean;
  session: DesktopSession | null;
  applications: DesktopApplication[];
  workspaces: Record<string, LocalWorkspace>;
  runs: Record<string, QARunSummary[]>;
  activeRun: GuidedRunState | null;
  signIn(): Promise<void>;
  reopenSignIn(): Promise<void>;
  cancelSignIn(): Promise<void>;
  signOut(): Promise<void>;
  refreshApplications(): Promise<DesktopApplication[]>;
  attachWorkspace(applicationId: string): Promise<LocalWorkspace | null>;
  refreshRuns(applicationId: string): Promise<QARunSummary[]>;
  getRun(runId: string): Promise<Record<string, unknown>>;
  getRunReplay(runId: string): Promise<Record<string, unknown>>;
  getReport(runId: string): Promise<QualityReport>;
  getDeclaredFlows(applicationId: string): Promise<DeclaredFlowSummary[]>;
  getDeclaredFlow(applicationId: string, flowId: string): Promise<DeclaredFlowDetail>;
  createDeclaredFlow(applicationId: string, name: string, workflowType: string): Promise<DeclaredFlowSummary>;
  addDeclaredState(applicationId: string, flowId: string, stateName: string, category: string): Promise<Record<string, unknown>>;
  addDeclaredTransition(applicationId: string, flowId: string, fromStateId: string, toStateId: string, action?: string): Promise<Record<string, unknown>>;
  completeDeclaredFlow(applicationId: string, flowId: string): Promise<Record<string, unknown>>;
  reopenDeclaredFlow(applicationId: string, flowId: string): Promise<Record<string, unknown>>;
  getDocuments(applicationId: string): Promise<DocumentAccess>;
  importDocuments(applicationId: string): Promise<DocumentImportResult[]>;
  getDocumentJob(applicationId: string, jobId: string): Promise<DocumentProcessingJob>;
  getIntentDrafts(applicationId: string): Promise<IntentDraft[]>;
  getIntentDraft(applicationId: string, draftId: string): Promise<IntentDraft>;
  createIntentDraft(applicationId: string, documentVersionIds: string[]): Promise<IntentDraftJobCreated>;
  getIntentDraftJobs(applicationId: string): Promise<IntentDraftJob[]>;
  getIntentDraftJob(applicationId: string, jobId: string): Promise<IntentDraftJob>;
  cancelIntentDraftJob(applicationId: string, jobId: string): Promise<IntentDraftJob>;
  reviewIntentDraft(applicationId: string, draftId: string, review: Record<string, unknown>): Promise<Record<string, unknown>>;
  deleteIntentDraft(applicationId: string, draftId: string): Promise<void>;
  correctIntentDraft(applicationId: string, draftId: string, correction: string): Promise<IntentDraftJobCreated>;
  detectInstrumentation(input: InstrumentationEnvironmentInput): Promise<{ entitled: boolean; activeControlAllowed: boolean; detections: InstrumentationDetection[] }>;
  proposeInstrumentation(input: InstrumentationEnvironmentInput & { adapterId: InstrumentationDetection['adapterId'] }): Promise<Record<string, unknown>>;
  listInstrumentationPlans(applicationId: string): Promise<Record<string, unknown>[]>;
  getInstrumentationPlan(applicationId: string, planId: string): Promise<Record<string, unknown>>;
  getLocalInstrumentationResult(applicationId: string, planId: string): Promise<Record<string, unknown> | null>;
  approveInstrumentation(input: InstrumentationEnvironmentInput & { planId: string; approvedFileScopes: string[]; approvedCommandIds: string[] }): Promise<Record<string, unknown>>;
  rejectInstrumentation(applicationId: string, planId: string, reason?: string): Promise<Record<string, unknown>>;
  applyInstrumentation(applicationId: string, planId: string): Promise<Record<string, unknown>>;
  validateInstrumentation(applicationId: string, planId: string): Promise<InstrumentationValidationResult>;
  rollbackInstrumentation(applicationId: string, planId: string): Promise<Record<string, unknown>>;
  startRun(input: StartGuidedRunInput): Promise<GuidedRunState>;
  pauseRun(): Promise<GuidedRunState>;
  endRun(): Promise<GuidedRunState>;
  clearError(): void;
};

type InstrumentationEnvironmentInput = {
  applicationId: string;
  environmentId: string;
  environmentType: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
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
  const [authPending, setAuthPending] = useState(false);
  const authAttemptRef = useRef(0);
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
    }).catch(async (cause) => {
      if (cancelled) return;
      const message = normalizeDesktopError(cause);
      const nextSession = await window.tellann?.auth.getSession().catch(() => null);
      if (nextSession && !nextSession.authenticated) {
        setSession(nextSession);
        setApplications([]);
        setCloudAvailable(true);
        setError('Your Tellann Desktop session expired or was revoked. Sign in again.');
        return;
      }
      setCloudAvailable(false);
      setError(message);
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
    const attemptId = ++authAttemptRef.current;
    setAuthPending(true);
    setError(null);
    try {
      const nextSession = await bridge().auth.signIn();
      setSession(nextSession);
      setApplications(await bridge().projects.list());
      setCloudAvailable(true);
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : String(cause);
      if (!/DESKTOP_AUTH_CANCELLED/.test(raw)) setError(normalizeDesktopError(cause));
    } finally {
      if (authAttemptRef.current === attemptId) setAuthPending(false);
    }
  }, []);

  const reopenSignIn = useCallback(async () => {
    try {
      await bridge().auth.reopenSignIn();
    } catch (cause) {
      setError(normalizeDesktopError(cause));
    }
  }, []);

  const cancelSignIn = useCallback(async () => {
    authAttemptRef.current += 1;
    await bridge().auth.cancelSignIn();
    setAuthPending(false);
    setError(null);
  }, []);

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
    authPending,
    error,
    cloudAvailable,
    session,
    applications,
    workspaces,
    runs,
    activeRun,
    signIn,
    reopenSignIn,
    cancelSignIn,
    signOut,
    refreshApplications,
    attachWorkspace,
    refreshRuns,
    getRun: (runId) => bridge().runs.get(runId),
    getRunReplay: (runId) => bridge().runs.getReplay(runId),
    getReport: (runId) => bridge().runs.getReport(runId),
    getDeclaredFlows: (applicationId) => bridge().intent.listDeclaredFlows(applicationId),
    getDeclaredFlow: (applicationId, flowId) => bridge().intent.getDeclaredFlow(applicationId, flowId),
    createDeclaredFlow: (applicationId, name, workflowType) => perform(() => bridge().intent.createDeclaredFlow(applicationId, name, workflowType)),
    addDeclaredState: (applicationId, flowId, stateName, category) => perform(() => bridge().intent.addDeclaredState(applicationId, flowId, stateName, category)),
    addDeclaredTransition: (applicationId, flowId, fromStateId, toStateId, action) => perform(() => bridge().intent.addDeclaredTransition(applicationId, flowId, fromStateId, toStateId, action)),
    completeDeclaredFlow: (applicationId, flowId) => perform(() => bridge().intent.completeDeclaredFlow(applicationId, flowId)),
    reopenDeclaredFlow: (applicationId, flowId) => perform(() => bridge().intent.reopenDeclaredFlow(applicationId, flowId)),
    getDocuments: (applicationId) => bridge().documents.list(applicationId),
    importDocuments: (applicationId) => perform(() => bridge().documents.import(applicationId)),
    getDocumentJob: (applicationId, jobId) => bridge().documents.getJob(applicationId, jobId),
    getIntentDrafts: (applicationId) => bridge().intent.listDrafts(applicationId),
    getIntentDraft: (applicationId, draftId) => bridge().intent.getDraft(applicationId, draftId),
    createIntentDraft: (applicationId, documentVersionIds) => perform(() => bridge().intent.createDraft(applicationId, documentVersionIds)),
    getIntentDraftJobs: (applicationId) => bridge().intent.listDraftJobs(applicationId),
    getIntentDraftJob: (applicationId, jobId) => bridge().intent.getDraftJob(applicationId, jobId),
    cancelIntentDraftJob: (applicationId, jobId) => perform(() => bridge().intent.cancelDraftJob(applicationId, jobId)),
    reviewIntentDraft: (applicationId, draftId, review) => perform(() => bridge().intent.reviewDraft(applicationId, draftId, review)),
    deleteIntentDraft: (applicationId, draftId) => perform(() => bridge().intent.deleteDraft(applicationId, draftId)),
    correctIntentDraft: (applicationId, draftId, correction) => perform(() => bridge().intent.correctDraft(applicationId, draftId, correction)),
    detectInstrumentation: (input) => perform(() => bridge().instrumentation.detect(input)),
    proposeInstrumentation: (input) => perform(() => bridge().instrumentation.propose(input)),
    listInstrumentationPlans: (applicationId) => bridge().instrumentation.list(applicationId),
    getInstrumentationPlan: (applicationId, planId) => bridge().instrumentation.get(applicationId, planId),
    getLocalInstrumentationResult: (applicationId, planId) => bridge().instrumentation.getLocalResult(applicationId, planId),
    approveInstrumentation: (input) => perform(() => bridge().instrumentation.approve(input)),
    rejectInstrumentation: (applicationId, planId, reason) => perform(() => bridge().instrumentation.reject(applicationId, planId, reason)),
    applyInstrumentation: (applicationId, planId) => perform(() => bridge().instrumentation.apply(applicationId, planId)),
    validateInstrumentation: (applicationId, planId) => perform(() => bridge().instrumentation.validate(applicationId, planId)),
    rollbackInstrumentation: (applicationId, planId) => perform(() => bridge().instrumentation.rollback(applicationId, planId)),
    startRun,
    pauseRun,
    endRun,
    clearError: () => setError(null),
  }), [
    activeRun, applications, attachWorkspace, authPending, bridgeAvailable, busy, cancelSignIn, cloudAvailable, endRun, error, loading,
    pauseRun, perform, refreshApplications, refreshRuns, reopenSignIn, runs, session, signIn, signOut, startRun, workspaces,
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
  if ((cause as { status?: number })?.status === 429 || /rate limit/i.test(raw)) {
    return raw.includes('temporarily limiting')
      ? raw
      : 'Tellann is temporarily limiting new requests. Cached project data remains available and the app will recover automatically.';
  }
  if (/DESKTOP_AUTH_REQUEST_EXPIRED/.test(raw)) {
    return 'The sign-in request expired. Try again to open a new secure browser session.';
  }
  if (/DESKTOP_AUTH_NOT_PENDING/.test(raw)) {
    return 'That sign-in request is no longer active. Cancel it and try again.';
  }
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '');
}
