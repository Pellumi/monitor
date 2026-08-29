`/careers` should feel like an extension of Tellann’s engineering philosophy, not a generic HR page.

Its job is to answer:

**What are we building? Why is it technically interesting? What kind of people belong here? How do we work? Are there open roles? What happens if I apply?**

Because the current product documents define Tellann’s mission, architecture, technical direction, security posture, and three-phase roadmap—but do **not** define employee benefits, compensation bands, office policy, headcount, or current openings—the page should be designed to support those later without inventing them now. 

# `/careers` — Complete Page Specification

## 1. Primary objective

The page should serve three visitor types:

```text
Interested engineer
→ "Is this technically interesting?"

Potential candidate
→ "Would I want to work here?"

Active applicant
→ "What roles are open and how do I apply?"
```

The conversion goal is therefore:

```text
Understand Tellann
        ↓
Understand the mission
        ↓
Understand the engineering challenge
        ↓
Understand how the company thinks
        ↓
Find a relevant role
        ↓
Read role details
        ↓
Apply
```

If no positions are currently open:

```text
Understand Tellann
        ↓
No matching opening
        ↓
Join future opportunities / follow updates
```

---

# 2. Recommended route architecture

The careers system should ultimately become:

```text
/careers
│
├── /careers/[job-slug]
│
└── optionally later:
    /careers/engineering
    /careers/design
    /careers/product
```

Example:

```text
/careers/senior-backend-engineer
/careers/frontend-engineer
/careers/platform-engineer
```

Do not create department routes until enough positions exist to justify them.

---

# 3. Complete `/careers` page structure

```text
/careers
│
├── 01 Navigation
├── 02 Careers Hero
├── 03 Why Work on Tellann
├── 04 The Technical Problem
├── 05 What We're Building
├── 06 How We Think
├── 07 Engineering Environment
├── 08 Areas You Could Work On
├── 09 Working at Tellann
├── 10 Open Positions
├── 11 Hiring Process
├── 12 Candidate Principles
├── 13 No-Openings State
├── 14 Careers FAQ
├── 15 Final CTA
└── 16 Footer
```

---

# 4. Section 01 — Navigation

Use the standard marketing navbar:

```text
Tellann

Product
Solutions
Developers
Resources
Pricing
Company

                         Sign in
                       Start free
```

In the Company mega menu:

```text
Company Overview
Careers
Contact
Brand
Roadmap
```

`Careers` is active.

---

# 5. Section 02 — Careers hero

The hero should sell the problem worth working on.

### Eyebrow

```text
CAREERS AT TELLANN
```

### H1

Recommended:

> **Help build software that can understand its own behavior.**

Alternative:

> **Build the intelligence layer for software quality.**

I prefer the first for careers because it feels more ambitious without claiming Phase 3 already exists.

---

## Supporting copy

> Tellann is building behavioral quality intelligence for software teams—starting with application observation, workflow modeling, coverage analysis, session reconstruction, and quality reporting, then evolving toward continuous production intelligence and autonomous validation.

That progression is consistent with the established product roadmap.  

---

## Primary CTA

If roles exist:

```text
[ View open roles ]
```

Scroll:

```text
#open-roles
```

Secondary:

```text
[ Learn what we're building ]
```

→ `/product`

---

# 6. Hero visual

Do not use stock photos of people laughing around laptops.

Use the product challenge.

Something like:

```text
Events
  ↓
Sessions
  ↓
States
  ↓
Transitions
  ↓
Workflows
  ↓
Behavior Graph
  ↓
Quality Intelligence
```

This is far more relevant to the kind of engineer Tellann wants to attract. The Behavior Graph is the platform’s central behavioral model. 

You could animate the graph slowly constructing itself.

---

# 7. Section 03 — Why work on Tellann

Heading:

> **A difficult problem worth solving.**

Then three large points.

### 01 — Software produces enormous evidence

```text
Routes
Clicks
API activity
State changes
Errors
Timing
Workflow outcomes
```

