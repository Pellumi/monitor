import crypto from 'node:crypto';

export type QAProtectedKind = 'ORDINARY' | 'DIRECT_IDENTIFIER' | 'SECRET';

export type ProtectedValueInput = {
  keyPath: string;
  kind: QAProtectedKind;
  value?: string;
  valueLength: number;
};

export type ProtectedValueEnvelope = Omit<ProtectedValueInput, 'value'> & {
  displayValue: string;
  fingerprint?: string;
  keyVersion?: string;
  iv?: string;
  ciphertext?: string;
  authTag?: string;
};

/**
 * Classification works on tokens, not raw substrings. Substring matching
 * misfires badly on ordinary field names — `profile` contains `file`, `company`
 * contains `pan`, `apparent` contains `parent` — and a false SECRET silently
 * discards a legitimate value with no way to recover it.
 */
const SECRET_TOKENS = new Set([
  'password', 'passwd', 'passcode', 'passphrase', 'secret', 'token', 'jwt', 'bearer',
  'authorization', 'cookie', 'cvv', 'cvc', 'pin', 'otp', 'credential', 'credentials', 'pan',
]);
/** Adjacent-token phrases, compared against a segment's tokens joined together. */
const SECRET_PHRASES = [
  'cardnumber', 'cardnum', 'creditcard', 'debitcard', 'securitycode',
  'filecontent', 'filecontents', 'filedata',
  'sessionid', 'sessiontoken', 'sessionkey', 'privatekey', 'secretkey', 'apikey',
  'accesstoken', 'refreshtoken', 'idtoken', 'clientsecret',
];
const IDENTIFIER_TOKENS = new Set(['email', 'phone', 'mobile', 'msisdn', 'ssn']);
const IDENTIFIER_PHRASES = ['userid', 'accountid', 'customerid', 'emailaddress', 'phonenumber'];
/**
 * Roots whose entire subtree is application payload rather than QA telemetry.
 * Every leaf below one of these is protected by default, so a body field named
 * `address` or `notes` is encrypted instead of being stored in cleartext.
 */
const PROTECTED_ROOT_SEGMENTS = new Set([
  'value', 'previousvalue', 'nextvalue', 'newvalue',
  'requestbody', 'responsebody', 'body', 'payload', 'websocketframe', 'frame',
]);

/**
 * Markers this pipeline itself writes in place of a captured value. The browser
 * observer redacts before upload and sends the real value separately, so the
 * placeholder left behind in metadata must not be treated as a fresh value and
 * encrypted a second time.
 */
const OWN_PLACEHOLDER = /^\[(?:NOT CAPTURED(?: IN PRODUCTION)?|PSEUDONYMIZED(?: ·[^\]]*)?|PROTECTED ·[^\]]*|TRUNCATED)\]$/;

export function isQaPlaceholder(value: string): boolean {
  return OWN_PLACEHOLDER.test(value);
}

