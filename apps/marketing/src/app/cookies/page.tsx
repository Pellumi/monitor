import type { Metadata } from 'next';
import Link from 'next/link';
import { introduction, sections, SectionBody } from './content';
import { MobileToc, SectionHeading, TableOfContents, type TocItem } from './toc';
import './cookies.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://domain-name.com';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'Learn how Tellann uses cookies, browser storage, analytics, and similar technologies, and how to manage your privacy preferences.',
  alternates: { canonical: '/cookies' },
  openGraph: {
    title: 'Cookie Policy | Tellann',
    description: 'Learn how Tellann uses cookies, browser storage, analytics, and similar technologies, and how to manage your privacy preferences.',
    url: `${siteUrl}/cookies`,
    type: 'website',
  },
};

const EFFECTIVE_DATE = '[Approved publication date]';
const LAST_UPDATED = '[Date of most recent substantive revision]';
const DOCUMENT_VERSION = '1.0';

const overviewCards: { title: string; description: string }[] = [
  {
    title: 'Strictly necessary',
    description: 'Authentication, security, session continuity, and consent records. Enabled when genuinely necessary to deliver the service.',
  },
  {
    title: 'Functional',
    description: 'Appearance, language, and other interface preferences. Used only where a necessary exception applies, or with consent.',
  },
  {
    title: 'Analytics',
    description: 'Website performance and navigation statistics. Off unless you consent, or a narrow statistical exemption applies.',
  },
  {
    title: 'Marketing',
    description: 'Advertising, attribution, and remarketing technologies. Off until required consent is obtained.',
  },
];

const categoryRows: string[][] = [
  ['Strictly necessary', 'Authentication, security, session continuity, consent records', 'Enabled when genuinely necessary'],
  ['Functional preferences', 'Theme, language, display settings', 'Depends on purpose and applicable exception'],
  ['Analytics', 'Website performance, visitor statistics, navigation patterns', 'Off unless consented or validly exempt'],
  ['Performance & diagnostics', 'Error diagnostics, client performance measurement', 'Classified by actual mechanism and purpose'],
  ['Marketing & advertising', 'Advertising pixels, campaign attribution, remarketing', 'Off until required consent'],
  ['Third-party embedded content', 'Video players, external widgets, interactive embeds', 'Blocked until authorized, where non-essential'],
];

const relatedDocuments: { title: string; href: string; description: string }[] = [
  { title: 'Privacy Policy', href: '/privacy', description: 'How Tellann collects, processes, and protects personal information.' },
  { title: 'Terms of Service', href: '/terms', description: "Tellann's account, subscription, and acceptable-use agreement." },
  { title: 'Acceptable Use Policy', href: '/acceptable-use', description: 'Detailed acceptable and prohibited usage.' },
  { title: 'Data Processing Agreement', href: '/dpa', description: 'Customer-controller and Tellann-processor responsibilities.' },
  { title: 'Security Overview', href: '/security', description: 'Security practices, architecture, and responsibilities.' },
  { title: 'Subprocessor List', href: '/subprocessors', description: "Third parties processing data on Tellann's behalf." },
];

const versionHistory: { version: string; date: string; summary: string }[] = [
  { version: '1.0', date: EFFECTIVE_DATE, summary: 'Initial publication draft — pending legal review and cookie-inventory verification.' },
];

const tocItems: TocItem[] = [
  { id: 'introduction', label: 'Introduction' },
  ...sections.map((section) => ({ id: section.id, label: `${section.number}. ${section.heading}` })),
  { id: 'cookie-inventory', label: 'Current technology inventory' },
  { id: 'related-documents', label: 'Related policies and agreements' },
  { id: 'cookies-contact', label: 'Privacy contact information' },
  { id: 'version-history', label: 'Version history' },
];

