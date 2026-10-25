import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import { installQaRecorder } from './injected-recorder';
import { captureMaskedViewportBuffer, readPngPixel } from './silent-capture';

/**
 * Exercises `installQaRecorder` in a real headless Chromium page rather than
 * only asserting against its source text — the hover tooltip, the pin +
 * pill composer, the annotation sidebar, resolve/delete, restore-after-
 * reload/reposition-on-scroll, and the screenshot highlight all have to
 * actually happen in a live DOM and a real captured image, not just be
 * present in the code. Playwright's locator engine cannot see into a closed
 * shadow root (verified directly: `page.locator('.tooltip')` finds nothing
 * against the real `mode: 'closed'` root), so `withOverlay` forces shadow
 * roots open for this test file only, via a context-level `attachShadow`
 * patch — `injected-recorder.ts` itself is untouched and still ships closed.
 */

const ORIGIN = 'https://overlay.test';
const ROUTE = '/orders';
const PAGE = `<!doctype html><html><body style="margin:0">
  <div style="height:1400px;position:relative">
    <button id="submit-btn" data-testid="submit-btn"
      style="position:absolute;top:260px;left:40px;color:rgb(17,24,39);font-size:16px;font-family:Arial">
      Submit order
    </button>
  </div>
</body></html>`;

type Stub = { calls: unknown[][] };

let browser: Browser;
test.before(async () => { browser = await chromium.launch({ headless: true }); });
test.after(async () => { await browser.close(); });

