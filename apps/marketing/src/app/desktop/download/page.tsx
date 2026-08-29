import type { Metadata } from "next";
import Link from "next/link";
import { DesktopDownloadPortal } from "@/components/desktop-download-portal";
import { DesktopVisual } from "@/components/desktop-visual";
import "./desktop-download.css";

export const metadata: Metadata = {
  title: "Download Tellann Desktop",
  description: "Download the latest verified Tellann Desktop release, review supported platforms and system requirements, and verify installer provenance.",
  alternates: { canonical: "/desktop/download" },
};

const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.domain-name.com";
const installerUrl = process.env.NEXT_PUBLIC_DESKTOP_WINDOWS_DOWNLOAD_URL || "#download-unavailable";

const installSteps = [
  ["01", "Download", "Choose the installer published for your operating system and architecture.", "DL-02", "Browser download screen", "1000 × 640", "520 × 333"],
  ["02", "Install", "Open the verified installer and follow the operating-system prompts.", "DL-03", "Windows installer screen", "1000 × 700", "520 × 364"],
  ["03", "Sign in", "Desktop opens your system browser for Tellann authentication and returns to the app.", "DL-04", "Desktop authentication handoff", "900 × 420", "520 × 243"],
  ["04", "Connect project", "Open a folder, clone a repository, attach a staging URL, or begin browser-only.", "DL-05", "Connect project screen", "1440 × 900", "720 × 450"],
] as const;

const requirements = [
  ["Operating system", "Verified versions pending compatibility data"],
  ["Architecture", "Windows x64 release planned first"],
  ["Memory", "Measured requirement pending"],
  ["Disk", "Artifact and installed-size data pending"],
  ["Network", "HTTPS access to Tellann services"],
  ["Development tools", "Project-dependent"],
] as const;

const faqs = [
  ["Which operating systems does Tellann Desktop support?", "Tellann Desktop is Windows-first. The precise supported Windows versions will be published from verified compatibility data."],
  ["How do I know whether I need x64 or ARM64?", "Use the architecture reported in Windows Settings. Only select an architecture when the release portal lists a verified artifact for it."],
  ["Is Tellann Desktop free to download?", "Downloading the application and accessing paid Tellann capabilities are separate decisions. Entitlements depend on your Tellann plan."],
  ["Does installing Desktop give Tellann access to my files?", "No. Installation alone does not grant repository access. Browser, read, write, and command permissions remain separate."],
  ["Do I need the SDK before installing Desktop?", "No. Desktop can begin with browser-only or project-attachment workflows; SDK and instrumentation choices remain explicit."],
  ["Can I use Desktop without a repository?", "Yes. A browser-only workflow can be used without attaching a local repository."],
  ["How do I verify the installer?", "Compare the filename, signature, and complete SHA-256 value against the metadata published with the release artifact."],
  ["What does the tellann:// link do?", "It asks the installed application to continue a short-lived browser-to-Desktop handoff. It must not contain credentials, file paths, or commands."],
  ["Can I install an older release?", "Only releases that remain published and supported should be downloadable. Withdrawn builds must remain unavailable."],
  ["How are updates delivered?", "Update behavior and verification details will be published only after the updater implementation and release policy are verified."],
] as const;

