import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Accessibility,
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpenText,
  Check,
  ChevronDown,
  CirclePause,
  CircleStop,
  Code2,
  Copy,
  FileSearch,
  Folder,
  Globe2,
  HelpCircle,
  KeyRound,
  Lock,
  Network,
  Play,
  Plus,
  Pencil,
  RefreshCw,
  SearchCode,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Trash2,
  Unlock,
  Workflow,
  X,
} from "lucide-react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { EntitlementModal } from "./components/entitlement-modal";
import type {
  DeclaredFlowDetail,
  DeclaredFlowSummary,
  DeclaredStateSuggestion,
  FlowReviewPreview,
  FlowSuggestionMeta,
  FlowInitialization,
  ManualRoadmap,
  InstrumentationDetection,
  InstrumentationPlan,
  IntentDraft,
  QARunSummary,
  QualityReport,
  SourceDocumentSummary,
  DocumentImportResult,
  IntentDraftJob,
} from "@sots/desktop-contracts";
import type { LiveEvidence } from "@sots/browser-observer";
import { useDesktop } from "./desktop-context";
import { SelectField } from "./components/ui/select";
import { FlowDiagram } from "./components/flow-diagram";
import { Switch } from "./components/ui/switch";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";

export function Page({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="page-empty">
      {icon}
      <h2>{title}</h2>
      <p className="mb-4 w-full">{description}</p>
      {action}
    </section>
  );
}

function Status({ children }: { children: ReactNode }) {
  return (
    <span className="status-pill">
      {/* <span aria-hidden="true" /> */}
      {children}
    </span>
  );
}

function ProjectRequired() {
  const location = useLocation();
  const section = location.pathname.split("/")[1] || "projects";
  return (
    <Navigate replace to={`/projects?next=${encodeURIComponent(section)}`} />
  );
}

export function RouteResolver({ section }: { section: string }) {
  const lastProject = localStorage.getItem("tellann:last-project");
  return (
    <Navigate
      replace
      to={
        lastProject
          ? `/projects/${lastProject}/${section}`
          : `/projects?next=${section}`
      }
    />
  );
}

export function RootResolver() {
  const { activeRun, applications } = useDesktop();
  const last = localStorage.getItem("tellann:last-project");
  const projectId = applications.some((item) => item.id === last)
    ? last
    : applications[0]?.id;
  if (activeRun && projectId)
    return (
      <Navigate
        replace
        to={`/projects/${projectId}/qa-runs/${activeRun.runId}/live`}
      />
    );
  return (
    <Navigate replace to={projectId ? `/projects/${projectId}` : "/projects"} />
  );
}

