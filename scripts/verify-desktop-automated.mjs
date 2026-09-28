/**
 * Acceptance for Automated Run.
 *
 *   pnpm verify:desktop:automated                      run everything that can run on this machine
 *   pnpm verify:desktop:automated -- --require-services   also fail (instead of skipping) if the gateway/database are absent
 *
 * Two tiers, kept apart so the result says exactly what was and was not proven:
 *
 *  1. LOCAL — real headless Chromium, the real observer, the real driver, the real engine and the real
 *     desktop composition (`executeAutomatedRun`), against the shared LMS fixture application
 *     (@tellann/lms-fixture) with a Flow compiled by the real contract compiler. Nothing is faked
 *     except the application's own SDK, which the fixture stands in for. The report section is built by
 *     the same function the report worker uses, from the evidence the run actually recorded.
 *  2. PLATFORM — the API contract (production refusal, entitlement), against a running gateway and
 *     database. Skipped, loudly, when they are not there.
 *
 * Run `pnpm build` first: this reads compiled packages, as verify-desktop-phase3.mjs does.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { BrowserObserver } = require('../packages/browser-observer/dist/index.js');
const { PageAutomationDriver } = require('../packages/browser-observer/dist/automation-driver.js');
const { readZip } = require('../packages/browser-observer/dist/trace-sanitizer.js');
const { compileExecutableContract, resolveRunTargets, SdkSignalBuffer, normalizeStateKey } = require('../packages/automation-engine/dist/index.js');
const { normalizeQaFlowKey } = require('../packages/db/dist/qa-flow-boundary.js');
const {
  AUTOMATION_STOP_REASON_KIND, AutomatedRunSectionSchema, AutomationConfigSchema, AutomationLimitsSchema,
  RunDataSetSchema, StartGuidedRunInputSchema, TestPersonaSchema,
} = require('../packages/desktop-contracts/dist/index.js');
const { LMS_USERS, lmsFlow, lmsNavigation, startLmsApp } = require('../packages/lms-fixture/dist/index.js');
const { executeAutomatedRun } = require('../apps/desktop/dist/main/main/automation/run-executor.js');
const { workspaceCodeEvidenceSource } = require('../apps/desktop/dist/main/main/automation/diagnostics-ports.js');
const { summarizeAutomationEvidence } = require('../services/background-workers/dist/qa-automation-report.js');
const { classifyAutomatedStateGap } = require('../services/fdrs-api/dist/automated-reconciliation.js');
const { PLAN_DEFINITIONS } = require('../packages/shared/dist/index.js');

const requireServices = process.argv.includes('--require-services');
const APP_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date().toISOString();
const TARGET = 'exam_created';
const DECLARED = ['course_details', 'exam_form', 'exam_created'];

// ---------------------------------------------------------------------------
// Bookkeeping
// ---------------------------------------------------------------------------

const results = [];
let scenario = '';
function check(name, condition, detail = '') {
  results.push({ scenario, name, ok: Boolean(condition), detail: condition ? '' : String(detail) });
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `\n        ${detail}`}`);
}
const skipped = [];

// ---------------------------------------------------------------------------
// Running one Automated Run against the fixture
// ---------------------------------------------------------------------------

const persona = (user) => TestPersonaSchema.parse({
  id: `persona-${user}`, applicationId: APP_ID, name: user, roles: [LMS_USERS[user].role], authenticated: true,
  credentials: [{ field: 'email', value: LMS_USERS[user].email }, { field: 'password', value: LMS_USERS[user].password }],
  createdAt: NOW, updatedAt: NOW,
});

const runData = (values) => RunDataSetSchema.parse({ id: 'data-1', applicationId: APP_ID, name: 'Exam data', values, createdAt: NOW, updatedAt: NOW });
const examData = () => runData([{ key: 'examTitle', generator: { kind: 'UNIQUE_SUFFIX', prefix: 'qa-exam-' }, secret: false }]);

async function runScenario(spec) {
  const app = await startLmsApp({ faults: spec.faults ?? {}, markers: spec.markers ?? 'adapter' });
  const events = [];
  const observer = new BrowserObserver({ headless: true, onEvidenceEvent: (event) => { events.push(event); } });
  const limits = AutomationLimitsSchema.parse({ maxDurationMs: 90_000, ...(spec.limits ?? {}) });
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-automated-'));
  const contract = compileExecutableContract(lmsFlow());
  let outcome;
  try {
    await observer.start({
      applicationId: APP_ID, environmentId: '22222222-2222-4222-8222-222222222222', workspaceId: null,
      environmentType: 'DEVELOPMENT', captureTracks: ['FRONTEND'], expectedGraphVersionId: '33333333-3333-4333-8333-333333333333',
      mode: 'AUTOMATED', targetUrl: app.url,
      automation: { targetTerminalStateKey: TARGET, executionProfileId: 'acceptance', limits, renderTimingComponents: [] },
    }, artifactRoot);
    const page = observer.getAutomationPage();
    // The page reports its states the way an application really does, in one of the three marker shapes, and
    // they are read the way the boundary evaluator reads them: by every name a state answers to.
    const signals = new SdkSignalBuffer(contract.stateAliases);
    const driver = new PageAutomationDriver(page, {
      sdkStates: async () => {
        const markers = await page.evaluate(() => window.__markers.slice());
        signals.reset();
        for (const marker of markers) signals.observe(marker);
        return signals.states();
      },
      beforeAction: () => { void page.evaluate(() => { window.__markers = []; }).catch(() => undefined); },
      quietMs: 100,
    });
    const act = driver.act.bind(driver);
    let acts = 0;
    driver.act = async (action) => {
      const done = await act(action);
      acts += 1;
      if (spec.crashAfterActs && acts === spec.crashAfterActs) await page.close();
      return done;
    };
    const result = await executeAutomatedRun({
      browser: observer, driver, contract,
      navigation: lmsNavigation({ courseRoles: spec.courseRoles }),
      persona: spec.persona === null ? null : persona(spec.persona ?? 'teacher'),
      runData: spec.runData === undefined ? examData() : spec.runData,
      targetStateKey: TARGET, environment: 'DEVELOPMENT', applicationOrigin: app.origin, limits,
      code: spec.explain === false ? null : { graph: lmsFlow().code.entities ? { entities: lmsFlow().code.entities.map((e) => ({ startLine: null, endLine: null, ...e })), relationships: lmsFlow().code.relationships } : { entities: [], relationships: [] } },
    });
    const finalPath = page.isClosed() ? null : new URL(page.url()).pathname;
    const finalState = spec.crashAfterActs ? await observer.abort('browser closed') : await observer.end();
    outcome = { app, events, result, finalState, finalPath, artifactDirectory: finalState.artifactDirectory };
  } catch (error) {
    try { await observer.abort('acceptance failure'); } catch { /* already down */ }
    throw error;
  } finally {
    await app.close();
  }
  return outcome;
}

