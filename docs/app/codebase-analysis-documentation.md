What you are describing is essentially a **Codebase Intelligence Engine**: a system that ingests an arbitrary software repository, converts it into a structured semantic model, discovers what the software does, and exposes that understanding through several complementary maps.

The key architectural decision is this:

> **Do not build four independent mapping systems. Build one canonical code knowledge graph, then generate hierarchical, dependency, architecture, and graph views from it.**

Tree-sitter is a strong foundation for language-independent parsing because it produces concrete syntax trees and supports incremental parsing. For deeper semantics—definitions, references, implementations, types—you should supplement syntax parsing with compiler/language-server information. LSP standardizes capabilities such as go-to-definition and find-references, while SCIP provides a language-agnostic indexing format specifically intended for precise code intelligence. ([tree-sitter.github.io][1])

---

# 1. What the finished system should be able to answer

A developer should eventually be able to give your system a repository and ask things like:

* What languages and frameworks does this project use?
* What is the application entry point?
* Where is authentication implemented?
* What happens when `POST /orders` is called?
* Which service sends emails?
* Which modules interact with Stripe?
* Which files are responsible for user registration?
* Which database tables does checkout modify?
* Which functions depend on `PaymentService`?
* What would potentially break if I changed `UserRepository`?
* Which modules form the payments domain?
* What are the major architectural domains?
* What background jobs exist?
* What event consumers exist?
* Which external APIs does the application call?
* Which parts of the system are highly coupled?
* Where are circular dependencies?
* What functionality has changed between commit A and commit B?

And ultimately:

> **“Explain everything this application can do.”**

That last question requires substantially more than an AST.

---

# 2. Overall architecture

I would structure the system like this:

```text
                       ┌───────────────────┐
                       │ Git Repository    │
                       │ commit/branch     │
                       └─────────┬─────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Repository Scanner      │
                    │                         │
                    │ files                   │
                    │ folders                 │
                    │ languages               │
                    │ manifests               │
                    │ frameworks              │
                    │ configs                 │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Language Analyzers      │
                    │                         │
                    │ Tree-sitter             │
                    │ compiler APIs           │
                    │ LSP / SCIP              │
                    │ framework adapters      │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Canonical Code IR       │
                    │                         │
                    │ symbols                 │
                    │ modules                 │
                    │ endpoints               │
                    │ calls                   │
                    │ DB operations           │
                    │ events                  │
                    │ external services       │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┼────────────────┐
                 ▼               ▼                ▼
       ┌─────────────────┐ ┌──────────────┐ ┌───────────────┐
       │ Semantic Linker │ │Domain Engine │ │Behavior Engine│
       │                 │ │              │ │               │
       │ resolve calls   │ │payments      │ │user flows     │
       │ references      │ │auth          │ │side effects   │
       │ imports         │ │catalog       │ │capabilities   │
       └────────┬────────┘ └──────┬───────┘ └───────┬───────┘
                └─────────────────┼───────────────────┘
                                  ▼
                      ┌──────────────────────┐
                      │ Code Knowledge Graph │
                      │ Neo4j / FalkorDB     │
                      └──────────┬───────────┘
                                 │
           ┌─────────────────────┼────────────────────────┐
           ▼                     ▼                        ▼
    Hierarchy Map         Dependency Map          Architecture Map
                                                           │
                                                           ▼
                                                   Graph Explorer
                                                           │
                                                           ▼
                                                  Natural-language
                                                   Code Assistant
```

The **canonical Code IR + knowledge graph** is the heart of the system.

Everything else becomes a projection of it.

---

# 3. Stage 1 — Repository ingestion

The first component is a repository scanner.

Suppose somebody gives you:

```text
https://github.com/company/project
```

or uploads a ZIP.

You clone/extract the repository and create a snapshot associated with:

```text
repositoryId
branch
commitHash
timestamp
```

Never analyze merely `"main"`.

Analyze:

```text
main @ 926fcc07
```

because your map has to represent a particular version of reality.

---

# 4. Build the hierarchical map first

This corresponds directly to your first strategy.

Consider:

```text
project/
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   ├── auth/
│   ├── database/
│   └── payments/
├── prisma/
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

Create nodes for:

```text
Repository
Directory
File
Package
Workspace
```

and relationships:

```text
Repository
   └─CONTAINS→ Directory
                  └─CONTAINS→ File
