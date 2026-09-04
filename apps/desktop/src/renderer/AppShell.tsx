import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Activity, BookOpenText, ChevronRight, Folder, LogOut, PanelLeft, PanelLeftClose,
  PanelLeftOpen, Settings, ShieldCheck,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { desktopNavigation } from './navigation';
import { useDesktop } from './desktop-context';
import { SelectField } from './components/ui/select';
import { NotificationToaster } from './components/notification-toaster';
import { UploadConsentModal } from './components/upload-consent-modal';

type SidebarMode = 'full' | 'icon' | 'closed';

const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 420;

function equivalentProjectRoute(pathname: string, projectId: string) {
  const match = pathname.match(/^\/applications\/[^/]+(\/.*)?$/);
  return match ? `/applications/${projectId}${match[1] ?? ''}` : `/applications/${projectId}`;
}

function storedSidebarMode(): SidebarMode {
  const value = localStorage.getItem('tellann:sidebar-mode');
  return value === 'icon' || value === 'closed' ? value : 'full';
}

function storedSidebarWidth() {
  const stored = localStorage.getItem('tellann:sidebar-width');
  if (stored === null) return DEFAULT_SIDEBAR_WIDTH;
  const value = Number(stored);
  return Number.isFinite(value) ? Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value)) : DEFAULT_SIDEBAR_WIDTH;
}

