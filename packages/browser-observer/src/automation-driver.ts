import { canonicalRouteFromPath } from '@tellann/automation-engine';
import type {
  ActionOutcome,
  AutomationAction,
  AutomationPorts,
  ObservedRequest,
  SemanticElement,
  SemanticSnapshot,
} from '@tellann/automation-engine';
import type { ElementHandle, Page, Request } from 'playwright';

/**
 * The browser half of an Automated Run: turns a live page into a `SemanticSnapshot`,
 * performs the actions the engine chooses, and says when the page has settled.
 *
 * It is deliberately not clever. What to do is the engine's decision; this only reports
 * and executes. It never reads pixels, and it never changes the application's DOM (no
 * attributes are added to elements: refs are indexes into a page-side list), because a
 * driver that perturbs the app can also change what it is recognising.
 */

export interface AutomationDriverOptions {
  /** State keys the application's own SDK has reported since the last action, most recent last. */
  sdkStates: () => string[] | Promise<string[]>;
  /** Called at the start of every action, so the SDK-signal buffer can be reset to "since the last action". */
  beforeAction?: () => void;
  /** A quiet DOM for this long counts as settled. */
  quietMs?: number;
  /** Give up settling after this long and return whatever is on the page. */
  settleTimeoutMs?: number;
  /** How long to wait for the SDK to report the expected state before proceeding on other evidence. */
  sdkGraceMs?: number;
  /** A request still in flight after this long is background traffic (polling, streaming), not something to wait for. */
  backgroundAfterMs?: number;
  actionTimeoutMs?: number;
  maxElements?: number;
}

const DEFAULTS = {
  quietMs: 250,
  settleTimeoutMs: 10_000,
  sdkGraceMs: 1_500,
  backgroundAfterMs: 3_000,
  actionTimeoutMs: 8_000,
  maxElements: 400,
} as const;

/** What the in-page extractor returns for one element, before refs are assigned. */
type Extracted = Omit<SemanticElement, 'ref'> & { signature: string };

interface ExtractionResult {
  path: string;
  url: string;
  title: string | null;
  headings: string[];
  elements: Extracted[];
}

const TRACKED_RESOURCES = new Set(['fetch', 'xhr', 'document']);

export class PageAutomationDriver implements Pick<AutomationPorts, 'snapshot' | 'act' | 'settle'> {
  private readonly options: Required<Omit<AutomationDriverOptions, 'sdkStates' | 'beforeAction'>> & Pick<AutomationDriverOptions, 'sdkStates' | 'beforeAction'>;
  private readonly requests = new Map<Request, ObservedRequest>();
  private readonly inflight = new Map<Request, number>();
  private errors = 0;
  private crashed = false;
  /** Signatures by ref from the last snapshot, so a stale ref can be re-found after a re-render. */
  private signatures = new Map<string, string>();

  constructor(private readonly page: Page, options: AutomationDriverOptions) {
    this.options = { ...DEFAULTS, ...options };
    page.on('request', (request) => {
      if (!TRACKED_RESOURCES.has(request.resourceType())) return;
      this.inflight.set(request, Date.now());
      this.requests.set(request, { method: request.method(), route: routeOf(request.url()), status: null, completed: false });
    });
    page.on('requestfinished', (request) => {
      this.inflight.delete(request);
      const seen = this.requests.get(request);
      if (!seen) return;
      // The response is what carries the status; requestfinished can fire first.
      void request.response().then((response) => {
        seen.status = response?.status() ?? null;
        seen.completed = true;
      }).catch(() => { seen.completed = true; });
    });
    page.on('requestfailed', (request) => {
      this.inflight.delete(request);
      const seen = this.requests.get(request);
      if (seen) seen.completed = true;
    });
    page.on('pageerror', () => { this.errors += 1; });
    page.on('console', (message) => { if (message.type() === 'error') this.errors += 1; });
    page.on('crash', () => { this.crashed = true; });
  }

  health(): 'OK' | 'BROWSER_CRASHED' {
    return this.crashed || this.page.isClosed() ? 'BROWSER_CRASHED' : 'OK';
  }

  async snapshot(): Promise<SemanticSnapshot> {
    const extracted = await this.extract();
    this.signatures = new Map();
    const elements = extracted.elements.map((item, index): SemanticElement => {
      const { signature, ...element } = item;
      const ref = `e${index}`;
      this.signatures.set(ref, signature);
      return { ...element, ref };
    });
    return {
      url: extracted.url,
      path: extracted.path,
      title: extracted.title,
      headings: extracted.headings,
      elements,
      sdkStates: await this.options.sdkStates(),
      requests: [...this.requests.values()].map((request) => ({ ...request })),
      errorCount: this.errors,
    };
  }

