import fs from 'node:fs';
import path from 'node:path';
import { parsePythonModule, type PythonModule } from './structure';

const SKIPPED_DIRECTORIES = new Set([
  '.git', 'node_modules', '.venv', 'venv', 'env', '__pycache__', '.tox', '.nox',
  '.mypy_cache', '.pytest_cache', '.ruff_cache', 'site-packages', 'dist', 'build',
  '.eggs', 'migrations', 'htmlcov', '.idea', '.vscode',
]);

export type ListPythonSourcesOptions = {
  maxFiles?: number;
  maxDepth?: number;
  /** Include `migrations/`, which is skipped by default as generated code. */
  includeMigrations?: boolean;
};

/** Every `.py` file under a directory, repository-relative and slash-separated. */
export function listPythonSourceFiles(root: string, options: ListPythonSourcesOptions = {}): string[] {
  const maxFiles = options.maxFiles ?? 20_000;
  const maxDepth = options.maxDepth ?? 12;
  const files: string[] = [];

  const visit = (directory: string, depth: number) => {
    if (files.length >= maxFiles || depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name) && !(options.includeMigrations && entry.name === 'migrations')) continue;
        if (entry.name.startsWith('.')) continue;
        visit(path.join(directory, entry.name), depth + 1);
        continue;
      }
      if (!entry.isFile() || !/\.pyi?$/.test(entry.name)) continue;
      files.push(path.relative(root, path.join(directory, entry.name)).replaceAll('\\', '/'));
    }
  };

  visit(root, 0);
  return files.sort();
}

export type PythonEntryPointKind =
  | 'django-settings' | 'django-urls' | 'django-asgi' | 'django-wsgi' | 'django-manage'
  | 'flask-app' | 'flask-factory' | 'fastapi-app' | 'starlette-app' | 'celery-app';

export type PythonEntryPoint = {
  /** Project-relative, forward-slashed. */
  file: string;
  /** The application object's name, when the entry point is an object. */
  symbol: string | null;
  kind: PythonEntryPointKind;
  confidence: number;
  line: number;
  /**
   * Line after which an initialization statement can be inserted at module
   * level. For an app object this is the end of its assignment; for a settings
   * module it is the end of the file.
   */
  insertAfterLine: number;
};

const APP_CONSTRUCTORS: Array<{ callee: RegExp; kind: PythonEntryPointKind; confidence: number }> = [
  { callee: /(^|\.)FastAPI$/, kind: 'fastapi-app', confidence: 0.98 },
  { callee: /(^|\.)Flask$/, kind: 'flask-app', confidence: 0.98 },
  { callee: /(^|\.)Starlette$/, kind: 'starlette-app', confidence: 0.95 },
  { callee: /(^|\.)Celery$/, kind: 'celery-app', confidence: 0.9 },
];

function readModule(absolute: string, relative: string): PythonModule | null {
  try {
    const source = fs.readFileSync(absolute, 'utf8');
    if (source.length > 2_000_000) return null;
    return parsePythonModule(source, relative);
  } catch {
    return null;
  }
}

/**
 * Where instrumentation for a Python project has to attach.
 *
 * Django is found by its settings module rather than by an application object,
 * because that is the only module guaranteed to be imported exactly once per
 * process regardless of whether the project runs under WSGI, ASGI, `manage.py`
 * or a Celery worker. Flask, FastAPI and Starlette are found by the assignment
 * that constructs the application, which is the object their middleware has to
 * be attached to.
 */
export function findPythonEntryPoints(projectDirectory: string, files?: string[]): PythonEntryPoint[] {
  const sources = files ?? listPythonSourceFiles(projectDirectory);
  const entryPoints: PythonEntryPoint[] = [];

  for (const relative of sources) {
    const base = path.posix.basename(relative);
    const absolute = path.join(projectDirectory, relative.replaceAll('/', path.sep));

    if (base === 'manage.py') {
      entryPoints.push({ file: relative, symbol: null, kind: 'django-manage', confidence: 0.95, line: 1, insertAfterLine: 1 });
      continue;
    }

    const djangoModule = base === 'settings.py' ? 'django-settings'
      : base === 'asgi.py' ? 'django-asgi'
      : base === 'wsgi.py' ? 'django-wsgi'
      : base === 'urls.py' ? 'django-urls'
      : null;

    const parsed = readModule(absolute, relative);
    if (!parsed) continue;

    if (djangoModule) {
      const isDjango = djangoModule === 'django-settings'
        ? parsed.assignments.some((assignment) => ['INSTALLED_APPS', 'MIDDLEWARE', 'ROOT_URLCONF', 'MIDDLEWARE_CLASSES'].includes(assignment.target))
        : parsed.imports.some((item) => (item.module ?? '').startsWith('django'))
          || parsed.calls.some((call) => /get_(asgi|wsgi)_application$/.test(call.callee) || /^(path|re_path|include)$/.test(call.callee));
      if (isDjango) {
        entryPoints.push({
          file: relative,
          symbol: null,
          kind: djangoModule,
          confidence: djangoModule === 'django-settings' ? 0.98 : 0.9,
          line: 1,
          insertAfterLine: parsed.lineCount,
        });
      }
    }

    for (const assignment of parsed.assignments) {
      if (assignment.scope.kind !== 'module' && assignment.scope.kind !== 'function') continue;
      const constructor = assignment.calls.find((call) =>
        APP_CONSTRUCTORS.some((candidate) => candidate.callee.test(call.callee)));
      if (!constructor) continue;
      const match = APP_CONSTRUCTORS.find((candidate) => candidate.callee.test(constructor.callee));
      if (!match) continue;
      // `app = Flask(__name__)` inside a function is the factory pattern; the
      // object is local, so the instrumenter attaches inside the factory.
      const insideFactory = assignment.scope.kind === 'function';
      entryPoints.push({
        file: relative,
        symbol: assignment.target.trim(),
        kind: insideFactory && match.kind === 'flask-app' ? 'flask-factory' : match.kind,
        confidence: insideFactory ? match.confidence - 0.08 : match.confidence,
        line: assignment.line,
        // The end of the statement, not its start: `app = FastAPI(` may open a
        // call that runs over several lines, and inserting at the start line
        // would put the instrumentation inside the argument list.
        insertAfterLine: assignment.endLine,
      });
    }
  }

  return entryPoints.sort((left, right) => right.confidence - left.confidence);
}

/** The best entry point for a given framework, or null when there is none. */
export function primaryEntryPoint(
  entryPoints: PythonEntryPoint[],
  kinds: PythonEntryPointKind[],
): PythonEntryPoint | null {
  const ranked = entryPoints.filter((item) => kinds.includes(item.kind));
  if (!ranked.length) return null;
  // Shallower files win ties: `app/main.py` is the application, `app/tests/fixtures.py` is not.
  return ranked.sort((left, right) =>
    right.confidence - left.confidence
    || left.file.split('/').length - right.file.split('/').length
    || (left.file < right.file ? -1 : 1))[0];
}
