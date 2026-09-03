import {
  memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState,
} from 'react';
import type {
  AnalysisComparison, CodebaseAnalysis, CodebaseFinding, CodeEntity, CodeEvidence,
  CodeRelationship, SoftwareFeature,
} from '@tellann/desktop-contracts';
import {
  AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Info, Loader2,
  RefreshCw, Search, Workflow, X,
} from 'lucide-react';
import { CodebaseGraphExplorer } from './codebase-graph-explorer';

type View =
  | 'overview' | 'hierarchy' | 'architecture' | 'dependencies' | 'features'
  | 'graph' | 'apis' | 'data' | 'external' | 'risks' | 'changes' | 'ask';

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'hierarchy', label: 'Hierarchy' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'features', label: 'Features' },
  { id: 'graph', label: 'Graph Explorer' },
  { id: 'apis', label: 'APIs & UI' },
  { id: 'data', label: 'Data & Events' },
  { id: 'external', label: 'External Systems' },
  { id: 'risks', label: 'Risks' },
  { id: 'changes', label: 'Changes' },
  { id: 'ask', label: 'Ask' },
];

const ACTIVE = new Set([
  'QUEUED', 'INGESTING', 'PARSING', 'LINKING', 'GRAPHING',
  'DISCOVERING_FEATURES', 'ANALYZING_ARCHITECTURE', 'SUMMARIZING',
]);

const STAGE_LABEL: Record<string, string> = {
  QUEUED: 'Queued', INGESTING: 'Reading the snapshot', PARSING: 'Parsing source',
  LINKING: 'Resolving references', GRAPHING: 'Building the graph',
  DISCOVERING_FEATURES: 'Discovering functionality',
  ANALYZING_ARCHITECTURE: 'Analysing architecture', SUMMARIZING: 'Preparing views',
};

// ── Shared pieces ────────────────────────────────────────────────────────────

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="analysis-metric" title={hint}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const tier = value >= 0.9 ? 'high' : value >= 0.7 ? 'medium' : 'low';
  const explanation = value >= 0.9
    ? 'Resolved by the compiler or a framework contract.'
    : value >= 0.7
      ? 'Read from syntax or corroborated documentation.'
      : 'Inferred from naming or directory layout. Verify before relying on it.';
  return <span className={`analysis-confidence tier-${tier}`} title={explanation}>{Math.round(value * 100)}%</span>;
}

/** Opens the exact file and line through the main process, which validates it. */
function useEvidenceOpener(applicationId: string) {
  return useCallback(async (evidence: Pick<CodeEvidence, 'path' | 'startLine'>) => {
    const result = await window.tellann?.projects?.openCodebaseEvidence?.({
      applicationId,
      path: evidence.path,
      line: evidence.startLine ?? 1,
    });
    if (result && !result.opened) {
      console.warn('[codebase-analysis] Could not open evidence:', result.reason);
    }
  }, [applicationId]);
}

function EvidenceLink({ item, onOpen }: { item: CodeEvidence; onOpen: (item: CodeEvidence) => void }) {
  return (
    <button className="analysis-evidence" onClick={() => void onOpen(item)} title={`${item.analyzer} · ${Math.round(item.confidence * 100)}% confidence`}>
      <ExternalLink size={12} />
      {item.path}{item.startLine ? `:${item.startLine}` : ''}
    </button>
  );
}

/**
 * Evidence for one claim. Everything the analysis asserts can be opened here and
 * then in the editor, which is what makes a low-confidence inference checkable
 * rather than something to take on trust.
 */
