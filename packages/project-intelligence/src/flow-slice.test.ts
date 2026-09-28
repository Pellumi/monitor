import assert from 'node:assert/strict';
import test from 'node:test';
import type { CodebaseAnalysis, CodeEntity, CodeRelationship } from '@tellann/desktop-contracts';
import { flowSlice } from './flow-slice';

const entity = (id: string, type: CodeEntity['type'] = 'function'): CodeEntity => ({
  id, type, name: id, path: `${id}.ts`, startLine: 1, endLine: 1, language: 'TypeScript', confidence: 1, metadata: {}, evidence: [],
});
const edge = (id: string, source: string, target: string, type: CodeRelationship['type'] = 'CALLS'): CodeRelationship => ({ id, source, target, type, confidence: 1, evidence: [] });

/**
 * button -> handler -> endpoint -> model
 * central -> handler   (a shared module that also touches the handler, one hop further out)
 * unrelated -> otherUnrelated   (a disconnected part of the graph)
 */
function fixture(): CodebaseAnalysis {
  const entities = ['button', 'handler', 'endpoint', 'model', 'central', 'unrelated', 'otherUnrelated'].map((id) => entity(id));
  const relationships = [
    edge('e1', 'button', 'handler', 'ROUTES_TO'),
    edge('e2', 'handler', 'endpoint', 'CALLS'),
    edge('e3', 'endpoint', 'model', 'READS'),
    edge('e4', 'central', 'handler', 'CALLS'),
    edge('e5', 'unrelated', 'otherUnrelated', 'CALLS'),
  ];
  return { entities, relationships } as CodebaseAnalysis;
}

test('the slice reaches everything within the hop limit, in either direction', () => {
  const result = flowSlice(fixture(), ['handler'], { depth: 2 });
  const ids = result.entities.map((e) => e.id).sort();
  assert.deepEqual(ids, ['button', 'central', 'endpoint', 'handler', 'model']);
  assert.equal(result.truncated, false);
});

test('a shallower depth reaches less, an unrelated part of the graph is never reached', () => {
  const oneHop = flowSlice(fixture(), ['handler'], { depth: 1 });
  assert.deepEqual(oneHop.entities.map((e) => e.id).sort(), ['button', 'central', 'endpoint', 'handler']);
  assert.ok(!oneHop.entities.some((e) => e.id === 'unrelated'));
});

test('several seeds union their neighbourhoods', () => {
  const result = flowSlice(fixture(), ['button', 'unrelated'], { depth: 1 });
  assert.deepEqual(result.entities.map((e) => e.id).sort(), ['button', 'handler', 'otherUnrelated', 'unrelated']);
});

test('relationships are kept only between entities that made it into the slice', () => {
  const result = flowSlice(fixture(), ['handler'], { depth: 1 });
  const ids = new Set(result.entities.map((e) => e.id));
  assert.ok(result.relationships.every((edge) => ids.has(edge.source) && ids.has(edge.target)));
  assert.ok(!result.relationships.some((edge) => edge.id === 'e3'), 'model is two hops out at depth 1');
});

test('a cap stops expansion and reports the slice as partial', () => {
  const result = flowSlice(fixture(), ['handler'], { depth: 5, maxEntities: 2 });
  assert.equal(result.truncated, true);
  assert.ok(result.entities.length <= 2);
});

test('a seed id not in the analysis is ignored rather than throwing', () => {
  const result = flowSlice(fixture(), ['does-not-exist', 'button'], { depth: 1 });
  assert.deepEqual(result.entities.map((e) => e.id).sort(), ['button', 'handler']);
});

test('an empty seed list produces an empty slice', () => {
  assert.deepEqual(flowSlice(fixture(), []), { entities: [], relationships: [], truncated: false });
});
