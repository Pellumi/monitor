import type { Metadata } from 'next';
import Link from 'next/link';
import { introduction, sections, SectionBody } from './content';
import { MobileToc, SectionHeading, TableOfContents, type TocItem } from './toc';
import './privacy.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://domain-name.com';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Learn how Tellann collects, uses, stores, shares, and protects personal information, application telemetry, developer workspace data, and behavioral quality intelligence.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy | Tellann',
    description:
      'Learn how Tellann collects, uses, stores, shares, and protects personal information, application telemetry, developer workspace data, and behavioral quality intelligence.',
    url: `${siteUrl}/privacy`,
    type: 'website',
  },
};

const EFFECTIVE_DATE = '[Approved publication date]';
const LAST_UPDATED = '[Date of most recent substantive revision]';
const DOCUMENT_VERSION = '1.0';
const DATA_CONTROLLER = '[Full registered name of Tellann’s operating legal entity]';

const overviewCards: { title: string; description: string }[] = [
  {
    title: 'What we collect',
    description: 'Account, billing, website, support, telemetry, session, and derived quality-intelligence information across our Services.',
  },
  {
    title: 'How we use it',
    description: 'To operate accounts and subscriptions, reconstruct authorized sessions, generate QA reports, and secure the platform.',
  },
  {
    title: 'Your source code',
    description: 'Analyzed locally by the Desktop Agent by default. Raw source is never uploaded without purpose-specific authorization.',
  },
  {
    title: 'Your privacy rights',
    description: 'Access, correction, deletion, restriction, objection, portability, and consent-withdrawal rights, subject to Applicable Law.',
  },
];

const relatedDocuments: { title: string; href: string; description: string }[] = [
  { title: 'Terms of Service', href: '/terms', description: "Tellann's account, subscription, and acceptable-use agreement." },
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
  { id: 'privacy-contact', label: 'Privacy contact information' },
  { id: 'version-history', label: 'Version history' },
];

export default function PrivacyPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Tellann Privacy Policy',
      description: metadata.description,
      url: `${siteUrl}/privacy`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Legal', item: `${siteUrl}/privacy` },
        { '@type': 'ListItem', position: 3, name: 'Privacy Policy', item: `${siteUrl}/privacy` },
      ],
    },
  ];

  return (
    <main className="privacy-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <header className="privacy-header">
        <div className="privacy-shell">
          <nav className="privacy-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Tellann</Link>
            <span aria-hidden="true">/</span>
            <span>Legal</span>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Privacy Policy</span>
          </nav>
          <p className="privacy-kicker">Legal</p>
          <h1>Privacy Policy</h1>
          <p className="privacy-lede">
            Tellann helps software teams understand application behavior without unnecessarily exposing the people, systems,
            and information behind it. This Privacy Policy explains how we handle information across our website, cloud
            platform, developer tools, SDKs, desktop software, billing systems, and related services, and how you can
            exercise your privacy rights.
          </p>
          <dl className="privacy-meta">
            <div>
              <dt>Effective date</dt>
              <dd className="privacy-tbd">{EFFECTIVE_DATE}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd className="privacy-tbd">{LAST_UPDATED}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{DOCUMENT_VERSION}</dd>
            </div>
            <div>
              <dt>Data controller</dt>
              <dd className="privacy-tbd">{DATA_CONTROLLER}</dd>
            </div>
          </dl>
          <p className="privacy-draft-notice">
            This is a publication draft aligned with Tellann&rsquo;s product specifications. It is not a certification that
            every described control is currently deployed, or that every pre-launch capability has shipped. Final publication
            requires confirming Tellann&rsquo;s contracting legal entity, reconciling the retention schedule, verifying
            deployed privacy controls, and legal review.
          </p>
          <MobileToc items={tocItems} />
        </div>
      </header>

      <section className="privacy-overview">
        <div className="privacy-shell">
          <div className="privacy-overview-grid">
            {overviewCards.map((card) => (
              <div key={card.title} className="privacy-overview-card">
                <b>{card.title}</b>
                <span>{card.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="privacy-shell privacy-layout">
        <aside className="privacy-toc-rail">
          <TableOfContents items={tocItems} />
        </aside>

        <article className="privacy-article">
          <section aria-labelledby="introduction">
            <h2 id="introduction" className="privacy-section-heading">
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

          <p className="privacy-end-marker">End of Privacy Policy &mdash; Version {DOCUMENT_VERSION}</p>

          <section id="related-documents" className="privacy-related">
            <h2>Related policies and agreements</h2>
            <p>
              Our Privacy Policy works alongside other policies that explain how we structure agreements, process customer
              data, and maintain responsible use of the platform.
            </p>
            <div className="privacy-related-grid">
              {relatedDocuments.map((doc) => (
                <Link key={doc.href} href={doc.href} className="privacy-related-card">
                  <b>{doc.title}</b>
                  <span>{doc.description}</span>
                </Link>
              ))}
            </div>
          </section>

          <section id="privacy-contact" className="privacy-contact">
            <h2>Privacy contact information</h2>
            <p>
              If you have questions about this Privacy Policy, want to exercise a privacy right, or want to report a concern,
              our team can help direct your request.
            </p>
            <Link href="/contact?reason=privacy" className="privacy-contact-cta">
              Contact Tellann <span>&rarr;</span>
            </Link>
          </section>

          <section id="version-history" className="privacy-version-history">
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
                    <td className="privacy-tbd">{entry.date}</td>
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
