import fs from 'node:fs';
import path from 'node:path';
import { normalizeDistribution, type PythonProject } from './manifest';
import { satisfiesPythonSpecifier } from './version';

/**
 * Python frameworks this system can reason about.
 *
 * The list is the union of what the instrumenters can safely modify and what
 * the analyzer can read routes and models out of; a framework appears here only
 * when at least one of those is true, so detection never promises support that
 * nothing downstream can honour.
 */
export type PythonFrameworkId =
  | 'django' | 'django-rest-framework' | 'flask' | 'fastapi' | 'starlette'
  | 'celery' | 'sqlalchemy' | 'tornado' | 'aiohttp' | 'sanic' | 'pyramid' | 'bottle';

export type PythonFrameworkDefinition = {
  id: PythonFrameworkId;
  label: string;
  /** PEP 503 normalized distribution that proves the framework is present. */
  distribution: string;
  /** Other distributions that also imply it. */
  aliases?: string[];
  /** Versions the adapters and analyzers have been written against. */
  supportedVersionRange: string;
  kind: 'web' | 'task-queue' | 'orm';
  /** Files whose presence alone is strong evidence, for manifest-less projects. */
  markerFiles?: string[];
};

export const PYTHON_FRAMEWORKS: PythonFrameworkDefinition[] = [
  { id: 'django', label: 'Django', distribution: 'django', supportedVersionRange: '>=3.2,<6', kind: 'web', markerFiles: ['manage.py'] },
  { id: 'django-rest-framework', label: 'Django REST Framework', distribution: 'djangorestframework', supportedVersionRange: '>=3.12,<4', kind: 'web' },
  { id: 'fastapi', label: 'FastAPI', distribution: 'fastapi', supportedVersionRange: '>=0.95,<1', kind: 'web' },
  { id: 'flask', label: 'Flask', distribution: 'flask', supportedVersionRange: '>=2,<4', kind: 'web' },
  { id: 'starlette', label: 'Starlette', distribution: 'starlette', supportedVersionRange: '>=0.27,<1', kind: 'web' },
  { id: 'tornado', label: 'Tornado', distribution: 'tornado', supportedVersionRange: '>=6,<7', kind: 'web' },
  { id: 'aiohttp', label: 'aiohttp', distribution: 'aiohttp', supportedVersionRange: '>=3,<4', kind: 'web' },
  { id: 'sanic', label: 'Sanic', distribution: 'sanic', supportedVersionRange: '>=22,<25', kind: 'web' },
  { id: 'pyramid', label: 'Pyramid', distribution: 'pyramid', supportedVersionRange: '>=2,<3', kind: 'web' },
  { id: 'bottle', label: 'Bottle', distribution: 'bottle', supportedVersionRange: '>=0.12,<1', kind: 'web' },
  { id: 'celery', label: 'Celery', distribution: 'celery', supportedVersionRange: '>=5,<6', kind: 'task-queue' },
  { id: 'sqlalchemy', label: 'SQLAlchemy', distribution: 'sqlalchemy', supportedVersionRange: '>=1.4,<3', kind: 'orm' },
];

export type PythonFrameworkEvidence = {
  id: PythonFrameworkId;
  label: string;
  /** Version the manifest pins, when the pin names one. */
  version: string | null;
  specifier: string | null;
  supportedVersionRange: string;
  /**
   * Whether this version is inside the range the adapters were written for.
   * An unpinned range is treated as supported: a project that wrote `Django`
   * with no version is not declaring an unsupported one.
   */
  supported: boolean;
  confidence: number;
  evidence: string[];
  kind: PythonFrameworkDefinition['kind'];
};

/**
 * Which frameworks a Python project uses.
 *
 * Manifest evidence is preferred because it is a declaration rather than a
 * guess. A marker file raises a framework that no manifest mentions, which is
 * the normal state of a `django-admin startproject` tree.
 */
export function detectPythonFrameworks(project: PythonProject, projectDirectory?: string): PythonFrameworkEvidence[] {
  const found: PythonFrameworkEvidence[] = [];

  for (const definition of PYTHON_FRAMEWORKS) {
    const candidates = [definition.distribution, ...(definition.aliases ?? [])].map(normalizeDistribution);
    const dependency = candidates.map((name) => project.dependencies[name]).find(Boolean);

    if (dependency) {
      const version = dependency.resolved;
      found.push({
        id: definition.id,
        label: definition.label,
        version,
        specifier: dependency.specifier || null,
        supportedVersionRange: definition.supportedVersionRange,
        supported: version ? satisfiesPythonSpecifier(version, definition.supportedVersionRange) : true,
        confidence: 0.98,
        evidence: [`${dependency.source} dependency: ${dependency.name}${dependency.specifier ? ` ${dependency.specifier}` : ''}`],
        kind: definition.kind,
      });
      continue;
    }

    if (projectDirectory && definition.markerFiles?.length) {
      const marker = definition.markerFiles.find((file) => fs.existsSync(path.join(projectDirectory, file)));
      if (marker) {
        found.push({
          id: definition.id,
          label: definition.label,
          version: null,
          specifier: null,
          supportedVersionRange: definition.supportedVersionRange,
          supported: true,
          confidence: 0.8,
          evidence: [`project file: ${marker}`],
          kind: definition.kind,
        });
      }
    }
  }

  return found.sort((left, right) => right.confidence - left.confidence);
}

/**
 * Whether a module path belongs to a framework whose routes are read by the
 * analyzer. Used to decide if a file deserves the framework passes at all.
 */
export function isPythonWebFramework(id: PythonFrameworkId): boolean {
  return PYTHON_FRAMEWORKS.find((item) => item.id === id)?.kind === 'web';
}
