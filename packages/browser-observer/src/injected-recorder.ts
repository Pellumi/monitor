/**
 * Pointer events Inspect mode must swallow. Preventing `click` alone is not
 * enough: menu, dropdown, drag and combobox implementations (Radix, react-aria,
 * most design systems) act on `pointerdown`/`mousedown`, so a press that
 * reached the page would still run application handlers while the user was
 * only trying to select an element.
 *
 * Exported for tests; `installQaRecorder` is serialized into the browser and so
 * must keep its own inline copy.
 */
export const INSPECT_INTERCEPTED_EVENTS = [
  'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick', 'contextmenu', 'auxclick',
] as const;

/**
 * Runs in every document before application code. Keep this function fully
 * self-contained: Playwright serializes it into the managed browser, so it may
 * not reference anything from module scope.
 */
export function installQaRecorder(config: {
  bridge: string;
  members: string;
  annotations: string;
  origin: string;
  production: boolean;
}) {
  if (location.origin !== config.origin) return;
  const invoke = (name: string, ...args: unknown[]) => {
    const binding = (globalThis as any)[name];
    return typeof binding === 'function' ? binding(...args) : Promise.resolve(undefined);
  };
  let phase: 'PRE_BOUNDARY' | 'IN_FLOW' = 'PRE_BOUNDARY';
  let mode: 'NAVIGATE' | 'INSPECT' = 'NAVIGATE';
  let latestInteraction: { eventId: string; groupId: string } | null = null;
  const uid = () => crypto.randomUUID();
  const send = (payload: Record<string, unknown>) => void invoke(config.bridge, {
    timestamp: new Date().toISOString(),
    ...payload,
  });
  const cleanUrl = (raw: string) => {
    try {
      const url = new URL(raw);
      const names = [...new Set([...url.searchParams.keys()])];
      url.search = names.length ? `?${names.map((name) => `${encodeURIComponent(name)}=`).join('&')}` : '';
      url.hash = '';
      return url.toString();
    } catch { return raw.split(/[?#]/, 1)[0]; }
  };
  const labelFor = (element: Element) => {
    const field = element as HTMLInputElement;
    const label = element.getAttribute('aria-label')
      || (element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : null)
      || element.closest('label')?.textContent;
    return String(label || element.getAttribute('title') || element.textContent || field.placeholder || '')
      .replace(/\s+/g, ' ').trim().slice(0, 500);
  };
  const cssPath = (element: Element) => {
    if ((element as HTMLElement).id) return `#${CSS.escape((element as HTMLElement).id)}`;
    const testId = element.getAttribute('data-testid');
    if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
    const segments: string[] = [];
    let node: Element | null = element;
    while (node && node !== document.documentElement && segments.length < 8) {
      const parent: Element | null = node.parentElement;
      const siblings: Element[] = parent
        ? Array.from(parent.children).filter((child: Element) => child.tagName === node!.tagName)
        : [];
      segments.unshift(`${node.tagName.toLowerCase()}${siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : ''}`);
      node = parent;
    }
    return segments.join(' > ');
  };
  const bounds = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  const describeElement = (element: Element) => ({
    tag: element.tagName.toLowerCase(),
    role: element.getAttribute('role'),
    accessibleName: labelFor(element),
    id: (element as HTMLElement).id || null,
    name: element.getAttribute('name'),
    testId: element.getAttribute('data-testid'),
    type: element.getAttribute('type'),
    formId: (element.closest('form') as HTMLFormElement | null)?.id || null,
    selector: cssPath(element),
    bounds: bounds(element),
  });
  // Token-based, matching the observer and the server classifier. Substring
  // matching flagged ordinary fields (a `profile` field contains `file`, a
  // `company` field contains `pan`) and silently discarded their values.
  const SECRET_TOKENS = ['password', 'passwd', 'passcode', 'passphrase', 'secret', 'token', 'jwt',
    'bearer', 'authorization', 'cookie', 'cvv', 'cvc', 'pin', 'otp', 'credential', 'credentials', 'pan'];
  const SECRET_PHRASES = ['cardnumber', 'cardnum', 'creditcard', 'debitcard', 'securitycode',
    'filecontent', 'sessionid', 'sessiontoken', 'privatekey', 'secretkey', 'apikey',
    'accesstoken', 'refreshtoken', 'clientsecret'];
  const IDENTIFIER_TOKENS = ['email', 'phone', 'mobile', 'msisdn', 'ssn'];
  const IDENTIFIER_PHRASES = ['userid', 'accountid', 'customerid', 'emailaddress', 'phonenumber'];
  const tokensOf = (text: string) => text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
  // Autocomplete is the standards-based signal for payment and credential
  // fields and is far more reliable than a name guess.
  const SECRET_AUTOCOMPLETE = /^(?:cc-(?:number|csc|exp|exp-month|exp-year|name|given-name|family-name|type)|(?:new|current)-password|one-time-code)$/i;
  const classifyField = (field: HTMLInputElement | HTMLTextAreaElement) => {
    const descriptor = `${field.type} ${field.name} ${field.id} ${field.getAttribute('aria-label') || ''}`;
    const tokens = tokensOf(descriptor);
    const joined = tokens.join('');
    const autocomplete = (field as HTMLInputElement).autocomplete || '';
    if (field.type === 'password' || field.type === 'file'
      || SECRET_AUTOCOMPLETE.test(autocomplete)
      || tokens.some((token) => SECRET_TOKENS.includes(token))
      || SECRET_PHRASES.some((phrase) => joined.includes(phrase))
      || field.closest('[data-tellann-sensitive]')) return 'SECRET';
    if (field.type === 'email' || field.type === 'tel'
      || /^(?:email|tel(?:-\w+)?|username)$/i.test(autocomplete)
      || tokens.some((token) => IDENTIFIER_TOKENS.includes(token))
      || IDENTIFIER_PHRASES.some((phrase) => joined.includes(phrase))) return 'DIRECT_IDENTIFIER';
    return 'ORDINARY';
  };

  const QUIET_PERIOD_MS = 500;
  const STABLE_PERIOD_MS = 250;
  const SETTLE_CAP_MS = 10_000;
  let routeStart = performance.now();
  let routeLabel = location.pathname;
  let mutationAt = performance.now();
  let settleRun = 0;
  /** Same-origin data requests currently in flight, tracked via fetch/XHR. */
  let inFlight = 0;
  let lastRequestSettledAt = performance.now();

  const isSameOriginData = (raw: string) => {
    try {
      const url = new URL(raw, location.href);
      return url.origin === location.origin && !/\.(?:js|css|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|ico|map)$/i.test(url.pathname);
    } catch { return false; }
  };
  const beginRequest = () => { inFlight += 1; };
  const endRequest = () => {
    inFlight = Math.max(0, inFlight - 1);
    lastRequestSettledAt = performance.now();
  };
  const originalFetch = globalThis.fetch;
  if (typeof originalFetch === 'function') {
    globalThis.fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
      const input = args[0];
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      if (!isSameOriginData(String(url))) return originalFetch.apply(this as any, args);
      beginRequest();
      return originalFetch.apply(this as any, args).finally(endRequest);
    } as typeof fetch;
  }
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest & { __tellannTracked?: boolean }, ...args: any[]) {
    this.__tellannTracked = isSameOriginData(String(args[1] ?? ''));
    return originalOpen.apply(this, args as any);
  } as typeof XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest & { __tellannTracked?: boolean }, ...args: any[]) {
    if (this.__tellannTracked) {
      beginRequest();
      this.addEventListener('loadend', endRequest, { once: true });
    }
    return originalSend.apply(this, args as any);
  } as typeof XMLHttpRequest.prototype.send;

  /**
   * Data-ready is a genuine quiet period: 500 ms with no same-origin data
   * request in flight, polled until it holds or the 10 s cap is reached.
   * Visually-stable then requires two animation frames plus 250 ms without a
   * meaningful DOM mutation. Both report explicit timeout flags rather than
   * fabricating a value.
   */
  const scheduleSettled = () => {
    routeStart = performance.now();
    routeLabel = location.pathname;
    const run = ++settleRun;
    const startedAt = routeStart;
    const label = routeLabel;
    const awaitQuiet = () => {
      if (run !== settleRun) return;
      const elapsed = performance.now() - startedAt;
      const quietFor = performance.now() - Math.max(lastRequestSettledAt, startedAt);
      if (elapsed >= SETTLE_CAP_MS) return finish(SETTLE_CAP_MS, true);
      if (inFlight > 0 || quietFor < QUIET_PERIOD_MS) {
        window.setTimeout(awaitQuiet, 100);
        return;
      }
      awaitStable(performance.now() - startedAt);
    };
    const awaitStable = (dataReadyMs: number) => {
      const stableFrom = performance.now();
      const check = () => {
        if (run !== settleRun) return;
        const elapsed = performance.now() - startedAt;
        if (elapsed >= SETTLE_CAP_MS) return finish(dataReadyMs, false, SETTLE_CAP_MS, true);
        // Stable once nothing has mutated for STABLE_PERIOD_MS. Taking the max
        // against the window start means a late mutation simply restarts the
        // quiet period instead of latching the check open.
        if (performance.now() - Math.max(mutationAt, stableFrom) < STABLE_PERIOD_MS) {
          window.setTimeout(check, 100);
          return;
        }
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (run !== settleRun) return;
          finish(dataReadyMs, false, performance.now() - startedAt, false);
        }));
      };
      check();
    };
    const finish = (
      dataReadyMs: number,
      dataReadyTimedOut: boolean,
      visuallyStableMs?: number,
      visuallyStableTimedOut = false,
    ) => {
      send({
        type: 'performance',
        metadata: {
          route: label,
          dataReadyMs: Math.round(dataReadyMs),
          visuallyStableMs: visuallyStableMs === undefined ? null : Math.round(visuallyStableMs),
          dataReadyTimedOut,
          visuallyStableTimedOut,
        },
      });
    };
    window.setTimeout(awaitQuiet, 100);
  };
  const emitRoute = (kind: string) => {
    const eventId = uid();
    const groupId = uid();
    latestInteraction = { eventId, groupId };
    // Close out the route we are leaving before its metrics get mixed into the
    // next one, then start a fresh accumulator.
    if (kind !== 'document') {
      flushRouteMetrics('route-change');
      resetRouteMetrics();
    }
    send({
      type: 'route', eventId, interactionGroupId: groupId,
      metadata: { kind, url: cleanUrl(location.href), title: document.title.slice(0, 200) },
    });
    scheduleSettled();
  };

  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  history.pushState = function (...args) { originalPush.apply(this, args); emitRoute('pushState'); };
  history.replaceState = function (...args) { originalReplace.apply(this, args); emitRoute('replaceState'); };
  addEventListener('popstate', () => emitRoute('popstate'));
  addEventListener('hashchange', () => emitRoute('hashchange'));
  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => send({
      type: 'viewport',
      metadata: {
        innerWidth, innerHeight, outerWidth, outerHeight,
        screenWidth: screen.width, screenHeight: screen.height,
        devicePixelRatio, orientation: screen.orientation?.type ?? null,
      },
    }), 200);
  });
  document.addEventListener('click', (event) => {
    if (mode === 'INSPECT') return;
    const target = (event.composedPath() as EventTarget[]).find((item) => item instanceof Element) as Element | undefined;
    const control = target?.closest('button, a, input[type="submit"], input[type="button"], [role="button"], [role="link"]');
    if (!control || control.closest('[data-tellann-ignore], [data-tellann-overlay]')) return;
    const eventId = uid();
    const groupId = uid();
    latestInteraction = { eventId, groupId };
    send({ type: 'click', eventId, interactionGroupId: groupId, metadata: describeElement(control) });
  }, true);
  document.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (!form || form.closest('[data-tellann-ignore], [data-tellann-overlay]')) return;
    const eventId = uid();
    const groupId = latestInteraction?.groupId || uid();
    send({
      type: 'submit_intent', eventId, interactionGroupId: groupId,
      causedByEventId: latestInteraction?.eventId,
      metadata: { ...describeElement(form), action: cleanUrl(form.action || location.href), method: form.method },
    });
    queueMicrotask(() => send({
      type: 'submit', eventId: uid(), interactionGroupId: groupId, causedByEventId: eventId,
      metadata: { formId: form.id || null, formName: form.name || null, valid: form.checkValidity() },
    }));
  }, true);
  const captureField = (event: Event) => {
    if (phase !== 'IN_FLOW' || config.production) return;
    const field = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!field?.matches?.('input, textarea, select') || field.closest('[data-tellann-ignore]')) return;
    const kind = classifyField(field);
    send({
      type: 'field', eventId: uid(), interactionGroupId: latestInteraction?.groupId,
      valueKind: kind, valuePath: `field.${field.name || field.id || field.type || 'anonymous'}.value`,
      value: kind === 'SECRET' ? undefined : String(field.value),
      metadata: {
        ...describeElement(field), label: labelFor(field), autocomplete: field.autocomplete || null,
        required: field.required, disabled: field.disabled, readOnly: field.readOnly,
        valid: field.validity.valid, valueLength: String(field.value).length, populated: Boolean(field.value),
      },
    });
  };
  document.addEventListener('change', captureField, true);
  document.addEventListener('blur', captureField, true);

  const patchStorage = (storage: Storage, store: string) => {
    const originalSet = storage.setItem.bind(storage);
    const originalRemove = storage.removeItem.bind(storage);
    const originalClear = storage.clear.bind(storage);
    storage.setItem = (key, value) => {
      const previous = storage.getItem(key);
      originalSet(key, value);
      if (phase !== 'IN_FLOW' || config.production) return;
      const keyTokens = tokensOf(key);
      const keyJoined = keyTokens.join('');
      const kind = keyTokens.some((token) => SECRET_TOKENS.includes(token))
        || SECRET_PHRASES.some((phrase) => keyJoined.includes(phrase))
        ? 'SECRET'
        : keyTokens.some((token) => IDENTIFIER_TOKENS.includes(token))
          || IDENTIFIER_PHRASES.some((phrase) => keyJoined.includes(phrase))
          ? 'DIRECT_IDENTIFIER' : 'ORDINARY';
      send({
        type: 'storage', valueKind: kind, valuePath: `${store}.${key}.newValue`,
        value: kind === 'SECRET' ? undefined : value,
        metadata: {
          store, operation: 'setItem', key: kind === 'SECRET' ? '[SENSITIVE KEY]' : key.slice(0, 200),
          previousLength: previous?.length ?? 0, valueLength: value.length,
        },
      });
    };
    storage.removeItem = (key) => {
      const previous = storage.getItem(key);
      originalRemove(key);
      if (phase !== 'IN_FLOW' || config.production) return;
      const removedTokens = tokensOf(key);
      const kind = removedTokens.some((token) => SECRET_TOKENS.includes(token))
        || SECRET_PHRASES.some((phrase) => removedTokens.join('').includes(phrase))
        ? 'SECRET' : 'ORDINARY';
      send({
        type: 'storage', valueKind: kind, valuePath: `${store}.${key}.previousValue`,
        value: kind === 'SECRET' ? undefined : previous ?? undefined,
        metadata: { store, operation: 'removeItem', key: kind === 'SECRET' ? '[SENSITIVE KEY]' : key.slice(0, 200), previousLength: previous?.length ?? 0 },
      });
    };
    storage.clear = () => {
      originalClear();
      if (phase === 'IN_FLOW') send({ type: 'storage', metadata: { store, operation: 'clear' } });
    };
  };
  try { patchStorage(localStorage, 'localStorage'); patchStorage(sessionStorage, 'sessionStorage'); } catch { /* denied */ }

  new MutationObserver(() => { mutationAt = performance.now(); })
    .observe(document, { subtree: true, childList: true, attributes: true });
  /**
   * Route-scoped metric accumulator. SPA navigations reset it and flush the
   * previous route's values, so LCP/CLS/long tasks are attributed to the route
   * they occurred on rather than accumulating globally for the whole session.
   * Entry types the browser does not support are reported explicitly rather
   * than silently defaulting to zero.
   */
  const supportedEntryTypes: string[] = (PerformanceObserver as any)?.supportedEntryTypes ?? [];
  const wanted = ['paint', 'largest-contentful-paint', 'layout-shift', 'longtask', 'event', 'resource'];
  const observedTypes = wanted.filter((type) => supportedEntryTypes.includes(type));
  const unsupportedTypes = wanted.filter((type) => !supportedEntryTypes.includes(type));
  const freshMetrics = () => ({
    lcp: null as number | null,
    fcp: null as number | null,
    cls: observedTypes.includes('layout-shift') ? 0 : null,
    longTasks: observedTypes.includes('longtask') ? 0 : null,
    longestInteractionMs: observedTypes.includes('event') ? 0 : null,
    resourceCount: observedTypes.includes('resource') ? 0 : null,
    transferredBytes: observedTypes.includes('resource') ? 0 : null,
  });
  let metrics = freshMetrics();
  let metricsRoute = location.pathname;

  const flushRouteMetrics = (reason: string) => {
    send({
      type: 'performance',
      metadata: {
        route: metricsRoute,
        reason,
        ...metrics,
        supported: observedTypes.length > 0,
        unsupportedMetrics: unsupportedTypes,
      },
    });
  };
  const resetRouteMetrics = () => {
    metrics = freshMetrics();
    metricsRoute = location.pathname;
  };

  try {
    if (!observedTypes.length) throw new Error('no supported entry types');
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') metrics.lcp = entry.startTime;
        if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') metrics.fcp = entry.startTime;
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          metrics.cls = Number(metrics.cls ?? 0) + (entry as any).value;
        }
        if (entry.entryType === 'longtask') metrics.longTasks = Number(metrics.longTasks ?? 0) + 1;
        if (entry.entryType === 'event') {
          metrics.longestInteractionMs = Math.max(Number(metrics.longestInteractionMs ?? 0), entry.duration);
        }
        if (entry.entryType === 'resource') {
          metrics.resourceCount = Number(metrics.resourceCount ?? 0) + 1;
          metrics.transferredBytes = Number(metrics.transferredBytes ?? 0)
            + ((entry as PerformanceResourceTiming).transferSize || 0);
        }
      }
    }).observe({ entryTypes: observedTypes, ...(observedTypes.includes('event') ? { durationThreshold: 40 } : {}) } as PerformanceObserverInit);
    addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      send({
        type: 'performance',
        metadata: {
          route: location.pathname,
          reason: 'load',
          ...metrics,
          domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
          loadMs: navigation?.loadEventEnd ?? null,
          supported: true,
          unsupportedMetrics: unsupportedTypes,
        },
      });
      scheduleSettled();
    }, { once: true });
  } catch {
    send({
      type: 'performance',
      metadata: { supported: false, reason: 'PerformanceObserver unavailable', unsupportedMetrics: wanted },
    });
  }
  addEventListener('pagehide', () => flushRouteMetrics('pagehide'), { once: true });
  addEventListener('error', (event) => send({
    type: 'runtime_error',
    metadata: {
      message: String((event as ErrorEvent).message || 'Runtime error').slice(0, 2_000),
      source: cleanUrl(String((event as ErrorEvent).filename || '')),
      line: (event as ErrorEvent).lineno,
      column: (event as ErrorEvent).colno,
    },
  }));
  addEventListener('unhandledrejection', (event) => send({
    type: 'runtime_error',
    metadata: {
      message: String((event as PromiseRejectionEvent).reason instanceof Error
        ? (event as PromiseRejectionEvent).reason.message
        : (event as PromiseRejectionEvent).reason).slice(0, 2_000),
      kind: 'unhandledrejection',
    },
  }));

  // Inspect overlay: isolated in a closed ShadowRoot so application styles and
  // DOM queries cannot accidentally change or record it.
  const host = document.createElement('div');
  host.dataset.tellannOverlay = 'true';
  host.style.display = 'none';
  document.documentElement.append(host);
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>:host{all:initial}.outline{position:fixed;pointer-events:none;border:2px solid #22c55e;background:#22c55e18;z-index:2147483646}.panel{position:fixed;right:20px;top:20px;width:340px;z-index:2147483647;background:#0b0f14;color:#f8fafc;border:1px solid #334155;border-radius:12px;padding:16px;font:14px/1.4 system-ui;box-shadow:0 18px 60px #000a}.panel h2{font-size:16px;margin:0 0 4px}.panel p{color:#94a3b8;margin:0 0 10px}.panel textarea,.panel input{box-sizing:border-box;width:100%;background:#111827;color:white;border:1px solid #475569;border-radius:7px;padding:9px;margin:6px 0}.panel button{border:1px solid #475569;background:#1e293b;color:white;border-radius:7px;padding:8px 11px;margin:6px 6px 0 0;cursor:pointer}.panel button.primary{background:#16a34a;border-color:#22c55e}.panel :focus-visible{outline:3px solid #facc15;outline-offset:2px}.chips{display:flex;gap:5px;flex-wrap:wrap}.chip{font-size:12px;background:#334155;padding:4px 7px;border-radius:999px}.results{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}.results button{font-size:12px;padding:4px 7px;margin:0}.shield{position:fixed;inset:0;z-index:2147483645;cursor:crosshair;background:transparent}.live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style><div class="shield" hidden></div><div class="outline" hidden></div><div class="panel" hidden role="dialog" aria-modal="true" aria-labelledby="tellann-title"><h2 id="tellann-title">Annotate selected element</h2><p class="preview"></p><textarea maxlength="2000" rows="5" aria-label="Annotation comment" placeholder="Describe the change or issue"></textarea><input aria-label="Search organization members" placeholder="Mention a teammate"><div class="chips"></div><div class="results" role="listbox" aria-label="Member search results"></div><div><button class="primary">Save annotation</button><button class="reselect">Reselect</button><button class="cancel">Cancel</button></div></div><div class="live" aria-live="polite"></div>`;
  const shield = shadow.querySelector('.shield') as HTMLElement;
  const outline = shadow.querySelector('.outline') as HTMLElement;
  const panel = shadow.querySelector('.panel') as HTMLElement;
  const preview = shadow.querySelector('.preview') as HTMLElement;
  const textarea = shadow.querySelector('textarea')!;
  const search = shadow.querySelector('input')!;
  const chips = shadow.querySelector('.chips')!;
  const results = shadow.querySelector('.results') as HTMLElement;
  const live = shadow.querySelector('.live') as HTMLElement;
  let selected: Element | null = null;
  let mentions: Array<{ id: string; displayName: string }> = [];
  const position = (element: Element | null) => {
    if (!element) { outline.hidden = true; return; }
    const rect = element.getBoundingClientRect();
    Object.assign(outline.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    outline.hidden = false;
  };
  let restoreFocusTo: Element | null = null;
  // The shield stays up for the whole of Inspect mode, including while the
  // annotation panel is open: the panel is a modal dialog, so a click beside it
  // must not fall through and drive the application. The panel sits above the
  // shield in the stacking order, so it remains fully interactive.
  const showShield = () => {
    shield.hidden = mode !== 'INSPECT';
  };
  const cancelInspect = () => {
    panel.hidden = true;
    outline.hidden = true;
    selected = null;
    mentions = [];
    chips.textContent = '';
    results.textContent = '';
    textarea.value = '';
    search.value = '';
    live.textContent = 'Inspection cancelled';
    showShield();
    if (restoreFocusTo instanceof HTMLElement && restoreFocusTo.isConnected) restoreFocusTo.focus();
    restoreFocusTo = null;
  };
  /**
   * Resolves what the user is pointing at without letting the application see
   * the event. The shield sits above the page, so `elementsFromPoint` is used
   * rather than the event target; the overlay host is skipped. For a
   * cross-origin iframe the topmost hit is the `<iframe>` element itself,
   * which is the correct anchor when its content is inaccessible.
   */
  const elementAtPoint = (x: number, y: number): Element | null => {
    const stack = document.elementsFromPoint(x, y);
    for (const candidate of stack) {
      if (candidate.closest('[data-tellann-overlay]')) continue;
      if (candidate === document.documentElement || candidate === document.body) continue;
      // Same-origin frames run their own recorder, so only opaque frames are
      // anchored from the parent document.
      if (candidate instanceof HTMLIFrameElement) {
        try {
          if (candidate.contentDocument) continue;
        } catch { /* cross-origin: anchor to the frame element */ }
      }
      return candidate;
    }
    return stack.find((candidate) => !candidate.closest('[data-tellann-overlay]')) ?? null;
  };
  const describeSelection = (element: Element) =>
    `${element.tagName.toLowerCase()} · ${labelFor(element) || 'unnamed element'} · ${location.pathname}`;
  const selectElement = (element: Element) => {
    selected = element;
    position(element);
    preview.textContent = describeSelection(element);
    panel.hidden = false;
    showShield();
    restoreFocusTo = document.activeElement;
    textarea.focus();
    live.textContent = 'Element selected. Add a comment and optional teammates.';
  };
  shield.addEventListener('mousemove', (event) => {
    if (mode !== 'INSPECT' || !panel.hidden) return;
    position(elementAtPoint(event.clientX, event.clientY));
  });
  shield.addEventListener('click', (event) => {
    if (mode !== 'INSPECT' || !panel.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    const target = elementAtPoint(event.clientX, event.clientY);
    if (target) selectElement(target);
  });
  /**
   * Defence in depth behind the shield. Preventing `click` alone was never
   * enough: menu, dropdown, drag and combobox implementations (Radix,
   * react-aria, most design systems) act on `pointerdown`/`mousedown`, so a
   * press that reached the page would still run application handlers.
   */
  for (const name of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick', 'contextmenu', 'auxclick']) {
    document.addEventListener(name, (event) => {
      if (mode !== 'INSPECT' || !panel.hidden) return;
      const target = (event.composedPath() as EventTarget[]).find((item) => item instanceof Element) as Element | undefined;
      if (target?.closest('[data-tellann-overlay]')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }, true);
  }
  const focusables = () => Array.from(
    panel.querySelectorAll<HTMLElement>('textarea, input, button'),
  ).filter((node) => !node.hasAttribute('disabled'));
  document.addEventListener('keydown', (event) => {
    if (mode !== 'INSPECT') return;
    if (event.key === 'Escape') { event.preventDefault(); cancelInspect(); return; }
    if (event.key === 'Enter' && panel.hidden && document.activeElement instanceof Element) {
      const target = document.activeElement;
      if (target.closest('[data-tellann-overlay]')) return;
      event.preventDefault();
      event.stopPropagation();
      selectElement(target);
    }
  }, true);
  // The annotation panel is a modal dialog, so keyboard focus must not escape
  // back into the page behind it while it is open.
  shadow.addEventListener('keydown', (event) => {
    const key = event as KeyboardEvent;
    if (panel.hidden || key.key !== 'Tab') return;
    const order = focusables();
    if (!order.length) return;
    const active = shadow.activeElement as HTMLElement | null;
    const index = active ? order.indexOf(active) : -1;
    const next = key.shiftKey
      ? order[(index <= 0 ? order.length : index) - 1]
      : order[(index + 1) % order.length];
    key.preventDefault();
    next.focus();
  }, true);
  let searchTimer = 0;
  // Selected mentions and search results render into separate containers:
  // sharing one made an in-progress search visually erase the chips the author
  // had already picked.
  const renderMentions = () => {
    chips.textContent = '';
    for (const mention of mentions) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = `@${mention.displayName}`;
      chips.append(chip);
    }
  };
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(async () => {
      const matches = await invoke(config.members, search.value) as Array<{ id: string; displayName: string }>;
      results.textContent = '';
      for (const member of matches || []) {
        if (mentions.some((item) => item.id === member.id)) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'option');
        button.textContent = `@${member.displayName}`;
        button.onclick = () => {
          if (!mentions.some((item) => item.id === member.id)) mentions.push(member);
          search.value = '';
          results.textContent = '';
          renderMentions();
          live.textContent = `Mentioned ${member.displayName}`;
          search.focus();
        };
        results.append(button);
      }
      live.textContent = `${(matches || []).length} teammate matches`;
    }, 250);
  });
  shadow.querySelector('.cancel')!.addEventListener('click', cancelInspect);
  shadow.querySelector('.reselect')!.addEventListener('click', () => {
    panel.hidden = true;
    selected = null;
    showShield();
    live.textContent = 'Choose another element';
  });
  shadow.querySelector('.primary')!.addEventListener('click', async () => {
    if (!selected || !textarea.value.trim()) {
      live.textContent = 'Enter a comment before saving';
      textarea.focus();
      return;
    }
    const rect = selected.getBoundingClientRect();
    const payload = {
      pageUrl: cleanUrl(location.href),
      normalizedRoute: location.pathname,
      flowStateKey: (globalThis as any).__tellannQaFlowState ?? null,
      scope: phase,
      comment: textarea.value.trim(),
      elementFingerprint: {
        tag: selected.tagName.toLowerCase(), role: selected.getAttribute('role'), accessibleName: labelFor(selected),
        id: (selected as HTMLElement).id || null, testId: selected.getAttribute('data-testid'), cssPath: cssPath(selected),
        frameUrl: cleanUrl(location.href), domFingerprint: `${selected.tagName}:${labelFor(selected)}:${cssPath(selected)}`.slice(0, 200),
      },
      documentBounds: { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height },
      viewportBounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      windowResolution: { innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio },
      screenshotArtifactId: null,
      mentionedUserIds: mentions.map((item) => item.id),
    };
    live.textContent = 'Saving annotation';
    await invoke(config.annotations, payload);
    live.textContent = 'Annotation saved';
    cancelInspect();
  });
  Object.defineProperty(globalThis, '__tellannQaSetPhase', {
    value: (next: typeof phase, stateKey?: string | null) => {
      phase = next;
      (globalThis as any).__tellannQaFlowState = stateKey ?? null;
    },
    configurable: false,
  });
  Object.defineProperty(globalThis, '__tellannQaSetMode', {
    value: (next: typeof mode) => {
      mode = next;
      host.style.display = next === 'INSPECT' ? 'block' : 'none';
      document.documentElement.style.cursor = next === 'INSPECT' ? 'crosshair' : '';
      if (next === 'NAVIGATE') cancelInspect();
      else live.textContent = 'Inspect mode active. Point to an element and click, or focus it and press Enter.';
      showShield();
    },
    configurable: false,
  });
  Object.defineProperty(globalThis, '__tellannQaScreenshotMode', {
    value: (active: boolean) => {
      panel.style.visibility = active ? 'hidden' : '';
      outline.style.visibility = active ? 'hidden' : '';
    },
    configurable: false,
  });
  send({
    type: 'viewport',
    metadata: {
      innerWidth, innerHeight, outerWidth, outerHeight,
      screenWidth: screen.width, screenHeight: screen.height,
      devicePixelRatio, orientation: screen.orientation?.type ?? null,
    },
  });
  emitRoute('document');
}
