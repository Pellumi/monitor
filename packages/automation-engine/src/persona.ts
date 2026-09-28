import { createHash, randomBytes } from 'node:crypto';
import type { AutomationStopReason, RunDataSet, RunDataValueKind, TestPersona } from '@tellann/desktop-contracts';
import type { AutomationPorts } from './executor';
import type { AutomationFile, ExecutableContract } from './types';
import type { Persona } from './planner';

/**
 * Turning the human-owned Test Persona and Run Data Set into what the engine actually consumes:
 * a `Persona` for the navigation planner, a `data()` port for filling forms, and credentials for
 * the entry sequence's login step. None of this touches storage — how a persona or data set is
 * kept on disk is the desktop's concern (`local-store.ts`); this is the pure resolution logic,
 * so it is testable without Electron and reusable wherever a run needs it.
 */

export interface MaterializedValue {
  value: string;
  secret: boolean;
  /** Present when the value is a file to upload; `value` is then its name. */
  file?: AutomationFile;
}

/**
 * Produce this run's values from a data set's generators. Called once per run: a `UNIQUE_SUFFIX`
 * value must be the same every time the engine asks for it during one run, and different from the
 * last run, so it is generated here and looked up afterward rather than regenerated per lookup.
 */
export function materializeRunData(dataSet: RunDataSet | null | undefined, now: () => number = Date.now): Map<string, MaterializedValue> {
  const materialized = new Map<string, MaterializedValue>();
  if (!dataSet) return materialized;
  for (const item of dataSet.values) {
    const generated = generate(item.generator, now);
    materialized.set(item.key, { ...generated, secret: item.secret });
  }
  return materialized;
}

function generate(generator: RunDataSet['values'][number]['generator'], now: () => number): { value: string; file?: AutomationFile } {
  switch (generator.kind) {
    case 'LITERAL':
      return { value: generator.value };
    case 'FUTURE_TIMESTAMP':
      return { value: formatTimestamp(new Date(now() + generator.offsetMs), generator.format ?? 'ISO') };
    case 'UNIQUE_SUFFIX':
      return { value: `${generator.prefix}${randomBytes(4).toString('hex')}` };
    case 'FILE':
      return {
        value: generator.fileName,
        file: { name: generator.fileName, mimeType: generator.mimeType ?? 'text/plain', base64: Buffer.from(generator.content, 'utf8').toString('base64') },
      };
  }
}

/** A moment in the shape the form it is going into wants. UTC throughout, so a value means the same on every machine. */
function formatTimestamp(date: Date, format: 'ISO' | 'DATE' | 'TIME' | 'US' | 'EU'): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getUTCFullYear(); const m = pad(date.getUTCMonth() + 1); const d = pad(date.getUTCDate());
  switch (format) {
    case 'DATE': return `${y}-${m}-${d}`;
    case 'TIME': return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
    case 'US': return `${m}/${d}/${y}`;
    case 'EU': return `${d}/${m}/${y}`;
    default: return date.toISOString();
  }
}

/** The engine's `data()` port over an already-materialized data set. */
export function runDataPort(materialized: Map<string, MaterializedValue>): NonNullable<AutomationPorts['data']> {
  return (key) => materialized.get(key);
}

/**
 * Every run-data key a contract's transitions could ask for, missing from the materialized set.
 * Checked before a run starts, per FR-158 / plan item 5: a run should fail with
 * `TEST_DATA_UNAVAILABLE` at setup rather than partway through a Flow.
 */
export function missingRunDataKeys(contract: ExecutableContract, materialized: Map<string, MaterializedValue>): string[] {
  const missing = new Set<string>();
  for (const transition of contract.transitions) {
    for (const input of transition.inputs) {
      if (!materialized.has(input.dataKey)) missing.add(input.dataKey);
    }
  }
  return [...missing];
}