async function withOverlay<T>(run: (page: Page, stubs: Record<string, Stub>) => Promise<T>): Promise<T> {
  const context: BrowserContext = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  await context.route(`${ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: PAGE }));
  // Production deliberately uses a closed shadow root so the application
  // under test can't reach the overlay; Playwright's own selector engine
  // respects that and can't see into it either. Forcing it open here is a
  // test-harness-only change (this init script never ships) so assertions
  // can read the overlay DOM — it does not touch injected-recorder.ts.
  await context.addInitScript(() => {
    const original = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit) {
      return original.call(this, { ...init, mode: 'open' });
    };
  });
  const page = await context.newPage();

  const stubs: Record<string, Stub> = {};
  const saved: Array<Record<string, unknown>> = [];
  let nextId = 1;

  const expose = async (name: string, impl: (...args: unknown[]) => unknown) => {
    stubs[name] = { calls: [] };
    await page.exposeFunction(name, (...args: unknown[]) => {
      stubs[name].calls.push(args);
      return impl(...args);
    });
  };

  await expose('__test_bridge', () => undefined);
  await expose('__test_members', () => [{ id: 'user-1', displayName: 'Ada Lovelace' }]);
  await expose('__test_snapshot', () => true);
  await expose('__test_annotations', (payload: unknown) => {
    const input = payload as Record<string, unknown>;
    const mentionedUserIds = Array.isArray(input.mentionedUserIds) ? input.mentionedUserIds as string[] : [];
    const record = {
      id: `ann-${nextId++}`,
      ...input,
      resolved: false,
      author: { displayName: 'QA author' },
      mentions: mentionedUserIds.map((id) => ({ userId: id, displayNameSnapshot: 'Ada Lovelace' })),
    };
    saved.push(record);
    return record;
  });
  await expose('__test_annotations_list', (route: unknown) => saved.filter((item) => item.normalizedRoute === route));
  await expose('__test_annotations_update', (id: unknown, input: unknown) => {
    const record = saved.find((item) => item.id === id);
    if (record) Object.assign(record, input);
    return record ?? null;
  });
  await expose('__test_annotations_delete', (id: unknown) => {
    const index = saved.findIndex((item) => item.id === id);
    if (index >= 0) saved.splice(index, 1);
  });
  await expose('__test_annotations_resolve', (id: unknown, resolved: unknown) => {
    const record = saved.find((item) => item.id === id);
    if (record) record.resolved = resolved;
    return record ?? null;
  });

  await page.addInitScript(installQaRecorder, {
    bridge: '__test_bridge',
    members: '__test_members',
    annotations: '__test_annotations',
    snapshot: '__test_snapshot',
    annotationsList: '__test_annotations_list',
    annotationsUpdate: '__test_annotations_update',
    annotationsDelete: '__test_annotations_delete',
    annotationsResolve: '__test_annotations_resolve',
    origin: ORIGIN,
    production: false,
  });

  try {
    // Deterministic accent color for pixel-level screenshot assertions.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`${ORIGIN}${ROUTE}`);
    return await run(page, stubs);
  } finally {
    await context.close();
  }
}

/** The button's screen-space center, for `page.mouse` calls that bypass actionability checks the shield would fail. */
async function centerOf(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${selector} must have a bounding box`);
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

test('hovering an element in Inspect mode shows its tag, size and computed color/font', async () => {
  await withOverlay(async (page) => {
    await page.evaluate(() => (globalThis as any).__tellannQaSetMode('INSPECT'));
    const { x, y } = await centerOf(page, '#submit-btn');
    await page.mouse.move(x, y);
    await page.locator('.tooltip:not([hidden])').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.tooltip .tag').textContent(), 'button');
    const meta = await page.locator('.tooltip .meta').textContent();
    assert.match(meta ?? '', /^\d+×\d+ · #111827 · 16px Arial$/, `unexpected tooltip meta: ${meta}`);
    // The badge marks Inspect mode as active, matching the reference design.
    await expect_visible(page, '.badge');
  });
});

test('selecting an element opens the inline pill; saving creates a pin and posts the full fingerprint', async () => {
  await withOverlay(async (page, stubs) => {
    await page.evaluate(() => (globalThis as any).__tellannQaSetMode('INSPECT'));
    const { x, y } = await centerOf(page, '#submit-btn');
    await page.mouse.move(x, y);
    await page.mouse.click(x, y);
    await page.locator('.pill:not([hidden])').waitFor({ state: 'visible' });
    await page.locator('.pill-input').fill('Button does nothing when clicked');
    await page.locator('.pill-save').click();
    await page.locator('.pin').first().waitFor({ state: 'visible' });

    assert.equal(stubs.__test_annotations.calls.length, 1);
    const payload = stubs.__test_annotations.calls[0][0] as Record<string, unknown>;
    assert.equal(payload.comment, 'Button does nothing when clicked');
    assert.equal(payload.normalizedRoute, ROUTE);
    const fingerprint = payload.elementFingerprint as Record<string, unknown>;
    assert.equal(fingerprint.tag, 'button');
    assert.equal(fingerprint.testId, 'submit-btn');

    assert.equal(await page.locator('.pin').count(), 1);
    assert.equal(await page.locator('.sidebar-toggle-count').textContent(), '1');
    assert.equal(await page.locator('.sidebar-toggle').isHidden(), false);
  });
});

test('a saved annotation can be reviewed from the sidebar, resolved and deleted from its pin', async () => {
  await withOverlay(async (page, stubs) => {
    await createOneAnnotation(page);

    // The sidebar is the dedicated reviewing surface: open it and confirm the
    // comment is listed without needing to re-enter Inspect mode.
    await page.locator('.sidebar-toggle').click();
    await page.locator('.sidebar:not([hidden])').waitFor({ state: 'visible' });
    assert.match((await page.locator('.sidebar-row').first().textContent()) ?? '', /Button does nothing/);
    await page.locator('.sidebar-row').first().click();
    await page.locator('.pill:not([hidden])').waitFor({ state: 'visible' });
    await page.locator('.pill-actions:not([hidden])').waitFor({ state: 'visible' });

    await page.locator('.pill-resolve').click();
    assert.equal(stubs.__test_annotations_resolve.calls.length, 1);
    assert.equal(stubs.__test_annotations_resolve.calls[0][1], true);
    await page.locator('.pin.resolved').first().waitFor({ state: 'visible' });
    assert.equal(await page.locator('.pin').first().textContent(), '✓');

    await page.locator('.pin').first().click();
    await page.locator('.pill-delete').click();
    assert.equal(stubs.__test_annotations_delete.calls.length, 1);
    await page.locator('.pin').first().waitFor({ state: 'detached' });
    assert.equal(await page.locator('.sidebar-toggle').isHidden(), true);
  });
});

test('an annotation restores as a pin after reload, and the pin tracks the element when the page scrolls', { timeout: 15_000 }, async () => {
  await withOverlay(async (page) => {
    await createOneAnnotation(page);

    await page.reload();
    // No user interaction here: the restored pin comes entirely from the
    // recorder's own initial loadAnnotations() call on install.
    await page.locator('.pin').first().waitFor({ state: 'visible' });
    assert.equal(await page.locator('.pin').count(), 1);

    const before = await page.locator('.pin').first().boundingBox();
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(250); // the resize/scroll reposition handler
    const after = await page.locator('.pin').first().boundingBox();
    assert.ok(before && after, 'the pin must have a bounding box before and after scrolling');
    assert.notEqual(after!.y, before!.y, 'the pin should have moved with the scrolled element');
  });
});

test('a real captured screenshot shows the highlighted element, both at selection time and in the fallback capture path', async () => {
  await withOverlay(async (page) => {
    await page.evaluate(() => (globalThis as any).__tellannQaSetMode('INSPECT'));
    const { x, y } = await centerOf(page, '#submit-btn');
    await page.mouse.move(x, y);
    const box = await page.locator('.outline').boundingBox();
    assert.ok(box, '.outline must be positioned over the hovered element');

    // Same function production uses for the pre-pick snapshot (selectElement
    // calls `invoke(config.snapshot)` while the outline is already visible,
    // before the pill ever opens) and for the fallback capture.
    const beforeShot = await captureMaskedViewportBuffer(page);
    assert.ok(beforeShot, 'captureMaskedViewportBuffer must succeed against a real page');
    const scale = beforeShot!.readUInt32BE(16) / 1024; // image width ÷ the 1024px viewport set in withOverlay
    const insideOutline = readPngPixel(beforeShot!, Math.round((box!.x + box!.width / 2) * scale), Math.round((box!.y + 6) * scale));
    const plainBackground = readPngPixel(beforeShot!, Math.round(10 * scale), Math.round(10 * scale));
    assert.ok(insideOutline && plainBackground, 'both sample points must decode to real pixels');
    assert.ok(
      plainBackground![0] > 230 && plainBackground![1] > 230 && plainBackground![2] > 230,
      `expected a plain white page background away from the outline, got rgb(${plainBackground!.slice(0, 3)})`,
    );
    assert.notDeepEqual(
      insideOutline!.slice(0, 3), plainBackground!.slice(0, 3),
      'a pixel inside the outline must be visibly tinted by the accent highlight, not just the plain background',
    );

    // The exact bug B3 fixed: toggling screenshot mode (the fallback capture
    // path's own signal to hide the composer) must hide the pill, never the
    // outline — confirmed here against a second real capture, not just by
    // reading what the setter's source does.
    await page.evaluate(() => (globalThis as any).__tellannQaScreenshotMode(true));
    const duringFallbackCapture = await captureMaskedViewportBuffer(page);
    await page.evaluate(() => (globalThis as any).__tellannQaScreenshotMode(false));
    assert.ok(duringFallbackCapture, 'the fallback capture must also succeed');
    const stillTinted = readPngPixel(duringFallbackCapture!, Math.round((box!.x + box!.width / 2) * scale), Math.round((box!.y + 6) * scale));
    assert.ok(stillTinted);
    assert.notDeepEqual(
      stillTinted!.slice(0, 3), plainBackground!.slice(0, 3),
      'the outline must still show in the fallback-path capture, not just the pre-pick one',
    );
  });
});

async function createOneAnnotation(page: Page) {
  await page.evaluate(() => (globalThis as any).__tellannQaSetMode('INSPECT'));
  const { x, y } = await centerOf(page, '#submit-btn');
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
  await page.locator('.pill:not([hidden])').waitFor({ state: 'visible' });
  await page.locator('.pill-input').fill('Button does nothing when clicked');
  await page.locator('.pill-save').click();
  await page.locator('.pin').first().waitFor({ state: 'visible' });
}

async function expect_visible(page: Page, selector: string) {
  assert.equal(await page.locator(selector).isHidden(), false, `${selector} should be visible`);
}
