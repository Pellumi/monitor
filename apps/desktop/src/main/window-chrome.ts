import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, screen, systemPreferences, Tray,
  type MenuItemConstructorOptions, type Rectangle,
} from 'electron';

/**
 * Native window behaviour for the main window: the drawn title bar, Mica,
 * remembered bounds, context menus, back/forward, taskbar progress, badges,
 * jump list, and the compact sign-in window.
 *
 * Channel names live here and in preload rather than in the shared contracts:
 * the desktop loads that package's prebuilt output at runtime.
 */
export const WINDOW_CHANNELS = {
  state: 'tellann:window:state',
  getState: 'tellann:window:state:get',
  navigate: 'tellann:window:navigate',
  command: 'tellann:window:command',
  consumeCommand: 'tellann:window:command:consume',
  contextMenu: 'tellann:window:context-menu',
  confirm: 'tellann:window:confirm',
  setMode: 'tellann:window:mode',
} as const;

export const TITLE_BAR_HEIGHT = 40;
const MAIN_MIN_SIZE = { width: 960, height: 640 };
const AUTH_SIZE = { width: 460, height: 620 };
const DEFAULT_BOUNDS = { width: 1440, height: 900 };

export type WindowMode = 'auth' | 'main';
export type WindowCommand = 'new-run' | 'applications';
type RunIndicator = 'idle' | 'running' | 'paused' | 'error';

type PersistedWindowState = {
  bounds?: Partial<Rectangle>;
  maximized?: boolean;
  mode?: WindowMode;
};

export type ContextMenuItemInput = {
  id?: string;
  label?: string;
  type?: 'normal' | 'separator' | 'checkbox';
  enabled?: boolean;
  checked?: boolean;
  accelerator?: string;
  submenu?: ContextMenuItemInput[];
};

export type ConfirmInput = {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

let window: BrowserWindow | null = null;
let mode: WindowMode = 'main';
let mainBounds: Rectangle | null = null;
let mainMaximized = false;
let unreadWhileAway = 0;
let tray: Tray | null = null;
let pendingCommand: WindowCommand | null = commandFromArgv(process.argv);
let endRunHandler: (() => void) | null = null;
let saveTimer: NodeJS.Timeout | null = null;

function stateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function readPersistedState(): PersistedWindowState {
  try {
    const file = stateFile();
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as PersistedWindowState : {};
  } catch {
    return {};
  }
}

function writePersistedState() {
  try {
    mkdirSync(path.dirname(stateFile()), { recursive: true });
    const state: PersistedWindowState = { bounds: mainBounds ?? undefined, maximized: mainMaximized, mode };
    writeFileSync(stateFile(), JSON.stringify(state));
  } catch {
    // Window placement is a convenience; failing to save it must never surface.
  }
}

/** Saved bounds are only reused when they still overlap a connected display. */
function visibleBounds(bounds: Partial<Rectangle> | undefined): Rectangle | null {
  if (!bounds || typeof bounds.width !== 'number' || typeof bounds.height !== 'number'
    || typeof bounds.x !== 'number' || typeof bounds.y !== 'number') return null;
  const candidate = bounds as Rectangle;
  const onScreen = screen.getAllDisplays().some(({ workArea }) =>
    candidate.x < workArea.x + workArea.width - 80
    && candidate.x + candidate.width > workArea.x + 80
    && candidate.y >= workArea.y - 8
    && candidate.y < workArea.y + workArea.height - 80);
  if (!onScreen) return null;
  return {
    ...candidate,
    width: Math.max(MAIN_MIN_SIZE.width, candidate.width),
    height: Math.max(MAIN_MIN_SIZE.height, candidate.height),
  };
}

/** Mica needs Windows 11 22H2 (build 22621) or later. */
export function supportsMica() {
  if (process.platform !== 'win32') return false;
  const build = Number(os.release().split('.')[2] ?? 0);
  return build >= 22621;
}

function overlayColors() {
  const dark = nativeTheme.shouldUseDarkColors;
  return {
    color: supportsMica() ? '#00000000' : dark ? '#202020' : '#f3f3f3',
    symbolColor: dark ? '#e6e6e6' : '#1a1a1a',
    height: TITLE_BAR_HEIGHT,
  };
}

/** The Windows accent, with the text colour that stays readable on top of it. */
function accentQuery() {
  let accent = '0067c0';
  try {
    if (process.platform === 'win32') accent = systemPreferences.getAccentColor().slice(0, 6) || accent;
  } catch {
    // Keep the default accent.
  }
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(accent.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { accent, onAccent: luminance > 0.36 ? '000000' : 'ffffff' };
}

type IconVariant = 'dark' | 'light';
let iconVariant: IconVariant | null = null;

/** Build output for a mark variant: white strokes for dark surfaces, black for light ones. */
function iconFile(variant: IconVariant, extension: 'ico' | 'png') {
  const name = `${variant === 'light' ? 'icon-light' : 'icon'}.${extension}`;
  return app.isPackaged ? path.join(process.resourcesPath, name) : path.resolve(__dirname, '../../../build', name);
}

function windowIconExtension(): 'ico' | 'png' {
  return process.platform === 'win32' ? 'ico' : 'png';
}

/** Initial window icon, guessed from the app theme until the taskbar theme is read. */
export function themedWindowIconPath() {
  return iconFile(nativeTheme.shouldUseDarkColors ? 'dark' : 'light', windowIconExtension());
}

/**
 * The taskbar follows the Windows mode, which can differ from the app mode
 * Electron reports, so it is read from the registry. Null when unavailable.
 */
function readTaskbarUsesLightTheme(): Promise<boolean | null> {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(
      'reg',
      ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', '/v', 'SystemUsesLightTheme'],
      { windowsHide: true, timeout: 3000 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const match = stdout.match(/SystemUsesLightTheme\s+REG_DWORD\s+0x([0-9a-f]+)/i);
        resolve(match ? parseInt(match[1], 16) === 1 : null);
      },
    );
  });
}

