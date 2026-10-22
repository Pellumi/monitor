import { canonicalRouteFromPath } from '@tellann/automation-engine';
import type {
  ActionOutcome,
  AutomationAction,
  AutomationPorts,
  Breakpoint,
  ObservedRequest,
  SemanticElement,
  SemanticSnapshot,
  ViewportSample,
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
  /**
   * Measure how the page is actually drawn — geometry, resolved colours, what is on top of what — alongside the
   * semantic read. On by default: the engine uses it to tell two identical-looking controls apart and to notice
   * that the control it picked is underneath something, both of which it is otherwise blind to. One extra
   * style-and-layout pass per snapshot; turn it off only if something needs the lightest possible read.
   */
  measure?: boolean;
}

const DEFAULTS = {
  quietMs: 250,
  settleTimeoutMs: 10_000,
  sdkGraceMs: 1_500,
  backgroundAfterMs: 3_000,
  actionTimeoutMs: 8_000,
  maxElements: 400,
  measure: true,
} as const;

/** What the in-page extractor returns for one element, before refs are assigned. */
type Extracted = Omit<SemanticElement, 'ref'> & { signature: string };
/** The measured half of an element, as the in-page pass produces it. */
type Measured = NonNullable<SemanticElement['geometry']>;

interface ExtractionResult {
  path: string;
  url: string;
  title: string | null;
  headings: string[];
  elements: Extracted[];
  /** The window the page was measured in, so a sample can say which size it describes. */
  viewport: { width: number; height: number };
  /** How far the page overflows sideways. Anything above zero is a horizontal scrollbar a person has to use. */
  horizontalOverflowPx: number;
  /** The smallest readable text on the page, in CSS pixels. Null when nothing was measured. */
  smallestTextPx: number | null;
}

const TRACKED_RESOURCES = new Set(['fetch', 'xhr', 'document']);

