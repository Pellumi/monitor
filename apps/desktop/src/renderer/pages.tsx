import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Accessibility, Activity, AlertTriangle, ArrowRight, BarChart3, BookOpenText,
  Check, CirclePause, CircleStop, Code2, FileSearch, Folder, Globe2, KeyRound, Lock,
  Network, Play, Plus, RefreshCw, SearchCode, ShieldCheck, TerminalSquare, Unlock, Workflow,
} from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { DeclaredFlowDetail, DeclaredFlowSummary, InstrumentationDetection, InstrumentationPlan, IntentDraft, QARunSummary, QualityReport, SourceDocumentSummary } from '@sots/desktop-contracts';
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
  const [unentitled, setUnentitled] = useState(false);

  const refresh = async () => {
    if (!projectId) return;
    try {
      const access = await getDocuments(projectId);
      setDocuments(access.documents);
      setUnentitled(!access.entitled);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [projectId]);

  if (!projectId) return <ProjectRequired />;

  if (unentitled) {
    return (
      <Page title="Sources" description="Local document extraction with approved, redacted evidence synchronized to Tellann.">
        <section className="guarded-card">
          <ShieldCheck size={32} />
          <div>
            <Status>Plan Entitlement Required</Status>
            <h2>Document Flow Inference requires an upgraded plan</h2>
            <p>Source document extraction and analysis (<code>DOCUMENT_FLOW_INFERENCE</code>) is not included on your organization's current plan (Free). Upgrade to Local, Solo, or Team plan to enable product document upload and workflow inference.</p>
          </div>
        </section>
      </Page>
    );
  }

  const upload = async () => {
    try {
      await importDocuments(projectId);
      await refresh();
    } catch (err: any) {
      if (String(err?.message ?? err).includes('FEATURE_NOT_ENTITLED')) {
        setUnentitled(true);
      }
    }
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

function ManualIntentBuilder({ projectId, flows, refreshFlows }: {
  projectId: string;
  flows: DeclaredFlowSummary[];
  refreshFlows(): Promise<DeclaredFlowSummary[]>;
}) {
  const {
    getDeclaredFlow, createDeclaredFlow, addDeclaredState, addDeclaredTransition,
    completeDeclaredFlow, reopenDeclaredFlow, busy,
  } = useDesktop();
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [activeFlow, setActiveFlow] = useState<DeclaredFlowDetail | null>(null);
  const [newFlowName, setNewFlowName] = useState('');
  const [workflowType, setWorkflowType] = useState('CUSTOM');
  const [stateName, setStateName] = useState('');
  const [stateCategory, setStateCategory] = useState('BUSINESS');
  const [fromStateId, setFromStateId] = useState('');
  const [toStateId, setToStateId] = useState('');
  const [transitionAction, setTransitionAction] = useState('');
  const [message, setMessage] = useState<string | null>(null);

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
    void refreshActiveFlow().catch((err) => setMessage(String(err?.message ?? err)));
  }, [projectId, selectedFlowId]);

  const createFlow = async () => {
    const name = newFlowName.trim();
    if (!name) return;
    try {
      const flow = await createDeclaredFlow(projectId, name, workflowType);
      await refreshFlows();
      setNewFlowName('');
      setSelectedFlowId(flow.id);
      setMessage('Flow created. Add the states users should move through.');
    } catch (err: any) {
      setMessage(String(err?.message ?? err));
    }
  };

  const addState = async () => {
    const name = stateName.trim();
    if (!selectedFlowId || !name) return;
    try {
      await addDeclaredState(projectId, selectedFlowId, name, stateCategory);
      setStateName('');
      await refreshActiveFlow();
      await refreshFlows();
      setMessage('State added.');
    } catch (err: any) {
      setMessage(String(err?.message ?? err));
    }
  };

  const addTransition = async () => {
    if (!selectedFlowId || !fromStateId || !toStateId || fromStateId === toStateId) return;
    try {
      await addDeclaredTransition(projectId, selectedFlowId, fromStateId, toStateId, transitionAction.trim() || undefined);
      setFromStateId('');
      setToStateId('');
      setTransitionAction('');
      await refreshActiveFlow();
      await refreshFlows();
      setMessage('Transition added.');
    } catch (err: any) {
      setMessage(String(err?.message ?? err));
    }
  };

  const toggleComplete = async () => {
    if (!activeFlow) return;
    try {
      if (activeFlow.status === 'COMPLETE') await reopenDeclaredFlow(projectId, activeFlow.id);
      else await completeDeclaredFlow(projectId, activeFlow.id);
      await refreshActiveFlow();
      await refreshFlows();
      setMessage(activeFlow.status === 'COMPLETE' ? 'Flow reopened for editing.' : 'Flow completed and ready for QA reconciliation.');
    } catch (err: any) {
      setMessage(String(err?.message ?? err));
    }
  };

  const editable = activeFlow?.status !== 'COMPLETE';
  const stateNameById = new Map(activeFlow?.states.map((state) => [state.id, state.stateName]) ?? []);

  return <div className="stack">
    <section className="content-card upgrade-card">
      <div><Status>Free plan · Manual declaration</Status><h2>Declare your intended behavior directly</h2><p>Manual flow declaration is included on Free. Upgrade to Local or Solo to turn requirements and product documents into reviewable AI-generated flows.</p></div>
      <Status>Local or Solo unlocks AI</Status>
    </section>

    <section className="content-card manual-flow-create">
      <div className="card-heading"><div><small>Step 1</small><h2>Create or choose a flow</h2></div></div>
      <div className="manual-flow-controls">
        <label><span>Existing flow</span><select value={selectedFlowId} onChange={(event) => setSelectedFlowId(event.target.value)}><option value="">Select a flow</option>{flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name} ({flow.status})</option>)}</select></label>
        <label><span>New flow name</span><input value={newFlowName} onChange={(event) => setNewFlowName(event.target.value)} placeholder="e.g. Customer checkout" /></label>
        <label><span>Flow type</span><select value={workflowType} onChange={(event) => setWorkflowType(event.target.value)}><option value="CUSTOM">Custom</option><option value="AUTHENTICATION">Authentication</option><option value="CHECKOUT">Checkout</option><option value="ONBOARDING">Onboarding</option></select></label>
        <button className="button primary" disabled={busy || !newFlowName.trim()} onClick={() => void createFlow()}><Plus size={15} />Create flow</button>
      </div>
    </section>

    {activeFlow ? <>
      <section className="content-card">
        <div className="card-heading"><div><small>Step 2</small><h2>Add expected states</h2></div><Status>{activeFlow.states.length} states</Status></div>
        <p>States are meaningful moments in the workflow, such as CART_REVIEWED, PAYMENT_SUBMITTED, or ORDER_CONFIRMED.</p>
        <div className="manual-flow-controls">
          <label><span>State name</span><input disabled={!editable} value={stateName} onChange={(event) => setStateName(event.target.value)} placeholder="e.g. PAYMENT_SUBMITTED" /></label>
          <label><span>Category</span><select disabled={!editable} value={stateCategory} onChange={(event) => setStateCategory(event.target.value)}><option value="BUSINESS">Business</option><option value="UI">UI</option><option value="SYSTEM">System</option><option value="ERROR">Error</option></select></label>
          <button className="button primary" disabled={busy || !editable || !stateName.trim()} onClick={() => void addState()}><Plus size={15} />Add state</button>
        </div>
        {activeFlow.states.length ? <div className="manual-state-list">{activeFlow.states.map((state, index) => <div key={state.id}><span>{index + 1}</span><strong>{state.stateName}</strong><small>{state.category}</small></div>)}</div> : <p className="muted-callout">No states yet. Add the first expected behavior above.</p>}
      </section>

      <section className="content-card">
        <div className="card-heading"><div><small>Step 3</small><h2>Connect the states</h2></div><Status>{activeFlow.transitions.length} transitions</Status></div>
        <div className="manual-flow-controls transition-controls">
          <label><span>From</span><select disabled={!editable} value={fromStateId} onChange={(event) => setFromStateId(event.target.value)}><option value="">Choose state</option>{activeFlow.states.map((state) => <option key={state.id} value={state.id}>{state.stateName}</option>)}</select></label>
          <label><span>To</span><select disabled={!editable} value={toStateId} onChange={(event) => setToStateId(event.target.value)}><option value="">Choose state</option>{activeFlow.states.map((state) => <option key={state.id} value={state.id}>{state.stateName}</option>)}</select></label>
          <label><span>Action (optional)</span><input disabled={!editable} value={transitionAction} onChange={(event) => setTransitionAction(event.target.value)} placeholder="e.g. submit payment" /></label>
          <button className="button primary" disabled={busy || !editable || !fromStateId || !toStateId || fromStateId === toStateId} onClick={() => void addTransition()}><Plus size={15} />Add transition</button>
        </div>
        {activeFlow.transitions.length ? <div className="manual-transition-list">{activeFlow.transitions.map((transition) => <div key={transition.id}><strong>{stateNameById.get(transition.fromStateId) ?? transition.fromState?.stateName}</strong><ArrowRight size={14} /><strong>{stateNameById.get(transition.toStateId) ?? transition.toState?.stateName}</strong><small>{transition.action || 'Transition'}</small></div>)}</div> : <p className="muted-callout">Add at least two states, then describe how users move between them.</p>}
      </section>

      <section className="content-card manual-flow-finish"><div><small>Step 4</small><h2>{activeFlow.status === 'COMPLETE' ? 'Flow is complete' : 'Finish the declaration'}</h2><p>{activeFlow.status === 'COMPLETE' ? 'This flow can now be used as expected behavior during QA runs.' : 'Completing locks this version and makes it available for reconciliation. You can reopen it later.'}</p></div><button className="button primary" disabled={busy || (!activeFlow.states.length && editable)} onClick={() => void toggleComplete()}>{activeFlow.status === 'COMPLETE' ? <Unlock size={15} /> : <Lock size={15} />}{activeFlow.status === 'COMPLETE' ? 'Reopen flow' : 'Complete flow'}</button></section>
    </> : <EmptyState icon={<Workflow size={36} />} title="Create your first intended flow" description="Name a workflow above, then add its expected states and transitions." />}
    {message ? <div className="context-banner" role="status">{message}</div> : null}
  </div>;
}

