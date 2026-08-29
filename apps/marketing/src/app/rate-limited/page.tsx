import type { Metadata } from "next";
import { RetryAction } from "@/components/service/retry-action";
import { ServiceIllustration, ServicePageShell } from "@/components/service/service-page-shell";

export const metadata: Metadata = { title: "Request Temporarily Limited", robots: { index: false, follow: false } };

export default function RateLimitedPage() {
  return <ServicePageShell code={429} label="RATE_LIMITED" title="Too many requests." description="This request has been temporarily limited. Wait a moment and try again. If the server provides a retry time, the active product surface should display that verified value." retryAction={<RetryAction />} actions={[{ label: "Back to home", href: "/" }]}><ServiceIllustration label="Repeated requests → rate limit / throttled-state design" dimensions="760 × 320" /></ServicePageShell>;
}
