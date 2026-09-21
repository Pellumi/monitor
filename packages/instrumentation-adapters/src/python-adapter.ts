import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveWithinWorkspace } from '@tellann/agent-policy';
import {
  detectPythonFrameworks,
  discoverPythonProjects,
  findPythonEntryPoints,
  listPythonSourceFiles,
  parsePythonModule,
  primaryEntryPoint,
  pythonInstallCommand,
  satisfiesPythonSpecifier,
  type PythonEntryPoint,
  type PythonEntryPointKind,
  type PythonModule,
  type PythonNode,
  type PythonProject,
} from '@tellann/python-project';
import {
  calculateFlowAnchorHash,
  fileHash,
  hash,
  INSTRUMENTATION_CONTRACT_VERSION,
  INSTRUMENTATION_MANIFEST_VERSION,
  type AdapterEvidence,
  type ApprovedInstrumentationTask,
  type DetectionResult,
  type FrameworkId,
  type InstrumentationAdapter,
  type InstrumentationPlan,
  type LocalProjectContext,
  type PatchOperation,
  type PatchResult,
  type RollbackResult,
  type StructuredCommand,
  type ValidationResult,
} from './contracts';
import { beginPatch, finalizePatch, hashChecks, restorePatch, rollbackPatch } from './patching';

/**
 * Instrumentation for Python web frameworks.
 *
 * The contract is the one every adapter honours - detect, index, propose,
 * apply, validate, rollback - and the safety envelope is the shared one in
 * `patching.ts`. What is specific to Python is how each step is carried out:
 * a dependency is declared in a manifest that might be any of four formats, a
 * module is generated as `tellann_instrumentation.py`, and an integration is
 * installed by editing the one module the framework is guaranteed to import
 * once per process.
 *
 * Source is modified through the structure reader in `@tellann/python-project`
 * rather than by regular expression, so an insertion lands after a multi-line
 * call's closing bracket and after a function's docstring, which is where
 * those two constructs would otherwise silently break.
 */

/** Distribution installed into the user's project. */
export const PYTHON_SDK_DISTRIBUTION = 'tellann';

/**
 * The pin written into the project's manifest.
 *
 * A range rather than `latest`, because Python manifests are read by resolvers
 * that have no notion of a floating tag, and an unpinned dependency in a
 * `requirements.txt` is a reproducibility problem the user did not ask for.
 */
export const PYTHON_SDK_SPECIFIER = '>=0.1,<1';

/** The module the adapter generates, at the Python project's root. */
const GENERATED_MODULE = 'tellann_instrumentation.py';

const GENERATED_START = '# tellann:generated:start';
const GENERATED_END = '# tellann:generated:end';

export type PythonAdapterDefinition = {
  id: Extract<FrameworkId, 'django' | 'flask' | 'fastapi' | 'starlette'>;
  label: string;
  /** PEP 503 normalized distribution that proves the framework is present. */
  distribution: string;
  supportedVersionRange: string;
  /** Entry-point kinds this adapter can attach to, most preferred first. */
  entryKinds: PythonEntryPointKind[];
  /** Helper exported by `tellann.integrations` for this framework. */
  integration: string;
};

export const PYTHON_DEFINITIONS: PythonAdapterDefinition[] = [
  {
    id: 'django',
    label: 'Django',
    distribution: 'django',
    supportedVersionRange: '>=3.2,<6',
    // The settings module, not `manage.py`: settings is the only module every
    // Django process imports exactly once, whether it was started by
    // `runserver`, by Gunicorn under WSGI, by Uvicorn under ASGI, or by a
    // Celery worker that never touches `manage.py` at all.
    entryKinds: ['django-settings'],
    integration: 'instrument_django',
  },
  {
    id: 'fastapi',
    label: 'FastAPI',
    distribution: 'fastapi',
    supportedVersionRange: '>=0.95,<1',
    entryKinds: ['fastapi-app'],
    integration: 'instrument_fastapi',
  },
  {
    id: 'flask',
    label: 'Flask',
    distribution: 'flask',
    supportedVersionRange: '>=2,<4',
    entryKinds: ['flask-app', 'flask-factory'],
    integration: 'instrument_flask',
  },
  {
    id: 'starlette',
    label: 'Starlette',
    distribution: 'starlette',
    supportedVersionRange: '>=0.27,<1',
    entryKinds: ['starlette-app'],
    integration: 'instrument_starlette',
  },
];

// ── project and manifest handling ────────────────────────────────────────────

type ResolvedProject = {
  project: PythonProject;
  /** Absolute directory of the project. */
  directory: string;
  /** Repository-relative project root, `''` for the repository root. */
  relativeRoot: string;
  version: string | null;
  specifier: string | null;
  supported: boolean;
  evidence: string[];
};

