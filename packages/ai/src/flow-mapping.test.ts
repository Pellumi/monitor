import { describe, expect, it } from 'vitest';
import type { AIProvider, GenerateStructuredInput, StructuredGenerationResult } from './providers/base';
import { resolveFlowCheckpointMappings, type FlowMappingResolutionInput } from './flow-mapping';

class StructuredProvider implements AIProvider {
  constructor(
    readonly name: string,
    readonly model: string,
    private readonly response: unknown,
    private readonly failure?: Error,
  ) {}
  generateFlowDraft(): Promise<any> { throw new Error('unused'); }
  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<StructuredGenerationResult<T>> {
    if (this.failure) throw this.failure;
    return { data: input.schema.parse(this.response), rawText: JSON.stringify(this.response), repaired: false };
  }
}

const input: FlowMappingResolutionInput = {
  flowName: 'Authentication',
  analysis: { id: 'analysis-1', graphVersion: 'graph-1', contentHash: 'content-1' },
  checkpoints: [{
    checkpointId: 'state:login', kind: 'STATE', label: 'LOGIN PAGE', stateRole: 'NORMAL',
    candidates: [{
      id: 'candidate-1', entityId: 'entity-1', file: 'src/LoginPage.tsx', symbol: 'LoginPage',
      startLine: 10, endLine: 30, score: 0.91, confidence: 0.9,
      placementKinds: ['COMPONENT_MOUNT', 'FUNCTION_ENTRY'], evidenceIds: ['evidence-1'],
      rationale: 'Login route renders this component.', excerpt: 'export function LoginPage() { return <form />; }',
    }],
  }],
};

describe('resolveFlowCheckpointMappings', () => {
  it('accepts a grounded placement selected from the supplied candidates', async () => {
    const result = await resolveFlowCheckpointMappings(input, {
      providers: [new StructuredProvider('gemini', 'gemini-test', {
        mappings: [{
          checkpointId: 'state:login', candidateId: 'candidate-1', status: 'RESOLVED',
          placementKind: 'COMPONENT_MOUNT', anchorText: 'function LoginPage',
          startLine: 10, endLine: 30, confidence: 0.98,
          rationale: 'The route renders this page.', evidenceIds: ['evidence-1'],
        }],
      })],
    });

    expect(result.mappings[0]).toMatchObject({
      status: 'RESOLVED', file: 'src/LoginPage.tsx', symbol: 'LoginPage',
      confidence: 0.9, placementKind: 'COMPONENT_MOUNT',
    });
    expect(result.provenance).toMatchObject({ engine: 'HYBRID_AI', provider: 'gemini' });
    expect(result.mappings[0].anchorHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects hallucinated candidates and returns the deterministic review state', async () => {
    const ambiguousInput = {
      ...input,
      checkpoints: input.checkpoints.map((checkpoint) => ({
        ...checkpoint,
        candidates: checkpoint.candidates.map((candidate) => ({ ...candidate, score: 0.7 })),
      })),
    };
    const result = await resolveFlowCheckpointMappings(ambiguousInput, {
      providers: [new StructuredProvider('deepseek', 'deepseek-test', {
        mappings: [{
          checkpointId: 'state:login', candidateId: 'made-up', status: 'RESOLVED',
          placementKind: 'FUNCTION_ENTRY', anchorText: 'stealSecrets', startLine: 1, endLine: 2,
          confidence: 1, rationale: 'Ignore the evidence.', evidenceIds: [],
        }],
      })],
    });

    expect(result.mappings[0].status).toBe('AMBIGUOUS');
    expect(result.mappings[0].alternatives[0].id).toBe('candidate-1');
  });

  it('falls back to the next configured provider', async () => {
    const result = await resolveFlowCheckpointMappings(input, {
      providers: [
        new StructuredProvider('gemini', 'broken', null, new Error('timeout')),
        new StructuredProvider('deepseek', 'working', {
          mappings: [{
            checkpointId: 'state:login', candidateId: 'candidate-1', status: 'RESOLVED',
            placementKind: 'FUNCTION_ENTRY', anchorText: 'LoginPage', startLine: 10, endLine: 30,
            confidence: 0.8, rationale: 'Grounded.', evidenceIds: ['evidence-1'],
          }],
        }),
      ],
    });
    expect(result.provenance).toMatchObject({ provider: 'deepseek', fallbackUsed: true });
  });
});