export type DataAvailability = { ok: true } | { ok: false; stopReason: Extract<AutomationStopReason, 'TEST_DATA_UNAVAILABLE'>; missingKeys: string[]; detail: string };

export function checkRunDataAvailability(contract: ExecutableContract, materialized: Map<string, MaterializedValue>): DataAvailability {
  const missing = missingRunDataKeys(contract, materialized);
  if (missing.length === 0) return { ok: true };
  return {
    ok: false,
    stopReason: 'TEST_DATA_UNAVAILABLE',
    missingKeys: missing,
    detail: `The run data set has no value for: ${missing.join(', ')}.`,
  };
}

/**
 * The navigation planner's view of a persona: only whether the *session* is currently
 * authenticated and what roles it has. Deliberately takes `sessionAuthenticated` as a required,
 * explicit argument rather than reading `persona.authenticated` — that field is the identity's
 * own fact ("this persona is the kind that logs in at all"), not whether this particular browser
 * session has done so, and conflating the two would let planning skip a login that never happened.
 */
export function personaForPlanner(persona: TestPersona | null | undefined, sessionAuthenticated: boolean): Persona {
  return { authenticated: sessionAuthenticated, roles: persona?.roles ?? [] };
}

/** Whether this persona's identity ever logs in. A guest/anonymous persona is `false` and must never be sent through a login form. */
export function personaRequiresLogin(persona: TestPersona | null | undefined): boolean {
  return persona?.authenticated ?? false;
}

/** Credential values for the login step, keyed the same way a Flow transition's `dataKey` is. */
export function personaCredentialData(persona: TestPersona | null | undefined): (key: string) => MaterializedValue | undefined {
  const byField = new Map((persona?.credentials ?? []).map((credential) => [credential.field, { value: credential.value, secret: true }]));
  return (key) => byField.get(key);
}

/**
 * How a typed run-data value should be classified for privacy, mirroring
 * `QAPendingProtectedValueSchema.kind`. A value the data set marked secret always stays SECRET; an
 * unmarked value is still checked against common direct-identifier shapes (an email address, for
 * instance) because a data-set author can forget to mark one, and treating it as ordinary would
 * let it show up in the clear in evidence and artifacts.
 */
// No word-boundary anchors: a key is very often camelCase ("studentEmail"), where `\b` would
// never fall between the two words at all and the term would silently stop matching.
const DIRECT_IDENTIFIER_KEY = /(email|e-?mail|phone|mobile|ssn|social.?security|passport|name|address|dob|birth)/i;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_SHAPE = /^\+?[\d\s().-]{7,20}$/;

export function classifyRunDataValue(key: string, value: string, secret: boolean): RunDataValueKind {
  if (secret) return 'SECRET';
  if (DIRECT_IDENTIFIER_KEY.test(key) || EMAIL_SHAPE.test(value) || PHONE_SHAPE.test(value)) return 'DIRECT_IDENTIFIER';
  return 'ORDINARY';
}

export interface ProtectedValueRecord {
  keyPath: string;
  kind: RunDataValueKind;
  /** Present unless the value is SECRET: a secret is registered but never carried in the clear. */
  value?: string;
  valueLength: number;
}

/** The protected-value record an automated fill should register, matching what a human-driven run records for the same field. */
export function protectedValueFor(dataKey: string, value: string, secret: boolean): ProtectedValueRecord {
  const kind = classifyRunDataValue(dataKey, value, secret);
  return {
    keyPath: dataKey,
    kind,
    value: kind === 'SECRET' ? undefined : value,
    valueLength: value.length,
  };
}

/** Stable per-run identity for a data set, so a report can say which materialization was used without exposing the values. */
export function runDataFingerprint(materialized: Map<string, MaterializedValue>): string {
  const entries = [...materialized.entries()].sort(([a], [b]) => a.localeCompare(b));
  return createHash('sha256').update(JSON.stringify(entries.map(([key, item]) => [key, item.secret ? null : item.value]))).digest('hex');
}
