# Tellann — `/privacy` Complete Page Specification & Privacy Policy

Public Legal Page · Privacy & Data Protection · Comprehensive Draft

The `/privacy` page should be Tellann's authoritative public explanation of what information Tellann collects, why it collects it, how that information moves through the platform, who can access it, how long it is retained, and what rights customers and individuals have over it.

For Tellann, a generic SaaS privacy policy is insufficient. Your system operates across multiple trust boundaries: the marketing website, authenticated dashboard, cloud infrastructure, SDKs installed in customer applications, a desktop agent with local source-code access, managed browser demonstrations, payment processors, and optional AI-assisted services.

The policy must distinguish between data used to operate Tellann itself and data Tellann processes on behalf of its customers.

Accuracy status: This draft is grounded in Tellann's uploaded specifications and supplemented by current regulatory references. The specifications describe intended and pre-launch behavior, but do not prove which controls are enabled in today's deployment. I will flag those distinctions rather than present proposed functionality as deployed fact.

## 1. Page identity and SEO

| Property       | Specification                       |
| -------------- | ----------------------------------- |
| Route          | `/privacy`                          |
| Page title     | Privacy Policy — Tellann            |
| H1             | Privacy Policy                      |
| Canonical URL  | `https://tellann.co/privacy`        |
| Indexing       | `index, follow`                     |
| Authentication | Public; none required               |
| Language       | English                             |
| Content format | Server-rendered legal document      |
| Last updated   | Actual publication or revision date |

Meta description:

> Learn how Tellann collects, uses, stores, shares, and protects personal information, application telemetry, developer workspace data, and behavioral quality intelligence.

No illustrations, video demonstrations, or promotional animations are necessary. Legal pages should be fast, readable, accessible, and free of unnecessary tracking.

## 2. Page structure and navigation

```
/privacy
│
├── Marketing Navbar
├── Breadcrumbs
├── Privacy Policy Header
│   ├── Title
│   ├── Effective Date
│   ├── Last Updated
│   └── Introductory Summary
│
├── Privacy Overview
│   ├── What We Collect
│   ├── How We Use It
│   ├── Your Source Code
│   └── Your Privacy Rights
│
├── Legal Document
│   ├── Sticky Table of Contents
│   └── Complete Privacy Policy
│
├── Privacy Rights & Requests
├── Related Legal Documents
├── Privacy Contact Information
├── Policy Version History
└── Marketing Footer
```

Use the same legal document component, typography, and spacing as `/terms`. The desktop layout should use a 240–260px sticky table of contents beside a maximum 800px reading column. On mobile, replace the sidebar with a collapsible section selector.

### Introductory summary

The following text should appear beneath the page heading, before the formal policy:

> Tellann helps software teams understand application behavior without unnecessarily exposing the people, systems, and information behind it.
>
> This Privacy Policy explains how we handle information across our website, cloud platform, developer tools, SDKs, desktop software, billing systems, and related services. It also explains your privacy rights and how to exercise them.

## 3. Tellann's data collection model

There are four principal information boundaries.

Tellann account and business information

Identity, organizations, billing, authentication, preferences, support, communications, and website usage.

Local developer environment

Repository contents, local analysis, branch state, instrumentation changes, and run credentials. Raw source remains local by default.

Authorized behavioral evidence

Session events, application metadata, backend metrics, code-derived projections, browser findings, and approved documents.

Derived quality intelligence

Workflow graphs, observed states, reconciliation results, coverage measurements, findings, and reports.

Tellann's intended architecture separates local source access from the evidence and derived artifacts sent to its cloud.

This distinction is explicitly supported by the Privacy & Data Collection, System Architecture, Desktop Demonstration, and Data Flow specifications.

## 4. Comprehensive data inventory

This is the essential inventory behind the public policy. Each category needs a documented collection purpose and applicable retention rule.

| Information category     | Examples                                                           | Primary purpose                                |
| ------------------------ | ------------------------------------------------------------------ | ---------------------------------------------- |
| Identity                 | Name, email, account ID, avatar                                    | Account administration                         |
| Authentication           | Password verifiers, login sessions, MFA status                     | Secure access                                  |
| Organization             | Organization name, memberships, invitations, roles                 | Workspace administration                       |
| Billing profile          | Billing name, country, email, tax identifiers                      | Subscription eligibility and invoicing         |
| Payment metadata         | Transaction reference, payment status, processor reference         | Billing and reconciliation                     |
| Usage metering           | Applications, seats, storage, quota usage                          | Entitlement enforcement                        |
| Website technical data   | IP address, user agent, request metadata                           | Security and service operations                |
| Website analytics        | Pages viewed, referral source, campaign attribution, where enabled | Website improvement                            |
| Cookies and preferences  | Session identifier, consent state, UI preferences                  | Authentication and preferences                 |
| Customer enquiries       | Contact information, messages, support attachments                 | Customer support                               |
| Notifications            | Delivery destination, preferences, push subscription metadata      | Service communications                         |
| Device metadata          | Device identity, platform, agent version                           | Authorized desktop sessions                    |
| Repository metadata      | Project binding, Git branch, snapshot reference                    | Local workspace verification                   |
| Code-derived projections | File paths, symbol paths, code graph topology                      | Codebase intelligence                          |
| Source files             | Local repository content                                           | Local analysis; exceptional authorized uploads |
| Documents                | Product specifications, requirements, imported text                | Document-derived intent suggestions            |
| Frontend telemetry       | Navigation, clicks, UI transitions                                 | Behavioral reconstruction                      |
| Form-event metadata      | Field interaction events, validation outcomes                      | Flow and state analysis                        |
| Backend telemetry        | Endpoints, methods, status, latency, errors                        | Endpoint intelligence                          |
| Session evidence         | Session IDs, timestamps, run IDs, event sequences                  | Session reconstruction                         |
| Browser evidence         | Browser findings, supported trace metadata                         | QA investigation                               |
| Workflow declarations    | Intended flows, states, transitions, versions                      | Declared intent                                |
| Derived analytics        | Graphs, missing states, coverage, reconciliation                   | Quality intelligence                           |
| Reports and exports      | Findings, generated reports, export records                        | Reporting and investigation                    |
| Audit logs               | User, action, timestamp, affected resource                         | Security and accountability                    |
| AI assistance metadata   | Feature invoked, user, status, token usage, cost                   | Assistance and operational metering            |
| Aggregated patterns      | Non-identifying state and transition structures                    | Structural pattern matching                    |

There are three important qualifications:

1. Sensitive data exclusion is scoped. Tellann's telemetry rules prohibit the deliberate capture of passwords, payment credentials, private keys, and similar restricted information. That does not mean Tellann's authentication or billing infrastructure can operate without securely processing the information necessary for those functions.
2. Local processing is not the same as cloud collection. Source files may be read by the Desktop Agent without being uploaded. File paths, analysis warnings, and structural projections can still reveal confidential information and must be protected.
3. Not every planned privacy control is implemented. The Privacy & Data Collection Specification explicitly marks comprehensive field-level PII transformations and customer-defined privacy rules as pre-launch. Those capabilities must not be advertised as available until verified.

