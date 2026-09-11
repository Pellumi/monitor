/**
 * Single source of truth for every public route on the marketing site.
 *
 * A route is either `live` (a real page exists under src/app) or `planned`
 * (the [...slug] catch-all renders a coming-soon stub for it). Planned routes
 * stay in this file deliberately: it is the build checklist for launch.
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

export type RouteStatus = 'live' | 'planned';

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
// Product
// ─────────────────────────────────────────────────────────────

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
      route('/product/flow-declaration', 'Flow declaration', 'Declare how your product should behave.'),
      route('/product/reconciliation', 'Reconciliation', 'Compare declared intent against behavior.'),
      route('/product/graph-drift', 'Graph drift', 'Catch coverage regressions early.'),
      route('/product/automated-instrumentation', 'Automated instrumentation', 'Tellann wires the SDK, you review it.'),
      route('/product/document-flow-inference', 'Document flow inference', 'Turn product documents into flows.'),
      route('/product/guided-qa-runs', 'Guided QA runs', 'Walk through a managed browser session.'),
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
  {
    label: 'Operate',
    routes: [
      route('/product/environments', 'Environments', 'Split development, staging, and production.'),
      route('/product/team-access', 'Team & access', 'Roles, invitations, and permissions.'),
      route('/product/audit-logs', 'Audit logs', 'Track who changed what.'),
      route('/product/notifications', 'Notifications', 'In-app, push, desktop, and email delivery.'),
      route('/product/integrations', 'Integrations & API', 'API tokens and signed webhooks.'),
      route('/product/data-retention', 'Storage & retention', 'What Tellann stores, and for how long.'),
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Solutions & use cases
// ─────────────────────────────────────────────────────────────

export const solutionGroups: RouteGroup[] = [
  {
    label: 'By role',
    routes: [
      route('/solutions', 'Solutions overview', 'Find the right Tellann workflow.'),
      route('/solutions/developers', 'Developers', 'Debug with behavioral context.'),
      route('/solutions/qa-engineers', 'QA engineers', 'See what is covered and what is not.'),
      route('/solutions/engineering-leaders', 'Engineering leaders', 'Review quality and release risk.'),
      route('/solutions/product-teams', 'Product teams', 'Understand the journeys users take.'),
    ],
  },
  {
    label: 'By organization',
    routes: [
      route('/solutions/startups', 'Startups', 'Build QA visibility with a lean team.'),
      route('/solutions/saas', 'SaaS teams', 'Understand behavior across your product.'),
      route('/solutions/enterprise', 'Enterprise', 'Controls, deployment, and governance for large teams.'),
      route('/solutions/agencies', 'Agencies', 'Prove quality across client applications.'),
    ],
  },
  {
    label: 'Use cases',
    // 13 entries would overrun the menu on its own; the rest live on /use-cases.
    limit: 6,
    seeAll: '/use-cases',
    routes: [
      route('/use-cases/workflow-coverage', 'Workflow coverage', 'Measure critical user journeys.'),
      route('/use-cases/find-missing-flows', 'Find missing flows', 'Discover untested paths.'),
      route('/use-cases/find-missing-states', 'Find missing states', 'Reveal absent UI and error states.'),
      route('/use-cases/qa-planning', 'QA planning', 'Plan QA from behavioral evidence.'),
      route('/use-cases/debug-user-workflows', 'Debug workflows', 'Trace problems through user journeys.'),
      route('/use-cases/api-performance-analysis', 'API performance', 'Find slow and error-prone endpoints.'),
      route('/use-cases', 'All use cases', 'Explore problems Tellann helps solve.'),
      route('/use-cases/application-walkthrough', 'Application walkthrough', 'Turn a walkthrough into evidence.'),
      route('/use-cases/regression-detection', 'Detect regressions', 'Catch coverage loss between releases.'),
      route('/use-cases/release-readiness', 'Release readiness', 'Decide whether a release is ready to ship.'),
      route(
        '/use-cases/legacy-application-mapping',
        'Map a legacy application',
        'Understand software nobody documented.',
      ),
      route(
        '/use-cases/documenting-user-journeys',
        'Document user journeys',
        'Turn real behavior into shared documentation.',
      ),
      route('/use-cases/onboarding-engineers', 'Onboard engineers', 'Show new developers how the product actually works.'),
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Developers
// ─────────────────────────────────────────────────────────────

export const developerGroups: RouteGroup[] = [
  {
    label: 'Get started',
    routes: [
      route('/developers', 'Developer hub', 'Integrate Tellann into your stack.'),
      route('/developers/quickstart', 'Quickstart', 'Capture your first demonstration.'),
      live('/desktop/download', 'Download Desktop', 'Get the Tellann desktop application.'),
      route('/developers/sdk', 'SDKs', 'Explore Tellann SDK capabilities.'),
      route('/developers/api', 'API reference', 'Build against the Tellann API.'),
      route('/developers/examples', 'Examples', 'Working integrations you can clone.'),
    ],
  },
  {
    label: 'Frameworks',
    routes: [
      route('/developers/react', 'React', 'Add Tellann to a React application.'),
      route('/developers/nextjs', 'Next.js', 'Add Tellann to a Next.js application.'),
      route('/developers/nodejs', 'Node.js', 'Instrument a Node.js backend.'),
      route('/developers/express', 'Express', 'Instrument an Express service.'),
      route('/developers/fastify', 'Fastify', 'Instrument a Fastify service.'),
      // NOTE: no NestJS adapter ships in packages/backend-sdk yet. Build the
      // adapter or drop this route before launch — do not publish it as-is.
      route('/developers/nestjs', 'NestJS', 'Instrument a NestJS service.'),
    ],
  },
  {
    label: 'Platform',
    routes: [
      route('/developers/events', 'Event reference', 'The events Tellann captures and what they mean.'),
      route('/developers/webhooks', 'Webhooks', 'Receive signed Tellann events in your own systems.'),
      route('/developers/self-hosting', 'Self-hosting', 'Run Tellann inside your own environment.'),
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Desktop
// ─────────────────────────────────────────────────────────────

export const desktopRoutes: SiteRoute[] = [
  live('/desktop', 'Tellann Desktop', "Explore Tellann's local project connection layer."),
  live('/desktop/download', 'Download Tellann Desktop', 'Download the desktop application for a supported computer.'),
  live('/desktop/releases', 'Desktop releases', 'Follow Tellann Desktop versions and release notes.'),
  live(
    '/desktop/security',
    'Desktop security',
    'Understand local repository access, permissions, and installer integrity.',
  ),
  live(
    '/desktop/requirements',
    'Desktop requirements',
    'Review operating system, hardware, and development-tool compatibility.',
  ),
  // Add /desktop/macos and /desktop/linux once those builds actually ship.
  route('/desktop/windows', 'Tellann Desktop for Windows', 'Install and run Tellann Desktop on Windows.'),
  route('/desktop/troubleshooting', 'Desktop troubleshooting', 'Resolve common desktop setup problems.'),
  route('/desktop/updates', 'Desktop updates', 'How Tellann Desktop updates itself.'),
];

// ─────────────────────────────────────────────────────────────
// Resources
// ─────────────────────────────────────────────────────────────

export const resourceGroups: RouteGroup[] = [
  {
    label: 'Learn',
    routes: [
      route('/resources', 'Resource hub', 'Learn about behavioral QA.'),
      route('/blog', 'Blog', 'Ideas and practices from Tellann.'),
      route('/guides', 'Guides', 'Practical quality engineering guides.'),
      route('/research', 'Research', 'Behavioral quality research.'),
      route('/glossary', 'Glossary', 'Terms for software behavior and quality.'),
      route('/faq', 'FAQ', 'Common questions about Tellann.'),
    ],
  },
  {
    label: 'Explore',
    routes: [
      route('/case-studies', 'Case studies', 'See Tellann in practice.'),
      route('/templates', 'Templates', 'Start from practical QA templates.'),
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

/**
 * Evergreen glossary terms. Also kept out of the navigation groups; the
 * /glossary index is their entry point.
 */
