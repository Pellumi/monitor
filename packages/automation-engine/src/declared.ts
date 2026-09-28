import { canonicalPattern } from './keys';
import type { ApiCondition, ContractRequirements, ControlDescriptor, EnvironmentKind, FormInput, InputRole, StepMode } from './types';

/**
 * What a person declared about a Flow, read out of a published version.
 *
 * The declaration is authoritative: where a state says which route identifies it, or a
 * transition says which control performs it, that is what a run uses, and what the code
 * analysis derived is the fallback. These readers are defensive because the snapshot is a
 * stored document that may have been written by an older Tellann, and a run must never
 * act on something it could not read cleanly: a value that does not parse is treated as
 * not declared, which falls back to derivation rather than to a guess.
 *
 * (The platform cleans the same fields when they are saved; this is the second lock.)
 */

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const text = (value: unknown, max = 120): string | null => {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : null;
};

const strings = (value: unknown): string[] =>
  (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).map((item) => text(item)).filter((item): item is string => item !== null);

// -- states ------------------------------------------------------------------

export interface DeclaredRecognizer {
  routes: string[];
  headings: string[];
  texts: string[];
}

export function declaredRecognizer(raw: unknown): DeclaredRecognizer {
  const source = record(raw);
  if (!source) return { routes: [], headings: [], texts: [] };
  const routes = strings(source.routes ?? source.route).filter((route) => route.startsWith('/')).map(canonicalPattern);
  return { routes: [...new Set(routes)], headings: [...new Set(strings(source.headings ?? source.heading))], texts: [...new Set(strings(source.texts ?? source.text))] };
}

// -- transitions -------------------------------------------------------------

const ELEMENT_FOR_ROLE: Record<string, string | null> = {
  link: 'a', button: 'button', checkbox: 'input', radio: 'input', field: 'input', select: 'select', tab: null, menuitem: null,
};

export interface DeclaredControl {
  role: string | null;
  label: string;
  testId: string | null;
}

export function declaredControl(raw: unknown): DeclaredControl | null {
  const source = record(raw);
  if (!source) return null;
  const label = text(source.label ?? source.name);
  const testId = text(source.testId, 60);
  if (!label && !testId) return null;
  const role = text(source.role, 20)?.toLowerCase() ?? null;
  return { role: role && role in ELEMENT_FOR_ROLE ? role : null, label: label ?? testId!, testId };
}

/** The element a role is expected to be: what ranking checks alongside the label. */
export function elementForRole(role: string | null): string | null {
  return role ? ELEMENT_FOR_ROLE[role] ?? null : null;
}

/** A descriptor from a declaration alone: enough to find the control by what it says on it. */
export function descriptorFromDeclaration(control: DeclaredControl): ControlDescriptor {
  return {
    labels: [control.label], testId: control.testId, domId: null, element: elementForRole(control.role), event: null, actionAnchor: null, href: null,
  };
}

export function declaredMode(raw: unknown): StepMode {
  const mode = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return mode === 'CONFIRM' || mode === 'MANUAL' ? mode : 'AUTO';
}

export function declaredEffects(raw: unknown): ApiCondition[] {
  const seen = new Set<string>();
  const effects: ApiCondition[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const source = record(item);
    const method = text(source?.method, 10)?.toUpperCase();
    const route = text(source?.route ?? source?.path, 200);
    if (!source || !method || !route?.startsWith('/') || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) continue;
    const status = Number(source.status ?? source.expectStatus);
    const canonical = canonicalPattern(route);
    if (seen.has(`${method} ${canonical}`)) continue;
    seen.add(`${method} ${canonical}`);
    effects.push({ method, route: canonical, expectStatus: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null, declared: true });
  }
  return effects;
}

const INPUT_ROLES = new Set<InputRole>(['PROTECTED', 'PROVIDED', 'GENERATED']);

/** Declared inputs, and the older shapes (`["title"]`, `{ title: … }`) that the executor has always accepted. */
export function declaredInputs(expected: unknown): FormInput[] {
  if (!expected) return [];
  const raw: unknown[] = Array.isArray(expected) ? expected : typeof expected === 'object' ? Object.keys(expected as object) : [];
  return raw.flatMap((item): FormInput[] => {
    if (typeof item === 'string' && item.trim()) return [{ name: item, label: null, dataKey: item }];
    const source = record(item);
    if (!source) return [];
    const name = typeof source.name === 'string' ? source.name : typeof source.field === 'string' ? source.field : null;
    if (!name) return [];
    const role = typeof source.role === 'string' ? source.role.toUpperCase() as InputRole : undefined;
    return [{
      name,
      label: typeof source.label === 'string' ? source.label : null,
      dataKey: typeof source.dataKey === 'string' ? source.dataKey : name,
      ...(role && INPUT_ROLES.has(role) ? { role } : {}),
    }];
  });
}

// -- flow --------------------------------------------------------------------

const ENVIRONMENTS = new Set<EnvironmentKind>(['DEVELOPMENT', 'STAGING', 'PRODUCTION']);

export function declaredRequirements(raw: unknown): ContractRequirements | undefined {
  const source = record(raw);
  if (!source) return undefined;
  const actor = text(source.actor, 40)?.toUpperCase() ?? undefined;
  const environments = strings(source.environments).map((item) => item.toUpperCase()).filter((item): item is EnvironmentKind => ENVIRONMENTS.has(item as EnvironmentKind));
  const data = strings(source.data);
  if (!actor && !environments.length && !data.length) return undefined;
  return { ...(actor ? { actor } : {}), environments: [...new Set(environments)], data: [...new Set(data)] };
}
