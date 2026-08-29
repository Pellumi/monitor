import type { Metadata } from "next";
import Link from "next/link";
import { DesktopProjectSequence, DesktopProductGallery } from "@/components/desktop-showcase";
import { DesktopVisual } from "@/components/desktop-visual";
import "./desktop.css";

export const metadata: Metadata = {
  title: "Tellann Desktop",
  description: "Connect local projects, understand the workspace, run guided QA sessions, and keep sensitive development operations under your control.",
  alternates: { canonical: "/desktop" },
};

const capabilities = [
  ["Workspace analysis", "Available", "Detect project structure and prepare reviewable workspace context."],
  ["Guided QA runs", "Available", "Demonstrate workflows in a managed browser and collect evidence."],
  ["Expected vs observed", "Available", "Compare declared behavior with evidence from a run."],
  ["Automatic instrumentation", "Coming later", "A bounded review-and-approval workflow, not unrestricted repository access."],
] as const;

const faqs = [
  ["Why does Tellann need a desktop application?", "Local repositories, development processes, and managed browser runs require a controlled execution boundary on your computer."],
  ["Does Tellann upload my source code?", "Raw source stays local by default. Only approved derived data and artifacts are synchronized with Tellann Cloud."],
  ["Can I use Tellann without the desktop app?", "Yes. Manual SDK integration and browser-based Tellann workflows remain available."],
  ["Can Tellann modify my repository?", "Only a future or enabled instrumentation task can propose changes, and its files and commands must remain within an explicitly approved scope."],
  ["Does Tellann run commands automatically?", "Command execution is a separate permission and must remain bounded to the task the developer approved."],
  ["Can I use Tellann against production?", "Production environments are observation-only. Local launch, instrumentation, automated interaction, and submission are intentionally restricted."],
  ["Which operating systems are supported?", "Tellann Desktop is Windows-first. Check the requirements page for the current verified platform and architecture matrix."],
] as const;

