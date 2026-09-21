Now that I have the shell structure, I'll gather the remaining details in parallel: where colors are defined and how many hard-coded hex values exist, how often patterns like uppercase labels, `transition: all`, hover lifts, and pointer cursors appear, and the card styles and Overview page markup to assess how "web-page"-like the content feels.

I'll now check whether fonts are bundled, how the pointer cursor is used, and whether back/forward navigation is handled before writing up my findings.

# Making the Tellann desktop app feel like a desktop app

The foundations are good. The window already hides the native title bar and draws its own ([main.ts:1143](src/main/main.ts:1143)), and the sidebar can be resized and collapsed. The web feel comes from four things: web-page layout and spacing, a marketing-style look, almost no Windows integration, and a few web habits. Here they are, roughly in order of how much each one matters.

---

## 1. Window chrome and title bar (biggest visual win)

**What's there now**
- The top bar is **60px tall**, but the Windows min/maximize/close buttons are only **32px** tall ([main.ts:1147](src/main/main.ts:1147)). So those buttons sit in the top half of the bar, misaligned with everything else in it.
- The space for those buttons is reserved with a hard-coded `padding-right: 150px` ([styles.css:2053](src/renderer/styles.css:2053)). That breaks with display scaling and on other operating systems.
- The top bar has a large bold "Tellann" wordmark link, which is what a website header looks like.
- The window background is `#080808` but the page body is `#000`, so the colour visibly changes while the app loads.
- The window doesn't dim or change when it loses focus. Native Windows apps do.

**What to change**
- **Make the title bar 36–40px** and set the window buttons to the same height.
- **Stop hard-coding the 150px.** Chromium's CSS variables for the title bar area (`env(titlebar-area-x/width/height)`) tell you exactly where the window buttons are. Keep dragging the bar to move the window, and mark the dropdowns as clickable.
- **Turn the top bar into a real title bar:** a small app icon, then `Org / Application ▾`, then the environment chip. Drop the big wordmark.
- **Use Windows 11's Mica background** (`backgroundMaterial: 'mica'`) with a partly transparent sidebar and title bar. On its own, this is the most "native Windows" change you can make.
- **Recolour the window buttons to match the app** (`mainWindow.setTitleBarOverlay`) and **react to focus changes:** send `blur`/`focus` to the page, set `data-window-focused`, and dim the title bar and sidebar text when the window isn't focused.
- **Match `backgroundColor` to the body colour** so nothing flashes on load.

## 2. Layout: pages vs. panes

**What's there now**
- Every screen uses the same `Page` component ([pages.tsx:144](src/renderer/pages.tsx:144)): a 25px heading, a description paragraph, and buttons on the right. That's a landing-page pattern.
- The heading scrolls away with the content ([styles.css:3462](src/renderer/styles.css:3462)).
- Applications appear as a two-column grid of cards, each with an "Open application" button ([pages.tsx:331](src/renderer/pages.tsx:331)).
- The empty state is a dashed box 360px tall.
- There are `@media (max-width: 640px)` breakpoints for phone widths, but the window can't be narrower than 1180px.

**What to change**
- **Replace the heading area with a fixed toolbar** (about 44px): the page name or breadcrumb on the left, then compact actions, a search box and view toggles. Only the content below it should scroll. Remove the description sentences, or move them into tooltips or first-run empty states.
- **Use list or table views that support selection** instead of card grids:
  - Arrow keys move the selection, Enter or double-click opens.
  - Rows are 28–32px tall.
  - Right-click opens a context menu.
  - "Open" and "Attach folder" move into that menu and the toolbar.
- **Use list-on-the-left, details-on-the-right** where it fits. QA Runs, Reports and Instrumentation plans all suit this: pick a run on the left and see its details on the right without leaving the page. This matters more than any visual tweak.
- **Add an inspector panel on the right** for screens with properties (a Flow, a finding, evidence), rather than stacking sections down the page.
- **Delete the phone-width breakpoints.** Where a pane needs to adapt to its own width, use container queries.

## 3. Density and sizing

The spacing is set for a website:

| Element | Current | Desktop target |
|---|---|---|
| Title bar | 60px | 36–40px |
| Status bar | 42px ([styles.css:2892](src/renderer/styles.css:2892)) | 22–26px |
| Sidebar nav row | ~44px (`padding: 12px 18px`) | 28–32px |
| Buttons | 36px min | 28–32px |
| Inputs | 40px min | 28–32px |
| Page padding | 28px | 12–16px inside panes |
| Page heading | 25px | 13–15px semibold in the toolbar |

Base text should be 13px (Segoe UI), with 12px for secondary text.

## 4. Visual language

**What's there now**
- Pure `#000` black everywhere.
- **54** `text-transform: uppercase` rules, plus monospace "terminal" labels such as `AUTH // SIGN OUT` ([AppShell.tsx:307](src/renderer/AppShell.tsx:307)).
- White primary buttons that lift on hover (`translateY(-0.5px)` and a glow, [styles.css:383](src/renderer/styles.css:383)).
- 11 `transition: all` rules.
- The font list puts **Inter** first, but Inter isn't bundled (there are no `@font-face` rules). So it only works on machines that happen to have Inter installed.

Together these read as a developer-tool marketing site.