But most of it remains fragmented.

The Tellann event model already treats these behaviors as structured input for later quality analysis. 

---

### 02 — Quality is still largely reconstructed manually

Teams often reason about application behavior through:

```text
test suites
tickets
logs
dashboards
analytics
human memory
```

Tellann's product thesis is that behavioral evidence itself can become a quality model. 

---

### 03 — The long-term problem is bigger than testing

```text
Observe
↓
Understand
↓
Evaluate
↓
Explain
↓
Validate
```

Tellann is attempting to make that progression systematic.

---

# 8. Section 04 — The technical problem

Heading:

> **We're not building another dashboard over telemetry.**

This is where technically serious candidates should become interested.

Explain the transformation:

```text
Raw events
      ↓
Session reconstruction
      ↓
State extraction
      ↓
Transition discovery
      ↓
Workflow discovery
      ↓
Behavior Graph
      ↓
Coverage analysis
      ↓
Quality findings
```

The processing and graph architecture are explicitly defined this way across the system architecture, data flow, and Behavior Graph specifications.   

---

# 9. Technical challenges

Use an editorial grid.

### Event systems

> Handle high-volume behavioral telemetry while preserving ordering, traceability and tenant isolation.

Tellann targets near-real-time ingestion and horizontal scaling for very large event volumes. 

### Behavioral modeling

> Convert noisy event streams into meaningful states, transitions and workflows.

### Graph systems

> Build behavioral models that remain explainable and useful as applications become complex.

### Replay

> Reconstruct useful behavioral timelines without relying on raw screen recordings.

Tellann’s replay specification defines replay as event-driven behavioral reconstruction. 

### Privacy

> Observe enough to understand behavior without collecting what should never leave the customer environment.



### Distributed analytics

> Coordinate ingestion, streaming, processing, persistence and reporting without turning the platform into an operational maze.

---

# 10. Section 05 — What we're building

Heading:

> **Build across the entire behavioral intelligence stack.**

Use three phases.

## Today — Behavioral QA

```text
SDKs
Event ingestion
Demonstration Mode
Session reconstruction
Session Replay
Behavior Graphs
Coverage analysis
Missing states
Missing flows
Endpoint analysis
QA reporting
```

These are the defined MVP capabilities. 

---

## Next — Production intelligence

```text
Continuous monitoring
Workflow health
Journey intelligence
Error correlation
Database intelligence
Production behavior
```



---

## Future — Autonomous validation

```text
Test generation
Regression analysis
Failure simulation
Anomaly detection
Quality intelligence
Explainable recommendations
```



Use explicit labels:

```text
CURRENT
PLANNED
FUTURE
```

Never imply all three are shipping.

---

# 11. Section 06 — How we think

Heading:

> **Principles before perks.**

Since Tellann's employee-benefit package is not currently defined in the supplied material, the careers page should initially emphasize the principles people would actually be joining.

I would use six.

---

## Evidence over assumption

> We prefer observable evidence to confident guesses.

This mirrors Tellann itself.

---

## Understand before automate

> We want to understand behavior before delegating increasingly consequential decisions to automation.

The MVP deliberately excludes premature autonomous QA. 

---

## Explain what the system knows

> A finding should be traceable to evidence.

The platform's future intelligence requirements explicitly call for explainability, confidence indicators and supporting rationale. 

---

## Privacy is architecture

> Privacy belongs in capture and processing design, not merely in legal copy.

Tellann's architecture requires privacy filtering before sensitive information enters downstream analytics. 

---

## Build systems that evolve

> Phase 1 cannot become technical debt that prevents Phase 3.

The architecture explicitly requires evolution across the product phases without architectural redesign. 

---

## Developer trust is earned

> Instrumentation that slows an application, surprises a developer, or captures more than necessary has failed.

SDK overhead and privacy are explicit non-functional constraints. 

---

# 12. Section 07 — Engineering environment

Heading:

> **The systems behind Tellann.**

This is where the careers page can expose more implementation detail than the homepage.

