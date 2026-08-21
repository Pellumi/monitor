import assert from 'node:assert/strict';
import test from 'node:test';
import { FlowReviewPreviewSchema, FlowSuggestionsResponseSchema, IPC } from './index';

test('whole-flow review IPC channels are stable and distinct', () => {
  assert.equal(IPC.previewFlowReview, 'tellann:cloud:intent:review:preview');
  assert.equal(IPC.applyFlowReview, 'tellann:cloud:intent:review:apply');
  assert.equal(IPC.declineFlowReview, 'tellann:cloud:intent:review:decline');
  assert.equal(new Set([IPC.previewFlowReview, IPC.applyFlowReview, IPC.declineFlowReview]).size, 3);
});

test('whole-flow contracts accept transition-only reviews and proposed diagram ids', () => {
  const suggestionId = '11111111-1111-4111-8111-111111111111';
  const reviewId = '22222222-2222-4222-8222-222222222222';
  assert.equal(FlowSuggestionsResponseSchema.parse({
    graphVersion: 4, graphHash: 'hash', reviewId,
    suggestions: [{
      id: suggestionId, suggestedStateName: 'PAYMENT_SUBMITTED', category: 'BUSINESS', rationale: 'Connect existing states',
      source: 'AI', sourceTier: 'AI_ASSISTED', confidence: .7, severity: 'MEDIUM', status: 'PENDING', reviewId,
      suggestedStatesJson: [], suggestedTransitionsJson: [{ from: 'CART', to: 'PAYMENT_SUBMITTED', action: 'checkout' }],
    }],
  }).suggestions[0].suggestedTransitionsJson?.length, 1);
  assert.equal(FlowReviewPreviewSchema.parse({
    reviewId, graphVersion: 4, graphHash: 'hash', validation: { valid: true, issues: [] },
    proposedStates: [], proposedTransitions: [], diagrams: [{
      kind: 'FLOW', renderer: 'MERMAID', rendererVersion: '1', source: 'flowchart LR',
      semanticNodeIds: ['proposed-state'], semanticEdgeIds: ['proposed-edge'],
    }],
  }).validation.valid, true);
});
