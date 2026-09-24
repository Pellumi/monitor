import { CodebaseAnalysisStatus, PrismaClient } from '@tellann/db';
import {
  draftFindingResolutions,
  type FindingCodeRef,
  type FindingResolution,
  type FindingResolutionBundle,
  type DraftResolutionOptions,
} from '@tellann/ai';

/**
 * Resolution summaries for a backend run's findings.
 *
 * A finding such as `GET /schools/<int:pk>/analytics/ returned 403` names an
 * endpoint and little else. Everything that explains it is elsewhere: the
 * requests the run captured for that endpoint, the models they touched, and the
 * code that handles the route. This gathers those into one bounded bundle per
 * finding for the AI service to read.
 *
 * What is gathered is what the run already stores, in the form it stores it.
 * Request and response bodies are the masked shapes the ingestion pipeline
 * persisted; decrypted values are never read here. Code is described by symbol,
 * file and line range from the stored analysis, not by its source text.
 */

export type EvidenceEventRow = {
  id: string;
  eventType: string;
  occurredAt: Date | string;
  metadata: unknown;
};

export type FindingRow = {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string | null;
  dedupeKey: string | null;
};

type Loose = Record<string, unknown>;
const record = (value: unknown): Loose =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Loose : {};
const text = (value: unknown, limit = 300): string | null => {
  if (value === null || value === undefined) return null;
  const out = String(value).trim();
  return out ? out.slice(0, limit) : null;
};
const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const iso = (value: Date | string): string | null => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * Mirrors `canonicalRoute` in @tellann/project-intelligence, which named the
 * endpoints in the stored analysis. A runtime template such as
 * `/schools/<int:pk>/analytics/` and the analysed `/schools/{param}/analytics`
 * are the same endpoint only after both are reduced the same way.
 */
export function canonicalRoute(input: string): string {
  let route = input.trim();
  if (!route.startsWith('/')) route = `/${route}`;
  route = route.replace(/[?#].*$/, '');
  route = route.replace(/\/+$/, '') || '/';
  route = route
    .replace(/\[\.{3}[^\]]+\]/g, '{param}')
    .replace(/\[\[?([^\]]+)\]?\]/g, '{param}')
    .replace(/:[A-Za-z0-9_]+/g, '{param}')
    .replace(/\{[^}]*\}/g, '{param}')
    .replace(/\$\{[^}]*\}/g, '{param}')
    .replace(/<[^>]*>/g, '{param}');
  return route.toLowerCase();
}

export type FindingTarget = { method: string | null; route: string; status: number | null };

/**
 * The endpoint a backend finding is about, recovered from how the desktop keyed
 * it. The finding row carries no link to its request events, so the key and the
 * title are all there is.
 */
export function parseFindingTarget(finding: Pick<FindingRow, 'category' | 'title' | 'dedupeKey'>): FindingTarget | null {
  const key = finding.dedupeKey ?? '';
  const routeAndStatus = /^backend:([A-Za-z]+):(\/.*):(\d{3})$/.exec(key);
  if (routeAndStatus) return { method: routeAndStatus[1].toUpperCase(), route: routeAndStatus[2], status: Number(routeAndStatus[3]) };
  const slow = /^backend-slow:([A-Za-z]+) (\/.*)$/.exec(key);
  if (slow) return { method: slow[1].toUpperCase(), route: slow[2], status: null };
  const unhandled = /^backend-error:(\/.*):([^:]+)$/.exec(key);
  if (unhandled) return { method: null, route: unhandled[1], status: null };
  const titled = /^([A-Z]+) (\/\S*) (?:returned (\d{3})|took )/.exec(finding.title);
  if (titled) return { method: titled[1], route: titled[2], status: titled[3] ? Number(titled[3]) : null };
  const unhandledTitle = /^Unhandled server error on (\/\S*)/.exec(finding.title);
  if (unhandledTitle) return { method: null, route: unhandledTitle[1], status: null };
  return null;
}

function sameEndpoint(metadata: Loose, target: FindingTarget): boolean {
  const route = text(metadata.route) ?? text(metadata.path);
  if (!route) return false;
  if (canonicalRoute(route) !== canonicalRoute(target.route)) return false;
  const method = text(metadata.method, 12);
  return !target.method || !method || method.toUpperCase() === target.method;
}

// ── Code context ──────────────────────────────────────────────────────────

