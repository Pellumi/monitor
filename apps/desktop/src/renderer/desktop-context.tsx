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
  RepositoryMismatch,
  CreateApplicationInput,
  DesktopOrganization,
  QaBranchSwitchResult,
  WorkspaceCompliance,
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

export type LocalWorkspace = {
  id: string;
  path: string;
  name: string;
  snapshot: RepositorySnapshotSummary;
};

/** A rejected folder attach, plus the application it was rejected for. */
export type RepositoryMismatchPrompt = RepositoryMismatch & { applicationId: string };

/**
 * Recovers the mismatch details the main process encoded into the error message,
 * because Electron keeps only `message` when a rejection crosses IPC — and it
 * prefixes that, so the payload is matched anywhere in the string rather than
 * anchored to its start.
 *
 * This lives here rather than in @tellann/desktop-contracts because that package
 * compiles to CommonJS and pulls in zod: the renderer imports only types from it.
 * The code below must stay in step with REPOSITORY_MISMATCH_CODE there.
 */
function parseRepositoryMismatch(cause: unknown): RepositoryMismatch | null {
  const raw = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  const match = /REPOSITORY_MISMATCH\s+(\{[\s\S]*\})/.exec(raw);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as Partial<RepositoryMismatch>;
    return {
      message: typeof parsed.message === 'string' && parsed.message
        ? parsed.message
        : 'This folder belongs to a different repository than the one this application is bound to.',
      expectedCloneUrl: typeof parsed.expectedCloneUrl === 'string' ? parsed.expectedCloneUrl : null,
    };
  } catch {
    return null;
  }
}