function trayImage() {
  return nativeImage.createFromPath(iconFile(iconVariant ?? 'dark', 'png')).resize({ width: 16, height: 16 });
}

/** Points the window, taskbar button and tray at the mark that suits the taskbar theme. */
async function refreshThemedIcons() {
  const light = (await readTaskbarUsesLightTheme()) ?? !nativeTheme.shouldUseDarkColors;
  const variant: IconVariant = light ? 'light' : 'dark';
  if (!window || window.isDestroyed() || variant === iconVariant) return;
  const icon = iconFile(variant, windowIconExtension());
  if (!existsSync(icon)) return;
  iconVariant = variant;
  window.setIcon(icon);
  if (process.platform === 'win32') {
    // The taskbar button takes its icon from the window's app details, not the
    // BrowserWindow icon. Without them a development run shows electron.exe's
    // icon, because Windows resolves the app identity to that executable.
    window.setAppDetails({
      appId: 'com.tellann.desktop',
      appIconPath: icon,
      appIconIndex: 0,
      relaunchCommand: app.isPackaged
        ? `"${process.execPath}"`
        : `"${process.execPath}" "${process.argv[1] ?? ''}"`,
      relaunchDisplayName: 'Tellann',
    });
  }
  tray?.setImage(trayImage());
}

/** Options merged into the main BrowserWindow constructor. */
export function windowOptions(): Electron.BrowserWindowConstructorOptions {
  const persisted = readPersistedState();
  mode = persisted.mode === 'auth' ? 'auth' : 'main';
  mainBounds = visibleBounds(persisted.bounds);
  mainMaximized = persisted.maximized === true;
  const mica = supportsMica();
  const dark = nativeTheme.shouldUseDarkColors;
  const base: Electron.BrowserWindowConstructorOptions = {
    titleBarStyle: 'hidden',
    titleBarOverlay: overlayColors(),
    backgroundColor: mica ? '#00000000' : dark ? '#202020' : '#f3f3f3',
    ...(mica ? { backgroundMaterial: 'mica' as const } : {}),
  };
  if (mode === 'auth') {
    return { ...base, ...AUTH_SIZE, resizable: false, maximizable: false, center: true };
  }
  return {
    ...base,
    ...(mainBounds ?? DEFAULT_BOUNDS),
    minWidth: MAIN_MIN_SIZE.width,
    minHeight: MAIN_MIN_SIZE.height,
    center: !mainBounds,
  };
}

/** Query string the renderer reads once at startup to match the native chrome. */
export function rendererQuery(): Record<string, string> {
  const { accent, onAccent } = accentQuery();
  return { material: supportsMica() ? 'mica' : 'solid', accent, onAccent, platform: process.platform };
}

function sendState() {
  if (!window || window.isDestroyed()) return;
  window.webContents.send(WINDOW_CHANNELS.state, currentState());
}

function currentState() {
  return {
    focused: window?.isFocused() ?? true,
    maximized: window?.isMaximized() ?? false,
    fullScreen: window?.isFullScreen() ?? false,
    mode,
  };
}

function scheduleSave() {
  if (!window || window.isDestroyed() || mode !== 'main') return;
  mainMaximized = window.isMaximized();
  if (!mainMaximized && !window.isFullScreen() && !window.isMinimized()) mainBounds = window.getNormalBounds();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(writePersistedState, 400);
}

