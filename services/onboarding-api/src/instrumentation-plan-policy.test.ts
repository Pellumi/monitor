import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePlanPolicy } from './instrumentation-routes';
import type { InstrumentationPlan } from '@tellann/desktop-contracts';

/**
 * The server's own check on a plan a desktop agent proposes. These cases need
 * no database: the policy is a pure function of the plan.
 */

type Command = InstrumentationPlan['validationCommands'][number];

const PYTHON_ENVIRONMENT_KEYS = [
  'CI', 'PATH', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
  'HOME', 'VIRTUAL_ENV', 'CONDA_PREFIX', 'PYTHONPATH', 'PYTHONHOME', 'PIP_INDEX_URL',
  'POETRY_HOME', 'UV_CACHE_DIR', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
];

function command(overrides: Partial<Command>): Command {
  return {
    id: 'install-sdk',
    executable: 'python',
    args: ['-m', 'pip', 'install', 'tellann>=0.1,<1'],
    cwd: '.',
    timeoutMs: 60_000,
    allowedEnvironmentKeys: PYTHON_ENVIRONMENT_KEYS,
    purpose: 'Install tellann',
    networkRequired: true,
    ...overrides,
  } as Command;
}

/** What the Python adapter proposes for a Django project, in plan shape. */
function pythonPlan(overrides: Partial<InstrumentationPlan> = {}): InstrumentationPlan {
  return {
    contractVersion: '1.0', manifestVersion: '1.0',
    id: '00000000-0000-4000-8000-000000000001', taskKey: 'a'.repeat(64),
    adapterId: 'django', adapterVersion: '1.0.0', frameworkVersion: '4.2.16',
    supportedVersionRange: '>=3.2,<6',
    baseRevision: null, repositoryFingerprint: 'a'.repeat(64),
    approvedFileScopes: ['requirements.txt', 'tellann_instrumentation.py', 'billing/settings.py'],
    packageChanges: [{ packageName: 'tellann', version: '>=0.1,<1', kind: 'dependency' }],
    operations: [
      { id: 'package-sdk', kind: 'UPDATE_PACKAGE', relativePath: 'requirements.txt', symbol: 'tellann', transformId: 'tellann.python.dependency', transformVersion: '1.0.0', expectedHash: 'b'.repeat(64), description: 'Declare the SDK', eventMappings: [] },
      { id: 'generated-config', kind: 'CREATE_FILE', relativePath: 'tellann_instrumentation.py', symbol: null, transformId: 'tellann.generated.config', transformVersion: '1.0.0', expectedHash: null, description: 'Create the config module', eventMappings: [] },
      { id: 'entry-import', kind: 'UPDATE_SOURCE', relativePath: 'billing/settings.py', symbol: null, transformId: 'tellann.python.entry', transformVersion: '1.0.0', expectedHash: 'c'.repeat(64), description: 'Register the middleware', eventMappings: [] },
    ],
    validationCommands: [
      command({}),
      command({ id: 'compile-check', args: ['-m', 'compileall', '-q', '.'], networkRequired: false, purpose: 'Check syntax' }),
    ],
    networkRequirements: ['Package index access'], risk: 'LOW', riskReasons: ['Bounded'],
    evidence: { entryPoints: [], existingInstrumentation: [], semanticBoundaries: [] },
    createdAt: new Date().toISOString(),
    ...overrides,
  } as InstrumentationPlan;
}

test('a Django plan installing the PyPI distribution is approved', () => {
  // Judged against the npm allowlist this returned UNAPPROVED_INSTRUMENTATION_PACKAGE,
  // which stopped every Python project at the first step of setup.
  assert.equal(validatePlanPolicy(pythonPlan()), null);
});

test('every Python package manager the adapter can emit is approved', () => {
  const shapes: Array<[string, string[]]> = [
    ['python', ['-m', 'pip', 'install', 'tellann>=0.1,<1']],
    ['python3', ['-m', 'pip', 'install', 'tellann>=0.1,<1']],
    ['poetry', ['add', 'tellann>=0.1,<1']],
    ['uv', ['add', 'tellann>=0.1,<1']],
    ['pdm', ['add', 'tellann>=0.1,<1']],
    ['pipenv', ['install', 'tellann>=0.1,<1']],
  ];
  for (const [executable, args] of shapes) {
    const plan = pythonPlan({ validationCommands: [command({ executable, args })] });
    assert.equal(validatePlanPolicy(plan), null, `${executable} ${args.join(' ')} should be approved`);
  }
});