const automationEvents = (events) => events.filter((event) => event.eventType.startsWith('QA_AUTOMATION_'));

function section(outcome, extra = {}) {
  const evidence = automationEvents(outcome.events).map((event) => ({
    eventType: event.eventType, occurredAt: event.occurredAt ?? event.timestamp ?? new Date().toISOString(),
    localSequence: event.localSequence, scope: event.scope, normalizedRoute: event.normalizedRoute ?? null, metadata: event.metadata ?? {},
  }));
  return summarizeAutomationEvidence({ mode: 'AUTOMATED', automation: { targetTerminalStateKey: TARGET, ...extra }, initialStateKey: 'course_details' }, evidence, DECLARED);
}

function everythingStored(outcome) {
  const parts = [JSON.stringify(outcome.events)];
  for (const name of fs.readdirSync(outcome.artifactDirectory)) {
    const file = path.join(outcome.artifactDirectory, name);
    if (name.endsWith('.zip')) {
      for (const entry of readZip(fs.readFileSync(file))) parts.push(entry.data.toString('utf8'));
    } else if (/\.(json|txt)$/.test(name)) {
      parts.push(fs.readFileSync(file, 'utf8'));
    }
  }
  return parts.join('\n');
}

const traces = (outcome) => fs.readdirSync(outcome.artifactDirectory).filter((name) => /^trace-\d/.test(name));
const posts = (app, route) => app.requests.filter((request) => request.method === 'POST' && request.path === route);
const kindOf = (stopReason) => AUTOMATION_STOP_REASON_KIND[stopReason];

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function cleanRun() {
  scenario = 'a run that goes to plan';
  console.log(`\n${scenario}`);
  const outcome = await runScenario({});
  const { result, app } = outcome;
  check('reaches the target state', result.stopReason === 'TERMINAL_STATE_REACHED', `${result.stopReason}: ${result.detail}`);
  check('visits the declared states in order', JSON.stringify(result.states.map((s) => s.stateKey)) === JSON.stringify(DECLARED), JSON.stringify(result.states.map((s) => s.stateKey)));
  check('logged in exactly once, as the persona', posts(app, '/api/login').length === 1);
  check('created exactly one exam, with a title generated from the run data set', app.exams.length === 1 && app.exams[0].title.startsWith('qa-exam-'), JSON.stringify(app.exams));
  check('the exam was created by the teacher persona', app.exams[0]?.by === LMS_USERS.teacher.email);

  const own = automationEvents(outcome.events);
  const types = own.map((event) => event.eventType);
  for (const type of ['QA_AUTOMATION_PLAN_CREATED', 'QA_AUTOMATION_STATE_EVALUATED', 'QA_AUTOMATION_ACTION_SELECTED', 'QA_AUTOMATION_ACTION_VERIFIED', 'QA_AUTOMATION_TERMINAL_STATE_REACHED', 'QA_AUTOMATION_STOPPED']) {
    check(`records ${type}`, types.includes(type));
  }
  check('the agent speaks for itself, not the application', own.every((event) => event.source === 'DESKTOP_AGENT'));
  check('the executor never opens the Flow boundary: everything it records stays pre-boundary', own.every((event) => event.scope === 'PRE_BOUNDARY'), JSON.stringify([...new Set(own.map((e) => e.scope))]));
  const selected = own.filter((event) => event.eventType === 'QA_AUTOMATION_ACTION_SELECTED');
  check('every action says why it was chosen', selected.length === 2 && selected.every((event) => event.metadata.method && event.metadata.transitionId && event.metadata.expectedState), JSON.stringify(selected.map((e) => e.metadata)));

  check('nothing forensic was kept for a clean run: no trace', traces(outcome).length === 0);
  check('nothing forensic was kept for a clean run: no anomaly capture', outcome.finalState.stateArtifacts.length === 0);

  const stored = everythingStored(outcome);
  check('the persona password appears nowhere in what was stored', !stored.includes(LMS_USERS.teacher.password));
  check('the persona email appears nowhere in what was stored', !stored.includes(LMS_USERS.teacher.email));

  const report = section(outcome);
  check('the report section validates against its contract', AutomatedRunSectionSchema.safeParse(report).success, JSON.stringify(AutomatedRunSectionSchema.safeParse(report).error?.issues ?? []));
  check('the report says the target was reached', report.outcome.reachedTarget === true && report.outcome.kind === 'SUCCESS');
  check('the report lists the states visited, state by state', JSON.stringify(report.states.map((s) => s.stateKey)) === JSON.stringify(DECLARED), JSON.stringify(report.states.map((s) => s.stateKey)));
  check('the report carries no diagnostics for a clean run', report.codeEvidence.length === 0 && report.retainedTraces.length === 0);
  check('the report names no credentials', !JSON.stringify(report).includes(LMS_USERS.teacher.password));
}

