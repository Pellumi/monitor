import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { CodebaseAnalysis, CodeEntity, CodeEvidence } from '@tellann/desktop-contracts';
import { AlertTriangle, ChevronRight, ExternalLink, Search, Workflow } from 'lucide-react';

type View = 'overview' | 'hierarchy' | 'architecture' | 'dependencies' | 'features' | 'apis' | 'data' | 'external' | 'risks' | 'changes' | 'ask';
const ACTIVE = new Set(['QUEUED', 'INGESTING', 'PARSING', 'LINKING', 'GRAPHING', 'DISCOVERING_FEATURES', 'ANALYZING_ARCHITECTURE', 'SUMMARIZING']);
const views: Array<{ id: View; label: string }> = [
  { id: 'overview', label: 'Overview' }, { id: 'hierarchy', label: 'Hierarchy' }, { id: 'architecture', label: 'Architecture' },
  { id: 'dependencies', label: 'Dependencies' }, { id: 'features', label: 'Features' }, { id: 'apis', label: 'APIs & UI' },
  { id: 'data', label: 'Data & Events' }, { id: 'external', label: 'External Systems' }, { id: 'risks', label: 'Risks' },
  { id: 'changes', label: 'Changes' }, { id: 'ask', label: 'Ask' },
];

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="analysis-metric"><strong>{value}</strong><span>{label}</span></div>;
}

function EvidenceButton({ item, root }: { item: CodeEvidence; root: string }) {
  const open = async () => {
    const absolute = `${root.replace(/[\\/]$/, '')}\\${item.path.replaceAll('/', '\\')}`;
    await window.tellann?.system?.openPath?.(absolute);
  };
  return <button className="analysis-evidence" onClick={() => void open()} title={`${item.path}:${item.startLine ?? 1}`}><ExternalLink size={12} />{item.path}:{item.startLine ?? 1}</button>;
}

const EntityList = memo(function EntityList({ entities, root, empty = 'No matching entities were discovered.' }: { entities: CodeEntity[]; root: string; empty?: string }) {
  if (!entities.length) return <p className="analysis-empty">{empty}</p>;
  return <div className="analysis-list">{entities.slice(0, 500).map((entity) => <article key={entity.id} className="analysis-list-row">
    <div><span className="analysis-type">{entity.type.replaceAll('_', ' ')}</span><strong>{entity.name}</strong>{entity.path ? <small>{entity.path}{entity.startLine ? `:${entity.startLine}` : ''}</small> : null}</div>
    <span className="analysis-confidence">{Math.round(entity.confidence * 100)}%</span>
    {entity.evidence[0] ? <EvidenceButton item={entity.evidence[0]} root={root} /> : null}
  </article>)}</div>;
});

function GraphView({ analysis }: { analysis: CodebaseAnalysis }) {
  const nodes = analysis.entities.filter((entity) => ['application', 'service', 'package', 'domain', 'external_service', 'database_model'].includes(entity.type)).slice(0, 40);
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const edges = analysis.relationships.filter((edge) => index.has(edge.source) && index.has(edge.target)).slice(0, 80);
  const width = 900; const height = Math.max(420, Math.ceil(nodes.length / 6) * 110);
  const point = (i: number) => ({ x: 90 + (i % 6) * 145, y: 70 + Math.floor(i / 6) * 110 });
  return <div className="analysis-graph-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Codebase architecture graph">
    {edges.map((edge) => { const from = point(index.get(edge.source)!); const to = point(index.get(edge.target)!); return <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="analysis-graph-edge" />; })}
    {nodes.map((node, i) => { const p = point(i); return <g key={node.id} transform={`translate(${p.x - 58} ${p.y - 25})`}><rect width="116" height="50" rx="8" className={`analysis-graph-node node-${node.type}`} /><text x="58" y="20" textAnchor="middle">{node.type.replaceAll('_', ' ')}</text><text x="58" y="37" textAnchor="middle" className="node-name">{node.name.slice(0, 18)}</text></g>; })}
  </svg></div>;
}

function LocalAsk({ analysis, root }: { analysis: CodebaseAnalysis; root: string }) {
  const [question, setQuestion] = useState('');
  const query = useDeferredValue(question.trim().toLowerCase());
  const matches = useMemo(() => query.length < 2 ? [] : analysis.entities.filter((entity) => `${entity.name} ${entity.type} ${entity.path ?? ''}`.toLowerCase().includes(query)).slice(0, 20), [analysis.entities, query]);
  return <div><div className="analysis-search"><Search size={16} /><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask or search this repository…" /></div>
    <p className="analysis-note">Evidence-grounded local search is available now. Cloud GraphRAG summaries activate when the analysis API and AI provider are configured.</p>
    <EntityList entities={matches} root={root} empty={query ? 'No evidence matches that question.' : 'Enter a symbol, feature, route, service, or file name.'} />
  </div>;
}