test('a Python plan is scoped to a subdirectory, as a backend beside a web app is', () => {
  const plan = pythonPlan({
    approvedFileScopes: ['backend/requirements.txt', 'backend/tellann_instrumentation.py'],
    operations: pythonPlan().operations.slice(0, 2).map((operation, index) => ({
      ...operation,
      relativePath: index === 0 ? 'backend/requirements.txt' : 'backend/tellann_instrumentation.py',
    })),
    validationCommands: [command({ cwd: 'backend' })],
  });
  assert.equal(validatePlanPolicy(plan), null);
});

test('a Python plan may not install anything but the SDK', () => {
  assert.equal(
    validatePlanPolicy(pythonPlan({ packageChanges: [{ packageName: 'requests', version: '*', kind: 'dependency' }] })),
    'UNAPPROVED_INSTRUMENTATION_PACKAGE',
  );
  // The verb alone is not enough: pip takes a path, a URL or a second
  // requirement as an ordinary argument.
  for (const requirement of [
    'requests',
    'tellann',
    './evil',
    'https://example.com/evil.whl',
    'tellann>=0.1 requests',
    '--index-url=https://example.com',
    'tellann;requests',
  ]) {
    const plan = pythonPlan({
      validationCommands: [command({ args: ['-m', 'pip', 'install', requirement] })],
    });
    assert.equal(
      validatePlanPolicy(plan),
      'UNAPPROVED_INSTRUMENTATION_COMMAND',
      `${requirement} should be refused`,
    );
  }
});

test('a Python plan may not run an arbitrary interpreter command', () => {
  for (const args of [
    ['-c', 'import os; os.system("id")'],
    ['-m', 'http.server'],
    ['manage.py', 'migrate'],
    ['-m', 'compileall', '-q', '..'],
  ]) {
    const plan = pythonPlan({
      validationCommands: [command({ id: 'compile-check', args, networkRequired: false })],
    });
    assert.equal(validatePlanPolicy(plan), 'UNAPPROVED_INSTRUMENTATION_COMMAND', args.join(' '));
  }
});

test('a Python plan may not reach for a shell or an unlisted environment key', () => {
  assert.equal(
    validatePlanPolicy(pythonPlan({ validationCommands: [command({ executable: 'powershell.exe' })] })),
    'UNAPPROVED_INSTRUMENTATION_COMMAND',
  );
  assert.equal(
    validatePlanPolicy(pythonPlan({
      validationCommands: [command({ allowedEnvironmentKeys: [...PYTHON_ENVIRONMENT_KEYS, 'AWS_SECRET_ACCESS_KEY'] })],
    })),
    'UNAPPROVED_INSTRUMENTATION_ENVIRONMENT',
  );
});

test('the two runtimes do not borrow each other\'s allowances', () => {
  // A JavaScript plan cannot install the Python distribution...
  const javascript = pythonPlan({
    adapterId: 'react-vite',
    approvedFileScopes: ['package.json'],
    operations: [{ ...pythonPlan().operations[0]!, relativePath: 'package.json' }],
  });
  assert.equal(validatePlanPolicy(javascript), 'UNAPPROVED_INSTRUMENTATION_PACKAGE');

  // ...and a Python plan cannot install the npm SDK.
  const python = pythonPlan({
    packageChanges: [{ packageName: '@tellann/backend-sdk', version: '^0.1.0', kind: 'dependency' }],
  });
  assert.equal(validatePlanPolicy(python), 'UNAPPROVED_INSTRUMENTATION_PACKAGE');
});

test('an unknown adapter is still refused outright', () => {
  assert.equal(
    validatePlanPolicy(pythonPlan({ adapterId: 'rails' as InstrumentationPlan['adapterId'] })),
    'UNSUPPORTED_INSTRUMENTATION_ADAPTER',
  );
});
