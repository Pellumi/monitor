/**
 * What a captured request is allowed to carry out of the application process.
 *
 * Two independent protections apply to a QA run's payloads. This module is the
 * first: anything that looks like a credential never leaves the server at all,
 * and bodies are clipped so one large upload cannot push an event past the
 * collector's size limit. The second lives in the desktop and the ingestion
 * pipeline, which classify every remaining leaf and encrypt it at rest.
 *
 * Doing it here as well matters because the value would otherwise sit in a
 * relay buffer, a spool file and a log line before the classifier ever sees it.
 */

export interface TellannCaptureConfig {
  /** Capture request bodies. Default true. */
  requestBody?: boolean;
  /** Capture response bodies. Default true. */
  responseBody?: boolean;
  /** Capture the safe subset of request and response headers. Default true. */
  headers?: boolean;
  /** Per-body ceiling before clipping, in bytes. Default 8 KB. */
  maxBodyBytes?: number;
  /** Extra key names to drop, on top of the built-in credential list. */
  redactKeys?: string[];
}

export type ResolvedCaptureConfig = Required<Omit<TellannCaptureConfig, 'redactKeys'>> & {
  redactKeys: string[];
};

const DEFAULT_MAX_BODY_BYTES = 8 * 1024;

export function resolveCaptureConfig(config?: TellannCaptureConfig): ResolvedCaptureConfig {
  return {
    requestBody: config?.requestBody ?? true,
    responseBody: config?.responseBody ?? true,
    headers: config?.headers ?? true,
    maxBodyBytes: config?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
    redactKeys: (config?.redactKeys ?? []).map((key) => key.toLowerCase()),
  };
}

/**
 * Key names whose value is dropped outright.
 *
 * Token based rather than substring based: a plain substring test drops
 * ordinary fields by accident (`profile` contains `file`, `company` contains
 * `pan`), and a value dropped by mistake cannot be recovered from the run.
 */
const SECRET_TOKENS = new Set([
  'password', 'passwd', 'passcode', 'passphrase', 'secret', 'token', 'jwt', 'bearer',
  'authorization', 'cookie', 'cookies', 'cvv', 'cvc', 'pin', 'otp', 'credential',
  'credentials', 'pan', 'salt', 'hash', 'signature',
]);

const SECRET_PHRASES = [
  'cardnumber', 'cardnum', 'creditcard', 'debitcard', 'securitycode',
  'sessionid', 'sessiontoken', 'sessionkey', 'privatekey', 'secretkey', 'apikey',
  'accesstoken', 'refreshtoken', 'idtoken', 'clientsecret', 'setcookie',
];

/** Request and response headers worth keeping. Everything else is dropped. */
const SAFE_HEADERS = new Set([
  'accept', 'accept-encoding', 'accept-language', 'content-type', 'content-length',
  'host', 'origin', 'referer', 'user-agent', 'x-request-id', 'x-requested-with',
  'x-forwarded-proto', 'cache-control', 'etag', 'location', 'retry-after',
]);

function tokensOf(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

export function isSecretKey(key: string, extra: string[] = []): boolean {
  const lower = key.toLowerCase();
  if (extra.includes(lower)) return true;
  const tokens = tokensOf(key);
  if (tokens.some((token) => SECRET_TOKENS.has(token))) return true;
  const joined = tokens.join('');
  return SECRET_PHRASES.some((phrase) => joined.includes(phrase));
}

/**
 * Copies a payload, dropping credential-shaped fields and clipping the result.
 *
 * Returns `undefined` when there is nothing worth sending, so the caller can
 * leave the field off the event entirely rather than send an empty object.
 */
export function sanitizePayload(
  value: unknown,
  capture: ResolvedCaptureConfig,
): unknown {
  if (value === undefined || value === null) return undefined;
  const visit = (child: unknown, key: string, depth: number): unknown => {
    if (depth > 8) return '[TRUNCATED]';
    if (child === null || typeof child === 'boolean' || typeof child === 'number') return child;
    if (typeof child === 'string') {
      if (key && isSecretKey(key, capture.redactKeys)) return '[REDACTED]';
      return child.length > 4_096 ? `${child.slice(0, 4_096)}…[TRUNCATED]` : child;
    }
    if (Array.isArray(child)) return child.slice(0, 100).map((item, index) => visit(item, `${key}.${index}`, depth + 1));
    if (typeof child === 'object') {
      if (Buffer.isBuffer(child)) return `[BINARY · ${child.length} bytes]`;
      return Object.fromEntries(
        Object.entries(child as Record<string, unknown>).slice(0, 100).map(([childKey, item]) => [
          childKey,
          isSecretKey(childKey, capture.redactKeys) ? '[REDACTED]' : visit(item, childKey, depth + 1),
        ]),
      );
    }
    return String(child).slice(0, 2_000);
  };
  const sanitized = visit(value, '', 0);
  return clipToBudget(sanitized, capture.maxBodyBytes);
}

/**
 * Keeps a sanitized payload inside its byte budget.
 *
 * A body over budget is replaced by a description of itself rather than a
 * half-serialized fragment: a truncated JSON string reads as corrupt data in
 * the run, while "an object with these keys, this big" is still useful.
 */
export function clipToBudget(value: unknown, maxBytes: number): unknown {
  let serialized: string;
  try {
    serialized = JSON.stringify(value) ?? '';
  } catch {
    return '[UNSERIALIZABLE]';
  }
  if (Buffer.byteLength(serialized, 'utf8') <= maxBytes) return value;
  if (typeof value === 'string') return `${value.slice(0, maxBytes)}…[TRUNCATED]`;
  if (Array.isArray(value)) {
    return { truncated: true, kind: 'array', length: value.length, bytes: Buffer.byteLength(serialized, 'utf8') };
  }
  if (value && typeof value === 'object') {
    return {
      truncated: true,
      kind: 'object',
      keys: Object.keys(value as Record<string, unknown>).slice(0, 50),
      bytes: Buffer.byteLength(serialized, 'utf8'),
    };
  }
  return '[TRUNCATED]';
}

/** The safe subset of a header bag, with credential headers never included. */
export function sanitizeHeaders(
  headers: Record<string, unknown> | undefined,
  capture: ResolvedCaptureConfig,
): Record<string, string> | undefined {
  if (!capture.headers || !headers) return undefined;
  const entries = Object.entries(headers)
    .filter(([key]) => SAFE_HEADERS.has(key.toLowerCase()) && !isSecretKey(key, capture.redactKeys))
    .slice(0, 40)
    .map(([key, value]) => [
      key.toLowerCase(),
      String(Array.isArray(value) ? value.join(', ') : value ?? '').slice(0, 500),
    ]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** Best-effort byte size of a payload, for the run's throughput totals. */
export function payloadBytes(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
  if (Buffer.isBuffer(value)) return value.length;
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
  } catch {
    return undefined;
  }
}

/** Parses a body the framework handed over as a raw string. */
export function parseBody(raw: unknown, contentType = ''): unknown {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string') return raw;
  if (!raw) return undefined;
  if (/json/i.test(contentType) || /^[[{]/.test(raw.trim())) {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  if (/application\/x-www-form-urlencoded/i.test(contentType)) {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }
  return raw;
}