function projectFor(root: string, definition: PythonAdapterDefinition): ResolvedProject | null {
  let projects: PythonProject[];
  try {
    projects = discoverPythonProjects(root);
  } catch {
    return null;
  }

  const candidates = projects.flatMap((project) => {
    const relativeRoot = project.root === '.' ? '' : project.root;
    const directory = path.join(root, ...(relativeRoot ? relativeRoot.split('/') : []));
    const detected = detectPythonFrameworks(project, directory).find((item) => item.id === definition.id);
    if (!detected) return [];
    return [{
      project,
      directory,
      relativeRoot,
      version: detected.version,
      specifier: detected.specifier,
      supported: detected.version
        ? satisfiesPythonSpecifier(detected.version, definition.supportedVersionRange)
        // An unpinned dependency is not a declaration of an unsupported
        // version, so it is treated as supported rather than refused.
        : true,
      evidence: detected.evidence.map((item) => (relativeRoot ? `${relativeRoot}: ${item}` : item)),
    }];
  });

  return candidates.find((item) => item.supported) ?? candidates[0] ?? null;
}

function withinProject(relativeRoot: string, relativePath: string): string {
  return relativeRoot ? path.posix.join(relativeRoot, relativePath) : relativePath;
}

type ManifestEdit = {
  /** Repository-relative manifest path. */
  relativePath: string;
  /** Applies the dependency to the manifest's current text. */
  apply: (source: string) => string;
  description: string;
  /** No manifest existed, so one is created. */
  created: boolean;
};

const DECLARED = new RegExp(`(^|[\\n\\[,"'\\s])${PYTHON_SDK_DISTRIBUTION}(\\s|$|[=<>!~,\\]"'])`, 'i');

/**
 * Where and how to declare the SDK dependency.
 *
 * Python has no single manifest, so the format the project already uses is the
 * one that is edited. Writing a `requirements.txt` into a Poetry project would
 * add a file its tooling ignores, which looks like success and installs
 * nothing.
 */
