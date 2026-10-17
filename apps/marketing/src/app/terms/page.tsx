import type { Metadata } from 'next';
import Link from 'next/link';
import { introduction, sections, SectionBody } from './content';
import { MobileToc, SectionHeading, TableOfContents, type TocItem } from './toc';
import './terms.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://domain-name.com';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    "Read Tellann's Terms of Service, including account responsibilities, subscriptions, billing, desktop software, data ownership, security, and acceptable use.",
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service | Tellann',
    description:
      "Read Tellann's Terms of Service, including account responsibilities, subscriptions, billing, desktop software, data ownership, security, and acceptable use.",
    url: `${siteUrl}/terms`,
    type: 'website',
  },
};

const EFFECTIVE_DATE = '[Date of publication]';
const LAST_UPDATED = '[Date of last substantive revision]';
const DOCUMENT_VERSION = '1.0';

const relatedDocuments: { title: string; href: string; description: string }[] = [
  { title: 'Privacy Policy', href: '/privacy', description: 'How Tellann collects, processes, and protects personal information.' },
  { title: 'Cookie Policy', href: '/cookies', description: 'Website cookies, analytics, preferences, and consent.' },
  { title: 'Acceptable Use Policy', href: '/acceptable-use', description: 'Detailed acceptable and prohibited usage.' },
  { title: 'Data Processing Agreement', href: '/dpa', description: 'Customer-controller and Tellann-processor responsibilities.' },
  { title: 'Security Overview', href: '/security', description: 'Security practices, architecture, and responsibilities.' },
  { title: 'Subprocessor List', href: '/subprocessors', description: "Third parties processing data on Tellann's behalf." },
];

const versionHistory: { version: string; date: string; summary: string }[] = [
  { version: '1.0', date: EFFECTIVE_DATE, summary: 'Initial publication draft — pending legal review.' },
];

const tocItems: TocItem[] = [
  { id: 'introduction', label: 'Introduction' },
  ...sections.map((section) => ({ id: section.id, label: `${section.number}. ${section.heading}` })),
  { id: 'related-documents', label: 'Related policies and agreements' },
  { id: 'legal-contact', label: 'Questions about these terms?' },
  { id: 'version-history', label: 'Version history' },
];

export default function TermsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Tellann Terms of Service',
      description: metadata.description,
      url: `${siteUrl}/terms`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Legal', item: `${siteUrl}/terms` },
        { '@type': 'ListItem', position: 3, name: 'Terms of Service', item: `${siteUrl}/terms` },
      ],
    },
  ];

  return (
    <main className="terms-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <header className="terms-header">
        <div className="terms-shell">
          <nav className="terms-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Tellann</Link>
            <span aria-hidden="true">/</span>
            <span>Legal</span>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Terms of Service</span>
          </nav>
          <p className="terms-kicker">Legal</p>
          <h1>Terms of Service</h1>
          <p className="terms-lede">
            These terms govern your use of Tellann&rsquo;s website, cloud platform, desktop software, SDKs, APIs, and related
            services.
          </p>
          <dl className="terms-meta">
            <div>
              <dt>Effective date</dt>
              <dd className="terms-tbd">{EFFECTIVE_DATE}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd className="terms-tbd">{LAST_UPDATED}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{DOCUMENT_VERSION}</dd>
            </div>
          </dl>
          <p className="terms-draft-notice">
            This is a publication draft aligned with Tellann&rsquo;s product specifications. It is not a certification that
            every clause is currently enforceable or that every described capability has shipped. Final publication requires
            confirming Tellann&rsquo;s contracting legal entity, resolving the open policy items noted below, and legal review.
          </p>
          <MobileToc items={tocItems} />
        </div>
      </header>

      <div className="terms-shell terms-layout">
        <aside className="terms-toc-rail">
          <TableOfContents items={tocItems} />
        </aside>

        <article className="terms-article">
          <section aria-labelledby="introduction">
            <h2 id="introduction" className="terms-section-heading">
              <span>Introduction</span>
            </h2>
            <SectionBody blocks={introduction} />
          </section>

          {sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id}>
              <SectionHeading id={section.id} number={section.number} heading={section.heading} />
              <SectionBody blocks={section.blocks} />
            </section>
          ))}

          <p className="terms-end-marker">End of Terms of Service &mdash; Version {DOCUMENT_VERSION}</p>

          <section id="related-documents" className="terms-related">
            <h2>Related policies and agreements</h2>
            <p>
              Our Terms of Service work alongside other policies that explain how we protect information, process customer
              data, and maintain responsible use of the platform.
            </p>
            <div className="terms-related-grid">
              {relatedDocuments.map((doc) => (
                <Link key={doc.href} href={doc.href} className="terms-related-card">
                  <b>{doc.title}</b>
                  <span>{doc.description}</span>
                </Link>
              ))}
            </div>
          </section>

          <section id="legal-contact" className="terms-contact">
            <h2>Questions about these terms?</h2>
            <p>
              If you have questions about your rights, an agreement, or how these terms apply to your organization, our team
              can help direct your enquiry.
            </p>
            <Link href="/contact?reason=legal" className="terms-contact-cta">
              Contact Tellann <span>&rarr;</span>
            </Link>
          </section>

          <section id="version-history" className="terms-version-history">
            <h2>Version history</h2>
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Date</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {versionHistory.map((entry) => (
                  <tr key={entry.version}>
                    <td>{entry.version}</td>
                    <td className="terms-tbd">{entry.date}</td>
                    <td>{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </article>
      </div>
    </main>
  );
}
