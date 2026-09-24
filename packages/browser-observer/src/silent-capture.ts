import fs from 'node:fs';
import zlib from 'node:zlib';
import type { Page } from 'playwright';

/**
 * Screenshots taken while the operator is driving the managed browser.
 *
 * Playwright's `page.screenshot({ mask })` masks by painting coloured boxes
 * over every sensitive field in the *live* page, resizing the layout for
 * `fullPage`, and removing both again afterwards. In a headed window that is
 * visible: every navigation or refresh settles, is captured, and the page
 * blinks near-black over its inputs while it happens.
 *
 * This takes the picture straight from the compositor instead, leaves the DOM
 * untouched, and applies the mask to the encoded image afterwards. Nothing the
 * operator can see changes.
 */

export type MaskRect = { x: number; y: number; width: number; height: number };

const MASK_COLOR: readonly [number, number, number] = [0x11, 0x18, 0x27];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(...parts: Buffer[]): number {
  let crc = 0xffffffff;
  for (const part of parts) {
    for (let index = 0; index < part.length; index += 1) {
      crc = CRC_TABLE[(crc ^ part[index]) & 0xff] ^ (crc >>> 8);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii');
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(name, data));
  return Buffer.concat([head, name, data, tail]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Fills the given rectangles (in image pixels) with the mask colour.
 *
 * Handles only what a browser screenshot actually is: 8-bit, non-interlaced,
 * truecolour with or without alpha. Anything else returns null so the caller
 * can fall back rather than ship an unmasked picture.
 */
export function maskPng(source: Buffer, rects: MaskRect[]): Buffer | null {
  if (source.length < 33 || !source.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  let width = 0;
  let height = 0;
  let channels = 0;
  const data: Buffer[] = [];
  for (let offset = 8; offset + 12 <= source.length;) {
    const length = source.readUInt32BE(offset);
    const type = source.toString('ascii', offset + 4, offset + 8);
    const body = source.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      const colorType = body[9];
      const interlace = body[12];
      if (depth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) return null;
      channels = colorType === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      data.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }
  if (!width || !height || !channels || !data.length) return null;

  const stride = width * channels;
  let inflated: Buffer;
  try { inflated = zlib.inflateSync(Buffer.concat(data)); } catch { return null; }
  if (inflated.length !== (stride + 1) * height) return null;

  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[y * (stride + 1)];
    const row = y * stride;
    const input = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[input + x];
      const left = x >= channels ? pixels[row + x - channels] : 0;
      const up = y > 0 ? pixels[row - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[row - stride + x - channels] : 0;
      let value: number;
      switch (filter) {
        case 0: value = raw; break;
        case 1: value = raw + left; break;
        case 2: value = raw + up; break;
        case 3: value = raw + ((left + up) >> 1); break;
        case 4: value = raw + paeth(left, up, upLeft); break;
        default: return null;
      }
      pixels[row + x] = value & 0xff;
    }
  }

  for (const rect of rects) {
    const left = Math.max(0, Math.floor(rect.x));
    const top = Math.max(0, Math.floor(rect.y));
    const right = Math.min(width, Math.ceil(rect.x + rect.width));
    const bottom = Math.min(height, Math.ceil(rect.y + rect.height));
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const at = y * stride + x * channels;
        pixels[at] = MASK_COLOR[0];
        pixels[at + 1] = MASK_COLOR[1];
        pixels[at + 2] = MASK_COLOR[2];
        if (channels === 4) pixels[at + 3] = 0xff;
      }
    }
  }

  // Filter type 0 on every row: the output is no smaller than a filtered
  // encode would be by a meaningful margin for UI screenshots, and it cannot
  // get the filter arithmetic wrong.
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    pixels.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Where the sensitive fields are in the current viewport, in CSS pixels.
 * Mirrors the locator the painted mask used — form fields, editable regions
 * and anything marked `data-tellann-sensitive` — and also looks inside open
 * shadow roots. The recorder's own overlay is a closed root, so it is never
 * reported.
 */
function readSensitiveRects(): { rects: MaskRect[]; viewportWidth: number } {
  const selector = 'input, textarea, select, [contenteditable="true"], [data-tellann-sensitive]';
  const rects: MaskRect[] = [];
  const visit = (root: ParentNode) => {
    for (const element of Array.from(root.querySelectorAll(selector))) {
      const box = element.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) rects.push({ x: box.left, y: box.top, width: box.width, height: box.height });
    }
    for (const element of Array.from(root.querySelectorAll('*'))) {
      const shadow = (element as HTMLElement).shadowRoot;
      if (shadow) visit(shadow);
    }
  };
  visit(document);
  // `innerWidth`, not `clientWidth`: the captured image includes the scrollbar.
  return { rects, viewportWidth: innerWidth };
}

/**
 * Captures the visible viewport to `file` with sensitive fields masked, without
 * touching the page. Returns false when it could not, in which case nothing is
 * written and the caller should use the painted-mask path instead.
 */
export async function captureMaskedViewport(page: Page, file: string): Promise<boolean> {
  let session: Awaited<ReturnType<ReturnType<Page['context']>['newCDPSession']>> | null = null;
  try {
    session = await page.context().newCDPSession(page);
    // Fields are located both before and after the picture and the masks are
    // the union of the two. The page can move in the milliseconds between the
    // reads (a scroll, an animating panel), and a field that had moved out from
    // under a single early read would otherwise be left readable.
    const before = await page.evaluate(readSensitiveRects);
    const shot = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const after = await page.evaluate(readSensitiveRects);
    const png = Buffer.from(shot.data, 'base64');
    if (png.length < 33) return false;
    const imageWidth = png.readUInt32BE(16);
    const { viewportWidth } = after;
    const scale = viewportWidth > 0 ? imageWidth / viewportWidth : 1;
    const masked = maskPng(png, [...before.rects, ...after.rects].map((rect) => ({
      x: rect.x * scale, y: rect.y * scale, width: rect.width * scale, height: rect.height * scale,
    })));
    if (!masked) return false;
    fs.writeFileSync(file, masked);
    return true;
  } catch {
    return false;
  } finally {
    await session?.detach().catch(() => undefined);
  }
}