type DesktopContextValue = {
  bridgeAvailable: boolean;
  loading: boolean;
  busy: boolean;
  authPending: boolean;
  error: string | null;
  cloudAvailable: boolean;
  session: DesktopSession | null;
  /** The signed-in user's avatar as a `data:` URI, or null to fall back to initials. */
  avatarDataUri: string | null;
  applications: DesktopApplication[];
  /** Organisations the member belongs to — the owner of any application they create. */
  organizations: DesktopOrganization[];
  workspaces: Record<string, LocalWorkspace>;
  /** Per-application QA branch verdict for this member's own checkout. */
  branchCompliance: Record<string, WorkspaceCompliance>;
  runs: Record<string, QARunSummary[]>;
  activeRun: GuidedRunState | null;
  signIn(): Promise<void>;
  reopenSignIn(): Promise<void>;
  cancelSignIn(): Promise<void>;
  signOut(): Promise<void>;
  refreshApplications(): Promise<DesktopApplication[]>;
  refreshOrganizations(): Promise<DesktopOrganization[]>;
  /** Creates the application in the cloud, then refreshes the local list. */
  createApplication(input: CreateApplicationInput): Promise<DesktopApplication | null>;
  attachWorkspace(applicationId: string): Promise<LocalWorkspace | null>;
  /** Set when the last attach was refused because the folder is a different repository. */
  repositoryMismatch: RepositoryMismatchPrompt | null;
  dismissRepositoryMismatch(): void;
  cloneWorkspace(applicationId: string, cloneUrl: string): Promise<LocalWorkspace | null>;
  refreshBranchCompliance(applicationId: string): Promise<WorkspaceCompliance | null>;
  /** Owner/Admin only: turn agent-performed branch switching on or off org-wide. */
  setBranchAgentCheckout(applicationId: string, allowAgentCheckout: boolean): Promise<WorkspaceCompliance | null>;
  grantQaBranchCheckout(applicationId: string): Promise<WorkspaceCompliance | null>;
  switchToQaBranch(applicationId: string): Promise<QaBranchSwitchResult | null>;
  restoreWorkspaceBranch(applicationId: string): Promise<{
    restored: boolean;
    branch: string | null;
    stashRestored: boolean;
    reason: string | null;
  } | null>;
  refreshRuns(applicationId: string): Promise<QARunSummary[]>;
  getRun(runId: string): Promise<Record<string, unknown>>;
  getRunReplay(runId: string): Promise<Record<string, unknown>>;
  getReport(runId: string): Promise<QualityReport>;
  getDeclaredFlows(applicationId: string): Promise<DeclaredFlowSummary[]>;
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
  instrumentationPurpose?: 'BOOTSTRAP' | 'FLOW';
  flowId?: string;
  flowVersionId?: string;
  flowInitializationId?: string;
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
  const [fetchedOrganizations, setFetchedOrganizations] = useState<DesktopOrganization[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, LocalWorkspace>>({});
  const [branchCompliance, setBranchCompliance] = useState<Record<string, WorkspaceCompliance>>({});
  const [repositoryMismatch, setRepositoryMismatch] = useState<RepositoryMismatchPrompt | null>(null);
  const [runs, setRuns] = useState<Record<string, QARunSummary[]>>({});
  const [activeRun, setActiveRun] = useState<GuidedRunState | null>(null);
  const [avatarDataUri, setAvatarDataUri] = useState<string | null>(null);

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
        // A member with no applications still belongs to an organisation, and
        // that is exactly when they need to create their first one.
        void bridge().projects.listOrganizations().then(setFetchedOrganizations).catch(() => undefined);
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
    const userId = session?.user?.id;
    if (!window.tellann || !userId) {
      setAvatarDataUri(null);
      return;
    }
    let cancelled = false;
    void window.tellann.auth
      .getAvatarDataUri()
      .then((uri) => { if (!cancelled) setAvatarDataUri(uri); })
      .catch(() => { if (!cancelled) setAvatarDataUri(null); });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!window.tellann?.projects?.onAppUpdated) return;
    const unsubscribe = window.tellann.projects.onAppUpdated((event) => {
      if (event.action === 'APP_DELETED') {
        setApplications((current) => current.filter((app) => app.id !== event.applicationId));
      } else {
        void bridge().projects.list().then((nextApps) => {
          setApplications(nextApps);
        }).catch(() => undefined);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!activeRun || ['COMPLETED', 'FAILED'].includes(activeRun.status)) return;
    const timer = window.setInterval(() => {
      void bridge().runs.getActive().then((state) => state && setActiveRun(state)).catch(() => undefined);
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [activeRun?.status]);

  const handleAuthRequired = useCallback(async () => {
    const nextSession = await window.tellann?.auth.getSession().catch(() => null);
    if (nextSession) {
      setSession(nextSession);
      if (!nextSession.authenticated) {
        setApplications([]);
      }
    }
  }, []);

  const perform = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    setBusy(true);
    setError(null);
    try {
      return await operation();
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : String(cause);
      if (/AUTHENTICATION_REQUIRED/.test(raw)) {
        void handleAuthRequired();
      }
      const message = normalizeDesktopError(cause);
      setError(message);
      throw cause;
    } finally {
      setBusy(false);
    }
  }, [handleAuthRequired]);

  const signIn = useCallback(async () => {
    const attemptId = ++authAttemptRef.current;
    setAuthPending(true);
    setError(null);
    try {
      const nextSession = await bridge().auth.signIn();
      setSession(nextSession);
      setApplications(await bridge().projects.list());
      void bridge().projects.listOrganizations().then(setFetchedOrganizations).catch(() => undefined);
      setCloudAvailable(true);
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : String(cause);
      if (!/DESKTOP_AUTH_CANCELLED/.test(raw)) {
        const currentSession = await bridge().auth.getSession().catch(() => null);
        if (currentSession && !currentSession.authenticated) {
          setSession(currentSession);
          setApplications([]);
          setCloudAvailable(true);
        }
        setError(normalizeDesktopError(cause));
      }
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
  }).catch(async (cause) => {
    const nextSession = await bridge().auth.getSession().catch(() => null);
    if (nextSession && !nextSession.authenticated) {
      setSession(nextSession);
      setApplications([]);
      setCloudAvailable(true);
      setError('Your Tellann Desktop session expired or was revoked. Sign in again.');
      throw cause;
    }
    setCloudAvailable(false);
    throw cause;
  }), [perform]);

  const refreshOrganizations = useCallback(async () => {
    // An Electron process started before this method existed exposes a bridge
    // without it, which would otherwise surface as an opaque TypeError.
    if (typeof bridge().projects.listOrganizations !== 'function') {
      throw new Error('Restart Tellann Desktop to load your organizations.');
    }
    const next = await bridge().projects.listOrganizations();
    setFetchedOrganizations(next);
    return next;
  }, []);

  /**
   * Every application already carries the organisation that owns it, so the
   * picker stays populated from data in hand even when `/organizations` is
   * unreachable — which otherwise looks identical to belonging to none.
   */
  const organizations = useMemo(() => {
    const merged = new Map<string, DesktopOrganization>();
    for (const organization of fetchedOrganizations) merged.set(organization.id, organization);
    for (const application of applications) {
      if (merged.has(application.organizationId)) continue;
      merged.set(application.organizationId, {
        id: application.organizationId,
        name: application.organizationName,
        slug: null,
      });
    }
    return [...merged.values()];
  }, [applications, fetchedOrganizations]);

  const createApplication = useCallback(async (input: CreateApplicationInput) => perform(async () => {
    const created = await bridge().projects.create(input);
    // The cloud is the source of truth for environments and entitlements, so
    // read the application back rather than synthesising it here. The list also
    // arrives via the APP_CREATED broadcast, but waiting for it would leave the
    // caller without an id to navigate to.
    const nextApplications = await bridge().projects.list();
    setApplications(nextApplications);
    return nextApplications.find((item) => item.id === created.id) ?? null;
  }), [perform]);

  const signOut = useCallback(async () => {
    await perform(async () => {
      await bridge().auth.signOut();
      setSession(null);
      setApplications([]);
      setFetchedOrganizations([]);
      setRuns({});
      setActiveRun(null);
    });
  }, [perform]);

  const refreshBranchCompliance = useCallback(async (applicationId: string) => {
    try {
      const compliance = await bridge().projects.getBranchCompliance(applicationId);
      setBranchCompliance((current) => {
        if (!compliance) {
          const { [applicationId]: _removed, ...rest } = current;
          return rest;
        }
        return { ...current, [applicationId]: compliance };
      });
      return compliance;
    } catch {
      // A compliance check that cannot run is not a violation, so it must never
      // surface as an error banner over the rest of the app.
      return null;
    }
  }, []);

  const attachWorkspace = useCallback(async (applicationId: string) => perform(async () => {
    const selected = await bridge().projects.chooseWorkspace();
    if (!selected) return null;
    setRepositoryMismatch(null);
    // The workspace id is derived in the main process from the folder path, so
    // re-attaching the same folder updates the existing record rather than
    // creating a duplicate.
    let scanned: Awaited<ReturnType<ReturnType<typeof bridge>['projects']['scanWorkspace']>>;
    try {
      scanned = await bridge().projects.scanWorkspace({ ...selected, applicationId });
    } catch (cause) {
      const mismatch = parseRepositoryMismatch(cause);
      // The wrong folder is the user's next decision, not an app-level failure:
      // it is raised as a modal that offers the folder picker again, instead of
      // an error banner above a page they are not looking at.
      if (!mismatch) throw cause;
      setRepositoryMismatch({ ...mismatch, applicationId });
      return null;
    }
    const workspace = { id: scanned.id, ...selected, snapshot: scanned.snapshot };
    setWorkspaces((current) => ({ ...current, [applicationId]: workspace }));
    void refreshBranchCompliance(applicationId);
    return workspace;
  }), [perform, refreshBranchCompliance]);

  const setBranchAgentCheckout = useCallback(async (applicationId: string, allowAgentCheckout: boolean) => perform(async () => {
    await bridge().projects.setBranchAgentCheckout(applicationId, allowAgentCheckout);
    return refreshBranchCompliance(applicationId);
  }), [perform, refreshBranchCompliance]);

  const grantQaBranchCheckout = useCallback(async (applicationId: string) => perform(async () => {
    await bridge().projects.grantQaBranchCheckout(applicationId);
    return refreshBranchCompliance(applicationId);
  }), [perform, refreshBranchCompliance]);

  const switchToQaBranch = useCallback(async (applicationId: string) => perform(async () => {
    const result = await bridge().projects.switchToQaBranch(applicationId);
    await refreshBranchCompliance(applicationId);
    return result;
  }), [perform, refreshBranchCompliance]);

  const restoreWorkspaceBranch = useCallback(async (applicationId: string) => perform(async () => {
    const result = await bridge().projects.restoreWorkspaceBranch(applicationId);
    await refreshBranchCompliance(applicationId);
    return result;
  }), [perform, refreshBranchCompliance]);

  const cloneWorkspace = useCallback(async (applicationId: string, cloneUrl: string) => perform(async () => {
    const workspace = await bridge().projects.cloneWorkspace({ applicationId, cloneUrl });
    if (!workspace) return null;
    setWorkspaces((current) => ({ ...current, [applicationId]: workspace }));
    void refreshBranchCompliance(applicationId);
    return workspace;
  }), [perform, refreshBranchCompliance]);

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
    avatarDataUri,
    applications,
    organizations,
    workspaces,
    branchCompliance,
    runs,
    activeRun,
    signIn,
    reopenSignIn,
    cancelSignIn,
    signOut,
    refreshApplications,
    refreshOrganizations,
    createApplication,
    attachWorkspace,
    repositoryMismatch,
    dismissRepositoryMismatch: () => setRepositoryMismatch(null),
    cloneWorkspace,
    refreshBranchCompliance,
    setBranchAgentCheckout,
    grantQaBranchCheckout,
    switchToQaBranch,
    restoreWorkspaceBranch,
    refreshRuns,
    getRun: (runId) => bridge().runs.get(runId),
    getRunReplay: (runId) => bridge().runs.getReplay(runId),
    getReport: (runId) => bridge().runs.getReport(runId),
    getDeclaredFlows: (applicationId) => bridge().intent.listDeclaredFlows(applicationId),
    getDeclaredFlow: (applicationId, flowId) => bridge().intent.getDeclaredFlow(applicationId, flowId),
    createDeclaredFlow: (applicationId, name, workflowType, purpose, scopeStatement) => perform(() => bridge().intent.createDeclaredFlow(applicationId, name, workflowType, purpose, scopeStatement)),
    addDeclaredState: (applicationId, flowId, stateName, category, role, terminalKind) => perform(() => bridge().intent.addDeclaredState(applicationId, flowId, stateName, category, role, terminalKind)),
    updateDeclaredState: (applicationId, flowId, stateId, stateName, category, role, terminalKind) => perform(() => bridge().intent.updateDeclaredState(applicationId, flowId, stateId, stateName, category, role, terminalKind)),
    deleteDeclaredState: (applicationId, flowId, stateId) => perform(() => bridge().intent.deleteDeclaredState(applicationId, flowId, stateId)),
    addDeclaredTransition: (applicationId, flowId, fromStateId, toStateId, action) => perform(() => bridge().intent.addDeclaredTransition(applicationId, flowId, fromStateId, toStateId, action)),
    completeDeclaredFlow: (applicationId, flowId) => perform(() => bridge().intent.completeDeclaredFlow(applicationId, flowId)),
    reopenDeclaredFlow: (applicationId, flowId) => perform(() => bridge().intent.reopenDeclaredFlow(applicationId, flowId)),
    generateFlowSuggestions: (applicationId, flowId, input) => bridge().intent.generateFlowSuggestions(applicationId, flowId, input),
    getFlowSuggestions: (applicationId, flowId) => bridge().intent.getFlowSuggestions(applicationId, flowId),
    acceptFlowSuggestion: (applicationId, flowId, suggestionId) => bridge().intent.acceptFlowSuggestion(applicationId, flowId, suggestionId),
    rejectFlowSuggestion: (applicationId, flowId, suggestionId) => bridge().intent.rejectFlowSuggestion(applicationId, flowId, suggestionId),
    previewFlowReview: (applicationId, flowId, input) => bridge().intent.previewFlowReview(applicationId, flowId, input),
    applyFlowReview: (applicationId, flowId, input) => perform(() => bridge().intent.applyFlowReview(applicationId, flowId, input)),
    declineFlowReview: (applicationId, flowId, reviewId) => bridge().intent.declineFlowReview(applicationId, flowId, reviewId),
    getFlowDiagrams: (applicationId, flowId, versionId) => bridge().intent.getFlowDiagrams(applicationId, flowId, versionId),
    initializeFlow: (input) => perform(() => bridge().intent.initializeFlow(input)),
    getFlowInitialization: (initializationId) => bridge().intent.getFlowInitialization(initializationId),
    analyzeFlowInitialization: (initializationId) => perform(() => bridge().intent.analyzeFlowInitialization(initializationId)),
    setFlowInitializationMode: (initializationId, mode) => perform(() => bridge().intent.setFlowInitializationMode(initializationId, mode)),
    updateFlowRoadmapStep: (initializationId, stepId, completed) => perform(() => bridge().intent.updateFlowRoadmapStep(initializationId, stepId, completed)),
    startFlowVerification: (initializationId) => perform(() => bridge().intent.startFlowVerification(initializationId)),
    verifyFlowCheckpointsInCode: (applicationId, initializationId) => perform(() => bridge().intent.verifyFlowCheckpointsInCode(applicationId, initializationId)),
    getFlowVerification: (initializationId) => bridge().intent.getFlowVerification(initializationId),
    rescanFlow: (bindingId, applicationId) => perform(() => bridge().intent.rescanFlow(bindingId, applicationId)),
    approveFlowInitialization: (initializationId, instrumentationPlanId) => perform(() => bridge().intent.approveFlowInitialization(initializationId, instrumentationPlanId)),
    applyFlowInitialization: (initializationId, patchSetId) => perform(() => bridge().intent.applyFlowInitialization(initializationId, patchSetId)),
    validateFlowInitialization: (initializationId, input) => perform(() => bridge().intent.validateFlowInitialization(initializationId, input)),
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
    pauseRun, perform, refreshApplications, refreshRuns, reopenSignIn, runs, session, signIn, signOut, startRun, workspaces, cloneWorkspace,
    branchCompliance, refreshBranchCompliance, setBranchAgentCheckout, grantQaBranchCheckout, switchToQaBranch, restoreWorkspaceBranch,
    avatarDataUri, organizations, refreshOrganizations, createApplication, repositoryMismatch,
  ]);

  return <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>;
}

