/**
 * Single source of truth for every public route on the marketing site.
 *
 * A route is `live` (a real page exists under src/app), `planned` (the
 * [...slug] catch-all renders a coming-soon stub for it), or `docs` (the
 * content lives on the documentation site and the navigation links there).
 * Planned routes stay in this file deliberately: it is the build checklist for
 * launch.
 *
 * The marketing site only carries pages that explain the product. Setup,
 * reference, administration, and how-to material belongs to docs.tellann.co:
 * those routes are listed in docs-redirects.json, which next.config.ts turns
 * into permanent redirects and this file turns into navigation links. Routes
 * retired without a page of their own are listed in retired-redirects.json.
 * Never register a redirected route here as `live` or `planned`.
 *
 * `status` controls how search engines see a route, so promoting a page is a
 * one-word change here:
 *   - sitemap     — only live routes are submitted to search engines
 *   - indexing    — stub pages are returned with noindex
 *
 * Navigation is separate: planned routes stay in the header and footer while
 * the site is being built, so the menus show the full intended structure and
 * every link lands on a coming-soon stub. Set NEXT_PUBLIC_HIDE_PLANNED_ROUTES=true
 * at launch to show only finished pages.
 */

import movedToDocs from './docs-redirects.json';

export type RouteStatus = 'live' | 'planned' | 'docs';

export type SiteRoute = {
  href: string;
  label: string;
  description: string;
  status: RouteStatus;
};

export type RouteGroup = {
  label: string;
  routes: SiteRoute[];
  /**
   * Cap on how many routes the mega-menu shows for this group. Declaration
   * order is priority order. The footer and the group's own index page still
   * list everything — the cap only keeps the menu inside one screen.
   */
  limit?: number;
  /** Index page the "See all" link points at when `limit` truncates the group. */
  seeAll?: string;
};

/** A page that exists under src/app today. */
const live = (href: string, label: string, description: string): SiteRoute => ({
  href,
  label,
  description,
  status: 'live',
});

/** A route reserved for launch. Rendered as a stub until its page is built. */
const route = (href: string, label: string, description: string): SiteRoute => ({
  href,
  label,
  description,
  status: 'planned',
});

// ─────────────────────────────────────────────────────────────
// Documentation links
// ─────────────────────────────────────────────────────────────