type AnalysisEntity = { id: string; type: string; name: string; path: string | null; startLine: number | null; endLine: number | null; metadata: Loose };
type AnalysisRelationship = { source: string; target: string; type: string };
type AnalysisFeature = {
  entrypoints: string[]; workflow: Array<{ label: string }>; reads: string[]; writes: string[];
  authorization: string[]; sourceFiles: string[];
};
export type StoredAnalysis = {
  revision: string | null;
  entities: AnalysisEntity[];
  relationships: AnalysisRelationship[];
  features: AnalysisFeature[];
};

/** Reads only what is needed out of the stored analysis payload, ignoring anything malformed. */
export function readStoredAnalysis(payload: unknown): StoredAnalysis | null {
  const root = record(payload);
  if (!Array.isArray(root.entities) || !Array.isArray(root.relationships)) return null;
  const entities = root.entities.map((raw): AnalysisEntity => {
    const entity = record(raw);
    return {
      id: String(entity.id ?? ''), type: String(entity.type ?? ''), name: String(entity.name ?? ''),
      path: text(entity.path, 400), startLine: number(entity.startLine), endLine: number(entity.endLine),
      metadata: record(entity.metadata),
    };
  }).filter((entity) => entity.id);
  const relationships = root.relationships.map((raw): AnalysisRelationship => {
    const edge = record(raw);
    return { source: String(edge.source ?? ''), target: String(edge.target ?? ''), type: String(edge.type ?? '') };
  });
  const strings = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item)) : [];
  const features = (Array.isArray(root.features) ? root.features : []).map((raw): AnalysisFeature => {
    const feature = record(raw);
    return {
      entrypoints: strings(feature.entrypoints),
      workflow: (Array.isArray(feature.workflow) ? feature.workflow : []).map((step) => ({ label: String(record(step).label ?? '') })),
      reads: strings(feature.reads), writes: strings(feature.writes),
      authorization: strings(feature.authorization), sourceFiles: strings(feature.sourceFiles),
    };
  });
  return { revision: text(root.revision, 80), entities, relationships, features };
}

const CODE_TYPES = new Set(['function', 'method', 'class']);
const MAX_CALLEES = 6;

/**
 * Where in the codebase an endpoint is handled: its route registration, its
 * handler and what that handler calls, plus the authorization signals and call
 * path the analysis found for the feature it belongs to.
 */
export function buildCodeContext(
  analysis: StoredAnalysis,
  target: FindingTarget,
  hints: { handler: string | null; repositoryRevision: string | null },
): NonNullable<FindingResolutionBundle['code']> | null {
  const byId = new Map(analysis.entities.map((entity) => [entity.id, entity]));
  const wanted = canonicalRoute(target.route);
  const endpoints = analysis.entities.filter((entity) => {
    if (entity.type !== 'endpoint' || entity.metadata.calledFromClient === true) return false;
    const route = text(entity.metadata.route);
    if (!route || canonicalRoute(route) !== wanted) return false;
    const method = text(entity.metadata.method, 12);
    return !target.method || !method || method.toUpperCase() === target.method;
  });

  const refs: FindingCodeRef[] = [];
  const seen = new Set<string>();
  const addRef = (entity: AnalysisEntity | undefined, role: string) => {
    if (!entity || seen.has(entity.id) || !entity.path || refs.length >= 10) return;
    seen.add(entity.id);
    refs.push({ id: `ref${refs.length + 1}`, role, name: entity.name, path: entity.path, startLine: entity.startLine, endLine: entity.endLine });
  };

  const handlers: AnalysisEntity[] = [];
  for (const endpoint of endpoints.slice(0, 2)) {
    addRef(endpoint, 'route registration');
    for (const edge of analysis.relationships) {
      if (edge.type !== 'ROUTES_TO' || edge.source !== endpoint.id) continue;
      const handler = byId.get(edge.target);
      if (handler && CODE_TYPES.has(handler.type)) handlers.push(handler);
    }
  }
  // The route may not have been resolved to a handler; the SDK reports the
  // handler it actually ran, which is the next best anchor.
  if (!handlers.length && hints.handler) {
    const last = hints.handler.split(/[.:/\\]/).filter(Boolean).at(-1);
    if (last) {
      for (const entity of analysis.entities) {
        if (CODE_TYPES.has(entity.type) && entity.name.split('.').at(-1) === last) handlers.push(entity);
        if (handlers.length >= 2) break;
      }
    }
  }
  if (!endpoints.length && !handlers.length) return null;

  for (const handler of handlers.slice(0, 2)) addRef(handler, 'handler');

  const handlerIds = new Set(handlers.map((handler) => handler.id));
  const callees: AnalysisEntity[] = [];
  for (const edge of analysis.relationships) {
    if (edge.type !== 'CALLS' || !handlerIds.has(edge.source)) continue;
    const callee = byId.get(edge.target);
    if (callee && CODE_TYPES.has(callee.type) && !handlerIds.has(callee.id)) callees.push(callee);
    if (callees.length >= MAX_CALLEES) break;
  }
  for (const callee of callees) addRef(callee, 'called by the handler');

  const scope = new Set([...handlerIds, ...callees.map((callee) => callee.id)]);
  const reads = new Set<string>();
  const writes = new Set<string>();
  const tests = new Set<string>();
  for (const edge of analysis.relationships) {
    if ((edge.type === 'READS' || edge.type === 'WRITES') && scope.has(edge.source)) {
      const model = byId.get(edge.target);
      if (model && (model.type === 'database_model' || model.type === 'database_table')) (edge.type === 'READS' ? reads : writes).add(model.name);
    }
    if (edge.type === 'TESTS' && handlerIds.has(edge.target)) {
      const test = byId.get(edge.source);
      if (test) tests.add(test.name);
    }
  }

  const endpointIds = new Set(endpoints.map((endpoint) => endpoint.id));
  const feature = analysis.features.find((item) => item.entrypoints.some((id) => endpointIds.has(id)));

  return {
    refs,
    authorization: (feature?.authorization ?? []).slice(0, 8),
    workflow: (feature?.workflow ?? []).map((step) => step.label).filter((label) => label && !/^(file|package|module):/i.test(label)).slice(0, 15),
    reads: [...new Set([...reads, ...(feature?.reads ?? [])])].slice(0, 15),
    writes: [...new Set([...writes, ...(feature?.writes ?? [])])].slice(0, 15),
    tests: [...tests].slice(0, 8),
    revision: analysis.revision,
    matchesRun: analysis.revision && hints.repositoryRevision ? analysis.revision === hints.repositoryRevision : null,
  };
}

