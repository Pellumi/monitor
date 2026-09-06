import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Sidebar } from '@/components/side-bar';
import { ArticleRail } from '@/components/article-rail';
import { JsonLd } from '@/components/json-ld';
import { NavigationButtons } from '@/components/navigation-buttons';
import { StatusBadges } from '@/components/status-badge';
import { docsBySlug, docsImporters, docsManifest } from '@/generated/docs-manifest';

type PageProps = { params: Promise<{ slug: string[] }> };
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs.tellann.co').replace(/\/$/, '');

export function generateStaticParams() {
  return docsManifest.map((doc) => ({ slug: doc.slug.split('/') }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = docsBySlug.get(slug.join('/'));
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: '/' + doc.slug },
    robots: doc.status === 'planned' ? { index: true, follow: true } : undefined,
    openGraph: { title: doc.title, description: doc.description, url: siteUrl + '/' + doc.slug, type: 'article' },
  };
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const currentSlug = slug.join('/');
  const doc = docsBySlug.get(currentSlug);
  if (!doc) notFound();
  const importer = docsImporters[doc.id];
  if (!importer) notFound();
  const Content = (await importer()).default;
  const index = docsManifest.findIndex((candidate) => candidate.id === doc.id);
  const previous = index > 0 ? docsManifest[index - 1] : undefined;
  const next = index < docsManifest.length - 1 ? docsManifest[index + 1] : undefined;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: doc.title,
    description: doc.description,
    dateModified: doc.updatedAt,
    isPartOf: { '@type': 'WebSite', name: 'Tellann Documentation', url: siteUrl },
  };
  const breadcrumbs = [
    { name: 'Docs', href: '/' },
    { name: doc.sectionTitle },
    { name: doc.title },
  ];

  return <div className="docs-shell docs-article-shell">
    <Sidebar />
    <main className="docs-article-main">
      <JsonLd id={'docs-structured-data-' + doc.id} value={structuredData} />
      <div className="docs-article-layout">
        <article className="docs-article">
          <nav className="docs-breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((item, crumbIndex) => <span key={item.name}>{crumbIndex ? <ChevronRight aria-hidden="true" /> : null}{item.href ? <Link href={item.href}>{item.name}</Link> : <span>{item.name}</span>}</span>)}
          </nav>
          <header className="docs-article-header">
            <div><p className="docs-kicker">{doc.sectionTitle}</p><StatusBadges status={doc.status} plans={doc.plans} /></div>
            <h1>{doc.title}</h1>
            <p>{doc.description}</p>
            <small>Updated {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(doc.updatedAt))}</small>
          </header>
          <div className="docs-mdx"><Content /></div>
          <NavigationButtons
            previousLabel={previous?.title}
            previousHref={previous ? '/' + previous.slug : undefined}
            nextLabel={next?.title}
            nextHref={next ? '/' + next.slug : undefined}
          />
        </article>
        <ArticleRail page={doc} />
      </div>
    </main>
  </div>;
}
