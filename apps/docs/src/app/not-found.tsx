import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return <main className="docs-not-found">
    <p className="docs-kicker">Error 404</p>
    <h1>This page is outside the graph.</h1>
    <p>The documentation address may have moved, or the page may not exist. Search the current v1 documentation or return to the task-oriented home.</p>
    <div>
      <Link href="/"><ArrowLeft aria-hidden="true" /> Documentation home</Link>
      <Link href="/overview/what-is-tellann"><Search aria-hidden="true" /> Start with Tellann</Link>
    </div>
  </main>;
}
