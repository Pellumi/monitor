# Tellann — `/terms` Complete Page Specification & Terms of Service

Page type: Legal / Public Marketing Website

The `/terms` route should contain Tellann's primary Terms of Service, governing the contractual relationship between Tellann and the individuals, developers, businesses, and organizations using its platform.

Unlike most marketing pages, this page is not designed to persuade visitors to subscribe. Its purpose is to establish clear, enforceable rules while explaining customers' rights, responsibilities, financial obligations, and legal protections.

For Tellann, the document needs to account for substantially more than ordinary SaaS terms because the platform can access local development workspaces, analyze proprietary code, propose source-code modifications, record application behavior, process customer documentation, and generate quality intelligence.

Important legal distinction: This is a comprehensive publication draft, aligned with the uploaded specifications and relevant legal frameworks—not a certification that every clause is legally enforceable or that every documented capability has been implemented. Final publication requires confirmation of Tellann's contracting legal entity, a small number of unresolved policies, and legal review.

## 1. Page identity and SEO

| Property         | Implementation                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Route            | `/terms`                                                                                                                                                     |
| Page title       | Terms of Service — Tellann                                                                                                                                   |
| H1               | Terms of Service                                                                                                                                             |
| Canonical URL    | `https://tellann.co/terms`                                                                                                                                   |
| Meta description | Read Tellann's Terms of Service, including account responsibilities, subscriptions, billing, desktop software, data ownership, security, and acceptable use. |
| Indexing         | `index, follow`                                                                                                                                              |
| Authentication   | Not required                                                                                                                                                 |
| Mobile support   | Fully responsive                                                                                                                                             |
| Content format   | Server-rendered legal document                                                                                                                               |

No marketing illustrations, autoplay videos, promotional animations, or distracting conversion banners are necessary.

## 2. Recommended page layout

TELLANN / LEGAL

# Terms of Service

Effective date: [Publication date]

These terms govern your use of Tellann's website, cloud platform, desktop software, SDKs, APIs, and related services.

On this page

Acceptance and accounts

Services and licensing

Data and security

Subscriptions and billing

Liability and disputes

1\. Acceptance of Terms

2\. Description of Services

Continue reading...

Illustrative layout only: desktop uses a sticky table of contents beside the document; mobile collapses navigation into a section selector.

### Layout dimensions

| Element               | Desktop         | Mobile                   |
| --------------------- | --------------- | ------------------------ |
| Overall container     | Maximum 1,280px | Full width, 20px padding |
| Legal document column | 760–820px       | 100% width               |
| Table of contents     | 240–260px       | Collapsible              |
| Hero heading          | 44–52px         | 32–36px                  |
| Section headings      | 22–26px         | 20–22px                  |
| Body text             | 15–16px         | 15–16px                  |
| Line height           | 1.7–1.85        | 1.65–1.8                 |
| Section spacing       | 36–48px         | 28–36px                  |

Use Tellann's monochrome branding and established typography. The document should prioritize readability over visual novelty.

## 3. Page structure

```
/terms
│
├── Marketing Navbar
├── Breadcrumbs
├── Legal Header
│   ├── Terms of Service
│   ├── Effective Date
│   ├── Last Updated
│   └── Introductory Explanation
│
├── Legal Document Layout
│   ├── Sticky Table of Contents
│   └── Complete Terms of Service
│
├── Related Legal Documents
│   ├── Privacy Policy
│   ├── Cookie Policy
│   ├── Acceptable Use Policy
│   ├── Data Processing Agreement
│   └── Security Information
│
├── Legal Contact
├── Document Version / Update Information
└── Marketing Footer
```

The table of contents should support anchor navigation, active-section indication, keyboard navigation, and copying direct links to clauses.

## 4. Tellann-specific contractual coverage

The following capabilities require explicit provisions, rather than generic disclaimers copied from another SaaS provider.

| Product area             | What the terms must establish                                               |
| ------------------------ | --------------------------------------------------------------------------- |
| Desktop Agent            | Local workspace permissions, user consent, code modification and rollback   |
| SDKs and ingestion APIs  | Authorized instrumentation, collection responsibilities, secure credentials |
| Developer Demonstrations | Permission to observe application behavior in controlled runs               |
| Behavior Graphs          | Ownership and permitted uses of derived workflow models                     |
| Flow Declaration         | Responsibility for human-authored intent and accepted suggestions           |
| Reconciliation           | Difference between recorded evidence and guaranteed software correctness    |
| Session Replay           | Telemetry reconstruction, privacy rules and restricted content              |
| Endpoint Intelligence    | Analytical nature of performance and error findings                         |
| QA Reports               | Ownership, permitted use and limitations of generated reports               |
| Assisted Intelligence    | Third-party model processing, sanitized inputs and human acceptance         |
| Billing                  | Trials, recurring payments, upgrades, downgrades and cancellations          |
| Enterprise               | Self-hosting, security allocation, negotiated agreements and SLAs           |
| Future Phases            | Separate authorization and terms for production and autonomous capabilities |

The documents establish six plans—Free, Local, Solo, Team, Business, and Enterprise—and a 14-day card-authorized trial that converts to a paid subscription unless cancelled. Phase 1 does not bill separately for telemetry events, QA reports, desktop-agent usage, or assisted intelligence.

The legal text below is written around those documented rules, rather than an assumed pricing model.

# 5. Complete Terms of Service — Publication Draft

The following is the proposed text for the legal document itself. Square-bracketed fields identify information that must be confirmed before publication.

# Terms of Service

