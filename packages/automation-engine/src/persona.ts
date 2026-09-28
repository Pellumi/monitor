import { createHash, randomBytes } from 'node:crypto';
import type { AutomationStopReason, RunDataSet, RunDataValueKind, TestPersona } from '@tellann/desktop-contracts';
import type { AutomationPorts } from './executor';
import type { AutomationFile, EnvironmentKind, ExecutableContract, FormInput } from './types';
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
 * Where every value a Flow types comes from, decided once.
 *
 * A Flow declares each input's role (see `InputRole`), and the run has three places to look:
 *
 *   1. the run data set, by the input's key (always wins: a person chose that value);
 *   2. for a GENERATED input, a value made for this run, so a Flow needs no data set to type a course title;
 *   3. for a PROTECTED input, the persona's stored sign-in, matched by the key, the field name, or the kind of
 *      credential the key ends in (`ADMIN_EMAIL` -> the persona's `email`). Never invented.
 *
 * An input none of those can supply is missing, and the run stops before it starts rather than partway through.
 * The steps a person performs (MANUAL) type nothing here, so they ask for nothing.
 * One resolver answers the availability check, the `data()` port and the list of values to register as
 * protected, so the three cannot disagree about where a value came from.
 */
export interface ResolvedRunData {
  port: NonNullable<AutomationPorts['data']>;
  /** Values made up for this run. */
  generated: Map<string, MaterializedValue>;
  /** Every value a PROTECTED input will type, to be registered so nothing typed is ever recorded. */
  protectedValues: string[];
  /** Keys nothing can supply. */
  missing: string[];
}

const CREDENTIAL_KIND = /(?:^|_)(email|username|password)$/i;

function credentialFor(lookup: ReturnType<typeof personaCredentialData>, input: FormInput): MaterializedValue | undefined {
  const kind = CREDENTIAL_KIND.exec(input.dataKey)?.[1]?.toLowerCase();
  return lookup(input.dataKey) ?? lookup(input.name) ?? lookup(input.name.toLowerCase()) ?? (kind ? lookup(kind) : undefined);
}

/** A value for a field the run has to make up. Recognisable as Tellann's, and unique per run. */
function generatedValue(input: FormInput, suffix: string): string {
  const name = input.name.toLowerCase();
  if (/e-?mail/.test(name)) return `qa+${suffix}@example.com`;
  if (/\bcode\b|\bid\b|\bnumber\b/.test(name)) return `QA${suffix.toUpperCase()}`;
  return `QA ${input.name.trim()} ${suffix}`.slice(0, 120);
}

export function resolveRunData(
  contract: ExecutableContract,
  materialized: Map<string, MaterializedValue>,
  persona: TestPersona | null | undefined,
  options: { unique?: () => string } = {},
): ResolvedRunData {
  const unique = options.unique ?? (() => randomBytes(3).toString('hex'));
  const lookup = personaCredentialData(persona);
  const generated = new Map<string, MaterializedValue>();
  const bridged = new Map<string, MaterializedValue>();
  const protectedKeys = new Set<string>();
  const missing = new Set<string>();

  for (const transition of contract.transitions) {
    if ((transition.mode ?? 'AUTO') === 'MANUAL') continue;
    for (const input of transition.inputs) {
      const role = input.role ?? 'PROVIDED';
      if (role === 'PROTECTED') protectedKeys.add(input.dataKey);
      if (materialized.has(input.dataKey) || generated.has(input.dataKey) || bridged.has(input.dataKey)) continue;
      if (role === 'GENERATED') {
        generated.set(input.dataKey, { value: generatedValue(input, unique()), secret: false });
      } else if (role === 'PROTECTED') {
        const credential = credentialFor(lookup, input);
        if (credential) bridged.set(input.dataKey, { ...credential, secret: true });
        else missing.add(input.dataKey);
      } else {
        missing.add(input.dataKey);
      }
    }
  }

  const port: ResolvedRunData['port'] = (key) => materialized.get(key) ?? generated.get(key) ?? bridged.get(key);
  const protectedValues = [...protectedKeys].flatMap((key) => {
    const value = port(key)?.value;
    return value ? [value] : [];
  });
  return { port, generated, protectedValues, missing: [...missing] };
}

/**
 * Every run-data key a contract's transitions could ask for, missing from the materialized set.
 * Checked before a run starts, per FR-158 / plan item 5: a run should fail with
 * `TEST_DATA_UNAVAILABLE` at setup rather than partway through a Flow. Inputs the run can supply
 * itself (generated values, the persona's sign-in) are not missing.
 */
export function missingRunDataKeys(contract: ExecutableContract, materialized: Map<string, MaterializedValue>, persona?: TestPersona | null): string[] {
  return resolveRunData(contract, materialized, persona).missing;
}

export type DataAvailability = { ok: true } | { ok: false; stopReason: Extract<AutomationStopReason, 'TEST_DATA_UNAVAILABLE'>; missingKeys: string[]; detail: string };

export function checkRunDataAvailability(contract: ExecutableContract, materialized: Map<string, MaterializedValue>, persona?: TestPersona | null): DataAvailability {
  const missing = missingRunDataKeys(contract, materialized, persona);
  if (missing.length === 0) return { ok: true };
  return {
    ok: false,
    stopReason: 'TEST_DATA_UNAVAILABLE',
    missingKeys: missing,
    detail: `The run data set has no value for: ${missing.join(', ')}.`,
  };
}

export type RequirementsCheck =
  | { ok: true }
  | { ok: false; stopReason: Extract<AutomationStopReason, 'FLOW_REQUIREMENTS_NOT_MET'>; problems: string[]; detail: string };

const roleKey = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * Whether this run has what the Flow says it needs: the account, an environment it may run in, and its data.
 * Checked before anything is touched, and every shortfall is reported at once so nobody fixes them one run at a time.
 */
export function checkFlowRequirements(
  contract: ExecutableContract,
  context: { environment: EnvironmentKind; persona: TestPersona | null | undefined; materialized: Map<string, MaterializedValue> },
): RequirementsCheck {
  const requires = contract.requires;
  if (!requires) return { ok: true };
  const problems: string[] = [];

  if (requires.environments.length > 0 && !requires.environments.includes(context.environment)) {
    problems.push(`The Flow may only be run in ${requires.environments.map((environment) => environment.toLowerCase()).join(' or ')}, and this run is in ${context.environment.toLowerCase()}.`);
  }
  if (requires.actor) {
    const roles = (context.persona?.roles ?? []).map(roleKey);
    if (!roles.includes(requires.actor)) {
      problems.push(context.persona
        ? `The Flow needs someone signed in as ${requires.actor}, and the persona "${context.persona.name}" does not have that role.`
        : `The Flow needs someone signed in as ${requires.actor}, and no persona was chosen.`);
    }
  }
  if (requires.data.length > 0) {
    const { port } = resolveRunData(contract, context.materialized, context.persona);
    const absent = requires.data.filter((key) => port(key) === undefined);
    if (absent.length > 0) problems.push(`The Flow needs run data for: ${absent.join(', ')}.`);
  }

  return problems.length === 0
    ? { ok: true }
    : { ok: false, stopReason: 'FLOW_REQUIREMENTS_NOT_MET', problems, detail: problems.join(' ') };
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
