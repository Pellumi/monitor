import {
  ApplicationArchitectureProjectionSchema,
  frameworkSdkSupport,
  type ApplicationArchitectureProjection,
  type ApplicationTraits,
  type ApplicationType,
  type ArchitectureConfidence,
  type DetectedFramework,
  type SdkTrack,
} from '@tellann/desktop-contracts';
import { canonicalRoute } from './frameworks';
import type { PackageBoundary } from './inventory';

// ─────────────────────────────────────────────────────────────
// Application architecture detection (doc §8–§9, §40).
//
// Deterministic and projection-only. The detector reads manifest names, file
// paths, canonical route templates and a few AST-derived flags. It never reads
// file contents, so the output cannot carry source text, literals or secrets.
// ─────────────────────────────────────────────────────────────

export const DETECTOR_VERSION = '1';

/** A type counts as present only when its side clears this floor. One weak signal cannot flip the type. */
const PRESENCE_FLOOR = 40;
/** Confidence threshold for a decisive classification. */
const DECISIVE = 60;

/** Dependency name -> framework id, per side. Versions are read from the manifest. */
const FRONTEND_DEPENDENCIES: Record<string, string> = {
  react: 'react',
  'react-dom': 'react',
  next: 'next',
  vue: 'vue',
  '@angular/core': 'angular',
};

const BACKEND_DEPENDENCIES: Record<string, string> = {
  express: 'express',
  fastify: 'fastify',
  '@nestjs/core': 'nestjs',
  django: 'django',
  flask: 'flask',
  fastapi: 'fastapi',
};

const CLIENT_ROUTER_DEPENDENCIES = ['react-router', 'react-router-dom', 'vue-router', '@angular/router'];
const STATE_LIBRARY_DEPENDENCIES = [
  'redux', '@reduxjs/toolkit', 'zustand', 'mobx', 'pinia', 'vuex', '@ngrx/store', 'jotai', 'recoil',
];
const HTTP_CLIENT_DEPENDENCIES = ['axios', 'swr', '@tanstack/react-query', 'ky', 'got', 'ofetch'];

const BROWSER_ENTRY = /(^|\/)(src\/)?(index|main|App|_app|root)\.(jsx|tsx)$|(^|\/)app\/(page|layout)\.(jsx|tsx)$|(^|\/)pages\/[^/]+\.(jsx|tsx)$/;
const SERVER_ENTRY = /(^|\/)(server|app|main)\.(ts|js|mjs|cjs|py)$/;
const ROUTE_HANDLER_FILE = /(^|\/)app\/.*\/route\.(ts|js|mjs)$|(^|\/)pages\/api\/.+\.(ts|js|mjs)$/;
const SERVER_TOPOLOGY = /(^|\/)(controllers|routes|middleware)\/[^/]+\.(ts|js|mjs|cjs|py)$/;
// Component sources across React, Vue, Svelte and Angular.
const COMPONENT_SOURCE = /\.(jsx|tsx|vue|svelte)$|\.component\.ts$/;

export interface ApplicationSignals {
  /** Client code issues HTTP calls (fetch/XHR). Defaults to true when the AST pass has not reported. */
  consumesHttpApi?: boolean;
  /** A `'use server'` directive or server action was found. */
  useServerDirective?: boolean;
  /** Server-side rendering was found. Defaults to Next.js being present on a server runtime. */
  serverRendering?: boolean;
}

export interface ApplicationProfileInput {
  /** Repository-relative workspace root, or "." for the whole repository (doc §38). */
  workspaceRoot: string;
  /** Package boundaries from the inventory. Both ecosystems. */
  packages: PackageBoundary[];
  /** Repository-relative analysable source files, from the inventory. */
  files: string[];
  /** Raw route paths from endpoint entities. Canonicalised here. */
  routeTemplates?: string[];
  signals?: ApplicationSignals;
  analysisSnapshotId: string;
}

interface Signal {
  name: string;
  weight: number;
  side: 'frontend' | 'backend';
}

function inside(candidate: string, root: string): boolean {
  if (root === '.' || root === '') return true;
  return candidate === root || candidate.startsWith(`${root}/`);
}

function dependencyVersions(packages: PackageBoundary[]): Map<string, string> {
  const versions = new Map<string, string>();
  for (const pkg of packages) {
    for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      const key = pkg.ecosystem === 'python' ? name.toLowerCase() : name;
      if (!versions.has(key)) versions.set(key, version);
    }
  }
  return versions;
}

