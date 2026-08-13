import { CheckCircle2, ShieldCheck } from 'lucide-react';

export default function DesktopAuthorizationCompletePage() {
  return (
    <main className="w-full min-h-screen bg-black text-white grid place-items-center px-4 py-10 font-sans">
      <section className="w-full max-w-md rounded-md border border-[#262626] bg-[#131313] py-5 shadow-2xl space-y-6">
        {/* Header Branding Row */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-5 px-8">
          <span className="text-[22px] font-extrabold tracking-tight text-white font-sans">
            TELLANN
          </span>
          <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
            AUTH // DESKTOP
          </span>
        </div>

        {/* Icon & Message */}
        <div className="text-center space-y-4 pt-2 px-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Desktop Authorized
          </h1>
          <p className="text-sm leading-relaxed text-[#c4c7c8]">
            Return to Tellann Desktop. This browser tab can now be safely closed.
          </p>
        </div>

        {/* Status Box */}
        <div className="rounded-md border border-[#262626] bg-black p-4 mx-8 text-center text-xs font-mono text-[#8e9192]">
          SESSION STATUS // ACTIVE
        </div>

        {/* Security Footer Note */}
        <div className="flex items-center justify-center gap-2 border-t border-[#262626] pt-5 text-xs text-[#8e9192] font-mono">
          {/* <ShieldCheck className="h-4 w-4 text-white shrink-0" /> */}
          <span>Device access remains revocable from Security &amp; Sessions.</span>
        </div>
      </section>
    </main>
  );
}
