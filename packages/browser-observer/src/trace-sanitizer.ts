import { deflateRawSync, inflateRawSync } from 'node:zlib';

/**
 * Makes a Playwright trace safe to leave the machine.
 *
 * A raw trace is a forensic recording, and it records too much: the value passed to every `fill`,
 * request headers with cookies and bearer tokens, request and response bodies, and (when enabled)
 * screenshots and DOM snapshots that show whatever was typed. The rest of the observer works hard
 * never to record any of that, so a trace may not undo it.
 *
 * Automated runs therefore record traces without screenshots, snapshots or sources, and rewrite the
 * archive here before it is stored. The action log is rebuilt from an allowlist of fields per event
 * type rather than by blanking known-bad ones, because what Playwright writes is broader than it
 * looks: the value of every `fill` is logged twice (as a parameter and as a log line), the log
 * quotes the outerHTML of whatever it resolved, and the *result* of every `evaluate` — which is how
 * the driver reads the page — is stored. So: typed text, evaluated code and results, element
 * markup, bodies, cookies and sensitive headers are all removed, and any registered protected value
 * is scrubbed wherever else it turns up. What remains is the action log (what was done to what, when,
 * and whether it errored) and console output — what a person needs to see *why* a step failed.
 *
 * The zip codec is deliberately tiny (stored/deflate, no zip64): Playwright writes plain archives and
 * this avoids a dependency for a hundred lines.
 */

export const REDACTED = '[REDACTED]';

