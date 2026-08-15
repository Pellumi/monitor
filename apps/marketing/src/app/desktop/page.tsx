import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Download Tellann Desktop',
  description: 'Connect a local project securely and automate reviewed Tellann SDK installation on Windows.',
};

const installerUrl = process.env.NEXT_PUBLIC_DESKTOP_WINDOWS_DOWNLOAD_URL ?? '#download-unavailable';

export default async function DesktopDownloadPage({ searchParams }: { searchParams: Promise<{ handoff?: string }> }) {
  const { handoff } = await searchParams;
  const validHandoff = typeof handoff === 'string' && /^[A-Za-z0-9_-]{32,}$/.test(handoff) ? handoff : null;
  const deepLink = validHandoff ? `tellann://connect?handoff=${encodeURIComponent(validHandoff)}` : 'tellann://connect';

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-bold tracking-widest">TELLANN</Link>
        <Link href="/security" className="text-sm text-slate-400 hover:text-white">Desktop security</Link>
      </header>
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.25em] text-emerald-400">Windows desktop</p>
          <h1 className="mt-5 text-5xl font-semibold leading-tight">Connect your codebase without repetitive SDK setup</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Tellann Desktop scans locally, detects supported frontend and backend targets, and shows every proposed file and command before it writes. Source stays on your device; the cloud receives bounded manifests and hashes.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href={installerUrl} className="rounded-md bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300">Download for Windows</a>
            <a href={deepLink} className="rounded-md border border-slate-600 px-5 py-3 text-sm font-semibold hover:border-white">I already installed Tellann</a>
          </div>
          {validHandoff ? <p className="mt-4 text-sm text-emerald-300">Your secure setup handoff is ready. Install Desktop, then choose “I already installed Tellann” to resume.</p> : null}
        </div>
        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-7">
          <h2 className="text-xl font-semibold">What Desktop will do</h2>
          <ol className="mt-6 space-y-5 text-sm leading-6 text-slate-300">
            <li><strong className="text-white">1. Attach and scan locally.</strong><br />Detect package roots, frameworks, entrypoints, Git state, and safe start commands.</li>
            <li><strong className="text-white">2. Ask once before changing anything.</strong><br />Review selected targets, files, dependency commands, validation, and rollback.</li>
            <li><strong className="text-white">3. Install and verify.</strong><br />Apply syntax-aware changes, install approved SDK packages, start approved processes, and confirm telemetry.</li>
          </ol>
          <div className="mt-7 border-t border-slate-800 pt-5 text-xs leading-5 text-slate-500">Windows 10/11 · x64 · Code signing and SHA-256 checksum are displayed beside production release artifacts. macOS and Linux are not yet supported.</div>
        </aside>
      </section>
    </main>
  );
}
