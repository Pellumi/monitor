import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allRouteMap, placeholderRouteMap, placeholderRoutes } from "@/config/site-routes";

type PageProps = { params: Promise<{ slug: string[] }> };

function getRoute(slug: string[]) {
  return placeholderRouteMap.get(`/${slug.join("/")}`);
}

export function generateStaticParams() {
  return placeholderRoutes.map(({ href }) => ({
    slug: href.slice(1).split("/"),
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const item = getRoute((await params).slug);
  if (!item) {
    return {
      title: "Page Not Found",
      robots: { index: false, follow: false },
    };
  }
  // Stubs are deliberately kept out of the index: they carry no real content
  // yet, and publishing dozens of near-identical pages would dilute the site.
  // Promoting the route to `live` in site-routes.ts restores indexing.
  return {
    title: item.label,
    description: item.description,
    robots: { index: false, follow: true },
    // Self-referencing, so the stub does not inherit the root layout's
    // canonical and claim to be the homepage.
    alternates: { canonical: item.href },
  };
}

export default async function PlaceholderPage({ params }: PageProps) {
  const item = getRoute((await params).slug);
  if (!item) notFound();

  // Resolved against every known route, not just the stubs, so a planned page
  // can still link back to a parent that is already built.
  const parentHref = item.href.split("/").slice(0, -1).join("/") || "/";
  const parent = allRouteMap.get(parentHref);

  return (
    <main className="placeholder-page">
      <div className="placeholder-orb" aria-hidden="true" />
      <div className="placeholder-content">
        <p className="eyebrow">Tellann · Coming soon</p>
        <h1>{item.label}</h1>
        <p>
          {item.description} This route is connected and ready for its full page
          content.
        </p>
        <div className="placeholder-actions">
          {parent ? (
            <Link href={parent.href}>← {parent.label}</Link>
          ) : (
            <Link href="/">← Back home</Link>
          )}
          <Link href="/product/how-it-works" className="primary-link">
            See how Tellann works
          </Link>
        </div>
        <code>{item.href}</code>
      </div>
    </main>
  );
}