**What to change**
- **Use the system font:** `"Segoe UI Variable", "Segoe UI", system-ui`. Keep monospace only for real code, IDs and hashes.
- **Keep uppercase for rare small section labels only.** Status pills, tags and dialog headers should use sentence case.
- **Use layered dark greys instead of pure black:**
  - Window about `#1c1c1c` (or Mica)
  - Panes about `#202020`
  - Raised surfaces about `#2b2b2b`
  - Borders around 8% white
- **Replace the white primary button with one accent colour.** That can be the brand colour or the Windows accent colour (`systemPreferences.getAccentColor()`). Keep solid buttons for the single main action on a screen.
- **No lifts or glows on hover.** Desktop controls only change background colour, over 80–120ms.
- **Follow the Windows light/dark setting** with `nativeTheme`. It's dark-only today, and native Windows apps respect the system setting.

**Prerequisite:** `styles.css` has **889 hard-coded hex colours** and 75 more in `pages.tsx`. The `--surface`/`--border` tokens aren't defined until line 2862 ([styles.css:2863](src/renderer/styles.css:2863)), so everything above that ignores them. Until colours go through a small set of tokens (surface levels, text levels, border, accent, danger/warning/success), you can't reskin the app or support light mode without editing thousands of lines.

## 5. Web habits that give it away

- **Pointer cursor on every button** ([styles.css:1831](src/renderer/styles.css:1831), plus 44 more). Windows apps use the normal arrow for buttons and tabs and keep the hand cursor for real hyperlinks.
- **Everything can be text-selected.** Dragging across the sidebar or toolbar highlights labels. Set `user-select: none` on the app chrome and turn selection back on for content: report text, code, IDs, logs.
- **No right-click menus.** Electron has no default context menu, so right-clicking a text field doesn't even offer Copy/Paste. Add a `webContents.on('context-menu')` handler with the edit actions, then app-specific menus on list rows.
- **Images and links can be dragged** as if they were web content. Add `-webkit-user-drag: none` to the chrome.
- **Dialogs look like web modals.** They have a blurred full-window backdrop, a large "TELLANN" wordmark and a key/value table ([AppShell.tsx:302-338](src/renderer/AppShell.tsx:302)). Use a compact dialog (title, one sentence, buttons on the right). For simple confirmations like sign-out, use the native `dialog.showMessageBox`.
- **The sign-in screen is a web login card** in the middle of a huge window ([App.tsx:81](src/renderer/App.tsx:81)). Show it in a small fixed-size window (about 460×560, not resizable), then open the main window after sign-in.
- **The loading screen is plain text** ("Loading Tellann Desktop…"). Use a brief splash screen, or a placeholder app layout that fills in as data loads.

## 6. Missing OS integration

- **Keyboard shortcuts.** The app menu is removed entirely (`Menu.setApplicationMenu(null)`, [main.ts:2401](src/main/main.ts:2401)), so there are no shortcuts. Keep the menu bar hidden but register:
  - `Ctrl+1…5` to switch sections
  - `Ctrl+K` for a command palette
  - `Ctrl+N` for a new QA run
  - `Ctrl+,` for settings
  - `Ctrl+F` to focus search
  - `Ctrl+B` to toggle the sidebar
  - `F5` to refresh
  - `Alt+←/→` for back/forward
- **Back/forward.** The app uses in-app routing but has no back/forward buttons and ignores the mouse's side buttons. Handle the `app-command` event (`browser-backward`/`browser-forward`) and add ‹ › buttons to the title bar.
- **Window position and size aren't remembered.** The window always opens at 1584×990. Save its position, size and maximized state, and restore them on launch. Also consider lowering the 1180px minimum width to about 960px once panes can collapse.
- **Taskbar:**
  - Show QA run progress on the taskbar icon (`setProgressBar`).
  - Flash the taskbar button when a run finishes while the window is in the background (`flashFrame`).
  - Show a badge overlay for unread findings (`setOverlayIcon`).
  - Add jump list shortcuts such as "New QA run" and "Open last application" (`setUserTasks`).
- **Drag and drop:** drop a project folder onto the window to attach a workspace.
- **Optional:** a tray icon while a guided run is active.

---

## Suggested order

1. **Tokens and base (half a day to a day):** define colour tokens, the system font, sizes and base resets (cursor, selection, dragging). Replace the most-used hard-coded colours. Nothing else is cheap to do until this is done.
2. **Chrome:** 40px title bar using the `env(titlebar-area-*)` variables, Mica background, dimming when unfocused, 24px status bar, 30px sidebar rows, saved window position and size, context menus, keyboard shortcuts, back/forward.
3. **Page structure:** replace `Page` with a fixed toolbar and a scrolling content area. Since every screen uses that one component, this changes all screens at once.
4. **Screen by screen:** switch Applications, QA Runs and Reports to selectable lists with a details pane. Rework dialogs and the sign-in window.
5. **Polish:** taskbar progress and badges, jump list, light theme, command palette.

Items 1–3 are mostly limited to `styles.css`, `AppShell.tsx`, the `Page` component and `createWindow`, so they change the look a lot without touching the 11k-line `pages.tsx`. I haven't run the app for this review; it's based on reading the code. I can start on Phases 1–2 if you'd like, or mock up the new layout (title bar, toolbar and list-with-details) first so you can approve the direction.