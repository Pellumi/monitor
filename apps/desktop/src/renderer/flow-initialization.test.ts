import assert from 'node:assert/strict';
import test from 'node:test';
import { flowBindingForEnvironment, flowRunReadiness } from './flow-initialization';

const versionId = '11111111-1111-4111-8111-111111111111';
const flow = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Checkout',
  status: 'COMPLETE',
  publishedVersionId: versionId,
  projectBindings: [
    {
      id: 'binding-staging', environmentId: 'staging', flowVersionId: versionId, status: 'ACTIVE',
      initializations: [{ status: 'COMPLETED' }], scans: [{ status: 'COMPLETED' }],
    },
    {
      id: 'binding-development', environmentId: 'development', flowVersionId: versionId, status: 'ACTIVE',
      initializations: [{ status: 'INITIALIZING' }], scans: [],
    },
  ],
} as never;

test('Flow readiness resolves the binding for the selected environment', () => {
  assert.equal(flowBindingForEnvironment(flow, 'staging')?.id, 'binding-staging');
  assert.equal(flowRunReadiness(flow, 'staging').ready, true);
  assert.equal(flowRunReadiness(flow, 'development').code, 'INITIALIZATION_REQUIRED');
  assert.equal(flowRunReadiness(flow, 'production').code, 'NOT_BOUND');
});

test('a binding against an older published version is stale', () => {
  const stale = {
    ...(flow as object),
    projectBindings: [{
      id: 'binding-staging', environmentId: 'staging', flowVersionId: '33333333-3333-4333-8333-333333333333', status: 'ACTIVE',
      initializations: [{ status: 'COMPLETED' }], scans: [{ status: 'COMPLETED' }],
    }],
  } as never;
  assert.equal(flowRunReadiness(stale, 'staging').code, 'STALE_VERSION');
});