export function IntentPage() {
  const { projectId, application, getDeclaredFlows } = useProject();
  const { getIntentDrafts, getDocuments, createIntentDraft, busy } = useDesktop();
  const [flows, setFlows] = useState<DeclaredFlowSummary[]>([]);
  const [drafts, setDrafts] = useState<IntentDraft[]>([]);
  const [documents, setDocuments] = useState<SourceDocumentSummary[]>([]);
  const [documentAutomationAvailable, setDocumentAutomationAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void Promise.all([getDeclaredFlows(projectId).catch(() => []), getDocuments(projectId)])
      .then(async ([nextFlows, access]) => {
        if (cancelled) return;
        setFlows(nextFlows);
        setDocuments(access.documents);
        setDocumentAutomationAvailable(access.entitled);
        if (access.entitled) setDrafts(await getIntentDrafts(projectId));
        else setDrafts([]);
      })
      .catch(() => { if (!cancelled) setDocumentAutomationAvailable(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);
  if (!projectId) return <ProjectRequired />;
  if (!application) return <NotFoundPage title="Project unavailable" description="Select another project." />;
  const refreshFlows = async () => {
    const next = await getDeclaredFlows(projectId);
    setFlows(next);
    return next;
  };
  const generate = async () => {
    const versionIds = documents.flatMap((document) => document.versions[0]?.id ? [document.versions[0].id] : []);
    await createIntentDraft(projectId, versionIds);
    setDrafts(await getIntentDrafts(projectId));
  };
  return (
    <Page title="Intent" description={documentAutomationAvailable === false ? 'Declare the system flows and behaviors your QA runs should expect.' : 'Generate expected workflows from approved document and repository evidence, then review before graph truth changes.'} actions={<Link className="button" to={`/projects/${projectId}/intent/versions`}>Version history</Link>}>
      {loading ? <LoadingState /> : documentAutomationAvailable === false ? <ManualIntentBuilder projectId={projectId} flows={flows} refreshFlows={refreshFlows} /> : <div className="stack">
        <section className="content-card ai-intent-actions"><div><Status>AI-assisted intent</Status><h2>Generate flows from your documents</h2><p>Tellann creates a review draft first. Nothing changes graph truth until you accept it.</p></div><button className="button primary" disabled={busy || documents.every((document) => !document.versions.length)} onClick={() => void generate()}><Workflow size={15} />Generate draft</button></section>
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
  const {
    projectId, application, workspace, busy, detectInstrumentation, proposeInstrumentation,
    listInstrumentationPlans,
  } = useProject();
  const editableEnvironments = application?.environments.filter((item) => item.type !== 'PRODUCTION') ?? [];
  const [environmentId, setEnvironmentId] = useState(editableEnvironments[0]?.id ?? application?.environments[0]?.id ?? '');
  const environment = application?.environments.find((item) => item.id === environmentId);
  const instrumentationEntitled = application?.entitlements?.features.AUTOMATED_INSTRUMENTATION === true;
  const [detections, setDetections] = useState<InstrumentationDetection[]>([]);
  const [plans, setPlans] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPlans = async () => {
    if (!projectId) return;
    setPlans(await listInstrumentationPlans(projectId));
  };

  useEffect(() => {
    if (!projectId) return;
    void refreshPlans().finally(() => setLoading(false));
  }, [projectId]);

  if (!projectId) return <ProjectRequired />;
  if (!application) return <NotFoundPage title="Project unavailable" description="Select another project." />;

  const detect = async () => {
    if (!environment) return;
    const result = await detectInstrumentation({ applicationId: projectId, environmentId: environment.id, environmentType: environment.type });
    setDetections(result.detections);
  };

  const propose = async (adapterId: InstrumentationDetection['adapterId']) => {
    if (!environment) return;
    await proposeInstrumentation({ applicationId: projectId, environmentId: environment.id, environmentType: environment.type, adapterId });
    await refreshPlans();
  };

  return (
    <Page title="Instrumentation" description="Detect the project stack, review a bounded task, and approve every file and command before Tellann writes.">
      <div className="mode-grid">
        <section className="mode-card featured"><Status>Available</Status><Globe2 /><h2>Browser-only</h2><p>No source mutation or SDK installation. Captures navigation, console, network, screenshots, and accessibility evidence.</p></section>
        <section className="mode-card"><Status>Manual</Status><Code2 /><h2>Manual SDK</h2><p>Continue using existing frontend and backend SDK integrations where deeper semantic telemetry is already installed.</p></section>
        <section className="mode-card"><Status>{!instrumentationEntitled ? 'Solo plan and above' : workspace ? 'Available' : 'Workspace required'}</Status><FileSearch /><h2>Automated instrumentation</h2><p>Syntax-aware SDK installation with task-scoped approval, validation, a local checkpoint, and conflict-safe rollback.</p></section>
      </div>
      <section className="content-card stack">
        <div className="card-heading"><div><small>Step 1</small><h2>Detect a supported adapter</h2></div><Status>{environment?.type ?? 'Select environment'}</Status></div>
        <label>Environment<select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)}>{application.environments.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.type}</option>)}</select></label>
        {environment?.type === 'PRODUCTION' ? <div className="context-banner"><Lock size={15} /> Production is observation-only. Instrumentation proposal and application are blocked locally and by the cloud.</div> : null}
        {!instrumentationEntitled ? <div className="context-banner"><Lock size={15} /> Automated instrumentation is not included on the {application.entitlements?.planType ?? 'current'} plan. Browser-only QA remains available.</div> : null}
        <div className="card-actions"><button className="button primary" disabled={busy || !workspace || !environment || environment.type === 'PRODUCTION' || !instrumentationEntitled} onClick={() => void detect()}><SearchCode size={15} />Detect framework</button></div>
        {detections.length ? <div className="data-table"><div className="table-head"><span>Adapter</span><span>Version</span><span>Confidence</span><span>Action</span></div>{detections.map((item) => <div className="table-row" key={item.adapterId}><span><strong>{item.adapterId}</strong><small>{item.supported ? 'Supported' : item.reasons.join('; ')}</small></span><span>{item.frameworkVersion ?? 'Unknown'}<small>{item.supportedVersionRange}</small></span><span>{Math.round(item.confidence * 100)}%</span><span><button className="button" disabled={busy || !item.supported} onClick={() => void propose(item.adapterId)}>Create bounded plan</button></span></div>)}</div> : null}
      </section>
      <section className="content-card">
        <div className="card-heading"><div><small>Step 2</small><h2>Instrumentation tasks</h2></div><button className="button" disabled={busy} onClick={() => void refreshPlans()}><RefreshCw size={15} />Refresh</button></div>
        {loading ? <LoadingState /> : plans.length ? <div className="data-table"><div className="table-head"><span>Framework</span><span>Risk</span><span>Status</span><span>Created</span></div>{plans.map((plan) => <Link className="table-row" key={String(plan.id)} to={`/projects/${projectId}/instrumentation/plans/${plan.id}`}><span><strong>{String(plan.adapterId)}</strong><small>{String(plan.frameworkVersion ?? 'unknown version')}</small></span><span>{String(plan.risk)}</span><span><Status>{String(plan.status)}</Status></span><span>{plan.createdAt ? new Date(String(plan.createdAt)).toLocaleString() : '—'}</span></Link>)}</div> : <EmptyState icon={<FileSearch size={36} />} title="No instrumentation tasks" description="Detect the attached project and create a proposal. No files change until explicit approval." />}
      </section>
    </Page>
  );
}

export function InstrumentationDetailPage() {
  const { projectId, planId } = useParams();
  const {
    application, busy, getInstrumentationPlan, getLocalInstrumentationResult, approveInstrumentation,
    rejectInstrumentation, applyInstrumentation, validateInstrumentation, rollbackInstrumentation,
  } = useProject();
  const [record, setRecord] = useState<Record<string, any> | null>(null);
  const [localResult, setLocalResult] = useState<Record<string, any> | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [commands, setCommands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const plan = record?.planJson as InstrumentationPlan | undefined;
  const environment = application?.environments.find((item) => item.id === record?.environmentId);
  const installRequired = plan?.validationCommands.some((command) => command.id === 'install-sdk') ?? false;
  const instrumentationEntitled = application?.entitlements?.features.AUTOMATED_INSTRUMENTATION === true;

  const refresh = async () => {
    if (!projectId || !planId) return;
    const [next, local] = await Promise.all([
      getInstrumentationPlan(projectId, planId), getLocalInstrumentationResult(projectId, planId),
    ]);
    setRecord(next);
    setLocalResult(local);
    const nextPlan = next.planJson as InstrumentationPlan;
    setFiles((current) => current.length ? current : nextPlan.approvedFileScopes);
    setCommands((current) => current.length ? current : nextPlan.validationCommands.map((item) => item.id));
  };

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [projectId, planId]);

  if (!projectId) return <ProjectRequired />;
  if (!planId) return <Page title="Instrumentation history" description="Select a task from the instrumentation workspace."><Link className="button primary" to={`/projects/${projectId}/instrumentation`}>Open tasks</Link></Page>;
  if (loading) return <LoadingState />;
  if (!record || !plan || !environment) return <NotFoundPage title="Instrumentation task unavailable" description="The task may be stale, removed, or outside this project." />;

  const approve = async () => {
    await approveInstrumentation({ applicationId: projectId, environmentId: environment.id, environmentType: environment.type, planId, approvedFileScopes: files, approvedCommandIds: commands });
    await refresh();
  };
  const apply = async () => { await applyInstrumentation(projectId, planId); await refresh(); };
  const validate = async () => { await validateInstrumentation(projectId, planId); await refresh(); };
  const rollback = async () => { await rollbackInstrumentation(projectId, planId); await refresh(); };

  return <Page title={`Instrumentation · ${plan.adapterId}`} description="Review scope, commands, evidence, local diff, validation, and rollback status." actions={<Status>{String(record.status)}</Status>}>
    <div className="two-column">
      <section className="content-card stack"><div className="card-heading"><div><small>Approved write boundary</small><h2>Files</h2></div><span>{files.length}/{plan.approvedFileScopes.length}</span></div>{plan.operations.map((operation) => <label className="check-row" key={operation.id}><input type="checkbox" disabled={record.status !== 'PROPOSED'} checked={files.includes(operation.relativePath)} onChange={(event) => setFiles((current) => event.target.checked ? [...new Set([...current, operation.relativePath])] : current.filter((item) => item !== operation.relativePath))} /><span><strong>{operation.relativePath}</strong><small>{operation.description}</small></span></label>)}</section>
      <section className="content-card stack"><div className="card-heading"><div><small>Approved execution boundary</small><h2>Commands</h2></div><Status>{plan.risk}</Status></div>{plan.validationCommands.map((command) => <label className="check-row" key={command.id}><input type="checkbox" disabled={record.status !== 'PROPOSED' || command.id === 'install-sdk'} checked={commands.includes(command.id)} onChange={(event) => setCommands((current) => event.target.checked ? [...new Set([...current, command.id])] : current.filter((item) => item !== command.id))} /><span><strong>{command.purpose}</strong><small>{command.executable} {command.args.join(' ')} · {command.networkRequired ? 'network' : 'offline'}</small></span></label>)}<p className="muted">{installRequired ? 'SDK installation is part of this approved task.' : 'The SDK is already available, so no registry installation is required.'} Tellann executes argument arrays without a shell.</p></section>
    </div>
    <section className="content-card"><h2>Evidence and risk</h2><div className="tag-list">{plan.riskReasons.map((reason) => <span key={reason}>{reason}</span>)}</div><dl className="detail-list"><div><dt>Base revision</dt><dd>{plan.baseRevision ?? 'No Git revision'}</dd></div><div><dt>Repository fingerprint</dt><dd>{plan.repositoryFingerprint.slice(0, 16)}…</dd></div><div><dt>Adapter</dt><dd>{plan.adapterVersion} · {plan.supportedVersionRange}</dd></div></dl></section>
    <section className="content-card review-actions">
      {!instrumentationEntitled ? <div className="context-banner"><Lock size={15} /> This plan cannot approve or apply automated instrumentation. Browser-only QA remains available.</div> : null}
      {record.status === 'PROPOSED' ? <><button className="button primary" disabled={busy || !instrumentationEntitled || files.length !== plan.approvedFileScopes.length || (installRequired && !commands.includes('install-sdk'))} onClick={() => void approve()}><ShieldCheck size={15} />Approve bounded task</button><button className="button danger" disabled={busy} onClick={() => void rejectInstrumentation(projectId, planId, 'Rejected in desktop review').then(refresh)}>Reject</button></> : null}
      {record.status === 'APPROVED' ? <button className="button primary" disabled={busy || !instrumentationEntitled} onClick={() => void apply()}><TerminalSquare size={15} />Apply and validate</button> : null}
      {['APPLIED', 'VALIDATION_FAILED', 'COMPLETED'].includes(String(record.status)) ? <><button className="button" disabled={busy} onClick={() => void validate()}>Re-run local checks</button><button className="button danger" disabled={busy} onClick={() => void rollback()}>Rollback Tellann changes</button></> : null}
    </section>
    {localResult ? <div className="two-column"><section className="content-card"><h2>Local validation</h2>{((localResult.validation as any)?.checks ?? []).map((check: any) => <Checklist key={check.name} checked={Boolean(check.passed)} text={`${check.name}: ${check.output}`} />)}</section><section className="content-card"><h2>Local diff</h2><p>Raw diff content remains encrypted on this device; the cloud stores only its hash and file manifest.</p><pre className="code-block">{String((localResult.patch as any)?.diff ?? 'No local diff')}</pre></section></div> : null}
  </Page>;
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
  const { projectId, application, workspace, startRun, busy, getDeclaredFlows, listInstrumentationPlans } = useProject();
  const navigate = useNavigate();
  const [environmentId, setEnvironmentId] = useState(application?.environments[0]?.id ?? '');
  const environment = application?.environments.find((item) => item.id === environmentId);
  const [targetUrl, setTargetUrl] = useState(environment?.baseUrl ?? 'http://localhost:3010/auth/login');
  const [mode, setMode] = useState<'GUIDED' | 'OBSERVATION_ONLY'>(environment?.type === 'PRODUCTION' ? 'OBSERVATION_ONLY' : 'GUIDED');
  const [productionObservationApproved, setProductionObservationApproved] = useState(false);
  const [flows, setFlows] = useState<DeclaredFlowSummary[]>([]);
  const [expectedGraphVersionId, setExpectedGraphVersionId] = useState('');
  const [instrumentationManifests, setInstrumentationManifests] = useState<Array<{ id: string; label: string }>>([]);
  const [patchSetId, setPatchSetId] = useState('');
  const launchCommands = workspace?.snapshot.launchCommands ?? [];
  const [launchCommandId, setLaunchCommandId] = useState('');
  const [launchApproved, setLaunchApproved] = useState(false);
  useEffect(() => {
    if (!projectId) return;
    void getDeclaredFlows(projectId).then((items) => {
      setFlows(items.filter((item) => item.status === 'COMPLETE' || item.status === 'COMPLETED'));
      setExpectedGraphVersionId(items.find((item) => item.status === 'COMPLETE' || item.status === 'COMPLETED')?.versions?.[0]?.id ?? '');
    });
  }, [getDeclaredFlows, projectId]);
  useEffect(() => {
    if (!projectId) return;
    void listInstrumentationPlans(projectId).then((plans) => {
      const manifests = plans.flatMap((plan: any) => ((plan.patchSets ?? []) as any[])
        .filter((patch) => patch.status === 'VALIDATED')
        .map((patch) => ({ id: String(patch.id), label: `${String(plan.adapterId)} · ${new Date(String(patch.validatedAt ?? patch.createdAt)).toLocaleString()}` })));
      setInstrumentationManifests(manifests);
      setPatchSetId((current) => current || manifests[0]?.id || '');
    }).catch(() => undefined);
  }, [listInstrumentationPlans, projectId]);
  if (!projectId) return <ProjectRequired />;
  if (!application) return <NotFoundPage title="Project unavailable" description="Select another project." />;
  const begin = async () => {
    const run = await startRun({
      applicationId: projectId,
      environmentId,
      workspaceId: workspace?.id ?? null,
      expectedGraphVersionId: expectedGraphVersionId || null,
      patchSetId: patchSetId || null,
      environmentType: environment?.type ?? 'STAGING',
      mode,
      productionObservationApproved: environment?.type === 'PRODUCTION' && productionObservationApproved,
      targetUrl,
      launchCommandId: launchCommandId || undefined,
      launchApproved: Boolean(launchCommandId) && launchApproved,
    });
    navigate(`/projects/${projectId}/qa-runs/${run.runId}/live`);
  };
  return (
    <Page title="New QA run" description="Configure a managed-browser run. Browser-only mode requires no SDK.">
      <section className="wizard-card">
        <div className="form-grid">
          <label>Environment<select value={environmentId} onChange={(event) => { const id = event.target.value; const next = application.environments.find((item) => item.id === id); setEnvironmentId(id); setTargetUrl(next?.baseUrl ?? targetUrl); setMode(next?.type === 'PRODUCTION' ? 'OBSERVATION_ONLY' : 'GUIDED'); setLaunchCommandId(''); setLaunchApproved(false); setProductionObservationApproved(false); }}>{application.environments.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.type})</option>)}</select></label>
          <label>Run mode<select value={mode} disabled={environment?.type === 'PRODUCTION'} onChange={(event) => { const next = event.target.value as typeof mode; setMode(next); if (next === 'OBSERVATION_ONLY') { setLaunchCommandId(''); setLaunchApproved(false); } }}><option value="GUIDED">Guided</option><option value="OBSERVATION_ONLY">Observation only</option></select></label>
          <label className="full">Application URL<input type="url" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} /></label>
          <label className="full">Expected intent<select value={expectedGraphVersionId} onChange={(event) => setExpectedGraphVersionId(event.target.value)}><option value="">Observational run (no expected graph)</option>{flows.flatMap((flow) => flow.versions?.[0] ? [<option key={flow.versions[0].id} value={flow.versions[0].id}>{flow.name} · version {flow.versions[0].version}</option>] : [])}</select></label>
          <label className="full">Instrumentation evidence<select value={patchSetId} onChange={(event) => setPatchSetId(event.target.value)}><option value="">Browser-only run (no instrumentation manifest)</option>{instrumentationManifests.map((manifest) => <option key={manifest.id} value={manifest.id}>{manifest.label}</option>)}</select></label>
          {launchCommands.length && mode !== 'OBSERVATION_ONLY' ? <label className="full">Local application process<select value={launchCommandId} onChange={(event) => { setLaunchCommandId(event.target.value); setLaunchApproved(false); }}><option value="">Attach to an already running application</option>{launchCommands.map((command) => <option key={command.id} value={command.id}>{command.label}</option>)}</select></label> : null}
        </div>
        {launchCommandId ? <label className="check-row"><input type="checkbox" checked={launchApproved} onChange={(event) => setLaunchApproved(event.target.checked)} /><span><strong>Approve this package script for this run</strong><small>Tellann executes only the selected package.json script without a shell and stops only the process tree it started.</small></span></label> : null}
        <div className="permission-summary"><KeyRound /><div><strong>Capture policy</strong><p>Console, network, screenshot, and accessibility evidence. Secrets and personal data are redacted. Repository access remains read-only unless you separately approved instrumentation. A local package script runs only when selected and approved above.</p></div></div>
        {environment?.type === 'PRODUCTION' ? <><div className="context-banner">Production is observation-only. Tellann blocks process launch, SDK injection, and non-read HTTP requests.</div><label className="check-row"><input type="checkbox" checked={productionObservationApproved} onChange={(event) => setProductionObservationApproved(event.target.checked)} /><span><strong>Approve production observation for this run</strong><small>No repository command, instrumentation, form submission, upload, or data mutation is permitted.</small></span></label></> : null}
        <button className="button primary" disabled={busy || !targetUrl || !environmentId || Boolean(launchCommandId && !launchApproved) || Boolean(environment?.type === 'PRODUCTION' && !productionObservationApproved)} onClick={() => void begin()}><Play size={16} />{environment?.type === 'PRODUCTION' ? 'Start observation-only run' : 'Start guided run'}</button>
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
      {report.instrumentation ? <section className="content-card"><div className="card-heading"><div><small>Instrumentation manifest</small><h2>{report.instrumentation.adapterId}</h2></div><Status>{report.instrumentation.status}</Status></div><dl className="detail-list"><div><dt>Plan</dt><dd>{report.instrumentation.planId.slice(0, 8)}</dd></div><div><dt>Adapter version</dt><dd>{report.instrumentation.adapterVersion}</dd></div><div><dt>Manifest version</dt><dd>{report.instrumentation.manifestVersion}</dd></div><div><dt>Validated</dt><dd>{report.instrumentation.validatedAt ? new Date(report.instrumentation.validatedAt).toLocaleString() : 'Not validated'}</dd></div></dl></section> : null}
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
