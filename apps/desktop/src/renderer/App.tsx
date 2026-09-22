import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import type { RunLifecycleEvent } from '@tellann/desktop-contracts';
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DesktopProvider, useDesktop } from './desktop-context';
import { ThemedLogo } from './components/themed-logo';
import {
  ActivityPage,
  DeclaredFlowPage,
  EnvironmentsPage,
  InstrumentationDetailPage,
  InstrumentationPage,
  IntentDetailPage,
  IntentPage,
  LiveRunPage,
  NewApplicationPage,
  NewRunPage,
  NotFoundPage,
  ApplicationOverviewPage,
  ApplicationsPage,
  ReportAuxPage,
  ReportDetailPage,
  ReportsPage,
  RootResolver,
  RouteResolver,
  RunDetailPage,
  RunsPage,
  RunSubPage,
  SourcesPage,
  WorkspacePage,
} from './pages';

/** Standalone window content (sign-in, recovery, splash) with its own drag strip. */
function StandaloneWindow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`auth-shell ${className}`}>
      <div className="auth-titlebar">
        <ThemedLogo className="titlebar-icon" />
        <span>Tellann</span>
      </div>
      {children}
    </div>
  );
}

function AppVersion() {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    void window.tellann?.system.getVersion().then(setVersion).catch(() => undefined);
  }, []);
  return <footer className="auth-footer">Tellann Desktop{version ? ` ${version}` : ''}</footer>;
}

function secureStorageLabel() {
  const platform = document.documentElement.dataset.platform;
  if (platform === 'win32') return 'Windows';
  if (platform === 'darwin') return 'macOS';
  if (platform === 'linux') return 'your Linux keyring';
  return 'your operating system';
}

class RendererErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Tellann renderer failed to render', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <StandaloneWindow>
        <div className="auth-card" role="alert">
          <TriangleAlert className="auth-logo" size={40} color="var(--warning)" />
          <h1>This view could not be displayed</h1>
          <p>{this.state.error.message || 'An unexpected renderer error occurred.'}</p>
          <div className="auth-actions">
            <button className="button primary" type="button" onClick={() => window.location.reload()}>
              Reload Tellann
            </button>
            <button
              className="button"
              type="button"
              onClick={() => {
                window.location.hash = '/applications';
                window.location.reload();
              }}
            >
              Return to applications
            </button>
          </div>
        </div>
      </StandaloneWindow>
    );
  }
}