The documented stack currently includes:

### Application and dashboard

```text
TypeScript
React
Next.js
```

### SDK ecosystem

```text
JavaScript
TypeScript
React
Next.js
Node.js
Express
NestJS
Fastify
```



### Event and processing infrastructure

```text
OpenTelemetry
Kafka
Redis
```

### Data

```text
PostgreSQL
ClickHouse
Object Storage
Graph storage
```

The architecture documents also contemplate Neo4j for graph persistence as the platform evolves. 

### Infrastructure

```text
Docker / OCI containers
Kubernetes
Cloud infrastructure
CI/CD
```



### Observability

```text
OpenTelemetry
Prometheus
Grafana
Loki
```



---

# 13. Important stack disclaimer

Do not write:

> "You must know all of these."

Instead:

> Different roles touch different parts of the stack. We care more about strong systems thinking and the ability to learn than matching every technology keyword.

Otherwise the careers page becomes a shopping list.

---

# 14. Section 08 — Areas you could work on

This is useful even before many jobs exist.

Heading:

> **Where difficult work lives.**

Use six areas.

### SDK & instrumentation

```text
Browser capture
Framework integrations
Event tracking
Privacy filtering
Performance overhead
```

---

### Backend platform

```text
Ingestion
APIs
Authentication
Tenant isolation
Processing coordination
```

---

### Behavioral systems

```text
State discovery
Transition modeling
Workflow discovery
Graph generation
Coverage
```

---

### Data & analytics

```text
ClickHouse
Telemetry analytics
Aggregation
Historical analysis
Performance
```

---

### Product engineering

```text
Dashboard
Graph visualization
Session replay
Reports
Developer onboarding
```

---

### Infrastructure & reliability

```text
Kafka
Kubernetes
Observability
Scaling
Deployment
Disaster recovery
```

These map cleanly to Tellann's component hierarchy. 

---

# 15. Future technical areas

You can add a subtle:

```text
LATER
```

section for:

```text
Regression systems
Anomaly detection
Generated tests
Failure simulation
Explainable quality intelligence
```

This helps attract people interested in longer-term research/ML systems without misrepresenting current implementation.

---

# 16. Section 09 — Working at Tellann

This section must be handled carefully.

The current system documents do **not** define:

* remote/hybrid/in-office policy;
* working hours;
* vacation;
* equipment;
* health insurance;
* equity;
* salary bands;
* geographic hiring restrictions;
* visa sponsorship.

So I would build the section but only populate verified company policies.

Structure:

```text
Working at Tellann

Location
[actual policy]

Work model
[actual policy]

Employment type
[actual policy]

Compensation
[actual policy]

Benefits
[actual benefits]

Equipment
[actual policy]
```

Until those are finalized, hide unavailable rows.

Do not fill the page with startup clichés.

---

# 17. Better early-stage version

Before formal benefits exist, use:

> **What you can expect from the work**

Then:

```text
High ownership

Small-team decision making

Direct exposure to product architecture

Work across meaningful system boundaries

Strong emphasis on technical reasoning

A product still early enough to shape
```

These are reasonable only if they accurately reflect how Tellann will operate. If not, don't publish them as promises.

---

# 18. Section 10 — Open positions

Anchor:

```text
#open-roles
```

Heading:

> **Open roles**

Provide filters once necessary:

```text
All teams ▾
All locations ▾
All employment types ▾
```

Don't show filters if there are only two jobs.

---

# 19. Job card design

Each role card:

```text
BACKEND ENGINEERING

Senior Backend Engineer

Build ingestion, processing and
behavioral analysis services.

Remote / Location
Full-time

                         View role →
```

Minimum data model:

```ts
type JobPosting = {
  id: string;
  slug: string;
  title: string;
  team: string;
  location: string;
  workModel?: string;
  employmentType: string;

  summary: string;

  status:
    | "OPEN"
    | "PAUSED"
    | "CLOSED";

  publishedAt?: string;
};
```

---

# 20. Role detail page

