import assert from 'node:assert/strict';
import test from 'node:test';
import type { CodebaseAnalysis, CodeEntity } from '@tellann/desktop-contracts';
import { retrieveFlowCheckpointCandidates } from '@tellann/project-intelligence';
import { resolveFlowCheckpointMappings } from '@tellann/ai';
import {
  analyzeFlowInitialization,
  applyEvidenceGroundedMappings,
  assertEvidenceGroundedContract,
  buildManualRoadmap,
} from './flow-initialization-analysis';

/**
 * The join, end to end, with no database and no network.
 *
 * Every stage of evidence-grounded initialization has its own tests, but the
 * failure this feature actually had was between them: retrieval produced a shape
 * the resolver narrowed, the resolver produced a shape the report widened, and
 * the first thing to notice a mismatch was the instrumentation adapter, several
 * steps and one user decision later. This walks a declared Flow from a codebase
 * analysis all the way to a contract-valid report and roadmap, so a change that
 * breaks the seam fails here instead of in the desktop.
 */

const STATE_LOGIN = '10000000-0000-4000-8000-000000000001';
const STATE_DONE = '10000000-0000-4000-8000-000000000002';
const TRANSITION_SUBMIT = '20000000-0000-4000-8000-000000000001';

function entity(input: Partial<CodeEntity> & Pick<CodeEntity, 'id' | 'type' | 'name'>): CodeEntity {
  return { path: null, startLine: null, endLine: null, language: 'typescript', confidence: 0.9, metadata: {}, evidence: [], ...input };
}

function codebase(entities: CodeEntity[]): CodebaseAnalysis {
  return {
    id: 'analysis-1', workspaceId: '40000000-0000-4000-8000-000000000001',
    repositoryFingerprint: 'repo', graphVersion: 'graph-1', analyzerVersions: {},
    status: 'COMPLETED', progress: 100, stageMessage: 'complete',
    startedAt: '2026-09-16T00:00:00.000Z', completedAt: '2026-09-16T00:01:00.000Z',
    revision: 'abc1234', branch: 'main', dirty: false, contentHash: 'content-1',
    entities, relationships: [], features: [], findings: [], architecture: null, coverage: null,
    incremental: null, explanations: [],
    summary: { files: 2, symbols: entities.length, relationships: 0, applications: 1, services: 0, domains: 1, features: 0, endpoints: 1, dataModels: 0, events: 0, externalServices: 0, tests: 0, confidence: 0.9, coveragePercent: 100 },
    warnings: [], notices: [],
  };
}

const snapshot = {
  name: 'User authentication',
  states: [
    { id: STATE_LOGIN, stateName: 'LOGIN PAGE', category: 'UI', role: 'INITIAL' },
    { id: STATE_DONE, stateName: 'DASHBOARD', category: 'UI', role: 'TERMINAL', terminalKind: 'SUCCESS' },
  ],
  transitions: [{ id: TRANSITION_SUBMIT, fromStateId: STATE_LOGIN, toStateId: STATE_DONE, action: 'SUBMIT_CREDENTIALS' }],
};

const repository = { id: '00000000-0000-4000-8000-000000000041', routeSummary: [], endpointSummary: [], frameworkSummary: [] };

const declaredFlow = {
  id: '30000000-0000-4000-8000-000000000001', name: 'User authentication',
  purpose: 'Let a returning user sign in and reach their dashboard.',
  states: [
    { id: STATE_LOGIN, stateName: 'LOGIN PAGE', category: 'UI', role: 'INITIAL' as const },
    { id: STATE_DONE, stateName: 'DASHBOARD', category: 'UI', role: 'TERMINAL' as const, terminalKind: 'SUCCESS' as const },
  ],
  transitions: [{ id: TRANSITION_SUBMIT, fromStateId: STATE_LOGIN, toStateId: STATE_DONE, action: 'SUBMIT_CREDENTIALS' }],
};