export function useDesktop() {
  const value = useContext(DesktopContext);
  if (!value) throw new Error('useDesktop must be used inside DesktopProvider');
  return value;
}

export function normalizeDesktopError(cause: unknown): string {
  const raw = cause instanceof Error
    ? cause.message
    : typeof cause === 'string'
      ? cause
      : 'Desktop operation failed';
  if ((cause as { status?: number })?.status === 429 || /rate limit/i.test(raw)) {
    return raw.includes('temporarily limiting')
      ? raw
      : 'Tellann is temporarily limiting new requests. Cached project data remains available and the app will recover automatically.';
  }
  if (/DESKTOP_AUTH_REQUEST_EXPIRED/.test(raw)) {
    return 'The sign-in request expired. Try again to open a new secure browser session.';
  }
  if (/AUTHENTICATION_REQUIRED/.test(raw)) {
    return 'Your Tellann Desktop session has expired or is not authenticated. Please sign in to reconnect.';
  }
  if (/DESKTOP_AUTH_NOT_PENDING/.test(raw)) {
    return 'That sign-in request is no longer active. Cancel it and try again.';
  }
  if (/STALE_TARGET_FILE:/.test(raw)) {
    const file = raw.split('STALE_TARGET_FILE:')[1]?.trim().split(/[\s'"]/)[0] || 'A project file';
    return `${file} changed on disk after this setup task was created, so Tellann stopped before writing anything to avoid overwriting your own edits. Open the project’s Instrumentation page, run “Detect framework” again to build a fresh task from the current files, then approve and apply that new task.`;
  }
  if (/STALE_INSTRUMENTATION_BASE_REVISION|STALE_INSTRUMENTATION_PLAN|STALE_INSTRUMENTATION/.test(raw)) {
    return 'The project changed (a new commit, or edited or installed dependencies) after this setup task was created, so it can no longer be applied safely. Run “Detect framework” again on the Instrumentation page to create a fresh task, then approve and apply it.';
  }
  if (/INVALID_TASK_APPROVAL|TASK_SCOPE_EXPANSION_DENIED|APPROVED_SCOPE_OUTSIDE_PLAN/.test(raw)) {
    return 'This setup task’s approved scope no longer matches what Tellann can verify. Create a fresh task from the Instrumentation page and approve every listed file again before applying.';
  }
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '');
}