export function ProjectsPage() {
  const { applications, workspaces, runs, refreshRuns, attachWorkspace, busy } =
    useDesktop();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const [query, setQuery] = useState("");
  const visible = applications.filter((item) =>
    `${item.name} ${item.organizationName}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  useEffect(() => {
    for (const application of applications) {
      if (!runs[application.id])
        void refreshRuns(application.id).catch(() => undefined);
    }
  }, [applications, refreshRuns, runs]);

  return (
    <Page
      title="Projects"
      description="Connect a Tellann application to a local workspace, a development URL, or a staging URL."
      actions={
        <Link className="button primary" to="/projects/new">
          Create project
        </Link>
      }
    >
      {next ? (
        <div className="context-banner">
          Select a project to continue to <strong>{next}</strong>.
        </div>
      ) : null}
      <div className="filter-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter projects"
          aria-label="Filter projects"
        />
      </div>
      {visible.length ? (
        <div className="project-grid">
          {visible.map((application) => {
            const workspace = workspaces[application.id];
            const latestRun = runs[application.id]?.[0];
            const destination = next
              ? `/projects/${application.id}/${next}`
              : `/projects/${application.id}`;
            return (
              <article className="project-card" key={application.id}>
                <div className="card-heading">
                  <div>
                    <small>{application.organizationName}</small>
                    <h2>{application.name}</h2>
                  </div>
                  <Status>
                    {workspace ? "Analyzed" : "Browser-only ready"}
                  </Status>
                </div>
                <div className="tag-list">
                  {application.environments.map((environment) => (
                    <span key={environment.id}>{environment.type}</span>
                  ))}
                </div>
                <dl className="summary-grid">
                  <div>
                    <dt>Workspace</dt>
                    <dd>{workspace?.name ?? "Not attached"}</dd>
                  </div>
                  <div>
                    <dt>Stack</dt>
                    <dd>
                      {workspace?.snapshot.frameworks[0]?.framework ??
                        "URL mode"}
                    </dd>
                  </div>
                  <div>
                    <dt>Latest run</dt>
                    <dd>{latestRun?.status ?? "None"}</dd>
                  </div>
                  <div>
                    <dt>Findings</dt>
                    <dd>
                      {latestRun ? latestRun.findingCount : "No run data"}
                    </dd>
                  </div>
                </dl>
                <div className="card-actions">
                  <Link
                    className="button primary"
                    to={destination}
                    onClick={() =>
                      localStorage.setItem(
                        "tellann:last-project",
                        application.id,
                      )
                    }
                  >
                    Open project
                  </Link>
                  <button
                    disabled={busy}
                    onClick={() => void attachWorkspace(application.id)}
                  >
                    Attach folder
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Folder size={36} />}
          title="No projects available"
          description="Create a cloud application or sign in to an organization with an existing application."
          action={
            <Link className="button primary" to="/projects/new">
              Create project
            </Link>
          }
        />
      )}
    </Page>
  );
}

export function NewProjectPage() {
  const { applications, attachWorkspace, busy } = useDesktop();
  const navigate = useNavigate();
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? "");
  const [mode, setMode] = useState<"folder" | "url">("folder");

  const complete = async () => {
    if (!applicationId) return;
    if (mode === "folder") await attachWorkspace(applicationId);
    localStorage.setItem("tellann:last-project", applicationId);
    navigate(
      mode === "url"
        ? `/projects/${applicationId}/qa-runs/new`
        : `/projects/${applicationId}`,
    );
  };

  return (
    <Page
      title="Create or attach project"
      description="Start with read-only workspace access or continue without a repository."
    >
      <section className="wizard-card">
        <div className="step-label">Step 1 of 3 / Cloud application</div>
        <label>
          Application
          <SelectField
            value={applicationId}
            onValueChange={setApplicationId}
            options={applications.map((item) => ({
              value: item.id,
              label: `${item.organizationName} / ${item.name}`,
            }))}
            placeholder="Select application"
          />
        </label>
        <div className="step-label">Step 2 of 3 / Working mode</div>
        <div className="choice-grid">
          <button
            className={mode === "folder" ? "choice selected" : "choice"}
            onClick={() => setMode("folder")}
          >
            <Folder />
            <strong>Local folder</strong>
            <span>Read-only analysis. No scripts are executed.</span>
          </button>
          <button
            className={mode === "url" ? "choice selected" : "choice"}
            onClick={() => setMode("url")}
          >
            <Globe2 />
            <strong>Browser-only URL</strong>
            <span>No SDK, source, write, or command permission required.</span>
          </button>
        </div>
        <div className="step-label">Step 3 of 3 / Permission summary</div>
        <div className="permission-summary">
          <ShieldCheck />
          <div>
            <strong>
              {mode === "folder" ? "Read workspace" : "Browser-only"}
            </strong>
            <p>
              {mode === "folder"
                ? "Tellann reads approved project files locally and uploads only redacted derived summaries."
                : "Tellann captures only the evidence categories approved for the guided run."}
            </p>
          </div>
        </div>
        <button
          className="button primary"
          disabled={!applicationId || busy}
          onClick={() => void complete()}
        >
          {mode === "folder"
            ? "Choose folder and analyze"
            : "Continue to QA run"}
          <ArrowRight size={16} />
        </button>
      </section>
    </Page>
  );
}

function useProject() {
  const { projectId } = useParams();
  const desktop = useDesktop();
  return {
    ...desktop,
    projectId,
    application: desktop.applications.find((item) => item.id === projectId),
    workspace: projectId ? desktop.workspaces[projectId] : undefined,
  };
}

export function ProjectOverviewPage() {
  const { projectId, application, workspace, runs, refreshRuns } = useProject();
  useEffect(() => {
    if (projectId) void refreshRuns(projectId).catch(() => undefined);
  }, [projectId, refreshRuns]);
  if (!projectId) return <ProjectRequired />;
  if (!application)
    return (
      <NotFoundPage
        title="Project unavailable"
        description="This project does not exist or is outside your current organization access."
      />
    );
  const latest = runs[projectId]?.[0];
  return (
    <Page
      title={application.name}
      description={`${application.organizationName} / Desktop project overview`}
    >
      <div className="metric-grid">
        <Metric
          label="Workspace"
          value={workspace ? "Analyzed" : "Not attached"}
        />
        <Metric label="Intent" value="Review expected behavior" />
        <Metric label="Instrumentation" value="Browser-only available" />
        <Metric label="Latest run" value={latest?.status ?? "No runs"} />
      </div>
      <div className="two-column">
        <section className="content-card">
          <h2>Readiness</h2>
          <Checklist
            checked={Boolean(application.environments.length)}
            text="Environment configured"
          />
          <Checklist
            checked={Boolean(workspace)}
            text="Local workspace analyzed"
          />
          <Checklist checked text="Browser-first QA available without SDK" />
        </section>
        <section className="content-card">
          <h2>Recommended next action</h2>
          <p className="mb-4">
            {workspace
              ? "Start a guided browser run or review the expected intent."
              : "Attach a folder for repository context, or start a URL-only guided run."}
          </p>
          <div className="card-actions">
            <Link
              className="button primary"
              to={`/projects/${projectId}/qa-runs/new`}
            >
              New QA run
            </Link>
            <Link className="button" to={`/projects/${projectId}/workspace`}>
              Workspace
            </Link>
          </div>
        </section>
      </div>
    </Page>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Checklist({ checked, text }: { checked: boolean; text: string }) {
  return (
    <div className="check-row">
      {checked ? <Check size={16} /> : <AlertTriangle size={16} />}
      <span>{text}</span>
    </div>
  );
}

function redactDisplayedDiff(value: unknown): string {
  return String(value ?? "No local diff")
    .replace(
      /(^[+-]?\s*(?:VITE_|NEXT_PUBLIC_)?TELLANN_INGESTION_KEY=).*$/gim,
      "$1[REDACTED]",
    )
    .replace(/(apiKey\s*:\s*)[^,\s}]+/gi, "$1[REDACTED]");
}

type InstrumentationDiffLine = {
  kind: "removed" | "added";
  oldLine: number | null;
  newLine: number | null;
  text: string;
};

type InstrumentationFileDiff = {
  path: string;
  additions: number;
  deletions: number;
  lines: InstrumentationDiffLine[];
};

function parseInstrumentationDiff(value: unknown): InstrumentationFileDiff[] {
  const redacted = redactDisplayedDiff(value).replaceAll("\r\n", "\n");
  if (!redacted.trim() || redacted === "No local diff") return [];
  return redacted
    .split(/(?=^--- a\/)/m)
    .flatMap<InstrumentationFileDiff>((section) => {
      const pathMatch = section.match(
        /^--- a\/(.+)\n\+\+\+ b\/(.+)\n@@ Tellann instrumentation @@\n/,
      );
      if (!pathMatch) return [];
      const body = section.slice(pathMatch[0].length);
      const additionBoundary = body.indexOf("\n+");
      const previous =
        additionBoundary >= 0
          ? body.slice(1, additionBoundary)
          : body.startsWith("-")
            ? body.slice(1)
            : "";
      const updated =
        additionBoundary >= 0 ? body.slice(additionBoundary + 2) : "";
      const previousLines = previous === "" ? [] : previous.split("\n");
      const updatedLines =
        updated === "" ? [] : updated.replace(/\n$/, "").split("\n");
      return [
        {
          path: pathMatch[2],
          deletions: previousLines.length,
          additions: updatedLines.length,
          lines: [
            ...previousLines.map((text, index) => ({
              kind: "removed" as const,
              oldLine: index + 1,
              newLine: null,
              text,
            })),
            ...updatedLines.map((text, index) => ({
              kind: "added" as const,
              oldLine: null,
              newLine: index + 1,
              text,
            })),
          ],
        },
      ];
    });
}

function InstrumentationDiffViewer({ diff }: { diff: unknown }) {
  const files = useMemo(() => parseInstrumentationDiff(diff), [diff]);
  if (!files.length)
    return (
      <p className="muted">No readable local file changes were recorded.</p>
    );
  return (
    <Accordion type="multiple" className="instrumentation-diff-list">
      {files.map((file, index) => (
        <AccordionItem key={file.path} value={`diff-file-${index}`}>
          <AccordionTrigger className="diff-file-trigger">
            <Code2 size={15} />
            <span className="diff-file-path">{file.path}</span>
            <span
              className="diff-file-stats"
              aria-label={`${file.additions} additions and ${file.deletions} deletions`}
            >
              <span className="diff-additions">+{file.additions}</span>
              <span className="diff-deletions">-{file.deletions}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="diff-file-content">
            <div
              className="diff-code"
              role="table"
              aria-label={`Changes to ${file.path}`}
            >
              {file.lines.map((line, lineIndex) => (
                <div
                  className={`diff-line diff-line-${line.kind}`}
                  role="row"
                  key={`${line.kind}-${lineIndex}`}
                >
                  <span className="diff-line-number" role="cell">
                    {line.oldLine ?? ""}
                  </span>
                  <span className="diff-line-number" role="cell">
                    {line.newLine ?? ""}
                  </span>
                  <span className="diff-line-marker" aria-hidden="true">
                    {line.kind === "added" ? "+" : "-"}
                  </span>
                  <code role="cell">{line.text || " "}</code>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function WorkspacePage() {
  const { projectId, application, workspace, attachWorkspace, busy } =
    useProject();
  if (!projectId) return <ProjectRequired />;
  if (!application)
    return (
      <NotFoundPage
        title="Project unavailable"
        description="Select another project."
      />
    );
  return (
    <Page
      title="Workspace"
      description="Local repository access, read-only analysis, detected stack, and redaction status."
      actions={
        <button
          className="button"
          disabled={busy}
          onClick={() => void attachWorkspace(projectId)}
        >
          <RefreshCw size={15} />
          {workspace ? "Change or rescan folder" : "Attach folder"}
        </button>
      }
    >
      {!workspace ? (
        (application as any)?.projectWorkspaces?.[0] ? (
          (() => {
            const cloudWs = (application as any).projectWorkspaces[0];
            const latestSnap = cloudWs.snapshots?.[0];
            const endpointsRaw = latestSnap?.endpointSummary;
            const endpointsCount = Array.isArray(endpointsRaw)
              ? endpointsRaw.length
              : endpointsRaw && typeof endpointsRaw === "object"
                ? Object.keys(endpointsRaw).length
                : typeof endpointsRaw === "number"
                  ? endpointsRaw
                  : 0;
            const docsRaw = latestSnap?.documentationSummary;
            const docsCount = Array.isArray(docsRaw)
              ? docsRaw.length
              : docsRaw && typeof docsRaw === "object"
                ? Object.keys(docsRaw).length
                : typeof docsRaw === "number"
                  ? docsRaw
                  : 0;
            const routesRaw = latestSnap?.routeSummary;
            const routesCount = Array.isArray(routesRaw)
              ? routesRaw.length
              : routesRaw && typeof routesRaw === "object"
                ? Object.keys(routesRaw).length
                : typeof routesRaw === "number"
                  ? routesRaw
                  : 0;

            return (
              <div
                className="content-card"
                style={{
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid var(--border-color)",
                    paddingBottom: "12px",
                  }}
                >
                  <div>
                    <h2 style={{ margin: 0, fontSize: "18px" }}>
                      Cloud Workspace Connected
                    </h2>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: "12px",
                        opacity: 0.7,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      Repository Fingerprint:{" "}
                      {cloudWs.repositoryFingerprint
                        ? cloudWs.repositoryFingerprint.slice(0, 12)
                        : cloudWs.opaqueLocalId}
                    </p>
                  </div>
                  <span
                    className="badge"
                    style={{
                      textTransform: "uppercase",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {cloudWs.packageManager || "npm"}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "12px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      padding: "12px",
                      background: "var(--bg-tertiary)",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: "bold",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {routesCount}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        opacity: 0.7,
                        textTransform: "uppercase",
                      }}
                    >
                      Discovered Routes
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "12px",
                      background: "var(--bg-tertiary)",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: "bold",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {endpointsCount}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        opacity: 0.7,
                        textTransform: "uppercase",
                      }}
                    >
                      Endpoints Mapped
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "12px",
                      background: "var(--bg-tertiary)",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: "bold",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {docsCount}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        opacity: 0.7,
                        textTransform: "uppercase",
                      }}
                    >
                      Doc Manifests
                    </div>
                  </div>
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    lineHeight: 1.5,
                    opacity: 0.8,
                  }}
                >
                  A project workspace is registered in Tellann Cloud for{" "}
                  <strong>{application.name}</strong>. Choose the local folder
                  on your computer to connect local file access and enable
                  automated instrumentation.
                </p>

                <div>
                  <button
                    className="button primary font-mono text-xs uppercase"
                    onClick={() => void attachWorkspace(projectId)}
                  >
                    Choose project folder
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          <EmptyState
            icon={<SearchCode size={36} />}
            title="No local workspace attached"
            description="Browser-only QA remains fully available. Attach a folder only when repository context is useful."
            action={
              <button
                className="button primary"
                onClick={() => void attachWorkspace(projectId)}
              >
                Choose project folder
              </button>
            }
          />
        )
      ) : (
        <div className="two-column">
          <section className="content-card">
            <h2>{workspace.name}</h2>
            <p className="local-path">{workspace.path}</p>
            <dl className="detail-list">
              <div>
                <dt>Branch</dt>
                <dd>{workspace.snapshot.branch ?? "None"}</dd>
              </div>
              <div>
                <dt>Revision</dt>
                <dd>
                  {workspace.snapshot.revision?.slice(0, 12) ??
                    "No Git revision"}
                </dd>
              </div>
              <div>
                <dt>Dirty</dt>
                <dd>
                  {workspace.snapshot.dirty ? "Local changes present" : "Clean"}
                </dd>
              </div>
              <div>
                <dt>Package manager</dt>
                <dd>{workspace.snapshot.packageManager ?? "Not detected"}</dd>
              </div>
            </dl>
          </section>
          <section className="content-card">
            <h2>Analysis</h2>
            <div className="tag-list">
              {workspace.snapshot.frameworks.map((item) => (
                <span key={item.framework}>
                  {item.framework} / {Math.round(item.confidence * 100)}%
                </span>
              ))}
            </div>
            <dl className="summary-grid">
              <div>
                <dt>Routes</dt>
                <dd>{workspace.snapshot.routes.length}</dd>
              </div>
              <div>
                <dt>Endpoints</dt>
                <dd>{workspace.snapshot.endpoints.length}</dd>
              </div>
              <div>
                <dt>Documents</dt>
                <dd>{workspace.snapshot.documentation.length}</dd>
              </div>
              <div>
                <dt>Secrets excluded</dt>
                <dd>{workspace.snapshot.redactionSummary.suspectedSecrets}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </Page>
  );
}

export function SourcesPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { getDocuments, importDocuments, refreshApplications, busy } =
    useDesktop();
  const [documents, setDocuments] = useState<SourceDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [unentitled, setUnentitled] = useState(false);
  const [entitlementModalOpen, setEntitlementModalOpen] = useState(false);

  const refresh = async () => {
    if (!projectId) return;
    try {
      const access = await getDocuments(projectId);
      if (access.accessDenied) {
        const available = await refreshApplications().catch(() => []);
        const fallback = available[0]?.id;
        navigate(fallback ? `/projects/${fallback}/sources` : "/projects", {
          replace: true,
        });
        return;
      }
      setDocuments(access.documents);
      setUnentitled(!access.entitled);
      if (!access.entitled) setEntitlementModalOpen(true);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [projectId]);

  useEffect(() => {
    if (
      !projectId ||
      !documents.some((document) =>
        ["QUEUED", "PROCESSING"].includes(
          document.processingJobs[0]?.status ?? document.status,
        ),
      )
    )
      return;
    const timer = window.setInterval(
      () => void refresh(),
      JOB_POLL_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [documents, projectId]);

  if (!projectId) return <ProjectRequired />;

  if (unentitled) {
    return (
      <Page
        title="Sources"
        description="Local document extraction with approved, redacted evidence synchronized to Tellann."
        actions={
          <button
            className="button primary"
            onClick={() => setEntitlementModalOpen(true)}
          >
            <Sparkles size={15} />
            Upgrade plan
          </button>
        }
      >
        <section className="guarded-card">
          <ShieldCheck size={32} />
          <div>
            <Status>Plan Entitlement Required</Status>
            <h2>Document Flow Inference requires an upgraded plan</h2>
            <p>
              Source document extraction and analysis (
              <code>DOCUMENT_FLOW_INFERENCE</code>) is not included on your
              organization's current plan (Free). Upgrade to Local, Solo, or
              Team plan to enable product document upload and workflow
              inference.
            </p>
            <div style={{ marginTop: "16px" }}>
              <button
                className="button primary"
                onClick={() => setEntitlementModalOpen(true)}
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        </section>
        <EntitlementModal
          isOpen={entitlementModalOpen}
          feature="DOCUMENT_FLOW_INFERENCE"
          currentPlan="Free"
          onClose={() => setEntitlementModalOpen(false)}
        />
      </Page>
    );
  }

  const upload = async () => {
    try {
      await importDocuments(projectId);
      await refresh();
    } catch (err: any) {
      if (String(err?.message ?? err).includes("FEATURE_NOT_ENTITLED")) {
        setUnentitled(true);
        setEntitlementModalOpen(true);
      }
    }
  };

  return (
    <Page
      title="Sources"
      description="Local document extraction with approved, redacted evidence synchronized to Tellann."
      actions={
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void upload()}
        >
          <FileSearch size={15} />
          Add documents
        </button>
      }
    >
      <div className="context-banner">
        PDF, DOCX, Markdown, text, HTML, and OpenAPI files are extracted
        locally. Raw files stay on this device unless separately approved.
      </div>
      {loading ? (
        <LoadingState />
      ) : documents.length ? (
        <div className="stack">
          {documents.map((document) => {
            const version = document.versions[0];
            const job = document.processingJobs[0];
            return (
              <section className="content-card row-card" key={document.id}>
                <div>
                  <small>{document.mimeType}</small>
                  <h2>{document.filename}</h2>
                  <p>
                    {version
                      ? `Version ${version.version} / ${version.processorVersion}`
                      : "Derived summary queued for processing"}
                  </p>
                </div>
                <div className="source-status">
                  <Status>{job?.status ?? document.status}</Status>
                  {version ? (
                    <span>
                      {String(
                        (version.extractedSummary as any)?.kind ?? "DOCUMENT",
                      )}
                    </span>
                  ) : null}
                  {document.status === "FAILED" ? (
                    <span>
                      {String(
                        (document as any).errorMessageSafe ??
                          "Processing failed",
                      )}
                    </span>
                  ) : null}
                  {version ? (
                    <Link
                      className="button"
                      to={`/projects/${projectId}/intent`}
                    >
                      Use in Intent
                    </Link>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<BookOpenText size={36} />}
          title="No product documents"
          description="Add existing requirements or OpenAPI documents. Tellann will infer a reviewable expected flow with citations."
          action={
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void upload()}
            >
              Choose documents
            </button>
          }
        />
      )}
    </Page>
  );
}

export function EnvironmentsPage() {
  const { application } = useProject();
  return (
    <Page
      title="Environments"
      description="URLs, browser policy, and production restrictions."
    >
      <div className="stack">
        {application?.environments.map((item) => (
          <section className="content-card row-card" key={item.id}>
            <div>
              <h2>{item.name}</h2>
              <p>{item.baseUrl ?? "No base URL configured"}</p>
            </div>
            <Status>{item.type}</Status>
          </section>
        ))}
      </div>
    </Page>
  );
}

export function ActivityPage() {
  return (
    <GuardedFeaturePage
      title="Project activity"
      description="Workspace scans, runs, reports, and local synchronization activity."
      phase="Cloud audit expansion is scheduled for enterprise hardening."
      fallback="QA run and report history are available in their respective sections."
    />
  );
}

function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  busy?: boolean;
  onConfirm(): void;
  onCancel(): void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="desktop-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="desktop-modal auth-otp-theme"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <button
          type="button"
          className="desktop-modal-close"
          aria-label="Close"
          disabled={busy}
          onClick={onCancel}
        >
          <X size={16} />
        </button>

        <div className="confirm-modal-topbar">
          <span className="confirm-modal-brand">TELLANN</span>
          <span className="confirm-modal-tag">ACTION // CONFIRMATION</span>
        </div>

        <h2 id="confirm-modal-title" className="confirm-modal-heading">
          {title}
        </h2>

        <div className="confirm-modal-body-box">
          <p>{description}</p>
        </div>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="button confirm-modal-btn-cancel"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`button confirm-modal-btn-action flex-1 ${variant === "danger" ? "danger" : ""}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function GuidedSuggestionsPanel({
  suggestions,
  meta,
  loading,
  error,
  actionId,
  editable,
  onRefresh,
  onAccept,
  onReject,
}: {
  suggestions: DeclaredStateSuggestion[];
  meta: FlowSuggestionMeta | null;
  loading: boolean;
  error: string | null;
  actionId: string | null;
  editable: boolean;
  onRefresh(): void;
  onAccept(id: string): void;
  onReject(id: string): void;
}) {
  const modeLabel =
    meta?.mode === "AI_ASSISTED"
      ? "AI + rules"
      : meta?.mode === "RULE_FALLBACK"
        ? "Rule fallback"
        : "Rule-guided";
  return (
    <section
      className="guided-suggestions"
      aria-labelledby="guided-suggestions-title"
    >
      <div className="guided-suggestions-heading">
        <div>
          <small>{modeLabel}</small>
          <h3 id="guided-suggestions-title">Guided suggestions</h3>
          <p>
            Review proposed additions based on this flow&apos;s purpose, scope
            boundary, and current states.
          </p>
        </div>
        <button
          type="button"
          className="button"
          disabled={loading || !editable}
          onClick={onRefresh}
        >
          <RefreshCw size={14} className={loading ? "spin" : undefined} />{" "}
          Refresh suggestions
        </button>
      </div>
      <div role="status" aria-live="polite" className="suggestion-status">
        {loading
          ? "Analyzing the current flow…"
          : error
            ? `Suggestions could not be refreshed: ${error}`
            : suggestions.length
              ? `${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"} ready for review.`
              : "No additional states are recommended right now."}
      </div>
      {meta?.mode === "RULE_ONLY" && !meta.aiAllowed ? (
        <p className="suggestion-upgrade-note">
          Free includes deterministic guidance. Local or Solo adds AI-enhanced
          analysis.
        </p>
      ) : null}
      {meta?.mode === "RULE_FALLBACK" ? (
        <p className="suggestion-upgrade-note">
          AI was unavailable, so Tellann kept the review moving with
          deterministic guidance.
        </p>
      ) : null}
      {suggestions.length ? (
        <div className="suggestion-card-list">
          {suggestions.map((suggestion) => {
            const proposedStates = suggestion.suggestedStatesJson?.length
              ? suggestion.suggestedStatesJson
              : [
                  {
                    name: suggestion.suggestedStateName,
                    category: suggestion.category,
                  },
                ];
            const sourceLabel =
              suggestion.source === "AI"
                ? "AI-assisted"
                : suggestion.source === "HYBRID"
                  ? "Hybrid"
                  : "Rule-based";
            const processing = actionId === suggestion.id;
            return (
              <article className="suggestion-card" key={suggestion.id}>
                <div className="suggestion-card-heading">
                  <div>
                    <strong>
                      {suggestion.title ||
                        `Add ${suggestion.suggestedStateName}`}
                    </strong>
                    <span>
                      {sourceLabel} · {suggestion.severity} ·{" "}
                      {Math.round(suggestion.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
                <div className="suggested-state-chips">
                  {proposedStates.map((state) => (
                    <span key={`${suggestion.id}-${state.name}`}>
                      {state.name} <small>{state.category}</small>
                    </span>
                  ))}
                </div>
                {suggestion.suggestedTransitionsJson?.length ? (
                  <ul className="suggested-transition-list">
                    {suggestion.suggestedTransitionsJson.map(
                      (transition, index) => (
                        <li key={`${suggestion.id}-transition-${index}`}>
                          {transition.from} → {transition.to}
                          {transition.action ? ` · ${transition.action}` : ""}
                        </li>
                      ),
                    )}
                  </ul>
                ) : null}
                <p>{suggestion.rationale}</p>
                <div className="suggestion-actions">
                  <button
                    type="button"
                    className="button primary"
                    disabled={!editable || processing}
                    onClick={() => onAccept(suggestion.id)}
                  >
                    <Check size={14} /> Accept
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={!editable || processing}
                    onClick={() => onReject(suggestion.id)}
                  >
                    <X size={14} /> Decline
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function WholeFlowReviewPanel({
  suggestions,
  meta,
  selectedIds,
  preview,
  loading,
  previewLoading,
  applying,
  error,
  editable,
  stateCount,
  onReview,
  onToggle,
  onApply,
  onDecline,
}: {
  suggestions: DeclaredStateSuggestion[];
  meta: FlowSuggestionMeta | null;
  selectedIds: Set<string>;
  preview: FlowReviewPreview | null;
  loading: boolean;
  previewLoading: boolean;
  applying: boolean;
  error: string | null;
  editable: boolean;
  stateCount: number;
  onReview(): void;
  onToggle(id: string): void;
  onApply(): void;
  onDecline(): void;
}) {
  const flowDiagram = preview?.diagrams.find((item) => item.kind === "FLOW");
  const selectedCount = selectedIds.size;
  return (
    <section
      className="flow-review-panel"
      aria-labelledby="flow-review-heading"
    >
      <div className="flow-review-heading-row">
        <div>
          <small>Tellann guided review</small>
          <h3 id="flow-review-heading">Review and connect states</h3>
        </div>
        <button
          type="button"
          className="button"
          disabled={!editable || stateCount < 2 || loading || applying}
          onClick={onReview}
        >
          <Sparkles size={15} />
          {suggestions.length ? "Review again" : "Ask Tellann to review flow"}
        </button>
      </div>
      <p>
        Reviewable guidance only. Your graph changes only after you select
        proposals and confirm them.
      </p>
      {stateCount < 2 ? (
        <p className="muted-callout">
          Add at least two states before requesting a whole-flow review.
        </p>
      ) : null}
      <div role="status" aria-live="polite">
        {loading ? (
          <p className="flow-review-status">
            <RefreshCw className="spin" size={15} /> Analyzing purpose, scope,
            states, and transitions…
          </p>
        ) : null}
        {!loading && meta?.stage === "CONNECTION_REPAIR" ? (
          <p className="flow-review-status warning">
            <Network size={15} /> Completing the existing flow first. Tellann
            will suggest new states only after every current state and terminal
            is reachable.
          </p>
        ) : null}
        {!loading && meta?.stage === "ENRICHMENT" ? (
          <p className="flow-review-status">
            <Check size={15} /> The existing flow is connected. Tellann is now
            reviewing optional missing states and alternate paths.
          </p>
        ) : null}
        {!loading && meta?.mode === "RULE_ONLY" ? (
          <p className="flow-review-status">
            Rule-guided review. Local and Solo plans add Gemini semantic
            analysis.
          </p>
        ) : null}
        {!loading && meta?.mode === "RULE_FALLBACK" ? (
          <p className="flow-review-status warning">
            Gemini was unavailable; deterministic validation guidance is shown.
          </p>
        ) : null}
        {error ? (
          <p className="flow-review-status error">
            <AlertTriangle size={15} /> {error}
          </p>
        ) : null}
      </div>
      {!loading && suggestions.length === 0 && meta ? (
        <p className="flow-review-complete">
          <Check size={16} /> No additional states or transitions were
          recommended.
        </p>
      ) : null}
      {suggestions.length ? (
        <div className="flow-review-proposals">
          {suggestions.map((suggestion) => {
            const states = suggestion.suggestedStatesJson ?? [];
            const transitions = suggestion.suggestedTransitionsJson ?? [];
            return (
              <label
                key={suggestion.id}
                className={`flow-review-proposal ${selectedIds.has(suggestion.id) ? "selected" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(suggestion.id)}
                  onChange={() => onToggle(suggestion.id)}
                  disabled={applying}
                />
                <span className="flow-review-proposal-body">
                  <span className="flow-review-badges">
                    <strong>
                      {suggestion.title ||
                        (states.length
                          ? "Missing state"
                          : "Recommended transition")}
                    </strong>
                    <Status>
                      {suggestion.source === "AI"
                        ? "AI-assisted"
                        : suggestion.source === "HYBRID"
                          ? "Hybrid"
                          : "Rule-based"}
                    </Status>
                    <small>
                      {suggestion.severity} ·{" "}
                      {Math.round(suggestion.confidence * 100)}%
                    </small>
                  </span>
                  {states.map((state) => (
                    <span
                      key={`${suggestion.id}-${state.name}`}
                      className="flow-review-patch"
                    >
                      <Plus size={12} /> State: {state.name} · {state.category}
                    </span>
                  ))}
                  {transitions.map((edge, index) => (
                    <span
                      key={`${suggestion.id}-edge-${index}`}
                      className="flow-review-patch"
                    >
                      <ArrowRight size={12} /> {edge.from} → {edge.to}
                      {edge.action ? ` · ${edge.action}` : ""}
                    </span>
                  ))}
                  <small>{suggestion.rationale}</small>
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
      {selectedCount ? (
        <div className="flow-review-preview">
          <div className="flow-review-preview-heading">
            <strong>Selected graph preview</strong>
            {previewLoading ? (
              <small>Updating…</small>
            ) : (
              <Status>
                {preview?.validation.valid ? "Valid" : "Needs attention"}
              </Status>
            )}
          </div>
          {preview?.validation.issues.length ? (
            <ul>
              {preview.validation.issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  <strong>{issue.code}</strong>: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          {flowDiagram ? (
            <FlowDiagram
              source={flowDiagram.source}
              label="Selected graph preview"
            />
          ) : null}
        </div>
      ) : null}
      {suggestions.length ? (
        <div className="flow-review-actions">
          <button
            type="button"
            className="button primary"
            disabled={
              !selectedCount ||
              previewLoading ||
              applying ||
              !preview?.validation.valid
            }
            onClick={onApply}
          >
            {applying ? "Applying…" : `Apply selected (${selectedCount})`}
          </button>
          <button
            type="button"
            className="button"
            disabled={applying}
            onClick={onDecline}
          >
            Decline review
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ManualIntentBuilder({
  projectId,
  flows,
  refreshFlows,
  initialFlowId,
  showPlanBanner = true,
}: {
  projectId: string;
  flows: DeclaredFlowSummary[];
  refreshFlows(): Promise<DeclaredFlowSummary[]>;
  initialFlowId?: string;
  showPlanBanner?: boolean;
}) {
  const navigate = useNavigate();
  const {
    getDeclaredFlow,
    createDeclaredFlow,
    addDeclaredState,
    updateDeclaredState,
    deleteDeclaredState,
    addDeclaredTransition,
    completeDeclaredFlow,
    reopenDeclaredFlow,
    getFlowDiagrams,
    initializeFlow,
    rescanFlow,
    generateFlowSuggestions,
    getFlowSuggestions,
    acceptFlowSuggestion,
    rejectFlowSuggestion,
    previewFlowReview,
    applyFlowReview,
    declineFlowReview,
    applications,
    workspaces,
    busy,
  } = useDesktop();
  const [selectedFlowId, setSelectedFlowId] = useState(initialFlowId ?? "");
  const [flowMode, setFlowMode] = useState<"existing" | "create">(
    initialFlowId || flows.length > 0 ? "existing" : "create",
  );
  const [activeFlow, setActiveFlow] = useState<DeclaredFlowDetail | null>(null);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowPurpose, setNewFlowPurpose] = useState("");
  const [newFlowScope, setNewFlowScope] = useState("");
  const [workflowType, setWorkflowType] = useState("CUSTOM");
  const [stateName, setStateName] = useState("");
  const [stateCategory, setStateCategory] = useState("BUSINESS");
  const [stateRole, setStateRole] = useState("NORMAL");
  const [terminalKind, setTerminalKind] = useState("SUCCESS");
  const [editingStateId, setEditingStateId] = useState<string | null>(null);
  const [fromStateId, setFromStateId] = useState("");
  const [toStateId, setToStateId] = useState("");
  const [transitionAction, setTransitionAction] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [diagrams, setDiagrams] = useState<
    Array<{ kind: string; source: string }>
  >([]);
  const [activeDiagramKind, setActiveDiagramKind] = useState("FLOW");
  const [suggestions, setSuggestions] = useState<DeclaredStateSuggestion[]>([]);
  const [suggestionMeta, setSuggestionMeta] =
    useState<FlowSuggestionMeta | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionActionId, setSuggestionActionId] = useState<string | null>(
    null,
  );
  const [stateToDelete, setStateToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [flowReviewSuggestions, setFlowReviewSuggestions] = useState<
    DeclaredStateSuggestion[]
  >([]);
  const [flowReviewMeta, setFlowReviewMeta] =
    useState<FlowSuggestionMeta | null>(null);
  const [flowReviewId, setFlowReviewId] = useState<string | null>(null);
  const [flowReviewRevision, setFlowReviewRevision] = useState<{
    graphVersion: number;
    graphHash: string;
  } | null>(null);
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(
    new Set(),
  );
  const [flowReviewPreview, setFlowReviewPreview] =
    useState<FlowReviewPreview | null>(null);
  const [flowReviewLoading, setFlowReviewLoading] = useState(false);
  const [flowReviewPreviewLoading, setFlowReviewPreviewLoading] =
    useState(false);
  const [flowReviewApplying, setFlowReviewApplying] = useState(false);
  const [flowReviewError, setFlowReviewError] = useState<string | null>(null);
  const flowReviewPreviewSequence = useRef(0);

  useEffect(() => {
    if (selectedFlowId || !flows.length) return;
    setSelectedFlowId(flows[0].id);
  }, [flows, selectedFlowId]);

  const refreshActiveFlow = async (flowId = selectedFlowId) => {
    if (!flowId) {
      setActiveFlow(null);
      return;
    }
    setActiveFlow(await getDeclaredFlow(projectId, flowId));
  };

  useEffect(() => {
    void refreshActiveFlow().catch((err) =>
      setMessage(String(err?.message ?? err)),
    );
  }, [projectId, selectedFlowId]);

  useEffect(() => {
    if (!selectedFlowId) {
      setSuggestions([]);
      setSuggestionMeta(null);
      return;
    }
    let cancelled = false;
    void getFlowSuggestions(projectId, selectedFlowId)
      .then((payload) => {
        if (!cancelled) {
          const latestReviewId =
            payload.suggestions.find((item) => item.reviewId)?.reviewId ?? null;
          const reviewSuggestions = latestReviewId
            ? payload.suggestions.filter(
                (item) => item.reviewId === latestReviewId,
              )
            : [];
          setSuggestions(payload.suggestions.filter((item) => !item.reviewId));
          setSuggestionMeta(payload.meta ?? null);
          setSuggestionsError(null);
          if (latestReviewId) {
            setFlowReviewId(latestReviewId);
            setFlowReviewSuggestions(reviewSuggestions);
            setFlowReviewMeta(payload.meta ?? null);
            setFlowReviewRevision({
              graphVersion: payload.graphVersion,
              graphHash: payload.graphHash,
            });
            setSelectedReviewIds(
              new Set(reviewSuggestions.map((item) => item.id)),
            );
          }
        }
      })
      .catch((error) => {
        if (!cancelled) setSuggestionsError(String(error?.message ?? error));
      });
    return () => {
      cancelled = true;
    };
  }, [getFlowSuggestions, projectId, selectedFlowId]);

  useEffect(() => {
    setFlowReviewSuggestions([]);
    setFlowReviewMeta(null);
    setFlowReviewId(null);
    setFlowReviewRevision(null);
    setSelectedReviewIds(new Set());
    setFlowReviewPreview(null);
    setFlowReviewError(null);
  }, [selectedFlowId]);

  useEffect(() => {
    if (
      !selectedFlowId ||
      !flowReviewRevision ||
      selectedReviewIds.size === 0
    ) {
      setFlowReviewPreview(null);
      return;
    }
    const sequence = ++flowReviewPreviewSequence.current;
    const timer = window.setTimeout(() => {
      setFlowReviewPreviewLoading(true);
      void previewFlowReview(projectId, selectedFlowId, {
        suggestionIds: [...selectedReviewIds],
        ...flowReviewRevision,
      })
        .then((payload) => {
          if (sequence === flowReviewPreviewSequence.current) {
            setFlowReviewPreview(payload);
            setFlowReviewError(null);
          }
        })
        .catch((error) => {
          if (sequence === flowReviewPreviewSequence.current) {
            setFlowReviewPreview(null);
            setFlowReviewError(String(error?.message ?? error));
          }
        })
        .finally(() => {
          if (sequence === flowReviewPreviewSequence.current)
            setFlowReviewPreviewLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    previewFlowReview,
    projectId,
    selectedFlowId,
    selectedReviewIds,
    flowReviewRevision,
  ]);

  const requestFlowReview = async () => {
    if (!selectedFlowId || !activeFlow || activeFlow.states.length < 2) return;
    setFlowReviewLoading(true);
    setFlowReviewError(null);
    setFlowReviewPreview(null);
    try {
      const payload = await generateFlowSuggestions(projectId, selectedFlowId, {
        trigger: "FLOW_REVIEW_REQUESTED",
        graphVersion: activeFlow.version,
      });
      setFlowReviewSuggestions(payload.suggestions);
      setFlowReviewMeta(payload.meta ?? null);
      setFlowReviewId(payload.reviewId ?? null);
      setFlowReviewRevision({
        graphVersion: payload.graphVersion,
        graphHash: payload.graphHash,
      });
      setSelectedReviewIds(new Set(payload.suggestions.map((item) => item.id)));
    } catch (error: any) {
      setFlowReviewError(String(error?.message ?? error));
    } finally {
      setFlowReviewLoading(false);
    }
  };

  const applySelectedFlowReview = async () => {
    if (
      !selectedFlowId ||
      !flowReviewRevision ||
      !selectedReviewIds.size ||
      !flowReviewPreview?.validation.valid
    )
      return;
    setFlowReviewApplying(true);
    setFlowReviewError(null);
    try {
      const result = (await applyFlowReview(projectId, selectedFlowId, {
        suggestionIds: [...selectedReviewIds],
        ...flowReviewRevision,
      })) as {
        graphVersion?: number;
        diagrams?: Array<{ kind: string; source: string }>;
        validation?: { valid: boolean };
      };
      await Promise.all([refreshActiveFlow(), refreshFlows()]);
      if (result.diagrams) setDiagrams(result.diagrams);
      setFlowReviewSuggestions([]);
      setSelectedReviewIds(new Set());
      setFlowReviewPreview(null);
      setFlowReviewId(null);
      setFlowReviewRevision(null);
      setMessage(
        "The existing flow is now connected. Tellann is checking for useful missing states and alternate paths…",
      );
      if (result.validation?.valid && result.graphVersion !== undefined) {
        setFlowReviewLoading(true);
        try {
          const next = await generateFlowSuggestions(
            projectId,
            selectedFlowId,
            {
              trigger: "FLOW_REVIEW_REQUESTED",
              graphVersion: result.graphVersion,
            },
          );
          setFlowReviewSuggestions(next.suggestions);
          setFlowReviewMeta(next.meta ?? null);
          setFlowReviewId(next.reviewId ?? null);
          setFlowReviewRevision({
            graphVersion: next.graphVersion,
            graphHash: next.graphHash,
          });
          setSelectedReviewIds(
            new Set(next.suggestions.map((item) => item.id)),
          );
          setMessage(
            next.suggestions.length
              ? "The core flow is complete. Optional state and path suggestions are ready for review."
              : "The flow is complete and Tellann found no additional states to recommend.",
          );
        } catch (followUpError: any) {
          setFlowReviewError(String(followUpError?.message ?? followUpError));
        } finally {
          setFlowReviewLoading(false);
        }
      }
    } catch (error: any) {
      setFlowReviewError(String(error?.message ?? error));
    } finally {
      setFlowReviewApplying(false);
    }
  };

  const declineCurrentFlowReview = async () => {
    if (!selectedFlowId || !flowReviewId) return;
    setFlowReviewApplying(true);
    setFlowReviewError(null);
    try {
      await declineFlowReview(projectId, selectedFlowId, flowReviewId);
      setFlowReviewSuggestions([]);
      setSelectedReviewIds(new Set());
      setFlowReviewPreview(null);
      setFlowReviewId(null);
      setFlowReviewRevision(null);
      setMessage("Flow review declined. No graph changes were made.");
    } catch (error: any) {
      setFlowReviewError(String(error?.message ?? error));
    } finally {
      setFlowReviewApplying(false);
    }
  };

  const refreshSuggestions = async (
    trigger:
      | "STATE_ADDED"
      | "STATE_UPDATED"
      | "STATE_DELETED"
      | "TRANSITION_ADDED"
      | "SUGGESTION_ACCEPTED"
      | "MANUAL_REFRESH",
    latestState?: Record<string, unknown>,
    graphVersion?: number,
  ) => {
    if (!selectedFlowId) return;
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const payload = await generateFlowSuggestions(projectId, selectedFlowId, {
        trigger,
        graphVersion,
        latestState,
      });
      setSuggestions(payload.suggestions);
      setSuggestionMeta(payload.meta ?? null);
    } catch (error: any) {
      setSuggestionsError(String(error?.message ?? error));
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    const versionId =
      activeFlow?.publishedVersionId ?? activeFlow?.versions?.[0]?.id;
    if (!activeFlow || activeFlow.status !== "COMPLETE" || !versionId) {
      setDiagrams([]);
      return;
    }
    void getFlowDiagrams(projectId, activeFlow.id, versionId)
      .then((payload) =>
        setDiagrams(
          Array.isArray(payload.diagrams)
            ? (payload.diagrams as Array<{ kind: string; source: string }>)
            : [],
        ),
      )
      .catch((error) => setMessage(String(error?.message ?? error)));
  }, [
    activeFlow?.id,
    activeFlow?.publishedVersionId,
    activeFlow?.status,
    getFlowDiagrams,
    projectId,
  ]);

  const createFlow = async () => {
    const name = newFlowName.trim();
    if (!name || !newFlowScope.trim()) return;
    try {
      const flow = await createDeclaredFlow(
        projectId,
        name,
        workflowType,
        newFlowPurpose.trim(),
        newFlowScope.trim(),
      );
      await refreshFlows();
      setNewFlowName("");
      setNewFlowPurpose("");
      setNewFlowScope("");
      setSelectedFlowId(flow.id);
      setFlowMode("existing");
      setMessage("Flow created. Add the states users should move through.");
    } catch (err: any) {
      setMessage(String(err?.message ?? err));
    }
  };

  const addState = async () => {
    const name = stateName.trim();
    if (!selectedFlowId || !name) return;
    try {
      const result = (await addDeclaredState(
        projectId,
        selectedFlowId,
        name,
        stateCategory,
        stateRole,
        stateRole === "TERMINAL" ? terminalKind : null,
      )) as { state?: Record<string, unknown>; graphVersion?: number };
      setStateName("");
      setStateRole("NORMAL");
      await refreshActiveFlow();
      await refreshFlows();
      setMessage("State added. Reviewing the flow for useful next states…");
      void refreshSuggestions("STATE_ADDED", result.state, result.graphVersion);
    } catch (err: any) {
      setMessage(String(err?.message ?? err));
    }
  };

  const beginEditState = (state: DeclaredFlowDetail["states"][number]) => {
    setEditingStateId(state.id);
    setStateName(state.stateName);
    setStateCategory(state.category || "BUSINESS");
    setStateRole(state.role ?? "NORMAL");
    setTerminalKind(state.terminalKind ?? "SUCCESS");
  };

  const cancelEditState = () => {
    setEditingStateId(null);
    setStateName("");
    setStateCategory("BUSINESS");
    setStateRole("NORMAL");
    setTerminalKind("SUCCESS");
  };

  const saveEditedState = async () => {
    const name = stateName.trim();
    const category = stateCategory?.trim() || "BUSINESS";
    if (!selectedFlowId || !editingStateId || !name) return;
    try {
      const result = (await updateDeclaredState(
        projectId,
        selectedFlowId,
        editingStateId,
        name,
        category,
        stateRole,
        stateRole === "TERMINAL" ? terminalKind : null,
      )) as { state?: Record<string, unknown>; graphVersion?: number };
      cancelEditState();
      await Promise.all([refreshActiveFlow(), refreshFlows()]);
      setMessage(
        "State updated. Reviewing suggestions against the new graph revision…",
      );
      void refreshSuggestions(
        "STATE_UPDATED",
        result?.state,
        result?.graphVersion,
      );
    } catch (error: any) {
      setMessage(String(error?.message ?? error));
    }
  };

  const removeState = async (stateId: string, stateNameToDelete: string) => {
    if (!selectedFlowId) return;
    try {
      const result = (await deleteDeclaredState(
        projectId,
        selectedFlowId,
        stateId,
      )) as { graphVersion?: number; deletedTransitionCount?: number };
      if (editingStateId === stateId) cancelEditState();
      setFromStateId((current) => (current === stateId ? "" : current));
      setToStateId((current) => (current === stateId ? "" : current));
      await Promise.all([refreshActiveFlow(), refreshFlows()]);
      setMessage(
        `State deleted${result.deletedTransitionCount ? ` with ${result.deletedTransitionCount} connected transition${result.deletedTransitionCount === 1 ? "" : "s"}` : ""}.`,
      );
      void refreshSuggestions("STATE_DELETED", undefined, result.graphVersion);
    } catch (error: any) {
      setMessage(String(error?.message ?? error));
    }
  };

  const actOnSuggestion = async (
    suggestionId: string,
    action: "accept" | "reject",
  ) => {
    if (!selectedFlowId) return;
    setSuggestionActionId(suggestionId);
    setSuggestionsError(null);
    try {
      if (action === "accept") {
        const response = (await acceptFlowSuggestion(
          projectId,
          selectedFlowId,
          suggestionId,
        )) as { data?: { graphVersion?: number } };
        await Promise.all([refreshActiveFlow(), refreshFlows()]);
        setMessage("Suggestion accepted and added to the flow.");
        await refreshSuggestions(
          "SUGGESTION_ACCEPTED",
          undefined,
          response.data?.graphVersion,
        );
      } else {
        await rejectFlowSuggestion(projectId, selectedFlowId, suggestionId);
        setSuggestions((current) =>
          current.filter((item) => item.id !== suggestionId),
        );
        setMessage("Suggestion declined.");
      }
    } catch (error: any) {
      const detail = String(error?.message ?? error);
      setSuggestionsError(detail);
      if (detail.includes("GRAPH_REVISION_STALE"))
        await refreshSuggestions("MANUAL_REFRESH");
    } finally {
      setSuggestionActionId(null);
    }
  };

  const addTransition = async () => {
    if (
      !selectedFlowId ||
      !fromStateId ||
      !toStateId ||
      fromStateId === toStateId
    )
      return;
    try {
      const result = (await addDeclaredTransition(
        projectId,
        selectedFlowId,
        fromStateId,
        toStateId,
        transitionAction.trim() || undefined,
      )) as { graphVersion?: number };
      setFromStateId("");
      setToStateId("");
      setTransitionAction("");
      await refreshActiveFlow();
      await refreshFlows();
      setMessage("Transition added.");
      void refreshSuggestions(
        "TRANSITION_ADDED",
        undefined,
        result.graphVersion,
      );
    } catch (err: any) {
      setMessage(String(err?.message ?? err));
    }
  };

  const toggleComplete = async () => {
    if (!activeFlow) return;
    try {
      if (activeFlow.status === "COMPLETE")
        await reopenDeclaredFlow(projectId, activeFlow.id);
      else await completeDeclaredFlow(projectId, activeFlow.id);
      await refreshActiveFlow();
      await refreshFlows();
      setMessage(
        activeFlow.status === "COMPLETE"
          ? "Flow reopened for editing."
          : "Flow completed and ready for QA reconciliation.",
      );
    } catch (err: any) {
      setMessage(String(err?.message ?? err));
    }
  };

  const editable = activeFlow?.status !== "COMPLETE";
  const application = applications.find((item) => item.id === projectId);
  const workspaceAttached = Boolean(workspaces[projectId]);
  const activeBinding = (activeFlow as any)?.projectBindings?.[0] as
    | { id: string; status: string }
    | undefined;
  const stateNameById = new Map(
    activeFlow?.states.map((state) => [state.id, state.stateName]) ?? [],
  );

  const initializeActiveFlow = async () => {
    if (!activeFlow?.publishedVersionId || !application?.environments[0]?.id)
      return;
    const environmentId = application.environments[0].id;
    const setup = await window.tellann?.setup.getSdkSetup(
      projectId,
      environmentId,
    );
    if (!(setup?.readiness as any)?.connected) {
      navigate(
        `/projects/${projectId}/instrumentation?setup=connect&flowId=${encodeURIComponent(activeFlow.id)}&flowVersionId=${encodeURIComponent(activeFlow.publishedVersionId)}&environmentId=${encodeURIComponent(environmentId)}`,
      );
      return;
    }
    const created = await initializeFlow({
      flowId: activeFlow.id,
      applicationId: projectId,
      environmentId,
      flowVersionId: activeFlow.publishedVersionId,
    });
    const initializationId = String(
      (created.initialization as Record<string, unknown> | undefined)?.id ?? "",
    );
    if (!initializationId)
      throw new Error("Flow initialization was created without an identifier.");
    navigate(
      `/projects/${projectId}/instrumentation?flowId=${encodeURIComponent(activeFlow.id)}&flowVersionId=${encodeURIComponent(activeFlow.publishedVersionId)}&initializationId=${encodeURIComponent(initializationId)}&environmentId=${encodeURIComponent(environmentId)}`,
    );
  };

  return (
    <div className="stack">
      {showPlanBanner ? (
        <section className="content-card upgrade-card">
          <div>
            <Status>Free plan / Manual declaration</Status>
            <h2>Declare your intended behavior directly</h2>
            <p>
              Manual flow declaration is included on Free. Upgrade to Local or
              Solo to turn requirements and product documents into reviewable
              AI-generated flows.
            </p>
          </div>
          <Status>Local or Solo unlocks AI</Status>
        </section>
      ) : null}

      <section className="context-banner" role="note">
        <strong>Keep every Flow focused.</strong> Declaring an entire project as
        one Flow reduces precision. Prefer one bounded capability such as
        authentication, checkout, password reset, or account deletion.
      </section>

      <section className="content-card manual-flow-create">
        <div className="card-heading">
          <div>
            <small>Step 1</small>
            <h2>Choose or create a flow</h2>
          </div>
          {flows.length > 0 ? (
            <div className="flow-mode-tabs">
              <button
                type="button"
                className={`button ${flowMode === "existing" ? "primary" : ""}`}
                onClick={() => setFlowMode("existing")}
              >
                <Folder size={14} />
                Select existing flow ({flows.length})
              </button>
              <button
                type="button"
                className={`button ${flowMode === "create" ? "primary" : ""}`}
                onClick={() => setFlowMode("create")}
              >
                <Plus size={14} />
                Create new flow
              </button>
            </div>
          ) : null}
        </div>

        {flows.length > 0 && flowMode === "existing" ? (
          <div className="flow-selection-mode">
            <p className="flow-section-guide">
              Select an existing flow from this project to review, edit, or
              publish its states and transitions.
            </p>
            <div className="flow-select-row">
              <label>
                <span>Existing flow</span>
                <SelectField
                  value={selectedFlowId}
                  onValueChange={setSelectedFlowId}
                  options={[
                    { value: "", label: "Select a flow" },
                    ...flows.map((flow) => ({
                      value: flow.id,
                      label: `${flow.name} (${flow.status})`,
                    })),
                  ]}
                  placeholder="Select a flow"
                />
              </label>
            </div>

            {activeFlow ? (
              <div className="active-flow-summary-card">
                <div className="active-flow-header">
                  <div>
                    <strong>{activeFlow.name}</strong>
                    <span className="flow-type-badge">
                      {activeFlow.workflowType}
                    </span>
                    <Status>{activeFlow.status}</Status>
                  </div>
                  <span className="state-count-tag">
                    {activeFlow.states.length} states
                  </span>
                </div>
                {activeFlow.purpose ? (
                  <div className="active-flow-detail">
                    <small>Purpose</small>
                    <p>{activeFlow.purpose}</p>
                  </div>
                ) : null}
                {activeFlow.scopeStatement ? (
                  <div className="active-flow-detail">
                    <small>Scope Boundary</small>
                    <p>{activeFlow.scopeStatement}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="flow-selection-empty-hint">
                Please choose a flow from the dropdown above to continue.
              </p>
            )}
          </div>
        ) : (
          <div className="flow-create-mode">
            {flows.length === 0 ? (
              <p className="flow-section-guide">
                No flows have been created for this project yet. Fill out the
                details below to define your first flow.
              </p>
            ) : (
              <p className="flow-section-guide">
                Define a new capability flow by specifying its name, type,
                purpose, and scope boundary.
              </p>
            )}
            <div className="create-flow-form">
              <div className="create-flow-row">
                <label>
                  <span>New flow name</span>
                  <input
                    value={newFlowName}
                    onChange={(event) => setNewFlowName(event.target.value)}
                    placeholder="e.g. Customer checkout"
                  />
                </label>
                <label>
                  <span>Flow type</span>
                  <SelectField
                    value={workflowType}
                    onValueChange={setWorkflowType}
                    options={[
                      { value: "CUSTOM", label: "Custom" },
                      { value: "AUTHENTICATION", label: "Authentication" },
                      { value: "CHECKOUT", label: "Checkout" },
                      { value: "ONBOARDING", label: "Onboarding" },
                    ]}
                  />
                </label>
              </div>

              <label className="full-width">
                <span className="field-label-with-tooltip">
                  Purpose
                  <span
                    className="tooltip-trigger"
                    tabIndex={0}
                    title="Describe what this capability achieves (e.g. Allow customers to browse items, add to cart, enter shipping info, and place order)."
                  >
                    <HelpCircle size={13} />
                    <span className="tooltip-bubble">
                      Describe what this capability achieves (e.g. Allow
                      customers to browse items, add to cart, enter shipping
                      info, and place order).
                    </span>
                  </span>
                </span>
                <textarea
                  rows={3}
                  value={newFlowPurpose}
                  onChange={(event) => setNewFlowPurpose(event.target.value)}
                  placeholder="What should this functionality achieve? (e.g. Allow customers to add items to cart, enter shipping info, and place order)"
                />
              </label>

              <label className="full-width">
                <span className="field-label-with-tooltip">
                  Scope boundary
                  <span
                    className="tooltip-trigger"
                    tabIndex={0}
                    title="Define the starting and ending boundaries of this flow (e.g. Guest sign-up screen through authenticated session)."
                  >
                    <HelpCircle size={13} />
                    <span className="tooltip-bubble">
                      Define the starting and ending boundaries of this flow
                      (e.g. Guest sign-up screen through authenticated session).
                    </span>
                  </span>
                </span>
                <textarea
                  rows={2}
                  value={newFlowScope}
                  onChange={(event) => setNewFlowScope(event.target.value)}
                  placeholder="e.g. Guest sign-up through authenticated session"
                />
              </label>

              <div className="create-flow-actions">
                <button
                  className="button primary"
                  disabled={busy || !newFlowName.trim() || !newFlowScope.trim()}
                  onClick={() => void createFlow()}
                >
                  <Plus size={15} />
                  Create flow
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {activeFlow ? (
        <>
          <section className="content-card">
            <div className="card-heading">
              <div>
                <small>Step 2</small>
                <h2>Add expected states</h2>
              </div>
              <Status>{activeFlow.states.length} states</Status>
            </div>
            <p>
              States are meaningful moments in the workflow, such as
              CART_REVIEWED, PAYMENT_SUBMITTED, or ORDER_CONFIRMED.
            </p>
            {editingStateId ? (
              <div
                className="state-editing-banner"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#1c1c1c",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  marginTop: "12px",
                  marginBottom: "-4px",
                }}
              >
                <span
                  style={{ color: "#fff", fontSize: "12px", fontWeight: 600 }}
                >
                  Editing state: {stateName || "Untitled"}
                </span>
                <button
                  type="button"
                  className="button"
                  style={{
                    minHeight: "26px",
                    fontSize: "11px",
                    padding: "0 10px",
                  }}
                  onClick={cancelEditState}
                >
                  Cancel editing
                </button>
              </div>
            ) : null}
            <div className="manual-flow-controls">
              <label>
                <span>State name</span>
                <input
                  disabled={!editable}
                  value={stateName}
                  onChange={(event) => setStateName(event.target.value)}
                  placeholder="e.g. PAYMENT_SUBMITTED"
                />
              </label>
              <label>
                <span>Category</span>
                <SelectField
                  disabled={!editable}
                  value={stateCategory}
                  onValueChange={setStateCategory}
                  options={[
                    { value: "BUSINESS", label: "Business" },
                    { value: "UI", label: "UI" },
                    { value: "SYSTEM", label: "System" },
                    { value: "ERROR", label: "Error" },
                  ]}
                />
              </label>
              <label>
                <span>Boundary role</span>
                <SelectField
                  disabled={!editable}
                  value={stateRole}
                  onValueChange={setStateRole}
                  options={[
                    { value: "NORMAL", label: "Intermediate" },
                    { value: "INITIAL", label: "Initial state" },
                    { value: "TERMINAL", label: "Terminal state" },
                  ]}
                />
              </label>
              {stateRole === "TERMINAL" ? (
                <label>
                  <span>Terminal outcome</span>
                  <SelectField
                    value={terminalKind}
                    onValueChange={setTerminalKind}
                    options={[
                      { value: "SUCCESS", label: "Success" },
                      { value: "FAILURE", label: "Failure" },
                      { value: "CANCELLATION", label: "Cancellation" },
                      { value: "ALTERNATE", label: "Alternate completion" },
                    ]}
                  />
                </label>
              ) : null}
              <button
                type="button"
                className="button primary"
                disabled={busy || !editable || !stateName.trim()}
                onClick={() =>
                  void (editingStateId ? saveEditedState() : addState())
                }
              >
                {editingStateId ? <Check size={15} /> : <Plus size={15} />}
                {editingStateId ? "Save state" : "Add state"}
              </button>
              {editingStateId ? (
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={cancelEditState}
                >
                  <X size={15} /> Cancel
                </button>
              ) : null}
            </div>
            {activeFlow.states.length ? (
              <div className="manual-state-list">
                {activeFlow.states.map((state, index) => (
                  <div key={state.id}>
                    <span>{index + 1}</span>
                    <strong>{state.stateName}</strong>
                    <small>{state.category}</small>
                    <div className="manual-state-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title={`Edit ${state.stateName}`}
                        aria-label={`Edit ${state.stateName}`}
                        disabled={!editable || busy}
                        onClick={() => beginEditState(state)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        title={`Delete ${state.stateName}`}
                        aria-label={`Delete ${state.stateName}`}
                        disabled={!editable || busy}
                        onClick={() =>
                          setStateToDelete({
                            id: state.id,
                            name: state.stateName,
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <small>
                      {state.role === "INITIAL"
                        ? "Initial"
                        : state.role === "TERMINAL"
                          ? `Terminal · ${state.terminalKind}`
                          : "Intermediate"}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-callout">
                No states yet. Add the first expected behavior above.
              </p>
            )}
            <GuidedSuggestionsPanel
              suggestions={suggestions}
              meta={suggestionMeta}
              loading={suggestionsLoading}
              error={suggestionsError}
              actionId={suggestionActionId}
              editable={editable}
              onRefresh={() => void refreshSuggestions("MANUAL_REFRESH")}
              onAccept={(id) => void actOnSuggestion(id, "accept")}
              onReject={(id) => void actOnSuggestion(id, "reject")}
            />
          </section>

          <ConfirmModal
            isOpen={Boolean(stateToDelete)}
            title={`Delete state "${stateToDelete?.name}"?`}
            description="Are you sure you want to delete this state? Any transitions connected to this state will also be deleted."
            confirmLabel="Delete state"
            cancelLabel="Cancel"
            variant="danger"
            busy={busy}
            onCancel={() => setStateToDelete(null)}
            onConfirm={() => {
              if (stateToDelete) {
                const { id, name } = stateToDelete;
                setStateToDelete(null);
                void removeState(id, name);
              }
            }}
          />

          <section className="content-card">
            <div className="card-heading">
              <div>
                <small>Step 3</small>
                <h2>Connect the states</h2>
              </div>
              <Status>{activeFlow.transitions.length} transitions</Status>
            </div>
            <div className="manual-flow-controls transition-controls">
              <label>
                <span>From</span>
                <SelectField
                  disabled={!editable}
                  value={fromStateId}
                  onValueChange={setFromStateId}
                  options={activeFlow.states.map((state) => ({
                    value: state.id,
                    label: state.stateName,
                  }))}
                  placeholder="Choose state"
                />
              </label>
              <label>
                <span>To</span>
                <SelectField
                  disabled={!editable}
                  value={toStateId}
                  onValueChange={setToStateId}
                  options={activeFlow.states.map((state) => ({
                    value: state.id,
                    label: state.stateName,
                  }))}
                  placeholder="Choose state"
                />
              </label>
              <label>
                <span>Action (optional)</span>
                <input
                  disabled={!editable}
                  value={transitionAction}
                  onChange={(event) => setTransitionAction(event.target.value)}
                  placeholder="e.g. submit payment"
                />
              </label>
              <button
                className="button primary"
                disabled={
                  busy ||
                  !editable ||
                  !fromStateId ||
                  !toStateId ||
                  fromStateId === toStateId
                }
                onClick={() => void addTransition()}
              >
                <Plus size={15} />
                Add transition
              </button>
            </div>
            {activeFlow.transitions.length ? (
              <div className="manual-transition-list">
                {activeFlow.transitions.map((transition) => (
                  <div key={transition.id} className="manual-transition-item">
                    <div className="manual-transition-flow">
                      <strong className="state-tag">
                        {stateNameById.get(transition.fromStateId) ??
                          transition.fromState?.stateName}
                      </strong>
                      <ArrowRight size={14} className="transition-arrow" />
                      <strong className="state-tag">
                        {stateNameById.get(transition.toStateId) ??
                          transition.toState?.stateName}
                      </strong>
                    </div>
                    <small className="manual-transition-action">
                      {transition.action || "Transition"}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-callout">
                Add at least two states, then describe how users move between
                them.
              </p>
            )}
            <WholeFlowReviewPanel
              suggestions={flowReviewSuggestions}
              meta={flowReviewMeta}
              selectedIds={selectedReviewIds}
              preview={flowReviewPreview}
              loading={flowReviewLoading}
              previewLoading={flowReviewPreviewLoading}
              applying={flowReviewApplying}
              error={flowReviewError}
              editable={editable}
              stateCount={activeFlow.states.length}
              onReview={() => void requestFlowReview()}
              onToggle={(id) =>
                setSelectedReviewIds((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onApply={() => void applySelectedFlowReview()}
              onDecline={() => void declineCurrentFlowReview()}
            />
          </section>

          <section className="content-card manual-flow-finish">
            <div>
              <small>Step 4</small>
              <h2>
                {activeFlow.status === "COMPLETE"
                  ? "Flow is published"
                  : "Publish the declaration"}
              </h2>
              <p>
                {activeFlow.status === "COMPLETE"
                  ? "This immutable Flow version is now the source of truth for initialization, rescans, QA runs, drift, and reports."
                  : "Publishing validates one initial state, one or more reachable terminal states, and all transitions before locking this version."}
              </p>
            </div>
            <button
              className="button primary"
              disabled={busy || (!activeFlow.states.length && editable)}
              onClick={() => void toggleComplete()}
            >
              {activeFlow.status === "COMPLETE" ? (
                <Unlock size={15} />
              ) : (
                <Lock size={15} />
              )}
              {activeFlow.status === "COMPLETE"
                ? "Create revision"
                : "Publish flow"}
            </button>
          </section>
          {diagrams.length ? (
            <section className="content-card">
              <div className="card-heading">
                <div>
                  <small>Synchronized projections</small>
                  <h2>Flow diagrams</h2>
                </div>
                <Status>Derived from this published version</Status>
              </div>
              <div
                className="button-row diagram-tabs"
                role="tablist"
                aria-label="Flow diagram projections"
              >
                {diagrams.map((diagram) => (
                  <button
                    key={diagram.kind}
                    type="button"
                    role="tab"
                    aria-selected={activeDiagramKind === diagram.kind}
                    aria-controls="published-flow-diagram"
                    className={
                      activeDiagramKind === diagram.kind
                        ? "button primary mr-2"
                        : "button secondary mr-2"
                    }
                    onClick={() => setActiveDiagramKind(diagram.kind)}
                  >
                    {diagram.kind.replace("_", " ")}
                  </button>
                ))}
              </div>
              {diagrams
                .filter((diagram) => diagram.kind === activeDiagramKind)
                .map((diagram) => {
                  const diagramLabel = `${diagram.kind.replaceAll("_", " ")} diagram`;
                  return (
                    <div
                      id="published-flow-diagram"
                      key={`${diagram.kind}-${diagram.source}`}
                      role="tabpanel"
                      className="published-flow-diagram"
                      aria-label={diagramLabel}
                    >
                      <FlowDiagram
                        source={diagram.source}
                        label={diagramLabel}
                      />
                    </div>
                  );
                })}
              <p className="muted-callout">
                All four views are generated from the same states and
                transitions. Edit the Flow—not the projection—to keep every
                diagram synchronized.
              </p>
            </section>
          ) : null}
          {activeFlow.status === "COMPLETE" ? (
            <section className="content-card">
              <div className="card-heading">
                <div>
                  <small>Project lifecycle</small>
                  <h2>
                    {activeBinding?.status === "ACTIVE"
                      ? "Rescan Flow"
                      : "Initialize Flow in project"}
                  </h2>
                </div>
                <Status>{activeBinding?.status ?? "Not initialized"}</Status>
              </div>
              <p className="mb-4">
                {activeBinding?.status === "ACTIVE"
                  ? "Create a new immutable scan, compare it with the previous implementation, and assess both against this published Flow."
                  : "Run the first Flow-scoped repository analysis, generate the code-review report, then review and approve the checkpoint instrumentation proposal."}
              </p>
              {!workspaceAttached ? (
                <p className="muted-callout">
                  Attach and scan a local workspace before initializing this
                  Flow.
                </p>
              ) : null}
              <button
                className="button primary"
                disabled={
                  busy ||
                  !workspaceAttached ||
                  !application?.environments[0]?.id ||
                  !activeFlow.publishedVersionId
                }
                onClick={() =>
                  void (
                    activeBinding?.status === "ACTIVE"
                      ? rescanFlow(activeBinding.id, projectId).then(() =>
                          refreshActiveFlow(),
                        )
                      : initializeActiveFlow()
                  )
                    .then(() =>
                      activeBinding?.status === "ACTIVE"
                        ? refreshActiveFlow().then(() =>
                            setMessage(
                              "Flow rescan completed and drift was generated.",
                            ),
                          )
                        : undefined,
                    )
                    .catch((error) =>
                      setMessage(String(error?.message ?? error)),
                    )
                }
              >
                {activeBinding?.status === "ACTIVE"
                  ? "Rescan Flow"
                  : "Initialize Flow"}
              </button>
            </section>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={<Workflow size={36} />}
          title="Create your first intended flow"
          description="Name a workflow above, then add its expected states and transitions."
        />
      )}
      {message ? (
        <div className="context-banner" role="status">
          {message}
        </div>
      ) : null}
    </div>
  );
}

export function DeclaredFlowPage() {
  const { flowId } = useParams();
  const { projectId, application, getDeclaredFlows } = useProject();
  const [flows, setFlows] = useState<DeclaredFlowSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshFlows = useCallback(async () => {
    if (!projectId) return [];
    const next = await getDeclaredFlows(projectId);
    setFlows(next);
    return next;
  }, [getDeclaredFlows, projectId]);

  useEffect(() => {
    let cancelled = false;
    void refreshFlows().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshFlows]);

  if (!projectId || !flowId) return <ProjectRequired />;
  if (!application) {
    return (
      <NotFoundPage
        title="Project unavailable"
        description="Select another project."
      />
    );
  }
  if (loading) return <LoadingState />;
  if (!flows.some((flow) => flow.id === flowId)) {
    return (
      <NotFoundPage
        title="Flow unavailable"
        description="This flow does not exist or is outside the selected project."
      />
    );
  }

  return (
    <Page
      title="Edit declared flow"
      description="Add the expected states and transitions, then complete the flow when it is ready for QA."
      actions={
        <Link className="button" to={`/projects/${projectId}/intent`}>
          Back to Intent
        </Link>
      }
    >
      <ManualIntentBuilder
        projectId={projectId}
        flows={flows}
        refreshFlows={refreshFlows}
        initialFlowId={flowId}
        showPlanBanner={false}
      />
    </Page>
  );
}

type IntentAutomationStage =
  | "IDLE"
  | "SELECTING_FILES"
  | "EXTRACTING_AND_UPLOADING"
  | "PROCESSING_DOCUMENTS"
  | "GENERATING_DRAFT"
  | "DRAFT_READY"
  | "PARTIAL_FAILURE"
  | "FAILED";

const JOB_POLL_INTERVAL_MS = 2_000;
const JOB_POLL_TIMEOUT_MS = 5 * 60_000;
const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function intentErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("FEATURE_NOT_ENTITLED"))
    return "Document-based flow generation is not included on this plan.";
  if (message.includes("PROMPT_INJECTION"))
    return "The approved document summary contains unsafe instructions and cannot be used for generation.";
  if (message.includes("INVALID_OR_UNPROCESSED"))
    return "One or more documents are not ready yet. Check their processing status and retry.";
  if (message.includes("DRAFT_JOB_CANNOT_BE_CANCELLED"))
    return "Generation has already started and can no longer be cancelled. Wait for it to finish, then review or discard the draft.";
  if (message.includes("401") || message.includes("UNAUTHORIZED"))
    return "Your desktop session expired. Sign in again, then check this job.";
  return (
    message
      .replace(/^Error invoking remote method '[^']+':\s*/i, "")
      .slice(0, 240) || "The flow-generation cycle failed."
  );
}

function humanizeFlowLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summarizeDraftRevision(
  parentDraft: IntentDraft | null,
  revisedDraft: IntentDraft,
): string[] {
  if (!parentDraft) return [];
  const parentWorkflows = Array.isArray(
    (parentDraft.draftJson as any)?.workflows,
  )
    ? (parentDraft.draftJson as any).workflows
    : [];
  const revisedWorkflows = Array.isArray(
    (revisedDraft.draftJson as any)?.workflows,
  )
    ? (revisedDraft.draftJson as any).workflows
    : [];
  const parentByKey = new Map(
    parentWorkflows.map((workflow: any) => [String(workflow.key), workflow]),
  );
  const revisedKeys = new Set(
    revisedWorkflows.map((workflow: any) => String(workflow.key)),
  );
  const changes: string[] = [];
  for (const workflow of revisedWorkflows) {
    const previous: any = parentByKey.get(String(workflow.key));
    if (!previous) {
      changes.push(
        `Added “${workflow.name}” with ${workflow.states?.length ?? 0} expected steps.`,
      );
      continue;
    }
    const details: string[] = [];
    if (previous.name !== workflow.name)
      details.push(`renamed from “${previous.name}”`);
    if ((previous.states?.length ?? 0) !== (workflow.states?.length ?? 0))
      details.push(
        `steps changed from ${previous.states?.length ?? 0} to ${workflow.states?.length ?? 0}`,
      );
    if (
      (previous.transitions?.length ?? 0) !==
      (workflow.transitions?.length ?? 0)
    )
      details.push(
        `transitions changed from ${previous.transitions?.length ?? 0} to ${workflow.transitions?.length ?? 0}`,
      );
    if (
      !details.length &&
      JSON.stringify({
        states: previous.states ?? [],
        transitions: previous.transitions ?? [],
      }) !==
        JSON.stringify({
          states: workflow.states ?? [],
          transitions: workflow.transitions ?? [],
        })
    )
      details.push("expected steps or transition behavior were revised");
    if (details.length)
      changes.push(`Updated “${workflow.name}”: ${details.join(", ")}.`);
  }
  for (const workflow of parentWorkflows) {
    if (!revisedKeys.has(String(workflow.key)))
      changes.push(`Removed “${workflow.name}”.`);
  }
  return changes;
}

export function IntentPage() {
  const { projectId, application, getDeclaredFlows } = useProject();
  const activeProjectId = projectId ?? "";
  const {
    getIntentDrafts,
    getIntentDraftJobs,
    getIntentDraftJob,
    cancelIntentDraftJob,
    getDocuments,
    getDocumentJob,
    importDocuments,
    createIntentDraft,
    deleteIntentDraft,
    busy,
  } = useDesktop();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<DeclaredFlowSummary[]>([]);
  const [drafts, setDrafts] = useState<IntentDraft[]>([]);
  const [documents, setDocuments] = useState<SourceDocumentSummary[]>([]);
  const [batch, setBatch] = useState<DocumentImportResult[]>([]);
  const [stage, setStage] = useState<IntentAutomationStage>("IDLE");
  const [automationMessage, setAutomationMessage] = useState<string | null>(
    null,
  );
  const [activeDraftJobId, setActiveDraftJobId] = useState<string | null>(null);
  const [activeDraftJobs, setActiveDraftJobs] = useState<IntentDraftJob[]>([]);
  const [cancellingDraftJobId, setCancellingDraftJobId] = useState<
    string | null
  >(null);
  const [documentPickerOpen, setDocumentPickerOpen] = useState(false);
  const [selectedReadyVersionIds, setSelectedReadyVersionIds] = useState<
    Set<string>
  >(() => new Set());
  const [confirmingDraftId, setConfirmingDraftId] = useState<string | null>(
    null,
  );
  const [draftManagementMessage, setDraftManagementMessage] = useState<
    string | null
  >(null);
  const [documentAutomationAvailable, setDocumentAutomationAvailable] =
    useState<boolean | null>(null);
  const [entitlementModalOpen, setEntitlementModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const operationRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    const [nextFlows, access] = await Promise.all([
      getDeclaredFlows(projectId).catch(() => []),
      getDocuments(projectId),
    ]);
    setFlows(nextFlows);
    setDocuments(access.documents);
    setDocumentAutomationAvailable(access.entitled);
    if (access.entitled) {
      const [nextDrafts, nextJobs] = await Promise.all([
        getIntentDrafts(projectId),
        getIntentDraftJobs(projectId),
      ]);
      setDrafts(nextDrafts);
      setActiveDraftJobs(nextJobs);
    } else {
      setDrafts([]);
      setActiveDraftJobs([]);
    }
  }, [
    getDeclaredFlows,
    getDocuments,
    getIntentDraftJobs,
    getIntentDrafts,
    projectId,
  ]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void refresh()
      .catch(() => {
        if (!cancelled) setDocumentAutomationAvailable(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      operationRef.current += 1;
    };
  }, [projectId, refresh]);

  useEffect(() => {
    const onFocus = () => void refresh().catch(() => undefined);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  useEffect(() => {
    if (!documentPickerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDocumentPickerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [documentPickerOpen]);
  const refreshFlows = async () => {
    const next = await getDeclaredFlows(activeProjectId);
    setFlows(next);
    return next;
  };

  const removeDraft = async (draft: IntentDraft) => {
    if (confirmingDraftId !== draft.id) {
      setConfirmingDraftId(draft.id);
      setDraftManagementMessage(
        `Confirm deletion of “${(draft.draftJson as any)?.workflows?.[0]?.name ?? "this draft"}”. This removes the draft and its generated evidence.`,
      );
      return;
    }
    try {
      await deleteIntentDraft(activeProjectId, draft.id);
      setConfirmingDraftId(null);
      setDraftManagementMessage("Draft deleted.");
      await refresh();
    } catch (error) {
      setDraftManagementMessage(intentErrorMessage(error));
    }
  };

  const pollDraftJob = useCallback(
    async (jobId: string, operation: number) => {
      const startedAt = Date.now();
      setActiveDraftJobId(jobId);
      while (
        operationRef.current === operation &&
        Date.now() - startedAt < JOB_POLL_TIMEOUT_MS
      ) {
        const job: IntentDraftJob = await getIntentDraftJob(
          activeProjectId,
          jobId,
        );
        setActiveDraftJobs((current) =>
          current.map((candidate) =>
            candidate.id === job.id ? job : candidate,
          ),
        );
        if (job.status === "COMPLETED" && job.draftId) {
          setStage("DRAFT_READY");
          setActiveDraftJobId(null);
          await refresh();
          navigate(`/projects/${activeProjectId}/intent/drafts/${job.draftId}`);
          return;
        }
        if (job.status === "FAILED" || job.status === "CANCELLED") {
          setActiveDraftJobId(null);
          throw new Error(
            job.errorMessageSafe ?? "Flow draft generation failed.",
          );
        }
        await delay(JOB_POLL_INTERVAL_MS);
      }
      if (operationRef.current === operation) {
        setStage("FAILED");
        setAutomationMessage(
          "Generation is still running. Use Check again to resume without creating another job.",
        );
      }
    },
    [activeProjectId, getIntentDraftJob, navigate, refresh],
  );

  useEffect(() => {
    const resumable = activeDraftJobs[0];
    if (
      !resumable ||
      activeDraftJobId ||
      [
        "SELECTING_FILES",
        "EXTRACTING_AND_UPLOADING",
        "PROCESSING_DOCUMENTS",
        "GENERATING_DRAFT",
      ].includes(stage)
    )
      return;
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    setStage("GENERATING_DRAFT");
    setAutomationMessage(
      "Resumed an existing generation. You can leave this page; progress is stored securely and will reappear when you return.",
    );
    void pollDraftJob(resumable.id, operation).catch((error) => {
      if (operationRef.current !== operation) return;
      setStage("FAILED");
      setAutomationMessage(intentErrorMessage(error));
      void refresh().catch(() => undefined);
    });
  }, [activeDraftJobId, activeDraftJobs, pollDraftJob, refresh, stage]);

  const generateVersions = useCallback(
    async (versionIds: string[], operation: number) => {
      if (!versionIds.length || operationRef.current !== operation) return;
      setStage("GENERATING_DRAFT");
      setAutomationMessage(
        "Generating a reviewable flow draft from approved evidence…",
      );
      const created = await createIntentDraft(activeProjectId, [
        ...new Set(versionIds),
      ]);
      await pollDraftJob(created.jobId, operation);
    },
    [activeProjectId, createIntentDraft, pollDraftJob],
  );

  const cancelGeneration = async (jobId: string) => {
    operationRef.current += 1;
    setActiveDraftJobId(null);
    setCancellingDraftJobId(jobId);
    try {
      await cancelIntentDraftJob(activeProjectId, jobId);
      const remaining = await getIntentDraftJobs(activeProjectId);
      setActiveDraftJobs(remaining);
      setStage("IDLE");
      setAutomationMessage(
        remaining.length
          ? "Queued generation cancelled. Another existing generation is still active."
          : "Generation cancelled. You can upload files or generate again from ready documents.",
      );
    } catch (error) {
      setStage("FAILED");
      setAutomationMessage(intentErrorMessage(error));
      await refresh().catch(() => undefined);
    } finally {
      setCancellingDraftJobId(null);
    }
  };

  const uploadAndGenerate = useCallback(async () => {
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    setBatch([]);
    setAutomationMessage(null);
    setStage("SELECTING_FILES");
    try {
      setStage("EXTRACTING_AND_UPLOADING");
      const imported = await importDocuments(activeProjectId);
      if (operationRef.current !== operation) return;
      if (!imported.length) {
        setStage("IDLE");
        return;
      }
      setBatch(imported);
      const pending = imported.filter(
        (item) => item.jobId && !item.versionId && item.status !== "FAILED",
      );
      const readyVersionIds = imported.flatMap((item) =>
        item.versionId ? [item.versionId] : [],
      );
      const failures = imported.filter((item) => item.status === "FAILED");
      if (pending.length) {
        setStage("PROCESSING_DOCUMENTS");
        setAutomationMessage(
          "Processing document evidence locally and in the secure worker queue…",
        );
        const startedAt = Date.now();
        const remaining = new Map(pending.map((item) => [item.jobId!, item]));
        while (
          remaining.size &&
          operationRef.current === operation &&
          Date.now() - startedAt < JOB_POLL_TIMEOUT_MS
        ) {
          const jobs = await Promise.all(
            [...remaining.keys()].map((jobId) =>
              getDocumentJob(activeProjectId, jobId),
            ),
          );
          for (const job of jobs) {
            const source = remaining.get(job.id)!;
            if (job.status === "COMPLETED" && job.resultVersionId) {
              readyVersionIds.push(job.resultVersionId);
              remaining.delete(job.id);
            } else if (job.status === "FAILED" || job.status === "CANCELLED") {
              failures.push({
                ...source,
                status: "FAILED",
                errorMessageSafe:
                  job.errorMessageSafe ?? "Document processing failed.",
              });
              remaining.delete(job.id);
            }
          }
          setBatch((current) =>
            current.map((item) => {
              const job = jobs.find((candidate) => candidate.id === item.jobId);
              return job
                ? {
                    ...item,
                    status: job.status,
                    versionId: job.resultVersionId,
                    errorMessageSafe: job.errorMessageSafe,
                  }
                : item;
            }),
          );
          if (remaining.size) await delay(JOB_POLL_INTERVAL_MS);
        }
        if (remaining.size && operationRef.current === operation) {
          setStage("FAILED");
          setAutomationMessage(
            "Document processing is still running. Check again from Intent or Sources; no duplicate job was created.",
          );
          await refresh();
          return;
        }
      }
      if (!readyVersionIds.length)
        throw new Error(
          "No selected document produced usable evidence. Review the file errors and retry.",
        );
      if (failures.length) {
        setStage("PARTIAL_FAILURE");
        setAutomationMessage(
          `${failures.length} file(s) failed. Generating from ${readyVersionIds.length} successful file(s).`,
        );
      }
      await generateVersions(readyVersionIds, operation);
    } catch (error) {
      if (operationRef.current !== operation) return;
      setStage("FAILED");
      setAutomationMessage(intentErrorMessage(error));
      await refresh().catch(() => undefined);
    }
  }, [
    activeProjectId,
    generateVersions,
    getDocumentJob,
    importDocuments,
    refresh,
  ]);

  const openReadyDocumentPicker = () => {
    setSelectedReadyVersionIds(new Set());
    setDocumentPickerOpen(true);
  };

  const generateReadyDocuments = () => {
    const versionIds = [...selectedReadyVersionIds];
    if (!versionIds.length) return;
    setDocumentPickerOpen(false);
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    void generateVersions(versionIds, operation).catch((error) => {
      setStage("FAILED");
      setAutomationMessage(intentErrorMessage(error));
    });
  };

  const resumeDocumentBatch = async () => {
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    setStage("PROCESSING_DOCUMENTS");
    setAutomationMessage("Checking the existing document jobs…");
    try {
      const readyVersionIds = batch.flatMap((item) =>
        item.versionId ? [item.versionId] : [],
      );
      const pending = batch.filter(
        (item) => item.jobId && !item.versionId && item.status !== "FAILED",
      );
      const jobs = await Promise.all(
        pending.map((item) => getDocumentJob(activeProjectId, item.jobId!)),
      );
      const failedIds = new Set(
        jobs
          .filter(
            (job) => job.status === "FAILED" || job.status === "CANCELLED",
          )
          .map((job) => job.id),
      );
      for (const job of jobs)
        if (job.status === "COMPLETED" && job.resultVersionId)
          readyVersionIds.push(job.resultVersionId);
      setBatch((current) =>
        current.map((item) => {
          const job = jobs.find((candidate) => candidate.id === item.jobId);
          return job
            ? {
                ...item,
                status: job.status,
                versionId: job.resultVersionId,
                errorMessageSafe: job.errorMessageSafe,
              }
            : item;
        }),
      );
      if (
        jobs.some(
          (job) => job.status === "QUEUED" || job.status === "PROCESSING",
        )
      ) {
        setStage("FAILED");
        setAutomationMessage(
          "Some document jobs are still running. Wait briefly, then check again.",
        );
        return;
      }
      if (!readyVersionIds.length)
        throw new Error("No document in this batch produced usable evidence.");
      if (failedIds.size)
        setAutomationMessage(
          `${failedIds.size} file(s) failed. Continuing with the successful evidence.`,
        );
      await generateVersions(readyVersionIds, operation);
    } catch (error) {
      setStage("FAILED");
      const msg = intentErrorMessage(error);
      if (String(error).includes("FEATURE_NOT_ENTITLED") || msg.includes("FEATURE_NOT_ENTITLED")) {
        setEntitlementModalOpen(true);
      }
      setAutomationMessage(msg);
    }
  };

  const checkAgain = () => {
    if (activeDraftJobId) {
      const operation = operationRef.current + 1;
      operationRef.current = operation;
      setStage("GENERATING_DRAFT");
      void pollDraftJob(activeDraftJobId, operation).catch((error) => {
        setStage("FAILED");
        const msg = intentErrorMessage(error);
        if (String(error).includes("FEATURE_NOT_ENTITLED") || msg.includes("FEATURE_NOT_ENTITLED")) {
          setEntitlementModalOpen(true);
        }
        setAutomationMessage(msg);
      });
    } else if (
      batch.some(
        (item) => item.jobId && !item.versionId && item.status !== "FAILED",
      )
    ) {
      void resumeDocumentBatch();
    } else void refresh();
  };
  const readyDocuments = documents.filter(
    (document) => document.versions.length > 0,
  );
  const processingDocuments = documents.filter((document) =>
    ["QUEUED", "PROCESSING"].includes(
      document.processingJobs[0]?.status ?? document.status,
    ),
  );
  const automationActive = [
    "SELECTING_FILES",
    "EXTRACTING_AND_UPLOADING",
    "PROCESSING_DOCUMENTS",
    "GENERATING_DRAFT",
  ].includes(stage);
  if (!projectId) return <ProjectRequired />;
  if (!application)
    return (
      <NotFoundPage
        title="Project unavailable"
        description="Select another project."
      />
    );
  return (
    <Page
      title="Intent"
      description={
        documentAutomationAvailable === false
          ? "Declare the system flows and behaviors your QA runs should expect."
          : "Generate expected workflows from approved document and repository evidence, then review before graph truth changes."
      }
      actions={
        <>
          {documentAutomationAvailable === false ? (
            <button
              className="button primary"
              onClick={() => setEntitlementModalOpen(true)}
            >
              <Sparkles size={15} /> Upgrade plan
            </button>
          ) : null}
          <Link className="button" to={`/projects/${projectId}/sources`}>
            <BookOpenText size={15} /> View documents
          </Link>
          <Link
            className="button"
            to={`/projects/${projectId}/intent/versions`}
          >
            Version history
          </Link>
        </>
      }
    >
      <EntitlementModal
        isOpen={entitlementModalOpen}
        feature="DOCUMENT_FLOW_INFERENCE"
        currentPlan="Free"
        onClose={() => setEntitlementModalOpen(false)}
      />
      {loading ? (
        <LoadingState />
      ) : documentAutomationAvailable === false ? (
        <ManualIntentBuilder
          projectId={projectId}
          flows={flows}
          refreshFlows={refreshFlows}
        />
      ) : (
        <div className="stack">
          <section className="content-card ai-intent-actions">
            <div>
              {/* <Status>AI-assisted intent</Status> */}
              <h2>Generate flows from your documents</h2>
              <p>
                Tellann creates a review draft first. Nothing changes graph
                truth until you accept it.
              </p>
            </div>
            <div className="review-actions">
              <button
                className="button primary"
                disabled={busy || automationActive}
                title={
                  automationActive
                    ? "Cancel or finish the active generation before starting another."
                    : undefined
                }
                onClick={() => void uploadAndGenerate()}
              >
                <FileSearch size={15} /> Upload and generate
              </button>
              {readyDocuments.length ? (
                <button
                  className="button"
                  disabled={busy || automationActive}
                  title={
                    automationActive
                      ? "Cancel or finish the active generation before starting another."
                      : undefined
                  }
                  onClick={openReadyDocumentPicker}
                >
                  <Workflow size={15} /> Generate from ready documents
                </button>
              ) : null}
            </div>
          </section>
          {documentPickerOpen ? (
            <div
              className="desktop-modal-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !automationActive)
                  setDocumentPickerOpen(false);
              }}
            >
              <section
                className="desktop-modal w-full bg-[#131313] border border-[#262626] rounded-xs p-6 shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ready-document-picker-title"
                aria-describedby="ready-document-picker-description"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2
                    id="ready-document-picker-title"
                    className="text-white text-[24px] font-semibold tracking-[-0.01em] mb-2"
                  >
                    Choose documents
                  </h2>{" "}
                  <div className="flex items-center gap-3">
                    <span className="border border-[#444748] text-[#8e9192] px-2 py-1 text-[11px] font-mono tracking-[0.08em] uppercase">
                      EVIDENCE // SELECTION
                    </span>
                    {/* <button
                      type="button"
                      className="text-[#8e9192] hover:text-white transition-colors p-1"
                      aria-label="Close document selection"
                      onClick={() => setDocumentPickerOpen(false)}
                    >
                      <X size={16} />
                    </button> */}
                  </div>
                </div>

                <p
                  id="ready-document-picker-description"
                  className="text-[#c4c7c8] text-[14px] leading-relaxed mb-6"
                >
                  Select the uploaded documents Tellann should use as evidence.
                  Only the latest processed version of each document is shown.
                </p>

                <div className="bg-[#000000] border border-[#262626] rounded-xs mb-4 max-h-[380px] overflow-y-auto divide-y divide-[#262626]">
                  {readyDocuments.map((document) => {
                    const version = document.versions[0];
                    const selected = selectedReadyVersionIds.has(version.id);
                    const toggleSelect = () => {
                      setSelectedReadyVersionIds((current) => {
                        const next = new Set(current);
                        if (next.has(version.id)) next.delete(version.id);
                        else next.add(version.id);
                        return next;
                      });
                    };

                    return (
                      <div
                        key={document.id}
                        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                          selected
                            ? "bg-[#181818]"
                            : "bg-[#000000] hover:bg-[#131313]"
                        }`}
                        onClick={toggleSelect}
                      >
                        <div className="flex flex-col gap-1 min-w-0 pr-4">
                          <strong className="text-white text-[13px] font-semibold truncate">
                            {document.filename}
                          </strong>
                          <span className="text-[#8e9192] font-mono text-[11px] tracking-[0.08em] uppercase">
                            Version {version.version} · Ready for generation
                          </span>
                        </div>
                        <Switch
                          checked={selected}
                          onCheckedChange={toggleSelect}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    );
                  })}
                </div>

                <div
                  className="text-[#8e9192] font-mono text-[11px] tracking-[0.08em] uppercase mb-6"
                  aria-live="polite"
                >
                  {selectedReadyVersionIds.size
                    ? `${selectedReadyVersionIds.size} DOCUMENT${selectedReadyVersionIds.size === 1 ? "" : "S"} SELECTED`
                    : "SELECT AT LEAST ONE DOCUMENT TO CONTINUE."}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="px-5 py-3 border border-[#444748] bg-[#000000] text-[#c4c7c8] hover:text-white hover:border-white font-mono text-[12px] tracking-[0.08em] uppercase font-semibold rounded-xs transition-colors"
                    onClick={() => setDocumentPickerOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="flex-1 px-5 py-3 bg-white text-black! font-mono text-[12px] tracking-[0.08em] uppercase font-semibold rounded-xs hover:bg-[#e6e6e6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={!selectedReadyVersionIds.size || automationActive}
                    onClick={generateReadyDocuments}
                  >
                    Generate selected flows
                  </button>
                </div>
              </section>
            </div>
          ) : null}
          {stage !== "IDLE" || batch.length || automationMessage ? (
            <section
              className="content-card intent-progress flex flex-col gap-4 w-full overflow-hidden"
              aria-live="polite"
            >
              <div className="card-heading flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
                <div className="min-w-0 flex-1">
                  <small>Generation cycle</small>
                  <h2 className="break-words">{stage.replaceAll("_", " ")}</h2>
                </div>
                <div className="shrink-0 self-start sm:self-auto">
                  <Status>{automationActive ? "IN PROGRESS" : stage}</Status>
                </div>
              </div>
              {automationMessage ? (
                <p className="break-words leading-relaxed">
                  {automationMessage}
                </p>
              ) : null}
              {activeDraftJobs.length ? (
                <div className="stack compact flex flex-col gap-2.5 w-full">
                  {activeDraftJobs.map((job) => {
                    const queuedForMs = job.createdAt
                      ? Date.now() - new Date(job.createdAt).getTime()
                      : 0;
                    const delayed =
                      job.status === "QUEUED" && queuedForMs > 15_000;
                    return (
                      <div
                        className="row-card flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 min-w-0 w-full"
                        key={job.id}
                      >
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                          <strong className="truncate">
                            Flow draft generation
                          </strong>
                          <small className="break-words">
                            Server job {job.id.slice(0, 8)} · attempt{" "}
                            {job.attempts + 1} of {job.maxAttempts}
                          </small>
                          {delayed ? (
                            <small className="break-words">
                              This is taking longer than expected. The
                              generation worker may be unavailable; cancel it
                              and try again after the worker is healthy.
                            </small>
                          ) : null}
                        </div>
                        <div className="shrink-0 self-start sm:self-auto flex items-center gap-2">
                          <Status>{job.status}</Status>
                          {job.status === "QUEUED" ? (
                            <button
                              className="button danger"
                              disabled={busy || cancellingDraftJobId === job.id}
                              onClick={() => void cancelGeneration(job.id)}
                            >
                              <CircleStop size={14} />
                              {cancellingDraftJobId === job.id
                                ? "Cancelling…"
                                : "Cancel generation"}
                            </button>
                          ) : (
                            <small>
                              Generation has started and can no longer be
                              cancelled.
                            </small>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {batch.length ? (
                <div className="stack compact flex flex-col gap-2.5 w-full">
                  {batch.map((item) => (
                    <div
                      className="row-card flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 min-w-0 w-full"
                      key={`${item.filename}:${item.jobId ?? "local"}`}
                    >
                      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                        <strong className="truncate" title={item.filename}>
                          {item.filename}
                        </strong>
                        <small className="break-words">
                          {item.errorMessageSafe ??
                            (item.versionId
                              ? "Evidence ready"
                              : "Derived evidence only; raw bytes remain local")}
                        </small>
                      </div>
                      <div className="shrink-0 self-start sm:self-auto">
                        <Status>
                          {item.versionId ? "READY" : item.status}
                        </Status>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {stage === "FAILED" ? (
                <div className="review-actions flex flex-wrap items-center gap-2.5 sm:gap-3 pt-2">
                  <button
                    className="button flex-1 sm:flex-none justify-center"
                    onClick={checkAgain}
                  >
                    <RefreshCw size={15} /> Check again
                  </button>
                  <button
                    className="button flex-1 sm:flex-none justify-center"
                    onClick={() => void uploadAndGenerate()}
                  >
                    Retry upload
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}
          {processingDocuments.length && stage === "IDLE" ? (
            <div className="context-banner">
              {processingDocuments.length} document(s) are still processing.
              This page refreshes when focused; Sources shows the full library.
            </div>
          ) : null}
          {drafts.length ? (
            <section className="content-card flex flex-col gap-4 w-full overflow-hidden">
              <div className="card-heading flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
                <div className="min-w-0 flex-1">
                  <small>Review queue</small>
                  <h2 className="break-words">Inferred intent drafts</h2>
                </div>
                <div className="shrink-0 self-start sm:self-auto">
                  <Status>
                    {
                      drafts.filter(
                        (draft) => draft.status === "PENDING_REVIEW",
                      ).length
                    }{" "}
                    pending
                  </Status>
                </div>
              </div>
              {draftManagementMessage ? (
                <div className="context-banner" role="status">
                  <span>{draftManagementMessage}</span>
                  {confirmingDraftId ? (
                    <button
                      className="button"
                      onClick={() => {
                        setConfirmingDraftId(null);
                        setDraftManagementMessage(null);
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="stack compact flex flex-col gap-2.5 w-full">
                {drafts.map((draft) => {
                  const draftName =
                    (draft.draftJson as any)?.workflows?.[0]?.name ??
                    "Document-derived intent";
                  const deletable = [
                    "PENDING_REVIEW",
                    "REJECTED",
                    "EXPIRED",
                  ].includes(draft.status);
                  return (
                    <div
                      className="row-card draft-link flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 min-w-0 w-full"
                      key={draft.id}
                    >
                      <Link
                        className="min-w-0 flex-1 flex flex-col gap-0.5 text-inherit hover:no-underline"
                        to={`/projects/${projectId}/intent/drafts/${draft.id}`}
                      >
                        <strong className="truncate" title={draftName}>
                          {draftName}
                        </strong>
                        <small className="break-words">
                          {draft.source} · {Math.round(draft.confidence * 100)}%
                          confidence
                        </small>
                      </Link>
                      <div className="shrink-0 self-start sm:self-auto flex items-center gap-2">
                        <Status>{draft.status}</Status>
                        {deletable ? (
                          <button
                            className={`button ${confirmingDraftId === draft.id ? "danger" : ""}`}
                            disabled={busy}
                            onClick={() => void removeDraft(draft)}
                            aria-label={`${confirmingDraftId === draft.id ? "Confirm deletion of" : "Delete"} ${draftName}`}
                          >
                            <Trash2 size={14} />
                            {confirmingDraftId === draft.id
                              ? "Confirm delete"
                              : "Delete"}
                          </button>
                        ) : (
                          <small title="Accepted drafts are retained as evidence for immutable graph versions.">
                            Retained as graph evidence
                          </small>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
          {flows.length ? (
            <section className="content-card flex flex-col gap-4 w-full overflow-hidden">
              <div className="card-heading flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
                <div className="min-w-0 flex-1">
                  <small>Graph truth</small>
                  <h2 className="break-words">Declared system flows</h2>
                </div>
              </div>
              <div className="stack compact flex flex-col gap-2.5 w-full">
                {flows.map((flow) => (
                  <Link
                    className="row-card draft-link flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 min-w-0 w-full hover:no-underline"
                    key={flow.id}
                    to={`/projects/${projectId}/intent/flows/${flow.id}`}
                    aria-label={`${flow.status === "DRAFT" ? "Open and edit" : "View"} ${flow.name}`}
                  >
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <strong className="truncate" title={flow.name}>
                        {flow.name}
                      </strong>
                      <small className="break-words">
                        {flow.status === "DRAFT"
                          ? "Draft flow · Open to add states and transitions"
                          : "Declared behavior · Open to view or reopen"}
                      </small>
                    </div>
                    <div className="source-status shrink-0 flex items-center gap-2.5 self-start sm:self-auto flex-wrap sm:flex-nowrap">
                      <Status>{flow.status}</Status>
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-400 whitespace-nowrap">
                        <Pencil size={13} />{" "}
                        {flow.status === "DRAFT"
                          ? "Open and edit"
                          : "View flow"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {!documents.length &&
          !drafts.length &&
          !flows.length &&
          stage === "IDLE" ? (
            <EmptyState
              icon={<Workflow size={36} />}
              title="No expected intent yet"
              description="Add product documents, process their derived evidence, then generate a reviewable flow draft."
              action={
                <button
                  className="button primary"
                  onClick={() => void uploadAndGenerate()}
                >
                  Upload documents
                </button>
              }
            />
          ) : null}
          {documents.length &&
          !drafts.length &&
          !flows.length &&
          stage === "IDLE" ? (
            <div className="context-banner">
              {readyDocuments.length
                ? `${readyDocuments.length} document(s) are ready for flow generation.`
                : "Your documents are queued or processing. Open Sources for detailed status."}
            </div>
          ) : null}
        </div>
      )}
    </Page>
  );
}

export function IntentDetailPage() {
  const { projectId, draftId } = useParams();
  const navigate = useNavigate();
  const {
    getIntentDraft,
    getIntentDraftJob,
    reviewIntentDraft,
    correctIntentDraft,
    busy,
  } = useDesktop();
  const [draft, setDraft] = useState<IntentDraft | null>(null);
  const [loading, setLoading] = useState(Boolean(draftId));
  const [correction, setCorrection] = useState("");
  const [correctionStatus, setCorrectionStatus] = useState<string | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [parentDraft, setParentDraft] = useState<IntentDraft | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [editedWorkflows, setEditedWorkflows] = useState<any[]>([]);
  const [editingWorkflow, setEditingWorkflow] = useState<string | null>(null);
  useEffect(() => {
    if (!projectId || !draftId) return;
    setLoading(true);
    void getIntentDraft(projectId, draftId)
      .then(setDraft)
      .finally(() => setLoading(false));
  }, [draftId, getIntentDraft, projectId]);
  useEffect(() => {
    const parentDraftId = (draft?.sourceManifest as any)?.parentDraftId;
    if (!projectId || !parentDraftId) {
      setParentDraft(null);
      return;
    }
    let cancelled = false;
    void getIntentDraft(projectId, parentDraftId)
      .then((value) => {
        if (!cancelled) setParentDraft(value);
      })
      .catch(() => {
        if (!cancelled) setParentDraft(null);
      });
    return () => {
      cancelled = true;
    };
  }, [draft, getIntentDraft, projectId]);
  useEffect(() => {
    const next = (draft?.draftJson as any)?.workflows;
    setEditedWorkflows(Array.isArray(next) ? structuredClone(next) : []);
  }, [draft]);
  if (!projectId) return <ProjectRequired />;
  if (!draftId)
    return (
      <GuardedFeaturePage
        title="Intent versions"
        description="Accepted graph version history."
        phase="Select an accepted graph from Intent."
        fallback="Version comparison remains cloud-authoritative."
      />
    );
  if (loading) return <LoadingState />;
  if (!draft)
    return (
      <NotFoundPage
        title="Intent draft unavailable"
        description="The draft may have been removed or belongs to another project."
      />
    );
  const draftJson = draft.draftJson as any;
  const workflows = editedWorkflows;
  const allConflicts = Array.isArray((draft.sourceManifest as any)?.conflicts)
    ? (draft.sourceManifest as any).conflicts
    : [];
  const conflicts = allConflicts.filter(
    (conflict: any) =>
      conflict?.blocking === true &&
      conflict?.severity === "HIGH" &&
      Array.isArray(conflict?.sources) &&
      conflict.sources.length > 1,
  );
  const manifestDocumentNames = Array.isArray(
    (draft.sourceManifest as any)?.documentNames,
  )
    ? (draft.sourceManifest as any).documentNames
    : [];
  const documentNames = [
    ...new Set([
      ...manifestDocumentNames,
      ...(draft.evidence ?? []).flatMap((item: any) =>
        item?.sourceDocument?.filename ? [item.sourceDocument.filename] : [],
      ),
    ]),
  ];
  const accept = async () => {
    await reviewIntentDraft(projectId, draft.id, {
      action: "ACCEPT",
      conflictResolutions: resolutions,
      editedWorkflows: workflows,
    });
    navigate(`/projects/${projectId}/intent`);
  };
  const reject = async () => {
    await reviewIntentDraft(projectId, draft.id, { action: "REJECT" });
    navigate(`/projects/${projectId}/intent`);
  };
  const correct = async () => {
    const requestedChange = correction.trim();
    if (!requestedChange || isCorrecting) return;
    try {
      setIsCorrecting(true);
      setCorrectionStatus("Submitting your requested change…");
      const created = await correctIntentDraft(
        projectId,
        draft.id,
        requestedChange,
      );
      const startedAt = Date.now();
      while (Date.now() - startedAt < JOB_POLL_TIMEOUT_MS) {
        const job = await getIntentDraftJob(projectId, created.jobId);
        setCorrectionStatus(
          job.status === "QUEUED"
            ? "Your revision is queued and will start shortly…"
            : `Updating the flows from your suggestion · attempt ${job.attempts + 1} of ${job.maxAttempts}…`,
        );
        if (job.status === "COMPLETED" && job.draftId) {
          setCorrectionStatus("Revision complete. Opening the updated draft…");
          setCorrection("");
          navigate(`/projects/${projectId}/intent/drafts/${job.draftId}`);
          return;
        }
        if (job.status === "FAILED" || job.status === "CANCELLED")
          throw new Error(
            job.errorMessageSafe ?? "Corrected draft generation failed.",
          );
        await delay(JOB_POLL_INTERVAL_MS);
      }
      setCorrectionStatus(
        "Correction is still processing. Return to Intent and check again.",
      );
    } catch (error) {
      setCorrectionStatus(intentErrorMessage(error));
    } finally {
      setIsCorrecting(false);
    }
  };
  const correctionRequest = (draft.sourceManifest as any)?.correctionRequest as
    | string
    | undefined;
  const revisionChanges = summarizeDraftRevision(parentDraft, draft);
  return (
    <Page
      title="Review generated system flows"
      description={`Tellann found ${workflows.length} user ${workflows.length === 1 ? "journey" : "journeys"}${documentNames.length ? ` from ${documentNames.map((name) => `“${name}”`).join(", ")}` : " from your approved project evidence"}. Review ${workflows.length === 1 ? "it" : "them"} before using ${workflows.length === 1 ? "it" : "them"} in QA tests.`}
      actions={
        <Status>
          {draft.status === "PENDING_REVIEW"
            ? "READY FOR REVIEW"
            : draft.status}
        </Status>
      }
    >
      <div className="flow-review-shell">
        {correctionRequest ? (
          <section className="revision-summary" aria-live="polite">
            <div className="revision-summary-heading">
              <Check size={18} />
              <div>
                <small>Revision complete</small>
                <h2>Your suggestion was applied to this review draft</h2>
              </div>
            </div>
            <p>
              <strong>Your suggestion:</strong> “{correctionRequest}”
            </p>
            {revisionChanges.length ? (
              <ul>
                {revisionChanges.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            ) : (
              <p>
                Tellann regenerated the workflow behavior using your suggestion.
                Review the journeys below to confirm the result matches your
                intent.
              </p>
            )}
          </section>
        ) : null}
        {conflicts.length ? (
          <div className="review-attention">
            <AlertTriangle size={18} />
            <strong>
              {conflicts.length}{" "}
              {conflicts.length === 1 ? "question needs" : "questions need"}{" "}
              your attention
            </strong>
            <span>Answer before approval.</span>
          </div>
        ) : (
          <div className="review-ready">
            <Check size={18} />
            <strong>No questions need your attention</strong>
            <span>Review each journey, then approve when it looks right.</span>
          </div>
        )}

        <section className="review-section">
          <div className="review-section-heading">
            <div>
              <small>Expected journeys</small>
              <h2>Is this how your application should work?</h2>
            </div>
            <span>{workflows.length} total</span>
          </div>
          <div className="journey-list">
            {workflows.map((workflow: any, workflowIndex: number) => {
              const editing = editingWorkflow === workflow.key;
              return (
                <article className="journey-card" key={workflow.key}>
                  <div className="journey-card-heading">
                    <div>
                      <span>Journey {workflowIndex + 1}</span>
                      {editing ? (
                        <input
                          aria-label="Journey name"
                          value={workflow.name}
                          onChange={(event) =>
                            setEditedWorkflows((current) =>
                              current.map((item) =>
                                item.key === workflow.key
                                  ? { ...item, name: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      ) : (
                        <h3>{workflow.name}</h3>
                      )}
                      <small>
                        {workflow.states?.length ?? 0} expected steps
                      </small>
                    </div>
                    <div className="journey-card-actions">
                      <Status>
                        {conflicts.some((conflict: any) =>
                          conflict.evidenceIds?.some((id: string) =>
                            workflow.evidenceIds?.includes(id),
                          ),
                        )
                          ? "NEEDS ATTENTION"
                          : "LOOKS READY"}
                      </Status>
                      <button
                        className="button"
                        onClick={() =>
                          setEditingWorkflow(editing ? null : workflow.key)
                        }
                      >
                        <Pencil size={14} />
                        {editing ? "Done editing" : "Edit"}
                      </button>
                    </div>
                  </div>
                  {workflow.description ? <p>{workflow.description}</p> : null}
                  <ol className="journey-steps">
                    {(workflow.states ?? []).map(
                      (state: any, stateIndex: number) => (
                        <li key={state.key ?? state.name}>
                          <span>{stateIndex + 1}</span>
                          {editing ? (
                            <input
                              aria-label={`Step ${stateIndex + 1}`}
                              value={state.name}
                              onChange={(event) =>
                                setEditedWorkflows((current) =>
                                  current.map((item) =>
                                    item.key !== workflow.key
                                      ? item
                                      : {
                                          ...item,
                                          states: item.states.map(
                                            (candidate: any, index: number) =>
                                              index === stateIndex
                                                ? {
                                                    ...candidate,
                                                    name: event.target.value,
                                                  }
                                                : candidate,
                                          ),
                                        },
                                  ),
                                )
                              }
                            />
                          ) : (
                            <strong>{humanizeFlowLabel(state.name)}</strong>
                          )}
                        </li>
                      ),
                    )}
                  </ol>
                  {editing ? (
                    <button
                      className="button danger journey-remove"
                      onClick={() => {
                        setEditedWorkflows((current) =>
                          current.filter((item) => item.key !== workflow.key),
                        );
                        setEditingWorkflow(null);
                      }}
                    >
                      Remove this journey
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        {conflicts.length ? (
          <section className="review-section questions-section">
            <div className="review-section-heading">
              <div>
                <small>Required decisions</small>
                <h2>Questions needing your input</h2>
              </div>
            </div>
            {conflicts.map((conflict: any, index: number) => (
              <article className="decision-card" key={conflict.key}>
                <span>Question {index + 1}</span>
                <h3>{conflict.question ?? conflict.description}</h3>
                <p>
                  Choose the statement that matches the behavior you expect.
                </p>
                <div className="decision-options">
                  {conflict.sources.map((source: any, sourceIndex: number) => (
                    <button
                      className={
                        resolutions[conflict.key] === `SOURCE_${sourceIndex}`
                          ? "selected"
                          : ""
                      }
                      key={source.evidenceId}
                      onClick={() =>
                        setResolutions((current) => ({
                          ...current,
                          [conflict.key]: `SOURCE_${sourceIndex}`,
                        }))
                      }
                    >
                      <strong>
                        {sourceIndex === 0
                          ? "Use the first statement"
                          : "Use the second statement"}
                      </strong>
                      <span>“{source.excerpt}”</span>
                      <small>
                        {source.filename}
                        {source.locator ? ` · ${source.locator}` : ""}
                      </small>
                    </button>
                  ))}
                  <button
                    className={
                      resolutions[conflict.key] === "BOTH" ? "selected" : ""
                    }
                    onClick={() =>
                      setResolutions((current) => ({
                        ...current,
                        [conflict.key]: "BOTH",
                      }))
                    }
                  >
                    <strong>Both apply</strong>
                    <span>
                      Both behaviors are valid in different situations.
                    </span>
                  </button>
                </div>
                <label>
                  <span>Or describe another behavior</span>
                  <textarea
                    value={
                      !resolutions[conflict.key]?.startsWith("SOURCE_") &&
                      resolutions[conflict.key] !== "BOTH"
                        ? (resolutions[conflict.key] ?? "")
                        : ""
                    }
                    onChange={(event) =>
                      setResolutions((current) => ({
                        ...current,
                        [conflict.key]: event.target.value,
                      }))
                    }
                    placeholder="Describe what should happen in plain language"
                  />
                </label>
              </article>
            ))}
          </section>
        ) : null}

        <AccordionItem value="generation-details" className="my-4">
          <AccordionTrigger>
            <div className="flex flex-col text-left">
              <strong className="text-white font-semibold">
                Documents and generation details
              </strong>
              <small className="text-xs text-[#8e9192]">
                See the evidence and technical information used for this draft.
              </small>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="detail-list">
              <div>
                <dt>Documents</dt>
                <dd>
                  {documentNames.join(", ") || "Approved project evidence"}
                </dd>
              </div>
              <div>
                <dt>Generation method</dt>
                <dd>{draft.source.replaceAll("_", " ").toLowerCase()}</dd>
              </div>
              <div>
                <dt>Overall confidence</dt>
                <dd>{Math.round(draft.confidence * 100)}%</dd>
              </div>
              <div>
                <dt>Evidence excerpts</dt>
                <dd>
                  {draft.evidence?.length ??
                    (draft.sourceManifest as any)?.evidenceIds?.length ??
                    0}
                </dd>
              </div>
            </dl>
          </AccordionContent>
        </AccordionItem>

        <section className="change-request-card">
          <div>
            <h2>Describe a change</h2>
            <p>
              Tell Tellann what to add, remove, or correct. You will review the
              revised flows before anything is saved.
            </p>
          </div>
          <div>
            <textarea
              className="w-full min-h-[96px] p-3 bg-black border border-[#262626] rounded text-white text-xs placeholder:text-[#555555] focus:outline-none focus:border-white transition-colors"
              value={correction}
              disabled={isCorrecting}
              onChange={(event) => setCorrection(event.target.value)}
              placeholder="For example: Require sign-in before checkout, and add an order cancellation journey."
            />
            <div className="flex items-center justify-between gap-3">
              {correctionStatus ? (
                <small
                  className="text-[#8e9192] font-mono text-[11px]"
                  role="status"
                >
                  {correctionStatus}
                </small>
              ) : (
                <span />
              )}
              <button
                className="button primary"
                disabled={
                  busy ||
                  isCorrecting ||
                  !correction.trim() ||
                  draft.status !== "PENDING_REVIEW"
                }
                onClick={() => void correct()}
              >
                {isCorrecting ? (
                  <>
                    <RefreshCw className="spin" size={15} /> Updating draft…
                  </>
                ) : (
                  "Apply suggestion to draft"
                )}
              </button>
            </div>
          </div>
        </section>

        <section className="review-footer">
          <div>
            <strong>Ready to use these journeys?</strong>
            <span>
              Approval saves them as the expected behavior for future QA runs.
              It does not change your application.
            </span>
          </div>
          <div className="review-actions">
            <button
              className="button primary"
              disabled={
                busy ||
                draft.status !== "PENDING_REVIEW" ||
                conflicts.some(
                  (conflict: any) => !resolutions[conflict.key]?.trim(),
                )
              }
              onClick={() => void accept()}
            >
              <Check size={15} />
              Approve and use these flows
            </button>
            <button
              className="button danger"
              disabled={busy || draft.status !== "PENDING_REVIEW"}
              onClick={() => void reject()}
            >
              Discard draft
            </button>
          </div>
          {conflicts.some(
            (conflict: any) => !resolutions[conflict.key]?.trim(),
          ) ? (
            <small className="approval-blocker">
              Answer every required question before approval.
            </small>
          ) : null}
        </section>
      </div>
    </Page>
  );
}

function FlowReviewPanel({
  initialization,
}: {
  initialization: FlowInitialization;
}) {
  const report = initialization.codeReviewReport;
  if (!report) return <LoadingState />;
  const groups = [
    ["Missing states", report.missingStates],
    ["Incomplete transitions", report.incompleteTransitions],
    ["Edge cases", report.edgeCases],
    ["Terminal outcomes", report.uncoveredTerminalOutcomes],
  ] as const;
  return (
    <section className="content-card flow-review-panel">
      <div className="card-heading">
        <div>
          <small>First code review</small>
          <h2>Declared intent against the repository</h2>
        </div>
        <Status>{report.engine.replace("_", " ")}</Status>
      </div>
      <div className="flow-review-metrics">
        <Metric
          label="States mapped"
          value={`${report.summary.mappedStates}/${report.summary.totalStates}`}
        />
        <Metric
          label="Transitions mapped"
          value={`${report.summary.mappedTransitions}/${report.summary.totalTransitions}`}
        />
        <Metric
          label="Terminals"
          value={String(initialization.manifest?.terminalStateIds.length ?? 0)}
        />
      </div>
      <div className="flow-review-findings">
        {groups.map(([title, findings]) => (
          <article key={title}>
            <strong>{title}</strong>
            <span>{findings.length}</span>
            <p>
              {findings.length
                ? "Review the evidence before choosing an initialization path."
                : "No blocking finding detected."}
            </p>
          </article>
        ))}
      </div>
      <AccordionItem value="flow-review-evidence">
        <AccordionTrigger>Review evidence and recommendations</AccordionTrigger>
        <AccordionContent>
          <div className="stack">
            {report.recommendations.length ? (
              report.recommendations.map((item: any, index: number) => (
                <div
                  className="muted-callout"
                  key={`${item.checkpointId ?? "recommendation"}-${index}`}
                >
                  <strong>{String(item.action ?? "Review mapping")}</strong>
                  <p>
                    {String(item.mapping?.file ?? "No confident file mapping")}{" "}
                    {item.mapping?.symbol ? `· ${item.mapping.symbol}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="muted">
                No remediation is required by the static review.
              </p>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </section>
  );
}

function FlowRoadmap({
  roadmap,
  verification,
  busy,
  onToggle,
  onVerify,
}: {
  roadmap: ManualRoadmap;
  verification: any;
  busy: boolean;
  onToggle(stepId: string, completed: boolean): void;
  onVerify(): void;
}) {
  return (
    <section className="content-card flow-roadmap-shell">
      <div className="card-heading">
        <div>
          <small>Manual initialization · revision {roadmap.revision}</small>
          <h2>Build the declared path into your project</h2>
        </div>
        <Status>
          {String(verification?.status ?? "ROADMAP READY").replaceAll("_", " ")}
        </Status>
      </div>
      <p className="muted">
        Checklist progress helps you resume. Only live, ordered checkpoint
        telemetry verifies this Flow.
      </p>
      <div className="flow-roadmap" aria-label="Flow initialization roadmap">
        {roadmap.groups.map((group) => {
          const steps = roadmap.steps.filter(
            (step) => step.groupId === group.id,
          );
          if (!steps.length) return null;
          return (
            <section
              className={`flow-roadmap-lane ${group.id === "spine" ? "is-spine" : "is-branch"}`}
              key={group.id}
            >
              <header>{group.title}</header>
              <div className="flow-roadmap-track">
                {steps.map((step) => {
                  const completed = ["DONE", "VERIFIED"].includes(step.status);
                  return (
                    <article
                      className={`flow-roadmap-step is-${step.status.toLowerCase()}`}
                      key={step.id}
                    >
                      <span className="flow-roadmap-node" aria-hidden="true">
                        {step.status === "VERIFIED" ? (
                          <Check size={13} />
                        ) : step.status === "BLOCKED" ? (
                          <Lock size={12} />
                        ) : null}
                      </span>
                      <div>
                        <small>{step.kind.replace("_", " ")}</small>
                        <h3>{step.title}</h3>
                        <p>{step.description}</p>
                        {step.file ? (
                          <code>
                            {step.file}
                            {step.symbol ? ` · ${step.symbol}` : ""}
                          </code>
                        ) : null}
                        {step.snippet ? (
                          <pre className="code-block">{step.snippet}</pre>
                        ) : null}
                        {step.status !== "VERIFIED" &&
                        step.kind !== "VERIFY" ? (
                          <label className="check-row">
                            <input
                              type="checkbox"
                              checked={completed}
                              disabled={busy || step.status === "BLOCKED"}
                              onChange={(event) =>
                                onToggle(step.id, event.target.checked)
                              }
                            />
                            <span>
                              <strong>I added this checkpoint</strong>
                            </span>
                          </label>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <div className="card-actions">
        <button
          className="button primary"
          disabled={busy || verification?.status === "COMPLETED"}
          onClick={onVerify}
        >
          <Play size={15} />
          {verification?.startedAt
            ? "Restart verification"
            : "Start telemetry verification"}
        </button>
      </div>
      {verification?.missingCheckpointIds?.length ? (
        <p className="muted-callout">
          Still unobserved: {verification.missingCheckpointIds.join(", ")}
        </p>
      ) : null}
    </section>
  );
}

function CopyableCodeBlock({
  label,
  code,
}: {
  label: ReactNode;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!code) return;
    try {
      if (typeof window.tellann?.system?.copyText === "function") {
        await window.tellann.system.copyText(code);
      } else {
        await navigator.clipboard.writeText(code);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Fallback if clipboard API fails
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <small>{label}</small>
        <button
          type="button"
          className="button"
          onClick={() => void handleCopy()}
          style={{
            padding: "3px 8px",
            fontSize: "11px",
            height: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: copied ? "rgba(34, 197, 94, 0.15)" : undefined,
            color: copied ? "#4ade80" : undefined,
            borderColor: copied ? "#22c55e" : undefined,
            transition: "all 0.15s ease",
            cursor: "pointer",
          }}
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check size={12} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={12} />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="code-block" style={{ margin: 0 }}>
        {code}
      </pre>
    </div>
  );
}

function formatSdkSetupTarget(
  target: any,
  workspace: any,
  detections: InstrumentationDetection[],
  applicationId: string,
  environmentId: string,
  gatewayEndpoint?: string,
) {
  const isFrontend = target.kind === "FRONTEND" || target.id === "frontend";
  const detectedFrameworkNames = (workspace?.snapshot?.frameworks ?? []).map(
    (framework: any) =>
      String(
        framework.framework ?? framework.name ?? framework.id ?? "",
      ).toLowerCase(),
  );
  const detectedAdapterIds = (detections ?? []).map((d) =>
    String(d.adapterId ?? "").toLowerCase(),
  );

  const hasFramework = (name: string) =>
    detectedFrameworkNames.some((framework: string) =>
      framework.includes(name),
    ) || detectedAdapterIds.some((adapter: string) => adapter.includes(name));

  const isNextJs = hasFramework("next");

  const isReact = hasFramework("react");
  const isVite = hasFramework("vite");
  const isReactVite = isReact && isVite;

  const rawWorkspacePath = workspace?.path ?? workspace?.root ?? "";
  const workspaceName =
    workspace?.name ??
    (rawWorkspacePath ? rawWorkspacePath.split(/[/\\]/).pop() : "");

  const packageName =
    target.packageName ??
    (isFrontend ? "@sots/frontend-sdk" : "@sots/backend-sdk");

  const detectedPackageManager = String(
    workspace?.snapshot?.packageManager ?? "npm",
  ).toLowerCase();
  const packageManager = ["npm", "pnpm", "yarn", "bun"].includes(
    detectedPackageManager,
  )
    ? detectedPackageManager
    : "npm";
  const installCommand =
    target.installCommands?.[packageManager] ??
    target.installCommands?.npm ??
    `${packageManager} ${packageManager === "npm" ? "install" : "add"} ${packageName}`;

  let stackLabel = isFrontend ? "Browser Application" : "Node.js Server";
  if (isFrontend) {
    if (isNextJs) stackLabel = "Next.js (App / Pages Router)";
    else if (isReactVite) stackLabel = "React + Vite";
    else if (isReact) stackLabel = "React";
    else if (isVite) stackLabel = "Vite";
  }

  const endpointStr = gatewayEndpoint ?? "http://localhost:3000";

  let snippet = String(target.snippet ?? "");

  if (isFrontend) {
    if (isVite && !isNextJs) {
      snippet = `import { SOTS } from '${packageName}';

// IMPORTANT: Initialize at top-level file scope (e.g. in main.tsx or top of App.tsx OUTSIDE React components)
SOTS.initialize({
    endpoint: import.meta.env.VITE_TELLANN_GATEWAY_URL || '${endpointStr}',
    apiKey: import.meta.env.VITE_TELLANN_INGESTION_KEY,
    applicationId: '${applicationId}',
    environmentId: '${environmentId}'
});

void SOTS.verifyInstallation();`;
    } else if (isReact && !isNextJs) {
      snippet = `import { SOTS } from '${packageName}';

// IMPORTANT: Initialize at top-level file scope (e.g. in index.tsx or top of App.tsx OUTSIDE React components)
SOTS.initialize({
    endpoint: process.env.REACT_APP_TELLANN_GATEWAY_URL || '${endpointStr}',
    apiKey: process.env.REACT_APP_TELLANN_INGESTION_KEY,
    applicationId: '${applicationId}',
    environmentId: '${environmentId}'
});

void SOTS.verifyInstallation();`;
    } else if (isNextJs) {
      snippet = `import { SOTS } from '${packageName}';

// Initialize Tellann browser telemetry for Next.js (e.g. in app/layout.tsx or _app.tsx)
SOTS.initialize({
    endpoint: process.env.NEXT_PUBLIC_TELLANN_GATEWAY_URL || '${endpointStr}',
    apiKey: process.env.NEXT_PUBLIC_TELLANN_INGESTION_KEY,
    applicationId: '${applicationId}',
    environmentId: '${environmentId}'
});

void SOTS.verifyInstallation();`;
    }
  }

  return {
    stackLabel,
    installCommand,
    snippet,
    packageManager,
    workspaceName: workspaceName !== "monitor" ? workspaceName : "",
  };
}

export function InstrumentationPage() {
  const {
    projectId,
    application,
    workspace,
    attachWorkspace,
    busy,
    detectInstrumentation,
    proposeInstrumentation,
    listInstrumentationPlans,
    approveInstrumentation,
    applyInstrumentation,
    initializeFlow,
    getFlowInitialization,
    analyzeFlowInitialization,
    setFlowInitializationMode,
    updateFlowRoadmapStep,
    startFlowVerification,
    getFlowVerification,
  } = useProject();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setupMode = searchParams.get("setup") === "connect";
  const flowId = searchParams.get("flowId") ?? undefined;
  const flowVersionId = searchParams.get("flowVersionId") ?? undefined;
  const initializationId = searchParams.get("initializationId") ?? undefined;
  const requestedEnvironmentId = searchParams.get("environmentId");
  const editableEnvironments =
    application?.environments.filter((item) => item.type !== "PRODUCTION") ??
    [];
  const [environmentId, setEnvironmentId] = useState(
    requestedEnvironmentId ??
      editableEnvironments[0]?.id ??
      application?.environments[0]?.id ??
      "",
  );
  const environment = application?.environments.find(
    (item) => item.id === environmentId,
  );
  const instrumentationEntitled =
    application?.entitlements?.features.AUTOMATED_INSTRUMENTATION === true;
  const [detections, setDetections] = useState<InstrumentationDetection[]>([]);
  const [selectedAdapters, setSelectedAdapters] = useState<
    InstrumentationDetection["adapterId"][]
  >([]);
  const [plans, setPlans] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [entitlementModalOpen, setEntitlementModalOpen] = useState(false);
  const [manualSetupOpen, setManualSetupOpen] = useState(false);
  const [manualSetup, setManualSetup] = useState<Record<string, any> | null>(
    null,
  );
  const [manualTargetId, setManualTargetId] = useState("frontend");
  const [manualRawKey, setManualRawKey] = useState<string | null>(null);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [proposalMessage, setProposalMessage] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [flowInitialization, setFlowInitialization] =
    useState<FlowInitialization | null>(null);
  const [flowLoadError, setFlowLoadError] = useState<string | null>(null);

  const refreshPlans = async () => {
    if (!projectId) return;
    setPlans(await listInstrumentationPlans(projectId));
  };

  useEffect(() => {
    if (!projectId) return;
    void refreshPlans().finally(() => setLoading(false));
  }, [projectId]);

  const refreshFlowInitialization = useCallback(async () => {
    if (!initializationId) return;
    const value = await getFlowInitialization(initializationId);
    setFlowInitialization(value as FlowInitialization);
  }, [getFlowInitialization, initializationId]);

  useEffect(() => {
    if (!initializationId) return;
    void refreshFlowInitialization().catch((cause) =>
      setFlowLoadError(
        cause instanceof Error ? cause.message : "Initialization unavailable.",
      ),
    );
  }, [initializationId, refreshFlowInitialization]);

  useEffect(() => {
    if (flowInitialization?.stage !== "SCANNING") return;
    const timer = window.setInterval(
      () => void refreshFlowInitialization().catch(() => undefined),
      document.hidden ? 10_000 : 2_000,
    );
    return () => window.clearInterval(timer);
  }, [flowInitialization?.stage, refreshFlowInitialization]);

  useEffect(() => {
    if (!projectId || !environmentId || !window.tellann) return;
    const refreshSetup = () =>
      void window.tellann?.setup
        .getSdkSetup(projectId, environmentId)
        .then(setManualSetup)
        .catch(() => setManualSetup(null));
    refreshSetup();
    if (
      (!manualSetupOpen && !flowId) ||
      (manualSetup?.readiness as any)?.connected
    )
      return;
    const timer = window.setInterval(
      refreshSetup,
      document.hidden ? 15_000 : 3_000,
    );
    return () => window.clearInterval(timer);
  }, [
    environmentId,
    flowId,
    manualSetup?.readiness,
    manualSetupOpen,
    projectId,
  ]);

  if (!projectId) return <ProjectRequired />;
  if (!application)
    return (
      <NotFoundPage
        title="Project unavailable"
        description="Select another project."
      />
    );

  const detect = async () => {
    if (!environment) return;
    const result = await detectInstrumentation({
      applicationId: projectId,
      environmentId: environment.id,
      environmentType: environment.type,
      instrumentationPurpose: flowId ? "FLOW" : "BOOTSTRAP",
      flowId,
      flowVersionId,
      flowInitializationId: initializationId,
    });
    setDetections(result.detections);
    const supported = result.detections.filter((item) => item.supported);
    const frontend = supported.find((item) =>
      ["react-vite", "nextjs"].includes(item.adapterId),
    );
    setSelectedAdapters(
      frontend
        ? [frontend.adapterId]
        : supported.slice(0, 1).map((item) => item.adapterId),
    );
  };

  const proposeSelected = async () => {
    setCreatingProposal(true);
    setProposalMessage(null);
    setProposalError(null);
    try {
      const records: Record<string, unknown>[] = [];
      for (const adapterId of selectedAdapters) {
        const record = await propose(adapterId);
        if (record) records.push(record);
      }
      await refreshPlans();
      if (records.length === 1) {
        const record = records[0];
        const returnedPlanId = String(record.id ?? "");
        if (!returnedPlanId)
          throw new Error("The setup task was created without an identifier.");
        setProposalMessage(
          String(record.status) === "PROPOSED"
            ? "Setup task created. Opening its review now."
            : `This setup already has a ${String(record.status).toLowerCase().replaceAll("_", " ")} task. Opening it now.`,
        );
        navigate(
          `/projects/${projectId}/instrumentation/plans/${returnedPlanId}${initializationId ? `?initializationId=${encodeURIComponent(initializationId)}` : ""}`,
        );
        return;
      }
      setProposalMessage(
        `${records.length} setup tasks are ready for review below.`,
      );
    } catch (cause) {
      setProposalError(
        cause instanceof Error
          ? cause.message
          : "Tellann could not create the setup task.",
      );
    } finally {
      setCreatingProposal(false);
    }
  };
  const visiblePlans = flowId
    ? plans.filter(
        (record) =>
          String(record.flowId ?? (record.planJson as any)?.flowId ?? "") ===
            flowId &&
          String(
            record.flowVersionId ??
              (record.planJson as any)?.flowVersionId ??
              "",
          ) === flowVersionId,
      )
    : plans.filter(
        (record) =>
          String(
            record.purpose ??
              (record.planJson as any)?.instrumentationPurpose ??
              "BOOTSTRAP",
          ) === "BOOTSTRAP",
      );
  const proposedPlans = visiblePlans.filter(
    (plan) => String(plan.status) === "PROPOSED",
  );
  const applyReviewedSetup = async () => {
    if (!environment) return;
    for (const record of proposedPlans) {
      const plan = record.planJson as InstrumentationPlan;
      await approveInstrumentation({
        applicationId: projectId,
        environmentId: environment.id,
        environmentType: environment.type,
        planId: String(record.id),
        approvedFileScopes: plan.approvedFileScopes,
        approvedCommandIds: plan.validationCommands.map(
          (command) => command.id,
        ),
      });
      await applyInstrumentation(projectId, String(record.id));
    }
    await refreshPlans();
  };

  const propose = async (adapterId: InstrumentationDetection["adapterId"]) => {
    if (!environment) return;
    return proposeInstrumentation({
      applicationId: projectId,
      environmentId: environment.id,
      environmentType: environment.type,
      adapterId,
      instrumentationPurpose: flowId ? "FLOW" : "BOOTSTRAP",
      flowId,
      flowVersionId,
      flowInitializationId: initializationId,
    });
  };

  const continueFlowInitialization = async () => {
    if (!flowId || !flowVersionId || !environmentId) return;
    const created = await initializeFlow({
      flowId,
      applicationId: projectId,
      environmentId,
      flowVersionId,
    });
    const nextId = String((created.initialization as any)?.id ?? "");
    if (!nextId)
      throw new Error("Flow initialization was created without an identifier.");
    navigate(
      `/projects/${projectId}/instrumentation?flowId=${encodeURIComponent(flowId)}&flowVersionId=${encodeURIComponent(flowVersionId)}&initializationId=${encodeURIComponent(nextId)}&environmentId=${encodeURIComponent(environmentId)}`,
      { replace: true },
    );
  };

  const chooseInitializationMode = async (mode: "AUTOMATED" | "MANUAL") => {
    if (!initializationId) return;
    await setFlowInitializationMode(initializationId, mode);
    await refreshFlowInitialization();
  };

  const toggleRoadmapStep = async (stepId: string, completed: boolean) => {
    if (!initializationId) return;
    await updateFlowRoadmapStep(initializationId, stepId, completed);
    await refreshFlowInitialization();
  };

  const beginVerification = async () => {
    if (!initializationId) return;
    await startFlowVerification(initializationId);
    await refreshFlowInitialization();
  };

  useEffect(() => {
    if (!initializationId || flowInitialization?.stage !== "AWAITING_TELEMETRY")
      return;
    const poll = () =>
      void getFlowVerification(initializationId).then((result) => {
        if (result.roadmap)
          setFlowInitialization((current) =>
            current
              ? ({
                  ...current,
                  roadmap: result.roadmap,
                  manualRoadmap: result.roadmap,
                  verification: result.verification,
                  ...(result.verification?.status === "COMPLETED"
                    ? { stage: "COMPLETED", status: "COMPLETED" }
                    : {}),
                } as FlowInitialization)
              : current,
          );
      });
    poll();
    const timer = window.setInterval(poll, document.hidden ? 15_000 : 3_000);
    return () => window.clearInterval(timer);
  }, [flowInitialization?.stage, getFlowVerification, initializationId]);

  return (
    <Page
      title="Instrumentation"
      description="Detect the project stack, review a bounded task, and approve every file and command before Tellann writes."
    >
      {flowId && !(manualSetup?.readiness as any)?.connected ? (
        <section className="content-card flow-prerequisite mb-4 ">
          <div className="card-heading">
            <div>
              <small>Required before Flow initialization</small>
              <h2>Connect Tellann to this project</h2>
            </div>
            <Status>Waiting for telemetry</Status>
          </div>
          <p className="mb-4">
            Install and initialize a Tellann SDK, start this environment, and
            send <code>TELLANN_INITIALIZED</code> or{" "}
            <code>SOTS_ONBOARDING_TEST</code>. Finding package files alone does
            not unlock the Flow.
          </p>
          <div className="card-actions">
            <button
              className="button primary"
              disabled={busy || !workspace}
              onClick={() => void detect()}
            >
              <ShieldCheck size={15} />
              Set up automatically
            </button>
            <button className="button" onClick={() => setManualSetupOpen(true)}>
              <Code2 size={15} />
              Set up manually
            </button>
            <button
              className="button"
              onClick={() =>
                window.tellann?.setup
                  .getSdkSetup(projectId, environmentId)
                  .then(setManualSetup)
              }
            >
              <RefreshCw size={15} />
              Check connection
            </button>
          </div>
        </section>
      ) : null}
      {flowId &&
      (manualSetup?.readiness as any)?.connected &&
      !initializationId ? (
        <section className="content-card flow-prerequisite is-ready">
          <div className="card-heading">
            <div>
              <small>SDK verified</small>
              <h2>Tellann can now analyze this Flow</h2>
            </div>
            <Status>Connected</Status>
          </div>
          <p>
            Continue to create an immutable Flow-scoped repository review. No
            source files change during analysis.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void continueFlowInitialization().catch((cause) =>
                setFlowLoadError(String(cause?.message ?? cause)),
              )
            }
          >
            <ArrowRight size={15} />
            Analyze declared Flow
          </button>
        </section>
      ) : null}
      {flowLoadError ? (
        <div className="context-banner" role="alert">
          <AlertTriangle size={15} />
          {flowLoadError}
          {initializationId ? (
            <button
              className="button"
              onClick={() =>
                void analyzeFlowInitialization(initializationId).then(
                  refreshFlowInitialization,
                )
              }
            >
              Retry analysis
            </button>
          ) : null}
        </div>
      ) : null}
      {flowInitialization ? (
        <>
          <FlowReviewPanel initialization={flowInitialization} />
          {!flowInitialization.mode &&
          flowInitialization.stage === "REVIEW_READY" ? (
            <section className="content-card flow-mode-choice mt-4">
              <div className="card-heading">
                <div>
                  <small>Choose how to initialize</small>
                  <h2>Use the same checkpoint contract in either path</h2>
                </div>
                <Status>Review ready</Status>
              </div>
              <div className="two-column">
                <article className="mode-card">
                  <Status>All plans</Status>
                  <h2>Guide me manually</h2>
                  <p className="mb-4">
                    Follow a persisted code roadmap, make the changes yourself,
                    then prove the path with live telemetry.
                  </p>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => void chooseInitializationMode("MANUAL")}
                  >
                    <Workflow size={15} />
                    Open manual roadmap
                  </button>
                </article>
                <article className="mode-card featured">
                  <Status>
                    {instrumentationEntitled
                      ? "Available"
                      : "Solo plan and above"}
                  </Status>
                  <h2>Instrument automatically</h2>
                  <p>
                    Generate a bounded AST proposal from confident mappings,
                    approve every file, and keep rollback available.
                  </p>
                  <button
                    className="button primary"
                    disabled={busy || !instrumentationEntitled}
                    onClick={() => void chooseInitializationMode("AUTOMATED")}
                  >
                    <Sparkles size={15} />
                    Create automated proposal
                  </button>
                </article>
              </div>
            </section>
          ) : null}
          {flowInitialization.stage === "SCANNING" ? (
            <div className="context-banner">
              <Activity size={15} />
              Tellann is enriching the deterministic review. The evidence-backed
              fallback remains available if the AI provider cannot respond.
            </div>
          ) : null}
          {flowInitialization.mode === "MANUAL" &&
          flowInitialization.manualRoadmap ? (
            <FlowRoadmap
              roadmap={flowInitialization.manualRoadmap}
              verification={flowInitialization.verification}
              busy={busy}
              onToggle={(stepId, completed) =>
                void toggleRoadmapStep(stepId, completed)
              }
              onVerify={() => void beginVerification()}
            />
          ) : null}
          {flowInitialization.stage === "COMPLETED" ? (
            <div className="context-banner">
              <Check size={15} />
              Flow initialized. Tellann observed an ordered path from the
              declared initial state to a terminal state.
            </div>
          ) : null}
        </>
      ) : null}
      {setupMode ? (
        <section className="content-card setup-connection-banner mb-4">
          <Status>SDK connection</Status>
          <h2>Connect this project automatically</h2>
          <p className="mb-4">
            Attach the project folder, select every frontend and backend target
            you want Tellann to configure, then review the bounded files and
            commands before one approved task writes locally.
          </p>
          <div className="card-actions">
            {!workspace ? (
              <button
                className="button primary"
                disabled={busy || !projectId}
                onClick={() => projectId && void attachWorkspace(projectId)}
              >
                <Folder size={15} />
                Attach project folder
              </button>
            ) : null}
            <button
              className="button"
              onClick={() => setManualSetupOpen((current) => !current)}
            >
              <Code2 size={15} />
              Set up manually
            </button>
          </div>
        </section>
      ) : null}
      {(setupMode || flowId) && manualSetupOpen && manualSetup ? (
        <section className="content-card stack">
          <div className="card-heading">
            <div>
              <small>Manual SDK setup</small>
              <h2>Copy the setup for your project</h2>
            </div>
            <Status>
              {String(
                (manualSetup.readiness as any)?.connected
                  ? "Verified"
                  : "Waiting for telemetry",
              )}
            </Status>
          </div>
          <div className="card-actions">
            {((manualSetup.targets as any[]) ?? []).map((target) => (
              <button
                key={String(target.id)}
                className={`button ${manualTargetId === target.id ? "primary" : ""}`}
                onClick={() => setManualTargetId(String(target.id))}
              >
                {target.kind === "FRONTEND"
                  ? "Frontend / browser"
                  : "Backend / Node.js"}
              </button>
            ))}
          </div>
          {(() => {
            const target = ((manualSetup.targets as any[]) ?? []).find(
              (candidate) => candidate.id === manualTargetId,
            );
            if (!target) return null;
            const formatted = formatSdkSetupTarget(
              target,
              workspace,
              detections,
              projectId ?? "",
              environmentId,
              (manualSetup as any)?.gatewayEndpoint,
            );
            return (
              <div className="stack">
                <div
                  className="context-banner"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>
                    <strong>Detected Stack:</strong> {formatted.stackLabel}
                  </span>
                  {formatted.workspaceName ? (
                    <small className="muted">
                      Project: <code>{formatted.workspaceName}</code>
                      {" · "}Package manager: <code>{formatted.packageManager}</code>
                    </small>
                  ) : (
                    <small className="muted">
                      Package manager: <code>{formatted.packageManager}</code>
                    </small>
                  )}
                </div>
                <CopyableCodeBlock
                  label={`Install package ${
                    formatted.workspaceName
                      ? `(in ${formatted.workspaceName})`
                      : "in project"
                  }`}
                  code={formatted.installCommand}
                />
                <CopyableCodeBlock
                  label={`Environment and initialization (${formatted.stackLabel})`}
                  code={formatted.snippet}
                />
                {manualRawKey ? (
                  <CopyableCodeBlock
                    label="One-time Development key · copy now"
                    code={manualRawKey}
                  />
                ) : (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      projectId &&
                      window.tellann?.setup
                        .issueKey(projectId, environmentId)
                        .then((result) => setManualRawKey(result.rawKey))
                    }
                  >
                    <KeyRound size={15} />
                    Generate one-time setup key
                  </button>
                )}
                <p className="muted">
                  Keep the key in an ignored local environment file. Start the
                  application after initialization; this screen and the web
                  dashboard use the same live readiness endpoint.
                </p>

                <div
                  className="stack mt-4"
                  style={{
                    background: "#0c0c0c",
                    border: "1px solid #222",
                    borderRadius: "6px",
                    padding: "16px",
                    marginTop: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid #222",
                      paddingBottom: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <small
                        style={{
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#8e9192",
                          fontSize: "10px",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        Guide & Next Steps
                      </small>
                      <h3
                        style={{
                          margin: "2px 0 0",
                          fontSize: "15px",
                          fontWeight: 600,
                        }}
                      >
                        What to do after adding the code
                      </h3>
                    </div>
                    <Status>
                      {(manualSetup.readiness as any)?.connected
                        ? "Verified"
                        : "Waiting for telemetry"}
                    </Status>
                  </div>

                  <div className="stack" style={{ gap: "14px" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          background: "#181818",
                          border: "1px solid #333",
                          borderRadius: "50%",
                          width: "22px",
                          height: "22px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "11px",
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        1
                      </div>
                      <div>
                        <strong style={{ fontSize: "13px", color: "#fff" }}>
                          Start your local dev server
                        </strong>
                        <p
                          className="muted"
                          style={{
                            margin: "2px 0 0",
                            fontSize: "12px",
                            lineHeight: "1.5",
                          }}
                        >
                          Run your application (e.g. <code>npm run dev</code> or{" "}
                          <code>pnpm dev</code>) and load it in your browser.
                          The Tellann SDK will send its initial telemetry
                          handshake automatically.
                        </p>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          background: (manualSetup.readiness as any)?.connected
                            ? "#14532d"
                            : "#181818",
                          border: `1px solid ${
                            (manualSetup.readiness as any)?.connected
                              ? "#22c55e"
                              : "#333"
                          }`,
                          borderRadius: "50%",
                          width: "22px",
                          height: "22px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "11px",
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        2
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: "13px", color: "#fff" }}>
                          Verify connection status
                        </strong>
                        <p
                          className="muted"
                          style={{
                            margin: "2px 0 8px",
                            fontSize: "12px",
                            lineHeight: "1.5",
                          }}
                        >
                          {(manualSetup.readiness as any)?.connected ? (
                            <span
                              style={{
                                color: "#4ade80",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Check size={13} /> Connection verified! Tellann is
                              receiving live telemetry from your app.
                            </span>
                          ) : (
                            <span>
                              Waiting for live telemetry... This screen updates
                              automatically when your app sends its first event.
                            </span>
                          )}
                        </p>
                        <button
                          type="button"
                          className="button"
                          disabled={busy}
                          onClick={() => {
                            if (projectId && environmentId) {
                              void window.tellann?.setup
                                .getSdkSetup(projectId, environmentId)
                                .then(setManualSetup);
                            }
                          }}
                          style={{
                            fontSize: "11px",
                            padding: "4px 10px",
                            height: "auto",
                          }}
                        >
                          <RefreshCw size={12} /> Check connection now
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          background: "#181818",
                          border: "1px solid #333",
                          borderRadius: "50%",
                          width: "22px",
                          height: "22px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "11px",
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        3
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: "13px", color: "#fff" }}>
                          Continue to next action
                        </strong>
                        <p
                          className="muted"
                          style={{
                            margin: "2px 0 10px",
                            fontSize: "12px",
                            lineHeight: "1.5",
                          }}
                        >
                          Once your application is running, choose what you want to
                          do next:
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          {flowId ? (
                            <button
                              type="button"
                              className="button primary"
                              disabled={busy}
                              onClick={() =>
                                void continueFlowInitialization().catch(
                                  (cause) =>
                                    setFlowLoadError(
                                      String(cause?.message ?? cause),
                                    ),
                                )
                              }
                            >
                              <ArrowRight size={14} /> Analyze declared Flow
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="button primary"
                                disabled={
                                  busy ||
                                  !workspace ||
                                  environment?.type === "PRODUCTION"
                                }
                                onClick={() => void detect()}
                              >
                                <SearchCode size={14} /> Detect framework & create proposal
                              </button>
                              <Link
                                className="button"
                                to={`/projects/${projectId}/intent`}
                              >
                                <Workflow size={14} /> View Behavior Graph
                              </Link>
                              <Link
                                className="button"
                                to={`/projects/${projectId}/qa-runs/new`}
                              >
                                <Play size={14} /> New QA Run
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "16px",
                      paddingTop: "14px",
                      borderTop: "1px solid #222",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "12px",
                        color: "#f59e0b",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "8px",
                      }}
                    >
                      <AlertTriangle size={14} /> Troubleshooting — Why isn't my app connecting?
                    </strong>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "18px",
                        fontSize: "12px",
                        color: "#9ca3af",
                        lineHeight: "1.6",
                      }}
                    >
                      <li>
                        <strong>Place initialization at top-level module scope:</strong>{" "}
                        Call <code>SOTS.initialize(...)</code> in <code>main.tsx</code> or top of <code>App.tsx</code> <em>outside</em> component functions (e.g. outside <code>{"const App = () => ..."}</code>). Calling it inside a component function resets the SDK session on every React render.
                      </li>
                      <li>
                        <strong>Set environment key & restart dev server:</strong> Put{" "}
                        <code>VITE_TELLANN_INGESTION_KEY={manualRawKey || "sots_..."}</code> in your <code>.env.local</code> file and restart your Vite server (<code>npm run dev</code>).
                      </li>
                      <li>
                        <strong>Check browser console & network tab:</strong> Press F12 in your browser to check if <code>/v1/events/batch</code> requests are failing or blocked by CORS.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            );
          })()}
        </section>
      ) : null}
      <div className="mode-grid my-4">
        <section className="mode-card featured">
          <Status>Available</Status>
          {/* <Globe2 /> */}
          <h2>Browser-only</h2>
          <p>
            No source mutation or SDK installation. Captures navigation,
            console, network, screenshots, and accessibility evidence.
          </p>
        </section>
        <section className="mode-card">
          <Status>Manual</Status>
          {/* <Code2 /> */}
          <h2>Manual SDK</h2>
          <p>
            Continue using existing frontend and backend SDK integrations where
            deeper semantic telemetry is already installed.
          </p>
        </section>
        <section className="mode-card">
          <Status>
            {!instrumentationEntitled
              ? "Solo plan and above"
              : workspace
                ? "Available"
                : "Workspace required"}
          </Status>
          {/* <FileSearch /> */}
          <h2>Automated instrumentation</h2>
          <p>
            Syntax-aware SDK installation with task-scoped approval, validation,
            a local checkpoint, and conflict-safe rollback.
          </p>
        </section>
      </div>
      <section className="content-card stack">
        <div className="card-heading">
          <div>
            <small>Step 1</small>
            <h2>Detect a supported adapter</h2>
          </div>
          <Status>{environment?.type ?? "Select environment"}</Status>
        </div>
        <label>Environment</label>
        <div className="flex w-full gap-4 items-start">
          <SelectField
            value={environmentId}
            onValueChange={setEnvironmentId}
            options={application.environments.map((item) => ({
              value: item.id,
              label: `${item.name} · ${item.type}`,
            }))}
            placeholder="Select environment"
            className="flex-1"
          />
          <div className="card-actions">
            <button
              className="button primary"
              disabled={
                busy ||
                !workspace ||
                !environment ||
                environment.type === "PRODUCTION" ||
                !instrumentationEntitled
              }
              onClick={() => void detect()}
            >
              <SearchCode size={15} />
              Detect framework
            </button>
          </div>
        </div>
        {environment?.type === "PRODUCTION" ? (
          <div className="context-banner">
            <Lock size={15} /> Production is observation-only. Instrumentation
            proposal and application are blocked locally and by the cloud.
          </div>
        ) : null}
        {!instrumentationEntitled ? (
          <div
            className="context-banner"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              <Lock
                size={15}
                style={{ display: "inline-block", marginRight: "8px" }}
              />{" "}
              Automated instrumentation is not included on the{" "}
              {application?.entitlements?.planType ?? "current"} plan. Browser-only
              QA remains available.
            </span>
            <button
              className="button primary"
              style={{
                background: "#ffffff",
                color: "#000000",
                border: "none",
                fontSize: "11px",
                fontWeight: 700,
                padding: "6px 14px",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
              onClick={() => setEntitlementModalOpen(true)}
            >
              Upgrade plan
            </button>
          </div>
        ) : null}
        {detections.length ? (
          <>
            <div className="data-table">
              <div className="table-head">
                <span>Adapter</span>
                <span>Version</span>
                <span>Confidence</span>
                <span>Action</span>
              </div>
              {detections.map((item) => (
                <div className="table-row" key={item.adapterId}>
                  <span>
                    <strong>{item.adapterId}</strong>
                    <small>
                      {item.supported ? "Supported" : item.reasons.join("; ")}
                    </small>
                  </span>
                  <span>
                    {item.frameworkVersion ?? "Unknown"}
                    <small>{item.supportedVersionRange}</small>
                  </span>
                  <span>{Math.round(item.confidence * 100)}%</span>
                  <span>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        disabled={!item.supported}
                        checked={selectedAdapters.includes(item.adapterId)}
                        onChange={(event) =>
                          setSelectedAdapters((current) =>
                            event.target.checked
                              ? [...new Set([...current, item.adapterId])]
                              : current.filter(
                                  (candidate) => candidate !== item.adapterId,
                                ),
                          )
                        }
                      />
                      <span>
                        <strong>
                          {item.supported ? "Include target" : "Manual setup"}
                        </strong>
                      </span>
                    </label>
                  </span>
                </div>
              ))}
            </div>
            <div className="card-actions w-full items-end! justify-end!">
              <button
                className="button primary"
                disabled={busy || creatingProposal || !selectedAdapters.length}
                onClick={() => void proposeSelected()}
              >
                <ShieldCheck size={15} />
                {creatingProposal
                  ? "Creating setup task…"
                  : `Create reviewed setup task${selectedAdapters.length > 1 ? "s" : ""}`}
              </button>
            </div>
            {proposalMessage ? (
              <div className="context-banner" role="status">
                <Check size={15} /> {proposalMessage}
              </div>
            ) : null}
            {proposalError ? (
              <div className="context-banner" role="alert">
                <AlertTriangle size={15} /> {proposalError}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
      <section className="content-card mt-4">
        <div className="card-heading">
          <div>
            <small>Step 2</small>
            <h2>Instrumentation tasks</h2>
          </div>
          <button
            className="button"
            disabled={busy}
            onClick={() => void refreshPlans()}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
        {loading ? (
          <LoadingState />
        ) : visiblePlans.length ? (
          <div className="stack">
            {setupMode && proposedPlans.length ? (
              <section className="content-card stack">
                <div className="card-heading">
                  <div>
                    <small>One reviewed setup</small>
                    <h2>
                      {proposedPlans.length} selected SDK target
                      {proposedPlans.length === 1 ? "" : "s"}
                    </h2>
                  </div>
                  <Status>Approval required</Status>
                </div>
                <p>
                  Tellann will checkpoint and apply each bounded adapter task in
                  sequence. If a target fails, its Tellann-authored changes are
                  restored and remaining targets stop.
                </p>
                <AccordionItem value="review-files-commands" className="my-3">
                  <AccordionTrigger>
                    Review all files and commands
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="stack">
                      {proposedPlans.map((record) => {
                        const plan = record.planJson as InstrumentationPlan;
                        return (
                          <div key={String(record.id)}>
                            <strong>{plan.adapterId}</strong>
                            <ul>
                              {plan.operations.map((operation) => (
                                <li key={operation.id}>
                                  {operation.relativePath} ·{" "}
                                  {operation.description}
                                </li>
                              ))}
                              {plan.validationCommands.map((command) => (
                                <li key={command.id}>
                                  {command.executable} {command.args.join(" ")}{" "}
                                  · {command.cwd}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void applyReviewedSetup()}
                >
                  <ShieldCheck size={15} />
                  Approve, apply and verify selected targets
                </button>
              </section>
            ) : null}
            <div className="data-table">
              <div className="table-head">
                <span>Framework</span>
                <span>Risk</span>
                <span>Status</span>
                <span>Created</span>
              </div>
              {visiblePlans.map((plan) => (
                <Link
                  className="table-row"
                  key={String(plan.id)}
                  to={`/projects/${projectId}/instrumentation/plans/${plan.id}${initializationId ? `?initializationId=${encodeURIComponent(initializationId)}` : ""}`}
                >
                  <span>
                    <strong>{String(plan.adapterId)}</strong>
                    <small>
                      {String(plan.frameworkVersion ?? "unknown version")}
                    </small>
                  </span>
                  <span>{String(plan.risk)}</span>
                  <span>
                    <Status>{String(plan.status)}</Status>
                  </span>
                  <span>
                    {plan.createdAt
                      ? new Date(String(plan.createdAt)).toLocaleString()
                      : "—"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<FileSearch size={36} />}
            title="No instrumentation tasks"
            description="Detect the attached project and create a proposal. No files change until explicit approval."
          />
        )}
      </section>
      <EntitlementModal
        isOpen={entitlementModalOpen}
        feature="AUTOMATED_INSTRUMENTATION"
        currentPlan={application?.entitlements?.planType}
        onClose={() => setEntitlementModalOpen(false)}
      />
    </Page>
  );
}

export function InstrumentationDetailPage() {
  const { projectId, planId } = useParams();
  const [searchParams] = useSearchParams();
  const initializationId = searchParams.get("initializationId");
  const {
    application,
    busy,
    getInstrumentationPlan,
    getLocalInstrumentationResult,
    approveInstrumentation,
    rejectInstrumentation,
    applyInstrumentation,
    validateInstrumentation,
    rollbackInstrumentation,
    approveFlowInitialization,
    applyFlowInitialization,
    validateFlowInitialization,
    startFlowVerification,
  } = useProject();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Record<string, any> | null>(null);
  const [localResult, setLocalResult] = useState<Record<string, any> | null>(
    null,
  );
  const [files, setFiles] = useState<string[]>([]);
  const [commands, setCommands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [entitlementModalOpen, setEntitlementModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [reportState, setReportState] = useState<
    "idle" | "generating" | "saved" | "failed"
  >("idle");
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const plan = record?.planJson as InstrumentationPlan | undefined;
  const environment = application?.environments.find(
    (item) => item.id === record?.environmentId,
  );
  const installRequired =
    plan?.validationCommands.some((command) => command.id === "install-sdk") ??
    false;
  const instrumentationEntitled =
    application?.entitlements?.features.AUTOMATED_INSTRUMENTATION === true;
  const latestCloudPatch = (
    record?.patchSets as
      | Array<{
          validationJson?: unknown;
          commandResultsJson?: unknown;
        }>
      | undefined
  )?.[0];
  const validationEvidence =
    localResult?.validation ??
    record?.validationJson ??
    latestCloudPatch?.validationJson;
  const commandEvidence =
    localResult?.commandResults ?? latestCloudPatch?.commandResultsJson;
  const buildResult = (
    (commandEvidence as
      | Array<{ id: string; passed: boolean; output: string }>
      | undefined) ?? []
  ).find((result) => result.id === "validate-build");
  const buildFailure =
    buildResult && !buildResult.passed ? buildResult : undefined;
  const buildWarning =
    buildResult?.passed === true &&
    /\bwarning\b|\(\s*!\s*\)|dynamically imported/i.test(buildResult.output);
  const validationSucceeded =
    ((validationEvidence as { valid?: boolean } | undefined)?.valid === true ||
      String(record?.status) === "COMPLETED") &&
    buildResult?.passed !== false;
  const telemetryVerified = (
    ((validationEvidence as any)?.checks ?? []) as Array<{
      name: string;
      passed: boolean;
    }>
  ).some((check) => check.name === "telemetry-verification" && check.passed);

  const refresh = async () => {
    if (!projectId || !planId) return;
    setLoadError(null);
    try {
      const next = await getInstrumentationPlan(projectId, planId);
      setRecord(next);
      const nextPlan = next.planJson as InstrumentationPlan | undefined;
      if (nextPlan) {
        setFiles((current) =>
          current.length ? current : nextPlan.approvedFileScopes,
        );
        setCommands((current) =>
          current.length
            ? current
            : nextPlan.validationCommands.map((item) => item.id),
        );
      }
      const local = await getLocalInstrumentationResult(
        projectId,
        planId,
      ).catch(() => null);
      setLocalResult(local);
    } catch (cause) {
      setRecord(null);
      setLocalResult(null);
      setLoadError(
        cause instanceof Error
          ? cause.message
          : "The instrumentation task could not be loaded.",
      );
    }
  };

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [projectId, planId]);

  if (!projectId) return <ProjectRequired />;
  if (!planId)
    return (
      <Page
        title="Instrumentation history"
        description="Select a task from the instrumentation workspace."
      >
        <Link
          className="button primary"
          to={`/projects/${projectId}/instrumentation`}
        >
          Open tasks
        </Link>
      </Page>
    );
  if (loading) return <LoadingState />;
  if (!record || !plan)
    return (
      <NotFoundPage
        title="Instrumentation task unavailable"
        description={
          loadError
            ? `Tellann could not load this task: ${loadError}`
            : "The task may have been removed or may belong to another project."
        }
      />
    );

  const environmentUnavailable = !environment;

  const approve = async () => {
    if (!environment)
      throw new Error("INSTRUMENTATION_ENVIRONMENT_UNAVAILABLE");
    if (initializationId)
      await approveFlowInitialization(initializationId, planId);
    await approveInstrumentation({
      applicationId: projectId,
      environmentId: environment.id,
      environmentType: environment.type,
      instrumentationPurpose: plan.instrumentationPurpose,
      flowId: plan.flowId ?? undefined,
      flowVersionId: plan.flowVersionId ?? undefined,
      planId,
      approvedFileScopes: files,
      approvedCommandIds: commands,
    });
    await refresh();
  };
  const approveAndApply = async () => {
    if (!environment)
      throw new Error("INSTRUMENTATION_ENVIRONMENT_UNAVAILABLE");
    if (initializationId)
      await approveFlowInitialization(initializationId, planId);
    await approveInstrumentation({
      applicationId: projectId,
      environmentId: environment.id,
      environmentType: environment.type,
      instrumentationPurpose: plan.instrumentationPurpose,
      flowId: plan.flowId ?? undefined,
      flowVersionId: plan.flowVersionId ?? undefined,
      planId,
      approvedFileScopes: files,
      approvedCommandIds: commands,
    });
    const result = await applyInstrumentation(projectId, planId);
    const patchSetId = String(
      (result.cloud as Record<string, unknown> | undefined)?.id ?? "",
    );
    if (initializationId) {
      if (!patchSetId)
        throw new Error(
          "Flow instrumentation was applied without a cloud patch identifier.",
        );
      await applyFlowInitialization(initializationId, patchSetId);
    }
    await refresh();
  };
  const apply = async () => {
    const result = await applyInstrumentation(projectId, planId);
    const patchSetId = String(
      (result.cloud as Record<string, unknown> | undefined)?.id ?? "",
    );
    if (initializationId) {
      if (!patchSetId)
        throw new Error(
          "Flow instrumentation was applied without a cloud patch identifier.",
        );
      await applyFlowInitialization(initializationId, patchSetId);
    }
    await refresh();
  };
  const validate = async () => {
    const validation = await validateInstrumentation(projectId, planId);
    if (initializationId && validation.valid) {
      await validateFlowInitialization(initializationId, {
        checkpointReachability: validation.checks,
      });
      await startFlowVerification(initializationId);
      navigate(
        `/projects/${projectId}/instrumentation?flowId=${encodeURIComponent(String(plan.flowId ?? ""))}&flowVersionId=${encodeURIComponent(String(plan.flowVersionId ?? ""))}&initializationId=${encodeURIComponent(initializationId)}&environmentId=${encodeURIComponent(String(record.environmentId ?? ""))}`,
      );
      return;
    }
    await refresh();
  };
  const copyBuildDiagnostics = async () => {
    if (!buildFailure || !window.tellann) return;
    try {
      if (typeof window.tellann.system.copyText === "function") {
        await window.tellann.system.copyText(buildFailure.output);
      } else {
        await navigator.clipboard.writeText(buildFailure.output);
      }
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2_500);
    } catch {
      setCopyState("failed");
    }
  };
  const generateBuildReport = async () => {
    if (
      !projectId ||
      !planId ||
      !application ||
      !environment ||
      !window.tellann
    )
      return;
    setReportState("generating");
    setReportMessage(null);
    try {
      const generateReport = window.tellann.instrumentation.generateReport;
      if (typeof generateReport !== "function") {
        setReportState("failed");
        setReportMessage(
          "Tellann Desktop loaded an older system bridge. Fully close and restart the Desktop app, then generate the report again.",
        );
        return;
      }
      const result = await generateReport(
        projectId,
        planId,
        application.name,
        environment.name,
      );
      if (result.cancelled) {
        setReportState("idle");
        return;
      }
      setReportState("saved");
      setReportMessage(
        result.sourceAdded
          ? `${result.filename} was saved and added to this project’s Sources (${result.sourceStatus?.toLowerCase() ?? "queued"}).`
          : `${result.filename} was saved, but could not be added to Sources: ${result.sourceError ?? "unknown upload error"}`,
      );
    } catch (cause) {
      setReportState("failed");
      setReportMessage(
        cause instanceof Error
          ? cause.message
          : "The validation report could not be generated.",
      );
    }
  };
  const rollback = async () => {
    await rollbackInstrumentation(projectId, planId);
    await refresh();
  };

  return (
    <Page
      title={`Instrumentation · ${plan.adapterId}`}
      description="Review scope, commands, evidence, local diff, validation, and rollback status."
      actions={
        <Status>
          {validationSucceeded ? "COMPLETED" : String(record.status)}
        </Status>
      }
    >
      {validationSucceeded ? (
        <section className="bg-[#131313] border border-[#262626] rounded-xs p-6 mb-6">
          <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">
            Tellann is installed and the project build passed
          </h2>

          <div className="bg-[#000000] border border-[#262626] p-4 my-4 flex items-start gap-3">
            <Check size={18} className="text-white shrink-0 mt-0.5" />
            <span className="text-sm text-[#c4c7c8] leading-relaxed">
              The reviewed files are in place, the SDK resolves correctly, and
              the approved TypeScript/Vite build completed successfully.
            </span>
          </div>

          {buildWarning ? (
            <p className="text-xs text-[#8e9192] bg-[#000000] border border-[#262626] p-3 mb-4 leading-relaxed">
              Vite reported a non-blocking import/chunking warning. It does not
              affect the SDK connection and can be optimized later by making
              that module use one consistent import strategy.
            </p>
          ) : null}

          {!localResult ? (
            <p className="text-xs text-[#8e9192] bg-[#000000] border border-[#262626] p-3 mb-4 leading-relaxed">
              This completed task was restored from synchronized cloud history.
              Local diff and rollback evidence are available only on the device
              and workspace that originally applied the task.
            </p>
          ) : null}

          <div className="my-5">
            <div className="text-[11px] font-mono text-[#8e9192] tracking-wider uppercase mb-3">
              WHAT TO DO NEXT
            </div>
            <div className="bg-[#000000] border border-[#262626] p-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-[#e2e2e2] leading-relaxed">
                {telemetryVerified ? (
                  <li>
                    Telemetry and the onboarding test event have been received.
                    Continue to your first guided walkthrough.
                  </li>
                ) : (
                  <>
                    <li>
                      Start the application normally and keep Tellann Desktop
                      open.
                    </li>
                    <li>
                      Open and use the application once so the SDK emits its
                      onboarding test event.
                    </li>
                    <li>
                      Confirm the connection becomes verified, then begin the
                      first guided walkthrough.
                    </li>
                  </>
                )}
              </ol>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 my-4 w-full! justify-end">
            <Link
              className="inline-flex items-center gap-2 bg-white text-black! font-semibold text-xs tracking-wider uppercase px-5 py-3 rounded-xs hover:bg-[#e6e6e6] transition-colors"
              to={`/projects/${projectId}/qa-runs/new`}
            >
              <Play size={15} />{" "}
              {telemetryVerified
                ? "Run first walkthrough"
                : "Continue to verification"}
            </Link>
            <Link
              className="inline-flex items-center gap-2 bg-[#000000] border border-[#444748] text-white font-medium text-xs tracking-wider uppercase px-5 py-3 rounded-xs hover:border-white transition-colors"
              to={`/projects/${projectId}/instrumentation`}
            >
              View instrumentation history
            </Link>
          </div>

          <div className="mt-6 pt-4 border-t border-[#262626]">
            <AccordionItem value="advanced-maintenance" defaultOpen={false}>
              <AccordionTrigger>Advanced maintenance</AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-[#8e9192] mb-3">
                  Use these only after source changes, when troubleshooting, or
                  when intentionally removing Tellann.
                </p>
                {localResult ? (
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void validate()}
                    >
                      <RefreshCw size={15} /> Re-run local checks
                    </button>
                    <button
                      className="button danger"
                      disabled={busy}
                      onClick={() => void rollback()}
                    >
                      <Trash2 size={15} /> Rollback Tellann changes
                    </button>
                  </div>
                ) : (
                  <p className="muted">
                    Revalidation and rollback require the original local
                    workspace evidence.
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          </div>
        </section>
      ) : null}

      <AccordionItem
        value="approved-setup-scope"
        defaultOpen={!validationSucceeded}
        className="mb-2"
      >
        {validationSucceeded ? (
          <AccordionTrigger>View approved setup scope</AccordionTrigger>
        ) : null}
        <AccordionContent
          className={validationSucceeded ? "" : "p-0 border-t-0 bg-transparent"}
        >
          <div className="two-column">
            <section className="content-card stack">
              <div className="card-heading">
                <div>
                  <small>Approved write boundary</small>
                  <h2>Files</h2>
                </div>
                <span>
                  {files.length}/{plan.approvedFileScopes.length}
                </span>
              </div>
              {plan.operations.map((operation) => (
                <div className="check-row flex" key={operation.id}>
                  <Switch
                    disabled={record.status !== "PROPOSED"}
                    checked={files.includes(operation.relativePath)}
                    onCheckedChange={(checked) =>
                      setFiles((current) =>
                        checked
                          ? [...new Set([...current, operation.relativePath])]
                          : current.filter(
                              (item) => item !== operation.relativePath,
                            ),
                      )
                    }
                  />
                  <span>
                    <strong>{operation.relativePath}</strong>
                    <small>{operation.description}</small>
                  </span>
                </div>
              ))}
            </section>
            <section className="content-card">
              <div className="card-heading mb-6">
                <div>
                  <small>Approved execution boundary</small>
                  <h2>Commands</h2>
                </div>
                <Status>{plan.risk}</Status>
              </div>
              {plan.validationCommands.map((command) => (
                <div
                  className="check-row flex items-start! justify-start"
                  key={command.id}
                >
                  <Switch
                    disabled={
                      record.status !== "PROPOSED" ||
                      command.id === "install-sdk"
                    }
                    checked={commands.includes(command.id)}
                    onCheckedChange={(checked) =>
                      setCommands((current) =>
                        checked
                          ? [...new Set([...current, command.id])]
                          : current.filter((item) => item !== command.id),
                      )
                    }
                  />
                  <span>
                    <strong>{command.purpose}</strong>
                    <small>
                      {command.executable} {command.args.join(" ")} ·{" "}
                      {command.networkRequired ? "network" : "offline"}
                    </small>
                  </span>
                </div>
              ))}
              <p className="muted">
                {installRequired
                  ? "SDK installation is part of this approved task."
                  : "The SDK is already available, so no registry installation is required."}{" "}
                Tellann executes argument arrays without a shell.
              </p>
            </section>
          </div>
          <section className="content-card mt-3">
            <h2>Evidence and risk</h2>
            <div className="tag-list">
              {plan.riskReasons.map((reason) => (
                <span key={reason}>{reason}</span>
              ))}
            </div>
            <dl className="detail-list">
              <div>
                <dt>Base revision</dt>
                <dd>{plan.baseRevision ?? "No Git revision"}</dd>
              </div>
              <div>
                <dt>Repository fingerprint</dt>
                <dd>{plan.repositoryFingerprint.slice(0, 16)}…</dd>
              </div>
              <div>
                <dt>Adapter</dt>
                <dd>
                  {plan.adapterVersion} · {plan.supportedVersionRange}
                </dd>
              </div>
            </dl>
          </section>
        </AccordionContent>
      </AccordionItem>
      {!validationSucceeded ? (
        <section className="content-card review-actions">
          {environmentUnavailable ? (
            <div className="context-banner">
              <AlertTriangle size={15} /> The environment originally attached to
              this task is no longer available. The task remains in history, but
              approval and apply actions are disabled.
            </div>
          ) : null}
          {!instrumentationEntitled ? (
            <div
              className="context-banner"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                <Lock
                  size={15}
                  style={{ display: "inline-block", marginRight: "8px" }}
                />{" "}
                This plan cannot approve or apply automated instrumentation.
                Browser-only QA remains available.
              </span>
              <button
                className="button primary"
                style={{
                  background: "#ffffff",
                  color: "#000000",
                  border: "none",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "6px 14px",
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
                onClick={() => setEntitlementModalOpen(true)}
              >
                Upgrade plan
              </button>
            </div>
          ) : null}
          {record.status === "PROPOSED" ? (
            <div className="flex w-full gap-4">
              <button
                className="button danger min-w-37.5"
                disabled={busy}
                onClick={() =>
                  void rejectInstrumentation(
                    projectId,
                    planId,
                    "Rejected in desktop review",
                  ).then(refresh)
                }
              >
                Reject
              </button>
              <button
                className="button primary flex-1"
                disabled={
                  busy ||
                  environmentUnavailable ||
                  !instrumentationEntitled ||
                  files.length !== plan.approvedFileScopes.length ||
                  (installRequired && !commands.includes("install-sdk"))
                }
                onClick={() => void approveAndApply()}
              >
                <ShieldCheck size={15} />
                Approve, apply and validate
              </button>
            </div>
          ) : null}
          {record.status === "APPROVED" ? (
            <button
              className="button primary"
              disabled={
                busy || environmentUnavailable || !instrumentationEntitled
              }
              onClick={() => void apply()}
            >
              <TerminalSquare size={15} />
              Apply and validate
            </button>
          ) : null}
          {localResult &&
          ["APPLIED", "VALIDATION_FAILED", "COMPLETED"].includes(
            String(record.status),
          ) ? (
            <>
              <button
                className="button"
                disabled={busy}
                onClick={() => void validate()}
              >
                Re-run local checks
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => void rollback()}
              >
                Rollback Tellann changes
              </button>
            </>
          ) : null}
        </section>
      ) : null}
      {localResult ? (
        <div className="stack">
          {buildFailure ? (
            <section className="content-card stack">
              <div className="card-heading">
                <div>
                  <small>Action required in the attached project</small>
                  <h2>Project build health</h2>
                </div>
                <Status>WARNING</Status>
              </div>
              <div className="context-banner">
                <AlertTriangle size={16} />
                <span>
                  Tellann’s files, SDK dependency, and idempotency checks
                  passed. The application’s own TypeScript build reported errors
                  that do not reference the Tellann SDK or generated
                  configuration.
                </span>
              </div>
              <p>
                Fix the project errors and re-run the checks. Tellann will not
                edit unrelated application code to resolve them without a
                separate file-and-command review and your explicit approval.
              </p>
              <ul className="stack muted">
                <li>
                  Resolve missing or outdated model properties and enum values.
                </li>
                <li>
                  Remove unused imports and variables, or adjust the project’s
                  TypeScript policy intentionally.
                </li>
                <li>
                  Restore missing store slices and service exports before
                  retrying the build.
                </li>
              </ul>
              <div className="flex w-full gap-4">
                <button
                  className="button flex-1"
                  onClick={() => void copyBuildDiagnostics()}
                >
                  {copyState === "copied" ? (
                    <Check size={15} />
                  ) : (
                    <Copy size={15} />
                  )}
                  {copyState === "copied"
                    ? "Copied to clipboard"
                    : copyState === "failed"
                      ? "Copy failed - retry"
                      : "Copy build diagnostics"}
                </button>
                <button
                  className="button flex-1"
                  disabled={reportState === "generating"}
                  onClick={() => void generateBuildReport()}
                >
                  <BookOpenText size={15} />
                  {reportState === "generating"
                    ? "Generating PDF…"
                    : "Generate Tellann PDF report"}
                </button>
                <button
                  className="button primary flex-1"
                  disabled={busy}
                  onClick={() => void validate()}
                >
                  <RefreshCw size={15} /> Re-run build and Tellann checks
                </button>
              </div>
              {reportMessage ? (
                <div
                  className="context-banner"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                  role={reportState === "failed" ? "alert" : "status"}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flex: 1,
                    }}
                  >
                    {reportState === "failed" ? (
                      <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                    ) : (
                      <Check size={15} style={{ flexShrink: 0 }} />
                    )}
                    <span>{reportMessage}</span>
                  </div>
                  <button
                    className="button"
                    style={{
                      padding: "3px 8px",
                      fontSize: "11px",
                      height: "auto",
                    }}
                    onClick={() => {
                      setReportMessage(null);
                      setReportState("idle");
                    }}
                  >
                    <X size={13} /> Dismiss
                  </button>
                </div>
              ) : null}
              <AccordionItem
                value="build-output"
                defaultOpen={false}
                className="mt-3"
              >
                <AccordionTrigger>Show full build output</AccordionTrigger>
                <AccordionContent>
                  <pre className="code-block">{buildFailure.output}</pre>
                </AccordionContent>
              </AccordionItem>
            </section>
          ) : null}
          {buildWarning && !validationSucceeded ? (
            <section className="content-card stack">
              <div className="card-heading">
                <div>
                  <small>Non-blocking project guidance</small>
                  <h2>Build passed with a bundler warning</h2>
                </div>
                <Status>BUILD PASSED</Status>
              </div>
              <div className="context-banner" role="status">
                <Check size={16} />
                <span>
                  TypeScript and Vite completed successfully. This warning does
                  not block Tellann installation or telemetry verification.
                </span>
              </div>
              <p>
                A module is imported both statically and dynamically, so Vite
                keeps it in the main chunk instead of creating a separate
                lazy-loaded chunk. Developers can remove the warning later by
                using one consistent import strategy for that module.
              </p>
              <div className="review-actions">
                <button
                  className="button"
                  disabled={reportState === "generating"}
                  onClick={() => void generateBuildReport()}
                >
                  <BookOpenText size={15} />{" "}
                  {reportState === "generating"
                    ? "Generating PDF…"
                    : "Generate Tellann PDF report"}
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void validate()}
                >
                  <RefreshCw size={15} /> Re-run build and Tellann checks
                </button>
              </div>
              {reportMessage ? (
                <div
                  className="context-banner"
                  role={reportState === "failed" ? "alert" : "status"}
                >
                  {reportState === "failed" ? (
                    <AlertTriangle size={15} />
                  ) : (
                    <Check size={15} />
                  )}
                  <span>{reportMessage}</span>
                </div>
              ) : null}
            </section>
          ) : null}

          <AccordionItem
            value="technical-validation-evidence"
            defaultOpen={!validationSucceeded}
            className="mt-4"
          >
            {validationSucceeded ? (
              <AccordionTrigger>
                View technical validation evidence
              </AccordionTrigger>
            ) : null}
            <AccordionContent
              className={
                validationSucceeded ? "" : "p-0 border-t-0 bg-transparent"
              }
            >
              <div className="stack">
                <section className="content-card">
                  <h2>Local validation</h2>
                  {((localResult.validation as any)?.checks ?? []).map(
                    (check: any) => (
                      <Checklist
                        key={check.name}
                        checked={Boolean(check.passed)}
                        text={`${check.name}: ${check.output}`}
                      />
                    ),
                  )}
                </section>
                <section className="content-card">
                  <div className="card-heading">
                    <div>
                      <small>File-by-file change review</small>
                      <h2>Local changes</h2>
                    </div>
                  </div>
                  <p>
                    Credential values are redacted from this local preview. The
                    cloud stores only the diff hash and bounded file manifest.
                  </p>
                  <InstrumentationDiffViewer
                    diff={(localResult.patch as any)?.diff}
                  />
                </section>
              </div>
            </AccordionContent>
          </AccordionItem>
        </div>
      ) : null}
      <EntitlementModal
        isOpen={entitlementModalOpen}
        feature="AUTOMATED_INSTRUMENTATION"
        currentPlan={application?.entitlements?.planType}
        onClose={() => setEntitlementModalOpen(false)}
      />
    </Page>
  );
}

function useRuns(projectId?: string) {
  const { runs, refreshRuns } = useDesktop();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!projectId) return;
    void refreshRuns(projectId)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [projectId, refreshRuns]);
  return { items: projectId ? (runs[projectId] ?? []) : [], loading };
}

export function RunsPage() {
  const { projectId, application } = useProject();
  const { items, loading } = useRuns(projectId);
  if (!projectId) return <ProjectRequired />;
  if (!application)
    return (
      <NotFoundPage
        title="Project unavailable"
        description="Select another project."
      />
    );
  return (
    <Page
      title="QA Runs"
      description="Guided browser execution, captured evidence, reconciliation, and report processing."
      actions={
        <Link
          className="button primary"
          to={`/projects/${projectId}/qa-runs/new`}
        >
          <Play size={15} />
          New QA run
        </Link>
      }
    >
      {loading ? (
        <LoadingState />
      ) : items.length ? (
        <RunTable projectId={projectId} runs={items} />
      ) : (
        <EmptyState
          icon={<Play size={36} />}
          title="No QA runs yet"
          description="Receive a browser-first report without installing an SDK or granting repository write access."
          action={
            <Link
              className="button primary"
              to={`/projects/${projectId}/qa-runs/new`}
            >
              Start first run
            </Link>
          }
        />
      )}
    </Page>
  );
}

function RunTable({
  projectId,
  runs,
}: {
  projectId: string;
  runs: QARunSummary[];
}) {
  return (
    <div className="data-table">
      <div className="table-head">
        <span>Run</span>
        <span>Environment</span>
        <span>Status</span>
        <span>Evidence</span>
        <span>Started</span>
      </div>
      {runs.map((run) => (
        <Link
          className="table-row"
          key={run.id}
          to={`/projects/${projectId}/qa-runs/${run.id}`}
        >
          <span>
            <strong>{run.id.slice(0, 8)}</strong>
            <small>{run.mode}</small>
          </span>
          <span>{run.environment?.name ?? run.environmentId.slice(0, 8)}</span>
          <span>
            <Status>{run.status}</Status>
          </span>
          <span>
            {run.artifactCount} artifacts / {run.findingCount} findings
          </span>
          <span>
            {run.startedAt
              ? new Date(run.startedAt).toLocaleString()
              : "Not started"}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function NewRunPage() {
  const {
    projectId,
    application,
    workspace,
    startRun,
    busy,
    getDeclaredFlows,
    listInstrumentationPlans,
  } = useProject();
  const navigate = useNavigate();
  const [environmentId, setEnvironmentId] = useState(
    application?.environments[0]?.id ?? "",
  );
  const environment = application?.environments.find(
    (item) => item.id === environmentId,
  );
  const detectedApplicationUrl =
    environment?.type === "DEVELOPMENT"
      ? workspace?.snapshot.suggestedApplicationUrls?.[0]
      : undefined;
  const [targetUrl, setTargetUrl] = useState(
    detectedApplicationUrl?.url ??
      environment?.baseUrl ??
      "http://localhost:3000",
  );
  const [mode, setMode] = useState<"GUIDED" | "OBSERVATION_ONLY">(
    environment?.type === "PRODUCTION" ? "OBSERVATION_ONLY" : "GUIDED",
  );
  const [productionObservationApproved, setProductionObservationApproved] =
    useState(false);
  const [flows, setFlows] = useState<DeclaredFlowSummary[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [expectedGraphVersionId, setExpectedGraphVersionId] = useState("");
  const [captureMode, setCaptureMode] = useState<
    "FRONTEND" | "BACKEND" | "COMBINED"
  >("FRONTEND");
  const [instrumentationManifests, setInstrumentationManifests] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [patchSetId, setPatchSetId] = useState("");
  const launchCommands = workspace?.snapshot.launchCommands ?? [];
  const [launchCommandId, setLaunchCommandId] = useState("");
  const [launchApproved, setLaunchApproved] = useState(false);
  useEffect(() => {
    const nextEnvironment = application?.environments.find(
      (item) => item.id === environmentId,
    );
    const detected =
      nextEnvironment?.type === "DEVELOPMENT"
        ? workspace?.snapshot.suggestedApplicationUrls?.[0]?.url
        : undefined;
    setTargetUrl(
      detected ?? nextEnvironment?.baseUrl ?? "http://localhost:3000",
    );
  }, [
    application?.environments,
    environmentId,
    workspace?.snapshot.suggestedApplicationUrls,
  ]);
  useEffect(() => {
    if (!projectId) return;
    void getDeclaredFlows(projectId).then((items) => {
      setFlows(
        items.filter(
          (item) => item.status === "COMPLETE" || item.status === "COMPLETED",
        ),
      );
      setExpectedGraphVersionId(
        items.find(
          (item) => item.status === "COMPLETE" || item.status === "COMPLETED",
        )?.versions?.[0]?.id ?? "",
      );
      setSelectedFlowId(
        items.find(
          (item) => item.status === "COMPLETE" || item.status === "COMPLETED",
        )?.id ?? "",
      );
    });
  }, [getDeclaredFlows, projectId]);
  useEffect(() => {
    if (!projectId) return;
    void listInstrumentationPlans(projectId)
      .then((plans) => {
        const manifests = plans.flatMap((plan: any) =>
          ((plan.patchSets ?? []) as any[])
            .filter((patch) => patch.status === "VALIDATED")
            .map((patch) => ({
              id: String(patch.id),
              label: `${String(plan.adapterId)} · ${new Date(String(patch.validatedAt ?? patch.createdAt)).toLocaleString()}`,
            })),
        );
        setInstrumentationManifests(manifests);
        setPatchSetId((current) => current || manifests[0]?.id || "");
      })
      .catch(() => undefined);
  }, [listInstrumentationPlans, projectId]);
  if (!projectId) return <ProjectRequired />;
  if (!application)
    return (
      <NotFoundPage
        title="Project unavailable"
        description="Select another project."
      />
    );
  const begin = async () => {
    const selectedFlow = flows.find(
      (flow) => flow.id === selectedFlowId,
    ) as any;
    const binding = selectedFlow?.projectBindings?.[0];
    const initialization = binding?.initializations?.[0];
    const scan = binding?.scans?.[0];
    if (
      !selectedFlow ||
      !binding ||
      binding.status !== "ACTIVE" ||
      initialization?.status !== "COMPLETED" ||
      !scan
    ) {
      throw new Error(
        "Initialize this published Flow in the selected project and environment before starting a QA run.",
      );
    }
    const run = await startRun({
      applicationId: projectId,
      environmentId,
      workspaceId: workspace?.id ?? null,
      flowId: selectedFlow.id,
      flowBindingId: binding.id,
      flowInitializationId: initialization.id,
      flowScanId: scan.id,
      flowDriftId: binding.latestDriftId ?? null,
      expectedGraphVersionId,
      captureTracks:
        captureMode === "COMBINED" ? ["FRONTEND", "BACKEND"] : [captureMode],
      patchSetId: patchSetId || null,
      environmentType: environment?.type ?? "STAGING",
      mode,
      productionObservationApproved:
        environment?.type === "PRODUCTION" && productionObservationApproved,
      targetUrl,
      launchCommandId: launchCommandId || undefined,
      launchApproved: Boolean(launchCommandId) && launchApproved,
    });
    navigate(`/projects/${projectId}/qa-runs/${run.runId}/live`);
  };
  return (
    <Page
      title="New QA run"
      description="Choose an initialized Flow and capture frontend, backend, or correlated evidence within its initial and terminal boundaries."
    >
      <section className="wizard-card">
        <div className="form-grid">
          <label>
            Environment
            <SelectField
              value={environmentId}
              onValueChange={(id) => {
                const next = application.environments.find(
                  (item) => item.id === id,
                );
                setEnvironmentId(id);
                const detected =
                  next?.type === "DEVELOPMENT"
                    ? workspace?.snapshot.suggestedApplicationUrls?.[0]?.url
                    : undefined;
                setTargetUrl(detected ?? next?.baseUrl ?? targetUrl);
                setMode(
                  next?.type === "PRODUCTION" ? "OBSERVATION_ONLY" : "GUIDED",
                );
                setLaunchCommandId("");
                setLaunchApproved(false);
                setProductionObservationApproved(false);
              }}
              options={application.environments.map((item) => ({
                value: item.id,
                label: `${item.name} (${item.type})`,
              }))}
            />
          </label>
          <label>
            Run mode
            <SelectField
              value={mode}
              disabled={environment?.type === "PRODUCTION"}
              onValueChange={(value) => {
                const next = value as typeof mode;
                setMode(next);
                if (next === "OBSERVATION_ONLY") {
                  setLaunchCommandId("");
                  setLaunchApproved(false);
                }
              }}
              options={[
                { value: "GUIDED", label: "Guided" },
                { value: "OBSERVATION_ONLY", label: "Observation only" },
              ]}
            />
          </label>
          <label className="full">
            Application URL
            <input
              type="url"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
            />
            {detectedApplicationUrl ? (
              <small>
                Detected from {detectedApplicationUrl.source} (
                {Math.round(detectedApplicationUrl.confidence * 100)}%
                confidence). You can edit this URL.
              </small>
            ) : null}
          </label>
          <label className="full">
            Flow source of truth
            <SelectField
              value={selectedFlowId}
              onValueChange={(flowId) => {
                setSelectedFlowId(flowId);
                setExpectedGraphVersionId(
                  flows.find((flow) => flow.id === flowId)?.versions?.[0]?.id ??
                    "",
                );
              }}
              options={[
                { value: "", label: "Select an initialized published Flow" },
                ...flows.flatMap((flow) =>
                  flow.versions?.[0]
                    ? [
                        {
                          value: flow.id,
                          label: `${flow.name} / version ${flow.versions[0].version}`,
                        },
                      ]
                    : [],
                ),
              ]}
            />
          </label>
          <label className="full">
            Capture tracks
            <SelectField
              value={captureMode}
              onValueChange={(value) =>
                setCaptureMode(value as typeof captureMode)
              }
              options={[
                { value: "FRONTEND", label: "Frontend browser" },
                { value: "BACKEND", label: "Backend requests" },
                { value: "COMBINED", label: "Combined frontend + backend" },
              ]}
            />
          </label>
          <label className="full">
            Instrumentation evidence
            <SelectField
              value={patchSetId}
              onValueChange={setPatchSetId}
              options={[
                {
                  value: "",
                  label: "Browser-only run (no instrumentation manifest)",
                },
                ...instrumentationManifests.map((manifest) => ({
                  value: manifest.id,
                  label: manifest.label,
                })),
              ]}
            />
          </label>
          {launchCommands.length && mode !== "OBSERVATION_ONLY" ? (
            <label className="full">
              Local application process
              <SelectField
                value={launchCommandId}
                onValueChange={(value) => {
                  setLaunchCommandId(value);
                  setLaunchApproved(false);
                }}
                options={[
                  {
                    value: "",
                    label: "Attach to an already running application",
                  },
                  ...launchCommands.map((command) => ({
                    value: command.id,
                    label: command.label,
                  })),
                ]}
              />
            </label>
          ) : null}
        </div>
        {launchCommandId ? (
          <label className="check-row">
            <input
              type="checkbox"
              checked={launchApproved}
              onChange={(event) => setLaunchApproved(event.target.checked)}
            />
            <span>
              <strong>Approve this package script for this run</strong>
              <small>
                Tellann executes only the selected package.json script without a
                shell and stops only the process tree it started.
              </small>
            </span>
          </label>
        ) : null}
        <div className="permission-summary">
          <KeyRound />
          <div>
            <strong>Capture policy</strong>
            <p>
              Console, network, screenshot, and accessibility evidence. Secrets
              and personal data are redacted. Repository access remains
              read-only unless you separately approved instrumentation. A local
              package script runs only when selected and approved above.
            </p>
          </div>
        </div>
        {environment?.type === "PRODUCTION" ? (
          <>
            <div className="context-banner">
              Production is observation-only. Tellann blocks process launch, SDK
              injection, and non-read HTTP requests.
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={productionObservationApproved}
                onChange={(event) =>
                  setProductionObservationApproved(event.target.checked)
                }
              />
              <span>
                <strong>Approve production observation for this run</strong>
                <small>
                  No repository command, instrumentation, form submission,
                  upload, or data mutation is permitted.
                </small>
              </span>
            </label>
          </>
        ) : null}
        <button
          className="button primary"
          disabled={
            busy ||
            !targetUrl ||
            !environmentId ||
            !selectedFlowId ||
            !expectedGraphVersionId ||
            Boolean(launchCommandId && !launchApproved) ||
            Boolean(
              environment?.type === "PRODUCTION" &&
              !productionObservationApproved,
            )
          }
          onClick={() => void begin()}
        >
          <Play size={16} />
          {environment?.type === "PRODUCTION"
            ? "Start observation-only run"
            : "Start guided run"}
        </button>
      </section>
    </Page>
  );
}

export function LiveRunPage() {
  const { projectId } = useParams();
  const { activeRun: run, pauseRun, endRun, busy } = useDesktop();
  const [tab, setTab] = useState<"CONSOLE" | "NETWORK" | "ACCESSIBILITY">(
    "CONSOLE",
  );
  if (!projectId) return <ProjectRequired />;
  if (!run)
    return (
      <EmptyState
        icon={<Activity size={36} />}
        title="No active local run"
        description="The requested run is not active on this device. Open its cloud detail or create a new run."
        action={
          <Link
            className="button primary"
            to={`/projects/${projectId}/qa-runs`}
          >
            Run history
          </Link>
        }
      />
    );
  const visible = run.evidence.filter((item) =>
    tab === "ACCESSIBILITY"
      ? item.kind === "ACCESSIBILITY" || item.kind === "PAGE"
      : item.kind === tab,
  );
  return (
    <div className="live-run-page">
      <section className="live-flow">
        <h2>Expected flow</h2>
        <p>
          {run.expectedGraphVersionId
            ? `Reconciling against accepted graph version ${run.expectedGraphVersionId.slice(0, 8)}.`
            : "No accepted intent selected. This is an observational run."}
        </p>
        <div className="flow-step complete">
          <span>
            <Check />
          </span>
          <div>
            <strong>Application opened</strong>
            <small>Entry observed</small>
          </div>
        </div>
        <div className="flow-step active">
          <span>2</span>
          <div>
            <strong>Demonstrate workflow</strong>
            <small>In progress</small>
          </div>
        </div>
      </section>
      <section className="live-browser">
        <div className="browser-toolbar">
          <Globe2 size={16} />
          <strong>Managed Chromium</strong>
          <Status>{run.status}</Status>
        </div>
        <div className="browser-canvas">
          <Activity size={42} />
          <h2>Managed browser is running</h2>
          <p>
            Complete the workflow in the isolated Chromium window. Evidence
            streams here without using your personal browser profile.
          </p>
        </div>
      </section>
      <aside className="live-evidence">
        <div className="evidence-heading">
          <h2>Live evidence</h2>
          <span>{run.evidence.length}</span>
        </div>
        <div className="evidence-tabs">
          <button
            className={tab === "CONSOLE" ? "selected" : ""}
            onClick={() => setTab("CONSOLE")}
          >
            <TerminalSquare size={14} />
            Console
          </button>
          <button
            className={tab === "NETWORK" ? "selected" : ""}
            onClick={() => setTab("NETWORK")}
          >
            <Network size={14} />
            Network
          </button>
          <button
            className={tab === "ACCESSIBILITY" ? "selected" : ""}
            onClick={() => setTab("ACCESSIBILITY")}
          >
            <Accessibility size={14} />
            A11y
          </button>
        </div>
        <div className="evidence-list">
          {visible.length ? (
            visible.map((item) => <EvidenceRow key={item.id} item={item} />)
          ) : (
            <div className="evidence-empty">
              Evidence will appear during the workflow.
            </div>
          )}
        </div>
      </aside>
      <footer className="run-controls">
        <div>
          <Status>{run.status}</Status>
          <code>{run.runId.slice(0, 8)}</code>
        </div>
        <div>
          {run.status === "RUNNING" || run.status === "PAUSED" ? (
            <>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void pauseRun()}
              >
                {run.status === "PAUSED" ? <Play /> : <CirclePause />}
                {run.status === "PAUSED" ? "Resume" : "Pause"}
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => void endRun()}
              >
                <CircleStop />
                End run
              </button>
            </>
          ) : null}
        </div>
        <div>Capture protected</div>
      </footer>
    </div>
  );
}

function EvidenceRow({ item }: { item: LiveEvidence }) {
  return (
    <div className={`evidence-row evidence-${item.level.toLowerCase()}`}>
      <time>{new Date(item.timestamp).toLocaleTimeString()}</time>
      <span>{item.level}</span>
      <p>{item.message}</p>
    </div>
  );
}

const RUN_TABS = [
  { value: "evidence", label: "Evidence" },
  { value: "findings", label: "Findings" },
  { value: "replay", label: "Replay" },
  { value: "graph", label: "Graph" },
  { value: "reconciliation", label: "Reconciliation" },
  { value: "artifacts", label: "Artifacts" },
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function displayValue(value: unknown, fallback = "Not recorded") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object")
    return (
      Object.entries(asRecord(value))
        .map(([key, item]) => `${key}: ${String(item)}`)
        .join(" · ") || fallback
    );
  return String(value);
}

function formatDate(value: unknown) {
  if (!value) return "Not recorded";
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleString();
}

function formatBytes(value: unknown) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EmptyRunSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <EmptyState
      icon={<BookOpenText size={32} />}
      title={title}
      description={description}
    />
  );
}

function ArtifactLayout({
  items,
  heading,
  showStorage = false,
}: {
  items: unknown[];
  heading: string;
  showStorage?: boolean;
}) {
  if (!items.length)
    return (
      <EmptyRunSection
        title={`No ${heading.toLowerCase()}`}
        description="This run has not captured data for this section yet."
      />
    );
  return (
    <section className="run-section">
      <div className="run-section-heading">
        <div>
          <small>Run collection</small>
          <h2>{heading}</h2>
        </div>
        <strong>{items.length}</strong>
      </div>
      <div className="artifact-grid">
        {items.map((value, index) => {
          const item = asRecord(value);
          const metadata = asRecord(item.metadata);
          return (
            <article className="data-card" key={String(item.id ?? index)}>
              <div className="data-card-topline">
                <span>
                  {displayValue(item.artifactType, "Artifact").replaceAll(
                    "_",
                    " ",
                  )}
                </span>
                <Status>
                  {displayValue(item.privacyClassification, "Internal")}
                </Status>
              </div>
              <h3>
                {displayValue(
                  metadata.title ?? metadata.name,
                  `Capture ${index + 1}`,
                )}
              </h3>
              <dl className="data-list">
                <div>
                  <dt>Captured</dt>
                  <dd>{formatDate(item.capturedAt ?? item.createdAt)}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{formatBytes(item.bytes)}</dd>
                </div>
                <div>
                  <dt>Approved</dt>
                  <dd>{displayValue(metadata.approved)}</dd>
                </div>
                {showStorage ? (
                  <div>
                    <dt>Storage</dt>
                    <dd>{displayValue(metadata.storageAdapter)}</dd>
                  </div>
                ) : null}
                {showStorage ? (
                  <div>
                    <dt>Reference</dt>
                    <dd className="truncate-value">
                      {displayValue(item.objectKey)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FindingsLayout({ items }: { items: unknown[] }) {
  if (!items.length)
    return (
      <EmptyRunSection
        title="No findings"
        description="No issues were recorded for this run."
      />
    );
  return (
    <section className="run-section mt-4">
      <div className="run-section-heading">
        <div>
          <small>Review queue</small>
          <h2>QA findings</h2>
        </div>
        <strong>{items.length}</strong>
      </div>
      <Accordion type="multiple" className="w-full space-y-2">
        {items.map((value, index) => {
          const item = asRecord(value);
          const steps = Array.isArray(item.reproductionSteps)
            ? item.reproductionSteps
            : [];
          const itemValue = String(item.id ?? index);
          return (
            <AccordionItem key={itemValue} value={itemValue}>
              <AccordionTrigger className="w-full py-3.5 px-4">
                <div className="flex items-center justify-between flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <span className="font-mono text-xs text-[#555] shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                      <strong className="text-white text-sm font-semibold truncate">
                        {displayValue(item.title, `Finding ${index + 1}`)}
                      </strong>
                      <span className="text-[#8e9192] font-mono text-[11px] uppercase tracking-wider shrink-0">
                        {displayValue(item.category, "Finding")}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 mr-2">
                    <Status>{displayValue(item.severity, "Unrated")}</Status>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-3 border-t border-[#262626] bg-[#000000] text-xs text-[#c4c7c8] space-y-3">
                <p className="leading-relaxed text-sm text-[#e2e2e2]">
                  {displayValue(
                    item.description,
                    "No description was recorded.",
                  )}
                </p>
                {item.recommendation ? (
                  <div className="recommendation">
                    <small>Recommended action</small>
                    {String(item.recommendation)}
                  </div>
                ) : null}
                {steps.length ? (
                  <div className="space-y-1.5 pt-1">
                    <small className="block text-[#8e9192] font-mono text-[10px] uppercase tracking-wider mb-1">
                      Reproduction steps
                    </small>
                    <ol className="list-decimal pl-5 space-y-1 leading-relaxed text-xs">
                      {steps.map((step, stepIndex) => (
                        <li key={stepIndex}>{displayValue(step)}</li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}

type ReplayEvent = {
  eventType: string;
  timestamp: string;
  offset: number;
  metadata: Record<string, unknown>;
};

function replayEvents(data: Record<string, unknown> | null): ReplayEvent[] {
  const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
  const rawEvents = sessions.flatMap((session) =>
    Array.isArray(asRecord(session).events)
      ? (asRecord(session).events as unknown[])
      : [],
  );
  const firstTime = rawEvents.length
    ? new Date(String(asRecord(rawEvents[0]).timestamp)).valueOf()
    : 0;
  return rawEvents.map((value) => {
    const event = asRecord(value);
    const timestamp = String(event.timestamp ?? "");
    return {
      eventType: String(event.eventType ?? event.type ?? "EVENT"),
      timestamp,
      offset: Math.max(0, new Date(timestamp).valueOf() - firstTime) || 0,
      metadata: asRecord(event.metadata ?? event.payload),
    };
  });
}

function formatOffset(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `+${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function ReplayLayout({
  data,
  error,
}: {
  data: Record<string, unknown> | null;
  error: string | null;
}) {
  const events = useMemo(() => replayEvents(data), [data]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const selected = events[selectedIndex];
  const duration = events.at(-1)?.offset ?? 0;

  useEffect(() => {
    if (!playing || !events.length) return;
    if (selectedIndex >= events.length - 1) {
      setPlaying(false);
      return;
    }
    const gap = events[selectedIndex + 1].offset - events[selectedIndex].offset;
    const timer = window.setTimeout(
      () => setSelectedIndex((index) => index + 1),
      Math.min(3000, Math.max(50, gap / speed)),
    );
    return () => window.clearTimeout(timer);
  }, [events, playing, selectedIndex, speed]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input, textarea, select"))
        return;
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      }
      if (event.key === "ArrowRight") {
        setPlaying(false);
        setSelectedIndex((index) => Math.min(events.length - 1, index + 1));
      }
      if (event.key === "ArrowLeft") {
        setPlaying(false);
        setSelectedIndex((index) => Math.max(0, index - 1));
      }
      if (["1", "2", "3", "4"].includes(event.key))
        setSpeed([0.5, 1, 2, 4][Number(event.key) - 1]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [events.length]);

  if (error)
    return <EmptyRunSection title="Replay unavailable" description={error} />;
  if (!data) return <LoadingState />;
  if (!events.length)
    return (
      <EmptyRunSection
        title="No replay events"
        description="This run did not record a behavioral session timeline."
      />
    );
  return (
    <section className="run-section replay-viewer">
      <div className="run-section-heading">
        <div>
          <small>Behavioral session</small>
          <h2>Run replay</h2>
        </div>
        <strong>{events.length} events</strong>
      </div>
      <div className="replay-scrubber" aria-label="Event timeline">
        <div className="replay-track">
          <div
            className="replay-progress"
            style={{
              width: `${duration ? (selected.offset / duration) * 100 : 0}%`,
            }}
          />
          {events.map((event, index) => (
            <button
              key={`${event.timestamp}-${index}`}
              aria-label={`${event.eventType} at ${formatOffset(event.offset)}`}
              className={index === selectedIndex ? "selected" : ""}
              style={{
                left: `${duration ? (event.offset / duration) * 100 : 0}%`,
              }}
              onClick={() => {
                setPlaying(false);
                setSelectedIndex(index);
              }}
            />
          ))}
        </div>
        <div className="replay-time">
          <span>+0:00</span>
          <span>{formatOffset(duration)}</span>
        </div>
      </div>
      <div className="replay-controls">
        <div>
          <button
            aria-label="Previous event"
            disabled={selectedIndex === 0}
            onClick={() => {
              setPlaying(false);
              setSelectedIndex((index) => Math.max(0, index - 1));
            }}
          >
            ←
          </button>
          <button
            className="play"
            aria-label={playing ? "Pause replay" : "Play replay"}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? <CirclePause size={15} /> : <Play size={15} />}
          </button>
          <button
            aria-label="Next event"
            disabled={selectedIndex === events.length - 1}
            onClick={() => {
              setPlaying(false);
              setSelectedIndex((index) =>
                Math.min(events.length - 1, index + 1),
              );
            }}
          >
            →
          </button>
        </div>
        <code>
          {formatOffset(selected.offset)} / {formatOffset(duration)} · Event{" "}
          {selectedIndex + 1} of {events.length}
        </code>
        <div className="speed-controls">
          <small>Speed</small>
          {[0.5, 1, 2, 4].map((value) => (
            <button
              key={value}
              className={speed === value ? "selected" : ""}
              onClick={() => setSpeed(value)}
            >
              {value}x
            </button>
          ))}
        </div>
      </div>
      <div className="replay-body">
        <div className="replay-events">
          {events.map((event, index) => (
            <button
              key={`${event.eventType}-${index}`}
              className={index === selectedIndex ? "selected" : ""}
              onClick={() => setSelectedIndex(index)}
            >
              <span>{event.eventType.replaceAll("_", " ")}</span>
              <time>{formatOffset(event.offset)}</time>
              <small>
                {displayValue(
                  event.metadata.url ?? event.metadata.endpoint,
                  "Recorded interaction",
                )}
              </small>
            </button>
          ))}
        </div>
        <article className="replay-detail">
          <small>Selected event</small>
          <h3>{selected.eventType.replaceAll("_", " ")}</h3>
          <p>{formatDate(selected.timestamp)}</p>
          <dl className="data-list">
            {Object.entries(selected.metadata).map(([key, value]) => (
              <div key={key}>
                <dt>{key.replaceAll("_", " ")}</dt>
                <dd>{displayValue(value)}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </section>
  );
}

function GraphLayout({ run }: { run: Record<string, unknown> }) {
  const graph = asRecord(run.expectedGraphVersion);
  return (
    <section className="run-section">
      <div className="run-section-heading">
        <div>
          <small>Expected behavior</small>
          <h2>Run graph</h2>
        </div>
        <Status>{graph.status ? displayValue(graph.status) : "Linked"}</Status>
      </div>
      <div className="detail-surface">
        <Workflow size={26} />
        <div>
          <h3>{displayValue(graph.name, "Expected graph version")}</h3>
          <p>The run was evaluated against the behavior definition below.</p>
        </div>
        <dl className="data-list">
          <div>
            <dt>Version ID</dt>
            <dd>{displayValue(run.expectedGraphVersionId)}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{displayValue(graph.version)}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDate(graph.createdAt)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function ReconciliationLayout({
  run,
  findings,
}: {
  run: Record<string, unknown>;
  findings: unknown[];
}) {
  return (
    <section className="run-section">
      <div className="run-section-heading">
        <div>
          <small>Expected vs observed</small>
          <h2>Reconciliation</h2>
        </div>
        <Status>{run.status ? displayValue(run.status) : "Pending"}</Status>
      </div>
      <div className="reconciliation-grid">
        <article>
          <small>Expected definition</small>
          <strong>
            {run.expectedGraphVersionId ? "Connected" : "Not selected"}
          </strong>
          <p>
            {run.expectedGraphVersionId
              ? "A versioned graph provided the baseline for this run."
              : "This run has no expected graph baseline."}
          </p>
        </article>
        <article>
          <small>Observed evidence</small>
          <strong>
            {Array.isArray(run.artifacts) ? run.artifacts.length : 0} captures
          </strong>
          <p>Browser observations correlated during the guided run.</p>
        </article>
        <article>
          <small>Detected gaps</small>
          <strong>{findings.length} findings</strong>
          <p>
            {findings.length
              ? "Review the Findings tab for actionable differences."
              : "No evidence-backed gaps were recorded."}
          </p>
        </article>
      </div>
    </section>
  );
}

export function RunDetailPage() {
  const { projectId, runId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getRun, getRunReplay } = useDesktop();
  const [run, setRun] = useState<Record<string, unknown> | null>(null);
  const [replay, setReplay] = useState<Record<string, unknown> | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestedTab = searchParams.get("tab") ?? "evidence";
  const activeTab = RUN_TABS.some((tab) => tab.value === requestedTab)
    ? requestedTab
    : "evidence";
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    setLoading(true);
    setRunError(null);
    void Promise.resolve()
      .then(() => getRun(runId))
      .then((nextRun) => {
        if (!cancelled) setRun(nextRun);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setRunError(
            error instanceof Error
              ? error.message
              : "The run could not be loaded.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getRun, runId]);

  useEffect(() => {
    if (!runId || activeTab !== "replay" || replay || replayError) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => getRunReplay(runId))
      .then((nextReplay) => {
        if (!cancelled) setReplay(nextReplay);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setReplayError(
            error instanceof Error ? error.message : "Replay is unavailable.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, getRunReplay, replay, replayError, runId]);
  if (!projectId || !runId) return <ProjectRequired />;
  if (loading) return <LoadingState />;
  if (runError)
    return (
      <Page
        title="Run unavailable"
        description="Tellann could not load this QA run. The desktop window remains safe to use."
        actions={
          <Link className="button" to={`/projects/${projectId}/qa-runs`}>
            Back to QA runs
          </Link>
        }
      >
        <EmptyRunSection title="Unable to open run" description={runError} />
      </Page>
    );
  if (!run)
    return (
      <NotFoundPage
        title="Run unavailable"
        description="The run does not exist or is outside your organization."
      />
    );
  const status = String(run.status ?? "UNKNOWN");
  const artifacts = Array.isArray(run.artifacts) ? run.artifacts : [];
  const findings = Array.isArray(run.findings) ? run.findings : [];
  return (
    <Page
      title={`QA run ${runId.slice(0, 8)}`}
      description="Run metadata, evidence, findings, reconciliation, and report status."
      actions={<Status>{status}</Status>}
    >
      <div className="metric-grid">
        <Metric label="Artifacts" value={artifacts.length} />
        <Metric label="Findings" value={findings.length} />
        <Metric label="Mode" value={String(run.mode ?? "GUIDED")} />
        <Metric
          label="Report"
          value={
            run.reportId
              ? "Ready"
              : status === "COMPLETED"
                ? "Generating"
                : "Pending"
          }
        />
      </div>
      <Tabs
        value={activeTab}
        onValueChange={(tab) =>
          setSearchParams(tab === "evidence" ? {} : { tab }, { replace: true })
        }
      >
        <TabsList aria-label="QA run details">
          {RUN_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              <span>
                {tab.value === "findings"
                  ? findings.length
                  : tab.value === "artifacts" || tab.value === "evidence"
                    ? artifacts.length
                    : ""}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="evidence">
          <ArtifactLayout items={artifacts} heading="Captured evidence" />
        </TabsContent>
        <TabsContent value="findings">
          <FindingsLayout items={findings} />
        </TabsContent>
        <TabsContent value="replay">
          <ReplayLayout data={replay} error={replayError} />
        </TabsContent>
        <TabsContent value="graph">
          <GraphLayout run={run} />
        </TabsContent>
        <TabsContent value="reconciliation">
          <ReconciliationLayout run={run} findings={findings} />
        </TabsContent>
        <TabsContent value="artifacts">
          <ArtifactLayout
            items={artifacts}
            heading="Run artifacts"
            showStorage
          />
        </TabsContent>
      </Tabs>
      {run.reportId ? (
        <Link
          className="button primary mt-4"
          to={`/projects/${projectId}/reports/${encodeURIComponent(String(run.reportId))}?runId=${runId}`}
        >
          Open QA report
        </Link>
      ) : null}
    </Page>
  );
}

export function RunSubPage({ kind }: { kind: string }) {
  const { projectId, runId } = useParams();
  if (!projectId || !runId) return <ProjectRequired />;
  return (
    <Navigate
      replace
      to={`/projects/${projectId}/qa-runs/${runId}?tab=${encodeURIComponent(kind)}`}
    />
  );
}

export function ReportsPage() {
  const { projectId } = useParams();
  const { items, loading } = useRuns(projectId);
  if (!projectId) return <ProjectRequired />;
  const reportRuns = items.filter(
    (run) => run.reportId || run.status === "COMPLETED",
  );
  return (
    <Page
      title="Reports"
      description="Canonical quality reports generated from guided QA evidence and reconciliation."
    >
      {loading ? (
        <LoadingState />
      ) : reportRuns.length ? (
        <div className="project-grid">
          {reportRuns.map((run) => (
            <article className="project-card" key={run.id}>
              <div className="card-heading">
                <div>
                  <small>QA report</small>
                  <h2>{run.id.slice(0, 8)}</h2>
                </div>
                <Status>{run.reportId ? "Ready" : "Processing"}</Status>
              </div>
              <dl className="summary-grid">
                <div>
                  <dt>Environment</dt>
                  <dd>{run.environment?.name ?? "Environment"}</dd>
                </div>
                <div>
                  <dt>Findings</dt>
                  <dd>{run.findingCount}</dd>
                </div>
                <div>
                  <dt>Artifacts</dt>
                  <dd>{run.artifactCount}</dd>
                </div>
                <div>
                  <dt>Completed</dt>
                  <dd>
                    {run.endedAt
                      ? new Date(run.endedAt).toLocaleDateString()
                      : "Pending"}
                  </dd>
                </div>
              </dl>
              <Link
                className="button primary"
                to={`/projects/${projectId}/reports/${encodeURIComponent(run.reportId ?? `qa-report:${run.id}`)}?runId=${run.id}`}
              >
                Open report
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<BarChart3 size={36} />}
          title="No reports yet"
          description="Complete a browser-first QA run to generate the first report."
          action={
            <Link
              className="button primary"
              to={`/projects/${projectId}/qa-runs/new`}
            >
              Start QA run
            </Link>
          }
        />
      )}
    </Page>
  );
}

export function ReportDetailPage() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get("runId");
  const { getReport } = useDesktop();
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (runId)
      void getReport(runId)
        .then(setReport)
        .finally(() => setLoading(false));
    else setLoading(false);
  }, [getReport, runId]);
  if (!projectId) return <ProjectRequired />;
  if (loading) return <LoadingState />;
  if (!report)
    return (
      <NotFoundPage
        title="Report unavailable"
        description="The report is still processing, expired, or the source run was not provided."
      />
    );
  return (
    <Page
      title="Quality report"
      description={`${report.application.name} · ${report.environment.name} · generated ${new Date(report.generatedAt).toLocaleString()}`}
      actions={<Status>{report.status}</Status>}
    >
      <div className="metric-grid">
        <Metric
          label="Expected coverage"
          value={
            report.coverage.expected == null
              ? "Observational"
              : `${report.coverage.expected.toFixed(1)}%`
          }
        />
        <Metric
          label="Observed states"
          value={report.summary.observedStateCount}
        />
        <Metric
          label="Transitions"
          value={report.summary.observedTransitionCount}
        />
        <Metric
          label="High priority"
          value={report.summary.criticalOrHighFindings}
        />
      </div>
      <div className="two-column">
        <section className="content-card">
          <h2>Evidence and findings</h2>
          <p>
            {report.summary.artifactCount} approved artifacts and{" "}
            {report.summary.findingCount} evidence-backed findings.
          </p>
          <div className="w-full flex justify-end">
            <Link
              className="button mt-4 primary"
              to={`/projects/${projectId}/qa-runs/${report.runId}/evidence`}
            >
              Review evidence
            </Link>
          </div>
        </section>
        <section className="content-card">
          <h2>Correlation</h2>
          <p>
            Run {report.correlation.runId.slice(0, 8)} ·{" "}
            {report.correlation.sessions.length} observed session(s)
          </p>
          <div className="w-full flex justify-end">
            <Link
              className="button mt-4 primary"
              to={`/projects/${projectId}/qa-runs/${report.runId}/reconciliation`}
            >
              View reconciliation
            </Link>
          </div>
        </section>
      </div>
      {report.instrumentation ? (
        <section className="content-card mt-4">
          <div className="card-heading">
            <div>
              <small>Instrumentation manifest</small>
              <h2>{report.instrumentation.adapterId}</h2>
            </div>
            <Status>{report.instrumentation.status}</Status>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Plan</dt>
              <dd>{report.instrumentation.planId.slice(0, 8)}</dd>
            </div>
            <div>
              <dt>Adapter version</dt>
              <dd>{report.instrumentation.adapterVersion}</dd>
            </div>
            <div>
              <dt>Manifest version</dt>
              <dd>{report.instrumentation.manifestVersion}</dd>
            </div>
            <div>
              <dt>Validated</dt>
              <dd>
                {report.instrumentation.validatedAt
                  ? new Date(
                      report.instrumentation.validatedAt,
                    ).toLocaleString()
                  : "Not validated"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
      {report.findings.length ? (
        <FindingsLayout items={report.findings} />
      ) : (
        <EmptyRunSection
          title="No findings"
          description="This report did not identify any evidence-backed issues that need your attention."
        />
      )}
    </Page>
  );
}

export function ReportAuxPage({ kind }: { kind: "compare" | "export" }) {
  return (
    <GuardedFeaturePage
      title={kind === "compare" ? "Compare reports" : "Export report"}
      description={
        kind === "compare"
          ? "Compare run, revision, intent, and finding deltas."
          : "Review privacy, redaction, included sections, and export format."
      }
      phase={
        kind === "compare"
          ? "Canonical persisted comparison activates with report versioning."
          : "Existing web exports remain the current canonical export path."
      }
      fallback="Open the report in the web companion for the currently supported workflow."
    />
  );
}

export function GuardedFeaturePage({
  title,
  description,
  phase,
  fallback,
}: {
  title: string;
  description: string;
  phase: string;
  fallback: string;
}) {
  return (
    <Page title={title} description={description}>
      <GuardedFeatureContent phase={phase} fallback={fallback} />
    </Page>
  );
}

function GuardedFeatureContent({
  phase,
  fallback,
}: {
  phase: string;
  fallback: string;
}) {
  return (
    <section className="guarded-card">
      <ShieldCheck size={32} />
      <div>
        <Status>Staged capability</Status>
        <h2>{phase}</h2>
        <p>{fallback}</p>
      </div>
    </section>
  );
}

export function LoadingState() {
  return (
    <div
      className="p-6 space-y-6 w-full animate-pulse"
      role="status"
      aria-label="Loading page data"
    >
      <div className="space-y-2">
        <div className="h-7 w-48 bg-neutral-800 rounded-md" />
        <div className="h-4 w-96 bg-neutral-800/60 rounded-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="h-24 bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
          <div className="h-4 w-24 bg-neutral-800 rounded" />
          <div className="h-6 w-16 bg-neutral-800/60 rounded" />
        </div>
        <div className="h-24 bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
          <div className="h-4 w-28 bg-neutral-800 rounded" />
          <div className="h-6 w-20 bg-neutral-800/60 rounded" />
        </div>
        <div className="h-24 bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
          <div className="h-4 w-20 bg-neutral-800 rounded" />
          <div className="h-6 w-16 bg-neutral-800/60 rounded" />
        </div>
      </div>
      <div className="h-56 bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4">
        <div className="h-5 w-40 bg-neutral-800 rounded" />
        <div className="h-4 w-full bg-neutral-800/40 rounded" />
        <div className="h-4 w-4/5 bg-neutral-800/40 rounded" />
        <div className="h-4 w-2/3 bg-neutral-800/40 rounded" />
      </div>
    </div>
  );
}

export function NotFoundPage({
  title = "Page not found",
  description = "The requested desktop route does not exist.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Page title={title} description={description}>
      <EmptyState
        icon={<AlertTriangle size={36} />}
        title="Nothing was changed"
        description="Choose a valid project or return to the project list."
        action={
          <Link className="button primary" to="/projects">
            Projects
          </Link>
        }
      />
    </Page>
  );
}