async function markerShapes() {
  scenario = 'the application reports its states in each of the three marker shapes';
  console.log(`\n${scenario}`);
  for (const markers of ['typed', 'slug', 'adapter']) {
    const outcome = await runScenario({ markers });
    check(`${markers} markers: the run reaches the target`, outcome.result.stopReason === 'TERMINAL_STATE_REACHED', `${outcome.result.stopReason}: ${outcome.result.detail}`);
    const evaluated = automationEvents(outcome.events).filter((event) => event.eventType === 'QA_AUTOMATION_STATE_EVALUATED' && event.metadata.recognizedStateKey);
    check(`${markers} markers: every state was recognised with high confidence`, evaluated.length >= 3 && evaluated.every((event) => event.metadata.confidence === 'HIGH'), JSON.stringify(evaluated.map((e) => [e.metadata.recognizedStateKey, e.metadata.confidence])));
    check(`${markers} markers: the application's own signal was a match, not a conflict`, evaluated.every((event) => event.metadata.evidence?.sdk === 'MATCH'), JSON.stringify(evaluated.map((e) => e.metadata.evidence?.sdk)));
  }
  const samples = ['Exam Form', 'exam-form', 'EXAM_FORM', '  exam form  ', 'exam___form', 'Course Details', '', '!!!', 's-form', 'Ünïcode State', 'a1 b2'];
  check('the engine and the boundary evaluator normalise a state key identically', samples.every((sample) => normalizeStateKey(sample) === normalizeQaFlowKey(sample)), JSON.stringify(samples.filter((sample) => normalizeStateKey(sample) !== normalizeQaFlowKey(sample))));
}