Each:

```text
/careers/[slug]
```

should contain:

```text
Role
Team
Location
Work model
Employment type

About Tellann

About the role

What you'll work on

Responsibilities

What we're looking for

Useful experience

What you do NOT need

Compensation
(if publicly defined)

Benefits
(if defined)

Hiring process

Equal opportunity statement
(if formally adopted)

Apply
```

---

# 21. Don't write impossible requirements

Avoid job specifications like:

```text
10 years of Neo4j
7 years of Next.js
AI + Kubernetes + React + Kafka + UX
```

for one engineer.

Roles should reflect actual ownership.

For instance, a platform/backend engineer may need:

```text
distributed systems
event processing
databases
API design
performance
```

while Kafka-specific expertise is useful but teachable.

---

# 22. Section 11 — Hiring process

Heading:

> **What to expect**

Only publish the stages once you actually adopt them.

A sensible structure could eventually be:

```text
01
Application

02
Intro conversation

03
Technical discussion

04
Practical exercise / work review

05
Final conversation

06
Decision
```

But treat this as an implementation template, **not yet an established Tellann policy**, because the supplied documents do not define a hiring process.

---

# 23. Candidate experience principle

If you implement hiring, I would strongly recommend stating:

> **We should be able to explain why every interview stage exists.**

This fits Tellann's broader explainability philosophy.

Avoid seven rounds because "serious companies do seven rounds."

---

# 24. Technical exercise

If Tellann uses one later, prefer:

```text
small realistic problem
+
written reasoning
+
discussion
```

over:

```text
8-hour unpaid production clone
```

Again, this is a recommendation, not something specified in the current project sources.

---

# 25. Section 12 — What we value in candidates

Heading:

> **What matters here.**

Avoid personality-code nonsense such as:

> We're looking for rockstars.

Use:

### Systems thinking

Can you reason beyond one function or component?

### Curiosity

Can you investigate behavior instead of prematurely assuming its cause?

### Precision

Can you distinguish what the evidence shows from what you merely suspect?

### Ownership

Can you carry a problem from understanding through implementation and validation?

### Communication

Can you explain complex technical ideas without hiding behind jargon?

### Skepticism

Can you challenge a design—including our own—when the evidence says it is wrong?

These fit the nature of the product better than generic corporate values.

---

# 26. Section 13 — No-openings state

This is essential because Tellann may not always be hiring.

Don't leave:

```text
No jobs found.
```

Use:

> **No open roles right now.**

Supporting:

> We're still building. When we open new roles, they'll appear here.

Then options:

```text
[ Follow Tellann ]
[ Explore what we're building ]
```

Potentially later:

```text
[ Join the talent network ]
```

but only if you actually build a system to retain candidate information and handle its privacy properly.

---

# 27. Do not collect speculative CVs casually

Avoid:

```text
Send your CV to careers@tellann.co
```

unless you have:

* a retention policy;
* privacy disclosure;
* applicant data handling process;
* actual intent to review them.

Applicant data is personal data.

Given Tellann's own privacy posture, its hiring process should not be sloppy about candidate information.

---

# 28. Section 14 — Careers FAQ

Recommended questions once policies are known.

### Are you currently hiring?

Dynamic answer based on open positions.

### Where does Tellann hire?

Only answer once geographic policy exists.

### Is Tellann remote?

Only if formally decided.

### Do I need experience with every technology in your stack?

Recommended answer:

> No. Individual roles will describe the experience actually relevant to that role.

### Can I apply to multiple roles?

Define policy when application system exists.

### What happens after I apply?

Link to hiring process.

### Can agencies submit candidates?

Define explicitly later.

### Do you accept internships?

Only say yes if they actually exist.

---

# 29. Section 15 — Final CTA

If jobs are open:

> **Find the part of Tellann you want to build.**

```text
[ View open roles ]
```

If none are open:

> **We're building the foundation now.**

```text
[ Explore Tellann ]
[ View roadmap ]
```

---

# 30. Footer

