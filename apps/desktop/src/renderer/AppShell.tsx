import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  AppWindow, ArrowLeft, ArrowRight, BookOpenText, Cloud, CloudOff, Folder, FolderPlus, LoaderCircle, LogOut,
  PanelLeft, Play, Plus, RefreshCw, Search, Settings, ShieldCheck, TriangleAlert,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { desktopNavigation } from './navigation';
import { useDesktop } from './desktop-context';
import { SelectField } from './components/ui/select';
import { NotificationToaster } from './components/notification-toaster';
import { UploadConsentModal } from './components/upload-consent-modal';
import { RepositoryMismatchModal } from './components/repository-mismatch-modal';
import { CommandPalette, type PaletteItem } from './components/command-palette';
import { confirmAction, formatEnum, showMenu } from './components/desktop-ui';
import { ThemedLogo } from './components/themed-logo';

type SidebarMode = 'full' | 'icon' | 'closed';

const DEFAULT_SIDEBAR_WIDTH = 232;
const MIN_SIDEBAR_WIDTH = 196;
const MAX_SIDEBAR_WIDTH = 360;
const ICON_SIDEBAR_WIDTH = 52;

// The sections that exist identically under every application. Anything deeper
// than one of these is a record id owned by the application currently in the
// route (a run, a report, a flow, an instrumentation plan).
const PROJECT_SECTIONS = new Set([
  'workspace', 'sources', 'environments', 'activity',
  'intent', 'instrumentation', 'qa-runs', 'reports',
]);