export interface ZipEntry { name: string; data: Buffer }

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function readZip(zip: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i -= 1) {
    if (zip.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('NOT_A_ZIP_ARCHIVE');
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  if (count === 0xffff || offset === 0xffffffff) throw new Error('ZIP64_UNSUPPORTED');
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n += 1) {
    if (zip.readUInt32LE(offset) !== CENTRAL) throw new Error('CORRUPT_ZIP_DIRECTORY');
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (zip.readUInt32LE(localOffset) !== LOCAL) throw new Error('CORRUPT_ZIP_ENTRY');
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const raw = zip.subarray(dataStart, dataStart + compressedSize);
    if (method !== 0 && method !== 8) throw new Error('ZIP_METHOD_UNSUPPORTED');
    if (!name.endsWith('/')) entries.push({ name, data: method === 0 ? Buffer.from(raw) : inflateRawSync(raw) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function writeZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(EOCD, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const SENSITIVE_HEADERS = new Set([
  'cookie', 'set-cookie', 'authorization', 'proxy-authorization', 'x-api-key', 'x-auth-token',
  'x-csrf-token', 'x-xsrf-token', 'x-access-token', 'x-amz-security-token',
]);
/** Actions whose argument is text a person typed. Recorded verbatim by Playwright; never kept here. */
const TYPING_METHODS = new Set(['fill', 'type', 'pressSequentially', 'insertText']);
/** Keys that hold request/response bodies or references to them. */
const BODY_KEYS = new Set(['postData', '_sha1', 'sha1']);
/** Parameters that carry content rather than intent, dropped from every action. */
const CONTENT_PARAMS = new Set(['value', 'text', 'expression', 'arg', 'options', 'payloads', 'files', 'streams', 'localPaths', 'source', 'func', 'script']);
/** The fields kept for each kind of trace event; an event kind not listed here is dropped whole. */
const EVENT_FIELDS: Record<string, string[]> = {
  'context-options': ['type', 'version', 'origin', 'browserName', 'platform', 'wallTime', 'monotonicTime', 'title', 'sdkLanguage'],
  before: ['type', 'callId', 'startTime', 'apiName', 'class', 'method', 'params', 'pageId', 'parentId', 'stepId', 'title'],
  after: ['type', 'callId', 'endTime', 'error'],
  log: ['type', 'callId', 'time', 'message'],
  console: ['type', 'time', 'pageId', 'messageType', 'text'],
  error: ['type', 'message'],
};
/** Actions after which the log line itself would repeat what was typed or chosen. */
const CONTENT_ACTIONS = new Set(['fill', 'type', 'pressSequentially', 'insertText', 'selectOption', 'setInputFiles']);
/** Values below this length are too likely to be ordinary words to scrub by substring. */
const MIN_SCRUB_LENGTH = 4;

export interface TraceSanitizeOptions {
  /** Values that must not appear anywhere in the archive (typed passwords, tokens). */
  protectedValues?: string[];
  /** Applied to every URL found, to drop credentials and query values. */
  sanitizeUrl?: (url: string) => string;
}

export interface TraceSanitizeResult {
  archive: Buffer;
  stats: { droppedResources: number; redactedValues: number; droppedLines: number };
}

export function sanitizeTraceArchive(zip: Buffer, options: TraceSanitizeOptions = {}): TraceSanitizeResult {
  const secrets = [...new Set((options.protectedValues ?? []).filter((value) => value.length >= MIN_SCRUB_LENGTH))]
    .sort((a, b) => b.length - a.length);
  const stats = { droppedResources: 0, redactedValues: 0, droppedLines: 0 };

  const scrub = (text: string): string => {
    let out = text;
    for (const secret of secrets) {
      if (out.includes(secret)) {
        out = out.split(secret).join(REDACTED);
        stats.redactedValues += 1;
      }
    }
    if (options.sanitizeUrl && /^https?:\/\/\S+$/i.test(out)) out = options.sanitizeUrl(out);
    return out;
  };

  const clean = (value: unknown, parentKey = ''): unknown => {
    if (typeof value === 'string') return scrub(value);
    if (Array.isArray(value)) {
      // Headers appear as [{ name, value }].
      return value.map((item) => {
        if (item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string'
          && SENSITIVE_HEADERS.has(String((item as { name: string }).name).toLowerCase())) {
          stats.redactedValues += 1;
          return { ...(item as object), value: REDACTED };
        }
        return clean(item, parentKey);
      });
    }
    if (value && typeof value === 'object') {
      const source = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      const typing = typeof source.method === 'string' && TYPING_METHODS.has(source.method);
      for (const [key, child] of Object.entries(source)) {
        if (BODY_KEYS.has(key)) { stats.redactedValues += 1; continue; }
        if (key === 'cookies') { stats.redactedValues += 1; out[key] = []; continue; }
        if (SENSITIVE_HEADERS.has(key.toLowerCase())) { stats.redactedValues += 1; out[key] = REDACTED; continue; }
        if (typing && key === 'params' && child && typeof child === 'object') {
          const params = { ...(child as Record<string, unknown>) };
          for (const field of ['value', 'text']) if (field in params) { params[field] = REDACTED; stats.redactedValues += 1; }
          out[key] = clean(params, key);
          continue;
        }
        out[key] = clean(child, key);
      }
      return out;
    }
    return value;
  };

  /** An action log event reduced to what is safe to keep, or null when the whole event is dropped. */
  const shape = (event: unknown, methods: Map<string, string>): unknown => {
    if (!event || typeof event !== 'object') return null;
    const source = event as Record<string, unknown>;
    const fields = typeof source.type === 'string' ? EVENT_FIELDS[source.type] : undefined;
    if (!fields) return null;
    const out: Record<string, unknown> = {};
    for (const field of fields) if (field in source) out[field] = source[field];
    const callId = typeof source.callId === 'string' ? source.callId : null;

    if (source.type === 'before') {
      const method = typeof source.method === 'string' ? source.method : '';
      if (callId) methods.set(callId, method);
      if (out.params && typeof out.params === 'object') {
        const params: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(out.params as Record<string, unknown>)) {
          if (CONTENT_PARAMS.has(key)) { params[key] = REDACTED; stats.redactedValues += 1; } else params[key] = value;
        }
        out.params = params;
      }
    }
    if (source.type === 'log' && typeof out.message === 'string') {
      const method = callId ? methods.get(callId) : undefined;
      if (method && CONTENT_ACTIONS.has(method) && /^\s*(fill|type|pressSequentially|insertText|selectOption|setInputFiles)\(/.test(out.message)) {
        out.message = REDACTED;
        stats.redactedValues += 1;
      } else {
        // "locator resolved to <button ... onclick=...>" quotes the element's whole markup.
        out.message = out.message.replace(/(<[a-zA-Z][\w-]*)[^>]*>[\s\S]*$/, (_match, tag: string) => `${tag}>`);
      }
    }
    return clean(out);
  };

  const kept: ZipEntry[] = [];
  for (const entry of readZip(zip)) {
    if (entry.name.startsWith('resources/')) { stats.droppedResources += 1; continue; }
    if (/\.(trace|network)$/.test(entry.name)) {
      const lines: string[] = [];
      const methods = new Map<string, string>();
      const isNetwork = entry.name.endsWith('.network');
      for (const line of entry.data.toString('utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const parsed: unknown = JSON.parse(line);
          const shaped = isNetwork ? clean(parsed) : shape(parsed, methods);
          if (shaped === null) { stats.droppedLines += 1; continue; }
          lines.push(JSON.stringify(shaped));
        } catch {
          // A line that will not parse cannot be checked, so it is not kept.
          stats.droppedLines += 1;
        }
      }
      kept.push({ name: entry.name, data: Buffer.from(lines.join('\n') + '\n', 'utf8') });
      continue;
    }
    // Anything else (stack tables, unknown additions) is neither inspected nor trusted.
    stats.droppedResources += 1;
  }
  kept.push({
    name: 'tellann-sanitized.json',
    data: Buffer.from(JSON.stringify({
      sanitized: true,
      removed: 'Typed text, evaluated code and results, element markup, request and response bodies, cookies, sensitive headers, screenshots and DOM snapshots.',
      ...stats,
    }, null, 2), 'utf8'),
  });
  return { archive: writeZip(kept), stats };
}
