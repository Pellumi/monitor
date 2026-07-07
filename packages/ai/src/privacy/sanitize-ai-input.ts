import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Regex patterns for sensitive data detection
// ─────────────────────────────────────────────────────────────

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/\-]+=*/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g;
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const PRIVATE_KEY_RE = /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/gi;
// Env-style secrets: KEY=value or KEY: value
const ENV_SECRET_RE = /\b(?:password|passwd|pwd|secret|api[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|db[_-]?pass(?:word)?|database[_-]?url)\s*[:=]\s*["']?[^"'\s,;\n]{4,}/gi;
// OAuth / session tokens — long random-looking strings
const API_KEY_RE = /\b(?:sk|pk|rk|api|tok|key|secret)-[A-Za-z0-9]{20,}\b/g;
// URLs with embedded credentials: http://user:pass@host
const URL_CRED_RE = /https?:\/\/[^@\s]+:[^@\s]+@[^\s]+/gi;
// Long unstructured payloads (>512 chars of continuous non-whitespace)
const LARGE_PAYLOAD_RE = /\S{512,}/g;

// Prompt injection patterns (to flag, not redact)
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /reveal\s+(?:your\s+)?system\s+prompt/i,
  /send\s+(?:me|them|the)\s+(?:your\s+)?(?:secrets?|credentials?|keys?|tokens?)/i,
  /bypass\s+(?:your\s+)?(?:policies|safety|filter|restrictions?)/i,
  /act\s+as\s+(?:a\s+)?system\s+admin/i,
  /you\s+are\s+now\s+(?:a\s+)?(?:different|evil|unrestricted|jailbroken)/i,
  /do\s+not\s+follow\s+(?:your\s+)?(?:guidelines|rules|policies)/i,
  /pretend\s+(?:you\s+are|you're|to\s+be)/i,
  /disregard\s+(?:all\s+)?(?:previous|your\s+)?instructions?/i,
  /print\s+your\s+(?:system\s+)?prompt/i,
];

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type RedactionType =
  | 'EMAIL'
  | 'PHONE'
  | 'BEARER_TOKEN'
  | 'JWT'
  | 'API_KEY'
  | 'CREDIT_CARD'
  | 'PRIVATE_KEY'
  | 'ENV_SECRET'
  | 'URL_CREDENTIAL'
  | 'LARGE_PAYLOAD';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RedactionSummary {
  type: RedactionType;
  count: number;
}

export interface SanitizeResult {
  sanitizedText: string;
  redactions: RedactionSummary[];
  riskLevel: RiskLevel;
  promptInjectionRisk: boolean;
  injectionPatterns: string[];
  originalHash: string;
}

// ─────────────────────────────────────────────────────────────
// Core sanitization
// ─────────────────────────────────────────────────────────────

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

/**
 * Sanitizes user input before it is sent to an AI provider.
 * Returns the sanitized text along with a summary of what was redacted.
 */
export function sanitizeAiInputFull(value: string): SanitizeResult {
  const originalHash = crypto.createHash('sha256').update(value).digest('hex');
  const redactions: RedactionSummary[] = [];
  let text = value;

  function redact(type: RedactionType, re: RegExp, replacement: string) {
    const count = countMatches(text, re);
    if (count > 0) {
      redactions.push({ type, count });
      text = text.replace(re, replacement);
    }
  }

  // Order matters — more specific patterns first
  redact('PRIVATE_KEY', PRIVATE_KEY_RE, '[redacted-private-key]');
  redact('JWT', JWT_RE, '[redacted-jwt]');
  redact('BEARER_TOKEN', BEARER_RE, 'Bearer [redacted-token]');
  redact('LARGE_PAYLOAD', LARGE_PAYLOAD_RE, '[truncated-large-payload]');

  // ENV_SECRET_RE uses a function replacer for the key-preserving replacement
  {
    const count = countMatches(text, ENV_SECRET_RE);
    if (count > 0) {
      redactions.push({ type: 'ENV_SECRET', count });
      text = text.replace(ENV_SECRET_RE, (match: string) => `${match.split(/[:=]/)[0]}=[redacted-secret]`);
    }
  }

  redact('API_KEY', API_KEY_RE, '[redacted-api-key]');
  redact('URL_CREDENTIAL', URL_CRED_RE, '[redacted-url-with-credentials]');
  // CREDIT_CARD must run before PHONE to prevent card numbers from matching PHONE_RE
  redact('CREDIT_CARD', CARD_RE, '[redacted-payment-card]');
  redact('EMAIL', EMAIL_RE, '[redacted-email]');
  redact('PHONE', PHONE_RE, '[redacted-phone]');

  // Prompt injection detection
  const injectionPatterns: string[] = [];
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      injectionPatterns.push(pattern.source);
    }
  }
  const promptInjectionRisk = injectionPatterns.length > 0;

  // Risk level
  const highRiskTypes: RedactionType[] = ['PRIVATE_KEY', 'JWT', 'ENV_SECRET', 'BEARER_TOKEN', 'API_KEY'];
  const mediumRiskTypes: RedactionType[] = ['CREDIT_CARD', 'URL_CREDENTIAL', 'EMAIL'];

  let riskLevel: RiskLevel = 'LOW';
  if (redactions.some((r) => highRiskTypes.includes(r.type)) || promptInjectionRisk) {
    riskLevel = 'HIGH';
  } else if (redactions.some((r) => mediumRiskTypes.includes(r.type))) {
    riskLevel = 'MEDIUM';
  }

  return {
    sanitizedText: text,
    redactions,
    riskLevel,
    promptInjectionRisk,
    injectionPatterns,
    originalHash,
  };
}

/**
 * Simplified string-only sanitizer. Used in existing call sites.
 * Returns only the sanitized string.
 */
export function sanitizeAiInput(value: string): string {
  return sanitizeAiInputFull(value).sanitizedText;
}

/**
 * Detects prompt injection attempts in user text.
 * Returns true if suspicious patterns are found.
 */
export function detectPromptInjection(text: string): {
  detected: boolean;
  patterns: string[];
} {
  const patterns: string[] = [];
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      patterns.push(pattern.source);
    }
  }
  return { detected: patterns.length > 0, patterns };
}
