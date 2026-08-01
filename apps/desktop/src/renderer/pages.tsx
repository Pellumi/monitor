import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Accessibility, Activity, AlertTriangle, ArrowRight, BarChart3, BookOpenText,
  Check, CirclePause, CircleStop, Code2, FileSearch, Folder, Globe2, KeyRound,
  Network, Play, RefreshCw, SearchCode, ShieldCheck, TerminalSquare, Workflow,
} from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { DeclaredFlowSummary, IntentDraft, QARunSummary, QualityReport, SourceDocumentSummary } from '@sots/desktop-contracts';
import type { LiveEvidence } from '@sots/browser-observer';
import { useDesktop } from './desktop-context';

export function Page({ title, description, actions, children }: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page">
      <header className="page-header">
        <div><h1>{title}</h1><p>{description}</p></div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, description, action }: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <section className="page-empty">{icon}<h2>{title}</h2><p>{description}</p>{action}</section>;
}

function Status({ children }: { children: ReactNode }) {
  return <span className="status-pill"><span aria-hidden="true" />{children}</span>;
}

function ProjectRequired() {
  const location = useLocation();
  const section = location.pathname.split('/')[1] || 'projects';
  return <Navigate replace to={`/projects?next=${encodeURIComponent(section)}`} />;
}

export function RouteResolver({ section }: { section: string }) {
  const lastProject = localStorage.getItem('tellann:last-project');
  return <Navigate replace to={lastProject ? `/projects/${lastProject}/${section}` : `/projects?next=${section}`} />;
}

export function RootResolver() {
  const { activeRun, applications } = useDesktop();
  const last = localStorage.getItem('tellann:last-project');
  const projectId = applications.some((item) => item.id === last) ? last : applications[0]?.id;
  if (activeRun && projectId) return <Navigate replace to={`/projects/${projectId}/qa-runs/${activeRun.runId}/live`} />;
  return <Navigate replace to={projectId ? `/projects/${projectId}` : '/projects'} />;
}