test('a declared Flow maps from codebase analysis to a contract-valid review', async () => {
  const analysis = codebase([
    // A file-scoped route: no symbol of its own, resolved through the component
    // declared beside it — the case that used to fall out of automated mode.
    entity({ id: 'route-login', type: 'ui_route', name: '/sign-in', path: 'apps/web/app/sign-in/page.tsx', startLine: 1, endLine: null }),
    entity({ id: 'login-component', type: 'function', name: 'SignInPage', path: 'apps/web/app/sign-in/page.tsx', startLine: 3, endLine: 24 }),
    entity({ id: 'submit-action', type: 'ui_action', name: 'submitCredentials', path: 'apps/web/app/sign-in/form.tsx', startLine: 12, endLine: 28 }),
    entity({ id: 'dashboard-route', type: 'ui_route', name: '/dashboard', path: 'apps/web/app/dashboard/page.tsx', startLine: 1, endLine: null }),
    entity({ id: 'dashboard-component', type: 'function', name: 'DashboardPage', path: 'apps/web/app/dashboard/page.tsx', startLine: 2, endLine: 30 }),
  ]);

  const retrieval = retrieveFlowCheckpointCandidates(analysis, declaredFlow as never);
  assert.equal(retrieval.mappings.length, 3, 'one mapping per declared state and transition');

  const loginCandidate = retrieval.mappings.find((item) => item.checkpointId === `state:${STATE_LOGIN}`)!.candidates[0];
  assert.equal(loginCandidate.path, 'apps/web/app/sign-in/page.tsx');
  assert.equal(loginCandidate.symbol, 'SignInPage', 'the route resolved to a real declaration');
  assert.equal(loginCandidate.startLine, 3, 'and to that declaration, not to line 1');
  assert.ok(loginCandidate.placementKinds.includes('COMPONENT_MOUNT'));

  const base = analyzeFlowInitialization(snapshot, repository, '00000000-0000-4000-8000-000000000040', undefined, 'User authentication');
  const checkpointIds = new Set(base.manifest.checkpoints.map((checkpoint) => checkpoint.id));
  assert.deepEqual(
    retrieval.mappings.map((item) => item.checkpointId).filter((id) => !checkpointIds.has(id)),
    [],
    'retrieval and the manifest agree on checkpoint identity',
  );

  // No providers configured is the declined-consent and every-provider-failed
  // path: deterministic candidates survive and every checkpoint goes to review.
  const resolved = await resolveFlowCheckpointMappings({
    flowName: 'User authentication',
    analysis: { id: analysis.id, graphVersion: analysis.graphVersion, contentHash: analysis.contentHash },
    checkpoints: retrieval.mappings.map((mapping) => {
      const checkpoint = base.manifest.checkpoints.find((item) => item.id === mapping.checkpointId)!;
      return {
        checkpointId: mapping.checkpointId, kind: mapping.kind, label: String(checkpoint.label),
        candidates: mapping.candidates.map((candidate) => ({
          id: candidate.id, entityId: candidate.entityId, file: candidate.path, symbol: candidate.symbol,
          startLine: candidate.startLine, endLine: candidate.endLine, score: candidate.score,
          confidence: candidate.confidence, placementKinds: candidate.placementKinds,
          evidenceIds: [`entity:${candidate.entityId}`], rationale: 'Ranked by codebase analysis.', excerpt: null,
        })),
      };
    }),
  }, { providers: [] });

  assert.equal(resolved.provenance.engine, 'GRAPH_ONLY');
  assert.ok(
    resolved.mappings.every((mapping) => mapping.status !== 'RESOLVED'),
    'ranking alone never claims to know the exact line',
  );

  const enriched = applyEvidenceGroundedMappings(base, resolved.mappings as never, {
    engine: 'GRAPH_ONLY', analysisId: analysis.id, snapshotId: analysis.id,
    graphVersion: analysis.graphVersion, contentHash: analysis.contentHash,
    revision: analysis.revision, branch: analysis.branch, dirty: analysis.dirty,
    retrievalVersion: retrieval.retrievalVersion, consentMode: 'GRAPH_ONLY',
  });

  assertEvidenceGroundedContract(enriched);
  assert.equal(enriched.report.progress.status, 'NEEDS_REVIEW');
  assert.equal(enriched.report.progress.unresolvedCount, 3, 'the user is asked about all three');
  assert.equal(enriched.report.analysis.revision, 'abc1234', 'the review says which tree it describes');

  // Every unresolved checkpoint offers something to choose, which is what makes
  // the review actionable rather than a list of dead ends.
  for (const checkpoint of enriched.manifest.checkpoints) {
    const mapping = checkpoint.mapping as { alternatives?: unknown[] };
    assert.ok((mapping.alternatives ?? []).length > 0, `${checkpoint.id} offers candidates`);
  }

  const roadmap = buildManualRoadmap(enriched.manifest as never, 1, enriched.report as never);
  const loginStep = roadmap.steps.find((step: Record<string, unknown>) => step.id === `state:${STATE_LOGIN}`)!;
  assert.ok((loginStep.alternatives as unknown[]).length > 0, 'manual mode gets the same evidence');
  assert.match(String(loginStep.snippet), /FLOW_INITIAL_STATE/);
});

