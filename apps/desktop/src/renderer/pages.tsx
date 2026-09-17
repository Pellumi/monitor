import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
} from "react";
import {
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
  FilePlus2,
  FileSearch,
  Folder,
  FolderOpen,
  GitBranch,
  Globe2,
  GraduationCap,
  Hourglass,
  HelpCircle,
  KeyRound,
  Lock,
  ArrowDownToLine,
  Clock,
  CloudUpload,
  ExternalLink,
  Filter,
  Gauge,
  MessageSquare,
  MoreHorizontal,
  MousePointerClick,
  Network,
  Play,
  Plus,
  Pencil,
  RefreshCw,
  SearchCode,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TerminalSquare,
  Trash2,
  TriangleAlert,
  Unlock,
  Workflow,
  X,
} from "lucide-react";
import { CodebaseAnalysisPanel } from "./codebase-analysis-panel";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { EntitlementModal } from "./components/entitlement-modal";
import {
  describeQaRunStartFailure,
  QaRunStartErrorModal,
  type QaRunStartFailure,
} from "./components/qa-run-start-error-modal";
import type {
  DeclaredFlowDetail,
  DeclaredFlowSummary,
  DeclaredStateSuggestion,
  DesktopApplication,
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
} from "@tellann/desktop-contracts";
import type { GuidedRunState, LiveEvidence } from "@tellann/browser-observer";
import { useDesktop, normalizeDesktopError } from "./desktop-context";
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
import {
  formatEnum,
  showMenu,
  statusTone,
  useSelectableList,
} from "./components/desktop-ui";
import { AppWindow, Info } from "lucide-react";
import { FlowEditor } from "./flow-editor/flow-editor";
import {
  flowInitializationHref,
  isFlowInitializable,
  isFlowReadyToRun,
  nextFlowToInitialize,
  nonProductionEnvironmentId,
} from "./flow-initialization";

function ActionTooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%) translateY(-6px)",
            backgroundColor: "var(--surface-0)",
            color: "var(--text-strong)",
            border: "1px solid var(--border-strong)",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 500,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.6)",
            letterSpacing: "0.02em",
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

/**
 * A routed view: a fixed toolbar (title, optional filter or view controls,
 * commands) over the scrolling content. `fill` gives the content the full
 * height so list and detail panes scroll on their own.
 */