// ── Bundles ───────────────────────────────────────────────────────────────

const REQUEST_SAMPLES = 3;
const ERROR_SAMPLES = 3;
const DATA_SAMPLES = 15;

export function buildResolutionBundle(
  finding: FindingRow,
  events: EvidenceEventRow[],
  analysis: StoredAnalysis | null,
  repositoryRevision: string | null,
): FindingResolutionBundle | null {
  const target = parseFindingTarget(finding);
  if (!target) return null;

  const matching = events
    .filter((event) => event.eventType === 'QA_BACKEND_REQUEST' && sameEndpoint(record(event.metadata), target));
  // The sample shows the behaviour the finding is about, not just any call to
  // the same route: the failing status for an error, the slowest for a slow one.
  const relevant = target.status !== null
    ? matching.filter((event) => number(record(event.metadata).statusCode) === target.status)
    : matching;
  const pool = relevant.length ? relevant : matching;
  const sampled = [...pool]
    .sort((left, right) => finding.category === 'BACKEND_SLOW_RESPONSE'
      ? (number(record(right.metadata).durationMs) ?? 0) - (number(record(left.metadata).durationMs) ?? 0)
      : 0)
    .slice(0, REQUEST_SAMPLES);

  const requests = sampled.map((event) => {
    const metadata = record(event.metadata);
    return {
      at: iso(event.occurredAt),
      method: text(metadata.method, 12),
      route: text(metadata.route) ?? text(metadata.path),
      statusCode: number(metadata.statusCode),
      durationMs: number(metadata.durationMs),
      handler: text(metadata.handler, 200),
      framework: text(metadata.framework, 60),
      requestBytes: number(metadata.requestBytes),
      responseBytes: number(metadata.responseBytes),
      models: (Array.isArray(metadata.models) ? metadata.models : [])
        .map((entry) => text(record(entry).model ?? entry, 120)).filter((name): name is string => Boolean(name)).slice(0, 20),
      query: metadata.query ?? undefined,
      requestBody: metadata.requestBody ?? undefined,
      responseBody: metadata.responseBody ?? undefined,
    };
  });

  const errors = events
    .filter((event) => event.eventType === 'QA_BACKEND_ERROR' && sameEndpoint(record(event.metadata), target))
    .slice(0, ERROR_SAMPLES)
    .map((event) => {
      const metadata = record(event.metadata);
      return {
        at: iso(event.occurredAt), name: text(metadata.name, 200), message: text(metadata.message, 600),
        route: text(metadata.route), method: text(metadata.method, 12),
      };
    });

  const operations = new Map<string, { model: string; operation: string; mutation: boolean; records: number | null; count: number }>();
  for (const event of events) {
    if (event.eventType !== 'QA_BACKEND_DATA_ACCESS') continue;
    const metadata = record(event.metadata);
    if (!sameEndpoint(metadata, target)) continue;
    const model = text(metadata.model, 120);
    if (!model) continue;
    const operation = text(metadata.operation, 60) ?? 'unknown';
    const mutation = metadata.mutation === true;
    const key = `${model}:${operation}:${mutation}`;
    const count = Math.max(1, Math.round(number(metadata.count) ?? 1));
    const records = number(metadata.records);
    const existing = operations.get(key);
    if (existing) {
      existing.count += count;
      if (records !== null) existing.records = (existing.records ?? 0) + records;
    } else if (operations.size < DATA_SAMPLES) {
      operations.set(key, { model, operation, mutation, records, count });
    }
  }

  const handler = requests.find((request) => request.handler)?.handler ?? null;
  const code = analysis ? buildCodeContext(analysis, target, { handler, repositoryRevision }) : null;

  return {
    findingId: finding.id,
    title: finding.title,
    category: finding.category,
    severity: finding.severity,
    description: finding.description,
    recommendation: finding.recommendation,
    endpoint: { method: target.method ?? requests[0]?.method ?? 'GET', route: target.route },
    occurrences: matching.length,
    requests,
    errors,
    dataOperations: [...operations.values()],
    code,
  };
}