```

But don't stop at directories.

Extract metadata.

For every file:

```text
path
extension
language
size
generated?
test?
configuration?
entrypoint?
framework?
```

You might discover:

```text
Languages
─────────
TypeScript       71%
SQL              11%
CSS               8%
Dockerfile        3%
Shell             2%
Other             5%
```

Then identify special files:

```text
package.json
pnpm-workspace.yaml
tsconfig.json
next.config.ts
Dockerfile
docker-compose.yml
prisma/schema.prisma
.github/workflows/*
.env.example
```

These often reveal architecture before you inspect application code.

---

# 5. Detect repository boundaries

One repository does not necessarily equal one application.

For example:

```text
/apps/web
/apps/api
/apps/admin
/services/billing
/services/notifications
/packages/common
/packages/database
```

Your scanner should detect:

```text
Repository
Application
Service
Package
Library
Module
```

For a monorepo:

```text
Repository
├── Application: web
├── Application: admin
├── Service: api
├── Service: worker
├── Package: database
└── Package: shared
```

Package manifests are especially important.

For JavaScript:

```text
package.json
pnpm-workspace.yaml
yarn.lock
package-lock.json
```

Python:

```text
pyproject.toml
requirements.txt
setup.py
```

Java:

```text
pom.xml
build.gradle
```

Go:

```text
go.mod
```

Rust:

```text
Cargo.toml
```

.NET:

```text
*.sln
*.csproj
```

They provide explicit dependency information and project boundaries.

---

# 6. Stage 2 — Parse source code

Now the real analysis begins.

Do **not** build this primarily using regex.

Regex is useful for very narrow fallback cases, but code is structured syntax.

Use parsers.

Tree-sitter is particularly suitable for the first layer because it supports numerous languages, provides syntax node positions, and is designed for fast incremental parsing. ([tree-sitter.github.io][1])

For:

```ts
class PaymentService {
  async charge(user: User, amount: number) {
    return stripe.paymentIntents.create({
      amount,
    });
  }
}
```

you want something conceptually like:

```text
Class
  name = PaymentService

  Method
    name = charge

    Parameters
      user
      amount

    CallExpression
      stripe.paymentIntents.create
```

---

# 7. Create language analyzer plugins

Do not put every language inside your core.

Design an interface:

```ts
interface LanguageAnalyzer {
    supports(file: SourceFile): boolean;

    parse(file: SourceFile): ParsedFile;

    extractSymbols(file: ParsedFile): Symbol[];

    extractImports(file: ParsedFile): Import[];

    extractCalls(file: ParsedFile): Call[];

    extractInheritance(file: ParsedFile): Inheritance[];

    extractExports(file: ParsedFile): Export[];

    extractAnnotations(file: ParsedFile): Annotation[];
}
```

Then implement:

```text
TypeScriptAnalyzer
PythonAnalyzer
JavaAnalyzer
GoAnalyzer
RustAnalyzer
CSharpAnalyzer
PHPAnalyzer
```

The core engine remains language independent.

---

# 8. AST is not enough

This is one of the most important parts of the project.

Suppose you see:

```ts
sendNotification(user);
```

The AST tells you:

```text
there is a call expression called sendNotification
```

It does **not necessarily tell you which `sendNotification` implementation gets called**.

You need semantic resolution.

For TypeScript, for example:

```text
TypeScript compiler
```

can resolve:

```text
symbol
type
definition
reference
module
```

Similarly:

```text
Java → JDT
Python → Pyright
Go → gopls
C# → Roslyn
Rust → rust-analyzer
```

Instead of building a bespoke abstraction for every language, LSP and SCIP can provide useful common layers. LSP standardizes language-server operations, while SCIP represents code intelligence such as symbol occurrences and references in a language-independent index. ([Microsoft GitHub][2])

Your strategy should therefore be:

```text
Tree-sitter
     +
Compiler/LSP/SCIP
     +
Framework-specific analysis
```

not:

```text
Tree-sitter alone
```

---

# 9. The canonical intermediate representation

Before writing anything into Neo4j, normalize everything into a common representation.

For example:

```ts
interface CodeEntity {
    id: string;

    type:
      | "repository"
      | "application"
      | "service"
      | "package"
      | "directory"
      | "file"
      | "module"
      | "class"
      | "interface"
      | "function"
      | "method"
      | "variable"
      | "endpoint"
      | "database_model"
      | "database_table"
      | "event"
      | "queue"
      | "job"
      | "external_service"
      | "domain";

    name: string;

    file?: string;

    startLine?: number;
    endLine?: number;

    language?: string;

    metadata: Record<string, unknown>;
}
```

And:

```ts
interface CodeRelationship {
    source: string;
    target: string;

    type:
      | "CONTAINS"
      | "DEFINES"
      | "IMPORTS"
      | "CALLS"
      | "USES"
      | "IMPLEMENTS"
      | "EXTENDS"
      | "READS"
      | "WRITES"
      | "ROUTES_TO"
      | "PUBLISHES"
      | "SUBSCRIBES_TO"
      | "DEPENDS_ON"
      | "TESTS"
      | "CONFIGURES"
      | "BELONGS_TO_DOMAIN";

    confidence: number;

    evidence: Evidence[];
}
```

That abstraction is what makes polyglot repositories manageable.

---

# 10. Every relationship needs evidence

This is a feature I would consider mandatory.

Suppose your system says:

```text
CheckoutService → CALLS → PaymentService
```

Store:

```json
{
  "confidence": 1,
  "evidence": {
    "type": "compiler-reference",
    "file": "src/checkout/checkout.service.ts",
    "line": 127
  }
}
```

But perhaps you infer:

```text
EmailService → BELONGS_TO_DOMAIN → Notifications
```

That might be:

```json
{
  "confidence": 0.83,
  "evidence": [
    "directory:/notifications",
    "class-name:EmailService",
    "dependency:NotificationRepository"
  ]
}
```

Your system should understand the difference between:

> **I know this.**

and:

> **I strongly suspect this.**

That becomes enormously important when an AI layer is added later.

---

# 11. Stage 3 — Dependency mapping

Now construct your second map.

Dependencies exist at several levels.

### Level 1 — Package dependencies

From:

```json
{
  "dependencies": {
    "stripe": "...",
    "express": "...",
    "redis": "..."
  }
}
```

produce:

```text
API
 ├─DEPENDS_ON→ Express
 ├─DEPENDS_ON→ Stripe
 └─DEPENDS_ON→ Redis
```

---

# 12. Module dependencies

From:

```ts
import { PaymentService } from "../payments/payment.service";
```

produce:

```text
CheckoutModule
       │
       └──IMPORTS──→ PaymentModule
```

Resolve things like:

```text
../../foo
@/foo
@company/foo
workspace:*
tsconfig aliases
```

properly.

Do not merely store the import string.

Resolve it to the actual node.

---

# 13. Symbol dependencies

Then go deeper:

```text
CheckoutController
       │
       ▼
CheckoutService
       │
       ▼
PaymentService
       │
       ▼
StripeGateway
       │
       ▼
Stripe SDK
```

Now you have a call graph.

The dependency map might therefore operate at selectable resolutions:

```text
Repository
Application
Service
Package
Module
File
Class
Function
```

Zooming out collapses nodes.

Zooming in expands them.

That is important because displaying 90,000 functions simultaneously is useless.

---

# 14. Detect database dependencies

This is necessary if your goal is functionality understanding.

Analyze:

```text
Prisma
TypeORM
Sequelize
Drizzle
Hibernate
Entity Framework
SQLAlchemy
raw SQL
Mongo queries
Redis
```

For:

```ts
await prisma.user.findUnique(...)
```

produce:

```text
Function
    │
    └──READS──→ User
```

For:

```ts
await prisma.order.create(...)
```

produce:

```text
Function
    │
    └──WRITES──→ Order
```

Now suddenly your graph can answer:

> Which functionality modifies orders?

---

# 15. Understand HTTP APIs

Framework analyzers are extremely valuable.

For NestJS:

```ts
@Controller("users")
export class UserController {

    @Post()
    createUser() {}
}
```

extract:

```text
Endpoint
method = POST
path = /users
```

and:

```text
POST /users
      │
      ROUTES_TO
      ▼
UserController.createUser
```

Do the equivalent for:

```text
Express
Fastify
Next.js
Django
Flask
FastAPI
Spring
ASP.NET
Laravel
Rails
```

This is why you need **framework adapters** in addition to language adapters.

---

# 16. Find every type of application entry point

Functionality usually begins at an entry point.

Your system should identify at least:

```text
HTTP endpoints
GraphQL queries
GraphQL mutations
GraphQL subscriptions

CLI commands

scheduled jobs
cron jobs

queue consumers

event listeners

WebSocket handlers

webhooks

serverless functions

UI routes

button/form actions

mobile screens

background workers
```

These become extremely important later.

Think of them as the doors through which behavior enters the system.

---

# 17. Model events and queues

For:

```ts
eventBus.publish("order.created", order);
```

create:

```text
OrderService
      │
      PUBLISHES
      ▼
order.created
```

And:

```ts
@OnEvent("order.created")
sendConfirmation() {}
```

becomes:

```text
order.created
      │
      HANDLED_BY
      ▼
NotificationService.sendConfirmation
```

The resulting flow is:

```text
Checkout
   ↓
Order created
   ↓
order.created
   ├──→ Email
   ├──→ Analytics
   └──→ Inventory
```

Without event analysis, you could completely misunderstand a modern distributed application.

---

# 18. External system detection

Create nodes for services such as:

```text
Stripe
Paystack
SendGrid
Twilio
AWS S3
Firebase
OpenAI
Cloudinary
Slack
Kafka
Redis
PostgreSQL
```

If you see:

```ts
axios.post("https://api.paystack.co/transaction/initialize")
```

represent:

```text
PaymentService
      │
      CALLS_EXTERNAL
      ▼
Paystack
```

Environment configuration can help:

```text
STRIPE_SECRET_KEY
DATABASE_URL
REDIS_URL
KAFKA_BROKERS
AWS_BUCKET
```

But environment-variable names should be treated as supporting evidence, not conclusive evidence.

---

# 19. Now build the architecture map

This is your third strategy.

At this point your graph might contain:

```text
45,000 functions
6,000 files
1,400 classes
380 database relationships
120 HTTP endpoints
50 external APIs
```

Nobody wants an architecture diagram containing all of those.

Architecture mapping is about **compression**.

You want:

```text
                Authentication
                      │
                      ▼
Users ───────────→ Orders
                      │
                      ▼
                  Payments
                      │
                ┌─────┴─────┐
                ▼           ▼
          Notifications   Analytics
```

rather than individual files.

---

# 20. Introduce Domain nodes

Create nodes such as:

```text
Domain: Authentication
Domain: Users
Domain: Payments
Domain: Catalog
Domain: Orders
Domain: Notifications
Domain: Analytics
Domain: Search
```

Then:

```text
PaymentController
PaymentService
StripeGateway
TransactionRepository
PaymentWebhookHandler
```

all become:

```text
BELONGS_TO_DOMAIN → Payments
```

Architecture becomes an aggregation query over the detailed graph.

---

# 21. How do you discover domains automatically?

Use several signals together.

For example:

### Directory structure

```text
src/payments/*
```

strongly suggests:

```text
Payments
```

### Names

```text
PaymentService
TransactionRepository
StripeGateway
```

provide semantic signals.

### Shared database models

If 17 files heavily interact with:

```text
Transaction
Payment
Invoice
```

they probably form a domain.

### Shared routes

```text
/payments/*
/billing/*
/invoices/*
```

provide another signal.

### Dependency density

If:

```text
A → B
B → C
C → A
```

frequently, these components may form a cohesive architectural unit.

Graph community-detection algorithms such as Louvain or Leiden can help identify densely connected component groups. Neo4j's current Graph Data Science tooling provides several community-detection algorithms, including Louvain, Leiden and strongly connected components. ([Neo4j Graph Intelligence Platform][3])

But don't blindly declare:

```text
Louvain cluster 17 = payments
```

Use clustering to propose boundaries.

Semantic evidence should name and validate them.

---

# 22. Strongly connected components are especially useful

Suppose:

```text
Users → Orders
Orders → Payments
Payments → Users
```

There may be problematic architectural coupling.

Strongly Connected Components can identify directed areas where everything can ultimately reach everything else. ([Neo4j Graph Intelligence Platform][4])

That makes your system useful not just for understanding code but for discovering architectural problems.

---

# 23. Stage 4 — The graph-based map

This becomes your fourth mapping strategy and the underlying storage mechanism.

I would use a **property graph**.

Neo4j and FalkorDB both fit this model. Neo4j uses Cypher for querying its property graph; FalkorDB likewise implements a property graph and OpenCypher, and currently also exposes full-text and vector-search functionality. ([Neo4j Graph Intelligence Platform][5])

Your graph might contain:

```text
(:Repository)
(:Application)
(:Package)
(:Directory)
(:File)
(:Module)

(:Class)
(:Interface)
(:Function)
(:Method)

(:Endpoint)
(:Job)
(:Event)
(:Queue)

(:Database)
(:Table)
(:Model)

(:ExternalService)

(:Domain)

(:Feature)
```

Edges:

```text
CONTAINS
DEFINES
IMPORTS
EXPORTS
CALLS
USES
IMPLEMENTS
EXTENDS

READS
WRITES

ROUTES_TO

PUBLISHES
SUBSCRIBES_TO

DEPENDS_ON
CALLS_EXTERNAL

BELONGS_TO_DOMAIN

TRIGGERS
RETURNS
RENDERS
```

This creates your **Code Knowledge Graph**.

---

# 24. Why the graph database matters

Once everything becomes a graph, questions that are difficult with relational tables become natural.

For example:

> What happens after `POST /checkout`?

Conceptually:

```cypher
MATCH path =
    (endpoint:Endpoint {path: "/checkout"})
    -[:ROUTES_TO|CALLS|PUBLISHES|WRITES*1..12]->
    (dependency)
RETURN path
```

Cypher is specifically designed around matching patterns between nodes and relationships. ([Neo4j Graph Intelligence Platform][6])

---

# 25. Blast-radius analysis becomes possible

Suppose the developer changes:

```text
User.id
```

You can traverse incoming dependencies:

```text
User
 ↑
UserRepository
 ↑
UserService
 ↑
OrderService
 ↑
OrderController
```

and report:

```text
Potentially affected:

12 modules
39 functions
6 API endpoints
3 background jobs
8 tests
2 external workflows
```

That becomes extremely powerful for developers.

---

# 26. But graph structure still doesn't equal functionality

This is where the system becomes much more interesting.

Imagine this call chain:

```text
POST /checkout
      ↓
CheckoutController.checkout
      ↓
CheckoutService.execute
      ↓
InventoryService.reserve
      ↓
PaymentService.charge
      ↓
OrderRepository.create
      ↓
EventBus.publish(order.created)
```

Those are technical facts.

But the human concept is:

> **Checkout**

So introduce another abstraction:

```text
Feature
```

or:

```text
Capability
```

---

# 27. Build a Functionality Discovery Engine

For every application entry point:

```text
HTTP route
UI action
CLI command
event listener
cron job
queue consumer
```

perform bounded graph traversal.

Example:

```text
POST /checkout
```

Follow:

```text
ROUTES_TO
CALLS
READS
WRITES
PUBLISHES
CALLS_EXTERNAL
```

until you reach meaningful side effects.

You might discover:

```text
Trigger:
POST /checkout

Behavior:
1. validates cart
2. checks inventory
3. calculates pricing
4. creates payment
5. creates order
6. reduces stock
7. publishes order.created

External systems:
Stripe

Database:
Cart READ
Product READ
Inventory WRITE
Order WRITE
Payment WRITE

Events:
order.created

Downstream:
Email confirmation
Analytics
```

Now the system can create:

```text
Feature: Checkout
```

---

# 28. A Feature record should look roughly like this

```ts
interface SoftwareFeature {
    id: string;

    name: string;

    description: string;

    domain: string;

    triggers: string[];

    entrypoints: string[];

    workflow: FeatureStep[];

    reads: string[];

    writes: string[];

    externalServices: string[];

    emittedEvents: string[];

    downstreamEffects: string[];

    authorization?: string[];

    sourceFiles: string[];

    confidence: number;

    evidence: Evidence[];
}
```

This is the layer that answers:

> What does the application actually do?

---

# 29. Discover functionality bottom-up and top-down

You need both approaches.

### Top-down

Start from:

```text
POST /checkout
```

and follow execution downstream.

### Bottom-up

Start from interesting side effects:

```text
Stripe API
SendGrid
Order table
Kafka event
S3 upload
```

and trace backwards.

For example:

```text
SendGrid
   ↑
NotificationService
   ↑
order.created
   ↑
CheckoutService
```

Now you know:

```text
Checkout causes an email.
```

This catches functionality that may otherwise be hidden behind asynchronous processing.

---

# 30. Add frontend understanding

For a full-stack system, backend-only analysis is insufficient.

Suppose:

```text
/pages/products/[id].tsx
```

contains:

```ts
const product = await api.products.get(id);
```

and:

```text
BuyButton
   ↓
createCheckout()
   ↓
POST /checkout
```

Your graph should connect:

```text
UI Route
   ↓
Page
   ↓
Component
   ↓
Frontend API Client
   ↓
Backend Endpoint
   ↓
Controller
   ↓
Service
```

Then your functionality map becomes genuinely end-to-end:

```text
User clicks Buy
       ↓
Checkout page
       ↓
POST /checkout
       ↓
Order domain
       ↓
Payments
       ↓
Stripe
```

That is far more valuable than simply mapping backend code.

---

# 31. Static analysis will never give you complete truth

This is where I would be skeptical of the phrase **“understand all functionalities.”**

Static analysis can get extremely far.

But consider:

```text
reflection
runtime dependency injection
eval()
dynamic imports
plugins
generated code
feature flags
environment-dependent behavior
database-driven workflows
external service behavior
message queues
runtime configuration
metaprogramming
```

Some behaviors simply cannot be reliably derived from source syntax alone.

Therefore add another subsystem.

---

# 32. Runtime evidence

Instrument development/test environments with something like:

```text
OpenTelemetry
```

and capture:

```text
HTTP request
↓
controller
↓
service
↓
database query
↓
Kafka
↓
worker
↓
external API
```

Then combine:

```text
STATIC_GRAPH
+
RUNTIME_GRAPH
```

If static analysis believes:

```text
A → B
```

and runtime traces observe:

```text
A → B
```

confidence becomes very high.

Runtime tracing also identifies edges hidden behind dynamic mechanisms.

---

# 33. Tests are another major source of knowledge

Tests often describe software functionality better than production code.

Example:

```ts
describe("checkout", () => {
   it("charges the card and creates an order", ...)
});
```

Extract:

```text
Test
   TESTS
   Checkout
```

and infer supporting evidence:

```text
Feature: Checkout

Expected outcome:
Payment created
Order created
```

Test names, fixtures and assertions can provide extremely strong semantic evidence.

---

# 34. Documentation can become another evidence source

Analyze:

```text
README.md
/docs
OpenAPI
Swagger
GraphQL schemas
ADR files
comments
JSDoc
docstrings
```

But documentation should not override code.

Instead:

```text
Documentation says X
Code suggests X
Runtime confirms X
```

is excellent evidence.

Whereas:

```text
Documentation says X
Code contains no X
```

should generate something like:

```text
Possibly outdated documentation.
```

---

# 35. The role of AI/LLMs

I would definitely use an LLM.

But **not as the parser**.

Do not do:

```text
repository
   ↓
LLM
   ↓
"Tell me what this does"
```

That becomes slow, expensive, inconsistent and difficult to verify.

Instead:

```text
Source code
   ↓
Deterministic parsers
   ↓
Symbols
   ↓
Relationships
   ↓
Graph
   ↓
Evidence bundle
   ↓
LLM
   ↓
Explanation
```

The LLM should interpret structured evidence.

Not manufacture the evidence.

---

# 36. Give the AI constrained context

Instead of sending 400 files, send:

```text
FEATURE CANDIDATE

Entry:
POST /checkout

Call tree:
CheckoutController.checkout
→ CheckoutService.execute
→ InventoryService.reserve
→ PaymentService.charge
→ OrderRepository.create

DB:
READ Cart
READ Product
WRITE Inventory
WRITE Order

External:
Stripe

Events:
order.created

Files:
...
```

Then ask:

```text
Identify the user-facing functionality.
Summarize the workflow.
Do not infer behavior not supported by evidence.
```

You will get far more reliable results.

---

# 37. Confidence scoring

I would implement something like:

```text
Compiler-resolved reference       1.00
Framework configuration           0.98
Explicit manifest dependency      0.98
AST relationship                  0.95
Runtime trace                     1.00
Test assertion                    0.95

Naming heuristic                  0.60
Directory heuristic               0.65
LLM inference                     0.50
```

Then combine corroborating signals.

The exact numbers aren't sacred.

The principle is.

Every inferred fact should be:

```text
fact
confidence
evidence
```

---

# 38. Your four maps now become simple projections

### Hierarchical Map

Uses:

```text
CONTAINS
DEFINES
```

Produces:

```text
Repository
└── Application
    └── Package
        └── Directory
            └── File
                └── Class
                    └── Method
```

---

### Dependency Map

Uses:

```text
IMPORTS
CALLS
USES
DEPENDS_ON
READS
WRITES
```

Produces:

```text
Module A
   ↓
Module B
   ↓
Package C
   ↓
PostgreSQL
```

---

### Architecture Map

Uses:

```text
BELONGS_TO_DOMAIN
CALLS
PUBLISHES
DEPENDS_ON
```

but aggregates lower-level nodes:

```text
Payments
   ↓
Orders
   ↓
Notifications
```

---

### Graph Map

Shows the underlying graph at whatever granularity the user requests.

```text
function
class
module
package
domain
feature
service
```

Same data.

Different lens.

That architectural choice will save you an enormous amount of duplicated work.

---

# 39. Store source code separately from the graph

Do not dump entire file contents into graph nodes.

Use something like:

```text
Git repository/object storage
        │
        └── source content

PostgreSQL
        │
        └── repositories
            users
            scan jobs
            metadata

Neo4j/FalkorDB
        │
        └── semantic relationships

Optional search index
        │
        └── full-text/semantic search
```

The graph should contain references such as:

```text
repository
commit
filepath
startLine
endLine
symbol
```

Source remains authoritative.

---

# 40. Neo4j vs FalkorDB

Both can work.

Neo4j currently has a broad Cypher ecosystem and dedicated Graph Data Science tooling, which is particularly useful for architecture analysis and graph algorithms. ([Neo4j Graph Intelligence Platform][7])

FalkorDB is attractive where very fast traversal, OpenCypher compatibility and integrated graph/semantic retrieval are important; its current documentation exposes property-graph, full-text and vector-search capabilities. ([docs.falkordb.com][8])

I would hide either behind:

```ts
interface GraphStore {
    upsertNodes(nodes: GraphNode[]): Promise<void>;
    upsertEdges(edges: GraphEdge[]): Promise<void>;

    traverse(query: GraphTraversal): Promise<GraphResult>;

    neighbors(id: string): Promise<GraphNode[]>;

    shortestPath(
        source: string,
        target: string
    ): Promise<GraphPath>;
}
```

Then your entire product isn't married to one database.

For the first implementation, **Neo4j would be my preference** because your project is heavily oriented toward graph analysis rather than simply graph storage.

---

# 41. Incremental analysis is essential

Scanning ten million lines from scratch after every commit would be wasteful.

Store:

```text
Repository
Commit
File hash
Analyzer version
```

When:

```text
commit A → commit B
```

run:

```bash
git diff
```

and determine:

```text
added files
modified files
deleted files
renamed files
```

Then:

```text
reparse changed files
        ↓
remove obsolete symbols
        ↓
update symbols
        ↓
re-resolve affected references
        ↓
find reverse dependencies
        ↓
recalculate affected features
        ↓
recalculate affected domains
```

Tree-sitter itself supports incremental syntax-tree updating, which can also be useful for IDE-style real-time analysis. ([tree-sitter.github.io][1])

---

# 42. You can now show architectural changes between commits

For example:

```text
Commit 929af
↓
Commit a82dd
```

Your engine could report:

```text
Architecture changes

+ Billing domain introduced
+ Stripe dependency introduced

POST /checkout
  now calls FraudService

PaymentService
  now writes PaymentAttempt

Order.created
  now triggers AnalyticsConsumer

Removed:
LegacyPaymentGateway
```

That becomes a particularly strong use case for engineering teams.

---

# 43. Recommended backend services

I would split your backend roughly into:

```text
Repository Service
    cloning
    Git operations

Scanner Service
    files
    manifests
    languages

Analysis Workers
    Tree-sitter
    compiler
    LSP
    framework analyzers

Semantic Linker
    references
    symbols
    dependency resolution

Graph Builder
    node/edge creation

Architecture Engine
    clustering
    domains
    coupling

Functionality Engine
    entrypoints
    flow discovery
    capabilities

Runtime Collector
    traces

AI Understanding Service
    summaries
    architecture explanations
    Q&A

Query API
    graph queries

Frontend
    visualization
```

You don't necessarily need microservices initially.

I would actually start with a modular monolith plus workers.

---

# 44. A sensible technology stack

Given the nature of this system:

```text
Frontend
Next.js
React
TypeScript

Visualization
Cytoscape.js
React Flow
D3 where necessary

Backend
NestJS / TypeScript

Queue
BullMQ + Redis

Metadata
PostgreSQL

Graph
Neo4j

Parsing
Tree-sitter

Semantic analysis
SCIP / LSP / compiler adapters

Object storage
S3-compatible storage

Runtime
OpenTelemetry

AI
LLM + structured graph retrieval
```

For very CPU-intensive indexing workers, you can later introduce:

```text
Go
Rust
```

without rewriting the main platform.

---

# 45. Visualizer design

I would make the UI behave somewhat like Google Maps.

At the highest zoom level:

```text
┌────────────┐
│   Users    │
└─────┬──────┘
      ↓
┌────────────┐
│   Orders   │
└─────┬──────┘
      ↓
┌────────────┐
│  Payments  │
└────────────┘
```

Click Payments:

```text
Payments
├── PaymentController
├── PaymentService
├── StripeGateway
├── TransactionRepository
└── PaymentWebhook
```

Click PaymentService:

```text
PaymentService
├── initializePayment()
├── verifyPayment()
├── refund()
└── handleWebhook()
```

Click `initializePayment()`:

```text
source code
dependencies
callers
callees
database operations
external APIs
tests
runtime traces
```

That progressive disclosure is much better than presenting a monstrous graph.

---

# 46. Add several developer views

I would eventually expose:

```text
Overview
Hierarchy
Architecture
Dependencies
Features
Data flow
API
Database
Events
External systems
Runtime
Changes
Search
```

And a natural-language interface:

```text
Ask about this repository...
```

---

# 47. Natural-language querying becomes GraphRAG

Now suppose someone asks:

> How does registration work?

Instead of performing ordinary embedding search alone:

```text
question
↓
Identify likely domain: Users/Auth
↓
Find registration endpoint
↓
Traverse graph
↓
Retrieve relevant symbols
↓
Retrieve source excerpts
↓
Generate answer
```

The answer could then say:

```text
Registration begins at POST /auth/register.

AuthController.register
    ↓
AuthService.register
    ↓
UserRepository.create
    ↓
PasswordService.hash

It creates:
User

It publishes:
user.registered

That event subsequently triggers:
EmailVerificationService.sendVerificationEmail
```

And every statement can link to its evidence.

This is much stronger than ordinary vector RAG.

---

# 48. An important additional concept: two graphs

Conceptually, I would maintain:

### Physical Code Graph

What the code physically contains.

```text
files
classes
functions
imports
calls
database operations
```

and:

### Semantic Product Graph

What those things mean.

```text
features
domains
workflows
capabilities
business entities
```

For example:

```text
SEMANTIC GRAPH

Checkout
    │
    IMPLEMENTED_BY
    ▼
CheckoutController
    │
    CALLS
    ▼
CheckoutService


PHYSICAL GRAPH
```

This distinction is incredibly useful.

The physical graph changes often.

The semantic graph changes more slowly.

---

# 49. Your complete information hierarchy should therefore become

```text
Repository
│
├── Applications
│
│   ├── Services
│
│   │   ├── Packages
│
│   │   │   ├── Modules
│
│   │   │   │   ├── Files
│
│   │   │   │   │   ├── Classes
│
│   │   │   │   │   ├── Functions
│
│   │   │   │   │   └── Variables
│
│
├── Infrastructure
│   ├── Databases
│   ├── Queues
│   ├── Caches
│   └── External Services
│
├── Interfaces
│   ├── REST
│   ├── GraphQL
│   ├── WebSockets
│   ├── CLI
│   └── UI
│
├── Domains
│   ├── Users
│   ├── Authentication
│   ├── Payments
│   ├── Orders
│   └── Notifications
│
└── Features
    ├── Register User
    ├── Login
    ├── Checkout
    ├── Refund
    └── Password Reset
```

Now you are no longer merely documenting source code.

You are creating a **computable representation of the software system itself**.

---

# 50. Implementation order

I would **not** try to build everything simultaneously.

### Phase 1 — Repository intelligence

Build:

```text
Git ingestion
file scanner
language detection
framework detection
hierarchy map
```

Target:

> “Tell me what's inside this repository.”

---

### Phase 2 — Semantic code intelligence

Build:

```text
Tree-sitter
symbols
imports
exports
classes
functions
references
compiler/LSP integration
```

Target:

> “Tell me how the code is connected.”

---

### Phase 3 — Graph

Introduce Neo4j.

Build:

```text
canonical node model
canonical relationship model
graph ingestion
graph traversal API
graph UI
```

Target:

> “Show me the codebase as a network.”

---

### Phase 4 — Framework intelligence

Build adapters for:

```text
NestJS
Express
Next.js
Prisma
```

first if TypeScript is your initial target.

Extract:

```text
HTTP routes
controllers
database models
DB reads/writes
background jobs
events
external requests
```

Target:

> “Tell me what the application actually interacts with.”

---

### Phase 5 — Feature discovery

Build:

```text
entrypoint detection
execution-path traversal
side-effect detection
feature candidates
feature summaries
confidence/evidence
```

Target:

> “Tell me what the software does.”

---

### Phase 6 — Architecture intelligence

Build:

```text
domains
cluster analysis
coupling
cycles
service boundaries
architecture summaries
```

Target:

> “Explain how this system is architected.”

---

### Phase 7 — Runtime intelligence

Add:

```text
OpenTelemetry
test execution
coverage
runtime traces
```

Target:

> “Show me what really happens when the application runs.”

---

### Phase 8 — AI interface

Finally add:

```text
Ask:
"How does checkout work?"

Ask:
"What calls Stripe?"

Ask:
"What would break if I modify this class?"

Ask:
"Explain authentication to a new engineer."

Ask:
"Which components belong to notifications?"
```

At this point the AI has structured facts beneath it rather than guessing from chunks of source code.

---

# 51. The architecture I would ultimately aim for

The system can be reduced to six intellectual layers:

```text
                    HUMAN UNDERSTANDING
                           ▲
                           │
                ┌─────────────────────┐
                │ 6. Explanation      │
                │ AI / Q&A / Docs     │
                └──────────▲──────────┘
                           │
                ┌─────────────────────┐
                │ 5. Functionality    │
                │ features/workflows  │
                └──────────▲──────────┘
                           │
                ┌─────────────────────┐
                │ 4. Architecture     │
                │ domains/services    │
                └──────────▲──────────┘
                           │
                ┌─────────────────────┐
                │ 3. Relationships    │
                │ graph/dependencies  │
                └──────────▲──────────┘
                           │
                ┌─────────────────────┐
                │ 2. Semantics        │
                │ symbols/references  │
                └──────────▲──────────┘
                           │
                ┌─────────────────────┐
                │ 1. Syntax           │
                │ AST/files           │
                └──────────▲──────────┘
                           │
                       SOURCE CODE
```

That is the model I would use for the entire product.

The **hierarchical map answers “where?”**
The **dependency map answers “what depends on what?”**
The **architecture map answers “how is the system organized conceptually?”**
The **graph map answers “how is everything connected?”**
And the missing fifth layer—the **functionality map—answers “what does the software actually do?”**

For your stated goal, that fifth layer is indispensable. Without it, you can produce an exquisite map of a forest while still failing to explain what lives there.

[1]: https://tree-sitter.github.io/?utm_source=chatgpt.com "Introduction - Tree-sitter"
[2]: https://microsoft.github.io/language-server-protocol/?utm_source=chatgpt.com "Official page for Language Server Protocol"
[3]: https://neo4j.com/docs/graph-data-science/current/algorithms/community/?utm_source=chatgpt.com "Community detection - Neo4j Graph Data Science"
[4]: https://neo4j.com/docs/graph-data-science/current/algorithms/strongly-connected-components/?utm_source=chatgpt.com "Strongly Connected Components - Neo4j Graph Data Science"
[5]: https://neo4j.com/docs/cypher-manual/current/introduction/?utm_source=chatgpt.com "Introduction - Cypher Manual"
[6]: https://neo4j.com/docs/cypher-manual/current/queries/basic/?utm_source=chatgpt.com "Basic queries - Cypher Manual"
[7]: https://neo4j.com/docs/?utm_source=chatgpt.com "Neo4j documentation - Neo4j Documentation"
[8]: https://docs.falkordb.com/?utm_source=chatgpt.com "FalkorDB Docs | Graph Database for GraphRAG, Cypher & Knowledge Graphs"
