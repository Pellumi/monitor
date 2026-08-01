import { Activity, Folder, LogOut, ShieldCheck } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { desktopNavigation } from './navigation';
import { useDesktop } from './desktop-context';

function equivalentProjectRoute(pathname: string, projectId: string) {
  const match = pathname.match(/^\/projects\/[^/]+(\/.*)?$/);
  return match ? `/projects/${projectId}${match[1] ?? ''}` : `/projects/${projectId}`;
}

export function AppShell() {
  const location = useLocation();
  const projectId = location.pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const navigate = useNavigate();
  const {
    applications, workspaces, activeRun, busy, cloudAvailable, error, session, signOut,
    refreshApplications, clearError,
  } = useDesktop();
  const application = applications.find((item) => item.id === projectId);
  const workspace = projectId ? workspaces[projectId] : undefined;
  const environmentId = projectId ? localStorage.getItem(`tellann:environment:${projectId}`) ?? '' : '';
  const environment = application?.environments.find((item) => item.id === environmentId)
    ?? application?.environments[0];

  const changeProject = (nextProjectId: string) => {
    localStorage.setItem('tellann:last-project', nextProjectId);
    navigate(equivalentProjectRoute(location.pathname, nextProjectId));
  };

  return (
    <div className="app-shell routed-shell">
      <header className="topbar">
        <Link className="brand" to="/projects">Tellann</Link>
        <select
          aria-label="Active project"
          value={application?.id ?? ''}
          onChange={(event) => changeProject(event.target.value)}
        >
          <option value="" disabled>Select project</option>
          {applications.map((item) => (
            <option key={item.id} value={item.id}>{item.organizationName} / {item.name}</option>
          ))}
        </select>
        <select
          aria-label="Active environment"
          value={environment?.id ?? ''}
          disabled={!application}
          onChange={(event) => {
            if (!projectId) return;
            localStorage.setItem(`tellann:environment:${projectId}`, event.target.value);
            navigate(location.pathname, { replace: true });
          }}
        >
          {application?.environments.map((item) => (
            <option key={item.id} value={item.id}>{item.name} ({item.type})</option>
          ))}
        </select>
        <span className="environment">{environment?.type ?? 'NO PROJECT'}</span>
        <div className="topbar-spacer" />
        <div className="permission"><ShieldCheck size={16} /> Browser-only / read workspace</div>
        <button
          className="avatar"
          title="Open profile"
          aria-label="Open profile"
          onClick={() => void window.tellann?.system.openProfile()}
        >
          {(session?.user?.displayName ?? session?.user?.email ?? 'QA').slice(0, 2).toUpperCase()}
        </button>
        <button className="sign-out-button" title="Sign out" onClick={() => void signOut()} disabled={busy}>
          <LogOut size={15} /><span>Sign out</span>
        </button>
      </header>

      <aside className="sidebar">
        <nav aria-label="Primary navigation">
          {desktopNavigation.map(({ id, label, icon: Icon, resolveHref, matches }) => (
            <NavLink
              key={id}
              to={resolveHref(projectId)}
              className={matches(location.pathname, projectId) ? 'nav-active' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-statuses">
          <Link className="sidebar-status" to={projectId ? `/projects/${projectId}/workspace` : '/projects'}>
            <span>Workspace</span>
            <strong>{workspace ? 'Analyzed' : 'Not analyzed'}</strong>
            <small>{workspace
              ? `${workspace.snapshot.frameworks[0]?.framework ?? 'Web'} · ${workspace.snapshot.branch ?? 'no branch'}`
              : 'Open workspace setup'}</small>
          </Link>
          <Link
            className="sidebar-status"
            to={projectId
              ? activeRun
                ? `/projects/${projectId}/qa-runs/${activeRun.runId}/live`
                : `/projects/${projectId}/qa-runs`
              : '/projects?next=qa-runs'}
          >
            <span>Run status</span>
            <strong>{activeRun?.status ?? 'Ready'}</strong>
            <small>{activeRun ? activeRun.runId.slice(0, 8) : 'No active run'}</small>
          </Link>
        </div>
      </aside>

      <main className="route-workspace">
        {environment?.type === 'PRODUCTION' ? (
          <div className="policy-banner" role="status">
            <ShieldCheck size={16} />
            Production is observation-only. Launch, instrumentation, automated interaction, and form submission are blocked.
          </div>
        ) : null}
        {error ? (
          <div className="global-error" role="alert">
            <span>{error}</span>
            <div className="error-actions">
              {!cloudAvailable ? (
                <button onClick={() => void refreshApplications().catch(() => undefined)}>Retry</button>
              ) : null}
              <button onClick={clearError}>Dismiss</button>
            </div>
          </div>
        ) : null}
        <Outlet />
      </main>

      <footer className="global-statusbar" aria-live="polite">
        <div><Activity size={16} /><span>{activeRun ? `Run ${activeRun.status.toLowerCase()}` : 'Ready for a guided run'}</span></div>
        <div>{busy ? 'Working…' : cloudAvailable ? 'Cloud connected' : 'Cloud offline'}</div>
        <div><Folder size={16} /><span>{workspace?.name ?? 'No local folder attached'}</span></div>
      </footer>
    </div>
  );
}
