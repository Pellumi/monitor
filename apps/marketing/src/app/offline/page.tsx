import type { Metadata } from "next";
import { RetryAction } from "@/components/service/retry-action";
import { ServiceIllustration, ServicePageShell } from "@/components/service/service-page-shell";

export const metadata: Metadata = { title: "Offline", robots: { index: false, follow: false } };

export default function OfflinePage() {
  return <ServicePageShell label="CONNECTION_LOST" title="You're offline." description="Tellann can't reach the network right now. Reconnect and retry this page. This does not imply that the Tellann dashboard supports full offline operation." retryAction={<RetryAction />} actions={[{ label: "Back to home", href: "/" }]}><ServiceIllustration label="Client ⇢ connection lost ⇢ Tellann cloud design" dimensions="760 × 320" /></ServicePageShell>;
}