function cleanVersion(version: string | undefined): string | null {
  if (!version) return null;
  const trimmed = version.trim().replace(/^[\^~>=<\s]+/, '');
  return trimmed ? trimmed.slice(0, 64) : null;
}

function collectSignals(
  versions: Map<string, string>,
  files: string[],
  routeTemplates: string[],
): Signal[] {
  const found: Signal[] = [];

  for (const dependency of Object.keys(FRONTEND_DEPENDENCIES)) {
    if (versions.has(dependency)) found.push({ name: `dependency:${dependency}`, weight: 25, side: 'frontend' });
  }
  for (const dependency of Object.keys(BACKEND_DEPENDENCIES)) {
    if (versions.has(dependency)) found.push({ name: `dependency:${dependency}`, weight: 25, side: 'backend' });
  }

  if (files.some((file) => BROWSER_ENTRY.test(file))) {
    found.push({ name: 'browser-entrypoint', weight: 25, side: 'frontend' });
  }
  const jsxFiles = files.filter((file) => COMPONENT_SOURCE.test(file));
  if (jsxFiles.length > 0) found.push({ name: 'component-sources', weight: 15, side: 'frontend' });

  if (CLIENT_ROUTER_DEPENDENCIES.some((dependency) => versions.has(dependency)) || versions.has('next')) {
    found.push({ name: 'client-router', weight: 20, side: 'frontend' });
  }

  // A server entrypoint is only evidence when it does not sit beside browser components.
  const jsxDirectories = new Set(jsxFiles.map((file) => file.slice(0, Math.max(0, file.lastIndexOf('/')))));
  const serverEntry = files.find((file) => {
    if (!SERVER_ENTRY.test(file)) return false;
    const directory = file.slice(0, Math.max(0, file.lastIndexOf('/')));
    return !jsxDirectories.has(directory);
  });
  if (serverEntry) found.push({ name: 'server-entrypoint', weight: 25, side: 'backend' });

  if (routeTemplates.length > 0) found.push({ name: 'http-routes', weight: 30, side: 'backend' });
  if (files.some((file) => ROUTE_HANDLER_FILE.test(file))) {
    found.push({ name: 'route-handler-files', weight: 40, side: 'backend' });
  }
  if (files.some((file) => SERVER_TOPOLOGY.test(file))) {
    found.push({ name: 'server-topology', weight: 15, side: 'backend' });
  }

  return found;
}

function sideScore(signals: Signal[], side: Signal['side']): number {
  const total = signals.filter((signal) => signal.side === side).reduce((sum, signal) => sum + signal.weight, 0);
  return Math.min(100, total);
}

function classify(frontend: number, backend: number): { type: ApplicationType; confidence: ArchitectureConfidence } {
  const frontendPresent = frontend >= PRESENCE_FLOOR;
  const backendPresent = backend >= PRESENCE_FLOOR;
  if (frontendPresent && backendPresent) {
    return { type: 'MIXED', confidence: Math.min(frontend, backend) >= DECISIVE ? 'HIGH' : 'MEDIUM' };
  }
  if (frontendPresent) {
    const decisive = frontend >= DECISIVE && backend < PRESENCE_FLOOR - 15;
    return { type: 'FRONTEND', confidence: decisive ? 'HIGH' : 'MEDIUM' };
  }
  if (backendPresent) {
    const decisive = backend >= DECISIVE && frontend < PRESENCE_FLOOR - 15;
    return { type: 'BACKEND', confidence: decisive ? 'HIGH' : 'MEDIUM' };
  }
  return { type: 'UNKNOWN', confidence: 'LOW' };
}

/** Tracks whose only detected frameworks lack SDK support. Feeds the resolver's unsupportedTracks. */
export function unsupportedSdkTracks(frameworks: Array<{ id: string }>): SdkTrack[] {
  const byTrack = new Map<SdkTrack, { supported: boolean; planned: boolean }>();
  for (const framework of frameworks) {
    const support = frameworkSdkSupport(framework.id);
    if (!support) continue;
    const entry = byTrack.get(support.track) ?? { supported: false, planned: false };
    if (support.status === 'SUPPORTED') entry.supported = true;
    else entry.planned = true;
    byTrack.set(support.track, entry);
  }
  return [...byTrack.entries()]
    .filter(([, entry]) => entry.planned && !entry.supported)
    .map(([track]) => track);
}