export function CodebaseAnalysisPanel({ applicationId, workspaceRoot }: { applicationId: string; workspaceRoot: string }) {
  const [analysis, setAnalysis] = useState<CodebaseAnalysis | null>(null);
  const [view, setView] = useState<View>('overview');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.toLowerCase());
  useEffect(() => {
    let stopped = false; let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = async () => {
      const next = await window.tellann?.projects.getCodebaseAnalysis(applicationId).catch(() => null);
      if (stopped) return;
      setAnalysis(next ?? null);
      if (!next || ACTIVE.has(next.status)) timer = setTimeout(refresh, 1200);
    };
    void refresh();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [applicationId]);

  const filtered = useMemo(() => !analysis ? [] : analysis.entities.filter((entity) => !deferredQuery || `${entity.name} ${entity.path ?? ''} ${entity.type}`.toLowerCase().includes(deferredQuery)), [analysis, deferredQuery]);
  if (!analysis) return <section className="content-card analysis-shell"><p className="analysis-empty">Deep analysis has not started. Reattach the folder to create a versioned code graph.</p></section>;
  if (ACTIVE.has(analysis.status)) return <section className="content-card analysis-shell"><div className="analysis-progress-head"><div><span className="analysis-kicker">Codebase intelligence</span><h2>{analysis.stageMessage}</h2></div><button className="button" onClick={() => void window.tellann?.projects.cancelCodebaseAnalysis(applicationId)}>Cancel</button></div><div className="analysis-progress"><span style={{ width: `${analysis.progress}%` }} /></div><p>{analysis.progress}% · Results appear progressively and this job resumes after navigation.</p></section>;

  const render = () => {
    if (view === 'overview') return <><div className="analysis-metrics"><Metric label="Files" value={analysis.summary.files} /><Metric label="Symbols" value={analysis.summary.symbols} /><Metric label="Relationships" value={analysis.summary.relationships} /><Metric label="Features" value={analysis.summary.features} /><Metric label="Domains" value={analysis.summary.domains} /><Metric label="Coverage" value={`${analysis.summary.coveragePercent}%`} /></div><div className="analysis-overview-grid"><div><h3>Framework and architecture coverage</h3><p>{analysis.summary.applications} applications · {analysis.summary.services} services · {Math.round(analysis.summary.confidence * 100)}% mean evidence confidence</p>{analysis.warnings.map((warning) => <div className="analysis-warning" key={warning}><AlertTriangle size={15} />{warning}</div>)}</div><div><h3>Top functionality</h3>{analysis.features.slice(0, 8).map((feature) => <button className="analysis-feature-link" key={feature.id} onClick={() => setView('features')}><Workflow size={14} />{feature.name}<ChevronRight size={14} /></button>)}</div></div></>;
    if (view === 'architecture') return <GraphView analysis={analysis} />;
    if (view === 'features') return <div className="analysis-feature-grid">{analysis.features.map((feature) => <article key={feature.id} className="analysis-feature-card"><span>{feature.domain} · {Math.round(feature.confidence * 100)}%</span><h3>{feature.name}</h3><p>{feature.description}</p><ol>{feature.workflow.slice(0, 10).map((step) => <li key={step.entityId}>{step.label}</li>)}</ol><div className="analysis-tags">{[...feature.externalServices, ...feature.emittedEvents, ...feature.writes].map((tag) => <span key={tag}>{tag}</span>)}</div>{feature.evidence[0] ? <EvidenceButton item={feature.evidence[0]} root={workspaceRoot} /> : null}</article>)}</div>;
    if (view === 'risks') return analysis.findings.length ? <div className="analysis-list">{analysis.findings.map((finding) => <article className="analysis-finding" key={finding.id}><AlertTriangle size={18} /><div><span>{finding.severity}</span><h3>{finding.title}</h3><p>{finding.description}</p></div></article>)}</div> : <p className="analysis-empty">No structural risks were detected by the current analyzers.</p>;
    if (view === 'ask') return <LocalAsk analysis={analysis} root={workspaceRoot} />;
    if (view === 'changes') return <p className="analysis-empty">This is the first retained analysis for this local workspace. Change analysis becomes available after the next revision is scanned.</p>;
    const types: Partial<Record<View, CodeEntity['type'][]>> = {
      hierarchy: ['application', 'service', 'package', 'file', 'class', 'interface', 'function', 'method'],
      dependencies: ['package', 'module', 'file', 'class', 'function', 'method'],
      apis: ['ui_route', 'ui_action', 'endpoint'], data: ['database_model', 'database_table', 'event', 'queue', 'job'], external: ['external_service'],
    };
    return <EntityList entities={filtered.filter((entity) => types[view]?.includes(entity.type))} root={workspaceRoot} />;
  };

  return <section className="content-card analysis-shell"><header className="analysis-header"><div><span className="analysis-kicker">Codebase intelligence · {analysis.status}</span><h2>Repository analysis</h2><p>Graph {analysis.graphVersion.slice(0, 12)} · completed {analysis.completedAt ? new Date(analysis.completedAt).toLocaleString() : '—'}</p></div><div className="analysis-search compact"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter findings" /></div></header><nav className="analysis-tabs" aria-label="Codebase analysis views">{views.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>{item.label}</button>)}</nav><div className="analysis-body">{render()}</div></section>;
}