  async act(action: AutomationAction): Promise<ActionOutcome> {
    // "Requests since the last action" is what the engine reasons about.
    this.requests.clear();
    this.options.beforeAction?.();
    try {
      if (action.kind === 'NAVIGATE') {
        await this.page.goto(action.url, { timeout: this.options.actionTimeoutMs, waitUntil: 'domcontentloaded' });
        return { ok: true };
      }
      const handle = await this.resolve(action.ref);
      if (!handle) return { ok: false, error: 'The element is no longer on the page.' };
      if (action.kind === 'CLICK') {
        await handle.click({ timeout: this.options.actionTimeoutMs });
        return { ok: true };
      }
      await this.fill(handle, action.value);
      return { ok: true };
    } catch (error) {
      // Never echo the value: `fill` errors can quote it, and it may be a secret.
      return { ok: false, error: action.kind === 'FILL' ? 'The field could not be filled.' : summarize(error) };
    }
  }

  async settle(expectedStateKey: string | null): Promise<SemanticSnapshot> {
    const deadline = Date.now() + this.options.settleTimeoutMs;
    const remaining = () => Math.max(0, deadline - Date.now());
    let sdkDeadline: number | null = null;

    while (remaining() > 0) {
      try {
        await this.page.waitForLoadState('domcontentloaded', { timeout: remaining() });
        await this.waitForQuiet(remaining());
        await this.waitForRequests(remaining());
        if (expectedStateKey === null) break;
        // The application says which state it is in. Give it a moment to say so, but do not stall on states
        // that never report: the run recognises them from the route and elements instead.
        if ((await this.options.sdkStates()).includes(expectedStateKey)) break;
        sdkDeadline ??= Math.min(deadline, Date.now() + this.options.sdkGraceMs);
        if (Date.now() >= sdkDeadline) break;
        await this.page.waitForTimeout(100);
      } catch (error) {
        // A navigation replaced the page mid-wait. That is what settling is for: go round again.
        if (!isContextDestroyed(error)) break;
      }
    }
    return this.snapshot();
  }

  // -- settling ---------------------------------------------------------------

  /** Resolves when the DOM has stopped changing for `quietMs`, or after `maxMs`. */
  private async waitForQuiet(maxMs: number): Promise<void> {
    await this.page.evaluate(({ quietMs, maxMs: limit }) => new Promise<void>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      const finish = () => { observer.disconnect(); clearTimeout(timer); clearTimeout(cap); resolve(); };
      const arm = () => { clearTimeout(timer); timer = setTimeout(finish, quietMs); };
      const observer = new MutationObserver(arm);
      observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      const cap = setTimeout(finish, limit);
      arm();
    }), { quietMs: this.options.quietMs, maxMs });
  }

  /** Waits for in-flight fetch/XHR/document requests, ignoring ones old enough to be background traffic. */
  private async waitForRequests(maxMs: number): Promise<void> {
    const until = Date.now() + maxMs;
    while (Date.now() < until) {
      const now = Date.now();
      const foreground = [...this.inflight.values()].filter((startedAt) => now - startedAt < this.options.backgroundAfterMs);
      if (foreground.length === 0) return;
      await this.page.waitForTimeout(50);
    }
  }

  // -- element handling -------------------------------------------------------

  private async extract(): Promise<ExtractionResult> {
    const max = this.options.maxElements;
    // A navigation can destroy the context between the settle check and this call.
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.page.evaluate(extractSemantic, max);
      } catch (error) {
        if (!isContextDestroyed(error) || attempt >= 3) throw error;
        await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);
      }
    }
  }

  /** The live element for a ref; if the app re-rendered and the node is gone, find the same element again. */
  private async resolve(ref: string): Promise<ElementHandle<Element> | null> {
    const index = Number(ref.slice(1));
    const direct = await this.page.evaluateHandle((i) => {
      const list = (window as unknown as { __tellannAutomationElements?: Element[] }).__tellannAutomationElements;
      const el = list?.[i];
      return el && el.isConnected ? el : null;
    }, index);
    const element = direct.asElement();
    if (element) return element;

    const signature = this.signatures.get(ref);
    if (!signature) return null;
    const fresh = await this.extract();
    const match = fresh.elements.findIndex((item) => item.signature === signature);
    if (match < 0) return null;
    const again = await this.page.evaluateHandle((i) => (window as unknown as { __tellannAutomationElements?: Element[] }).__tellannAutomationElements?.[i] ?? null, match);
    return again.asElement();
  }

  private async fill(handle: ElementHandle<Element>, value: string): Promise<void> {
    const kind = await handle.evaluate((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'select') return 'select';
      if (tag === 'input') {
        const type = (el as HTMLInputElement).type;
        if (type === 'checkbox' || type === 'radio') return 'toggle';
      }
      return 'text';
    });
    if (kind === 'select') {
      await handle.selectOption([{ label: value }, { value }], { timeout: this.options.actionTimeoutMs });
    } else if (kind === 'toggle') {
      await (handle as ElementHandle<HTMLInputElement>).setChecked(/^(true|yes|on|1|checked)$/i.test(value), { timeout: this.options.actionTimeoutMs });
    } else {
      await (handle as ElementHandle<HTMLInputElement>).fill(value, { timeout: this.options.actionTimeoutMs });
    }
  }
}