function EvidenceDrawer({
  title, subject, evidence, onClose, onOpen,
}: {
  title: string;
  subject: string;
  evidence: CodeEvidence[];
  onClose: () => void;
  onOpen: (item: CodeEvidence) => void;
}) {
  return (
    <aside className="analysis-drawer" aria-label="Evidence">
      <header>
        <div>
          <span className="analysis-kicker">{title}</span>
          <h3>{subject}</h3>
        </div>
        <button onClick={onClose} aria-label="Close evidence"><X size={16} /></button>
      </header>
      {evidence.length ? (
        <ol className="analysis-evidence-list">
          {evidence.map((item, index) => (
            <li key={`${item.path}:${item.startLine}:${index}`}>
              <div className="analysis-evidence-head">
                <span>{item.kind.replaceAll('-', ' ')}</span>
                <ConfidenceBadge value={item.confidence} />
              </div>
              <EvidenceLink item={item} onOpen={onOpen} />
              <small>Analyzer: {item.analyzer}</small>
              {item.excerpt ? <pre>{item.excerpt}</pre> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="analysis-empty">
          This is a derived result with no single source location. It follows from the relationships
          shown in the graph rather than from one line of code.
        </p>
      )}
    </aside>
  );
}

/**
 * Windowed list. Repositories reach tens of thousands of entities, and rendering
 * them all is what makes an Electron view freeze.
 */
function VirtualList<T>({
  items, rowHeight = 58, height = 460, render, empty,
}: {
  items: T[];
  rowHeight?: number;
  height?: number;
  render: (item: T, index: number) => React.ReactNode;
  empty: string;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setScrollTop(0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [items]);

  if (!items.length) return <p className="analysis-empty">{empty}</p>;

  const overscan = 6;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visible = Math.ceil(height / rowHeight) + overscan * 2;
  const slice = items.slice(start, start + visible);

  return (
    <div
      ref={containerRef}
      className="analysis-virtual"
      style={{ height }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * rowHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${start * rowHeight}px)` }}>
          {slice.map((item, index) => (
            <div key={start + index} style={{ height: rowHeight }}>{render(item, start + index)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

const EntityRow = memo(function EntityRow({
  entity, onEvidence,
}: {
  entity: CodeEntity;
  onEvidence: (entity: CodeEntity) => void;
}) {
  return (
    <article className="analysis-list-row">
      <div>
        <span className="analysis-type">{entity.type.replaceAll('_', ' ')}</span>
        <strong>{entity.name}</strong>
        {entity.path ? <small>{entity.path}{entity.startLine ? `:${entity.startLine}` : ''}</small> : null}
      </div>
      <ConfidenceBadge value={entity.confidence} />
      <button className="analysis-inline-button" onClick={() => onEvidence(entity)}>Evidence</button>
    </article>
  );
});

// ── Views ────────────────────────────────────────────────────────────────────

function OverviewView({
  analysis, onGoTo,
}: {
  analysis: CodebaseAnalysis;
  onGoTo: (view: View) => void;
}) {
  const coverage = analysis.coverage;
  const architecture = analysis.architecture;
  const languages = Object.entries(coverage?.languageBytes ?? {})
    .sort(([, left], [, right]) => right - left)
    .slice(0, 6);
  const totalBytes = languages.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;

  const confidenceBuckets = useMemo(() => {
    const buckets = { high: 0, medium: 0, low: 0 };
    for (const entity of analysis.entities) {
      if (entity.confidence >= 0.9) buckets.high += 1;
      else if (entity.confidence >= 0.7) buckets.medium += 1;
      else buckets.low += 1;
    }
    return buckets;
  }, [analysis.entities]);
  const totalEntities = analysis.entities.length || 1;

  return (
    <>
      <div className="analysis-metrics">
        <Metric label="Source files" value={analysis.summary.files} />
        <Metric label="Symbols" value={analysis.summary.symbols} />
        <Metric label="Relationships" value={analysis.summary.relationships} />
        <Metric label="Features" value={analysis.summary.features} />
        <Metric label="Endpoints" value={analysis.summary.endpoints} />
        <Metric label="Domains" value={analysis.summary.domains} />
        <Metric
          label="Coverage"
          value={`${analysis.summary.coveragePercent}%`}
          hint="Share of files the deep analyzers actually reached, counted in files."
        />
      </div>

      <div className="analysis-overview-grid">
        <section>
          <h3>Snapshot</h3>
          <dl className="analysis-facts">
            <div><dt>Revision</dt><dd>{analysis.revision ? analysis.revision.slice(0, 10) : 'no git history'}</dd></div>
            <div><dt>Branch</dt><dd>{analysis.branch ?? '—'}</dd></div>
            <div><dt>Working tree</dt><dd>{analysis.dirty ? 'has uncommitted changes' : 'clean'}</dd></div>
            <div><dt>Graph version</dt><dd>{analysis.graphVersion.slice(0, 12)}</dd></div>
            <div><dt>Analyzer</dt><dd>{analysis.analyzerVersions.coordinator ?? '—'}</dd></div>
          </dl>

          <h3>Languages</h3>
          <div className="analysis-language-bar" role="img" aria-label="Language distribution">
            {languages.map(([language, bytes]) => (
              <span
                key={language}
                style={{ width: `${(bytes / totalBytes) * 100}%` }}
                title={`${language}: ${Math.round((bytes / totalBytes) * 100)}%`}
                className={`lang-${language.toLowerCase().replace(/[^a-z]/g, '')}`}
              />
            ))}
          </div>
          <ul className="analysis-legend">
            {languages.map(([language, bytes]) => (
              <li key={language}>
                <span className={`lang-${language.toLowerCase().replace(/[^a-z]/g, '')}`} />
                {language} {Math.round((bytes / totalBytes) * 100)}%
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Analysis coverage</h3>
          {coverage ? (
            <dl className="analysis-facts">
              <div>
                <dt>Files analysed</dt>
                <dd>{coverage.analyzedFiles} of {coverage.analyzableFiles}</dd>
              </div>
              <div>
                <dt>Calls resolved internally</dt>
                <dd title="Call sites reaching a declaration inside this repository.">
                  {Math.round(coverage.internalCallRatio * 100)}%
                </dd>
              </div>
              <div>
                <dt>Calls into dependencies</dt>
                <dd title="Resolved into a library. Correct, and deliberately not graphed.">
                  {Math.round(coverage.externalCallRatio * 100)}%
                </dd>
              </div>
              <div>
                <dt>Calls left unresolved</dt>
                <dd title="No declaration found: dynamic dispatch, injection, or untyped values.">
                  {Math.round(coverage.unresolvedCallRatio * 100)}%
                </dd>
              </div>
              {Object.keys(coverage.unsupportedLanguageFiles).length ? (
                <div>
                  <dt>Not deeply analysed</dt>
                  <dd>
                    {Object.entries(coverage.unsupportedLanguageFiles)
                      .map(([language, count]) => `${language} (${count})`).join(', ')}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : <p className="analysis-empty">Coverage was not recorded for this analysis.</p>}

          <h3>Evidence confidence</h3>
          <div className="analysis-confidence-bar" role="img" aria-label="Confidence distribution">
            <span className="tier-high" style={{ width: `${(confidenceBuckets.high / totalEntities) * 100}%` }} title={`${confidenceBuckets.high} compiler or framework resolved`} />
            <span className="tier-medium" style={{ width: `${(confidenceBuckets.medium / totalEntities) * 100}%` }} title={`${confidenceBuckets.medium} syntax or documentation`} />
            <span className="tier-low" style={{ width: `${(confidenceBuckets.low / totalEntities) * 100}%` }} title={`${confidenceBuckets.low} heuristic`} />
          </div>
          <p className="analysis-note">
            {confidenceBuckets.high} resolved, {confidenceBuckets.medium} from syntax, {confidenceBuckets.low} inferred.
          </p>
        </section>

        <section>
          <h3>Key findings</h3>
          {analysis.findings.length ? (
            <ul className="analysis-finding-summary">
              {Object.entries(
                analysis.findings.reduce<Record<string, number>>((totals, finding) => {
                  totals[finding.kind] = (totals[finding.kind] ?? 0) + 1;
                  return totals;
                }, {}),
              ).map(([kind, count]) => (
                <li key={kind}>
                  <button className="analysis-inline-button" onClick={() => onGoTo('risks')}>
                    {count} {kind.replaceAll('_', ' ').toLowerCase()}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="analysis-empty">No structural risks were detected.</p>}

          {architecture ? (
            <>
              <h3>Architecture</h3>
              <dl className="analysis-facts">
                <div><dt>Modules</dt><dd>{architecture.metrics.modules}</dd></div>
                <div><dt>Cycles</dt><dd>{architecture.metrics.cycles}</dd></div>
                <div><dt>Average fan-in</dt><dd>{architecture.metrics.averageFanIn}</dd></div>
                <div><dt>Never imported</dt><dd>{architecture.metrics.orphanModules} module(s)</dd></div>
              </dl>
            </>
          ) : null}

          <h3>Top functionality</h3>
          {analysis.features.slice(0, 6).map((feature) => (
            <button className="analysis-feature-link" key={feature.id} onClick={() => onGoTo('features')}>
              <Workflow size={14} />{feature.name}<ChevronRight size={14} />
            </button>
          ))}
        </section>
      </div>

      {analysis.warnings.length ? (
        <div className="analysis-warnings">
          {analysis.warnings.map((warning) => (
            <div className="analysis-warning" key={warning}><AlertTriangle size={15} />{warning}</div>
          ))}
        </div>
      ) : null}
    </>
  );
}

/** Lazy tree over CONTAINS/DEFINES, expanding only what the user opens. */
function HierarchyView({ analysis, onEvidence }: { analysis: CodebaseAnalysis; onEvidence: (entity: CodeEntity) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of analysis.relationships) {
      if (edge.type !== 'CONTAINS' && edge.type !== 'DEFINES') continue;
      const bucket = map.get(edge.source);
      if (bucket) bucket.push(edge.target);
      else map.set(edge.source, [edge.target]);
    }
    return map;
  }, [analysis.relationships]);

  const byId = useMemo(
    () => new Map<string, CodeEntity>(analysis.entities.map((entity) => [entity.id, entity])),
    [analysis.entities],
  );
  const roots = useMemo(() => {
    const repository = analysis.entities.filter((entity) => entity.type === 'repository');
    if (repository.length) return repository;
    return analysis.entities.filter((entity) => entity.type === 'application' || entity.type === 'service');
  }, [analysis.entities]);

  // Flattened to only what is currently open, so the row count stays small.
  const rows = useMemo(() => {
    const output: Array<{ entity: CodeEntity; depth: number; expandable: boolean }> = [];
    const walk = (ids: string[], depth: number) => {
      if (depth > 12) return;
      const entities = ids
        .map((id) => byId.get(id))
        .filter(Boolean) as CodeEntity[];
      entities.sort((left, right) =>
        (left.type < right.type ? -1 : left.type > right.type ? 1 : left.name.localeCompare(right.name)));
      for (const entity of entities) {
        const kids = childrenOf.get(entity.id) ?? [];
        output.push({ entity, depth, expandable: kids.length > 0 });
        if (expanded.has(entity.id)) walk(kids, depth + 1);
      }
    };
    walk(roots.map((entity) => entity.id), 0);
    return output;
  }, [roots, byId, childrenOf, expanded]);

  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <>
      <p className="analysis-note">
        {rows.length} row(s) shown. Branches load only when you open them.
      </p>
      <VirtualList
        items={rows}
        rowHeight={40}
        empty="The hierarchy is empty for this analysis."
        render={(row) => (
          <div className="analysis-tree-row" style={{ paddingLeft: 8 + row.depth * 18 }}>
            {row.expandable ? (
              <button className="analysis-tree-toggle" onClick={() => toggle(row.entity.id)} aria-expanded={expanded.has(row.entity.id)}>
                {expanded.has(row.entity.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : <span className="analysis-tree-spacer" />}
            <span className="analysis-type">{row.entity.type.replaceAll('_', ' ')}</span>
            <strong>{row.entity.name}</strong>
            <ConfidenceBadge value={row.entity.confidence} />
            <button className="analysis-inline-button" onClick={() => onEvidence(row.entity)}>Evidence</button>
          </div>
        )}
      />
    </>
  );
}

function ArchitectureView({
  analysis, onEvidence,
}: {
  analysis: CodebaseAnalysis;
  onEvidence: (entity: CodeEntity) => void;
}) {
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const domains = analysis.architecture?.domains ?? [];

  const membersOf = useMemo(() => {
    const map = new Map<string, CodeEntity[]>();
    const byId = new Map<string, CodeEntity>(analysis.entities.map((entity) => [entity.id, entity]));
    for (const edge of analysis.relationships) {
      if (edge.type !== 'BELONGS_TO_DOMAIN') continue;
      const entity = byId.get(edge.source);
      if (!entity || entity.type !== 'file') continue;
      const bucket = map.get(edge.target);
      if (bucket) bucket.push(entity);
      else map.set(edge.target, [entity]);
    }
    return map;
  }, [analysis.entities, analysis.relationships]);

  const dataStores = analysis.entities.filter((entity) => entity.type === 'database_model' || entity.type === 'database_table');
  const queues = analysis.entities.filter((entity) => entity.type === 'queue' || entity.type === 'event');
  const externals = analysis.entities.filter((entity) => entity.type === 'external_service');

  return (
    <div className="analysis-architecture">
      <section>
        <h3>Domains</h3>
        <p className="analysis-note">
          Discovered by clustering the dependency graph, then named from the directories, data models,
          and routes the cluster shares. Confidence reflects how many of those signals agreed.
        </p>
        <div className="analysis-domain-grid">
          {domains.map((domain) => (
            <article key={domain.id} className={`analysis-domain-card${openDomain === domain.id ? ' open' : ''}`}>
              <button onClick={() => setOpenDomain(openDomain === domain.id ? null : domain.id)}>
                <div>
                  <h4>{domain.name}</h4>
                  <small>{domain.memberCount} module(s)</small>
                </div>
                <ConfidenceBadge value={domain.confidence} />
              </button>
              {openDomain === domain.id ? (
                <div className="analysis-domain-body">
                  <p className="analysis-note">Signals: {domain.signals.join(', ') || 'directory layout'}</p>
                  <VirtualList
                    items={membersOf.get(domain.id) ?? []}
                    rowHeight={54}
                    height={260}
                    empty="No modules were attributed to this domain."
                    render={(entity) => <EntityRow entity={entity} onEvidence={onEvidence} />}
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
        {!domains.length ? <p className="analysis-empty">No domains were derived for this snapshot.</p> : null}
      </section>

      <div className="analysis-architecture-columns">
        <section>
          <h3>Data stores ({dataStores.length})</h3>
          <VirtualList items={dataStores} height={220} empty="No data models were discovered."
            render={(entity) => <EntityRow entity={entity} onEvidence={onEvidence} />} />
        </section>
        <section>
          <h3>Events and queues ({queues.length})</h3>
          <VirtualList items={queues} height={220} empty="No events or queues were discovered."
            render={(entity) => <EntityRow entity={entity} onEvidence={onEvidence} />} />
        </section>
        <section>
          <h3>External systems ({externals.length})</h3>
          <VirtualList items={externals} height={220} empty="No external systems were discovered."
            render={(entity) => <EntityRow entity={entity} onEvidence={onEvidence} />} />
        </section>
      </div>
    </div>
  );
}

const RESOLUTIONS: Array<{ id: CodeEntity['type']; label: string }> = [
  { id: 'package', label: 'Package' },
  { id: 'file', label: 'Module' },
  { id: 'class', label: 'Class' },
  { id: 'function', label: 'Function' },
];

function DependenciesView({
  analysis, query, onEvidence,
}: {
  analysis: CodebaseAnalysis;
  query: string;
  onEvidence: (entity: CodeEntity) => void;
}) {
  const [resolution, setResolution] = useState<CodeEntity['type']>('file');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [relationship, setRelationship] = useState<string>('ALL');
  const [selected, setSelected] = useState<CodeEntity | null>(null);

  const candidates = useMemo(
    () => analysis.entities.filter((entity) =>
      entity.type === resolution
      && (!query || `${entity.name} ${entity.path ?? ''}`.toLowerCase().includes(query))),
    [analysis.entities, resolution, query],
  );

  const related = useMemo(() => {
    if (!selected) return [];
    const byId = new Map<string, CodeEntity>(analysis.entities.map((entity) => [entity.id, entity]));
    return analysis.relationships
      .filter((edge) => (direction === 'out' ? edge.source : edge.target) === selected.id)
      .filter((edge) => relationship === 'ALL' || edge.type === relationship)
      .map((edge) => ({ edge, entity: byId.get(direction === 'out' ? edge.target : edge.source) }))
      .filter((item): item is { edge: CodeRelationship; entity: CodeEntity } => Boolean(item.entity));
  }, [selected, analysis, direction, relationship]);

  const relationshipTypes = useMemo(
    () => ['ALL', ...new Set(analysis.relationships.map((edge) => edge.type))],
    [analysis.relationships],
  );

  return (
    <div className="analysis-dependencies">
      <div className="analysis-controls">
        <label>
          Resolution
          <select value={resolution} onChange={(event) => { setResolution(event.target.value as CodeEntity['type']); setSelected(null); }}>
            {RESOLUTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>
          Direction
          <select value={direction} onChange={(event) => setDirection(event.target.value as 'out' | 'in')}>
            <option value="out">Depends on</option>
            <option value="in">Depended on by</option>
          </select>
        </label>
        <label>
          Relationship
          <select value={relationship} onChange={(event) => setRelationship(event.target.value)}>
            {relationshipTypes.map((type) => (
              <option key={type} value={type}>{type === 'ALL' ? 'All' : type.replaceAll('_', ' ').toLowerCase()}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="analysis-two-column">
        <div>
          <h4>{candidates.length} {resolution.replaceAll('_', ' ')}(s)</h4>
          <VirtualList
            items={candidates}
            height={420}
            empty="Nothing matches this filter."
            render={(entity) => (
              <button
                className={`analysis-picker-row${selected?.id === entity.id ? ' active' : ''}`}
                onClick={() => setSelected(entity)}
              >
                <strong>{entity.name}</strong>
                {entity.path ? <small>{entity.path}</small> : null}
              </button>
            )}
          />
        </div>
        <div>
          <h4>{selected ? `${direction === 'out' ? 'Depends on' : 'Depended on by'} (${related.length})` : 'Select an item'}</h4>
          {selected ? (
            <VirtualList
              items={related}
              height={420}
              empty={direction === 'out'
                ? 'This unit has no outgoing dependencies of the selected kind.'
                : 'Nothing depends on this unit through the selected relationship.'}
              render={(item) => (
                <article className="analysis-list-row">
                  <div>
                    <span className="analysis-type">{item.edge.type.replaceAll('_', ' ').toLowerCase()}</span>
                    <strong>{item.entity.name}</strong>
                    {item.entity.path ? <small>{item.entity.path}</small> : null}
                  </div>
                  <ConfidenceBadge value={item.edge.confidence} />
                  <button className="analysis-inline-button" onClick={() => onEvidence(item.entity)}>Evidence</button>
                </article>
              )}
            />
          ) : <p className="analysis-empty">Choose an item on the left to see what it connects to.</p>}
        </div>
      </div>
    </div>
  );
}

function FeaturesView({
  analysis, query, onEvidence,
}: {
  analysis: CodebaseAnalysis;
  query: string;
  onEvidence: (subject: string, evidence: CodeEvidence[]) => void;
}) {
  const [domain, setDomain] = useState('ALL');
  const domains = useMemo(
    () => ['ALL', ...new Set(analysis.features.map((feature) => feature.domain))].sort(),
    [analysis.features],
  );
  const explanations = useMemo(
    () => new Map(analysis.explanations.map((item) => [item.featureId, item])),
    [analysis.explanations],
  );

  const features = useMemo(() => analysis.features.filter((feature) =>
    (domain === 'ALL' || feature.domain === domain)
    && (!query || `${feature.name} ${feature.description} ${feature.triggers.join(' ')}`.toLowerCase().includes(query))),
  [analysis.features, domain, query]);

  return (
    <>
      <div className="analysis-controls">
        <label>
          Domain
          <select value={domain} onChange={(event) => setDomain(event.target.value)}>
            {domains.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'All domains' : item}</option>)}
          </select>
        </label>
        <span className="analysis-note">{features.length} of {analysis.features.length} features</span>
      </div>
      <VirtualList
        items={features}
        rowHeight={280}
        height={620}
        empty="No features match this filter."
        render={(feature: SoftwareFeature) => {
          const explanation = explanations.get(feature.id);
          return (
            <article className="analysis-feature-card">
              <header>
                <span>{feature.domain}</span>
                <ConfidenceBadge value={feature.confidence} />
              </header>
              <h3>{feature.name}</h3>
              <p>{feature.description}</p>
              {explanation?.grounded ? (
                <p className="analysis-provenance">
                  <Info size={12} /> Described by {explanation.model} from evidence only ({explanation.promptVersion}).
                </p>
              ) : null}
              <div className="analysis-feature-columns">
                <div>
                  <h4>Workflow</h4>
                  <ol>{feature.workflow.slice(0, 8).map((step) => <li key={step.entityId}>{step.label}</li>)}</ol>
                </div>
                <div>
                  <h4>Effects</h4>
                  <ul>
                    {feature.reads.length ? <li>Reads {feature.reads.join(', ')}</li> : null}
                    {feature.writes.length ? <li>Writes {feature.writes.join(', ')}</li> : null}
                    {feature.externalServices.length ? <li>Calls {feature.externalServices.join(', ')}</li> : null}
                    {feature.emittedEvents.length ? <li>Publishes {feature.emittedEvents.join(', ')}</li> : null}
                    {feature.downstreamEffects.map((effect) => <li key={effect}>{effect}</li>)}
                    {feature.authorization.length ? <li>Authorization: {feature.authorization.join(', ')}</li> : null}
                    {!feature.reads.length && !feature.writes.length && !feature.externalServices.length && !feature.emittedEvents.length
                      ? <li className="analysis-muted">No data, event, or external effects were resolved.</li> : null}
                  </ul>
                </div>
              </div>
              <footer>
                <span>{feature.sourceFiles.length} file(s)</span>
                <button className="analysis-inline-button" onClick={() => onEvidence(feature.name, feature.evidence)}>
                  Evidence
                </button>
              </footer>
            </article>
          );
        }}
      />
    </>
  );
}

function RisksView({
  analysis, applicationId, onEvidence,
}: {
  analysis: CodebaseAnalysis;
  applicationId: string;
  onEvidence: (subject: string, evidence: CodeEvidence[]) => void;
}) {
  const [target, setTarget] = useState('');
  const [radius, setRadius] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(() => analysis.entities.filter((entity) =>
    ['file', 'class', 'function', 'method', 'database_model'].includes(entity.type)), [analysis.entities]);

  const run = async (entityId: string) => {
    setBusy(true);
    try {
      const result = await window.tellann?.projects?.codebaseQuery?.({
        applicationId, kind: 'blast-radius', payload: { entityId },
      });
      setRadius(result ?? null);
    } catch {
      setRadius(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="analysis-risks">
      <section>
        <h3>Structural findings</h3>
        <VirtualList
          items={analysis.findings}
          rowHeight={118}
          height={380}
          empty="No structural risks were detected by the current analyzers."
          render={(finding: CodebaseFinding) => (
            <article className={`analysis-finding severity-${finding.severity.toLowerCase()}`}>
              <AlertTriangle size={18} />
              <div>
                <span>{finding.severity} · {finding.kind.replaceAll('_', ' ').toLowerCase()}</span>
                <h4>{finding.title}</h4>
                <p>{finding.description}</p>
                {finding.evidence.length ? (
                  <button className="analysis-inline-button" onClick={() => onEvidence(finding.title, finding.evidence)}>
                    Evidence
                  </button>
                ) : null}
              </div>
            </article>
          )}
        />
      </section>

      <section>
        <h3>Blast radius</h3>
        <p className="analysis-note">What could break if you change this, following incoming dependencies.</p>
        <div className="analysis-search compact">
          <Search size={14} />
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="Find a module, class, function, or model…"
          />
        </div>
        {target.length > 1 ? (
          <VirtualList
            items={candidates.filter((entity) =>
              `${entity.name} ${entity.path ?? ''}`.toLowerCase().includes(target.toLowerCase())).slice(0, 200)}
            height={200}
            empty="Nothing matches that name."
            render={(entity) => (
              <button className="analysis-picker-row" onClick={() => void run(entity.id)}>
                <strong>{entity.name}</strong>
                {entity.path ? <small>{entity.path}</small> : null}
              </button>
            )}
          />
        ) : null}
        {busy ? <p className="analysis-note"><Loader2 size={14} className="spin" /> Calculating…</p> : null}
        {radius ? (
          <div className="analysis-metrics compact">
            <Metric label="Modules" value={radius.affected?.modules ?? 0} />
            <Metric label="Functions" value={radius.affected?.functions ?? 0} />
            <Metric label="Endpoints" value={radius.affected?.endpoints ?? 0} />
            <Metric label="Jobs" value={radius.affected?.jobs ?? 0} />
            <Metric label="Tests" value={radius.affected?.tests ?? 0} />
            <Metric label="Features" value={radius.affected?.features ?? 0} />
          </div>
        ) : null}
        {radius?.truncated ? <p className="analysis-note">The result was capped; the true reach is larger.</p> : null}
      </section>
    </div>
  );
}

function ChangesView({ applicationId }: { applicationId: string }) {
  const [comparison, setComparison] = useState<AnalysisComparison | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [reason, setReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await window.tellann?.projects?.codebaseQuery?.({ applicationId, kind: 'compare' });
        if (cancelled) return;
        if (result?.changes) {
          setComparison(result);
          setState('ready');
        } else {
          setReason(result?.message ?? 'Two completed analyses are needed before changes can be compared.');
          setState('unavailable');
        }
      } catch (error) {
        if (cancelled) return;
        setReason(error instanceof Error ? error.message : 'Change analysis is unavailable.');
        setState('unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [applicationId]);

  if (state === 'loading') return <p className="analysis-note"><Loader2 size={14} className="spin" /> Comparing snapshots…</p>;
  if (state === 'unavailable' || !comparison) return <p className="analysis-empty">{reason}</p>;

  return (
    <>
      <div className="analysis-metrics compact">
        <Metric label="Features added" value={comparison.summary.featuresAdded} />
        <Metric label="Features changed" value={comparison.summary.featuresChanged} />
        <Metric label="Features removed" value={comparison.summary.featuresRemoved} />
        <Metric label="Endpoints added" value={comparison.summary.endpointsAdded} />
        <Metric label="External systems added" value={comparison.summary.externalsAdded} />
      </div>
      <p className="analysis-note">
        {comparison.fromRevision?.slice(0, 8) ?? 'previous'} → {comparison.toRevision?.slice(0, 8) ?? 'current'}
      </p>
      <VirtualList
        items={comparison.changes}
        rowHeight={76}
        height={480}
        empty="Nothing changed architecturally between these two snapshots."
        render={(change) => (
          <article className={`analysis-change kind-${change.kind.toLowerCase()}`}>
            <span>{change.kind}</span>
            <div>
              <strong>{change.label}</strong>
              <p>{change.detail}</p>
            </div>
          </article>
        )}
      />
    </>
  );
}

function AskView({ applicationId }: { applicationId: string }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openEvidence = useEvidenceOpener(applicationId);

  const ask = async () => {
    if (question.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const result = await window.tellann?.projects?.codebaseQuery?.({
        applicationId, kind: 'ask', payload: { question },
      });
      setAnswer(result ?? null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The question could not be answered.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="analysis-ask">
      <div className="analysis-search">
        <Search size={16} />
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void ask(); }}
          placeholder="How does checkout work? What calls Stripe? What breaks if I change UserRepository?"
          aria-label="Ask about this repository"
        />
        <button onClick={() => void ask()} disabled={busy}>{busy ? <Loader2 size={14} className="spin" /> : 'Ask'}</button>
      </div>
      <p className="analysis-note">
        Answers are built from the analysed graph and cite the code they came from. Anything the analysis
        did not discover will be reported as unknown rather than guessed.
      </p>
      {error ? <p className="analysis-empty">{error}</p> : null}
      {answer ? (
        <div className="analysis-answer">
          {answer.uncertainty ? (
            <div className="analysis-warning"><AlertTriangle size={15} />{answer.uncertainty}</div>
          ) : null}
          {(answer.features ?? []).map((item: any) => (
            <article key={item.featureId}>
              <header>
                <h3>{item.name}</h3>
                <ConfidenceBadge value={item.confidence ?? 0.5} />
              </header>
              <p>{item.summary}</p>
              {!item.grounded ? (
                <p className="analysis-provenance">
                  <Info size={12} /> Deterministic description; no model output was accepted for this feature.
                </p>
              ) : null}
              <div className="analysis-citations">
                {(item.citations ?? []).map((citation: CodeEvidence, index: number) => (
                  <EvidenceLink key={`${citation.path}-${index}`} item={citation} onOpen={openEvidence} />
                ))}
              </div>
            </article>
          ))}
          {!(answer.features ?? []).length ? <p className="analysis-empty">{answer.answer}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

export function CodebaseAnalysisPanel({
  applicationId, workspaceRoot,
}: {
  applicationId: string;
  workspaceRoot: string;
}) {
  const [view, setView] = useState<View>('overview');
  const [state, setState] = useState<CodebaseAnalysisView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState<{ subject: string; evidence: CodeEvidence[] } | null>(null);
  const deferredQuery = useDeferredValue(query.toLowerCase());
  const openEvidence = useEvidenceOpener(applicationId);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = async () => {
      try {
        const next = await window.tellann?.projects.getCodebaseAnalysis(applicationId);
        if (stopped) return;
        setState(next ?? null);
        setLoaded(true);
        const status = next?.job?.status ?? next?.analysis?.status;
        // Poll while work is in flight; settle once it is done.
        if (!next || (status && ACTIVE.has(status))) timer = setTimeout(refresh, 1_500);
      } catch {
        if (!stopped) {
          setLoaded(true);
          timer = setTimeout(refresh, 5_000);
        }
      }
    };
    void refresh();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [applicationId]);

  const analysis = state?.analysis ?? null;
  const status = state?.job?.status ?? analysis?.status ?? null;
  const progress = state?.job?.progress ?? analysis?.progress ?? 0;
  const stageMessage = state?.job?.stageMessage ?? analysis?.stageMessage ?? '';

  const showEntityEvidence = useCallback((entity: CodeEntity) => {
    setDrawer({ subject: entity.name, evidence: entity.evidence });
  }, []);
  const showEvidence = useCallback((subject: string, evidence: CodeEvidence[]) => {
    setDrawer({ subject, evidence });
  }, []);

  const loadGraph = useCallback(async (input: {
    search: string; types: string[]; relationshipTypes: string[]; depth: number; limit: number; rootId: string | null;
  }) => {
    if (state?.mode === 'cloud') {
      const result = await window.tellann?.projects?.codebaseQuery?.({
        applicationId, kind: 'graph', payload: input,
      });
      return result ?? null;
    }
    // A local analysis has no server to query, so the same projection is
    // computed here over the in-memory graph.
    if (!analysis) return null;
    const local: CodebaseAnalysis = analysis;
    const byId = new Map<string, CodeEntity>(local.entities.map((entity) => [entity.id, entity]));
    const search = input.search.toLowerCase();
    const seeds = local.entities.filter((entity) => {
      if (input.rootId) return entity.id === input.rootId;
      if (input.types.length && !input.types.includes(entity.type)) return false;
      if (!search) return true;
      return entity.name.toLowerCase().includes(search) || (entity.path ?? '').toLowerCase().includes(search);
    }).slice(0, input.limit);

    const nodes = new Map<string, CodeEntity>(seeds.map((entity) => [entity.id, entity]));
    const edges = new Map<string, CodeRelationship>();
    let frontier = seeds.map((entity) => entity.id);
    for (let depth = 0; depth < input.depth && nodes.size < input.limit; depth += 1) {
      const next: string[] = [];
      for (const edge of local.relationships) {
        if (input.relationshipTypes.length && !input.relationshipTypes.includes(edge.type)) continue;
        const touchesSource = frontier.includes(edge.source);
        const touchesTarget = frontier.includes(edge.target);
        if (!touchesSource && !touchesTarget) continue;
        edges.set(edge.id, edge);
        const other = touchesSource ? edge.target : edge.source;
        if (nodes.has(other) || nodes.size >= input.limit) continue;
        const entity = byId.get(other);
        if (!entity) continue;
        nodes.set(other, entity);
        next.push(other);
      }
      frontier = next;
    }
    const kept = new Set(nodes.keys());
    return {
      nodes: [...nodes.values()],
      edges: [...edges.values()].filter((edge) => kept.has(edge.source) && kept.has(edge.target)),
      truncated: nodes.size >= input.limit,
      totalMatched: nodes.size,
    };
  }, [analysis, applicationId, state?.mode]);

  const filteredEntities = useMemo(() => {
    if (!analysis) return [];
    if (!deferredQuery) return analysis.entities;
    return analysis.entities.filter((entity) =>
      `${entity.name} ${entity.path ?? ''} ${entity.type}`.toLowerCase().includes(deferredQuery));
  }, [analysis, deferredQuery]);

  if (!loaded) {
    return (
      <section className="content-card analysis-shell">
        <p className="analysis-note"><Loader2 size={14} className="spin" /> Checking analysis status…</p>
      </section>
    );
  }

  if (!state) {
    return (
      <section className="content-card analysis-shell">
        <p className="analysis-empty">
          Deep analysis has not started for this workspace. Re-attach the folder to build a versioned code graph.
        </p>
      </section>
    );
  }

  if (state.unreachable) {
    return (
      <section className="content-card analysis-shell">
        <div className="analysis-warning"><AlertTriangle size={15} />
          The analysis service could not be reached, so this view may be out of date. {state.unreachable}
        </div>
        {analysis ? <p className="analysis-note">Showing the last result stored on this device.</p> : null}
      </section>
    );
  }

  // In-flight, whether it is running here or in the cloud.
  if (status && ACTIVE.has(status)) {
    return (
      <section className="content-card analysis-shell">
        <div className="analysis-progress-head">
          <div>
            <span className="analysis-kicker">
              Codebase intelligence · {state.mode === 'cloud' ? 'analysing in the cloud' : 'analysing on this device'}
            </span>
            <h2>{STAGE_LABEL[status] ?? status}</h2>
            <p>{stageMessage}</p>
          </div>
          <button className="button" onClick={() => void window.tellann?.projects.cancelCodebaseAnalysis(applicationId)}>
            Cancel
          </button>
        </div>
        <div className="analysis-progress"><span style={{ width: `${Math.max(progress, 2)}%` }} /></div>
        <p className="analysis-note">
          {progress}%
          {state.uploadProgress ? ` · uploading part ${state.uploadProgress.sent} of ${state.uploadProgress.total}` : ''}
          {state.job ? ` · attempt ${state.job.attempt} of ${state.job.maxAttempts}` : ''}
          {' '}· results appear as each stage completes, and this continues if you navigate away.
        </p>
        {state.interrupted ? (
          <div className="analysis-warning">
            <AlertTriangle size={15} />
            The previous run stopped when the desktop closed. It was restarted from the beginning.
          </div>
        ) : null}
        {analysis && analysis.entities.length ? (
          <p className="analysis-note">
            Partial results so far: {analysis.summary.files} file(s), {analysis.summary.features} feature(s).
          </p>
        ) : null}
      </section>
    );
  }

  if (status === 'FAILED') {
    return (
      <section className="content-card analysis-shell">
        <div className="analysis-warning"><AlertTriangle size={15} />
          Analysis failed: {state.job?.errorMessageSafe ?? analysis?.stageMessage ?? 'no detail was recorded'}.
        </div>
        <button className="button" onClick={() => void window.tellann?.projects?.rescanCodebase?.(applicationId)}>
          <RefreshCw size={14} /> Try again
        </button>
      </section>
    );
  }

  if (!analysis) {
    return (
      <section className="content-card analysis-shell">
        <p className="analysis-empty">
          {status === 'CANCELLED'
            ? 'This analysis was cancelled. Re-attach the workspace or rescan to start a new one.'
            : 'No analysis results are available for this workspace yet.'}
        </p>
      </section>
    );
  }

  const typeFilters: Partial<Record<View, CodeEntity['type'][]>> = {
    apis: ['endpoint', 'ui_route', 'ui_action'],
    data: ['database_model', 'database_table', 'event', 'queue', 'job'],
    external: ['external_service'],
  };

  const renderView = () => {
    switch (view) {
      case 'overview': return <OverviewView analysis={analysis} onGoTo={setView} />;
      case 'hierarchy': return <HierarchyView analysis={analysis} onEvidence={showEntityEvidence} />;
      case 'architecture': return <ArchitectureView analysis={analysis} onEvidence={showEntityEvidence} />;
      case 'dependencies': return <DependenciesView analysis={analysis} query={deferredQuery} onEvidence={showEntityEvidence} />;
      case 'features': return <FeaturesView analysis={analysis} query={deferredQuery} onEvidence={showEvidence} />;
      case 'graph': return <CodebaseGraphExplorer load={loadGraph} onOpenEntity={showEntityEvidence} />;
      case 'risks': return <RisksView analysis={analysis} applicationId={applicationId} onEvidence={showEvidence} />;
      case 'changes': return <ChangesView applicationId={applicationId} />;
      case 'ask': return <AskView applicationId={applicationId} />;
      default: {
        const wanted = typeFilters[view] ?? [];
        const items = filteredEntities.filter((entity) => wanted.includes(entity.type));
        return (
          <>
            <p className="analysis-note">{items.length} item(s)</p>
            <VirtualList
              items={items}
              height={560}
              empty="Nothing of this kind was discovered in this snapshot."
              render={(entity) => <EntityRow entity={entity} onEvidence={showEntityEvidence} />}
            />
          </>
        );
      }
    }
  };

  return (
    <section className="content-card analysis-shell">
      <header className="analysis-header">
        <div>
          <span className="analysis-kicker">
            Codebase intelligence · {analysis.status === 'PARTIAL' ? 'partial' : 'complete'}
            {state.mode === 'cloud' ? ' · cloud' : ' · local'}
            {analysis.dirty ? ' · uncommitted changes included' : ''}
          </span>
          <h2>Repository analysis</h2>
          <p>
            Graph {analysis.graphVersion.slice(0, 12)}
            {analysis.revision ? ` · ${analysis.revision.slice(0, 8)}` : ''}
            {analysis.completedAt ? ` · ${new Date(analysis.completedAt).toLocaleString()}` : ''}
            {analysis.incremental && analysis.incremental.mode !== 'full'
              ? ` · ${analysis.incremental.mode} (${analysis.incremental.reusedFiles} file(s) reused)`
              : ''}
          </p>
        </div>
        <div className="analysis-header-actions">
          <div className="analysis-search compact">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter this view"
              aria-label="Filter the current view"
            />
          </div>
          <button className="button" onClick={() => void window.tellann?.projects?.rescanCodebase?.(applicationId)}>
            <RefreshCw size={14} /> Rescan
          </button>
        </div>
      </header>

      {analysis.status === 'PARTIAL' ? (
        <div className="analysis-warning">
          <AlertTriangle size={15} />
          This analysis is partial. Some of the repository was not fully covered; see Overview for what was reached.
        </div>
      ) : null}

      <nav className="analysis-tabs" aria-label="Codebase analysis views">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            className={view === item.id ? 'active' : ''}
            onClick={() => setView(item.id)}
            aria-current={view === item.id}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="analysis-body">{renderView()}</div>

      {drawer ? (
        <EvidenceDrawer
          title="Evidence"
          subject={drawer.subject}
          evidence={drawer.evidence}
          onClose={() => setDrawer(null)}
          onOpen={openEvidence}
        />
      ) : null}
      {workspaceRoot ? null : null}
    </section>
  );
}
