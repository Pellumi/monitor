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
  host.style.display = 'none';
  // Playwright init scripts execute before the parser creates <html>. Mount the
  // overlay as soon as the root exists instead of aborting the entire recorder
  // (which also disables interaction, field, storage, viewport, and mode hooks).
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
  shadow.innerHTML = `<style>
    :host{all:initial;color-scheme:dark;--font-ui:"Segoe UI Variable Text","Segoe UI Variable","Segoe UI",system-ui,sans-serif;--font-display:"Segoe UI Variable Display","Segoe UI Variable","Segoe UI",system-ui,sans-serif;--font-mono:"Cascadia Mono","Cascadia Code",Consolas,"Courier New",monospace;--accent:#4cc2ff;--on-accent:#000;--surface-0:#1b1b1b;--surface-1:#262626;--surface-2:#2e2e2e;--text-strong:#fff;--text:#d6d6d6;--text-muted:#a3a3a3;--text-subtle:#7c7c7c;--border-subtle:#2a2a2a;--border:#353535;--border-strong:#4c4c4c;--overlay-rgb:255 255 255;--shadow-k:1;--control-height:30px;--radius:4px;--radius-lg:8px;--ease:cubic-bezier(.2,0,0,1)}
    @media(prefers-color-scheme:light){:host{color-scheme:light;--accent:#0067c0;--on-accent:#fff;--surface-0:#fbfbfb;--surface-1:#fff;--surface-2:#f0f0f0;--text-strong:#1a1a1a;--text:#303030;--text-muted:#5c5c5c;--text-subtle:#878787;--border-subtle:#ededed;--border:#e0e0e0;--border-strong:#c4c4c4;--overlay-rgb:0 0 0;--shadow-k:.3}}
    .outline{position:fixed;pointer-events:none;border:1px solid var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent);border-radius:2px;z-index:2147483646}.shield{position:fixed;inset:0;z-index:2147483645;cursor:crosshair;background:transparent}.shield.modal-open{cursor:default;background:rgb(0 0 0/calc(.1 + .4*var(--shadow-k)))}
    .panel,.panel *{box-sizing:border-box}.panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 48px));max-height:calc(100vh - 48px);overflow:auto;z-index:2147483647;padding:20px 24px 0;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface-1);color:var(--text);font:13px/1.45 var(--font-ui);box-shadow:0 32px 64px rgb(0 0 0/calc(.45*var(--shadow-k)));animation:dialog-in .14s var(--ease)}@keyframes dialog-in{from{opacity:0;transform:translate(-50%,-50%) scale(.98)}}
    .eyebrow{margin:0 0 6px;color:var(--text-muted);font:600 11px var(--font-ui);letter-spacing:.04em;text-transform:uppercase}.panel h2{margin:0;color:var(--text-strong);font:600 16px/1.3 var(--font-display);letter-spacing:0}.preview{margin:12px 0 18px;padding:8px 10px;border:1px solid var(--border-subtle);border-left:2px solid var(--accent);border-radius:var(--radius);background:var(--surface-0);color:var(--text-muted);font:11.5px/1.5 var(--font-mono);overflow-wrap:anywhere}
    .field{margin-bottom:16px}label{display:block;margin:0 0 6px;color:var(--text);font:12px/1.4 var(--font-ui)}.optional{color:var(--text-subtle)}.panel textarea,.panel input{display:block;width:100%;min-height:var(--control-height);padding:7px 10px;border:1px solid var(--border);border-bottom-color:var(--border-strong);border-radius:var(--radius);background:var(--surface-0);color:var(--text-strong);font:12px/1.5 var(--font-ui);outline:none}.panel textarea{min-height:96px;resize:vertical}.panel input{height:var(--control-height);padding:0 10px}.panel ::placeholder{color:var(--text-subtle)}.panel textarea:focus,.panel input:focus{border-bottom-color:var(--accent);box-shadow:inset 0 -1px 0 var(--accent)}.hint{margin:6px 0 0;color:var(--text-subtle);font:11px/1.45 var(--font-ui)}
    .actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:20px -24px 0;padding:16px 24px;border-top:1px solid var(--border-subtle);border-radius:0 0 var(--radius-lg) var(--radius-lg);background:var(--surface-0)}.panel button{display:inline-flex;align-items:center;justify-content:center;min-width:96px;min-height:var(--control-height);padding:0 12px;border:1px solid var(--border);border-bottom-color:var(--border-strong);border-radius:var(--radius);background:var(--surface-1);color:var(--text-strong);font:500 12px/1.2 var(--font-ui);white-space:nowrap;cursor:default;transition:background-color .08s var(--ease),border-color .08s var(--ease),color .08s var(--ease)}.panel button:hover:not(:disabled){background:var(--surface-2)}.panel button:active:not(:disabled){background:var(--surface-1);color:var(--text-muted)}.panel button.primary{border-color:transparent;background:var(--accent);color:var(--on-accent)}.panel button.primary:hover:not(:disabled){background:color-mix(in srgb,var(--accent) 88%,var(--text-strong))}.panel button.primary:active:not(:disabled){background:color-mix(in srgb,var(--accent) 82%,var(--surface-0))}.panel button:disabled{opacity:.5;cursor:wait}.panel :focus-visible{outline:2px solid var(--accent);outline-offset:1px}
    .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.chip{padding:2px 8px;border-radius:var(--radius);background:rgb(var(--overlay-rgb)/.07);color:var(--text-muted);font:11px var(--font-ui)}.results{display:flex;flex-direction:column;gap:2px;margin-top:6px;padding:4px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface-1);box-shadow:0 8px 24px rgb(0 0 0/calc(.32*var(--shadow-k)))}.chips:empty,.results:empty{display:none}.results button{justify-content:flex-start;min-width:0;min-height:26px;padding:0 10px;border:0;border-radius:var(--radius);background:transparent;color:var(--text);font:12px var(--font-ui)}.results button:hover:not(:disabled){background:rgb(var(--overlay-rgb)/.07)}.live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
    @media(max-width:560px){.panel{padding:16px 16px 0}.actions{flex-wrap:wrap;margin:16px -16px 0;padding:12px 16px}.panel button{flex:1}.panel button.primary{flex-basis:100%;order:-1}}
    @media(prefers-reduced-motion:reduce){.panel{animation:none}.panel button{transition:none}}
  </style><div class="shield" hidden></div><div class="outline" hidden></div><div class="panel" hidden role="dialog" aria-modal="true" aria-labelledby="tellann-title"><p class="eyebrow">Inspect mode</p><h2 id="tellann-title">Annotate selected element</h2><p class="preview"></p><div class="field"><label for="tellann-comment">Note</label><textarea id="tellann-comment" maxlength="2000" rows="5" aria-label="Annotation comment" placeholder="Describe the change or issue"></textarea><p class="hint">When a codebase is connected, Tellann will add the closest verified filename and line range.</p></div><div class="field"><label for="tellann-member">Mention a teammate <span class="optional">Optional</span></label><input id="tellann-member" aria-label="Search organization members" placeholder="Search by name"><div class="chips"></div><div class="results" role="listbox" aria-label="Member search results"></div></div><div class="actions"><button class="reselect">Reselect</button><button class="cancel">Cancel</button><button class="primary">Save annotation</button></div></div><div class="live" aria-live="polite"></div>`;
  const shield = shadow.querySelector('.shield') as HTMLElement;
  const outline = shadow.querySelector('.outline') as HTMLElement;
  const panel = shadow.querySelector('.panel') as HTMLElement;
  const preview = shadow.querySelector('.preview') as HTMLElement;
  const textarea = shadow.querySelector('textarea')!;
  const search = shadow.querySelector('input')!;
  const chips = shadow.querySelector('.chips')!;
  const results = shadow.querySelector('.results') as HTMLElement;
  const live = shadow.querySelector('.live') as HTMLElement;
  const saveButton = shadow.querySelector('.primary') as HTMLButtonElement;
  const modalButtons = Array.from(panel.querySelectorAll('button')) as HTMLButtonElement[];
  let selected: Element | null = null;
  let saving = false;
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
    shield.classList.toggle('modal-open', !panel.hidden);
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
  saveButton.addEventListener('click', async () => {
    if (saving) return;
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
    saving = true;
    modalButtons.forEach((button) => { button.disabled = true; });
    saveButton.textContent = 'Saving…';
    live.textContent = 'Saving annotation';
    try {
      await invoke(config.annotations, payload);
      panel.hidden = true;
      outline.hidden = true;
      selected = null;
      mentions = [];
      chips.textContent = '';
      results.textContent = '';
      textarea.value = '';
      search.value = '';
      live.textContent = 'Annotation saved';
      showShield();
      if (restoreFocusTo instanceof HTMLElement && restoreFocusTo.isConnected) restoreFocusTo.focus();
      restoreFocusTo = null;
    } catch {
      live.textContent = 'Annotation could not be saved. Try again.';
      textarea.focus();
    } finally {
      saving = false;
      modalButtons.forEach((button) => { button.disabled = false; });
      saveButton.textContent = 'Save annotation';
    }
  });
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
      host.style.display = next === 'INSPECT' ? 'block' : 'none';
      document.documentElement.style.cursor = next === 'INSPECT' ? 'crosshair' : '';
      if (next === 'NAVIGATE') cancelInspect();
      else live.textContent = 'Inspect mode active. Point to an element and click, or focus it and press Enter.';
      showShield();
      return true;
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