export function AppShell() {
  const location = useLocation();
  // `/applications/new` is the create wizard, not an application id. Reading
  // `new` as one makes the "unknown application" guard below bounce straight
  // to the first existing application, so the wizard never renders.
  const routeSegment = location.pathname.match(/^\/applications\/([^/]+)/)?.[1];
  const projectId = routeSegment === 'new' ? undefined : routeSegment;
  const navigate = useNavigate();
  const {
    applications, workspaces, activeRun, busy, cloudAvailable, error, session, avatarDataUri, signOut,
    refreshApplications, clearError,
  } = useDesktop();
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(storedSidebarMode);
  const [sidebarWidth, setSidebarWidth] = useState(storedSidebarWidth);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const application = applications.find((item) => item.id === projectId);
  const workspace = projectId ? workspaces[projectId] : undefined;
  const environmentId = projectId ? localStorage.getItem(`tellann:environment:${projectId}`) ?? '' : '';
  const environment = application?.environments.find((item) => item.id === environmentId)
    ?? application?.environments[0];
  const userName = session?.user?.displayName?.trim() || session?.user?.email.split('@')[0] || 'Tellann user';
  const userEmail = session?.user?.email ?? '';
  const initials = userName.slice(0, 2).toUpperCase();
  const avatarNode = avatarDataUri
    ? <img className="profile-avatar" src={avatarDataUri} alt={userName} />
    : <span className="profile-avatar">{initials}</span>;
  const effectiveSidebarWidth = sidebarMode === 'closed' ? 0 : sidebarMode === 'icon' ? 68 : sidebarWidth;

  useEffect(() => {
    if (!projectId || application || !session?.authenticated || !cloudAvailable) return;
    const fallback = applications[0]?.id;
    if (fallback) {
      localStorage.setItem('tellann:last-project', fallback);
      navigate(equivalentProjectRoute(location.pathname, fallback), { replace: true });
    } else {
      localStorage.removeItem('tellann:last-project');
      navigate('/applications', { replace: true });
    }
  }, [application, applications, cloudAvailable, location.pathname, navigate, projectId, session?.authenticated]);

  // Clicking a native OS notification (or a toast's View action) asks the main
  // process to focus this window and hand over the notification's deep link.
  // Desktop and the web dashboard share the `/applications/:id` shape, so the
  // same link resolves on either surface.
  useEffect(() => {
    if (!window.tellann?.notifications?.onOpenDeepLink) return;
    return window.tellann.notifications.onOpenDeepLink(({ deepLink }) => {
      if (typeof deepLink === 'string' && deepLink.startsWith('/')) navigate(deepLink);
    });
  }, [navigate]);

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (!signOutOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSignOutOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [signOutOpen]);

  const changeProject = (nextProjectId: string) => {
    localStorage.setItem('tellann:last-project', nextProjectId);
    navigate(equivalentProjectRoute(location.pathname, nextProjectId));
  };

  const setMode = (mode: SidebarMode) => {
    setSidebarMode(mode);
    localStorage.setItem('tellann:sidebar-mode', mode);
    setProfileOpen(false);
  };

  const cycleSidebar = () => {
    setMode(sidebarMode === 'full' ? 'icon' : sidebarMode === 'icon' ? 'closed' : 'full');
  };

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (sidebarMode !== 'full') return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const onMove = (moveEvent: PointerEvent) => {
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, startWidth + moveEvent.clientX - startX)));
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.classList.remove('sidebar-resizing');
      setSidebarWidth((current) => {
        localStorage.setItem('tellann:sidebar-width', String(current));
        return current;
      });
    };
    document.body.classList.add('sidebar-resizing');
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const confirmSignOut = async () => {
    setSignOutOpen(false);
    await signOut();
  };

  const sidebarToggleLabel = sidebarMode === 'full'
    ? 'Use icon-only sidebar'
    : sidebarMode === 'icon'
      ? 'Close sidebar'
      : 'Open full sidebar';

  return (
    <div
      className="app-shell routed-shell"
      data-sidebar-mode={sidebarMode}
      style={{ '--sidebar-width': `${effectiveSidebarWidth}px` } as CSSProperties}
    >
      <header className="topbar">
        <button className="sidebar-toggle" type="button" onClick={cycleSidebar} title={sidebarToggleLabel} aria-label={sidebarToggleLabel}>
          {sidebarMode === 'full' ? <PanelLeftClose size={17} /> : sidebarMode === 'icon' ? <PanelLeftOpen size={17} /> : <PanelLeft size={17} />}
        </button>
        <Link className="brand" to="/applications">Tellann</Link>
        <SelectField
          ariaLabel="Active application"
          value={application?.id ?? ''}
          onValueChange={changeProject}
          options={applications.map((item) => ({ value: item.id, label: `${item.organizationName} / ${item.name}` }))}
          placeholder="Select application"
          className="topbar-select project-select"
        />
        {application && application.environments.length > 1 ? (
          <SelectField
            ariaLabel="Active environment"
            value={environment?.id ?? ''}
            onValueChange={(value) => {
              if (!projectId) return;
              localStorage.setItem(`tellann:environment:${projectId}`, value);
              navigate(location.pathname, { replace: true });
            }}
            options={application.environments.map((item) => ({ value: item.id, label: `${item.name} (${item.type})` }))}
            placeholder="Select environment"
            className="topbar-select environment-select"
          />
        ) : null}
        <span className="environment">{environment?.type ?? 'NO APPLICATION'}</span>
        <div className="topbar-spacer" />
      </header>

      {sidebarMode !== 'closed' ? (
        <aside className="sidebar" aria-label="Desktop sidebar">
          <nav aria-label="Primary navigation">
            {desktopNavigation.map(({ id, label, icon: Icon, resolveHref, matches }) => (
              <NavLink
                key={id}
                to={resolveHref(projectId)}
                title={sidebarMode === 'icon' ? label : undefined}
                aria-label={label}
                className={matches(location.pathname, projectId) ? 'nav-active' : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-statuses">
            <Link className="sidebar-status" title={sidebarMode === 'icon' ? `Workspace: ${workspace ? 'Analyzed' : 'Not analyzed'}` : undefined} to={projectId ? `/applications/${projectId}/workspace` : '/applications'}>
              <Folder className="sidebar-status-icon" size={18} />
              <span>Workspace</span>
              <strong>{workspace ? 'Analyzed' : 'Not analyzed'}</strong>
              <small>{workspace
                ? `${workspace.snapshot.frameworks[0]?.framework ?? 'Web'} · ${workspace.snapshot.branch ?? 'no branch'}`
                : 'Open workspace setup'}</small>
            </Link>
            <Link
              className="sidebar-status"
              title={sidebarMode === 'icon' ? `Run status: ${activeRun?.status ?? 'Ready'}` : undefined}
              to={projectId
                ? activeRun
                  ? `/applications/${projectId}/qa-runs/${activeRun.runId}/live`
                  : `/applications/${projectId}/qa-runs`
                : '/applications?next=qa-runs'}
            >
              <Activity className="sidebar-status-icon" size={18} />
              <span>Run status</span>
              <strong>{activeRun?.status ?? 'Ready'}</strong>
              <small>{activeRun ? activeRun.runId.slice(0, 8) : 'No active run'}</small>
            </Link>
          </div>

          <div className="sidebar-profile" ref={profileRef}>
            {profileOpen ? (
              <div className="profile-popover" role="menu" aria-label="Profile menu">
                <button className="profile-summary" type="button" onClick={() => { setProfileOpen(false); void window.tellann?.system.openProfile(); }}>
                  {avatarNode}
                  <span className="profile-identity"><strong>{userName}</strong><small>{userEmail}</small></span>
                  <ChevronRight size={14} />
                </button>
                <div className="profile-menu-items">
                  <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); void window.tellann?.system.openProfile(); }}><Settings size={16} /><span>Profile settings</span></button>
                  <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); void window.tellann?.system.openExternal('https://docs.tellann.co'); }}><BookOpenText size={16} /><span>Documentation</span></button>
                  <button className="profile-signout" type="button" role="menuitem" onClick={() => { setProfileOpen(false); setSignOutOpen(true); }}><LogOut size={16} /><span>Sign out</span></button>
                </div>
              </div>
            ) : null}
            <button
              className="profile-trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              title={sidebarMode === 'icon' ? userName : undefined}
              onClick={() => setProfileOpen((current) => !current)}
            >
              {avatarNode}
              <span className="profile-trigger-name">{userName}</span>
            </button>
          </div>

          {sidebarMode === 'full' ? <div className="sidebar-resize-handle" role="separator" aria-label="Resize sidebar" aria-orientation="vertical" onPointerDown={beginResize} /> : null}
        </aside>
      ) : null}

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
              {!cloudAvailable ? <button onClick={() => void refreshApplications().catch(() => undefined)}>Retry</button> : null}
              <button onClick={clearError}>Dismiss</button>
            </div>
          </div>
        ) : null}
        <Outlet />
      </main>

      <NotificationToaster />
      <UploadConsentModal />

      <footer className="global-statusbar" aria-live="polite">
        <div><Activity size={16} /><span>{activeRun ? `Run ${activeRun.status.toLowerCase()}` : 'Ready for a guided run'}</span></div>
        <div>{busy ? 'Working…' : cloudAvailable ? 'Cloud connected' : 'Cloud offline'}</div>
        <div><Folder size={16} /><span>{workspace?.name ?? 'No local folder attached'}</span></div>
      </footer>

      {signOutOpen ? (
        <div className="desktop-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSignOutOpen(false); }}>
          <div className="desktop-modal" role="dialog" aria-modal="true" aria-labelledby="signout-title">
            <div className="flex items-center justify-between mb-5">
              <span className="text-white text-[20px] font-extrabold tracking-tight">TELLANN</span>
              <span className="border border-[#444748] text-[#8e9192] px-2 py-1 text-[11px] font-mono tracking-[0.08em] uppercase">
                AUTH // SIGN OUT
              </span>
            </div>
            <h2 id="signout-title">Sign out of Tellann?</h2>
            <p className="mb-4">Are you sure you want to sign out? You will need to sign in again to access your workspace.</p>
            <table role="presentation" className="w-full border-collapse mb-6 bg-black border border-[#262626]">
              <tbody>
                <tr>
                  <td className="p-2.5 border-b border-[#262626] text-[#8e9192] font-mono text-[11px] tracking-[0.08em] uppercase">USER ACCOUNT</td>
                  <td className="p-2.5 border-b border-[#262626] text-white text-right font-mono text-[13px]">{userName}</td>
                </tr>
                {userEmail ? (
                  <tr>
                    <td className={`p-2.5 ${workspace?.name ? 'border-b border-[#262626]' : ''} text-[#8e9192] font-mono text-[11px] tracking-[0.08em] uppercase`}>ACCOUNT EMAIL</td>
                    <td className={`p-2.5 ${workspace?.name ? 'border-b border-[#262626]' : ''} text-white text-right font-mono text-[13px]`}>{userEmail}</td>
                  </tr>
                ) : null}
                {workspace?.name ? (
                  <tr>
                    <td className="p-2.5 text-[#8e9192] font-mono text-[11px] tracking-[0.08em] uppercase">ACTIVE WORKSPACE</td>
                    <td className="p-2.5 text-white text-right font-mono text-[13px]">{workspace.name}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="desktop-modal-actions">
              <button type="button" onClick={() => setSignOutOpen(false)} disabled={busy}>Cancel</button>
              <button className="confirm" type="button" onClick={() => void confirmSignOut()} disabled={busy}>{busy ? 'Signing out…' : 'Confirm sign out'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