// ── Orchestration ─────────────────────────────────────────────────────────

const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

export type ResolutionOutcome = {
  byFindingId: Map<string, FindingResolution>;
  status: string;
  provider: string | null;
  model: string | null;
  drafted: number;
  discarded: number;
  /** Whether stored source analysis was available to anchor the findings. */
  codeContext: boolean;
};

export const NO_RESOLUTIONS: ResolutionOutcome = {
  byFindingId: new Map(), status: 'NOT_RUN', provider: null, model: null, drafted: 0, discarded: 0, codeContext: false,
};

/**
 * The stored analysis closest to the code the run executed against: the one
 * taken from the run's own repository snapshot when there is one, otherwise the
 * application's most recent finished analysis. A run with neither simply has no
 * code context, and the reading is made from the requests alone.
 */
async function loadStoredAnalysis(
  prisma: PrismaClient,
  run: { applicationId: string; repositorySnapshotId: string | null },
): Promise<StoredAnalysis | null> {
  const finished = { in: [CodebaseAnalysisStatus.COMPLETED, CodebaseAnalysisStatus.PARTIAL] };
  const select = { projections: { where: { kind: 'analysis' }, select: { payload: true } } } as const;
  const scoped = run.repositorySnapshotId
    ? await prisma.codebaseAnalysisJob.findFirst({
        where: { applicationId: run.applicationId, status: finished, codebaseSnapshot: { repositorySnapshotId: run.repositorySnapshotId } },
        orderBy: { completedAt: 'desc' },
        select,
      })
    : null;
  const job = scoped ?? await prisma.codebaseAnalysisJob.findFirst({
    where: { applicationId: run.applicationId, status: finished },
    orderBy: { completedAt: 'desc' },
    select,
  });
  return readStoredAnalysis(job?.projections[0]?.payload);
}

export async function draftBackendFindingResolutions(
  prisma: PrismaClient,
  input: {
    run: { applicationId: string; repositorySnapshotId: string | null; repositoryRevision: string | null };
    findings: FindingRow[];
    events: EvidenceEventRow[];
    ai?: DraftResolutionOptions;
  },
): Promise<ResolutionOutcome> {
  const candidates = input.findings
    .filter((finding) => finding.category.startsWith('BACKEND_'))
    .sort((left, right) => (severityRank[left.severity] ?? 99) - (severityRank[right.severity] ?? 99));
  if (!candidates.length) return { ...NO_RESOLUTIONS, status: 'NO_BACKEND_FINDINGS' };

  const analysis = await loadStoredAnalysis(prisma, input.run).catch(() => null);
  const bundles = candidates
    .map((finding) => buildResolutionBundle(finding, input.events, analysis, input.run.repositoryRevision))
    .filter((bundle): bundle is FindingResolutionBundle => bundle !== null);
  if (!bundles.length) return { ...NO_RESOLUTIONS, status: 'NO_MATCHING_EVIDENCE' };

  const result = await draftFindingResolutions(bundles, input.ai);
  const codeContext = bundles.some((bundle) => bundle.code !== null);
  return {
    byFindingId: new Map(result.resolutions.map((resolution) => [resolution.findingId, resolution])),
    status: result.unavailable
      ? `UNAVAILABLE:${result.unavailable}`
      : `READY:${result.provider}:${result.model}${result.discarded ? `:discarded=${result.discarded}` : ''}`,
    provider: result.provider,
    model: result.model,
    drafted: result.resolutions.length,
    discarded: result.discarded,
    codeContext,
  };
}
