import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CodeEntity, CodeRelationship } from '@tellann/desktop-contracts';
import { Crosshair, Filter, Loader2, Maximize2, RotateCcw, Search, X } from 'lucide-react';

export type GraphData = { nodes: CodeEntity[]; edges: CodeRelationship[]; truncated: boolean; totalMatched: number };

const NODE_TYPES: Array<{ id: CodeEntity['type']; label: string }> = [
  { id: 'domain', label: 'Domains' },
  { id: 'application', label: 'Applications' },
  { id: 'service', label: 'Services' },
  { id: 'package', label: 'Packages' },
  { id: 'file', label: 'Files' },
  { id: 'class', label: 'Classes' },
  { id: 'function', label: 'Functions' },
  { id: 'endpoint', label: 'Endpoints' },
  { id: 'ui_route', label: 'UI routes' },
  { id: 'database_model', label: 'Data models' },
  { id: 'event', label: 'Events' },
  { id: 'queue', label: 'Queues' },
  { id: 'job', label: 'Jobs' },
  { id: 'external_service', label: 'External systems' },
  { id: 'feature', label: 'Features' },
];

const EDGE_TYPES: CodeRelationship['type'][] = [
  'CONTAINS', 'DEFINES', 'IMPORTS', 'CALLS', 'ROUTES_TO', 'READS', 'WRITES',
  'PUBLISHES', 'SUBSCRIBES_TO', 'HANDLED_BY', 'DEPENDS_ON', 'CALLS_EXTERNAL',
  'BELONGS_TO_DOMAIN', 'IMPLEMENTS_FEATURE', 'TESTS',
];

type Placed = { node: CodeEntity; x: number; y: number };

/**
 * Force-free layered layout. Nodes are grouped by type into columns and spread
 * vertically, which stays readable at a few hundred nodes and costs nothing to
 * compute - a simulation would fight the fixed render budget for no benefit at
 * the sizes this view is capped to.
 */
function layout(nodes: CodeEntity[]): { placed: Placed[]; width: number; height: number } {
  const columns = new Map<string, CodeEntity[]>();
  for (const node of nodes) {
    const bucket = columns.get(node.type);
    if (bucket) bucket.push(node);
    else columns.set(node.type, [node]);
  }
  const ordered = [...columns.entries()].sort((left, right) => right[1].length - left[1].length);
  const placed: Placed[] = [];
  const columnWidth = 210;
  const rowHeight = 62;
  let maxRows = 1;

  ordered.forEach(([, group], columnIndex) => {
    maxRows = Math.max(maxRows, group.length);
    group.forEach((node, rowIndex) => {
      placed.push({
        node,
        x: 110 + columnIndex * columnWidth,
        y: 54 + rowIndex * rowHeight,
      });
    });
  });

  return {
    placed,
    width: Math.max(900, 140 + ordered.length * columnWidth),
    height: Math.max(420, 100 + maxRows * rowHeight),
  };
}

const NodeShape = memo(function NodeShape({
  placed, selected, dimmed, onSelect,
}: {
  placed: Placed;
  selected: boolean;
  dimmed: boolean;
  onSelect: (node: CodeEntity) => void;
}) {
  const { node, x, y } = placed;
  return (
    <g
      transform={`translate(${x - 88} ${y - 20})`}
      className={`graph-node type-${node.type}${selected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}`}
      onClick={() => onSelect(node)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(node); }}
      aria-label={`${node.type.replaceAll('_', ' ')}: ${node.name}`}
    >
      <rect width="176" height="40" rx="7" />
      <text x="10" y="16" className="graph-node-type">{node.type.replaceAll('_', ' ')}</text>
      <text x="10" y="31" className="graph-node-name">
        {node.name.length > 26 ? `${node.name.slice(0, 25)}…` : node.name}
      </text>
    </g>
  );
});