const docsOrigin = (process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.domain-name.com').replace(/\/$/, '');
const docsDestinations = new Map(movedToDocs.map(({ source, destination }) => [source, destination]));

/**
 * A link to the documentation page that replaced a marketing route. Keyed by
 * the old marketing path so navigation and redirects share one table — an
 * unknown path fails at module load instead of shipping a broken link.
 */
const docs = (movedRoute: string, label: string, description: string): SiteRoute => {
  const destination = docsDestinations.get(movedRoute);
  if (!destination) throw new Error(`${movedRoute} is not listed in docs-redirects.json`);
  return {
    href: destination === '/' ? docsOrigin : `${docsOrigin}${destination}`,
    label,
    description,
    status: 'docs',
  };
};

export const isDocsRoute = (item: SiteRoute) => item.status === 'docs';

/** Documentation destinations used by navigation and in-page links. */
export const docsLinks = {
  home: docs('/developers', 'Documentation', 'Guides, references, and tutorials.'),
  quickstart: docs('/developers/quickstart', 'Quickstart', 'Capture your first demonstration.'),
  sdk: docs('/developers/sdk', 'SDK reference', 'Explore Tellann SDK capabilities.'),
  events: docs('/developers/events', 'Event reference', 'The events Tellann captures.'),
  desktopRequirements: docs('/desktop/requirements', 'Desktop requirements', 'What Tellann Desktop needs to run.'),
  desktopReleases: docs('/desktop/releases', 'Desktop releases', 'Desktop versions and release notes.'),
  privacy: docs('/security/privacy', 'Privacy', 'Privacy controls before transmission.'),
  dataCollection: docs('/security/data-collection', 'Data collection', 'What Tellann collects and excludes.'),
  replayPrivacy: docs('/security/session-replay', 'Replay privacy', 'Privacy boundaries for session replay.'),
} satisfies Record<string, SiteRoute>;

// ─────────────────────────────────────────────────────────────
// Product
// ─────────────────────────────────────────────────────────────

// Workspace administration (environments, team access, audit logs,
// notifications, integrations, retention) is documented rather than sold
// page-by-page — see docs-redirects.json.
export const productGroups: RouteGroup[] = [
  {
    label: 'Platform',
    routes: [
      live('/product', 'Product overview', 'Explore the Tellann platform.'),
      live('/product/how-it-works', 'How it works', 'From SDK setup to quality evidence.'),
      live('/product/demonstration-mode', 'Demonstration mode', 'Show Tellann how your product works.'),
      live('/desktop', 'Desktop app', 'Connect and prepare local projects.'),
      live('/desktop/security', 'Desktop security', 'Local access and permission boundaries.'),
    ],
  },
  {
    label: 'Declare & verify',
    routes: [
      live('/product/flow-declaration', 'Flow declaration', 'Declare how your product should behave.'),
      live('/product/reconciliation', 'Reconciliation', 'Compare declared intent against behavior.'),
      live('/product/graph-drift', 'Graph drift', 'Compare behavior across demonstrations.'),
      live('/product/automated-instrumentation', 'Automated instrumentation', 'Tellann wires the SDK, you review it.'),
      live('/product/document-flow-inference', 'Document flow inference', 'Turn product documents into reviewable flow drafts.'),
      live('/product/guided-qa-runs', 'Guided QA runs', 'Walk through a managed browser session.'),
    ],
  },
  {
    label: 'Understand behavior',
    routes: [
      live('/product/behavior-graphs', 'Behavior graphs', 'See states, actions, and transitions.'),
      live('/product/workflow-discovery', 'Workflow discovery', 'Turn interactions into workflows.'),
      live('/product/session-replay', 'Session replay', 'Reconstruct behavior from telemetry.'),
    ],
  },
  {
    label: 'Analyze & report',
    routes: [
      live('/product/coverage', 'Coverage', 'Measure demonstrated behavior.'),
      live('/product/missing-flows', 'Missing flows', 'Find scenarios never observed.'),
      live('/product/missing-states', 'Missing states', 'Reveal unhandled product states.'),
      live('/product/endpoint-intelligence', 'Endpoint intelligence', 'Endpoint performance and risk.'),
      route('/product/qa-reports', 'QA reports', 'Share quality findings with your team.'),
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Solutions & use cases
// ─────────────────────────────────────────────────────────────

// Solutions explains Tellann per role only. Organization-size and use-case
// pages repeated the Product pages from another angle and were retired — their
// URLs redirect to the closest existing page (retired-redirects.json). Two
// groups keep the menu two columns wide, like Company.
export const solutionGroups: RouteGroup[] = [
  {
    label: 'Build & test',
    routes: [
      route('/solutions', 'Solutions overview', 'Find the right Tellann workflow.'),
      route('/solutions/developers', 'Developers', 'Debug with behavioral context.'),
      route('/solutions/qa-engineers', 'QA engineers', 'See what is covered and what is not.'),
    ],
  },
  {
    label: 'Lead & plan',
    routes: [
      route('/solutions/engineering-leaders', 'Engineering leaders', 'Review quality and release risk.'),
      route('/solutions/product-teams', 'Product teams', 'Understand the journeys users take.'),
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Desktop
// ─────────────────────────────────────────────────────────────

// Installation, requirements, releases, updates, and troubleshooting are
// documented under docs.tellann.co/desktop.
export const desktopRoutes: SiteRoute[] = [
  live('/desktop', 'Tellann Desktop', "Explore Tellann's local project connection layer."),
  live('/desktop/download', 'Download Tellann Desktop', 'Download the desktop application for a supported computer.'),
  live(
    '/desktop/security',
    'Desktop security',
    'Understand local repository access, permissions, and installer integrity.',
  ),
];

// ─────────────────────────────────────────────────────────────
// Resources
// ─────────────────────────────────────────────────────────────

// Developer material has no menu of its own: the header carries a single Docs
// link to docs.tellann.co, which has its own navigation and search.
export const resourceGroups: RouteGroup[] = [
  {
    label: 'Learn',
    routes: [
      route('/resources', 'Resource hub', 'Learn about behavioral QA.'),
      route('/blog', 'Blog', 'Ideas and practices from Tellann.'),
      route('/research', 'Research', 'Behavioral quality research.'),
    ],
  },
  {
    label: 'Explore',
    routes: [
      route('/case-studies', 'Case studies', 'See Tellann in practice.'),
      route('/changelog', 'Changelog', 'Follow product improvements.'),
      live('/roadmap', 'Roadmap', 'See what is now, next, and later.'),
    ],
  },
];

/**
 * Blog category landing pages. Kept out of the navigation groups so the
 * Resources mega-menu stays readable — the /blog index links these directly.
 */
export const blogCategoryRoutes: SiteRoute[] = [
  route('/blog/behavioral-testing', 'Behavioral testing', 'Writing and reasoning about behavioral tests.'),
  route('/blog/software-quality', 'Software quality', 'How teams define and defend quality.'),
  route('/blog/qa-engineering', 'QA engineering', 'Practices from modern QA teams.'),
  route('/blog/session-replay', 'Session replay', 'Debugging with reconstructed behavior.'),
  route('/blog/application-observability', 'Application observability', 'Seeing what software actually does.'),
  route('/blog/testing-strategy', 'Testing strategy', 'Deciding what is worth testing.'),
  route('/blog/release-quality', 'Release quality', 'Shipping with evidence rather than hope.'),
];

// ─────────────────────────────────────────────────────────────
// Company, comparisons, trust, legal
// ─────────────────────────────────────────────────────────────

export const companyRoutes: SiteRoute[] = [
  // NOTE: /about is a permanent redirect to /company (src/app/about/page.tsx),
  // not a page. It is deliberately unregistered so it stays out of the sitemap
  // and navigation — register it here only if it ever becomes a real page.
  live('/company', 'Company overview', "Why Tellann exists and where we're going."),
  live('/careers', 'Careers', 'Help build the future of software quality.'),
  live('/contact', 'Contact', 'Talk to the Tellann team.'),
  live('/brand', 'Brand', 'Logos, identity, and brand resources.'),
  live('/roadmap', 'Roadmap', "See what we're building next."),
  route('/demo', 'Book a demo', 'See Tellann walked through by our team.'),
  route('/press', 'Press', 'Media resources and company news.'),
  route('/partners', 'Partners', 'Build and deliver with Tellann.'),
];

export const comparisonRoutes: SiteRoute[] = [
  route('/compare', 'Compare', 'Understand where Tellann fits.'),
  route('/compare/sentry', 'Tellann vs Sentry', 'Behavioral QA and error tracking compared.'),
  route('/compare/posthog', 'Tellann vs PostHog', 'Behavioral QA and product analytics compared.'),
  route('/compare/datadog', 'Tellann vs Datadog', 'Behavioral QA and observability compared.'),
  route('/compare/new-relic', 'Tellann vs New Relic', 'Behavioral QA and observability compared.'),
  route('/compare/replay', 'Tellann vs Replay', 'Behavioral QA and debugging replay compared.'),
  route('/compare/playwright', 'Tellann vs Playwright', 'Behavioral QA and end-to-end testing compared.'),
  route('/compare/cypress', 'Tellann vs Cypress', 'Behavioral QA and end-to-end testing compared.'),
  route('/compare/logrocket', 'Tellann vs LogRocket', 'Behavioral QA and session recording compared.'),
  route('/compare/fullstory', 'Tellann vs FullStory', 'Behavioral QA and digital experience analytics compared.'),
  route('/compare/mabl', 'Tellann vs mabl', 'Behavioral QA and automated test authoring compared.'),
];

// The detailed privacy, data-collection, authentication, access-control,
// audit, architecture, and compliance material is documented under
// docs.tellann.co/security-privacy. Marketing keeps the buyer-facing overview.
export const securityRoutes: SiteRoute[] = [
  live('/security', 'Security', 'How Tellann protects product data.'),
  route('/security/enterprise', 'Enterprise security', 'Controls for larger organizations.'),
  route('/security/responsible-disclosure', 'Responsible disclosure', 'Report a vulnerability to Tellann.'),
];

export const legalRoutes: SiteRoute[] = [
  route('/legal', 'Legal', 'Tellann legal information.'),
  live('/privacy', 'Privacy policy', 'How Tellann handles personal data.'),
  live('/terms', 'Terms', 'Terms for using Tellann.'),
  route('/cookies', 'Cookies', 'How Tellann uses cookies.'),
  route('/dpa', 'DPA', 'Data processing terms.'),
  route('/subprocessors', 'Subprocessors', 'Vendors supporting Tellann.'),
  route('/acceptable-use', 'Acceptable use', 'Rules for responsible use.'),
  route('/sla', 'Service level agreement', 'Availability and support commitments.'),
  route('/accessibility', 'Accessibility', 'Our accessibility commitment and conformance.'),
];

/** Routes that are not part of a navigation group but still belong to the site. */
export const standaloneRoutes: SiteRoute[] = [
  live('/pricing', 'Pricing', 'Plans for individuals, teams, and organizations.'),
];

// ─────────────────────────────────────────────────────────────
// Derived collections
// ─────────────────────────────────────────────────────────────

export const routeGroups = [productGroups, solutionGroups, resourceGroups];

const dedupe = (routes: SiteRoute[]) =>
  routes.filter((item, index) => routes.findIndex(({ href }) => href === item.href) === index);

/** Every route this site serves, live and planned. Documentation links are excluded. */
export const allRoutes: SiteRoute[] = dedupe([
  ...routeGroups.flatMap((groups) => groups.flatMap((group) => group.routes)),
  ...blogCategoryRoutes,
  ...companyRoutes,
  ...comparisonRoutes,
  ...securityRoutes,
  ...legalRoutes,
  ...desktopRoutes,
  ...standaloneRoutes,
]).filter((item) => !isDocsRoute(item));

export const allRouteMap = new Map(allRoutes.map((item) => [item.href, item]));

export const liveRoutes = allRoutes.filter((item) => item.status === 'live');

/** Routes still to be built. These are the ones the catch-all renders. */
export const plannedRoutes = allRoutes.filter((item) => item.status === 'planned');

/** Rendered by src/app/[...slug]/page.tsx. Live routes have their own page. */
export const placeholderRoutes = plannedRoutes;
export const placeholderRouteMap = new Map(placeholderRoutes.map((item) => [item.href, item]));

/** Only live pages are submitted to search engines. */
export const sitemapRoutes = dedupe([...liveRoutes]).map(({ href }) => href).concat('/').sort();

export function isPlannedRoute(href: string) {
  return allRouteMap.get(href)?.status === 'planned';
}

// ─────────────────────────────────────────────────────────────
// Navigation visibility
// ─────────────────────────────────────────────────────────────

/**
 * Planned routes stay in the navigation by default: while the site is being
 * built, the menus double as the visible checklist of what is still outstanding,
 * and every one of them resolves to a coming-soon stub rather than a 404.
 *
 * Set NEXT_PUBLIC_HIDE_PLANNED_ROUTES=true to drop them from the header and
 * footer — flip this on at launch so visitors only see finished pages. It
 * changes navigation only; stub URLs stay reachable either way.
 */
export const hidePlannedRoutes = process.env.NEXT_PUBLIC_HIDE_PLANNED_ROUTES === 'true';

export const isRouteVisible = (item: SiteRoute) => !hidePlannedRoutes || item.status !== 'planned';

export const visibleRoutes = (routes: SiteRoute[]) => routes.filter(isRouteVisible);

/** Filters a group list to visible routes, dropping groups that end up empty. */
export const visibleGroups = (groups: RouteGroup[]): RouteGroup[] =>
  groups
    .map((group) => ({ ...group, routes: visibleRoutes(group.routes) }))
    .filter((group) => group.routes.length > 0);

export const navProductGroups = visibleGroups(productGroups);
export const navSolutionGroups = visibleGroups(solutionGroups);
export const navResourceGroups = visibleGroups(resourceGroups);
export const navCompanyRoutes = visibleRoutes(companyRoutes);

/** Company splits into two columns so the menu never becomes one tall stack. */
export const companyGroups: RouteGroup[] = [
  {
    label: 'Tellann',
    routes: companyRoutes.filter(({ href }) =>
      ['/company', '/careers', '/press', '/partners'].includes(href),
    ),
  },
  {
    label: 'Connect',
    routes: companyRoutes.filter(({ href }) =>
      ['/contact', '/demo', '/brand', '/roadmap'].includes(href),
    ),
  },
];

export const navCompanyGroups = visibleGroups(companyGroups);
export const navDesktopRoutes = visibleRoutes(desktopRoutes);
export const navSecurityRoutes = visibleRoutes(securityRoutes);
export const navLegalRoutes = visibleRoutes(legalRoutes);

// ─────────────────────────────────────────────────────────────
// Active-link resolution
// ─────────────────────────────────────────────────────────────

// Every known href participates, including planned ones, so a planned child
// route never marks its live parent as the active navigation item.
const knownHrefs = new Set(allRoutes.map(({ href }) => href));

export function isRouteActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === '/' || !pathname.startsWith(`${href}/`)) return false;

  // A more specific navigation route owns the highlight, so /product/how-it-works
  // does not also mark the /product overview link as active.
  for (
    let candidate = pathname;
    candidate.length > href.length;
    candidate = candidate.slice(0, candidate.lastIndexOf('/'))
  ) {
    if (knownHrefs.has(candidate)) return false;
  }

  return true;
}
