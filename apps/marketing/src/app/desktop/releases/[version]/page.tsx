import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/coming-soon-page";

type PageProps = { params: Promise<{ version: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { version } = await params;
  return {
    title: `Tellann Desktop ${version} Release Notes`,
    description: `Release notes for Tellann Desktop ${version}.`,
    robots: { index: false, follow: true },
  };
}

export default async function DesktopReleasePage({ params }: PageProps) {
  const { version } = await params;
  return (
    <ComingSoonPage
      title={`Desktop ${version}`}
      description="This permanent release route will contain verified release notes, compatibility information, and artifacts."
      route={`/desktop/releases/${version}`}
      backHref="/desktop/releases"
      backLabel="Back to Desktop releases"
    />
  );
}