/**
 * Runs in the page. Fully self-contained: Playwright serializes it, so it may not reference module scope.
 * Elements are kept in a page-side list and referred to by index; nothing is written to the application's DOM.
 */
export function extractSemantic(maxElements: number): ExtractionResult {
  const store: Element[] = [];
  (window as unknown as { __tellannAutomationElements: Element[] }).__tellannAutomationElements = store;

  const text = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();
  const implicitRole = (el: Element): string | null => {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit.split(/\s+/)[0]!;
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return el.hasAttribute('href') ? 'link' : null;
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
      if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'range') return 'slider';
      return 'textbox';
    }
    return null;
  };
  const labelOf = (el: Element): string | null => {
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length > 0) return text(labels[0]!.innerText || labels[0]!.textContent) || null;
    const wrapping = el.closest('label');
    return wrapping ? text(wrapping.textContent) || null : null;
  };
  const nameOf = (el: Element, label: string | null): string | null => {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const joined = labelledBy.split(/\s+/).map((id) => text(document.getElementById(id)?.textContent)).filter(Boolean).join(' ');
      if (joined) return joined;
    }
    const aria = text(el.getAttribute('aria-label'));
    if (aria) return aria;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
      if (['button', 'submit', 'reset'].includes(type)) return text((el as HTMLInputElement).value) || null;
      if (type === 'image') return text(el.getAttribute('alt')) || null;
    }
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      return label ?? (text(el.getAttribute('placeholder')) || text(el.getAttribute('title')) || null);
    }
    const content = text((el as HTMLElement).innerText || el.textContent);
    if (content) return content.length > 200 ? content.slice(0, 200) : content;
    const img = el.querySelector('img[alt]');
    if (img) return text(img.getAttribute('alt')) || null;
    return text(el.getAttribute('title')) || null;
  };
  const isVisible = (el: Element): boolean => {
    const check = (el as Element & { checkVisibility?: (options?: object) => boolean }).checkVisibility;
    if (typeof check === 'function' && !check.call(el, { checkVisibilityCSS: true })) return false;
    const rect = (el as HTMLElement).getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const isEnabled = (el: Element): boolean =>
    !(el as HTMLButtonElement).disabled
    && el.getAttribute('aria-disabled') !== 'true'
    && !el.closest('fieldset[disabled]');

  const selector = [
    'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary', '[role]', '[tabindex]',
    '[data-testid]', '[data-test-id]', '[data-test]', '[data-tellann-action]',
  ].join(',');

  const elements: Extracted[] = [];
  const seenCounts = new Map<string, number>();
  for (const el of Array.from(document.querySelectorAll(selector))) {
    if (elements.length >= maxElements) break;
    const tag = el.tagName.toLowerCase();
    // Containers matched only through tabindex/role add noise, and a `<form>` is not something to click.
    if (tag === 'form' || tag === 'body' || tag === 'html') continue;
    const role = implicitRole(el);
    const label = labelOf(el);
    const name = nameOf(el, label);
    const testId = el.getAttribute('data-testid') ?? el.getAttribute('data-test-id') ?? el.getAttribute('data-test');
    const href = el.getAttribute('href');
    const signatureBase = [tag, role ?? '', testId ?? '', name ?? '', label ?? '', el.getAttribute('name') ?? ''].join('|');
    // Identical controls (three "Delete" buttons) are told apart by order among their twins.
    const occurrence = seenCounts.get(signatureBase) ?? 0;
    seenCounts.set(signatureBase, occurrence + 1);
    store.push(el);
    elements.push({
      tag,
      role,
      name,
      label,
      testId,
      domId: el.id || null,
      href,
      actionAnchor: el.getAttribute('data-tellann-action'),
      fieldName: el.getAttribute('name'),
      inputType: tag === 'input' ? ((el as HTMLInputElement).type || 'text').toLowerCase() : null,
      visible: isVisible(el),
      enabled: isEnabled(el),
      signature: `${signatureBase}#${occurrence}`,
    });
  }

  return {
    path: location.pathname,
    url: location.href,
    title: text(document.title) || null,
    headings: Array.from(document.querySelectorAll('h1,h2,h3')).slice(0, 12).map((h) => text(h.textContent)).filter(Boolean),
    elements,
  };
}

function routeOf(url: string): string {
  try {
    return canonicalRouteFromPath(new URL(url).pathname);
  } catch {
    return url;
  }
}

function isContextDestroyed(error: unknown): boolean {
  return /Execution context was destroyed|Target (page, context or browser )?has been closed|navigation/i.test(String((error as Error)?.message ?? error));
}

function summarize(error: unknown): string {
  return String((error as Error)?.message ?? error).split('\n')[0]!.slice(0, 200);
}
