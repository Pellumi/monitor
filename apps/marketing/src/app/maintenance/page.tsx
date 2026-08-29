import type { Metadata } from "next";
import { RetryAction } from "@/components/service/retry-action";
import { ServiceIllustration, ServicePageShell } from "@/components/service/service-page-shell";

export const metadata: Metadata = { title: "Scheduled Maintenance", robots: { index: false, follow: false } };

export default function MaintenancePage() {
  const statusUrl = process.env.NEXT_PUBLIC_STATUS_URL || "https://status.tellann.co";
  return <ServicePageShell label="MAINTENANCE" title="Tellann is undergoing scheduled maintenance." description="Some services are temporarily unavailable while we perform planned platform maintenance. Verified timing and restoration updates will appear on the status page." retryAction={<RetryAction />} actions={[{ label: "View system status", href: statusUrl, primary: true, external: true }]} status><div><ServiceIllustration label="Client → Tellann / scheduled-maintenance state design" dimensions="760 × 320" /><div className="service-extra"><div className="service-extra-row"><span>Affected services</span><b>See current status</b></div><div className="service-extra-row"><span>Expected restoration</span><b>Not currently published</b></div></div></div></ServicePageShell>;
}