function manifestEditFor(root: string, resolved: ResolvedProject): ManifestEdit {
  const { project, relativeRoot } = resolved;
  const spec = `${PYTHON_SDK_DISTRIBUTION}${PYTHON_SDK_SPECIFIER}`;

  const pyproject = project.manifests.find((item) => item.kind === 'pyproject');
  if (pyproject) {
    const absolute = path.join(root, ...pyproject.path.split('/'));
    const text = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
    const poetry = /\[tool\.poetry\.dependencies\]/.test(text);
    const pep621 = /^\s*dependencies\s*=\s*\[/m.test(text);
    if (poetry && !pep621) {
      return {
        relativePath: pyproject.path,
        created: false,
        description: `Add ${spec} to [tool.poetry.dependencies]`,
        apply: (source) => {
          if (DECLARED.test(source)) return source;
          return source.replace(
            /(\[tool\.poetry\.dependencies\][^\n]*\n)/,
            `$1${PYTHON_SDK_DISTRIBUTION} = "${PYTHON_SDK_SPECIFIER}"\n`,
          );
        },
      };
    }
    if (pep621) {
      return {
        relativePath: pyproject.path,
        created: false,
        description: `Add ${spec} to [project] dependencies`,
        apply: (source) => {
          if (DECLARED.test(source)) return source;
          // Matched non-greedily to the first closing bracket, so a later
          // `optional-dependencies` array is left untouched.
          return source.replace(
            /(^\s*dependencies\s*=\s*\[)([\s\S]*?)(\])/m,
            (_match, open: string, body: string, close: string) => {
              const trimmed = body.replace(/\s+$/, '');
              const separator = trimmed.trim() ? (trimmed.trimEnd().endsWith(',') ? '' : ',') : '';
              const indent = /\n(\s+)\S/.exec(body)?.[1] ?? '  ';
              return `${open}${trimmed}${separator}\n${indent}"${spec}",\n${close}`;
            },
          );
        },
      };
    }
  }

  const pipfile = project.manifests.find((item) => item.kind === 'pipfile');
  if (pipfile) {
    return {
      relativePath: pipfile.path,
      created: false,
      description: `Add ${spec} to [packages]`,
      apply: (source) => {
        if (DECLARED.test(source)) return source;
        return /\[packages\]/.test(source)
          ? source.replace(/(\[packages\][^\n]*\n)/, `$1${PYTHON_SDK_DISTRIBUTION} = "${PYTHON_SDK_SPECIFIER}"\n`)
          : `${source.replace(/\s*$/, '')}\n\n[packages]\n${PYTHON_SDK_DISTRIBUTION} = "${PYTHON_SDK_SPECIFIER}"\n`;
      },
    };
  }

  // A runtime requirements file, never a dev or test one.
  const requirements = project.manifests
    .filter((item) => item.kind === 'requirements')
    .sort((left, right) => left.path.length - right.path.length)
    .find((item) => /(^|\/)requirements\.txt$/i.test(item.path));
  const target = requirements?.path ?? withinProject(relativeRoot, 'requirements.txt');
  return {
    relativePath: target,
    created: !requirements,
    description: `Add ${spec} to ${path.posix.basename(target)}`,
    apply: (source) => {
      if (DECLARED.test(source)) return source;
      const body = source.replace(/\s*$/, '');
      return body ? `${body}\n${spec}\n` : `${spec}\n`;
    },
  };
}

// ── the generated module ─────────────────────────────────────────────────────

function pythonString(value: string): string {
  return JSON.stringify(value);
}

function generatedModule(definition: PythonAdapterDefinition): string {
  return `${GENERATED_START} manifest=${INSTRUMENTATION_MANIFEST_VERSION}
"""Tellann instrumentation.

Generated by Tellann. Re-generating replaces this file, so edits belong in the
application rather than here. Configuration is read from the environment, with
the values below as the fallback for a checkout that has no environment file.
"""

from __future__ import annotations

import os

from tellann import TELLANN

DEFAULT_ENDPOINT = os.environ.get("TELLANN_RELAY_ENDPOINT") or os.environ.get(
    "TELLANN_GATEWAY_URL"
) or "http://127.0.0.1:43117"
APPLICATION_ID = os.environ.get("TELLANN_APPLICATION_ID") or "configure-in-tellann-desktop"

#: Added to Django's MIDDLEWARE by the generated settings hook.
MIDDLEWARE_PATH = "tellann.integrations.django_middleware.TellannMiddleware"


def initialize() -> None:
    """Configure the SDK once per process."""
    if TELLANN.is_initialized():
        return
    TELLANN.initialize(
        endpoint=DEFAULT_ENDPOINT,
        application_id=APPLICATION_ID,
        environment_id=os.environ.get("TELLANN_ENVIRONMENT_ID"),
        api_key=os.environ.get("TELLANN_RUN_CREDENTIAL") or os.environ.get("TELLANN_INGESTION_KEY"),
        run_id=os.environ.get("TELLANN_RUN_ID"),
        session_id=os.environ.get("TELLANN_SESSION_ID"),
        trace_id=os.environ.get("TELLANN_TRACE_ID"),
        agent_version=os.environ.get("TELLANN_AGENT_VERSION"),
        instrumentation_manifest_version=${pythonString(INSTRUMENTATION_MANIFEST_VERSION)},
    )
    TELLANN.verify_installation()


def instrument(app=None):
    """Initialize, and attach framework middleware when an app is given."""
    initialize()
    if app is None:
        return None
    from tellann.integrations import ${definition.integration}

    return ${definition.integration}(app)


def checkpoint(*args, **kwargs) -> None:
    """Mark a declared Flow checkpoint. Inserted calls resolve through here."""
    initialize()
    TELLANN.checkpoint(*args, **kwargs)


initialize()
${GENERATED_END}
`;
}

// ── source insertion ─────────────────────────────────────────────────────────

/** Split into lines while remembering the line ending the file already used. */
function splitLines(source: string): { lines: string[]; newline: string } {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  return { lines: source.replaceAll('\r\n', '\n').split('\n'), newline };
}

/** Insert `block` so it begins on the line after `afterLine` (1-indexed). */
function insertAfterLine(source: string, afterLine: number, block: string[]): string {
  const { lines, newline } = splitLines(source);
  const at = Math.min(Math.max(afterLine, 0), lines.length);
  lines.splice(at, 0, ...block);
  return lines.join(newline);
}

const DJANGO_SETTINGS_BLOCK = (moduleName: string): string[] => [
  '',
  GENERATED_START,
  `from ${moduleName} import MIDDLEWARE_PATH as TELLANN_MIDDLEWARE, initialize as tellann_initialize`,
  '',
  'tellann_initialize()',
  '',
  '# Appended rather than assigned, so the project keeps whatever middleware it',
  '# already declared, and re-running instrumentation does not add it twice.',
  '_tellann_existing_middleware = list(globals().get("MIDDLEWARE", []))',
  'if TELLANN_MIDDLEWARE not in _tellann_existing_middleware:',
  '    MIDDLEWARE = [*_tellann_existing_middleware, TELLANN_MIDDLEWARE]',
  GENERATED_END,
  '',
];

const APPLICATION_BLOCK = (moduleName: string, symbol: string, indent: string): string[] => [
  `${indent}${GENERATED_START}`,
  `${indent}from ${moduleName} import instrument as tellann_instrument`,
  '',
  `${indent}tellann_instrument(${symbol})`,
  `${indent}${GENERATED_END}`,
];

/** Leading whitespace of a 1-indexed line. */
function indentOfLine(source: string, line: number): string {
  const { lines } = splitLines(source);
  return /^[ \t]*/.exec(lines[line - 1] ?? '')?.[0] ?? '';
}

/**
 * Wire the generated module into the framework's entry point.
 *
 * Returns the source unchanged when the marker is already present, so applying
 * a plan twice produces one integration rather than two.
 */
export function applyPythonEntryTransform(
  definition: PythonAdapterDefinition,
  source: string,
  entry: PythonEntryPoint,
  moduleName: string,
): string {
  if (source.includes(GENERATED_START)) return source;

  if (definition.id === 'django') {
    const { lines, newline } = splitLines(source);
    return [...lines, ...DJANGO_SETTINGS_BLOCK(moduleName)].join(newline);
  }

  if (!entry.symbol) throw new Error(`SAFE_${definition.id.toUpperCase()}_APP_NOT_FOUND`);
  // The factory case keeps the application object's own indentation, so the
  // call lands inside the factory function rather than at module level where
  // the name does not exist.
  const indent = indentOfLine(source, entry.line);
  return insertAfterLine(source, entry.insertAfterLine, APPLICATION_BLOCK(moduleName, entry.symbol, indent));
}

// ── Flow checkpoints ─────────────────────────────────────────────────────────

/**
 * Placements a Python checkpoint can be inserted at.
 *
 * Only callable entries are accepted. The remaining placement kinds - a branch
 * arm, a particular statement, a React component mount - are resolved against a
 * TypeScript syntax tree by the retrieval engine, and honouring them here would
 * mean guessing at a location the plan describes in another language's terms.
 * Refusing is the honest answer; inserting a call at an approximate position
 * inside someone's function is not.
 */
const SUPPORTED_PYTHON_PLACEMENTS = new Set(['FUNCTION_ENTRY', 'CALLBACK_ENTRY', 'ROUTE_HANDLER_ENTRY', 'METHOD_ENTRY', 'ARROW_FUNCTION_ENTRY']);

function declarationNamed(module: PythonModule, symbol: string): PythonNode | null {
  const exact = module.declarations.find((item) => item.qualifiedName === symbol);
  if (exact) return exact;
  return module.declarations.find((item) => item.name === symbol) ?? null;
}

export type PythonCheckpointPlacement = {
  file: string;
  symbol: string;
  placementKind: string;
  anchorText: string;
  anchorHash: string;
  startLine: number;
  endLine: number;
};

/** The line a checkpoint call goes after: the callable's body start. */
function checkpointInsertLine(declaration: PythonNode): number {
  // After the docstring, so the string stays the docstring.
  return declaration.docstringEndLine ?? declaration.bodyStartLine - 1;
}

export function applyPythonCheckpoint(
  source: string,
  filePath: string,
  operation: PatchOperation,
  moduleName: string,
): string {
  const marker = `tellann:checkpoint:${operation.id}`;
  if (source.includes(marker)) return source;
  if (!operation.symbol) throw new Error(`FLOW_CHECKPOINT_MAPPING_REVIEW_REQUIRED:${operation.id}`);
  if (operation.placementKind && !SUPPORTED_PYTHON_PLACEMENTS.has(operation.placementKind)) {
    throw new Error(`UNSUPPORTED_FLOW_CHECKPOINT_PLACEMENT:${operation.id}`);
  }

  const module = parsePythonModule(source, filePath);
  const declaration = declarationNamed(module, operation.symbol);
  if (!declaration || declaration.kind !== 'function') throw new Error(`STALE_FLOW_CHECKPOINT_SYMBOL:${operation.id}`);

  const mapping = operation.eventMappings[0];
  const parts = [pythonString(operation.id)];
  if (mapping?.eventType) parts.push(`event_type=${pythonString(mapping.eventType)}`);
  if (mapping?.stateId) parts.push(`state_id=${pythonString(mapping.stateId)}`);
  if (mapping?.transitionId) parts.push(`transition_id=${pythonString(mapping.transitionId)}`);
  if (mapping?.terminalKind) parts.push(`terminal_kind=${pythonString(mapping.terminalKind)}`);
  if (operation.flowInitializationId) parts.push(`flow_initialization_id=${pythonString(operation.flowInitializationId)}`);

  const indent = declaration.bodyIndent;
  const withCall = insertAfterLine(source, checkpointInsertLine(declaration), [
    `${indent}tellann_checkpoint(${parts.join(', ')})  # ${marker}`,
  ]);

  const importLine = `from ${moduleName} import checkpoint as tellann_checkpoint`;
  if (withCall.includes(importLine)) return withCall;
  // Below `from __future__`, which Python requires to be the first statement.
  const { lines } = splitLines(withCall);
  let at = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*from\s+__future__\s+import/.test(lines[index])) at = index + 1;
    else if (/^\s*(#|"""|''')/.test(lines[index]) && at === index) at = index + 1;
  }
  return insertAfterLine(withCall, at, [importLine]);
}

// ── commands ─────────────────────────────────────────────────────────────────

const PYTHON_ENVIRONMENT_KEYS = [
  'CI', 'PATH', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
  'HOME', 'VIRTUAL_ENV', 'CONDA_PREFIX', 'PYTHONPATH', 'PYTHONHOME', 'PIP_INDEX_URL',
  'POETRY_HOME', 'UV_CACHE_DIR', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
];

function pythonExecutable(): string {
  return process.platform === 'win32' ? 'python' : 'python3';
}

function pythonCommands(resolved: ResolvedProject): StructuredCommand[] {
  const cwd = resolved.relativeRoot || '.';
  const install = pythonInstallCommand(resolved.project.manager, `${PYTHON_SDK_DISTRIBUTION}${PYTHON_SDK_SPECIFIER}`);
  const [executable, ...args] = install.split(' ');

  return [
    {
      id: 'install-sdk',
      executable,
      args,
      cwd,
      timeoutMs: 15 * 60_000,
      allowedEnvironmentKeys: PYTHON_ENVIRONMENT_KEYS,
      purpose: `Install ${PYTHON_SDK_DISTRIBUTION} with the project's package manager (${resolved.project.manager})`,
      networkRequired: true,
    },
    {
      id: 'compile-check',
      executable: pythonExecutable(),
      // Compiles every module to bytecode without importing any of them, so a
      // syntax error introduced by instrumentation is caught without executing
      // a line of the user's application.
      args: ['-m', 'compileall', '-q', '.'],
      cwd,
      timeoutMs: 5 * 60_000,
      allowedEnvironmentKeys: PYTHON_ENVIRONMENT_KEYS,
      purpose: 'Check every Python module still parses after instrumentation',
      networkRequired: false,
    },
  ];
}

// ── the adapter ──────────────────────────────────────────────────────────────

const SEMANTIC_BOUNDARY = /^(login|sign_?in|authenticate|validate|save|create|update|delete|persist|checkout|register|submit)/i;

export class PythonAdapter implements InstrumentationAdapter {
  readonly version = '1.0.0';
  readonly id: FrameworkId;
  readonly supportedVersionRange: string;

  constructor(private readonly definition: PythonAdapterDefinition) {
    this.id = definition.id;
    this.supportedVersionRange = definition.supportedVersionRange;
  }

  detect(input: LocalProjectContext): DetectionResult {
    const resolved = projectFor(input.workspaceRoot, this.definition);
    if (!resolved) {
      return {
        adapterId: this.id,
        adapterVersion: this.version,
        supported: false,
        confidence: 0,
        frameworkVersion: null,
        supportedVersionRange: this.supportedVersionRange,
        evidence: [],
        reasons: [`No Python project in this workspace declares ${this.definition.distribution}`],
      };
    }

    const entry = primaryEntryPoint(this.entryPoints(resolved), this.definition.entryKinds);
    return {
      adapterId: this.id,
      adapterVersion: this.version,
      // A framework with nowhere to attach is detected but not supported: the
      // adapter would have nothing to modify.
      supported: resolved.supported && Boolean(entry),
      confidence: resolved.supported ? (entry ? 0.99 : 0.7) : 0.6,
      frameworkVersion: resolved.version,
      supportedVersionRange: this.supportedVersionRange,
      evidence: [
        ...resolved.evidence,
        ...(entry ? [`entry point: ${withinProject(resolved.relativeRoot, entry.file)} (${entry.kind})`] : []),
      ],
      reasons: [
        ...(!resolved.supported
          ? [`${this.definition.label} ${resolved.version ?? 'unknown'} is outside ${this.supportedVersionRange}`]
          : []),
        ...(!entry ? [`No ${this.definition.label} entry point was found to attach to`] : []),
      ],
    };
  }

  private entryPoints(resolved: ResolvedProject): PythonEntryPoint[] {
    try {
      return findPythonEntryPoints(resolved.directory);
    } catch {
      return [];
    }
  }

  async index(input: LocalProjectContext): Promise<AdapterEvidence> {
    const resolved = projectFor(input.workspaceRoot, this.definition);
    if (!resolved) return { entryPoints: [], existingInstrumentation: [], semanticBoundaries: [] };

    const entryPoints: AdapterEvidence['entryPoints'] = this.entryPoints(resolved)
      .filter((item) => this.definition.entryKinds.includes(item.kind))
      .map((item) => ({
        file: withinProject(resolved.relativeRoot, item.file),
        symbol: item.symbol,
        confidence: item.confidence,
      }));

    const existingInstrumentation: AdapterEvidence['existingInstrumentation'] = [];
    const semanticBoundaries: AdapterEvidence['semanticBoundaries'] = [];

    for (const relative of listPythonSourceFiles(resolved.directory, { maxFiles: 5_000 })) {
      const repositoryPath = withinProject(resolved.relativeRoot, relative);
      let content: string;
      try {
        content = fs.readFileSync(resolveWithinWorkspace(input.workspaceRoot, repositoryPath), 'utf8');
      } catch {
        continue;
      }
      if (content.includes(GENERATED_START) || /(^|\n)\s*(from|import)\s+tellann\b/.test(content)) {
        existingInstrumentation.push({
          file: repositoryPath,
          marker: content.includes(GENERATED_START) ? 'generated-block' : 'sdk-import',
        });
      }
      if (semanticBoundaries.length >= 100) continue;
      if (!SEMANTIC_BOUNDARY.test(content) && !/\b(login|authenticate|checkout)\b/i.test(content)) continue;
      let module: PythonModule;
      try {
        module = parsePythonModule(content, repositoryPath);
      } catch {
        continue;
      }
      for (const declaration of module.declarations) {
        if (declaration.kind !== 'function' || !SEMANTIC_BOUNDARY.test(declaration.name)) continue;
        const authentication = /^(login|sign_?in|authenticate|register)/i.test(declaration.name);
        const validation = /^validate/i.test(declaration.name);
        semanticBoundaries.push({
          file: repositoryPath,
          symbol: declaration.qualifiedName,
          eventType: 'WORKFLOW_STARTED',
          confidence: 0.78,
          rationale: authentication
            ? 'Authentication workflow entry'
            : validation ? 'Validation workflow entry' : 'Persisted business workflow entry',
        });
        if (semanticBoundaries.length >= 100) break;
      }
    }

    return { entryPoints: entryPoints.slice(0, 20), existingInstrumentation, semanticBoundaries };
  }

  async propose(input: LocalProjectContext): Promise<InstrumentationPlan> {
    if (input.environmentType === 'PRODUCTION') throw new Error('PRODUCTION_OBSERVATION_ONLY');
    const detection = this.detect(input);
    if (!detection.supported) throw new Error(`UNSUPPORTED_FRAMEWORK_VERSION:${detection.reasons.join(';')}`);

    const resolved = projectFor(input.workspaceRoot, this.definition);
    if (!resolved) throw new Error('FRAMEWORK_PACKAGE_NOT_FOUND');
    const entry = primaryEntryPoint(this.entryPoints(resolved), this.definition.entryKinds);
    if (!entry) throw new Error('SAFE_ENTRY_POINT_NOT_IN_FRAMEWORK_PACKAGE');

    const evidence = await this.index(input);
    const manifest = manifestEditFor(input.workspaceRoot, resolved);
    const generatedFile = withinProject(resolved.relativeRoot, GENERATED_MODULE);
    const entryFile = withinProject(resolved.relativeRoot, entry.file);
    const moduleName = GENERATED_MODULE.replace(/\.py$/, '');

    const operations: PatchOperation[] = [
      {
        id: 'package-sdk',
        kind: manifest.created ? 'CREATE_FILE' : 'UPDATE_PACKAGE',
        relativePath: manifest.relativePath,
        symbol: PYTHON_SDK_DISTRIBUTION,
        transformId: 'tellann.python.dependency',
        transformVersion: this.version,
        expectedHash: fileHash(input.workspaceRoot, manifest.relativePath),
        description: manifest.description,
        eventMappings: [],
      },
      {
        id: 'generated-config',
        kind: fs.existsSync(resolveWithinWorkspace(input.workspaceRoot, generatedFile)) ? 'UPDATE_SOURCE' : 'CREATE_FILE',
        relativePath: generatedFile,
        symbol: null,
        transformId: 'tellann.generated.config',
        transformVersion: this.version,
        expectedHash: fileHash(input.workspaceRoot, generatedFile),
        description: 'Create the Tellann SDK configuration and correlation module',
        eventMappings: [{ eventType: 'TELLANN_INITIALIZED', expectedState: null }],
        content: generatedModule(this.definition),
      },
      {
        id: 'entry-import',
        kind: 'UPDATE_SOURCE',
        relativePath: entryFile,
        symbol: entry.symbol,
        transformId: 'tellann.python.entry',
        transformVersion: this.version,
        expectedHash: fileHash(input.workspaceRoot, entryFile),
        description: this.definition.id === 'django'
          ? 'Initialize Tellann and register its middleware from the Django settings module'
          : `Attach the Tellann ${this.definition.label} integration to the application object`,
        eventMappings: [],
        importModule: moduleName,
      },
    ];

    if (input.instrumentationPurpose === 'FLOW' && !input.flowManifest) {
      throw new Error('FLOW_INITIALIZATION_MANIFEST_REQUIRED');
    }
    const flowManifest = input.instrumentationPurpose === 'FLOW' ? input.flowManifest : null;
    const assigned = input.flowCheckpointIds ? new Set(input.flowCheckpointIds) : null;
    const checkpoints = (flowManifest?.checkpoints ?? [])
      .filter((checkpoint) => !assigned || assigned.has(checkpoint.id));

    for (const checkpoint of checkpoints) {
      const mapping = checkpoint.mapping as {
        file?: string; symbol?: string | null; placementKind?: string;
        anchorText?: string; anchorHash?: string; startLine?: number; endLine?: number;
      };
      if (!mapping?.file || !mapping.symbol || !mapping.placementKind) {
        throw new Error(`FLOW_CHECKPOINT_MAPPING_REVIEW_REQUIRED:${checkpoint.id}`);
      }
      if (!SUPPORTED_PYTHON_PLACEMENTS.has(mapping.placementKind)) {
        throw new Error(`UNSUPPORTED_FLOW_CHECKPOINT_PLACEMENT:${checkpoint.id}`);
      }
      if (resolved.relativeRoot && !mapping.file.startsWith(`${resolved.relativeRoot}/`)) {
        throw new Error(`FLOW_CHECKPOINT_OUTSIDE_FRAMEWORK_PACKAGE:${checkpoint.id}`);
      }
      const target = resolveWithinWorkspace(input.workspaceRoot, mapping.file);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        throw new Error(`STALE_FLOW_CHECKPOINT_FILE:${checkpoint.id}`);
      }
      const content = fs.readFileSync(target, 'utf8');
      const declaration = declarationNamed(parsePythonModule(content, mapping.file), mapping.symbol);
      if (!declaration || declaration.kind !== 'function') {
        throw new Error(`STALE_FLOW_CHECKPOINT_SYMBOL:${checkpoint.id}`);
      }
      if (mapping.anchorText && mapping.anchorHash) {
        const expected = calculateFlowAnchorHash(mapping.file, mapping.symbol, mapping.placementKind, mapping.anchorText);
        if (expected !== mapping.anchorHash) throw new Error(`STALE_FLOW_CHECKPOINT_ANCHOR:${checkpoint.id}`);
      }

      operations.push({
        id: checkpoint.id,
        kind: 'UPDATE_SOURCE',
        relativePath: mapping.file,
        symbol: mapping.symbol,
        transformId: 'tellann.python.checkpoint',
        transformVersion: this.version,
        expectedHash: fileHash(input.workspaceRoot, mapping.file),
        description: `Add declared Flow checkpoint ${checkpoint.id} at the entry of ${mapping.symbol}`,
        eventMappings: [{
          eventType: checkpoint.eventType,
          expectedState: checkpoint.expectedState,
          checkpointId: checkpoint.id,
          stateId: checkpoint.stateId,
          transitionId: checkpoint.transitionId,
          terminalKind: checkpoint.terminalKind,
        }],
        importModule: moduleName,
        flowInitializationId: input.flowInitializationId,
        placementKind: mapping.placementKind as PatchOperation['placementKind'],
        anchorText: mapping.anchorText,
        anchorHash: mapping.anchorHash,
        startLine: mapping.startLine,
        endLine: mapping.endLine,
      });
    }

    const validationCommands = pythonCommands(resolved);
    const hasExisting = evidence.existingInstrumentation.length > 0;

    return {
      contractVersion: INSTRUMENTATION_CONTRACT_VERSION,
      manifestVersion: INSTRUMENTATION_MANIFEST_VERSION,
      id: crypto.randomUUID(),
      // A digest of everything the plan would do, so two proposals for an
      // unchanged workspace approve as the same task and a changed one does not.
      taskKey: hash(JSON.stringify({
        adapter: this.id,
        version: this.version,
        revision: input.snapshot.revision,
        fingerprint: input.snapshot.repositoryFingerprint,
        operations: operations.map(({ content, ...operation }) => operation),
      })),
      adapterId: this.id,
      adapterVersion: this.version,
      frameworkVersion: detection.frameworkVersion,
      supportedVersionRange: this.supportedVersionRange,
      baseRevision: input.snapshot.revision,
      repositoryFingerprint: input.snapshot.repositoryFingerprint,
      approvedFileScopes: [...new Set(operations.map((operation) => operation.relativePath))],
      packageChanges: [{
        packageName: PYTHON_SDK_DISTRIBUTION,
        version: PYTHON_SDK_SPECIFIER,
        kind: 'dependency',
      }],
      operations,
      validationCommands,
      networkRequirements: ['Package index access to install the Tellann Python SDK'],
      risk: hasExisting || checkpoints.length ? 'MEDIUM' : 'LOW',
      riskReasons: [
        ...(hasExisting ? ['Existing instrumentation requires duplicate-registration checks'] : []),
        ...(checkpoints.length ? ['Resolved Flow checkpoints modify explicitly mapped source locations'] : []),
        ...(!hasExisting && !checkpoints.length
          ? ['Changes are limited to one dependency, one generated module, and one framework integration']
          : []),
      ],
      evidence,
      instrumentationPurpose: input.instrumentationPurpose ?? 'BOOTSTRAP',
      flowId: input.flowId ?? null,
      flowVersionId: input.flowVersionId ?? null,
      flowInitializationId: input.flowInitializationId ?? null,
      flowManifest: flowManifest ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  async apply(input: LocalProjectContext, task: ApprovedInstrumentationTask): Promise<PatchResult> {
    const session = beginPatch(input, task, this.id);
    const plan = session.plan;
    try {
      const resolved = projectFor(input.workspaceRoot, this.definition);
      if (!resolved) throw new Error('FRAMEWORK_PACKAGE_NOT_FOUND');
      const moduleName = GENERATED_MODULE.replace(/\.py$/, '');

      const dependency = plan.operations.find((operation) => operation.id === 'package-sdk');
      if (dependency) {
        const target = resolveWithinWorkspace(input.workspaceRoot, dependency.relativePath);
        const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, manifestEditFor(input.workspaceRoot, resolved).apply(current));
      }

      const generated = plan.operations.find((operation) => operation.id === 'generated-config');
      if (generated?.content) {
        const target = resolveWithinWorkspace(input.workspaceRoot, generated.relativePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
        if (!current.includes(GENERATED_START)) fs.writeFileSync(target, generated.content);
      }

      const entryOperation = plan.operations.find((operation) => operation.id === 'entry-import');
      if (entryOperation) {
        const target = resolveWithinWorkspace(input.workspaceRoot, entryOperation.relativePath);
        const current = fs.readFileSync(target, 'utf8');
        // Re-resolved rather than taken from the plan: the plan carries the
        // symbol, and the position has to be read from the file as it is now.
        const entry = primaryEntryPoint(this.entryPoints(resolved), this.definition.entryKinds);
        if (!entry) throw new Error('SAFE_ENTRY_POINT_NOT_IN_FRAMEWORK_PACKAGE');
        fs.writeFileSync(target, applyPythonEntryTransform(this.definition, current, entry, moduleName));
      }

      for (const operation of plan.operations.filter((item) => item.transformId === 'tellann.python.checkpoint')) {
        const target = resolveWithinWorkspace(input.workspaceRoot, operation.relativePath);
        const current = fs.readFileSync(target, 'utf8');
        fs.writeFileSync(target, applyPythonCheckpoint(current, operation.relativePath, operation, moduleName));
      }

      return finalizePatch(input, task, session);
    } catch (error) {
      restorePatch(input, session);
      throw error;
    }
  }

  async validate(input: LocalProjectContext, result: PatchResult): Promise<ValidationResult> {
    const checks: ValidationResult['checks'] = hashChecks(input, result);

    const manifestFile = result.files.find((file) =>
      /(^|\/)(requirements[^/]*\.txt|pyproject\.toml|Pipfile)$/i.test(file.relativePath));
    const manifestText = manifestFile
      ? (() => {
          try {
            return fs.readFileSync(resolveWithinWorkspace(input.workspaceRoot, manifestFile.relativePath), 'utf8');
          } catch {
            return '';
          }
        })()
      : '';
    checks.push({
      name: 'sdk-dependency',
      passed: DECLARED.test(manifestText),
      output: manifestFile?.relativePath ?? 'no Python manifest was written',
    });

    const generatedFile = result.files.find((file) => file.relativePath.endsWith(GENERATED_MODULE));
    const generatedText = generatedFile
      ? (() => {
          try {
            return fs.readFileSync(resolveWithinWorkspace(input.workspaceRoot, generatedFile.relativePath), 'utf8');
          } catch {
            return '';
          }
        })()
      : '';
    checks.push({
      name: 'generated-config',
      passed: generatedText.includes(GENERATED_START),
      output: generatedFile?.relativePath ?? 'missing generated config',
    });

    const resolved = projectFor(input.workspaceRoot, this.definition);
    const sources = resolved
      ? listPythonSourceFiles(resolved.directory, { maxFiles: 5_000 }).map((relative) => {
          const repositoryPath = withinProject(resolved.relativeRoot, relative);
          try {
            return { relativePath: repositoryPath, content: fs.readFileSync(resolveWithinWorkspace(input.workspaceRoot, repositoryPath), 'utf8') };
          } catch {
            return { relativePath: repositoryPath, content: '' };
          }
        })
      : [];

    const duplicated = sources
      .filter((source) => (source.content.match(new RegExp(GENERATED_START, 'g')) ?? []).length > 1)
      .map((source) => source.relativePath);
    checks.push({
      name: 'idempotency-markers',
      passed: duplicated.length === 0,
      output: duplicated.length ? `Duplicate markers: ${duplicated.join(', ')}` : 'No duplicate generated markers',
    });

    if (input.instrumentationPurpose === 'FLOW' && input.flowManifest) {
      for (const checkpoint of input.flowManifest.checkpoints) {
        const marker = `tellann:checkpoint:${checkpoint.id}`;
        const matches = sources.flatMap((source) =>
          Array.from({ length: source.content.split(marker).length - 1 }, () => source.relativePath));
        checks.push({
          name: `flow-checkpoint:${checkpoint.id}`,
          passed: matches.length === 1,
          output: matches.length === 1
            ? `Exactly one marker present in ${matches[0]}`
            : `Expected one marker for ${checkpoint.id}; found ${matches.length}`,
        });
      }
    }

    return { valid: checks.every((check) => check.passed), checks };
  }

  async rollback(input: LocalProjectContext, result: PatchResult): Promise<RollbackResult> {
    return rollbackPatch(input, result);
  }
}

export const pythonAdapters: InstrumentationAdapter[] = PYTHON_DEFINITIONS.map(
  (definition) => new PythonAdapter(definition),
);
