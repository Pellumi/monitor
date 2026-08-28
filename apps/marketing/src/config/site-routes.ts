export type SiteRoute = {
  href: string;
  label: string;
  description: string;
};

export type RouteGroup = {
  label: string;
  routes: SiteRoute[];
};

const route = (href: string, label: string, description: string): SiteRoute => ({
  href,
  label,
  description,
});

export const productGroups: RouteGroup[] = [
  {
    label: 'Platform',
    routes: [
      route('/product', 'Product overview', 'Explore the Tellann platform.'),
      route('/product/how-it-works', 'How it works', 'From SDK setup to quality evidence.'),
      route('/product/demonstration-mode', 'Demonstration mode', 'Show Tellann how your product works.'),
    ],
  },
  {
    label: 'Understand behavior',
    routes: [
      route('/product/behavior-graphs', 'Behavior graphs', 'See states, actions, and transitions.'),
      route('/product/workflow-discovery', 'Workflow discovery', 'Turn interactions into workflows.'),
      route('/product/session-replay', 'Session replay', 'Reconstruct behavior from telemetry.'),
    ],
  },
  {
    label: 'Analyze quality',
    routes: [
      route('/product/coverage', 'Coverage', 'Measure demonstrated behavior.'),
      route('/product/missing-flows', 'Missing flows', 'Find scenarios that were not observed.'),
      route('/product/missing-states', 'Missing states', 'Reveal unhandled product states.'),
      route('/product/endpoint-intelligence', 'Endpoint intelligence', 'Understand endpoint performance and risk.'),
    ],
  },
  {
    label: 'Communicate',
    routes: [route('/product/qa-reports', 'QA reports', 'Share quality findings with your team.')],
  },
];

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
    ],
  },
  {
    label: 'Use cases',
    routes: [
      route('/use-cases', 'All use cases', 'Explore problems Tellann helps solve.'),
      route('/use-cases/workflow-coverage', 'Workflow coverage', 'Measure critical user journeys.'),
      route('/use-cases/find-missing-flows', 'Find missing flows', 'Discover untested paths.'),
      route('/use-cases/find-missing-states', 'Find missing states', 'Reveal absent UI and error states.'),
      route('/use-cases/application-walkthrough', 'Application walkthrough', 'Turn a walkthrough into evidence.'),
      route('/use-cases/api-performance-analysis', 'API performance', 'Find slow and error-prone endpoints.'),
      route('/use-cases/qa-planning', 'QA planning', 'Plan QA from behavioral evidence.'),
      route('/use-cases/debug-user-workflows', 'Debug workflows', 'Trace problems through user journeys.'),
    ],
  },
];

export const developerGroups: RouteGroup[] = [
  {
    label: 'Get started',
    routes: [
      route('/developers', 'Developer hub', 'Integrate Tellann into your stack.'),
      route('/developers/quickstart', 'Quickstart', 'Capture your first demonstration.'),
      route('/developers/sdk', 'SDKs', 'Explore Tellann SDK capabilities.'),
      route('/developers/api', 'API reference', 'Build against the Tellann API.'),
    ],
  },
  {
    label: 'Frameworks',
    routes: [
      route('/developers/react', 'React', 'Add Tellann to a React application.'),
      route('/developers/nextjs', 'Next.js', 'Add Tellann to a Next.js application.'),
      route('/developers/nodejs', 'Node.js', 'Instrument a Node.js backend.'),
      route('/developers/express', 'Express', 'Instrument an Express service.'),
      route('/developers/nestjs', 'NestJS', 'Instrument a NestJS service.'),
    ],
  },
];

export const resourceGroups: RouteGroup[] = [
  {
    label: 'Learn',
    routes: [
      route('/resources', 'Resource hub', 'Learn about behavioral QA.'),
      route('/blog', 'Blog', 'Ideas and practices from Tellann.'),
      route('/guides', 'Guides', 'Practical quality engineering guides.'),
      route('/research', 'Research', 'Behavioral quality research.'),
      route('/glossary', 'Glossary', 'Terms for software behavior and quality.'),
    ],
  },
  {
    label: 'Explore',
    routes: [
      route('/case-studies', 'Case studies', 'See Tellann in practice.'),
      route('/templates', 'Templates', 'Start from practical QA templates.'),
      route('/changelog', 'Changelog', 'Follow product improvements.'),
      route('/roadmap', 'Roadmap', 'See what is now, next, and later.'),
    ],
  },
];

export const companyRoutes: SiteRoute[] = [
  route('/company', 'Company overview', "Why Tellann exists and where we're going."),
  route('/careers', 'Careers', 'Help build the future of software quality.'),
  route('/contact', 'Contact', 'Talk to the Tellann team.'),
  route('/brand', 'Brand', 'Logos, identity, and brand resources.'),
  route('/roadmap', 'Roadmap', "See what we're building next."),
];

export const comparisonRoutes: SiteRoute[] = [
  route('/compare', 'Compare', 'Understand where Tellann fits.'),
  route('/compare/sentry', 'Tellann vs Sentry', 'Behavioral QA and error tracking compared.'),
  route('/compare/posthog', 'Tellann vs PostHog', 'Behavioral QA and product analytics compared.'),
  route('/compare/datadog', 'Tellann vs Datadog', 'Behavioral QA and observability compared.'),
  route('/compare/new-relic', 'Tellann vs New Relic', 'Behavioral QA and observability compared.'),
  route('/compare/replay', 'Tellann vs Replay', 'Behavioral QA and debugging replay compared.'),
];

export const securityRoutes: SiteRoute[] = [
  route('/security', 'Security', 'How Tellann protects product data.'),
  route('/security/privacy', 'Privacy', 'Privacy controls before transmission.'),
  route('/security/data-collection', 'Data collection', 'What Tellann collects and excludes.'),
  route('/security/session-replay', 'Replay privacy', 'Privacy boundaries for session replay.'),
  route('/security/enterprise', 'Enterprise security', 'Controls for larger organizations.'),
];

export const legalRoutes: SiteRoute[] = [
  route('/legal', 'Legal', 'Tellann legal information.'),
  route('/privacy', 'Privacy policy', 'How Tellann handles personal data.'),
  route('/terms', 'Terms', 'Terms for using Tellann.'),
  route('/cookies', 'Cookies', 'How Tellann uses cookies.'),
  route('/dpa', 'DPA', 'Data processing terms.'),
  route('/subprocessors', 'Subprocessors', 'Vendors supporting Tellann.'),
  route('/acceptable-use', 'Acceptable use', 'Rules for responsible use.'),
];

export const routeGroups = [productGroups, solutionGroups, developerGroups, resourceGroups];

export const placeholderRoutes = [
  ...routeGroups.flatMap((groups) => groups.flatMap((group) => group.routes)),
  ...companyRoutes,
  ...comparisonRoutes,
  ...securityRoutes,
  ...legalRoutes,
].filter((item, index, routes) => routes.findIndex(({ href }) => href === item.href) === index);

export const placeholderRouteMap = new Map(placeholderRoutes.map((item) => [item.href, item]));

export const sitemapRoutes = [
  '/',
  ...placeholderRoutes.map(({ href }) => href),
  '/pricing',
].filter((href, index, routes) => routes.indexOf(href) === index);
