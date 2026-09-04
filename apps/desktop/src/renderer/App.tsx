import { KeyRound, ShieldCheck } from 'lucide-react';
import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DesktopProvider, useDesktop } from './desktop-context';
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
      <div className="auth-shell">
        <div className="auth-card" role="alert">
          <div className="auth-card-header">
            <span className="brand-logo">TELLANN</span>
            <span className="badge">Page recovery</span>
          </div>
          <h1>This page could not be displayed</h1>
          <p>{this.state.error.message || 'An unexpected renderer error occurred.'}</p>
          <div className="actions-row">
            <button className="primary-btn" onClick={() => window.location.reload()}>
              Reload Tellann
            </button>
            <button
              className="secondary-btn"
              onClick={() => {
                window.location.hash = '/applications';
                window.location.reload();
              }}
            >
              Return to applications
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function AuthenticatedApp() {
  const { bridgeAvailable, loading, busy, authPending, error, session, signIn, reopenSignIn } = useDesktop();
  if (loading) return <div className="auth-shell"><div className="loading-state">Loading Tellann Desktop…</div></div>;
  if (!session?.authenticated) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-card-header">
            <span className="brand-logo">TELLANN</span>
            <span className="badge">Auth // Desktop</span>
          </div>

          <h1>{bridgeAvailable ? 'Connect Tellann Desktop' : 'Open Tellann in the desktop app'}</h1>
          <p>
            {bridgeAvailable
              ? 'Sign in securely in your system browser. Raw source remains local and your device credential is protected by Windows.'
              : 'This URL is only the renderer preview. Authentication, application access, and managed-browser controls are provided by Electron.'}
          </p>

          <table className="auth-meta-table">
            <tbody>
              <tr>
                <td className="meta-label">ENVIRONMENT</td>
                <td className="meta-value">Desktop Application</td>
              </tr>
              <tr>
                <td className="meta-label">AUTHENTICATION</td>
                <td className="meta-value">System Browser OAuth</td>
              </tr>
              {/* <tr>
                <td className="meta-label">SECURITY MODEL</td>
                <td className="meta-value">Windows Protected Credentials</td>
              </tr> */}
            </tbody>
          </table>

          {authPending ? (
            <div className="auth-pending mb-2" role="status" aria-live="polite">
              <strong>Waiting for authentication</strong>
              <span>Complete sign-in in your browser. If you closed the page, open it again or start over.</span>
            </div>
          ) : null}

          <div className="actions-row">
            {authPending ? (
              <>
                <button className="primary-btn" onClick={() => void reopenSignIn()}>
                  Open browser again
                </button>
                <button className="secondary-btn" onClick={() => void signIn()}>
                  Start over
                </button>
              </>
            ) : (
              <button className="primary-btn w-full!" onClick={() => void signIn()} disabled={busy || !bridgeAvailable}>
                {/* <KeyRound size={16} /> */}
                Sign in to Tellann
              </button>
            )}
          </div>

          {/* {!bridgeAvailable ? (
            <div className="context-banner">
              Run <code>npx pnpm --filter @tellann/desktop dev</code> and use the Electron window.
            </div>
          ) : null} */}
          {error ? <div className="global-error">{error}</div> : null}

          <div className="auth-card-footer text-center">
            Tellann Systems &middot; Desktop Service
            {/* <br />   */}
            {/* You received this prompt because of activity in Tellann Desktop. */}
          </div>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <SetupHandoffResolver />
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
