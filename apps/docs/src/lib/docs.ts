export type DocPage = {
  slug: string;
  title: string;
  description: string;
  audience: string;
  sections: Array<{
    title: string;
    body: string;
    bullets?: string[];
    code?: string;
  }>;
};

export const docs: DocPage[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Create an organization, add an application, generate an API key, install the SDK, and run your first behavioral review.',
    audience: 'Everyone',
    sections: [
      {
        title: 'First-time path',
        body: 'A new user starts in the product app, creates the workspace objects needed for telemetry, and then declares the expected behavior of the system.',
        bullets: [
          'Sign in at app.domain-name.com/auth/login.',
          'Create an organization and first application.',
          'Create a development or staging environment.',
          'Generate an environment-scoped API key.',
          'Install the frontend or backend SDK and send SOTS_ONBOARDING_TEST.',
          'Declare the first expected flow and run reconciliation after telemetry arrives.',
        ],
      },
    ],
  },
  {
    slug: 'concepts',
    title: 'Core Concepts',
    description: 'Understand the Declare, Observe, Reconcile, Report loop that drives SOTS.',
    audience: 'Everyone',
    sections: [
      {
        title: 'Declare, observe, reconcile, report',
        body: 'SOTS compares what your product is expected to do with what it actually does during real sessions or automated test runs.',
        bullets: [
          'Declared behavior is the expected product model.',
          'Observed behavior is telemetry from SDK events, sessions, workflows, APIs, and errors.',
          'Reconciliation classifies confirmed paths, true gaps, and undeclared behavior.',
          'Reports turn those findings into release evidence.',
        ],
      },
    ],
  },
  {
    slug: 'qa-guide',
    title: 'QA Workflow',
    description: 'Use SOTS to turn manual and automated test passes into behavioral coverage evidence.',
    audience: 'QA',
    sections: [
      {
        title: 'How QA uses SOTS',
        body: 'QA teams declare important journeys, exercise the application, then inspect reconciliation findings to decide what was covered, missed, or unexpectedly present.',
        bullets: [
          'Declare high-value user journeys before a test pass.',
          'Run manual, exploratory, Cypress, or Playwright coverage.',
          'Review missing states and missing flows.',
          'Promote valid discovered states or file issues for invalid behavior.',
          'Export reports for release signoff.',
        ],
      },
    ],
  },
  {
    slug: 'developer-guide',
    title: 'Developer Guide',
    description: 'Integrate SDKs, correlate frontend and backend sessions, and review implementation behavior.',
    audience: 'Developers',
    sections: [
      {
        title: 'Developer responsibilities',
        body: 'Developers wire SDKs into customer-facing surfaces and backend APIs so SOTS can build a truthful behavioral graph.',
        bullets: [
          'Install frontend SDK in the browser application.',
          'Install backend SDK in API services.',
          'Use Express or Fastify middleware to capture route telemetry.',
          'Track meaningful states and business events where automatic page tracking is not enough.',
          'Review endpoint analysis for latency and error risk.',
        ],
      },
    ],
  },
  {
    slug: 'project-manager-guide',
    title: 'Project Manager Guide',
    description: 'Interpret expected coverage and release reports without reading raw telemetry.',
    audience: 'Project managers',
    sections: [
      {
        title: 'Release readiness',
        body: 'Project managers use SOTS reports to ask better release questions: which journeys were confirmed, which expected paths were missed, and what unexpected behavior appeared.',
        bullets: [
          'Use Expected Coverage as a headline signal.',
          'Review true gaps before release decisions.',
          'Use exports as sprint review and signoff evidence.',
          'Track whether high-risk workflows are covered by real sessions.',
        ],
      },
    ],
  },
  {
    slug: 'admin-guide',
    title: 'Admin Guide',
    description: 'Manage organizations, applications, environments, API keys, users, billing, and audit evidence.',
    audience: 'Admins',
    sections: [
      {
        title: 'Operating the workspace',
        body: 'Admins own the non-primary product layer: identity, access, billing, API key hygiene, and governance.',
        bullets: [
          'Create and manage organizations and applications.',
          'Separate development, staging, and production environments.',
          'Rotate API keys and revoke unused keys.',
          'Assign roles based on responsibility.',
          'Review billing, usage, and audit events.',
        ],
      },
    ],
  },
  {
    slug: 'sdk/frontend',
    title: 'Frontend SDK',
    description: 'Install the browser SDK and send page, state, transition, workflow, and business events.',
    audience: 'Developers',
    sections: [
      {
        title: 'Initialize the SDK',
        body: 'The frontend SDK points to the public API gateway and includes the environment API key generated during onboarding.',
        code: `import { SOTS } from '@sots/frontend-sdk';\n\nSOTS.initialize({\n  endpoint: 'https://api.domain-name.com',\n  apiKey: 'SOTS_API_KEY',\n  applicationId: 'APP_ID',\n  environmentId: 'ENVIRONMENT_ID'\n});\n\nSOTS.trackEvent('SOTS_ONBOARDING_TEST');`,
      },
      {
        title: 'Track product behavior',
        body: 'Use explicit state and business events where page-view tracking alone cannot explain the user journey.',
        code: `SOTS.trackState('CHECKOUT_PAGE');\nSOTS.trackEvent('BUTTON_CLICK', { elementId: 'place-order' });\nSOTS.trackBusinessEvent({\n  type: 'CHECKOUT_START',\n  payload: { cartValue: 149.99 }\n});`,
      },
    ],
  },
  {
    slug: 'sdk/backend',
    title: 'Backend SDK',
    description: 'Install the Node SDK, capture API calls, errors, states, and backend workflows.',
    audience: 'Developers',
    sections: [
      {
        title: 'Initialize backend tracking',
        body: 'The backend SDK can generate collector-compatible session IDs when one is not supplied.',
        code: `import { SOTS, sotsExpressMiddleware } from '@sots/backend-sdk';\n\nSOTS.initialize({\n  endpoint: 'https://api.domain-name.com',\n  apiKey: 'SOTS_API_KEY',\n  applicationId: 'APP_ID',\n  environmentId: 'ENVIRONMENT_ID'\n});\n\napp.use(sotsExpressMiddleware());`,
      },
      {
        title: 'Manual captures',
        body: 'Capture API metrics and backend errors directly when middleware is not enough.',
        code: `await SOTS.trackApi({\n  endpoint: '/api/checkout',\n  method: 'POST',\n  statusCode: 201,\n  durationMs: 382\n});\n\nawait SOTS.captureMessage('Payment provider timeout', 'warning');`,
      },
    ],
  },
  {
    slug: 'api-reference',
    title: 'API Reference',
    description: 'Reference the gateway routes used by SDK ingestion, reports, reconciliation, and endpoint analysis.',
    audience: 'Developers',
    sections: [
      {
        title: 'Gateway routes',
        body: 'Public SDK and dashboard traffic routes through the API gateway. Production deployments can expose it at api.domain-name.com.',
        bullets: [
          'POST /v1/events and /v1/events/batch ingest telemetry.',
          'GET /reports/:applicationId/latest returns the current report snapshot.',
          'GET /reports/:applicationId/export downloads report files.',
          'GET /applications/:id/reconciliation returns reconciliation findings.',
          'GET /applications/:id/reconciliation/export downloads reconciliation JSON or CSV.',
          'GET /endpoints/:applicationId/analysis returns endpoint intelligence.',
        ],
      },
    ],
  },
  {
    slug: 'reconciliation',
    title: 'Reconciliation',
    description: 'Compare declared behavior with observed behavior and classify the difference.',
    audience: 'QA and developers',
    sections: [
      {
        title: 'Finding classes',
        body: 'Reconciliation separates behavior into actionable buckets so teams can decide whether to test, fix, promote, or ignore each finding.',
        bullets: [
          'Confirmed states and transitions were both declared and observed.',
          'True gaps were declared but not observed.',
          'Undeclared states or transitions were observed but not expected.',
          'Expected Coverage summarizes how much declared behavior was confirmed.',
        ],
      },
    ],
  },
  {
    slug: 'reports',
    title: 'Reports',
    description: 'Generate and export release evidence from sessions, workflows, gaps, endpoint analysis, and reconciliation.',
    audience: 'QA and project managers',
    sections: [
      {
        title: 'Report usage',
        body: 'Reports condense the observed behavioral graph and coverage findings into evidence suitable for QA signoff and release review.',
        bullets: [
          'Use latest reports for dashboard review.',
          'Export formats are controlled by entitlement tier.',
          'Attach reports to release notes, sprint reviews, or bug triage.',
        ],
      },
    ],
  },
  {
    slug: 'billing',
    title: 'Billing',
    description: 'Understand plans, subscription status, invoices, checkout, cancellation, and entitlement resolution.',
    audience: 'Admins',
    sections: [
      {
        title: 'Billing model',
        body: 'Billing determines which plan an organization is on, while entitlements determine which features the services allow.',
        bullets: [
          'Plans control app, environment, API key, export, and feature limits.',
          'Checkout and webhooks update subscription and invoice records.',
          'Failed, cancelled, or suspended subscriptions should affect entitlements.',
        ],
      },
    ],
  },
  {
    slug: 'entitlements',
    title: 'Entitlements',
    description: 'Understand how plan features are enforced by services.',
    audience: 'Admins and developers',
    sections: [
      {
        title: 'Feature checks',
        body: 'Services ask whether an organization can access a feature instead of hard-coding plan names.',
        bullets: [
          'Report generation and export.',
          'Session replay.',
          'Endpoint intelligence.',
          'Demonstration mode.',
          'Behavior graph and reconciliation access.',
        ],
      },
    ],
  },
  {
    slug: 'security',
    title: 'Security',
    description: 'Learn the MVP security boundary for auth, cookies, API keys, and tenant isolation.',
    audience: 'Admins',
    sections: [
      {
        title: 'Subdomain boundary',
        body: 'The marketing and docs sites remain public. The authenticated application lives on app.domain-name.com, and auth cookies should be scoped to that host.',
        bullets: [
          'Do not share app auth cookies with docs or marketing.',
          'Use environment-scoped API keys for SDK ingestion.',
          'Keep customer reports, sessions, and apps tenant-isolated.',
          'Audit sensitive user, billing, API key, and export actions.',
        ],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Resolve common onboarding, SDK, telemetry, reconciliation, and report issues.',
    audience: 'Everyone',
    sections: [
      {
        title: 'Common checks',
        body: 'Most early issues come from incorrect API keys, wrong environment IDs, blocked gateway traffic, or missing test events.',
        bullets: [
          'Confirm the SDK endpoint points to the API gateway.',
          'Verify the API key belongs to the selected environment.',
          'Send SOTS_ONBOARDING_TEST and check SDK readiness.',
          'Run enough behavior to meet reconciliation thresholds.',
          'Check plan entitlements if export or advanced features are denied.',
        ],
      },
    ],
  },
];

export function getDoc(slug: string) {
  return docs.find((doc) => doc.slug === slug);
}
