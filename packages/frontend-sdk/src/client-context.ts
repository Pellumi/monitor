import type { ClientContext } from './event-types.js';

/**
 * What the page is, as opposed to what happened on it.
 *
 * Captured once per session and attached to every event. There was none of this
 * before, which is why "is this bug browser-specific?" had no answer anywhere in the
 * product.
 *
 * Everything here is best-effort and every field is optional: a headless runtime has
 * no `screen`, an old browser has no `Intl.DateTimeFormat().resolvedOptions`, and a
 * privacy-hardened one reports a deliberately flattened user agent. A missing field
 * is a null column, never a thrown error and never a guess.
 */

const MOBILE_HINT = /android|iphone|ipod|blackberry|iemobile|opera mini|windows phone/i;
const TABLET_HINT = /ipad|tablet|playbook|silk|kindle/i;
const BOT_HINT = /bot|crawler|spider|crawling|headlesschrome|phantomjs|lighthouse|pingdom/i;

function detectDeviceType(userAgent: string, touchPoints: number, width: number): ClientContext['deviceType'] {
  if (!userAgent) return 'unknown';
  if (BOT_HINT.test(userAgent)) return 'bot';
  if (TABLET_HINT.test(userAgent)) return 'tablet';
  if (MOBILE_HINT.test(userAgent)) return 'mobile';
  // iPadOS reports a desktop Safari user agent, so the only signal left is a touch
  // screen on a large viewport.
  if (touchPoints > 1 && width >= 768) return 'tablet';
  if (touchPoints > 1) return 'mobile';
  return 'desktop';
}

interface NameAndVersion {
  name?: string;
  version?: string;
}

/**
 * Browser family and major version.
 *
 * Order matters: Edge and Opera both carry "Chrome" in their user agent, and Chrome
 * carries "Safari", so the most specific pattern has to win. Only the major version
 * is kept — a full build string is high-entropy and adds nothing to "which browsers
 * is this broken on".
 */
function detectBrowser(userAgent: string): NameAndVersion {
  const patterns: Array<[string, RegExp]> = [
    ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
    ['Opera', /OPR\/(\d+)/],
    ['Samsung Internet', /SamsungBrowser\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Safari', /Version\/(\d+).*Safari/],
  ];
  for (const [name, pattern] of patterns) {
    const match = userAgent.match(pattern);
    if (match) return { name, version: match[1] };
  }
  return {};
}

function detectOs(userAgent: string): NameAndVersion {
  const patterns: Array<[string, RegExp | null]> = [
    ['Windows', /Windows NT (\d+\.\d+)/],
    ['Android', /Android (\d+)/],
    ['iOS', /OS (\d+)[._]\d+ like Mac OS X/],
    ['macOS', /Mac OS X (\d+)[._]\d+/],
    ['Linux', null],
    ['CrOS', null],
  ];
  for (const [name, pattern] of patterns) {
    if (!pattern) {
      if (userAgent.includes(name)) return { name: name === 'CrOS' ? 'ChromeOS' : name };
      continue;
    }
    const match = userAgent.match(pattern);
    if (match) return { name, version: match[1]?.replace('_', '.') };
  }
  return {};
}

/** Trims a value to the envelope's declared limit, so a hostile UA cannot bloat it. */
function cap(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export function captureClientContext(releaseVersion?: string | null): ClientContext {
  const context: ClientContext = {};

  try {
    const nav = globalThis.navigator as Navigator | undefined;
    const userAgent = nav?.userAgent ?? '';
    const width = globalThis.innerWidth ?? 0;

    context.deviceType = detectDeviceType(userAgent, nav?.maxTouchPoints ?? 0, width);

    const browser = detectBrowser(userAgent);
    context.browserName = cap(browser.name, 40);
    context.browserVersion = cap(browser.version, 24);

    const os = detectOs(userAgent);
    context.osName = cap(os.name, 40);
    context.osVersion = cap(os.version, 24);

    // The layout viewport, not the screen: what the user could actually see is what
    // reproduces a layout bug.
    if (Number.isFinite(width) && width > 0) context.viewportWidth = Math.round(width);
    const height = globalThis.innerHeight ?? 0;
    if (Number.isFinite(height) && height > 0) context.viewportHeight = Math.round(height);

    context.locale = cap(nav?.language, 35);
  } catch {
    // A runtime without navigator or window still gets a valid, empty context.
  }

  try {
    context.timezone = cap(Intl.DateTimeFormat().resolvedOptions().timeZone, 64);
  } catch {
    // Intl is absent or the zone is unresolvable.
  }

  if (releaseVersion) context.releaseVersion = cap(releaseVersion, 64);

  // Drop the keys that resolved to nothing, so an empty context serialises as {}
  // rather than as ten nulls repeated on every event.
  for (const key of Object.keys(context) as Array<keyof ClientContext>) {
    if (context[key] === undefined) delete context[key];
  }

  return context;
}
