import Link from 'next/link';
import { ArrowRight, BookOpen, Cpu, Terminal, Shield, RefreshCw, BarChart2 } from 'lucide-react';
import { Sidebar } from '@/components/side-bar';

export default function DocsHome() {
  const cards = [
    {
      title: 'Getting Started',
      description: 'Learn Tellann basics and set up your organization and environment.',
      href: '/getting-started',
      icon: BookOpen,
    },
    {
      title: 'Core Concepts',
      description: 'Understand the mental model of behavior graphs, states, and transitions.',
      href: '/concepts',
      icon: Cpu,
    },
    {
      title: 'Developer Guide',
      description: 'Integrate the frontend and backend SDKs to start sending telemetry.',
      href: '/guides/developer',
      icon: Terminal,
    },
    {
      title: 'Reconciliation Engine',
      description: 'Compare declared behavior against actual telemetry to find gaps.',
      href: '/reconciliation/overview',
      icon: RefreshCw,
    },
    {
      title: 'Session Replay',
      description: 'Reconstruct visual timelines and analyze errors from captured logs.',
      href: '/session-replay/overview',
      icon: BarChart2,
    },
    {
      title: 'Security & Privacy',
      description: 'Understand domain boundaries, tenant isolation, and PII masking.',
      href: '/security-privacy/security',
      icon: Shield,
    },
  ];

  return (
    <div className="flex w-full min-h-[calc(100vh-4rem)]">
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Pane */}
      <main className="flex-1 overflow-y-auto px-6 py-12 sm:px-12 bg-background transition-colors duration-200">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Hero Banner */}
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight mb-4">
              Welcome to <span className="text-blue-400">Tellann</span> Docs
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Understand, model, and validate your software behavior. Learn how to declare behavior graphs,
              instrument telemetry SDKs, and reconcile your release confidence.
            </p>
          </div>

          {/* Guide Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className="p-6 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 hover:border-border/80 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      {card.title}
                      <ArrowRight className="w-3.5 h-3.5 text-blue-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </h3>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {card.description}
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Quickstart Callout */}
          <div className="p-8 rounded-xl bg-muted/40 border border-border">
            <h3 className="text-sm font-bold text-foreground mb-2">
              Behavioral Quality Intelligence
            </h3>
            <p className="text-muted-foreground text-xs leading-relaxed mb-4">
              Need assistance with your integration or environment settings? Explore our tutorials section or check
              troubleshooting guides to resolve API key authorization or telemetry pipeline issues.
            </p>
            <Link
              href="/quick-start"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-semibold"
            >
              <span>Get started in 5 minutes</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