async function applicationFailure() {
  scenario = 'the application prevents the step';
  console.log(`\n${scenario}`);
  const outcome = await runScenario({ faults: { saveFails: true } });
  const { result, app } = outcome;
  check('stops because the transition did not advance', result.stopReason === 'TRANSITION_DID_NOT_ADVANCE', `${result.stopReason}: ${result.detail}`);
  check('that is a finding about the application', kindOf(result.stopReason) === 'APPLICATION');
  check('the mutation was not retried', posts(app, '/api/exams').length === 1, `${posts(app, '/api/exams').length} POSTs`);
  check('no exam exists', app.exams.length === 0);

  check('a diagnostic capture was taken while the failing page was still up', outcome.finalState.stateArtifacts.some((artifact) => artifact.captureReason === 'FINDING'));
  const kept = traces(outcome);
  check('a trace was kept for the state where it went wrong', kept.length >= 1, JSON.stringify(fs.readdirSync(outcome.artifactDirectory)));
  if (kept.length > 0) {
    const entries = readZip(fs.readFileSync(path.join(outcome.artifactDirectory, kept[0])));
    const names = entries.map((entry) => entry.name);
    check('the kept trace is marked sanitised', names.includes('tellann-sanitized.json'));
    check('the kept trace carries no screenshots, DOM snapshots or bodies', !names.some((name) => name.startsWith('resources/')));
  }
  const stored = everythingStored(outcome);
  check('the password is absent from the events, the manifest and the trace', !stored.includes(LMS_USERS.teacher.password));
  check('no session cookie value survives in the trace', !/lms_session=[a-f0-9]{16,}/.test(stored));

  const report = section(outcome);
  check('the report says the application prevented the outcome', report.outcome.kind === 'APPLICATION' && report.outcome.reachedTarget === false);
  check('the target is listed as prevented by the application, not merely unattempted', report.unreachedStates.some((s) => s.stateKey === TARGET && s.status === 'BLOCKED_BY_APPLICATION'), JSON.stringify(report.unreachedStates));
  check('the report explains the failing step from the code, by location', report.codeEvidence.some((e) => e.refs.some((r) => r.file === 'src/pages/NewExam.tsx')), JSON.stringify(report.codeEvidence));
  check('the code evidence carries no source text', !JSON.stringify(report.codeEvidence).includes('function '));
  check('the report says where a trace was kept', report.retainedTraces.length >= 1);
  check('reconciliation reads it as an implementation mismatch', classifyAutomatedStateGap(TARGET, { stopReason: result.stopReason, targetTerminalStateKey: TARGET, observedDestinationsByState: new Map() }) === 'IMPLEMENTATION_MISMATCH');
}