Use the full marketing footer.

Company section:

```text
Company
Careers
Contact
Brand
Roadmap
```

Careers is current.

---

# 31. Desktop page hierarchy

Visually:

```text
NAV
────────────────────────────────

CAREERS HERO

Help build software that
can understand its own behavior.

[ View open roles ]

Large behavior graph visual

────────────────────────────────

A DIFFICULT PROBLEM
WORTH SOLVING

────────────────────────────────

THE TECHNICAL PROBLEM

Events → Sessions → Graph → Quality

────────────────────────────────

WHAT WE'RE BUILDING

Today      Next      Future

────────────────────────────────

HOW WE THINK

01 Evidence
02 Understand
03 Explain
04 Privacy
05 Trust
06 Evolution

────────────────────────────────

ENGINEERING ENVIRONMENT

SDK / Platform / Data / Infra

────────────────────────────────

WHERE YOU CAN WORK

6 engineering/product areas

────────────────────────────────

WORKING AT TELLANN

verified policies only

────────────────────────────────

OPEN ROLES

[ role ]
[ role ]
[ role ]

────────────────────────────────

HIRING PROCESS

────────────────────────────────

FAQ

────────────────────────────────

FINAL CTA

────────────────────────────────

FOOTER
```

---

# 32. Mobile structure

```text
Hero
↓
Mission
↓
Technical challenge
↓
What we're building
↓
Principles
↓
Engineering environment
↓
Areas
↓
Working at Tellann
↓
Open roles
↓
Hiring process
↓
FAQ
↓
CTA
↓
Footer
```

Job cards become full-width.

Filters become:

```text
[ Filter roles ]
```

opening a drawer/bottom sheet.

---

# 33. Careers page visual style

Do not suddenly turn Careers into a colorful HR microsite.

Keep the established Tellann monochrome system.

Visual assets should primarily be:

* behavior graphs;
* code;
* event streams;
* engineering diagrams;
* selective product visuals;
* later, real team photography.

If team photos are eventually used, use actual Tellann people—not stock images.

---

# 34. Engineering code motif

One section could show real-looking system language:

```text
PAGE_VISIT
      ↓
STATE_ENTERED
      ↓
BUTTON_CLICK
      ↓
API_REQUEST
      ↓
API_RESPONSE
      ↓
STATE_TRANSITION
```

These event types are grounded in Tellann's event taxonomy. 

Subheading:

> This is the language we're teaching Tellann to understand.

That's much more distinctive than a stock developer terminal.

---

# 35. Job data source

Do not hardcode jobs into `page.tsx`.

Initially:

```text
CMS / database
       ↓
Careers service
       ↓
/careers
```

or a simple structured content source.

Later you can integrate an ATS.

Page needs:

```text
getOpenJobs()
```

and job detail pages need:

```text
getJobBySlug()
```

---

# 36. Careers state model

Your page should support:

```text
LOADING

OPEN_ROLES

NO_OPEN_ROLES

ERROR
```

If job fetching fails:

Don't display:

```text
There are no roles available.
```

because an API failure is not the same as zero jobs.

Use:

> We're having trouble loading openings. Please try again.

---

# 37. Structured data

Every individual job page should eventually output:

```text
JobPosting
```

schema containing only accurate data:

```text
title
description
datePosted
employmentType
hiringOrganization
jobLocation
applicantLocationRequirements
baseSalary
```

only where applicable.

Do not fabricate salary values just to satisfy schema.

---

# 38. SEO metadata

For `/careers`:

### Title

```text
Careers at Tellann — Build Behavioral Quality Intelligence
```

### Meta description

```text
Explore careers at Tellann and help build behavioral intelligence systems for software quality, workflow modeling, session analysis, developer tooling and distributed infrastructure.
```

### Canonical

```text
https://tellann.co/careers
```

---

# 39. Job detail SEO

Example:

```text
Senior Backend Engineer | Careers at Tellann
```

Canonical:

```text
https://tellann.co/careers/senior-backend-engineer
```

