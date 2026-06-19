import type { Metadata } from 'next';
import Link from 'next/link';
import { docs, getDoc } from '@/lib/docs';
import { notFound } from 'next/navigation';

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
  const doc = getDoc(slug.join('/'));
  if (!doc) notFound();

  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[270px_1fr] lg:px-10">
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-lg border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-950">Documentation</div>
          <nav className="mt-4 grid gap-1 text-sm text-slate-600">
            {docs.map((item) => (
              <Link
                key={item.slug}
                href={`/${item.slug}`}
                className={`rounded-md px-2 py-1.5 hover:bg-slate-50 hover:text-slate-950 ${item.slug === doc.slug ? 'bg-blue-50 font-semibold text-blue-700' : ''}`}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <article className="min-w-0">
        <Link href="/" className="text-sm font-semibold text-blue-700">Back to docs home</Link>
        <div className="mt-8 border-b border-slate-200 pb-8">
          <div className="text-sm font-semibold text-blue-700">{doc.audience}</div>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-slate-950">{doc.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{doc.description}</p>
        </div>

        <div className="mt-10 space-y-10">
          {doc.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
              <p className="mt-4 text-base leading-8 text-slate-600">{section.body}</p>
              {section.bullets && (
                <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
              {section.code && (
                <pre className="mt-5 rounded-lg bg-slate-950 p-5 text-sm leading-6 text-slate-100">
                  <code>{section.code}</code>
                </pre>
              )}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
