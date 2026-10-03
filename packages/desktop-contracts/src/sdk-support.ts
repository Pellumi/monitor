// ─────────────────────────────────────────────────────────────
// SDK support registry — which frameworks Tellann can instrument today.
//
// Detection and instrumentation support are separate facts: Tellann may
// recognise a framework (Vue, Django) without being able to instrument it.
// This registry is the only place that records instrumentation support.
// Values mirror docs/product docs/sdk_spec.txt §3 and packages/python-sdk.
// ─────────────────────────────────────────────────────────────

export type SdkSupportStatus = 'SUPPORTED' | 'PLANNED';

export type SdkTrack = 'FRONTEND' | 'BACKEND';

export interface FrameworkSdkSupport {
  /** Stable framework id, as emitted by the desktop framework detector. */
  id: string;
  track: SdkTrack;
  /** Language the framework is written in; selects the SDK package. */
  language: 'javascript' | 'python';
  status: SdkSupportStatus;
  /** Human-readable note shown when the framework is detected but unsupported. */
  note?: string;
}

export const FRAMEWORK_SDK_SUPPORT: readonly FrameworkSdkSupport[] = [
  { id: 'react', track: 'FRONTEND', language: 'javascript', status: 'SUPPORTED' },
  { id: 'next', track: 'FRONTEND', language: 'javascript', status: 'SUPPORTED' },
  { id: 'express', track: 'BACKEND', language: 'javascript', status: 'SUPPORTED' },
  { id: 'fastify', track: 'BACKEND', language: 'javascript', status: 'SUPPORTED' },
  { id: 'nestjs', track: 'BACKEND', language: 'javascript', status: 'SUPPORTED' },
  { id: 'django', track: 'BACKEND', language: 'python', status: 'SUPPORTED' },
  { id: 'flask', track: 'BACKEND', language: 'python', status: 'SUPPORTED' },
  { id: 'fastapi', track: 'BACKEND', language: 'python', status: 'SUPPORTED' },
  {
    id: 'vue',
    track: 'FRONTEND',
    language: 'javascript',
    status: 'PLANNED',
    note: 'Vue telemetry is not yet supported.',
  },
  {
    id: 'angular',
    track: 'FRONTEND',
    language: 'javascript',
    status: 'PLANNED',
    note: 'Angular telemetry is not yet supported.',
  },
];

const FRAMEWORK_INDEX = new Map(FRAMEWORK_SDK_SUPPORT.map((entry) => [entry.id, entry]));

/** Support record for a framework id, or undefined when the framework is unknown to Tellann. */
export function frameworkSdkSupport(id: string): FrameworkSdkSupport | undefined {
  return FRAMEWORK_INDEX.get(id);
}

/** True when an SDK for this track can instrument the framework today. */
export function isSdkSupported(id: string, track: SdkTrack): boolean {
  const entry = FRAMEWORK_INDEX.get(id);
  return entry?.track === track && entry.status === 'SUPPORTED';
}