export function CodebaseGraphExplorer({
  load, onOpenEntity,
}: {
  load: (query: {
    search: string;
    types: string[];
    relationshipTypes: string[];
    depth: number;
    limit: number;
    rootId: string | null;
  }) => Promise<GraphData | null>;
  onOpenEntity: (entity: CodeEntity) => void;
}) {
  const [search, setSearch] = useState('');
  const [types, setTypes] = useState<string[]>(['domain', 'service', 'endpoint', 'external_service']);
  const [edgeTypes, setEdgeTypes] = useState<string[]>([]);
  const [depth, setDepth] = useState(1);
  const [limit, setLimit] = useState(150);
  const [rootId, setRootId] = useState<string | null>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CodeEntity | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [zoom, setZoom] = useState(1);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await load({ search, types, relationshipTypes: edgeTypes, depth, limit, rootId });
      // A slower earlier request must not overwrite a newer result.
      if (current !== requestId.current) return;
      setData(next);
    } catch (failure) {
      if (current !== requestId.current) return;
      setError(failure instanceof Error ? failure.message : 'The graph could not be queried.');
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [load, search, types, edgeTypes, depth, limit, rootId]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 250);
    return () => clearTimeout(timer);
  }, [refresh]);

  const { placed, width, height } = useMemo(() => layout(data?.nodes ?? []), [data]);
  const positions = useMemo(() => new Map(placed.map((item) => [item.node.id, item])), [placed]);

  const neighbourIds = useMemo(() => {
    if (!selected || !data) return null;
    const ids = new Set<string>([selected.id]);
    for (const edge of data.edges) {
      if (edge.source === selected.id) ids.add(edge.target);
      if (edge.target === selected.id) ids.add(edge.source);
    }
    return ids;
  }, [selected, data]);

  const toggle = (list: string[], value: string, set: (next: string[]) => void) =>
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  return (
    <div className="graph-explorer">
      <div className="graph-toolbar">
        <div className="analysis-search compact">
          <Search size={14} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search nodes by name or path…"
            aria-label="Search the code graph"
          />
        </div>
        <button className={showFilters ? 'active' : ''} onClick={() => setShowFilters((value) => !value)}>
          <Filter size={14} /> Filters {types.length ? `(${types.length})` : ''}
        </button>
        <label className="graph-control">
          Depth
          <input
            type="range" min={1} max={4} value={depth}
            onChange={(event) => setDepth(Number(event.target.value))}
            aria-label="Traversal depth"
          />
          <span>{depth}</span>
        </label>
        <label className="graph-control">
          Max nodes
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} aria-label="Node cap">
            <option value={75}>75</option>
            <option value={150}>150</option>
            <option value={300}>300</option>
            <option value={600}>600</option>
          </select>
        </label>
        <button onClick={() => setZoom((value) => Math.min(value + 0.2, 2))} aria-label="Zoom in"><Maximize2 size={14} /></button>
        <button
          onClick={() => { setZoom(1); setRootId(null); setSelected(null); }}
          aria-label="Reset the view"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      {showFilters ? (
        <div className="graph-filters">
          <div>
            <h4>Node types</h4>
            <div className="graph-chiplist">
              {NODE_TYPES.map((item) => (
                <button
                  key={item.id}
                  className={types.includes(item.id) ? 'active' : ''}
                  onClick={() => toggle(types, item.id, setTypes)}
                  aria-pressed={types.includes(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h4>Relationships</h4>
            <div className="graph-chiplist">
              {EDGE_TYPES.map((item) => (
                <button
                  key={item}
                  className={edgeTypes.includes(item) ? 'active' : ''}
                  onClick={() => toggle(edgeTypes, item, setEdgeTypes)}
                  aria-pressed={edgeTypes.includes(item)}
                >
                  {item.replaceAll('_', ' ').toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {rootId ? (
        <p className="analysis-note">
          Focused on one node and its neighbourhood.{' '}
          <button className="analysis-inline-button" onClick={() => setRootId(null)}>Show the whole graph</button>
        </p>
      ) : null}

      <div className="graph-canvas">
        {loading ? <div className="graph-loading"><Loader2 size={16} className="spin" /> Querying the graph…</div> : null}
        {error ? <p className="analysis-empty">{error}</p> : null}
        {!loading && !error && !data?.nodes.length ? (
          <p className="analysis-empty">No nodes match these filters. Widen the node types or clear the search.</p>
        ) : null}
        {data?.nodes.length ? (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: `${100 * zoom}%` }}
            role="img"
            aria-label="Interactive code graph"
          >
            {data.edges.map((edge) => {
              const from = positions.get(edge.source);
              const to = positions.get(edge.target);
              if (!from || !to) return null;
              const dim = neighbourIds && !(neighbourIds.has(edge.source) && neighbourIds.has(edge.target));
              return (
                <line
                  key={edge.id}
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  className={`graph-edge${dim ? ' dimmed' : ''}`}
                >
                  <title>{`${edge.type} (${Math.round(edge.confidence * 100)}% confidence)`}</title>
                </line>
              );
            })}
            {placed.map((item) => (
              <NodeShape
                key={item.node.id}
                placed={item}
                selected={selected?.id === item.node.id}
                dimmed={Boolean(neighbourIds && !neighbourIds.has(item.node.id))}
                onSelect={setSelected}
              />
            ))}
          </svg>
        ) : null}
      </div>

      <div className="graph-status">
        {data ? (
          <span>
            {data.nodes.length} node(s), {data.edges.length} edge(s)
            {data.truncated ? ` — capped at ${limit}; ${data.totalMatched} matched` : ''}
          </span>
        ) : <span />}
      </div>

      {selected ? (
        <aside className="graph-drawer" aria-label="Node details">
          <header>
            <div>
              <span className="analysis-type">{selected.type.replaceAll('_', ' ')}</span>
              <h3>{selected.name}</h3>
            </div>
            <button onClick={() => setSelected(null)} aria-label="Close details"><X size={16} /></button>
          </header>
          {selected.path ? <p className="graph-drawer-path">{selected.path}{selected.startLine ? `:${selected.startLine}` : ''}</p> : null}
          <dl>
            <div><dt>Confidence</dt><dd>{Math.round(selected.confidence * 100)}%</dd></div>
            {selected.language ? <div><dt>Language</dt><dd>{selected.language}</dd></div> : null}
            {Object.entries(selected.metadata ?? {}).slice(0, 6).map(([key, value]) => (
              <div key={key}><dt>{key}</dt><dd>{String(Array.isArray(value) ? value.join(', ') : value).slice(0, 80)}</dd></div>
            ))}
          </dl>
          <div className="graph-drawer-actions">
            <button onClick={() => { setRootId(selected.id); setDepth(2); }}>
              <Crosshair size={14} /> Focus neighbourhood
            </button>
            <button onClick={() => onOpenEntity(selected)}>Open details</button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
