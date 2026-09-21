import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createApprovalHash, detectAdapters, getAdapter, type LocalProjectContext } from './index';

const NEWLINE = '\n';

function pythonFixture(files: Record<string, string>): LocalProjectContext {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-python-adapter-')));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return {
    workspaceRoot: root,
    environmentType: 'DEVELOPMENT',
    snapshot: {
      workspaceId: '00000000-0000-4000-8000-000000000001',
      revision: null,
      branch: null,
      dirty: true,
      repositoryFingerprint: 'b'.repeat(64),
      languages: ['.py'],
      packageManager: 'pip',
      frameworks: [],
      routes: [],
      endpoints: [],
      documentation: [],
      manifestHashes: {},
      scannerVersion: 'test',
      redactionSummary: { excludedFiles: 0, suspectedSecrets: 0 },
    },
  };
}

function approvedTask(plan: Awaited<ReturnType<ReturnType<typeof getAdapter>['propose']>>) {
  return {
    plan,
    approvedFileScopes: plan.approvedFileScopes,
    approvedCommandIds: [],
    approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []),
    checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-python-checkpoint-')),
  };
}

/** The interpreter to run the generated module with, or null when there is none. */
function pythonInterpreter(): string | null {
  for (const candidate of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    const probe = spawnSync(candidate, ['-c', 'pass'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

function runPython(
  interpreter: string,
  cwd: string,
  script: string,
  environment: Record<string, string>,
): string {
  // A clean slate: an inherited TELLANN_* variable from the developer's own
  // shell would decide the outcome of the very thing under test.
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('TELLANN_')),
  ) as Record<string, string>;
  const result = spawnSync(interpreter, [script], {
    cwd,
    encoding: 'utf8',
    env: { ...inherited, ...environment, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert.equal(result.status, 0, `python exited ${result.status}: ${result.stderr}`);
  return result.stdout.trim();
}

function read(context: LocalProjectContext, relative: string): string {
  return fs.readFileSync(path.join(context.workspaceRoot, ...relative.split('/')), 'utf8');
}

const DJANGO_FIXTURE = {
  'requirements.txt': `Django>=4.2,<6${NEWLINE}gunicorn==22.0.0${NEWLINE}`,
  'manage.py': `import os${NEWLINE}${NEWLINE}os.environ.setdefault("DJANGO_SETTINGS_MODULE", "billing.settings")${NEWLINE}`,
  'billing/__init__.py': '',
  'billing/settings.py': [
    'from pathlib import Path',
    '',
    'BASE_DIR = Path(__file__).resolve().parent.parent',
    'INSTALLED_APPS = [',
    '    "django.contrib.admin",',
    ']',
    'MIDDLEWARE = [',
    '    "django.middleware.security.SecurityMiddleware",',
    ']',
    'ROOT_URLCONF = "billing.urls"',
  ].join(NEWLINE),
  'billing/views.py': [
    'def checkout(request):',
    '    """Take payment for the basket."""',
    '    return None',
  ].join(NEWLINE),
};

const FASTAPI_FIXTURE = {
  'pyproject.toml': [
    '[project]',
    'name = "api"',
    'requires-python = ">=3.11"',
    'dependencies = [',
    '  "fastapi>=0.110",',
    '  "uvicorn[standard]",',
    ']',
  ].join(NEWLINE),
  'app/__init__.py': '',
  'app/main.py': [
    'from fastapi import FastAPI',
    '',
    'app = FastAPI(',
    '    title="Billing",',
    ')',
    '',
    '@app.get("/health")',
    'async def health():',
    '    return "ok"',
  ].join(NEWLINE),
};

const FLASK_FIXTURE = {
  'Pipfile': `[packages]${NEWLINE}flask = "==3.0.3"${NEWLINE}`,
  'shop/__init__.py': [
    'from flask import Flask',
    '',
    '',
    'def create_app():',
    '    app = Flask(__name__)',
    '    return app',
  ].join(NEWLINE),
};

test('Django, FastAPI and Flask fixtures are detected by their own adapter', () => {
  for (const [id, files] of [
    ['django', DJANGO_FIXTURE],
    ['fastapi', FASTAPI_FIXTURE],
    ['flask', FLASK_FIXTURE],
  ] as const) {
    const context = pythonFixture(files);
    const detected = detectAdapters(context).find((item) => item.adapterId === id);
    assert.equal(detected?.supported, true, `${id} should be supported`);
    assert.ok(detected!.evidence.length > 0, `${id} should report evidence`);
    fs.rmSync(context.workspaceRoot, { recursive: true, force: true });
  }
});

test('a Django version outside the supported range is detected but refused', async () => {
  const context = pythonFixture({ ...DJANGO_FIXTURE, 'requirements.txt': `Django==2.2.28${NEWLINE}` });
  const detected = detectAdapters(context).find((item) => item.adapterId === 'django');
  assert.equal(detected?.supported, false);
  assert.equal(detected?.frameworkVersion, '2.2.28');
  assert.match(detected!.reasons.join(' '), /outside >=3\.2,<6/);
  await assert.rejects(getAdapter('django').propose(context), /UNSUPPORTED_FRAMEWORK_VERSION/);
  fs.rmSync(context.workspaceRoot, { recursive: true, force: true });
});

test('Django instrumentation adds the dependency, the module and the middleware, and rolls back', async () => {
  const context = pythonFixture(DJANGO_FIXTURE);
  fs.writeFileSync(path.join(context.workspaceRoot, 'untouched.txt'), 'preserve me');
  const adapter = getAdapter('django');

  const plan = await adapter.propose(context);
  assert.deepEqual(new Set(plan.approvedFileScopes), new Set([
    'requirements.txt', 'tellann_instrumentation.py', 'billing/settings.py',
  ]));
  assert.deepEqual(plan.packageChanges, [{ packageName: 'tellann', version: '>=0.1,<1', kind: 'dependency' }]);
  assert.ok(plan.validationCommands.some((command) => command.id === 'compile-check'));

  const result = await adapter.apply(context, approvedTask(plan));
  assert.deepEqual(new Set(result.changedFiles), new Set([
    'requirements.txt', 'tellann_instrumentation.py', 'billing/settings.py',
  ]));

  const requirements = read(context, 'requirements.txt');
  assert.match(requirements, /^tellann>=0\.1,<1$/m);
  assert.match(requirements, /^Django>=4\.2,<6$/m, 'existing pins are preserved');

  const settings = read(context, 'billing/settings.py');
  assert.match(settings, /from tellann_instrumentation import MIDDLEWARE_PATH as TELLANN_MIDDLEWARE/);
  assert.match(settings, /MIDDLEWARE = \[\*_tellann_existing_middleware, TELLANN_MIDDLEWARE\]/);
  assert.match(settings, /ROOT_URLCONF = "billing\.urls"/, 'the original settings are preserved');

  const generated = read(context, 'tellann_instrumentation.py');
  assert.match(generated, /from tellann import TELLANN/);
  assert.match(generated, /tellann\.integrations\.django_middleware\.TellannMiddleware/);

  const validation = await adapter.validate(context, result);
  assert.equal(validation.valid, true, JSON.stringify(validation.checks.filter((check) => !check.passed)));

  const rollback = await adapter.rollback(context, result);
  assert.equal(rollback.verified, true);
  assert.equal(fs.existsSync(path.join(context.workspaceRoot, 'tellann_instrumentation.py')), false);
  assert.doesNotMatch(read(context, 'billing/settings.py'), /tellann/i);
  assert.doesNotMatch(read(context, 'requirements.txt'), /tellann/i);
  assert.equal(read(context, 'untouched.txt'), 'preserve me');

  fs.rmSync(context.workspaceRoot, { recursive: true, force: true });
});

test('FastAPI instrumentation attaches after a multi-line application constructor', async () => {
  const context = pythonFixture(FASTAPI_FIXTURE);
  const adapter = getAdapter('fastapi');

  const plan = await adapter.propose(context);
  assert.ok(plan.approvedFileScopes.includes('pyproject.toml'));
  const result = await adapter.apply(context, approvedTask(plan));

  const main = read(context, 'app/main.py');
  const lines = main.split(NEWLINE);
  const closing = lines.findIndex((line) => line.trim() === ')');
  const attach = lines.findIndex((line) => line.includes('tellann_instrument(app)'));
  assert.ok(closing >= 0 && attach > closing, 'the call is inserted after the constructor closes, not inside it');
  assert.match(main, /@app\.get\("\/health"\)/, 'the route is untouched');

  const pyproject = read(context, 'pyproject.toml');
  assert.match(pyproject, /"tellann>=0\.1,<1",/);
  assert.match(pyproject, /"fastapi>=0\.110",/, 'existing dependencies are preserved');
  assert.match(pyproject, /requires-python = ">=3\.11"/);

  const validation = await adapter.validate(context, result);
  assert.equal(validation.valid, true, JSON.stringify(validation.checks.filter((check) => !check.passed)));

  fs.rmSync(context.workspaceRoot, { recursive: true, force: true });
});

test('a Flask application factory is instrumented inside the factory, at its own indentation', async () => {
  const context = pythonFixture(FLASK_FIXTURE);
  const adapter = getAdapter('flask');

  const plan = await adapter.propose(context);
  const result = await adapter.apply(context, approvedTask(plan));

  const source = read(context, 'shop/__init__.py');
  const attach = source.split(NEWLINE).find((line) => line.includes('tellann_instrument(app)'));
  assert.ok(attach, 'the factory is instrumented');
  assert.match(attach!, /^ {4}tellann_instrument\(app\)$/, 'the call keeps the factory body indentation');
  assert.match(source, /return app/, 'the factory still returns its application');

  const pipfile = read(context, 'Pipfile');
  assert.match(pipfile, /tellann = ">=0\.1,<1"/);
  assert.match(pipfile, /flask = "==3\.0\.3"/);

  assert.equal((await adapter.validate(context, result)).valid, true);
  fs.rmSync(context.workspaceRoot, { recursive: true, force: true });
});

test('applying an already-instrumented project does not duplicate the integration', async () => {
  const context = pythonFixture(DJANGO_FIXTURE);
  const adapter = getAdapter('django');

  const first = await adapter.apply(context, approvedTask(await adapter.propose(context)));
  assert.equal(first.changedFiles.length, 3);

  const second = await adapter.apply(context, approvedTask(await adapter.propose(context)));
  assert.deepEqual(second.changedFiles, [], 'a second apply writes nothing');

  const settings = read(context, 'billing/settings.py');
  assert.equal(settings.split('tellann:generated:start').length - 1, 1);
  assert.equal(read(context, 'requirements.txt').split('tellann>=').length - 1, 1);

  assert.equal((await adapter.validate(context, second)).valid, true);
  fs.rmSync(context.workspaceRoot, { recursive: true, force: true });
});

test('instrumentation is refused for a production environment and for an unapproved file', async () => {
  const context = pythonFixture(DJANGO_FIXTURE);
  const adapter = getAdapter('django');
  const plan = await adapter.propose(context);

  await assert.rejects(
    adapter.propose({ ...context, environmentType: 'PRODUCTION' }),
    /PRODUCTION_OBSERVATION_ONLY/,
  );
  await assert.rejects(
    adapter.apply({ ...context, environmentType: 'PRODUCTION' }, approvedTask(plan)),
    /PRODUCTION_OBSERVATION_ONLY/,
  );

  const narrowed = ['requirements.txt'];
  await assert.rejects(
    adapter.apply(context, {
      plan,
      approvedFileScopes: narrowed,
      approvedCommandIds: [],
      approvalHash: createApprovalHash(plan, narrowed, []),
      checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-python-checkpoint-')),
    }),
    /TASK_SCOPE_EXPANSION_DENIED/,
  );

  // Nothing was written by either refusal.
  assert.equal(fs.existsSync(path.join(context.workspaceRoot, 'tellann_instrumentation.py')), false);
  assert.doesNotMatch(read(context, 'requirements.txt'), /tellann/i);
  fs.rmSync(context.workspaceRoot, { recursive: true, force: true });
});

test('a Flow checkpoint is inserted after the docstring and refuses placements it cannot honour', async () => {
  const context = pythonFixture(DJANGO_FIXTURE);
  const adapter = getAdapter('django');

  const flowContext: LocalProjectContext = {
    ...context,
    instrumentationPurpose: 'FLOW',
    flowId: '00000000-0000-4000-8000-0000000000f1',
    flowVersionId: '00000000-0000-4000-8000-0000000000f2',
    flowInitializationId: '00000000-0000-4000-8000-0000000000f3',
    flowManifest: {
      version: '2.0',
      checkpoints: [{
        id: 'cp-checkout',
        eventType: 'FLOW_STATE_REACHED',
        expectedState: 'CHECKOUT',
        stateId: 'state-checkout',
        transitionId: null,
        terminalKind: null,
        mapping: {
          file: 'billing/views.py',
          symbol: 'checkout',
          placementKind: 'FUNCTION_ENTRY',
        },
      }],
    } as unknown as LocalProjectContext['flowManifest'],
  };

  const plan = await adapter.propose(flowContext);
  assert.ok(plan.approvedFileScopes.includes('billing/views.py'));
  const result = await adapter.apply(flowContext, approvedTask(plan));

  const views = read(context, 'billing/views.py').split(NEWLINE);
  const docstring = views.findIndex((line) => line.includes('Take payment'));
  const call = views.findIndex((line) => line.includes('tellann_checkpoint('));
  assert.ok(docstring >= 0 && call > docstring, 'the checkpoint is inserted after the docstring');
  assert.match(views[call], /tellann_checkpoint\("cp-checkout", event_type="FLOW_STATE_REACHED", state_id="state-checkout", flow_initialization_id="00000000-0000-4000-8000-0000000000f3"\)\s+# tellann:checkpoint:cp-checkout/);
  assert.match(read(context, 'billing/views.py'), /from tellann_instrumentation import checkpoint as tellann_checkpoint/);

  assert.equal((await adapter.validate(flowContext, result)).valid, true);

  // A placement that belongs to a TypeScript syntax tree is refused outright
  // rather than guessed at.
  const unsupported: LocalProjectContext = {
    ...flowContext,
    flowManifest: {
      version: '2.0',
      checkpoints: [{
        ...(flowContext.flowManifest as any).checkpoints[0],
        mapping: { file: 'billing/views.py', symbol: 'checkout', placementKind: 'COMPONENT_MOUNT' },
      }],
    } as unknown as LocalProjectContext['flowManifest'],
  };
  await assert.rejects(adapter.propose(unsupported), /UNSUPPORTED_FLOW_CHECKPOINT_PLACEMENT/);

  fs.rmSync(context.workspaceRoot, { recursive: true, force: true });
});

test('the generated module reads Tellann settings from the environment file beside it', async () => {
  // Vite and Next load `.env.local` for the JavaScript adapters. Python has no
  // equivalent, so a server the developer starts by hand saw none of the
  // credentials Tellann had just written, and the SDK came up against a
  // placeholder application id instead of disabling itself.
  const context = pythonFixture(DJANGO_FIXTURE);
  const adapter = getAdapter('django');
  const plan = await adapter.propose(context);
  await adapter.apply(context, approvedTask(plan));

  const generated = read(context, 'tellann_instrumentation.py');
  assert.match(generated, /ENVIRONMENT_FILES = \("\.env\.local", "\.env"\)/);
  assert.match(generated, /_load_environment_files\(\)/);
  // Only Tellann's own keys are loaded; this is not a dotenv implementation for
  // the whole application.
  assert.match(generated, /ENVIRONMENT_PREFIX = "TELLANN_"/);
  assert.match(generated, /if not key\.startswith\(ENVIRONMENT_PREFIX\) or key in os\.environ:/);
  // An id that is not the real one looks like a working install while every
  // event lands against the wrong application.
  assert.doesNotMatch(generated, /configure-in-tellann-desktop/);
  assert.match(generated, /APPLICATION_ID = os\.environ\.get\("TELLANN_APPLICATION_ID"\)/);
  assert.match(generated, /if not APPLICATION_ID:/);

  fs.rmSync(context.workspaceRoot, { recursive: true, force: true });
});

test('the generated module loads .env.local, prefers the real environment, and disables itself unconfigured', async (t) => {
  const python = pythonInterpreter();
  if (!python) return t.skip('no Python interpreter on PATH');

  const context = pythonFixture(DJANGO_FIXTURE);
  const adapter = getAdapter('django');
  await adapter.apply(context, approvedTask(await adapter.propose(context)));

  // A stub package stands in for the installed SDK: the module under test is
  // the generated one, not the wheel.
  const stub = path.join(context.workspaceRoot, 'tellann');
  fs.mkdirSync(stub, { recursive: true });
  fs.writeFileSync(path.join(stub, '__init__.py'), [
    'class _Stub:',
    '    def __init__(self):',
    '        self.config = None',
    '    def is_initialized(self):',
    '        return self.config is not None',
    '    def initialize(self, **kwargs):',
    '        self.config = kwargs',
    '    def verify_installation(self):',
    '        pass',
    '',
    'TELLANN = _Stub()',
    '',
  ].join(NEWLINE));

  fs.writeFileSync(path.join(context.workspaceRoot, '.env.local'), [
    '# written by Tellann',
    'TELLANN_GATEWAY_URL=https://gateway.example.com',
    'TELLANN_APPLICATION_ID=app-from-file',
    'TELLANN_ENVIRONMENT_ID="env-from-file"',
    "TELLANN_INGESTION_KEY='key-from-file'",
    'DJANGO_SETTINGS_MODULE=should-not-be-loaded',
    '',
  ].join(NEWLINE));

  const probe = [
    'import json, os, sys',
    'sys.path.insert(0, os.getcwd())',
    'import tellann_instrumentation as generated',
    'from tellann import TELLANN',
    'print(json.dumps({',
    '    "config": TELLANN.config,',
    '    "django": os.environ.get("DJANGO_SETTINGS_MODULE"),',
    '}))',
    '',
  ].join(NEWLINE);
  fs.writeFileSync(path.join(context.workspaceRoot, 'probe.py'), probe);

  const fromFile = JSON.parse(runPython(python, context.workspaceRoot, 'probe.py', {}));
  assert.equal(fromFile.config.application_id, 'app-from-file');
  assert.equal(fromFile.config.endpoint, 'https://gateway.example.com');
  assert.equal(fromFile.config.environment_id, 'env-from-file', 'double quotes are stripped');
  assert.equal(fromFile.config.api_key, 'key-from-file', 'single quotes are stripped');
  assert.equal(fromFile.django, null, 'a non-Tellann key in the file is not loaded');

  // A real environment variable - what Tellann injects when it launches the
  // app itself, and what a deployment sets - always wins over the file.
  const fromEnvironment = JSON.parse(runPython(python, context.workspaceRoot, 'probe.py', {
    TELLANN_APPLICATION_ID: 'app-from-environment',
    TELLANN_RUN_ID: 'run-7',
    TELLANN_SESSION_ID: 'session-7',
    TELLANN_TRACE_ID: 'trace-7',
  }));
  assert.equal(fromEnvironment.config.application_id, 'app-from-environment');
  assert.equal(fromEnvironment.config.run_id, 'run-7');
  assert.equal(fromEnvironment.config.session_id, 'session-7');
  assert.equal(fromEnvironment.config.trace_id, 'trace-7');

  // With neither, the SDK stays off rather than reporting to a placeholder.
  fs.rmSync(path.join(context.workspaceRoot, '.env.local'));
  const unconfigured = JSON.parse(runPython(python, context.workspaceRoot, 'probe.py', {}));
  assert.equal(unconfigured.config, null);

  fs.rmSync(context.workspaceRoot, { recursive: true, force: true });
});
