import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/coming-soon-page";

export const metadata: Metadata = {
  title: "Tellann Desktop System Requirements",
  description: "Review operating system, hardware, architecture, and development-tool compatibility.",
  alternates: { canonical: "/desktop/requirements" },
};

export default function DesktopRequirementsPage() {
  return <ComingSoonPage title="Desktop requirements" description="Review supported operating systems, architectures, hardware, package managers, frameworks, and development tools." route="/desktop/requirements" />;
}
