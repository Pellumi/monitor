import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { docs, getDoc } from '@/lib/docs';
import { Sidebar } from '@/components/side-bar';
import { CodeBlock } from '@/components/code-block';
import { EndpointBlock } from '@/components/endpoint-block';
import { TryItPanel } from '@/components/try-it-panel';
import { NavigationButtons } from '@/components/navigation-buttons';

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

export async function generateStaticParams() {
  return docs.map((doc) => ({ slug: doc.slug.split('/') }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug.join('/'));
  if (!doc) return {};

  return {
    title: doc.title,
    description: doc.description,
    alternates: {
      canonical: `/${doc.slug}`,
    },
  };
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const currentSlug = slug.join('/');
  const doc = getDoc(currentSlug);
  if (!doc) notFound();

  // Find adjacent documents for navigation buttons
  const currentIndex = docs.findIndex((item) => item.slug === doc.slug);
  const previousDoc = currentIndex > 0 ? docs[currentIndex - 1] : null;
  const nextDoc = currentIndex < docs.length - 1 ? docs[currentIndex + 1] : null;

  // Extract table of contents headings
  const tocItems = doc.sections.map((section) => ({
    label: section.title,
    href: `#${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  }));

  return (
    <div className="flex w-full h-[calc(100vh-4rem)] overflow-hidden">
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Workspace */}
      <main className="flex-1 min-w-0 bg-background transition-colors duration-200 overflow-hidden">
        <div className="flex gap-10 h-full">
          <article className="flex-1 min-w-0 overflow-y-auto h-full pl-6 pr-6 sm:pl-12 sm:pr-8 py-8 scroll-smooth">
            {/* Breadcrumb section header */}
            <div className="mb-8">
              <span className="inline-block text-[9px] font-bold text-blue-400 uppercase tracking-widest bg-blue-600/10 px-2.5 py-0.5 rounded border border-blue-500/20 mb-2">
                {doc.category}
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                {doc.title}
              </h1>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                {doc.description}
              </p>
            </div>

            {/* Document Content Sections */}
            <div className="space-y-10 border-t border-border pt-8">
              {doc.sections.map((section) => {
                const sectionId = section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                return (
                  <section key={section.title} id={sectionId} className="scroll-mt-20">
                    <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
                      {section.title}
                    </h2>
                    <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                      {section.body}
                    </p>

                    {/* Bullet Points */}
                    {section.bullets && (
                      <ul className="mt-4 list-disc pl-5 space-y-2 text-xs sm:text-sm text-muted-foreground">
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="leading-relaxed">
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* API Method and Path Badge */}
                    {section.endpoint && (
                      <EndpointBlock method={section.endpoint.method} path={section.endpoint.path} />
                    )}

                    {/* Try It Out Interactive Playground */}
                    {section.tryIt && section.endpoint && (
                      <TryItPanel
                        method={section.endpoint.method}
                        path={section.endpoint.path}
                        pathParams={section.tryIt.pathParams}
                        defaultBody={section.tryIt.defaultBody}
                      />
                    )}

                    {/* Code Highlight Block */}
                    {section.code && (
                      <CodeBlock
                        code={section.code}
                        language={section.language || 'typescript'}
                        title={section.title}
                      />
                    )}
                  </section>
                );
              })}
            </div>

            {/* Bottom Traversal select items */}
            <NavigationButtons
              previousLabel={previousDoc?.title}
              previousHref={previousDoc ? `/${previousDoc.slug}` : undefined}
              nextLabel={nextDoc?.title}
              nextHref={nextDoc ? `/${nextDoc.slug}` : undefined}
            />
          </article>

          {/* Right Sidebar: Table of Contents */}
          {tocItems.length > 0 && (
            <aside className="w-72 hidden xl:block shrink-0 overflow-y-auto h-full py-8 pr-12">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
                On this page
              </h3>
              <nav className="space-y-3">
                {tocItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors block border-l border-transparent hover:border-primary pl-4 -ml-4"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
