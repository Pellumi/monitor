/**
 * Opt-in render timing for the Flow's own components, measured in the managed browser.
 *
 * React reports every commit to the DevTools global hook, and (once that hook is present when React
 * starts) records how long each component's render took. This installs a minimal hook, before the
 * application loads, that keeps the durations of *named* components only and drops everything else on
 * the floor. It changes nothing in the application's source, records nothing about props, state or
 * DOM, and is only installed when a run asks for specific components — never blanket instrumentation.
 *
 * Durations are only recorded by development and profiling builds of React. That suits an Automated
 * Run, which is never allowed against production; a production build simply yields no samples, and a
 * run with no samples says nothing rather than reporting zeroes.
 */

export interface RenderTimingSnapshotEntry {
  component: string;
  mounts: number;
  updates: number;
  totalMs: number;
  maxMs: number;
}

/** The page-side API. */
export interface RenderTimingHandle {
  /** What was measured since the last call; resets the counters. */
  snapshot(): RenderTimingSnapshotEntry[];
}

export const RENDER_TIMING_GLOBAL = '__tellannRenderTiming';

/**
 * Runs in the page, before the application. Must be self-contained: it is serialised into the page
 * and cannot reference anything from this module.
 */
export function installRenderTiming(names: string[]): void {
  const scope = window as unknown as Record<string, unknown>;
  if (scope.__tellannRenderTiming) return;

  const wanted: Record<string, true> = Object.create(null);
  for (const name of names) wanted[name] = true;
  const stats: Record<string, { mounts: number; updates: number; totalMs: number; maxMs: number }> = Object.create(null);

  // Fiber tags (stable across React 17-19): the kinds of fiber that are a user's component.
  const isComponentTag = (tag: number) => tag === 0 || tag === 1 || tag === 11 || tag === 14 || tag === 15;
  const PERFORMED_WORK = 1;

  const nameOf = (fiber: { type?: unknown; elementType?: unknown }): string | null => {
    type Named = { displayName?: string; name?: string };
    const type = (fiber.elementType ?? fiber.type) as (Named & { type?: unknown; render?: unknown }) | ((...args: never[]) => unknown) & Named | null;
    if (!type) return null;
    if (typeof type === 'function') return (type as Named).displayName || (type as Named).name || null;
    if (typeof type === 'object') {
      const wrapper = type as Named & { type?: unknown; render?: unknown };
      // memo() and forwardRef() wrap the component; the name lives on what they wrap.
      const inner: unknown = wrapper.type ?? wrapper.render;
      const innerName = typeof inner === 'function' ? (inner as Named).displayName || (inner as Named).name || null : null;
      return wrapper.displayName || innerName;
    }
    return null;
  };

  type Fiber = {
    tag: number; flags: number; actualDuration?: number; alternate: unknown; child: Fiber | null; sibling: Fiber | null;
    type?: unknown; elementType?: unknown;
  };

  const record = (name: string, fiber: Fiber) => {
    const duration = typeof fiber.actualDuration === 'number' && fiber.actualDuration >= 0 ? fiber.actualDuration : null;
    if (duration === null) return; // A build that does not time renders: say nothing rather than zero.
    const entry = (stats[name] ??= { mounts: 0, updates: 0, totalMs: 0, maxMs: 0 });
    if (fiber.alternate === null) entry.mounts += 1;
    else entry.updates += 1;
    entry.totalMs += duration;
    if (duration > entry.maxMs) entry.maxMs = duration;
    try {
      // Also visible to anything that reads User Timing, such as a browser trace.
      performance.measure(`tellann:render:${name}`, { start: Math.max(0, performance.now() - duration), duration });
    } catch {
      // Timing must never break the application.
    }
  };

  const walk = (start: Fiber | null) => {
    // Iterative: a deep tree must not be able to overflow the stack of the page being observed.
    const stack: Fiber[] = start ? [start] : [];
    while (stack.length > 0) {
      const fiber = stack.pop()!;
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
      if ((fiber.flags & PERFORMED_WORK) === 0 || !isComponentTag(fiber.tag)) continue;
      const name = nameOf(fiber);
      if (name && wanted[name]) record(name, fiber);
    }
  };

  const existing = scope.__REACT_DEVTOOLS_GLOBAL_HOOK__ as Record<string, unknown> | undefined;
  let hook = existing;
  if (!hook) {
    const renderers = new Map<number, unknown>();
    let next = 0;
    hook = {
      renderers,
      supportsFiber: true,
      isDisabled: false,
      inject(renderer: unknown) { next += 1; renderers.set(next, renderer); return next; },
      checkDCE() {},
      onCommitFiberRoot() {},
      onCommitFiberUnmount() {},
      onPostCommitFiberRoot() {},
    };
    Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', { value: hook, configurable: true, writable: true });
  }
  // Wrap rather than replace, so a hook that was already there keeps working.
  const previous = hook.onCommitFiberRoot as ((...args: unknown[]) => unknown) | undefined;
  hook.onCommitFiberRoot = function (this: unknown, ...args: unknown[]) {
    try {
      const root = args[1] as { current?: Fiber } | undefined;
      walk(root?.current ?? null);
    } catch {
      // Observing must never break the application.
    }
    return previous ? previous.apply(this, args) : undefined;
  };

  const handle: RenderTimingHandle = {
    snapshot() {
      const out = Object.keys(stats).map((component) => ({ component, ...stats[component]! }));
      for (const key of Object.keys(stats)) delete stats[key];
      return out;
    },
  };
  Object.defineProperty(window, '__tellannRenderTiming', { value: handle, configurable: true });
}