export class PageAutomationDriver implements Pick<AutomationPorts, 'snapshot' | 'act' | 'settle'> {
  private readonly options: Required<Omit<AutomationDriverOptions, 'sdkStates' | 'beforeAction'>> & Pick<AutomationDriverOptions, 'sdkStates' | 'beforeAction'>;
  private readonly requests = new Map<Request, ObservedRequest>();
  private readonly inflight = new Map<Request, number>();
  private errors = 0;
  private crashed = false;
  /**
   * Whether the page said it was busy while the run was waiting for it, from right after the last action.
   * Asked then rather than once everything has settled, because by then any loader has gone — so a page that
   * showed a spinner and one that showed nothing would look identical.
   */
  private busyWhileSettling: boolean | undefined;
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
      frameOrigins: this.frameOrigins(),
      ...(this.options.measure ? { page: { ...pageOf(extracted), busyIndicator: this.busyWhileSettling ?? false } } : {}),
    };
  }

  /**
   * How this page looks at other window sizes.
   *
   * A Flow is walked once, at one size, because walking it five times would be five runs. So each state is
   * instead re-measured at each size the moment it is reached: the window is resized, the page is allowed to
   * settle, it is read again, and the original size is put back before the run acts. Nothing is clicked and no
   * state is changed, so what the run does is the same whether this happens or not — which is the only way it
   * can be on by default.
   *
   * The original size is restored in a `finally`, because a run left at phone width would then drive the rest of
   * the Flow at phone width and report findings about a size nobody asked about.
   */
  async measureViewports(breakpoints: Breakpoint[]): Promise<ViewportSample[]> {
    if (breakpoints.length === 0 || this.page.isClosed()) return [];
    const original = this.page.viewportSize();
    const samples: ViewportSample[] = [];
    try {
      for (const breakpoint of breakpoints) {
        if (this.page.isClosed()) break;
        try {
          await this.page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
          // Reflow, media queries and anything that re-renders on resize. The same quiet window as a settle.
          await this.waitForQuiet(this.options.quietMs * 4);
          const extracted = await this.extract(true);
          samples.push({
            breakpoint,
            page: pageOf(extracted),
            elements: extracted.elements.map(({ signature, ...element }, index) => { void signature; return { ...element, ref: `b${index}` }; }),
          });
        } catch (error) {
          // One size that could not be measured is one missing row, not a failed run.
          if (!isContextDestroyed(error)) break;
        }
      }
    } finally {
      if (original && !this.page.isClosed()) await this.page.setViewportSize(original).catch(() => undefined);
      // Put the page back the way the run found it, so the quiet window the next action waits on is honest.
      if (!this.page.isClosed()) await this.waitForQuiet(this.options.quietMs * 4).catch(() => undefined);
    }
    return samples;
  }

  /** Host and path (never a query, which can carry tokens) of every embedded frame: how an embedded CAPTCHA is recognised. */
  private frameOrigins(): string[] {
    const main = this.page.mainFrame();
    return this.page.frames().filter((frame) => frame !== main).flatMap((frame) => {
      try {
        const url = new URL(frame.url());
        return url.protocol === 'about:' ? [] : [`${url.host}${url.pathname}`.slice(0, 120)];
      } catch {
        return [];
      }
    });
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
      switch (action.kind) {
        case 'CLICK':
          await handle.click({ timeout: this.options.actionTimeoutMs });
          return { ok: true };
        case 'SELECT':
          await this.choose(handle, action.value);
          return { ok: true };
        case 'SET_CHECKED':
          await this.setChecked(handle, action.checked);
          return { ok: true };
        case 'UPLOAD':
          await this.upload(handle, action.file);
          return { ok: true };
        default:
          await this.fill(handle, action.value);
          return { ok: true };
      }
    } catch (error) {
      // Never echo a value: errors from typing can quote it, and it may be a secret.
      if (action.kind === 'FILL') return { ok: false, error: 'The field could not be filled.' };
      if (action.kind === 'SELECT') return { ok: false, error: `The choice could not be made: ${summarizeWithout(error, action.value)}` };
      if (action.kind === 'UPLOAD') return { ok: false, error: 'The file could not be attached.' };
      return { ok: false, error: summarize(error) };
    }
  }

  async settle(expectedStateKey: string | null): Promise<SemanticSnapshot> {
    const deadline = Date.now() + this.options.settleTimeoutMs;
    const remaining = () => Math.max(0, deadline - Date.now());
    let sdkDeadline: number | null = null;
    // Read first, while a loader would still be up. Everything below waits for it to go away again.
    this.busyWhileSettling = this.options.measure ? await this.readBusyIndicator() : undefined;

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

  /**
   * A picture of one control, for the one question a picture answers better than the markup does: which of two
   * identically described controls a person would actually press.
   *
   * A crop of the element and a little around it, never the page, so it carries no more of the application than
   * the control itself. Sensitive fields are masked by the same code that masks every other screenshot, and the
   * element is scrolled into view first — a control below the fold has no pixels to photograph. Null when it
   * cannot be done, which the caller treats as having no picture rather than as a failure.
   */
  async cropElement(ref: string, padding = 8): Promise<{ mimeType: string; base64: string } | null> {
    if (this.page.isClosed()) return null;
    try {
      const handle = await this.resolve(ref);
      if (!handle) return null;
      await handle.scrollIntoViewIfNeeded({ timeout: this.options.actionTimeoutMs }).catch(() => undefined);
      const box = await handle.boundingBox();
      if (!box || box.width <= 0 || box.height <= 0) return null;
      const viewport = this.page.viewportSize();
      const clip = {
        x: Math.max(0, box.x - padding),
        y: Math.max(0, box.y - padding),
        width: Math.min(box.width + padding * 2, (viewport?.width ?? box.x + box.width) - Math.max(0, box.x - padding)),
        height: Math.min(box.height + padding * 2, (viewport?.height ?? box.y + box.height) - Math.max(0, box.y - padding)),
      };
      if (clip.width <= 0 || clip.height <= 0) return null;
      // Masked by the same locator as every other screenshot: a control can sit beside a field, and a crop that
      // happens to include one must not carry what somebody typed into it.
      const shot = await this.page.screenshot({
        clip,
        type: 'png',
        mask: [this.page.locator('input, textarea, select, [contenteditable="true"], [data-tellann-sensitive]')],
        timeout: this.options.actionTimeoutMs,
      });
      return shot.length > 0 ? { mimeType: 'image/png', base64: shot.toString('base64') } : null;
    } catch {
      return null;
    }
  }

  /**
   * Whether anything on the page is currently saying it is working: the accessible ways of saying so, and the
   * class names skeleton placeholders are conventionally given. Visible only — a hidden spinner tells nobody
   * anything. False rather than null on failure, because "we could not tell" and "it said nothing" lead to the
   * same place and only one of them is worth a separate code path.
   */
  private async readBusyIndicator(): Promise<boolean> {
    try {
      return await this.page.evaluate(() => {
        const selector = '[aria-busy="true"], [role="progressbar"], [role="status"], progress, '
          + '[class*="skeleton" i], [class*="shimmer" i], [class*="spinner" i], [class*="loading" i], [data-loading="true"]';
        for (const node of Array.from(document.querySelectorAll(selector))) {
          const box = node.getBoundingClientRect();
          if (box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden') return true;
        }
        return false;
      });
    } catch {
      return false;
    }
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

  private async extract(measure = this.options.measure): Promise<ExtractionResult> {
    const input = { maxElements: this.options.maxElements, measure };
    // A navigation can destroy the context between the settle check and this call.
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.page.evaluate(extractSemantic, input);
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

  /** Typed text: an input, a textarea or a contenteditable. Choices and toggles have their own actions. */
  private async fill(handle: ElementHandle<Element>, value: string): Promise<void> {
    await (handle as ElementHandle<HTMLInputElement>).fill(value, { timeout: this.options.actionTimeoutMs });
  }

  /**
   * Choose an option. A native `<select>` is resolved to option indexes in the page (a label first, then a value, so
   * two options can never both match one request), a custom combobox or listbox is opened and the option clicked.
   */
  private async choose(handle: ElementHandle<Element>, value: string): Promise<void> {
    const wanted = value.split(',').map((part) => part.trim()).filter(Boolean);
    const native = await handle.evaluate((el) => (el.tagName.toLowerCase() === 'select' ? { multiple: (el as HTMLSelectElement).multiple } : null));
    if (native) {
      const parts = native.multiple ? wanted : [value.trim()];
      const indexes = await handle.evaluate((el, requested) => {
        const options = Array.from((el as HTMLSelectElement).options);
        const norm = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();
        return requested.map((part) => {
          const byLabel = options.findIndex((option) => !option.disabled && norm(option.label || option.textContent || '') === norm(part));
          return byLabel >= 0 ? byLabel : options.findIndex((option) => !option.disabled && norm(option.value) === norm(part));
        });
      }, parts);
      if (indexes.some((index) => index < 0)) throw new Error('that option is not offered');
      await handle.selectOption(indexes.map((index) => ({ index })), { timeout: this.options.actionTimeoutMs });
      return;
    }
    const editable = await handle.evaluate((el) => el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea');
    for (const part of wanted.length > 0 ? wanted : [value]) {
      let picked = await this.pickListOption(handle, part, false);
      if (!picked && editable) {
        // A combobox that filters as you type: type the text, then take the option that appears.
        await (handle as ElementHandle<HTMLInputElement>).fill(part, { timeout: this.options.actionTimeoutMs });
        picked = await this.pickListOption(handle, part, true);
      }
      if (!picked) throw new Error('that option is not in the list');
    }
  }

  /** Opens the list (unless already open) and clicks the option whose text is `text`. */
  private async pickListOption(handle: ElementHandle<Element>, text: string, alreadyOpen: boolean): Promise<boolean> {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exact = new RegExp(`^\\s*${escaped}\\s*$`, 'i');
    const partial = new RegExp(escaped, 'i');
    if (!alreadyOpen) await handle.click({ timeout: this.options.actionTimeoutMs });
    for (const pattern of [exact, partial]) {
      for (const role of ['option', 'menuitemradio', 'menuitem', 'treeitem'] as const) {
        const candidate = this.page.getByRole(role, { name: pattern }).filter({ visible: true }).first();
        try {
          await candidate.waitFor({ state: 'visible', timeout: pattern === exact && role === 'option' ? 1_500 : 250 });
        } catch {
          continue;
        }
        await candidate.click({ timeout: this.options.actionTimeoutMs });
        return true;
      }
    }
    // Leave the page as we found it rather than with a list hanging open.
    await this.page.keyboard.press('Escape').catch(() => undefined);
    return false;
  }

  /** A checkbox, radio or switch, native or custom, left on or off. */
  private async setChecked(handle: ElementHandle<Element>, checked: boolean): Promise<void> {
    const info = await handle.evaluate((el) => {
      const input = el as HTMLInputElement;
      const native = el.tagName.toLowerCase() === 'input' && (input.type === 'checkbox' || input.type === 'radio');
      const rect = el.getBoundingClientRect();
      return {
        native,
        radio: native && input.type === 'radio',
        current: native ? input.checked : el.getAttribute('aria-checked') === 'true',
        visible: rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden',
      };
    });
    if (info.current === checked) return;
    // A radio cannot be switched off by clicking it; choosing another one does that.
    if (info.radio && !checked) return;
    if (info.native && info.visible) {
      await (handle as ElementHandle<HTMLInputElement>).setChecked(checked, { timeout: this.options.actionTimeoutMs });
      return;
    }
    // A styled control whose real input is hidden, or an ARIA one: click what the person would click.
    if (info.native) {
      await handle.evaluate((el) => { const label = (el as HTMLInputElement).labels?.[0]; if (label) label.click(); else (el as HTMLElement).click(); });
    } else {
      await handle.click({ timeout: this.options.actionTimeoutMs });
    }
    const after = await handle.evaluate((el) => (el.tagName.toLowerCase() === 'input' ? (el as HTMLInputElement).checked : el.getAttribute('aria-checked') === 'true'));
    if (after !== checked) throw new Error('the control did not change');
  }

  /** A file input (even a hidden one), or a control that opens the file chooser. */
  private async upload(handle: ElementHandle<Element>, file: { name: string; mimeType: string; base64: string }): Promise<void> {
    const payload = { name: file.name, mimeType: file.mimeType, buffer: Buffer.from(file.base64, 'base64') };
    const isFileInput = await handle.evaluate((el) => el.tagName.toLowerCase() === 'input' && (el as HTMLInputElement).type === 'file');
    if (isFileInput) {
      await (handle as ElementHandle<HTMLInputElement>).setInputFiles(payload, { timeout: this.options.actionTimeoutMs });
      return;
    }
    const [chooser] = await Promise.all([
      this.page.waitForEvent('filechooser', { timeout: this.options.actionTimeoutMs }),
      handle.click({ timeout: this.options.actionTimeoutMs }),
    ]);
    await chooser.setFiles(payload);
  }
}

/**
 * Runs in the page. Fully self-contained: Playwright serializes it, so it may not reference module scope.
 * Elements are kept in a page-side list and referred to by index; nothing is written to the application's DOM.
 */
export function extractSemantic({ maxElements, measure }: { maxElements: number; measure: boolean }): ExtractionResult {
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

  /** The `required` property, for the three elements that have one. Undefined (not false) for anything else. */
  const requiredOf = (el: Element): boolean | undefined => {
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'select' || tag === 'textarea' ? (el as HTMLInputElement).required === true : undefined;
  };
  /** Whether a text-like or choice field currently holds a value — a fact, never the value itself. Undefined for a choice/file field, which have their own way of saying this (`checked`, `options`). */
  const populatedOf = (el: Element): boolean | undefined => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'select') return (el as HTMLTextAreaElement | HTMLSelectElement).value.length > 0;
    if (tag === 'input') {
      const type = (el as HTMLInputElement).type;
      if (['checkbox', 'radio', 'file', 'submit', 'button', 'reset', 'image', 'hidden'].includes(type)) return undefined;
      return (el as HTMLInputElement).value.length > 0;
    }
    return undefined;
  };

  const checkedOf = (el: Element): boolean | null => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const type = (el as HTMLInputElement).type;
      if (type === 'checkbox' || type === 'radio') return (el as HTMLInputElement).checked;
    }
    const aria = el.getAttribute('aria-checked');
    return aria === null ? null : aria === 'true';
  };
  // The name of the group a radio or checkbox belongs to: what a Flow calls the field ("Difficulty"), as opposed to
  // the choice ("Hard"). Taken from an ARIA radio group, or the legend of a fieldset.
  const groupOf = (el: Element): string | null => {
    const container = el.closest('[role=radiogroup], [role=group], fieldset');
    if (!container) return null;
    const labelledBy = container.getAttribute('aria-labelledby');
    if (labelledBy) {
      const joined = labelledBy.split(/\s+/).map((id) => text(document.getElementById(id)?.textContent)).filter(Boolean).join(' ');
      if (joined) return joined;
    }
    const aria = text(container.getAttribute('aria-label'));
    if (aria) return aria;
    const legend = container.tagName.toLowerCase() === 'fieldset' ? container.querySelector('legend') : null;
    return legend ? text(legend.textContent) || null : null;
  };

  /**
   * The smallest font size among the elements a person actually reads. Decorative and hidden text is skipped:
   * a 9px legal footnote nobody is asked to act on is not the finding, and a `display: none` node is not read
   * at all. Null when there is no text on the page to measure.
   */
  const smallestText = (): number | null => {
    let smallest: number | null = null;
    const nodes = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,td,th,label,button,a,span,strong,em,legend');
    for (const node of Array.from(nodes).slice(0, 600)) {
      const content = (node as HTMLElement).innerText ?? node.textContent ?? '';
      if (content.replace(/\s+/g, ' ').trim().length < 2) continue;
      const box = node.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) continue;
      const size = Number.parseFloat(getComputedStyle(node).fontSize);
      if (!Number.isFinite(size) || size <= 0) continue;
      if (smallest === null || size < smallest) smallest = size;
    }
    return smallest;
  };

  /**
   * How the browser actually drew the element: where it is, whether a person could reach it, and what it looks
   * like. One read of the layout and one of the resolved style per element, with nothing mutated in between, so
   * the whole pass costs a single style-and-layout resolution however many elements there are.
   *
   * `background` walks up to the nearest ancestor that paints something, because that is what text is read
   * against — an element's own `background-color` is `rgba(0, 0, 0, 0)` far more often than not.
   */
  const measureOf = (el: Element): Measured | undefined => {
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const width = innerWidth || document.documentElement.clientWidth;
    const height = innerHeight || document.documentElement.clientHeight;
    const number = (value: string): number | null => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const opaque = (value: string) => {
      const parsed = /^rgba?\(\s*[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+(?:[\s,/]+([\d.]+))?\s*\)$/.exec(value.trim());
      return parsed ? (parsed[1] === undefined ? true : Number.parseFloat(parsed[1]) > 0.01) : false;
    };
    let background: string | null = null;
    for (let node: Element | null = el; node; node = node.parentElement) {
      const painted = getComputedStyle(node).backgroundColor;
      if (opaque(painted)) { background = painted; break; }
    }
    // Nothing in the chain paints, so what is behind the text is the browser's own canvas. There is no API for
    // its colour, and it is white for every light-scheme page — which is what the managed browser always opens
    // with (`colorScheme: 'light'`). Assuming it is better than reporting nothing: reporting nothing would
    // silently skip the contrast check on exactly the pages that never set a background.
    if (!background) background = 'rgb(255, 255, 255)';
    // Only ask the document what is on top when the centre is somewhere it could answer about.
    const centreX = box.left + box.width / 2;
    const centreY = box.top + box.height / 2;
    const onScreen = box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < height && box.left < width;
    const atCentre = onScreen && centreX >= 0 && centreY >= 0 && centreX < width && centreY < height
      ? document.elementFromPoint(centreX, centreY)
      : null;
    const borderWidth = number(style.borderTopWidth);
    const ownBackground = opaque(style.backgroundColor);
    return {
      rect: { x: box.left, y: box.top, width: box.width, height: box.height },
      inViewport: onScreen,
      // Not reachable is not the same as covered: an element whose centre is off screen is scrolled to before
      // it is acted on, so it is reported as off screen rather than as something being on top of it.
      hitTestOk: atCentre === null ? onScreen : atCentre === el || el.contains(atCentre) || atCentre.contains(el),
      fontSizePx: number(style.fontSize),
      fontWeight: number(style.fontWeight),
      color: style.color || null,
      backgroundColor: background,
      borderWidthPx: borderWidth,
      borderStyle: style.borderTopStyle || null,
      cursor: style.cursor || null,
      opacity: number(style.opacity),
      emphasis: ownBackground ? 'FILLED' : borderWidth !== null && borderWidth > 0 && style.borderTopStyle !== 'none' ? 'OUTLINED' : 'TEXT',
    };
  };

  const selector = [
    'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary', '[role]', '[tabindex]', '[contenteditable=true]',
    '[data-testid]', '[data-test-id]', '[data-test]', '[data-tellann-action]',
  ].join(',');

  // Indexed once per extraction, stably: what `formIndex` on an element refers to.
  const forms = Array.from(document.querySelectorAll('form'));
  const formIndexOf = (el: Element): number | null => {
    const form = el.closest('form');
    return form ? forms.indexOf(form) : null;
  };

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
      // Facts about a choice or a toggle. Nothing here reads what a person typed into a text field.
      checked: checkedOf(el),
      options: tag === 'select'
        ? Array.from((el as HTMLSelectElement).options).filter((option) => !option.disabled && option.value !== '').slice(0, 100).map((option) => text(option.label || option.textContent))
        : null,
      optionValues: tag === 'select'
        ? Array.from((el as HTMLSelectElement).options).filter((option) => !option.disabled && option.value !== '').slice(0, 100).map((option) => option.value)
        : null,
      multiple: tag === 'select' ? (el as HTMLSelectElement).multiple : false,
      optionValue: tag === 'input' && ['radio', 'checkbox'].includes((el as HTMLInputElement).type) ? el.getAttribute('value') : null,
      popup: el.getAttribute('aria-haspopup'),
      autocomplete: el.getAttribute('autocomplete'),
      group: groupOf(el),
      required: requiredOf(el),
      populated: populatedOf(el),
      formIndex: formIndexOf(el),
      ...(measure ? { geometry: measureOf(el) } : {}),
      signature: `${signatureBase}#${occurrence}`,
    });
  }

  return {
    path: location.pathname,
    url: location.href,
    title: text(document.title) || null,
    headings: Array.from(document.querySelectorAll('h1,h2,h3')).slice(0, 12).map((h) => text(h.textContent)).filter(Boolean),
    elements,
    viewport: { width: innerWidth || document.documentElement.clientWidth, height: innerHeight || document.documentElement.clientHeight },
    // What a person would have to scroll sideways to see. Nothing should ever need this to be more than zero.
    horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    // Smallest text anywhere a person reads, which is what "too small to read" is measured against.
    smallestTextPx: measure ? smallestText() : null,
  };
}

/** The page-level half of an extraction, which both a snapshot and a viewport sample carry. */
function pageOf(extracted: ExtractionResult): NonNullable<SemanticSnapshot['page']> {
  return {
    viewport: extracted.viewport,
    horizontalOverflowPx: extracted.horizontalOverflowPx,
    smallestTextPx: extracted.smallestTextPx,
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

/** An error line with a value scrubbed out of it, for messages about choices (which may still be data a person supplied). */
function summarizeWithout(error: unknown, value: string): string {
  const line = summarize(error);
  return value ? line.split(value).join('[value]') : line;
}

function summarize(error: unknown): string {
  return String((error as Error)?.message ?? error).split('\n')[0]!.slice(0, 200);
}