export default function CookiesPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Tellann Cookie Policy',
      description: metadata.description,
      url: `${siteUrl}/cookies`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Legal', item: `${siteUrl}/cookies` },
        { '@type': 'ListItem', position: 3, name: 'Cookie Policy', item: `${siteUrl}/cookies` },
      ],
    },
  ];

  return (
    <main className="cookies-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <header className="cookies-header">
        <div className="cookies-shell">
          <nav className="cookies-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Tellann</Link>
            <span aria-hidden="true">/</span>
            <span>Legal</span>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Cookie Policy</span>
          </nav>
          <p className="cookies-kicker">Legal</p>
          <h1>Cookie Policy</h1>
          <p className="cookies-lede">
            We use cookies and similar technologies to operate our services, protect accounts, remember preferences, and,
            where permitted, understand how our website is used. You can learn about these technologies and control
            optional tracking through your browser and the controls described below.
          </p>
          <dl className="cookies-meta">
            <div>
              <dt>Effective date</dt>
              <dd className="cookies-tbd">{EFFECTIVE_DATE}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd className="cookies-tbd">{LAST_UPDATED}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{DOCUMENT_VERSION}</dd>
            </div>
          </dl>
          <p className="cookies-draft-notice">
            This is a publication draft aligned with Tellann&rsquo;s product specifications. It is not a certification that
            every described technology is currently deployed. Final publication requires a verified cookie and
            browser-storage inventory from the running applications, a working consent-management system, and legal
            review.
          </p>
          <MobileToc items={tocItems} />
        </div>
      </header>

      <section className="cookies-overview">
        <div className="cookies-shell">
          <div className="cookies-overview-grid">
            {overviewCards.map((card) => (
              <div key={card.title} className="cookies-overview-card">
                <b>{card.title}</b>
                <span>{card.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cookies-manage" id="manage-preferences" aria-labelledby="manage-preferences-heading">
        <div className="cookies-shell cookies-manage-grid">
          <div>
            <h2 id="manage-preferences-heading">Manage cookie preferences</h2>
            <p>
              Strictly necessary technologies keep Tellann secure and operational and cannot be switched off here. Where
              optional analytics or marketing technologies are deployed, they will not run until you consent, and you will
              be able to change your choice at any time through a cookie preference control connected to our
              consent-management system.
            </p>
            <p className="cookies-manage-note">A connected, functioning preference center has not shipped yet.</p>
          </div>
          <div className="cookies-manage-card">
            <p>Until the preference center ships, you can control cookies and site data directly through your browser.</p>
            <div className="cookies-manage-actions">
              <a className="cookies-manage-link" href="#s19">
                View browser controls
              </a>
              <a className="cookies-manage-link cookies-manage-link--secondary" href="#cookie-inventory">
                View cookie details
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="cookies-categories" aria-labelledby="cookie-categories-heading">
        <div className="cookies-shell">
          <h2 id="cookie-categories-heading">Cookie categories</h2>
          <p>
            This is the classification model we use to describe cookies and similar technologies. It is a recommended
            structure, not a claim that every category below is currently deployed on Tellann&rsquo;s Services.
          </p>
          <table className="cookies-category-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Example purpose</th>
                <th>Recommended default</th>
              </tr>
            </thead>
            <tbody>
              {categoryRows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td key={index}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="cookies-shell cookies-layout">
        <aside className="cookies-toc-rail">
          <TableOfContents items={tocItems} />
        </aside>

        <article className="cookies-article">
          <section aria-labelledby="introduction">
            <h2 id="introduction" className="cookies-section-heading">
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

          <p className="cookies-end-marker">End of Cookie Policy &mdash; Version {DOCUMENT_VERSION}</p>

          <section id="cookie-inventory" className="cookies-inventory" aria-labelledby="cookie-inventory-heading">
            <h2 id="cookie-inventory-heading">Current technology inventory</h2>
            <p>
              A legal document should not display an invented table of cookies and their durations. Tellann has not yet
              published a verified inventory of the cookie names, storage keys, providers, and expiration periods actually
              deployed across its marketing website, dashboard, authentication, billing, documentation, SDK, managed
              browser, and Desktop Agent surfaces.
            </p>
            <p>
              Before this Policy is finalized, that inventory will be generated from the running applications and published
              here, identifying each technology&rsquo;s provider, domain, storage type, purpose, data processed, category,
              expiration, and consent requirement.
            </p>
          </section>

          <section id="related-documents" className="cookies-related">
            <h2>Related policies and agreements</h2>
            <p>
              Our Cookie Policy works alongside other policies that explain how we protect information, process customer
              data, and maintain responsible use of the platform.
            </p>
            <div className="cookies-related-grid">
              {relatedDocuments.map((doc) => (
                <Link key={doc.href} href={doc.href} className="cookies-related-card">
                  <b>{doc.title}</b>
                  <span>{doc.description}</span>
                </Link>
              ))}
            </div>
          </section>

          <section id="cookies-contact" className="cookies-contact">
            <h2>Privacy contact information</h2>
            <p>
              If you have questions about this Cookie Policy or how Tellann uses browser storage and similar technologies,
              our team can help direct your request.
            </p>
            <Link href="/contact?reason=privacy" className="cookies-contact-cta">
              Contact Tellann <span>&rarr;</span>
            </Link>
          </section>

          <section id="version-history" className="cookies-version-history">
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
                    <td className="cookies-tbd">{entry.date}</td>
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