/** Wires native behaviour onto the freshly created main window. */
export function attachWindowChrome(target: BrowserWindow) {
  window = target;
  void refreshThemedIcons();
  if (mode === 'main' && mainMaximized) target.maximize();

  for (const event of ['focus', 'blur', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'] as const) {
    target.on(event as 'focus', sendState);
  }
  target.on('focus', () => {
    target.flashFrame(false);
    // Windows mode changes do not always reach nativeTheme, so recheck on focus.
    void refreshThemedIcons();
    if (unreadWhileAway) {
      unreadWhileAway = 0;
      if (process.platform === 'win32') target.setOverlayIcon(null, '');
      else app.setBadgeCount(0);
    }
  });
  target.on('resize', scheduleSave);
  target.on('move', scheduleSave);
  target.on('maximize', scheduleSave);
  target.on('unmaximize', scheduleSave);
  target.on('close', () => {
    scheduleSave();
    if (saveTimer) clearTimeout(saveTimer);
    writePersistedState();
  });

  // Mouse back/forward buttons and the keyboard media keys.
  target.on('app-command', (_event, command) => {
    if (command === 'browser-backward') target.webContents.send(WINDOW_CHANNELS.navigate, 'back');
    if (command === 'browser-forward') target.webContents.send(WINDOW_CHANNELS.navigate, 'forward');
  });

  // Electron shows no context menu by default. Give text the standard edit
  // menu; the renderer raises its own menus for rows and prevents this one.
  target.webContents.on('context-menu', (_event, params) => {
    const template: MenuItemConstructorOptions[] = [];
    if (params.isEditable) {
      template.push(
        { role: 'undo', enabled: params.editFlags.canUndo },
        { role: 'redo', enabled: params.editFlags.canRedo },
        { type: 'separator' },
        { role: 'cut', enabled: params.editFlags.canCut },
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { role: 'selectAll', enabled: params.editFlags.canSelectAll },
      );
    } else if (params.selectionText.trim()) {
      template.push({ role: 'copy' }, { type: 'separator' }, { role: 'selectAll' });
    }
    if (!app.isPackaged) {
      if (template.length) template.push({ type: 'separator' });
      template.push({ label: 'Inspect element', click: () => target.webContents.inspectElement(params.x, params.y) });
    }
    if (template.length) Menu.buildFromTemplate(template).popup({ window: target });
  });

  nativeTheme.on('updated', () => {
    if (!target.isDestroyed()) target.setTitleBarOverlay(overlayColors());
    void refreshThemedIcons();
    sendState();
  });

  if (app.isPackaged && process.platform === 'win32') {
    app.setUserTasks([
      {
        program: process.execPath,
        arguments: '--tellann-command=new-run',
        iconPath: process.execPath,
        iconIndex: 0,
        title: 'New QA run',
        description: 'Start a guided QA run for the last application',
      },
      {
        program: process.execPath,
        arguments: '--tellann-command=applications',
        iconPath: process.execPath,
        iconIndex: 0,
        title: 'Applications',
        description: 'Open the application list',
      },
    ]);
  }
}

function commandFromArgv(argv: string[]): WindowCommand | null {
  const value = argv.find((item) => item.startsWith('--tellann-command='))?.split('=')[1];
  return value === 'new-run' || value === 'applications' ? value : null;
}

/** Jump list tasks start a second instance; forward its command to this window. */
export function handleSecondInstanceArgv(argv: string[]) {
  const command = commandFromArgv(argv);
  if (!command) return;
  if (window && !window.isDestroyed() && !window.webContents.isLoading()) {
    window.webContents.send(WINDOW_CHANNELS.command, command);
  } else {
    pendingCommand = command;
  }
}

function applyMode(next: WindowMode) {
  if (!window || window.isDestroyed() || next === mode) return;
  if (next === 'auth') {
    mainMaximized = window.isMaximized();
    if (!window.isMaximized() && !window.isFullScreen()) mainBounds = window.getNormalBounds();
    mode = 'auth';
    if (window.isFullScreen()) window.setFullScreen(false);
    if (window.isMaximized()) window.unmaximize();
    window.setMinimumSize(AUTH_SIZE.width, AUTH_SIZE.height);
    window.setResizable(false);
    window.setMaximizable(false);
    window.setSize(AUTH_SIZE.width, AUTH_SIZE.height);
    window.center();
  } else {
    mode = 'main';
    window.setResizable(true);
    window.setMaximizable(true);
    window.setMinimumSize(MAIN_MIN_SIZE.width, MAIN_MIN_SIZE.height);
    if (mainBounds) window.setBounds(mainBounds);
    else {
      window.setSize(DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height);
      window.center();
    }
    if (mainMaximized) window.maximize();
  }
  writePersistedState();
  sendState();
}

/** Taskbar progress while a guided run is active, plus a tray entry to reach it. */
export function setRunIndicator(indicator: RunIndicator) {
  if (!window || window.isDestroyed()) return;
  if (indicator === 'idle') window.setProgressBar(-1);
  else window.setProgressBar(1, { mode: indicator === 'running' ? 'indeterminate' : indicator });
  updateTray(indicator);
}

function updateTray(indicator: RunIndicator) {
  if (indicator === 'idle') {
    tray?.destroy();
    tray = null;
    return;
  }
  if (!tray) {
    tray = new Tray(trayImage());
    tray.on('click', () => focusWindow());
  }
  tray.setToolTip(indicator === 'paused' ? 'Tellann: QA run paused' : 'Tellann: QA run in progress');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Tellann', click: () => focusWindow() },
    { type: 'separator' },
    { label: 'End QA run', enabled: Boolean(endRunHandler), click: () => endRunHandler?.() },
  ]));
}