export const glossaryRoutes: SiteRoute[] = [
  route('/glossary/behavior-graph', 'Behavior graph', 'What a behavior graph is and how it is built.'),
  route('/glossary/workflow-coverage', 'Workflow coverage', 'Measuring which user journeys were exercised.'),
  route('/glossary/session-replay', 'Session replay', 'Reconstructing a session from telemetry.'),
  route('/glossary/application-state', 'Application state', 'What counts as a state in an application.'),
  route('/glossary/state-transition', 'State transition', 'How an application moves between states.'),
  route('/glossary/user-workflow', 'User workflow', 'A repeatable path a user takes through a product.'),
  route('/glossary/behavioral-testing', 'Behavioral testing', 'Testing against observed behavior.'),
  route('/glossary/qa-coverage', 'QA coverage', 'How QA coverage differs from code coverage.'),
  route('/glossary/declared-flow', 'Declared flow', 'An intended behavior described before it is observed.'),
  route('/glossary/reconciliation', 'Reconciliation', 'Comparing declared intent with observed behavior.'),
  route('/glossary/missing-flow', 'Missing flow', 'A journey that was never demonstrated.'),
  route('/glossary/missing-state', 'Missing state', 'A state the interface needs but never reached.'),
  route('/glossary/graph-drift', 'Graph drift', 'How a behavior graph changes between versions.'),
  route('/glossary/demonstration-mode', 'Demonstration mode', 'Showing an application instead of describing it.'),
  route('/glossary/endpoint-intelligence', 'Endpoint intelligence', 'Understanding endpoint performance and risk.'),
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

export const securityRoutes: SiteRoute[] = [
  live('/security', 'Security', 'How Tellann protects product data.'),
  route('/security/privacy', 'Privacy', 'Privacy controls before transmission.'),
  route('/security/data-collection', 'Data collection', 'What Tellann collects and excludes.'),
  route('/security/session-replay', 'Replay privacy', 'Privacy boundaries for session replay.'),
  route('/security/enterprise', 'Enterprise security', 'Controls for larger organizations.'),
  route('/security/architecture', 'Architecture', 'How Tellann is built and isolated.'),
  route('/security/authentication', 'Authentication', 'MFA, sessions, and sign-in controls.'),
  route('/security/access-control', 'Access control', 'Roles, permissions, and least-privilege access.'),
  route('/security/audit-logging', 'Audit logging', 'An auditable record of workspace activity.'),
  route('/security/responsible-disclosure', 'Responsible disclosure', 'Report a vulnerability to Tellann.'),
  // Publish only once there is something factual to state.
  route('/security/compliance', 'Compliance', 'Certifications and compliance posture.'),
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

export const routeGroups = [productGroups, solutionGroups, developerGroups, resourceGroups];

const dedupe = (routes: SiteRoute[]) =>
  routes.filter((item, index) => routes.findIndex(({ href }) => href === item.href) === index);

/** Every route the site knows about, live and planned. */
export const allRoutes: SiteRoute[] = dedupe([
  ...routeGroups.flatMap((groups) => groups.flatMap((group) => group.routes)),
  ...blogCategoryRoutes,
  ...glossaryRoutes,
  ...companyRoutes,
  ...comparisonRoutes,
  ...securityRoutes,
  ...legalRoutes,
  ...desktopRoutes,
  ...standaloneRoutes,
]);

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

export const isRouteVisible = (item: SiteRoute) => !hidePlannedRoutes || item.status === 'live';

export const visibleRoutes = (routes: SiteRoute[]) => routes.filter(isRouteVisible);

/** Filters a group list to visible routes, dropping groups that end up empty. */
export const visibleGroups = (groups: RouteGroup[]): RouteGroup[] =>
  groups
    .map((group) => ({ ...group, routes: visibleRoutes(group.routes) }))
    .filter((group) => group.routes.length > 0);

export const navProductGroups = visibleGroups(productGroups);
export const navSolutionGroups = visibleGroups(solutionGroups);
export const navDeveloperGroups = visibleGroups(developerGroups);
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