**Effective Date:** [Date of publication]\
**Last Updated:** [Date of last substantive revision]\
**Document Version:** 1.0\
**Service Provider:** [Full legal name of Tellann's contracting entity]\
**Website:** [https://tellann.co](https://tellann.co)

## Introduction

Welcome to Tellann.

These Terms of Service ("Terms") govern your access to and use of Tellann, a software quality intelligence platform that helps developers, quality assurance professionals, and organizations understand application behavior, assess workflow coverage, reconcile intended functionality against observed evidence, and investigate software quality issues.

These Terms form a legally binding agreement between you, or the organization you represent, and [Full Legal Entity Name] ("Tellann," "we," "us," or "our").

Please read these Terms carefully before creating an account, installing Tellann software, subscribing to a paid plan, connecting an application, or otherwise using our Services.

**By accepting these Terms during registration, subscription, or another agreement process, you agree to be bound by them.** If you are accepting on behalf of an organization, you represent that you are authorized to do so.

If you do not agree, you must not use the Services.

These Terms should be read together with our Privacy Policy, applicable Data Processing Agreement, product-specific terms, and any separately executed enterprise agreement.

## 1. Definitions

For purposes of these Terms:

**"Account"** means the identity and associated credentials used to access Tellann.

**"Organization"** means a workspace, company, team, or other customer entity registered within the platform.

**"Authorized User"** means an individual permitted by an Organization to access its Tellann resources.

**"Services"** means Tellann's websites, cloud platform, dashboard, desktop software, SDKs, APIs, documentation, reporting features, integrations, and other functionality made available by Tellann.

**"Desktop Agent"** means Tellann's locally installed application for workspace binding, codebase analysis, instrumentation, and managed application demonstrations.

**"SDK"** means software development kits, libraries, or integration components supplied by Tellann for application telemetry collection.

**"Customer Data"** means information, materials, telemetry, application metadata, declared workflows, submitted documents, and other content provided to or processed through the Services on behalf of a customer.

**"Customer Source Code"** means source files, repositories, configuration files, and other proprietary software materials belonging to or lawfully controlled by a customer.

**"Derived Artifacts"** means analysis projections, code graphs, reconstructed sessions, workflow models, findings, coverage measurements, and related outputs generated through processing Customer Data.

**"QA Report"** means a report, finding, visualization, summary, or export generated by Tellann from available evidence.

**"Subscription"** means an entitlement to a particular plan for an applicable billing period.

**"Paid Plan"** means an eligible subscription other than the Free plan.

**"Documentation"** means the applicable technical instructions, product descriptions, and published integration guidance.

**"Applicable Law"** means laws and regulations governing the relevant party, activities, jurisdiction, or data-processing operation.

## 2. Eligibility and Authority

### 2.1 Minimum eligibility

You must be legally capable of entering into a binding agreement under Applicable Law.

Individuals who lack legal capacity may not independently enter into paid agreements or administer organizational accounts.

### 2.2 Organizational authority

If you register, subscribe, or use the Services on behalf of an Organization, you represent and warrant that you have authority to:

- Accept these Terms on the Organization's behalf.
- Connect or authorize the connection of relevant applications.
- Grant the permissions necessary for the applicable Services.
- Authorize payments where you are the designated payer.
- Manage resources within your assigned organizational role.

The Organization is responsible for activities conducted by its Authorized Users within the authority granted to them, subject to Tellann's own obligations under these Terms and Applicable Law.

### 2.3 Accurate information

You agree to provide accurate registration, billing, and contact information and to keep it reasonably current.

You must not deliberately misrepresent your identity, billing country, organizational authority, or eligibility for a plan.

## 3. Account Registration and Security

### 3.1 Account creation

Certain Services require registration and authentication.

Tellann may provide password-based authentication, one-time verification codes, multi-factor authentication, device authorization, and organization-based identity management, depending on the available functionality and plan.

### 3.2 Account responsibilities

You must take reasonable steps to protect your account, including:

- Safeguarding passwords and access credentials.
- Not sharing personal login credentials with unauthorized persons.
- Maintaining the security of devices used to access Tellann.
- Revoking credentials and device access that are no longer required.
- Promptly reporting suspected account compromise.

### 3.3 Organization membership and permissions

Tellann supports organizational access roles, including Owner, Admin, Member, and Viewer.

The permissions available to each user depend on the user's role, organizational configuration, and subscribed plan.

Organization Owners are responsible for controlling membership, ownership transfers, and other privileged organizational operations.

### 3.4 Device sessions and API credentials

Desktop device sessions, SDK ingestion credentials, and programmatic access tokens are separate authentication mechanisms.

You must use each credential only for its intended purpose.

You must not publish secret credentials, deliberately bypass permission boundaries, or provide unauthorized third parties with access to organizational resources.

### 3.5 Unauthorized access

You must notify Tellann promptly after becoming aware of unauthorized access, stolen credentials, compromised devices, or suspected misuse of your Organization.

Tellann may revoke compromised credentials or restrict access where reasonably necessary to protect users and the Services.

## 4. Description and Scope of Services

### 4.1 Core functionality

Tellann provides tools for observing, reconstructing, and analyzing application behavior.

Depending on the currently available features and the customer's subscription, the Services may include:

- Application registration and environment management.
- Declaration and management of intended application workflows.
- Locally managed developer demonstrations.
- Frontend and backend behavioral data capture.
- Session reconstruction and replay.
- Behavior graph creation and workflow discovery.
- Workflow, state, transition, and endpoint coverage analysis.
- Identification of unobserved states and paths.
- Reconciliation of declared intent against observed behavior.
- Endpoint and error analysis.
- Visual and accessibility findings.
- QA reporting and export.
- Codebase and product-document analysis.
- Team collaboration and organizational administration.

Functionality is subject to actual product availability, technical compatibility, and applicable plan entitlements.

### 4.2 Evidence-based analysis

Tellann generates analytical results from available application evidence.

A report may identify an unobserved workflow, a possible missing state, a discrepancy between declaration and observation, or another quality concern.

**An unobserved workflow is not necessarily a defective or unimplemented workflow.**

Likewise, an observed workflow is not proof that every implementation condition, security requirement, edge case, or user experience is correct.

Users remain responsible for interpreting analytical results and conducting any additional validation required for their applications.

### 4.3 Product evolution

Tellann may develop additional capabilities involving production monitoring, workflow health, real-user journey intelligence, regression detection, assisted validation, and autonomous quality intelligence.

A capability described on a roadmap, in conceptual documentation, or in promotional material does not become an available or contractually included Service merely because it has been announced.

Any new capability involving materially different data processing, additional fees, or authority to modify customer systems may require separate notice, authorization, or agreement.

### 4.4 Technical compatibility

Certain functionality requires compatible operating systems, runtimes, frameworks, network access, application instrumentation, or desktop environments.

Tellann does not warrant compatibility with every programming language, application architecture, browser, database, operating system, or third-party service.

## 5. License to Use Tellann

### 5.1 Service license

Subject to these Terms and applicable payment obligations, Tellann grants you a limited, non-exclusive, non-transferable, non-sublicensable right to access and use the Services during your applicable subscription or authorized access period.

Use is permitted for lawful internal development, testing, quality assurance, application analysis, and related organizational purposes.

### 5.2 Software license

Tellann grants you permission to install and execute supported Desktop Agent and SDK components for authorized use with the Services.

You may not distribute proprietary Tellann components to unrelated third parties, resell access, or operate an unauthorized competing hosted service based on Tellann software.

The preceding restrictions do not override rights expressly granted under any applicable open-source license.

### 5.3 Open-source components

Some software components may be provided under separate open-source licenses.

Those licenses govern the relevant components to the extent of any inconsistency with these Terms.

### 5.4 Restrictions

Except where expressly permitted by law or an applicable license, you must not:

- Remove proprietary notices.
- Circumvent subscription or authorization controls.
- Sell or sublicense proprietary platform access without authorization.
- Misrepresent Tellann software as your own proprietary product.
- Copy proprietary internal implementations for unauthorized redistribution.
- Interfere with the security or availability of the Services.

## 6. Customer Applications and Authorized Access

### 6.1 Rights to connected systems

You may connect, analyze, instrument, or demonstrate only applications, repositories, environments, and systems that you own or are lawfully authorized to access.

You are responsible for obtaining any necessary permissions from employers, clients, customers, repository owners, or other relevant parties.

### 6.2 Application configuration

You are responsible for:

- Selecting the appropriate application and environment.
- Maintaining valid integration credentials.
- Configuring telemetry collection within lawful boundaries.
- Testing integration changes.
- Ensuring the connected application remains adequately protected.

### 6.3 Testing environments

Where practical, application demonstrations and instrumentation should first be conducted in development, staging, or other controlled environments.

If you authorize operations against a production system, you remain responsible for assessing the operational risk of those actions and for ensuring the relevant feature is intended and permitted for production use.

### 6.4 Third-party systems

Your use of Tellann does not grant permission to bypass third-party authentication, violate repository permissions, or exceed authorization granted by another service provider.

## 7. Desktop Agent and Local Workspace Access

### 7.1 Nature of local access

The Desktop Agent may require permission to access a local software workspace.

Depending on enabled functionality, this access can include:

- Reading supported project files.
- Examining repository structure and metadata.
- Creating code analysis projections.
- Identifying workflow checkpoints.
- Examining branch and version-control state.
- Preparing instrumentation changes.
- Running permitted local validation operations.
- Launching and controlling managed browser demonstration sessions.

### 7.2 Source-code handling

Tellann's intended operating model is local-first.

Customer Source Code is analyzed on the user's machine by default.

Derived analysis information may be transmitted to Tellann's Services where required to provide the requested functionality.

Raw source files or source archives must not be transmitted to Tellann without explicit authorization for a stated purpose.

### 7.3 Source upload consent

Where a feature requires uploading raw source materials, Tellann must identify the purpose of the upload and obtain the required authorization.

Consent to one upload does not constitute ongoing permission to upload the same repository for other purposes.

Source archives uploaded under such authorization are subject to purpose-limited handling and deletion requirements.

### 7.4 Workspace binding

Binding a workspace authorizes the Desktop Agent to perform supported operations within the approved scope.

Such authorization does not transfer ownership of the repository or grant unrestricted control of the user's computer.

A user may revoke workspace access by using available unbinding, permission, or device-revocation mechanisms.

### 7.5 Device security

You are responsible for securing the local device on which the Desktop Agent runs, including maintaining appropriate system permissions, malware protection, access controls, and backups.

Tellann is responsible for implementing the security controls it undertakes to provide within its software and hosted Services.

## 8. Instrumentation and Source-Code Modification

### 8.1 Instrumentation functionality

Certain subscription tiers may permit the Desktop Agent to propose changes to a customer's working tree for behavioral instrumentation.

Such changes may introduce tracking hooks, SDK configuration, workflow markers, or other approved integration components.

### 8.2 Human authorization

Tellann must not intentionally apply an instrumentation plan to a customer's working tree without the required explicit approval.

Where an instrumentation feature is available, the customer must be provided with a reviewable description or diff of proposed changes before approval.

### 8.3 Reversibility

Supported instrumentation operations must provide a recorded rollback mechanism for reverting the changes made by the approved plan.

Rollback is intended to reverse Tellann-generated instrumentation changes. It does not replace normal source-control practices, repository backups, or independent verification.

### 8.4 Branch governance

Where supported, organizational branch policies and time-limited checkout permissions govern the Desktop Agent's authorization to switch branches and apply modifications.

### 8.5 Customer responsibility

You are responsible for reviewing proposed changes, confirming their suitability, and conducting appropriate tests before committing or deploying modified software.

Tellann remains responsible for failures caused by its breach of applicable contractual obligations, subject to the remedies and limitations permitted by Applicable Law.

### 8.6 No unrestricted modification authority

Installation of the Desktop Agent or acceptance of these Terms does not grant Tellann unrestricted authority to modify, commit, deploy, or otherwise change customer applications.

Any future autonomous modification or remediation capability requires a separately defined authorization scope, including revocation and appropriate safeguards.

## 9. Behavioral Capture, Telemetry, and Session Replay

### 9.1 Captured information

Depending on the enabled integrations and features, Tellann may process application behavior data such as:

- Page visits and navigation transitions.
- UI interactions and form-event metadata.
- Application state and workflow transitions.
- API request and response metadata.
- Timing and performance information.
- Error classifications.
- Session and demonstration identifiers.
- Browser diagnostic findings.

Collection is governed by the applicable Documentation, privacy controls, and data-processing terms.

### 9.2 Session replay

Tellann's Session Replay functionality reconstructs behavioral timelines from recorded telemetry.

Session Replay is not necessarily a video or pixel-accurate recording of a user's screen.

Its completeness and accuracy depend on the available and successfully processed evidence.

### 9.3 Sensitive information

Application telemetry must not be configured to intentionally capture prohibited sensitive material such as plaintext passwords, private keys, authentication tokens, full payment credentials, government identity records, or protected health information.

Tellann implements privacy and protected-value controls within supported components, but customers remain responsible for their own application-specific data handling and configurations.

### 9.4 Customer notice and consent

Where your use of Tellann involves observing employees, customers, testers, or end users, you are responsible for providing legally required notices, establishing a valid legal basis, and obtaining consent where required.

You must not use Tellann as an undisclosed surveillance tool or for unauthorized monitoring of individuals.

### 9.5 Limitations

Tellann may reject, exclude, aggregate, mask, or otherwise restrict telemetry where necessary to enforce privacy, security, technical, or contractual requirements.

## 10. Declared Intent, Reconciliation, and Quality Analysis

### 10.1 Declared intent

Users may describe expected application workflows, states, and transitions through Tellann's supported interfaces.

These declarations constitute customer-provided expectations and do not independently establish that the declared functionality exists.

### 10.2 Observed behavior

Tellann reconstructs observed behavior from the available captured evidence.

Observed behavior represents what the platform recorded and processed, not necessarily the complete set of possible application behaviors.

### 10.3 Reconciliation

Tellann may compare declared intent against observed behavior and classify confirmed behavior, unobserved expected behavior, and observed but undeclared behavior.

These classifications support quality investigation and are not conclusive legal, security, or regulatory certifications.

### 10.4 Recommendations and findings

Recommendations are provided to help customers investigate potential improvements.

Users remain responsible for determining their relevance, correctness, and suitability before implementing changes.

### 10.5 Quality assurance responsibility

Tellann supplements existing quality assurance processes.

It does not eliminate the need for independent testing, code review, security assessments, accessibility verification, operational monitoring, or release governance.

## 11. Customer Data Ownership and Intellectual Property

### 11.1 Customer ownership

As between Tellann and the customer, the customer retains all rights, title, and interest in Customer Source Code, customer-authored materials, proprietary application information, and Customer Data, except for materials owned by third parties.

Nothing in these Terms transfers ownership of your repository or proprietary software to Tellann.

### 11.2 Processing license

You grant Tellann a limited, non-exclusive license to host, transmit, process, reproduce, display, and transform Customer Data only as reasonably necessary to provide, secure, maintain, support, and improve the contracted Services in accordance with these Terms and applicable data-processing arrangements.

This license ends when no longer required for those permitted purposes, subject to applicable retention and legal obligations.

### 11.3 Generated reports and outputs

Customers may use, reproduce, download, share, and internally modify their generated QA Reports, workflow analyses, and customer-specific analytical outputs for lawful business and engineering purposes.

To the extent that Tellann owns rights in customer-specific generated output, Tellann grants the customer a perpetual, worldwide, non-exclusive, royalty-free license to use and distribute that output, subject to applicable third-party rights and confidentiality obligations.

This does not transfer ownership of Tellann's underlying software, algorithms, generic report templates, analytical methods, or platform infrastructure.

### 11.4 Tellann intellectual property

Tellann retains ownership of its proprietary software, trademarks, interfaces, algorithms, Documentation, product designs, service architecture, and other intellectual property.

### 11.5 Feedback

If you voluntarily provide product suggestions or feedback, Tellann may use that feedback to develop and improve its Services without compensation, provided it does not disclose confidential Customer Data or proprietary source materials without authorization.

## 12. Aggregated and Anonymized Information

### 12.1 Operational statistics

Tellann may generate statistical information about service performance, usage, system reliability, feature utilization, and other operational characteristics.

Such information must be handled in accordance with the applicable privacy and data-processing requirements.

### 12.2 Structural pattern analysis

Tellann may generate anonymized, aggregated structural patterns from application behavior graphs to improve supported workflow modeling and suggestion capabilities.

Such patterns must not identify an individual customer or expose customer-specific source code, raw telemetry payloads, confidential application content, or identifiable business information.

### 12.3 Cross-organization protection

Tellann must not make another customer's identifiable records or proprietary behavioral data available through structural pattern matching.

Cross-organization use is limited to non-identifying, aggregated structural information within the permitted processing purpose.

### 12.4 Exclusion requests

Organizations requiring exclusion from eligible cross-organization structural aggregation may request the applicable exclusion through Tellann's supported organizational configuration or contact process.

The scope and implementation of that exclusion must be disclosed and honored in accordance with the applicable policy or agreement.

## 13. Assisted Intelligence and Automated Suggestions

### 13.1 Assisted functionality

Tellann may use automated or model-assisted capabilities for limited activities, including draft workflow generation, suggestion enrichment, domain inference, and processing of supported product documentation.

Availability may vary by plan and release.

### 13.2 Third-party processing

Where an assisted feature uses an external model provider, sanitized information necessary for the requested task may be transmitted to that provider, subject to applicable privacy safeguards and data-processing arrangements.

### 13.3 Human review

Model-generated suggestions and drafts may contain mistakes, omissions, or inaccurate interpretations.

They must be reviewed by an authorized user before being incorporated into customer-declared intent or other consequential configurations.

### 13.4 Analytical results

Model assistance must not be treated as independent proof that an application is correct, secure, or production-ready.

### 13.5 Customer content and training

Use of Tellann does not itself grant unrestricted permission to use Customer Source Code or confidential Customer Data for unrelated general-purpose model training.

Any such use requires a separately established lawful basis, appropriate contractual authorization, and clear disclosure.

### 13.6 Future autonomous features

Any future capability that executes tests, proposes remediation, or modifies customer systems autonomously will be subject to additional authorization and controls appropriate to the nature of the action.

## 14. Data Protection and Privacy

### 14.1 Privacy framework

Tellann processes personal information in accordance with Applicable Law, its Privacy Policy, and relevant contractual data-protection obligations.

### 14.2 Data controller and processor roles

For personal information collected directly for account administration, billing, security, and business operations, Tellann may act as an independent data controller.

Where Tellann processes personal data contained in customer application telemetry or other Customer Data on the customer's behalf, Tellann generally acts as a data processor or equivalent service provider, as determined by the relevant law and processing circumstances.

### 14.3 Customer responsibilities

Customers are responsible for ensuring that their instructions, integrations, and collection practices are lawful, including maintaining appropriate notices, consent mechanisms where required, and other legal bases.

### 14.4 Tellann responsibilities

Tellann is responsible for implementing the technical and organizational safeguards applicable to its role and for handling Customer Data within the authorized scope.

### 14.5 Data Processing Agreement

Where required, processing of personal data on behalf of a customer will be governed by a Data Processing Agreement ("DPA") addressing the relevant processing activities, security measures, subprocessors, assistance obligations, and data return or deletion requirements.

### 14.6 International transfers

International transfers of personal data must comply with applicable cross-border transfer requirements and any necessary contractual safeguards.

### 14.7 Privacy rights

Individuals may have legal rights relating to access, correction, deletion, portability, objection, restriction, or other matters.

Requests will be handled according to the applicable controller–processor relationship and Applicable Law.

## 15. Data Security and Confidentiality

### 15.1 Security measures

Tellann will implement reasonable and appropriate technical and organizational measures for protecting the Services and Customer Data, taking account of the nature of the processing and relevant contractual obligations.

These may include access controls, encryption, session management, credential protection, tenant isolation, logging, and security monitoring, as applicable.

### 15.2 Shared responsibility

Tellann is responsible for securing the infrastructure and software components under its control.

Customers are responsible for securing their applications, connected systems, devices, local workspaces, access permissions, and their own infrastructure.

### 15.3 Confidentiality

Each party must protect the other party's non-public confidential information using reasonable care and may disclose it only where authorized, necessary for permitted service operations under suitable confidentiality obligations, or legally required.

Confidentiality obligations do not apply to information lawfully public, independently developed without misuse, or lawfully obtained from an unrestricted third party.

### 15.4 Security incidents

Tellann will investigate confirmed security incidents affecting systems under its control and provide legally or contractually required notifications and cooperation.

Customers must promptly notify Tellann of suspected unauthorized use of their accounts or integrations.

### 15.5 No absolute security guarantee

No internet-connected system can be guaranteed immune from every vulnerability or operational failure.

This statement does not reduce Tellann's obligation to maintain the safeguards it contractually promises or those required by law.

## 16. Subscriptions, Plans, and Usage Limits

### 16.1 Available plans

Tellann's commercial plan structure includes:

- Free.
- Local (Nigeria only).
- Solo.
- Team.
- Business.
- Enterprise.

The features and limits associated with each plan are described on the applicable pricing, entitlement, or subscription pages.

### 16.2 Organization-scoped subscriptions

Subscriptions grant entitlements to a particular Organization.

Application limits, active user seats, storage, retention, environments, and applicable credentials are measured or enforced at the organizational level.

### 16.3 Billing identity

The paying user maintains billing information that may determine the available billing currency, payment processors, and regional plan eligibility for Organizations they pay for.

### 16.4 Usage limits

You agree to remain within your plan's applicable resource limits.

Tellann may prevent new resource creation, restrict additional ingestion, or limit unavailable features when an applicable quota is reached.

### 16.5 User seats

Where applicable, user seats include active Organization members and unexpired invitations.

Revoking an invitation or removing a member releases the corresponding occupied seat, according to the platform's metering rules.

### 16.6 Feature availability

A subscription does not grant access to features excluded from the plan or not yet generally available.

### 16.7 Usage transparency

Tellann will identify customer-facing billable units and applicable limits.

Measurement of operational events or internal compute consumption does not by itself create a charge.

## 17. Free Trials

### 17.1 Trial period

Eligible new paying users may receive a 14-day trial of the applicable introductory paid plan.

The documented introductory trial is Solo, or Local for eligible Nigeria-billed customers.

### 17.2 Payment authorization

Starting the trial requires an accepted, chargeable payment method.

A nominal card authorization may be performed to verify that the payment method is usable. This is not the subscription charge.

Any temporary authorization hold is subject to the payment processor and issuing bank's handling.

### 17.3 Trial access

During the trial, the Organization receives the applicable trial-plan entitlements.

### 17.4 Automatic conversion

Unless cancelled or otherwise changed before the trial ends, the trial converts to a paid subscription and the first subscription payment becomes due at the disclosed conversion date.

The trial conversion terms, amount, and payment schedule must be clearly displayed before the customer authorizes the trial.

### 17.5 Cancellation during trial

You may cancel before the trial ends to prevent the first subscription charge.

Cancelling a trial does not require purchasing a paid plan.

### 17.6 Trial eligibility

Trial eligibility is limited to one trial per paying user and one trial per Organization, subject to reasonable enforcement controls.

### 17.7 Enterprise evaluations

Enterprise evaluations may be governed by separately negotiated agreements and do not automatically follow the standard trial process.

## 18. Billing, Payments, and Taxes

### 18.1 Subscription fees

Paid subscription fees are charged according to the selected plan, billing currency, and billing period displayed at checkout.

### 18.2 Billing intervals

Tellann offers monthly and annual subscriptions where available.

Under the documented billing model, monthly cycles renew after 30 days and annual cycles after 365 days, unless an applicable agreement specifies otherwise.

### 18.3 Automatic renewal

Paid subscriptions renew automatically unless cancelled or changed before the applicable renewal date.

The billing interface must disclose the renewal schedule and provide a method for managing or cancelling renewal.

### 18.4 Payment processing

Tellann may use authorized third-party payment processors to collect subscription payments.

Supported methods and processors depend on billing currency, payer eligibility, and current processor availability.

### 18.5 Payment authorization

By subscribing, you authorize Tellann and its designated payment processor to charge the disclosed amounts, including authorized renewals and prorated subscription changes, using your selected payment method.

### 18.6 Currency

Charges are made in the billing currency established for your subscription.

Currency conversion charges or other charges imposed independently by your bank or payment provider may apply.

### 18.7 Taxes

Applicable taxes are determined according to relevant tax laws and the disclosed billing arrangements.

Tellann's documented pricing policy is to display tax-inclusive subscription prices, with applicable tax components identified on invoices.

No additional tax or fee will be imposed contrary to the disclosed checkout terms or mandatory law.

### 18.8 Invoices

Tellann makes applicable invoices and payment receipts available through its billing functionality.

### 18.9 Billing disputes

If you believe a payment was incorrect or unauthorized, you should contact Tellann through the billing support channel with relevant transaction information.

Nothing in these Terms limits statutory payment-dispute or chargeback rights.

## 19. Upgrades, Downgrades, and Overages

### 19.1 Upgrades

Upgrades to a higher paid plan may take effect immediately.

Where the change increases the subscription price, the additional amount will be prorated for the unused portion of the billing period and disclosed before the change is authorized.

### 19.2 Downgrades

Scheduled downgrades ordinarily take effect at the next renewal.

The Organization may retain existing higher-tier access until the downgrade becomes effective.

### 19.3 Downgrade consequences

A downgrade may reduce application limits, seats, retention periods, storage allowances, available report formats, or other entitlements.

Tellann will provide information or warnings about relevant limits.

Existing data is not deleted solely because a downgrade event occurs, but data may subsequently become subject to the shorter retention period of the new plan.

### 19.4 Phase 1 metering

During the Behavioral QA & Intent Platform phase, Tellann does not separately charge for:

- Individual telemetry events.
- Demonstration sessions on paid plans.
- Session replay operations.
- Behavior graph generation.
- Reconciliation operations.
- QA report generation or export.
- Included assisted intelligence consumption.
- Use of the Desktop Agent itself.

Applicable application, seat, storage, retention, and other resource entitlements remain enforceable.

### 19.5 Future usage-based billing

Future production-event billing, AI-consumption billing, or other usage-based charges will not apply merely because such features appear on Tellann's roadmap.

New charges require appropriate advance disclosure, pricing terms, and authorization consistent with Applicable Law.

## 20. Failed Payments and Grace Periods

### 20.1 Failed renewal

If a subscription renewal payment fails, the Organization enters the documented payment-recovery process.

### 20.2 Grace period

Tellann provides a seven-day grace period for failed recurring payments under the standard subscription model.

During that period, the Organization retains its existing paid-plan entitlements while payment recovery is attempted.

### 20.3 Payment retries

Tellann may retry the authorized payment method once per day during the grace period and provide payment failure notifications.

Updating the payment method may trigger another collection attempt.

### 20.4 End of grace period

If payment is not recovered by the end of the grace period, the Organization is automatically returned to the Free plan.

### 20.5 Data consequences

The return to Free does not itself immediately delete existing Customer Data.

However, Free plan quotas and retention rules begin to apply, and data exceeding the applicable retention window may subsequently be deleted through ordinary retention processing.

### 20.6 Suspension for cause

Payment-related downgrade is separate from suspension imposed for security, abuse, legal, or other contractual reasons.

## 21. Cancellation and Refunds

### 21.1 Cancellation

The designated paying user may cancel an eligible recurring subscription through the available billing interface or authorized support process.

### 21.2 Effect of cancellation

Unless the customer requests an earlier termination that Tellann accepts, or Applicable Law requires otherwise, cancellation stops future renewal and the subscription remains available through the end of the already-paid term.

After that term, the Organization may continue under the Free plan, subject to its entitlements and retention rules.

### 21.3 Trial cancellation

A valid cancellation completed before the disclosed trial conversion time prevents the first paid subscription charge.

### 21.4 Refund requests

Payment for an already-started subscription period is not automatically refunded solely because the customer cancels renewal or does not use the Services.

Refunds, credits, subscription extensions, or other appropriate remedies may be available for duplicate or unauthorized charges, material service failures, incorrect billing, or other qualifying circumstances.

Tellann will assess requests reasonably and in accordance with Applicable Law.

### 21.5 Mandatory rights

Nothing in these Terms excludes rights or remedies that cannot lawfully be restricted, including rights concerning materially defective, misrepresented, or undelivered services.

## 22. Data Retention, Export, and Deletion

### 22.1 Retention

Customer Data is retained according to applicable plan limits, published retention rules, and legal or contractual obligations.

Different categories of data may have different retention requirements where expressly disclosed.

### 22.2 Plan changes

Changes to an Organization's subscription may change the applicable data-retention window.

Customers should export necessary records before reducing or ending their subscription.

### 22.3 Export

Authorized users may export supported Customer Data and generated reports in formats made available by their entitlements.

Exports remain subject to applicable security, privacy, and access controls.

### 22.4 Organization deletion

An authorized Organization Owner may request deletion through supported administrative functionality or a verified support process.

Tellann may require appropriate identity and authority verification before executing a deletion request.

### 22.5 Deletion processing

Following valid deletion or termination instructions, Tellann will delete or return relevant Customer Data in accordance with applicable retention rules, data-processing agreements, technical deletion schedules, and legal obligations.

Limited copies may remain in protected backups or records where lawfully required, subject to restricted access and subsequent deletion.

### 22.6 Purpose-limited source archives

Source archives uploaded with express permission for a defined purpose are subject to deletion when that purpose is complete, independently of ordinary subscription retention.

### 22.7 Local copies

Uninstalling the Desktop Agent does not necessarily delete data previously transmitted to the cloud Services.

Likewise, deleting cloud data does not automatically remove source files or other materials stored in the customer's own workspace.

## 23. Acceptable Use and Prohibited Activities

You must not use Tellann to:

1. Access or analyze applications, repositories, accounts, or systems without authorization.
2. Harvest passwords, credentials, authentication tokens, or private information.
3. Conduct unlawful or undisclosed surveillance.
4. Intentionally transmit prohibited sensitive data in violation of applicable privacy requirements.
5. Deploy malicious code, malware, ransomware, or unauthorized persistence mechanisms.
6. Attack, impair, overload, or circumvent Tellann's services, security, billing, or access controls.
7. Misrepresent organizational authority, location-based eligibility, or payment identity.
8. Use the platform to facilitate fraud, unlawful discrimination, or other illegal activities.
9. Redistribute proprietary Tellann software in violation of applicable license terms.
10. Interfere with other customers' data, environments, or tenancy boundaries.
11. Use the platform to perform unauthorized security tests or destructive operations against third-party systems.
12. Attempt to bypass enforced plan limits or obtain features through deliberately fraudulent means.

Legitimate security research, authorized testing, and lawful software interoperability are not prohibited merely because they involve technical investigation.

Any testing against Tellann-operated infrastructure must follow Tellann's published vulnerability disclosure or testing authorization policy.

## 24. Third-Party Services and Integrations

Tellann may interact with third-party frameworks, repositories, identity providers, payment processors, hosting providers, or other technology platforms.

Use of those services may be governed by separate agreements between the customer and the third-party provider.

Tellann does not grant customers rights to third-party software or systems beyond those it is authorized to grant.

Tellann remains responsible for its own contractual obligations and for third-party service providers to the extent required by Applicable Law or applicable agreements.

The customer is responsible for maintaining any independent subscriptions, licenses, credentials, or permissions required for their connected systems.

## 25. Enterprise and Self-Hosted Deployments

### 25.1 Enterprise agreements

Enterprise subscriptions may be governed by negotiated commercial agreements, order forms, support terms, and Data Processing Agreements.

### 25.2 Self-hosted deployments

Where an Enterprise customer elects an authorized self-hosted deployment, the customer ordinarily controls its hosting infrastructure, network environment, local operational security, and deployment configuration.

Tellann's responsibilities for licensing, updates, support, vulnerabilities, and deployment assistance are established by the applicable enterprise agreement.

### 25.3 Service levels

Any binding uptime commitment, service credit, incident response time, or dedicated support obligation is governed by an applicable Service Level Agreement ("SLA") or negotiated contract.

General technical objectives in Tellann's engineering documentation do not independently establish an SLA.

### 25.4 Conflicting terms

A mutually executed enterprise agreement or order form takes precedence over these public Terms to the extent of a direct conflict concerning the same subject.

Mandatory data protection terms and applicable law retain their required priority.

## 26. Service Availability, Maintenance, and Changes

### 26.1 Availability

Tellann will use commercially reasonable efforts to operate and maintain the Services in accordance with applicable commitments.

Temporary interruptions may occur because of maintenance, network failures, security incidents, third-party outages, or other operational circumstances.

### 26.2 Maintenance

Tellann may perform scheduled or emergency maintenance.

Reasonable advance notice will be provided for material planned disruptions where practicable.

### 26.3 Updates

Tellann may update its software, APIs, SDKs, and other functionality.

Changes affecting independently versioned integrations will be managed according to the applicable compatibility and deprecation policies.

### 26.4 Material service reductions

Tellann will provide reasonable notice of material reductions or discontinuation of paid functionality, except where immediate action is reasonably required for security, legal compliance, or prevention of harm.

Applicable remedies will be provided where required by law or contract.

### 26.5 Roadmap information

Published roadmaps and development plans communicate present intentions, not unconditional commitments.

## 27. Suspension and Termination

### 27.1 Customer termination

Customers may stop using the Services and cancel their subscriptions in accordance with these Terms.

### 27.2 Suspension by Tellann

Tellann may temporarily restrict or suspend access where reasonably necessary because of:

- Material violations of these Terms.
- Unauthorized access or credible security threats.
- Fraud or payment misuse.
- Unlawful activity.
- Material risk to other customers or the platform.
- Legal or regulatory requirements.

Where practicable, Tellann will provide notice and an opportunity to remedy the issue before suspension.

### 27.3 Suspension scope

Suspension should be proportionate to the relevant risk.

Where safe and legally permissible, affected Organizations may retain restricted access to existing reports and data exports during suspension.

### 27.4 Termination for material breach

Either party may terminate the agreement for a material breach that remains unremedied following reasonable notice and an appropriate opportunity to cure, except where immediate termination is legally justified.

### 27.5 Effect of termination

Upon termination, rights to use the terminated Services cease, except for rights expressly surviving termination.

Accrued payment obligations, applicable confidentiality duties, intellectual property provisions, dispute provisions, and lawful data retention obligations may survive.

## 28. Disclaimers and Analytical Limitations

### 28.1 Nature of the Services

Tellann provides software quality analysis and supporting engineering tools.

Its results depend on the information available to the system, the customer's configuration, and the completeness of the relevant evidence.

### 28.2 No guarantee of defect-free software

Tellann does not guarantee that its use will identify every defect, vulnerability, accessibility issue, regression, performance problem, or unimplemented workflow.

### 28.3 No certification

Unless expressly agreed in writing, Tellann's analytical outputs do not constitute an independent security certification, regulatory compliance certification, professional audit opinion, or warranty that a customer application is safe for release.

### 28.4 Professional judgment

Customers remain responsible for engineering decisions, deployment approval, and evaluating software quality.

### 28.5 Statutory rights

To the extent permitted by Applicable Law, the Services are provided subject to the express warranties and commitments in the applicable agreement.

No disclaimer excludes an obligation or remedy that cannot lawfully be excluded.

## 29. Limitation of Liability

### 29.1 Excluded losses

To the extent permitted by Applicable Law, neither party will be liable to the other for indirect, incidental, special, or consequential losses, including lost profits or business opportunities, arising from these Terms.

This exclusion applies only to the extent such losses may lawfully be excluded and does not override express commitments or legally protected remedies.

### 29.2 Aggregate liability

Subject to Section 29.3 and any separately agreed enterprise liability provisions, each party's aggregate contractual liability arising from the Services will not exceed the greater of:

- The subscription fees paid or payable for the affected Organization during the twelve months preceding the event giving rise to the claim; or
- USD 100, or its equivalent in the applicable billing currency.

### 29.3 Exceptions

Nothing in these Terms limits or excludes liability for fraud, fraudulent misrepresentation, willful misconduct, or other matters for which exclusion or limitation is prohibited by Applicable Law.

Applicable statutory consumer remedies, legally non-excludable data protection obligations, and liabilities arising from intentional misconduct remain unaffected.

### 29.4 Reasonableness

Any limitation is subject to applicable fairness, enforceability, consumer protection, and mandatory legal requirements.

## 30. Indemnification

### 30.1 Customer indemnification

To the extent permitted by Applicable Law, an Organization agrees to defend and indemnify Tellann against third-party claims directly arising from:

- The Organization's intentional unlawful use of the Services.
- Its infringement of third-party intellectual property rights through materials it supplies.
- Its unauthorized monitoring or unlawful collection of third-party data.
- Its deliberate violation of third-party system access rights.

This obligation applies only to the extent the claim is attributable to the Organization's conduct and not to Tellann's breach, negligence, or unlawful acts.

### 30.2 Claim management

The indemnified party must provide reasonably prompt notice, reasonable cooperation, and an appropriate opportunity for the indemnifying party to manage the defense.

No settlement may impose a non-monetary obligation or admission of wrongdoing on the indemnified party without its consent.

### 30.3 Mandatory protections

Indemnification does not remove statutory rights or obligations that cannot legally be excluded or transferred.

## 31. Governing Law and Dispute Resolution

### 31.1 Governing law

These Terms are governed by the laws of [Confirmed Governing Jurisdiction], excluding conflict-of-laws principles to the extent legally permissible.

Where Tellann's contracting entity is incorporated and operates in Nigeria, the intended default governing law is Nigerian law.

### 31.2 Informal dispute resolution

Before commencing formal proceedings, either party may notify the other of a dispute and attempt to resolve it through good-faith discussions.

The parties should ordinarily allow thirty days for informal resolution, unless urgent relief is required.

### 31.3 Court jurisdiction

Subject to mandatory legal protections and any separately agreed dispute-resolution procedure, proceedings may be brought before courts of competent jurisdiction in [Confirmed Jurisdiction].

### 31.4 Statutory rights

Nothing in this section prevents a consumer or data subject from exercising non-waivable rights, contacting an applicable regulator, or bringing proceedings in a forum that Applicable Law requires to remain available.

## 32. Changes to These Terms

### 32.1 Amendments

Tellann may update these Terms to reflect changes in the Services, legal requirements, security practices, or commercial operations.

### 32.2 Material changes

We will provide reasonable advance notice of material changes, ordinarily at least thirty days before they become effective, unless an earlier change is reasonably required by law or an urgent security concern.

### 32.3 Notification methods

Notices may be delivered through the Services, email, or another appropriate communication channel associated with the Account.

### 32.4 Acceptance of revised terms

Where legally required or where material contractual changes call for renewed agreement, Tellann will obtain the appropriate acceptance.

If you do not agree with materially revised terms, you may discontinue the affected Services or cancel renewal, subject to applicable contractual and statutory rights.

### 32.5 Previous versions

Tellann may maintain previous versions and revision histories of the Terms for reference and auditability.

## 33. General Legal Provisions

### 33.1 Entire agreement

These Terms, together with any applicable accepted order form, DPA, product-specific conditions, and other incorporated agreements, constitute the agreement regarding the relevant Services.

### 33.2 Order of precedence

Where agreements conflict, the applicable executed enterprise agreement or order form controls its expressly negotiated subject matter.

An applicable DPA governs conflicting provisions concerning personal-data processing.

Mandatory international data-transfer clauses and Applicable Law prevail where required.

### 33.3 Severability

If a provision is found unenforceable, the remaining provisions remain effective to the extent legally possible.

### 33.4 No waiver

Failure to enforce a provision on one occasion does not waive the right to enforce it later.

### 33.5 Assignment

Neither party may assign the agreement in a way that materially prejudices the other party's rights without required authorization, except for a lawful corporate restructuring or business transfer subject to appropriate continuity and notice safeguards.

### 33.6 Independent parties

The parties are independent contractors. These Terms do not create an employment, agency, partnership, or joint venture relationship.

### 33.7 Force majeure

Neither party is responsible for failure or delay caused by circumstances beyond its reasonable control, excluding payment obligations already due and subject to Applicable Law.

The affected party must take reasonable steps to mitigate the impact.

### 33.8 Electronic agreements

These Terms may be accepted electronically using an authorized online acceptance mechanism.

### 33.9 Survival

Provisions concerning confidentiality, intellectual property, accrued obligations, permitted retention, disputes, and other matters intended to survive will remain effective after termination to the extent necessary.

## 34. Contact Information

For questions about these Terms, your subscription, or your contractual rights, contact:

**Tellann**\
Legal Entity: [Full Registered Legal Name]\
Registration Number: [Company Registration Number]\
Registered Address: [Registered Business Address]\
General Contact: [Verified Contact Email]\
Legal Contact: [Verified Legal Email]\
Privacy Contact: [Verified Privacy Email]\
Website: [https://tellann.co](https://tellann.co)

For product support, please use the official support channel identified within the Tellann platform or website.

---

**End of Terms of Service — Version 1.0**

# 6. Supporting content below the Terms

The legal document should be followed by three restrained sections.

### Related legal documents

Heading: Related policies and agreements

Supporting copy:

> Our Terms of Service work alongside other policies that explain how we protect information, process customer data, and maintain responsible use of the platform.

| Document                  | Suggested route        | Purpose                                                            |
| ------------------------- | ---------------------- | ------------------------------------------------------------------ |
| Privacy Policy            | `/privacy`             | How Tellann collects, processes, and protects personal information |
| Cookie Policy             | `/cookies`             | Website cookies, analytics, preferences, and consent               |
| Acceptable Use Policy     | `/acceptable-use`      | Detailed acceptable and prohibited usage                           |
| Data Processing Agreement | `/legal/dpa`           | Customer-controller and Tellann-processor responsibilities         |
| Security Overview         | `/security`            | Security practices, architecture, and responsibilities             |
| Subprocessor List         | `/legal/subprocessors` | Third parties processing data on Tellann's behalf                  |

These routes are recommendations. Do not link to unpublished documents as though they already exist.

### Legal contact section

Heading: Questions about these terms?

Text:

> If you have questions about your rights, an agreement, or how these terms apply to your organization, our team can help direct your enquiry.

CTA: Contact Tellann → `/contact?reason=legal`

### Version history

A simple disclosure showing document version, effective date, and a concise summary of substantive changes.

Version 1.0 would be labeled Initial publication once approved.

# 7. Functional implementation requirements

The page does not require many interactive features, but what it does offer should work reliably.

| Functionality            | Expected behavior                                                |
| ------------------------ | ---------------------------------------------------------------- |
| Sticky table of contents | Automatically identifies the section currently being read        |
| Anchor navigation        | Navigates directly to headings using stable IDs                  |
| Copy section link        | Copies the URL and heading anchor                                |
| Print document           | Uses the browser's native print functionality                    |
| Mobile navigation        | Collapsible table of contents                                    |
| Effective date           | Displays the current published legal version                     |
| Accessibility            | Keyboard navigation, semantic headings, visible focus indicators |
| Version history          | Shows prior approved versions                                    |
| Legal document links     | Navigate to the appropriate published policies                   |

The page should be server-rendered, with the actual legal text available without JavaScript. Do not load the document exclusively through a client-side fetch.

For implementation, maintain versioned legal records rather than editing a single mutable document without history.

```
interface LegalDocument {
  slug: "terms";
  title: string;
  version: string;

  effectiveAt: string;
  lastUpdatedAt: string;

  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";

  sections: LegalSection[];

  approvedBy?: string;
  publishedAt?: string;
}

interface LegalSection {
  id: string;
  number: string;
  heading: string;
  content: string;
}
```

## 8. Agreement acceptance and enforcement

This is particularly important: publishing `/terms` does not, by itself, establish demonstrable acceptance of the agreement.

Tellann should collect affirmative acceptance during registration.

Illustrative registration agreement

I agree to Tellann's Terms of Service and acknowledge the Privacy Policy.

Create accountThis is a demonstration of the checkbox and disabled-state behavior, not a live registration control.

At minimum, Tellann should preserve the agreement version, accepting user, associated organization where relevant, UTC timestamp, acceptance mechanism, and sufficient audit metadata to prove acceptance.

For paid subscriptions, the checkout must additionally show the price, currency, renewal frequency, trial end date, expected first charge, and cancellation method.

Do not bundle consent to optional marketing messages, cookies, or other unrelated data processing into mandatory Terms acceptance.

# 9. Legal and specification accuracy review

I checked the proposed clauses against Tellann's technical specifications and the applicable Nigerian legal framework. There are several matters I would resolve before treating this document as ready for production.

## 9.1 Publication blockers

| Priority | Issue                     | Required decision                                                            |
| -------- | ------------------------- | ---------------------------------------------------------------------------- |
| Critical | Legal entity              | Identify the registered company or individual legally supplying Tellann      |
| Critical | Data retention conflict   | Reconcile category-specific retention periods with plan-based retention      |
| Critical | Privacy feature status    | Verify which masking and configurable privacy safeguards actually work       |
| Critical | Data Processing Agreement | Prepare an appropriate DPA and establish subprocessor disclosures            |
| High     | Cancellation and refunds  | Formally approve the cancellation and refund policy                          |
| High     | Liability and indemnity   | Obtain legal review of Sections 29 and 30                                    |
| High     | AI provider processing    | Confirm model-provider retention, training, and confidentiality arrangements |
| High     | International taxation    | Validate tax treatment for every country Tellann accepts payments from       |
| High     | Jurisdiction              | Select governing law and courts based on the contracting entity              |
| High     | Aggregation exclusions    | Confirm the customer opt-out process is operational                          |

### A. Data retention contradiction

Tellann's Entitlement Specification establishes customer-facing retention windows of:

| Plan       | Retention |
| ---------- | --------- |
| Free       | 14 days   |
| Local      | 30 days   |
| Solo       | 90 days   |
| Team       | 180 days  |
| Business   | 365 days  |
| Enterprise | Custom    |

However, the Privacy & Data Collection Specification also describes data-category retention defaults that can exceed these limits, including longer periods for events, analytics, and reports.

These rules cannot simply be treated as equivalent. Before publication, establish which data the plan window governs, which data may have separate legal or operational retention periods, and when deletion actually happens.&#x20;

entitlement_spec.txt

pdcs.txt



### B. Privacy controls are not uniformly complete

Your privacy specification explicitly marks configurable privacy rules and certain field-level masking mechanisms as pre-launch.

The existing sensitive-field exclusion and protected-value handling must not be represented as a complete, independently audited privacy solution.

The legal text is deliberately cautious, but `/privacy` must give users an exact account of deployed protections.&#x20;

pdcs.txt



### C. Billing and refunds

Your Billing Specification defines the 14-day trial, automatic conversion, seven-day payment grace period, immediate prorated upgrades, and next-renewal downgrades.

It does not fully establish the ordinary cancellation-effective-date policy or detailed refund criteria.

Sections 21, 29, 30, and 32 of my draft contain proposed commercial or contractual policies, including cancellation treatment, the liability cap, indemnification, and a 30-day notice standard. They should not be described as previously approved company policy.&#x20;

billing.txt



Nigeria's Federal Competition and Consumer Protection framework includes requirements concerning fair contract terms and conspicuous notice of certain limitations of liability and indemnities. This makes lawyer review of those clauses particularly important.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://fccpc.gov.ng\&sz=32)

FCCPC

+1



### D. Nigerian and international data protection

For Nigerian customers, the relevant framework includes the Nigeria Data Protection Act 2023 and the General Application and Implementation Directive, which came into force on September 19, 2025.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://ndpc.gov.ng\&sz=32)

Nigeria Data Protection Commission

+1



For customers subject to EU GDPR requirements, an ordinary Terms page is not necessarily enough. Processing arrangements may require an Article 28 agreement and appropriate international transfer safeguards.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://commission.europa.eu\&sz=32)

European Commission

+1



The separation between `/terms`, `/privacy`, and a DPA is therefore substantive, not merely a website-design choice.

### E. International billing and tax

Your specification treats published prices as tax-inclusive and recognizes Nigerian VAT at 7.5%, a rate reflected in the Nigeria Tax Act 2025, which took effect on January 1, 2026.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://finance.gov.ng\&sz=32)

Federal Ministry of Finance

+1



However, the billing specification's treatment of countries outside its registered tax list as having no tax is not a sufficient international tax-compliance policy.

Before selling globally, verify place-of-supply, customer classification, registration, collection, and invoice requirements in supported markets.

# 10. Final implementation recommendation

I would implement `/terms` as a versioned legal page, but treat it as one component of a wider contractual system.

Public Terms of Service

Displayed publicly and linked from registration

Recorded agreement acceptance

Associated with a specific terms version

Separate subscription authorization

Price, trial, renewal and payment disclosures

Purpose-specific permissions

Separate consent for sensitive actions such as source uploads, approved instrumentation, and future autonomous remediation.

The central principle is to distinguish accepting a service contract from granting permission for a specific technical action. Agreeing to Tellann's Terms should never silently grant authority to upload an entire proprietary repository or modify a production application.

That distinction is fundamental to Tellann's local-first architecture and its long-term credibility with engineering teams and enterprise customers.

Once the identified decisions are resolved and counsel approves the text, this draft provides a substantial foundation for `/terms` without misrepresenting the platform's present capabilities or future ambitions.