export function ProjectsPage() {
  const { applications, workspaces, runs, refreshRuns, attachWorkspace, busy } = useDesktop();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const [query, setQuery] = useState('');
  const visible = applications.filter((item) =>
    `${item.name} ${item.organizationName}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    for (const application of applications) {
      if (!runs[application.id]) void refreshRuns(application.id).catch(() => undefined);
    }
  }, [applications, refreshRuns, runs]);

  return (
    <Page
      title="Projects"
      description="Connect a Tellann application to a local workspace, a development URL, or a staging URL."
      actions={<Link className="button primary" to="/projects/new">Create project</Link>}
    >
      {next ? <div className="context-banner">Select a project to continue to <strong>{next}</strong>.</div> : null}
      <div className="filter-row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter projects" aria-label="Filter projects" />
      </div>
      {visible.length ? (
        <div className="project-grid">
          {visible.map((application) => {
            const workspace = workspaces[application.id];
            const latestRun = runs[application.id]?.[0];
            const destination = next ? `/projects/${application.id}/${next}` : `/projects/${application.id}`;
            return (
              <article className="project-card" key={application.id}>
                <div className="card-heading"><div><small>{application.organizationName}</small><h2>{application.name}</h2></div><Status>{workspace ? 'Analyzed' : 'Browser-only ready'}</Status></div>
                <div className="tag-list">{application.environments.map((environment) => <span key={environment.id}>{environment.type}</span>)}</div>
                <dl className="summary-grid">
                  <div><dt>Workspace</dt><dd>{workspace?.name ?? 'Not attached'}</dd></div>
                  <div><dt>Stack</dt><dd>{workspace?.snapshot.frameworks[0]?.framework ?? 'URL mode'}</dd></div>
                  <div><dt>Latest run</dt><dd>{latestRun?.status ?? 'None'}</dd></div>
                  <div><dt>Findings</dt><dd>{latestRun?.findingCount ?? 0}</dd></div>
                </dl>
                <div className="card-actions">
                  <Link className="button primary" to={destination} onClick={() => localStorage.setItem('tellann:last-project', application.id)}>Open project</Link>
                  <button disabled={busy} onClick={() => void attachWorkspace(application.id)}>Attach folder</button>
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
          action={<Link className="button primary" to="/projects/new">Create project</Link>}
        />
      )}
    </Page>
  );
}

export function NewProjectPage() {
  const { applications, attachWorkspace, busy } = useDesktop();
  const navigate = useNavigate();
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? '');
  const [mode, setMode] = useState<'folder' | 'url'>('folder');

  const complete = async () => {
    if (!applicationId) return;
    if (mode === 'folder') await attachWorkspace(applicationId);
    localStorage.setItem('tellann:last-project', applicationId);
    navigate(mode === 'url' ? `/projects/${applicationId}/qa-runs/new` : `/projects/${applicationId}`);
  };

  return (
    <Page title="Create or attach project" description="Start with read-only workspace access or continue without a repository.">
      <section className="wizard-card">
        <div className="step-label">Step 1 of 3 · Cloud application</div>
        <label>Application<select value={applicationId} onChange={(event) => setApplicationId(event.target.value)}>{applications.map((item) => <option key={item.id} value={item.id}>{item.organizationName} / {item.name}</option>)}</select></label>
        <div className="step-label">Step 2 of 3 · Working mode</div>
        <div className="choice-grid">
          <button className={mode === 'folder' ? 'choice selected' : 'choice'} onClick={() => setMode('folder')}><Folder /><strong>Local folder</strong><span>Read-only analysis. No scripts are executed.</span></button>
          <button className={mode === 'url' ? 'choice selected' : 'choice'} onClick={() => setMode('url')}><Globe2 /><strong>Browser-only URL</strong><span>No SDK, source, write, or command permission required.</span></button>
        </div>
        <div className="step-label">Step 3 of 3 · Permission summary</div>
        <div className="permission-summary"><ShieldCheck /><div><strong>{mode === 'folder' ? 'Read workspace' : 'Browser-only'}</strong><p>{mode === 'folder' ? 'Tellann reads approved project files locally and uploads only redacted derived summaries.' : 'Tellann captures only the evidence categories approved for the guided run.'}</p></div></div>
        <button className="button primary" disabled={!applicationId || busy} onClick={() => void complete()}>{mode === 'folder' ? 'Choose folder and analyze' : 'Continue to QA run'}<ArrowRight size={16} /></button>
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
  useEffect(() => { if (projectId) void refreshRuns(projectId).catch(() => undefined); }, [projectId, refreshRuns]);
  if (!projectId) return <ProjectRequired />;
  if (!application) return <NotFoundPage title="Project unavailable" description="This project does not exist or is outside your current organization access." />;
  const latest = runs[projectId]?.[0];
  return (
    <Page title={application.name} description={`${application.organizationName} · Desktop project overview`}>
      <div className="metric-grid">
        <Metric label="Workspace" value={workspace ? 'Analyzed' : 'Not attached'} />
        <Metric label="Intent" value="Review expected behavior" />
        <Metric label="Instrumentation" value="Browser-only available" />
        <Metric label="Latest run" value={latest?.status ?? 'No runs'} />
      </div>
      <div className="two-column">
        <section className="content-card"><h2>Readiness</h2><Checklist checked={Boolean(application.environments.length)} text="Environment configured" /><Checklist checked={Boolean(workspace)} text="Local workspace analyzed" /><Checklist checked text="Browser-first QA available without SDK" /></section>
        <section className="content-card"><h2>Recommended next action</h2><p>{workspace ? 'Start a guided browser run or review the expected intent.' : 'Attach a folder for repository context, or start a URL-only guided run.'}</p><div className="card-actions"><Link className="button primary" to={`/projects/${projectId}/qa-runs/new`}>New QA run</Link><Link className="button" to={`/projects/${projectId}/workspace`}>Workspace</Link></div></section>
      </div>
    </Page>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function Checklist({ checked, text }: { checked: boolean; text: string }) {
  return <div className="check-row">{checked ? <Check size={16} /> : <AlertTriangle size={16} />}<span>{text}</span></div>;
}

export function WorkspacePage() {
  const { projectId, application, workspace, attachWorkspace, busy } = useProject();
  if (!projectId) return <ProjectRequired />;
  if (!application) return <NotFoundPage title="Project unavailable" description="Select another project." />;
  return (
    <Page title="Workspace" description="Local repository access, read-only analysis, detected stack, and redaction status." actions={<button className="button" disabled={busy} onClick={() => void attachWorkspace(projectId)}><RefreshCw size={15} />{workspace ? 'Change or rescan folder' : 'Attach folder'}</button>}>
      {!workspace ? <EmptyState icon={<SearchCode size={36} />} title="No local workspace attached" description="Browser-only QA remains fully available. Attach a folder only when repository context is useful." action={<button className="button primary" onClick={() => void attachWorkspace(projectId)}>Choose project folder</button>} /> : (
        <div className="two-column">
          <section className="content-card"><h2>{workspace.name}</h2><p className="local-path">{workspace.path}</p><dl className="detail-list"><div><dt>Branch</dt><dd>{workspace.snapshot.branch ?? 'None'}</dd></div><div><dt>Revision</dt><dd>{workspace.snapshot.revision?.slice(0, 12) ?? 'No Git revision'}</dd></div><div><dt>Dirty</dt><dd>{workspace.snapshot.dirty ? 'Local changes present' : 'Clean'}</dd></div><div><dt>Package manager</dt><dd>{workspace.snapshot.packageManager ?? 'Not detected'}</dd></div></dl></section>
          <section className="content-card"><h2>Analysis</h2><div className="tag-list">{workspace.snapshot.frameworks.map((item) => <span key={item.framework}>{item.framework} · {Math.round(item.confidence * 100)}%</span>)}</div><dl className="summary-grid"><div><dt>Routes</dt><dd>{workspace.snapshot.routes.length}</dd></div><div><dt>Endpoints</dt><dd>{workspace.snapshot.endpoints.length}</dd></div><div><dt>Documents</dt><dd>{workspace.snapshot.documentation.length}</dd></div><div><dt>Secrets excluded</dt><dd>{workspace.snapshot.redactionSummary.suspectedSecrets}</dd></div></dl></section>
        </div>
      )}
    </Page>
  );
}

export function SourcesPage() {
  const { projectId } = useParams();
  const { getDocuments, importDocuments, busy } = useDesktop();
  const [documents, setDocuments] = useState<SourceDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = () => projectId ? getDocuments(projectId).then(setDocuments).finally(() => setLoading(false)) : Promise.resolve();
  useEffect(() => { void refresh(); }, [projectId]);
  if (!projectId) return <ProjectRequired />;
  const upload = async () => {
    await importDocuments(projectId);
    await refresh();
  };
  return (
    <Page title="Sources" description="Local document extraction with approved, redacted evidence synchronized to Tellann." actions={<button className="button primary" disabled={busy} onClick={() => void upload()}><FileSearch size={15} />Add documents</button>}>
      <div className="context-banner">PDF, DOCX, Markdown, text, HTML, and OpenAPI files are extracted locally. Raw files stay on this device unless separately approved.</div>
      {loading ? <LoadingState /> : documents.length ? <div className="stack">{documents.map((document) => {
        const version = document.versions[0];
        const job = document.processingJobs[0];
        return <section className="content-card row-card" key={document.id}><div><small>{document.mimeType}</small><h2>{document.filename}</h2><p>{version ? `Version ${version.version} · ${version.processorVersion}` : 'Derived summary queued for processing'}</p></div><div className="source-status"><Status>{job?.status ?? document.status}</Status>{version ? <span>{String((version.extractedSummary as any)?.kind ?? 'DOCUMENT')}</span> : null}</div></section>;
      })}</div> : <EmptyState icon={<BookOpenText size={36} />} title="No product documents" description="Add existing requirements or OpenAPI documents. Tellann will infer a reviewable expected flow with citations." action={<button className="button primary" disabled={busy} onClick={() => void upload()}>Choose documents</button>} />}
    </Page>
  );
}

export function EnvironmentsPage() {
  const { application } = useProject();
  return <Page title="Environments" description="URLs, browser policy, and production restrictions."><div className="stack">{application?.environments.map((item) => <section className="content-card row-card" key={item.id}><div><h2>{item.name}</h2><p>{item.baseUrl ?? 'No base URL configured'}</p></div><Status>{item.type}</Status></section>)}</div></Page>;
}

export function ActivityPage() {
  return <GuardedFeaturePage title="Project activity" description="Workspace scans, runs, reports, and local synchronization activity." phase="Cloud audit expansion is scheduled for enterprise hardening." fallback="QA run and report history are available in their respective sections." />;
}

export function IntentPage() {
  const { projectId, application, getDeclaredFlows } = useProject();
  const { getIntentDrafts, getDocuments, createIntentDraft, busy } = useDesktop();
  const [flows, setFlows] = useState<DeclaredFlowSummary[]>([]);
  const [drafts, setDrafts] = useState<IntentDraft[]>([]);
  const [documents, setDocuments] = useState<SourceDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!projectId) return;
    void Promise.all([getDeclaredFlows(projectId), getIntentDrafts(projectId), getDocuments(projectId)])
      .then(([nextFlows, nextDrafts, nextDocuments]) => { setFlows(nextFlows); setDrafts(nextDrafts); setDocuments(nextDocuments); })
      .catch(() => { setFlows([]); setDrafts([]); setDocuments([]); }).finally(() => setLoading(false));
  }, [getDeclaredFlows, getDocuments, getIntentDrafts, projectId]);
  if (!projectId) return <ProjectRequired />;
  if (!application) return <NotFoundPage title="Project unavailable" description="Select another project." />;
  const generate = async () => {
    const versionIds = documents.flatMap((document) => document.versions[0]?.id ? [document.versions[0].id] : []);
    await createIntentDraft(projectId, versionIds);
    setDrafts(await getIntentDrafts(projectId));
  };
  return (
    <Page title="Intent" description="Generate expected workflows from approved document and repository evidence, then review before graph truth changes." actions={<><Link className="button" to={`/projects/${projectId}/intent/versions`}>Version history</Link><button className="button primary" disabled={busy || documents.every((document) => !document.versions.length)} onClick={() => void generate()}><Workflow size={15} />Generate draft</button></>}>
      {loading ? <LoadingState /> : <div className="stack">
        {drafts.length ? <section className="content-card"><div className="card-heading"><div><small>Review queue</small><h2>Inferred intent drafts</h2></div><Status>{drafts.filter((draft) => draft.status === 'PENDING_REVIEW').length} pending</Status></div><div className="stack compact">{drafts.map((draft) => <Link className="row-card draft-link" key={draft.id} to={`/projects/${projectId}/intent/drafts/${draft.id}`}><div><strong>{(draft.draftJson as any)?.workflows?.[0]?.name ?? 'Document-derived intent'}</strong><small>{draft.source} · {Math.round(draft.confidence * 100)}% confidence</small></div><Status>{draft.status}</Status></Link>)}</div></section> : null}
        {flows.length ? <section className="content-card"><div className="card-heading"><div><small>Graph truth</small><h2>Accepted declared graphs</h2></div></div><div className="stack compact">{flows.map((flow) => <section className="row-card" key={flow.id}><div><strong>{flow.name}</strong><small>Immutable accepted behavior</small></div><Status>{flow.status}</Status></section>)}</div></section> : null}
        {!drafts.length && !flows.length ? <EmptyState icon={<Workflow size={36} />} title="No expected intent yet" description="Add product documents, process their derived evidence, then generate a reviewable flow draft." action={<Link className="button primary" to={`/projects/${projectId}/sources`}>Add documents</Link>} /> : null}
      </div>}
    </Page>
  );
}

export function IntentDetailPage() {
  const { projectId, draftId } = useParams();
  const navigate = useNavigate();
  const { getIntentDraft, reviewIntentDraft, correctIntentDraft, busy } = useDesktop();
  const [draft, setDraft] = useState<IntentDraft | null>(null);
  const [loading, setLoading] = useState(Boolean(draftId));
  const [correction, setCorrection] = useState('');
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!projectId || !draftId) return;
    void getIntentDraft(projectId, draftId).then(setDraft).finally(() => setLoading(false));
  }, [draftId, getIntentDraft, projectId]);
  if (!projectId) return <ProjectRequired />;
  if (!draftId) return <GuardedFeaturePage title="Intent versions" description="Accepted graph version history." phase="Select an accepted graph from Intent." fallback="Version comparison remains cloud-authoritative." />;
  if (loading) return <LoadingState />;
  if (!draft) return <NotFoundPage title="Intent draft unavailable" description="The draft may have been removed or belongs to another project." />;
  const draftJson = draft.draftJson as any;
  const workflows = Array.isArray(draftJson?.workflows) ? draftJson.workflows : [];
  const conflicts = Array.isArray((draft.sourceManifest as any)?.conflicts) ? (draft.sourceManifest as any).conflicts : [];
  const accept = async () => {
    await reviewIntentDraft(projectId, draft.id, { action: 'ACCEPT', conflictResolutions: resolutions });
    navigate(`/projects/${projectId}/intent`);
  };
  const reject = async () => { await reviewIntentDraft(projectId, draft.id, { action: 'REJECT' }); navigate(`/projects/${projectId}/intent`); };
  const correct = async () => { await correctIntentDraft(projectId, draft.id, correction); navigate(`/projects/${projectId}/intent`); };
  return <Page title="Review inferred intent" description="Verify workflows, conflicts, assumptions, confidence, and evidence before accepting graph truth." actions={<Status>{draft.status}</Status>}>
    <div className="intent-review-grid">
      <div className="stack">
        {conflicts.length ? <section className="content-card conflict-card"><h2>Source conflicts</h2><p>Every conflict requires an explicit resolution before acceptance.</p>{conflicts.map((conflict: any) => <label key={conflict.key}><strong>{conflict.description}</strong><textarea value={resolutions[conflict.key] ?? ''} onChange={(event) => setResolutions((current) => ({ ...current, [conflict.key]: event.target.value }))} placeholder="Explain the intended behavior" /></label>)}</section> : null}
        {workflows.map((workflow: any) => <section className="content-card" key={workflow.key}><div className="card-heading"><div><small>{workflow.key}</small><h2>{workflow.name}</h2></div><Status>{Math.round((workflow.confidence ?? draft.confidence) * 100)}%</Status></div><p>{workflow.description}</p><div className="flow-review-list">{(workflow.states ?? []).map((state: any) => <div key={state.key ?? state.name}><span>{state.category ?? 'BUSINESS'}</span><strong>{state.name}</strong><small>{(state.evidenceIds ?? workflow.evidenceIds ?? []).length} citation(s)</small></div>)}</div></section>)}
      </div>
      <aside className="stack">
        <section className="content-card"><h2>Provenance</h2><dl className="detail-list"><div><dt>Source</dt><dd>{draft.source}</dd></div><div><dt>Confidence</dt><dd>{Math.round(draft.confidence * 100)}%</dd></div><div><dt>Evidence</dt><dd>{draft.evidence?.length ?? (draft.sourceManifest as any)?.evidenceIds?.length ?? 0}</dd></div></dl></section>
        <section className="content-card"><h2>Natural-language correction</h2><textarea value={correction} onChange={(event) => setCorrection(event.target.value)} placeholder="Describe what should change. A new review draft will be generated." /><button className="button" disabled={busy || !correction.trim() || draft.status !== 'PENDING_REVIEW'} onClick={() => void correct()}>Generate corrected draft</button></section>
        <section className="content-card review-actions"><button className="button primary" disabled={busy || draft.status !== 'PENDING_REVIEW' || conflicts.some((conflict: any) => !resolutions[conflict.key]?.trim())} onClick={() => void accept()}><Check size={15} />Accept as graph version</button><button className="button danger" disabled={busy || draft.status !== 'PENDING_REVIEW'} onClick={() => void reject()}>Reject draft</button><small>AI generation alone cannot modify the declared graph.</small></section>
      </aside>
    </div>
  </Page>;
}

export function InstrumentationPage() {
  const { workspace } = useProject();
  return (
    <Page title="Instrumentation" description="Choose how Tellann observes semantic application behavior.">
      <div className="mode-grid">
        <section className="mode-card featured"><Status>Available</Status><Globe2 /><h2>Browser-only</h2><p>No source mutation or SDK installation. Captures navigation, console, network, screenshots, and accessibility evidence.</p></section>
        <section className="mode-card"><Status>Manual</Status><Code2 /><h2>Manual SDK</h2><p>Continue using existing frontend and backend SDK integrations where deeper semantic telemetry is already installed.</p></section>
        <section className="mode-card"><Status>{workspace ? 'Proposal planned' : 'Workspace required'}</Status><FileSearch /><h2>Automated instrumentation</h2><p>Bounded planning and application activate in Phase 3. Guided runs do not depend on this capability.</p></section>
      </div>
    </Page>
  );
}

export function InstrumentationDetailPage() {
  return <GuardedFeaturePage title="Instrumentation task" description="Plan scope, diff, validation, manifest, and rollback." phase="Automated application activates in Phase 3." fallback="Browser-only capture and manual SDK integrations remain usable." />;
}

function useRuns(projectId?: string) {
  const { runs, refreshRuns } = useDesktop();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!projectId) return;
    void refreshRuns(projectId).catch(() => undefined).finally(() => setLoading(false));
  }, [projectId, refreshRuns]);
  return { items: projectId ? runs[projectId] ?? [] : [], loading };
}

export function RunsPage() {
  const { projectId, application } = useProject();
  const { items, loading } = useRuns(projectId);
  if (!projectId) return <ProjectRequired />;
  if (!application) return <NotFoundPage title="Project unavailable" description="Select another project." />;
  return (
    <Page title="QA Runs" description="Guided browser execution, captured evidence, reconciliation, and report processing." actions={<Link className="button primary" to={`/projects/${projectId}/qa-runs/new`}><Play size={15} />New QA run</Link>}>
      {loading ? <LoadingState /> : items.length ? <RunTable projectId={projectId} runs={items} /> : <EmptyState icon={<Play size={36} />} title="No QA runs yet" description="Receive a browser-first report without installing an SDK or granting repository write access." action={<Link className="button primary" to={`/projects/${projectId}/qa-runs/new`}>Start first run</Link>} />}
    </Page>
  );
}

function RunTable({ projectId, runs }: { projectId: string; runs: QARunSummary[] }) {
  return <div className="data-table"><div className="table-head"><span>Run</span><span>Environment</span><span>Status</span><span>Evidence</span><span>Started</span></div>{runs.map((run) => <Link className="table-row" key={run.id} to={`/projects/${projectId}/qa-runs/${run.id}`}><span><strong>{run.id.slice(0, 8)}</strong><small>{run.mode}</small></span><span>{run.environment?.name ?? run.environmentId.slice(0, 8)}</span><span><Status>{run.status}</Status></span><span>{run.artifactCount} artifacts · {run.findingCount} findings</span><span>{run.startedAt ? new Date(run.startedAt).toLocaleString() : 'Not started'}</span></Link>)}</div>;
}

export function NewRunPage() {
  const { projectId, application, workspace, startRun, busy, getDeclaredFlows } = useProject();
  const navigate = useNavigate();
  const [environmentId, setEnvironmentId] = useState(application?.environments[0]?.id ?? '');
  const environment = application?.environments.find((item) => item.id === environmentId);
  const [targetUrl, setTargetUrl] = useState(environment?.baseUrl ?? 'http://localhost:3010/auth/login');
  const [mode, setMode] = useState<'GUIDED' | 'OBSERVATION_ONLY'>(environment?.type === 'PRODUCTION' ? 'OBSERVATION_ONLY' : 'GUIDED');
  const [flows, setFlows] = useState<DeclaredFlowSummary[]>([]);
  const [expectedGraphVersionId, setExpectedGraphVersionId] = useState('');
  useEffect(() => {
    if (!projectId) return;
    void getDeclaredFlows(projectId).then((items) => {
      setFlows(items.filter((item) => item.status === 'COMPLETE' || item.status === 'COMPLETED'));
      setExpectedGraphVersionId(items.find((item) => item.status === 'COMPLETE' || item.status === 'COMPLETED')?.versions?.[0]?.id ?? '');
    });
  }, [getDeclaredFlows, projectId]);
  if (!projectId) return <ProjectRequired />;
  if (!application) return <NotFoundPage title="Project unavailable" description="Select another project." />;
  const begin = async () => {
    const run = await startRun({
      applicationId: projectId,
      environmentId,
      workspaceId: workspace?.id ?? null,
      expectedGraphVersionId: expectedGraphVersionId || null,
      environmentType: environment?.type ?? 'STAGING',
      targetUrl,
    });
    navigate(`/projects/${projectId}/qa-runs/${run.runId}/live`);
  };
  return (
    <Page title="New QA run" description="Configure a managed-browser run. Browser-only mode requires no SDK.">
      <section className="wizard-card">
        <div className="form-grid">
          <label>Environment<select value={environmentId} onChange={(event) => { const id = event.target.value; const next = application.environments.find((item) => item.id === id); setEnvironmentId(id); setTargetUrl(next?.baseUrl ?? targetUrl); setMode(next?.type === 'PRODUCTION' ? 'OBSERVATION_ONLY' : 'GUIDED'); }}>{application.environments.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.type})</option>)}</select></label>
          <label>Run mode<select value={mode} disabled={environment?.type === 'PRODUCTION'} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="GUIDED">Guided</option><option value="OBSERVATION_ONLY">Observation only</option></select></label>
          <label className="full">Application URL<input type="url" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} /></label>
          <label className="full">Expected intent<select value={expectedGraphVersionId} onChange={(event) => setExpectedGraphVersionId(event.target.value)}><option value="">Observational run (no expected graph)</option>{flows.flatMap((flow) => flow.versions?.[0] ? [<option key={flow.versions[0].id} value={flow.versions[0].id}>{flow.name} · version {flow.versions[0].version}</option>] : [])}</select></label>
        </div>
        <div className="permission-summary"><KeyRound /><div><strong>Capture policy</strong><p>Console, network, screenshot, and accessibility evidence. Secrets and personal data are redacted. Repository write and command permissions are not requested.</p></div></div>
        {environment?.type === 'PRODUCTION' ? <div className="context-banner">Production supports explicitly approved observation-only attachment. Active guided control remains blocked.</div> : null}
        <button className="button primary" disabled={busy || !targetUrl || !environmentId || environment?.type === 'PRODUCTION'} onClick={() => void begin()}><Play size={16} />{environment?.type === 'PRODUCTION' ? 'Production attachment requires observation workflow' : 'Start guided run'}</button>
      </section>
    </Page>
  );
}

export function LiveRunPage() {
  const { projectId } = useParams();
  const { activeRun: run, pauseRun, endRun, busy } = useDesktop();
  const [tab, setTab] = useState<'CONSOLE' | 'NETWORK' | 'ACCESSIBILITY'>('CONSOLE');
  if (!projectId) return <ProjectRequired />;
  if (!run) return <EmptyState icon={<Activity size={36} />} title="No active local run" description="The requested run is not active on this device. Open its cloud detail or create a new run." action={<Link className="button primary" to={`/projects/${projectId}/qa-runs`}>Run history</Link>} />;
  const visible = run.evidence.filter((item) => tab === 'ACCESSIBILITY' ? item.kind === 'ACCESSIBILITY' || item.kind === 'PAGE' : item.kind === tab);
  return (
    <div className="live-run-page">
      <section className="live-flow"><h2>Expected flow</h2><p>{run.expectedGraphVersionId ? `Reconciling against accepted graph version ${run.expectedGraphVersionId.slice(0, 8)}.` : 'No accepted intent selected. This is an observational run.'}</p><div className="flow-step complete"><span><Check /></span><div><strong>Application opened</strong><small>Entry observed</small></div></div><div className="flow-step active"><span>2</span><div><strong>Demonstrate workflow</strong><small>In progress</small></div></div></section>
      <section className="live-browser"><div className="browser-toolbar"><Globe2 size={16} /><strong>Managed Chromium</strong><Status>{run.status}</Status></div><div className="browser-canvas"><Activity size={42} /><h2>Managed browser is running</h2><p>Complete the workflow in the isolated Chromium window. Evidence streams here without using your personal browser profile.</p></div></section>
      <aside className="live-evidence"><div className="evidence-heading"><h2>Live evidence</h2><span>{run.evidence.length}</span></div><div className="evidence-tabs"><button className={tab === 'CONSOLE' ? 'selected' : ''} onClick={() => setTab('CONSOLE')}><TerminalSquare size={14} />Console</button><button className={tab === 'NETWORK' ? 'selected' : ''} onClick={() => setTab('NETWORK')}><Network size={14} />Network</button><button className={tab === 'ACCESSIBILITY' ? 'selected' : ''} onClick={() => setTab('ACCESSIBILITY')}><Accessibility size={14} />A11y</button></div><div className="evidence-list">{visible.length ? visible.map((item) => <EvidenceRow key={item.id} item={item} />) : <div className="evidence-empty">Evidence will appear during the workflow.</div>}</div></aside>
      <footer className="run-controls"><div><Status>{run.status}</Status><code>{run.runId.slice(0, 8)}</code></div><div>{run.status === 'RUNNING' || run.status === 'PAUSED' ? <><button className="button primary" disabled={busy} onClick={() => void pauseRun()}>{run.status === 'PAUSED' ? <Play /> : <CirclePause />}{run.status === 'PAUSED' ? 'Resume' : 'Pause'}</button><button className="button" disabled={busy} onClick={() => void endRun()}><CircleStop />End run</button></> : null}</div><div>Capture protected</div></footer>
    </div>
  );
}

function EvidenceRow({ item }: { item: LiveEvidence }) {
  return <div className={`evidence-row evidence-${item.level.toLowerCase()}`}><time>{new Date(item.timestamp).toLocaleTimeString()}</time><span>{item.level}</span><p>{item.message}</p></div>;
}

export function RunDetailPage() {
  const { projectId, runId } = useParams();
  const { getRun } = useDesktop();
  const [run, setRun] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (runId) void getRun(runId).then(setRun).finally(() => setLoading(false)); }, [getRun, runId]);
  if (!projectId || !runId) return <ProjectRequired />;
  if (loading) return <LoadingState />;
  if (!run) return <NotFoundPage title="Run unavailable" description="The run does not exist or is outside your organization." />;
  const status = String(run.status ?? 'UNKNOWN');
  const artifacts = Array.isArray(run.artifacts) ? run.artifacts : [];
  const findings = Array.isArray(run.findings) ? run.findings : [];
  return (
    <Page title={`QA run ${runId.slice(0, 8)}`} description="Run metadata, evidence, findings, reconciliation, and report status." actions={<Status>{status}</Status>}>
      <div className="metric-grid"><Metric label="Artifacts" value={artifacts.length} /><Metric label="Findings" value={findings.length} /><Metric label="Mode" value={String(run.mode ?? 'GUIDED')} /><Metric label="Report" value={run.reportId ? 'Ready' : status === 'COMPLETED' ? 'Generating' : 'Pending'} /></div>
      <div className="tab-links">{['evidence', 'findings', 'replay', 'graph', 'reconciliation', 'artifacts'].map((tab) => <Link key={tab} to={`/projects/${projectId}/qa-runs/${runId}/${tab}`}>{tab}</Link>)}</div>
      {run.reportId ? <Link className="button primary" to={`/projects/${projectId}/reports/${encodeURIComponent(String(run.reportId))}?runId=${runId}`}>Open QA report</Link> : null}
    </Page>
  );
}

export function RunSubPage({ kind }: { kind: string }) {
  const { projectId, runId } = useParams();
  const { getRun } = useDesktop();
  const [run, setRun] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { if (runId) void getRun(runId).then(setRun); }, [getRun, runId]);
  const items = kind === 'evidence' || kind === 'artifacts'
    ? (Array.isArray(run?.artifacts) ? run.artifacts : [])
    : kind === 'findings' ? (Array.isArray(run?.findings) ? run.findings : []) : [];
  return (
    <Page title={kind[0].toUpperCase() + kind.slice(1)} description={`Correlated ${kind} for run ${runId?.slice(0, 8) ?? ''}.`} actions={<Link className="button" to={`/projects/${projectId}/qa-runs/${runId}`}>Run overview</Link>}>
      {['evidence', 'artifacts', 'findings'].includes(kind) ? items.length ? <pre className="json-view">{JSON.stringify(items, null, 2)}</pre> : <EmptyState icon={<BookOpenText size={36} />} title={`No ${kind} available`} description="This run has not produced data for this section, or processing is still underway." /> : <GuardedFeatureContent phase={kind === 'replay' ? 'Rich synchronized replay is staged after browser-first evidence.' : 'This view becomes richer as processing completes.'} fallback="The run overview, uploaded evidence, findings, and canonical report remain available." />}
    </Page>
  );
}

export function ReportsPage() {
  const { projectId } = useParams();
  const { items, loading } = useRuns(projectId);
  if (!projectId) return <ProjectRequired />;
  const reportRuns = items.filter((run) => run.reportId || run.status === 'COMPLETED');
  return (
    <Page title="Reports" description="Canonical quality reports generated from guided QA evidence and reconciliation.">
      {loading ? <LoadingState /> : reportRuns.length ? <div className="project-grid">{reportRuns.map((run) => <article className="project-card" key={run.id}><div className="card-heading"><div><small>QA report</small><h2>{run.id.slice(0, 8)}</h2></div><Status>{run.reportId ? 'Ready' : 'Processing'}</Status></div><dl className="summary-grid"><div><dt>Environment</dt><dd>{run.environment?.name ?? 'Environment'}</dd></div><div><dt>Findings</dt><dd>{run.findingCount}</dd></div><div><dt>Artifacts</dt><dd>{run.artifactCount}</dd></div><div><dt>Completed</dt><dd>{run.endedAt ? new Date(run.endedAt).toLocaleDateString() : 'Pending'}</dd></div></dl><Link className="button primary" to={`/projects/${projectId}/reports/${encodeURIComponent(run.reportId ?? `qa-report:${run.id}`)}?runId=${run.id}`}>Open report</Link></article>)}</div> : <EmptyState icon={<BarChart3 size={36} />} title="No reports yet" description="Complete a browser-first QA run to generate the first report." action={<Link className="button primary" to={`/projects/${projectId}/qa-runs/new`}>Start QA run</Link>} />}
    </Page>
  );
}

export function ReportDetailPage() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId');
  const { getReport } = useDesktop();
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (runId) void getReport(runId).then(setReport).finally(() => setLoading(false)); else setLoading(false); }, [getReport, runId]);
  if (!projectId) return <ProjectRequired />;
  if (loading) return <LoadingState />;
  if (!report) return <NotFoundPage title="Report unavailable" description="The report is still processing, expired, or the source run was not provided." />;
  return (
    <Page title="Quality report" description={`${report.application.name} · ${report.environment.name} · generated ${new Date(report.generatedAt).toLocaleString()}`} actions={<Status>{report.status}</Status>}>
      <div className="metric-grid"><Metric label="Expected coverage" value={report.coverage.expected == null ? 'Observational' : `${report.coverage.expected.toFixed(1)}%`} /><Metric label="Observed states" value={report.summary.observedStateCount} /><Metric label="Transitions" value={report.summary.observedTransitionCount} /><Metric label="High priority" value={report.summary.criticalOrHighFindings} /></div>
      <div className="two-column"><section className="content-card"><h2>Evidence and findings</h2><p>{report.summary.artifactCount} approved artifacts and {report.summary.findingCount} evidence-backed findings.</p><Link className="button" to={`/projects/${projectId}/qa-runs/${report.runId}/evidence`}>Review evidence</Link></section><section className="content-card"><h2>Correlation</h2><p>Run {report.correlation.runId.slice(0, 8)} · {report.correlation.sessions.length} observed session(s)</p><Link className="button" to={`/projects/${projectId}/qa-runs/${report.runId}/reconciliation`}>View reconciliation</Link></section></div>
      {report.findings.length ? <pre className="json-view">{JSON.stringify(report.findings, null, 2)}</pre> : <div className="context-banner">No findings were generated for this run.</div>}
    </Page>
  );
}

export function ReportAuxPage({ kind }: { kind: 'compare' | 'export' }) {
  return <GuardedFeaturePage title={kind === 'compare' ? 'Compare reports' : 'Export report'} description={kind === 'compare' ? 'Compare run, revision, intent, and finding deltas.' : 'Review privacy, redaction, included sections, and export format.'} phase={kind === 'compare' ? 'Canonical persisted comparison activates with report versioning.' : 'Existing web exports remain the current canonical export path.'} fallback="Open the report in the web companion for the currently supported workflow." />;
}

export function GuardedFeaturePage({ title, description, phase, fallback }: { title: string; description: string; phase: string; fallback: string }) {
  return <Page title={title} description={description}><GuardedFeatureContent phase={phase} fallback={fallback} /></Page>;
}

function GuardedFeatureContent({ phase, fallback }: { phase: string; fallback: string }) {
  return <section className="guarded-card"><ShieldCheck size={32} /><div><Status>Staged capability</Status><h2>{phase}</h2><p>{fallback}</p></div></section>;
}

export function LoadingState() {
  return <div className="loading-state" role="status"><RefreshCw className="spin" /><span>Loading current project data…</span></div>;
}

export function NotFoundPage({ title = 'Page not found', description = 'The requested desktop route does not exist.' }: { title?: string; description?: string }) {
  return <Page title={title} description={description}><EmptyState icon={<AlertTriangle size={36} />} title="Nothing was changed" description="Choose a valid project or return to the project list." action={<Link className="button primary" to="/projects">Projects</Link>} /></Page>;
}
