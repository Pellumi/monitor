import type { Metadata } from "next";
import Link from "next/link";
import { DesktopPermissionModel } from "@/components/desktop-security-controls";
import { DesktopVisual } from "@/components/desktop-visual";
import "./desktop-security.css";

const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.domain-name.com";

export const metadata: Metadata = {
  title: "Tellann Desktop Security",
  description: "Understand how Tellann Desktop handles local repositories, workspace permissions, privacy, source-code changes, command execution, validation, rollback, and cloud synchronization.",
  alternates: { canonical: "/desktop/security" },
};

const principles = [
  ["Least privilege", "Begin with the smallest capability needed and request more only when a workflow requires it."],
  ["Explicit scope", "Files, commands, and environments stay within a visible approved boundary."],
  ["Local by default", "Workspace analysis happens on the machine; synchronization is a separate decision."],
  ["Observable trust", "Prompts, diffs, validation results, and audit records make the boundary visible."],
] as const;

const faqs = [
  ["Does read access allow Tellann to modify files?", "No. Read, write, and command execution are separate permission classes."],
  ["Does workspace analysis run repository scripts?", "The intended read-only scanner does not execute repository scripts. Any command workflow requires separate approval."],
  ["Does source code ever leave my machine?", "Raw source stays local by default, but an absolute never-transmitted claim would be inaccurate because an explicitly approved support or file-upload scope may allow selected content."],
  ["Can Tellann silently expand an approved task?", "The security model requires renewed approval when file, command, or environment scope changes."],
  ["What happens if validation fails?", "The result should remain visible and rollback should be available for a supported applied-change workflow."],
  ["Can Desktop modify production?", "No. Production environments are observation-only and exclude launch, instrumentation, automated interaction, and submission."],
  ["How do I verify an installer?", "Use the signing and checksum details published with the actual release artifact. Availability must come from the release manifest."],
] as const;