export function onEndRunRequested(handler: () => void) {
  endRunHandler = handler;
}

function focusWindow() {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

/** Flashes the taskbar button when something finishes while the user is elsewhere. */
export function requestAttention() {
  if (window && !window.isDestroyed() && !window.isFocused()) window.flashFrame(true);
}

/** A notification arrived: badge the taskbar icon until the window is focused. */
export function noteBackgroundNotification() {
  if (!window || window.isDestroyed() || window.isFocused()) return;
  unreadWhileAway += 1;
  if (process.platform === 'win32') {
    window.setOverlayIcon(badgeIcon(), `${unreadWhileAway} unread notification${unreadWhileAway === 1 ? '' : 's'}`);
  } else {
    app.setBadgeCount(unreadWhileAway);
  }
  window.flashFrame(true);
}

/** A 16px filled circle in BGRA, so no image asset has to ship with the app. */
function badgeIcon() {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center);
      const coverage = Math.max(0, Math.min(1, 7.5 - distance));
      const offset = (y * size + x) * 4;
      const ring = distance > 5.5;
      buffer[offset] = ring ? 255 : 59; // B
      buffer[offset + 1] = ring ? 255 : 59; // G
      buffer[offset + 2] = ring ? 255 : 220; // R
      buffer[offset + 3] = Math.round(coverage * 255);
    }
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size });
}

export function registerWindowIpc(assertTrustedSender: (event: Electron.IpcMainInvokeEvent) => void) {
  ipcMain.handle(WINDOW_CHANNELS.getState, (event) => {
    assertTrustedSender(event);
    return currentState();
  });
  ipcMain.handle(WINDOW_CHANNELS.setMode, (event, next: unknown) => {
    assertTrustedSender(event);
    if (next === 'auth' || next === 'main') applyMode(next);
    return currentState();
  });
  ipcMain.handle(WINDOW_CHANNELS.consumeCommand, (event) => {
    assertTrustedSender(event);
    const command = pendingCommand;
    pendingCommand = null;
    return command;
  });
  ipcMain.handle(WINDOW_CHANNELS.confirm, async (event, input: ConfirmInput) => {
    assertTrustedSender(event);
    if (!window || window.isDestroyed()) return false;
    const { response } = await dialog.showMessageBox(window, {
      type: input.danger ? 'warning' : 'question',
      title: String(input.title ?? 'Tellann'),
      message: String(input.message ?? ''),
      detail: input.detail ? String(input.detail) : undefined,
      buttons: [String(input.confirmLabel ?? 'OK'), String(input.cancelLabel ?? 'Cancel')],
      defaultId: input.danger ? 1 : 0,
      cancelId: 1,
      noLink: true,
    });
    return response === 0;
  });
  ipcMain.handle(WINDOW_CHANNELS.contextMenu, (event, items: ContextMenuItemInput[]) => {
    assertTrustedSender(event);
    if (!window || window.isDestroyed() || !Array.isArray(items)) return null;
    const target = window;
    return new Promise<string | null>((resolve) => {
      let settled = false;
      const settle = (value: string | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const toTemplate = (list: ContextMenuItemInput[], depth: number): MenuItemConstructorOptions[] =>
        list.slice(0, 40).map((item): MenuItemConstructorOptions => {
          if (item.type === 'separator') return { type: 'separator' };
          const submenu = depth < 2 && Array.isArray(item.submenu) ? toTemplate(item.submenu, depth + 1) : undefined;
          if (submenu) return { label: String(item.label ?? ''), enabled: item.enabled !== false, submenu };
          return {
            label: String(item.label ?? ''),
            type: item.type === 'checkbox' ? 'checkbox' : 'normal',
            checked: item.type === 'checkbox' ? item.checked === true : undefined,
            enabled: item.enabled !== false,
            accelerator: item.accelerator,
            registerAccelerator: false,
            click: () => settle(item.id ?? null),
          };
        });
      const template = toTemplate(items, 0);
      // The close callback can run before the click handler, so give a
      // selection a moment to land before treating the menu as dismissed.
      Menu.buildFromTemplate(template).popup({ window: target, callback: () => setTimeout(() => settle(null), 60) });
    });
  });
}
