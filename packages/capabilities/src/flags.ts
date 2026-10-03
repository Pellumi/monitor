import { CAPABILITY_KEYS, type CapabilityKey } from './types';

/**
 * Rollout controls for the capability system (doc §49, plan §Rollout).
 *   CAPABILITIES_ENFORCE  — API enforcement uses the resolver (off = legacy plan-only checks)
 *   CAPABILITIES_UI       — dashboard navigation uses the resolver (off = legacy static sidebar)
 *   CAPABILITIES_DISABLED — comma-separated capability keys to force UNAVAILABLE (kill switch per capability)
 */
export interface RolloutFlags {
  enforce: boolean;
  ui: boolean;
  disabled: ReadonlySet<CapabilityKey>;
}

const KEYS = new Set<string>(CAPABILITY_KEYS);

function truthy(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

/** Reads flags from an environment map. Unknown capability keys fail loudly rather than being ignored. */
export function readRolloutFlags(env: Record<string, string | undefined>): RolloutFlags {
  const disabled = new Set<CapabilityKey>();
  for (const raw of (env.CAPABILITIES_DISABLED ?? '').split(',')) {
    const key = raw.trim();
    if (!key) continue;
    if (!KEYS.has(key)) throw new Error(`CAPABILITIES_DISABLED names unknown capability "${key}"`);
    disabled.add(key as CapabilityKey);
  }
  return {
    enforce: truthy(env.CAPABILITIES_ENFORCE),
    ui: truthy(env.CAPABILITIES_UI),
    disabled,
  };
}
