import type { Metadata } from "next";
import { ServiceIllustration, ServicePageShell } from "@/components/service/service-page-shell";

export const metadata: Metadata = { title: "Access Restricted", robots: { index: false, follow: false } };

export default function ForbiddenPage() {
  return <ServicePageShell code={403} label="ACCESS_RESTRICTED" title="You don't have access to this resource." description="Your account may be signed in, but its current permissions do not allow access to this page. Contact your organization administrator when access is expected." actions={[{ label: "Back to home", href: "/", primary: true }, { label: "Request access", href: "/contact?reason=access" }]}><ServiceIllustration label="User → blocked transition → restricted resource design" dimensions="760 × 320" /></ServicePageShell>;
}
