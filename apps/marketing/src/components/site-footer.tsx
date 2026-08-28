import Image from "next/image";
import Link from "next/link";
import { logoIconText, logoIconTextBlack } from "@/lib/image";
import {
  companyRoutes,
  developerGroups,
  legalRoutes,
  productGroups,
  resourceGroups,
  securityRoutes,
  solutionGroups,
  type SiteRoute,
} from "@/config/site-routes";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";
const docsUrl =
  process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.domain-name.com";
const statusUrl =
  process.env.NEXT_PUBLIC_STATUS_URL || "https://status.tellann.co";

type FooterLink = Pick<SiteRoute, "href" | "label"> & {
  external?: boolean;
  sublabel?: string;
};

type FooterGroup = {
  title: string;
  links: FooterLink[];
};

const selectRoutes = (routes: SiteRoute[], hrefs: string[]) =>
  hrefs.flatMap((href) => {
    const item = routes.find((route) => route.href === href);
    return item ? [{ href: item.href, label: item.label }] : [];
  });

const allSolutionRoutes = solutionGroups.flatMap((group) => group.routes);
const allDeveloperRoutes = developerGroups.flatMap((group) => group.routes);
const allResourceRoutes = resourceGroups.flatMap((group) => group.routes);

const footerNavigation: FooterGroup[] = [
  {
    title: "Product",
    links: productGroups.flatMap((group) =>
      group.routes.map((route, index) => ({
        href: route.href,
        label: route.label,
        sublabel: index === 0 ? group.label : undefined,
      })),
    ),
  },
  {
    title: "Solutions",
    links: [
      ...selectRoutes(allSolutionRoutes, [
        "/solutions/developers",
        "/solutions/qa-engineers",
        "/solutions/engineering-leaders",
        "/solutions/product-teams",
        "/solutions/startups",
        "/solutions/saas",
      ]),
      ...selectRoutes(allSolutionRoutes, [
        "/use-cases/workflow-coverage",
        "/use-cases/find-missing-flows",
        "/use-cases/qa-planning",
      ]).map((route, index) => ({
        ...route,
        sublabel: index === 0 ? "Use cases" : undefined,
      })),
    ],
  },
  {
    title: "Developers",
    links: [
      ...selectRoutes(allDeveloperRoutes, [
        "/developers",
        "/developers/quickstart",
        "/developers/sdk",
        "/developers/api",
        "/developers/react",
        "/developers/nextjs",
        "/developers/nodejs",
      ]),
      { label: "Documentation", href: docsUrl, external: true },
      { label: "System status", href: statusUrl, external: true },
    ],
  },
  {
    title: "Resources",
    links: selectRoutes(allResourceRoutes, [
      "/blog",
      "/guides",
      "/glossary",
      "/changelog",
      "/roadmap",
    ]),
  },
  {
    title: "Company",
    links: [
      ...selectRoutes(companyRoutes, ["/company", "/careers", "/contact", "/brand", "/roadmap"]),
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Trust & legal",
    links: [
      ...selectRoutes(securityRoutes, [
        "/security",
        "/security/privacy",
        "/security/data-collection",
        "/security/session-replay",
        "/security/enterprise",
      ]),
      ...selectRoutes(legalRoutes, [
        "/terms",
        "/privacy",
        "/cookies",
        "/dpa",
        "/subprocessors",
        "/acceptable-use",
      ]).map((route, index) => ({
        ...route,
        sublabel: index === 0 ? "Policies" : undefined,
      })),
    ],
  },
];

function FooterNavLink({ link }: { link: FooterLink }) {
  return (
    <div className="footer-link-row">
      {link.sublabel ? <span>{link.sublabel}</span> : null}
      {link.external ? (
        <a href={link.href} target="_blank" rel="noreferrer">
          {link.label} <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <Link href={link.href}>{link.label}</Link>
      )}
    </div>
  );
}

function FooterColumn({ group }: { group: FooterGroup }) {
  return (
    <div className="footer-column">
      <h2>{group.title}</h2>
      <div>
        {group.links.map((link) => (
          <FooterNavLink key={`${group.title}-${link.href}`} link={link} />
        ))}
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <section className="footer-cta" aria-labelledby="footer-cta-heading">
        <div>
          <p>Ready to understand what your testing missed?</p>
          <h2 id="footer-cta-heading">
            Show Tellann how your application works.
          </h2>
        </div>
        <div className="footer-cta-detail">
          <p>
            Start with a demonstration and turn observed behavior into
            workflows, coverage, missing paths, session replay, endpoint
            intelligence, and QA reports.
          </p>
          <div className="footer-cta-actions">
            <a href={`${appUrl}/auth/login?plan=free`}>
              Start free <span aria-hidden="true">→</span>
            </a>
            <a href={docsUrl} target="_blank" rel="noreferrer">
              View documentation <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      <div className="footer-navigation">
        <div className="footer-brand">
          <Link href="/" className="brand footer-wordmark">
            <Image
              src={logoIconText}
              alt="Tellann"
              width={120}
              className="hidden dark:block h-auto"
              priority
            />
            <Image
              src={logoIconTextBlack}
              alt="Tellann"
              width={120}
              className="block dark:hidden h-auto"
              priority
            />
          </Link>
          <p className="mt-2!">
            Behavioral quality intelligence for software teams. Tellann maps
            application workflows, measures coverage, and reveals what your team
            missed.
          </p>
          <p id="mino" className="w-full!">Behavioral quality intelligence</p>
        </div>

        <nav className="footer-grid footer-nav-desktop" aria-label="Footer">
          {footerNavigation.map((group) => (
            <FooterColumn key={group.title} group={group} />
          ))}
        </nav>

        <nav className="footer-nav-mobile" aria-label="Footer">
          {footerNavigation.map((group) => (
            <details key={group.title}>
              <summary>
                {group.title} <span aria-hidden="true">+</span>
              </summary>
              <div>
                {group.links.map((link) => (
                  <FooterNavLink
                    key={`${group.title}-${link.href}`}
                    link={link}
                  />
                ))}
              </div>
            </details>
          ))}
        </nav>
      </div>
      <Link
        href="/"
        className="footer-mega-wordmark"
        aria-label="Tellann home"
      >
        <Image
          src="/logo_text.svg"
          alt=""
          fill
          sizes="100vw"
          className="footer-mega-wordmark-image footer-mega-wordmark-image-dark"
        />
        <Image
          src="/logo_text_black.svg"
          alt=""
          fill
          sizes="100vw"
          className="footer-mega-wordmark-image footer-mega-wordmark-image-light"
        />
      </Link>

      <div className="footer-bottom">
        <div>
          <span>
            © {new Date().getFullYear()} Tellann. All rights reserved.
          </span>
        </div>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/cookies">Cookies</Link>
        </div>
      </div>
    </footer>
  );
}