export function Page({
  title,
  description,
  actions,
  toolbar,
  layout = "scroll",
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  layout?: "scroll" | "fill";
  children: ReactNode;
}) {
  // Short descriptions (an organization name) read as a subtitle; longer
  // explanations stay out of the way in a tooltip.
  const shortDescription = description && description.length <= 48;
  return (
    <div className={`page${layout === "fill" ? " page-fill" : ""}`}>
      <header className="page-toolbar">
        <div className="page-toolbar-title">
          <h1>{title}</h1>
          {shortDescription ? (
            <span className="page-toolbar-subtitle">{description}</span>
          ) : description ? (
            <span className="page-toolbar-hint" title={description} aria-label={description} role="img">
              <Info size={14} />
            </span>
          ) : null}
        </div>
        {toolbar ? <div className="page-toolbar-center">{toolbar}</div> : <div className="page-toolbar-spacer" />}
        {actions ? <div className="page-actions">{actions}</div> : null}
      </header>
      <div className="page-body">{children}</div>
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
  const text = typeof children === "string" ? children : null;
  return (
    <span className="status-pill" data-tone={text ? statusTone(text) : "neutral"}>
      <span aria-hidden="true" />
      {text ? formatEnum(text) : children}
    </span>
  );
}

function ApplicationRequired() {
  const location = useLocation();
  const section = location.pathname.split("/")[1] || "applications";
  return (
    <Navigate replace to={`/applications?next=${encodeURIComponent(section)}`} />
  );
}

function sdkSetupHref(applicationId: string, environmentId?: string) {
  return `/applications/${applicationId}/instrumentation?setup=connect${
    environmentId ? `&environmentId=${encodeURIComponent(environmentId)}` : ""
  }`;
}

type SdkConnectionStatus = "checking" | "connected" | "disconnected" | "unavailable";

function useSdkConnectionStatus(
  applicationId: string | undefined,
  environmentId: string,
): SdkConnectionStatus {
  const [status, setStatus] = useState<SdkConnectionStatus>("checking");
  useEffect(() => {
    if (!applicationId || !environmentId || !window.tellann?.setup) {
      setStatus("unavailable");
      return;
    }
    let cancelled = false;
    setStatus("checking");
    void window.tellann.setup
      .getSdkSetup(applicationId, environmentId)
      .then((setup) => {
        if (cancelled) return;
        setStatus(
          (setup?.readiness as { connected?: boolean } | undefined)?.connected
            ? "connected"
            : "disconnected",
        );
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, environmentId]);
  return status;
}

export function RouteResolver({ section }: { section: string }) {
  const lastProject = localStorage.getItem("tellann:last-project");
  return (
    <Navigate
      replace
      to={
        lastProject
          ? `/applications/${lastProject}/${section}`
          : `/applications?next=${section}`
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
        to={`/applications/${projectId}/qa-runs/${activeRun.runId}/live`}
      />
    );
  return (
    <Navigate replace to={projectId ? `/applications/${projectId}` : "/applications"} />
  );
}

const applicationKey = (application: { id: string }) => application.id;
const runKey = (run: QARunSummary) => run.id;
const flowKey = (flow: DeclaredFlowSummary) => flow.id;

export function ApplicationsPage() {
  const { applications, workspaces, runs, refreshRuns, attachWorkspace, busy } =
    useDesktop();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () =>
      applications.filter((item) =>
        `${item.name} ${item.organizationName}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [applications, query],
  );

  useEffect(() => {
    for (const application of applications) {
      if (!runs[application.id])
        void refreshRuns(application.id).catch(() => undefined);
    }
  }, [applications, refreshRuns, runs]);

  const openApplication = useCallback(
    (application: { id: string }) => {
      localStorage.setItem("tellann:last-project", application.id);
      navigate(
        next
          ? `/applications/${application.id}/${next}`
          : `/applications/${application.id}`,
      );
    },
    [navigate, next],
  );

  const list = useSelectableList({
    items: visible,
    getKey: applicationKey,
    onOpen: openApplication,
    onContextMenu: (application, event) => {
      const workspace = workspaces[application.id];
      void showMenu(event, [
        { id: "open", label: "Open", accelerator: "Enter" },
        { id: "run", label: "New QA run" },
        { type: "separator" },
        {
          id: "attach",
          label: workspace ? "Change project folder…" : "Attach project folder…",
          enabled: !busy,
        },
        { id: "reveal", label: "Show folder in Explorer", enabled: Boolean(workspace) },
        { type: "separator" },
        { id: "copy", label: "Copy application ID" },
      ]).then((choice) => {
        if (choice === "open") openApplication(application);
        if (choice === "run")
          navigate(`/applications/${application.id}/qa-runs/new`);
        if (choice === "attach") void attachWorkspace(application.id);
        if (choice === "reveal" && workspace)
          void window.tellann?.system.openPath(workspace.path);
        if (choice === "copy")
          void window.tellann?.system.copyText(application.id);
      });
    },
  });

  const selected = list.selected;
  const selectedWorkspace = selected ? workspaces[selected.id] : undefined;
  const selectedRun = selected ? runs[selected.id]?.[0] : undefined;

  return (
    <Page
      title="Applications"
      description="Connect a Tellann application to a local workspace, a development URL, or a staging URL."
      layout={applications.length ? "fill" : "scroll"}
      toolbar={
        applications.length ? (
          <input
            className="toolbar-search"
            data-search-input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter applications (Ctrl+F)"
            aria-label="Filter applications"
          />
        ) : null
      }
      actions={
        <Link className="button primary" to="/applications/new">
          <Plus size={15} />
          Create application
        </Link>
      }
    >
      {next ? (
        <div className="context-banner infobar">
          <Info size={16} />
          <span>
            Select an application to continue to <strong>{formatEnum(next.replace(/-/g, "_"))}</strong>.
          </span>
        </div>
      ) : null}
      {applications.length ? (
        <div className="master-detail">
          <div className="list-pane">
            <div
              className="list-view"
              aria-label="Applications"
              style={{ "--list-columns": "minmax(200px, 1.6fr) minmax(120px, 1fr) minmax(100px, 0.8fr) 130px" } as CSSProperties}
              {...list.listProps}
            >
              <div className="list-head" role="presentation">
                <span>Name</span>
                <span>Workspace</span>
                <span>Latest run</span>
                <span>Status</span>
              </div>
              {visible.map((application) => {
                const workspace = workspaces[application.id];
                const latestRun = runs[application.id]?.[0];
                return (
                  <div className="list-row" key={application.id} {...list.rowProps(application)}>
                    <span className="list-cell-primary">
                      <strong>{application.name}</strong>
                      <small>{application.organizationName}</small>
                    </span>
                    <span>{workspace?.name ?? "Not attached"}</span>
                    <span>{latestRun ? formatEnum(latestRun.status) : "None"}</span>
                    <span>
                      <Status>{workspace ? "Analyzed" : "Browser only"}</Status>
                    </span>
                  </div>
                );
              })}
              {!visible.length ? (
                <div className="list-empty">No applications match “{query}”.</div>
              ) : null}
            </div>
          </div>
          <aside className="detail-pane" aria-label="Application details">
            {selected ? (
              <div className="detail-content">
                <div className="detail-header">
                  <small>{selected.organizationName}</small>
                  <h2>{selected.name}</h2>
                </div>
                <div className="detail-actions">
                  <button className="button primary" type="button" onClick={() => openApplication(selected)}>
                    <AppWindow size={15} />
                    Open
                  </button>
                  <button
                    className="button"
                    type="button"
                    disabled={busy}
                    onClick={() => void attachWorkspace(selected.id)}
                  >
                    <FolderOpen size={15} />
                    {selectedWorkspace ? "Change folder" : "Attach folder"}
                  </button>
                </div>
                <dl className="property-list">
                  <div>
                    <dt>Workspace</dt>
                    <dd>{selectedWorkspace?.name ?? "Not attached"}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd className="mono selectable">{selectedWorkspace?.path ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Stack</dt>
                    <dd>{selectedWorkspace?.snapshot.frameworks[0]?.framework ?? "URL mode"}</dd>
                  </div>
                  <div>
                    <dt>Branch</dt>
                    <dd>{selectedWorkspace?.snapshot.branch ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Environments</dt>
                    <dd>
                      {selected.environments.map((environment) => formatEnum(environment.type)).join(", ") || "None"}
                    </dd>
                  </div>
                  <div>
                    <dt>Latest run</dt>
                    <dd>{selectedRun ? formatEnum(selectedRun.status) : "None"}</dd>
                  </div>
                  <div>
                    <dt>Findings</dt>
                    <dd>{selectedRun ? selectedRun.findingCount : "No run data"}</dd>
                  </div>
                  <div>
                    <dt>Application ID</dt>
                    <dd className="mono selectable">{selected.id}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="detail-empty">Select an application to see its details.</div>
            )}
          </aside>
        </div>
      ) : (
        <EmptyState
          icon={<Folder size={36} />}
          title="No applications available"
          description="Create a cloud application or sign in to an organization with an existing application."
          action={
            <Link className="button primary" to="/applications/new">
              Create application
            </Link>
          }
        />
      )}
    </Page>
  );
}

export function NewApplicationPage() {
  const {
    organizations,
    refreshOrganizations,
    createApplication,
    attachWorkspace,
    busy,
    clearError,
  } = useDesktop();
  const navigate = useNavigate();
  const [organizationId, setOrganizationId] = useState("");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [organizationsError, setOrganizationsError] = useState<string | null>(
    null,
  );
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);

  // A failed lookup must not read as "you belong to no organization", so the
  // reason is reported and the load can be retried.
  const loadOrganizations = useCallback(() => {
    setLoadingOrganizations(true);
    setOrganizationsError(null);
    void refreshOrganizations()
      .catch((cause) => setOrganizationsError(normalizeDesktopError(cause)))
      .finally(() => setLoadingOrganizations(false));
  }, [refreshOrganizations]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  // Only default the selection; never overwrite a choice the user has made.
  useEffect(() => {
    setOrganizationId((current) =>
      current && organizations.some((item) => item.id === current)
        ? current
        : (organizations[0]?.id ?? ""),
    );
  }, [organizations]);

  const trimmedName = name.trim();

  const complete = async () => {
    if (!organizationId || !trimmedName) return;
    setFormError(null);
    let created;
    try {
      created = await createApplication({
        organizationId,
        name: trimmedName,
        summary: summary.trim() || null,
      });
    } catch (cause) {
      // The cloud owns the plan limit and the Owner/Admin check, so its message
      // is the one worth showing — and it belongs beside the form rather than in
      // the shell banner, which is why that one is cleared.
      setFormError(normalizeDesktopError(cause));
      clearError();
      return;
    }
    if (!created) {
      setFormError(
        "The application was created but could not be loaded. Reopen the Applications list to continue.",
      );
      return;
    }
    localStorage.setItem("tellann:last-project", created.id);
    // The folder picker is always offered and always optional: cancelling it
    // leaves the application browser-only, and a folder can be attached later
    // from the Applications list or the Workspace page.
    // With a folder attached, connecting the SDK is the next step, so go straight
    // to it rather than the overview.
    const attached = await attachWorkspace(created.id).catch(() => null);
    navigate(
      attached
        ? sdkSetupHref(created.id, nonProductionEnvironmentId(created))
        : `/applications/${created.id}`,
    );
  };

  return (
    <Page
      title="Create application"
      description="Register a new application in your organization, then choose a local folder for it — or skip the folder and attach one whenever you like."
    >
      <section className="wizard-card">
        <div className="step-label">Step 1 of 2 / Organization</div>
        <label>
          Organization
          <SelectField
            value={organizationId}
            onValueChange={setOrganizationId}
            options={organizations.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            placeholder={
              organizations.length
                ? "Select organization"
                : loadingOrganizations
                  ? "Loading organizations…"
                  : organizationsError
                    ? "Organizations could not be loaded"
                    : "No organization available"
            }
          />
        </label>
        {organizationsError ? (
          <div className="global-error" role="alert">
            <span>{organizationsError}</span>
            <button onClick={loadOrganizations} disabled={loadingOrganizations}>
              Retry
            </button>
          </div>
        ) : null}

        <div className="step-label">Step 2 of 2 / Application</div>
        <label>
          Application name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Production E-commerce Store"
            maxLength={120}
          />
        </label>
        <label>
          Summary (optional)
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What this application does, in a sentence or two."
            rows={3}
            maxLength={500}
          />
        </label>

        {formError ? (
          <div className="global-error" role="alert">
            <span>{formError}</span>
          </div>
        ) : null}

        <button
          className="button primary"
          disabled={!organizationId || !trimmedName || busy}
          onClick={() => void complete()}
        >
          {busy ? "Creating…" : "Create application"}
          <ArrowRight size={16} />
        </button>
        {/* <p className="wizard-footnote">
          The application is created in Tellann Cloud, so it appears in the web
          dashboard immediately and everyone signed in is notified. A folder
          picker opens next for read-only analysis, then Tellann takes you
          straight to connecting the SDK. Skip the folder to stay browser-only
          and attach one later from the Applications list.
        </p> */}
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

function formatRunStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ");
}

type JourneyStep = {
  title: string;
  why: string;
  done: boolean;
  /** False while the step's status is still being fetched. */
  known: boolean;
  doneDetail: string;
  action: ReactNode;
  /** Where the step is done or changed; its progress row links there. */
  href: string;
};

/**
 * The overview answers one question: what should I do next? Each setup step
 * unlocks the one after it (a Flow needs the SDK, a run needs a Flow), so the
 * first incomplete step is always the next action. Folder details live on the
 * Workspace page, reachable from the sidebar.
 */
export function ApplicationOverviewPage() {
  const {
    projectId,
    application,
    workspace,
    runs,
    refreshRuns,
    attachWorkspace,
    getDeclaredFlows,
    busy,
  } = useProject();
  useEffect(() => {
    if (projectId) void refreshRuns(projectId).catch(() => undefined);
  }, [projectId, refreshRuns]);
  const sdkEnvironmentId = nonProductionEnvironmentId(application);
  const sdkStatus = useSdkConnectionStatus(projectId, sdkEnvironmentId);
  // The Flows themselves, not just a ready/not-ready flag: the "Initialize a Flow"
  // step has to name the Flow it sends you to, or it lands on Intent with nothing
  // selected and no way forward.
  const [flows, setFlows] = useState<DeclaredFlowSummary[] | null>(null);
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setFlows(null);
    void getDeclaredFlows(projectId)
      .then((items) => {
        if (!cancelled) setFlows(items);
      })
      .catch(() => {
        if (!cancelled) setFlows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [getDeclaredFlows, projectId]);

  if (!projectId) return <ApplicationRequired />;
  if (!application)
    return (
      <NotFoundPage
        title="Application unavailable"
        description="This application does not exist or is outside your current organization access."
      />
    );

  const latestRun = runs[projectId]?.[0];
  const flowReady = flows === null ? null : flows.some(isFlowReadyToRun);
  const flowToInitialize = nextFlowToInitialize(flows ?? []);
  // Without a published Flow to point at there is nothing to initialize yet, so
  // the step falls back to Intent, where one gets declared and published first.
  const initializeFlowHref =
    flowInitializationHref(projectId, flowToInitialize, sdkEnvironmentId) ??
    `/applications/${projectId}/intent`;
  const steps: JourneyStep[] = [
    {
      title: "Attach your project folder",
      why: "Tellann reads your code, read-only, to set up the SDK and map your Flow.",
      done: Boolean(workspace),
      known: true,
      doneDetail: workspace?.name ?? "",
      href: `/applications/${projectId}/workspace`,
      action: (
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void attachWorkspace(projectId).catch(() => undefined)}
        >
          <Folder size={15} />
          Choose project folder
        </button>
      ),
    },
    {
      title: "Connect the Tellann SDK",
      why: "Your app sends telemetry, so every run captures what happens inside it.",
      done: sdkStatus === "connected",
      known: sdkStatus !== "checking",
      doneDetail: "Connected",
      href: sdkSetupHref(projectId, sdkEnvironmentId),
      action: (
        <Link
          className="button primary"
          to={sdkSetupHref(projectId, sdkEnvironmentId)}
        >
          <Code2 size={15} />
          Connect SDK
        </Link>
      ),
    },
    {
      title: "Initialize a Flow",
      why: "Tell Tellann which user journey to check, such as sign-up or checkout.",
      done: flowReady === true,
      known: flowReady !== null,
      doneDetail: "Ready to run",
      href: initializeFlowHref,
      action: (
        <Link className="button primary" to={initializeFlowHref}>
          <Workflow size={15} />
          {flowToInitialize
            ? `Initialize “${flowToInitialize.name}”`
            : "Open Intent"}
        </Link>
      ),
    },
    {
      title: "Run your first walkthrough",
      why: "Walk through the Flow once in the guided browser. Tellann records the evidence and writes your report.",
      done: Boolean(latestRun),
      known: true,
      doneDetail: latestRun ? formatRunStatus(String(latestRun.status)) : "",
      href: latestRun
        ? `/applications/${projectId}/qa-runs/${latestRun.id}`
        : `/applications/${projectId}/qa-runs/new`,
      action: (
        <Link
          className="button primary"
          to={`/applications/${projectId}/qa-runs/new`}
        >
          <Play size={15} />
          Start a QA run
        </Link>
      ),
    },
  ];
  const nextIndex = steps.findIndex((step) => !step.done);
  const nextStep = nextIndex === -1 ? null : steps[nextIndex];
  const reportHref =
    latestRun && (latestRun.reportId || latestRun.status === "COMPLETED")
      ? `/applications/${projectId}/reports/${encodeURIComponent(latestRun.reportId ?? `qa-report:${latestRun.id}`)}?runId=${latestRun.id}`
      : null;

  return (
    <Page title={application.name} description={application.organizationName}>
      {/* A wrong branch can block runs, so it outranks the next step. */}
      <QaBranchNotice projectId={projectId} hideWhenCompliant />
      {nextStep && !nextStep.known ? (
        <section className="content-card next-step-card" aria-busy="true">
          <span className="step-label">Next step</span>
          <h2>Checking your setup…</h2>
        </section>
      ) : nextStep ? (
        <section className="content-card next-step-card">
          <span className="step-label">
            Next step · {nextIndex + 1} of {steps.length}
          </span>
          <h2>{nextStep.title}</h2>
          <p>{nextStep.why}</p>
          <div className="card-actions">{nextStep.action}</div>
        </section>
      ) : latestRun ? (
        <section className="content-card next-step-card is-complete">
          <span className="step-label">
            Latest run · {formatRunStatus(String(latestRun.status))}
          </span>
          <h2>
            {reportHref
              ? `${latestRun.findingCount} finding${latestRun.findingCount === 1 ? "" : "s"} in your latest run`
              : "Your latest run is being processed"}
          </h2>
          <p>
            {reportHref
              ? "Review the report, fix what matters, then run the Flow again to confirm."
              : "The report appears here once processing finishes."}
          </p>
          <div className="card-actions">
            {reportHref ? (
              <Link className="button primary" to={reportHref}>
                <BarChart3 size={15} />
                View report
              </Link>
            ) : null}
            <Link
              className={`button ${reportHref ? "" : "primary"}`}
              to={`/applications/${projectId}/qa-runs/new`}
            >
              <Play size={15} />
              New QA run
            </Link>
          </div>
        </section>
      ) : null}

      <ol className="overview-progress" aria-label="Setup progress">
        {steps.map((step, index) => {
          const current = index === nextIndex && step.known;
          return (
            <li
              key={step.title}
              className={`overview-progress-step${step.done ? " is-done" : current ? " is-current" : ""}`}
            >
              <Link
                className="overview-progress-link"
                to={step.href}
                aria-current={current ? "step" : undefined}
              >
                <span className="overview-progress-marker" aria-hidden="true">
                  {step.done ? <Check size={12} /> : index + 1}
                </span>
                <span className="overview-progress-text">
                  <strong>{step.title}</strong>
                  {step.done && step.doneDetail ? (
                    <small>{step.doneDetail}</small>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {workspace ? (
        <div className="overview-analysis">
          <CodebaseAnalysisPanel applicationId={projectId} collapsible />
        </div>
      ) : null}
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
  kind: "removed" | "added" | "context" | "meta";
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

type DiffOp = { kind: "context" | "removed" | "added"; text: string };

// The instrumentation "diff" payload is not a real unified diff — the adapter
// stores the whole previous file as one block and the whole new file as another
// (see instrumentation-adapters `apply`). Diff the two blocks here so the viewer
// shows only the lines that actually changed instead of "every line removed and
// re-added".
function lineDiff(before: string[], after: string[]): DiffOp[] {
  const n = before.length;
  const m = after.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        before[i] === after[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push({ kind: "context", text: before[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ kind: "removed", text: before[i] });
      i += 1;
    } else {
      ops.push({ kind: "added", text: after[j] });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ kind: "removed", text: before[i] });
    i += 1;
  }
  while (j < m) {
    ops.push({ kind: "added", text: after[j] });
    j += 1;
  }
  return ops;
}

// Keep `context` lines around each change and collapse long unchanged runs.
function toHunkLines(ops: DiffOp[], context = 3): InstrumentationDiffLine[] {
  const changedIndexes = ops.flatMap((op, index) =>
    op.kind === "context" ? [] : [index],
  );
  if (!changedIndexes.length) return [];
  const keep = new Set<number>();
  for (const index of changedIndexes) {
    for (
      let k = Math.max(0, index - context);
      k <= Math.min(ops.length - 1, index + context);
      k += 1
    ) {
      keep.add(k);
    }
  }
  const lines: InstrumentationDiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let previousKept = -1;
  ops.forEach((op, index) => {
    if (op.kind === "context") {
      oldLine += 1;
      newLine += 1;
    } else if (op.kind === "removed") {
      oldLine += 1;
    } else {
      newLine += 1;
    }
    if (!keep.has(index)) return;
    if (previousKept >= 0 && index > previousKept + 1) {
      lines.push({
        kind: "meta",
        oldLine: null,
        newLine: null,
        text: "⋯ unchanged lines",
      });
    }
    lines.push({
      kind: op.kind,
      oldLine: op.kind === "added" ? null : oldLine,
      newLine: op.kind === "removed" ? null : newLine,
      text: op.text,
    });
    previousKept = index;
  });
  return lines;
}

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
      const previousLines =
        previous === "" ? [] : previous.replace(/\n$/, "").split("\n");
      const updatedLines =
        updated === "" ? [] : updated.replace(/\n$/, "").split("\n");
      const ops = lineDiff(previousLines, updatedLines);
      return [
        {
          path: pathMatch[2],
          deletions: ops.filter((op) => op.kind === "removed").length,
          additions: ops.filter((op) => op.kind === "added").length,
          lines: toHunkLines(ops),
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
                    {line.kind === "added"
                      ? "+"
                      : line.kind === "removed"
                        ? "-"
                        : ""}
                  </span>
                  <code role="cell">
                    {line.kind === "meta" ? line.text : line.text || " "}
                  </code>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/**
 * The QA review branch gate.
 *
 * Every member clones the project wherever they like and works on whatever
 * branch they like, so the only thing the organisation can hold constant is the
 * branch name. This surfaces the verdict for THIS machine and offers the two
 * ways out: switch it yourself, or let Tellann switch it for you under an
 * explicit, revocable grant.
 */
function QaBranchNotice({
  projectId,
  hideWhenCompliant = false,
}: {
  projectId: string;
  /** Show only when something needs action, e.g. on the overview. */
  hideWhenCompliant?: boolean;
}) {
  const {
    branchCompliance,
    refreshBranchCompliance,
    setBranchAgentCheckout,
    grantQaBranchCheckout,
    switchToQaBranch,
    restoreWorkspaceBranch,
    busy,
  } = useDesktop();
  const [notice, setNotice] = useState<string | null>(null);
  const compliance = branchCompliance[projectId];

  useEffect(() => {
    void refreshBranchCompliance(projectId);
  }, [projectId, refreshBranchCompliance]);

  if (!compliance || compliance.status === "NO_POLICY") return null;
  // Keep a just-switched notice visible so its outcome message is not lost.
  if (hideWhenCompliant && compliance.status === "COMPLIANT" && !notice)
    return null;

  const compliant = compliance.status === "COMPLIANT";
  const mismatch = compliance.status === "BRANCH_MISMATCH";
  const accent = compliant
    ? "#2f6b3f"
    : compliance.blocksRun
      ? "#7a2e2e"
      : "#7a5a2e";

  const handleSwitch = async () => {
    setNotice(null);
    const result = await switchToQaBranch(projectId);
    if (!result) return;
    if (!result.switched) {
      setNotice(
        `Could not switch branch: ${result.reason ?? "unknown reason"}.`,
      );
      return;
    }
    setNotice(
      result.stashRef
        ? `Switched to ${result.branch}. Your uncommitted changes were stashed and can be restored.`
        : `Switched to ${result.branch}.`,
    );
  };

  const handleAgentCheckoutPolicy = async (allow: boolean) => {
    setNotice(null);
    await setBranchAgentCheckout(projectId, allow);
    setNotice(
      allow
        ? "Agent branch switching is now enabled for this application. Grant this workspace access to let Tellann switch it."
        : "Agent branch switching has been disabled for this application.",
    );
  };

  return (
    <div
      style={{
        border: `1px solid ${accent}`,
        borderRadius: 8,
        padding: "14px 16px",
        marginBottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {compliant ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
        <strong style={{ fontSize: 13 }}>
          {compliant
            ? "QA review branch"
            : compliance.blocksRun
              ? "QA review branch required"
              : "QA review branch warning"}
        </strong>
        {compliance.requiredBranch ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              opacity: 0.8,
            }}
          >
            <GitBranch size={13} />
            {compliance.requiredBranch}
          </span>
        ) : null}
      </div>

      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
        {compliance.message}
      </p>

      {mismatch && compliance.dirty ? (
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, opacity: 0.85 }}>
          This workspace has uncommitted changes. They will be stashed before
          the switch and can be restored afterwards, never discarded.
        </p>
      ) : null}

      {notice ? (
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>{notice}</p>
      ) : null}

      {mismatch ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            className="button"
            disabled={busy}
            onClick={() => void refreshBranchCompliance(projectId)}
          >
            <RefreshCw size={14} />I switched it myself
          </button>

          {!compliance.agentCheckoutAllowed ? (
            compliance.canManageBranchPolicy ? (
              <button
                className="button"
                disabled={busy}
                onClick={() => void handleAgentCheckoutPolicy(true)}
              >
                <Unlock size={14} />
                Enable agent branch switching
              </button>
            ) : (
              <span style={{ fontSize: 12, opacity: 0.7, alignSelf: "center" }}>
                An Owner or Admin has not enabled agent-performed branch
                switching.
              </span>
            )
          ) : compliance.agentCheckoutGranted ? (
            <button
              className="button"
              disabled={busy}
              onClick={() => void handleSwitch()}
            >
              <GitBranch size={14} />
              Switch to {compliance.requiredBranch}
            </button>
          ) : (
            <button
              className="button"
              disabled={busy}
              onClick={() => void grantQaBranchCheckout(projectId)}
            >
              <Unlock size={14} />
              Allow Tellann to switch it
            </button>
          )}

          {compliance.agentCheckoutAllowed &&
          compliance.canManageBranchPolicy ? (
            <button
              className="button"
              disabled={busy}
              onClick={() => void handleAgentCheckoutPolicy(false)}
              style={{ opacity: 0.7 }}
            >
              <Lock size={14} />
              Disable agent branch switching
            </button>
          ) : null}
        </div>
      ) : null}

      {compliant ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              const result = await restoreWorkspaceBranch(projectId);
              if (!result) return;
              setNotice(
                result.restored
                  ? `Restored ${result.branch}${result.stashRestored ? " and reapplied your stashed changes" : ""}.`
                  : `Could not restore your previous branch: ${result.reason ?? "unknown reason"}.`,
              );
            }}
          >
            <RefreshCw size={14} />
            Restore my previous branch
          </button>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceAttachButton() {
  const { projectId, workspace, attachWorkspace, busy } = useProject();
  if (!projectId) return null;
  return (
    <button
      className="button"
      disabled={busy}
      onClick={() => void attachWorkspace(projectId)}
    >
      <RefreshCw size={15} />
      {workspace ? "Change folder" : "Attach folder"}
    </button>
  );
}

// The full workspace view, on the Workspace route. The overview shows only the
// branch warning (when action is needed) and the analysis summary.
export function WorkspaceDetails() {
  const {
    projectId,
    application,
    workspace,
    attachWorkspace,
    cloneWorkspace,
    busy,
  } = useProject();
  const [pathCopied, setPathCopied] = useState(false);
  if (!projectId || !application) return null;
  return (
    <>
      <QaBranchNotice projectId={projectId} />
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
                      Team repository available
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
                  Repository context is registered for{" "}
                  <strong>{application.name}</strong>, but no folder is
                  connected on this device. Attach an existing checkout or clone
                  the team repository to begin local review.
                </p>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    className="button primary font-mono text-xs uppercase"
                    onClick={() => void attachWorkspace(projectId)}
                    disabled={busy}
                  >
                    Attach existing folder
                  </button>
                  {cloudWs.repositoryCloneUrl ? (
                    <button
                      className="button font-mono text-xs uppercase"
                      onClick={() =>
                        void cloneWorkspace(
                          projectId,
                          cloudWs.repositoryCloneUrl,
                        )
                      }
                      disabled={busy}
                    >
                      Clone from GitHub
                    </button>
                  ) : null}
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
            <div style={{ marginBottom: "16px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--muted, var(--text-muted))",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                Local folder on this device
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  background: "var(--surface-0)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "8px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    overflow: "hidden",
                    flex: 1,
                  }}
                >
                  <Folder
                    size={15}
                    style={{ color: "var(--text-strong)", flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "12px",
                      color: "var(--text-strong)",
                      wordBreak: "break-all",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {workspace.path}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flexShrink: 0,
                  }}
                >
                  <ActionTooltip content="Open in File Explorer">
                    <button
                      type="button"
                      style={{
                        background: "var(--surface-1)",
                        border: "1px solid var(--border)",
                        color: "var(--text-strong)",
                        padding: "6px 10px",
                        borderRadius: "4px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        cursor: "default",
                        transition: "all 0.15s ease",
                      }}
                      onClick={async () => {
                        if (workspace.path) {
                          try {
                            if (
                              typeof window.tellann?.system?.openPath ===
                              "function"
                            ) {
                              await window.tellann.system.openPath(
                                workspace.path,
                              );
                            } else if (
                              typeof window.tellann?.system?.copyText ===
                              "function"
                            ) {
                              await window.tellann.system.copyText(
                                workspace.path,
                              );
                            } else {
                              await navigator.clipboard.writeText(
                                workspace.path,
                              );
                            }
                          } catch (err) {
                            console.error("Could not open folder path", err);
                          }
                        }
                      }}
                      aria-label={`Open folder in file explorer: ${workspace.path}`}
                    >
                      <FolderOpen size={14} />
                      <span style={{ fontSize: "11px", fontWeight: 500 }}>
                        Open
                      </span>
                    </button>
                  </ActionTooltip>
                  <ActionTooltip
                    content={pathCopied ? "Copied!" : "Copy path to clipboard"}
                  >
                    <button
                      type="button"
                      style={{
                        background: "var(--surface-1)",
                        border: "1px solid var(--border)",
                        color: "var(--text-strong)",
                        padding: "6px 8px",
                        borderRadius: "4px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "default",
                        transition: "all 0.15s ease",
                      }}
                      onClick={async () => {
                        if (workspace.path) {
                          if (
                            typeof window.tellann?.system?.copyText ===
                            "function"
                          ) {
                            await window.tellann.system.copyText(
                              workspace.path,
                            );
                          } else {
                            await navigator.clipboard.writeText(workspace.path);
                          }
                          setPathCopied(true);
                          setTimeout(() => setPathCopied(false), 1500);
                        }
                      }}
                      aria-label="Copy folder path"
                    >
                      {pathCopied ? (
                        <Check size={14} style={{ color: "var(--text-strong)" }} />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </ActionTooltip>
                </div>
              </div>
            </div>
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
      {workspace && projectId ? <CodebaseAnalysisPanel applicationId={projectId} /> : null}
    </>
  );
}

export function WorkspacePage() {
  const { projectId, application } = useProject();
  if (!projectId) return <ApplicationRequired />;
  if (!application)
    return (
      <NotFoundPage
        title="Application unavailable"
        description="Select another application."
      />
    );
  return (
    <Page
      title="Workspace"
      description="Local repository access, read-only analysis, detected stack, and redaction status."
      actions={<WorkspaceAttachButton />}
    >
      <WorkspaceDetails />
    </Page>
  );
}

export function SourcesPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const {
    getDocuments,
    importDocuments,
    getDocumentImport,
    resumeDocumentImport,
    cancelDocumentImport,
    dismissDocumentImport,
    onDocumentImportProgress,
    refreshApplications,
    busy,
  } = useDesktop();
  const [documents, setDocuments] = useState<SourceDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [unentitled, setUnentitled] = useState(false);
  const [entitlementModalOpen, setEntitlementModalOpen] = useState(false);
  const [importView, setImportView] = useState<DocumentImportView | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const refresh = async () => {
    if (!projectId) return;
    try {
      const access = await getDocuments(projectId);
      if (access.accessDenied) {
        const available = await refreshApplications().catch(() => []);
        const fallback = available[0]?.id;
        navigate(fallback ? `/applications/${fallback}/sources` : "/applications", {
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

  // Uploads run in the desktop's background import, which outlives this page.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void getDocumentImport(projectId)
      .then(async (view) => {
        if (cancelled) return;
        setImportView(view);
        if (view && !view.running && ACTIVE_IMPORT_STAGES.includes(view.stage)) {
          const resumed = await resumeDocumentImport(projectId);
          if (!cancelled) setImportView(resumed);
        }
      })
      .catch(() => undefined);
    const unsubscribe = onDocumentImportProgress((view) => {
      if (view.applicationId === projectId) setImportView(view);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [projectId]);

  // Show each file in the library as soon as its status changes.
  const importProgressKey = importView
    ? `${importView.id}:${importView.stage}:${importView.files.map((file) => file.status).join(",")}`
    : "";
  useEffect(() => {
    if (importProgressKey) void refresh();
  }, [importProgressKey]);

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

  if (!projectId) return <ApplicationRequired />;

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
    setImportMessage(null);
    try {
      const view = await importDocuments(projectId, { generateDraft: false });
      if (view) setImportView(view);
    } catch (err: any) {
      if (String(err?.message ?? err).includes("FEATURE_NOT_ENTITLED")) {
        setUnentitled(true);
        setEntitlementModalOpen(true);
      }
      setImportMessage(intentErrorMessage(err));
    }
  };

  const updateImport = (request: Promise<DocumentImportView | null>) => {
    void request
      .then((view) => {
        if (view) setImportView(view);
      })
      .catch((error) => setImportMessage(intentErrorMessage(error)));
  };

  const dismissImport = async () => {
    await dismissDocumentImport(projectId).catch(() => undefined);
    setImportView(null);
  };

  return (
    <Page
      title="Sources"
      description="Local document extraction with approved, redacted evidence synchronized to Tellann."
      actions={
        <button
          className="button primary"
          disabled={busy || isDocumentImportActive(importView)}
          title={
            isDocumentImportActive(importView)
              ? "Wait for the current import to finish or stop it first."
              : undefined
          }
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
      {importMessage ? (
        <div className="context-banner" role="status">
          {importMessage}
        </div>
      ) : null}
      {importView ? (
        <DocumentImportProgress
          view={importView}
          busy={busy}
          cancellingGeneration={false}
          onStop={() => updateImport(cancelDocumentImport(projectId))}
          onCancelGeneration={() => updateImport(cancelDocumentImport(projectId))}
          onCheckAgain={() => updateImport(resumeDocumentImport(projectId))}
          onRetry={() => void dismissImport().then(upload)}
          onDismiss={() => void dismissImport()}
          onReviewDraft={() => {
            if (importView.draftId)
              navigate(`/applications/${projectId}/intent/drafts/${importView.draftId}`);
          }}
        />
      ) : null}
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
                      to={`/applications/${projectId}/intent`}
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
      title="Application activity"
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

// Character limits for the flow definition fields.
const FLOW_NAME_MAX = 20;
const FLOW_PURPOSE_MAX = 200;
const FLOW_SCOPE_MAX = 200;

// Textarea that caps its length and grows to fit its content so all text stays visible.
function CappedTextarea({
  value,
  onChange,
  maxLength,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <span style={{ display: "block", width: "100%" }}>
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
        style={{ resize: "none", overflow: "hidden", width: "100%" }}
      />
      <span
        style={{
          display: "block",
          marginTop: 4,
          textAlign: "right",
          fontSize: 11,
          opacity: 0.6,
        }}
      >
        {Math.max(0, maxLength - value.length)} characters left
      </span>
    </span>
  );
}

/**
 * Confirms permanent deletion of a declared flow. Mirrors the web editor's
 * "type DELETE <flow name>" gate because the delete also removes the QA runs,
 * reports, versions, bindings and scans recorded against the flow.
 */
function DeleteFlowDialog({
  flow,
  busy,
  onCancel,
  onConfirm,
}: {
  flow: { id: string; name: string };
  busy: boolean;
  onCancel(): void;
  onConfirm(): Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expected = `DELETE ${flow.name}`;
  const canDelete = !busy && !deleting && typed.trim() === expected;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleting, onCancel]);
  const confirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (cause) {
      setError(
        String(cause instanceof Error ? cause.message : cause)
          .replace(/^Error invoking remote method '[^']+':\s*/i, "")
          .slice(0, 240) || "The flow could not be deleted.",
      );
      setDeleting(false);
    }
  };
  return (
    <div
      className="desktop-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) onCancel();
      }}
    >
      <form
        className="desktop-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-flow-title"
        aria-describedby="delete-flow-description"
        onSubmit={(event) => {
          event.preventDefault();
          if (canDelete) void confirm();
        }}
      >
        <h2 id="delete-flow-title">Delete “{flow.name}”?</h2>
        <p id="delete-flow-description">
          This permanently deletes the flow, its published versions, and the QA
          runs, reconciliation reports, bindings and scans recorded against it.
          It cannot be undone. Your documents are kept.
        </p>
        <label className="dialog-field">
          <span>
            Type <code className="confirm-phrase">{expected}</code> to confirm
          </span>
          <input
            autoFocus
            value={typed}
            disabled={deleting}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="dialog-error">
            {error}
          </p>
        ) : null}
        <div className="desktop-modal-actions">
          <button type="submit" className="destructive" disabled={!canDelete}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button type="button" disabled={deleting} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function ManualIntentBuilder({
  projectId,
  flows,
  refreshFlows,
  initialFlowId,
  showPlanBanner = true,
  onFlowDeleted,
}: {
  projectId: string;
  flows: DeclaredFlowSummary[];
  refreshFlows(): Promise<DeclaredFlowSummary[]>;
  initialFlowId?: string;
  showPlanBanner?: boolean;
  /** Called after the open flow is deleted; without it the builder switches to another flow. */
  onFlowDeleted?(flowId: string): void;
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
    deleteDeclaredFlow,
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
  const [copiedFlowLabel, setCopiedFlowLabel] = useState<string | null>(null);
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

  const [flowDeleteOpen, setFlowDeleteOpen] = useState(false);
  const deleteActiveFlow = async () => {
    if (!activeFlow) return;
    const deleted = { id: activeFlow.id, name: activeFlow.name };
    await deleteDeclaredFlow(projectId, deleted.id);
    setFlowDeleteOpen(false);
    if (onFlowDeleted) {
      onFlowDeleted(deleted.id);
      return;
    }
    // Refresh first so the builder falls back to a flow that still exists.
    await refreshFlows();
    setActiveFlow(null);
    setSelectedFlowId("");
    setMessage(`“${deleted.name}” was deleted.`);
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

  const copyFlowLabel = async (key: string, value: string) => {
    try {
      if (typeof window.tellann?.system?.copyText === "function") {
        await window.tellann.system.copyText(value);
      } else {
        await navigator.clipboard.writeText(value);
      }
      setCopiedFlowLabel(key);
      window.setTimeout(
        () =>
          setCopiedFlowLabel((current) => (current === key ? null : current)),
        1500,
      );
    } catch {
      setMessage(
        "Could not copy the label. Select the text and copy it manually.",
      );
    }
  };

  const initializeActiveFlow = async () => {
    // Production is observation-only — initializing against it is rejected.
    const environmentId = nonProductionEnvironmentId(application);
    if (!activeFlow?.publishedVersionId || !environmentId) return;
    const setup = await window.tellann?.setup.getSdkSetup(
      projectId,
      environmentId,
    );
    if (!(setup?.readiness as any)?.connected) {
      navigate(
        `/applications/${projectId}/instrumentation?setup=connect&flowId=${encodeURIComponent(activeFlow.id)}&flowVersionId=${encodeURIComponent(activeFlow.publishedVersionId)}&environmentId=${encodeURIComponent(environmentId)}`,
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
      `/applications/${projectId}/instrumentation?flowId=${encodeURIComponent(activeFlow.id)}&flowVersionId=${encodeURIComponent(activeFlow.publishedVersionId)}&initializationId=${encodeURIComponent(initializationId)}&environmentId=${encodeURIComponent(environmentId)}`,
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
        <strong>Keep every Flow focused.</strong> Declaring an entire application as
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
              Select an existing flow from this application to review, edit, or
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
                No flows have been created for this application yet. Fill out the
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
                    maxLength={FLOW_NAME_MAX}
                    onChange={(event) =>
                      setNewFlowName(event.target.value.slice(0, FLOW_NAME_MAX))
                    }
                    placeholder="e.g. Customer checkout"
                  />
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      textAlign: "right",
                      fontSize: 11,
                      opacity: 0.6,
                    }}
                  >
                    {newFlowName.length}/{FLOW_NAME_MAX}
                  </span>
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
                <CappedTextarea
                  rows={3}
                  value={newFlowPurpose}
                  onChange={setNewFlowPurpose}
                  maxLength={FLOW_PURPOSE_MAX}
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
                <CappedTextarea
                  rows={3}
                  value={newFlowScope}
                  onChange={setNewFlowScope}
                  maxLength={FLOW_SCOPE_MAX}
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
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "4px",
                  marginTop: "12px",
                  marginBottom: "-4px",
                }}
              >
                <span
                  style={{ color: "var(--text-strong)", fontSize: "12px", fontWeight: 600 }}
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
                    <strong
                      className="manual-truncated-label"
                      title={state.stateName}
                    >
                      {state.stateName}
                    </strong>
                    <small>{state.category}</small>
                    <div className="manual-state-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title={
                          copiedFlowLabel === `state:${state.id}`
                            ? "Copied"
                            : "Copy full state name"
                        }
                        aria-label={`Copy full state name: ${state.stateName}`}
                        onClick={() =>
                          void copyFlowLabel(
                            `state:${state.id}`,
                            state.stateName,
                          )
                        }
                      >
                        {copiedFlowLabel === `state:${state.id}` ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
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
                      <strong
                        className="state-tag manual-truncated-label"
                        title={
                          stateNameById.get(transition.fromStateId) ??
                          transition.fromState?.stateName
                        }
                      >
                        {stateNameById.get(transition.fromStateId) ??
                          transition.fromState?.stateName}
                      </strong>
                      <ArrowRight size={14} className="transition-arrow" />
                      <strong
                        className="state-tag manual-truncated-label"
                        title={
                          stateNameById.get(transition.toStateId) ??
                          transition.toState?.stateName
                        }
                      >
                        {stateNameById.get(transition.toStateId) ??
                          transition.toState?.stateName}
                      </strong>
                    </div>
                    <div className="manual-transition-action-group">
                      <small
                        className="manual-transition-action manual-truncated-label"
                        title={transition.action || "Transition"}
                      >
                        {transition.action || "Transition"}
                      </small>
                      <button
                        type="button"
                        className="icon-button"
                        title={
                          copiedFlowLabel === `transition:${transition.id}`
                            ? "Copied"
                            : "Copy full transition"
                        }
                        aria-label={`Copy full transition: ${transition.action || "Transition"}`}
                        onClick={() => {
                          const from =
                            stateNameById.get(transition.fromStateId) ??
                            transition.fromState?.stateName ??
                            "Start";
                          const to =
                            stateNameById.get(transition.toStateId) ??
                            transition.toState?.stateName ??
                            "End";
                          void copyFlowLabel(
                            `transition:${transition.id}`,
                            `${from} -> ${to} - ${transition.action || "Transition"}`,
                          );
                        }}
                      >
                        {copiedFlowLabel === `transition:${transition.id}` ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
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
          <section className="content-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <small>Danger zone</small>
              <h2>Delete this flow</h2>
              <p>
                Permanently removes the flow, its published versions, and the
                QA runs and reports recorded against it.
              </p>
            </div>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => setFlowDeleteOpen(true)}
            >
              <Trash2 size={15} /> Delete flow
            </button>
          </section>
          {flowDeleteOpen ? (
            <DeleteFlowDialog
              flow={{ id: activeFlow.id, name: activeFlow.name }}
              busy={busy}
              onCancel={() => setFlowDeleteOpen(false)}
              onConfirm={deleteActiveFlow}
            />
          ) : null}
          {diagrams.length ? (
            <section className="content-card published-flow-diagram-card">
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
                  !nonProductionEnvironmentId(application) ||
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
  const navigate = useNavigate();
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

  if (!projectId || !flowId) return <ApplicationRequired />;
  if (!application) {
    return (
      <NotFoundPage
        title="Application unavailable"
        description="Select another application."
      />
    );
  }
  if (loading) return <LoadingState />;
  if (!flows.some((flow) => flow.id === flowId)) {
    return (
      <NotFoundPage
        title="Flow unavailable"
        description="This flow does not exist or is outside the selected application."
      />
    );
  }

  // The canvas replaces the step-by-step form: states and transitions are
  // edited on the graph, with suggestions, history and settings in its panel.
  return (
    <FlowEditor
      key={flowId}
      projectId={projectId}
      flowId={flowId}
      onClose={() => navigate(`/applications/${projectId}/intent`)}
      onDeleted={() => navigate(`/applications/${projectId}/intent`)}
    />
  );
}

const JOB_POLL_INTERVAL_MS = 2_000;
const JOB_POLL_TIMEOUT_MS = 5 * 60_000;
const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const ACTIVE_IMPORT_STAGES: DocumentImportView["stage"][] = [
  "EXTRACTING_AND_UPLOADING",
  "PROCESSING_DOCUMENTS",
  "GENERATING_DRAFT",
];

const IMPORT_STAGE_LABELS: Record<DocumentImportView["stage"], string> = {
  EXTRACTING_AND_UPLOADING: "Extracting and uploading",
  PROCESSING_DOCUMENTS: "Processing document evidence",
  GENERATING_DRAFT: "Generating flow draft",
  DOCUMENTS_READY: "Documents ready",
  DRAFT_READY: "Draft ready for review",
  FAILED: "Needs attention",
  CANCELLED: "Stopped",
};

const IMPORT_FILE_LABELS: Record<
  DocumentImportView["files"][number]["status"],
  string
> = {
  WAITING: "Waiting to be extracted",
  EXTRACTING: "Extracting locally",
  UPLOADING: "Uploading derived evidence; raw bytes remain local",
  QUEUED: "Queued for processing",
  PROCESSING: "Processing evidence",
  READY: "Evidence ready",
  FAILED: "Failed",
  CANCELLED: "Not uploaded",
};

function isDocumentImportActive(view: DocumentImportView | null): boolean {
  return Boolean(
    view && (view.running || ACTIVE_IMPORT_STAGES.includes(view.stage)),
  );
}

/**
 * Whether a document's latest version reflects its latest upload. A version
 * stays usable either way, but the picker must not call an older version
 * "ready" while a newer upload is processing or after it failed.
 */
function documentReadiness(document: SourceDocumentSummary): {
  ready: boolean;
  label: string;
} {
  const version = document.versions[0];
  if (!version) return { ready: false, label: "Not processed yet" };
  const latestJob = document.processingJobs[0]?.status;
  if (
    document.status === "PROCESSED" ||
    (document.status === "READY" && (!latestJob || latestJob === "COMPLETED"))
  )
    return {
      ready: true,
      label: `Version ${version.version} · Ready for generation`,
    };
  if (
    document.status === "PROCESSING" ||
    latestJob === "QUEUED" ||
    latestJob === "PROCESSING"
  )
    return {
      ready: false,
      label: `Version ${version.version} · A newer upload is still processing; this is the previous version`,
    };
  if (document.status === "FAILED" || latestJob === "FAILED")
    return {
      ready: false,
      label: `Version ${version.version} · The latest upload failed; this is the previous version`,
    };
  return { ready: false, label: `Version ${version.version}` };
}

// Manual starting points for a new flow, mirroring the web dashboard's
// "Create a flow" picker. Each creates a bounded draft flow of the given
// workflow type and drops the author into the flow editor to add states.
const FLOW_STARTING_POINTS: Array<{
  key: string;
  label: string;
  description: string;
  flowName: string;
  workflowType: string;
  purpose: string;
  /**
   * Domain template the API seeds the new flow from. Omitted for the blank
   * starting point, which opens an empty canvas by design.
   */
  template?: string;
  icon: typeof Workflow;
}> = [
  {
    key: "ECOMMERCE",
    label: "E-commerce store",
    description:
      "Preloads a typical shop journey: browse, product, cart, checkout, order tracking.",
    flowName: "Checkout",
    workflowType: "CHECKOUT",
    purpose:
      "Let a shopper move from reviewing their cart through payment to an order confirmation.",
    template: "ECOMMERCE",
    icon: ShoppingCart,
  },
  {
    key: "LMS",
    label: "Education / LMS",
    description:
      "Preloads a typical learning journey: course catalog, enrolment, lesson, completion.",
    flowName: "Course enrollment",
    workflowType: "ENROLLMENT",
    purpose:
      "Let a learner move from browsing courses through enrolment to completing a lesson.",
    template: "LMS",
    icon: GraduationCap,
  },
  {
    key: "CUSTOM",
    label: "Custom (empty flow)",
    description:
      "Start from a blank canvas and declare every state and transition yourself.",
    flowName: "New Flow",
    workflowType: "CUSTOM",
    purpose: "",
    icon: FilePlus2,
  },
];

function intentErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("FEATURE_NOT_ENTITLED"))
    return "Document-based flow generation is not included on this plan.";
  if (message.includes("PROMPT_INJECTION"))
    return "Every usable section of the selected documents reads as instructions to the AI, so none of it can be used for generation.";
  if (message.includes("NO_USABLE_DOCUMENT_EVIDENCE"))
    return "The selected documents contain no usable text for generation.";
  if (message.includes("INVALID_OR_UNPROCESSED"))
    return "One or more documents are not ready yet. Check their processing status and retry.";
  if (message.includes("INTENT_IMPORT_IN_PROGRESS"))
    return "An import for this application is already running. Wait for it to finish or stop it first.";
  if (message.includes("DRAFT_JOB_CANNOT_BE_CANCELLED"))
    return "Generation has already started and can no longer be cancelled. Wait for it to finish, then review or discard the draft.";
  if (message.includes("DRAFT_REVISION_IN_PROGRESS"))
    return "A revision of this draft is already running.";
  if (message.includes("CONFLICT_ANSWERS_NOT_APPLIED"))
    return "Apply your answers first. Tellann regenerates the draft with them, then you approve the revised draft.";
  if (message.includes("UNRESOLVED_SOURCE_CONFLICTS"))
    return "Answer every question before applying your answers.";
  if (message.includes("CORRECTION_BLOCKED_BY_PRIVACY_POLICY"))
    return "That text looks like it contains secrets or instructions to the AI. Rephrase it in plain language.";
  if (message.includes("REVIEWED_DRAFT_IS_IMMUTABLE") || message.includes("DRAFT_ALREADY_REVIEWED"))
    return "This draft has already been reviewed or replaced by a revision.";
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

/** Progress of a document import run by the desktop, shared by Intent and Sources. */
function DocumentImportProgress({
  view,
  busy,
  cancellingGeneration,
  onStop,
  onCancelGeneration,
  onCheckAgain,
  onRetry,
  onDismiss,
  onReviewDraft,
}: {
  view: DocumentImportView;
  busy: boolean;
  cancellingGeneration: boolean;
  onStop(): void;
  onCancelGeneration(): void;
  onCheckAgain(): void;
  onRetry(): void;
  onDismiss(): void;
  onReviewDraft(): void;
}) {
  const active = isDocumentImportActive(view);
  const readyCount = view.files.filter((file) => file.versionId).length;
  const canStop = active && view.stage !== "GENERATING_DRAFT";
  return (
    <section
      className="content-card intent-progress flex flex-col gap-4 w-full overflow-hidden"
      aria-live="polite"
    >
      <div className="card-heading flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <small>{view.generateDraft ? "Generation cycle" : "Document upload"}</small>
          <h2 className="break-words">{IMPORT_STAGE_LABELS[view.stage]}</h2>
        </div>
        <div className="shrink-0 self-start sm:self-auto">
          <Status>{active ? "IN PROGRESS" : view.stage.replaceAll("_", " ")}</Status>
        </div>
      </div>
      {active ? (
        <p className="break-words leading-relaxed">
          You can leave this page. Tellann keeps working in the background and
          shows progress here when you come back.
        </p>
      ) : null}
      {view.message ? (
        <p className="break-words leading-relaxed">
          {view.stage === "FAILED"
            ? intentErrorMessage(view.message)
            : view.message}
        </p>
      ) : null}
      {view.failedFileCount > 0 ? (
        <div className="context-banner" role="status">
          {view.failedFileCount} of {view.files.length} file(s) could not be
          used.
          {view.generateDraft &&
          readyCount > 0 &&
          ["GENERATING_DRAFT", "DRAFT_READY"].includes(view.stage)
            ? ` The draft is generated from the ${readyCount} that could.`
            : ""}
        </div>
      ) : null}
      {view.generateDraft &&
      view.draftJobId &&
      view.stage === "GENERATING_DRAFT" ? (
        <div className="row-card flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 min-w-0 w-full">
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <strong className="truncate">Flow draft generation</strong>
            <small className="break-words">
              Server job {view.draftJobId.slice(0, 8)}
            </small>
          </div>
          <div className="shrink-0 self-start sm:self-auto flex items-center gap-2">
            <Status>{view.draftJobStatus ?? "QUEUED"}</Status>
            {view.draftJobStatus === "QUEUED" ? (
              <button
                className="button danger"
                disabled={busy || cancellingGeneration}
                onClick={onCancelGeneration}
              >
                <CircleStop size={14} />
                {cancellingGeneration ? "Cancelling…" : "Cancel generation"}
              </button>
            ) : (
              <small>
                Generation has started and can no longer be cancelled.
              </small>
            )}
          </div>
        </div>
      ) : null}
      {view.files.length ? (
        <div className="stack compact flex flex-col gap-2.5 w-full">
          {view.files.map((file) => (
            <div
              className="row-card flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 min-w-0 w-full"
              key={file.id}
            >
              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                <strong className="truncate" title={file.filename}>
                  {file.filename}
                </strong>
                <small className="break-words">
                  {file.errorMessageSafe ??
                    (file.status === "READY" && file.deduplicated
                      ? "Unchanged since the last upload · Evidence ready"
                      : IMPORT_FILE_LABELS[file.status])}
                </small>
              </div>
              <div className="shrink-0 self-start sm:self-auto">
                <Status>{file.status}</Status>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {canStop || !active ? (
        <div className="review-actions flex flex-wrap items-center gap-2.5 sm:gap-3 pt-2">
          {canStop ? (
            <button className="button" disabled={busy} onClick={onStop}>
              <CircleStop size={15} /> Stop import
            </button>
          ) : null}
          {view.stage === "DRAFT_READY" && view.draftId ? (
            <button className="button primary" onClick={onReviewDraft}>
              Review draft <ArrowRight size={14} />
            </button>
          ) : null}
          {view.stage === "FAILED" ? (
            <>
              <button className="button" onClick={onCheckAgain}>
                <RefreshCw size={15} /> Check again
              </button>
              <button className="button" disabled={busy} onClick={onRetry}>
                Upload again
              </button>
            </>
          ) : null}
          {!active ? (
            <button className="button" onClick={onDismiss}>
              <X size={15} /> Dismiss
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function IntentPage() {
  const { projectId, application, getDeclaredFlows } = useProject();
  const activeProjectId = projectId ?? "";
  const {
    getIntentDrafts,
    getIntentDraftJobs,
    cancelIntentDraftJob,
    getDocuments,
    importDocuments,
    getDocumentImport,
    resumeDocumentImport,
    cancelDocumentImport,
    dismissDocumentImport,
    generateFromDocumentVersions,
    onDocumentImportProgress,
    deleteIntentDraft,
    createDeclaredFlow,
    deleteDeclaredFlow,
    busy,
  } = useDesktop();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<DeclaredFlowSummary[]>([]);
  const [drafts, setDrafts] = useState<IntentDraft[]>([]);
  const [documents, setDocuments] = useState<SourceDocumentSummary[]>([]);
  const [importView, setImportView] = useState<DocumentImportView | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
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
  const [creatingFlowKey, setCreatingFlowKey] = useState<string | null>(null);
  const [flowToDelete, setFlowToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  // The last import stage this page saw, to tell a transition it witnessed
  // (open the finished draft) from a finished import found on arrival (offer it).
  const observedImportRef = useRef<{
    id: string;
    stage: DocumentImportView["stage"];
  } | null>(null);

  const openFlow = useCallback(
    (flow: DeclaredFlowSummary) =>
      navigate(`/applications/${projectId}/intent/flows/${flow.id}`),
    [navigate, projectId],
  );
  // Declaring a Flow is only half of it: until it is bound to the attached project
  // no QA run can start, and Instrumentation is where that binding happens.
  const initializeEnvironmentId = nonProductionEnvironmentId(application);
  const initializeFlow = useCallback(
    (flow: DeclaredFlowSummary) => {
      const href = flowInitializationHref(
        projectId,
        flow,
        initializeEnvironmentId,
      );
      if (href) navigate(href);
    },
    [navigate, projectId, initializeEnvironmentId],
  );
  const canInitialize = (flow: DeclaredFlowSummary) =>
    isFlowInitializable(flow) && Boolean(initializeEnvironmentId);
  const openFlowMenu = (
    flow: DeclaredFlowSummary,
    event: Parameters<typeof showMenu>[0],
  ) => {
    void showMenu(event, [
      {
        id: "open",
        label: flow.status === "DRAFT" ? "Open and edit" : "View flow",
        accelerator: "Enter",
      },
      ...(canInitialize(flow)
        ? [{ id: "initialize", label: "Initialize in project…" }]
        : []),
      { id: "copy", label: "Copy flow ID" },
      { type: "separator" as const },
      { id: "delete", label: "Delete…", accelerator: "Delete", enabled: !busy },
    ]).then((choice) => {
      if (choice === "open") openFlow(flow);
      if (choice === "initialize") initializeFlow(flow);
      if (choice === "copy") void navigator.clipboard?.writeText(flow.id);
      if (choice === "delete") setFlowToDelete({ id: flow.id, name: flow.name });
    });
  };
  const flowList = useSelectableList({
    items: flows,
    getKey: flowKey,
    onOpen: openFlow,
    onContextMenu: openFlowMenu,
  });

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
    };
  }, [projectId, refresh]);

  // An import started earlier keeps running in the desktop, including one
  // started before navigating away or before the desktop was last closed.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void getDocumentImport(projectId)
      .then(async (view) => {
        if (cancelled) return;
        observedImportRef.current = view
          ? { id: view.id, stage: view.stage }
          : null;
        setImportView(view);
        if (view && !view.running && ACTIVE_IMPORT_STAGES.includes(view.stage)) {
          const resumed = await resumeDocumentImport(projectId);
          if (!cancelled) setImportView(resumed);
        }
      })
      .catch(() => undefined);
    const unsubscribe = onDocumentImportProgress((view) => {
      if (view.applicationId === projectId) setImportView(view);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [projectId]);

  useEffect(() => {
    if (!importView) return;
    const previous = observedImportRef.current;
    observedImportRef.current = { id: importView.id, stage: importView.stage };
    if (!previous || previous.id !== importView.id || previous.stage === importView.stage)
      return;
    void refresh().catch(() => undefined);
    if (importView.stage === "DRAFT_READY" && importView.draftId) {
      void dismissDocumentImport(importView.applicationId).catch(() => undefined);
      navigate(
        `/applications/${importView.applicationId}/intent/drafts/${importView.draftId}`,
      );
    }
  }, [importView]);

  // Generation jobs not owned by the import (revisions requested from a review
  // page) are listed here until they finish.
  const otherDraftJobs = activeDraftJobs.filter(
    (job) => job.id !== importView?.draftJobId,
  );
  useEffect(() => {
    if (!projectId || !otherDraftJobs.length) return;
    const timer = window.setInterval(
      () => void refresh().catch(() => undefined),
      JOB_POLL_INTERVAL_MS * 2,
    );
    return () => window.clearInterval(timer);
  }, [projectId, otherDraftJobs.length, refresh]);

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

  const showActionError = (error: unknown) => {
    const message = intentErrorMessage(error);
    if (String(error).includes("FEATURE_NOT_ENTITLED"))
      setEntitlementModalOpen(true);
    setActionMessage(message);
  };

  const startFlowFromTemplate = async (
    option: (typeof FLOW_STARTING_POINTS)[number],
  ) => {
    if (!activeProjectId || creatingFlowKey) return;
    setCreatingFlowKey(option.key);
    setActionMessage(null);
    try {
      const flow = await createDeclaredFlow(
        activeProjectId,
        option.flowName,
        option.workflowType,
        option.purpose,
        "",
        option.template,
      );
      await refreshFlows();
      navigate(`/applications/${activeProjectId}/intent/flows/${flow.id}`);
    } catch (error) {
      setActionMessage(intentErrorMessage(error));
    } finally {
      setCreatingFlowKey(null);
    }
  };

  const removeDraft = async (draft: IntentDraft) => {
    if (confirmingDraftId !== draft.id) {
      setConfirmingDraftId(draft.id);
      setDraftManagementMessage(
        `Confirm deletion of “${(draft.draftJson as any)?.workflows?.[0]?.name ?? "this draft"}”. This removes the draft; your documents and their evidence are kept.`,
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

  const deleteFlow = async () => {
    if (!flowToDelete) return;
    const deleted = flowToDelete;
    await deleteDeclaredFlow(activeProjectId, deleted.id);
    setFlows((current) => current.filter((flow) => flow.id !== deleted.id));
    setFlowToDelete(null);
    setActionMessage(`“${deleted.name}” was deleted.`);
    await refresh().catch(() => undefined);
  };

  const trackImport = (view: DocumentImportView | null) => {
    if (!view) return;
    observedImportRef.current = { id: view.id, stage: view.stage };
    setImportView(view);
  };

  const uploadAndGenerate = async () => {
    setActionMessage(null);
    try {
      trackImport(
        await importDocuments(activeProjectId, { generateDraft: true }),
      );
    } catch (error) {
      showActionError(error);
    }
  };

  const retryUpload = async () => {
    if (importView && !isDocumentImportActive(importView)) {
      await dismissDocumentImport(activeProjectId).catch(() => undefined);
      setImportView(null);
    }
    await uploadAndGenerate();
  };

  const openReadyDocumentPicker = () => {
    setSelectedReadyVersionIds(new Set());
    setDocumentPickerOpen(true);
  };

  const generateReadyDocuments = async () => {
    const selected = documents.flatMap((document) => {
      const version = document.versions[0];
      return version && selectedReadyVersionIds.has(version.id)
        ? [{ versionId: version.id, documentId: document.id, filename: document.filename }]
        : [];
    });
    if (!selected.length) return;
    setDocumentPickerOpen(false);
    setActionMessage(null);
    try {
      trackImport(await generateFromDocumentVersions(activeProjectId, selected));
    } catch (error) {
      showActionError(error);
    }
  };

  const stopImport = async () => {
    try {
      const view = await cancelDocumentImport(activeProjectId);
      if (view) setImportView(view);
    } catch (error) {
      setActionMessage(intentErrorMessage(error));
    }
  };

  const cancelImportGeneration = async () => {
    if (!importView?.draftJobId) return;
    setCancellingDraftJobId(importView.draftJobId);
    try {
      const view = await cancelDocumentImport(activeProjectId);
      if (view) setImportView(view);
      await refresh();
    } catch (error) {
      setActionMessage(intentErrorMessage(error));
    } finally {
      setCancellingDraftJobId(null);
    }
  };

  const cancelOtherGeneration = async (jobId: string) => {
    setCancellingDraftJobId(jobId);
    try {
      await cancelIntentDraftJob(activeProjectId, jobId);
      await refresh();
    } catch (error) {
      setActionMessage(intentErrorMessage(error));
    } finally {
      setCancellingDraftJobId(null);
    }
  };

  const checkAgain = async () => {
    try {
      const view = await resumeDocumentImport(activeProjectId);
      if (view) setImportView(view);
      await refresh();
    } catch (error) {
      setActionMessage(intentErrorMessage(error));
    }
  };

  const dismissImport = async () => {
    await dismissDocumentImport(activeProjectId).catch(() => undefined);
    observedImportRef.current = null;
    setImportView(null);
  };

  const reviewImportedDraft = () => {
    if (!importView?.draftId) return;
    const target = `/applications/${activeProjectId}/intent/drafts/${importView.draftId}`;
    void dismissImport();
    navigate(target);
  };

  // Only drafts still awaiting a decision belong in the review queue; reviewed
  // ones are history and link to the flow they produced.
  const pendingDrafts = drafts.filter((draft) => draft.status === "PENDING_REVIEW");
  const reviewedDrafts = drafts.filter((draft) => draft.status !== "PENDING_REVIEW");
  const renderDraftRow = (draft: IntentDraft) => {
    const draftName =
      (draft.draftJson as any)?.workflows?.[0]?.name ?? "Document-derived intent";
    const accepted = ["ACCEPTED", "PARTIALLY_ACCEPTED"].includes(draft.status);
    const acceptedFlow = draft.acceptedGraphId
      ? flows.find((flow) => flow.id === draft.acceptedGraphId)
      : undefined;
    const deletable =
      ["PENDING_REVIEW", "REJECTED", "EXPIRED", "SUPERSEDED"].includes(draft.status) ||
      (accepted && !acceptedFlow);
    const detail =
      draft.status === "SUPERSEDED"
        ? "Replaced by a revised draft"
        : accepted && acceptedFlow
          ? `Accepted into “${acceptedFlow.name}”`
          : accepted
            ? "Accepted; the flow it created has since been deleted"
            : `${draft.source} · ${Math.round(draft.confidence * 100)}% confidence`;
    return (
      <div
        className="row-card draft-link flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 min-w-0 w-full"
        key={draft.id}
      >
        <Link
          className="min-w-0 flex-1 flex flex-col gap-0.5 text-inherit hover:no-underline"
          to={`/applications/${projectId}/intent/drafts/${draft.id}`}
        >
          <strong className="truncate" title={draftName}>
            {draftName}
          </strong>
          <small className="break-words">{detail}</small>
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
              {confirmingDraftId === draft.id ? "Confirm delete" : "Delete"}
            </button>
          ) : acceptedFlow ? (
            <Link
              className="button"
              to={`/applications/${projectId}/intent/flows/${acceptedFlow.id}`}
              title="Accepted drafts are kept as evidence while their flow exists. Delete the flow to remove the draft."
            >
              Open flow
            </Link>
          ) : null}
        </div>
      </div>
    );
  };
  const versionedDocuments = documents.filter(
    (document) => document.versions.length > 0,
  );
  const readyDocumentCount = versionedDocuments.filter(
    (document) => documentReadiness(document).ready,
  ).length;
  const processingDocuments = documents.filter((document) =>
    ["QUEUED", "PROCESSING"].includes(
      document.processingJobs[0]?.status ?? document.status,
    ),
  );
  const importActive = isDocumentImportActive(importView);
  if (!projectId) return <ApplicationRequired />;
  if (!application)
    return (
      <NotFoundPage
        title="Application unavailable"
        description="Select another application."
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
          <Link className="button" to={`/applications/${projectId}/sources`}>
            <BookOpenText size={15} /> View documents
          </Link>
          <Link
            className="button"
            to={`/applications/${projectId}/intent/versions`}
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
          <section className="content-card">
            <div className="card-heading">
              <div>
                <small>Start a flow</small>
                <h2>Create a flow</h2>
              </div>
            </div>
            <p>
              Pick a starting point. Every state and transition stays editable
              afterwards, or generate one from your documents below.
            </p>
            <div className="grid gap-3 sm:grid-cols-3 mt-4">
              {FLOW_STARTING_POINTS.map((option) => {
                const isCreating = creatingFlowKey === option.key;
                return (
                  <div
                    key={option.key}
                    className="flex flex-col justify-between rounded-lg border border-(--border) bg-(--surface-0) p-4 transition-all hover:border-(--border-strong) hover:bg-(--surface-1)"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        {option.key === "CUSTOM" && (
                          <span className="rounded border border-(--border) bg-(--surface-1) px-1.5 py-0.5 font-mono text-[9px] text-(--text-muted)">
                            Blank
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-(--text-strong)">
                        {option.label}
                      </h3>
                      <p className="text-xs leading-relaxed text-(--text-muted)">
                        {option.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`button ${option.key === "CUSTOM" ? "" : "primary"} w-full mt-4 flex items-center justify-center gap-1.5`}
                      disabled={busy || creatingFlowKey !== null}
                      onClick={() => void startFlowFromTemplate(option)}
                    >
                      {isCreating ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Creating…
                        </>
                      ) : (
                        <>
                          {option.label}
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="content-card ai-intent-actions">
            <div>
              <h2>Generate flows from your documents</h2>
              <p>
                Tellann creates a review draft first. Nothing changes graph
                truth until you accept it.
              </p>
            </div>
            <div className="review-actions">
              <button
                className="button primary"
                disabled={busy || importActive}
                title={
                  importActive
                    ? "Stop or finish the active import before starting another."
                    : undefined
                }
                onClick={() => void uploadAndGenerate()}
              >
                <FileSearch size={15} /> Upload and generate
              </button>
              {versionedDocuments.length ? (
                <button
                  className="button"
                  disabled={busy || importActive}
                  title={
                    importActive
                      ? "Stop or finish the active import before starting another."
                      : undefined
                  }
                  onClick={openReadyDocumentPicker}
                >
                  <Workflow size={15} /> Generate from ready documents
                </button>
              ) : null}
            </div>
          </section>
          {actionMessage ? (
            <div className="context-banner" role="status">
              <span>{actionMessage}</span>
              <button className="button" onClick={() => setActionMessage(null)}>
                Dismiss
              </button>
            </div>
          ) : null}
          {documentPickerOpen ? (
            <div
              className="desktop-modal-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget)
                  setDocumentPickerOpen(false);
              }}
            >
              <section
                className="desktop-modal w-full bg-(--surface-1) border border-(--border) rounded-xs p-6 shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ready-document-picker-title"
                aria-describedby="ready-document-picker-description"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2
                    id="ready-document-picker-title"
                    className="text-(--text-strong) text-[24px] font-semibold tracking-[-0.01em] mb-2"
                  >
                    Choose documents
                  </h2>
                </div>

                <p
                  id="ready-document-picker-description"
                  className="text-(--text) text-[14px] leading-relaxed mb-6"
                >
                  Select the uploaded documents Tellann should use as evidence.
                  Only the latest processed version of each document is shown.
                </p>

                <div className="bg-(--surface-0) border border-(--border) rounded-xs mb-4 max-h-[380px] overflow-y-auto divide-y divide-(--border)">
                  {versionedDocuments.map((document) => {
                    const version = document.versions[0];
                    const readiness = documentReadiness(document);
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
                        className={`flex items-center justify-between p-4 cursor-default transition-colors ${
                          selected
                            ? "bg-(--surface-1)"
                            : "bg-(--surface-0) hover:bg-(--surface-1)"
                        }`}
                        onClick={toggleSelect}
                      >
                        <div className="flex flex-col gap-1 min-w-0 pr-4">
                          <strong className="text-(--text-strong) text-[13px] font-semibold truncate">
                            {document.filename}
                          </strong>
                          <span
                            className={`font-mono text-[11px] tracking-[0.08em] uppercase ${
                              readiness.ready ? "text-(--text-muted)" : "text-[#d6a24a]"
                            }`}
                          >
                            {readiness.label}
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
                  className="text-(--text-muted) font-mono text-[11px] tracking-[0.08em] uppercase mb-6"
                  aria-live="polite"
                >
                  {selectedReadyVersionIds.size
                    ? `${selectedReadyVersionIds.size} DOCUMENT${selectedReadyVersionIds.size === 1 ? "" : "S"} SELECTED`
                    : "SELECT AT LEAST ONE DOCUMENT TO CONTINUE."}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="px-5 py-3 border border-(--border-strong) bg-(--surface-0) text-(--text) hover:text-(--text-strong) hover:border-(--accent) font-mono text-[12px] tracking-[0.08em] uppercase font-semibold rounded-xs transition-colors"
                    onClick={() => setDocumentPickerOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="flex-1 px-5 py-3 bg-(--accent) text-black! font-mono text-[12px] tracking-[0.08em] uppercase font-semibold rounded-xs hover:bg-(--accent) transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={!selectedReadyVersionIds.size || importActive}
                    onClick={() => void generateReadyDocuments()}
                  >
                    Generate selected flows
                  </button>
                </div>
              </section>
            </div>
          ) : null}
          {importView ? (
            <DocumentImportProgress
              view={importView}
              busy={busy}
              cancellingGeneration={
                Boolean(importView.draftJobId) &&
                cancellingDraftJobId === importView.draftJobId
              }
              onStop={() => void stopImport()}
              onCancelGeneration={() => void cancelImportGeneration()}
              onCheckAgain={() => void checkAgain()}
              onRetry={() => void retryUpload()}
              onDismiss={() => void dismissImport()}
              onReviewDraft={reviewImportedDraft}
            />
          ) : null}
          {otherDraftJobs.length ? (
            <section className="content-card flex flex-col gap-4 w-full overflow-hidden" aria-live="polite">
              <div className="card-heading">
                <div>
                  <small>Generation</small>
                  <h2>Draft revisions in progress</h2>
                </div>
              </div>
              <div className="stack compact flex flex-col gap-2.5 w-full">
                {otherDraftJobs.map((job) => {
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
                        <strong className="truncate">Flow draft generation</strong>
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
                            onClick={() => void cancelOtherGeneration(job.id)}
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
            </section>
          ) : null}
          {processingDocuments.length && !importActive ? (
            <div className="context-banner">
              {processingDocuments.length} document(s) are still processing.
              This page refreshes when focused; Sources shows the full library.
            </div>
          ) : null}
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
          {pendingDrafts.length ? (
            <section className="content-card flex flex-col gap-4 w-full overflow-hidden">
              <div className="card-heading flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
                <div className="min-w-0 flex-1">
                  <small>Review queue</small>
                  <h2 className="break-words">Drafts waiting for review</h2>
                </div>
                <div className="shrink-0 self-start sm:self-auto">
                  <Status>{pendingDrafts.length} pending</Status>
                </div>
              </div>
              <div className="stack compact flex flex-col gap-2.5 w-full">
                {pendingDrafts.map(renderDraftRow)}
              </div>
            </section>
          ) : null}
          {flows.length ? (
            <section className="content-card flex flex-col gap-3 w-full overflow-hidden">
              <div className="card-heading flex items-center justify-between gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <small>Graph truth</small>
                  <h2 className="break-words">
                    Declared system flows{" "}
                    <span className="card-count">{flows.length}</span>
                  </h2>
                </div>
                {flowList.selected ? (
                  <div className="detail-actions shrink-0">
                    <button
                      className="button"
                      onClick={() => openFlow(flowList.selected!)}
                    >
                      <Pencil size={14} />
                      {flowList.selected.status === "DRAFT" ? "Open and edit" : "View flow"}
                    </button>
                    {canInitialize(flowList.selected) ? (
                      <button
                        className="button primary"
                        onClick={() => initializeFlow(flowList.selected!)}
                      >
                        <Workflow size={14} /> Initialize in project
                      </button>
                    ) : null}
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() =>
                        setFlowToDelete({
                          id: flowList.selected!.id,
                          name: flowList.selected!.name,
                        })
                      }
                      aria-label={`Delete ${flowList.selected.name}`}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="card-list">
                <div
                  className="list-view"
                  aria-label="Declared system flows"
                  style={{ "--list-columns": "minmax(220px, 1fr) 110px 70px 150px 26px" } as CSSProperties}
                  {...flowList.listProps}
                  onKeyDown={(event) => {
                    if (event.key === "Delete" && flowList.selected && !busy) {
                      event.preventDefault();
                      setFlowToDelete({
                        id: flowList.selected.id,
                        name: flowList.selected.name,
                      });
                      return;
                    }
                    flowList.listProps.onKeyDown(event);
                  }}
                >
                  <div className="list-head" role="presentation">
                    <span>Name</span>
                    <span>Status</span>
                    <span>Version</span>
                    <span>Modified</span>
                    <span />
                  </div>
                  {flows.map((flow) => (
                    <div
                      className="list-row"
                      key={flow.id}
                      title={flow.name}
                      {...flowList.rowProps(flow)}
                    >
                      <span className="list-cell-primary">
                        <strong>{flow.name}</strong>
                        <small>
                          {flow.purpose ||
                            (flow.status === "DRAFT"
                              ? "Draft · add states and transitions"
                              : "Declared behavior")}
                        </small>
                      </span>
                      <span>
                        <Status>{flow.status}</Status>
                      </span>
                      <span>{flow.version ? `v${flow.version}` : "—"}</span>
                      <span>{flow.updatedAt ? formatDate(flow.updatedAt) : "—"}</span>
                      <button
                        className="row-action"
                        aria-label={`More actions for ${flow.name}`}
                        onMouseDown={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          flowList.setSelectedKey(flow.id);
                          openFlowMenu(flow, event);
                        }}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
          {reviewedDrafts.length ? (
            <details className="content-card flex flex-col gap-4 w-full overflow-hidden">
              <summary className="card-heading flex items-center justify-between gap-3 min-w-0 cursor-default">
                <div className="min-w-0 flex-1">
                  <small>History</small>
                  <h2 className="break-words">Reviewed drafts</h2>
                </div>
                <Status>{reviewedDrafts.length}</Status>
              </summary>
              <div className="stack compact flex flex-col gap-2.5 w-full mt-4">
                {reviewedDrafts.map(renderDraftRow)}
              </div>
            </details>
          ) : null}
          {flowToDelete ? (
            <DeleteFlowDialog
              flow={flowToDelete}
              busy={busy}
              onCancel={() => setFlowToDelete(null)}
              onConfirm={deleteFlow}
            />
          ) : null}
          {!documents.length && !drafts.length && !flows.length && !importView ? (
            <EmptyState
              icon={<Workflow size={36} />}
              title="No expected intent yet"
              description="Add product documents, process their derived evidence, then generate a reviewable flow draft."
              action={
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void uploadAndGenerate()}
                >
                  Upload documents
                </button>
              }
            />
          ) : null}
          {documents.length && !drafts.length && !flows.length && !importView ? (
            <div className="context-banner">
              {readyDocumentCount
                ? `${readyDocumentCount} document(s) are ready for flow generation.`
                : "Your documents are queued or processing. Open Sources for detailed status."}
            </div>
          ) : null}
        </div>
      )}
    </Page>
  );
}

const GENERATION_METHOD_LABELS: Record<string, string> = {
  AI_PROVIDER: "AI provider",
  DOCUMENT_BASELINE: "Assembled from document text (no AI)",
  RULE_TEMPLATE: "Generic domain template (no AI)",
};

function describeConflictResolution(conflict: any): string {
  const resolution = conflict?.resolution ?? {};
  if (resolution.choice === "SOURCE")
    return `use “${resolution.statement ?? "the chosen statement"}”`;
  if (resolution.choice === "BOTH") return "both statements apply";
  return `“${resolution.statement ?? ""}”`;
}

export function IntentDetailPage() {
  const { projectId, draftId } = useParams();
  const navigate = useNavigate();
  const {
    getIntentDraft,
    getIntentDraftJob,
    reviewIntentDraft,
    correctIntentDraft,
    applyIntentConflictAnswers,
    busy,
  } = useDesktop();
  const [draft, setDraft] = useState<IntentDraft | null>(null);
  const [loading, setLoading] = useState(Boolean(draftId));
  const [correction, setCorrection] = useState("");
  const [revisionJobId, setRevisionJobId] = useState<string | null>(null);
  const [revisionKind, setRevisionKind] = useState<
    "CORRECTION" | "ANSWERS" | null
  >(null);
  const [revisionStatus, setRevisionStatus] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [parentDraft, setParentDraft] = useState<IntentDraft | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [editedWorkflows, setEditedWorkflows] = useState<any[]>([]);
  const [editingWorkflow, setEditingWorkflow] = useState<string | null>(null);

  const loadDraft = useCallback(async () => {
    if (!projectId || !draftId) return;
    setDraft(await getIntentDraft(projectId, draftId).catch(() => null));
  }, [draftId, projectId]);

  useEffect(() => {
    if (!projectId || !draftId) return;
    // Opening another draft (such as the revision just generated) starts clean.
    setResolutions({});
    setCorrection("");
    setRevisionJobId(null);
    setRevisionKind(null);
    setRevisionStatus(null);
    setReviewError(null);
    setEditingWorkflow(null);
    setLoading(true);
    void loadDraft().finally(() => setLoading(false));
  }, [draftId, projectId, loadDraft]);
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
  }, [draft, projectId]);
  useEffect(() => {
    const next = (draft?.draftJson as any)?.workflows;
    setEditedWorkflows(Array.isArray(next) ? structuredClone(next) : []);
  }, [draft]);
  // A revision requested before leaving this page is picked back up.
  useEffect(() => {
    const jobId = (draft as any)?.activeRevisionJobId;
    if (typeof jobId === "string" && jobId) {
      setRevisionJobId(jobId);
      setRevisionStatus("A revision of this draft is already running…");
    }
  }, [draft]);
  useEffect(() => {
    if (!projectId || !revisionJobId) return;
    let cancelled = false;
    void (async () => {
      const startedAt = Date.now();
      try {
        while (!cancelled && Date.now() - startedAt < JOB_POLL_TIMEOUT_MS) {
          const job = await getIntentDraftJob(projectId, revisionJobId);
          if (cancelled) return;
          if (job.status === "COMPLETED" && job.draftId) {
            setRevisionStatus("Revision complete. Opening the updated draft…");
            setRevisionJobId(null);
            navigate(`/applications/${projectId}/intent/drafts/${job.draftId}`);
            return;
          }
          if (job.status === "FAILED" || job.status === "CANCELLED")
            throw new Error(
              job.errorMessageSafe ?? "The revised draft could not be generated.",
            );
          setRevisionStatus(
            job.status === "QUEUED"
              ? "Your revision is queued and will start shortly…"
              : `Updating the flows · attempt ${job.attempts + 1} of ${job.maxAttempts}…`,
          );
          await delay(JOB_POLL_INTERVAL_MS);
        }
        if (!cancelled) {
          setRevisionJobId(null);
          setRevisionStatus(
            "The revision is still running. You can leave this page; reopen this draft to pick it back up.",
          );
        }
      } catch (error) {
        if (!cancelled) {
          setRevisionJobId(null);
          setRevisionStatus(intentErrorMessage(error));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, revisionJobId]);
  if (!projectId) return <ApplicationRequired />;
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
        description="The draft may have been removed or belongs to another application."
      />
    );
  const draftJson = draft.draftJson as any;
  const manifest = (draft.sourceManifest as any) ?? {};
  const workflows = editedWorkflows;
  const allConflicts = Array.isArray(manifest.conflicts)
    ? manifest.conflicts
    : [];
  const conflicts = allConflicts.filter(
    (conflict: any) =>
      conflict?.blocking === true &&
      conflict?.severity === "HIGH" &&
      Array.isArray(conflict?.sources) &&
      conflict.sources.length > 1,
  );
  const resolvedConflicts = allConflicts.filter(
    (conflict: any) => conflict?.resolved && conflict?.resolution,
  );
  const pendingReview = draft.status === "PENDING_REVIEW";
  const generation = draftJson?.generation as
    | { method?: string; reason?: string | null; message?: string | null }
    | undefined;
  const coverage: Array<{
    filename: string;
    includedSections: number;
    totalSections: number;
    unsafeSections: number;
  }> = Array.isArray(manifest.coverage) ? manifest.coverage : [];
  const supersededByDraftId = (draft as any).supersededByDraftId as
    | string
    | null
    | undefined;
  const manifestDocumentNames = Array.isArray(manifest.documentNames)
    ? manifest.documentNames
    : [];
  const documentNames = [
    ...new Set([
      ...manifestDocumentNames,
      ...(draft.evidence ?? []).flatMap((item: any) =>
        item?.sourceDocument?.filename ? [item.sourceDocument.filename] : [],
      ),
    ]),
  ];
  const unansweredConflict = conflicts.some(
    (conflict: any) => !resolutions[conflict.key]?.trim(),
  );
  const accept = async () => {
    setReviewError(null);
    try {
      await reviewIntentDraft(projectId, draft.id, {
        action: "ACCEPT",
        editedWorkflows: workflows,
      });
      navigate(`/applications/${projectId}/intent`);
    } catch (error) {
      setReviewError(intentErrorMessage(error));
    }
  };
  const reject = async () => {
    setReviewError(null);
    try {
      await reviewIntentDraft(projectId, draft.id, { action: "REJECT" });
      navigate(`/applications/${projectId}/intent`);
    } catch (error) {
      setReviewError(intentErrorMessage(error));
    }
  };
  const startRevision = async (
    kind: "CORRECTION" | "ANSWERS",
    request: () => Promise<{ jobId: string }>,
  ) => {
    if (revisionJobId) return;
    setRevisionKind(kind);
    setRevisionStatus(
      kind === "ANSWERS"
        ? "Applying your answers…"
        : "Submitting your requested change…",
    );
    try {
      const created = await request();
      setRevisionJobId(created.jobId);
    } catch (error) {
      setRevisionStatus(intentErrorMessage(error));
      // Another revision already running: reload to pick up its job.
      if (String(error).includes("DRAFT_REVISION_IN_PROGRESS"))
        void loadDraft();
    }
  };
  const correct = () => {
    const requestedChange = correction.trim();
    if (!requestedChange) return;
    void startRevision("CORRECTION", () =>
      correctIntentDraft(projectId, draft.id, requestedChange),
    );
  };
  const applyAnswers = () => {
    if (unansweredConflict) return;
    void startRevision("ANSWERS", () =>
      applyIntentConflictAnswers(
        projectId,
        draft.id,
        Object.fromEntries(
          conflicts.map((conflict: any) => [
            conflict.key,
            resolutions[conflict.key].trim(),
          ]),
        ),
      ),
    );
  };
  const correctionRequest = manifest.correctionRequest as string | undefined;
  const appliedAnswers: string[] = Array.isArray(manifest.appliedConflictAnswers)
    ? manifest.appliedConflictAnswers
    : [];
  const revisionChanges = summarizeDraftRevision(parentDraft, draft);
  return (
    <Page
      title="Review generated system flows"
      description={`Tellann found ${workflows.length} user ${workflows.length === 1 ? "journey" : "journeys"}${documentNames.length ? ` from ${documentNames.map((name) => `“${name}”`).join(", ")}` : " from your approved application evidence"}. Review ${workflows.length === 1 ? "it" : "them"} before using ${workflows.length === 1 ? "it" : "them"} in QA tests.`}
      actions={
        <Status>{pendingReview ? "READY FOR REVIEW" : draft.status}</Status>
      }
    >
      <div className="flow-review-shell">
        {draft.status === "SUPERSEDED" ? (
          <div className="context-banner" role="status">
            <span>
              This draft was replaced by a revised draft and can no longer be
              approved.
            </span>
            {supersededByDraftId ? (
              <Link
                className="button"
                to={`/applications/${projectId}/intent/drafts/${supersededByDraftId}`}
              >
                Open the revised draft
              </Link>
            ) : null}
          </div>
        ) : null}
        {generation?.message && generation.method !== "AI_PROVIDER" ? (
          <div className="review-attention" role="status">
            <AlertTriangle size={18} />
            <strong>
              {generation.method === "DOCUMENT_BASELINE"
                ? "Generated without AI"
                : "Generic template, not your documents"}
            </strong>
            <span>{generation.message}</span>
          </div>
        ) : null}
        {correctionRequest || appliedAnswers.length ? (
          <section className="revision-summary" aria-live="polite">
            <div className="revision-summary-heading">
              <Check size={18} />
              <div>
                <small>Revision complete</small>
                <h2>
                  {correctionRequest && appliedAnswers.length
                    ? "Your answers and suggestion were applied to this review draft"
                    : correctionRequest
                      ? "Your suggestion was applied to this review draft"
                      : "Your answers were applied to this review draft"}
                </h2>
              </div>
            </div>
            {correctionRequest ? (
              <p>
                <strong>Your suggestion:</strong> “{correctionRequest}”
              </p>
            ) : null}
            {appliedAnswers.length && resolvedConflicts.length ? (
              <ul>
                {resolvedConflicts.map((conflict: any) => (
                  <li key={conflict.key}>
                    {conflict.question ?? conflict.description}{" "}
                    {describeConflictResolution(conflict)}
                  </li>
                ))}
              </ul>
            ) : null}
            {revisionChanges.length ? (
              <ul>
                {revisionChanges.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            ) : (
              <p>
                Tellann regenerated the workflow behavior with your input.
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
            <span>Answer, then apply your answers before approval.</span>
          </div>
        ) : pendingReview ? (
          <div className="review-ready">
            <Check size={18} />
            <strong>No questions need your attention</strong>
            <span>Review each journey, then approve when it looks right.</span>
          </div>
        ) : null}

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
                        disabled={!pendingReview}
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
            <div className="flex flex-col gap-2">
              <p className="text-xs text-(--text-muted)">
                Tellann regenerates the journeys with your answers, and you
                review the revised draft before anything is saved. Edits made
                to journeys on this page are not carried into the revision.
              </p>
              <div className="review-actions flex flex-wrap items-center gap-3">
                <button
                  className="button primary"
                  disabled={
                    busy ||
                    Boolean(revisionJobId) ||
                    !pendingReview ||
                    unansweredConflict
                  }
                  onClick={applyAnswers}
                >
                  {revisionJobId && revisionKind === "ANSWERS" ? (
                    <>
                      <RefreshCw className="spin" size={15} /> Applying
                      answers…
                    </>
                  ) : (
                    "Apply answers to draft"
                  )}
                </button>
                {revisionKind === "ANSWERS" && revisionStatus ? (
                  <small
                    className="text-(--text-muted) font-mono text-[11px]"
                    role="status"
                  >
                    {revisionStatus}
                  </small>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <AccordionItem value="generation-details" className="my-4">
          <AccordionTrigger>
            <div className="flex flex-col text-left">
              <strong className="text-(--text-strong) font-semibold">
                Documents and generation details
              </strong>
              <small className="text-xs text-(--text-muted)">
                See the evidence and technical information used for this draft.
              </small>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="detail-list">
              <div>
                <dt>Documents</dt>
                <dd>
                  {documentNames.join(", ") || "Approved application evidence"}
                </dd>
              </div>
              {coverage.length ? (
                <div>
                  <dt>Document coverage</dt>
                  <dd>
                    {coverage
                      .map(
                        (item) =>
                          `${item.filename}: ${item.includedSections} of ${item.totalSections} sections used${item.unsafeSections ? ` (${item.unsafeSections} set aside as unsafe)` : ""}`,
                      )
                      .join("; ")}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Generation method</dt>
                <dd>
                  {(generation?.method &&
                    GENERATION_METHOD_LABELS[generation.method]) ??
                    draft.source.replaceAll("_", " ").toLowerCase()}
                </dd>
              </div>
              <div>
                <dt>Overall confidence</dt>
                <dd>{Math.round(draft.confidence * 100)}%</dd>
              </div>
              <div>
                <dt>Evidence excerpts</dt>
                <dd>
                  {draft.evidence?.length ??
                    manifest.evidenceIds?.length ??
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
              className="w-full min-h-[96px] p-3 bg-(--surface-0) border border-(--border) rounded text-(--text-strong) text-xs placeholder:text-(--text-subtle) focus:outline-none focus:border-(--accent) transition-colors"
              value={correction}
              disabled={Boolean(revisionJobId) || !pendingReview}
              onChange={(event) => setCorrection(event.target.value)}
              placeholder="For example: Require sign-in before checkout, and add an order cancellation journey."
            />
            <div className="flex items-center justify-between gap-3">
              {revisionKind !== "ANSWERS" && revisionStatus ? (
                <small
                  className="text-(--text-muted) font-mono text-[11px]"
                  role="status"
                >
                  {revisionStatus}
                </small>
              ) : (
                <span />
              )}
              <button
                className="button primary"
                disabled={
                  busy ||
                  Boolean(revisionJobId) ||
                  !correction.trim() ||
                  !pendingReview
                }
                onClick={correct}
              >
                {revisionJobId && revisionKind !== "ANSWERS" ? (
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
                !pendingReview ||
                conflicts.length > 0 ||
                Boolean(revisionJobId)
              }
              onClick={() => void accept()}
            >
              <Check size={15} />
              Approve and use these flows
            </button>
            <button
              className="button danger"
              disabled={busy || !pendingReview || Boolean(revisionJobId)}
              onClick={() => void reject()}
            >
              Discard draft
            </button>
          </div>
          {conflicts.length ? (
            <small className="approval-blocker">
              Answer every question and apply your answers before approval.
            </small>
          ) : revisionJobId ? (
            <small className="approval-blocker">
              Wait for the revision to finish, then review the revised draft.
            </small>
          ) : null}
          {reviewError ? (
            <small className="approval-blocker" role="alert">
              {reviewError}
            </small>
          ) : null}
        </section>
      </div>
    </Page>
  );
}

type FlowMappingCandidateView = {
  id: string;
  entityId?: string | null;
  file?: string | null;
  path?: string | null;
  symbol?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  placementKind?: string | null;
  placementKinds?: string[];
  anchor?: string | null;
  confidence?: number;
  score?: number;
  rationale?: string;
  evidenceIds?: string[];
  excerpt?: string | null;
};

type FlowMappingView = {
  status?: string;
  file?: string | null;
  symbol?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  placementKind?: string | null;
  anchor?: string | null;
  confidence?: number;
  rationale?: string;
  alternatives?: FlowMappingCandidateView[];
  evidenceIds?: string[];
  manualInstruction?: string;
  userConfirmed?: boolean;
  userOverrode?: boolean;
};

type FlowCheckpointView = {
  id: string;
  kind: string;
  label?: string;
  stateRole?: string | null;
  terminalKind?: string | null;
  mapping?: FlowMappingView;
};

const FLOW_MAPPING_STATUS_LABEL: Record<string, string> = {
  RESOLVED: "Located",
  AMBIGUOUS: "Needs a choice",
  UNRESOLVED: "Not found",
  UNSUPPORTED: "Cannot be placed here",
};

const FLOW_PROGRESS_LABEL: Record<string, string> = {
  WAITING_FOR_ANALYSIS: "Waiting for your code to be analysed",
  RETRIEVING: "Searching the analysed codebase",
  CONTEXTUALIZING: "Reading the shortlisted files",
  RESOLVING: "Pinpointing each checkpoint",
  NEEDS_REVIEW: "Needs your review",
  READY: "Ready",
  FAILED: "Analysis failed",
};

function placementLabel(kind?: string | null): string {
  if (!kind) return "";
  return kind.toLowerCase().replaceAll("_", " ");
}

function confidenceLabel(value?: number | null): string | null {
  return typeof value === "number" && value > 0
    ? `${Math.round(value * 100)}% confidence`
    : null;
}

function locationLabel(
  file?: string | null,
  symbol?: string | null,
  startLine?: number | null,
): string | null {
  if (!file) return null;
  return `${file}${startLine ? `:${startLine}` : ""}${symbol ? ` · ${symbol}` : ""}`;
}

/**
 * What mapping is doing, while it does it.
 *
 * Each of these takes real time on a real repository — analysis can run for
 * minutes, and the upload consent prompt sits inside the first one. A single
 * unchanging line is indistinguishable from a hang, so the work is named, in
 * order, with the current step called out and the ones already behind it
 * marked done.
 */
const FLOW_MAPPING_STAGES = [
  {
    id: "WAITING_FOR_ANALYSIS",
    title: "Reading your code",
    detail:
      "Checking the analysis still matches what is on disk, and analysing it again if not.",
    slow: "On a large project this is the slow part.",
  },
  {
    id: "RETRIEVING",
    title: "Finding candidates",
    detail:
      "Searching the analysed codebase for the places each state and transition could live.",
    slow: null,
  },
  {
    id: "CONTEXTUALIZING",
    title: "Reading the shortlist",
    detail:
      "Opening the files that matched, so the choice is made against your real code.",
    slow: null,
  },
  {
    id: "RESOLVING",
    title: "Pinpointing placements",
    detail: "Working out the exact place each checkpoint belongs.",
    slow: null,
  },
] as const;

function FlowMappingProgressPanel({
  progress,
  checkpointCount,
  busy,
  onRetry,
}: {
  progress: { status?: string; message?: string | null } | undefined;
  checkpointCount: number;
  busy?: boolean;
  onRetry?: () => void;
}) {
  const status = String(progress?.status ?? "WAITING_FOR_ANALYSIS");
  const failed = status === "FAILED";
  const activeIndex = FLOW_MAPPING_STAGES.findIndex(
    (stage) => stage.id === status,
  );
  // An unknown status is still forward motion, not a reason to show nothing.
  const current = activeIndex < 0 ? 0 : activeIndex;

  return (
    <section
      className="content-card flow-mapping-progress"
      aria-busy={!failed}
      aria-live="polite"
    >
      <div className="card-heading">
        <div>
          <small>Working</small>
          <h2>Mapping this Flow to your code</h2>
        </div>
        {checkpointCount ? (
          <Status>{checkpointCount} checkpoints</Status>
        ) : null}
      </div>

      {failed ? (
        <div className="context-banner mt-4!" role="alert">
          <AlertTriangle size={15} />
          {progress?.message || "Mapping could not be completed."}
          {onRetry ? (
            <button className="button" disabled={busy} onClick={onRetry}>
              <RefreshCw size={15} />
              Try again
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <ol className="flow-stage-list">
            {FLOW_MAPPING_STAGES.map((stage, index) => {
              const state =
                index < current ? "done" : index === current ? "current" : "pending";
              return (
                <li key={stage.id} className="flow-stage" data-state={state}>
                  <span className="flow-stage-marker" aria-hidden="true">
                    {state === "done" ? <Check size={12} /> : null}
                  </span>
                  <div>
                    <strong>{stage.title}</strong>
                    <p className="muted">
                      {state === "current" && progress?.message
                        ? progress.message
                        : stage.detail}
                      {state === "current" && stage.slow ? ` ${stage.slow}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* A hint of the shape the results will take, so the page reads as
              filling in rather than as empty. */}
          <div className="flow-skeleton" aria-hidden="true">
            {[0, 1, 2].map((row) => (
              <div className="flow-skeleton-row" key={row}>
                <span className="flow-skeleton-bar" data-width="title" />
                <span className="flow-skeleton-bar" data-width="location" />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * One declared checkpoint and the place in the repository it maps to.
 *
 * A row is the whole decision: what was declared, where Tellann believes it
 * lives, why, and — when the evidence supports more than one place — the ranked
 * alternatives to choose between. Nothing here asks the user to go and find the
 * location themselves; that was the failure this review replaces.
 */
function FlowMappingRow({
  checkpoint,
  pendingCandidateId,
  onConfirm,
  onReveal,
}: {
  checkpoint: FlowCheckpointView;
  /** The candidate being confirmed for *this* checkpoint, if any. */
  pendingCandidateId: string | null;
  onConfirm(checkpointId: string, candidate: FlowMappingCandidateView): void;
  onReveal(file: string, line?: number | null): void;
}) {
  const mapping = checkpoint.mapping ?? {};
  const status = String(mapping.status ?? "UNRESOLVED");
  const resolved = status === "RESOLVED";
  const alternatives = mapping.alternatives ?? [];
  const location = locationLabel(
    mapping.file,
    mapping.symbol,
    mapping.startLine,
  );
  const confidence = confidenceLabel(mapping.confidence);
  const [openCandidates, setOpenCandidates] = useState(false);

  return (
    <div className="flow-mapping-row" data-status={status}>
      <div className="flow-mapping-row-head">
        <div className="flow-mapping-row-title">
          <strong>{checkpoint.label ?? checkpoint.id}</strong>
          {checkpoint.stateRole && checkpoint.stateRole !== "NORMAL" ? (
            <span className="muted">
              {checkpoint.stateRole === "INITIAL" ? "start" : "finish"}
            </span>
          ) : null}
        </div>
        <Status>{FLOW_MAPPING_STATUS_LABEL[status] ?? status}</Status>
      </div>
      {location ? (
        <div className="flow-mapping-location">
          <code>{location}</code>
          <div className="flow-mapping-location-meta">
            {mapping.placementKind ? (
              <span className="muted">
                at {placementLabel(mapping.placementKind)}
              </span>
            ) : null}
            {confidence ? <span className="muted">{confidence}</span> : null}
            {mapping.userConfirmed ? (
              <span className="muted">chosen by you</span>
            ) : null}
            <button
              className="button subtle"
              onClick={() => onReveal(mapping.file!, mapping.startLine)}
            >
              <FileSearch size={14} />
              Show me where
            </button>
          </div>
        </div>
      ) : null}
      {mapping.rationale ? <p>{mapping.rationale}</p> : null}
      {resolved ? null : (
        <div className="flow-mapping-resolve">
          <p className="muted">
            {status === "AMBIGUOUS"
              ? `The evidence points at ${alternatives.length} place${alternatives.length === 1 ? "" : "s"}. Pick the one where this happens.`
              : status === "UNSUPPORTED"
                ? "Tellann found this behaviour but cannot safely insert a line at that exact point. Choose another location, or add it yourself with manual initialization."
                : "Tellann could not find where this happens in your analysed code. Choose a location below, or add it yourself with manual initialization."}
          </p>
          {alternatives.length ? (
            <>
              <button
                className="button"
                onClick={() => setOpenCandidates((open) => !open)}
              >
                <ChevronDown size={14} />
                {openCandidates ? "Hide" : "Show"} {alternatives.length}{" "}
                candidate{alternatives.length === 1 ? "" : "s"}
              </button>
              {openCandidates ? (
                <ul className="flow-candidate-list">
                  {alternatives.map((candidate) => {
                    const file = candidate.file ?? candidate.path ?? "";
                    const candidateConfidence = confidenceLabel(
                      candidate.confidence ?? candidate.score,
                    );
                    const kinds = candidate.placementKind
                      ? [candidate.placementKind]
                      : (candidate.placementKinds ?? []);
                    return (
                      <li key={candidate.id}>
                        <div className="flow-candidate-head">
                          <code>
                            {locationLabel(
                              file,
                              candidate.symbol,
                              candidate.startLine,
                            )}
                          </code>
                          {candidateConfidence ? (
                            <span className="muted">
                              {candidateConfidence}
                            </span>
                          ) : null}
                        </div>
                        {candidate.rationale ? (
                          <p className="muted">{candidate.rationale}</p>
                        ) : null}
                        {/* The excerpt is what makes this a decision rather
                            than a guess — show the code before confirming. */}
                        {candidate.excerpt ? (
                          <pre className="flow-candidate-excerpt">
                            {candidate.excerpt.slice(0, 1200)}
                          </pre>
                        ) : null}
                        <div className="flow-candidate-actions">
                          {kinds.length ? (
                            <span className="muted">
                              {placementLabel(kinds[0])}
                            </span>
                          ) : null}
                          {file ? (
                            <button
                              className="button subtle"
                              onClick={() =>
                                onReveal(file, candidate.startLine)
                              }
                            >
                              <FileSearch size={14} />
                              Open
                            </button>
                          ) : null}
                          {/* Confirming one location locks only the siblings
                              it competes with. Gating this on the shared
                              desktop busy flag greyed out every candidate of
                              every checkpoint at once, so one click read as
                              the whole list going dead. */}
                          <button
                            className="button primary"
                            disabled={
                              pendingCandidateId !== null || !kinds.length
                            }
                            onClick={() => onConfirm(checkpoint.id, candidate)}
                          >
                            {pendingCandidateId === candidate.id ? (
                              <>
                                <RefreshCw size={14} className="spin" />
                                Using this location…
                              </>
                            ) : (
                              <>
                                <Check size={14} />
                                Use this location
                              </>
                            )}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * The evidence-grounded review of a published Flow against the analysed
 * codebase.
 *
 * Reads the v2 report where there is one and falls back to the v1 summary for
 * initializations recorded before evidence-grounded mapping existed, so an old
 * record still opens instead of rendering blank.
 */
/**
 * A candidate is worth offering as a bulk acceptance when the ranking is
 * confident and there is daylight between it and the runner-up. Below that the
 * choice is genuinely the reviewer's, and pre-selecting it would be asking them
 * to rubber-stamp a guess.
 */
const BULK_ACCEPT_MIN_CONFIDENCE = 0.6;
const BULK_ACCEPT_MIN_MARGIN = 0.08;

function bulkAcceptable(checkpoints: FlowCheckpointView[]) {
  const accepted: Array<{ checkpointId: string; candidate: FlowMappingCandidateView }> = [];
  for (const checkpoint of checkpoints) {
    const mapping = (checkpoint as any).mapping;
    if (!mapping || mapping.status === "RESOLVED") continue;
    const alternatives = (mapping.alternatives ?? []) as FlowMappingCandidateView[];
    const [best, runnerUp] = alternatives;
    if (!best) continue;
    const confidence = Number((best as any).confidence ?? 0);
    const margin = confidence - Number((runnerUp as any)?.confidence ?? 0);
    if (confidence < BULK_ACCEPT_MIN_CONFIDENCE) continue;
    if (runnerUp && margin < BULK_ACCEPT_MIN_MARGIN) continue;
    accepted.push({ checkpointId: String(checkpoint.id), candidate: best });
  }
  return accepted;
}

function FlowReviewPanel({
  initialization,
  onReanalyze,
  onConfirmMapping,
  onConfirmMappings,
  onRetryResolution,
  onRevealEvidence,
  pendingMappings,
  bulkConfirming,
  busy,
}: {
  initialization: FlowInitialization;
  onReanalyze?: () => void;
  onConfirmMapping?(
    checkpointId: string,
    candidate: FlowMappingCandidateView,
  ): void;
  onConfirmMappings?(
    entries: Array<{ checkpointId: string; candidate: FlowMappingCandidateView }>,
  ): void;
  onRetryResolution?(): void;
  onRevealEvidence?(file: string, line?: number | null): void;
  /** Checkpoint id -> the candidate id currently being confirmed for it. */
  pendingMappings?: Record<string, string>;
  bulkConfirming?: boolean;
  busy?: boolean;
}) {
  const report = initialization.codeReviewReport as any;
  if (!report) return <LoadingState />;
  if (report.version !== "2.0") {
    // While mapping is still running, the only report on record is the
    // filename-matched fallback. Showing its "0/22 states mapped" next to a
    // banner saying the real analysis is in progress states a result that has
    // not been reached yet — and 0/N is the exact thing evidence-grounded
    // mapping exists to stop saying. The banner speaks for this state instead.
    const mappingStatus = String(
      (initialization as any).scan?.mappingStatus ?? "",
    );
    const mappingPending =
      initialization.stage === "SCANNING" ||
      [
        "WAITING_FOR_ANALYSIS",
        "RETRIEVING",
        "CONTEXTUALIZING",
        "RESOLVING",
      ].includes(mappingStatus);
    if (mappingPending) {
      return (
        <FlowMappingProgressPanel
          progress={(initialization as any).scan?.mappingProgress}
          checkpointCount={
            ((initialization.manifest as any)?.checkpoints ?? []).length
          }
          busy={busy}
          onRetry={onReanalyze}
        />
      );
    }
    return (
      <LegacyFlowReviewPanel
        initialization={initialization}
        onReanalyze={onReanalyze}
        busy={busy}
      />
    );
  }

  const checkpoints = ((initialization.manifest as any)?.checkpoints ??
    []) as FlowCheckpointView[];
  const states = checkpoints.filter((item) => item.kind === "STATE");
  const transitions = checkpoints.filter((item) => item.kind === "TRANSITION");
  const progress = report.progress ?? {};
  const analysis = report.analysis ?? {};
  const ai = report.ai ?? {};
  const remaining = Number(progress.unresolvedCount ?? 0);
  const staged = !["READY", "NEEDS_REVIEW"].includes(
    String(progress.status ?? ""),
  );

  const groups: Array<[string, FlowCheckpointView[]]> = [
    ["States", states],
    ["Transitions", transitions],
  ];
  const acceptable = onConfirmMappings ? bulkAcceptable(checkpoints) : [];
  // A run where every call failed and a run where the model considered each
  // checkpoint and was unsure both end as "choose one yourself". They ask
  // completely different things of the reader, so they no longer look alike.
  const resolutionFailed = Boolean(ai.failed);

  return (
    <section className="content-card flow-review-panel">
      <div className="card-heading">
        <div>
          <small>Code review</small>
          <h2>Where this Flow lives in your code</h2>
        </div>
        <div className="flex items-center gap-2">
          <Status>
            {ai.attempted && ai.provider
              ? `${String(ai.provider).toLowerCase()} + analysis`
              : "analysis only"}
          </Status>
          {onReanalyze ? (
            <button
              className="button"
              disabled={busy}
              onClick={onReanalyze}
              title="Analyse the project again and rebuild these locations"
            >
              <RefreshCw size={15} />
              Re-run analysis
            </button>
          ) : null}
        </div>
      </div>

      {/* Freshness first: a location is only as trustworthy as the analysis it
          came from, so say which commit it describes before showing any of it. */}
      <dl className="detail-list flow-analysis-identity">
        <div>
          <dt>Analysed</dt>
          <dd>
            {analysis.branch ?? "this folder"}
            {analysis.revision
              ? ` · ${String(analysis.revision).slice(0, 8)}`
              : ""}
            {analysis.dirty ? " · uncommitted changes" : ""}
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            {analysis.mode === "CLOUD_APPROVED"
              ? "Uploaded for analysis"
              : "Stayed on this device"}
          </dd>
        </div>
        <div>
          <dt>Checkpoints located</dt>
          <dd>
            {Number(progress.resolvedCount ?? 0)}/
            {Number(progress.totalCheckpoints ?? checkpoints.length)}
          </dd>
        </div>
      </dl>

      {staged ? (
        <div className="context-banner mt-4!">
          <Activity size={15} />
          {FLOW_PROGRESS_LABEL[String(progress.status)] ??
            "Working through your code…"}
        </div>
      ) : null}

      <p className="flow-review-findings-note">
        {remaining
          ? `${remaining} of ${Number(progress.totalCheckpoints ?? checkpoints.length)} checkpoints still need a location. Choose one for each, or use manual initialization and place them yourself.`
          : "Every declared state and transition has a location in your code."}
      </p>

      {resolutionFailed ? (
        <div className="infobar" data-tone="warning" role="status">
          <TriangleAlert size={16} />
          <span>
            {Number(ai.batchesFailed ?? 0) === Number(ai.batches ?? 0)
              ? "Automatic placement could not be completed"
              : `Automatic placement finished for some checkpoints but not others (${Number(ai.batchesFailed ?? 0)} of ${Number(ai.batches ?? 0)} batches failed)`}
            {ai.failureReasonSafe ? ` — ${String(ai.failureReasonSafe)}.` : "."} The
            evidence below was still gathered, so you can retry the placement or
            choose the locations yourself.
          </span>
          {onRetryResolution ? (
            <button className="button" type="button" disabled={busy} onClick={onRetryResolution}>
              <RefreshCw size={15} />
              Retry placement
            </button>
          ) : null}
        </div>
      ) : null}

      {ai.consentMode === "GRAPH_ONLY" && ai.attempted === false ? (
        <p className="muted">
          These locations come from the codebase analysis alone — no source was
          sent to an AI provider. They are still evidence-backed; the ranking is
          just less specific about exactly which line to use.
        </p>
      ) : null}

      {acceptable.length > 1 ? (
        <div className="flow-review-bulk">
          <button
            className="button"
            type="button"
            disabled={busy || bulkConfirming}
            onClick={() => onConfirmMappings?.(acceptable)}
          >
            {bulkConfirming
              ? "Accepting…"
              : `Accept ${acceptable.length} high-confidence locations`}
          </button>
          <span className="muted">
            Only where one candidate clearly leads the ranking. Everything else
            stays for you to decide.
          </span>
        </div>
      ) : null}

      {groups.map(([title, items]) =>
        items.length ? (
          <div className="flow-mapping-group" key={title}>
            <h3>{title}</h3>
            {items.map((checkpoint) => (
              <FlowMappingRow
                key={checkpoint.id}
                checkpoint={checkpoint}
                pendingCandidateId={pendingMappings?.[checkpoint.id] ?? null}
                onConfirm={(checkpointId, candidate) =>
                  onConfirmMapping?.(checkpointId, candidate)
                }
                onReveal={(file, line) => onRevealEvidence?.(file, line)}
              />
            ))}
          </div>
        ) : null,
      )}

      {report.edgeCases?.length ? (
        <AccordionItem value="flow-review-edge-cases">
          <AccordionTrigger>
            Problems with the declared Flow itself ({report.edgeCases.length})
          </AccordionTrigger>
          <AccordionContent>
            <div className="stack">
              {report.edgeCases.map((item: any, index: number) => (
                <div className="muted-callout" key={`${item.code}-${index}`}>
                  <strong>{formatEnum(String(item.code))}</strong>
                  {item.explanation ? <p>{String(item.explanation)}</p> : null}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ) : null}
    </section>
  );
}

/** The pre-evidence review, kept so initializations recorded before v2 still open. */
function LegacyFlowReviewPanel({
  initialization,
  onReanalyze,
  busy,
}: {
  initialization: FlowInitialization;
  onReanalyze?: () => void;
  busy?: boolean;
}) {
  const report = initialization.codeReviewReport as any;
  return (
    <section className="content-card flow-review-panel">
      <div className="card-heading">
        <div>
          <small>First code review</small>
          <h2>Declared intent against the repository</h2>
        </div>
        <div className="flex items-center gap-2">
          <Status>recorded before evidence mapping</Status>
          {onReanalyze ? (
            <button className="button" disabled={busy} onClick={onReanalyze}>
              <RefreshCw size={15} />
              Re-run analysis
            </button>
          ) : null}
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          label="States mapped"
          value={`${report.summary.mappedStates}/${report.summary.totalStates}`}
        />
        <Metric
          label="Transitions mapped"
          value={`${report.summary.mappedTransitions}/${report.summary.totalTransitions}`}
        />
      </div>
      <p className="flow-review-findings-note">
        This review predates evidence-grounded mapping. Re-run the analysis to
        get exact file locations for every checkpoint.
      </p>
    </section>
  );
}

type RoadmapStep = ManualRoadmap["steps"][number];

const FLOW_GRAPH = { nodeW: 190, nodeH: 62, xGap: 60, yGap: 118, pad: 34 };

// The step titles carry the human name inside quotes, e.g.
// `Record when the flow reaches "Checkout"` — pull it out for compact labels.
function quotedName(title: string): string {
  return title.match(/"([^"]+)"/)?.[1] ?? title;
}

function stepKindLabel(kind: string): string {
  return kind === "TRANSITION"
    ? "Transition"
    : kind === "TERMINAL"
      ? "Finish state"
      : kind === "PREREQUISITE"
        ? "Setup"
        : kind === "VERIFY"
          ? "Verify"
          : "State";
}

/** What the last "check my code" pass found, so the card can explain itself. */
type FlowCodeScanOutcome = {
  completed: boolean;
  filesScanned: number;
  markersFound: number;
  error?: string;
};

function FlowRoadmap({
  roadmap,
  manifest,
  verification,
  busy,
  scanOutcome,
  onToggle,
  onVerify,
  onRebuild,
  onRevealEvidence,
}: {
  roadmap: ManualRoadmap;
  manifest?: {
    checkpoints?: Array<Record<string, any>>;
    initialStateId?: string;
  } | null;
  verification: any;
  busy: boolean;
  scanOutcome: FlowCodeScanOutcome | null;
  onToggle(stepId: string, completed: boolean): void;
  onVerify(): void;
  onRebuild?: () => void;
  /** Opens a step's location in the editor; absent when no folder is attached. */
  onRevealEvidence?: (file: string, line?: number | null) => void;
}) {
  const stepById = useMemo(
    () => new Map(roadmap.steps.map((step) => [step.id, step] as const)),
    [roadmap.steps],
  );

  // Lay states out in longest-path layers from the declared initial state;
  // transitions become the edges between them.
  const graph = useMemo(() => {
    const checkpoints = manifest?.checkpoints ?? [];
    const stateCps = checkpoints.filter((c) => c.kind === "STATE");
    const transitionCps = checkpoints.filter((c) => c.kind === "TRANSITION");
    if (!stateCps.length) return null;

    const edges = transitionCps
      .map((t) => ({
        from: String(t.fromCheckpointId ?? ""),
        to: String(t.toCheckpointId ?? ""),
      }))
      .filter((e) => e.from && e.to);

    const layer = new Map<string, number>();
    for (const cp of stateCps) layer.set(String(cp.id), 0);
    const initialId = `state:${manifest?.initialStateId ?? ""}`;
    if (layer.has(initialId)) {
      for (let pass = 0; pass < stateCps.length; pass += 1) {
        let changed = false;
        for (const edge of edges) {
          const from = layer.get(edge.from);
          if (from === undefined) continue;
          if ((layer.get(edge.to) ?? 0) < from + 1) {
            layer.set(edge.to, from + 1);
            changed = true;
          }
        }
        if (!changed) break;
      }
    }
    const deepest = Math.max(0, ...layer.values());
    const byLayer = new Map<number, string[]>();
    for (const cp of stateCps) {
      const id = String(cp.id);
      const lvl = layer.get(id) ?? deepest + 1;
      if (!byLayer.has(lvl)) byLayer.set(lvl, []);
      byLayer.get(lvl)!.push(id);
    }
    const rows = [...byLayer.keys()].sort((a, b) => a - b);
    const rowWidth = (count: number) =>
      count * FLOW_GRAPH.nodeW + Math.max(0, count - 1) * FLOW_GRAPH.xGap;
    const widest = Math.max(
      ...rows.map((r) => rowWidth(byLayer.get(r)!.length)),
    );
    const pos = new Map<string, { x: number; y: number }>();
    rows.forEach((row, rowIndex) => {
      const ids = byLayer.get(row)!;
      const startX = FLOW_GRAPH.pad + (widest - rowWidth(ids.length)) / 2;
      ids.forEach((id, i) => {
        pos.set(id, {
          x: startX + i * (FLOW_GRAPH.nodeW + FLOW_GRAPH.xGap),
          y: FLOW_GRAPH.pad + rowIndex * (FLOW_GRAPH.nodeH + FLOW_GRAPH.yGap),
        });
      });
    });
    return {
      nodes: stateCps.map((cp) => ({ id: String(cp.id), cp })),
      transitions: transitionCps,
      pos,
      width: widest + FLOW_GRAPH.pad * 2,
      height:
        FLOW_GRAPH.pad * 2 +
        rows.length * FLOW_GRAPH.nodeH +
        Math.max(0, rows.length - 1) * FLOW_GRAPH.yGap,
    };
  }, [manifest]);

  const observed = useMemo(
    () => new Set<string>(verification?.observedCheckpointIds ?? []),
    [verification?.observedCheckpointIds],
  );
  const missing = useMemo(
    () => new Set<string>(verification?.missingCheckpointIds ?? []),
    [verification?.missingCheckpointIds],
  );

  // Initialization needs the flow's boundaries only: the declared initial state
  // and one terminal state. Those are the steps we put in front of the user; the
  // rest of the graph stays available but never blocks them.
  const requiredSteps = useMemo(() => {
    const checkpoints = manifest?.checkpoints ?? [];
    // Read the boundaries off the manifest rather than off the step flags, so a
    // roadmap generated before this contract still shows just its two ends.
    const ordered = [
      ...checkpoints.filter((cp) => cp.stateRole === "INITIAL"),
      ...checkpoints.filter((cp) => cp.stateRole === "TERMINAL"),
    ].map((cp) => String(cp.id));
    const steps = ordered.length
      ? ordered
          .map((id) => stepById.get(id))
          .filter((step): step is RoadmapStep => Boolean(step))
      : roadmap.steps.filter(
          (step) =>
            step.kind !== "VERIFY" && (step as any).required !== false,
        );
    return steps.filter((step) => Boolean(step.snippet));
  }, [manifest, roadmap.steps, stepById]);
  const requiredSummary = useMemo(() => {
    if (!verification?.startedAt) return "NOT CHECKED YET";
    const startFound = requiredSteps.some(
      (step) => step.kind !== "TERMINAL" && observed.has(step.id),
    );
    const finishFound = requiredSteps.some(
      (step) => step.kind === "TERMINAL" && observed.has(step.id),
    );
    if (startFound && finishFound) return "BOTH FOUND";
    if (startFound) return "FINISH MARKER MISSING";
    if (finishFound) return "START MARKER MISSING";
    return "NOT FOUND YET";
  }, [observed, requiredSteps, verification?.startedAt]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    setSelectedId((current) => {
      if (current && stepById.has(current)) return current;
      return (
        roadmap.steps.find((s) => s.status === "CURRENT" && s.kind !== "VERIFY")
          ?.id ??
        roadmap.steps.find((s) => s.kind !== "VERIFY")?.id ??
        null
      );
    });
  }, [roadmap.steps, stepById]);
  const selected = selectedId ? (stepById.get(selectedId) ?? null) : null;

  // Where the code scan actually found this checkpoint, so the user can tell a
  // marker they just added from one that was already there.
  const evidenceLocation = (step: RoadmapStep): string | null => {
    const hit = (step.verificationEvidence ?? []).find(
      (item: any) => item?.file,
    ) as { file?: string; line?: number } | undefined;
    return hit?.file ? `${hit.file}${hit.line ? `:${hit.line}` : ""}` : null;
  };

  const renderPanel = (step: RoadmapStep) => {
    const completed = ["DONE", "VERIFIED"].includes(step.status);
    const deps = (step.dependencies ?? [])
      .map((id) => stepById.get(id))
      .filter((s): s is RoadmapStep => Boolean(s))
      .map((s) => quotedName(s.title));
    return (
      <div className="flow-graph-panel-body">
        <div className="flow-graph-panel-head">
          <span className="flow-graph-kind">
            {stepKindLabel(step.kind)}
            {(step as any).required === false ? " · optional" : " · required"}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Close details"
            onClick={() => setSelectedId(null)}
          >
            <X size={15} />
          </button>
          <h3>{quotedName(step.title)}</h3>
        </div>
        <p className="flow-graph-panel-desc">{step.description}</p>
        <div className="flow-graph-panel-row">
          <small>Where to add it</small>
          {step.file ? (
            <>
              <code>
                {step.file}
                {step.startLine ? `:${step.startLine}` : ""}
                {step.symbol ? ` · ${step.symbol}` : ""}
              </code>
              {/* Manual placement gets the same evidence the automated path
                  would have acted on: where, at what kind of point, why, and
                  how sure — not just a filename. */}
              <div className="flow-mapping-location-meta">
                {step.placementKind ? (
                  <span className="muted">
                    at {placementLabel(step.placementKind)}
                  </span>
                ) : null}
                {confidenceLabel(step.confidence) ? (
                  <span className="muted">
                    {confidenceLabel(step.confidence)}
                  </span>
                ) : null}
                {onRevealEvidence ? (
                  <button
                    className="button subtle"
                    onClick={() =>
                      onRevealEvidence(step.file!, step.startLine)
                    }
                  >
                    <FileSearch size={14} />
                    Show me where
                  </button>
                ) : null}
              </div>
              {step.rationale ? (
                <p className="muted">{step.rationale}</p>
              ) : null}
            </>
          ) : (
            <span className="muted">
              Tellann could not pinpoint this. Add the line wherever this
              happens in your code.
            </span>
          )}
        </div>
        {step.alternatives?.length ? (
          <div className="flow-graph-panel-row">
            <small>Other places it could go</small>
            <ul className="flow-candidate-list">
              {step.alternatives.slice(0, 4).map((candidate) => (
                <li key={candidate.id}>
                  <div className="flow-candidate-head">
                    <code>
                      {candidate.file}
                      {candidate.startLine ? `:${candidate.startLine}` : ""}
                      {candidate.symbol ? ` · ${candidate.symbol}` : ""}
                    </code>
                    {confidenceLabel(candidate.confidence) ? (
                      <span className="muted">
                        {confidenceLabel(candidate.confidence)}
                      </span>
                    ) : null}
                  </div>
                  {candidate.rationale ? (
                    <p className="muted">{candidate.rationale}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {step.snippet ? (
          <div className="flow-graph-panel-row">
            <CopyableCodeBlock
              label={<small className="muted">Checkpoint code</small>}
              code={step.snippet}
            />
          </div>
        ) : null}
        {step.kind !== "VERIFY" ? (
          <label className="check-row flow-graph-panel-check">
            <Switch
              checked={completed}
              disabled={
                busy || step.status === "BLOCKED" || step.status === "VERIFIED"
              }
              onCheckedChange={(checked) => onToggle(step.id, checked)}
            />
            <span>
              <strong>I added this checkpoint</strong>
            </span>
          </label>
        ) : null}
        <div>
          {step.status === "VERIFIED" || observed.has(step.id) ? (
            <span className="flow-graph-badge is-ok">
              <Check size={13} /> Found in your code
              {evidenceLocation(step) ? ` · ${evidenceLocation(step)}` : ""}
            </span>
          ) : missing.has(step.id) ? (
            <span className="flow-graph-badge is-wait">
              Not found in your code yet
            </span>
          ) : (
            <span className="flow-graph-badge">
              {(step as any).required === false
                ? "Optional — not needed to initialize"
                : "Not checked yet"}
            </span>
          )}
        </div>
        {deps.length ? (
          <div className="flow-graph-panel-row">
            <small>Comes after</small>
            <span>{deps.join(", ")}</span>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <section className="content-card flow-roadmap-shell mt-6 rounded-lg">
      <div className="card-heading">
        <div>
          <small>Manual initialization</small>
          <h2>Mark where this flow starts and ends in your code</h2>
        </div>
        <div className="flex items-center gap-2">
          <Status>
            {String(verification?.status ?? "ROADMAP READY").replaceAll(
              "_",
              " ",
            )}
          </Status>
          {onRebuild ? (
            <button
              className="button"
              disabled={busy}
              onClick={onRebuild}
              title="Rebuild this roadmap from a fresh analysis. Resets the checklist ticks below."
            >
              <RefreshCw size={15} />
              Rebuild roadmap
            </button>
          ) : null}
        </div>
      </div>

      <details className="flow-graph-help">
        <summary>How this works</summary>
        <div className="muted stack" style={{ gap: 6 }}>
          <p>
            Tellann needs to know where this flow begins and where it can end in
            your code. That is two lines — everything else in the graph is
            optional detail you can add whenever you like.
          </p>
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            <li>
              Paste the <strong>start</strong> line where the flow begins, and
              one <strong>finish</strong> line where it ends.
            </li>
            <li>
              Click <strong>“Check my code”</strong>. Tellann searches the
              attached project folder for those markers — your app does not have
              to be running.
            </li>
            <li>
              Once both are found, the flow is initialized and you can start a
              QA run.
            </li>
          </ol>
          <p>
            Optional: add the in-between states and transitions from the graph
            for a finer-grained picture during runs.
          </p>
        </div>
      </details>

      {requiredSteps.length ? (
        <div className="flow-required-markers">
          <div className="flow-required-head">
            <h3>Add these lines to your code</h3>
            <Status>{requiredSummary}</Status>
          </div>
          <p className="muted">
            The start marker is required, plus <strong>at least one</strong>{" "}
            finish marker. Put each one where that moment actually happens in
            your code.
          </p>
          <div className="flow-required-list">
            {requiredSteps.map((step) => (
              <div
                key={step.id}
                className={`flow-required-item ${
                  observed.has(step.id) ? "is-found" : ""
                }`}
              >
                <CopyableCodeBlock
                  label={
                    <small className="muted">
                      {step.kind === "TERMINAL" ? "Finish" : "Start"} ·{" "}
                      {quotedName(step.title)}
                      {observed.has(step.id) ? " · found in your code" : ""}
                    </small>
                  }
                  code={step.snippet}
                />
                {step.file ? (
                  <small className="muted">
                    Suggested location: <code>{step.file}</code>
                    {step.symbol ? ` · ${step.symbol}` : ""}
                  </small>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* {graph ? (
        <div className="flow-graph" aria-label="Flow checkpoint graph">
          <div className="flow-graph-canvas-wrap">
            <div
              className="flow-graph-inner"
              style={{ width: graph.width, height: graph.height }}
            >
              <svg
                className="flow-graph-edges"
                width={graph.width}
                height={graph.height}
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="tellann-flow-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,0 L10,5 L0,10 z" fill="#5b6570" />
                  </marker>
                </defs>
                {graph.transitions.map((transition) => {
                  const a = graph.pos.get(String(transition.fromCheckpointId));
                  const b = graph.pos.get(String(transition.toCheckpointId));
                  if (!a || !b) return null;
                  const ax = a.x + FLOW_GRAPH.nodeW / 2;
                  const ay = a.y + FLOW_GRAPH.nodeH;
                  const bx = b.x + FLOW_GRAPH.nodeW / 2;
                  const by = b.y;
                  const forward = by > ay;
                  const midY = (ay + by) / 2;
                  const path = forward
                    ? `M ${ax} ${ay} C ${ax} ${midY}, ${bx} ${midY}, ${bx} ${by}`
                    : `M ${ax} ${ay} C ${ax + 140} ${ay}, ${bx + 140} ${by}, ${bx} ${by}`;
                  const step = stepById.get(String(transition.id));
                  const label = quotedName(
                    step?.title ?? String(transition.id),
                  );
                  const isSelected = selected?.id === transition.id;
                  const isDone =
                    step && ["DONE", "VERIFIED"].includes(step.status);
                  const labelW = Math.min(200, 18 + label.length * 6.2);
                  const lx = forward ? (ax + bx) / 2 : Math.max(ax, bx) + 90;
                  const ly = forward ? midY : (ay + by) / 2;
                  return (
                    <g key={transition.id}>
                      <path
                        d={path}
                        fill="none"
                        stroke={
                          isSelected
                            ? "#9b72ff"
                            : observed.has(String(transition.id))
                              ? "#6ca86c"
                              : "#3f4650"
                        }
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        strokeDasharray={isDone ? undefined : "5 4"}
                        markerEnd="url(#tellann-flow-arrow)"
                      />
                      <g
                        className="flow-graph-edge-label"
                        transform={`translate(${lx} ${ly})`}
                        onClick={() => setSelectedId(String(transition.id))}
                      >
                        <rect
                          x={-labelW / 2}
                          y={-11}
                          width={labelW}
                          height={22}
                          rx={5}
                        />
                        <text x={0} y={4} textAnchor="middle">
                          {label}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
              {graph.nodes.map((node) => {
                const place = graph.pos.get(node.id);
                if (!place) return null;
                const step = stepById.get(node.id);
                const status = step?.status ?? "PENDING";
                const isDone = ["DONE", "VERIFIED"].includes(status);
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`flow-graph-node is-${status.toLowerCase()} ${
                      selected?.id === node.id ? "is-selected" : ""
                    } ${observed.has(node.id) ? "is-observed" : ""}`}
                    style={{
                      left: place.x,
                      top: place.y,
                      width: FLOW_GRAPH.nodeW,
                      height: FLOW_GRAPH.nodeH,
                    }}
                    onClick={() => setSelectedId(node.id)}
                  >
                    <span className="flow-graph-node-role">
                      {node.cp.stateRole === "INITIAL"
                        ? "Start"
                        : node.cp.stateRole === "TERMINAL"
                          ? "Finish"
                          : "State"}
                    </span>
                    <span className="flow-graph-node-name">
                      {quotedName(step?.title ?? node.id)}
                    </span>
                    {isDone ? (
                      <span className="flow-graph-node-tick">
                        <Check size={12} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          <aside className="flow-graph-panel">
            {selected ? (
              renderPanel(selected)
            ) : (
              <div className="flow-graph-panel-empty">
                <Network size={28} />
                <p>
                  Select a state or transition in the graph to see its
                  checkpoint code and mark it done.
                </p>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <ol className="flow-graph-fallback">
          {roadmap.steps.map((step) => (
            <li key={step.id} className={`is-${step.status.toLowerCase()}`}>
              <div>
                <small className="flow-graph-kind">
                  {stepKindLabel(step.kind)}
                </small>
                <h4>{step.title}</h4>
                <p>{step.description}</p>
                {step.file ? (
                  <code>
                    {step.file}
                    {step.symbol ? ` · ${step.symbol}` : ""}
                  </code>
                ) : null}
                {step.snippet ? (
                  <CopyableCodeBlock
                    label={<small className="muted">Checkpoint code</small>}
                    code={step.snippet}
                  />
                ) : null}
                {step.kind !== "VERIFY" ? (
                  <label className="check-row">
                    <Switch
                      checked={["DONE", "VERIFIED"].includes(step.status)}
                      disabled={
                        busy ||
                        step.status === "BLOCKED" ||
                        step.status === "VERIFIED"
                      }
                      onCheckedChange={(checked) => onToggle(step.id, checked)}
                    />
                    <span>
                      <strong>I added this checkpoint</strong>
                    </span>
                  </label>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )} */}

      <div className="card-actions mt-4">
        <button
          className="button primary"
          disabled={busy || verification?.status === "COMPLETED"}
          onClick={onVerify}
        >
          <SearchCode size={15} />
          {verification?.status === "COMPLETED"
            ? "Flow initialized"
            : verification?.startedAt
              ? "Check my code again"
              : "Check my code"}
        </button>
      </div>
      {scanOutcome?.error ? (
        <p className="muted-callout" role="alert">
          {scanOutcome.error}
        </p>
      ) : scanOutcome && !scanOutcome.completed ? (
        <p className="muted-callout" role="status">
          Searched {scanOutcome.filesScanned.toLocaleString()} source file
          {scanOutcome.filesScanned === 1 ? "" : "s"} in the attached project and
          could not find{" "}
          {verification?.missingCheckpointIds?.length
            ? verification.missingCheckpointIds
                .map((id: string) => `“${quotedName(stepById.get(id)?.title ?? id)}”`)
                .join(" or ")
            : "the start and finish markers"}
          . Add the line
          {verification?.missingCheckpointIds?.length === 1 ? "" : "s"} above,
          save the file, then check again.
        </p>
      ) : null}
    </section>
  );
}

function highlightCodeSnippet(code: string): ReactNode[] {
  if (!code) return [];
  const tokenRegex =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/[^\n]*|\/\*[\s\S]*?\*\/|\b(?:import|from|export|const|let|var|function|void|return|await|async|type|interface|true|false|null|undefined)\b|\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()|\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*:)|[0-9]+)/g;

  let lastIndex = 0;
  const nodes: ReactNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(code)) !== null) {
    const textBefore = code.slice(lastIndex, match.index);
    if (textBefore) nodes.push(textBefore);

    const token = match[0];
    lastIndex = tokenRegex.lastIndex;

    if (token.startsWith("//") || token.startsWith("/*")) {
      nodes.push(
        <span
          key={nodes.length}
          style={{ color: "#6a9955", fontStyle: "italic" }}
        >
          {token}
        </span>,
      );
    } else if (
      token.startsWith('"') ||
      token.startsWith("'") ||
      token.startsWith("`")
    ) {
      nodes.push(
        <span key={nodes.length} style={{ color: "#ce9178" }}>
          {token}
        </span>,
      );
    } else if (
      /^(?:import|from|export|const|let|var|function|void|return|await|async|type|interface|true|false|null|undefined)$/.test(
        token,
      )
    ) {
      nodes.push(
        <span key={nodes.length} style={{ color: "#c586c0", fontWeight: 600 }}>
          {token}
        </span>,
      );
    } else if (
      code
        .slice(match.index + token.length)
        .trimStart()
        .startsWith("(")
    ) {
      nodes.push(
        <span key={nodes.length} style={{ color: "#dcdcaa" }}>
          {token}
        </span>,
      );
    } else if (
      code
        .slice(match.index + token.length)
        .trimStart()
        .startsWith(":")
    ) {
      nodes.push(
        <span key={nodes.length} style={{ color: "#9cdcfe" }}>
          {token}
        </span>,
      );
    } else if (/^\d+$/.test(token)) {
      nodes.push(
        <span key={nodes.length} style={{ color: "#b5cea8" }}>
          {token}
        </span>,
      );
    } else {
      nodes.push(token);
    }
  }

  const textAfter = code.slice(lastIndex);
  if (textAfter) nodes.push(textAfter);

  return nodes;
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
            cursor: "default",
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
        {highlightCodeSnippet(code)}
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
    (isFrontend ? "@tellann/frontend-sdk" : "@tellann/backend-sdk");

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
      snippet = `import { TELLANN } from '${packageName}';

// IMPORTANT: Initialize at top-level file scope (e.g. in main.tsx or top of App.tsx OUTSIDE React components)
TELLANN.initialize({
    endpoint: import.meta.env.VITE_TELLANN_GATEWAY_URL || '${endpointStr}',
    apiKey: import.meta.env.VITE_TELLANN_INGESTION_KEY,
    applicationId: '${applicationId}',
    environmentId: '${environmentId}'
});

void TELLANN.verifyInstallation();`;
    } else if (isReact && !isNextJs) {
      snippet = `import { TELLANN } from '${packageName}';

// IMPORTANT: Initialize at top-level file scope (e.g. in index.tsx or top of App.tsx OUTSIDE React components)
TELLANN.initialize({
    endpoint: process.env.REACT_APP_TELLANN_GATEWAY_URL || '${endpointStr}',
    apiKey: process.env.REACT_APP_TELLANN_INGESTION_KEY,
    applicationId: '${applicationId}',
    environmentId: '${environmentId}'
});

void TELLANN.verifyInstallation();`;
    } else if (isNextJs) {
      snippet = `import { TELLANN } from '${packageName}';

// Initialize Tellann browser telemetry for Next.js (e.g. in app/layout.tsx or _app.tsx)
TELLANN.initialize({
    endpoint: process.env.NEXT_PUBLIC_TELLANN_GATEWAY_URL || '${endpointStr}',
    apiKey: process.env.NEXT_PUBLIC_TELLANN_INGESTION_KEY,
    applicationId: '${applicationId}',
    environmentId: '${environmentId}'
});

void TELLANN.verifyInstallation();`;
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

type BranchDecision = "on-branch" | "confirmed" | "cancelled";

/**
 * Instrumentation writes to whatever branch the workspace is on. QA work belongs
 * on the application's QA review branch, so applying anywhere else is allowed
 * only after the member confirms it. The branch is checked fresh at the moment
 * of applying, not from a cached status. The main process refuses an
 * unconfirmed off-branch apply, so pass `confirmOffQaBranch` only on "confirmed".
 */
function useOffQaBranchConfirmation(projectId: string | undefined) {
  const { refreshBranchCompliance } = useDesktop();
  const [prompt, setPrompt] = useState<{
    currentBranch: string;
    requiredBranch: string;
    blocksRun: boolean;
    resolve(decision: BranchDecision): void;
  } | null>(null);

  const confirmBranch = useCallback(async (): Promise<BranchDecision> => {
    if (!projectId) return "on-branch";
    const compliance = await refreshBranchCompliance(projectId);
    if (compliance?.status !== "BRANCH_MISMATCH") return "on-branch";
    return new Promise<BranchDecision>((resolve) =>
      setPrompt({
        currentBranch: compliance.currentBranch ?? "another branch",
        requiredBranch: compliance.requiredBranch ?? "the QA review branch",
        blocksRun: compliance.blocksRun,
        resolve,
      }),
    );
  }, [projectId, refreshBranchCompliance]);

  const settle = (decision: BranchDecision) => {
    prompt?.resolve(decision);
    setPrompt(null);
  };

  const modal = (
    <ConfirmModal
      isOpen={Boolean(prompt)}
      title="Apply on a different branch?"
      description={
        prompt
          ? `This workspace is on "${prompt.currentBranch}", but QA work for this application happens on "${prompt.requiredBranch}". The changes will be written to "${prompt.currentBranch}" and won't be on the QA review branch until you merge them.${prompt.blocksRun ? ` QA runs stay blocked until the workspace is back on "${prompt.requiredBranch}".` : ""}`
          : ""
      }
      confirmLabel={`Apply on ${prompt?.currentBranch ?? "this branch"}`}
      cancelLabel="Cancel"
      variant="primary"
      onConfirm={() => settle("confirmed")}
      onCancel={() => settle("cancelled")}
    />
  );

  return { confirmBranch, modal };
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
    getDeclaredFlows,
    initializeFlow,
    getFlowInitialization,
    getFlowInitializationProgress,
    analyzeFlowInitialization,
    retryFlowMappingResolution,
    setFlowInitializationMode,
    updateFlowRoadmapStep,
    verifyFlowCheckpointsInCode,
    getFlowVerification,
    confirmFlowMapping,
    confirmFlowMappings,
    openCodebaseEvidence,
  } = useProject();
  const navigate = useNavigate();
  const branchConfirmation = useOffQaBranchConfirmation(projectId);
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
  const [scanOutcome, setScanOutcome] = useState<FlowCodeScanOutcome | null>(
    null,
  );
  // Until the first readiness check returns, "not connected" is unknown, not false.
  const [setupChecked, setSetupChecked] = useState(false);

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

  // While mapping runs, poll the progress endpoint rather than the record.
  //
  // The initialization carries the manifest, the report, the roadmap, every
  // mapping and every alternative — megabytes on a real Flow — and none of it
  // changes until mapping finishes. Re-reading all of it every two seconds to
  // watch a stage field made the waiting itself expensive. The full record is
  // fetched once, when the stage it is waiting for actually arrives.
  useEffect(() => {
    if (flowInitialization?.stage !== "SCANNING" || !initializationId) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void getFlowInitializationProgress(initializationId)
        .then((update) => {
          if (cancelled || !update) return;
          const status = String((update as any).mappingStatus ?? "");
          const stage = String((update as any).stage ?? "");
          if (stage !== "SCANNING" || ["READY", "NEEDS_REVIEW", "FAILED", "SHADOW"].includes(status)) {
            void refreshFlowInitialization().catch(() => undefined);
            return;
          }
          // Keep the banner's counts moving without refetching the record.
          setFlowInitialization((current) => current && ({
            ...current,
            scan: { ...(current as any).scan, mappingStatus: status, mappingProgress: (update as any).progress },
          }) as FlowInitialization);
        })
        .catch(() => undefined);
    }, document.hidden ? 10_000 : 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [flowInitialization?.stage, getFlowInitializationProgress, initializationId, refreshFlowInitialization]);

  // Which candidate is being confirmed, per checkpoint. Confirming is one IPC
  // call behind the shared desktop `busy` flag, so driving the buttons off that
  // flag disabled every checkpoint's candidates at once — the whole list looked
  // broken because one of its buttons was working. Only the checkpoint being
  // confirmed belongs in a pending state.
  const [pendingMappings, setPendingMappings] = useState<
    Record<string, string>
  >({});

  // Each confirm replies with a rebuilt snapshot of the entire initialization,
  // so two in flight together would race and the slower reply would drop the
  // faster one's checkpoint. Rather than blocking the other buttons to prevent
  // that, the requests queue: every button stays live, and they go out in the
  // order they were clicked.
  const confirmQueue = useRef<Promise<unknown>>(Promise.resolve());

  // Choosing a location for an ambiguous checkpoint. The server recomputes the
  // anchor hash from the candidate the user picked, so the reply already
  // carries the rebuilt manifest, report and roadmap.
  /**
   * Fold a confirmation's reply into the record already on screen.
   *
   * Confirming used to answer with a rebuilt manifest, report and roadmap — and
   * with fifty checkpoints to work through, that is fifty full rebuilds sent to
   * a client that was only ever going to change one checkpoint of each. The
   * reply now carries the checkpoints that moved and the counts that decide
   * whether the review is finished.
   */
  const applyMappingDelta = useCallback((delta: Record<string, any>) => {
    setFlowInitialization((current) => {
      if (!current) return current;
      const moved = new Map<string, any>((delta.checkpoints ?? []).map((item: any) => [String(item.id), item]));
      const manifest = (current as any).manifest;
      const report = (current.codeReviewReport ?? {}) as any;
      return {
        ...current,
        stage: delta.stage ?? current.stage,
        mappingVersion: delta.mappingVersion ?? (current as any).mappingVersion,
        roadmapRevision: delta.roadmapRevision ?? (current as any).roadmapRevision,
        failureReasonSafe: delta.failureReasonSafe ?? null,
        manifest: manifest
          ? {
              ...manifest,
              checkpoints: (manifest.checkpoints ?? []).map((item: any) => moved.get(String(item.id)) ?? item),
            }
          : manifest,
        codeReviewReport: {
          ...report,
          progress: delta.progress ?? report.progress,
          summary: delta.summary ?? report.summary,
        },
        scan: {
          ...(current as any).scan,
          mappingStatus: delta.progress?.status ?? (current as any).scan?.mappingStatus,
          mappingProgress: delta.progress ?? (current as any).scan?.mappingProgress,
        },
      } as FlowInitialization;
    });
  }, []);

  const confirmMapping = useCallback(
    (checkpointId: string, candidate: FlowMappingCandidateView) => {
      if (!initializationId) return;
      setPendingMappings((current) => ({
        ...current,
        [checkpointId]: candidate.id,
      }));
      const settled = confirmQueue.current.then(async () => {
        setFlowLoadError(null);
        try {
          applyMappingDelta(await confirmFlowMapping(
            initializationId,
            checkpointId,
            candidate.id,
            candidate.placementKind ?? candidate.placementKinds?.[0],
            candidate.anchor ?? candidate.symbol ?? undefined,
          ));
        } catch (cause) {
          setFlowLoadError(normalizeDesktopError(cause));
        } finally {
          // Leave a newer choice for the same checkpoint pending.
          setPendingMappings((current) => {
            if (current[checkpointId] !== candidate.id) return current;
            const { [checkpointId]: _done, ...rest } = current;
            return rest;
          });
        }
      });
      confirmQueue.current = settled.catch(() => undefined);
    },
    [applyMappingDelta, confirmFlowMapping, initializationId],
  );

  const [bulkConfirming, setBulkConfirming] = useState(false);

  /**
   * Accept a page of candidates in one request.
   *
   * Rebuilding the manifest, report and roadmap costs the same for forty
   * confirmations as for one, and a reviewer who agrees with the ranking should
   * not have to spend forty round trips saying so.
   */
  const confirmMappingsInBulk = useCallback(
    (
      entries: Array<{ checkpointId: string; candidate: FlowMappingCandidateView }>,
    ) => {
      if (!initializationId || !entries.length) return;
      setBulkConfirming(true);
      const settled = confirmQueue.current.then(async () => {
        setFlowLoadError(null);
        try {
          applyMappingDelta(await confirmFlowMappings(
            initializationId,
            entries.map(({ checkpointId, candidate }) => ({
              checkpointId,
              candidateId: candidate.id,
              placementKind: candidate.placementKind ?? candidate.placementKinds?.[0],
              anchorText: candidate.anchor ?? candidate.symbol ?? undefined,
            })),
          ));
        } catch (cause) {
          setFlowLoadError(normalizeDesktopError(cause));
        } finally {
          setBulkConfirming(false);
        }
      });
      confirmQueue.current = settled.catch(() => undefined);
    },
    [applyMappingDelta, confirmFlowMappings, initializationId],
  );

  /**
   * Ask the resolver again, without re-running anything behind it.
   *
   * A provider timeout says nothing about the shortlist it was given, and that
   * shortlist is still on the scan — so re-analysing the repository to recover
   * from one would repeat minutes of work that was not wrong.
   */
  const retryResolution = useCallback(() => {
    if (!initializationId) return;
    setFlowLoadError(null);
    void retryFlowMappingResolution(initializationId)
      .then(() => refreshFlowInitialization())
      .catch((cause) => setFlowLoadError(normalizeDesktopError(cause)));
  }, [initializationId, refreshFlowInitialization, retryFlowMappingResolution]);

  const revealEvidence = useCallback(
    (file: string, line?: number | null) => {
      if (!projectId) return;
      void openCodebaseEvidence({
        applicationId: projectId,
        path: file,
        ...(line ? { line } : {}),
      }).then((result) => {
        if (!result?.opened) {
          setFlowLoadError(
            result?.reason === "FILE_NOT_FOUND"
              ? `${file} is no longer in the attached project. Re-run the analysis.`
              : "That file could not be opened from the attached project.",
          );
        }
      });
    },
    [openCodebaseEvidence, projectId],
  );

  // Once the SDK is connected the next step is a specific Flow, so the connected
  // card needs to know which published Flow is still waiting to be initialized.
  // Only relevant when no Flow is already in the URL.
  const [initializableFlows, setInitializableFlows] = useState<
    DeclaredFlowSummary[]
  >([]);
  useEffect(() => {
    if (!projectId || flowId) return;
    let cancelled = false;
    void getDeclaredFlows(projectId)
      .then((items) => {
        if (!cancelled) setInitializableFlows(items);
      })
      .catch(() => {
        if (!cancelled) setInitializableFlows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [getDeclaredFlows, projectId, flowId]);

  const setupConnected = Boolean((manualSetup?.readiness as any)?.connected);
  useEffect(() => {
    if (!projectId || !environmentId || !window.tellann) return;
    const refreshSetup = () =>
      void window.tellann?.setup
        .getSdkSetup(projectId, environmentId)
        .then(setManualSetup)
        .catch(() => setManualSetup(null))
        .finally(() => setSetupChecked(true));
    refreshSetup();
    // Keep checking until connected, so the setup banner and manual guide flip
    // to "connected" on their own once the app sends its first event.
    if (setupConnected) return;
    const timer = window.setInterval(
      refreshSetup,
      document.hidden ? 15_000 : 3_000,
    );
    return () => window.clearInterval(timer);
    // Depend on the connected flag, not the readiness object: every fetch
    // returns a new object, which would re-run this effect back-to-back.
  }, [environmentId, projectId, setupConnected]);

  // The manual setup panel renders near the top of the page, above the mode
  // cards that can open it, so bring it into view when it opens.
  useEffect(() => {
    if (!manualSetupOpen) return;
    document
      .getElementById("manual-sdk-setup")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [manualSetupOpen]);

  if (!projectId) return <ApplicationRequired />;
  if (!application)
    return (
      <NotFoundPage
        title="Application unavailable"
        description="Select another application."
      />
    );

  // A `flowId` in the URL means the user is here to initialize a declared Flow,
  // but that is a two-phase process. Phase one always connects the Tellann SDK to
  // the project (a BOOTSTRAP proposal). Only once the SDK handshake has landed and
  // the Flow initialization has produced its checkpoint manifest can a FLOW
  // proposal be created — the adapter rejects a FLOW proposal that has no manifest
  // with FLOW_INITIALIZATION_MANIFEST_REQUIRED.
  const tellannConnected = setupConnected;
  const automaticSetupAvailable =
    instrumentationEntitled && environment?.type !== "PRODUCTION";
  const flowManifestReady =
    Boolean(initializationId) && Boolean(flowInitialization?.manifest);
  const instrumentationPurpose: "BOOTSTRAP" | "FLOW" =
    flowId && tellannConnected && flowManifestReady ? "FLOW" : "BOOTSTRAP";
  const flowContext =
    instrumentationPurpose === "FLOW"
      ? { flowId, flowVersionId, flowInitializationId: initializationId }
      : {};

  const detect = async () => {
    if (!environment) return;
    const result = await detectInstrumentation({
      applicationId: projectId,
      environmentId: environment.id,
      environmentType: environment.type,
      instrumentationPurpose,
      ...flowContext,
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

  // The detection results render in the Step 1 card further down the page.
  const detectAndReveal = async () => {
    await detect();
    document
      .getElementById("instrumentation-detect")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          `/applications/${projectId}/instrumentation/plans/${returnedPlanId}${initializationId ? `?initializationId=${encodeURIComponent(initializationId)}` : ""}`,
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
    ? plans.filter((record) => {
        const purpose = String(
          record.purpose ??
            (record.planJson as any)?.instrumentationPurpose ??
            "BOOTSTRAP",
        );
        // Until the SDK handshake lands, the only actionable task is the
        // BOOTSTRAP proposal that connects Tellann to this project; after that
        // only tasks scoped to this Flow version are relevant.
        if (purpose !== "FLOW") return !tellannConnected;
        return (
          String(record.flowId ?? (record.planJson as any)?.flowId ?? "") ===
            flowId &&
          String(
            record.flowVersionId ??
              (record.planJson as any)?.flowVersionId ??
              "",
          ) === flowVersionId
        );
      })
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
    // One confirmation covers every task in this batch.
    const branchDecision = await branchConfirmation.confirmBranch();
    if (branchDecision === "cancelled") return;
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
      await applyInstrumentation(projectId, String(record.id), {
        confirmOffQaBranch: branchDecision === "confirmed",
      });
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
      instrumentationPurpose,
      // A Flow's checkpoints are split across whichever packages are being
      // instrumented together, so each adapter has to know the whole set.
      selectedAdapterIds: selectedAdapters,
      ...flowContext,
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
      `/applications/${projectId}/instrumentation?flowId=${encodeURIComponent(flowId)}&flowVersionId=${encodeURIComponent(flowVersionId)}&initializationId=${encodeURIComponent(nextId)}&environmentId=${encodeURIComponent(environmentId)}`,
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

  /**
   * Initialize the flow from the code that is already written. The desktop main
   * process searches the attached project for the declared start and finish
   * markers; nothing has to be running. On success there is nothing left to set
   * up, so the user goes straight to starting a QA run.
   */
  const verifyCheckpointsInCode = async () => {
    if (!initializationId || !projectId) return;
    setScanOutcome(null);
    try {
      const result = await verifyFlowCheckpointsInCode(
        projectId,
        initializationId,
      );
      setScanOutcome({
        completed: result.completed === true,
        filesScanned: Number(result.filesScanned) || 0,
        markersFound: Number(result.markersFound) || 0,
      });
      await refreshFlowInitialization();
      if (result.completed === true) {
        navigate(
          `/applications/${projectId}/qa-runs/new${flowId ? `?flowId=${encodeURIComponent(flowId)}` : ""}`,
        );
      }
    } catch (cause) {
      setScanOutcome({
        completed: false,
        filesScanned: 0,
        markersFound: 0,
        error: String((cause as Error)?.message ?? cause),
      });
    }
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

  // A setup task that has started but not finished is the next step: the user
  // goes back to it rather than starting another one.
  const inProgressStatuses = new Set([
    "PROPOSED",
    "APPROVED",
    "APPLYING",
    "APPLIED",
    "VALIDATING",
    "VALIDATION_FAILED",
  ]);
  const activeTask = visiblePlans.find((record) =>
    inProgressStatuses.has(String(record.status)),
  );
  const adapterLabels: Record<string, string> = {
    "react-vite": "React (Vite)",
    nextjs: "Next.js",
    express: "Express",
    fastify: "Fastify",
    nestjs: "NestJS",
  };
  const adapterLabel = (adapterId: unknown) =>
    adapterLabels[String(adapterId)] ?? String(adapterId);
  const taskStatusLabel = (status: unknown) =>
    String(status).toLowerCase().replaceAll("_", " ");
  const taskHref = (record: Record<string, any>) =>
    `/applications/${projectId}/instrumentation/plans/${record.id}${initializationId ? `?initializationId=${encodeURIComponent(initializationId)}` : ""}`;
  const supportedDetections = detections.filter((item) => item.supported);
  // Adapters that were found but cannot be set up automatically; adapters that
  // simply are not in the project are not worth listing.
  const unsupportedDetections = detections.filter(
    (item) => !item.supported && item.confidence > 0,
  );
  // Without an environment the readiness check never runs, so there is nothing
  // to wait for.
  const setupResolved = setupChecked || !environmentId;
  const checkingSetup = !setupResolved && !initializationId;
  const flowToInitialize = nextFlowToInitialize(initializableFlows);
  // Re-entering this page with the Flow's context is what unlocks the analysis
  // step below; Intent is only the right destination when nothing is published.
  const initializeFlowHref =
    flowInitializationHref(projectId, flowToInitialize, environmentId) ??
    `/applications/${projectId}/intent`;
  const flowAutomated = Boolean(
    flowId && flowInitialization?.mode === "AUTOMATED",
  );
  // Automated initialization is atomic across every declared checkpoint, so a
  // single unplaced one blocks it — and so does a review that predates
  // evidence-grounded mapping, because it has no placements at all. Treating
  // that older shape as "nothing unresolved" enabled the button and turned a
  // knowable precondition into ALL_FLOW_CHECKPOINT_MAPPINGS_REQUIRED from the
  // server, which tells the user nothing they can act on.
  const automatedBlocker = (() => {
    const report = flowInitialization?.codeReviewReport as any;
    if (!report) return "This Flow has not been reviewed against your code yet.";
    if (report.version !== "2.0") {
      return "Re-run the analysis to locate every checkpoint before Tellann can add them for you.";
    }
    const remaining = Number(report.summary?.unresolvedCount ?? 0);
    if (!remaining) return null;
    return `${remaining} checkpoint${remaining === 1 ? "" : "s"} still need${remaining === 1 ? "s" : ""} a location above.`;
  })();
  const multipleEnvironments = application.environments.length > 1;
  const toggleManualSetup = () => setManualSetupOpen((current) => !current);
  const manualSetupLabel = manualSetupOpen
    ? "Hide manual setup"
    : "Set up manually";
  const environmentPicker = multipleEnvironments ? (
    <SelectField
      ariaLabel="Environment"
      value={environmentId}
      onValueChange={setEnvironmentId}
      options={application.environments.map((item) => ({
        value: item.id,
        label: `${item.name} · ${item.type}`,
      }))}
      placeholder="Select environment"
      className="instrumentation-environment"
    />
  ) : null;
  const automationNote = !instrumentationEntitled ? (
    <p className="setup-note">
      <Lock size={13} />
      Automatic setup is included on Solo and above.
      <button
        type="button"
        className="inline-link-button"
        onClick={() => setEntitlementModalOpen(true)}
      >
        See plans
      </button>
    </p>
  ) : environment?.type === "PRODUCTION" ? (
    <p className="setup-note">
      <Lock size={13} />
      Production is observation-only, so Tellann won&apos;t change code for it.
      {multipleEnvironments ? " Choose a development environment above." : ""}
    </p>
  ) : null;

  return (
    <Page
      title="Instrumentation"
      description={
        flowId
          ? "Mark where this Flow starts and finishes in your code."
          : "Connect the Tellann SDK to this project."
      }
    >
      {branchConfirmation.modal}
      {checkingSetup ? (
        <section className="content-card next-step-card" aria-busy="true">
          <span className="step-label">Tellann SDK</span>
          <h2>Checking the connection…</h2>
        </section>
      ) : null}

      {/* ── Flow initialization ─────────────────────────────────────────── */}
      {flowId && setupResolved && !tellannConnected ? (
        <section className="content-card next-step-card">
          <span className="step-label">Before this Flow · Tellann SDK</span>
          <h2>Connect the Tellann SDK</h2>
          <p>
            Tellann needs the SDK running in your app before it can map this
            Flow. This page moves on as soon as your app sends its first event.
          </p>
          <div className="card-actions">
            {activeTask ? (
              <Link className="button primary" to={taskHref(activeTask)}>
                <ArrowRight size={15} />
                Continue setup task
              </Link>
            ) : automaticSetupAvailable && workspace ? (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void detectAndReveal()}
              >
                <SearchCode size={15} />
                Detect framework
              </button>
            ) : null}
            <button
              className={`button${activeTask || (automaticSetupAvailable && workspace) ? "" : " primary"}`}
              disabled={!environmentId}
              onClick={toggleManualSetup}
            >
              <Code2 size={15} />
              {manualSetupLabel}
            </button>
          </div>
          {automationNote}
        </section>
      ) : null}
      {flowId && tellannConnected && !initializationId ? (
        <section className="content-card next-step-card">
          <span className="step-label">SDK connected · Next step</span>
          <h2>Map this Flow in your code</h2>
          <p>
            Tellann reviews your code to find where this Flow starts and
            finishes. Your files don&apos;t change.
          </p>
          <div className="card-actions">
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
              Analyze this Flow
            </button>
          </div>
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
          <FlowReviewPanel
            initialization={flowInitialization}
            busy={busy}
            // Only offer this while no path has been chosen yet: re-analyzing
            // regenerates the manifest and manual roadmap (bumping its revision),
            // which would blow away roadmap progress or an in-flight automated
            // proposal once a mode is picked.
            onReanalyze={
              initializationId &&
              ["REVIEW_READY", "SCANNING"].includes(flowInitialization.stage) &&
              !flowInitialization.mode
                ? () =>
                    void analyzeFlowInitialization(initializationId).then(
                      refreshFlowInitialization,
                    )
                : undefined
            }
            onConfirmMapping={confirmMapping}
            onConfirmMappings={confirmMappingsInBulk}
            onRetryResolution={
              initializationId && !flowInitialization.mode ? retryResolution : undefined
            }
            onRevealEvidence={revealEvidence}
            pendingMappings={pendingMappings}
            bulkConfirming={bulkConfirming}
          />
          {!flowInitialization.mode &&
          flowInitialization.stage === "REVIEW_READY" ? (
            <section className="content-card flow-mode-choice mt-4">
              <div className="card-heading">
                <div>
                  <small>Next step</small>
                  <h2>How should this Flow&apos;s start and finish be marked?</h2>
                </div>
              </div>
              <div className="two-column">
                <article
                  className={`mode-card${instrumentationEntitled ? "" : " featured"}`}
                >
                  <Status>All plans</Status>
                  <h2>I&apos;ll add them</h2>
                  <p className="mb-4">
                    Add two lines, one where the Flow starts and one where it
                    finishes. Tellann then finds them in your code.
                  </p>
                  <button
                    className={`button${instrumentationEntitled ? "" : " primary"}`}
                    disabled={busy}
                    onClick={() => void chooseInitializationMode("MANUAL")}
                  >
                    <Workflow size={15} />
                    Show me where
                  </button>
                </article>
                <article
                  className={`mode-card${instrumentationEntitled ? " featured" : ""}`}
                >
                  <Status>
                    {instrumentationEntitled
                      ? "Recommended"
                      : "Solo plan and above"}
                  </Status>
                  <h2>Add them for me</h2>
                  <p className="mb-4">
                    Tellann prepares the change. You approve each file, and it
                    can be undone.
                  </p>
                  <button
                    className={`button${instrumentationEntitled ? " primary" : ""}`}
                    disabled={
                      busy || !instrumentationEntitled || Boolean(automatedBlocker)
                    }
                    onClick={() => void chooseInitializationMode("AUTOMATED")}
                  >
                    <Sparkles size={15} />
                    Prepare the change
                  </button>
                  {/* Automated initialization writes every declared checkpoint
                      at once, so it cannot start until each one has a location.
                      Say what is missing, not just no. */}
                  {automatedBlocker ? (
                    <p className="muted mt-2">{automatedBlocker}</p>
                  ) : null}
                </article>
              </div>
            </section>
          ) : null}
          {flowAutomated &&
          instrumentationPurpose === "FLOW" &&
          flowInitialization.stage !== "COMPLETED" ? (
            activeTask ? (
              <section className="content-card next-step-card mt-4">
                <span className="step-label">Next step</span>
                <h2>Review the checkpoint changes</h2>
                <p>
                  The {adapterLabel(activeTask.adapterId)} changes are{" "}
                  {taskStatusLabel(activeTask.status)}.
                  {String(activeTask.status) === "PROPOSED"
                    ? " Nothing is written until you approve them."
                    : ""}
                </p>
                <div className="card-actions">
                  <Link className="button primary" to={taskHref(activeTask)}>
                    <ArrowRight size={15} />
                    Open the changes
                  </Link>
                </div>
              </section>
            ) : detections.length ? null : (
              <section className="content-card next-step-card mt-4">
                <span className="step-label">Next step</span>
                <h2>Prepare the checkpoint changes</h2>
                <p>
                  Tellann detects your framework, then prepares the lines that
                  mark where this Flow starts and finishes.
                </p>
                <div className="card-actions">
                  <button
                    className="button primary"
                    disabled={busy || !workspace}
                    onClick={() => void detectAndReveal()}
                  >
                    <SearchCode size={15} />
                    Detect framework
                  </button>
                </div>
              </section>
            )
          ) : null}
          {flowInitialization.mode === "MANUAL" &&
          flowInitialization.manualRoadmap ? (
            <FlowRoadmap
              roadmap={flowInitialization.manualRoadmap}
              manifest={flowInitialization.manifest}
              verification={flowInitialization.verification}
              busy={busy}
              scanOutcome={scanOutcome}
              onToggle={(stepId, completed) =>
                void toggleRoadmapStep(stepId, completed)
              }
              onVerify={() => void verifyCheckpointsInCode()}
              onRebuild={
                initializationId &&
                flowInitialization.verification?.status !== "COMPLETED"
                  ? () =>
                      void analyzeFlowInitialization(initializationId).then(
                        refreshFlowInitialization,
                      )
                  : undefined
              }
              onRevealEvidence={workspace ? revealEvidence : undefined}
            />
          ) : null}
          {flowInitialization.stage === "COMPLETED" ? (
            <div className="context-banner">
              <Check size={15} />
              {(flowInitialization.verification as any)?.method ===
              "STATIC_CODE_SCAN"
                ? "Flow initialized. Tellann found the start and finish markers in your code."
                : "Flow initialized. Tellann saw your app go from the start of this Flow to its finish."}
              <Link
                className="button"
                to={`/applications/${projectId}/qa-runs/new${flowId ? `?flowId=${encodeURIComponent(flowId)}` : ""}`}
              >
                Start a QA run
              </Link>
            </div>
          ) : null}
        </>
      ) : null}

      {/* ── SDK connection ──────────────────────────────────────────────── */}
      {!flowId && setupResolved ? (
        tellannConnected ? (
          <section className="content-card next-step-card is-complete">
            <span className="step-label">Tellann SDK · Connected</span>
            <h2>Tellann is connected to this project</h2>
            <p>
              {environment?.name ?? "This environment"} is sending events.{" "}
              {flowToInitialize
                ? `Next, initialize “${flowToInitialize.name}” so Tellann knows which journey to check.`
                : "Next, declare and publish a Flow so Tellann knows which journey to check."}
            </p>
            <div className="card-actions">
              <Link className="button primary" to={initializeFlowHref}>
                <Workflow size={15} />
                {flowToInitialize ? "Initialize a Flow" : "Declare a Flow"}
              </Link>
              <button className="button" onClick={toggleManualSetup}>
                <Code2 size={15} />
                {manualSetupOpen ? "Hide setup code" : "View setup code"}
              </button>
            </div>
          </section>
        ) : proposedPlans.length > 1 ? (
          <section className="content-card next-step-card">
            <span className="step-label">Next step · Tellann SDK</span>
            <h2>Approve {proposedPlans.length} setup tasks</h2>
            <p>
              Tellann applies them one at a time. If one fails, its changes are
              undone and the rest stop.
            </p>
            <AccordionItem value="review-files-commands" className="w-full my-2">
              <AccordionTrigger>Review files and commands</AccordionTrigger>
              <AccordionContent>
                <div className="stack">
                  {proposedPlans.map((record) => {
                    const plan = record.planJson as InstrumentationPlan;
                    return (
                      <div key={String(record.id)}>
                        <strong>{adapterLabel(plan.adapterId)}</strong>
                        <ul>
                          {plan.operations.map((operation) => (
                            <li key={operation.id}>
                              {operation.relativePath} · {operation.description}
                            </li>
                          ))}
                          {plan.validationCommands.map((command) => (
                            <li key={command.id}>
                              {command.executable} {command.args.join(" ")} ·{" "}
                              {command.cwd}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
            <div className="card-actions">
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void applyReviewedSetup()}
              >
                <ShieldCheck size={15} />
                Approve and apply
              </button>
            </div>
          </section>
        ) : activeTask ? (
          <section className="content-card next-step-card">
            <span className="step-label">Next step · Tellann SDK</span>
            <h2>
              {String(activeTask.status) === "PROPOSED"
                ? "Review your setup task"
                : "Finish your setup task"}
            </h2>
            <p>
              {String(activeTask.status) === "PROPOSED"
                ? `The ${adapterLabel(activeTask.adapterId)} setup is ready. Nothing is written until you approve its files and commands.`
                : `The ${adapterLabel(activeTask.adapterId)} setup is ${taskStatusLabel(activeTask.status)}.`}
            </p>
            <div className="card-actions">
              <Link className="button primary" to={taskHref(activeTask)}>
                <ArrowRight size={15} />
                {String(activeTask.status) === "PROPOSED"
                  ? "Review setup task"
                  : "Open setup task"}
              </Link>
              <button
                className="button"
                disabled={!environmentId}
                onClick={toggleManualSetup}
              >
                <Code2 size={15} />
                {manualSetupLabel}
              </button>
            </div>
          </section>
        ) : (
          <section className="content-card next-step-card">
            <span className="step-label">Next step · Tellann SDK</span>
            <h2>Connect the Tellann SDK</h2>
            <p>
              {automaticSetupAvailable
                ? workspace
                  ? "Tellann detects your framework and prepares the change. Nothing is written until you approve it."
                  : "Attach your project folder so Tellann can detect your framework and prepare the change for your approval."
                : "Add the SDK to your project with a one-time key. This page confirms the connection when your app sends its first event."}
            </p>
            {environmentPicker}
            <div className="card-actions">
              {automaticSetupAvailable ? (
                workspace ? (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => void detectAndReveal()}
                  >
                    <SearchCode size={15} />
                    Detect framework
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => void attachWorkspace(projectId)}
                  >
                    <Folder size={15} />
                    Attach project folder
                  </button>
                )
              ) : null}
              <button
                className={`button${automaticSetupAvailable ? "" : " primary"}`}
                disabled={!environmentId}
                onClick={toggleManualSetup}
              >
                <Code2 size={15} />
                {manualSetupLabel}
              </button>
            </div>
            {automationNote}
          </section>
        )
      ) : null}

      {/* ── Detection results, for SDK setup or Flow checkpoints ────────── */}
      {detections.length ? (
        <section className="content-card stack mt-4" id="instrumentation-detect">
          <div className="card-heading">
            <div>
              <small>
                {instrumentationPurpose === "FLOW"
                  ? "Flow checkpoints"
                  : "Detected in your project"}
              </small>
              <h2>
                {supportedDetections.length
                  ? "Choose what to set up"
                  : "No supported framework found"}
              </h2>
            </div>
          </div>
          {supportedDetections.length ? (
            <div className="detection-options">
              {supportedDetections.map((item) => (
                <label
                  className="check-row detection-option"
                  key={item.adapterId}
                >
                  <input
                    type="checkbox"
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
                    <strong>{adapterLabel(item.adapterId)}</strong>
                    <small>
                      {item.frameworkVersion
                        ? `Version ${item.frameworkVersion}`
                        : "Version not detected"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p>
              Tellann couldn&apos;t find a framework it can set up
              automatically. Use manual setup instead.
            </p>
          )}
          {unsupportedDetections.length ? (
            <p className="muted">
              Needs manual setup:{" "}
              {unsupportedDetections
                .map((item) => adapterLabel(item.adapterId))
                .join(", ")}
              .
            </p>
          ) : null}
          <div className="card-actions">
            {supportedDetections.length ? (
              <button
                className="button primary"
                disabled={busy || creatingProposal || !selectedAdapters.length}
                onClick={() => void proposeSelected()}
              >
                <ShieldCheck size={15} />
                {creatingProposal ? "Preparing…" : "Prepare setup for review"}
              </button>
            ) : null}
            {instrumentationPurpose === "FLOW" ? null : (
              <button
                className={`button${supportedDetections.length ? "" : " primary"}`}
                disabled={!environmentId}
                onClick={toggleManualSetup}
              >
                <Code2 size={15} />
                {manualSetupLabel}
              </button>
            )}
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
        </section>
      ) : null}

      {/* ── Manual setup, on demand ─────────────────────────────────────── */}
      {manualSetupOpen && !manualSetup ? (
        <div className="context-banner mt-4" id="manual-sdk-setup" role="status">
          <RefreshCw size={15} />
          {environmentId
            ? "Loading the SDK setup for this environment…"
            : "Select an environment to see its SDK setup."}
        </div>
      ) : null}
      {manualSetupOpen && manualSetup ? (
        <section className="content-card stack mt-4" id="manual-sdk-setup">
          <div className="card-heading">
            <div>
              <small>Manual setup</small>
              <h2>Add the SDK to your project</h2>
            </div>
            <Status>
              {tellannConnected ? "Connected" : "Waiting for first event"}
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
                <p className="muted">
                  {formatted.stackLabel}
                  {formatted.workspaceName
                    ? ` · ${formatted.workspaceName}`
                    : ""}
                  {` · ${formatted.packageManager}`}
                </p>
                <CopyableCodeBlock
                  label="1. Install the package"
                  code={formatted.installCommand}
                />
                {manualRawKey ? (
                  <CopyableCodeBlock
                    label="2. Your setup key · shown once, keep it in an ignored env file"
                    code={manualRawKey}
                  />
                ) : (
                  <div className="card-actions">
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        void window.tellann?.setup
                          .issueKey(projectId, environmentId)
                          .then((result) => setManualRawKey(result.rawKey))
                      }
                    >
                      <KeyRound size={15} />
                      2. Generate setup key
                    </button>
                  </div>
                )}
                <CopyableCodeBlock
                  label="3. Add the environment variables and initialization"
                  code={formatted.snippet}
                />
                <p
                  className={`setup-live-status${tellannConnected ? " is-connected" : ""}`}
                  role="status"
                >
                  {tellannConnected ? (
                    <Check size={14} />
                  ) : (
                    <RefreshCw size={13} className="spin" />
                  )}
                  {tellannConnected
                    ? "Connected. Tellann is receiving events from your app."
                    : "4. Start your app and open it once. This updates on its own when the first event arrives."}
                </p>
                {tellannConnected ? null : (
                  <details className="setup-troubleshooting">
                    <summary>App not connecting?</summary>
                    <ul>
                      <li>
                        Call <code>TELLANN.initialize(...)</code> once at the
                        top level of your entry file, not inside a component.
                      </li>
                      <li>
                        Env files are read at startup: restart your dev server
                        after adding the key.
                      </li>
                      <li>
                        In your browser&apos;s network tab, check that{" "}
                        <code>/v1/events/batch</code> requests aren&apos;t
                        failing or blocked by CORS.
                      </li>
                    </ul>
                  </details>
                )}
              </div>
            );
          })()}
        </section>
      ) : null}

      {/* ── History, out of the way ─────────────────────────────────────── */}
      {visiblePlans.length ? (
        <details className="content-card setup-history mt-4">
          <summary>
            Setup history · {visiblePlans.length} task
            {visiblePlans.length === 1 ? "" : "s"}
          </summary>
          <div className="data-table mt-3">
            <div className="table-head">
              <span>Framework</span>
              <span>Status</span>
              <span>Created</span>
            </div>
            {visiblePlans.map((plan) => (
              <Link
                className="table-row"
                key={String(plan.id)}
                to={taskHref(plan)}
              >
                <span>
                  <strong>{adapterLabel(plan.adapterId)}</strong>
                  <small>
                    {String(plan.frameworkVersion ?? "unknown version")}
                  </small>
                </span>
                <span>
                  <Status>{taskStatusLabel(plan.status)}</Status>
                </span>
                <span>
                  {plan.createdAt
                    ? new Date(String(plan.createdAt)).toLocaleString()
                    : "—"}
                </span>
              </Link>
            ))}
          </div>
        </details>
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

const APPLY_STEP_HINTS: Record<string, string> = {
  PREPARE: "Tellann checks that what you approved is exactly what it's about to do.",
  CHECKPOINT: "This is what lets Tellann undo its changes if anything goes wrong.",
  WRITE_FILES: "Only the files you approved are changed.",
  CREDENTIALS: "The key goes in a local file that stays out of Git.",
  VALIDATE: "Tellann confirms the SDK is wired in and resolves correctly.",
  VERIFY: "Your app is started so the SDK can send its first event.",
  SYNC: "Your team sees the result in Tellann Cloud.",
  ROLLBACK: "Tellann restores the files it changed.",
};

function formatElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function applyStepHint(stepId: string) {
  if (APPLY_STEP_HINTS[stepId]) return APPLY_STEP_HINTS[stepId];
  if (stepId === "COMMAND:install-sdk") return "Installing packages can take a minute or two.";
  if (stepId.startsWith("COMMAND:")) return "Running an approved command in your project.";
  return "";
}

/**
 * Live progress while an approved task is applied: every step Tellann takes,
 * what it is doing right now, and the files it has changed so far.
 */
function ApplyProgressPanel({
  progress,
  plan,
  approvedCommandIds,
}: {
  progress: InstrumentationApplyProgress;
  plan: InstrumentationPlan;
  approvedCommandIds: string[];
}) {
  const [now, setNow] = useState(() => Date.now());
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const fileCount = plan.operations.filter(
    (operation) =>
      operation.id !== "tellann-local-environment" &&
      operation.id !== "tellann-environment-ignore",
  ).length;
  const planned: Array<{ id: string; label: string }> = [
    { id: "PREPARE", label: "Confirm your approval" },
    { id: "CHECKPOINT", label: "Record where your project is" },
    {
      id: "WRITE_FILES",
      label: `Write ${fileCount} approved change${fileCount === 1 ? "" : "s"}`,
    },
    { id: "CREDENTIALS", label: "Add your setup key" },
    ...plan.validationCommands
      .filter((command) => approvedCommandIds.includes(command.id))
      .map((command) => ({ id: `COMMAND:${command.id}`, label: command.purpose })),
    { id: "VALIDATE", label: "Check the changes" },
    { id: "SYNC", label: "Save the result" },
  ];
  // Steps that are only known once they happen: starting the app, and undoing
  // changes after a failure.
  for (const event of progress.events) {
    if (planned.some((step) => step.id === event.step)) continue;
    if (event.step === "VERIFY") {
      planned.splice(planned.length - 1, 0, {
        id: "VERIFY",
        label: "Start your app and wait for its first event",
      });
    } else {
      planned.push({
        id: event.step,
        label: event.step === "ROLLBACK" ? "Undo Tellann's changes" : event.message,
      });
    }
  }
  const steps = planned.map((step) => {
    const events = progress.events.filter((event) => event.step === step.id);
    const last = events[events.length - 1];
    return {
      ...step,
      events,
      last,
      status: last?.status ?? ("PENDING" as const),
      startedAt: events[0] ? Date.parse(events[0].at) : null,
    };
  });
  const current = [...steps].reverse().find((step) => step.status === "RUNNING");
  const done = steps.filter((step) => step.status === "DONE").length;
  const percent = Math.round((done / steps.length) * 100);

  return (
    <section
      ref={panelRef}
      className="content-card apply-progress mb-6"
      aria-live="polite"
    >
      <div className="apply-progress-head">
        <div>
          <small>Applying · {formatElapsed(now - Date.parse(progress.startedAt))}</small>
          <h2>{current?.last?.message ?? "Setting up Tellann in your project"}</h2>
          <p>{current ? applyStepHint(current.id) : "Getting started…"}</p>
        </div>
        <Status>
          {done}/{steps.length} steps
        </Status>
      </div>
      <div
        className="apply-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ width: `${Math.max(percent, 4)}%` }} />
      </div>
      <ol className="apply-progress-steps">
        {steps.map((step) => {
          const changes = step.events.filter((event) => event.detail && event.status === "RUNNING");
          const listsChanges = step.id === "WRITE_FILES" || step.id === "CREDENTIALS";
          return (
            <li
              key={step.id}
              className={`apply-progress-step is-${step.status.toLowerCase()}`}
            >
              <span className="apply-progress-icon" aria-hidden="true">
                {step.status === "DONE" ? (
                  <Check size={12} />
                ) : step.status === "RUNNING" ? (
                  <RefreshCw size={12} className="spin" />
                ) : step.status === "FAILED" ? (
                  <AlertTriangle size={12} />
                ) : null}
              </span>
              <div className="apply-progress-text">
                <strong>{step.label}</strong>
                {step.status === "RUNNING" && step.startedAt !== null ? (
                  <small>
                    {!listsChanges && step.last?.detail ? (
                      <code>{step.last.detail}</code>
                    ) : null}{" "}
                    {formatElapsed(now - step.startedAt)}
                  </small>
                ) : step.status === "DONE" ? (
                  <small>{step.last?.message}</small>
                ) : step.status === "FAILED" ? (
                  <small>{normalizeDesktopError(step.last?.message ?? "")}</small>
                ) : null}
                {listsChanges && changes.length ? (
                  <ul className="apply-progress-changes">
                    {changes.map((event, index) => (
                      <li key={`${event.detail}-${index}`}>
                        <Check size={11} />
                        <code>{event.detail}</code>
                        <span>{event.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="apply-progress-note">
        You can keep working elsewhere. Tellann keeps going and will notify you when it&apos;s done.
      </p>
    </section>
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
    getDeclaredFlows,
  } = useProject();
  const navigate = useNavigate();
  const branchConfirmation = useOffQaBranchConfirmation(projectId);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [liveReadiness, setLiveReadiness] = useState<{
    connected?: boolean;
    installationTestPassed?: boolean;
  } | null>(null);
  // null = not yet checked. A Flow only counts once it is published AND has an
  // active, completed initialization in this project — the same bar NewRunPage
  // enforces before a run can start.
  const [declaredFlows, setDeclaredFlows] = useState<
    DeclaredFlowSummary[] | null
  >(null);
  const hasInitializedFlow =
    declaredFlows === null ? null : declaredFlows.some(isFlowReadyToRun);
  const plan = record?.planJson as InstrumentationPlan | undefined;
  const environment = application?.environments.find(
    (item) => item.id === record?.environmentId,
  );
  // Initialize into the environment this task instrumented, unless that is
  // production — initialization is rejected there.
  const flowToInitialize = nextFlowToInitialize(declaredFlows ?? []);
  const initializeFlowHref =
    flowInitializationHref(
      projectId,
      flowToInitialize,
      environment && environment.type !== "PRODUCTION"
        ? environment.id
        : nonProductionEnvironmentId(application),
    ) ?? `/applications/${projectId}/intent`;
  const installRequired =
    plan?.validationCommands.some((command) => command.id === "install-sdk") ??
    false;
  // A rolled-back / rejected / failed / stale task is closed: it can no longer be
  // approved, applied, re-validated or rolled back again, and any lingering local
  // validation evidence from a previous attempt must not resurface as "success".
  const terminalStatus = [
    "ROLLED_BACK",
    "ROLLBACK_FAILED",
    "REJECTED",
    "FAILED",
    "STALE",
  ].includes(String(record?.status));
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
  // The main process classifies a failed `validate-build` whose diagnostics never
  // reference the Tellann SDK or generated config as a passing `project-build-warning`
  // check, so `validation.valid` stays true. Mirror that here: a pre-existing project
  // build error the operator must fix themselves must not keep the task stuck in the
  // "not yet done" UI when every Tellann check actually passed.
  const buildFailureUnrelatedToTellann = (
    ((validationEvidence as any)?.checks ?? []) as Array<{
      name: string;
      passed: boolean;
    }>
  ).some((check) => check.name === "project-build-warning" && check.passed);
  const validationSucceeded =
    !terminalStatus &&
    ((validationEvidence as { valid?: boolean } | undefined)?.valid === true ||
      String(record?.status) === "COMPLETED") &&
    (buildResult?.passed !== false || buildFailureUnrelatedToTellann);
  // The apply step gives the running app a 45s window to emit TELLANN_ONBOARDING_TEST.
  // If the app was not up during that window this check is absent, and the operator
  // finishes verification later by starting the app while this screen polls readiness.
  const telemetryCheckPassed = (
    ((validationEvidence as any)?.checks ?? []) as Array<{
      name: string;
      passed: boolean;
    }>
  ).some((check) => check.name === "telemetry-verification" && check.passed);
  const telemetryVerified =
    telemetryCheckPassed || liveReadiness?.installationTestPassed === true;

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
            : nextPlan.validationCommands
                // An optional command is offered in the list and left unticked:
                // a full production build to check a few inserted calls is the
                // longest step in initialization, and the type check beside it
                // asks the same question in a fraction of the time.
                .filter((item) => !(item as { optional?: boolean }).optional)
                .map((item) => item.id),
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

  // Applying runs in the main process and reports each step. The latest state
  // is fetched on arrival, so returning to this page mid-apply picks it up.
  const [applyProgress, setApplyProgress] =
    useState<InstrumentationApplyProgress | null>(null);
  useEffect(() => {
    const bridge = window.tellann?.instrumentation;
    if (!planId || typeof bridge?.onProgress !== "function") return;
    let cancelled = false;
    void bridge
      .getProgress(planId)
      .then((state) => {
        if (!cancelled && state) setApplyProgress(state);
      })
      .catch(() => undefined);
    const unsubscribe = bridge.onProgress((state) => {
      if (state.planId !== planId) return;
      setApplyProgress(state);
      // Also covers an apply that finishes after navigating away and back,
      // when no local action is waiting to refresh the task.
      if (state.outcome !== "RUNNING") void refresh();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [planId]);

  // Once the install itself has passed but the onboarding test event has not been
  // seen yet, this screen is the verification step: poll live readiness so it flips
  // to "verified" on its own when the operator starts their app.
  const environmentId = environment?.id;
  const pollSdkReadiness = useCallback(() => {
    if (!projectId || !environmentId || !window.tellann?.setup?.getSdkSetup)
      return;
    void window.tellann.setup
      .getSdkSetup(projectId, environmentId)
      .then((setup) =>
        setLiveReadiness(
          ((setup?.readiness as Record<string, unknown>) ?? null) as {
            connected?: boolean;
            installationTestPassed?: boolean;
          } | null,
        ),
      )
      .catch(() => undefined);
  }, [projectId, environmentId]);
  useEffect(() => {
    if (!validationSucceeded || telemetryVerified || !environmentId) return;
    pollSdkReadiness();
    const timer = window.setInterval(
      pollSdkReadiness,
      document.hidden ? 15_000 : 3_000,
    );
    return () => window.clearInterval(timer);
  }, [validationSucceeded, telemetryVerified, environmentId, pollSdkReadiness]);

  // Once telemetry is verified, the completed screen's forward action should only
  // send the operator into a QA run if a Flow is actually ready to run — otherwise
  // this bootstrap install is done, but no Flow has been initialized in this
  // project yet, and the right next step is to go initialize one.
  useEffect(() => {
    if (!projectId || !validationSucceeded || !telemetryVerified) return;
    let cancelled = false;
    void getDeclaredFlows(projectId)
      .then((items) => {
        if (!cancelled) setDeclaredFlows(items);
      })
      .catch(() => {
        if (!cancelled) setDeclaredFlows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, validationSucceeded, telemetryVerified, getDeclaredFlows]);

  if (!projectId) return <ApplicationRequired />;
  if (!planId)
    return (
      <Page
        title="Instrumentation history"
        description="Select a task from the instrumentation workspace."
      >
        <Link
          className="button primary"
          to={`/applications/${projectId}/instrumentation`}
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
            : "The task may have been removed or may belong to another application."
        }
      />
    );

  const environmentUnavailable = !environment;

  // Every mutating action (approve / apply / validate / rollback) is a fire-and-forget
  // onClick. Without this wrapper a failure — e.g. STALE_TARGET_FILE when package.json
  // changed after the task was proposed — only lands in the main-process console. Run
  // them through here so the reason and the recovery step are shown on this page, and
  // the record is refreshed so a server-side FAILED transition is reflected.
  const runAction = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
    } catch (cause) {
      setActionError(normalizeDesktopError(cause));
      await refresh().catch(() => undefined);
    }
  };

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
    // Asked before approving, so cancelling leaves the task untouched.
    const branchDecision = await branchConfirmation.confirmBranch();
    if (branchDecision === "cancelled") return;
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
    const result = await applyInstrumentation(projectId, planId, {
      confirmOffQaBranch: branchDecision === "confirmed",
    });
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
    const branchDecision = await branchConfirmation.confirmBranch();
    if (branchDecision === "cancelled") return;
    const result = await applyInstrumentation(projectId, planId, {
      confirmOffQaBranch: branchDecision === "confirmed",
    });
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
        `/applications/${projectId}/instrumentation?flowId=${encodeURIComponent(String(plan.flowId ?? ""))}&flowVersionId=${encodeURIComponent(String(plan.flowVersionId ?? ""))}&initializationId=${encodeURIComponent(initializationId)}&environmentId=${encodeURIComponent(String(record.environmentId ?? ""))}`,
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
          ? `${result.filename} was saved and added to this application’s Sources (${result.sourceStatus?.toLowerCase() ?? "queued"}).`
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
  // A Flow task belongs to a Flow initialization; rejecting it sends that Flow
  // back to choosing how its start and finish are marked (done by the backend).
  const flowTask = plan.instrumentationPurpose === "FLOW";
  const flowChoiceHref = `/applications/${projectId}/instrumentation?flowId=${encodeURIComponent(String(plan.flowId ?? ""))}&flowVersionId=${encodeURIComponent(String(plan.flowVersionId ?? ""))}${initializationId ? `&initializationId=${encodeURIComponent(initializationId)}` : ""}&environmentId=${encodeURIComponent(String(record.environmentId ?? ""))}`;
  const rejectTask = async () => {
    setRejectConfirmOpen(false);
    await rejectInstrumentation(projectId, planId, "Rejected in desktop review");
    if (flowTask && initializationId) {
      navigate(flowChoiceHref);
      return;
    }
    await refresh();
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
      {branchConfirmation.modal}
      <ConfirmModal
        isOpen={rejectConfirmOpen}
        title="Reject this setup task?"
        description={
          flowTask
            ? "Tellann closes this task without changing any files, and this Flow goes back to choosing how its start and finish are marked. A rejected task can't be reopened."
            : "Tellann closes this task without changing any files. A rejected task can't be reopened; to set up again, run Detect framework to create a new task."
        }
        confirmLabel="Reject task"
        cancelLabel="Keep reviewing"
        variant="danger"
        busy={busy}
        onConfirm={() => void runAction(rejectTask)}
        onCancel={() => setRejectConfirmOpen(false)}
      />
      {applyProgress?.outcome === "RUNNING" ? (
        <ApplyProgressPanel
          progress={applyProgress}
          plan={plan}
          approvedCommandIds={commands}
        />
      ) : null}
      {terminalStatus ? (
        <section className="content-card stack mb-6">
          <div className="card-heading">
            <div>
              <small>This setup task is closed</small>
              <h2>
                {record.status === "ROLLED_BACK"
                  ? "Tellann changes were rolled back"
                  : record.status === "REJECTED"
                    ? "This setup task was rejected"
                    : record.status === "STALE"
                      ? "This setup task expired"
                      : "This setup task failed"}
              </h2>
            </div>
            <Status>{String(record.status)}</Status>
          </div>
          {record.status === "FAILED" && record.failureReasonSafe ? (
            <div className="context-banner" role="alert">
              <AlertTriangle size={15} />
              <span>
                {normalizeDesktopError(String(record.failureReasonSafe))}
              </span>
            </div>
          ) : null}
          {record.status === "REJECTED" && flowTask ? (
            <>
              <p>
                No files were changed. This Flow is back to choosing how its
                start and finish are marked, so you can add them yourself or
                have Tellann prepare a new change.
              </p>
              <Link className="button primary" to={flowChoiceHref}>
                <ArrowRight size={15} />
                Choose how to mark the Flow
              </Link>
            </>
          ) : (
            <>
              <p>
                A closed task can no longer be approved, applied, re-validated,
                or rolled back. Start a new setup from the Instrumentation page
                and Tellann will create a fresh reviewed task from the current
                project state.
              </p>
              <Link
                className="button primary"
                to={`/applications/${projectId}/instrumentation${initializationId ? `?initializationId=${encodeURIComponent(initializationId)}` : ""}`}
              >
                <ArrowRight size={15} />
                Re-run detection and create a fresh task
              </Link>
            </>
          )}
        </section>
      ) : null}
      {actionError && !terminalStatus ? (
        <section className="content-card stack mb-6">
          <div className="card-heading">
            <div>
              <small>Tellann stopped before changing anything</small>
              <h2>This action could not be completed</h2>
            </div>
            <Status>Action needed</Status>
          </div>
          <div className="context-banner" role="alert">
            <AlertTriangle size={15} />
            <span>{actionError}</span>
          </div>
          <div className="card-actions">
            <Link
              className="button primary"
              to={`/applications/${projectId}/instrumentation${initializationId ? `?initializationId=${encodeURIComponent(initializationId)}` : ""}`}
            >
              <ArrowRight size={15} />
              Go to Instrumentation to re-detect
            </Link>
            <button
              className="button"
              disabled={busy}
              onClick={() => {
                setActionError(null);
                void refresh();
              }}
            >
              <RefreshCw size={15} />
              Dismiss and reload task
            </button>
          </div>
        </section>
      ) : null}
      {validationSucceeded ? (
        <section className="bg-(--surface-1) border border-(--border) rounded-xs p-6 mb-6">
          <h2 className="text-2xl font-semibold text-(--text-strong) tracking-tight mb-2">
            {buildFailure
              ? "Tellann is installed — every Tellann check passed"
              : "Tellann is installed and the project build passed"}
          </h2>

          <div className="bg-(--surface-0) border border-(--border) p-4 my-4 flex items-start gap-3">
            <Check size={18} className="text-(--text-strong) shrink-0 mt-0.5" />
            <span className="text-sm text-(--text) leading-relaxed">
              {buildFailure
                ? "The reviewed files are in place and the SDK resolves correctly. Your application's own build reported pre-existing errors that do not reference Tellann, so they don't block this setup, the categorized diagnostics stay available under the technical validation evidence below."
                : "The reviewed files are in place, the SDK resolves correctly, and the approved TypeScript/Vite build completed successfully."}
            </span>
          </div>

          {buildWarning ? (
            <p className="text-xs text-(--text-muted) bg-(--surface-0) border border-(--border) p-3 mb-4 leading-relaxed">
              Vite reported a non-blocking import/chunking warning. It does not
              affect the SDK connection and can be optimized later by making
              that module use one consistent import strategy.
            </p>
          ) : null}

          {!localResult ? (
            <p className="text-xs text-(--text-muted) bg-(--surface-0) border border-(--border) p-3 mb-4 leading-relaxed">
              This completed task was restored from synchronized cloud history.
              Local diff and rollback evidence are available only on the device
              and workspace that originally applied the task.
            </p>
          ) : null}

          <div className="my-5">
            <div className="text-[11px] font-mono text-(--text-muted) tracking-wider uppercase mb-3">
              WHAT TO DO NEXT
            </div>
            <div className="bg-(--surface-0) border border-(--border) p-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-(--text) leading-relaxed">
                {telemetryVerified ? (
                  <li>
                    Telemetry and the onboarding test event have been received.
                    {hasInitializedFlow
                      ? " Continue to your first guided walkthrough."
                      : " No Flow has been initialized in this application yet — initialize one to start your first guided walkthrough."}
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

          {telemetryVerified ? (
            <div className="bg-(--surface-0) border border-(--border) p-4 my-4 flex items-start gap-3">
              <Check size={16} className="text-(--text-strong) shrink-0 mt-0.5" />
              <span className="text-sm text-(--text) leading-relaxed">
                Tellann received the onboarding test event. The connection is
                verified.{" "}
                {hasInitializedFlow
                  ? "You can start your first guided walkthrough."
                  : "No Flow has been initialized in this application yet — initialize one before starting a walkthrough."}
              </span>
            </div>
          ) : (
            <div className="bg-(--surface-0) border border-(--border) p-4 my-4 flex items-start gap-3">
              <RefreshCw
                size={15}
                className="text-(--text-muted) shrink-0 mt-0.5 animate-spin"
              />
              <span className="text-sm text-(--text) leading-relaxed flex-1">
                Searching automatically for the onboarding test event
                {environment?.name ? ` from ${environment.name}` : ""}. Start
                your application and use it once — Tellann checks every few
                seconds and updates this screen when the event arrives. No QA
                run is needed for this step.
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-3 my-4 w-full! justify-end">
            {telemetryVerified && hasInitializedFlow ? (
              <Link
                className="inline-flex items-center gap-2 bg-(--accent) text-black! font-semibold text-xs tracking-wider uppercase px-5 py-3 rounded-xs hover:bg-(--accent) transition-colors"
                to={`/applications/${projectId}/qa-runs/new`}
              >
                <Play size={15} /> Run first walkthrough
              </Link>
            ) : null}
            {telemetryVerified && !hasInitializedFlow ? (
              <Link
                className="inline-flex items-center gap-2 bg-(--accent) text-black! font-semibold text-xs tracking-wider uppercase px-5 py-3 rounded-xs hover:bg-(--accent) transition-colors"
                to={initializeFlowHref}
              >
                <ArrowRight size={15} />{" "}
                {flowToInitialize ? "Initialize a Flow" : "Declare a Flow"}
              </Link>
            ) : null}
            <Link
              className="inline-flex items-center gap-2 bg-(--surface-0) border border-(--border-strong) text-(--text-strong) font-medium text-xs tracking-wider uppercase px-5 py-3 rounded-xs hover:border-(--accent) transition-colors"
              to={`/applications/${projectId}/instrumentation`}
            >
              View instrumentation history
            </Link>
          </div>

          <div className="mt-6 pt-4 border-t border-(--border)">
            <AccordionItem value="advanced-maintenance" defaultOpen={false}>
              <AccordionTrigger>Advanced maintenance</AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-(--text-muted) mb-3">
                  Use these only after source changes, when troubleshooting, or
                  when intentionally removing Tellann.
                </p>
                {localResult ? (
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void runAction(validate)}
                    >
                      <RefreshCw size={15} /> Re-run local checks
                    </button>
                    <button
                      className="button danger"
                      disabled={busy}
                      onClick={() => void runAction(rollback)}
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
      {!validationSucceeded && !terminalStatus ? (
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
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  border: "none",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "6px 14px",
                  cursor: "default",
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
                onClick={() => setRejectConfirmOpen(true)}
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
                onClick={() => void runAction(approveAndApply)}
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
              onClick={() => void runAction(apply)}
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
                onClick={() => void runAction(validate)}
              >
                Re-run local checks
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => void runAction(rollback)}
              >
                Rollback Tellann changes
              </button>
            </>
          ) : null}
        </section>
      ) : null}
      {localResult ? (
        <div className="stack">
          {buildFailure && !terminalStatus && !validationSucceeded ? (
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
                  onClick={() => void runAction(validate)}
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
          {buildWarning && !validationSucceeded && !terminalStatus ? (
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
                  onClick={() => void runAction(validate)}
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

function reportHrefFor(projectId: string, run: QARunSummary) {
  return run.reportId || run.status === "COMPLETED"
    ? `/applications/${projectId}/reports/${encodeURIComponent(run.reportId ?? `qa-report:${run.id}`)}?runId=${run.id}`
    : null;
}

function formatRunTime(value: string | null | undefined, fallback: string) {
  return value ? new Date(value).toLocaleString() : fallback;
}

export function RunsPage() {
  const { projectId, application } = useProject();
  const { items, loading } = useRuns(projectId);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase();
    if (!terms) return items;
    return items.filter((run) =>
      `${run.id} ${run.status} ${run.mode} ${run.environment?.name ?? ""}`
        .toLowerCase()
        .includes(terms),
    );
  }, [items, query]);
  const openRun = useCallback(
    (run: QARunSummary) => navigate(`/applications/${projectId}/qa-runs/${run.id}`),
    [navigate, projectId],
  );
  const list = useSelectableList({
    items: visible,
    getKey: runKey,
    onOpen: openRun,
    onContextMenu: (run, event) => {
      const report = projectId ? reportHrefFor(projectId, run) : null;
      void showMenu(event, [
        { id: "open", label: "Open run", accelerator: "Enter" },
        { id: "report", label: "View report", enabled: Boolean(report) },
        { type: "separator" },
        { id: "copy", label: "Copy run ID" },
      ]).then((choice) => {
        if (choice === "open") openRun(run);
        if (choice === "report" && report) navigate(report);
        if (choice === "copy") void window.tellann?.system.copyText(run.id);
      });
    },
  });
  if (!projectId) return <ApplicationRequired />;
  if (!application)
    return (
      <NotFoundPage
        title="Application unavailable"
        description="Select another application."
      />
    );
  const selected = list.selected;
  const selectedReport = selected ? reportHrefFor(projectId, selected) : null;
  return (
    <Page
      title="QA Runs"
      description="Guided browser execution, captured evidence, reconciliation, and report processing."
      layout={!loading ? "fill" : "scroll"}
      toolbar={
        items.length ? (
          <input
            className="toolbar-search"
            data-search-input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter runs (Ctrl+F)"
            aria-label="Filter runs"
          />
        ) : null
      }
      actions={
        <Link
          className="button primary"
          to={`/applications/${projectId}/qa-runs/new`}
          title="New QA run (Ctrl+N)"
        >
          <Play size={15} />
          New QA run
        </Link>
      }
    >
      {loading ? (
        <LoadingState />
      ) : items.length ? (
        <div className="master-detail">
          <div className="list-pane">
            <div
              className="list-view"
              aria-label="QA runs"
              style={{ "--list-columns": "minmax(130px, 1fr) minmax(110px, 1fr) 130px minmax(120px, 1fr) minmax(140px, 1fr)" } as CSSProperties}
              {...list.listProps}
            >
              <div className="list-head" role="presentation">
                <span>Run</span>
                <span>Environment</span>
                <span>Status</span>
                <span>Evidence</span>
                <span>Started</span>
              </div>
              {visible.map((run) => (
                <div className="list-row" key={run.id} {...list.rowProps(run)}>
                  <span className="list-cell-primary">
                    <strong className="mono">{run.id.slice(0, 8)}</strong>
                    <small>{formatEnum(run.mode)}</small>
                  </span>
                  <span>{run.environment?.name ?? run.environmentId.slice(0, 8)}</span>
                  <span>
                    <Status>{run.status}</Status>
                  </span>
                  <span>
                    {run.artifactCount} artifacts · {run.findingCount} findings
                  </span>
                  <span>{formatRunTime(run.startedAt, "Not started")}</span>
                </div>
              ))}
              {!visible.length ? (
                <div className="list-empty">No runs match “{query}”.</div>
              ) : null}
            </div>
          </div>
          <aside className="detail-pane" aria-label="Run details">
            {selected ? (
              <div className="detail-content">
                <div className="detail-header">
                  <small>QA run</small>
                  <h2 className="mono">{selected.id.slice(0, 8)}</h2>
                </div>
                <div className="detail-actions">
                  <button className="button primary" type="button" onClick={() => openRun(selected)}>
                    Open run
                  </button>
                  {selectedReport ? (
                    <Link className="button" to={selectedReport}>
                      <BarChart3 size={15} />
                      View report
                    </Link>
                  ) : null}
                </div>
                <dl className="property-list">
                  <div>
                    <dt>Status</dt>
                    <dd><Status>{selected.status}</Status></dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>{formatEnum(selected.mode)}</dd>
                  </div>
                  <div>
                    <dt>Environment</dt>
                    <dd>{selected.environment?.name ?? selected.environmentId}</dd>
                  </div>
                  <div>
                    <dt>Started</dt>
                    <dd>{formatRunTime(selected.startedAt, "Not started")}</dd>
                  </div>
                  <div>
                    <dt>Ended</dt>
                    <dd>{formatRunTime(selected.endedAt, "—")}</dd>
                  </div>
                  <div>
                    <dt>Artifacts</dt>
                    <dd>{selected.artifactCount}</dd>
                  </div>
                  <div>
                    <dt>Findings</dt>
                    <dd>{selected.findingCount}</dd>
                  </div>
                  <div>
                    <dt>Run ID</dt>
                    <dd className="mono selectable">{selected.id}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="detail-empty">Select a run to see its details.</div>
            )}
          </aside>
        </div>
      ) : (
        <EmptyState
          icon={<Play size={36} />}
          title="No QA runs yet"
          description="Receive a browser-first report without installing an SDK or granting repository write access."
          action={
            <Link
              className="button primary"
              to={`/applications/${projectId}/qa-runs/new`}
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
          to={`/applications/${projectId}/qa-runs/${run.id}`}
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
    clearError,
    getDeclaredFlows,
    listInstrumentationPlans,
  } = useProject();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedFlowId = searchParams.get("flowId") ?? "";
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
  const [runStartFailure, setRunStartFailure] =
    useState<QaRunStartFailure | null>(null);
  const targetUrlInputRef = useRef<HTMLInputElement>(null);
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
      // A Flow that cannot start a run is filtered out rather than surfaced as
      // a selectable option that later fails.
      const ready = items.filter(isFlowReadyToRun);
      setFlows(ready);
      // Arriving straight from initializing a Flow, that Flow is the one the user
      // means to run — preselect it rather than whichever sorts first.
      const requested = requestedFlowId
        ? ready.find((item) => item.id === requestedFlowId)
        : undefined;
      const preferred = requested ?? ready[0];
      setExpectedGraphVersionId(preferred?.versions?.[0]?.id ?? "");
      setSelectedFlowId(preferred?.id ?? "");
    });
  }, [getDeclaredFlows, projectId, requestedFlowId]);
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
  if (!projectId) return <ApplicationRequired />;
  if (!application)
    return (
      <NotFoundPage
        title="Application unavailable"
        description="Select another application."
      />
    );
  const begin = async () => {
    setRunStartFailure(null);
    try {
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
          "Initialize this published Flow in the selected application and environment before starting a QA run.",
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
          captureMode === "COMBINED"
            ? ["FRONTEND", "BACKEND"]
            : [captureMode],
        patchSetId: patchSetId || null,
        environmentType: environment?.type ?? "STAGING",
        mode,
        productionObservationApproved:
          environment?.type === "PRODUCTION" && productionObservationApproved,
        targetUrl,
        launchCommandId: launchCommandId || undefined,
        launchApproved: Boolean(launchCommandId) && launchApproved,
      });
      navigate(`/applications/${projectId}/qa-runs/${run.runId}/live`);
    } catch (cause) {
      setRunStartFailure(
        describeQaRunStartFailure(cause, targetUrl, launchCommands.length > 0),
      );
      // startRun also reports through the shell for unscoped operations. This
      // failure has a dedicated recovery dialog, so avoid showing it twice.
      clearError();
    }
  };
  const reviewRunSettings = useCallback(() => {
    setRunStartFailure(null);
    window.requestAnimationFrame(() => targetUrlInputRef.current?.focus());
  }, []);
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
              ref={targetUrlInputRef}
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
            <small>
              Only Flows that are published and have a completed initialization
              in this application are listed. If a Flow you created is missing,
              either publish it from the declare view or initialize it for this
              application first.
            </small>
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
            <span className="field-label-with-tooltip">
              Instrumentation evidence
              <span
                className="tooltip-trigger"
                tabIndex={0}
                title="Optional. If you let Tellann patch your code with QA-only hooks, the run can watch your app's state (Redux, Context, useState) instead of only the screen. Picking that manifest stamps the report with exactly which files were patched and when it was verified. A browser-only run still captures clicks, pages, network, and screenshots."
              >
                <HelpCircle size={13} />
                <span className="tooltip-bubble">
                  Optional. If you let Tellann patch your code with QA-only
                  hooks, the run can watch your app&apos;s state (Redux,
                  Context, useState) instead of only the screen. Picking that
                  manifest stamps the report with exactly which files were
                  patched and when it was verified. A browser-only run still
                  captures clicks, pages, network, and screenshots.
                </span>
              </span>
            </span>
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
        {/* <div className="permission-summary">
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
        </div> */}
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
      <QaRunStartErrorModal
        failure={runStartFailure}
        busy={busy}
        onClose={reviewRunSettings}
        onRetry={() => void begin()}
      />
    </Page>
  );
}

/**
 * What each boundary refusal means for the person driving the browser. The
 * server's reason codes are precise but unreadable; leaving them on screen left
 * a run looking stuck with no way to tell what to do about it.
 */
const BOUNDARY_REJECTION_GUIDANCE: Record<string, string> = {
  UNKNOWN_STATE:
    "Your application reported a state that this Flow version does not declare. Check the state key the SDK is sending.",
  BEFORE_INITIAL_BOUNDARY:
    "The Flow has not started yet. Reach its first state in the browser window before the rest of the walkthrough can be recorded.",
  INITIAL_BOUNDARY_ALREADY_ACCEPTED:
    "The Flow already started, so this second start event was ignored. Carry on from where you are.",
  FLOW_VERSION_MISMATCH:
    "The application is reporting against a different Flow version than this run expects. Restart it so it picks up the published version.",
  UNKNOWN_TRANSITION:
    "That move is not a declared transition in this Flow. Follow one of the expected paths, or add the transition to the Flow.",
  OUT_OF_ORDER_TRANSITION:
    "That transition started from a different state than the one the run is on. Go back and take the declared path.",
  UNDECLARED_TERMINAL_STATE:
    "That state is not declared as an ending for this Flow, so it cannot finish the run.",
  RUN_PAUSED: "The run is paused, so Flow events are not being accepted. Resume to continue.",
  AFTER_TERMINAL_BOUNDARY: "This Flow already reached an ending, so later events are not recorded.",
  FLOW_EVENT_CONTEXT_REQUIRED:
    "The event arrived without its Flow version or state key. Check the SDK call that reports this state.",
  UNSUPPORTED_FLOW_EVENT: "The application sent an event type this Flow does not use.",
  EVENT_ID_COLLISION: "An event with this id was already recorded for a different run.",
  RUN_IS_TERMINAL: "This run has already finished.",
  RUN_NOT_FOUND: "The cloud no longer recognises this run.",
};

type EvidenceTabValue = "CONSOLE" | "NETWORK" | "INTERACTION" | "FLOW" | "PERFORMANCE" | "FINDINGS";

const EVIDENCE_TABS: Array<{
  value: EvidenceTabValue;
  label: string;
  icon: typeof Activity;
  kinds: Array<LiveEvidence["kind"]>;
}> = [
  { value: "CONSOLE", label: "Console", icon: TerminalSquare, kinds: ["CONSOLE"] },
  { value: "NETWORK", label: "Network", icon: Network, kinds: ["NETWORK"] },
  { value: "INTERACTION", label: "Interactions", icon: MousePointerClick, kinds: ["INTERACTION", "STORAGE"] },
  { value: "FLOW", label: "Flow", icon: Workflow, kinds: ["FLOW", "PAGE"] },
  { value: "PERFORMANCE", label: "Performance", icon: Gauge, kinds: ["PERFORMANCE", "ACCESSIBILITY"] },
  { value: "FINDINGS", label: "Findings", icon: AlertTriangle, kinds: [] },
];

/** Rows rendered at once. A log pane only ever shows its tail. */
const EVIDENCE_WINDOW = 200;
/** No capture for this long means something is wrong, not that nothing happened. */
const STALL_AFTER_MS = 30_000;

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/** Status of one expected state, given what the run has actually accepted. */
type PlanStateStatus = "done" | "current" | "next" | "pending";

function planStateStatuses(run: GuidedRunState): Map<string, PlanStateStatus> {
  const statuses = new Map<string, PlanStateStatus>();
  const plan = run.flowPlan;
  if (!plan) return statuses;
  const visited = new Set(run.coverage?.visitedStateKeys ?? []);
  const nextKeys = new Set(
    run.phase === "PRE_BOUNDARY"
      ? plan.initialStateKey
        ? [plan.initialStateKey]
        : []
      : plan.transitions
          .filter((transition) => transition.from === run.currentFlowStateKey)
          .map((transition) => transition.to),
  );
  for (const state of plan.states) {
    if (state.key === run.currentFlowStateKey && run.phase === "IN_FLOW") statuses.set(state.key, "current");
    else if (visited.has(state.key)) statuses.set(state.key, "done");
    else if (nextKeys.has(state.key)) statuses.set(state.key, "next");
    else statuses.set(state.key, "pending");
  }
  return statuses;
}

/** The one sentence telling the user what to do right now. */
function runInstruction(run: GuidedRunState): { title: string; detail: string } {
  const plan = run.flowPlan;
  if (run.status === "PAUSED") {
    return {
      title: "Run paused",
      detail: "Nothing is being recorded. Resume when you are ready to carry on.",
    };
  }
  if (!plan) {
    return {
      title: run.expectedGraphVersionId ? "Loading the expected Flow" : "Observational run",
      detail: run.expectedGraphVersionId
        ? "Everything is being captured. The expected states will appear once the accepted graph loads."
        : "No accepted Flow was selected, so nothing is being reconciled. Everything you do is still captured.",
    };
  }
  const label = (key: string | null) =>
    plan.states.find((state) => state.key === key)?.name ?? key ?? "the next state";
  if (run.phase === "PRE_BOUNDARY") {
    return {
      title: `Open ${label(plan.initialStateKey)} in the browser`,
      detail:
        "Sign in and navigate to where this Flow begins. Detailed recording starts the moment your application reports that state.",
    };
  }
  if (run.coverage?.terminalReached) {
    return {
      title: "This Flow reached an ending",
      detail: "You can end the run, or keep going to cover the states that are still outstanding.",
    };
  }
  const next = plan.transitions
    .filter((transition) => transition.from === run.currentFlowStateKey)
    .map((transition) => label(transition.to));
  return {
    title: next.length ? `Continue to ${next.slice(0, 2).join(" or ")}` : "Carry on through the Flow",
    detail: next.length
      ? "Drive the application the way a user would. Every step is being recorded against the Flow."
      : "This state has no declared next step. Move on to whichever state you expect to reach.",
  };
}

export function LiveRunPage() {
  const { projectId } = useParams();
  const {
    activeRun: run,
    pauseRun,
    resumeRun,
    setRunInteractionMode,
    focusRunBrowser,
    endRun,
    busy,
  } = useDesktop();
  const [tab, setTab] = useState<EvidenceTabValue>("FLOW");
  const [query, setQuery] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [follow, setFollow] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const listRef = useRef<HTMLDivElement | null>(null);
  const [flowWidth, setFlowWidth] = useState<number>(() => {
    const saved = localStorage.getItem("tellann:live-flow-width");
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return !isNaN(parsed) && parsed >= 180 && parsed <= 600 ? parsed : 260;
  });
  const [evidenceWidth, setEvidenceWidth] = useState<number>(() => {
    const saved = localStorage.getItem("tellann:live-evidence-width");
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return !isNaN(parsed) && parsed >= 240 && parsed <= 600 ? parsed : 360;
  });

  // Elapsed time and stall detection both need a clock of their own: the run
  // state only changes when the browser has something to say, which is exactly
  // when a stall does not.
  useEffect(() => {
    if (!run || run.status === "COMPLETED" || run.status === "FAILED") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [run?.status]);

  /**
   * Keeps both panels inside the window. A width saved on a wide monitor used
   * to survive into a small window and squeeze the middle column to nothing.
   */
  useEffect(() => {
    const clamp = () => {
      const available = window.innerWidth;
      const maxSide = Math.max(180, Math.floor((available - 360) / 2));
      setFlowWidth((current) => Math.min(current, Math.max(180, maxSide)));
      setEvidenceWidth((current) => Math.min(current, Math.max(240, maxSide)));
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);

  const beginResize = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      edge: "flow" | "evidence",
    ) => {
      event.preventDefault();
      const startX = event.clientX;
      const isFlow = edge === "flow";
      const setWidth = isFlow ? setFlowWidth : setEvidenceWidth;
      const storageKey = isFlow ? "tellann:live-flow-width" : "tellann:live-evidence-width";
      const minWidth = isFlow ? 180 : 240;
      const startWidth = isFlow ? flowWidth : evidenceWidth;
      const maxWidth = Math.min(600, Math.max(minWidth, Math.floor((window.innerWidth - 360) / 2)));
      const className = isFlow ? "flow-resizing" : "evidence-resizing";
      const onMove = (moveEvent: PointerEvent) => {
        const delta = isFlow ? moveEvent.clientX - startX : startX - moveEvent.clientX;
        setWidth(Math.min(maxWidth, Math.max(minWidth, startWidth + delta)));
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.body.classList.remove(className);
        setWidth((current) => {
          localStorage.setItem(storageKey, String(current));
          return current;
        });
      };
      document.body.classList.add(className);
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [flowWidth, evidenceWidth],
  );

  /** Double-click resets a panel to its default, the way a splitter should. */
  const resetWidth = useCallback((edge: "flow" | "evidence") => {
    if (edge === "flow") {
      setFlowWidth(260);
      localStorage.setItem("tellann:live-flow-width", "260");
    } else {
      setEvidenceWidth(360);
      localStorage.setItem("tellann:live-evidence-width", "360");
    }
  }, []);

  const activeTab = EVIDENCE_TABS.find((entry) => entry.value === tab) ?? EVIDENCE_TABS[0];
  const visible = useMemo(() => {
    if (!run || activeTab.value === "FINDINGS") return [];
    const needle = query.trim().toLowerCase();
    return run.evidence.filter((item) => {
      if (!activeTab.kinds.includes(item.kind)) return false;
      if (errorsOnly && item.level === "INFO") return false;
      if (!needle) return true;
      if (item.message.toLowerCase().includes(needle)) return true;
      return (item.details ?? []).some(
        (entry) =>
          entry.label.toLowerCase().includes(needle) || entry.value.toLowerCase().includes(needle),
      );
    });
  }, [run?.evidence, activeTab, query, errorsOnly]);

  const windowed = visible.length > EVIDENCE_WINDOW ? visible.slice(-EVIDENCE_WINDOW) : visible;

  useEffect(() => {
    if (!follow) return;
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [windowed.length, follow, tab]);

  const onListScroll = useCallback(() => {
    const node = listRef.current;
    if (!node) return;
    const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
    setFollow(atBottom);
  }, []);

  const runControl = useCallback(async (action: () => Promise<unknown>) => {
    setControlError(null);
    try {
      await action();
    } catch (cause) {
      setControlError(normalizeDesktopError(cause));
    }
  }, []);

  if (!projectId) return <ApplicationRequired />;
  if (!run)
    return (
      <EmptyState
        icon={<Activity size={36} />}
        title="No active local run"
        description="The requested run is not active on this device. Open its cloud detail or create a new run."
        action={
          <Link className="button primary" to={`/applications/${projectId}/qa-runs`}>
            Run history
          </Link>
        }
      />
    );

  const plan = run.flowPlan;
  const coverage = run.coverage;
  const statuses = planStateStatuses(run);
  const instruction = runInstruction(run);
  const rejection = run.boundaryRejection;
  const currentObservation = run.observations.at(-1);
  const resolution = run.windowResolution;
  const elapsedMs = now - new Date(run.startedAt).valueOf();
  const lastEvidenceMs = run.lastEvidenceAt ? now - new Date(run.lastEvidenceAt).valueOf() : null;
  const stalled =
    run.status === "RUNNING" && lastEvidenceMs !== null && lastEvidenceMs > STALL_AFTER_MS;
  // Tolerant of a state written by an older build, which would not carry the
  // newer collections at all.
  const findings = [...(run.findings ?? [])].reverse();
  const stateArtifacts = run.stateArtifacts ?? [];
  const flowStateHistory = run.flowStateHistory ?? [];
  const counts = run.liveCounts ?? ({} as Record<LiveEvidence["kind"], number>);
  // Before the boundary opens, coverage, findings and the diagnostic facts can
  // only report zero. Shown together they read as a wall of failure next to the
  // one thing there is to do, so the workspace carries a single status panel
  // until the application reports the Flow's first state.
  const preBoundary = run.phase === "PRE_BOUNDARY";
  const initialStateName =
    plan?.states.find((state) => state.key === plan.initialStateKey)?.name ??
    plan?.initialStateKey ??
    null;
  const tabCount = (entry: (typeof EVIDENCE_TABS)[number]) =>
    entry.value === "FINDINGS"
      ? findings.length
      : entry.kinds.reduce((total, kind) => total + (counts[kind] ?? 0), 0);

  return (
    <div
      className="live-run-page"
      style={
        {
          "--flow-width": `${flowWidth}px`,
          "--evidence-width": `${evidenceWidth}px`,
        } as CSSProperties
      }
    >
      <header className="run-toolbar">
        <div className="run-toolbar-title">
          <h1>{plan?.flowName ?? "QA run"}</h1>
          <span className="run-toolbar-subtitle">
            {plan?.version != null ? `Version ${plan.version}` : "No accepted Flow"}
            {" · "}
            {new URL(run.targetUrl).host}
          </span>
        </div>
        <div className="run-toolbar-meters">
          <span title="Time since this run started">
            <Clock size={13} />
            {formatDuration(elapsedMs)}
          </span>
          <span
            className={stalled ? "is-stalled" : undefined}
            title="Time since the last captured event"
          >
            <Activity size={13} />
            {lastEvidenceMs === null
              ? "No events yet"
              : stalled
                ? `Quiet for ${formatDuration(lastEvidenceMs)}`
                : `Last event ${formatDuration(lastEvidenceMs)} ago`}
          </span>
          {run.syncBacklog > 0 ? (
            <span className="is-pending" title="Evidence events still waiting to reach the cloud">
              <CloudUpload size={13} />
              {run.syncBacklog} queued
            </span>
          ) : null}
          {run.annotationCount > 0 ? (
            <span title="Inspect comments saved during this run">
              <MessageSquare size={13} />
              {run.annotationCount}
            </span>
          ) : null}
        </div>
        <div className="run-toolbar-actions">
          <Status>{run.status}</Status>
          <button
            className="button"
            type="button"
            disabled={busy || run.status === "COMPLETED" || run.status === "FAILED"}
            onClick={() => void runControl(focusRunBrowser)}
          >
            <ExternalLink size={15} />
            Show browser
          </button>
        </div>
      </header>

      <section className="live-flow">
        <div
          className="flow-resize-handle"
          role="separator"
          aria-label="Resize expected Flow panel"
          aria-orientation="vertical"
          onPointerDown={(event) => beginResize(event, "flow")}
          onDoubleClick={() => resetWidth("flow")}
        />
        <div className="run-instruction" data-tone={rejection ? "warning" : "normal"}>
          <small>What to do now</small>
          <strong>{instruction.title}</strong>
          <p>{instruction.detail}</p>
        </div>

        {rejection ? (
          <div className="run-rejection" role="status">
            <TriangleAlert size={15} />
            <div>
              <strong>Your application reported a state the Flow refused</strong>
              <p>{BOUNDARY_REJECTION_GUIDANCE[rejection.reason] ?? `The server refused it: ${rejection.reason}.`}</p>
              <dl>
                <div>
                  <dt>Reported</dt>
                  <dd>{rejection.stateKey ?? "no state key"}</dd>
                </div>
                <div>
                  <dt>Reason</dt>
                  <dd>
                    <code>{rejection.reason}</code>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        ) : null}

        <div className="flow-plan-heading">
          <h2>Expected states</h2>
          {coverage ? (
            <span>
              {coverage.visitedStateKeys.length} / {coverage.expectedStates}
            </span>
          ) : null}
        </div>

        {plan && plan.states.length ? (
          <ol className="flow-plan">
            {plan.states.map((state, index) => {
              const status = statuses.get(state.key) ?? "pending";
              return (
                <li key={state.key} className="flow-plan-state" data-status={status}>
                  <span className="flow-plan-marker">
                    {status === "done" ? <Check size={13} /> : index + 1}
                  </span>
                  <div>
                    <strong>{state.name}</strong>
                    <small>
                      {status === "current"
                        ? "You are here"
                        : status === "done"
                          ? "Visited"
                          : status === "next"
                            ? "Expected next"
                            : state.role === "TERMINAL"
                              ? `Ending${state.terminalKind ? ` · ${state.terminalKind.toLowerCase()}` : ""}`
                              : state.role === "INITIAL"
                                ? "Starting point"
                                : "Not reached yet"}
                    </small>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="flow-plan-empty">
            {run.expectedGraphVersionId
              ? "The accepted graph for this run could not be read, so the expected states cannot be listed. Capture is unaffected."
              : "This run is observational. Nothing is being compared against a declared Flow."}
          </p>
        )}
      </section>

      <section className="live-browser">
        <div className="browser-toolbar">
          <Globe2 size={16} />
          <strong>Managed Chromium</strong>
          <span className="browser-toolbar-route">
            {currentObservation?.url || run.targetUrl}
          </span>
          <Status>{run.phase.replaceAll("_", " ")}</Status>
        </div>
        <div className="run-workspace">
          {preBoundary ? (
            <section className="run-waiting">
              <header>
                <Hourglass size={18} />
                <div>
                  <small>Waiting to start</small>
                  <strong>
                    {initialStateName
                      ? `Your application has not reported ${initialStateName} yet`
                      : "Your application has not reported the Flow's first state yet"}
                  </strong>
                </div>
              </header>
              <dl>
                <div>
                  <dt>Browser is on</dt>
                  <dd>{currentObservation?.url || run.targetUrl}</dd>
                </div>
                <div>
                  <dt>Flow events received</dt>
                  <dd>
                    {counts.FLOW ?? 0}
                    {counts.FLOW
                      ? " · open the Flow tab to see what each one reported"
                      : " · nothing has reached Tellann from your application"}
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}

          {!preBoundary && coverage ? (
            <section className="run-coverage">
              <header>
                <div>
                  <small>Flow coverage</small>
                  <strong>
                    {coverage.visitedStateKeys.length} of {coverage.expectedStates} states
                  </strong>
                </div>
                <div>
                  <small>Transitions</small>
                  <strong>
                    {coverage.takenTransitionKeys.length} of {coverage.expectedTransitions}
                  </strong>
                </div>
                <div>
                  <small>Ending</small>
                  <strong>{coverage.terminalReached ? "Reached" : "Not yet"}</strong>
                </div>
              </header>
              <div
                className="run-coverage-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={coverage.expectedStates}
                aria-valuenow={coverage.visitedStateKeys.length}
              >
                <span
                  style={{
                    width: `${coverage.expectedStates ? (coverage.visitedStateKeys.length / coverage.expectedStates) * 100 : 0}%`,
                  }}
                />
              </div>
              {coverage.remainingStateKeys.length ? null : (
                <p>Every declared state in this Flow has been visited.</p>
              )}
            </section>
          ) : null}

          {preBoundary ? null : (
          <div className="run-facts">
            <article>
              <small>Current route</small>
              <strong>{currentObservation?.stateName || "Waiting for a route"}</strong>
              <span>{currentObservation?.url || run.targetUrl}</span>
            </article>
            <article>
              <small>Viewport</small>
              <strong>
                {resolution
                  ? `${resolution.innerWidth} × ${resolution.innerHeight}`
                  : "Detecting…"}
              </strong>
              <span>
                {resolution
                  ? `${resolution.screenWidth} × ${resolution.screenHeight} screen · ${resolution.devicePixelRatio}× DPR`
                  : "The first viewport event has not arrived yet."}
              </span>
            </article>
            <article>
              <small>Captured events</small>
              <strong>
                {Object.values(run.evidenceCounts).reduce((total, value) => total + value, 0)}
              </strong>
              <span>
                {`${run.evidenceCounts.QA_REQUEST ?? 0} requests · $${stateArtifacts.length} state snapshots`}
              </span>
            </article>
            <article>
              <small>Interaction mode</small>
              <strong>{run.interactionMode === "INSPECT" ? "Inspect" : "Navigate"}</strong>
              <span>
                {run.interactionMode === "INSPECT"
                  ? "Click any element in the browser window to leave a comment."
                  : "Controls in the application behave normally."}
              </span>
            </article>
          </div>
          )}

          {preBoundary && !findings.length ? null : (
          <section className="run-findings">
            <header>
              <h2>Findings</h2>
              <span>{findings.length}</span>
            </header>
            {findings.length ? (
              <ul>
                {findings.slice(0, 40).map((finding) => (
                  <li key={finding.id} data-severity={finding.severity.toLowerCase()}>
                    <span className="run-finding-severity">{finding.severity}</span>
                    <div>
                      <strong>{finding.title}</strong>
                      <p>{finding.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="run-findings-empty">
                Nothing has gone wrong yet. Console errors, failed requests and accessibility
                failures appear here as they happen.
              </p>
            )}
          </section>
          )}

          {flowStateHistory.length ? (
            <section className="run-timeline">
              <header>
                <h2>Timeline</h2>
                <span>{flowStateHistory.length} accepted steps</span>
              </header>
              <ol>
                {flowStateHistory.map((visit, index) => (
                  <li key={`${visit.stateKey}-${visit.timestamp}-${index}`}>
                    <time>{new Date(visit.timestamp).toLocaleTimeString()}</time>
                    <strong>
                      {plan?.states.find((state) => state.key === visit.stateKey)?.name ??
                        visit.stateKey}
                    </strong>
                    <small>{visit.eventType.replaceAll("_", " ").toLowerCase()}</small>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <div className={`run-capture-disclosure ${run.phase === "IN_FLOW" ? "active" : ""}`}>
            <ShieldCheck size={17} />
            <div>
              <strong>
                {run.phase === "IN_FLOW"
                  ? "Recording this Flow in full"
                  : "Recording metadata only, for now"}
              </strong>
              <span>
                {run.phase === "IN_FLOW"
                  ? "Clicks, forms, protected field values, application state, storage, requests, routes, performance and per-state screenshots are all being kept."
                  : "Routes, requests, console errors, viewport and performance are kept. Field values, application state and screenshots stay off until your application reports the Flow's first state."}
              </span>
            </div>
          </div>
        </div>
      </section>

      <aside className="live-evidence">
        <div
          className="evidence-resize-handle"
          role="separator"
          aria-label="Resize evidence panel"
          aria-orientation="vertical"
          onPointerDown={(event) => beginResize(event, "evidence")}
          onDoubleClick={() => resetWidth("evidence")}
        />
        <div className="evidence-heading">
          <h2>Live evidence</h2>
          <div className="evidence-heading-tools">
            <label className="evidence-search">
              <Filter size={13} />
              <input
                value={query}
                placeholder="Filter"
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Filter evidence"
              />
              {query ? (
                <button type="button" aria-label="Clear filter" onClick={() => setQuery("")}>
                  <X size={12} />
                </button>
              ) : null}
            </label>
            <button
              type="button"
              className={errorsOnly ? "evidence-toggle selected" : "evidence-toggle"}
              aria-pressed={errorsOnly}
              title="Show only warnings and errors"
              onClick={() => setErrorsOnly((current) => !current)}
            >
              <AlertTriangle size={13} />
            </button>
            <button
              type="button"
              className={follow ? "evidence-toggle selected" : "evidence-toggle"}
              aria-pressed={follow}
              title="Follow new events"
              onClick={() => {
                setFollow(true);
                const node = listRef.current;
                if (node) node.scrollTop = node.scrollHeight;
              }}
            >
              <ArrowDownToLine size={13} />
            </button>
          </div>
        </div>
        <div className="evidence-tabs" role="tablist">
          {EVIDENCE_TABS.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.value}
                role="tab"
                aria-selected={tab === entry.value}
                className={tab === entry.value ? "selected" : ""}
                onClick={() => setTab(entry.value)}
              >
                <Icon size={13} />
                {entry.label} <span>{tabCount(entry)}</span>
              </button>
            );
          })}
        </div>
        <div className="evidence-list" ref={listRef} onScroll={onListScroll}>
          {activeTab.value === "FINDINGS" ? (
            findings.length ? (
              findings.map((finding) => (
                <div
                  key={finding.id}
                  className={`evidence-row evidence-${finding.severity === "LOW" || finding.severity === "INFO" ? "info" : finding.severity === "MEDIUM" ? "warn" : "error"}`}
                >
                  <time>{finding.category.replaceAll("_", " ").toLowerCase()}</time>
                  <span>{finding.severity}</span>
                  <div className="evidence-row-body">
                    <p>{finding.title}</p>
                    <dl>
                      <div>
                        <dt>Detail</dt>
                        <dd>{finding.description}</dd>
                      </div>
                      {finding.recommendation ? (
                        <div>
                          <dt>Fix</dt>
                          <dd>{finding.recommendation}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </div>
              ))
            ) : (
              <div className="evidence-empty">No findings have been raised in this run.</div>
            )
          ) : (
            <>
              {run.evidenceTrimmed > 0 && !query && !errorsOnly ? (
                <div className="evidence-trimmed">
                  {run.evidenceTrimmed} earlier rows were dropped from this panel. Every one of them
                  is still in the run's evidence.
                </div>
              ) : null}
              {visible.length > windowed.length ? (
                <div className="evidence-trimmed">
                  Showing the most recent {windowed.length} of {visible.length} matching rows.
                </div>
              ) : null}
              {windowed.length ? (
                windowed.map((item, index) => (
                  <EvidenceRow
                    key={item.id}
                    item={item}
                    continuesGroup={
                      Boolean(item.groupId) && windowed[index - 1]?.groupId === item.groupId
                    }
                  />
                ))
              ) : (
                <div className="evidence-empty">
                  {query || errorsOnly
                    ? "No rows match this filter."
                    : "Evidence will appear here as you use the application."}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <footer className="run-controls">
        <div>
          <code>{run.runId.slice(0, 8)}</code>
          <span className="run-mode-status" role="status" aria-live="polite">
            {controlError
              ? controlError
              : run.phase === "IN_FLOW"
                ? "Recording the Flow in full"
                : "Metadata only until the Flow starts"}
          </span>
        </div>
        <div>
          {run.status === "RUNNING" || run.status === "PAUSED" ? (
            <>
              <div className="run-mode-selector" role="group" aria-label="Browser interaction mode">
                <button
                  className={run.interactionMode === "NAVIGATE" ? "selected" : ""}
                  aria-pressed={run.interactionMode === "NAVIGATE"}
                  disabled={busy || run.status === "PAUSED"}
                  onClick={() => void runControl(() => setRunInteractionMode("NAVIGATE"))}
                >
                  Navigate
                </button>
                <button
                  className={run.interactionMode === "INSPECT" ? "selected" : ""}
                  aria-pressed={run.interactionMode === "INSPECT"}
                  disabled={busy || run.status === "PAUSED"}
                  onClick={() => void runControl(() => setRunInteractionMode("INSPECT"))}
                >
                  Inspect
                </button>
              </div>
              <button
                className="button"
                disabled={busy}
                onClick={() => void runControl(run.status === "PAUSED" ? resumeRun : pauseRun)}
              >
                {run.status === "PAUSED" ? <Play /> : <CirclePause />}
                {run.status === "PAUSED" ? "Resume" : "Pause"}
              </button>
              {confirmEnd ? (
                <>
                  <button
                    className="button danger"
                    disabled={busy}
                    onClick={() => {
                      setConfirmEnd(false);
                      void runControl(endRun);
                    }}
                  >
                    <CircleStop />
                    {run.phase === "PRE_BOUNDARY" ? "End without the Flow" : "End run"}
                  </button>
                  <button className="button" disabled={busy} onClick={() => setConfirmEnd(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="button" disabled={busy} onClick={() => setConfirmEnd(true)}>
                  <CircleStop />
                  End run
                </button>
              )}
            </>
          ) : null}
        </div>
        <div>
          {confirmEnd && run.phase === "PRE_BOUNDARY"
            ? "This Flow never started, so the run will hold metadata only and will not reconcile."
            : run.status === "PAUSED"
              ? "Paused — nothing is being recorded"
              : `${run.evidence.length} rows shown · ${run.evidenceTrimmed} trimmed`}
        </div>
      </footer>
    </div>
  );
}

function EvidenceRow({
  item,
  continuesGroup,
}: {
  item: LiveEvidence;
  continuesGroup?: boolean;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const dismiss = () => setMenu(null);
    window.addEventListener("click", dismiss);
    window.addEventListener("blur", dismiss);
    return () => {
      window.removeEventListener("click", dismiss);
      window.removeEventListener("blur", dismiss);
    };
  }, [menu]);

  const copy = (text: string) => {
    void window.tellann?.system?.copyText?.(text);
    setMenu(null);
  };

  return (
    <div
      className={`evidence-row evidence-${item.level.toLowerCase()}`}
      data-group-continues={continuesGroup ? "true" : undefined}
      data-unrecorded={item.recorded === false ? "true" : undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <time>{new Date(item.timestamp).toLocaleTimeString()}</time>
      <span>{item.level}</span>
      <div className="evidence-row-body">
        <p>{item.message}</p>
        {item.recorded === false ? (
          <em className="evidence-unrecorded">Seen while paused — not written to evidence</em>
        ) : null}
        {item.details?.length ? (
          <dl>
            {item.details.map((entry) => (
              <div key={`${entry.label}:${entry.value}`}>
                <dt>{entry.label}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {menu ? (
        <div className="evidence-menu" style={{ left: menu.x, top: menu.y }} role="menu">
          <button type="button" role="menuitem" onClick={() => copy(item.message)}>
            <Copy size={13} />
            Copy message
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() =>
              copy(
                [
                  `${item.timestamp} ${item.level} ${item.kind}`,
                  item.message,
                  ...(item.details ?? []).map((entry) => `${entry.label}: ${entry.value}`),
                ].join("\n"),
              )
            }
          >
            <Copy size={13} />
            Copy row with detail
          </button>
          <button type="button" role="menuitem" onClick={() => copy(JSON.stringify(item, null, 2))}>
            <Code2 size={13} />
            Copy as JSON
          </button>
        </div>
      ) : null}
    </div>
  );
}

const RUN_TABS = [
  { value: "evidence", label: "Evidence" },
  { value: "findings", label: "Findings" },
  { value: "annotations", label: "Annotations" },
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
  runId,
}: {
  items: unknown[];
  heading: string;
  showStorage?: boolean;
  runId?: string;
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
      <ArtifactGrid items={items} showStorage={showStorage} runId={runId} />
    </section>
  );
}

function ArtifactGrid({
  items,
  showStorage,
  runId,
}: {
  items: unknown[];
  showStorage: boolean;
  runId?: string;
}) {
  const { getArtifactDownloadUrl } = useDesktop();
  const [selectedArtifactUrl, setSelectedArtifactUrl] = useState<string | null>(null);

  return (
    <>
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
                  {runId && typeof item.id === "string" && ["SCREENSHOT", "INSPECT_SCREENSHOT", "SANITIZED_FINAL_SCREENSHOT"].includes(String(item.artifactType)) ? (
                    <button
                      type="button"
                      className="button secondary"
                      style={{ marginLeft: "12px", padding: "2px 8px", fontSize: "11px", height: "auto", minHeight: "0" }}
                      onClick={async () => {
                        try {
                          const result = await getArtifactDownloadUrl(runId, item.id as string);
                          if (result.url) {
                            setSelectedArtifactUrl(result.url);
                          }
                        } catch (e) {
                          console.error("Failed to load artifact", e);
                        }
                      }}
                    >
                      View screenshot
                    </button>
                  ) : null}
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
      {selectedArtifactUrl ? (
        <dialog
          className="fixed inset-0 m-auto bg-black/80 backdrop-blur-sm border-0 w-screen h-screen z-50 flex items-center justify-center p-4 cursor-zoom-out"
          open
          onClick={() => setSelectedArtifactUrl(null)}
        >
          <img
            src={selectedArtifactUrl}
            alt="Artifact Preview"
            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-16 right-16 bg-black/70 hover:bg-black text-white rounded-full w-12 h-12 flex items-center justify-center cursor-pointer text-xl shadow-2xl border border-white/10 backdrop-blur-md transition-colors"
            onClick={() => setSelectedArtifactUrl(null)}
          >
            ✕
          </button>
        </dialog>
      ) : null}
    </>
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
                    <span className="font-mono text-xs text-(--text-subtle) shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                      <strong className="text-(--text-strong) text-sm font-semibold truncate">
                        {displayValue(item.title, `Finding ${index + 1}`)}
                      </strong>
                      <span className="text-(--text-muted) font-mono text-[11px] uppercase tracking-wider shrink-0">
                        {displayValue(item.category, "Finding")}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 mr-2">
                    <Status>{displayValue(item.severity, "Unrated")}</Status>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-3 border-t border-(--border) bg-(--surface-0) text-xs text-(--text) space-y-3">
                <p className="leading-relaxed text-sm text-(--text)">
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
                    <small className="block text-(--text-muted) font-mono text-[10px] uppercase tracking-wider mb-1">
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
  const { getRun, getRunReplay, retryRunSynchronization } = useDesktop();
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
    let timer = 0;
    let delay = 1_500;
    setLoading(true);
    setRunError(null);
    const poll = () => void Promise.resolve()
        .then(() => getRun(runId))
        .then((nextRun) => {
          if (cancelled) return;
          setRun(nextRun);
          setRunError(null);
          const reportStatus = String(nextRun.reportStatus ?? "PENDING");
          if (!["READY", "FAILED"].includes(reportStatus)) {
            timer = window.setTimeout(poll, delay);
            delay = Math.min(15_000, Math.round(delay * 1.6));
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) setRunError(error instanceof Error ? error.message : "The run could not be loaded.");
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
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
  if (!projectId || !runId) return <ApplicationRequired />;
  if (loading) return <LoadingState />;
  if (runError)
    return (
      <Page
        title="Run unavailable"
        description="Tellann could not load this QA run. The desktop window remains safe to use."
        actions={
          <Link className="button" to={`/applications/${projectId}/qa-runs`}>
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
  const annotations = Array.isArray(run.annotations) ? run.annotations : [];
  const evidenceCounts = asRecord(run.evidenceCounts);
  const evidenceTotal = Object.values(evidenceCounts).reduce<number>(
    (sum, value) => sum + Number(value || 0),
    0,
  );
  const reportStatus = String(run.reportStatus ?? (run.reportId ? "READY" : "PENDING"));
  const processingLabels: Record<string, string> = {
    PENDING: "Uploading evidence",
    RECONCILING: "Reconciling Flow",
    ANALYZING: "Analyzing findings",
    GENERATING: "Generating improvements",
    READY: "Ready",
    FAILED: "Failed",
  };
  return (
    <Page
      title={`QA run ${runId.slice(0, 8)}`}
      description="Run metadata, evidence, findings, reconciliation, and report status."
      actions={<Status>{status}</Status>}
    >
      <div className="metric-grid">
        <Metric label="Evidence events" value={evidenceTotal} />
        <Metric label="Findings" value={findings.length} />
        <Metric label="Annotations" value={annotations.length} />
        <Metric
          label="Report"
          value={
            processingLabels[reportStatus] ?? reportStatus
          }
        />
      </div>
      {reportStatus !== "READY" ? (
        <section className={`run-processing-card ${reportStatus === "FAILED" ? "failed" : ""}`} role={reportStatus === "FAILED" ? "alert" : "status"} aria-live="polite">
          <div>
            <small>Report pipeline</small>
            <strong>{processingLabels[reportStatus] ?? reportStatus}</strong>
            <p>
              {reportStatus === "FAILED"
                ? "Captured evidence remains safe. Retry synchronization or report generation without repeating the run."
                : "You can review the synchronized counts now. This page updates while the durable report is prepared."}
            </p>
          </div>
          {reportStatus === "FAILED" || run.synchronizationStatus === "FAILED" ? (
            <button className="button primary" onClick={() => void retryRunSynchronization(runId)}>Retry processing</button>
          ) : <span className="processing-spinner" aria-hidden="true" />}
        </section>
      ) : null}
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
                  : tab.value === "annotations"
                    ? annotations.length
                  : tab.value === "artifacts" || tab.value === "evidence"
                    ? artifacts.length
                    : ""}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="evidence">
          <ArtifactLayout items={artifacts} heading="Captured evidence" runId={runId} />
        </TabsContent>
        <TabsContent value="findings">
          <FindingsLayout items={findings} />
        </TabsContent>
        <TabsContent value="annotations">
          {annotations.length ? (
            <div className="annotation-list" id="annotations">
              {annotations.map((raw, index) => {
                const annotation = asRecord(raw);
                const author = asRecord(annotation.author);
                const mentions = Array.isArray(annotation.mentions) ? annotation.mentions : [];
                return (
                  <article className="annotation-card" key={String(annotation.id ?? index)}>
                    <div className="annotation-pin">{index + 1}</div>
                    <div>
                      <strong>{String(author.displayName ?? "Tellann member")}</strong>
                      <small>{formatDate(annotation.createdAt)} · {String(annotation.normalizedRoute ?? "/")}</small>
                      <p>{String(annotation.comment ?? "")}</p>
                      {mentions.length ? <div className="annotation-mentions">Mentioned: {mentions.map((item) => `@${String(asRecord(item).displayNameSnapshot ?? "member")}`).join(", ")}</div> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <EmptyRunSection title="No annotations" description="Use Inspect mode during a QA run to pin comments to elements." />}
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
            runId={runId}
          />
        </TabsContent>
      </Tabs>
      {run.reportId && reportStatus === "READY" ? (
        <Link
          className="button primary mt-4"
          to={`/applications/${projectId}/reports/${encodeURIComponent(String(run.reportId))}?runId=${runId}`}
        >
          Open QA report
        </Link>
      ) : null}
    </Page>
  );
}

export function RunSubPage({ kind }: { kind: string }) {
  const { projectId, runId } = useParams();
  if (!projectId || !runId) return <ApplicationRequired />;
  return (
    <Navigate
      replace
      to={`/applications/${projectId}/qa-runs/${runId}?tab=${encodeURIComponent(kind)}`}
    />
  );
}

export function ReportsPage() {
  const { projectId } = useParams();
  const { items, loading } = useRuns(projectId);
  const navigate = useNavigate();
  const reportRuns = useMemo(
    () => items.filter((run) => run.reportId || run.status === "COMPLETED"),
    [items],
  );
  const openReport = useCallback(
    (run: QARunSummary) => {
      if (projectId) navigate(reportHrefFor(projectId, run) ?? `/applications/${projectId}/qa-runs/${run.id}`);
    },
    [navigate, projectId],
  );
  const list = useSelectableList({
    items: reportRuns,
    getKey: runKey,
    onOpen: openReport,
    onContextMenu: (run, event) => {
      void showMenu(event, [
        { id: "open", label: "Open report", accelerator: "Enter" },
        { id: "run", label: "Open QA run" },
        { type: "separator" },
        { id: "copy", label: "Copy run ID" },
      ]).then((choice) => {
        if (choice === "open") openReport(run);
        if (choice === "run") navigate(`/applications/${projectId}/qa-runs/${run.id}`);
        if (choice === "copy") void window.tellann?.system.copyText(run.id);
      });
    },
  });
  if (!projectId) return <ApplicationRequired />;
  const selected = list.selected;
  return (
    <Page
      title="Reports"
      description="Canonical quality reports generated from guided QA evidence and reconciliation."
      layout={!loading ? "fill" : "scroll"}
    >
      {loading ? (
        <LoadingState />
      ) : reportRuns.length ? (
        <div className="master-detail">
          <div className="list-pane">
            <div
              className="list-view"
              aria-label="Reports"
              style={{ "--list-columns": "minmax(130px, 1fr) minmax(110px, 1fr) 90px 90px minmax(110px, 1fr) 110px" } as CSSProperties}
              {...list.listProps}
            >
              <div className="list-head" role="presentation">
                <span>Report</span>
                <span>Environment</span>
                <span>Findings</span>
                <span>Artifacts</span>
                <span>Completed</span>
                <span>Status</span>
              </div>
              {reportRuns.map((run) => (
                <div className="list-row" key={run.id} {...list.rowProps(run)}>
                  <span className="list-cell-primary">
                    <strong className="mono">{run.id.slice(0, 8)}</strong>
                    <small>QA report</small>
                  </span>
                  <span>{run.environment?.name ?? "Environment"}</span>
                  <span>{run.findingCount}</span>
                  <span>{run.artifactCount}</span>
                  <span>{run.endedAt ? new Date(run.endedAt).toLocaleDateString() : "Pending"}</span>
                  <span>
                    <Status>{run.reportId ? "Ready" : "Processing"}</Status>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <aside className="detail-pane" aria-label="Report details">
            {selected ? (
              <div className="detail-content">
                <div className="detail-header">
                  <small>QA report</small>
                  <h2 className="mono">{selected.id.slice(0, 8)}</h2>
                </div>
                <div className="detail-actions">
                  <button className="button primary" type="button" onClick={() => openReport(selected)}>
                    <BarChart3 size={15} />
                    Open report
                  </button>
                  <Link className="button" to={`/applications/${projectId}/qa-runs/${selected.id}`}>
                    Open QA run
                  </Link>
                </div>
                <dl className="property-list">
                  <div>
                    <dt>Status</dt>
                    <dd><Status>{selected.reportId ? "Ready" : "Processing"}</Status></dd>
                  </div>
                  <div>
                    <dt>Environment</dt>
                    <dd>{selected.environment?.name ?? "Environment"}</dd>
                  </div>
                  <div>
                    <dt>Findings</dt>
                    <dd>{selected.findingCount}</dd>
                  </div>
                  <div>
                    <dt>Artifacts</dt>
                    <dd>{selected.artifactCount}</dd>
                  </div>
                  <div>
                    <dt>Completed</dt>
                    <dd>{formatRunTime(selected.endedAt, "Pending")}</dd>
                  </div>
                  <div>
                    <dt>Run ID</dt>
                    <dd className="mono selectable">{selected.id}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="detail-empty">Select a report to see its details.</div>
            )}
          </aside>
        </div>
      ) : (
        <EmptyState
          icon={<BarChart3 size={36} />}
          title="No reports yet"
          description="Complete a browser-first QA run to generate the first report."
          action={
            <Link
              className="button primary"
              to={`/applications/${projectId}/qa-runs/new`}
            >
              Start QA run
            </Link>
          }
        />
      )}
    </Page>
  );
}

/** Display order for the download control. The plan decides which are offered. */
const REPORT_DOWNLOAD_FORMATS = [
  { value: "PDF", label: "PDF", hint: "Tellann's report document." },
  { value: "HTML", label: "HTML", hint: "The same document as a web page." },
  { value: "CSV", label: "CSV", hint: "Findings and coverage gaps as a flat table." },
  { value: "JSON", label: "JSON", hint: "The report payload, unchanged." },
] as const;

type ReportDownloadFormat = (typeof REPORT_DOWNLOAD_FORMATS)[number]["value"];

function bestEntitledFormat(allowed: readonly string[]): ReportDownloadFormat {
  return (
    REPORT_DOWNLOAD_FORMATS.find((item) => allowed.includes(item.value))?.value ?? "JSON"
  );
}

function titleCasePlan(plan: string | undefined) {
  return plan ? plan.charAt(0) + plan.slice(1).toLowerCase() : undefined;
}

/**
 * Where the complete report leaves the app. The page above it is a summary, so
 * this is the only route to the evidence, next steps, and appendix behind it.
 *
 * Formats the organisation's plan does not include stay visible but locked:
 * a missing control reads as a missing feature, a locked one reads as a plan
 * boundary. Main re-resolves the entitlement before it writes anything, so this
 * control is a affordance, not the gate.
 */
function ReportDownloadCard({
  runId,
  entitlements,
}: {
  runId: string | null;
  entitlements: DesktopApplication["entitlements"];
}) {
  const { saveReportDownload } = useDesktop();
  // A null entitlement means the cloud could not be asked, not that the plan
  // excludes exporting; every plan includes JSON, so that stays available.
  const allowed = entitlements ? entitlements.reportFormats : ["JSON"];
  const allowedKey = allowed.join(",");
  const [format, setFormat] = useState<ReportDownloadFormat>(() => bestEntitledFormat(allowed));
  const [lockedFormat, setLockedFormat] = useState<ReportDownloadFormat | null>(null);
  const [status, setStatus] = useState<{
    tone: "idle" | "saving" | "saved" | "error";
    message: string | null;
  }>({ tone: "idle", message: null });

  // A plan change between visits must not leave a locked format selected.
  useEffect(() => {
    setFormat((current) => (allowed.includes(current) ? current : bestEntitledFormat(allowed)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedKey]);

  const download = async () => {
    if (!runId) return;
    setStatus({ tone: "saving", message: null });
    try {
      const result = await saveReportDownload(runId, format);
      setStatus(
        result.cancelled
          ? { tone: "idle", message: null }
          : { tone: "saved", message: `Saved ${result.filename ?? "the report"}.` },
      );
    } catch (error) {
      setStatus({ tone: "error", message: normalizeDesktopError(error) });
    }
  };

  const selected = REPORT_DOWNLOAD_FORMATS.find((item) => item.value === format);
  const exportable = allowed.length > 0;
  return (
    <section className="content-card report-download">
      <div className="card-heading">
        <div>
          <small>Full report</small>
          <h2>Download the complete report</h2>
        </div>
        {entitlements?.planType ? <Status>{entitlements.planType}</Status> : null}
      </div>
      <p>
        Every finding with its evidence, rationale, and next step, the declared coverage gaps, the
        risks found outside this Flow, the annotations, and the capture appendix. PDF and HTML are
        printed on Tellann's watermarked report design.
      </p>
      <div className="report-format-picker" role="radiogroup" aria-label="Report format">
        {REPORT_DOWNLOAD_FORMATS.map((item) => {
          const entitled = allowed.includes(item.value);
          return (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={entitled && format === item.value}
              className={`report-format${entitled && format === item.value ? " selected" : ""}${entitled ? "" : " locked"}`}
              title={entitled ? item.hint : `${item.label} is not included on your plan.`}
              onClick={() => (entitled ? setFormat(item.value) : setLockedFormat(item.value))}
            >
              {entitled ? null : <Lock size={12} />}
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="report-download-actions">
        <button
          className="button primary"
          type="button"
          disabled={!runId || !exportable || status.tone === "saving"}
          onClick={() => void download()}
        >
          <ArrowDownToLine size={15} />
          {status.tone === "saving" ? "Preparing…" : `Download ${format}`}
        </button>
        <small>
          {exportable
            ? selected?.hint
            : "Report downloads are not included on this plan."}
        </small>
      </div>
      {status.message ? (
        <p className={`report-download-status${status.tone === "error" ? " is-error" : ""}`} role={status.tone === "error" ? "alert" : "status"}>
          {status.message}
        </p>
      ) : null}
      <EntitlementModal
        isOpen={lockedFormat !== null}
        feature="REPORT_EXPORT"
        featureName={`${lockedFormat ?? "Report"} downloads`}
        currentPlan={titleCasePlan(entitlements?.planType)}
        description={`Downloading this report as ${lockedFormat} is not included on your organization's current plan. Your plan covers ${allowed.join(", ") || "no export format"}.`}
        onClose={() => setLockedFormat(null)}
      />
    </section>
  );
}

/** Priority pill plus title. What the finding means lives in the downloaded report. */
function ReportFindingTitles({
  items,
  label,
}: {
  items: Record<string, unknown>[];
  label: string;
}) {
  const [page, setPage] = useState(0);
  const itemsPerPage = 10;
  
  if (!items.length) return null;
  
  const totalPages = Math.ceil(items.length / itemsPerPage);
  // Ensure page is within bounds in case items array changes
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const visibleItems = items.slice(safePage * itemsPerPage, (safePage + 1) * itemsPerPage);

  return (
    <div className="report-title-group">
      <h3>{label}</h3>
      <ul className="report-title-list">
        {visibleItems.map((item, index) => (
          <li key={String(item.id ?? (safePage * itemsPerPage + index))}>
            <Status>{String(item.priority ?? "MEDIUM")}</Status>
            <span>{String(item.title ?? item.suggestedAction ?? "Finding")}</span>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
          <button
            type="button"
            className="analysis-btn-secondary"
            disabled={safePage === 0}
            onClick={(e) => {
              e.preventDefault();
              setPage(p => Math.max(0, p - 1));
            }}
            style={{ opacity: safePage === 0 ? 0.5 : 1, cursor: safePage === 0 ? 'not-allowed' : 'pointer' }}
          >
            Previous
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Page {safePage + 1} of {totalPages}
          </span>
          <button
            type="button"
            className="analysis-btn-secondary"
            disabled={safePage === totalPages - 1}
            onClick={(e) => {
              e.preventDefault();
              setPage(p => Math.min(totalPages - 1, p + 1));
            }}
            style={{ opacity: safePage === totalPages - 1 ? 0.5 : 1, cursor: safePage === totalPages - 1 ? 'not-allowed' : 'pointer' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The report summary.
 *
 * What the run established fills tens of pages: every finding's rationale,
 * evidence, and next step, the coverage gaps, the appendix. Rendering all of it
 * here buried the result. The page answers "what happened and is it good" and
 * names what was found; the explanations leave in the downloaded report.
 */
function formatReportDuration(ms: unknown): string {
  if (ms == null) return "Not recorded";
  const num = Number(ms);
  if (!Number.isFinite(num) || num < 0) return "0s";
  const total = Math.floor(num / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function ReportDetailPage() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get("runId");
  const { getReport, revealProtectedValue, applications } = useDesktop();
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [revealBusy, setRevealBusy] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  useEffect(() => {
    if (runId)
      void getReport(runId)
        .then(setReport)
        .finally(() => setLoading(false));
    else setLoading(false);
  }, [getReport, runId]);
  if (!projectId) return <ApplicationRequired />;
  if (loading) return <LoadingState />;
  if (!report)
    return (
      <NotFoundPage
        title="Report unavailable"
        description="The report is still processing, expired, or the source run was not provided."
      />
    );
  const application = applications.find((item) => item.id === projectId);
  const sections = asRecord(report.sections);
  const flowSummary = asRecord(sections.flowSummary);
  const runSummary = asRecord(sections.runSummary);
  const inFlow = asRecord(sections.inFlowFindings);
  const appendix = asRecord(sections.evidenceAppendix);
  const detailedFindings = Array.isArray(inFlow.findings)
    ? inFlow.findings.map(asRecord)
    : [];
  const criticalFindings = Array.isArray(sections.criticalSystemWideFindings)
    ? sections.criticalSystemWideFindings.map(asRecord)
    : [];
  const annotations = Array.isArray(sections.userAnnotations)
    ? sections.userAnnotations.map(asRecord)
    : [];
  const evidenceEvents = Array.isArray(appendix.events)
    ? appendix.events.map(asRecord)
    : [];
  const missingStateCount = Array.isArray(inFlow.missingStates) ? inFlow.missingStates.length : 0;
  const missingTransitionCount = Array.isArray(inFlow.missingTransitions)
    ? inFlow.missingTransitions.length
    : 0;
  const protectedValues = evidenceEvents.flatMap((event) =>
    Array.isArray(event.protectedValues)
      ? event.protectedValues.map((value) => ({ event, value: asRecord(value) }))
      : [],
  );
  const viewportHistory = Array.isArray(runSummary.viewportHistory)
    ? runSummary.viewportHistory.map(asRecord)
    : [];
  const latestViewport = viewportHistory.at(-1);
  const severityCounts = detailedFindings.reduce<Record<string, number>>((counts, finding) => {
    const priority = String(finding.priority ?? "MEDIUM").toUpperCase();
    counts[priority] = (counts[priority] ?? 0) + 1;
    return counts;
  }, {});
  const eventTotal = Number(appendix.eventTotal ?? evidenceEvents.length);

  const reveal = async (valueId: string) => {
    if (!runId || revealBusy) return;
    setRevealBusy(valueId);
    setRevealError(null);
    try {
      const result = await revealProtectedValue(runId, valueId);
      setRevealedValues((current) => ({ ...current, [valueId]: result.value }));
    } catch (error) {
      setRevealError(normalizeDesktopError(error));
    } finally {
      setRevealBusy(null);
    }
  };

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

      <section className="content-card report-section">
        <div className="card-heading">
          <div>
            <small>Flow and run</small>
            <h2>{String(flowSummary.name ?? report.flow?.name ?? "Selected Flow")}</h2>
          </div>
          <Status>Version {String(flowSummary.version ?? report.flow?.version ?? "legacy")}</Status>
        </div>
        <p>{String(flowSummary.purpose ?? report.flow?.purpose ?? "No purpose was declared for this Flow.")}</p>
        <dl className="detail-list report-detail-grid">
          <div><dt>Target</dt><dd>{String(runSummary.url ?? "Not recorded")}</dd></div>
          <div><dt>Environment</dt><dd>{report.environment.name} · {report.environment.type}</dd></div>
          <div><dt>Outcome</dt><dd>{String(runSummary.boundaryOutcome ?? report.boundary.completionReason ?? report.status)}</dd></div>
          <div><dt>Duration</dt><dd>{formatReportDuration(runSummary.durationMs)}</dd></div>
          <div><dt>Declared structure</dt><dd>{String(flowSummary.declaredStateCount ?? "—")} states · {String(flowSummary.declaredTransitionCount ?? "—")} transitions</dd></div>
          <div><dt>Window resolution</dt><dd>{latestViewport?.innerWidth && latestViewport?.innerHeight ? `${String(latestViewport.innerWidth)} × ${String(latestViewport.innerHeight)} CSS px` : "Not recorded"}</dd></div>
        </dl>
        {runSummary.captureDegraded ? (
          <div className="report-warning" role="alert">
            <AlertTriangle size={18} /> Capture was degraded. Read the limitations in the downloaded
            report before relying on coverage.
          </div>
        ) : null}
      </section>

      <ReportDownloadCard runId={runId} entitlements={application?.entitlements ?? null} />

      <section className="content-card report-section">
        <div className="card-heading">
          <div>
            <small>Findings</small>
            <h2>What this run found</h2>
          </div>
          <Status>{`${detailedFindings.length + criticalFindings.length} total`}</Status>
        </div>
        <div className="report-counts" aria-label="Findings by priority">
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const)
            .filter((priority) => severityCounts[priority])
            .map((priority) => (
              <span key={priority}>
                <strong>{severityCounts[priority]}</strong>
                {priority.toLowerCase()}
              </span>
            ))}
          <span><strong>{missingStateCount}</strong>states not reached</span>
          <span><strong>{missingTransitionCount}</strong>transitions not reached</span>
          <span><strong>{annotations.length}</strong>annotations</span>
          <span><strong>{eventTotal}</strong>evidence events</span>
        </div>
        {detailedFindings.length || criticalFindings.length ? (
          <>
            <ReportFindingTitles items={detailedFindings} label="In this Flow" />
            <ReportFindingTitles items={criticalFindings} label="Outside this Flow" />
            <p className="report-note">
              Why each one matters, the evidence behind it, and the next step are in the downloadable
              report.
            </p>
          </>
        ) : (
          <EmptyRunSection
            title="No findings"
            description="This run produced no evidence-backed issue that needs your attention."
          />
        )}
      </section>

      <section className="content-card report-section">
        <div className="card-heading">
          <div>
            <small>Evidence</small>
            <h2>Where to look further</h2>
          </div>
          <Status>{`${eventTotal} events`}</Status>
        </div>
        <div className="report-links">
          <Link className="button" to={`/applications/${projectId}/qa-runs/${report.runId}/evidence`}>
            Review evidence timeline
          </Link>
          <Link className="button" to={`/applications/${projectId}/qa-runs/${report.runId}/reconciliation`}>
            View Flow reconciliation
          </Link>
          <Link className="button" to={`/applications/${projectId}/qa-runs/${report.runId}`}>
            Open QA run
          </Link>
        </div>
        {protectedValues.length ? (
          <details className="report-details protected-values">
            <summary>Protected values ({protectedValues.length})</summary>
            <p>
              Values stay masked, and are never written to a downloaded report. Authorized reveals
              are individual, rate limited, audited, and never cached.
            </p>
            {revealError ? <div className="inline-error" role="alert">{revealError}</div> : null}
            {protectedValues.map(({ event, value }, index) => {
              const valueId = String(value.id ?? "");
              const canReveal = String(value.kind) === "ENCRYPTED";
              return (
                <div className="protected-value-row" key={valueId || `${String(event.id)}:${index}`}>
                  <div>
                    <strong>{String(value.keyPath ?? "protected value")}</strong>
                    <small>{String(value.displayValue ?? "[PROTECTED]")} · {String(event.type ?? "event")} · {String(event.route ?? "unknown route")}</small>
                    {revealedValues[valueId] !== undefined ? <code>{revealedValues[valueId]}</code> : null}
                  </div>
                  {canReveal && valueId && revealedValues[valueId] === undefined ? (
                    <button className="button" type="button" disabled={Boolean(revealBusy)} onClick={() => void reveal(valueId)}>
                      <Unlock size={15} />
                      {revealBusy === valueId ? "Authorizing…" : "Reveal"}
                    </button>
                  ) : (
                    <Status>{canReveal ? "REVEALED" : "NOT REVEALABLE"}</Status>
                  )}
                </div>
              );
            })}
          </details>
        ) : null}
      </section>
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
    <div className="loading-skeleton" role="status" aria-label="Loading page data">
      <div className="skeleton-line is-title" style={{ width: "28%" }} />
      {["92%", "86%", "74%", "88%", "64%", "80%"].map((width, index) => (
        <div key={index} className="skeleton-line" style={{ width }} />
      ))}
      <div className="skeleton-block" />
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
        description="Choose a valid application or return to the application list."
        action={
          <Link className="button primary" to="/applications">
            Applications
          </Link>
        }
      />
    </Page>
  );
}
