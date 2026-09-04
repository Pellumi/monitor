import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AiExplanation,
  AnalysisComparison,
  CodebaseAnalysis,
  CodebaseFinding,
  CodeEntity,
  CodeEvidence,
  CodeRelationship,
  SoftwareFeature,
} from "@tellann/desktop-contracts";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Cloud,
  Database,
  ExternalLink,
  FileText,
  FolderOpen,
  FolderTree,
  GitCompare,
  GitFork,
  Globe,
  Info,
  Layers,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { CodebaseGraphExplorer } from "./codebase-graph-explorer";
import { useDesktop } from "./desktop-context";

type View =
  | "overview"
  | "hierarchy"
  | "architecture"
  | "dependencies"
  | "features"
  | "graph"
  | "apis"
  | "data"
  | "external"
  | "risks"
  | "changes"
  | "ask";

type FindingKind = CodebaseFinding["kind"];

const FINDING_LABELS: Record<FindingKind, string> = {
  CYCLE: "import cycles",
  COUPLING: "coupling hotspots",
  UNRESOLVED_REFERENCE: "unresolved references",
  STALE_DOCUMENTATION: "stale documents",
  DYNAMIC_CODE: "dynamic call sites",
  UNSUPPORTED_LANGUAGE: "unsupported files",
};

const FINDING_ICONS: Record<FindingKind, typeof AlertTriangle> = {
  CYCLE: RefreshCw,
  COUPLING: Share2,
  UNRESOLVED_REFERENCE: GitFork,
  STALE_DOCUMENTATION: FileText,
  DYNAMIC_CODE: Activity,
  UNSUPPORTED_LANGUAGE: Info,
};

// Highest severity wins the chip colour, so one HIGH cycle is not hidden behind
// a pile of INFO findings of the same kind.
const SEVERITY_RANK = { HIGH: 2, WARNING: 1, INFO: 0 } as const;

const VIEWS: Array<{
  id: View;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "hierarchy", label: "Hierarchy", icon: FolderTree },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "dependencies", label: "Dependencies", icon: GitFork },
  { id: "features", label: "Features", icon: Sparkles },
  { id: "graph", label: "Graph Explorer", icon: Share2 },
  { id: "apis", label: "APIs & UI", icon: Globe },
  { id: "data", label: "Data & Events", icon: Database },
  { id: "external", label: "External Systems", icon: Cloud },
  { id: "risks", label: "Risks", icon: ShieldAlert },
  { id: "changes", label: "Changes", icon: GitCompare },
  { id: "ask", label: "Ask", icon: MessageSquare },
];

const ACTIVE = new Set([
  "QUEUED",
  "INGESTING",
  "PARSING",
  "LINKING",
  "GRAPHING",
  "DISCOVERING_FEATURES",
  "ANALYZING_ARCHITECTURE",
  "SUMMARIZING",
]);

const STAGE_LABEL: Record<string, string> = {
  QUEUED: "Queued",
  INGESTING: "Reading the snapshot",
  PARSING: "Parsing source",
  LINKING: "Resolving references",
  GRAPHING: "Building the graph",
  DISCOVERING_FEATURES: "Discovering functionality",
  ANALYZING_ARCHITECTURE: "Analysing architecture",
  SUMMARIZING: "Preparing views",
};

// ── Shared pieces ────────────────────────────────────────────────────────────

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="analysis-metric" title={hint}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const tier = value >= 0.9 ? "high" : value >= 0.7 ? "medium" : "low";
  const explanation =
    value >= 0.9
      ? "Resolved by the compiler or a framework contract."
      : value >= 0.7
        ? "Read from syntax or corroborated documentation."
        : "Inferred from naming or directory layout. Verify before relying on it.";
  return (
    <span className={`analysis-confidence tier-${tier}`} title={explanation}>
      {Math.round(value * 100)}%
    </span>
  );
}

/** Opens the exact file and line through the main process, which validates it. */
function useEvidenceOpener(applicationId: string) {
  return useCallback(
    async (evidence: Pick<CodeEvidence, "path" | "startLine">) => {
      const result = await window.tellann?.projects?.openCodebaseEvidence?.({
        applicationId,
        path: evidence.path,
        line: evidence.startLine ?? 1,
      });
      if (result && !result.opened) {
        console.warn(
          "[codebase-analysis] Could not open evidence:",
          result.reason,
        );
      }
    },
    [applicationId],
  );
}

function EvidenceLink({
  item,
  onOpen,
}: {
  item: CodeEvidence;
  onOpen: (item: CodeEvidence) => void;
}) {
  return (
    <button
      className="analysis-evidence"
      onClick={() => void onOpen(item)}
      title={`${item.analyzer} · ${Math.round(item.confidence * 100)}% confidence`}
    >
      <ExternalLink size={12} />
      {item.path}
      {item.startLine ? `:${item.startLine}` : ""}
    </button>
  );
}

/**
 * Evidence for one claim. Everything the analysis asserts can be opened here and
 * then in the editor, which is what makes a low-confidence inference checkable
 * rather than something to take on trust.
 */