# 5. Complete Privacy Policy — Publication Draft

The following is the proposed legal text for `/privacy`. It is deliberately written as a standalone policy, with explicit distinctions between current Phase 1 processing, restricted or locally processed information, and future functionality.

Square-bracketed fields are publication dependencies. The text should undergo final operational and legal verification before becoming a binding public representation of Tellann's practices.

# Privacy Policy

**Effective Date:** [Approved publication date]\
**Last Updated:** [Date of most recent substantive revision]\
**Version:** 1.0\
**Data Controller:** [Full registered name of Tellann's operating legal entity]\
**Website:** [https://tellann.co](https://tellann.co)

## Introduction

At Tellann, we believe that understanding software behavior should not require sacrificing the privacy of the people who build, operate, or use that software.

This Privacy Policy describes how Tellann ("Tellann," "we," "us," or "our") collects, processes, stores, discloses, retains, and protects information in connection with our website, software quality intelligence platform, desktop applications, software development kits, APIs, and related services.

It also explains the rights available to individuals whose personal information we process and the responsibilities shared between Tellann and organizations using our Services.

Our privacy principles are:

- **Data minimization:** We seek to process only the information necessary for a defined purpose.
- **Local-first source handling:** Customer source code remains on the developer's machine by default.
- **Privacy by design:** Sensitive information should be excluded or protected as early as possible in the collection process.
- **Purpose limitation:** Information is processed for defined, legitimate purposes.
- **Customer control:** Organizations retain authority over their applications, submitted information, and authorized users.
- **Transparency:** Customers should understand what information enters Tellann and how that information is used.
- **Accountability:** Sensitive operations and material access decisions should be traceable and subject to appropriate controls.

Please read this Privacy Policy carefully.

## 1. Who We Are

Tellann is a software quality intelligence platform that helps software teams understand, analyze, and validate application behavior.

Our Services include, subject to product availability:

- Application and organization management.
- Workflow intent declaration.
- Developer demonstration sessions.
- Frontend and backend behavioral telemetry collection.
- Session reconstruction and replay.
- Workflow discovery and behavior graphs.
- Coverage analysis and missing-state identification.
- Reconciliation of intended and observed behavior.
- Endpoint intelligence.
- Quality assurance reports.
- Desktop-based codebase and documentation analysis.
- Associated account, billing, notification, and support services.

The legal entity responsible for Tellann's independent data-controller activities is:

**[Full Legal Entity Name]**\
Registration Number: [Number]\
Registered Address: [Address]\
Privacy Contact: [Privacy email address]

## 2. Scope of This Policy

This Privacy Policy applies to personal information processed through:

1. The Tellann marketing website and public documentation.
2. Account registration, authentication, and user settings.
3. Organizations, applications, memberships, and collaboration features.
4. Billing, subscriptions, trials, payments, and invoices.
5. The Tellann dashboard and associated APIs.
6. The Tellann Desktop Agent.
7. Customer applications instrumented using Tellann SDKs.
8. Managed browser demonstrations and session reconstruction.
9. Codebase analysis, documentation processing, and instrumentation.
10. Behavior graphs, reconciliation, findings, and quality reports.
11. Optional assisted intelligence functionality.
12. Notifications, support requests, security operations, and customer communications.

This Policy also describes how we intend to address additional processing introduced by future features.

Not every capability described in Tellann's technical roadmap is currently available. Future processing involving materially different personal information will be documented before the relevant functionality becomes available.

## 3. Our Role in Processing Personal Information

Tellann processes information in different capacities depending on its purpose.

### 3.1 Tellann as a data controller

Tellann generally determines the purposes and means of processing information used to operate its own business and services.

This may include:

- User registration and account administration.
- Authentication and security.
- Billing administration.
- Customer communications.
- Technical support.
- Website operation and analytics.
- Fraud and abuse prevention.
- Compliance with legal requirements.
- Internal service reliability and operational monitoring.

For these activities, Tellann generally acts as an independent data controller.

### 3.2 Tellann as a data processor

When an organization uses Tellann to analyze its application or process its own application-related information, that organization generally determines the purposes for which the information is collected and used.

This includes personal data that may be present in:

- Authorized behavioral telemetry.
- Recorded application sessions.
- User interaction metadata.
- Customer application documents.
- Application-specific workflow evidence.
- Uploaded source materials.
- Customer-controlled reports and analytical outputs.

For these activities, Tellann generally acts as a data processor acting on the organization's instructions.

### 3.3 Customer responsibilities

Organizations are responsible for establishing the lawful basis for collecting and disclosing information from their own application users, employees, testers, and other individuals.

Organizations must provide any required notices, obtain appropriate consent where necessary, and comply with applicable privacy and monitoring laws.

### 3.4 Data Processing Agreement

Where required, processing on behalf of a customer is governed by a Data Processing Agreement ("DPA") establishing the relevant processing instructions, security measures, subprocessors, international transfers, cooperation, and deletion obligations.

## 4. Categories of Information We Collect

The categories below distinguish personal information collected directly by Tellann from information provided by customers and technical information generated during platform use.

### 4.1 Account identity information

When you create an account or maintain a user profile, we may collect:

- Full name or display name.
- Email address.
- Account identifier.
- Profile image or avatar.
- Authentication preferences.
- Profile and interface preferences.
- Account creation and modification timestamps.
- Account status.
- Associated organizations and memberships.

**Purpose:** To establish and maintain user accounts, identify authorized users, provide access to the Services, personalize account settings, and communicate account-related information.

### 4.2 Authentication and session information

To authenticate users and secure accounts, we process information such as:

- Authentication method.
- Securely handled password-verification information, where password authentication is used.
- One-time authentication challenges and verification status.
- Multi-factor authentication configuration and challenge results.
- Access-session identifiers and expiry metadata.
- Refresh-session and revocation information.
- Registered devices.
- Login timestamps.
- Successful and failed authentication attempts.
- Relevant authentication security events.

**Purpose:** To authenticate users, maintain sessions, enforce access control, detect suspicious activity, and protect customer accounts.

Authentication credentials are handled through the designated authentication system. They are not treated as ordinary application telemetry.

### 4.3 Organization and membership information

When an Organization is created or administered, we may process:

- Organization name and identifier.
- Organization settings.
- Member identities.
- Roles and permissions.
- Invitations and invitation status.
- Invitation email addresses.
- Organizational security policies.
- Membership changes.
- Relevant administrative records.

**Purpose:** To operate multi-user workspaces, enforce authorization boundaries, manage collaboration, and protect organizational resources.

### 4.4 Billing profile and subscription information

For subscription administration, we process:

- Payer name and billing email.
- Billing country.
- Billing address or tax details where required.
- Organization associated with the subscription.
- Selected plan.
- Billing currency.
- Subscription status.
- Trial eligibility.
- Trial start and conversion dates.
- Renewal dates.
- Subscription changes.
- Applicable resource entitlements.
- Cancellation status.

**Purpose:** To administer subscriptions, establish plan and regional eligibility, calculate applicable charges, manage renewals, and maintain accounting records.

The billing profile belongs to the designated paying user, while subscription entitlements apply to the associated Organization.

### 4.5 Payment and transaction information

Payments are processed through authorized payment service providers.

Depending on the payment provider and transaction method, Tellann may receive:

- Payment transaction reference.
- Processor customer or payment-method reference.
- Payment status.
- Charge amount and currency.
- Payment timestamps.
- Authorized payment-method summary, where supplied.
- Invoice and receipt references.
- Refund or dispute status.
- Payment failure information.

Payment processors may separately collect full card or payment information required to authorize a transaction.

Tellann's application-telemetry system is not designed to capture card numbers, CVVs, card PINs, or payment authentication secrets.

**Purpose:** To verify payments, administer recurring billing, issue invoices, resolve payment issues, and prevent fraudulent transactions.

### 4.6 Subscription usage and metering information

Tellann measures resource consumption and entitlements, including:

- Number of registered applications.
- Active organization members.
- Outstanding invitations consuming seats.
- Registered environments.
- Ingestion credentials.
- Storage consumption.
- Applicable retention entitlements.
- Demonstration counts.
- Session counts.
- Report and export activity.
- Relevant API usage.

Some measurements are used for customer-facing quota enforcement; others support internal capacity planning, diagnostics, and abuse prevention.

Measurement does not necessarily mean that the activity is separately billable.

### 4.7 Website and network information

When you interact with our website or Services, our systems and applicable infrastructure providers may process technical information such as:

- IP address.
- Request timestamp.
- Requested URL or route.
- Browser or user-agent information.
- HTTP request metadata.
- Response status.
- Approximate location derived from network information where used.
- Security and abuse-detection metadata.
- Technical error and diagnostic information.

These categories may be processed in ordinary web and security infrastructure independently of customer application telemetry.

**Purpose:** To deliver the website, maintain security, investigate technical failures, mitigate abuse, and monitor infrastructure reliability.

### 4.8 Website analytics and marketing information

Where website analytics or marketing measurement is enabled, and subject to applicable consent requirements, the information processed may include:

- Page visits.
- Referral sources.
- Campaign identifiers.
- Navigation interactions.
- Conversion events.
- Aggregate performance and engagement metrics.

If Tellann uses optional analytics cookies, advertising technologies, or third-party tracking tools, the relevant technologies, providers, purposes, and retention periods must be disclosed in our Cookie Policy and applicable consent controls.

We do not assume that every optional analytics or advertising technology is necessary to operate our Services.

### 4.9 Contact, support, and correspondence

When you communicate with us, we process the information necessary to respond, potentially including:

- Name.
- Email address.
- Organization details.
- Message content.
- Support request category.
- Technical descriptions.
- Diagnostic files or attachments you choose to supply.
- Correspondence history.
- Support request status.

**Purpose:** To respond to enquiries, investigate issues, provide customer assistance, and improve support processes.

Please do not include passwords, private keys, unrestricted credentials, or unnecessary sensitive personal information in support submissions.

### 4.10 Notifications and communication preferences

Tellann may process:

- Notification preferences.
- Recipient account and organization identifiers.
- Email delivery destinations.
- Notification category.
- Notification content and identifiers.
- Read and dismissal status.
- Delivery attempts and outcomes.
- Web push subscription information, where permission is granted.
- Registered desktop delivery destinations.

**Purpose:** To deliver account, billing, security, QA run, reporting, instrumentation, and other relevant service notifications.

### 4.11 Desktop device information

The Tellann Desktop Agent may process:

- Registered device identity.
- Operating-system and agent compatibility information.
- Agent version.
- Authorization and device-session state.
- Device registration and revocation records.
- Local configuration relevant to supported operations.
- Diagnostic and update information.

**Purpose:** To authorize specific installations, secure desktop access, maintain software compatibility, and support local development workflows.

### 4.12 Local workspace and repository information

When you authorize the Desktop Agent to access a local workspace, it may process locally:

- Repository contents.
- Workspace path.
- Project structure.
- Source file contents.
- Framework and dependency information.
- Repository identity.
- Branch information.
- Version-control status.
- Snapshot references.
- Instrumentation targets.
- Applicable configuration and diagnostic information.

**Purpose:** To understand the application structure, locate relevant workflow checkpoints, propose instrumentation, and perform authorized demonstrations.

Customer source files remain local by default. Processing a file locally does not mean uploading it to Tellann's cloud.

### 4.13 Code-derived information transmitted to Tellann

To support codebase intelligence, the Desktop Agent may transmit derived information such as:

- File and symbol paths.
- Code graph relationships.
- Flow checkpoint locations.
- Structural analysis results.
- Analysis warnings.
- Repository snapshot references.
- Relevant instrumentation status and metadata.

These artifacts may contain confidential technical information and are treated as protected Customer Data.

### 4.14 Source-code uploads

Raw Customer Source Code and source archives are not part of Tellann's default cloud-upload behavior.

Where a specific feature requires their upload, Tellann must obtain authorization identifying:

- The materials to be transferred.
- The stated purpose.
- The authorizing user.
- The time of authorization.
- The relevant destination and processing context.

Authorization for one upload does not automatically authorize subsequent uploads for different purposes.

Consented source archives are subject to deletion when the authorized purpose is complete.

### 4.15 Customer-provided documents

Users may submit product or software documentation, including:

- Requirements specifications.
- Workflow descriptions.
- Feature documentation.
- Product design documents.
- Application architecture descriptions.
- Other authorized development materials.

Tellann may process such materials to derive candidate workflows, states, or declarations for human review.

Where optional model assistance is used, appropriately sanitized document text may be processed by an authorized model provider.

### 4.16 Frontend application telemetry

The Tellann frontend SDK is designed to capture structured behavioral events such as:

- Page views.
- Route changes.
- Page exits.
- Button and link interactions.
- Component interactions.
- Tab and dropdown interactions.
- Form interaction events.
- Form validation outcomes.
- Application state changes.
- Workflow boundaries and outcomes.
- Client-side errors.

These events may include relevant non-sensitive metadata, such as a component identifier, page route, state name, or event timestamp.

**Purpose:** To reconstruct demonstrated application behavior, identify workflows, and support quality analysis.

### 4.17 Backend telemetry

The backend SDK may collect technical execution metadata such as:

- API endpoint or normalized route.
- Request method.
- Response status.
- Execution duration.
- Error category.
- Endpoint execution metrics.
- Trace and correlation identifiers.
- Applicable application and environment identifiers.

**Purpose:** To understand backend behavior and correlate it with frontend workflows.

Sensitive headers, authentication credentials, and protected payload values are excluded according to the supported collection rules.

### 4.18 Session and demonstration information

Tellann processes session and QA run information such as:

- Session identifier.
- Run identifier.
- Application and organization identifiers.
- Environment identifier.
- Event identifiers.
- Event types and versions.
- Timestamps.
- Sequence and correlation information.
- Session duration.
- Run lifecycle state.
- Evidence boundaries.
- Capture source and relevant agent version.

**Purpose:** To reconstruct the event timeline, associate frontend and backend activity, generate evidence, and provide reproducible analysis.

### 4.19 Browser findings and replay information

During supported demonstrations, Tellann may process:

- Browser observations.
- Supported interaction traces.
- Network request metadata.
- Application errors.
- Visual and accessibility findings.
- Replay timelines.
- Evidence integrity information.
- Related run artifacts.

Session Replay is primarily a reconstruction of observed telemetry, rather than a conventional video recording of the entire screen.

### 4.20 Declared intent and workflow information

Tellann stores customer-declared information about expected application behavior, including:

- Declared workflows.
- States and transitions.
- Expected success and failure paths.
- Flow descriptions.
- Accepted or rejected suggestions.
- Declaration revisions.
- Approval information.
- Ruleset and provenance metadata.

**Purpose:** To represent intended behavior and compare it with recorded evidence.

### 4.21 Derived behavioral intelligence

From available evidence and declarations, Tellann may generate:

- Observed Behavior Graphs.
- Workflow maps.
- State and transition inventories.
- Coverage calculations.
- Missing-state candidates.
- Missing-flow candidates.
- Reconciliation classifications.
- Endpoint findings.
- Graph versions and comparisons.
- QA report findings.
- Evidence-backed recommendations.

These outputs are connected to the relevant Organization and application.

Their accuracy and completeness depend on the quality and scope of available evidence.

### 4.22 Reports and exports

Tellann may store:

- Generated QA reports.
- Report versions and metadata.
- Related application or run identifiers.
- Export formats and generated files.
- Export history.
- Report generation status.

**Purpose:** To provide quality intelligence to authorized users, support investigations, and maintain appropriate auditability.

### 4.23 Audit and security logs

Tellann may create records of actions including:

- Authentication attempts.
- Membership changes.
- Permission modifications.
- API credential creation or revocation.
- Desktop device registration or revocation.
- Workspace binding changes.
- Source upload authorization.
- Instrumentation approval and rollback.
- QA run lifecycle events.
- Report exports.
- Protected-value access.
- Billing and security configuration changes.
- Assisted intelligence invocations.

These records may include the acting user, affected resource, timestamp, result, and relevant organization identifier.

**Purpose:** To maintain accountability, investigate security incidents, prevent unauthorized activity, and meet legal or contractual obligations.

### 4.24 Assisted intelligence information

Where supported model assistance is invoked, Tellann may process sanitized information such as:

- Declared flow and state names.
- Relevant, sanitized structural context.
- Appropriate customer-provided document text.
- Request and feature identifiers.
- Output suggestions.
- Invocation status.
- Attributed user and organization.
- Model consumption and operational cost metadata.

Tellann's Phase 1 analytical findings are intended to be produced through deterministic analysis of application evidence. Model assistance is limited to supplementary activities rather than serving as an independent source of analytical truth.

## 5. Information We Intentionally Exclude From Application Telemetry

Tellann's telemetry and replay systems are designed to exclude restricted information, including:

### 5.1 Authentication secrets

- Password values.
- PINs.
- Passphrases.
- Security answers.
- Access and refresh tokens.
- Session authentication cookies.
- Private authentication keys.

### 5.2 Financial credentials

- Full payment card numbers.
- CVV or CVC values.
- Card PINs.
- Banking authentication credentials.
- Payment authorization secrets.
- Unnecessary bank account information.

### 5.3 Highly sensitive personal information

- Government identity numbers.
- Passport numbers.
- Driver's license numbers.
- Medical records.
- Diagnoses.
- Prescriptions.
- Biometric templates.
- Other protected personal information not required for the authorized processing purpose.

### 5.4 Raw file contents

Customer application telemetry is not intended to capture raw contents of uploaded images, videos, audio files, or documents.

File-related events may include appropriately restricted metadata where relevant.

### 5.5 Important qualification

These exclusions govern application observation and telemetry.

They do not prevent a user from deliberately submitting information through a separate, clearly identified workflow, nor do they eliminate the necessary processing of authentication or payment information by the appropriate systems.

Sensitive-field exclusion is a protective control, not a guarantee that every possible custom field name or application design will be classified correctly.

Customers must avoid deliberately transmitting restricted information through custom events or improperly configured integrations.

## 6. How We Collect Information

We obtain information through several methods.

### 6.1 Direct submission

Information supplied during registration, billing, support, application setup, organization administration, and document submission.

### 6.2 Automated service operation

Technical information generated by authentication, session management, security monitoring, usage metering, service requests, and notification delivery.

### 6.3 Authorized customer integrations

Behavioral and technical information transmitted from supported SDKs and application integrations.

### 6.4 Local desktop processing

Information processed by the Desktop Agent within an authorized developer workspace.

### 6.5 Approved transfers

Materials explicitly approved for cloud upload, including selected documents or consented source archives.

### 6.6 Service providers

Limited information received from payment processors, identity providers, notification services, or other approved providers as necessary for their designated functions.

### 6.7 Generated information

Analytical records derived from submitted or observed information, including behavioral graphs, coverage reports, reconciliation findings, and usage statistics.

## 7. Purposes and Lawful Bases for Processing

We process personal information only where there is an applicable lawful basis.

Depending on the jurisdiction and processing activity, the basis may include:

**Performance of a contract:** Providing accounts, subscriptions, authentication, and requested services.

**Compliance with a legal obligation:** Maintaining legally required financial records, responding to lawful requests, and complying with data protection obligations.

**Legitimate interests:** Protecting the platform from abuse, maintaining reliability, investigating security incidents, and operating or improving services where the processing is lawful and does not override individuals' rights.

**Consent:** Processing that requires an affirmative choice, such as optional non-essential cookies, certain marketing communications, or an explicitly authorized expanded collection activity.

**Other lawful bases:** Where recognized and appropriate under the applicable legislation.

Our processing purposes include:

1. Creating and administering Tellann accounts.
2. Authenticating users and securing devices.
3. Maintaining organizational permissions.
4. Providing subscribed features.
5. Processing authorized application evidence.
6. Constructing workflow and behavior models.
7. Generating QA reports and analysis.
8. Administering billing and resource entitlements.
9. Providing technical support.
10. Delivering necessary operational communications.
11. Preventing fraud and unauthorized use.
12. Maintaining infrastructure and service reliability.
13. Improving supported product functionality through authorized and appropriately protected information.
14. Meeting applicable legal and regulatory requirements.

Where Tellann is acting as a processor, the customer is generally responsible for establishing the lawful basis for collecting and instructing the processing of personal data within Customer Data.

## 8. Desktop Agent, Local Processing, and Source-Code Privacy

### 8.1 Local-first processing

Tellann's Desktop Agent is designed to perform source-code inspection and related operations on the developer's machine by default.

Source-code analysis does not automatically require the transfer of complete source files to Tellann.

### 8.2 Derived information

To provide cloud-based intelligence and coordinated functionality, the Desktop Agent may transmit permitted projections, evidence, and operational metadata.

A code-derived projection is not necessarily anonymous. File paths and structural information may remain confidential or identify individuals and organizations.

### 8.3 Explicit source-upload authorization

Raw source files, source archives, and unreviewed working-tree diffs are not to be transmitted without specific, recorded authorization for the relevant purpose.

### 8.4 Instrumentation approval

The Desktop Agent may prepare proposed code changes. Authorized users review and approve applicable instrumentation plans before changes are made.

The authorization and change history are recorded where the relevant functionality is supported.

### 8.5 Run credentials

Credentials supplied to conduct demonstrations are intended to remain in operating-system-protected local storage.

They must not be uploaded to Tellann's cloud as part of demonstration evidence.

### 8.6 Device sessions

Desktop authorization uses device-bound sessions that can be revoked independently of the user's other authenticated sessions.

### 8.7 Local data lifecycle

Deleting cloud records does not automatically delete the original Customer Source Code or other files held on a developer's own machine.

Users and organizations remain responsible for local repository and device administration.

## 9. Session Replay and Behavioral Evidence

### 9.1 Purpose

Tellann reconstructs application sessions from recorded events so authorized users can understand what occurred during a demonstration.

### 9.2 Replay content

A replay can include navigation, UI interactions, application states, workflow transitions, errors, and permitted technical metadata.

### 9.3 Protected information

Sensitive fields and classified protected values are subject to applicable exclusion, protection, and display controls.

Protected values are not intended to appear in clear text within ordinary replay views, reports, findings, or exports.

### 9.4 Authorized reveal

Where the platform supports exceptional access to a protected captured value, such access requires appropriate user authorization and an audit record.

### 9.5 Evidence completeness

Events may be missing because of integration coverage, filtering, connectivity, processing, or other technical conditions.

Session Replay and related reports therefore represent available evidence, not necessarily a complete record of every application action.

### 9.6 User monitoring responsibilities

Customers must ensure that persons whose activity is recorded receive legally required notices and that observation occurs within lawful boundaries.

## 10. Customer Documents and Assisted Intelligence

### 10.1 Document processing

Customer-provided product documents may be analyzed to identify potential application workflows and generate draft intent declarations.

### 10.2 Model-assisted features

Where an assisted capability requires a model provider, Tellann may submit limited, sanitized contextual information to that provider.

### 10.3 Restricted information

The intended model-processing boundary excludes raw source-file contents, credentials, protected values, and raw telemetry payloads.

### 10.4 Human approval

Model-generated suggestions do not automatically amend customer-declared intent or authorize changes to customer software.

### 10.5 Operational records

Tellann may maintain model invocation records, including feature type, status, consuming organization, invoking user, token usage, and cost.

### 10.6 Model training

Tellann does not obtain unrestricted permission to use confidential Customer Source Code or personal Customer Data for unrelated general-purpose model training merely because a customer uses the Services.

Processing by model providers is governed by the applicable feature disclosure, provider agreement, data-processing terms, and customer instructions.

Where any provider offers independent retention or training settings, these must be accurately described in the applicable processing documentation.

## 11. Aggregated and Anonymized Structural Patterns

Tellann's behavioral modeling architecture includes a capability to identify recurring structural patterns across applications.

### 11.1 Purpose

Aggregated structural analysis supports recognition of common application states, workflow paths, and possible missing branches.

### 11.2 Information used

The permitted structural index is limited to non-identifying state categories, standardized state names, and transition topology.

It is not intended to contain retrievable individual customer graph records, raw telemetry, customer names, proprietary field names, or identifying business metadata.

### 11.3 Aggregation

Contributions are represented in aggregate, frequency-weighted form.

The system must not reveal which customer contributed a particular pattern.

### 11.4 Protection against re-identification

Only genuinely non-identifying information may be treated as anonymized.

Hashed or pseudonymized personal information remains subject to privacy protections where individuals can still be identified.

### 11.5 Exclusion

Organizations requiring exclusion from cross-organization structural aggregation may request exclusion through the available organizational process or contact Tellann's privacy team.

The applicable scope and method of exclusion will be confirmed before processing the request.

## 12. How We Share Information

We may disclose information to the following recipient categories only where necessary and lawful.

### 12.1 Infrastructure providers

Hosting, storage, database, network, backup, and security providers operating components of the Services.

### 12.2 Payment processors

Approved providers handling payment authorization, recurring billing, payment verification, and transaction processing.

### 12.3 Communication providers

Providers supporting transactional email, notifications, web push, or other authorized messaging channels.

### 12.4 Identity and security providers

Providers assisting with authentication, identity verification, and platform protection where applicable.

### 12.5 Model providers

Authorized providers supporting an expressly invoked, bounded assisted-intelligence feature.

### 12.6 Authorized organization members

Information may be made available to other members of the same Organization according to their permissions and subscription entitlements.

### 12.7 Professional advisers

Legal, accounting, audit, or other professional advisers where required, subject to appropriate confidentiality obligations.

### 12.8 Legal and regulatory authorities

Information may be disclosed where lawfully required, including in response to valid legal process or binding regulatory obligations.

### 12.9 Business transactions

Information may be transferred as part of a lawful merger, acquisition, financing, or business restructuring, subject to confidentiality, applicable notice obligations, and continuing privacy protections.

### 12.10 No unrestricted disclosure

We do not authorize service providers to use Customer Data for unrelated purposes simply because they receive access while delivering services to Tellann.

We do not sell identifiable Customer Source Code, raw customer telemetry, or confidential QA reports as commercial datasets.

## 13. Cookies and Similar Technologies

### 13.1 Essential technologies

Tellann may use strictly necessary cookies or comparable storage technologies for authentication, session security, fraud prevention, or features required to operate the requested service.

### 13.2 Functional preferences

Where enabled, preference storage may remember language, appearance, interface settings, or similar choices.

### 13.3 Analytics

Optional analytics technologies may help us understand website performance and engagement.

Where consent is legally required, such technologies will not be activated until valid consent is obtained.

### 13.4 Marketing technologies

Any advertising pixels, retargeting tools, or cross-site tracking technologies must be separately disclosed and subject to applicable consent requirements.

### 13.5 Managing preferences

Users may manage available preferences through Tellann's cookie controls and applicable browser settings.

Rejecting optional tracking must not prevent access to the essential Services.

### 13.6 Cookie Policy

The names, providers, purposes, durations, and categories of deployed cookies or similar technologies are described in the applicable Cookie Policy.

## 14. Notifications and Communications

Tellann may deliver operational notifications through supported channels such as:

- Email.
- In-app notifications.
- Web push.
- Desktop notifications.

Notifications may concern:

- Account security.
- Authentication events.
- Billing and subscription status.
- Quota usage.
- QA run completion.
- Report availability.
- Reconciliation and graph changes.
- Instrumentation outcomes.
- Important service updates.

Notifications may require the processing of account identifiers, recipient destinations, relevant event metadata, delivery status, and user preferences.

Users may manage optional notifications through available account settings.

Essential legal, security, and transaction notices may still be delivered where necessary and lawful.

Marketing communications, where offered, will follow applicable consent, objection, and unsubscribe requirements.

## 15. Data Storage and Retention

### 15.1 General principle

Tellann retains personal information and Customer Data for the period reasonably necessary to fulfill the purpose of processing, subject to documented retention schedules, subscription entitlements, applicable agreements, and legal obligations.

### 15.2 Customer-facing plan retention

For supported application evidence governed by plan retention, the documented maximum windows are:

| Plan       | Retention Window         |
| ---------- | ------------------------ |
| Free       | 14 days                  |
| Local      | 30 days                  |
| Solo       | 90 days                  |
| Team       | 180 days                 |
| Business   | 365 days                 |
| Enterprise | Contractually configured |

These windows do not necessarily govern every category of account, billing, security, or legally required record.

### 15.3 Evidence and derived artifacts

Demonstration evidence, reports, replay assets, graph records, and other analytical materials are subject to the applicable category-specific and organization-level retention rules.

The operative schedules must be disclosed consistently in the applicable retention documentation.

### 15.4 Source archives

A raw source archive uploaded with authorization for a defined purpose is subject to deletion when that purpose is completed, regardless of the ordinary subscription retention window.

### 15.5 Billing and accounting records

Records needed to comply with financial, tax, fraud prevention, or other legal obligations may be retained beyond an active subscription where required by law.

### 15.6 Security records

Relevant logs may be retained where necessary for security investigations, lawful compliance, auditability, or the establishment and defense of legal claims, subject to appropriate safeguards.

### 15.7 Backups

Residual copies may temporarily remain in controlled backup systems until the applicable backup lifecycle completes.

Such copies remain subject to appropriate restrictions and are not retained indefinitely merely because they exist in backups.

### 15.8 Plan changes

Downgrading to a lower plan may change applicable retention limits.

The downgrade itself does not necessarily cause immediate deletion, but ordinary retention processing may subsequently delete information outside the new entitlement window.

### 15.9 End of subscription

Termination or cancellation of a subscription does not automatically mean that every account and organizational record is immediately erased.

Relevant access, export, deletion, and post-termination retention rules apply.

## 16. Information Security

We design Tellann's security architecture around least-privilege access, tenant isolation, secure transport, controlled local access, and auditability.

The documented security controls include:

- Encryption for data in transit.
- Encryption for sensitive data at rest.
- Authenticated API access.
- Organization-scoped authorization.
- Role-based permissions.
- Device-bound desktop sessions.
- Local credential protection.
- Workspace trust verification.
- Sensitive telemetry filtering.
- Protected-value handling.
- Audit logging.
- Security monitoring.
- Credential revocation.
- Controlled source-code modification.
- Backup and recovery procedures.

The exact controls available depend on the deployed system, feature status, and applicable agreement.

Customers remain responsible for securing their own applications, repositories, devices, and authorized access.

No technical system can be guaranteed completely immune from every security threat.

## 17. International Data Transfers

Tellann may use infrastructure or approved service providers operating in jurisdictions outside the customer's country.

Where personal information is transferred internationally, Tellann will apply safeguards required by Applicable Law.

These may include:

- Appropriate contractual transfer clauses.
- Recognized adequacy arrangements where applicable.
- Data processing agreements.
- Access restrictions.
- Encryption and appropriate technical safeguards.
- Transfer risk assessments where required.

Enterprise customers may have separately negotiated data residency or deployment arrangements.

Actual hosting regions and applicable transfer mechanisms are documented in the relevant service or data-processing disclosures.

## 18. Your Privacy Rights

Depending on Applicable Law and Tellann's processing role, individuals may have the right to:

### 18.1 Be informed

Receive information about the collection, use, disclosure, and retention of their personal data.

### 18.2 Access personal data

Request confirmation of whether personal information is being processed and obtain applicable access to that information.

### 18.3 Correct information

Request correction of inaccurate or incomplete personal information.

### 18.4 Request deletion

Request erasure where the legal requirements for deletion are met.

### 18.5 Restrict processing

Request restriction of certain processing activities in applicable circumstances.

### 18.6 Object to processing

Object to processing carried out under certain lawful bases, including eligible direct marketing activities.

### 18.7 Data portability

Request relevant personal data in a commonly used, machine-readable format where the right applies.

### 18.8 Withdraw consent

Withdraw previously granted consent for an optional activity where consent is the applicable lawful basis.

Withdrawal does not automatically invalidate earlier lawful processing or processing supported by a different valid legal basis.

### 18.9 Automated decision-making rights

Exercise applicable rights concerning qualifying decisions made solely by automated processing.

### 18.10 Lodge a complaint

Contact an applicable data protection supervisory authority if concerned about the handling of personal information.

These rights are not absolute and may be subject to applicable conditions, exceptions, or verification requirements.

## 19. Exercising Your Rights

You may submit a privacy request to:

**[Verified Privacy Contact Email]**

Where applicable, you may also use available account or organizational privacy controls.

We may require reasonable verification of identity or authority before disclosing, correcting, or deleting protected information.

We will respond within the time prescribed by applicable law and explain where a legal restriction prevents us from fulfilling a request.

If Tellann processes your information on behalf of a customer Organization, we may refer the request to that Organization or assist it in responding under the applicable Data Processing Agreement.

We will not disclose another individual's or organization's confidential information solely because a request is submitted.

## 20. Organization-Controlled Personal Data

If your information was collected by an application, company, employer, or other organization using Tellann, that organization may be the appropriate data controller.

For example, if you use an application that has integrated Tellann's SDK, the application operator generally determines the purpose and legal basis for recording permitted interaction data.

In these cases:

- The customer generally determines the permitted processing purpose.
- Tellann processes the information within its authorized processor role.
- The customer may control applicable data access and retention.
- Tellann assists with applicable privacy requests under its contractual and legal obligations.

Individuals may contact the application operator directly for requests concerning their use of that application.

This does not eliminate Tellann's independent legal obligations.

## 21. Data Breaches and Security Incidents

Tellann maintains procedures for identifying, investigating, containing, and addressing security incidents.

These procedures may include:

- Security-event detection.
- Incident classification.
- Containment and access revocation.
- Investigation.
- Remediation.
- Recovery.
- Post-incident review.
- Notification where legally or contractually required.

Where a personal-data breach occurs, Tellann will carry out the reporting, assistance, and notification responsibilities applicable to its role and the circumstances of the incident.

When processing data for a customer, Tellann will notify and cooperate with the customer as required by law and the applicable agreement.

## 22. Automated Decisions and Profiling

Tellann uses automated software processing to analyze application behavior and generate engineering insights.

Such analysis may identify workflow gaps, states, transitions, or application-level quality findings.

During Phase 1, these analytical results are intended to evaluate software behavior rather than make decisions about the legal rights, employment, creditworthiness, or personal eligibility of individuals.

Tellann's Phase 1 design does not include solely automated decisions intended to produce legal or similarly significant effects on individuals.

Any future processing that introduces qualifying automated personal decisions will require appropriate safeguards, disclosures, and lawful authorization before deployment.

## 23. Children's Privacy

Tellann is intended primarily for professional developers, software teams, and organizations.

It is not designed as a consumer service directed toward children.

We do not intentionally solicit personal information from children for independent marketing or direct account creation in circumstances prohibited by Applicable Law.

Where a customer operates software used by children, the customer is responsible for assessing whether Tellann's observation capabilities are appropriate, lawful, and properly configured for that environment.

Children's sensitive information must not be introduced into restricted telemetry categories contrary to Tellann's documented rules.

If we become aware of prohibited processing involving children's personal information, we will take appropriate action.

## 24. Data Requests, Export, and Account Deletion

Authorized users may access account controls and export features available to their roles and plans.

Requests for Organization deletion, account removal, or data export are subject to:

- Appropriate authorization.
- Applicable retention requirements.
- Contractual processing obligations.
- Security verification.
- Legal restrictions.
- The technical scope of the request.

Deleting a user account, removing a member, cancelling a subscription, uninstalling the Desktop Agent, and deleting an Organization are distinct operations that may have different consequences.

We will explain those consequences through the relevant account or support process.

## 25. Third-Party Websites and Services

Our website or Services may link to third-party websites, repositories, integration providers, or other external services.

Their privacy practices are governed by their own policies.

This Privacy Policy does not replace the independent terms or privacy notices of third parties that users choose to access.

Tellann remains responsible for its own use of authorized service providers as required by Applicable Law and relevant agreements.

## 26. Future Platform Capabilities

Tellann's longer-term product direction includes capabilities that may involve additional processing.

### 26.1 Production intelligence

Potential future activities include continuous production telemetry processing, real-user journey analysis, workflow health monitoring, and error correlation.

These are not described as generally available Phase 1 features.

### 26.2 Database intelligence

Future features may analyze permitted database execution and performance metadata.

They are not intended to require unrestricted collection of database contents or sensitive personal records.

### 26.3 Autonomous behavioral intelligence

Future features may include regression detection, test generation, failure simulation, and bounded automated remediation.

Capabilities that modify customer systems will require explicit, appropriately scoped authorization.

### 26.4 Privacy review before activation

Material new processing purposes, categories of personal data, providers, or automated actions will be assessed and disclosed before the relevant features become operational.

Where required, additional notices, agreements, or permissions will be obtained.

## 27. Changes to This Privacy Policy

We may revise this Privacy Policy to reflect changes in:

- Our Services.
- Information collection practices.
- Processing purposes.
- Data protection requirements.
- Subprocessors and international transfers.
- Security and retention practices.
- Available privacy controls.

The effective date and last-updated date will reflect the applicable published version.

For material changes affecting privacy rights or processing expectations, Tellann will provide notice and obtain any additional authorization required by law.

Where appropriate, previous policy versions may be retained for transparency and auditability.

## 28. Legal Framework

Tellann's privacy obligations depend on the relevant processing activity and jurisdiction.

Applicable frameworks may include:

- The Nigeria Data Protection Act 2023.
- Applicable Nigeria Data Protection Commission directives and guidance.
- The European Union General Data Protection Regulation, where applicable.
- The United Kingdom's applicable data protection and electronic privacy legislation, where applicable.
- Other privacy, communications, and consumer protection laws relevant to the affected individuals and operations.

Reference to these frameworks does not mean that every jurisdiction's requirements apply to every processing activity.

## 29. Contact and Complaints

For privacy enquiries, data protection requests, or concerns about this Policy, contact:

**Tellann**\
Legal Entity: [Full Registered Legal Name]\
Registered Address: [Registered Address]\
Privacy Email: [Verified Privacy Email]\
Data Protection Officer: [Name or contact channel, if applicable]\
Website: [https://tellann.co](https://tellann.co)

If you are dissatisfied with how your privacy concern has been handled, you may contact the appropriate data protection authority.

For Nigeria, the relevant authority is the Nigeria Data Protection Commission.

**Regulatory Website:** [https://ndpc.gov.ng](https://ndpc.gov.ng)

---

**End of Privacy Policy — Version 1.0**

# 6. Data retention review — critical before publication

The single largest unresolved privacy-policy issue is Tellann's retention model.

Your Privacy & Data Collection Specification contains the following category-level defaults:

| Data category              | Documented default            |
| -------------------------- | ----------------------------- |
| Raw telemetry events       | 13 months                     |
| Sessions                   | 13 months                     |
| Session replay assets      | 90 days                       |
| Analytics data             | 24 months                     |
| QA reports                 | 5 years                       |
| Demonstration run evidence | Plan retention window         |
| Run artifacts              | 90 days                       |
| Consented source archives  | Until authorized purpose ends |
| Quality assessments        | Unlimited                     |

However, your Entitlement Specification limits organization evidence retention to 14–365 days, depending on the plan.

This creates a real contractual ambiguity. For example, a Free-plan user sees a 14-day retention entitlement, while the privacy specification describes 13-month retention for raw events.

These need not be contradictory if they govern different types of records, but the documents do not sufficiently explain the relationship.

I would resolve this by maintaining a single authoritative retention registry that defines, for every data category, its retention trigger, maximum duration, deletion schedule, backup behavior, and whether it follows the organization's plan.

Until that is resolved, Section 15 should remain under legal and engineering review.

## 7. Privacy-sensitive technical controls

The Privacy Policy must correspond to mechanisms that actually exist throughout Tellann.

### A. Collection and exclusion pipeline

```
Application / SDK / Managed Browser
                │
                ▼
         Event Created
                │
                ▼
       Schema Validation
                │
                ▼
   Sensitive Field Classification
                │
                ▼
  Exclude or Protect Restricted Data
                │
                ▼
       Authorized Transmission
                │
                ▼
       Ingestion Validation
                │
                ▼
      Tenant-Scoped Processing
                │
                ▼
      Evidence / Analytics Storage
                │
                ▼
      Retention and Deletion
```

Before shipping, test whether sensitive values can escape through less obvious fields such as URL query strings, error messages, exception stacks, business-event payloads, custom metadata, network traces, and document-derived suggestions.

The event taxonomy explicitly supports customer-defined `BUSINESS_EVENT` payloads. Those are a particularly important risk because arbitrary customer-supplied event properties may contain personal information even when standard SDK fields are filtered.

### B. Required consent distinctions

| Activity                              | Authorization model                                |
| ------------------------------------- | -------------------------------------------------- |
| Account registration                  | Agreement acceptance and relevant privacy notice   |
| Essential session authentication      | Necessary processing for secure service operation  |
| Marketing emails                      | Appropriate opt-in or other lawful marketing basis |
| Optional analytics cookies            | Consent where required                             |
| Browser push                          | Explicit browser permission                        |
| Workspace binding                     | Explicit workspace authorization                   |
| Source archive upload                 | Purpose-specific authorization                     |
| Instrumentation patch application     | Separate review and approval                       |
| Protected-value reveal                | Role authorization and audited action              |
| Customer-defined telemetry collection | Customer's lawful collection basis                 |
| Future autonomous modification        | Explicit, application-scoped, revocable authority  |

Do not treat agreeing to `/terms` or acknowledging `/privacy` as universal permission for all subsequent collection or technical operations.

### C. Privacy requests

I recommend implementing a dedicated privacy request workflow rather than treating every request as an ordinary support ticket.

```
type PrivacyRequestType =
  | "ACCESS"
  | "RECTIFICATION"
  | "ERASURE"
  | "PORTABILITY"
  | "RESTRICTION"
  | "OBJECTION"
  | "CONSENT_WITHDRAWAL";

type PrivacyRequestStatus =
  | "RECEIVED"
  | "VERIFYING"
  | "IN_REVIEW"
  | "WAITING_FOR_CONTROLLER"
  | "FULFILLED"
  | "PARTIALLY_FULFILLED"
  | "DENIED";

interface PrivacyRequest {
  id: string;
  requesterId?: string;
  requesterEmail: string;

  organizationId?: string;
  requestType: PrivacyRequestType;
  status: PrivacyRequestStatus;

  submittedAt: string;
  verifiedAt?: string;
  deadlineAt?: string;
  resolvedAt?: string;

  controllerRole: "TELLANN" | "CUSTOMER";
  resolutionReason?: string;
}
```

The applicable response deadline should be determined by jurisdiction and request type rather than a single hardcoded global deadline.

## 8. External data processors and subprocessors

Tellann's billing specification identifies two payment providers, while the architecture specifies categories of infrastructure and intelligence services without conclusively identifying their deployed vendors.

| Service category         | Documented provider or status                              |
| ------------------------ | ---------------------------------------------------------- |
| NGN payment processing   | Paystack and Flutterwave                                   |
| USD payment processing   | Flutterwave                                                |
| Cloud hosting            | Actual production provider unconfirmed                     |
| Object storage           | Actual production provider unconfirmed                     |
| Transactional email      | Unconfirmed                                                |
| Push delivery            | Actual providers and browser services require verification |
| Model assistance         | Actual provider unconfirmed                                |
| Marketing analytics      | Actual tools unconfirmed                                   |
| Error tracking           | Actual service provider unconfirmed                        |
| Customer support tooling | Actual provider unconfirmed                                |

Do not list AWS, Azure, Google Cloud, or another provider as the actual subprocessor merely because Tellann's architecture supports deployment on that infrastructure.

I would publish `/legal/subprocessors` with provider name, processing purpose, data categories, processing location, and applicable safeguards, updated from the real production inventory.

## 9. Legal compliance and verification

The Nigerian privacy framework is the logical starting point if Tellann's eventual contracting entity is established in Nigeria, but its precise scope and international obligations depend on the entity, the customers, and where the processing occurs.

The relevant sources include:

- [Nigeria Data Protection Act 2023](https://ndpc.gov.ng/download/nigeria-data-protection-act-2023?utm_source=chatgpt.com) and the [Nigeria Data Protection Commission](https://ndpc.gov.ng/?utm_source=chatgpt.com). The NDPC identifies rights such as access, rectification, objection, restriction, portability, erasure, and safeguards concerning automated decision-making.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://ndpc.gov.ng\&sz=32)

  Nigeria Data Protection Commission

  +1

- The Nigeria General Application and Implementation Directive, effective September 19, 2025.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://ndpc.gov.ng\&sz=32)

  ndpc.gov.ng

- The [EU General Data Protection Regulation](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng?utm_source=chatgpt.com), particularly Articles 13–14 for transparency and Article 28 for processor agreements where applicable.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://eur-lex.europa.eu\&sz=32)

  EUR-Lex

- The UK's [ICO guidance on cookies and similar technologies](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/?utm_source=chatgpt.com). Necessary cookies and non-essential tracking have different consent requirements.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://ico.org.uk\&sz=32)

  ICO



## 10. Publication readiness checklist

Privacy launch readiness

0 / 13 confirmed

Use this as a working checklist. Checking an item records your review progress here; it does not independently verify implementation.

Confirm Tellann's contracting legal entity and registered address

Verify all deployed data collection and analytics tools

Reconcile the complete retention schedule

Test sensitive-field exclusion against custom payloads

Confirm exact local-versus-cloud source handling

Verify the deployed privacy masking and redaction controls

Create the live subprocessor inventory

Verify model-provider data retention and training terms

Approve the Data Processing Agreement

Implement or verify cookie consent management

Implement privacy request and deletion workflows

Confirm cross-border hosting and transfer safeguards

Complete legal and security reviews

&#x20;Copy checklist

## 11. Final recommendation

The Privacy Policy should be supported by three complementary documents, each serving a different function.

| Document     | Governs                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| `/privacy`   | Public transparency about Tellann's handling of personal information           |
| `/legal/dpa` | Contractual personal-data processing obligations between customers and Tellann |
| `/cookies`   | The actual cookies and tracking technologies used on Tellann's websites        |

I would also make privacy information available contextually inside the Desktop Agent, SDK integration documentation, data export workflows, and application settings.

The most important principle for Tellann is that privacy must be enforced at the source of collection, not merely described on the marketing website.

Tellann's local-first design is potentially a substantial competitive advantage. But claims such as “your source code stays on your machine” and “sensitive information is excluded before transmission” become liabilities if even one operating path contradicts them.

The draft establishes the policy framework. The next requirement before publication is to reconcile the few conflicting specifications, verify the deployed controls, identify every processor and retention period, and obtain legal approval.