export default function DesktopPage() {
  return (
    <main className="desktop-page">
      <section className="desktop-hero">
        <div className="desktop-shell desktop-hero-copy">
          <p className="desktop-kicker">Tellann Desktop</p>
          <h1>Bring Tellann closer to your code.</h1>
          <p>Connect your local project, understand its structure, run guided QA sessions, and keep sensitive development operations under your control.</p>
          <div className="desktop-actions">
            <Link className="desktop-button is-primary" href="/desktop/download">Download Tellann Desktop <span>→</span></Link>
            <a className="desktop-button" href="#how-desktop-works">See how it works <span>↓</span></a>
          </div>
          <small>Windows-first · Stable release details on the download page</small>
        </div>
        <div className="desktop-shell-wide desktop-hero-media">
          <DesktopVisual id="DSK-01" label="Tellann Desktop product loop / hero poster" source="1600 × 1000" display="1180 × 738" />
        </div>
      </section>

      <section className="desktop-status" aria-label="Desktop product status">
        <div className="desktop-shell">
          {["Windows-first", "Local workspace", "Guided QA runs", "Cloud connected"].map((item, index) => <span key={item}><small>{String(index + 1).padStart(2, "0")}</small><strong>{item}</strong></span>)}
        </div>
      </section>

      <section className="desktop-section" id="how-desktop-works">
        <div className="desktop-shell desktop-split">
          <div className="desktop-copy">
            <p className="desktop-kicker">Why Desktop exists</p>
            <h2>Some parts of software can only be understood where the software lives.</h2>
            <p>A browser cannot safely inspect an arbitrary repository, understand local development context, or perform bounded operations on your machine. Tellann Desktop creates that controlled local boundary.</p>
            <Link className="desktop-text-link" href="/desktop/security">Learn about Desktop security <span>→</span></Link>
          </div>
          <DesktopVisual id="DSK-03" label="Local repository to Tellann Cloud boundary diagram" source="1400 × 900" display="760 × 489" />
        </div>
      </section>

      <section className="desktop-section is-surface">
        <div className="desktop-shell desktop-section-head">
          <p className="desktop-kicker">Connect your project</p>
          <h2>Connect the project you already have.</h2>
          <p>Open a local folder, clone a repository, attach a development or preview URL, or begin in browser-only mode.</p>
        </div>
        <DesktopProjectSequence />
      </section>

      <section className="desktop-section">
        <div className="desktop-shell desktop-split is-reverse">
          <div className="desktop-copy">
            <p className="desktop-kicker">Workspace intelligence</p>
            <h2>Understand the environment before changing it.</h2>
            <p>Tellann can assemble reviewable context about the project without presenting roadmap adapters as already shipped.</p>
            <div className="desktop-detected-list">{["Framework", "Language", "Package manager", "Git state", "Routes", "Endpoints", "Tests", "Documentation"].map(item => <span key={item}>{item}<b>Detected context</b></span>)}</div>
          </div>
          <DesktopVisual id="DSK-06" label="Workspace analysis screenshot" source="1440 × 900" display="1080 × 675" />
        </div>
      </section>

      <section className="desktop-section is-inverted">
        <div className="desktop-shell desktop-section-head">
          <p className="desktop-kicker">Guided QA runs</p>
          <h2>Use the application normally. Keep the evidence.</h2>
          <p>A managed browser run connects the workflow you demonstrate with structured runtime evidence and a reviewable result.</p>
        </div>
        <div className="desktop-shell-wide desktop-media-block">
          <DesktopVisual id="DSK-08" label="Guided QA Run video / poster" source="1920 × 1200" display="1280 × 800" />
          <div className="desktop-media-notes"><span>Expected workflow</span><span>Managed browser</span><span>Live evidence</span><span>Reviewable result</span></div>
        </div>
      </section>

      <section className="desktop-section">
        <div className="desktop-shell desktop-section-head">
          <p className="desktop-kicker">Expected → observed</p>
          <h2>Turn a walkthrough into behavioral evidence.</h2>
          <p>Tellann reconciles the behavior a team expects with states, transitions, failures, and recovery paths actually observed during a run.</p>
        </div>
        <div className="desktop-shell-wide desktop-media-block"><DesktopVisual id="DSK-10" label="Expected versus observed reconciliation diagram" source="1440 × 820" display="1180 × 672" /></div>
      </section>

      <section className="desktop-section is-surface">
        <div className="desktop-shell desktop-section-head">
          <p className="desktop-kicker">Automated instrumentation · Coming later</p>
          <h2>Review before Tellann changes anything.</h2>
          <p>The planned workflow is deliberately bounded: detect, propose, review, approve, apply, validate, then keep or roll back.</p>
        </div>
        <div className="desktop-shell desktop-flow">{["Detect", "Propose", "Review", "Approve", "Apply", "Validate", "Keep / rollback"].map((item, index, items) => <span key={item}><small>{String(index + 1).padStart(2, "0")}</small><strong>{item}</strong>{index < items.length - 1 ? <i>→</i> : null}</span>)}</div>
        <div className="desktop-shell desktop-instrumentation-media">
          <DesktopVisual id="DSK-11" label="Instrumentation plan screenshot" source="1440 × 900" display="1040 × 650" />
          <DesktopVisual id="DSK-12" label="Approved diff detail" source="1200 × 900" display="560 × 420" />
        </div>
      </section>

      <section className="desktop-section">
        <div className="desktop-shell desktop-section-head">
          <p className="desktop-kicker">Hybrid architecture</p>
          <h2>Local execution. Shared intelligence.</h2>
          <p>Your machine owns local execution. Tellann Cloud remains authoritative for shared applications, accepted intent, reports, collaboration, billing, and audit.</p>
        </div>
        <div className="desktop-shell-wide desktop-media-block"><DesktopVisual id="DSK-13" label="Desktop and Tellann Cloud architecture" source="1600 × 900" display="1280 × 720" /></div>
      </section>

      <section className="desktop-section is-surface">
        <div className="desktop-shell desktop-trust">
          <div className="desktop-copy">
            <p className="desktop-kicker">Local trust boundary</p>
            <h2>Your repository is not an unrestricted permission.</h2>
            <p>Reading, modifying, running, and synchronizing remain distinct permissions.</p>
            <Link className="desktop-text-link" href="/desktop/security">Read Desktop security <span>→</span></Link>
          </div>
          <ol className="desktop-permission-ladder">{["Browser only", "Read workspace", "Propose instrumentation", "Apply approved task", "Run approved commands"].map((item, index) => <li key={item}><small>Level {index}</small><strong>{item}</strong></li>)}</ol>
          <div className="desktop-trust-cards">{["Raw source stays local by default", "Read access ≠ write access", "Commands require separate scope", "Production is observation-only", "Changes remain bounded", "Permissions can be revoked"].map(item => <span key={item}>{item}</span>)}</div>
        </div>
      </section>

      <section className="desktop-section">
        <div className="desktop-shell desktop-section-head"><p className="desktop-kicker">Supported ecosystem</p><h2>Built around modern development workflows.</h2><p>Status labels describe the current Desktop relationship without turning the adapter roadmap into false support claims.</p></div>
        <div className="desktop-shell desktop-capabilities">{capabilities.map(([title, status, copy]) => <article key={title}><span>{status}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
        <div className="desktop-shell desktop-platforms"><div><small>Package managers</small><p>npm · pnpm · yarn · bun</p></div><div><small>Windows</small><b>Available</b></div><div><small>macOS</small><b>Coming later</b></div><div><small>Linux</small><b>Coming later</b></div><Link href="/desktop/requirements">View system requirements →</Link></div>
      </section>

      <section className="desktop-section is-surface">
        <div className="desktop-shell desktop-section-head"><p className="desktop-kicker">Product gallery</p><h2>Inside Tellann Desktop.</h2><p>One continuous workspace story—from project context and intent through QA runs and reports.</p></div>
        <DesktopProductGallery />
      </section>

      <section className="desktop-section">
        <div className="desktop-shell desktop-release-card">
          <div><p className="desktop-kicker">Tellann Desktop</p><span>Current stable</span><h2>Release manifest pending</h2><p>Verified version, publication date, platform, artifact size, signing status, and checksum will be supplied by the release pipeline.</p><div className="desktop-actions"><Link className="desktop-button is-primary" href="/desktop/download">Download page <span>→</span></Link><Link className="desktop-button" href="/desktop/releases">Release history <span>→</span></Link></div></div>
          <aside><small>Installer artifact</small><strong>Published with the stable release</strong><span>Signed status</span><span>SHA-256 verification</span><Link href="/desktop/download">Verify download →</Link></aside>
        </div>
      </section>

      <section className="desktop-section is-surface">
        <div className="desktop-shell desktop-faq"><div><p className="desktop-kicker">Desktop FAQ</p><h2>Local work, clear boundaries.</h2></div><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></div>
      </section>

      <section className="desktop-final">
        <div className="desktop-shell"><p className="desktop-kicker">Tellann Desktop</p><h2>Start with the project already on your machine.</h2><div className="desktop-actions"><Link className="desktop-button is-primary" href="/desktop/download">Download Tellann Desktop <span>→</span></Link><Link className="desktop-button" href="/desktop/requirements">View requirements <span>→</span></Link></div><small>Current stable details are published on the download page.</small></div>
        <div className="desktop-final-crop"><DesktopVisual id="DSK-18" label="Tellann Desktop application screenshot" source="1600 × 1000" display="1000 × 625" /></div>
      </section>
    </main>
  );
}
