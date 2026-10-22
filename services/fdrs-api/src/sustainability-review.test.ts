import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReviewHash, languageFindings, routeCollisionFindings, runStaticSustainabilityChecks,
} from './sustainability-review';
import type { SustainabilityGraphEdge, SustainabilityGraphNode } from './sustainability-review';

function node(overrides: Partial<SustainabilityGraphNode> & { id: string; stateName: string }): SustainabilityGraphNode {
  return { role: 'NORMAL', ...overrides };
}
function edge(overrides: Partial<SustainabilityGraphEdge> & { id: string; fromNodeId: string; toNodeId: string }): SustainabilityGraphEdge {
  return { action: 'CONTINUE', ...overrides };
}

const loginFlow = () => ({
  nodes: [
    node({ id: 'n1', stateName: 'LOGIN_PAGE', role: 'INITIAL' }),
    node({ id: 'n2', stateName: 'DASHBOARD', role: 'TERMINAL', terminalKind: 'SUCCESS' }),
  ],
  edges: [edge({ id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', action: 'SUBMIT_CREDENTIALS' })],
});

test('buildReviewHash is stable for the same content and changes when a name changes', () => {
  const a = loginFlow();
  const b = loginFlow();
  assert.equal(buildReviewHash(a.nodes, a.edges), buildReviewHash(b.nodes, b.edges));

  const renamed = loginFlow();
  renamed.nodes[0]!.stateName = 'SIGN_IN_PAGE';
  assert.notEqual(buildReviewHash(a.nodes, a.edges), buildReviewHash(renamed.nodes, renamed.edges));
});

test('buildReviewHash changes when only a declared input field changes — the exact gap graphRevisionHash leaves', () => {
  const before = loginFlow();
  const beforeHash = buildReviewHash(before.nodes, before.edges);

  const after = loginFlow();
  // The Admin Course Create bug, reproduced: adding the missing password field to the
  // transition's declared inputs, with no other change to state/transition shape.
  after.edges[0]!.expectedInput = [
    { name: 'email', dataKey: 'email', role: 'PROTECTED' },
    { name: 'password', dataKey: 'password', role: 'PROTECTED' },
  ];
  const afterHash = buildReviewHash(after.nodes, after.edges);

  assert.notEqual(beforeHash, afterHash, 'fixing the declared inputs must invalidate the cached review');
});

test('an unreachable state is reported under criterion 1, not duplicated as a structural error', () => {
  const nodes = [
    node({ id: 'n1', stateName: 'START', role: 'INITIAL' }),
    node({ id: 'n2', stateName: 'END', role: 'TERMINAL', terminalKind: 'SUCCESS' }),
    node({ id: 'n3', stateName: 'ORPHAN' }),
  ];
  const edges = [edge({ id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' })];
  const findings = languageFindings(nodes, edges);
  const unreachable = findings.find((finding) => finding.code === 'UNREACHABLE_STATE');
  assert.ok(unreachable);
  assert.equal(unreachable!.criterion, 'INTERPRETABLE_END_TO_END');
  assert.equal(unreachable!.severity, 'CRITICAL');
  assert.deepEqual(unreachable!.nodeIds, ['n3']);
});

test('a dead-end state is reported under criterion 1', () => {
  const nodes = [
    node({ id: 'n1', stateName: 'START', role: 'INITIAL' }),
    node({ id: 'n2', stateName: 'STUCK' }),
  ];
  const edges = [edge({ id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' })];
  const findings = languageFindings(nodes, edges);
  assert.ok(findings.some((finding) => finding.code === 'DEAD_END_STATE' && finding.criterion === 'INTERPRETABLE_END_TO_END'));
});

test('a generic action name is reported under criterion 4, not criterion 1', () => {
  const nodes = [
    node({ id: 'n1', stateName: 'START', role: 'INITIAL' }),
    node({ id: 'n2', stateName: 'END', role: 'TERMINAL', terminalKind: 'SUCCESS' }),
  ];
  const edges = [edge({ id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', action: 'continue' })];
  const findings = languageFindings(nodes, edges);
  const generic = findings.find((finding) => finding.code === 'ACTION_GENERIC');
  assert.ok(generic);
  assert.equal(generic!.criterion, 'BUSINESS_INTENT_DERIVABLE');
  assert.equal(generic!.severity, 'LOW');
});

test('colliding terminal and intermediate routes with no declared evidence are a critical finding', () => {
  const nodes = [
    node({ id: 'n1', stateName: 'COURSE_FORM', recognizer: { routes: ['/courses/{param}'] } }),
    node({ id: 'n2', stateName: 'COURSE_OVERVIEW', role: 'TERMINAL', terminalKind: 'SUCCESS', recognizer: { routes: ['/courses/{param}'] } }),
  ];
  const findings = routeCollisionFindings(nodes);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.criterion, 'ROUTE_DISAMBIGUATION');
  assert.equal(findings[0]!.code, 'ROUTE_COLLISION_UNDISAMBIGUATED');
  assert.equal(findings[0]!.severity, 'CRITICAL');
  assert.deepEqual(findings[0]!.nodeIds.sort(), ['n1', 'n2']);
});

test('colliding routes with distinct declared headings are only informational', () => {
  const nodes = [
    node({ id: 'n1', stateName: 'COURSE_FORM', recognizer: { routes: ['/courses/{param}'], headings: ['Edit Course'] } }),
    node({ id: 'n2', stateName: 'COURSE_OVERVIEW', role: 'TERMINAL', terminalKind: 'SUCCESS', recognizer: { routes: ['/courses/{param}'], headings: ['Course Overview'] } }),
  ];
  const findings = routeCollisionFindings(nodes);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.code, 'ROUTE_COLLISION_DISAMBIGUATED');
  assert.equal(findings[0]!.severity, 'INFO');
});

test('runStaticSustainabilityChecks combines both check families', () => {
  const nodes = [
    node({ id: 'n1', stateName: 'START', role: 'INITIAL', recognizer: { routes: ['/a'] } }),
    node({ id: 'n2', stateName: 'END', role: 'TERMINAL', terminalKind: 'SUCCESS', recognizer: { routes: ['/a'] } }),
    node({ id: 'n3', stateName: 'ORPHAN' }),
  ];
  const edges = [edge({ id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' })];
  const findings = runStaticSustainabilityChecks(nodes, edges);
  assert.ok(findings.some((finding) => finding.code === 'UNREACHABLE_STATE'));
  assert.ok(findings.some((finding) => finding.code === 'ROUTE_COLLISION_UNDISAMBIGUATED'));
});
