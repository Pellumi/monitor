import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { placeholderRouteMap, placeholderRoutes } from "@/config/site-routes";

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
  return {
    title: item.label,
    description: item.description,
    alternates: { canonical: item.href },
  };
}

export default async function PlaceholderPage({ params }: PageProps) {
  const item = getRoute((await params).slug);
  if (!item) notFound();

  const parentHref = item.href.split("/").slice(0, -1).join("/") || "/";
  const parent = placeholderRouteMap.get(parentHref);

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
