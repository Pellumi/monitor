import { KeyRound, ShieldCheck } from 'lucide-react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DesktopProvider, useDesktop } from './desktop-context';
import {
  ActivityPage,
  EnvironmentsPage,
  InstrumentationDetailPage,
  InstrumentationPage,
  IntentDetailPage,
  IntentPage,
  LiveRunPage,
  NewProjectPage,
  NewRunPage,
  NotFoundPage,
  ProjectOverviewPage,
  ProjectsPage,
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

function AuthenticatedApp() {
  const { bridgeAvailable, loading, busy, error, session, signIn } = useDesktop();
  if (loading) return <div className="auth-shell"><div className="loading-state">Loading Tellann Desktop…</div></div>;
  if (!session?.authenticated) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-card-icon"><ShieldCheck size={28} /></div>
          <h1>{bridgeAvailable ? 'Connect Tellann Desktop' : 'Open Tellann in the desktop app'}</h1>
          <p>{bridgeAvailable
            ? 'Sign in securely in your system browser. Raw source remains local and your device credential is protected by Windows.'
            : 'This URL is only the renderer preview. Authentication, project access, and managed-browser controls are provided by Electron.'}</p>
          <button className="primary-btn" onClick={() => void signIn()} disabled={busy || !bridgeAvailable}><KeyRound size={18} />Sign in to Tellann</button>
          {!bridgeAvailable ? <div className="context-banner">Run <code>npx pnpm --filter @sots/desktop dev</code> and use the Electron window.</div> : null}
          {error ? <div className="global-error">{error}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<RootResolver />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/new" element={<NewProjectPage />} />
          <Route path="projects/:projectId" element={<ProjectOverviewPage />} />
          <Route path="projects/:projectId/workspace" element={<WorkspacePage />} />
          <Route path="projects/:projectId/sources" element={<SourcesPage />} />
          <Route path="projects/:projectId/environments" element={<EnvironmentsPage />} />
          <Route path="projects/:projectId/activity" element={<ActivityPage />} />

          <Route path="projects/:projectId/intent" element={<IntentPage />} />
          <Route path="projects/:projectId/intent/drafts/:draftId" element={<IntentDetailPage />} />
          <Route path="projects/:projectId/intent/versions" element={<IntentDetailPage />} />
          <Route path="projects/:projectId/intent/versions/:versionId" element={<IntentDetailPage />} />
          <Route path="projects/:projectId/intent/compare" element={<IntentDetailPage />} />
          <Route path="projects/:projectId/intent/editor" element={<IntentDetailPage />} />

          <Route path="projects/:projectId/instrumentation" element={<InstrumentationPage />} />
          <Route path="projects/:projectId/instrumentation/plans/:planId" element={<InstrumentationDetailPage />} />
          <Route path="projects/:projectId/instrumentation/plans/:planId/diff" element={<InstrumentationDetailPage />} />
          <Route path="projects/:projectId/instrumentation/plans/:planId/validation" element={<InstrumentationDetailPage />} />
          <Route path="projects/:projectId/instrumentation/history" element={<InstrumentationDetailPage />} />
          <Route path="projects/:projectId/instrumentation/manifests/:manifestId" element={<InstrumentationDetailPage />} />

          <Route path="projects/:projectId/qa-runs" element={<RunsPage />} />
          <Route path="projects/:projectId/qa-runs/new" element={<NewRunPage />} />
          <Route path="projects/:projectId/qa-runs/:runId" element={<RunDetailPage />} />
          <Route path="projects/:projectId/qa-runs/:runId/live" element={<LiveRunPage />} />
          {['evidence', 'findings', 'replay', 'graph', 'reconciliation', 'artifacts'].map((kind) => (
            <Route key={kind} path={`projects/:projectId/qa-runs/:runId/${kind}`} element={<RunSubPage kind={kind} />} />
          ))}

          <Route path="projects/:projectId/reports" element={<ReportsPage />} />
          <Route path="projects/:projectId/reports/compare" element={<ReportAuxPage kind="compare" />} />
          <Route path="projects/:projectId/reports/:reportId" element={<ReportDetailPage />} />
          <Route path="projects/:projectId/reports/:reportId/export" element={<ReportAuxPage kind="export" />} />

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

export function App() {
  return <DesktopProvider><AuthenticatedApp /></DesktopProvider>;
}