export default async function DesktopDownloadPage({ searchParams }: { searchParams: Promise<{ handoff?: string }> }) {
  const { handoff } = await searchParams;
  const validHandoff = typeof handoff === "string" && /^[A-Za-z0-9_-]{32,256}$/.test(handoff) ? handoff : null;

  return (
    <main className="deskdown-page">
      <section className="deskdown-hero">
        <div className="deskdown-shell deskdown-hero-copy">
          <p className="deskdown-kicker">Tellann Desktop</p>
          <h1>{validHandoff ? "Continue connecting your Tellann project." : "Download Tellann Desktop."}</h1>
          <p>{validHandoff ? "Tellann Desktop is required to continue this local project workflow." : "Install the local Tellann application and connect your development workspace to Tellann."}</p>
        </div>
        <DesktopDownloadPortal installerUrl={installerUrl} handoff={validHandoff} />
        <div className="deskdown-shell deskdown-hero-visual"><DesktopVisual id="DL-01" label="Desktop installer and application launch screen" source="1400 × 900" display="680 × 437" /></div>
      </section>

      <section className="deskdown-section is-surface" id="verify">
        <div className="deskdown-shell deskdown-head"><p className="deskdown-kicker">Artifact integrity</p><h2>Verify before you install.</h2><p>Version, filename, file size, signature, publisher, and SHA-256 must come from the same release manifest as the download URL.</p></div>
        <div className="deskdown-shell deskdown-verification"><div><span>Release artifact</span><h3>Verification data pending</h3><dl><div><dt>Filename</dt><dd>Supplied by release manifest</dd></div><div><dt>Signature</dt><dd>Not yet published</dd></div><div><dt>SHA-256</dt><dd><code>Published with the verified artifact</code></dd></div><div><dt>Artifact state</dt><dd>Unavailable</dd></div></dl><a href={`${docsUrl}/desktop/verify-download`}>Verification instructions <b>↗</b></a></div><DesktopVisual id="DL-08" label="Installer verification diagram" source="1000 × 300" display="820 × 246" /></div>
      </section>

      <section className="deskdown-section">
        <div className="deskdown-shell deskdown-head"><p className="deskdown-kicker">Installation</p><h2>Install in a few steps.</h2><p>Download, install, authenticate in your browser, then choose how to connect the project.</p></div>
        <div className="deskdown-shell deskdown-step-grid">{installSteps.map(([number,title,copy,id,label,source,display])=><article key={id}><header><small>{number}</small><h3>{title}</h3></header><p>{copy}</p><DesktopVisual id={id} label={label} source={source} display={display} /></article>)}</div>
      </section>

      <section className="deskdown-section is-inverted" id="handoff">
        <div className="deskdown-shell deskdown-head"><p className="deskdown-kicker">Browser → Desktop handoff</p><h2>Continue without placing secrets in the link.</h2><p>A valid handoff uses only an opaque, temporary identifier. Desktop validates it after the explicit open action.</p></div>
        <div className="deskdown-shell deskdown-handoff"><DesktopVisual id="DL-06" label="Browser to Desktop handoff diagram" source="1100 × 360" display="900 × 295" /><div><h3>{validHandoff ? "This browser handoff is ready." : "Already have Tellann Desktop?"}</h3><p>{validHandoff ? "Open Desktop to continue. If it does not open, install the verified release and try again." : "Open the installed application, check the release history, or review update guidance."}</p><div className="deskdown-actions"><a className="deskdown-button is-primary" href={validHandoff ? `tellann://connect?handoff=${encodeURIComponent(validHandoff)}` : "tellann://connect"}>Open Tellann Desktop <span>↗</span></a><Link className="deskdown-button" href="/desktop/releases">Check latest release <span>→</span></Link></div></div></div>
      </section>

      <section className="deskdown-section">
        <div className="deskdown-shell deskdown-head"><p className="deskdown-kicker">First launch</p><h2>What happens the first time you open Desktop?</h2><p>Authentication and project selection precede local read access and workspace analysis.</p></div>
        <div className="deskdown-shell deskdown-timeline">{["Install","Sign in","Select application","Attach project","Read-only access","Workspace analysis","Ready"].map((item,index)=><span key={item}><small>{String(index+1).padStart(2,"0")}</small><strong>{item}</strong></span>)}</div>
        <div className="deskdown-shell deskdown-first-launch"><DesktopVisual id="DL-07" label="First launch and sign-in screen" source="1440 × 900" display="760 × 475" /><p>Desktop requests only the next capability needed. Repository scripts are not executed during read-only workspace analysis.</p></div>
      </section>

      <section className="deskdown-section is-surface">
        <div className="deskdown-shell deskdown-head"><p className="deskdown-kicker">Compatibility preview</p><h2>Before you install.</h2><p>Values without verified compatibility or artifact evidence remain visibly pending.</p></div>
        <div className="deskdown-shell deskdown-requirements">{requirements.map(([label,value])=><article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>
        <div className="deskdown-shell"><Link className="deskdown-text-link" href="/desktop/requirements">View full system requirements <span>→</span></Link></div>
      </section>

      <section className="deskdown-section">
        <div className="deskdown-shell deskdown-head"><p className="deskdown-kicker">Release history</p><h2>Previous releases.</h2><p>Only manifest-backed, supported builds will appear here. Withdrawn versions will never expose an active download.</p></div>
        <div className="deskdown-shell deskdown-release-state"><div><small>Latest stable</small><strong>Release manifest pending</strong><span>Windows · Architecture and provenance pending</span></div><div><small>Previous stable</small><strong>No published metadata</strong><span>Release archive awaiting verified artifacts</span></div><Link href="/desktop/releases">View all Desktop releases <span>→</span></Link></div>
      </section>

      <section className="deskdown-section is-surface"><div className="deskdown-shell deskdown-faq"><div><p className="deskdown-kicker">Download FAQ</p><h2>Choose and verify the right build.</h2></div><div>{faqs.map(([question,answer])=><details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></div></section>

      <section className="deskdown-resources"><div className="deskdown-shell"><div><p className="deskdown-kicker">Installation support</p><h2>Need help installing?</h2></div><nav aria-label="Desktop installation resources"><a href={`${docsUrl}/desktop/installation`}>Installation guide <span>↗</span></a><Link href="/desktop/requirements">System requirements <span>→</span></Link><Link href="/desktop/security">Desktop security <span>→</span></Link><Link href="/desktop/releases">Release history <span>→</span></Link><a href={`${docsUrl}/desktop/troubleshooting`}>Troubleshooting <span>↗</span></a></nav></div></section>

      <section className="deskdown-final"><div className="deskdown-shell"><p className="deskdown-kicker">Tellann Desktop</p><h2>Install Tellann Desktop.</h2><p>Connect local development workflows to Tellann from a controlled desktop environment.</p><div className="deskdown-actions"><a className="deskdown-button is-primary" href={installerUrl === "#download-unavailable" ? "#release-unavailable" : installerUrl} aria-disabled={installerUrl === "#download-unavailable"}>Download for Windows <span>→</span></a><Link className="deskdown-button" href="/desktop/requirements">View system requirements <span>→</span></Link></div><small id="release-unavailable">Stable release metadata is not yet published.</small></div><div className="deskdown-final-crop"><DesktopVisual id="DL-09" label="Tellann Desktop launch screen crop" source="1400 × 900" display="840 × 540" /></div></section>
    </main>
  );
}