When closed:

* remove `JobPosting` schema;
* mark clearly as closed;
* either keep page for a short period or redirect based on recruitment policy.

---

# 40. Analytics

Track:

```text
CAREERS_PAGE_VIEWED

CAREERS_OPEN_ROLES_VIEWED

CAREERS_TEAM_FILTER_CHANGED
CAREERS_LOCATION_FILTER_CHANGED

CAREERS_ROLE_CLICKED

CAREERS_PRINCIPLES_VIEWED
CAREERS_ENGINEERING_SECTION_VIEWED

CAREERS_ROADMAP_CLICKED
CAREERS_PRODUCT_CLICKED
```

For job pages:

```text
JOB_PAGE_VIEWED
JOB_APPLY_CLICKED
JOB_APPLICATION_STARTED
JOB_APPLICATION_COMPLETED
```

Be cautious about tracking sensitive applicant information.

---

# 41. Component architecture

```text
CareersPage
│
├── MarketingNavbar
├── CareersHero
├── WhyTellannCareers
├── TechnicalChallenge
├── ProductEvolution
├── CareersPrinciples
├── EngineeringStack
├── WorkAreas
├── WorkEnvironment
├── OpenRoles
│   ├── JobFilters
│   ├── JobList
│   └── JobCard[]
├── HiringProcess
├── CandidateValues
├── CareersFAQ
├── FinalCTA
└── MarketingFooter
```

---

# 42. Data structures

### Job

```ts
interface Job {
  id: string;
  slug: string;

  title: string;
  team: string;

  location: string;
  workModel?: "REMOTE" | "HYBRID" | "ONSITE";
  employmentType:
    | "FULL_TIME"
    | "PART_TIME"
    | "CONTRACT"
    | "INTERNSHIP";

  summary: string;

  responsibilities: string[];
  requirements: string[];
  preferred?: string[];

  status:
    | "DRAFT"
    | "OPEN"
    | "PAUSED"
    | "CLOSED";

  publishedAt?: string;
}
```

---

# 43. Dynamic hero behavior

If positions exist:

```text
We're hiring.

Help build software that
can understand its own behavior.

[ View 4 open roles ]
```

If none:

```text
Help build software that
can understand its own behavior.

No open roles today.
See what we're building.

[ View roadmap ]
```

Better than having stale "We're hiring!" copy forever.

---

# 44. How Careers relates to Company

Keep their purposes clean.

```text
/company
    ↓
Why does Tellann exist?


/careers
    ↓
Why would I help build it?
```

The careers page can therefore reuse:

* mission;
* vision;
* principles;
* roadmap;

but should reinterpret them around **work**, not duplicate entire sections verbatim.

---

# 45. What I would explicitly avoid

Do not launch `/careers` with:

```text
"We're a family."
```

Don't.

Also avoid:

```text
Work hard, play hard
Rockstar engineers
Ninja developers
Unlimited growth
Move fast and break things
Best-in-class compensation
Industry-leading benefits
Global remote team
```

unless those statements become concrete and verifiable.

For Tellann, the intellectual challenge is compelling enough. There is no reason to decorate it with startup clichés.

---

# 46. What should be implemented now

Even before hiring begins, I would ship:

```text
/careers

✓ Careers hero
✓ Mission / technical challenge
✓ Product roadmap
✓ Principles
✓ Engineering areas
✓ Technology environment
✓ Open-role component
✓ Empty-role state
✓ Careers FAQ shell
✓ Footer
```

Hide:

```text
Compensation
Benefits
Location policy
Hiring-process details
Open-job filters
Candidate talent network
```

until those policies/data actually exist.

That gives Tellann a credible careers page **without pretending the company is larger or more operationally mature than it is**.

The page's core message should be simple: Tellann is tackling a hard systems problem across developer tooling, event processing, behavioral graphs, privacy, analytics and eventually autonomous software quality. Someone should want to work there because **the problem is difficult and meaningful**, not because the page has pictures of beanbags.  