function EvidenceDrawer({
  title,
  subject,
  evidence,
  onClose,
  onOpen,
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
        <button onClick={onClose} aria-label="Close evidence">
          <X size={16} />
        </button>
      </header>
      {evidence.length ? (
        <ol className="analysis-evidence-list">
          {evidence.map((item, index) => (
            <li key={`${item.path}:${item.startLine}:${index}`}>
              <div className="analysis-evidence-head">
                <span>{item.kind.replaceAll("-", " ")}</span>
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
          This is a derived result with no single source location. It follows
          from the relationships shown in the graph rather than from one line of
          code.
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
  items,
  rowHeight = 58,
  height = 460,
  render,
  empty,
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

  if (!items.length) {
    return (
      <div className="analysis-virtual-empty">
        <Info size={18} />
        <span>{empty}</span>
      </div>
    );
  }

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
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${start * rowHeight}px)` }}>
          {slice.map((item, index) => (
            // Rows are positioned by a fixed height, so anything taller than
            // rowHeight is clipped here rather than painted over its neighbour.
            <div
              key={start + index}
              style={{ height: rowHeight, overflow: "hidden" }}
            >
              {render(item, start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const EntityRow = memo(function EntityRow({
  entity,
  onEvidence,
}: {
  entity: CodeEntity;
  onEvidence: (entity: CodeEntity) => void;
}) {
  return (
    <article className="analysis-list-row">
      <div className="analysis-list-main">
        <span className="analysis-type">
          {entity.type.replaceAll("_", " ")}
        </span>
        <strong className="analysis-list-name">{entity.name}</strong>
        {entity.path ? (
          <small className="analysis-list-path">
            {entity.path}
            {entity.startLine ? `:${entity.startLine}` : ""}
          </small>
        ) : null}
      </div>
      <div className="analysis-list-meta">
        <ConfidenceBadge value={entity.confidence} />
        <button
          type="button"
          className="analysis-inline-button px-2"
          onClick={() => onEvidence(entity)}
        >
          {/* <FileText size={12} /> */}
          Evidence
        </button>
      </div>
    </article>
  );
});

// ── Views ────────────────────────────────────────────────────────────────────

function OverviewView({
  analysis,
  onGoTo,
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

  const findingGroups = useMemo(() => {
    const groups = new Map<
      FindingKind,
      { kind: FindingKind; count: number; severity: CodebaseFinding["severity"] }
    >();
    for (const finding of analysis.findings) {
      const existing = groups.get(finding.kind);
      if (!existing) {
        groups.set(finding.kind, {
          kind: finding.kind,
          count: 1,
          severity: finding.severity,
        });
        continue;
      }
      existing.count += 1;
      if (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[existing.severity]) {
        existing.severity = finding.severity;
      }
    }
    return [...groups.values()].sort(
      (left, right) =>
        SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] ||
        right.count - left.count,
    );
  }, [analysis.findings]);

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
            <div>
              <dt>Revision</dt>
              <dd>
                {analysis.revision
                  ? analysis.revision.slice(0, 10)
                  : "no git history"}
              </dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>{analysis.branch ?? "—"}</dd>
            </div>
            <div>
              <dt>Working tree</dt>
              <dd>{analysis.dirty ? "has uncommitted changes" : "clean"}</dd>
            </div>
            <div>
              <dt>Graph version</dt>
              <dd>{analysis.graphVersion.slice(0, 12)}</dd>
            </div>
            <div>
              <dt>Analyzer</dt>
              <dd>{analysis.analyzerVersions.coordinator ?? "—"}</dd>
            </div>
          </dl>

          <h3>Languages</h3>
          <div
            className="analysis-language-bar"
            role="img"
            aria-label="Language distribution"
          >
            {languages.map(([language, bytes]) => {
              const langKey = language.toLowerCase().replace(/[^a-z]/g, "");
              return (
                <span
                  key={language}
                  style={{ width: `${(bytes / totalBytes) * 100}%` }}
                  title={`${language}: ${Math.round((bytes / totalBytes) * 100)}%`}
                  className={`lang-${langKey}`}
                />
              );
            })}
          </div>
          <ul className="analysis-legend">
            {languages.map(([language, bytes]) => {
              const langKey = language.toLowerCase().replace(/[^a-z]/g, "");
              return (
                <li key={language}>
                  <span className={`analysis-legend-dot lang-${langKey}`} />
                  <span className="analysis-legend-label">{language}</span>
                  <strong className="analysis-legend-pct">
                    {Math.round((bytes / totalBytes) * 100)}%
                  </strong>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3>Analysis coverage</h3>
          {coverage ? (
            <dl className="analysis-facts">
              <div>
                <dt>Files analysed</dt>
                <dd>
                  {coverage.analyzedFiles} of {coverage.analyzableFiles}
                </dd>
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
                      .map(([language, count]) => `${language} (${count})`)
                      .join(", ")}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="analysis-empty">
              Coverage was not recorded for this analysis.
            </p>
          )}

          <h3>Evidence confidence</h3>
          <div
            className="analysis-confidence-bar"
            role="img"
            aria-label="Confidence distribution"
          >
            <span
              className="tier-high"
              style={{
                width: `${(confidenceBuckets.high / totalEntities) * 100}%`,
              }}
              title={`${confidenceBuckets.high} compiler or framework resolved`}
            />
            <span
              className="tier-medium"
              style={{
                width: `${(confidenceBuckets.medium / totalEntities) * 100}%`,
              }}
              title={`${confidenceBuckets.medium} syntax or documentation`}
            />
            <span
              className="tier-low"
              style={{
                width: `${(confidenceBuckets.low / totalEntities) * 100}%`,
              }}
              title={`${confidenceBuckets.low} heuristic`}
            />
          </div>
          <p className="analysis-note">
            {confidenceBuckets.high} resolved, {confidenceBuckets.medium} from
            syntax, {confidenceBuckets.low} inferred.
          </p>
        </section>

        <section className="col-span-2">
          <div className="analysis-section-head">
            <h3>Key findings</h3>
            {analysis.findings.length ? (
              <button
                className="analysis-section-link"
                onClick={() => onGoTo("risks")}
              >
                All {analysis.findings.length}
                <ChevronRight size={13} />
              </button>
            ) : null}
          </div>
          {findingGroups.length ? (
            <ul className="analysis-finding-summary">
              {findingGroups.map((group) => {
                const Icon = FINDING_ICONS[group.kind] ?? AlertTriangle;
                return (
                  <li key={group.kind}>
                    <button
                      className={`analysis-finding-chip severity-${group.severity.toLowerCase()} rounded-none!`}
                      onClick={() => onGoTo("risks")}
                      title={`${group.count} ${FINDING_LABELS[group.kind] ?? group.kind} / highest severity ${group.severity.toLowerCase()}`}
                    >
                      {/* <span className="analysis-finding-icon">
                        <Icon size={14} />
                      </span> */}
                      <span className="analysis-finding-text">
                        <strong>{group.count}</strong>
                        <span>{FINDING_LABELS[group.kind] ?? group.kind}</span>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="analysis-clear">
              <ShieldCheck size={14} />
              No structural risks were detected.
            </p>
          )}

          {architecture ? (
            <>
              <div className="analysis-section-head">
                <h3>Architecture</h3>
                <button
                  className="analysis-section-link"
                  onClick={() => onGoTo("architecture")}
                >
                  Explore
                  <ChevronRight size={13} />
                </button>
              </div>
              <div className="analysis-stat-row">
                <div className="analysis-stat">
                  <strong>{architecture.metrics.modules}</strong>
                  <span>Modules</span>
                </div>
                <div
                  className={
                    architecture.metrics.cycles
                      ? "analysis-stat is-warn"
                      : "analysis-stat"
                  }
                >
                  <strong>{architecture.metrics.cycles}</strong>
                  <span>Cycles</span>
                </div>
                <div className="analysis-stat">
                  <strong>{architecture.metrics.averageFanIn}</strong>
                  <span>Avg fan-in</span>
                </div>
                <div
                  className={
                    architecture.metrics.orphanModules
                      ? "analysis-stat is-warn"
                      : "analysis-stat"
                  }
                >
                  <strong>{architecture.metrics.orphanModules}</strong>
                  <span>Never imported</span>
                </div>
              </div>
            </>
          ) : null}

          <div className="analysis-section-head">
            <h3>Top functionality</h3>
            {analysis.features.length > 6 ? (
              <button
                className="analysis-section-link"
                onClick={() => onGoTo("features")}
              >
                All {analysis.features.length}
                <ChevronRight size={13} />
              </button>
            ) : null}
          </div>
          {analysis.features.length ? (
            <ul className="analysis-feature-list">
              {analysis.features.slice(0, 6).map((feature, index) => (
                <li key={feature.id}>
                  <button
                    className="analysis-feature-link"
                    onClick={() => onGoTo("features")}
                    title={feature.description || feature.name}
                  >
                    <span className="analysis-feature-rank">{index + 1}</span>
                    <span className="analysis-feature-text">
                      <strong>{feature.name}</strong>
                      <span>
                        {feature.domain || "no domain"}
                        {feature.workflow.length
                          ? ` / ${feature.workflow.length} step${feature.workflow.length === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="analysis-clear">
              <Workflow size={14} />
              No user-facing functionality was inferred yet.
            </p>
          )}
        </section>
      </div>

      {analysis.warnings.length || analysis.notices.length ? (
        <div className="analysis-warnings">
          {analysis.warnings.map((warning) => (
            <div className="analysis-warning" key={warning}>
              <AlertTriangle size={15} />
              {warning}
            </div>
          ))}
          {/* Notices are things that worked as intended, not gaps in the result. */}
          {analysis.notices.map((notice) => (
            <div className="analysis-notice" key={notice}>
              <Info size={15} />
              {notice}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

/** Lazy tree over CONTAINS/DEFINES, expanding only what the user opens. */
function HierarchyView({
  analysis,
  onEvidence,
}: {
  analysis: CodebaseAnalysis;
  onEvidence: (entity: CodeEntity) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of analysis.relationships) {
      if (edge.type !== "CONTAINS" && edge.type !== "DEFINES") continue;
      const bucket = map.get(edge.source);
      if (bucket) bucket.push(edge.target);
      else map.set(edge.source, [edge.target]);
    }
    return map;
  }, [analysis.relationships]);

  const byId = useMemo(
    () =>
      new Map<string, CodeEntity>(
        analysis.entities.map((entity) => [entity.id, entity]),
      ),
    [analysis.entities],
  );
  const roots = useMemo(() => {
    const repository = analysis.entities.filter(
      (entity) => entity.type === "repository",
    );
    if (repository.length) return repository;
    return analysis.entities.filter(
      (entity) => entity.type === "application" || entity.type === "service",
    );
  }, [analysis.entities]);

  // Flattened to only what is currently open, so the row count stays small.
  const rows = useMemo(() => {
    const output: Array<{
      entity: CodeEntity;
      depth: number;
      expandable: boolean;
    }> = [];
    const walk = (ids: string[], depth: number) => {
      if (depth > 12) return;
      const entities = ids
        .map((id) => byId.get(id))
        .filter(Boolean) as CodeEntity[];
      entities.sort((left, right) =>
        left.type < right.type
          ? -1
          : left.type > right.type
            ? 1
            : left.name.localeCompare(right.name),
      );
      for (const entity of entities) {
        const kids = childrenOf.get(entity.id) ?? [];
        output.push({ entity, depth, expandable: kids.length > 0 });
        if (expanded.has(entity.id)) walk(kids, depth + 1);
      }
    };
    walk(
      roots.map((entity) => entity.id),
      0,
    );
    return output;
  }, [roots, byId, childrenOf, expanded]);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <p className="analysis-note mb-2!">
        {rows.length} row(s) shown. Branches load only when you open them.
      </p>
      <VirtualList
        items={rows}
        rowHeight={40}
        empty="The hierarchy is empty for this analysis."
        render={(row) => (
          <div
            className="analysis-tree-row"
            style={{ paddingLeft: 8 + row.depth * 18 }}
          >
            <div className="analysis-tree-main">
              {row.expandable ? (
                <button
                  type="button"
                  className="analysis-tree-toggle"
                  onClick={() => toggle(row.entity.id)}
                  aria-expanded={expanded.has(row.entity.id)}
                  title={
                    expanded.has(row.entity.id)
                      ? "Collapse branch"
                      : "Expand branch"
                  }
                >
                  {expanded.has(row.entity.id) ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
              ) : (
                <span className="analysis-tree-spacer" />
              )}
              <span className="analysis-type">
                {row.entity.type.replaceAll("_", " ")}
              </span>
              <strong className="analysis-tree-name">{row.entity.name}</strong>
            </div>
            <div className="analysis-tree-meta">
              <ConfidenceBadge value={row.entity.confidence} />
              <button
                type="button"
                className="analysis-inline-button px-2! no-underline!"
                onClick={() => onEvidence(row.entity)}
              >
                {/* <FileText size={12} /> */}
                Evidence
              </button>
            </div>
          </div>
        )}
      />
    </>
  );
}

function ArchitectureView({
  analysis,
  onEvidence,
}: {
  analysis: CodebaseAnalysis;
  onEvidence: (entity: CodeEntity) => void;
}) {
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const domains = analysis.architecture?.domains ?? [];

  const membersOf = useMemo(() => {
    const map = new Map<string, CodeEntity[]>();
    const byId = new Map<string, CodeEntity>(
      analysis.entities.map((entity) => [entity.id, entity]),
    );
    for (const edge of analysis.relationships) {
      if (edge.type !== "BELONGS_TO_DOMAIN") continue;
      const entity = byId.get(edge.source);
      if (!entity || entity.type !== "file") continue;
      const bucket = map.get(edge.target);
      if (bucket) bucket.push(entity);
      else map.set(edge.target, [entity]);
    }
    return map;
  }, [analysis.entities, analysis.relationships]);

  const dataStores = analysis.entities.filter(
    (entity) =>
      entity.type === "database_model" || entity.type === "database_table",
  );
  const queues = analysis.entities.filter(
    (entity) => entity.type === "queue" || entity.type === "event",
  );
  const externals = analysis.entities.filter(
    (entity) => entity.type === "external_service",
  );

  return (
    <div className="analysis-architecture">
      <section>
        <h3>Domains</h3>
        <p className="analysis-note">
          Discovered by clustering the dependency graph, then named from the
          directories, data models, and routes the cluster shares. Confidence
          reflects how many of those signals agreed.
        </p>
        <div className="analysis-domain-grid">
          {domains.map((domain) => (
            <article
              key={domain.id}
              className={`analysis-domain-card${openDomain === domain.id ? " open" : ""}`}
            >
              <button
                onClick={() =>
                  setOpenDomain(openDomain === domain.id ? null : domain.id)
                }
              >
                <div>
                  <h4>{domain.name}</h4>
                  <small>{domain.memberCount} module(s)</small>
                </div>
                <ConfidenceBadge value={domain.confidence} />
              </button>
              {openDomain === domain.id ? (
                <div className="analysis-domain-body">
                  <p className="analysis-note">
                    Signals: {domain.signals.join(", ") || "directory layout"}
                  </p>
                  <VirtualList
                    items={membersOf.get(domain.id) ?? []}
                    rowHeight={54}
                    height={260}
                    empty="No modules were attributed to this domain."
                    render={(entity) => (
                      <EntityRow entity={entity} onEvidence={onEvidence} />
                    )}
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
        {!domains.length ? (
          <p className="analysis-empty">
            No domains were derived for this snapshot.
          </p>
        ) : null}
      </section>

      <div className="analysis-architecture-columns">
        <section>
          <h3>Data stores ({dataStores.length})</h3>
          <VirtualList
            items={dataStores}
            height={220}
            empty="No data models were discovered."
            render={(entity) => (
              <EntityRow entity={entity} onEvidence={onEvidence} />
            )}
          />
        </section>
        <section>
          <h3>Events and queues ({queues.length})</h3>
          <VirtualList
            items={queues}
            height={220}
            empty="No events or queues were discovered."
            render={(entity) => (
              <EntityRow entity={entity} onEvidence={onEvidence} />
            )}
          />
        </section>
        <section>
          <h3>External systems ({externals.length})</h3>
          <VirtualList
            items={externals}
            height={220}
            empty="No external systems were discovered."
            render={(entity) => (
              <EntityRow entity={entity} onEvidence={onEvidence} />
            )}
          />
        </section>
      </div>
    </div>
  );
}

const RESOLUTIONS: Array<{ id: CodeEntity["type"]; label: string }> = [
  { id: "package", label: "Package" },
  { id: "file", label: "Module" },
  { id: "class", label: "Class" },
  { id: "function", label: "Function" },
];

function DependenciesView({
  analysis,
  query,
  onEvidence,
}: {
  analysis: CodebaseAnalysis;
  query: string;
  onEvidence: (entity: CodeEntity) => void;
}) {
  const [resolution, setResolution] = useState<CodeEntity["type"]>("file");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [relationship, setRelationship] = useState<string>("ALL");
  const [selected, setSelected] = useState<CodeEntity | null>(null);

  const candidates = useMemo(
    () =>
      analysis.entities.filter(
        (entity) =>
          entity.type === resolution &&
          (!query ||
            `${entity.name} ${entity.path ?? ""}`
              .toLowerCase()
              .includes(query)),
      ),
    [analysis.entities, resolution, query],
  );

  const related = useMemo(() => {
    if (!selected) return [];
    const byId = new Map<string, CodeEntity>(
      analysis.entities.map((entity) => [entity.id, entity]),
    );
    return analysis.relationships
      .filter(
        (edge) =>
          (direction === "out" ? edge.source : edge.target) === selected.id,
      )
      .filter((edge) => relationship === "ALL" || edge.type === relationship)
      .map((edge) => ({
        edge,
        entity: byId.get(direction === "out" ? edge.target : edge.source),
      }))
      .filter((item): item is { edge: CodeRelationship; entity: CodeEntity } =>
        Boolean(item.entity),
      );
  }, [selected, analysis, direction, relationship]);

  const relationshipTypes = useMemo(
    () => ["ALL", ...new Set(analysis.relationships.map((edge) => edge.type))],
    [analysis.relationships],
  );

  return (
    <div className="analysis-dependencies">
      <div className="analysis-controls">
        <label>
          Resolution
          <select
            value={resolution}
            onChange={(event) => {
              setResolution(event.target.value as CodeEntity["type"]);
              setSelected(null);
            }}
          >
            {RESOLUTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Direction
          <select
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as "out" | "in")
            }
          >
            <option value="out">Depends on</option>
            <option value="in">Depended on by</option>
          </select>
        </label>
        <label>
          Relationship
          <select
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
          >
            {relationshipTypes.map((type) => (
              <option key={type} value={type}>
                {type === "ALL"
                  ? "All"
                  : type.replaceAll("_", " ").toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="analysis-two-column">
        <div>
          <h4>
            {candidates.length} {resolution.replaceAll("_", " ")}(s)
          </h4>
          <VirtualList
            items={candidates}
            height={420}
            empty="Nothing matches this filter."
            render={(entity) => (
              <button
                className={`analysis-picker-row${selected?.id === entity.id ? " active" : ""}`}
                onClick={() => setSelected(entity)}
              >
                <strong>{entity.name}</strong>
                {entity.path ? <small>{entity.path}</small> : null}
              </button>
            )}
          />
        </div>
        <div>
          <h4>
            {selected
              ? `${direction === "out" ? "Depends on" : "Depended on by"} (${related.length})`
              : "Select an item"}
          </h4>
          {selected ? (
            <VirtualList
              items={related}
              height={420}
              empty={
                direction === "out"
                  ? "This unit has no outgoing dependencies of the selected kind."
                  : "Nothing depends on this unit through the selected relationship."
              }
              render={(item) => (
                <article className="analysis-list-row">
                  <div>
                    <span className="analysis-type">
                      {item.edge.type.replaceAll("_", " ").toLowerCase()}
                    </span>
                    <strong>{item.entity.name}</strong>
                    {item.entity.path ? (
                      <small>{item.entity.path}</small>
                    ) : null}
                  </div>
                  <ConfidenceBadge value={item.edge.confidence} />
                  <button
                    className="analysis-inline-button"
                    onClick={() => onEvidence(item.entity)}
                  >
                    Evidence
                  </button>
                </article>
              )}
            />
          ) : (
            <p className="analysis-empty">
              Choose an item on the left to see what it connects to.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const FEATURE_PAGE_SIZE = 12;
const FEATURE_STEP_LIMIT = 8;

// Workflow labels arrive as "kind: value" ("endpoint: GET /zones"). Splitting
// them lets the kind render as a tag instead of repeating inside every line.
function splitStepLabel(label: string): { kind: string | null; text: string } {
  const separator = label.indexOf(": ");
  if (separator === -1) return { kind: null, text: label };
  return { kind: label.slice(0, separator), text: label.slice(separator + 2) };
}

function featureEffects(
  feature: SoftwareFeature,
): Array<{ verb: string; value: string }> {
  const effects: Array<{ verb: string; value: string }> = [];
  if (feature.reads.length)
    effects.push({ verb: "Reads", value: feature.reads.join(", ") });
  if (feature.writes.length)
    effects.push({ verb: "Writes", value: feature.writes.join(", ") });
  if (feature.externalServices.length)
    effects.push({ verb: "Calls", value: feature.externalServices.join(", ") });
  if (feature.emittedEvents.length)
    effects.push({ verb: "Publishes", value: feature.emittedEvents.join(", ") });
  for (const effect of feature.downstreamEffects)
    effects.push({ verb: "Then", value: effect });
  if (feature.authorization.length)
    effects.push({ verb: "Auth", value: feature.authorization.join(", ") });
  return effects;
}

const FeatureCard = memo(function FeatureCard({
  feature,
  explanation,
  onEvidence,
}: {
  feature: SoftwareFeature;
  explanation: AiExplanation | undefined;
  onEvidence: (subject: string, evidence: CodeEvidence[]) => void;
}) {
  const steps = feature.workflow.slice(0, FEATURE_STEP_LIMIT);
  const hiddenSteps = feature.workflow.length - steps.length;
  const effects = featureEffects(feature);

  return (
    <article className="analysis-feature-card">
      <header>
        <span className="analysis-feature-domain">
          {feature.domain || "unscoped"}
        </span>
        <ConfidenceBadge value={feature.confidence} />
      </header>
      <h3>{feature.name}</h3>
      {feature.description ? <p>{feature.description}</p> : null}
      {explanation?.grounded ? (
        <p className="analysis-provenance">
          <Info size={12} /> Described by {explanation.model} from evidence only
          ({explanation.promptVersion}).
        </p>
      ) : null}
      <div className="analysis-feature-columns">
        <div>
          <h4>
            Workflow
            <span>{feature.workflow.length}</span>
          </h4>
          {steps.length ? (
            <ol className="analysis-step-list">
              {steps.map((step, index) => {
                const { kind, text } = splitStepLabel(step.label);
                return (
                  <li key={`${step.entityId}-${index}`}>
                    <span className="analysis-step-index">{index + 1}</span>
                    <span className="analysis-step-body">
                      {kind ? (
                        <span className="analysis-step-kind">{kind}</span>
                      ) : null}
                      <span className="analysis-step-text">{text}</span>
                    </span>
                  </li>
                );
              })}
              {hiddenSteps > 0 ? (
                <li className="analysis-step-more">
                  +{hiddenSteps} further step{hiddenSteps === 1 ? "" : "s"}
                </li>
              ) : null}
            </ol>
          ) : (
            <p className="analysis-muted">No workflow steps were resolved.</p>
          )}
        </div>
        <div>
          <h4>
            Effects
            <span>{effects.length}</span>
          </h4>
          {effects.length ? (
            <ul className="analysis-effect-list">
              {effects.map((effect, index) => (
                <li key={`${effect.verb}-${index}`}>
                  <span className="analysis-effect-verb">{effect.verb}</span>
                  <span className="analysis-effect-value">{effect.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="analysis-muted">
              No data, event, or external effects were resolved.
            </p>
          )}
        </div>
      </div>
      <footer>
        <span>
          {feature.sourceFiles.length} file
          {feature.sourceFiles.length === 1 ? "" : "s"}
        </span>
        <button
          className="analysis-inline-button"
          onClick={() => onEvidence(feature.name, feature.evidence)}
        >
          <FileText size={13} />
          Evidence
        </button>
      </footer>
    </article>
  );
});

function FeaturesView({
  analysis,
  query,
  onEvidence,
}: {
  analysis: CodebaseAnalysis;
  query: string;
  onEvidence: (subject: string, evidence: CodeEvidence[]) => void;
}) {
  const [domain, setDomain] = useState("ALL");
  const [visibleCount, setVisibleCount] = useState(FEATURE_PAGE_SIZE);
  const domains = useMemo(
    () =>
      [
        "ALL",
        ...new Set(analysis.features.map((feature) => feature.domain)),
      ].sort(),
    [analysis.features],
  );
  const explanations = useMemo(
    () => new Map(analysis.explanations.map((item) => [item.featureId, item])),
    [analysis.explanations],
  );

  const features = useMemo(
    () =>
      analysis.features.filter(
        (feature) =>
          (domain === "ALL" || feature.domain === domain) &&
          (!query ||
            `${feature.name} ${feature.description} ${feature.triggers.join(" ")}`
              .toLowerCase()
              .includes(query)),
      ),
    [analysis.features, domain, query],
  );

  // A feature card is as tall as its workflow, so the list grows a page at a
  // time rather than windowing rows at a fixed height they routinely outgrow.
  useEffect(() => {
    setVisibleCount(FEATURE_PAGE_SIZE);
  }, [domain, query, analysis.features]);

  const shown = features.slice(0, visibleCount);

  return (
    <>
      <div className="analysis-controls">
        <label>
          Domain
          <select
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
          >
            {domains.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "All domains" : item}
              </option>
            ))}
          </select>
        </label>
        <span className="analysis-note">
          {features.length} of {analysis.features.length} features
        </span>
      </div>
      {shown.length ? (
        <>
          <div className="analysis-feature-grid">
            {shown.map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                explanation={explanations.get(feature.id)}
                onEvidence={onEvidence}
              />
            ))}
          </div>
          {visibleCount < features.length ? (
            <div className="analysis-more-row">
              <span>
                Showing {shown.length} of {features.length}
              </span>
              <button
                className="analysis-inline-button"
                onClick={() =>
                  setVisibleCount((count) => count + FEATURE_PAGE_SIZE)
                }
              >
                <ChevronDown size={13} />
                Show{" "}
                {Math.min(FEATURE_PAGE_SIZE, features.length - shown.length)}{" "}
                more
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="analysis-virtual-empty">
          <Info size={18} />
          <span>No features match this filter.</span>
        </div>
      )}
    </>
  );
}

function RisksView({
  analysis,
  applicationId,
  onEvidence,
}: {
  analysis: CodebaseAnalysis;
  applicationId: string;
  onEvidence: (subject: string, evidence: CodeEvidence[]) => void;
}) {
  const [target, setTarget] = useState("");
  const [radius, setRadius] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(
    () =>
      analysis.entities.filter((entity) =>
        ["file", "class", "function", "method", "database_model"].includes(
          entity.type,
        ),
      ),
    [analysis.entities],
  );

  const run = async (entityId: string) => {
    setBusy(true);
    try {
      const result = await window.tellann?.projects?.codebaseQuery?.({
        applicationId,
        kind: "blast-radius",
        payload: { entityId },
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
            <article
              className={`analysis-finding severity-${finding.severity.toLowerCase()}`}
            >
              <AlertTriangle size={18} />
              <div>
                <span>
                  {finding.severity} ·{" "}
                  {finding.kind.replaceAll("_", " ").toLowerCase()}
                </span>
                <h4>{finding.title}</h4>
                <p>{finding.description}</p>
                {finding.evidence.length ? (
                  <button
                    className="analysis-inline-button"
                    onClick={() => onEvidence(finding.title, finding.evidence)}
                  >
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
        <p className="analysis-note">
          What could break if you change this, following incoming dependencies.
        </p>
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
            items={candidates
              .filter((entity) =>
                `${entity.name} ${entity.path ?? ""}`
                  .toLowerCase()
                  .includes(target.toLowerCase()),
              )
              .slice(0, 200)}
            height={200}
            empty="Nothing matches that name."
            render={(entity) => (
              <button
                className="analysis-picker-row"
                onClick={() => void run(entity.id)}
              >
                <strong>{entity.name}</strong>
                {entity.path ? <small>{entity.path}</small> : null}
              </button>
            )}
          />
        ) : null}
        {busy ? (
          <p className="analysis-note">
            <Loader2 size={14} className="spin" /> Calculating…
          </p>
        ) : null}
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
        {radius?.truncated ? (
          <p className="analysis-note">
            The result was capped; the true reach is larger.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function ChangesView({ applicationId }: { applicationId: string }) {
  const [comparison, setComparison] = useState<AnalysisComparison | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await window.tellann?.projects?.codebaseQuery?.({
          applicationId,
          kind: "compare",
        });
        if (cancelled) return;
        if (result?.summary && Array.isArray(result.changes)) {
          setComparison(result);
          setState("ready");
        } else {
          setReason(
            result?.message ??
              "Two completed analyses are needed before changes can be compared.",
          );
          setState("unavailable");
        }
      } catch (error) {
        if (cancelled) return;
        setReason(
          error instanceof Error
            ? error.message
            : "Change analysis is unavailable.",
        );
        setState("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (state === "loading")
    return (
      <p className="analysis-note">
        <Loader2 size={14} className="spin" /> Comparing snapshots…
      </p>
    );
  if (state === "unavailable" || !comparison)
    return <p className="analysis-empty">{reason}</p>;

  return (
    <>
      <div className="analysis-metrics compact">
        <Metric
          label="Features added"
          value={comparison.summary.featuresAdded}
        />
        <Metric
          label="Features changed"
          value={comparison.summary.featuresChanged}
        />
        <Metric
          label="Features removed"
          value={comparison.summary.featuresRemoved}
        />
        <Metric
          label="Endpoints added"
          value={comparison.summary.endpointsAdded}
        />
        <Metric
          label="External systems added"
          value={comparison.summary.externalsAdded}
        />
      </div>
      <p className="analysis-note">
        {comparison.fromRevision?.slice(0, 8) ?? "previous"} →{" "}
        {comparison.toRevision?.slice(0, 8) ?? "current"}
      </p>
      <VirtualList
        items={comparison.changes}
        rowHeight={76}
        height={480}
        empty="Nothing changed architecturally between these two snapshots."
        render={(change) => (
          <article
            className={`analysis-change kind-${change.kind.toLowerCase()}`}
          >
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
  const [question, setQuestion] = useState("");
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
        applicationId,
        kind: "ask",
        payload: { question },
      });
      setAnswer(result ?? null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The question could not be answered.",
      );
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
          onKeyDown={(event) => {
            if (event.key === "Enter") void ask();
          }}
          placeholder="How does checkout work? What calls Stripe? What breaks if I change UserRepository?"
          aria-label="Ask about this repository"
        />
        <button onClick={() => void ask()} disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : "Ask"}
        </button>
      </div>
      <p className="analysis-note">
        Answers are built from the analysed graph and cite the code they came
        from. Anything the analysis did not discover will be reported as unknown
        rather than guessed.
      </p>
      {error ? <p className="analysis-empty">{error}</p> : null}
      {answer ? (
        <div className="analysis-answer">
          {answer.uncertainty ? (
            <div className="analysis-warning">
              <AlertTriangle size={15} />
              {answer.uncertainty}
            </div>
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
                  <Info size={12} /> Deterministic description; no model output
                  was accepted for this feature.
                </p>
              ) : null}
              <div className="analysis-citations">
                {(item.citations ?? []).map(
                  (citation: CodeEvidence, index: number) => (
                    <EvidenceLink
                      key={`${citation.path}-${index}`}
                      item={citation}
                      onOpen={openEvidence}
                    />
                  ),
                )}
              </div>
            </article>
          ))}
          {!(answer.features ?? []).length ? (
            <p className="analysis-empty">{answer.answer}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

/**
 * The worker reports a folder it cannot open as a raw `ENOENT` against a path
 * it has already redacted to `[workspace]`, which tells the reader nothing and
 * cannot be fixed by retrying — the folder has to be attached again.
 */
function isMissingWorkspaceFailure(detail: string | null | undefined): boolean {
  return /ENOENT|no such file or directory|WORKSPACE_NOT_ATTACHED/i.test(detail ?? "");
}

/**
 * Every state where the panel has nothing to show: what happened, the technical
 * detail underneath it, and the action that actually resolves it.
 *
 * These used to be bare children of `.analysis-shell`, which has no padding of
 * its own, so a full-bleed warning bar and an unaligned button sat flush against
 * the card edges. The shell stays padding-free for the data views; this supplies
 * its own frame.
 */
function AnalysisStateCard({
  title,
  description,
  detail,
  actions,
}: {
  title: string;
  description: string;
  detail?: string | null;
  actions: ReactNode;
}) {
  return (
    <section className="content-card analysis-shell w-full">
      <div className="analysis-state w-full max-w-none p-0!">
        {/* <AlertTriangle size={18} className="analysis-state-icon" /> */}
        <h2>{title}</h2>
        <p>{description}</p>
        {detail ? <p className="analysis-state-detail">{detail}</p> : null}
        <div className="analysis-state-actions ml-auto!">{actions}</div>
      </div>
    </section>
  );
}

export function CodebaseAnalysisPanel({
  applicationId,
  workspaceRoot,
}: {
  applicationId: string;
  workspaceRoot: string;
}) {
  const { attachWorkspace, busy } = useDesktop();
  const [view, setView] = useState<View>("overview");
  const [state, setState] = useState<CodebaseAnalysisView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<{
    subject: string;
    evidence: CodeEvidence[];
  } | null>(null);
  const deferredQuery = useDeferredValue(query.toLowerCase());
  const openEvidence = useEvidenceOpener(applicationId);

  // Bumped whenever something starts new work, so polling restarts. Without it
  // a rescan runs in the main process while this view sits on the old result.
  const [reloadToken, setReloadToken] = useState(0);
  const [rescan, setRescan] = useState<{
    busy: boolean;
    message: string | null;
    /** The rescan cannot proceed until a folder is attached again. */
    needsAttach: boolean;
  }>({ busy: false, message: null, needsAttach: false });

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = async () => {
      try {
        const next =
          await window.tellann?.projects.getCodebaseAnalysis(applicationId);
        if (stopped) return;
        setState(
          next?.analysis
            ? {
                ...next,
                // Local analysis snapshots created before notices were added do
                // not contain this collection. Normalize persisted snapshots at
                // the renderer boundary so opening Workspace remains compatible.
                analysis: {
                  ...next.analysis,
                  warnings: next.analysis.warnings ?? [],
                  notices: next.analysis.notices ?? [],
                },
              }
            : (next ?? null),
        );
        setLoaded(true);
        const status = next?.job?.status ?? next?.analysis?.status;
        // Poll while work is in flight; settle once it is done.
        if (!next || (status && ACTIVE.has(status)))
          timer = setTimeout(refresh, 1_500);
      } catch {
        if (!stopped) {
          setLoaded(true);
          timer = setTimeout(refresh, 5_000);
        }
      }
    };
    void refresh();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [applicationId, reloadToken]);

  /**
   * Start a fresh analysis of the attached folder. Reports what happened either
   * way: a cloud-backed workspace needs re-attaching so consent is asked against
   * the new revision, and a failure has to be visible rather than swallowed.
   */
  const startRescan = useCallback(async () => {
    setRescan({ busy: true, message: null, needsAttach: false });
    try {
      const result =
        await window.tellann?.projects?.rescanCodebase?.(applicationId);
      if (!result) {
        setRescan({
          busy: false,
          message: "This build of the desktop app cannot start a rescan.",
          needsAttach: false,
        });
        return;
      }
      if (result.requiresReattach) {
        setRescan({
          busy: false,
          message:
            "This workspace sends its source for cloud analysis. Attaching the folder again analyses the current revision, so consent is asked against what would actually be uploaded.",
          needsAttach: true,
        });
        return;
      }
      setRescan({ busy: false, message: null, needsAttach: false });
      setReloadToken((value) => value + 1);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The rescan could not be started.";
      setRescan({
        busy: false,
        message,
        needsAttach: isMissingWorkspaceFailure(message),
      });
    }
  }, [applicationId]);

  /**
   * Opens the folder picker and restarts polling. Attaching runs a fresh
   * analysis in the main process, so the panel only has to look again.
   */
  const attachFolder = useCallback(async () => {
    const attached = await attachWorkspace(applicationId).catch(() => null);
    if (!attached) return;
    setRescan({ busy: false, message: null, needsAttach: false });
    setReloadToken((value) => value + 1);
  }, [attachWorkspace, applicationId]);

  const analysis = state?.analysis ?? null;
  const status = state?.job?.status ?? analysis?.status ?? null;
  const progress = state?.job?.progress ?? analysis?.progress ?? 0;
  const stageMessage = state?.job?.stageMessage ?? analysis?.stageMessage ?? "";

  const showEntityEvidence = useCallback((entity: CodeEntity) => {
    setDrawer({ subject: entity.name, evidence: entity.evidence });
  }, []);
  const showEvidence = useCallback(
    (subject: string, evidence: CodeEvidence[]) => {
      setDrawer({ subject, evidence });
    },
    [],
  );

  const loadGraph = useCallback(
    async (input: {
      search: string;
      types: string[];
      relationshipTypes: string[];
      depth: number;
      limit: number;
      rootId: string | null;
    }) => {
      // The main process answers this from the local graph or the cloud API
      // depending on how the workspace was attached, so there is one path here.
      const result = await window.tellann?.projects?.codebaseQuery?.({
        applicationId,
        kind: "graph",
        payload: input,
      });
      return result ?? null;
    },
    [applicationId],
  );

  const filteredEntities = useMemo(() => {
    if (!analysis) return [];
    if (!deferredQuery) return analysis.entities;
    return analysis.entities.filter((entity) =>
      `${entity.name} ${entity.path ?? ""} ${entity.type}`
        .toLowerCase()
        .includes(deferredQuery),
    );
  }, [analysis, deferredQuery]);

  if (!loaded) {
    return (
      <section className="content-card analysis-shell">
        <p className="analysis-note">
          <Loader2 size={14} className="spin" /> Checking analysis status…
        </p>
      </section>
    );
  }

  if (!state) {
    return (
      <AnalysisStateCard
        title="No code graph yet"
        description="Deep analysis has not run for this application. Attach the project folder to build a versioned code graph from it."
        actions={
          <button
            className="analysis-btn-primary"
            onClick={() => void attachFolder()}
            disabled={busy}
          >
            <FolderOpen size={14} />
            Attach folder
          </button>
        }
      />
    );
  }

  if (state.unreachable) {
    return (
      <section className="content-card analysis-shell">
        <div className="analysis-warning">
          <AlertTriangle size={15} />
          The analysis service could not be reached, so this view may be out of
          date. {state.unreachable}
        </div>
        {analysis ? (
          <p className="analysis-note">
            Showing the last result stored on this device.
          </p>
        ) : null}
      </section>
    );
  }

  // In-flight, whether it is running here or in the cloud.
  if (status && ACTIVE.has(status)) {
    return (
      <section className="content-card analysis-shell p-0!">
        <div className="analysis-progress-head">
          <div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span className="analysis-badge">
                Codebase //{" "}
                {state.mode === "cloud" ? "Cloud Analysis" : "Local Analysis"}
              </span>
            </div>
            <h2>{STAGE_LABEL[status] ?? status}</h2>
            <p>{stageMessage}</p>
          </div>
          <button
            className="analysis-btn-secondary"
            onClick={() =>
              void window.tellann?.projects.cancelCodebaseAnalysis(
                applicationId,
              )
            }
          >
            Cancel
          </button>
        </div>
        <div className="analysis-progress">
          <span style={{ width: `${Math.max(progress, 2)}%` }} />
        </div>
        <p className="analysis-note">
          {progress}%
          {state.uploadProgress
            ? ` · uploading part ${state.uploadProgress.sent} of ${state.uploadProgress.total}`
            : ""}
          {state.job
            ? ` · attempt ${state.job.attempt} of ${state.job.maxAttempts}`
            : ""}{" "}
          · results appear as each stage completes, and this continues if you
          navigate away.
        </p>
        {state.interrupted ? (
          <div className="analysis-warning">
            <AlertTriangle size={15} />
            The previous run stopped when the desktop closed. It was restarted
            from the beginning.
          </div>
        ) : null}
        {analysis && analysis.entities.length ? (
          <p className="analysis-note">
            Partial results so far: {analysis.summary.files} file(s),{" "}
            {analysis.summary.features} feature(s).
          </p>
        ) : null}
      </section>
    );
  }

  if (status === "FAILED") {
    const failure = state.job?.errorMessageSafe ?? analysis?.stageMessage ?? null;
    // A folder that cannot be opened is not something a retry can fix, and the
    // raw ENOENT names a path that was redacted to "[workspace]" on the way
    // here — so it is stated plainly and answered with the picker instead.
    const missingFolder = isMissingWorkspaceFailure(failure);
    const needsAttach = missingFolder || rescan.needsAttach;
    return (
      <AnalysisStateCard
        title={missingFolder ? "The project folder is missing" : "Analysis failed"}
        description={
          missingFolder
            ? "Tellann could not open the folder attached to this application, it has been moved, renamed, or deleted since the last analysis. Attach it again to rebuild the code graph."
            : "The codebase analysis stopped before it finished, so no results were saved from this run."
        }
        detail={rescan.message ?? (missingFolder ? null : failure)}
        actions={
          needsAttach ? (
            <button
              className="analysis-btn-primary"
              onClick={() => void attachFolder()}
              disabled={busy}
            >
              <FolderOpen size={14} />
              Attach folder
            </button>
          ) : (
            <button
              className="analysis-btn-primary"
              onClick={() => void startRescan()}
              disabled={rescan.busy}
            >
              {rescan.busy ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {rescan.busy ? "Starting…" : "Try again"}
            </button>
          )
        }
      />
    );
  }

  if (!analysis) {
    return (
      <AnalysisStateCard
        title={status === "CANCELLED" ? "Analysis cancelled" : "No results yet"}
        description={
          status === "CANCELLED"
            ? "This analysis was stopped before it produced a code graph. Start a new one, or attach a different folder."
            : "No analysis results are available for this application yet. Run one against the attached folder to build a code graph."
        }
        detail={rescan.message}
        actions={
          <>
            <button
              className="analysis-btn-primary"
              onClick={() => void startRescan()}
              disabled={rescan.busy || busy}
            >
              {rescan.busy ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {rescan.busy ? "Starting…" : "Run analysis"}
            </button>
            <button
              className="analysis-btn-secondary"
              onClick={() => void attachFolder()}
              disabled={busy}
            >
              <FolderOpen size={14} />
              Attach folder
            </button>
          </>
        }
      />
    );
  }

  const typeFilters: Partial<Record<View, CodeEntity["type"][]>> = {
    apis: ["endpoint", "ui_route", "ui_action"],
    data: ["database_model", "database_table", "event", "queue", "job"],
    external: ["external_service"],
  };

  const renderView = () => {
    switch (view) {
      case "overview":
        return <OverviewView analysis={analysis} onGoTo={setView} />;
      case "hierarchy":
        return (
          <HierarchyView analysis={analysis} onEvidence={showEntityEvidence} />
        );
      case "architecture":
        return (
          <ArchitectureView
            analysis={analysis}
            onEvidence={showEntityEvidence}
          />
        );
      case "dependencies":
        return (
          <DependenciesView
            analysis={analysis}
            query={deferredQuery}
            onEvidence={showEntityEvidence}
          />
        );
      case "features":
        return (
          <FeaturesView
            analysis={analysis}
            query={deferredQuery}
            onEvidence={showEvidence}
          />
        );
      case "graph":
        return (
          <CodebaseGraphExplorer
            load={loadGraph}
            onOpenEntity={showEntityEvidence}
          />
        );
      case "risks":
        return (
          <RisksView
            analysis={analysis}
            applicationId={applicationId}
            onEvidence={showEvidence}
          />
        );
      case "changes":
        return <ChangesView applicationId={applicationId} />;
      case "ask":
        return <AskView applicationId={applicationId} />;
      default: {
        const wanted = typeFilters[view] ?? [];
        const items = filteredEntities.filter((entity) =>
          wanted.includes(entity.type),
        );
        return (
          <>
            <p className="analysis-note">{items.length} item(s)</p>
            <VirtualList
              items={items}
              height={560}
              empty="Nothing of this kind was discovered in this snapshot."
              render={(entity) => (
                <EntityRow entity={entity} onEvidence={showEntityEvidence} />
              )}
            />
          </>
        );
      }
    }
  };

  return (
    <section className="content-card analysis-shell">
      <header className="analysis-header p-0! border-none!">
        <div className="mb-4!">
          {/* <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span className="analysis-badge">
              Codebase //{" "}
              {analysis.status === "PARTIAL" ? "Partial" : "Complete"}
            </span>
            <span className="analysis-badge">
              {state.mode === "cloud" ? "Cloud" : "Local"}
            </span>
            {analysis.dirty ? (
              <span className="analysis-badge">Uncommitted Changes</span>
            ) : null}
          </div> */}
          <h2>Repository analysis</h2>
          <p>
            Graph {analysis.graphVersion.slice(0, 12)}
            {analysis.revision ? ` · ${analysis.revision.slice(0, 8)}` : ""}
            {analysis.completedAt
              ? ` · ${new Date(analysis.completedAt).toLocaleString()}`
              : ""}
            {analysis.incremental && analysis.incremental.mode !== "full"
              ? ` · ${analysis.incremental.mode} (${analysis.incremental.reusedFiles} file(s) reused)`
              : ""}
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
            {query ? (
              <button
                type="button"
                className="analysis-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear filter"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>
          <button
            className="analysis-btn-primary"
            onClick={() => void startRescan()}
            disabled={rescan.busy}
          >
            {rescan.busy ? (
              <Loader2 size={14} className="spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            {rescan.busy ? "Starting…" : "Rescan"}
          </button>
        </div>
      </header>

      {rescan.message ? (
        <div className="analysis-warning">
          <Info size={15} />
          {rescan.message}
        </div>
      ) : null}

      {analysis.status === "PARTIAL" && analysis.warnings.length ? (
        <div className="analysis-warning">
          <AlertTriangle size={15} />
          <div>
            <strong>Partial analysis.</strong>{" "}
            {analysis.warnings.length === 1
              ? analysis.warnings[0]
              : `${analysis.warnings.length} parts of the repository could not be read:`}
            {analysis.warnings.length > 1 ? (
              <ul>
                {analysis.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav className="analysis-tabs" aria-label="Codebase analysis views">
        <div className="analysis-tabs-track">
          {VIEWS.map((item) => {
            return (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                onClick={() => setView(item.id)}
                aria-current={view === item.id}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="analysis-body p-0! py-4!">{renderView()}</div>

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