async function infrastructureFailure() {
  scenario = 'Tellann\'s own infrastructure fails';
  console.log(`\n${scenario}`);
  const outcome = await runScenario({ crashAfterActs: 3 });
  const { result } = outcome;
  check('stops because the browser went away', result.stopReason === 'BROWSER_CRASHED', `${result.stopReason}: ${result.detail}`);
  check('that is not a finding about the application', kindOf(result.stopReason) === 'INFRASTRUCTURE');
  const report = section(outcome);
  check('the report says so', report.outcome.kind === 'INFRASTRUCTURE');
  check('unreached states are "not attempted", never blamed on the application', report.unreachedStates.length > 0 && report.unreachedStates.every((s) => s.status === 'NOT_ATTEMPTED'), JSON.stringify(report.unreachedStates));
  check('reconciliation draws no conclusion from it', classifyAutomatedStateGap(TARGET, { stopReason: result.stopReason, targetTerminalStateKey: TARGET, observedDestinationsByState: new Map() }) === 'TRUE_GAP');
}

async function loopsAndBudgets() {
  scenario = 'loops and budgets';
  console.log(`\n${scenario}`);
  const loop = await runScenario({ faults: { saveLoopsBack: true }, limits: { maxSteps: 40, maxReplans: 10 } });
  check('a step that goes round in a circle is stopped', ['LOOP_DETECTED', 'MAX_REPLANS_EXCEEDED', 'MAX_STEPS_EXCEEDED'].includes(loop.result.stopReason) && loop.result.stopReason === 'LOOP_DETECTED', `${loop.result.stopReason}: ${loop.result.detail}`);
  check('and did not go on creating exams without limit', loop.app.exams.length <= 4, `${loop.app.exams.length} exams`);

  const budget = await runScenario({ limits: { maxSteps: 1 } });
  check('the step budget stops a run', budget.result.stopReason === 'MAX_STEPS_EXCEEDED', `${budget.result.stopReason}`);
  check('and stopped before the second action', budget.app.exams.length === 0);
}

async function personasAndAccess() {
  scenario = 'personas, roles and credentials';
  console.log(`\n${scenario}`);
  const hidden = await runScenario({ persona: 'student' });
  check('a control the persona is not shown is reported as a declared control not on the page', hidden.result.stopReason === 'EXPECTED_TRANSITION_NOT_FOUND', `${hidden.result.stopReason}: ${hidden.result.detail}`);
  check('the run did not try anything else to get past it', posts(hidden.app, '/api/exams').length === 0);
  check('that is a finding about the application', kindOf(hidden.result.stopReason) === 'APPLICATION');

  const guarded = await runScenario({ persona: 'student', courseRoles: ['TEACHER'] });
  check('a role guard the persona does not satisfy stops the run as authorization', guarded.result.stopReason === 'AUTHORIZATION_BLOCKED', `${guarded.result.stopReason}: ${guarded.result.detail}`);
  check('the run stayed where the guard stopped it, rather than probing', guarded.finalPath === '/dashboard', String(guarded.finalPath));
  check('reconciliation reads it as an authorization mismatch', classifyAutomatedStateGap(TARGET, { stopReason: guarded.result.stopReason, targetTerminalStateKey: TARGET, observedDestinationsByState: new Map() }) === 'AUTHORIZATION_MISMATCH');

  const rejected = await runScenario({ faults: { loginRejects: true } });
  check('credentials the application refuses are an authentication failure', rejected.result.stopReason === 'AUTHENTICATION_FAILED', `${rejected.result.stopReason}: ${rejected.result.detail}`);
  check('the Flow was never started', !automationEvents(rejected.events).some((event) => event.eventType === 'QA_AUTOMATION_PLAN_CREATED'));
  check('the wrong-password attempt did not leak the password either', !everythingStored(rejected).includes(LMS_USERS.teacher.password));

  const missing = await runScenario({ runData: runData([]) });
  check('a run data set without a value the Flow needs stops before touching the application', missing.result.stopReason === 'TEST_DATA_UNAVAILABLE', `${missing.result.stopReason}: ${missing.result.detail}`);
  check('nothing was sent to the application', missing.app.requests.every((request) => request.method === 'GET'), JSON.stringify(missing.app.requests.map((r) => `${r.method} ${r.path}`)));
}