/**
 * Derives the projection from the inventory. Pure: the same inputs always give the same
 * projection, and the result is validated against the shared contract before it is returned.
 */
export function detectApplicationProfile(input: ApplicationProfileInput): ApplicationArchitectureProjection {
  // Candidates come from every package in the repository, so a user can choose among them.
  const workspaceCandidates = input.packages.length > 1
    ? [...new Set(input.packages.map((pkg) => pkg.root).filter((root) => root !== '.'))].sort().slice(0, 200)
    : [];
  const packages = input.packages.filter((pkg) => inside(pkg.root, input.workspaceRoot));
  const files = input.files.filter((file) => inside(file, input.workspaceRoot));
  const routeTemplates = [...new Set((input.routeTemplates ?? []).map(canonicalRoute))].sort().slice(0, 2_000);
  const versions = dependencyVersions(packages);
  const signals = input.signals ?? {};

  const found = collectSignals(versions, files, routeTemplates);
  const frontendScore = sideScore(found, 'frontend');
  const backendScore = sideScore(found, 'backend');
  const { type, confidence } = classify(frontendScore, backendScore);

  const has = (name: string) => found.some((signal) => signal.name === name);
  const frontendPresent = frontendScore >= PRESENCE_FLOOR;
  const backendPresent = backendScore >= PRESENCE_FLOOR;
  const serverRouteFiles = files.filter((file) => ROUTE_HANDLER_FILE.test(file));

  // Frameworks: detected from manifests, with the SDK registry deciding support.
  const frameworks: DetectedFramework[] = [];
  const seen = new Set<string>();
  for (const [dependency, id] of [...Object.entries(FRONTEND_DEPENDENCIES), ...Object.entries(BACKEND_DEPENDENCIES)]) {
    if (!versions.has(dependency) || seen.has(id)) continue;
    seen.add(id);
    frameworks.push({
      id,
      version: cleanVersion(versions.get(dependency)),
      sdkSupport: frameworkSdkSupport(id)?.status ?? 'UNKNOWN_FRAMEWORK',
    });
  }

  const apiProvider = routeTemplates.length > 0 || serverRouteFiles.length > 0;
  const backendRuntime = backendPresent || apiProvider;
  const browserSurface = frontendPresent;

  const traits: ApplicationTraits = {
    browserSurface,
    frontendRuntime: browserSurface,
    backendRuntime,
    clientRouting: has('client-router'),
    uiStateSurface: STATE_LIBRARY_DEPENDENCIES.some((dependency) => versions.has(dependency)),
    // Without an AST report, assume a browser app calls an API. Endpoint Intelligence then
    // shows Limited, rather than wrongly declaring the app not applicable.
    apiConsumer: browserSurface && (
      (signals.consumesHttpApi ?? true) || HTTP_CLIENT_DEPENDENCIES.some((dependency) => versions.has(dependency))
    ),
    apiProvider,
    serverActions: signals.useServerDirective === true,
    serverRendering: signals.serverRendering ?? (versions.has('next') && backendRuntime),
    managedBrowserRunnable: browserSurface && packages.some(
      (pkg) => pkg.scripts.dev !== undefined || pkg.scripts.start !== undefined,
    ),
  };

  const warnings: string[] = [];
  if (packages.length === 0) warnings.push('No package manifest was found in the selected workspace.');
  if (type === 'UNKNOWN') warnings.push('No frontend or backend signals reached the detection threshold.');
  if (backendRuntime && routeTemplates.length === 0 && serverRouteFiles.length === 0) {
    warnings.push('A server runtime was detected but no route templates were resolved.');
  }
  for (const framework of frameworks) {
    if (framework.sdkSupport === 'PLANNED') {
      warnings.push(`${framework.id} is detected, but Tellann cannot instrument it yet.`);
    }
  }

  const projection = {
    detectedType: type,
    confidence,
    scores: { frontend: frontendScore, backend: backendScore },
    traits,
    frameworks,
    routeTemplates,
    workspaceRoot: input.workspaceRoot,
    analysisSnapshotId: input.analysisSnapshotId,
    detectorVersion: DETECTOR_VERSION,
    warnings: warnings.slice(0, 100),
    workspaceCandidates,
  };
  return ApplicationArchitectureProjectionSchema.parse(projection);
}