test('confirming a candidate completes the review and unblocks automated mode', () => {
  const analysis = codebase([
    entity({ id: 'route-login', type: 'ui_route', name: '/sign-in', path: 'apps/web/app/sign-in/page.tsx', startLine: 1, endLine: null }),
    entity({ id: 'login-component', type: 'function', name: 'SignInPage', path: 'apps/web/app/sign-in/page.tsx', startLine: 3, endLine: 24 }),
  ]);
  const retrieval = retrieveFlowCheckpointCandidates(analysis, declaredFlow as never);
  const base = analyzeFlowInitialization(snapshot, repository, '00000000-0000-4000-8000-000000000040', undefined, 'User authentication');

  // What the confirm route writes once the user picks a location for each one.
  const confirmed = base.manifest.checkpoints.map((checkpoint) => {
    const candidate = retrieval.mappings.find((item) => item.checkpointId === checkpoint.id)?.candidates[0];
    return {
      checkpointId: checkpoint.id, status: 'RESOLVED' as const,
      entityId: candidate?.entityId ?? 'entity-1', candidateId: candidate?.id ?? 'candidate-1',
      file: candidate?.path ?? 'apps/web/app/sign-in/page.tsx', symbol: candidate?.symbol ?? 'SignInPage',
      startLine: candidate?.startLine ?? 3, endLine: candidate?.endLine ?? 24,
      placementKind: 'COMPONENT_MOUNT', anchorText: 'export default function SignInPage()',
      anchorHash: 'b'.repeat(64), confidence: 0.85, rationale: 'Chosen by the user.',
      evidenceIds: [`entity:${candidate?.entityId ?? 'entity-1'}`],
      alternatives: [], userConfirmed: true, userOverridden: true,
    };
  });

  const enriched = applyEvidenceGroundedMappings(base, confirmed, {
    engine: 'GRAPH_ONLY', analysisId: analysis.id, snapshotId: analysis.id,
    graphVersion: analysis.graphVersion, contentHash: analysis.contentHash,
    revision: analysis.revision, branch: analysis.branch, dirty: analysis.dirty,
    retrievalVersion: retrieval.retrievalVersion, consentMode: 'GRAPH_ONLY',
  });

  assertEvidenceGroundedContract(enriched);
  assert.equal(enriched.report.progress.status, 'READY');
  assert.equal(enriched.report.progress.unresolvedCount, 0);
  assert.ok(
    enriched.manifest.checkpoints.every((checkpoint) => (checkpoint.mapping as { status?: string }).status === 'RESOLVED'),
    'the gate automated mode checks is now satisfied',
  );
});
