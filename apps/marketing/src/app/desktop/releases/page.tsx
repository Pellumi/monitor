import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/coming-soon-page";

export const metadata: Metadata = {
  title: "Tellann Desktop Releases",
  description: "Review published Tellann Desktop versions and release notes.",
  alternates: { canonical: "/desktop/releases" },
};

export default function DesktopReleasesPage() {
  return <ComingSoonPage title="Desktop releases" description="Review published versions, improvements, fixes, compatibility notes, and installer provenance." route="/desktop/releases" />;
}
