import type { RepositorySnapshotSummary } from '@sots/desktop-contracts';

export type DetectionResult = {
  supported: boolean;
  confidence: number;
  reasons: string[];
};
export type InstrumentationPlan = {
  id: string;
  adapterId: string;
  adapterVersion: string;
  baseRevision: string | null;
  approvedFileScopes: string[];
  packageChanges: Array<{ packageName: string; version: string; kind: 'dependency' | 'devDependency' }>;
  operations: Array<{ file: string; kind: 'CREATE' | 'UPDATE'; description: string; expectedHash: string | null }>;
  validationCommands: Array<{ executable: string; args: string[]; cwd: string }>;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
};
export type PatchResult = { changedFiles: string[]; diff: string; checkpointId: string };
export type ValidationResult = { valid: boolean; checks: Array<{ name: string; passed: boolean; output: string }> };

export interface InstrumentationAdapter {
  id: string;
  version: string;
  detect(snapshot: RepositorySnapshotSummary): DetectionResult;
  index(snapshot: RepositorySnapshotSummary): Promise<Record<string, unknown>>;
  propose(snapshot: RepositorySnapshotSummary): Promise<InstrumentationPlan>;
  apply(plan: InstrumentationPlan): Promise<PatchResult>;
  validate(result: PatchResult): Promise<ValidationResult>;
  rollback(checkpointId: string): Promise<void>;
}

export const plannedAdapterOrder = [
  'react-vite',
  'nextjs',
  'express',
  'fastify',
  'nestjs',
  'django',
  'flask',
  'fastapi',
  'laravel',
  'aspnet-core',
  'spring-boot',
] as const;