function AuthenticatedApp() {
  const { bridgeAvailable, loading, busy, authPending, error, session, signIn, reopenSignIn } = useDesktop();

  // Signed out, the window shrinks to a compact sign-in window; signed in, it
  // returns to the size and position the user last left it at.
  useEffect(() => {
    if (loading || !window.tellann?.window) return;
    void window.tellann.window.setMode(session?.authenticated ? 'main' : 'auth').catch(() => undefined);
  }, [loading, session?.authenticated]);

  if (loading) {
    return (
      <StandaloneWindow className="app-splash">
        <div className="splash-body" role="status" aria-label="Loading Tellann">
          <ThemedLogo className="splash-logo" />
          <div className="splash-progress" />
        </div>
      </StandaloneWindow>
    );
  }

  if (!session?.authenticated) {
    return (
      <StandaloneWindow>
        <div className="auth-card">
          <ThemedLogo className="auth-logo" />
          <h1>{bridgeAvailable ? 'Sign in to Tellann' : 'Open Tellann in the desktop app'}</h1>
          <p>
            {bridgeAvailable
              ? `Sign-in opens in your browser. Source code stays on this device, and your device credential is protected by ${secureStorageLabel()}.`
              : 'This URL is only the renderer preview. Authentication, application access, and managed-browser controls are provided by Electron.'}
          </p>

          {authPending ? (
            <div className="auth-pending" role="status" aria-live="polite">
              <LoaderCircle className="spin" size={16} />
              <div>
                <strong>Waiting for your browser</strong>
                <span>Finish signing in there. If you closed the page, open it again or start over.</span>
              </div>
            </div>
          ) : null}

          <div className="auth-actions">
            {authPending ? (
              <>
                <button className="button primary" type="button" onClick={() => void reopenSignIn()}>
                  Open browser again
                </button>
                <button className="button" type="button" onClick={() => void signIn()}>
                  Start over
                </button>
              </>
            ) : (
              <button className="button primary" type="button" onClick={() => void signIn()} disabled={busy || !bridgeAvailable}>
                Sign in with browser
              </button>
            )}
          </div>

          {error ? (
            <div className="infobar" data-tone="danger" role="alert">
              <TriangleAlert size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          <AppVersion />
        </div>
      </StandaloneWindow>
    );
  }

  return (
    <HashRouter>
      <SetupHandoffResolver />
      <RunLifecycleResolver />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<RootResolver />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="applications/new" element={<NewApplicationPage />} />
          <Route path="applications/:projectId" element={<ApplicationOverviewPage />} />
          <Route path="applications/:projectId/workspace" element={<WorkspacePage />} />
          <Route path="applications/:projectId/sources" element={<SourcesPage />} />
          <Route path="applications/:projectId/environments" element={<EnvironmentsPage />} />
          <Route path="applications/:projectId/activity" element={<ActivityPage />} />

          <Route path="applications/:projectId/intent" element={<IntentPage />} />
          <Route path="applications/:projectId/intent/flows/:flowId" element={<DeclaredFlowPage />} />
          <Route path="applications/:projectId/intent/drafts/:draftId" element={<IntentDetailPage />} />
          <Route path="applications/:projectId/intent/versions" element={<IntentDetailPage />} />
          <Route path="applications/:projectId/intent/versions/:versionId" element={<IntentDetailPage />} />
          <Route path="applications/:projectId/intent/compare" element={<IntentDetailPage />} />
          <Route path="applications/:projectId/intent/editor" element={<IntentDetailPage />} />

          <Route path="applications/:projectId/instrumentation" element={<InstrumentationPage />} />
          <Route path="applications/:projectId/instrumentation/plans/:planId" element={<InstrumentationDetailPage />} />
          <Route path="applications/:projectId/instrumentation/plans/:planId/diff" element={<InstrumentationDetailPage />} />
          <Route path="applications/:projectId/instrumentation/plans/:planId/validation" element={<InstrumentationDetailPage />} />
          <Route path="applications/:projectId/instrumentation/history" element={<InstrumentationDetailPage />} />
          <Route path="applications/:projectId/instrumentation/manifests/:manifestId" element={<InstrumentationDetailPage />} />

          <Route path="applications/:projectId/qa-runs" element={<RunsPage />} />
          <Route path="applications/:projectId/qa-runs/new" element={<NewRunPage />} />
          <Route path="applications/:projectId/qa-runs/:runId" element={<RunDetailPage />} />
          <Route path="applications/:projectId/qa-runs/:runId/live" element={<LiveRunPage />} />
          {['evidence', 'findings', 'replay', 'graph', 'reconciliation', 'artifacts'].map((kind) => (
            <Route key={kind} path={`applications/:projectId/qa-runs/:runId/${kind}`} element={<RunSubPage kind={kind} />} />
          ))}

          <Route path="applications/:projectId/reports" element={<ReportsPage />} />
          <Route path="applications/:projectId/reports/compare" element={<ReportAuxPage kind="compare" />} />
          <Route path="applications/:projectId/reports/:reportId" element={<ReportDetailPage />} />
          <Route path="applications/:projectId/reports/:reportId/export" element={<ReportAuxPage kind="export" />} />

          <Route path="intent" element={<RouteResolver section="intent" />} />
          <Route path="instrumentation" element={<RouteResolver section="instrumentation" />} />
          <Route path="qa-runs" element={<RouteResolver section="qa-runs" />} />
          <Route path="reports" element={<RouteResolver section="reports" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

function RunLifecycleResolver() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState<RunLifecycleEvent | null>(null);
  useEffect(() => {
    if (!window.tellann?.runs.onLifecycleEvent) return;
    return window.tellann.runs.onLifecycleEvent((event) => {
      if (event.localStatus !== 'CHROMIUM_CLOSED') return;
      setNotice(event);
      navigate(`/applications/${event.applicationId}/qa-runs/${event.runId}`, { replace: true });
      window.setTimeout(() => setNotice((current) => current?.runId === event.runId ? null : current), 8_000);
    });
  }, [navigate]);
  if (!notice) return null;
  const terminal = notice.completionReason === 'TERMINAL_STATE_REACHED';
  // A backend run never opened a browser, so saying Chromium closed would be
  // describing something that did not happen.
  const closed = notice.captureTracks && !notice.captureTracks.includes('FRONTEND')
    ? 'Capture stopped'
    : 'Chromium was closed';
  return (
    <div className="run-lifecycle-toast" role="status" aria-live="polite">
      <strong>{terminal ? 'Terminal state reached' : 'QA run ended'}</strong>
      <span>
        {terminal
          ? `${closed} and your QA report is being prepared.`
          : notice.completionReason === 'MANUAL_STOP_BEFORE_INITIAL'
            ? `${closed}. The initial Flow boundary was not reached, so the report will be incomplete.`
            : `${closed} before a terminal state. The available in-Flow evidence is being prepared.`}
      </span>
      {notice.safeError ? <small>{notice.safeError}</small> : null}
    </div>
  );
}

function SetupHandoffResolver() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    void window.tellann?.setup.claimHandoff().then((handoff) => {
      if (cancelled || !handoff) return;
      const applicationId = String(handoff.applicationId ?? '');
      const environmentId = String(handoff.environmentId ?? '');
      const handoffId = String(handoff.id ?? '');
      if (!applicationId || !environmentId) return;
      navigate(`/applications/${applicationId}/instrumentation?setup=connect&environmentId=${encodeURIComponent(environmentId)}&handoffId=${encodeURIComponent(handoffId)}`);
      if (handoffId) void window.tellann?.setup.consumeHandoff(handoffId).catch(() => undefined);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [navigate]);
  return null;
}

export function App() {
  return (
    <RendererErrorBoundary>
      <DesktopProvider><AuthenticatedApp /></DesktopProvider>
    </RendererErrorBoundary>
  );
}