async function boundaries() {
  scenario = 'what an Automated Run is never allowed to be';
  console.log(`\n${scenario}`);
  const production = StartGuidedRunInputSchema.safeParse({
    applicationId: APP_ID, environmentId: '22222222-2222-4222-8222-222222222222', environmentType: 'PRODUCTION', captureTracks: ['FRONTEND'],
    mode: 'AUTOMATED', targetUrl: 'https://app.example.test/', flowId: '44444444-4444-4444-8444-444444444444',
    flowBindingId: '55555555-5555-4555-8555-555555555555', flowInitializationId: '66666666-6666-4666-8666-666666666666',
    flowScanId: '77777777-7777-4777-8777-777777777777', expectedGraphVersionId: '33333333-3333-4333-8333-333333333333',
    automation: { targetTerminalStateKey: TARGET, executionProfileId: 'p' },
  });
  check('the start contract refuses production', production.success === false);

  const observer = new BrowserObserver({ headless: true });
  let refused = false;
  try {
    await observer.start({
      applicationId: APP_ID, environmentId: '22222222-2222-4222-8222-222222222222', workspaceId: null, environmentType: 'PRODUCTION',
      captureTracks: ['FRONTEND'], expectedGraphVersionId: '33333333-3333-4333-8333-333333333333', mode: 'AUTOMATED', targetUrl: 'http://127.0.0.1:1/',
    }, fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-automated-')));
  } catch { refused = true; }
  check('the observer refuses to drive a production application, whatever it is asked', refused);
  check('an automated run cannot be pointed at more than one target', AutomationConfigSchema.safeParse({ targetTerminalStateKey: TARGET, executionProfileId: 'p', targetTerminalStateKeys: [TARGET, 'exam_error'] }).success === false);
  check('and the engine refuses it too, rather than running the first', resolveRunTargets({ targetStateKey: TARGET, targetStateKeys: [TARGET, 'exam_error'] }).ok === false);

  const enabled = (plan) => PLAN_DEFINITIONS[plan].features.find((item) => item.feature === 'AUTOMATED_QA_RUNS')?.enabled === true;
  check('Automated Run is a Business and Enterprise feature', enabled('BUSINESS') && enabled('ENTERPRISE') && !['FREE', 'LOCAL', 'SOLO', 'TEAM'].some(enabled));
}

// ---------------------------------------------------------------------------
// Platform tier
// ---------------------------------------------------------------------------

async function platform() {
  scenario = 'the platform contract';
  console.log(`\n${scenario}`);
  const gateway = process.env.API_GATEWAY_URL ?? 'http://127.0.0.1:3000';
  let reachable = false;
  try {
    await fetch(`${gateway}/applications/${crypto.randomUUID()}/qa-runs`, { method: 'POST', signal: AbortSignal.timeout(3000) });
    reachable = true;
  } catch { /* nothing listening */ }
  if (!reachable) {
    const message = `no gateway at ${gateway}`;
    if (requireServices) { check('the platform is reachable', false, message); return; }
    skipped.push(`platform contract (${message})`);
    console.log(`  SKIPPED  ${message}. Start the services and re-run to prove the API side.`);
    return;
  }

  let prisma;
  try {
    try { process.loadEnvFile?.('.env'); } catch { /* environment already populated */ }
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
    await prisma.$connect();
  } catch (error) {
    const message = `database unavailable (${String(error).split('\n')[0]})`;
    if (requireServices) { check('the database is reachable', false, message); return; }
    skipped.push(`platform contract (${message})`);
    console.log(`  SKIPPED  ${message}.`);
    return;
  }

  const jwt = require('jsonwebtoken');
  const suffix = crypto.randomUUID();
  const created = [];
  try {
    for (const planType of ['TEAM', 'BUSINESS']) {
      const plan = await prisma.plan.findFirst({ where: { type: planType } });
      if (!plan) { skipped.push(`${planType} plan is not seeded`); console.log(`  SKIPPED  ${planType} plan is not seeded`); continue; }
      const user = await prisma.user.create({ data: { email: `automated-${planType.toLowerCase()}-${suffix}@example.test` } });
      const organization = await prisma.organization.create({
        data: {
          name: `Automated acceptance ${planType}`, slug: `automated-${planType.toLowerCase()}-${suffix}`, createdByUserId: user.id,
          memberships: { create: { userId: user.id, role: 'OWNER' } },
          subscription: { create: { planId: plan.id, status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60_000) } },
        },
      });
      const application = await prisma.application.create({ data: { organizationId: organization.id, name: `Automated ${planType}` } });
      const development = await prisma.environment.create({ data: { applicationId: application.id, name: 'Development', type: 'DEVELOPMENT' } });
      const production = await prisma.environment.create({ data: { applicationId: application.id, name: 'Production', type: 'PRODUCTION', baseUrl: 'https://app.example.test' } });
      created.push(organization.id);
      const token = jwt.sign({ sub: user.id, email: user.email }, process.env.ACCEPTANCE_JWT_SECRET || process.env.JWT_SECRET || 'tellann-default-jwt-secret-change-in-production', { expiresIn: '15m' });
      const create = async (environment, targetUrl) => {
        const response = await fetch(`${gateway}/applications/${application.id}/qa-runs`, {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            environmentId: environment.id, mode: 'AUTOMATED', targetUrl,
            flowId: crypto.randomUUID(), flowBindingId: crypto.randomUUID(), flowInitializationId: crypto.randomUUID(), flowScanId: crypto.randomUUID(),
            expectedGraphVersionId: crypto.randomUUID(), automation: { targetTerminalStateKey: TARGET, executionProfileId: 'p' },
          }),
        });
        return { status: response.status, body: await response.json().catch(() => null) };
      };
      const onProduction = await create(production, 'https://app.example.test/');
      check(`${planType}: production is refused for an Automated Run`, onProduction.status === 403 && onProduction.body?.error === 'PRODUCTION_ACTIVE_CONTROL_BLOCKED', JSON.stringify(onProduction));
      const onDevelopment = await create(development, 'http://127.0.0.1:4173/');
      if (planType === 'TEAM') {
        check('TEAM: a plan without the feature is told so', onDevelopment.status === 403 && onDevelopment.body?.error === 'FEATURE_NOT_ENTITLED' && onDevelopment.body?.feature === 'AUTOMATED_QA_RUNS', JSON.stringify(onDevelopment));
      } else {
        check('BUSINESS: the entitlement gate passes (the request goes on to fail on the Flow it names, not on the plan)', onDevelopment.body?.error !== 'FEATURE_NOT_ENTITLED' && onDevelopment.status !== 403, JSON.stringify(onDevelopment));
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log('Automated Run acceptance');
  await cleanRun();
  await markerShapes();
  await applicationFailure();
  await infrastructureFailure();
  await loopsAndBudgets();
  await personasAndAccess();
  await boundaries();
  await platform();

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed${skipped.length ? `; skipped: ${skipped.join('; ')}` : ''}`);
  if (failed.length) {
    console.error(`\nAUTOMATED_ACCEPTANCE_FAILED:\n${failed.map((result) => `  [${result.scenario}] ${result.name}${result.detail ? ` — ${result.detail}` : ''}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ success: true, checks: results.length, skipped }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
