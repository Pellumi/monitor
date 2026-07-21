export type DocPage = {
  slug: string;
  title: string;
  description: string;
  category: string;
  sections: Array<{
    title: string;
    body: string;
    bullets?: string[];
    code?: string;
    language?: string;
    endpoint?: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      path: string;
    };
    tryIt?: {
      pathParams?: string[];
      defaultBody?: string;
    };
  }>;
};

export const CATEGORY_ORDER = [
  '🚀 GET STARTED',
  '📚 CONCEPTS',
  '👥 GUIDES',
  '🎬 DEMONSTRATION MODE',
  '📊 ANALYSIS & REPORTS',
  '🔄 RECONCILIATION',
  '🎥 SESSION REPLAY',
  '🧩 SDK REFERENCE',
  '🔌 API REFERENCE',
  '🏢 ADMINISTRATION',
  '🔒 SECURITY & PRIVACY',
  '💳 BILLING & PLANS',
  '🏗 ARCHITECTURE',
  '🆚 WHY TELLANN?',
  '🛠 TROUBLESHOOTING',
  '🎓 TUTORIALS',
];

export const docs: DocPage[] = [
  // 🚀 GET STARTED
  {
    slug: 'what-is-tellann',
    title: 'What is Tellann?',
    description: 'Tellann is a Behavioral Quality Intelligence Platform that learns how your software behaves by observing it.',
    category: '🚀 GET STARTED',
    sections: [
      {
        title: 'Introduction',
        body: 'Tellann is a Behavioral Quality Intelligence Platform that learns how your software behaves by observing it. Instead of relying only on test suites, logs, metrics, or analytics, Tellann builds a behavioral model of your application from real interactions. Install the SDK, demonstrate your application once, and Tellann automatically generates:',
        bullets: [
          'Behavioral Graphs',
          'Workflow Maps',
          'Coverage Reports',
          'Missing State Reports',
          'Missing Flow Reports',
          'Session Replays',
          'Endpoint Intelligence'
        ]
      },
      {
        title: 'Traditional QA vs Tellann',
        body: 'Traditional testing tracks assertions. Tellann tracks behavioral reality. Under the traditional approach, you write tests first, manually document workflows, find bugs after they occur, and analyze logs and metrics. With Tellann, you demonstrate behavior first, automatically discover workflows, identify coverage gaps early, and analyze application behavior.'
      },
      {
        title: 'What Tellann Produces',
        body: 'Tellann automatically parses telemetry to construct several core assets:',
        bullets: [
          'Behavioral Graph: Visual representation of application behavior (ANONYMOUS -> REGISTERED -> AUTHENTICATED -> CHECKOUT)',
          'Coverage Analysis: Shows what was demonstrated and what was missed',
          'Missing Flows: Detects missing paths (Login Failure, Session Expiration, Payment Failure)',
          'Session Replay: Replay exactly what happened during a demonstration'
        ]
      }
    ]
  },
  {
    slug: 'why-exists',
    title: 'Why Tellann Exists',
    description: 'Traditional testing tracks assertions. Tellann tracks behavioral reality.',
    category: '🚀 GET STARTED',
    sections: [
      {
        title: 'The Question Gap',
        body: 'Modern software teams have plenty of tools: Logs, Metrics, Traces, Analytics, Session Replays, and Test Suites. Yet teams still struggle to answer simple questions: What workflows exist in this application? What parts of the application have been demonstrated? Which error paths have never been tested? What happens if payment fails? What behavior is missing?'
      },
      {
        title: 'Existing Tools vs Tellann',
        body: 'Existing tools like Datadog answer if the infrastructure is healthy. Sentry answers what broke. PostHog tracks how users are behaving. Replay records what happened. Tellann answers: What behavior exists? What behavior is missing? Which workflows lack coverage? Which states have never been observed? How confident should we be in this release?'
      },
      {
        title: 'The Core Idea',
        body: 'A developer demonstration is transformed into actionable quality insights:',
        bullets: [
          'Demonstration -> Behavior Graph -> Coverage Analysis -> Missing States -> Missing Flows -> QA Intelligence'
        ]
      }
    ]
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Tellann can be integrated into any application using the Frontend SDK, Backend SDK, or both.',
    category: '🚀 GET STARTED',
    sections: [
      {
        title: 'Before You Begin',
        body: 'Tellann can be integrated into any application using the Frontend SDK, Backend SDK, or both. You\'ll need: A Tellann account, an organization, an application, an environment, and an API key.'
      },
      {
        title: 'Integration Flow',
        body: 'The standard onboarding process is straightforward:',
        bullets: [
          'Create Organization',
          'Create Application',
          'Create Environment',
          'Generate API Key',
          'Install SDK',
          'Run Demonstration',
          'View Reports'
        ]
      },
      {
        title: 'Supported Platforms',
        body: 'Tellann supports modern frontend and backend stacks. Frontend: React, Next.js, JavaScript, TypeScript. Backend: Node.js, Express, NestJS, Fastify.'
      }
    ]
  },
  {
    slug: 'quick-start',
    title: 'Quick Start (5 Minutes)',
    description: 'Get Tellann running locally and send your first onboarding event in 5 minutes.',
    category: '🚀 GET STARTED',
    sections: [
      {
        title: 'Step 1 — Install SDK',
        body: 'Add Tellann to your project dependencies.',
        code: 'npm install @sots/frontend-sdk',
        language: 'bash'
      },
      {
        title: 'Step 2 — Initialize SDK',
        body: 'Initialize Tellann at the entry point of your application:',
        code: 'import { SOTS } from "@sots/frontend-sdk";\n\nSOTS.initialize({\n  apiKey: "YOUR_API_KEY",\n  applicationId: "YOUR_APP_ID",\n  environment: "development"\n});',
        language: 'typescript'
      },
      {
        title: 'Step 3 — Start Application',
        body: 'Run your application normally.',
        code: 'npm run dev',
        language: 'bash'
      },
      {
        title: 'Step 4 — Start Demonstration',
        body: 'Inside the Tellann Dashboard: navigate to Applications, select your application, and click "Start Demonstration".'
      },
      {
        title: 'Step 5 — Demonstrate Behavior',
        body: 'Click through your app to demonstrate user paths, for example: Register -> Login -> Browse Products -> Add To Cart -> Checkout.'
      },
      {
        title: 'Step 6 — Stop Recording',
        body: 'Inside Tellann, click "Stop Demonstration" to complete your session.'
      },
      {
        title: 'Step 7 — View Results',
        body: 'Tellann automatically processes the demonstration and generates your Behavioral Graph, Coverage Report, Missing States, Missing Flows, and Session Replay.'
      }
    ]
  },
  {
    slug: 'concepts',
    title: 'Core Concepts',
    description: 'Master the mental model behind Tellann behavior mapping.',
    category: '🚀 GET STARTED',
    sections: [
      {
        title: 'Event & Session',
        body: 'An Event is the smallest unit of observation (e.g. BUTTON_CLICK, PAGE_VISIT, API_REQUEST, ERROR_OCCURRED). A Session represents a chronological collection of events.'
      },
      {
        title: 'State & Transition',
        body: 'A State is a meaningful condition in the application (e.g. ANONYMOUS, AUTHENTICATED, CHECKOUT, PAYMENT_FAILED). A Transition represents movement between states (e.g. CART -> CHECKOUT).'
      },
      {
        title: 'Workflow & Behavior Graph',
        body: 'A Workflow represents a business process (e.g. Registration, Login, Checkout, Subscription Purchase). A Behavior Graph is a connected model of observed application behavior (State -> Transition -> State).'
      },
      {
        title: 'Coverage & Gaps',
        body: 'Coverage is the percentage of expected behavior that has been observed. A Missing State is a state that should likely exist but has not been demonstrated (e.g. EMPTY_CART, 404_PAGE, PAYMENT_FAILED). A Missing Flow is a workflow path that has not been demonstrated (e.g. Login Failure, Retry Payment, Session Timeout).'
      }
    ]
  },
  {
    slug: 'first-demonstration',
    title: 'Your First Demonstration Session',
    description: 'Teach Tellann how your application behaves through manual walkthroughs.',
    category: '🚀 GET STARTED',
    sections: [
      {
        title: 'Teaching the System',
        body: 'A demonstration session teaches Tellann how your application behaves. You are not testing. You are teaching.'
      },
      {
        title: 'Good vs Better vs Best Demonstrations',
        body: 'Under a Good Demonstration, you cover a standard success path (Register -> Login -> Browse -> Add -> Checkout). Under a Better Demonstration, you add basic alternative flows (Register -> Login -> Logout -> Password Reset -> Add to Cart -> Remove -> Checkout -> Payment Success). Under the Best Demonstration, you include success paths, failure paths, empty states, validation errors, and recovery flows (e.g. Login Failure, Empty Search, Invalid Form Submission, Payment Failure, and Retry Actions).'
      },
      {
        title: 'Demonstration Tips',
        body: 'To get clean behavior models with high accuracy, follow these tips: Move slowly, complete workflows, include edge cases, trigger validation errors, and explore alternate paths.'
      }
    ]
  },
  {
    slug: 'first-report',
    title: 'Understanding Your First Report',
    description: 'Read and interpret behavior compliance and gap reports.',
    category: '🚀 GET STARTED',
    sections: [
      {
        title: 'Executive Summary & Behavioral Graph',
        body: 'The Executive Summary provides your high-level application health overview (Quality Score, Workflow Coverage, Missing States, and Missing Flows). The Behavioral Graph visualizes the observed application behavior flow (e.g. ANONYMOUS -> REGISTERED -> AUTHENTICATED).'
      },
      {
        title: 'Coverage & Gaps',
        body: 'The Coverage Report shows the percentage of observed behavior (e.g. Checkout Coverage 75%). Missing States list expected states that were not observed (e.g. 404_PAGE, EMPTY_CART, PAYMENT_FAILED). Missing Flows list expected workflow paths that were not demonstrated (e.g. Retry Payment, Session Timeout, Login Failure).'
      },
      {
        title: 'Session Replay & Next Steps',
        body: 'The Session Replay allows you to inspect exactly what happened during the demonstration. To improve your quality metrics next: review missing states, review missing flows, run another demonstration to cover outstanding paths, improve coverage scores, and establish a behavioral baseline.'
      }
    ]
  },

  {
    slug: 'concepts/behavioral-qa',
    title: 'Behavioral QA',
    description: 'A new paradigm of software quality focused on flow correctness rather than assertions.',
    category: '📚 CONCEPTS',
    sections: [
      {
        title: 'Shifting from Assertions to Flow Mapping',
        body: 'Behavioral QA focuses on tracing journeys (e.g. login -> add item -> checkout). Instead of mocking endpoints, it ensures that every actual flow maps to a verified graph model.',
      },
    ],
  },
  {
    slug: 'concepts/demonstration-mode',
    title: 'Developer Demonstration Mode',
    description: 'Enable real-time tracking of human walkthroughs to teach Tellann expected paths.',
    category: '📚 CONCEPTS',
    sections: [
      {
        title: 'Why teach the system?',
        body: 'Writing complex JSON graph rules by hand is tedious. Demonstration mode lets you record your actions directly, translating UI actions into state transitions.',
      },
    ],
  },
  {
    slug: 'concepts/behavior-graphs',
    title: 'Behavior Graphs',
    description: 'Mathematical representations of application flows built from states and transitions.',
    category: '📚 CONCEPTS',
    sections: [
      {
        title: 'Directed Acyclic Graphs (DAG)',
        body: 'Tellann models behavior as a DAG, representing screens or states as nodes, and user interactions or backend processes as directed edges.',
      },
    ],
  },
  {
    slug: 'concepts/workflows',
    title: 'Workflows',
    description: 'Sequences of related actions representing a high-level business goal.',
    category: '📚 CONCEPTS',
    sections: [
      {
        title: 'Business journeys',
        body: 'Workflows represent end-to-end user goals, e.g. "User Signup" or "Payment Processing". A workflow has a designated start state and one or more end states.',
      },
    ],
  },
  {
    slug: 'concepts/states',
    title: 'States',
    description: 'Nodes in the behavior graph representing specific screens or conditions.',
    category: '📚 CONCEPTS',
    sections: [
      {
        title: 'Defining States',
        body: 'A state represents an application screen (e.g., `CART_VIEW`) or a status (e.g., `PAYMENT_PENDING`).',
      },
    ],
  },
  {
    slug: 'concepts/transitions',
    title: 'Transitions',
    description: 'Directed edges linking one state to another.',
    category: '📚 CONCEPTS',
    sections: [
      {
        title: 'State Transitions',
        body: 'A transition is triggered by an event (e.g. click, API response, or navigation). It dictates how an application shifts from state A to state B.',
      },
    ],
  },
  {
    slug: 'concepts/coverage',
    title: 'Coverage',
    description: 'Metric indicating the percentage of declared behavior confirmed by real telemetry.',
    category: '📚 CONCEPTS',
    sections: [
      {
        title: 'Behavioral Coverage vs Code Coverage',
        body: 'Unlike code coverage which counts executed lines of code, behavioral coverage counts the percentage of modeled workflows and user paths successfully navigated and verified.',
      },
    ],
  },
  {
    slug: 'concepts/missing-states',
    title: 'Missing States',
    description: 'Declared states that were never reached during testing or execution.',
    category: '📚 CONCEPTS',
    sections: [
      {
        title: 'Detecting Dead Nodes',
        body: 'If a screen is modeled in the expected behavior graph but Tellann telemetry never records it, it is classified as a missing state.',
      },
    ],
  },
  {
    slug: 'concepts/missing-flows',
    title: 'Missing Flows',
    description: 'Declared transitions or paths that were never walked.',
    category: '📚 CONCEPTS',
    sections: [
      {
        title: 'Critical path gaps',
        body: 'A missing flow occurs when expected sequences of steps (transitions) are bypassed or not executed during user sessions.',
      },
    ],
  },
  {
    slug: 'concepts/reconciliation-engine',
    title: 'Reconciliation Engine',
    description: 'The core service matching expectations with observed telemetry.',
    category: '📚 CONCEPTS',
    sections: [
      {
        title: 'How reconciliation runs',
        body: 'The reconciliation engine runs asynchronously, aggregating sessions and analyzing differences. It matches observed paths onto the declared behavior graph and flags gaps.',
      },
    ],
  },
  {
    slug: 'concepts/expected-vs-observed',
    title: 'Expected vs Observed Behavior',
    description: 'The foundational reconciliation comparison.',
    category: '📚 CONCEPTS',
    sections: [
      {
        title: 'The comparison model',
        body: 'Expected behavior models what the product should do. Observed behavior represents what the application actually did. The delta maps out your release quality risk.',
      },
    ],
  },

  // 👥 GUIDES
  {
    slug: 'guides/developer',
    title: 'Developer Guide',
    description: 'Step-by-step instructions for engineers integrating Tellann SDKs.',
    category: '👥 GUIDES',
    sections: [
      {
        title: 'Developer Responsibilities',
        body: 'As a developer, your primary role is instrumenting Tellann in frontend apps and API gateways.',
        bullets: [
          'Configure environment variables.',
          'Install standard NPM/Node tracking libraries.',
          'Decorate business transitions and API responses.',
        ],
      },
    ],
  },
  {
    slug: 'guides/qa',
    title: 'QA Guide',
    description: 'Instructions for testing teams verifying behavior coverage.',
    category: '👥 GUIDES',
    sections: [
      {
        title: 'QA Flow Verification',
        body: 'QA teams use Tellann to map test scripts into behavioral graphs and review gaps before signing off on releases.',
      },
    ],
  },
  {
    slug: 'guides/product-manager',
    title: 'Product Manager Guide',
    description: 'How product managers utilize behavioral graphs to verify specs.',
    category: '👥 GUIDES',
    sections: [
      {
        title: 'Product Specifications',
        body: 'Ensure that developers actually implement the exact workflow paths defined in PM product requirement documents (PRD).',
      },
    ],
  },
  {
    slug: 'guides/admin',
    title: 'Admin Guide',
    description: 'Manage users, environments, API keys, and billing settings.',
    category: '👥 GUIDES',
    sections: [
      {
        title: 'Administration operations',
        body: 'Control roles, manage billing tiers, and generate scoped environment API keys.',
      },
    ],
  },

  // 🎬 DEMONSTRATION MODE
  {
    slug: 'demo-mode/introduction',
    title: 'Introduction to Demo Mode',
    description: 'Get introduced to the Tellann Demonstration engine.',
    category: '🎬 DEMONSTRATION MODE',
    sections: [
      {
        title: 'Teach by demonstration',
        body: 'Demonstration Mode is the easiest way to model behavior. Instead of writing code, you navigate your application, and Tellann constructs the behavior graph nodes.',
      },
    ],
  },
  {
    slug: 'demo-mode/recording',
    title: 'Recording a Demonstration',
    description: 'How to trigger, record, and save a demonstration trace.',
    category: '🎬 DEMONSTRATION MODE',
    sections: [
      {
        title: 'Recording steps',
        body: 'Open your staging environment, click "Record Demo" in the Tellann browser panel, execute the flow, and click "Submit Trace".',
      },
    ],
  },
  {
    slug: 'demo-mode/guided',
    title: 'Guided Demonstrations',
    description: 'Walk through preset paths to declare standard golden paths.',
    category: '🎬 DEMONSTRATION MODE',
    sections: [
      {
        title: 'Interactive walkthroughs',
        body: 'Guided demonstrations enforce compliance on critical business paths like registration and payment checkouts.',
      },
    ],
  },
  {
    slug: 'demo-mode/exploratory',
    title: 'Exploratory Demonstrations',
    description: 'Freely explore paths to record edge cases and complex branches.',
    category: '🎬 DEMONSTRATION MODE',
    sections: [
      {
        title: 'Discovering unmapped paths',
        body: 'Use exploratory sessions to map alternative user choices, failure redirects, and error pages.',
      },
    ],
  },
  {
    slug: 'demo-mode/validation',
    title: 'Validation Demonstrations',
    description: 'Verify if a demonstration matches existing behavior rules.',
    category: '🎬 DEMONSTRATION MODE',
    sections: [
      {
        title: 'Demonstration verification',
        body: 'Submit a validation trace to check if Tellann flags any deviations from the established behavior model.',
      },
    ],
  },
  {
    slug: 'demo-mode/learning-behavior',
    title: 'How Tellann Learns Behavior',
    description: 'Understand the machine learning models behind Tellann behavior capture.',
    category: '🎬 DEMONSTRATION MODE',
    sections: [
      {
        title: 'Pattern mapping',
        body: 'Tellann aggregates multiple demonstration traces, filters noise, and maps common states and interaction sequences into canonical behavior graphs.',
      },
    ],
  },
  {
    slug: 'demo-mode/best-practices',
    title: 'Demonstration Best Practices',
    description: 'Get clean behavior models with high accuracy.',
    category: '🎬 DEMONSTRATION MODE',
    sections: [
      {
        title: 'Recording advice',
        body: 'Keep sessions short, click intentionally, wait for network requests to complete, and avoid multi-tab recording.',
      },
    ],
  },

  // 📊 ANALYSIS & REPORTS
  {
    slug: 'analysis/behavior-graphs',
    title: 'Behavior Graphs',
    description: 'Visual representations of all paths traversed in your application.',
    category: '📊 ANALYSIS & REPORTS',
    sections: [
      {
        title: 'Analyzing the Graph',
        body: 'The Tellann dashboard visualizes states as circles, transitions as arrows, and overlays error rates and execution frequency.',
      },
    ],
  },
  {
    slug: 'analysis/coverage',
    title: 'Coverage',
    description: 'Detailed coverage mapping of your application states and APIs.',
    category: '📊 ANALYSIS & REPORTS',
    sections: [
      {
        title: 'Reviewing coverage metrics',
        body: 'Track your overall state, transition, and API endpoint coverage. High-risk features require 100% behavioral coverage before shipping.',
      },
    ],
  },
  {
    slug: 'analysis/missing-behavior',
    title: 'Missing Behavior',
    description: 'Inspecting gaps between expected specs and actual execution.',
    category: '📊 ANALYSIS & REPORTS',
    sections: [
      {
        title: 'Identifying quality risk',
        body: 'Tellann highlights missing states and transitions in orange/red in the behavior graph, helping you immediately find untested functionality.',
      },
    ],
  },
  {
    slug: 'analysis/reports',
    title: 'Reports',
    description: 'Generate, filter, and export executive quality intelligence reports.',
    category: '📊 ANALYSIS & REPORTS',
    sections: [
      {
        title: 'Generating reports',
        body: 'Reports summarize release quality, detailing covered paths, security validations, and outstanding gaps. Reports can be exported as PDF/JSON.',
      },
    ],
  },

  // 🔄 RECONCILIATION
  {
    slug: 'reconciliation/overview',
    title: 'Overview of Reconciliation',
    description: 'Learn how Tellann automatically highlights testing gaps.',
    category: '🔄 RECONCILIATION',
    sections: [
      {
        title: 'Reconciling flows',
        body: 'The reconciliation process is Tellann\'s main quality check. It reads the expected behavior graph and overlays observed telemetry to find missing states.',
      },
    ],
  },
  {
    slug: 'reconciliation/expected-graphs',
    title: 'Expected Graphs',
    description: 'Building and maintaining your expected behavior model.',
    category: '🔄 RECONCILIATION',
    sections: [
      {
        title: 'Modelling expectations',
        body: 'Define expected graphs programmatically or via demonstration mode, documenting how actions flow.',
      },
    ],
  },
  {
    slug: 'reconciliation/demonstrated-graphs',
    title: 'Demonstrated Graphs',
    description: 'Behavior models generated by guided QA walks.',
    category: '🔄 RECONCILIATION',
    sections: [
      {
        title: 'Guided trace graphs',
        body: 'Graphs constructed from specific recorded demonstration sessions. Useful as baseline comparison standards.',
      },
    ],
  },
  {
    slug: 'reconciliation/observed-graphs',
    title: 'Observed Graphs',
    description: 'Graphs generated from real staging or production telemetry.',
    category: '🔄 RECONCILIATION',
    sections: [
      {
        title: 'Real-world behavior',
        body: 'Observed graphs represent the absolute truth of application execution, built directly from API calls and frontend events.',
      },
    ],
  },
  {
    slug: 'reconciliation/gap-detection',
    title: 'Gap Detection',
    description: 'The algorithmic detection of missing paths and states.',
    category: '🔄 RECONCILIATION',
    sections: [
      {
        title: 'Finding Gaps',
        body: 'By computing the topological delta between the expected graph and the observed graph, Tellann immediately exposes missing steps and untested branches.',
      },
    ],
  },
  {
    slug: 'reconciliation/coverage-scoring',
    title: 'Coverage Scoring',
    description: 'Mathematical calculation of behavioral coverage.',
    category: '🔄 RECONCILIATION',
    sections: [
      {
        title: 'Scoring formulas',
        body: 'Coverage is calculated as the ratio of observed states/transitions to declared states/transitions within a target application environment.',
      },
    ],
  },
  {
    slug: 'reconciliation/release-confidence',
    title: 'Release Confidence',
    description: 'Quantifying release readiness based on behavioral validation.',
    category: '🔄 RECONCILIATION',
    sections: [
      {
        title: 'Ship with confidence',
        body: 'Tellann generates a Release Confidence Score based on API error rates, coverage percentages, and critical workflow integrity checks.',
      },
    ],
  },

  // 🎥 SESSION REPLAY
  {
    slug: 'session-replay/overview',
    title: 'Replay Overview',
    description: 'Visual timeline reconstruction from behavioral telemetry.',
    category: '🎥 SESSION REPLAY',
    sections: [
      {
        title: 'Contextual replay',
        body: 'Tellann Session Replay reconstructs user timelines from captured telemetry instead of capturing video. It connects events, API payloads, and errors chronologically.',
      },
    ],
  },
  {
    slug: 'session-replay/timeline',
    title: 'Timeline Navigation',
    description: 'Navigating through user action timelines, API calls, and errors.',
    category: '🎥 SESSION REPLAY',
    sections: [
      {
        title: 'Interacting with the replay timeline',
        body: 'Scroll, seek, and filter the session timeline. Click on specific events to inspect request headers, state values, or error traces.',
      },
    ],
  },
  {
    slug: 'session-replay/errors',
    title: 'Investigating Errors',
    description: 'Correlating frontend console errors with backend exceptions.',
    category: '🎥 SESSION REPLAY',
    sections: [
      {
        title: 'Trace and diagnose',
        body: 'When a user session fails, Tellann maps the frontend error back to the backend API exception, displaying both side-by-side in the replay viewer.',
      },
    ],
  },
  {
    slug: 'session-replay/workflow-analysis',
    title: 'Workflow Analysis',
    description: 'Inspect step-by-step user traversal of declared workflows.',
    category: '🎥 SESSION REPLAY',
    sections: [
      {
        title: 'Analyzing workflow walkthroughs',
        body: 'See exactly where users drop off or deviate from modeled checkout or signup flows in real-time replays.',
      },
    ],
  },
  {
    slug: 'session-replay/privacy',
    title: 'Replay Privacy Controls',
    description: 'Enforce masking of sensitive input and PII data before ingestion.',
    category: '🎥 SESSION REPLAY',
    sections: [
      {
        title: 'Data scrubbing',
        body: 'Configure the SDK to block, mask, or hash sensitive data like passwords, credit cards, or medical records on the client side.',
      },
    ],
  },

  // 🧩 SDK REFERENCE
  {
    slug: 'sdk-reference/frontend',
    title: 'Frontend SDK Reference',
    description: 'Javascript browser client SDK reference and initialization.',
    category: '🧩 SDK REFERENCE',
    sections: [
      {
        title: 'NPM Installation',
        body: 'Install the frontend SDK package:',
        code: `npm install @sots/frontend-sdk`,
        language: 'bash',
      },
      {
        title: 'Initialization and State Tracking',
        body: 'Point the client to your API Gateway and track custom user states:',
        code: `import { SOTS } from '@sots/frontend-sdk';\n\nSOTS.initialize({\n  endpoint: 'http://localhost:3000',\n  apiKey: 'YOUR_API_KEY',\n  applicationId: 'YOUR_APP_ID',\n  environmentId: 'YOUR_ENV_ID'\n});\n\n// Track navigation state\nSOTS.trackState('DASHBOARD_VIEW');\n\n// Track custom UI interaction\nSOTS.trackEvent('CLICK_UPGRADE_PLAN');`,
        language: 'typescript',
      },
    ],
  },
  {
    slug: 'sdk-reference/backend',
    title: 'Backend SDK Reference',
    description: 'Node.js backend SDK reference, middleware integration, and session tracing.',
    category: '🧩 SDK REFERENCE',
    sections: [
      {
        title: 'Node Installation',
        body: 'Install the backend SDK package:',
        code: `npm install @sots/backend-sdk`,
        language: 'bash',
      },
      {
        title: 'Express Middleware Setup',
        body: 'Use Express middleware to automatically track endpoints, response codes, and errors:',
        code: `import { SOTS, sotsExpressMiddleware } from '@sots/backend-sdk';\nimport express from 'express';\n\nconst app = express();\n\nSOTS.initialize({\n  endpoint: 'http://localhost:3000',\n  apiKey: 'YOUR_API_KEY',\n  applicationId: 'YOUR_APP_ID',\n  environmentId: 'YOUR_ENV_ID'\n});\n\n// Intercept requests\napp.use(sotsExpressMiddleware());`,
        language: 'typescript',
      },
    ],
  },
  {
    slug: 'sdk-reference/event-reference',
    title: 'Event Reference',
    description: 'Full taxonomy catalog of Tellann behavioral events.',
    category: '🧩 SDK REFERENCE',
    sections: [
      {
        title: 'Supported Event Types',
        body: 'Tellann parses and indexes the following telemetry events:',
        bullets: [
          'PAGE_VISIT: Fired on screen navigation.',
          'BUTTON_CLICK: Capture click actions.',
          'STATE_ENTERED: Custom state boundary registration.',
          'API_REQUEST / API_RESPONSE: Track roundtrip latencies.',
          'ERROR_OCCURRED: Capture uncaught exceptions.',
        ],
      },
    ],
  },

  // 🔌 API REFERENCE
  {
    slug: 'api-reference/authentication',
    title: 'Authentication',
    description: 'API key authentication format for interacting with the Tellann Gateway.',
    category: '🔌 API REFERENCE',
    sections: [
      {
        title: 'Bearer Header',
        body: 'Include your environment-scoped API Key in the Authorization header:',
        code: 'Authorization: Bearer sots_dev_key_12345',
        language: 'bash',
      },
      {
        title: 'Gateway Endpoint Details',
        body: 'Use the base Tellann API Gateway URL for all REST requests.',
        endpoint: {
          method: 'GET',
          path: '/health',
        },
        tryIt: {},
      },
    ],
  },
  {
    slug: 'api-reference/organizations',
    title: 'Organizations API',
    description: 'Manage tenant organization boundaries.',
    category: '🔌 API REFERENCE',
    sections: [
      {
        title: 'List Organizations',
        body: 'Retrieve organizations belonging to the authenticated account.',
        endpoint: {
          method: 'GET',
          path: '/organizations',
        },
        tryIt: {},
      },
    ],
  },
  {
    slug: 'api-reference/applications',
    title: 'Applications API',
    description: 'Create and list monitored applications.',
    category: '🔌 API REFERENCE',
    sections: [
      {
        title: 'List Applications',
        body: 'Get applications for an organization.',
        endpoint: {
          method: 'GET',
          path: '/applications',
        },
        tryIt: {},
      },
    ],
  },
  {
    slug: 'api-reference/api-keys',
    title: 'API Keys API',
    description: 'Generate, rotate, and revoke environment API keys.',
    category: '🔌 API REFERENCE',
    sections: [
      {
        title: 'List API Keys',
        body: 'Fetch active keys for an application environment.',
        endpoint: {
          method: 'GET',
          path: '/api-keys',
        },
        tryIt: {},
      },
    ],
  },
  {
    slug: 'api-reference/events',
    title: 'Events API',
    description: 'Ingest raw behavioral telemetry events.',
    category: '🔌 API REFERENCE',
    sections: [
      {
        title: 'Ingest Event',
        body: 'Send a single telemetry event. For batch submissions, use `/v1/events/batch`.',
        endpoint: {
          method: 'POST',
          path: '/v1/events',
        },
        tryIt: {
          defaultBody: `{\n  "eventType": "STATE_ENTERED",\n  "timestamp": "${new Date().toISOString()}",\n  "metadata": {\n    "stateName": "DASHBOARD"\n  }\n}`,
        },
      },
    ],
  },
  {
    slug: 'api-reference/sessions',
    title: 'Sessions API',
    description: 'Query session metadata and construct timelines.',
    category: '🔌 API REFERENCE',
    sections: [
      {
        title: 'Get Session details',
        body: 'Retrieve details for a single behavioral session.',
        endpoint: {
          method: 'GET',
          path: '/sessions/{id}',
        },
        tryIt: {
          pathParams: ['id'],
        },
      },
    ],
  },
  {
    slug: 'api-reference/demonstrations',
    title: 'Demonstrations API',
    description: 'Manage guided QA walkthrough traces.',
    category: '🔌 API REFERENCE',
    sections: [
      {
        title: 'Submit Demo Trace',
        body: 'Submit a new demonstration trace to train Tellann behavior graphs.',
        endpoint: {
          method: 'POST',
          path: '/demonstrations',
        },
        tryIt: {
          defaultBody: '{\n  "traceName": "Verify Checkout Flow",\n  "events": []\n}',
        },
      },
    ],
  },
  {
    slug: 'api-reference/graphs',
    title: 'Graphs API',
    description: 'Retrieve constructed expected and observed behavior graphs.',
    category: '🔌 API REFERENCE',
    sections: [
      {
        title: 'Get Application Graph',
        body: 'Fetch behavior nodes, states, and transition links.',
        endpoint: {
          method: 'GET',
          path: '/applications/{id}/graph',
        },
        tryIt: {
          pathParams: ['id'],
        },
      },
    ],
  },
  {
    slug: 'api-reference/coverage',
    title: 'Coverage API',
    description: 'Query live behavior coverage scores.',
    category: '🔌 API REFERENCE',
    sections: [
      {
        title: 'Get Coverage Metrics',
        body: 'Fetch state and transition coverage details.',
        endpoint: {
          method: 'GET',
          path: '/coverage',
        },
        tryIt: {},
      },
    ],
  },
  {
    slug: 'api-reference/reports',
    title: 'Reports API',
    description: 'Generate and export behavior reports.',
    category: '🔌 API REFERENCE',
    sections: [
      {
        title: 'Get Latest Report',
        body: 'Retrieve the latest behavioral analysis report.',
        endpoint: {
          method: 'GET',
          path: '/reports',
        },
        tryIt: {},
      },
    ],
  },

  // 🏢 ADMINISTRATION
  {
    slug: 'administration/organizations',
    title: 'Organizations',
    description: 'Setting up and isolating multiple business organizations.',
    category: '🏢 ADMINISTRATION',
    sections: [
      {
        title: 'Tenant Isolation',
        body: 'Tellann enforces complete data isolation between organizations. Telemetry, behavior graphs, and sessions are partitioned strictly at the database layer.',
      },
    ],
  },
  {
    slug: 'administration/applications',
    title: 'Applications',
    description: 'Adding, configuring, and deleting application definitions.',
    category: '🏢 ADMINISTRATION',
    sections: [
      {
        title: 'Application boundaries',
        body: 'Applications represent distinct software projects (e.g. e-commerce-client vs checkout-api) within an organization.',
      },
    ],
  },
  {
    slug: 'administration/environments',
    title: 'Environments',
    description: 'Configuring development, staging, and production environments.',
    category: '🏢 ADMINISTRATION',
    sections: [
      {
        title: 'Environment isolation',
        body: 'Isolate behavior rules. Production environment graphs are typically locked, whereas development and staging environments accept new demonstration traces.',
      },
    ],
  },
  {
    slug: 'administration/team-members',
    title: 'Team Members',
    description: 'Inviting developers, QA engineers, and managers.',
    category: '🏢 ADMINISTRATION',
    sections: [
      {
        title: 'Collaborating on Tellann',
        body: 'Invite team members to share reports, view session replays, and review quality graphs.',
      },
    ],
  },
  {
    slug: 'administration/rbac',
    title: 'Role-Based Access Control',
    description: 'Configuring roles: Admin, Developer, QA, and Manager.',
    category: '🏢 ADMINISTRATION',
    sections: [
      {
        title: 'User permissions',
        body: 'Enforce who can edit expected flow models, rotate API keys, view billing settings, or delete applications.',
      },
    ],
  },
  {
    slug: 'administration/audit-logs',
    title: 'Audit Logs',
    description: 'Trace sensitive actions and environment settings changes.',
    category: '🏢 ADMINISTRATION',
    sections: [
      {
        title: 'Access auditing',
        body: 'Track user logins, key rotations, project updates, and data deletion requests for corporate compliance.',
      },
    ],
  },
  {
    slug: 'administration/retention-policies',
    title: 'Retention Policies',
    description: 'Configure data retention parameters for events and session replays.',
    category: '🏢 ADMINISTRATION',
    sections: [
      {
        title: 'Telemetry purging',
        body: 'Define how long Tellann retains raw event data and timeline models (default is 90 days).',
      },
    ],
  },

  // 🔒 SECURITY & PRIVACY
  {
    slug: 'security-privacy/security',
    title: 'Security Architecture',
    description: 'How Tellann secures data, cookies, subdomains, and auth sessions.',
    category: '🔒 SECURITY & PRIVACY',
    sections: [
      {
        title: 'Tellann Security Boundary',
        body: 'All authenticated dashboard operations live on `app.domain-name.com`. Sessions are managed via secure, HttpOnly, SameSite cookies. Public marketing and documentation sites run on separate subdomains with no cookie sharing.',
      },
    ],
  },
  {
    slug: 'security-privacy/privacy',
    title: 'Privacy and PII',
    description: 'Safeguard sensitive client data and user inputs.',
    category: '🔒 SECURITY & PRIVACY',
    sections: [
      {
        title: 'PII Scrubbing and Masking',
        body: 'Specify privacy rule templates to mask user input fields before the SDK sends telemetry. Tellann automatically screens values matching credit card numbers, passwords, and tokens.',
      },
    ],
  },

  // 💳 BILLING & PLANS
  {
    slug: 'billing/pricing-overview',
    title: 'Pricing Overview',
    description: 'Review Tellann subscription pricing models.',
    category: '💳 BILLING & PLANS',
    sections: [
      {
        title: 'Tellann Pricing',
        body: 'Pricing scales based on ingest volumes, session counts, and access to premium features like Session Replay and Endpoint Intelligence.',
      },
    ],
  },
  {
    slug: 'billing/plans-comparison',
    title: 'Plans Comparison',
    description: 'Detailed comparison of Free, Team, and Enterprise plans.',
    category: '💳 BILLING & PLANS',
    sections: [
      {
        title: 'Tiers comparison table',
        body: 'Free plan supports 1 organization and 5,000 events/mo. Team tier unlocks multi-environment support. Enterprise tier provides audit logging and custom retention policies.',
      },
    ],
  },
  {
    slug: 'billing/entitlements',
    title: 'Entitlements Enforcement',
    description: 'Understand how feature access limits are resolved.',
    category: '💳 BILLING & PLANS',
    sections: [
      {
        title: 'Enforcing limits',
        body: 'Upstream services verify subscription flags during runtime. If a plan is suspended or over its quota limits, Tellann blocks reporting API endpoints or hides Session Replay timelines.',
      },
    ],
  },
  {
    slug: 'billing/usage-limits',
    title: 'Usage Limits',
    description: 'Monitoring monthly event ingestion metrics.',
    category: '💳 BILLING & PLANS',
    sections: [
      {
        title: 'Tracking usage',
        body: 'View real-time event counts and session usage. Exceeding limits triggers warnings, with data buffered temporarily for 48 hours.',
      },
    ],
  },
  {
    slug: 'billing/storage-limits',
    title: 'Storage Limits',
    description: 'Object storage quotas for session replays.',
    category: '💳 BILLING & PLANS',
    sections: [
      {
        title: 'Replay storage limits',
        body: 'Replays and behavior assets utilize MinIO object storage. The Team plan allows up to 50GB of session timeline assets.',
      },
    ],
  },
  {
    slug: 'billing/retention-limits',
    title: 'Retention Limits',
    description: 'Plan constraints on historical data retention.',
    category: '💳 BILLING & PLANS',
    sections: [
      {
        title: 'History windows',
        body: 'Telemetry data retention limits vary: Free tier holds 14 days, Team tier holds 90 days, Enterprise tier supports custom retention limits.',
      },
    ],
  },

  // 🏗 ARCHITECTURE
  {
    slug: 'architecture/system-architecture',
    title: 'System Architecture',
    description: 'Deep dive into the microservice pipeline that drives Tellann.',
    category: '🏗 ARCHITECTURE',
    sections: [
      {
        title: 'Tellann Infrastructure Flow',
        body: 'The Tellann system is built with a decoupled event ingestion architecture:',
        bullets: [
          'API Gateway: Manages rate-limiting and verifies Bearer API keys.',
          'Event Collector: Accepts events and pushes them to a Kafka broker.',
          'Session Engine: Reconstructs chronological timelines and stores raw logs in clickhouse.',
          'Coverage/Graph Engine: Processes reconciliation DAGs and updates PostgreSQL.',
        ],
      },
    ],
  },
  {
    slug: 'architecture/event-pipeline',
    title: 'Event Pipeline',
    description: 'How telemetry routes through Kafka and Clickhouse.',
    category: '🏗 ARCHITECTURE',
    sections: [
      {
        title: 'Telemetry ingestion path',
        body: 'Events submitted to `/v1/events` flow through Kafka to buffer high volumes, before being ingested into Clickhouse for analytical queries and PostgreSQL for relational definitions.',
      },
    ],
  },
  {
    slug: 'architecture/behavior-graph-engine',
    title: 'Behavior Graph Engine',
    description: 'The mathematical graph engine building state machines.',
    category: '🏗 ARCHITECTURE',
    sections: [
      {
        title: 'Graph creation algorithms',
        body: 'The Graph Engine computes topological sorting and generates DAG rules from sequential event timelines, generating node trees representing transitions.',
      },
    ],
  },
  {
    slug: 'architecture/coverage-engine',
    title: 'Coverage Engine',
    description: 'How Tellann processes reconciliation delta algorithms.',
    category: '🏗 ARCHITECTURE',
    sections: [
      {
        title: 'Topological alignment',
        body: 'The Coverage Engine aligns the expected graph nodes with observed traces, highlighting unreached steps (gaps) and unexpected branches.',
      },
    ],
  },
  {
    slug: 'architecture/session-replay-engine',
    title: 'Session Replay Engine',
    description: 'Reconstructing timelines from behavioral event streams.',
    category: '🏗 ARCHITECTURE',
    sections: [
      {
        title: 'Chronological replay builder',
        body: 'Instead of recording video, Tellann reads chronological events and builds a timeline playback layout, mapping user navigation, clicks, and REST requests.',
      },
    ],
  },
  {
    slug: 'architecture/deployment-models',
    title: 'Deployment Models',
    description: 'SaaS vs Hybrid Tellann deployment models.',
    category: '🏗 ARCHITECTURE',
    sections: [
      {
        title: 'Hosting Tellann',
        body: 'Tellann can be used as a fully-hosted SaaS platform, or deployed in a hybrid model where the telemetry storage (Clickhouse) remains in the client\'s cloud.',
      },
    ],
  },
  {
    slug: 'architecture/self-hosted',
    title: 'Self-Hosted Deployment',
    description: 'Run the entire Tellann stack inside your infrastructure.',
    category: '🏗 ARCHITECTURE',
    sections: [
      {
        title: 'Docker Compose and Kubernetes',
        body: 'Self-hosted guides support deployment using Helm charts or local Docker Compose stacks detailing Kafka, Clickhouse, and API gateway routes.',
      },
    ],
  },

  // 🆚 WHY TELLANN?
  {
    slug: 'why-tellann/why-tellann',
    title: 'Why Tellann?',
    description: 'Understand the distinct advantages of Behavioral Quality Intelligence.',
    category: '🆚 WHY TELLANN?',
    sections: [
      {
        title: 'The Tellann Difference',
        body: 'Tellann bridges the gap between manual testing, automated tests, and real-world behavior, ensuring what you build aligns with what you declared.',
      },
    ],
  },
  {
    slug: 'why-tellann/vs-datadog',
    title: 'Tellann vs Datadog',
    description: 'Compare Tellann behavioral modeling with Datadog RUM.',
    category: '🆚 WHY TELLANN?',
    sections: [
      {
        title: 'RUM vs Behavioral Reconciliation',
        body: 'While Datadog captures performance metrics and RUM click maps, Tellann reconciles executions against explicit state graphs to detect untested feature paths and logical gaps.',
      },
    ],
  },
  {
    slug: 'why-tellann/vs-sentry',
    title: 'Tellann vs Sentry',
    description: 'Compare Tellann error tracking with Sentry.',
    category: '🆚 WHY TELLANN?',
    sections: [
      {
        title: 'Error context vs Behavior context',
        body: 'Sentry tracks stack traces. Tellann tracks behavioral context, showing where errors occurred inside a larger state transition diagram.',
      },
    ],
  },
  {
    slug: 'why-tellann/vs-posthog',
    title: 'Tellann vs PostHog',
    description: 'Compare Tellann with PostHog product analytics.',
    category: '🆚 WHY TELLANN?',
    sections: [
      {
        title: 'Product Funnels vs Quality Assurance',
        body: 'PostHog maps conversion rates. Tellann maps structural behavior compliance, pointing out logical code branch bugs rather than just user dropoffs.',
      },
    ],
  },
  {
    slug: 'why-tellann/vs-replay-io',
    title: 'Tellann vs Replay.io',
    description: 'Compare Tellann with time-travel debuggers.',
    category: '🆚 WHY TELLANN?',
    sections: [
      {
        title: 'Replay.io vs Telemetry Reconstruction',
        body: 'Replay.io records low-level browser execution. Tellann reconstructs behavioral timelines, which scales cleanly to multi-session backend correlation.',
      },
    ],
  },
  {
    slug: 'why-tellann/behavioral-quality',
    title: 'Behavioral Quality Intelligence',
    description: 'The core category Tellann creates.',
    category: '🆚 WHY TELLANN?',
    sections: [
      {
        title: 'Quality Intelligence',
        body: 'Behavioral Quality Intelligence translates raw events into proof of correctness, validating release safety using observed math instead of guesses.',
      },
    ],
  },

  // 🛠 TROUBLESHOOTING
  {
    slug: 'troubleshooting/sdk-not-sending',
    title: 'SDK Not Sending Events',
    description: 'Resolve issues where events fail to register in the gateway.',
    category: '🛠 TROUBLESHOOTING',
    sections: [
      {
        title: 'Verification list',
        body: 'If your application is not transmitting telemetry, check:',
        bullets: [
          'Verify if the endpoint URL points to the gateway (http://localhost:3000).',
          'Confirm that the API Key is active in your environments dashboard.',
          'Verify console logs for CORS blocking errors.',
        ],
      },
    ],
  },
  {
    slug: 'troubleshooting/demo-not-processing',
    title: 'Demonstration Not Processing',
    description: 'Diagnose failures in demonstration trace processing.',
    category: '🛠 TROUBLESHOOTING',
    sections: [
      {
        title: 'Trace errors',
        body: 'Ensure you completed the demo flow completely. Tellann expects a transition path starting from an onboarding state.',
      },
    ],
  },
  {
    slug: 'troubleshooting/missing-states-not-appearing',
    title: 'Missing States Not Appearing',
    description: 'Ensure behavior graphs display expected gap highlights.',
    category: '🛠 TROUBLESHOOTING',
    sections: [
      {
        title: 'Topological mismatch',
        body: 'Confirm your application graph has been declared. Reconciliation cannot identify missing nodes without a declared graph base.',
      },
    ],
  },
  {
    slug: 'troubleshooting/replay-not-loading',
    title: 'Replay Not Loading',
    description: 'Resolve session replay playback errors.',
    category: '🛠 TROUBLESHOOTING',
    sections: [
      {
        title: 'Timeline retrieval error',
        body: 'Check database network health. Clickhouse timelines might not have loaded if the collector experienced queue latency.',
      },
    ],
  },
  {
    slug: 'troubleshooting/api-key-errors',
    title: 'API Key Errors',
    description: 'Handle 401 Unauthorized gateway errors.',
    category: '🛠 TROUBLESHOOTING',
    sections: [
      {
        title: 'API Key Validation',
        body: 'Gateway keys must be prefixed with `sots_` or map to the active organization hash. Revoke and re-generate key credentials if authentication fails.',
      },
    ],
  },
  {
    slug: 'troubleshooting/coverage-looks-wrong',
    title: 'Coverage Looks Wrong',
    description: 'Resolve mathematical discrepancy in coverage ratios.',
    category: '🛠 TROUBLESHOOTING',
    sections: [
      {
        title: 'Verifying calculations',
        body: 'Check whether obsolete states are still active in the expected model. Obsolete nodes reduce active coverage scoring metrics.',
      },
    ],
  },
  {
    slug: 'troubleshooting/faq',
    title: 'FAQ',
    description: 'Frequently Asked Questions about Tellann.',
    category: '🛠 TROUBLESHOOTING',
    sections: [
      {
        title: 'Common Questions',
        body: 'How much overhead does the SDK add? The browser SDK adds less than 3KB of gzipped payload and queues logs asynchronously to prevent rendering lag.',
      },
    ],
  },

  // 🎓 TUTORIALS
  {
    slug: 'tutorials/ecommerce',
    title: 'Analyze an E-commerce Application',
    description: 'Step-by-step tutorial modeling an e-commerce checkout loop.',
    category: '🎓 TUTORIALS',
    sections: [
      {
        title: 'E-commerce tutorial',
        body: 'Learn to track product detail pages, checkout processes, inventory status, and payment callbacks using Tellann state telemetry.',
      },
    ],
  },
  {
    slug: 'tutorials/saas',
    title: 'Analyze a SaaS Dashboard',
    description: 'Learn to model SaaS metrics dashboards.',
    category: '🎓 TUTORIALS',
    sections: [
      {
        title: 'SaaS dashboard tutorial',
        body: 'Model tenant onboarding walkthroughs, workspace switches, role changes, and charts loading states.',
      },
    ],
  },
  {
    slug: 'tutorials/lms',
    title: 'Analyze an LMS',
    description: 'Walkthrough modeling a Learning Management System (LMS).',
    category: '🎓 TUTORIALS',
    sections: [
      {
        title: 'LMS mapping',
        body: 'Model student registration, lesson view durations, quiz completions, and certificate outputs.',
      },
    ],
  },
  {
    slug: 'tutorials/checkout',
    title: 'Validate a Checkout Flow',
    description: 'Validate complex checkout processes against missing transitions.',
    category: '🎓 TUTORIALS',
    sections: [
      {
        title: 'Checkout security validation',
        body: 'Ensure that order confirmation states cannot be bypassed by directly entering success URLs without billing validations.',
      },
    ],
  },
  {
    slug: 'tutorials/missing-auth',
    title: 'Detect Missing Authentication Paths',
    description: 'Locate pages accessible without proper user authentication.',
    category: '🎓 TUTORIALS',
    sections: [
      {
        title: 'Auth path tracking',
        body: 'Verify if telemetry logs page transitions to dashboard subpages when the authentication state remains undefined.',
      },
    ],
  },
  {
    slug: 'tutorials/first-graph',
    title: 'Create Your First Expected Graph',
    description: 'Write expected graph assertions from business rules.',
    category: '🎓 TUTORIALS',
    sections: [
      {
        title: 'Creating expected graphs',
        body: 'Learn to compile a schema file declaring states and transition maps, and upload it directly using Tellann APIs.',
      },
    ],
  },
  {
    slug: 'tutorials/compare-expected-observed',
    title: 'Compare Expected vs Observed Behavior',
    description: 'Resolve reconciliation results after a release pipeline run.',
    category: '🎓 TUTORIALS',
    sections: [
      {
        title: 'Topological analysis',
        body: 'Walk through real reconciliation report findings to promote valid code paths or log developer bugs for unexpected branches.',
      },
    ],
  },
];

export function getDoc(slug: string) {
  return docs.find((doc) => doc.slug === slug);
}
