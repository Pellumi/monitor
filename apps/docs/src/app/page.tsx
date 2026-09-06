import Link from 'next/link';
import { ArrowRight, Blocks, ChartNoAxesCombined, CirclePlay, GitBranch, Radar, Settings2 } from 'lucide-react';
import { Sidebar } from '@/components/side-bar';

const lifecycle = ['Connect', 'Observe', 'Demonstrate', 'Model', 'Analyze', 'Investigate', 'Act'];
const tasks = [
  { title: 'Integrate Tellann', description: 'Install the SDK, configure an environment, and verify telemetry.', href: '/integrations/integration-overview', icon: Blocks },
  { title: 'Run a demonstration', description: 'Capture a guided walkthrough and inspect the resulting behavior.', href: '/demonstration/guided', icon: CirclePlay },
  { title: 'Understand a behavior graph', description: 'Read states, transitions, actions, and workflow boundaries.', href: '/behavior-workflows/behavior-graph-overview', icon: GitBranch },
  { title: 'Investigate a failed session', description: 'Trace events, errors, API activity, and recovery paths.', href: '/sessions-replay/investigating-failures', icon: Radar },
  { title: 'Review coverage and gaps', description: 'Interpret observed paths, missing behavior, and critical gaps.', href: '/coverage-quality/interpreting-coverage', icon: ChartNoAxesCombined },
  { title: 'Operate your workspace', description: 'Manage applications, roles, keys, retention, privacy, and usage.', href: '/workspace-admin/organizations', icon: Settings2 },
];
const personas = [
  ['Developers', 'Integrate Tellann and investigate behavior.', '/integrations/integration-overview'],
  ['QA Engineers', 'Run demonstrations and analyze coverage.', '/demonstration/guided'],
  ['Engineering Managers', 'Understand quality reports and release risk.', '/reports/executive-quality-report'],
  ['Product Teams', 'Understand workflows and user journeys.', '/behavior-workflows/workflow-inventory'],
  ['Administrators', 'Manage teams, security, and billing.', '/workspace-admin/organizations'],
];

export default function DocsHome() {
  return <div className="docs-shell">
    <Sidebar />
    <main className="docs-home">
      <section className="docs-home-hero" aria-labelledby="docs-home-title">
        <div>
          <p className="docs-kicker">Tellann documentation · v1</p>
          <h1 id="docs-home-title">Build confidence from <span>real software behavior.</span></h1>
          <p className="docs-home-lede">Learn how to connect Tellann, capture behavioral evidence, model workflows, measure coverage, investigate failures, and turn findings into clear action.</p>
          <div className="docs-home-actions">
            <Link href="/get-started/quickstart" className="docs-button docs-button-primary">Start in 5 minutes <ArrowRight aria-hidden="true" /></Link>
            <Link href="/overview/how-tellann-works" className="docs-button docs-button-secondary">Explore how Tellann works <ArrowRight aria-hidden="true" /></Link>
          </div>
        </div>
        <div className="docs-lifecycle" aria-label="Tellann lifecycle">
          <p>Behavior intelligence lifecycle</p>
          <ol>{lifecycle.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>)}</ol>
        </div>
      </section>

      <section className="docs-task-section" aria-labelledby="task-heading">
        <header><p className="docs-kicker">Start with a task</p><h2 id="task-heading">Move from question to evidence.</h2><p>Each path leads to a complete workflow, then connects you to the underlying reference.</p></header>
        <div className="docs-task-grid">{tasks.map(({ icon: Icon, ...task }, index) => <Link key={task.href} href={task.href} className="docs-task-card">
          <span className="docs-card-index">{String(index + 1).padStart(2, '0')}</span><Icon aria-hidden="true" /><h3>{task.title}</h3><p>{task.description}</p><span>Open guide <ArrowRight aria-hidden="true" /></span>
        </Link>)}</div>
      </section>

      <section className="docs-personas" aria-labelledby="persona-heading">
        <header><p className="docs-kicker">Documentation for every role</p><h2 id="persona-heading">Enter through the work you own.</h2></header>
        <div>{personas.map(([title, description, href]) => <Link href={href} key={title}><strong>{title}</strong><span>{description}</span><ArrowRight aria-hidden="true" /></Link>)}</div>
      </section>

      <section className="docs-quickstart" aria-labelledby="quickstart-heading">
        <div><p className="docs-kicker">Ready to connect?</p><h2 id="quickstart-heading">From SDK install to verified evidence in five minutes.</h2><p>Use a non-production environment, send one named event, and verify it all the way through the session timeline.</p></div>
        <div><Link href="/get-started/quickstart" className="docs-button docs-button-primary">Open quickstart <ArrowRight aria-hidden="true" /></Link><Link href="/overview/feature-availability">Feature Availability</Link></div>
      </section>
    </main>
  </div>;
}
