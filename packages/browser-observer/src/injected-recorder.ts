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
  /** Takes the annotation's screenshot as an element is picked, before the dialog opens. */
  snapshot: string;
  /** Returns every annotation on the current route, for restoring pins after a reload/navigation. */
  annotationsList: string;
  annotationsUpdate: string;
  annotationsDelete: string;
  annotationsResolve: string;
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
  const scheduleSettled = (trigger: 'route' | 'interaction' = 'route') => {
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
          trigger,
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
    // Re-fetch and redraw this route's annotation pins on every navigation —
    // reusing this hook (rather than a second listener set) is what makes SPA
    // navigation "just work" for restore, since emitRoute already fires on
    // pushState/replaceState/popstate/hashchange and the initial document.
    void loadAnnotations();
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
    resizeTimer = window.setTimeout(() => {
      repositionAllPins();
      send({
        type: 'viewport',
        metadata: {
          innerWidth, innerHeight, outerWidth, outerHeight,
          screenWidth: screen.width, screenHeight: screen.height,
          devicePixelRatio, orientation: screen.orientation?.type ?? null,
        },
      });
    }, 200);
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
    // Most state changes in an app never touch the URL — a modal opens, a tab
    // switches, validation appears. Running the same settle detector a route
    // change uses means those moments produce a `performance` event too, which
    // is what the observer screenshots on.
    scheduleSettled('interaction');
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
    // A submit that stays on the page still changes it — a success banner, an
    // inline error, a cleared form. Settle and let the observer capture it.
    scheduleSettled('interaction');
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
  /**
   * Interaction latencies for this route, newest first. INP is the 98th
   * percentile of them, which is what the metric is actually defined as: the
   * single longest interaction is noise on a page with hundreds of them, and
   * reporting that as "worst interaction" overstated the problem.
   */
  let interactionDurations: number[] = [];
  const percentileInteraction = (): number | null => {
    if (!interactionDurations.length) return null;
    const sorted = [...interactionDurations].sort((a, b) => b - a);
    // web-vitals discards one interaction per 50, floor-capped at the worst.
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length / 50));
    return Math.round(sorted[index]);
  };
  const freshMetrics = () => ({
    lcp: null as number | null,
    fcp: null as number | null,
    cls: observedTypes.includes('layout-shift') ? 0 : null,
    longTasks: observedTypes.includes('longtask') ? 0 : null,
    /** Total blocking time contributed by long tasks, in milliseconds. */
    longTaskMs: observedTypes.includes('longtask') ? 0 : null,
    /** Where the browser attributed the worst long task, when it says. */
    longestTaskMs: observedTypes.includes('longtask') ? 0 : null,
    longestTaskAttribution: null as string | null,
    longestInteractionMs: observedTypes.includes('event') ? 0 : null,
    /** Interaction to Next Paint for this route. */
    inpMs: observedTypes.includes('event') ? null as number | null : null,
    interactionCount: observedTypes.includes('event') ? 0 : null,
    resourceCount: observedTypes.includes('resource') ? 0 : null,
    transferredBytes: observedTypes.includes('resource') ? 0 : null,
    /** Resources the browser reported with a zero-length body, i.e. failures. */
    failedResourceCount: observedTypes.includes('resource') ? 0 : null,
    /** Seconds this route spent hidden, which invalidates paint timings. */
    hiddenMs: 0,
  });
  let metrics = freshMetrics();
  let metricsRoute = location.pathname;
  let hiddenSince: number | null = document.visibilityState === 'hidden' ? performance.now() : null;

  const settleHidden = () => {
    if (hiddenSince === null) return;
    metrics.hiddenMs += performance.now() - hiddenSince;
    hiddenSince = null;
  };

  const flushRouteMetrics = (reason: string) => {
    settleHidden();
    if (document.visibilityState === 'hidden') hiddenSince = performance.now();
    send({
      type: 'performance',
      metadata: {
        route: metricsRoute,
        reason,
        ...metrics,
        inpMs: percentileInteraction(),
        hiddenMs: Math.round(metrics.hiddenMs),
        supported: observedTypes.length > 0,
        unsupportedMetrics: unsupportedTypes,
      },
    });
  };
  const resetRouteMetrics = () => {
    metrics = freshMetrics();
    interactionDurations = [];
    hiddenSince = document.visibilityState === 'hidden' ? performance.now() : null;
    metricsRoute = location.pathname;
  };

  // A route that spent time in a background tab has meaningless paint timings,
  // so the reader needs to know that rather than seeing an unexplained 30s LCP.
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenSince = performance.now();
    else settleHidden();
  });

  /**
   * The navigation timing breakdown. `domContentLoaded` and `load` alone cannot
   * separate "the server was slow" from "our bundle was slow", which is the
   * first question anyone asks about a slow route.
   */
  const navigationBreakdown = () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!navigation) return {};
    const round = (value: number | undefined) => (value == null || Number.isNaN(value) ? null : Math.round(value));
    return {
      domContentLoadedMs: round(navigation.domContentLoadedEventEnd),
      loadMs: round(navigation.loadEventEnd),
      ttfbMs: round(navigation.responseStart),
      requestMs: round(navigation.responseStart - navigation.requestStart),
      responseMs: round(navigation.responseEnd - navigation.responseStart),
      dnsMs: round(navigation.domainLookupEnd - navigation.domainLookupStart),
      tcpMs: round(navigation.connectEnd - navigation.connectStart),
      tlsMs: navigation.secureConnectionStart
        ? round(navigation.connectEnd - navigation.secureConnectionStart)
        : null,
      redirectCount: navigation.redirectCount,
      redirectMs: round(navigation.redirectEnd - navigation.redirectStart),
      domInteractiveMs: round(navigation.domInteractive),
      transferSize: navigation.transferSize ?? null,
      encodedBodySize: navigation.encodedBodySize ?? null,
      navigationType: navigation.type,
    };
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
        if (entry.entryType === 'longtask') {
          metrics.longTasks = Number(metrics.longTasks ?? 0) + 1;
          // Blocking time is what the main thread stole from the user, which is
          // the part of a long task that actually hurts.
          metrics.longTaskMs = Number(metrics.longTaskMs ?? 0) + Math.max(0, entry.duration - 50);
          if (entry.duration > Number(metrics.longestTaskMs ?? 0)) {
            metrics.longestTaskMs = Math.round(entry.duration);
            const attribution = (entry as any).attribution?.[0];
            metrics.longestTaskAttribution = attribution
              ? String(attribution.containerType === 'window'
                ? attribution.name || 'window'
                : `${attribution.containerType}:${attribution.containerName || attribution.containerId || attribution.containerSrc || 'unnamed'}`).slice(0, 200)
              : null;
          }
        }
        if (entry.entryType === 'event') {
          metrics.interactionCount = Number(metrics.interactionCount ?? 0) + 1;
          metrics.longestInteractionMs = Math.max(Number(metrics.longestInteractionMs ?? 0), entry.duration);
          interactionDurations.push(entry.duration);
          // Unbounded growth on a long-lived SPA route would leak; the tail is
          // all the percentile needs.
          if (interactionDurations.length > 500) interactionDurations.shift();
        }
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming;
          metrics.resourceCount = Number(metrics.resourceCount ?? 0) + 1;
          metrics.transferredBytes = Number(metrics.transferredBytes ?? 0) + (resource.transferSize || 0);
          // A resource that transferred nothing and decoded to nothing did not
          // arrive: a broken image or font that no network panel filter catches.
          if (!resource.transferSize && !resource.decodedBodySize && resource.responseEnd > 0) {
            metrics.failedResourceCount = Number(metrics.failedResourceCount ?? 0) + 1;
          }
        }
      }
    }).observe({ entryTypes: observedTypes, ...(observedTypes.includes('event') ? { durationThreshold: 40 } : {}) } as PerformanceObserverInit);
    addEventListener('load', () => {
      send({
        type: 'performance',
        metadata: {
          route: location.pathname,
          reason: 'load',
          ...metrics,
          inpMs: percentileInteraction(),
          hiddenMs: Math.round(metrics.hiddenMs),
          ...navigationBreakdown(),
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
  // Unlike the old single-shot overlay, this one stays mounted (never
  // display:none) regardless of mode: persisted pins must keep showing in
  // Navigate too, so reviewing existing feedback doesn't require re-entering
  // Inspect mode. Only the shield/outline/tooltip/pill/badge are mode-gated.
  const mountHost = () => {
    if (host.isConnected || !document.documentElement) return;
    document.documentElement.append(host);
  };
  mountHost();
  if (!host.isConnected) document.addEventListener('DOMContentLoaded', mountHost, { once: true });
  const shadow = host.attachShadow({ mode: 'closed' });
  // The overlay lives in a page the desktop app only hosts, so it cannot load
  // theme.css. The tokens below mirror it one for one (including the light
  // scheme and the Windows accent default) so Inspect mode reads as part of
  // the desktop shell rather than as part of the application under test.
  // `--pin` is a dedicated turquoise, distinct from `--accent` blue: hover
  // highlight stays blue, frozen/placed annotation markers are turquoise.
  shadow.innerHTML = `<style>
    :host{all:initial;color-scheme:dark;--font-ui:"Segoe UI Variable Text","Segoe UI Variable","Segoe UI",system-ui,sans-serif;--font-display:"Segoe UI Variable Display","Segoe UI Variable","Segoe UI",system-ui,sans-serif;--font-mono:"Cascadia Mono","Cascadia Code",Consolas,"Courier New",monospace;--accent:#4cc2ff;--on-accent:#000;--pin:#2dd4bf;--pin-on:#07312c;--surface-0:#1b1b1b;--surface-1:#262626;--surface-2:#2e2e2e;--text-strong:#fff;--text:#d6d6d6;--text-muted:#a3a3a3;--text-subtle:#7c7c7c;--border-subtle:#2a2a2a;--border:#353535;--border-strong:#4c4c4c;--overlay-rgb:255 255 255;--shadow-k:1;--control-height:30px;--radius:4px;--radius-lg:8px;--ease:cubic-bezier(.2,0,0,1)}
    @media(prefers-color-scheme:light){:host{color-scheme:light;--accent:#0067c0;--on-accent:#fff;--pin:#0d9488;--pin-on:#fff;--surface-0:#fbfbfb;--surface-1:#fff;--surface-2:#f0f0f0;--text-strong:#1a1a1a;--text:#303030;--text-muted:#5c5c5c;--text-subtle:#878787;--border-subtle:#ededed;--border:#e0e0e0;--border-strong:#c4c4c4;--overlay-rgb:0 0 0;--shadow-k:.3}}
    .outline{position:fixed;pointer-events:none;border:1px solid var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent);border-radius:2px;z-index:2147483646}.shield{position:fixed;inset:0;z-index:2147483645;cursor:crosshair;background:transparent}.shield.modal-open{cursor:default;background:rgb(0 0 0/calc(.1 + .4*var(--shadow-k)))}
    .tooltip{position:fixed;pointer-events:none;z-index:2147483646;max-width:280px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-1);box-shadow:0 8px 20px rgb(0 0 0/calc(.3*var(--shadow-k)))}
    .tooltip .tag{color:var(--accent);font:600 11px var(--font-mono)}.tooltip .meta{margin-top:2px;color:var(--text-muted);font:11px/1.4 var(--font-mono);overflow-wrap:anywhere}
    .pin{position:fixed;width:22px;height:22px;margin:-11px 0 0 -11px;padding:0;border:2px solid var(--on-accent);border-radius:50%;background:var(--pin);color:var(--pin-on);font:700 12px/1 var(--font-ui);display:flex;align-items:center;justify-content:center;cursor:default;z-index:2147483646;box-shadow:0 2px 8px rgb(0 0 0/calc(.35*var(--shadow-k)))}
    .pin.resolved{opacity:.55}.pin.orphaned{border-style:dashed}
    .badge{position:fixed;top:14px;right:14px;display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:var(--surface-1);border:1px solid var(--border);color:var(--text);font:600 11px/1 var(--font-ui);z-index:2147483647;box-shadow:0 8px 20px rgb(0 0 0/calc(.3*var(--shadow-k)))}
    .badge-dot{width:7px;height:7px;border-radius:50%;background:var(--pin);animation:badge-pulse 1.4s ease-in-out infinite}@keyframes badge-pulse{0%,100%{opacity:1}50%{opacity:.35}}
    .pill,.pill *{box-sizing:border-box}
    .pill{position:fixed;z-index:2147483647;min-width:272px;max-width:min(380px,calc(100vw - 32px));padding:7px;border:1px solid var(--border);border-radius:999px;background:color-mix(in srgb,var(--surface-1) 95%,transparent);backdrop-filter:blur(18px) saturate(1.5);-webkit-backdrop-filter:blur(18px) saturate(1.5);color:var(--text);font:13px/1.4 var(--font-ui);box-shadow:0 0 0 1px rgb(0 0 0/calc(.03*var(--shadow-k))),0 2px 6px rgb(0 0 0/calc(.1*var(--shadow-k))),0 16px 40px rgb(0 0 0/calc(.32*var(--shadow-k)));transition:border-radius .22s var(--ease),box-shadow .22s var(--ease),left .14s var(--ease),top .14s var(--ease);animation:dialog-in .22s cubic-bezier(.16,1,.3,1)}
    @keyframes dialog-in{from{opacity:0;transform:translateY(-6px) scale(.96)}}
    .pill.expanded{border-radius:var(--radius-lg)}
    .pill-bar{display:flex;align-items:center;gap:4px}
    .pill-input{flex:1;min-width:0;height:var(--control-height);padding:0 12px;border:0;border-radius: 9999px 0 0 9999px;background:transparent;color:var(--text-strong);font:13px/1.4 var(--font-ui);outline:none}
    .pill-input::placeholder{color:var(--text-subtle)}
    .pill button{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 auto;border:0;border-radius:50%;background:transparent;color:var(--text-muted);font:600 13px var(--font-ui);cursor:default;transition:background-color .14s var(--ease),color .14s var(--ease),transform .1s var(--ease)}
    .pill button:hover:not(:disabled){background:rgb(var(--overlay-rgb)/.08)}
    .pill button:active:not(:disabled){transform:scale(.88)}
    .pill button:disabled{opacity:.5;cursor:wait}
    .pill-save{background:var(--pin);color:var(--pin-on);box-shadow:0 1px 2px rgb(0 0 0/calc(.18*var(--shadow-k)))}
    .pill-save:hover:not(:disabled){background:var(--pin);filter:brightness(1.1)}
    .pill-mention-box{padding:4px 9px 0}
    .pill-mention-box[hidden]{display:none}
    .pill-mention-input{width:100%;height:28px;padding:0 10px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface-0);color:var(--text-strong);font:12px var(--font-ui);outline:none;transition:border-color .14s var(--ease),box-shadow .14s var(--ease)}
    .pill-mention-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
    .pill-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 9px}
    .pill-chips:empty{display:none}
    .pill-chips .chip{padding:3px 9px;border-radius:999px;background:rgb(var(--overlay-rgb)/.07);color:var(--text-muted);font:11px var(--font-ui);animation:pop-in .15s var(--ease)}
    @keyframes pop-in{from{opacity:0;transform:scale(.85)}}
    .pill-results{display:flex;flex-direction:column;gap:2px;margin:4px 9px 0;padding:4px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface-0);box-shadow:0 10px 24px rgb(0 0 0/calc(.2*var(--shadow-k)))}
    .pill-results:empty{display:none}
    .pill-results button{width:auto;height:28px;border-radius:var(--radius);justify-content:flex-start;padding:0 10px;color:var(--text);transition:background-color .1s var(--ease)}
    .pill-results button:hover:not(:disabled){background:rgb(var(--overlay-rgb)/.07)}
    .pill-meta{padding:4px 11px 0;color:var(--text-subtle);font:11px/1.4 var(--font-ui)}
    .pill-meta:empty{display:none}
    .pill-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:6px;padding:7px 9px 0;border-top:1px solid var(--border-subtle)}
    .pill-actions[hidden]{display:none}
    .pill-actions button{width:auto;height:28px;padding:0 11px;border-radius:var(--radius-lg);font:500 11px var(--font-ui);transition:background-color .14s var(--ease)}
    .pill-actions button:hover:not(:disabled){background:rgb(var(--overlay-rgb)/.08)}
    .pill-actions .pill-delete{color:#f87171}
    .live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
    :focus-visible{outline:2px solid var(--accent);outline-offset:1px}
    .sidebar-toggle{position:fixed;bottom:18px;right:18px;z-index:2147483647;display:flex;align-items:center;justify-content:center;min-width:34px;height:34px;padding:0 8px;border:2px solid var(--on-accent);border-radius:17px;background:var(--pin);color:var(--pin-on);font:700 12px var(--font-ui);box-shadow:0 8px 20px rgb(0 0 0/calc(.3*var(--shadow-k)))}
    .sidebar-toggle[hidden]{display:none}
    .sidebar{position:fixed;top:0;right:0;bottom:0;z-index:2147483647;width:300px;max-width:calc(100vw - 24px);display:flex;flex-direction:column;background:var(--surface-1);border-left:1px solid var(--border);box-shadow:-16px 0 40px rgb(0 0 0/calc(.35*var(--shadow-k)))}
    .sidebar[hidden]{display:none}
    .sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border-subtle);color:var(--text-strong);font:600 13px/1.2 var(--font-ui)}
    .sidebar-list{flex:1;overflow:auto;padding:6px}
    .sidebar-empty{padding:16px 14px;color:var(--text-subtle);font:12px/1.5 var(--font-ui)}
    .sidebar-row{display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;margin-bottom:2px;padding:8px 10px;border:0;border-radius:var(--radius);background:transparent;color:var(--text);text-align:left;font:12px var(--font-ui)}
    .sidebar-row:hover{background:rgb(var(--overlay-rgb)/.06)}
    .sidebar-row.resolved{opacity:.6}
    .sidebar-row-comment{color:var(--text-strong);font-weight:600;overflow-wrap:anywhere}
    .sidebar-row-meta{color:var(--text-subtle);font-size:11px}
    @media(prefers-reduced-motion:reduce){.pill{animation:none;transition:none}.pill button,.badge-dot,.pill-chips .chip,.pill-mention-input,.pill-results button,.pill-actions button{animation:none;transition:none}}
  </style><div class="shield" hidden></div><div class="outline" hidden></div><div class="tooltip" hidden><div class="tag"></div><div class="meta"></div></div><div class="pins"></div><div class="pill" hidden role="dialog" aria-modal="true" aria-label="Annotate selected element"><div class="pill-bar"><input class="pill-input" type="text" maxlength="2000" placeholder="Add a comment…" aria-label="Annotation comment"><button class="pill-mention-btn" type="button" aria-label="Mention a teammate" title="Mention a teammate">@</button><button class="pill-save" type="button" aria-label="Save annotation">✓</button></div><div class="pill-mention-box" hidden><input class="pill-mention-input" type="text" placeholder="Search teammates…" aria-label="Search organization members"></div><div class="pill-chips"></div><div class="pill-results" role="listbox" aria-label="Member search results"></div><div class="pill-meta"></div><div class="pill-actions" hidden><button class="pill-resolve" type="button">Resolve</button><button class="pill-delete" type="button">Delete</button><button class="pill-cancel" type="button">Cancel</button></div></div><div class="badge" hidden><span class="badge-dot"></span>Annotating</div><button class="sidebar-toggle" type="button" aria-label="Review annotations on this page" hidden><span class="sidebar-toggle-count">0</span></button><aside class="sidebar" hidden aria-label="Annotations on this page"><div class="sidebar-header"><span>Annotations on this page</span><button class="sidebar-close" type="button" aria-label="Close annotations panel">✕</button></div><div class="sidebar-list"></div></aside><div class="live" aria-live="polite"></div>`;
  const shield = shadow.querySelector('.shield') as HTMLElement;
  const outline = shadow.querySelector('.outline') as HTMLElement;
  const tooltip = shadow.querySelector('.tooltip') as HTMLElement;
  const tooltipTag = shadow.querySelector('.tooltip .tag') as HTMLElement;
  const tooltipMeta = shadow.querySelector('.tooltip .meta') as HTMLElement;
  const pinsLayer = shadow.querySelector('.pins') as HTMLElement;
  const pill = shadow.querySelector('.pill') as HTMLElement;
  const pillInput = shadow.querySelector('.pill-input') as HTMLInputElement;
  const mentionButton = shadow.querySelector('.pill-mention-btn') as HTMLButtonElement;
  const mentionBox = shadow.querySelector('.pill-mention-box') as HTMLElement;
  const mentionInput = shadow.querySelector('.pill-mention-input') as HTMLInputElement;
  const pillChips = shadow.querySelector('.pill-chips') as HTMLElement;
  const pillResults = shadow.querySelector('.pill-results') as HTMLElement;
  const pillMeta = shadow.querySelector('.pill-meta') as HTMLElement;
  const pillActions = shadow.querySelector('.pill-actions') as HTMLElement;
  const resolveButton = shadow.querySelector('.pill-resolve') as HTMLButtonElement;
  const deleteButton = shadow.querySelector('.pill-delete') as HTMLButtonElement;
  const cancelButton = shadow.querySelector('.pill-cancel') as HTMLButtonElement;
  const saveButton = shadow.querySelector('.pill-save') as HTMLButtonElement;
  const badge = shadow.querySelector('.badge') as HTMLElement;
  const sidebarToggle = shadow.querySelector('.sidebar-toggle') as HTMLButtonElement;
  const sidebarToggleCount = shadow.querySelector('.sidebar-toggle-count') as HTMLElement;
  const sidebar = shadow.querySelector('.sidebar') as HTMLElement;
  const sidebarList = shadow.querySelector('.sidebar-list') as HTMLElement;
  const sidebarCloseButton = shadow.querySelector('.sidebar-close') as HTMLButtonElement;
  const live = shadow.querySelector('.live') as HTMLElement;
  const pillButtons = () => Array.from(pill.querySelectorAll('button')) as HTMLButtonElement[];
  let selected: Element | null = null;
  let editing: Record<string, any> | null = null;
  let saving = false;
  let mentions: Array<{ id: string; displayName: string }> = [];
  const position = (element: Element | null) => {
    if (!element) { outline.hidden = true; return; }
    const rect = element.getBoundingClientRect();
    Object.assign(outline.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    outline.hidden = false;
  };
  // No image/CSS library is available in this package (same constraint that
  // forces the hand-rolled PNG masking in silent-capture.ts) so computed
  // colors are hex-encoded by hand for the hover tooltip.
  const rgbToHex = (value: string) => {
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match) return value;
    const [r, g, b, a] = match[1].split(',').map((part) => parseFloat(part.trim()));
    if (a === 0) return 'transparent';
    return `#${[r, g, b].map((channel) => Math.max(0, Math.min(255, Math.round(channel || 0))).toString(16).padStart(2, '0')).join('')}`;
  };
  const positionTooltip = (element: Element | null, x: number, y: number) => {
    if (!element) { tooltip.hidden = true; return; }
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    tooltipTag.textContent = element.tagName.toLowerCase();
    const family = style.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    tooltipMeta.textContent = `${Math.round(rect.width)}×${Math.round(rect.height)} · ${rgbToHex(style.color)} · ${style.fontSize} ${family}`;
    const left = Math.max(8, Math.min(x + 14, innerWidth - 300));
    const top = y + 18 > innerHeight - 60 ? Math.max(8, y - 54) : y + 18;
    Object.assign(tooltip.style, { left: `${left}px`, top: `${top}px` });
    tooltip.hidden = false;
  };
  let restoreFocusTo: Element | null = null;
  // The shield stays up for the whole of Inspect mode, including while the
  // pill composer is open: the pill is a modal-ish dialog, so a click beside
  // it must not fall through and drive the application. The pill sits above
  // the shield in the stacking order, so it remains fully interactive.
  const showShield = () => {
    shield.hidden = mode !== 'INSPECT';
    shield.classList.toggle('modal-open', !pill.hidden);
  };
  const resetPillFields = () => {
    pillInput.value = '';
    mentions = [];
    pillChips.textContent = '';
    pillResults.textContent = '';
    mentionBox.hidden = true;
    pillMeta.textContent = '';
    pill.classList.remove('expanded');
  };
  const closePill = () => {
    pill.hidden = true;
    pillActions.hidden = true;
    outline.hidden = true;
    selected = null;
    editing = null;
    resetPillFields();
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
  // Flips/clamps so the pill never renders off-screen; a second pass measures
  // its actual rendered size once shown, since width varies with content.
  const positionPill = (rect: { left: number; top: number; bottom: number }) => {
    Object.assign(pill.style, { left: `${Math.max(12, rect.left)}px`, top: `${Math.max(12, rect.bottom + 10)}px` });
    requestAnimationFrame(() => {
      const box = pill.getBoundingClientRect();
      let left = box.left;
      let top = box.top;
      if (box.right > innerWidth - 12) left -= box.right - (innerWidth - 12);
      if (box.bottom > innerHeight - 12) top = Math.max(12, rect.top - box.height - 10);
      Object.assign(pill.style, { left: `${Math.max(12, left)}px`, top: `${Math.max(12, top)}px` });
    });
  };
  const openPillForCreate = (element: Element) => {
    editing = null;
    selected = element;
    resetPillFields();
    pillActions.hidden = true;
    pill.classList.remove('expanded');
    pill.hidden = false;
    positionPill(element.getBoundingClientRect());
    showShield();
    restoreFocusTo = document.activeElement;
    pillInput.focus();
    live.textContent = 'Element selected. Add a comment and optional teammates.';
  };
  const openPillForEdit = (annotation: Record<string, any>) => {
    selected = null;
    editing = annotation;
    pillInput.value = String(annotation.comment ?? '');
    mentions = (Array.isArray(annotation.mentions) ? annotation.mentions : [])
      .map((item: any) => ({ id: item.userId, displayName: item.displayNameSnapshot }));
    pillChips.textContent = '';
    for (const mention of mentions) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = `@${mention.displayName}`;
      pillChips.append(chip);
    }
    pillResults.textContent = '';
    mentionBox.hidden = true;
    const author = annotation.author?.displayName ? `By ${annotation.author.displayName}` : '';
    pillMeta.textContent = annotation.resolved ? `${author}${author ? ' · ' : ''}Resolved` : author;
    pillActions.hidden = false;
    resolveButton.textContent = annotation.resolved ? 'Unresolve' : 'Resolve';
    pill.classList.add('expanded');
    pill.hidden = false;
    const target = pinTargets.get(annotation.id);
    const anchor = (target && target.isConnected) ? target.getBoundingClientRect() : pinButtons.get(annotation.id)?.getBoundingClientRect();
    if (anchor) positionPill(anchor);
    showShield();
    restoreFocusTo = document.activeElement;
    pillInput.focus();
    live.textContent = 'Reviewing annotation.';
  };
  const describeSelection = (element: Element) =>
    `${element.tagName.toLowerCase()} · ${labelFor(element) || 'unnamed element'} · ${location.pathname}`;
  // True while the picture for a picked element is being taken. The composer
  // stays closed until it is done, so the picture is of the page rather than
  // of the composer, and it never has to be hidden again at save time.
  let picking = false;
  const selectElement = async (element: Element) => {
    if (picking) return;
    picking = true;
    position(element);
    try { await invoke(config.snapshot); } catch { /* the save takes its own picture instead */ }
    picking = false;
    if (mode !== 'INSPECT') return;
    openPillForCreate(element);
  };
  shield.addEventListener('mousemove', (event) => {
    if (mode !== 'INSPECT' || !pill.hidden || picking) { tooltip.hidden = true; return; }
    const target = elementAtPoint(event.clientX, event.clientY);
    position(target);
    positionTooltip(target, event.clientX, event.clientY);
  });
  shield.addEventListener('mouseleave', () => { tooltip.hidden = true; });
  shield.addEventListener('click', (event) => {
    if (mode !== 'INSPECT' || !pill.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    if (picking) return;
    const target = elementAtPoint(event.clientX, event.clientY);
    if (target) { tooltip.hidden = true; void selectElement(target); }
  });
  /**
   * Defence in depth behind the shield. Preventing `click` alone was never
   * enough: menu, dropdown, drag and combobox implementations (Radix,
   * react-aria, most design systems) act on `pointerdown`/`mousedown`, so a
   * press that reached the page would still run application handlers.
   */
  for (const name of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick', 'contextmenu', 'auxclick']) {
    document.addEventListener(name, (event) => {
      if (mode !== 'INSPECT' || !pill.hidden) return;
      // Scan the whole composed path rather than calling `.closest()` on just
      // the innermost target: `.closest()` cannot cross a shadow boundary, so
      // for an event whose real target lives inside the overlay's own shadow
      // root (e.g. a click on `.shield` itself), `.closest()` from that
      // target would never find the host's `data-tellann-overlay` attribute
      // and this guard would wrongly swallow the overlay's own interactions.
      // The host element is always present later in the composed path
      // (shadow-internal nodes always flow out into their host's own
      // ancestry), so scanning the array finds it regardless.
      const path = event.composedPath() as EventTarget[];
      const insideOverlay = path.some((item) => item instanceof Element && item.hasAttribute('data-tellann-overlay'));
      if (insideOverlay) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }, true);
  }
  const focusables = () => Array.from(
    pill.querySelectorAll<HTMLElement>('input, button'),
  ).filter((node) => !node.hasAttribute('disabled') && node.offsetParent !== null);
  document.addEventListener('keydown', (event) => {
    if (mode !== 'INSPECT') return;
    if (event.key === 'Escape') { event.preventDefault(); closePill(); return; }
    if (event.key === 'Enter' && pill.hidden && document.activeElement instanceof Element) {
      const target = document.activeElement;
      if (target.closest('[data-tellann-overlay]')) return;
      event.preventDefault();
      event.stopPropagation();
      void selectElement(target);
    }
  }, true);
  // The pill composer is a modal-ish dialog, so keyboard focus must not escape
  // back into the page behind it while it is open.
  shadow.addEventListener('keydown', (event) => {
    const key = event as KeyboardEvent;
    if (pill.hidden || key.key !== 'Tab') return;
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
  let mentionSearchTimer = 0;
  const runMentionSearch = (query: string) => {
    clearTimeout(mentionSearchTimer);
    mentionSearchTimer = window.setTimeout(async () => {
      const matches = await invoke(config.members, query) as Array<{ id: string; displayName: string }>;
      pillResults.textContent = '';
      for (const member of matches || []) {
        if (mentions.some((item) => item.id === member.id)) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'option');
        button.textContent = `@${member.displayName}`;
        button.onclick = () => {
          mentions.push(member);
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = `@${member.displayName}`;
          pillChips.append(chip);
          pillResults.textContent = '';
          mentionInput.value = '';
          mentionInput.focus();
          live.textContent = `Mentioned ${member.displayName}`;
          pill.classList.add('expanded');
        };
        pillResults.append(button);
      }
      live.textContent = `${(matches || []).length} teammate matches`;
    }, 250);
  };
  mentionButton.addEventListener('click', () => {
    const opening = mentionBox.hidden;
    mentionBox.hidden = !opening;
    if (opening) {
      pill.classList.add('expanded');
      mentionInput.value = '';
      pillResults.textContent = '';
      mentionInput.focus();
      runMentionSearch('');
    } else {
      pillResults.textContent = '';
      if (!mentions.length) pill.classList.remove('expanded');
    }
  });
  mentionInput.addEventListener('input', () => runMentionSearch(mentionInput.value));
  cancelButton.addEventListener('click', closePill);
  saveButton.addEventListener('click', async () => {
    if (saving) return;
    if (editing) {
      if (!pillInput.value.trim()) { live.textContent = 'Enter a comment before saving'; pillInput.focus(); return; }
      saving = true;
      pillButtons().forEach((button) => { button.disabled = true; });
      live.textContent = 'Saving changes';
      try {
        const updated = await invoke(config.annotationsUpdate, editing.id, {
          comment: pillInput.value.trim(),
          mentionedUserIds: mentions.map((item) => item.id),
        }) as Record<string, any>;
        if (updated?.id) renderPin(updated);
        live.textContent = 'Annotation updated';
        closePill();
      } catch {
        live.textContent = 'Could not save changes. Try again.';
      } finally {
        saving = false;
        pillButtons().forEach((button) => { button.disabled = false; });
      }
      return;
    }
    if (!selected || !pillInput.value.trim()) {
      live.textContent = 'Enter a comment before saving';
      pillInput.focus();
      return;
    }
    const rect = selected.getBoundingClientRect();
    const payload = {
      pageUrl: cleanUrl(location.href),
      normalizedRoute: location.pathname,
      flowStateKey: (globalThis as any).__tellannQaFlowState ?? null,
      scope: phase,
      comment: pillInput.value.trim(),
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
    saving = true;
    pillButtons().forEach((button) => { button.disabled = true; });
    live.textContent = 'Saving annotation';
    try {
      const saved = await invoke(config.annotations, payload) as Record<string, any>;
      if (saved?.id) renderPin(saved);
      live.textContent = 'Annotation saved';
      closePill();
    } catch {
      live.textContent = 'Annotation could not be saved. Try again.';
      pillInput.focus();
    } finally {
      saving = false;
      pillButtons().forEach((button) => { button.disabled = false; });
    }
  });
  deleteButton.addEventListener('click', async () => {
    if (saving || !editing) return;
    const id = editing.id;
    saving = true;
    pillButtons().forEach((button) => { button.disabled = true; });
    live.textContent = 'Deleting annotation';
    try {
      await invoke(config.annotationsDelete, id);
      removePin(id);
      live.textContent = 'Annotation deleted';
      closePill();
    } catch {
      live.textContent = 'Could not delete. Try again.';
    } finally {
      saving = false;
      pillButtons().forEach((button) => { button.disabled = false; });
    }
  });
  resolveButton.addEventListener('click', async () => {
    if (saving || !editing) return;
    const next = !editing.resolved;
    saving = true;
    pillButtons().forEach((button) => { button.disabled = true; });
    live.textContent = next ? 'Marking resolved' : 'Reopening annotation';
    try {
      const updated = await invoke(config.annotationsResolve, editing.id, next) as Record<string, any>;
      if (updated?.id) {
        editing = updated;
        renderPin(updated);
        resolveButton.textContent = updated.resolved ? 'Unresolve' : 'Resolve';
        const author = updated.author?.displayName ? `By ${updated.author.displayName}` : '';
        pillMeta.textContent = updated.resolved ? `${author}${author ? ' · ' : ''}Resolved` : author;
      }
      live.textContent = next ? 'Marked resolved' : 'Reopened';
    } catch {
      live.textContent = 'Could not update. Try again.';
    } finally {
      saving = false;
      pillButtons().forEach((button) => { button.disabled = false; });
    }
  });

  // --- Persistent annotation pins: restore after reload/navigation, reposition
  // on scroll/resize, relocate by fingerprint when the DOM has changed. ---
  const pinButtons = new Map<string, HTMLButtonElement>();
  const pinTargets = new Map<string, Element | null>();
  const pinData = new Map<string, Record<string, any>>();
  const relocate = (fingerprint: any): Element | null => {
    try {
      if (fingerprint?.cssPath) {
        const matches = document.querySelectorAll(fingerprint.cssPath);
        if (matches.length === 1) return matches[0];
      }
    } catch { /* a selector built against a page that has since changed shape */ }
    if (fingerprint?.testId) {
      try {
        const match = document.querySelector(`[data-testid="${CSS.escape(fingerprint.testId)}"]`);
        if (match) return match;
      } catch { /* ignore */ }
    }
    if (fingerprint?.id) {
      const match = document.getElementById(fingerprint.id);
      if (match) return match;
    }
    return null;
  };
  const positionPinAt = (button: HTMLButtonElement, target: Element | null, orphanSlot: number) => {
    if (target && target.isConnected) {
      const rect = target.getBoundingClientRect();
      Object.assign(button.style, { left: `${rect.left}px`, top: `${rect.top}px` });
    } else {
      Object.assign(button.style, { left: '18px', top: `${innerHeight - 40 - orphanSlot * 30}px` });
    }
  };
  const reindexOrphans = () => {
    let slot = 0;
    for (const [id, button] of pinButtons) {
      if (!pinTargets.get(id)) { positionPinAt(button, null, slot); slot += 1; }
    }
  };
  function renderPin(annotation: Record<string, any>) {
    pinData.set(annotation.id, annotation);
    const target = relocate(annotation.elementFingerprint);
    pinTargets.set(annotation.id, target);
    let button = pinButtons.get(annotation.id);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'pin';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const current = pinData.get(annotation.id);
        if (current) openPillForEdit(current);
      });
      pinsLayer.append(button);
      pinButtons.set(annotation.id, button);
    }
    button.textContent = annotation.resolved ? '✓' : '';
    button.classList.toggle('resolved', Boolean(annotation.resolved));
    button.classList.toggle('orphaned', !target);
    button.setAttribute('aria-label', annotation.resolved ? 'Resolved annotation' : 'Open annotation');
    positionPinAt(button, target, 0);
    reindexOrphans();
    renderSidebar();
  }
  function removePin(id: string) {
    pinButtons.get(id)?.remove();
    pinButtons.delete(id);
    pinTargets.delete(id);
    pinData.delete(id);
    reindexOrphans();
    renderSidebar();
  }
  function renderPins(list: Array<Record<string, any>>) {
    const incoming = new Set(list.map((item) => item.id));
    for (const id of Array.from(pinButtons.keys())) if (!incoming.has(id)) removePin(id);
    for (const annotation of list) renderPin(annotation);
  }
  function repositionAllPins() {
    for (const [id, button] of pinButtons) positionPinAt(button, pinTargets.get(id) ?? null, 0);
    reindexOrphans();
  }
  /**
   * The persistent reviewing surface the reference design calls for: a
   * toggleable panel listing every annotation on the current route,
   * independent of Inspect/Navigate mode, so feedback can be reviewed without
   * hunting for pins on a long page. Clicking a row scrolls to (or, for an
   * orphaned annotation, simply opens) the same edit composer a pin opens.
   */
  function renderSidebar() {
    const list = Array.from(pinData.values());
    sidebarToggleCount.textContent = String(list.length);
    sidebarToggle.hidden = list.length === 0;
    if (!list.length) sidebar.hidden = true;
    sidebarList.textContent = '';
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'sidebar-empty';
      empty.textContent = 'No annotations on this page yet.';
      sidebarList.append(empty);
      return;
    }
    for (const annotation of list) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = annotation.resolved ? 'sidebar-row resolved' : 'sidebar-row';
      const comment = document.createElement('span');
      comment.className = 'sidebar-row-comment';
      comment.textContent = String(annotation.comment ?? '');
      const meta = document.createElement('span');
      meta.className = 'sidebar-row-meta';
      const authorName = annotation.author?.displayName ? String(annotation.author.displayName) : 'QA author';
      meta.textContent = annotation.resolved ? `${authorName} · Resolved` : authorName;
      row.append(comment, meta);
      row.addEventListener('click', () => {
        const target = pinTargets.get(annotation.id);
        if (target && target.isConnected) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const current = pinData.get(annotation.id) ?? annotation;
        openPillForEdit(current);
      });
      sidebarList.append(row);
    }
  }
  sidebarToggle.addEventListener('click', () => { sidebar.hidden = !sidebar.hidden; });
  sidebarCloseButton.addEventListener('click', () => { sidebar.hidden = true; });
  let loadToken = 0;
  async function loadAnnotations() {
    const requestId = ++loadToken;
    try {
      const list = await invoke(config.annotationsList, location.pathname) as Array<Record<string, any>>;
      if (requestId !== loadToken) return; // superseded by a later navigation
      renderPins(Array.isArray(list) ? list : []);
    } catch { /* keep whatever is already rendered rather than clearing on a transient error */ }
  }
  addEventListener('scroll', repositionAllPins, { passive: true, capture: true });

  Object.defineProperty(globalThis, '__tellannQaSetPhase', {
    value: (next: typeof phase, stateKey?: string | null) => {
      phase = next;
      (globalThis as any).__tellannQaFlowState = stateKey ?? null;
      return true;
    },
    configurable: false,
  });
  Object.defineProperty(globalThis, '__tellannQaSetMode', {
    // Returns true so the desktop can tell a delivered command from one that
    // reached a page with no recorder installed.
    value: (next: typeof mode) => {
      mode = next;
      document.documentElement.style.cursor = next === 'INSPECT' ? 'crosshair' : '';
      badge.hidden = next !== 'INSPECT';
      if (next === 'NAVIGATE') closePill();
      else live.textContent = 'Inspect mode active. Point to an element and click, or focus it and press Enter.';
      showShield();
      return true;
    },
    configurable: false,
  });
  Object.defineProperty(globalThis, '__tellannQaScreenshotMode', {
    value: (active: boolean) => {
      // The outline/pin are deliberately left alone here — every annotation
      // screenshot must show the highlighted element boundary, and hiding
      // only the pill (not the outline) is what selectElement's pre-dialog
      // capture path already relies on.
      pill.style.visibility = active ? 'hidden' : '';
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
