import Image from "next/image";
import Link from "next/link";
import { logoIconText, logoIconTextBlack } from "@/lib/image";
import {
  docsLinks,
  isDocsRoute,
  isRouteVisible,
  navCompanyRoutes,
  navDesktopRoutes,
  navLegalRoutes,
  navProductGroups,
  navResourceGroups,
  navSecurityRoutes,
  navSolutionGroups,
  type SiteRoute,
} from "@/config/site-routes";

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

// Documentation pages open on docs.tellann.co, so they render as external links.
const toFooterLink = (item: SiteRoute): FooterLink => ({
  href: item.href,
  label: item.label,
  external: isDocsRoute(item),
});

// Curated picks. A planned route silently drops out of the footer until its
// page is built, so this list can name routes ahead of time.
const selectRoutes = (routes: SiteRoute[], hrefs: string[]) =>
  hrefs.flatMap((href) => {
    const item = routes.find((route) => route.href === href);
    return item && isRouteVisible(item) ? [toFooterLink(item)] : [];
  });

const allSolutionRoutes = navSolutionGroups.flatMap((group) => group.routes);
const allResourceRoutes = navResourceGroups.flatMap((group) => group.routes);

// Product is by far the longest section, so it gets its own row with one column
// per menu group instead of one tall column that leaves the rest of the footer
// empty beside it.
const productColumns: FooterGroup[] = navProductGroups.map((group) => ({
  title: group.label,
  links: group.routes.map(toFooterLink),
}));

// The second row shares the product row's column grid, so every edge lines up.
const siteColumns: FooterGroup[] = [
  {
    title: "Solutions",
    links: selectRoutes(allSolutionRoutes, [
      "/solutions/developers",
      "/solutions/qa-engineers",
      "/solutions/engineering-leaders",
      "/solutions/product-teams",
    ]),
  },
  {
    title: "Developers",
    links: [
      toFooterLink(docsLinks.home),
      toFooterLink(docsLinks.quickstart),
      ...selectRoutes(navDesktopRoutes, ["/desktop/download"]).map((link) => ({
        ...link,
        label: "Download Desktop",
      })),
      { label: "System status", href: statusUrl, external: true },
    ],
  },
  {
    title: "Resources",
    links: selectRoutes(allResourceRoutes, ["/blog", "/case-studies", "/changelog", "/roadmap"]),
  },
  {
    title: "Company",
    links: [
      ...selectRoutes(navCompanyRoutes, ["/company", "/careers", "/contact", "/brand"]),
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Trust",
    links: [
      ...selectRoutes(navSecurityRoutes, ["/security", "/security/enterprise"]),
      ...selectRoutes(navDesktopRoutes, ["/desktop/security"]),
      ...[docsLinks.privacy, docsLinks.dataCollection, docsLinks.replayPrivacy].map(toFooterLink),
    ],
  },
];

// Policies live in the bottom bar, where visitors look for them.
const legalLinks = selectRoutes(navLegalRoutes, [
  "/terms",
  "/privacy",
  "/cookies",
  "/dpa",
  "/subprocessors",
  "/acceptable-use",
]);

// A column whose routes are all still planned is dropped rather than rendered
// as an empty heading.
const nonEmpty = (groups: FooterGroup[]) => groups.filter((group) => group.links.length > 0);

const visibleProductColumns = nonEmpty(productColumns);
const visibleSiteColumns = nonEmpty(siteColumns);

// Mobile collapses Product back into one section, labelled by group.
const mobileGroups: FooterGroup[] = [
  {
    title: "Product",
    links: visibleProductColumns.flatMap((column) =>
      column.links.map((link, index) => ({
        ...link,
        sublabel: index === 0 ? column.title : undefined,
      })),
    ),
  },
  ...visibleSiteColumns,
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

        <nav
          className="footer-tier footer-tier-product footer-nav-desktop"
          aria-label="Footer product"
        >
          <p className="footer-tier-label">Product</p>
          {visibleProductColumns.map((group) => (
            <FooterColumn key={group.title} group={group} />
          ))}
        </nav>

        <nav
          className="footer-tier footer-tier-site footer-nav-desktop"
          aria-label="Footer"
        >
          {visibleSiteColumns.map((group) => (
            <FooterColumn key={group.title} group={group} />
          ))}
        </nav>

        <nav className="footer-nav-mobile" aria-label="Footer">
          {mobileGroups.map((group) => (
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
        <div aria-label="Legal">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
