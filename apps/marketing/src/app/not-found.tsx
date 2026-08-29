import type { Metadata } from "next";
import { ServiceIllustration, ServicePageShell } from "@/components/service/service-page-shell";

export const metadata: Metadata = { title: "Page Not Found", robots: { index: false, follow: false } };

export default function NotFound() {
  return <ServicePageShell code={404} label="ROUTE_NOT_FOUND" title="This path doesn't exist." description="The page may have moved, the address may be incorrect, or the route no longer exists." actions={[{ label: "Back to home", href: "/", primary: true }, { label: "Explore Tellann", href: "/product" }]} helpfulLinks><ServiceIllustration label="Known path → missing route / Behavior Graph design" dimensions="760 × 320" /></ServicePageShell>;
}
