import type { Metadata } from "next";
import { RetryAction } from "@/components/service/retry-action";
import { ServiceIllustration, ServicePageShell } from "@/components/service/service-page-shell";

export const metadata: Metadata = { title: "Service Temporarily Unavailable", robots: { index: false, follow: false } };

export default function ServiceUnavailablePage() {
  return <ServicePageShell code={503} label="SERVICE_DISRUPTION" title="Tellann is temporarily unavailable." description="We're experiencing a service disruption. Operational updates are available on the Tellann status page." retryAction={<RetryAction />} actions={[{ label: "View status", href: process.env.NEXT_PUBLIC_STATUS_URL || "https://status.tellann.co", primary: true, external: true }]} status><ServiceIllustration label="Client → unavailable Tellann service / outage-state design" dimensions="760 × 320" /></ServicePageShell>;
}
