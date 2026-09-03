import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import test from 'node:test';
import type { CodebaseAnalysis, CodeEntity } from '@tellann/desktop-contracts';
import {
  analyzeCodebase, blastRadius, buildSanitizedSourceArchive, canonicalRoute,
  compareAnalyses, previewSanitizedSourceArchive, redactSecrets,
} from './index';

const WORKSPACE = '00000000-0000-4000-8000-000000000005';
const FINGERPRINT = 'f'.repeat(64);

function write(root: string, relative: string, content: string): void {
  const target = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

/**
 * A repository shaped like the ones this analyzer is meant for: a pnpm
 * workspace with a Next.js frontend, a Nest service, an Express service, a
 * Prisma schema, events, a queue, a cron job, tests, and documentation that
 * disagrees with the code.
 */
function buildFixture(): string {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-fixture-')));

  write(root, 'package.json', JSON.stringify({ name: 'shop', private: true }));
  write(root, 'pnpm-workspace.yaml', 'packages:\n  - "apps/*"\n  - "services/*"\n  - "packages/*"\n');

  // ── packages/db ────────────────────────────────────────────────────────────
  write(root, 'packages/db/package.json', JSON.stringify({ name: '@shop/db', main: 'src/index.ts' }));
  write(root, 'packages/db/prisma/schema.prisma', [
    'model Order { id String @id }',
    'model Payment { id String @id }',
    'model Cart { id String @id }',
  ].join('\n'));
  write(root, 'packages/db/src/index.ts', [
    'export const prisma = {} as any;',
    'export function connect() { return prisma; }',
  ].join('\n'));

  // ── services/api: Express checkout + event publication ─────────────────────
  write(root, 'services/api/package.json', JSON.stringify({
    name: '@shop/api', main: 'src/index.ts',
    dependencies: { express: '^5.0.0', '@shop/db': 'workspace:*', stripe: '^17.0.0' },
  }));
  write(root, 'services/api/src/payments.ts', [
    "import { prisma } from '@shop/db';",
    'const stripe = {} as any;',
    'export async function chargeCard(amount: number) {',
    '  await stripe.paymentIntents.create({ amount });',
    '  await prisma.payment.create({ data: { amount } });',
    '  return true;',
    '}',
  ].join('\n'));
  write(root, 'services/api/src/index.ts', [
    "import express from 'express';",
    "import { prisma } from '@shop/db';",
    "import { chargeCard } from './payments';",
    "import { bus } from './bus';",
    'const app = express();',
    "app.post('/checkout', async function checkout() {",
    '  await prisma.cart.findMany({});',
    '  await chargeCard(100);',
    '  await prisma.order.create({ data: {} });',
    "  bus.publish('order.created', {});",
    '});',
    'export { app };',
  ].join('\n'));
  write(root, 'services/api/src/bus.ts', 'export const bus = {} as any;');

  // ── services/notifications: consumer, queue worker, cron ───────────────────
  write(root, 'services/notifications/package.json', JSON.stringify({
    name: '@shop/notifications', main: 'src/index.ts', dependencies: { '@shop/db': 'workspace:*' },
  }));
  write(root, 'services/notifications/src/index.ts', [
    "import { bus } from '../../api/src/bus';",
    'const sendgrid = {} as any;',
    'const cron = {} as any;',
    'declare const Worker: any;',
    'export function sendConfirmation() {',
    "  return sendgrid.send({ to: 'x' });",
    '}',
    "bus.on('order.created', sendConfirmation);",
    "cron.schedule('0 * * * *', function sweepDigests() { return sendConfirmation(); });",
    "const worker = new Worker('emails', function drainEmails() { return sendConfirmation(); });",
    'export { worker };',
  ].join('\n'));

  // ── services/nest: decorator-driven controller ─────────────────────────────
  write(root, 'services/nest/package.json', JSON.stringify({
    name: '@shop/nest', main: 'src/index.ts', dependencies: { '@nestjs/core': '^10.0.0' },
  }));
  write(root, 'services/nest/src/index.ts', [
    'declare function Controller(prefix?: string): ClassDecorator;',
    'declare function Get(path?: string): MethodDecorator;',
    'declare function Post(path?: string): MethodDecorator;',
    'declare function OnEvent(name: string): MethodDecorator;',
    "@Controller('users')",
    'export class UserController {',
    '  @Post()',
    '  createUser() { return 1; }',
    "  @Get(':id')",
    '  findUser() { return 2; }',
    "  @OnEvent('order.created')",
    '  onOrder() { return 3; }',
    '}',
  ].join('\n'));

  // ── apps/web: Next.js app + pages routes, React action, API client ─────────
  write(root, 'apps/web/package.json', JSON.stringify({
    name: '@shop/web', main: 'src/index.ts', dependencies: { next: '^15.0.0', react: '^19.0.0' },
  }));
  write(root, 'apps/web/app/checkout/page.tsx', [
    "import { startCheckout } from '../../src/api-client';",
    'export default function CheckoutPage() {',
    '  return <button onClick={startCheckout}>Buy now</button>;',
    '}',
  ].join('\n'));
  write(root, 'apps/web/app/orders/[id]/route.ts', [
    'export async function GET() { return new Response("ok"); }',
  ].join('\n'));
  write(root, 'apps/web/pages/legacy.tsx', 'export default function Legacy() { return null; }');
  write(root, 'apps/web/src/api-client.ts', [
    'export async function startCheckout() {',
    "  return fetch('/checkout', { method: 'POST' });",
    '}',
  ].join('\n'));

  // ── Aliased re-export chain ────────────────────────────────────────────────
  write(root, 'packages/shared/package.json', JSON.stringify({ name: '@shop/shared', main: 'src/index.ts' }));
  write(root, 'packages/shared/src/money.ts', 'export function formatMoney(value: number) { return String(value); }');
  write(root, 'packages/shared/src/index.ts', "export { formatMoney } from './money';");
  write(root, 'services/api/src/receipt.ts', [
    "import { formatMoney } from '@shop/shared';",
    'export function renderReceipt() { return formatMoney(10); }',
  ].join('\n'));

  // ── Import cycle ───────────────────────────────────────────────────────────
  write(root, 'packages/shared/src/cycle-a.ts', [
    "import { bValue } from './cycle-b';",
    'export const aValue = () => bValue();',
  ].join('\n'));
  write(root, 'packages/shared/src/cycle-b.ts', [
    "import { aValue } from './cycle-a';",
    'export const bValue = () => aValue;',
  ].join('\n'));

  // ── Tests, docs, other languages, secrets ──────────────────────────────────
  write(root, 'services/api/src/payments.test.ts', [
    "import { chargeCard } from './payments';",
    "describe('payments', () => {",
    "  it('charges the card and records a payment', async () => { await chargeCard(1); });",
    '});',
  ].join('\n'));
  write(root, 'openapi.json', JSON.stringify({
    paths: {
      '/checkout': { post: {} },
      '/legacy-refund': { post: {} },
    },
  }));
  write(root, 'docs/architecture.md', '# Architecture\n\nCheckout charges the card.');
  write(root, 'scripts/report.py', 'print("not analyzed deeply")');
  write(root, 'scripts/tool.go', 'package main');
  write(root, '.env', 'STRIPE_SECRET_KEY=sk_live_abcdefghijklmnop1234\n');
  write(root, 'services/api/src/config.ts', [
    'export const config = {',
    "  apiKey: 'sk_live_zzzzzzzzzzzzzzzzzzzz',",
    "  url: process.env.STRIPE_SECRET_KEY,",
    '};',
    'export function readConfig() { return config; }',
  ].join('\n'));

  return root;
}

let fixtureRoot: string | null = null;
let fixtureAnalysis: CodebaseAnalysis | null = null;

function analyze(): { root: string; analysis: CodebaseAnalysis } {
  if (!fixtureRoot || !fixtureAnalysis) {
    fixtureRoot = buildFixture();
    fixtureAnalysis = analyzeCodebase(fixtureRoot, WORKSPACE, FINGERPRINT).analysis;
  }
  return { root: fixtureRoot, analysis: fixtureAnalysis };
}

const named = (analysis: CodebaseAnalysis, type: CodeEntity['type']): string[] =>
  analysis.entities.filter((entity) => entity.type === type).map((entity) => entity.name);

const edgeExists = (analysis: CodebaseAnalysis, type: string, predicate: (target: CodeEntity) => boolean): boolean =>
  analysis.relationships.some((edge) => {
    if (edge.type !== type) return false;
    const target = analysis.entities.find((entity) => entity.id === edge.target);
    return Boolean(target && predicate(target));
  });

test('canonicalises routes across framework spellings', () => {
  assert.equal(canonicalRoute('/users/:id'), '/users/{param}');
  assert.equal(canonicalRoute('/users/[id]'), '/users/{param}');
  assert.equal(canonicalRoute('users/[[...slug]]'), '/users/{param}');
  assert.equal(canonicalRoute('/Users/'), '/users');
  assert.equal(canonicalRoute('/a?b=1'), '/a');
});

test('resolves calls across files with the type checker rather than by call text', () => {
  const { analysis } = analyze();
  const checkout = analysis.entities.find((entity) => entity.type === 'function' && entity.name === 'checkout');
  const charge = analysis.entities.find((entity) => entity.type === 'function' && entity.name === 'chargeCard');
  assert.ok(checkout, 'the checkout handler should be a declaration node');
  assert.ok(charge, 'chargeCard should be a declaration node');

  const resolved = analysis.relationships.find((edge) =>
    edge.type === 'CALLS' && edge.source === checkout!.id && edge.target === charge!.id);
  assert.ok(resolved, 'checkout should call chargeCard through a resolved edge');
  assert.equal(resolved!.confidence, 1, 'a checker-resolved call is full confidence');

  // The old text-keyed scheme collapsed every same-spelled call onto one node.
  const phantom = analysis.entities.filter((entity) => entity.metadata?.unresolved === true);
  assert.equal(phantom.length, 0, 'unresolved calls must not be invented as entities');
});

test('follows workspace aliases and re-exports to the real declaration', () => {
  const { analysis } = analyze();
  const receipt = analysis.entities.find((entity) => entity.type === 'function' && entity.name === 'renderReceipt');
  const format = analysis.entities.find((entity) => entity.type === 'function' && entity.name === 'formatMoney');
  assert.ok(receipt && format);
  assert.ok(
    analysis.relationships.some((edge) =>
      edge.type === 'CALLS' && edge.source === receipt!.id && edge.target === format!.id),
    'an aliased re-export should resolve through to its definition',
  );
});

test('extracts endpoints from Express, NestJS decorators and Next.js file routes', () => {
  const { analysis } = analyze();
  const endpoints = named(analysis, 'endpoint');
  assert.ok(endpoints.includes('POST /checkout'), 'express route');
  assert.ok(endpoints.includes('POST /users'), 'nest @Post on @Controller("users")');
  assert.ok(endpoints.includes('GET /users/{param}'), 'nest @Get(":id") composed with the controller prefix');
  assert.ok(endpoints.includes('GET /orders/{param}'), 'next.js app-router route handler');
  assert.ok(named(analysis, 'ui_route').includes('/checkout'), 'next.js page route');
  assert.ok(named(analysis, 'ui_route').includes('/legacy'), 'next.js pages-router page');
});

test('joins a browser fetch to the backend endpoint it calls', () => {
  const { analysis } = analyze();
  const endpoint = analysis.entities.find((entity) =>
    entity.type === 'endpoint' && entity.name === 'POST /checkout');
  assert.ok(endpoint);
  const client = analysis.entities.find((entity) => entity.type === 'function' && entity.name === 'startCheckout');
  assert.ok(client);
  assert.ok(
    analysis.relationships.some((edge) =>
      edge.type === 'CALLS' && edge.source === client!.id && edge.target === endpoint!.id),
    'the frontend client and the server route must share one endpoint node',
  );
});

test('records a UI action and the handler it triggers', () => {
  const { analysis } = analyze();
  const action = analysis.entities.find((entity) => entity.type === 'ui_action');
  assert.ok(action, 'an onClick handler should produce a ui_action');
  assert.match(action!.name, /Buy now/);
  assert.ok(
    analysis.relationships.some((edge) => edge.type === 'ROUTES_TO' && edge.source === action!.id),
    'the action should route to the handler it names',
  );
});

test('separates database reads from writes and prefers the declared schema', () => {
  const { analysis } = analyze();
  assert.ok(edgeExists(analysis, 'READS', (target) => target.name.toLowerCase() === 'cart'));
  assert.ok(edgeExists(analysis, 'WRITES', (target) => target.name.toLowerCase() === 'order'));
  assert.ok(edgeExists(analysis, 'WRITES', (target) => target.name.toLowerCase() === 'payment'));

  const order = analysis.entities.find((entity) =>
    entity.type === 'database_model' && entity.name.toLowerCase() === 'order');
  assert.equal(order?.metadata.declared, true, 'the Prisma schema should confirm the model');
});

test('captures event publication, subscription and downstream effects', () => {
  const { analysis } = analyze();
  assert.ok(named(analysis, 'event').includes('order.created'));
  assert.ok(analysis.relationships.some((edge) => edge.type === 'PUBLISHES'));
  assert.ok(analysis.relationships.some((edge) => edge.type === 'SUBSCRIBES_TO'));
  assert.ok(analysis.relationships.some((edge) => edge.type === 'HANDLED_BY'));

  const checkoutFeature = analysis.features.find((feature) => feature.emittedEvents.includes('order.created'));
  assert.ok(checkoutFeature, 'the checkout feature should publish order.created');
  assert.ok(
    checkoutFeature!.downstreamEffects.some((effect) => /order\.created handled by/i.test(effect)),
    'the consumer of that event must appear as a downstream effect',
  );
});

test('detects scheduled jobs and queue consumers as entrypoints', () => {
  const { analysis } = analyze();
  assert.ok(named(analysis, 'job').some((name) => name.includes('0 * * * *')), 'cron schedule');
  assert.ok(named(analysis, 'queue').includes('emails'), 'queue worker');
  assert.ok(analysis.features.some((feature) => /scheduled/i.test(feature.name)), 'a cron job is a feature trigger');
});

test('builds features with a workflow, side effects and honest confidence', () => {
  const { analysis } = analyze();
  const checkout = analysis.features.find((feature) => feature.triggers.includes('POST /checkout'));
  assert.ok(checkout);
  assert.ok(checkout!.writes.length >= 1, 'checkout writes at least one model');
  assert.ok(checkout!.externalServices.length >= 1, 'checkout reaches an external service');
  assert.ok(checkout!.workflow.length > 1, 'the workflow spans more than the entrypoint');
  assert.ok(checkout!.sourceFiles.some((file) => file.includes('payments.ts')), 'evidence crosses files');
  assert.ok(checkout!.confidence > 0.5 && checkout!.confidence <= 1);
});

test('links tests to the subjects they import', () => {
  const { analysis } = analyze();
  const testEntity = analysis.entities.find((entity) => entity.type === 'test' && /charges the card/.test(entity.name));
  assert.ok(testEntity);
  assert.ok(
    analysis.relationships.some((edge) => edge.type === 'TESTS' && edge.source === testEntity!.id),
    'a test should point at what it exercises',
  );
});

test('reports documented endpoints that no code implements', () => {
  const { analysis } = analyze();
  const stale = analysis.findings.find((finding) => finding.kind === 'STALE_DOCUMENTATION');
  assert.ok(stale, 'an OpenAPI path with no implementation is a finding');
  assert.match(stale!.description, /legacy-refund/);
});

test('detects import cycles as strongly connected components', () => {
  const { analysis } = analyze();
  const cycle = analysis.findings.find((finding) => finding.kind === 'CYCLE');
  assert.ok(cycle, 'the cycle-a/cycle-b pair should be reported');
  assert.ok(cycle!.entityIds.length >= 2);
});

test('produces named domains from clustering plus semantic signals', () => {
  const { analysis } = analyze();
  assert.ok(analysis.architecture, 'the architecture report should be present');
  assert.ok(analysis.architecture!.domains.length >= 1);
  for (const domain of analysis.architecture!.domains) {
    assert.ok(domain.name.length > 0);
    assert.ok(domain.confidence >= 0.6 && domain.confidence <= 1);
    assert.ok(Array.isArray(domain.signals));
  }
  assert.ok(analysis.features.every((feature) => feature.domain.length > 0), 'every feature is assigned a domain');
});

test('measures coupling, centrality and architecture metrics', () => {
  const { analysis } = analyze();
  const architecture = analysis.architecture!;
  assert.ok(architecture.metrics.modules > 0);
  assert.ok(architecture.coupling.length > 0);
  for (const record of architecture.coupling) {
    assert.ok(record.instability >= 0 && record.instability <= 1);
    assert.ok(record.centrality >= 0 && record.centrality <= 1);
  }
});

test('answers blast radius from incoming dependencies', () => {
  const { analysis } = analyze();
  const charge = analysis.entities.find((entity) => entity.type === 'function' && entity.name === 'chargeCard')!;
  const graph = analysisToGraph(analysis);
  const radius = blastRadius(graph, charge.id);
  assert.ok(radius.affected.functions + radius.affected.modules > 0, 'something depends on chargeCard');
  assert.ok(radius.entityIds.length > 0);
});

test('counts coverage in files and names unsupported languages', () => {
  const { analysis } = analyze();
  const coverage = analysis.coverage!;
  assert.ok(coverage.unsupportedLanguageFiles.Python >= 1);
  assert.ok(coverage.unsupportedLanguageFiles.Go >= 1);
  assert.ok(coverage.analyzedFiles > 0);
  // Two unsupported files beside many analysed ones must not read as 91%.
  assert.ok(coverage.analyzableFiles >= coverage.analyzedFiles - 1);
  assert.ok(analysis.summary.coveragePercent > 50 && analysis.summary.coveragePercent <= 100);
  assert.ok(analysis.warnings.some((warning) => /Python/.test(warning)));
  assert.ok(analysis.findings.some((finding) => finding.kind === 'UNSUPPORTED_LANGUAGE'));
});

test('is deterministic for the same working tree', () => {
  const { root, analysis } = analyze();
  const second = analyzeCodebase(root, WORKSPACE, FINGERPRINT).analysis;
  assert.equal(analysis.graphVersion, second.graphVersion);
  assert.equal(analysis.contentHash, second.contentHash);
  assert.equal(analysis.entities.length, second.entities.length);
  assert.equal(analysis.relationships.length, second.relationships.length);
  assert.equal(analysis.features.length, second.features.length);

  const normalise = (input: CodebaseAnalysis) => JSON.stringify({
    entities: input.entities.map((entity) => [entity.id, entity.type, entity.name]).sort(),
    edges: input.relationships.map((edge) => [edge.source, edge.type, edge.target]).sort(),
  });
  assert.equal(normalise(analysis), normalise(second));
});

test('snapshot identity distinguishes two dirty trees at one revision', () => {
  const root = buildFixture();
  const first = analyzeCodebase(root, WORKSPACE, FINGERPRINT).analysis;
  write(root, 'services/api/src/extra.ts', 'export function extra() { return 1; }');
  const second = analyzeCodebase(root, WORKSPACE, FINGERPRINT).analysis;
  assert.notEqual(first.contentHash, second.contentHash);
  assert.notEqual(first.graphVersion, second.graphVersion);
  fs.rmSync(root, { recursive: true, force: true });
});

test('reuses cached fragments when nothing changed and re-analyses what did', () => {
  const root = buildFixture();
  const first = analyzeCodebase(root, WORKSPACE, FINGERPRINT);
  assert.equal(first.analysis.incremental!.mode, 'full');

  const unchanged = analyzeCodebase(root, WORKSPACE, FINGERPRINT, { cache: first.cache });
  assert.equal(unchanged.analysis.incremental!.mode, 'unchanged');
  assert.ok(unchanged.analysis.incremental!.reusedFiles > 0);
  assert.equal(
    unchanged.analysis.entities.filter((entity) => entity.type === 'endpoint').length,
    first.analysis.entities.filter((entity) => entity.type === 'endpoint').length,
    'replayed fragments must reproduce the same endpoints',
  );

  write(root, 'services/api/src/payments.ts', [
    "import { prisma } from '@shop/db';",
    'const stripe = {} as any;',
    'export async function chargeCard(amount: number) {',
    '  await stripe.paymentIntents.create({ amount });',
    '  await prisma.payment.create({ data: { amount } });',
    '  await prisma.paymentAttempt.create({ data: {} });',
    '  return true;',
    '}',
  ].join('\n'));
  const incremental = analyzeCodebase(root, WORKSPACE, FINGERPRINT, { cache: unchanged.cache });
  assert.equal(incremental.analysis.incremental!.mode, 'incremental');
  assert.ok(incremental.analysis.incremental!.modifiedFiles.some((file) => file.includes('payments.ts')));
  assert.ok(
    incremental.analysis.incremental!.invalidatedDependents >= 1,
    'files importing the changed one must be re-analysed',
  );
  assert.ok(
    incremental.analysis.entities.some((entity) =>
      entity.type === 'database_model' && entity.name.toLowerCase() === 'paymentattempt'),
    'the new write should appear after an incremental rescan',
  );

  // The incremental result must agree with a clean full scan of the same tree.
  const clean = analyzeCodebase(root, WORKSPACE, FINGERPRINT).analysis;
  const ids = (input: CodebaseAnalysis) =>
    new Set(input.entities.filter((entity) => entity.type === 'endpoint' || entity.type === 'database_model')
      .map((entity) => entity.id));
  assert.deepEqual([...ids(incremental.analysis)].sort(), [...ids(clean)].sort());
  fs.rmSync(root, { recursive: true, force: true });
});

test('compares two analyses into an architectural change report', () => {
  const root = buildFixture();
  const before = analyzeCodebase(root, WORKSPACE, FINGERPRINT).analysis;
  write(root, 'services/api/src/refunds.ts', [
    "import express from 'express';",
    "import { prisma } from '@shop/db';",
    'const app = express();',
    "app.post('/refunds', async function refund() { await prisma.refund.create({ data: {} }); });",
    'export { app as refundApp };',
  ].join('\n'));
  const after = analyzeCodebase(root, WORKSPACE, FINGERPRINT).analysis;

  const comparison = compareAnalyses(before, after);
  assert.ok(comparison.summary.endpointsAdded >= 1);
  assert.ok(comparison.changes.some((change) => change.kind === 'ADDED' && /refunds/i.test(change.label)));
  assert.ok(comparison.summary.featuresAdded >= 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('redacts secret values without discarding the surrounding code', () => {
  const outcome = redactSecrets([
    "const apiKey = 'sk_live_abcdefghijklmnop';",
    "export function handler() { return apiKey; }",
  ].join('\n'));
  assert.ok(outcome.redactions >= 1);
  assert.equal(outcome.content.includes('sk_live_abcdefghijklmnop'), false);
  assert.ok(outcome.content.includes('export function handler'), 'code structure survives redaction');
});

test('never ships credential files, and reports what it excluded', () => {
  const { root } = analyze();
  const archive = buildSanitizedSourceArchive(root);
  const decoded = zlib.gunzipSync(archive.buffer).toString('utf8');
  assert.equal(decoded.includes('sk_live_abcdefghijklmnop1234'), false, '.env must not be uploaded');
  assert.equal(decoded.includes('sk_live_zzzzzzzzzzzzzzzzzzzz'), false, 'inline literals are redacted');
  assert.ok(decoded.includes('checkout'), 'source needed for analysis is still present');
  assert.ok(archive.redactedFiles >= 1);
  assert.ok(archive.fileCount > 0);
  assert.equal(archive.truncated, false);
});

test('previews archive size and exclusions before consent is given', () => {
  const { root } = analyze();
  const preview = previewSanitizedSourceArchive(root);
  assert.ok(preview.compressedBytes > 0);
  assert.ok(preview.fileCount > 0);
  assert.ok(preview.languages.length > 0);
  assert.ok(preview.excludedByReason['secret-path'] >= 1, 'the .env exclusion is reported up front');
});

test('reports truncation explicitly instead of silently dropping files', () => {
  const { root } = analyze();
  const tiny = buildSanitizedSourceArchive(root, 2_000);
  assert.equal(tiny.truncated, true);
  assert.ok(tiny.excluded.some((item) => item.reason === 'archive-budget'));
  // Source is kept in preference to documentation when the budget is tight.
  const kept = zlib.gunzipSync(tiny.buffer).toString('utf8');
  assert.equal(kept.includes('architecture.md'), false);
});

/** Rebuild a queryable graph from a finished analysis, for traversal helpers. */
function analysisToGraph(analysis: CodebaseAnalysis) {
  const { GraphBuilder } = require('./core') as typeof import('./core');
  const graph = new GraphBuilder();
  for (const entity of analysis.entities) graph.addEntity(entity);
  for (const edge of analysis.relationships) {
    const { id, ...rest } = edge;
    graph.addEdge(rest);
  }
  return graph;
}

test.after(() => {
  if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true });
});