// Switching applications keeps the section the user is in, but drops the
// record id below it: those ids are resolved by id alone, so carrying one over
// re-renders the previous application's record and the switch looks like it
// did nothing at all.
function equivalentProjectRoute(pathname: string, projectId: string) {
  const section = pathname.match(/^\/applications\/[^/]+\/([^/]+)/)?.[1];
  return section && PROJECT_SECTIONS.has(section)
    ? `/applications/${projectId}/${section}`
    : `/applications/${projectId}`;
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
  const navigationType = useNavigationType();
  // `/applications/new` is the create wizard, not an application id. Reading
  // `new` as one makes the "unknown application" guard below bounce straight
  // to the first existing application, so the wizard never renders.
  const routeSegment = location.pathname.match(/^\/applications\/([^/]+)/)?.[1];
  const projectId = routeSegment === 'new' ? undefined : routeSegment;
  const navigate = useNavigate();
  const {
    applications, workspaces, activeRun, busy, cloudAvailable, error, session, avatarDataUri, signOut,
    refreshApplications, refreshRuns, clearError, attachWorkspace,
  } = useDesktop();
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(storedSidebarMode);
  const [sidebarWidth, setSidebarWidth] = useState(storedSidebarWidth);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [historyBounds, setHistoryBounds] = useState({ index: 0, max: 0 });
  const [dropActive, setDropActive] = useState(false);
  const dragDepth = useRef(0);
  const application = applications.find((item) => item.id === projectId);
  const workspace = projectId ? workspaces[projectId] : undefined;
  const environmentId = projectId ? localStorage.getItem(`tellann:environment:${projectId}`) ?? '' : '';
  const environment = application?.environments.find((item) => item.id === environmentId)
    ?? application?.environments[0];
  const userName = session?.user?.displayName?.trim() || session?.user?.email.split('@')[0] || 'Tellann user';
  const userEmail = session?.user?.email ?? '';
  const initials = userName.slice(0, 2).toUpperCase();
  const avatarNode = avatarDataUri
    ? <img className="profile-avatar" src={avatarDataUri} alt="" />
    : <span className="profile-avatar" aria-hidden="true">{initials}</span>;
  const isLiveRunPage = Boolean(location.pathname.match(/^\/applications\/[^/]+\/qa-runs\/[^/]+\/live\/?$/));
  const activeSidebarMode = isLiveRunPage ? 'closed' : sidebarMode;
  const effectiveSidebarWidth = activeSidebarMode === 'closed' ? 0 : activeSidebarMode === 'icon' ? ICON_SIDEBAR_WIDTH : sidebarWidth;
  const lastProjectId = projectId ?? localStorage.getItem('tellann:last-project') ?? applications[0]?.id;

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

  // Back/forward availability, from the router's history index.
  useEffect(() => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    setHistoryBounds((current) => ({ index, max: navigationType === 'PUSH' ? index : Math.max(current.max, index) }));
  }, [location.key, navigationType]);

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

  // Inactive windows dim their chrome, as native Windows apps do.
  useEffect(() => {
    const bridge = window.tellann?.window;
    if (!bridge) return;
    const apply = (state: DesktopWindowState) => {
      document.documentElement.dataset.windowFocused = String(state.focused);
      document.documentElement.dataset.windowMaximized = String(state.maximized);
    };
    void bridge.getState().then(apply).catch(() => undefined);
    return bridge.onStateChange(apply);
  }, []);

  // Mouse back/forward buttons.
  useEffect(() => window.tellann?.window?.onNavigate((direction) => navigate(direction === 'back' ? -1 : 1)), [navigate]);

  const runWindowCommand = useCallback((command: DesktopWindowCommand) => {
    if (command === 'new-run' && lastProjectId) navigate(`/applications/${lastProjectId}/qa-runs/new`);
    else navigate('/applications');
  }, [lastProjectId, navigate]);

  // Jump list tasks.
  useEffect(() => {
    const bridge = window.tellann?.window;
    if (!bridge) return;
    void bridge.consumePendingCommand().then((command) => { if (command) runWindowCommand(command); }).catch(() => undefined);
    return bridge.onCommand(runWindowCommand);
  }, [runWindowCommand]);

  const changeProject = useCallback((nextProjectId: string) => {
    localStorage.setItem('tellann:last-project', nextProjectId);
    navigate(equivalentProjectRoute(location.pathname, nextProjectId));
  }, [location.pathname, navigate]);

  const setMode = useCallback((mode: SidebarMode) => {
    setSidebarMode(mode);
    localStorage.setItem('tellann:sidebar-mode', mode);
  }, []);

  const toggleSidebar = useCallback(() => {
    setMode(sidebarMode === 'full' ? 'icon' : 'full');
  }, [setMode, sidebarMode]);

  const refresh = useCallback(() => {
    void refreshApplications().catch(() => undefined);
    if (projectId) void refreshRuns(projectId).catch(() => undefined);
    window.dispatchEvent(new CustomEvent('tellann:refresh'));
  }, [projectId, refreshApplications, refreshRuns]);

  const requestSignOut = useCallback(async () => {
    const confirmed = await confirmAction({
      title: 'Sign out',
      message: 'Sign out of Tellann?',
      detail: [
        userEmail ? `Signed in as ${userEmail}.` : '',
        'You will need to sign in again to access your applications. Local workspace folders are not changed.',
      ].filter(Boolean).join('\n\n'),
      confirmLabel: 'Sign out',
      danger: true,
    });
    if (confirmed) await signOut();
  }, [signOut, userEmail]);

  const openProfileMenu = async (event: MouseEvent) => {
    const choice = await showMenu(event, [
      { id: 'profile', label: 'Profile settings', accelerator: 'Ctrl+,' },
      { id: 'docs', label: 'Documentation' },
      { type: 'separator' },
      { id: 'sign-out', label: 'Sign out…' },
    ]);
    if (choice === 'profile') void window.tellann?.system.openProfile();
    if (choice === 'docs') void window.tellann?.system.openExternal('https://docs.tellann.co');
    if (choice === 'sign-out') void requestSignOut();
  };

  const openSidebarMenu = async (event: MouseEvent) => {
    const choice = await showMenu(event, [
      { id: 'full', label: 'Show labels', enabled: sidebarMode !== 'full' },
      { id: 'icon', label: 'Icons only', enabled: sidebarMode !== 'icon' },
      { id: 'closed', label: 'Hide sidebar' },
    ]);
    if (choice === 'full' || choice === 'icon' || choice === 'closed') setMode(choice);
  };

  // Keyboard shortcuts. Native menus are hidden, so the window handles them.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (event.altKey && !mod && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        navigate(event.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (event.key === 'F5' || (mod && key === 'r' && !event.shiftKey)) {
        event.preventDefault();
        refresh();
        return;
      }
      if (!mod || event.altKey) return;
      if (key === 'k' || (key === 'p' && event.shiftKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (key === 'b') {
        event.preventDefault();
        if (!isLiveRunPage) {
          toggleSidebar();
        }
      } else if (key === ',') {
        event.preventDefault();
        void window.tellann?.system.openProfile();
      } else if (key === 'n') {
        event.preventDefault();
        navigate(projectId ? `/applications/${projectId}/qa-runs/new` : '/applications/new');
      } else if (/^[1-9]$/.test(key)) {
        const item = desktopNavigation[Number(key) - 1];
        if (!item) return;
        event.preventDefault();
        navigate(item.resolveHref(projectId));
      } else if (key === 'f') {
        const input = document.querySelector<HTMLInputElement>('[data-search-input]');
        if (!input) return;
        event.preventDefault();
        input.focus();
        input.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, projectId, refresh, toggleSidebar, isLiveRunPage]);

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activeSidebarMode !== 'full') return;
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

  // Dropping a project folder onto the window attaches it to the open application.
  const draggingFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');
  const dropHandlers = {
    onDragEnter: (event: DragEvent) => {
      if (!draggingFiles(event)) return;
      dragDepth.current += 1;
      setDropActive(true);
    },
    onDragOver: (event: DragEvent) => {
      if (!draggingFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = projectId ? 'link' : 'none';
    },
    onDragLeave: (event: DragEvent) => {
      if (!draggingFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDropActive(false);
    },
    onDrop: (event: DragEvent) => {
      if (!draggingFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDropActive(false);
      const entry = event.dataTransfer.items[0]?.webkitGetAsEntry?.();
      const file = event.dataTransfer.files[0];
      if (!projectId || !file || !entry?.isDirectory || !window.tellann?.system.getPathForFile) return;
      const folderPath = window.tellann.system.getPathForFile(file);
      if (folderPath) void attachWorkspace(projectId, { path: folderPath, name: entry.name }).catch(() => undefined);
    },
  };

  const paletteItems = useMemo<PaletteItem[]>(() => [
    ...desktopNavigation.map((item, index) => ({
      id: `nav-${item.id}`,
      group: 'Go to',
      label: item.label,
      icon: item.icon,
      shortcut: `Ctrl+${index + 1}`,
      run: () => navigate(item.resolveHref(projectId)),
    })),
    ...applications.map((item) => ({
      id: `app-${item.id}`,
      group: 'Applications',
      label: item.name,
      icon: AppWindow,
      keywords: item.organizationName,
      run: () => changeProject(item.id),
    })),
    { id: 'new-run', group: 'Commands', label: 'New QA run', icon: Play, shortcut: 'Ctrl+N', disabled: !projectId, run: () => navigate(`/applications/${projectId}/qa-runs/new`) },
    { id: 'new-app', group: 'Commands', label: 'Create application', icon: Plus, run: () => navigate('/applications/new') },
    { id: 'attach', group: 'Commands', label: 'Attach project folder…', icon: FolderPlus, disabled: !projectId, run: () => { if (projectId) void attachWorkspace(projectId).catch(() => undefined); } },
    { id: 'refresh', group: 'Commands', label: 'Refresh', icon: RefreshCw, shortcut: 'F5', run: refresh },
    { id: 'sidebar', group: 'Commands', label: 'Toggle sidebar', icon: PanelLeft, shortcut: 'Ctrl+B', disabled: isLiveRunPage, run: toggleSidebar },
    { id: 'profile', group: 'Commands', label: 'Profile settings', icon: Settings, shortcut: 'Ctrl+,', run: () => void window.tellann?.system.openProfile() },
    { id: 'docs', group: 'Commands', label: 'Documentation', icon: BookOpenText, run: () => void window.tellann?.system.openExternal('https://docs.tellann.co') },
    { id: 'sign-out', group: 'Commands', label: 'Sign out…', icon: LogOut, run: () => void requestSignOut() },
  ], [applications, attachWorkspace, changeProject, navigate, projectId, refresh, requestSignOut, toggleSidebar, isLiveRunPage]);

  const runStatusLabel = activeRun ? `QA run ${formatEnum(activeRun.status).toLowerCase()}` : 'Ready';

  return (
    <div
      className="app-shell routed-shell"
      data-sidebar-mode={activeSidebarMode}
      style={{ '--sidebar-width': `${effectiveSidebarWidth}px` } as CSSProperties}
      {...dropHandlers}
    >
      <header className="titlebar">
        <div className="titlebar-leading">
          <ThemedLogo className="titlebar-icon" />
          <button className="titlebar-button" type="button" onClick={() => navigate(-1)} disabled={historyBounds.index <= 0} title="Back (Alt+Left)" aria-label="Back">
            <ArrowLeft size={16} />
          </button>
          <button className="titlebar-button" type="button" onClick={() => navigate(1)} disabled={historyBounds.index >= historyBounds.max} title="Forward (Alt+Right)" aria-label="Forward">
            <ArrowRight size={16} />
          </button>
          <button className="titlebar-button" type="button" disabled={isLiveRunPage} onClick={toggleSidebar} onContextMenu={(event) => void openSidebarMenu(event)} title="Toggle sidebar (Ctrl+B)" aria-label="Toggle sidebar" aria-pressed={activeSidebarMode === 'full'}>
            <PanelLeft size={16} />
          </button>
        </div>
        <div className="titlebar-context">
          <span className="titlebar-app-name">Tellann</span>
          <span className="titlebar-separator" aria-hidden="true">/</span>
          <SelectField
            ariaLabel="Active application"
            value={application?.id ?? ''}
            onValueChange={changeProject}
            options={applications.map((item) => ({ value: item.id, label: `${item.organizationName} / ${item.name}` }))}
            placeholder="Select application"
            className="titlebar-select project-select"
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
              options={application.environments.map((item) => ({ value: item.id, label: `${item.name} (${formatEnum(item.type)})` }))}
              placeholder="Select environment"
              className="titlebar-select environment-select"
            />
          ) : null}
          {environment ? (
            <span className="environment-chip" data-environment={environment.type.toLowerCase()}>{formatEnum(environment.type)}</span>
          ) : null}
        </div>
        <button className="titlebar-search" type="button" onClick={() => setPaletteOpen(true)} title="Search (Ctrl+K)">
          <Search size={14} />
          <span>Search Tellann</span>
          <kbd>Ctrl+K</kbd>
        </button>
        <div className="titlebar-drag" />
      </header>

      {activeSidebarMode !== 'closed' ? (
        <aside className="sidebar" aria-label="Sidebar" onContextMenu={(event) => {
          if ((event.target as HTMLElement).closest('input, textarea')) return;
          void openSidebarMenu(event);
        }}>
          <nav aria-label="Primary navigation">
            {desktopNavigation.map(({ id, label, icon: Icon, resolveHref, matches }, index) => (
              <NavLink
                key={id}
                to={resolveHref(projectId)}
                title={`${label} (Ctrl+${index + 1})`}
                aria-label={label}
                className={matches(location.pathname, projectId) ? 'nav-active' : undefined}
                draggable={false}
              >
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-profile">
            <button
              className="profile-trigger"
              type="button"
              aria-haspopup="menu"
              title={userEmail ? `${userName} (${userEmail})` : userName}
              onClick={(event) => void openProfileMenu(event)}
              onContextMenu={(event) => void openProfileMenu(event)}
            >
              {avatarNode}
              <span className="profile-trigger-name">
                <strong>{userName}</strong>
                {userEmail ? <small>{userEmail}</small> : null}
              </span>
            </button>
          </div>

          {activeSidebarMode === 'full' ? <div className="sidebar-resize-handle" role="separator" aria-label="Resize sidebar" aria-orientation="vertical" onPointerDown={beginResize} onDoubleClick={() => { setSidebarWidth(DEFAULT_SIDEBAR_WIDTH); localStorage.setItem('tellann:sidebar-width', String(DEFAULT_SIDEBAR_WIDTH)); }} /> : null}
        </aside>
      ) : null}

      <main className="route-workspace">
        {environment?.type === 'PRODUCTION' ? (
          <div className="policy-banner infobar" data-tone="warning" role="status">
            <ShieldCheck size={16} />
            <span><strong>Production is observation-only.</strong> Launch, instrumentation, automated interaction and form submission are blocked.</span>
          </div>
        ) : null}
        {error ? (
          <div className="global-error infobar" data-tone="danger" role="alert">
            <TriangleAlert size={16} />
            <span>{error}</span>
            <div className="error-actions">
              {!cloudAvailable ? <button type="button" onClick={() => void refreshApplications().catch(() => undefined)}>Retry</button> : null}
              <button type="button" onClick={clearError}>Dismiss</button>
            </div>
          </div>
        ) : null}
        <Outlet />
        {dropActive ? (
          <div className="drop-overlay" aria-hidden="true">
            <FolderPlus size={28} />
            <strong>{application ? `Attach folder to ${application.name}` : 'Open an application first'}</strong>
            <span>{application ? 'Drop a project folder to attach it as this application’s workspace.' : 'Folders attach to the application that is open.'}</span>
          </div>
        ) : null}
      </main>

      <NotificationToaster />
      <UploadConsentModal />
      <RepositoryMismatchModal />
      <CommandPalette open={paletteOpen} items={paletteItems} onClose={() => setPaletteOpen(false)} />

      {/* Workspace and run state live here only; the sidebar stays navigation. */}
      <footer className="global-statusbar" aria-live="polite">
        <NavLink
          className="statusbar-item"
          data-active={activeRun ? 'true' : undefined}
          to={projectId
            ? activeRun
              ? `/applications/${projectId}/qa-runs/${activeRun.runId}/live`
              : `/applications/${projectId}/qa-runs`
            : '/applications?next=qa-runs'}
          title={activeRun ? `Open run ${activeRun.runId.slice(0, 8)}` : 'No active QA run (Ctrl+N starts one)'}
          draggable={false}
        >
          <span className="statusbar-dot" aria-hidden="true" />
          <span>{runStatusLabel}</span>
        </NavLink>
        <div className="statusbar-spacer" />
        {busy ? <div className="statusbar-item"><LoaderCircle className="spin" size={12} /><span>Working…</span></div> : null}
        <div className="statusbar-item" title={cloudAvailable ? 'Connected to Tellann Cloud' : 'Tellann Cloud is unreachable'}>
          {cloudAvailable ? <Cloud size={12} /> : <CloudOff size={12} />}
          <span>{cloudAvailable ? 'Connected' : 'Offline'}</span>
        </div>
        {workspace ? (
          <NavLink
            className="statusbar-item"
            to={`/applications/${projectId}/workspace`}
            title={workspace.path}
            draggable={false}
          >
            <Folder size={12} />
            <span>{workspace.snapshot.branch ? `${workspace.name} · ${workspace.snapshot.branch}` : workspace.name}</span>
          </NavLink>
        ) : (
          <button
            className="statusbar-item"
            type="button"
            disabled={!projectId || busy}
            onClick={() => { if (projectId) void attachWorkspace(projectId).catch(() => undefined); }}
            title={projectId ? 'Attach a project folder, or drop one onto the window' : 'Open an application to attach a folder'}
          >
            <FolderPlus size={12} />
            <span>Attach folder</span>
          </button>
        )}
      </footer>
    </div>
  );
}
