import type { CapabilityReasonCode, CapabilityState } from '@tellann/desktop-contracts';
import type { EvidenceCounts } from './evidence';
import type { CapabilityResolutionMap } from './resolver';
import type { CapabilityKey } from './types';

// ─────────────────────────────────────────────────────────────
// Report stamping (doc §28, §29). A generated report records the capability state and evidence it
// was built from, so it stays explainable after the application's architecture changes.
// ─────────────────────────────────────────────────────────────

export interface EvidenceBasisLine {
  label: string;
  status: 'CONNECTED' | 'NOT_CONNECTED' | 'PRESENT' | 'ABSENT';
}

export interface CapabilityBasis {
  resolverVersion: number;
  /** Revision of the architecture profile in force when the report was generated. Null if unanalysed. */
  architectureRevisionNumber: number | null;
  capabilities: Partial<Record<CapabilityKey, { state: CapabilityState; reason: CapabilityReasonCode | null }>>;
  evidenceBasis: EvidenceBasisLine[];
  stampedAt: string;
}

/** The "Evidence Basis" block: what a reader must know to tell absence of evidence from a clean result. */
export function evidenceBasis(counts: EvidenceCounts | null): EvidenceBasisLine[] {
  const c = counts;
  const connected = (n: number | undefined) => (n && n > 0 ? 'CONNECTED' : 'NOT_CONNECTED') as EvidenceBasisLine['status'];
  const present = (n: number | undefined) => (n && n > 0 ? 'PRESENT' : 'ABSENT') as EvidenceBasisLine['status'];
  return [
    { label: 'Frontend telemetry', status: connected(c?.frontendEventCount) },
    { label: 'Backend telemetry', status: connected(c?.backendEventCount) },
    { label: 'Browser evidence', status: present(c?.browserEventCount) },
    { label: 'Declared intent', status: present(c?.declaredFlowCount) },
  ];
}

export function buildCapabilityBasis(input: {
  resolverVersion: number;
  architectureRevisionNumber: number | null;
  resolutions: CapabilityResolutionMap;
  counts: EvidenceCounts | null;
  stampedAt: Date;
}): CapabilityBasis {
  const capabilities: CapabilityBasis['capabilities'] = {};
  for (const [key, resolution] of Object.entries(input.resolutions) as Array<[CapabilityKey, CapabilityResolutionMap[CapabilityKey]]>) {
    capabilities[key] = { state: resolution.state, reason: resolution.reason ?? null };
  }
  return {
    resolverVersion: input.resolverVersion,
    architectureRevisionNumber: input.architectureRevisionNumber,
    capabilities,
    evidenceBasis: evidenceBasis(input.counts),
    stampedAt: input.stampedAt.toISOString(),
  };
}