/** Splits one path segment into lowercase words across camel, snake and kebab case. */
function segmentTokens(segment: string): string[] {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

function pathSegments(keyPath: string): string[] {
  return keyPath.split('.').filter(Boolean);
}

function matchesSecret(segment: string): boolean {
  const tokens = segmentTokens(segment);
  if (tokens.some((token) => SECRET_TOKENS.has(token))) return true;
  const joined = tokens.join('');
  return SECRET_PHRASES.some((phrase) => joined.includes(phrase));
}

function matchesIdentifier(segment: string): boolean {
  const tokens = segmentTokens(segment);
  if (tokens.some((token) => IDENTIFIER_TOKENS.has(token))) return true;
  const joined = tokens.join('');
  return IDENTIFIER_PHRASES.some((phrase) => joined.includes(phrase));
}
const EMAIL_VALUE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/**
 * Deliberately requires human phone punctuation (`+`, space, parens, dash).
 * A bare digit run is far more often a timestamp, order number, or numeric id,
 * and classifying those as direct identifiers made ordinary values unrevealable.
 */
const PHONE_VALUE = /^\+?(?=(?:\D*\d){7,15}\D*$)\d{0,4}(?:[\s().-]+\d{1,6}){1,5}$/;

const KIND_RANK: Record<QAProtectedKind, number> = { ORDINARY: 0, DIRECT_IDENTIFIER: 1, SECRET: 2 };

/** The stricter of two classifications always wins. */
export function strictestQaKind(left: QAProtectedKind, right: QAProtectedKind): QAProtectedKind {
  return KIND_RANK[left] >= KIND_RANK[right] ? left : right;
}

/**
 * Server-side classification floor. Returns null when a leaf needs no
 * protection at all (ordinary QA telemetry such as an element role or status).
 */
export function classifyQaValue(keyPath: string, value?: string): QAProtectedKind | null {
  const segments = pathSegments(keyPath);
  // A secret anywhere along the path taints the whole leaf: `checkout.card.cvv`
  // and `cvv.value` are both secrets.
  if (segments.some(matchesSecret)) return 'SECRET';
  const candidate = String(value ?? '');
  if (segments.some(matchesIdentifier) || EMAIL_VALUE.test(candidate) || PHONE_VALUE.test(candidate)) {
    return 'DIRECT_IDENTIFIER';
  }
  if (segments.some((segment) => PROTECTED_ROOT_SEGMENTS.has(segmentTokens(segment).join('')))) {
    return 'ORDINARY';
  }
  return null;
}

/**
 * Re-derives the classification for a value the client asked us to protect.
 * A recorder that mislabels a password as ORDINARY must not be able to get it
 * encrypted-and-revealable, so the server floor is applied unconditionally and
 * the declared kind may only ever raise it.
 */
export function reclassifyQaProtectedValue(input: ProtectedValueInput): ProtectedValueInput {
  const derived = classifyQaValue(input.keyPath, input.value) ?? 'ORDINARY';
  const kind = strictestQaKind(derived, input.kind);
  return kind === 'SECRET'
    ? { keyPath: input.keyPath, kind, valueLength: input.valueLength }
    : { ...input, kind };
}

/**
 * True when this process is a production deployment. Deliberately distinct from
 * the QA target's environment type: a production API server may legitimately
 * run a staging capture, and its key material must still be configured.
 */
function serverRequiresConfiguredKeys(): boolean {
  return process.env.NODE_ENV === 'production';
}

function configuredKey(name: string): Buffer {
  const configured = process.env[name];
  if (!configured && serverRequiresConfiguredKeys()) throw new Error(`${name}_REQUIRED`);
  return crypto.createHash('sha256').update(configured || `tellann-local-development-${name}`).digest();
}

/**
 * Fail-closed preflight so a misconfigured production deployment is rejected at
 * ingestion, rather than silently writing values under a derived fallback key
 * that `revealQaValue` would later refuse to decrypt.
 */
export function assertQaEncryptionConfigured(): void {
  configuredKey('QA_EVIDENCE_HMAC_KEY');
  configuredKey('QA_EVIDENCE_ENCRYPTION_KEY');
}

export function sanitizeQaUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const url = new URL(raw);
    const names = [...new Set([...url.searchParams.keys()])].sort();
    url.search = names.length ? `?${names.map((name) => `${encodeURIComponent(name)}=`).join('&')}` : '';
    url.hash = '';
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function protectQaValue(
  input: ProtectedValueInput,
  options: { production: boolean },
): ProtectedValueEnvelope {
  const value = String(input.value ?? '');
  const valueLength = Number.isFinite(input.valueLength) ? Math.max(0, input.valueLength) : value.length;
  if (input.kind === 'SECRET') {
    return { keyPath: input.keyPath, kind: 'SECRET', valueLength, displayValue: '[NOT CAPTURED]' };
  }
  const hmac = crypto.createHmac('sha256', configuredKey('QA_EVIDENCE_HMAC_KEY'))
    .update(value)
    .digest('base64url');
  const keyVersion = process.env.QA_EVIDENCE_KEY_VERSION || 'v1';
  if (input.kind === 'DIRECT_IDENTIFIER') {
    return {
      keyPath: input.keyPath,
      kind: input.kind,
      valueLength,
      displayValue: `[PSEUDONYMIZED · ${hmac.slice(0, 12)}]`,
      fingerprint: hmac,
      keyVersion,
    };
  }
  if (options.production) {
    return { keyPath: input.keyPath, kind: input.kind, valueLength, displayValue: '[NOT CAPTURED IN PRODUCTION]' };
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', configuredKey('QA_EVIDENCE_ENCRYPTION_KEY'), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    keyPath: input.keyPath,
    kind: input.kind,
    valueLength,
    displayValue: `[PROTECTED · ${valueLength} characters]`,
    fingerprint: hmac,
    keyVersion,
    iv: iv.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    authTag: cipher.getAuthTag().toString('base64url'),
  };
}

export function revealQaValue(value: {
  kind: string;
  iv: string | null;
  ciphertext: string | null;
  authTag: string | null;
}): string | null {
  if (value.kind !== 'ORDINARY' || !value.iv || !value.ciphertext || !value.authTag) return null;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    configuredKey('QA_EVIDENCE_ENCRYPTION_KEY'),
    Buffer.from(value.iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(value.authTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Recursively redacts a captured metadata tree, returning the safe tree plus
 * already-protected envelopes. Leaves below a payload root default to ORDINARY
 * so application body fields are encrypted rather than stored as plaintext.
 */
export function sanitizeQaMetadata(
  input: unknown,
  options: { production: boolean; maxDepth?: number },
): { metadata: Record<string, unknown>; protectedValues: ProtectedValueEnvelope[] } {
  const protectedValues: ProtectedValueEnvelope[] = [];
  const maxDepth = options.maxDepth ?? 8;
  const visit = (value: unknown, path: string, depth: number): unknown => {
    if (depth > maxDepth) return '[TRUNCATED]';
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') {
      const clipped = value.slice(0, 16_384);
      // Already redacted upstream; re-protecting would encrypt the marker text
      // and emit a duplicate protected value alongside the real one.
      if (isQaPlaceholder(clipped)) return clipped;
      const kind = classifyQaValue(path, clipped);
      if (!kind) return clipped.slice(0, 2_000);
      const envelope = protectQaValue(
        {
          keyPath: path || 'value',
          kind,
          value: kind === 'SECRET' ? undefined : clipped,
          valueLength: value.length,
        },
        options,
      );
      protectedValues.push(envelope);
      return envelope.displayValue;
    }
    if (Array.isArray(value)) return value.slice(0, 200).map((item, index) => visit(item, `${path}.${index}`, depth + 1));
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 200)) {
        result[key] = visit(child, path ? `${path}.${key}` : key, depth + 1);
      }
      return result;
    }
    return String(value).slice(0, 2_000);
  };
  const metadata = visit(input && typeof input === 'object' ? input : {}, '', 0);
  return { metadata: metadata as Record<string, unknown>, protectedValues };
}