export default function DesktopSecurityPage() {
  return (
    <main className="desksec-page">
      <section className="desksec-hero">
        <div className="desksec-shell desksec-hero-copy">
          <p className="desksec-kicker" data-aos="fade-up">Desktop security</p>
          <h1 data-aos="fade-up" data-aos-delay="60">Your repository is not an unrestricted permission.</h1>
          <p data-aos="fade-up" data-aos-delay="120">See exactly how Tellann Desktop separates local access, workspace analysis, source changes, command execution, privacy filtering, and cloud synchronization.</p>
          <div className="desksec-actions"><a className="desksec-button is-primary" href="#permission-model">Explore the permission model <span>↓</span></a><a className="desksec-button" href={docsUrl}>Read security documentation <span>↗</span></a></div>
        </div>
        <div className="desksec-shell-wide desksec-hero-media" data-aos="tellann-panel"><DesktopVisual id="SEC-D01" label="Desktop trust-boundary diagram" source="1600 × 920" display="1240 × 713" /></div>
      </section>

      <section className="desksec-principles"><div className="desksec-shell">{principles.map(([title, copy], index) => <article key={title}><small>{String(index + 1).padStart(2, "0")}</small><h2>{title}</h2><p data-aos="fade-up" data-aos-delay="120">{copy}</p></article>)}</div></section>

      <section className="desksec-section is-surface" id="permission-model">
        <div className="desksec-shell desksec-head"><p className="desksec-kicker" data-aos="fade-up">Permission model</p><h2 data-aos="fade-up" data-aos-delay="60">Permission is incremental, not inherited.</h2><p data-aos="fade-up" data-aos-delay="120">Browser, read, proposal, write, and command capabilities remain distinct. Refusing a higher permission does not destroy lower-privilege workflows.</p></div>
        <div className="desksec-shell"><DesktopPermissionModel /></div>
      </section>

      <section className="desksec-section">
        <div className="desksec-shell desksec-head"><p className="desksec-kicker" data-aos="fade-up">Read-only workspace analysis</p><h2 data-aos="fade-up" data-aos-delay="60">Inspect context without executing the project.</h2><p data-aos="fade-up" data-aos-delay="120">Analysis can assemble bounded context about Git, frameworks, packages, routes, endpoints, tests, and documentation. It does not turn read permission into script execution.</p></div>
        <div className="desksec-shell-wide desksec-media" data-aos="tellann-panel"><DesktopVisual id="SEC-D03" label="Read-only workspace analysis" source="1440 × 900" display="1180 × 680" /></div>
        <div className="desksec-shell desksec-inspection-grid" data-aos="tellann-panel">{["Git state", "Frameworks", "Package manager", "Routes", "Endpoints", "Tests", "Documentation", "Repository structure"].map(item => <span key={item}>{item}<b>Inspectable</b></span>)}</div>
      </section>

      <section className="desksec-section is-inverted">
        <div className="desksec-shell desksec-two-column"><div><p className="desksec-kicker" data-aos="fade-up">Analysis boundary</p><h2 data-aos="fade-up" data-aos-delay="60">Read analysis does not mean “run everything.”</h2></div><div className="desksec-block-list" data-aos="tellann-panel">{["Does not execute repository scripts", "Does not grant write access", "Does not authorize shell commands", "Does not submit production actions", "Does not silently widen scope", "Does not bypass privacy filters"].map(item => <span key={item}>, {item}</span>)}</div></div>
      </section>

      <section className="desksec-section">
        <div className="desksec-shell desksec-head"><p className="desksec-kicker" data-aos="fade-up">Local ↔ synchronized</p><h2 data-aos="fade-up" data-aos-delay="60">Know what stays on the machine and what may move.</h2><p data-aos="fade-up" data-aos-delay="120">Approved derived information can support shared Tellann intelligence without treating the complete repository as a default cloud payload.</p></div>
        <div className="desksec-shell-wide desksec-media" data-aos="tellann-panel"><DesktopVisual id="SEC-D04" label="Local and synchronized data-boundary diagram" source="1400 × 700" display="1180 × 590" /></div>
        <div className="desksec-shell desksec-boundary-matrix"><article><span>Stays local by default</span>{["Raw repository", "Absolute local paths", "Unapproved files", "Local credentials", "Unapproved command output"].map(x => <p key={x}>, {x}</p>)}</article><article><span>Derived and reviewable</span>{["Framework signals", "Route inventory", "Dependency facts", "QA evidence", "Validation results"].map(x => <p key={x}>○ {x}</p>)}</article><article><span>Explicit approval required</span>{["Selected file content", "Support diagnostics", "Expanded task scope", "Sensitive operation", "Command execution"].map(x => <p key={x}>✓ {x}</p>)}</article></div>
      </section>

      <section className="desksec-section is-surface">
        <div className="desksec-shell desksec-head"><p className="desksec-kicker" data-aos="fade-up">Privacy before transmission</p><h2 data-aos="fade-up" data-aos-delay="60">Filter first. Synchronize second.</h2><p data-aos="fade-up" data-aos-delay="120">Desktop data moves through capture, classification, masking or blocking, approval, then transmission.</p></div>
        <div className="desksec-shell-wide desksec-media" data-aos="tellann-panel"><DesktopVisual id="SEC-D05" label="Privacy filtering pipeline" source="1500 × 480" display="1240 × 397" /></div>
        <div className="desksec-shell desksec-privacy-grid" data-aos="tellann-panel"><article><span>Collect</span>{["Workflow events", "State transitions", "Configured endpoint metadata", "Validation evidence"].map(x => <p key={x}>{x}</p>)}</article><article><span>Mask / pseudonymize</span>{["User identifiers", "Query values", "Form values when allowed", "Diagnostic context"].map(x => <p key={x}>{x}</p>)}</article><article><span>Never collect by default</span>{["Passwords", "Payment credentials", "Authentication tokens", "Secrets and private keys"].map(x => <p key={x}>{x}</p>)}</article></div>
      </section>

      <section className="desksec-section">
        <div className="desksec-shell desksec-head"><p className="desksec-kicker" data-aos="fade-up">Instrumentation · gated capability</p><h2 data-aos="fade-up" data-aos-delay="60">A proposal is not permission to write.</h2><p data-aos="fade-up" data-aos-delay="120">The intended instrumentation lifecycle separates analysis, planning, diff review, approval, application, validation, and rollback.</p></div>
        <div className="desksec-shell desksec-flow" data-aos="tellann-panel">{["Analyze", "Plan", "Review", "Approve", "Apply", "Validate", "Keep / rollback"].map((x,i,a)=><span key={x}><small>{String(i+1).padStart(2,"0")}</small><strong>{x}</strong>{i<a.length-1?<i>→</i>:null}</span>)}</div>
        <div className="desksec-shell desksec-stacked-media"><DesktopVisual id="SEC-D06" label="Bounded instrumentation plan" source="1440 × 900" display="940 × 588" /><DesktopVisual id="SEC-D07" label="Approved diff and file scope" source="1400 × 1000" display="700 × 500" /></div>
      </section>

      <section className="desksec-section is-surface">
        <div className="desksec-shell desksec-split"><div><p className="desksec-kicker" data-aos="fade-up">Command execution</p><h2 data-aos="fade-up" data-aos-delay="60">Show the command. Show the scope. Ask first.</h2><p data-aos="fade-up" data-aos-delay="120">Command permission is separate from repository read and write access. The exact command, working directory, purpose, and expected effect should be visible before approval.</p><div className="desksec-command-rules">{["Explicit command", "Approved working directory", "Bounded environment", "Recorded outcome", "No silent follow-up commands"].map(x=><span key={x}>{x}</span>)}</div></div><DesktopVisual id="SEC-D08" label="Command approval prompt" source="1280 × 800" display="760 × 475" /></div>
      </section>

      <section className="desksec-section">
        <div className="desksec-shell desksec-head"><p className="desksec-kicker" data-aos="fade-up">Validation and rollback</p><h2 data-aos="fade-up" data-aos-delay="60">Verify the result or return to a known state.</h2><p data-aos="fade-up" data-aos-delay="120">Applied changes should be followed by visible syntax, type, SDK, and telemetry checks. A failed supported task retains a rollback path.</p></div>
        <div className="desksec-shell desksec-validation"><DesktopVisual id="SEC-D09" label="Post-change validation screen" source="1440 × 900" display="920 × 575" /><DesktopVisual id="SEC-D10" label="Validation and rollback decision diagram" source="520 × 540" /></div>
      </section>

      <section className="desksec-section is-inverted">
        <div className="desksec-shell desksec-head"><p className="desksec-kicker" data-aos="fade-up">Production safety</p><h2 data-aos="fade-up" data-aos-delay="60">Production is observation-only.</h2><p data-aos="fade-up" data-aos-delay="120">Desktop must not launch, instrument, automate interaction, or submit actions against a production environment.</p></div>
        <div className="desksec-shell desksec-production-policy">{["Observe", "Capture approved evidence", "Apply privacy filtering", "Synchronize permitted artifacts"].map(x=><span key={x}>✓ {x}</span>)}{["Launch", "Instrument", "Automate", "Submit"].map(x=><span key={x}>⊘ {x}</span>)}</div>
        <div className="desksec-shell desksec-media"><DesktopVisual id="SEC-D11" label="Production environment policy UI" source="1280 × 800" display="720 × 450" /></div>
      </section>

      <section className="desksec-section">
        <div className="desksec-shell desksec-split"><div><p className="desksec-kicker" data-aos="fade-up">QA run privacy</p><h2 data-aos="fade-up" data-aos-delay="60">Observe behavior without collecting everything.</h2><p data-aos="fade-up" data-aos-delay="120">Managed browser runs should make capture scope, masked data, excluded fields, and synchronized evidence visible to the operator.</p><Link className="desksec-text-link" href="/security/privacy">Read platform privacy <span>→</span></Link></div><DesktopVisual id="SEC-D12" label="QA run privacy controls" source="1440 × 900" display="980 × 613" /></div>
      </section>

      <section className="desksec-section is-surface">
        <div className="desksec-shell desksec-split is-reverse"><DesktopVisual id="SEC-D13" label="Desktop authentication and device view" source="1100 × 700" display="580 × 369" /><div><p className="desksec-kicker" data-aos="fade-up">Authentication and device trust</p><h2 data-aos="fade-up" data-aos-delay="60">A local device is still an authenticated client.</h2><p data-aos="fade-up" data-aos-delay="120">Sessions, application access, device state, and revocation should remain visible. Exact credential-store claims require implementation verification before publication.</p></div></div>
        <div className="desksec-shell-wide desksec-encryption" data-aos="tellann-panel"><DesktopVisual id="SEC-D14" label="Encrypted desktop-to-cloud connection diagram" source="1200 × 420" display="1000 × 350" /><p>Transport encryption, tenant scope, authenticated requests, and cloud-side audit form the shared boundary. Exact protocol claims must match deployed configuration.</p></div>
      </section>

      <section className="desksec-section">
        <div className="desksec-shell desksec-two-column"><div><p className="desksec-kicker" data-aos="fade-up">Auditability</p><h2 data-aos="fade-up" data-aos-delay="60">Security-sensitive actions should leave evidence.</h2><p data-aos="fade-up" data-aos-delay="120">Permission grants, denied requests, changed scope, commands, validation, synchronization, and device revocation belong in a reviewable timeline.</p></div><ol className="desksec-audit">{["Project attached in browser-only mode", "Read workspace requested", "Workspace analysis completed", "Write permission declined", "QA run completed", "Approved artifacts synchronized"].map((x,i)=><li key={x}><small>Event {String(i+1).padStart(2,"0")}</small><strong>{x}</strong></li>)}</ol></div>
      </section>

      <section className="desksec-section is-surface">
        <div className="desksec-shell desksec-split"><div><p className="desksec-kicker" data-aos="fade-up">Installer and update integrity</p><h2 data-aos="fade-up" data-aos-delay="60">Verify the software before giving it access.</h2><p data-aos="fade-up" data-aos-delay="120">Published releases should expose verifiable artifact identity, signing status, checksum, version, and provenance. The page does not claim those are available until the release manifest proves them.</p><Link className="desksec-text-link" href="/desktop/releases">View Desktop releases <span>→</span></Link></div><DesktopVisual id="SEC-D15" label="Installer verification and artifact integrity" source="1200 × 760" display="720 × 456" /></div>
      </section>

      <section className="desksec-section"><div className="desksec-shell desksec-head"><p className="desksec-kicker" data-aos="fade-up">Control summary</p><h2 data-aos="fade-up" data-aos-delay="60">The boundary, at a glance.</h2><p data-aos="fade-up" data-aos-delay="120">Security does not depend on color or vague trust language.</p></div><div className="desksec-shell desksec-control-grid" data-aos="tellann-panel">{["✓ Read and write are distinct", "✓ Initial attachment can remain browser-only", "✓ Scanning does not authorize commands", "✓ Scope changes require new approval", "✓ Privacy filtering precedes transmission", "✓ Production remains observation-only", "○ Instrumentation must be explicitly enabled", "○ Installer facts come from release evidence"].map(x=><span key={x}>{x}</span>)}</div></section>

      <section className="desksec-section is-surface"><div className="desksec-shell desksec-faq"><div><p className="desksec-kicker" data-aos="fade-up">Desktop security FAQ</p><h2 data-aos="fade-up" data-aos-delay="60">Specific questions. Specific boundaries.</h2></div><div>{faqs.map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></div></section>

      <section className="desksec-resources"><div className="desksec-shell"><div><p className="desksec-kicker" data-aos="fade-up">Security resources</p><h2 data-aos="fade-up" data-aos-delay="60">Go deeper into the model.</h2></div><nav aria-label="Desktop security resources"><Link href="/desktop">Desktop overview <span>→</span></Link><Link href="/desktop/requirements">System requirements <span>→</span></Link><Link href="/security">Platform security <span>→</span></Link><a href={docsUrl}>Security documentation <span>↗</span></a></nav></div></section>

      <section className="desksec-final"><div className="desksec-shell"><p className="desksec-kicker" data-aos="fade-up">Tellann Desktop</p><h2 data-aos="fade-up" data-aos-delay="60">Start with the smallest permission you need.</h2><div className="desksec-actions"><Link className="desksec-button is-primary" href="/desktop/download">Download Tellann Desktop <span>→</span></Link><Link className="desksec-button" href="/desktop">Explore Desktop <span>→</span></Link></div></div><div className="desksec-final-crop"><DesktopVisual id="SEC-D16" label="Desktop permission prompt crop" source="1400 × 900" display="900 × 579" /></div></section>
    </main>
  );
}
