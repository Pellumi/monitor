# Tellann — `/cookies` Complete Page Specification & Cookies Policy

Legal Page · Cookie Consent · Browser Storage · Tracking Transparency

The `/cookies` page should serve as Tellann's official Cookies and Similar Technologies Policy, explaining how Tellann uses cookies, browser storage, session identifiers, analytics technologies, and other device-based mechanisms across its public website and software platform.

For Tellann, this policy needs to address three distinct environments:

- The marketing website — visitors browsing Tellann's pages, documentation, pricing, and company information.
- The authenticated platform — developers and organizations accessing the dashboard, authentication, billing, preferences, and administrative functionality.
- Customer application environments — applications instrumented using Tellann SDKs and demonstration sessions operated through the Desktop Agent.

The important distinction is that not every piece of behavioral telemetry is a cookie, and not every local storage mechanism belongs to Tellann's marketing website. The policy should explain these differences rather than inaccurately describe all tracking as cookies.

Your specifications define how authentication, behavioral collection, desktop sessions, and privacy filtering should operate. They do not contain an authoritative inventory of deployed cookie names, storage keys, third-party trackers, or their exact expiry periods. Those must be verified from the running applications before publication.

# 1. Page identity and SEO

| Property            | Implementation                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Route               | `/cookies`                                                                                                                        |
| Page title          | Cookie Policy — Tellann                                                                                                           |
| H1                  | Cookie Policy                                                                                                                     |
| Canonical URL       | `https://tellann.co/cookies`                                                                                                      |
| Meta description    | Learn how Tellann uses cookies, browser storage, analytics, and similar technologies, and how to manage your privacy preferences. |
| Authentication      | Public                                                                                                                            |
| Indexing            | `index, follow`                                                                                                                   |
| Page classification | Legal and privacy                                                                                                                 |
| Rendering           | Server-rendered                                                                                                                   |
| Last updated        | Actual legal publication date                                                                                                     |

The page should be accessible without signing in, rejecting cookies should not prevent a visitor from reading it, and optional tracking must not be a requirement for viewing legal documents.

# 2. Recommended page structure

```
/cookies
│
├── 01 Marketing Navbar
├── 02 Breadcrumb Navigation
├── 03 Cookie Policy Hero
│   ├── H1
│   ├── Introduction
│   ├── Effective Date
│   └── Last Updated
│
├── 04 Quick Cookie Overview
├── 05 Manage Cookie Preferences
├── 06 Cookie Categories
├── 07 Complete Cookie Policy
│   └── Sticky Table of Contents
├── 08 Current Cookie and Storage Inventory
├── 09 Browser & Device Controls
├── 10 Related Legal Documents
├── 11 Privacy Contact
├── 12 Policy Version History
└── 13 Marketing Footer
```

Use the same monochrome theme, Satoshi typography, legal-document component, and content hierarchy as `/terms` and `/privacy`.

The desktop page should have a 240–260px sticky navigation column and a 760–820px document column, with the table of contents collapsing on mobile.

## 3. Hero content

TELLANN / LEGAL

# Cookie Policy

Effective date: [Publication date]

We use cookies and similar technologies to operate our services, protect accounts, remember preferences, and, where permitted, understand how our website is used.

You can learn about these technologies and control optional tracking through your cookie preferences.

Manage preferences

View cookie details

Essential technologies

Help deliver security, authentication and requested functionality.

Optional technologies

Subject to consent or another applicable legal exception.

Visual layout concept. Functional controls should be connected to the actual consent-management system, not implemented as decorative buttons.

# 4. Cookie categories Tellann should distinguish

| Category                     | Example purpose                                               | Recommended default                         |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| Strictly necessary           | Authentication, security, session continuity, consent records | Enabled when genuinely necessary            |
| Functional preferences       | Theme, language, display settings                             | Depends on purpose and applicable exception |
| Analytics                    | Website performance, visitor statistics, navigation patterns  | Off unless consented or validly exempt      |
| Performance and diagnostics  | Error diagnostics, client performance measurement             | Classify by actual mechanism and purpose    |
| Marketing and advertising    | Advertising pixels, campaign attribution, remarketing         | Off until required consent                  |
| Third-party embedded content | Video players, external widgets, interactive embeds           | Block non-essential access until authorized |

This is a recommended classification model, not a claim that Tellann currently deploys all six categories.

A further legal nuance matters here. The UK's final April 2026 guidance recognizes narrow exemptions for certain statistical and appearance-related technologies, provided their conditions—including clear information and a simple way to object—are met. That does not make all analytics cookies automatically exempt.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://ico.org.uk\&sz=32)

ICO

+1



For Tellann, I recommend the simplest conservative global approach: disable optional analytics and marketing technologies until the visitor makes an appropriate choice, unless a specific exempt implementation has been reviewed and documented.

# 5. Complete Cookies Policy — Publication Draft

The following document is intended to be the primary legal text rendered on `/cookies`.

Square-bracketed placeholders identify company details or deployment facts that must be verified. In particular, the cookie inventory referenced below must be generated from the actual production environment.

# Cookie Policy

**Effective Date:** [Approved publication date]\
**Last Updated:** [Last substantive revision date]\
**Document Version:** 1.0\
**Service Provider:** [Full registered legal entity]\
**Website:** [https://tellann.co](https://tellann.co)

## Introduction

At Tellann, we believe that understanding how digital services operate should not require unnecessary or undisclosed tracking.

This Cookie Policy explains how Tellann ("Tellann," "we," "us," or "our") uses cookies, browser storage, and similar technologies in connection with our websites, applications, and related services.

It describes the purposes of these technologies, the information they may process, the choices available to you, and how our practices relate to our broader Privacy Policy.

Some technologies are necessary to provide the services you request, maintain security, and keep your account functioning. Others may support preferences, performance measurement, analytics, or marketing where enabled and legally permitted.

We seek to provide clear information and meaningful choices concerning technologies that are not strictly necessary.

Please read this Policy together with our Privacy Policy and Terms of Service.

## 1. What Are Cookies?

Cookies are small pieces of information that a website can ask your browser to store on your device.

They may be sent back to the relevant website during subsequent requests, allowing the website to recognize a session, retain certain settings, or perform other functions.

Cookies may be used to:

- Maintain authenticated sessions.
- Provide security and protect against abuse.
- Remember appropriate user preferences.
- Support application functionality.
- Measure website performance.
- Understand permitted website usage.
- Support advertising or campaign measurement where enabled and authorized.

Cookies are not inherently harmful, but their privacy implications depend on the information collected, how that information is combined, who receives it, and the purposes for which it is used.

## 2. What Are Similar Technologies?

In addition to traditional HTTP cookies, websites and applications may use other mechanisms to store information on a device or retrieve information from it.

These can include:

**Local storage:** Browser storage that can retain information beyond a single page load.

**Session storage:** Browser storage generally associated with a particular browsing session or tab.

**IndexedDB:** Structured browser-side storage that applications can use to retain larger datasets.

**Cache Storage:** Browser storage that may be used by service workers to retain website or application resources.

**Web beacons and tracking pixels:** Resources that may communicate information when a page or message is opened.

**Device identifiers and fingerprinting:** Methods that may use device, browser, or environmental characteristics to recognize or distinguish devices.

**Software development kit storage:** Storage used by embedded application libraries to maintain local state, queues, or session context.

**Push subscription records:** Browser-managed subscription information used to deliver notifications after the necessary permission is granted.

**Other device-access mechanisms:** Technologies that read information stored on a device for a defined purpose.

Not every technology listed above is necessarily deployed by Tellann.

This Policy describes the categories relevant to our platform and requires the accompanying technology inventory to identify the mechanisms actually in use.

## 3. Where This Policy Applies

This Policy applies to storage and access technologies used directly by Tellann or by authorized service providers through Tellann-controlled services.

These may include:

### 3.1 Public marketing website

Pages explaining Tellann's products, pricing, company, documentation, resources, and legal policies.

### 3.2 Authenticated dashboard

The browser-based application used to manage organizations, applications, workflows, reports, billing, and other supported capabilities.

### 3.3 Authentication interfaces

Pages or flows used for login, verification, account recovery, multi-factor authentication, or federated identity.

### 3.4 Billing and checkout

Subscription and payment interfaces, including integrations with authorized payment processors.

### 3.5 Documentation and related web applications

Technical documentation, SDK instructions, developer resources, and other Tellann-controlled web experiences.

### 3.6 Customer applications using Tellann integrations

Applications operated by customers that use Tellann's SDKs may have their own browser storage and telemetry collection arrangements.

The customer's application operator generally determines the purposes and legal basis for processing data from that application's users.

### 3.7 Managed demonstration environments

Tellann's Desktop Agent may operate a managed browser to demonstrate customer application workflows.

Cookies belonging to the demonstrated application are distinct from cookies belonging to Tellann's own websites.

## 4. Types of Cookies and Technologies

We classify relevant technologies according to their actual purposes.

### 4.1 Strictly necessary technologies

Strictly necessary technologies enable functions that are essential to delivering a requested service or maintaining necessary security.

Depending on the deployed architecture, they may support:

- Authentication and session continuity.
- Secure access to organizational resources.
- Login and account security.
- Protection against request forgery.
- Security and abuse prevention.
- Load balancing and service continuity.
- Remembering cookie consent decisions.
- Other functions strictly necessary to deliver a service requested by the user.

Where a technology qualifies for a lawful exemption from consent, it may operate without optional tracking consent.

Such classification depends on the actual purpose and applicable law, not simply on how we label the technology.

### 4.2 Functional and preference technologies

Functional technologies may remember settings such as:

- Appearance and theme preferences.
- Language selections.
- Interface display choices.
- Certain accessibility preferences.
- Other user-selected settings.

Where such storage is necessary to deliver a specific preference requested by the user, an applicable legal exception may permit its use.

Where the storage extends beyond that purpose or is not exempt, we obtain the necessary consent.

### 4.3 Analytics technologies

Where deployed, analytics technologies may help us understand:

- Which pages receive visits.
- How visitors navigate our website.
- Website loading and performance.
- How visitors find our content.
- Aggregate interactions with public pages.
- Technical issues affecting user experience.
- Whether website content is useful.

Depending on the tool and configuration, analytics may involve browser identifiers, storage, request metadata, or third-party processing.

Analytics technologies are enabled only where an applicable consent or exemption permits their use.

### 4.4 Performance and diagnostic technologies

Performance and diagnostic mechanisms may help identify:

- Failed requests.
- Client-side errors.
- Slow page rendering.
- Browser compatibility problems.
- Unavailable services.
- Other technical failures.

Some diagnostic activity may be necessary for service security or operation.

Other diagnostic or user-measurement technologies may require consent or another applicable legal exception.

We assess these mechanisms according to their actual purposes and the information they access.

### 4.5 Marketing and advertising technologies

If Tellann enables marketing or advertising technologies, they may support:

- Campaign performance measurement.
- Advertising attribution.
- Conversion tracking.
- Audience measurement.
- Remarketing.
- Advertising personalization.
- Tracking across websites or services.

These technologies are not automatically necessary for operating Tellann.

Where required, they will remain inactive until valid consent is obtained.

We do not treat acceptance of our Terms of Service, ordinary website navigation, or the creation of an account as blanket consent to advertising tracking.

### 4.6 Third-party embedded content

Some pages may include content supplied by external platforms, such as:

- Videos.
- Embedded documentation.
- Interactive demonstrations.
- Social media content.
- External support or communication widgets.

Such providers may use their own cookies or similar technologies.

Where an embedded feature requires non-essential device access, it will be subject to the applicable consent requirements.

We may instead display a placeholder or require a user action before loading the external content.

## 5. First-Party and Third-Party Cookies

### 5.1 First-party cookies

First-party cookies are associated with the website or domain the user is visiting.

Tellann-controlled applications may use first-party storage for authorized service functions.

First-party status alone does not make a cookie exempt from consent requirements.

### 5.2 Third-party cookies

Third-party cookies are associated with a domain or provider different from the website being visited.

They may be introduced through embedded services, external authentication, payment interfaces, analytics, or advertising technologies.

Whether a third party can store or access information depends on the provider, browser behavior, technical integration, and applicable permissions.

### 5.3 Third-party accountability

Where Tellann intentionally enables an external technology through its services, we assess its purposes, information-sharing arrangements, and relevant legal requirements.

The actual providers used must be identified in the published cookie inventory or linked processing disclosures.

## 6. Session Cookies and Persistent Cookies

### 6.1 Session cookies

Session cookies are generally temporary and are designed to support activity during a browsing session.

Their practical lifetime depends on browser behavior and the configuration of the relevant service.

### 6.2 Persistent cookies

Persistent cookies remain available beyond a single browsing session until their configured expiration or deletion.

They may support appropriate preference retention, permitted analytics, or other disclosed purposes.

### 6.3 Duration

Each deployed cookie must have a defined purpose and an appropriate lifespan.

Expiration periods must not be longer than necessary for the relevant purpose and applicable legal requirements.

The exact duration of each cookie or persistent storage item is documented in Tellann's current technology inventory.

## 7. Authentication and Account Security

Tellann uses authentication and authorization mechanisms to protect user accounts and organizations.

Depending on the deployed authentication architecture, browser-based session management may involve:

- Cookies.
- Bearer access tokens.
- Refresh-session mechanisms.
- Temporary verification state.
- Other secure session mechanisms.

We do not assume that a particular authentication value is stored in a cookie unless the deployed system actually uses that arrangement.

Authentication-related storage is intended to support functions such as:

- Signing in.
- Maintaining an authorized session.
- Confirming session validity.
- Protecting accounts against unauthorized use.
- Supporting logout and session revocation.
- Maintaining appropriate authentication continuity.

Authentication technologies must be configured with safeguards appropriate to the risks of their use.

Disabling technologies essential for authentication may prevent successful login or other protected functionality.

## 8. Organizational Workspaces and Dashboard Preferences

Tellann supports organization-based access to application intelligence and administrative functionality.

Depending on the implemented features, browser storage may help preserve:

- Appropriate interface preferences.
- Selected appearance settings.
- Temporary navigation state.
- Other user-requested interface behavior.

Organization membership, billing entitlements, and authoritative access permissions are enforced by the platform and must not depend solely on browser-stored values.

Browser preferences must not grant unauthorized access or override server-side permission decisions.

## 9. Website Analytics and Product Measurement

Tellann may evaluate the use and performance of its own websites and services for legitimate operational or business purposes.

Website analytics and product telemetry are distinct activities.

For example:

- Measuring visits to the Tellann pricing page concerns the Tellann website.
- Recording a customer's demonstrated checkout workflow concerns the customer's application.
- Measuring a completed QA report-generation task concerns Tellann platform operation.

These activities may involve different information, technical mechanisms, responsible organizations, and legal bases.

The fact that Tellann offers behavioral analysis tools does not mean that all visitors to the Tellann marketing website are automatically subjected to customer-style session replay.

Optional browser-based analytics and tracking remain subject to the applicable consent or exemption requirements.

## 10. Tellann SDKs and Customer Application Cookies

Tellann provides SDKs designed to collect supported application behavior and technical events.

These integrations may record information such as:

- Navigation events.
- Application state transitions.
- UI interaction events.
- Workflow boundaries.
- Session identifiers.
- API timing and response metadata.
- Error events.

### 10.1 Distinction between events and cookies

Behavioral events are not inherently cookies.

An event can be transmitted without using an HTTP cookie, while an SDK may separately use browser storage to maintain session context or buffer events.

The exact storage behavior depends on the SDK version and configuration.

### 10.2 Customer control

The organization operating the instrumented application generally determines why the application is being analyzed and what lawful notices or permissions are required.

### 10.3 Storage and identifier disclosures

Where a Tellann SDK stores identifiers or other information in a user's browser, the integration documentation must explain:

- The storage mechanism.
- The data stored.
- Its purpose.
- Its lifespan.
- Whether it is essential or optional.
- The responsible controller.
- Applicable consent requirements.

### 10.4 Consent enforcement

Customers must configure their applications to comply with applicable privacy and device-access requirements.

Where lawful consent is required for an SDK's storage or collection behavior, integration must not cause the relevant optional processing to begin before the necessary authorization.

### 10.5 Customer privacy notices

The customer's own privacy and cookie notices generally govern observation of the customer's application users.

Tellann's public Cookie Policy does not replace those notices.

## 11. Session Replay and Demonstration Sessions

Tellann provides telemetry-based session reconstruction for supported application demonstrations.

### 11.1 Session identification

A demonstration may use technical identifiers to associate events with a particular application, environment, session, or QA run.

### 11.2 Replay behavior

Session Replay reconstructs a timeline from available application events.

It is not necessarily a video or pixel-accurate recording of a user's entire screen.

### 11.3 Restricted values

Tellann's telemetry collection rules exclude protected values such as authentication secrets, payment credentials, and other restricted information.

### 11.4 Application cookies

A managed browser may receive cookies from the application being demonstrated.

Those cookies can be necessary for the customer's application to authenticate users or execute workflows.

Their existence does not mean those cookie values should be included in Tellann's recorded telemetry.

### 11.5 Customer responsibility

The customer remains responsible for determining whether its application requires notices, consent, or other safeguards before user behavior is collected or demonstrated.

## 12. Desktop Agent and Device Storage

The Tellann Desktop Agent is a locally installed application used to support source-code analysis, instrumentation, and managed browser demonstrations.

It is distinct from the Tellann marketing website and browser dashboard.

### 12.1 Device-bound credentials

The Desktop Agent is designed to hold platform device-session credentials and applicable run credentials using operating-system-protected storage.

These credentials are not ordinary website analytics cookies.

### 12.2 Workspace information

Workspace paths, repository information, code-derived analysis, and locally stored configuration are governed by Tellann's desktop security and privacy requirements.

### 12.3 Locally buffered evidence

Supported SDKs and local components may buffer events or evidence to manage temporary connectivity interruptions.

Such buffering is not automatically equivalent to a tracking cookie.

### 12.4 System browser authorization

The Desktop Agent uses the user's system browser for platform authorization.

Cookies or other authentication technologies used during this process are governed by the applicable Tellann authentication service and its disclosed storage practices.

### 12.5 Managed browser context

A customer application's cookies and local storage within a managed demonstration browser belong to that application's execution context and must not be confused with Tellann's marketing analytics.

## 13. Payment Processors and Checkout

Tellann's documented payment integrations include Paystack and Flutterwave, subject to the selected currency and available processor.

When a customer proceeds to checkout, an authorized payment provider may use cookies or other technologies for:

- Payment authentication.
- Fraud prevention.
- Transaction security.
- Maintaining checkout state.
- Payment processing.
- Other purposes disclosed by the payment provider.

The technology used depends on the live integration and the provider's practices.

Payment-provider cookies are not automatically classified as Tellann advertising or analytics cookies.

Where a payment provider sets non-essential technologies through a Tellann-controlled integration, applicable transparency and consent requirements must still be satisfied.

Customers may consult the relevant payment provider's privacy and cookie information for additional details.

## 14. Notifications and Push Services

Tellann may support in-app, web push, email, and desktop notifications.

### 14.1 Web push

Web push requires a supported browser and the necessary notification permission.

Push functionality may involve a browser-managed subscription endpoint, related cryptographic information, and notification preferences.

These are not inherently cookies, although related application storage may be used.

### 14.2 Desktop notifications

Desktop notifications are handled through the installed application and operating-system notification facilities, subject to supported configuration.

### 14.3 Email tracking

If Tellann uses email-open pixels, tracked links, or comparable technologies, those mechanisms must be assessed and disclosed according to their purpose and applicable law.

Transactional email delivery does not, by itself, authorize unrelated marketing tracking.

### 14.4 Preferences

Users may manage optional communication preferences through supported settings.

Browser or operating-system notification permissions can also be changed through the relevant device controls.

## 15. Information Processed Through Cookies and Similar Technologies

Depending on the purpose and deployed technology, information accessed or collected may include:

- Random session or preference identifiers.
- Consent choices.
- Browser and device characteristics.
- Relevant authentication state.
- Page or route information.
- Website interaction events.
- Referral and campaign parameters.
- Timing and performance measurements.
- Relevant security indicators.
- Approximate network-derived location, where used.
- Other data specifically disclosed in the current technology inventory.

Some information may constitute personal data when it identifies or can reasonably be linked to an individual.

We assess such processing under applicable data protection law and our Privacy Policy.

## 16. Our Legal Approach to Cookies

Tellann operates with users and customers in potentially different jurisdictions.

Applicable cookie and device-access requirements depend on the circumstances, including the website operator, users' locations, purposes, and technology.

### 16.1 Necessary technologies

Technologies genuinely necessary for requested services or qualifying security functions may operate without separate cookie consent where an applicable legal exception permits this.

### 16.2 Optional technologies

Where consent is required, optional storage and access will not begin until valid consent is obtained.

### 16.3 Specific purposes

A user's consent to analytics does not automatically authorize advertising personalization or unrelated third-party tracking.

### 16.4 Valid consent

Where consent is required, it must be freely given, appropriately informed, specific to the relevant purposes, and expressed through a valid affirmative action.

### 16.5 Consent withdrawal

Users must be able to withdraw consent through accessible controls.

Withdrawal stops future processing dependent on that consent, subject to the technical and legal scope of the request.

### 16.6 Legal exceptions

Certain jurisdictions provide limited exceptions for particular statistical or user-interface preference technologies.

Tellann will rely on an exception only where the particular implementation satisfies its conditions, including applicable information and objection requirements.

## 17. Managing Your Cookie Preferences

Where Tellann uses optional cookies or similar technologies, visitors can manage the applicable purposes through our cookie preference controls.

Available choices should include:

- Accepting eligible optional technologies.
- Rejecting technologies that require consent.
- Reviewing individual purpose categories.
- Saving customized preferences.
- Revisiting and changing previous choices.
- Withdrawing consent for applicable purposes.

Strictly necessary technologies may remain enabled where they qualify for an applicable legal exception.

Where we rely on a lawful exception that requires an objection mechanism, the relevant objection control will also be provided.

The preference interface must accurately reflect the current deployed technologies and their purposes.

## 18. Withdrawing Consent

You may withdraw consent for applicable optional technologies through Tellann's cookie preference controls.

Withdrawal should be effective for future optional storage and access without unnecessary obstacles.

Following withdrawal, Tellann should:

1. Stop the affected optional technologies from executing.
2. Prevent further optional tracking events dependent on the withdrawn permission.
3. Remove accessible non-essential identifiers where technically appropriate.
4. Update the recorded preference.
5. Apply the new preference to relevant Tellann-controlled services where supported.

Withdrawing consent does not automatically delete every historical record already lawfully processed.

Requests concerning previously collected personal data are handled under the Privacy Policy and applicable data protection rights.

## 19. Browser and Device Controls

Most browsers provide settings for viewing, deleting, or restricting cookies and other stored site data.

Depending on the browser, you may be able to:

- Delete cookies.
- Clear local or session storage.
- Remove website data.
- Restrict third-party cookies.
- Block selected storage mechanisms.
- Manage notification permissions.
- Control website permissions and privacy protections.

These settings operate independently of Tellann's own preference management.

Deleting necessary session information may sign you out or interrupt certain features.

Blocking essential functionality may prevent authentication, payment, or other requested services from operating correctly.

Browser settings should not be treated as a substitute for collecting consent where Tellann has a separate obligation to obtain it.

## 20. Retention and Expiration

Cookies and similar technologies may have different storage lifetimes.

These depend on:

- The specific technology.
- Its purpose.
- Whether it is session-based or persistent.
- Browser behavior.
- Security and operational needs.
- User preferences.
- Applicable legal requirements.

The active cookie inventory identifies the duration of each deployed item.

Where consent is recorded, the consent record may be retained for an appropriate accountability period separate from the expiration of the browser-stored preference.

Deleting a cookie does not necessarily delete corresponding server-side records.

Data retained by Tellann's account, billing, security, or behavioral-analysis systems follows the applicable Privacy Policy, retention schedule, and contractual requirements.

## 21. Third-Party Technologies and Providers

Where Tellann uses third-party storage or tracking technologies, the relevant providers will be identified in the technology inventory.

The inventory will specify:

- Provider or responsible party.
- Technology or cookie name.
- Domain or storage scope.
- Purpose.
- Data categories processed.
- Retention or expiration.
- Applicable consent category.
- Relevant provider privacy information.

The inclusion of a provider in Tellann's payment, hosting, or software architecture does not by itself establish that the provider sets browser cookies.

Only verified, deployed technologies are listed as active.

## 22. Data Transfers and Disclosure

Cookie-related information may be processed by Tellann or approved service providers as necessary for the specified purpose.

Where such processing involves personal data, applicable privacy, security, confidentiality, and international transfer requirements apply.

We do not authorize unrelated reuse of customer information merely because a service provider is involved in delivering functionality.

Additional information about processing responsibilities and third-party recipients is available in the Privacy Policy and applicable subprocessor disclosures.

## 23. Children's Privacy

Tellann's primary Services are intended for software development professionals and organizations.

We do not design optional advertising or tracking technologies for profiling children.

Where a customer uses Tellann in connection with an application accessed by children, that customer must assess and meet applicable child privacy, notice, consent, and monitoring requirements.

Tellann's technical processing responsibilities remain governed by the applicable agreements and legal obligations.

## 24. Do Not Track and Global Privacy Signals

Browsers or privacy tools may transmit preference signals indicating a desire to restrict tracking.

Tellann will evaluate and honor signals to the extent required by applicable law and supported by its implemented consent-management systems.

Where legally recognized signals are supported, their behavior should be documented in the relevant privacy controls.

Tellann will not claim universal support for a particular browser privacy signal unless its handling has been implemented and verified.

## 25. Changes to Our Cookie Practices

We may update the technologies used to operate or improve the Services.

When a material new non-essential purpose, provider, or tracking mechanism is introduced, we will update the relevant disclosures and obtain fresh consent where required.

We may also update this Policy to reflect:

- New technical functionality.
- Changes to authentication or security mechanisms.
- New integrations.
- Changes to applicable privacy requirements.
- Changes in service providers.
- Updated consent-management controls.

Material changes will be communicated where required.

## 26. Relationship With Other Tellann Policies

This Cookie Policy should be read together with:

**Terms of Service:** [https://tellann.co/terms](https://tellann.co/terms)

**Privacy Policy:** [https://tellann.co/privacy](https://tellann.co/privacy)

**Subprocessor Information:** [Publish verified URL]

**Data Processing Agreement:** [Publish verified URL]

The Privacy Policy provides broader details concerning our processing of personal data, including lawful bases, retention, individual rights, and security measures.

The Terms of Service establish the contractual conditions governing access to Tellann.

This Cookie Policy addresses the specific storage and access technologies described here.

## 27. Contact Information

If you have questions about this Cookie Policy or how Tellann uses browser storage and similar technologies, contact:

**Tellann**

Legal Entity: [Full registered legal name]\
Registered Address: [Verified registered address]\
Privacy Email: [Verified privacy contact]\
Website: [https://tellann.co](https://tellann.co)

You may also contact the appropriate data protection authority where applicable.

For Nigeria, the relevant data protection regulator is the Nigeria Data Protection Commission.

**Regulator Website:** [https://ndpc.gov.ng](https://ndpc.gov.ng)

---

**End of Cookie Policy — Version 1.0**

# 6. Cookie consent banner — Recommended implementation

The Cookie Policy must be connected to a functioning consent-management system across Tellann's public website and relevant authenticated interfaces.

I recommend a compact, monochrome bottom banner rather than a fullscreen modal. The visitor should have three equally accessible choices: accepting optional technologies, rejecting them, or customizing preferences.

### Exact banner text

Your privacy, your choice.

We use essential technologies to keep Tellann secure and operational. With your permission, we'd also like to use optional technologies to understand website usage and improve your experience.

You can accept, reject, or customize your choices at any time. Read our Cookie Policy for details.

Reject all

Customize

Accept all

This is an interactive design preview, not a live Tellann consent system. The actual implementation must save and enforce decisions across the relevant applications.

This approach aligns with the ICO's April 29, 2026 final guidance: non-exempt technologies require a valid legal basis for their use, and where consent is required, refusal should be as easy as acceptance.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://ico.org.uk\&sz=32)

ICO

+1



## 7. Current cookie inventory

This is the most important accuracy requirement.

A legal document should not display an invented table of cookies and their durations. Tellann's specifications do not identify particular deployed cookie names.

Before launch, create an inventory using this structure:

| Required field      | Example of information to record                  |
| ------------------- | ------------------------------------------------- |
| Technology name     | Actual cookie name or storage key                 |
| Provider            | Tellann or verified third party                   |
| Domain              | Exact hostname and scope                          |
| Storage type        | Cookie, localStorage, IndexedDB, etc.             |
| Purpose             | Authentication, preference, analytics, etc.       |
| Data processed      | Identifier, session state, preference             |
| Category            | Essential, functional, analytics, marketing       |
| Expiration          | Actual configured duration                        |
| Consent requirement | Required, exempt, or subject to consent           |
| Policy URL          | Relevant provider's published privacy information |
| Deployment status   | Active or inactive                                |

### Areas to audit

| Tellann surface   | Items to verify                                                                 |
| ----------------- | ------------------------------------------------------------------------------- |
| Marketing website | Analytics, consent storage, marketing pixels, third-party embeds                |
| Dashboard         | Session handling, preferences, browser storage                                  |
| Authentication    | Cookies versus bearer-token storage, SSO state, temporary authentication values |
| Billing           | Paystack and Flutterwave integrations and third-party checkout storage          |
| Documentation     | Analytics, embedded content, independent cookies                                |
| Frontend SDK      | Session identifier storage and persistent event buffering                       |
| Backend SDK       | Handling and exclusion of request cookie headers                                |
| Managed browser   | Customer-application cookies and browser context isolation                      |
| Desktop Agent     | Local device credentials and persisted application configuration                |
| Web notifications | Service-worker storage, subscription records, and permissions                   |

Do not classify all SDK-generated telemetry as tracking-cookie data. The frontend SDK generates behavioral events and session identifiers, but the precise browser persistence strategy must be confirmed from the implementation.

Likewise, the Backend SDK specification explicitly excludes `Cookie`, `Set-Cookie`, and `Authorization` headers from transmitted telemetry. That is a telemetry protection, not a claim that Tellann's own authentication system never uses cookies.

## 8. Consent management architecture

I would introduce one centralized consent policy with independently enforced adapters for each Tellann-controlled web application.

```
                     Consent Policy Registry
                               │
             ┌─────────────────┼──────────────────┐
             ▼                 ▼                  ▼
         Marketing          Dashboard          Documentation
          Website           Application           Website
             │                 │                  │
             └─────────────────┼──────────────────┘
                               ▼
                     Consent Decision
                               │
                     Purpose Evaluation
                               │
               ┌───────────────┴──────────────┐
               ▼                              ▼
       Exempt / Necessary                 Optional
               │                              │
               ▼                         Authorization?
          May execute                    │          │
                                        Yes         No
                                         │          │
                                         ▼          ▼
                                      Execute     Block
```

Treat this as an enforcement system, not merely a UI component.

Where Tellann's marketing, dashboard, and documentation applications are hosted on separate origins, each origin must enforce the appropriate decision. A shared consent preference must not be assumed to transfer automatically between unrelated domains or browser contexts.

### Consent data model

```
type CookieCategory =
  | "ESSENTIAL"
  | "FUNCTIONAL"
  | "ANALYTICS"
  | "MARKETING";

type StorageTechnology =
  | "COOKIE"
  | "LOCAL_STORAGE"
  | "SESSION_STORAGE"
  | "INDEXED_DB"
  | "CACHE_STORAGE"
  | "PIXEL"
  | "OTHER";

interface CookieRegistryEntry {
  id: string;
  name: string;
  provider: string;
  domain: string;
  type: StorageTechnology;

  category: CookieCategory;
  purpose: string;
  dataCategories: string[];

  duration: string;
  legalBasisOrException: string;
  requiresConsent: boolean;

  providerPolicyUrl?: string;
  enabled: boolean;
}

interface CookieConsentRecord {
  id: string;
  anonymousVisitorId?: string;
  userId?: string;

  policyVersion: string;
  registryVersion: string;

  functional: boolean;
  analytics: boolean;
  marketing: boolean;

  jurisdictionRule: string;
  collectedAt: string;
  updatedAt: string;

  method: "BANNER" | "PREFERENCE_CENTER";
}
```

The visitor identifier itself should be minimized. Consent records should not become a new mechanism for tracking users across websites.

## 9. Expected consent behaviors

| Scenario                         | Required behavior                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| First visit, no preference       | Non-exempt technologies remain disabled                                                               |
| Accept all                       | Enable eligible optional categories                                                                   |
| Reject all                       | Essential technologies remain; optional categories disabled                                           |
| Customize                        | Enable only selected categories                                                                       |
| Page reload                      | Respect existing valid preferences                                                                    |
| Sign in                          | Do not silently turn optional categories on                                                           |
| Sign out                         | Do not erase or override lawful choices without reason                                                |
| Withdraw analytics consent       | Stop future non-exempt analytics collection                                                           |
| Introduce a new tracking purpose | Obtain fresh consent where required                                                                   |
| Clear browser data               | Handle lost consent state safely                                                                      |
| Open `/cookies`                  | Allow viewing regardless of consent                                                                   |
| Use Desktop Agent                | Apply desktop-specific permission rules separately                                                    |
| Start a QA demonstration         | Do not substitute marketing cookie consent for authorization to collect customer application evidence |

Consent and product authorization are different things. Permission to use Tellann's website analytics is not permission to monitor a customer's production users; conversely, rejecting Tellann's marketing analytics does not automatically revoke an organization's separately authorized QA processing.

## 10. Additional technical protections

I recommend enforcing the following rules:

1. No premature tracking: block non-exempt scripts, pixels, and storage access until authorized, including through tag managers and embedded content.
2. Secure authentication: when cookies carry authentication state, review `HttpOnly`, `Secure`, `SameSite`, scope, expiration, CSRF protections, and session revocation.
3. No secrets in analytics: never send passwords, authentication tokens, raw customer source code, or sensitive session values into marketing or website analytics.
4. Versioned consent: retain the legal-policy and technology-registry version applicable to each recorded choice.
5. Accessible withdrawal: provide a persistent Cookie Settings link in the footer and relevant privacy controls.
6. Separation of purposes: do not reuse an essential security identifier for advertising without addressing the additional purpose and its legal requirements.
7. Automated audits: verify cookies, local storage, network requests, pixels, and provider scripts before and after consent decisions.
8. Retention alignment: distinguish browser storage expiration from backend records and the plan-based retention of application telemetry.

## 11. Legal accuracy and applicable law

Tellann should use a global conservative policy for optional tracking, while allowing narrow jurisdiction-specific exceptions only after review.

| Jurisdiction   | Relevant considerations                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Nigeria        | NDPA 2023 and the General Application and Implementation Directive 2025, including cookie notice and consent requirements |
| European Union | ePrivacy framework, applicable national implementations, and GDPR where personal data is processed                        |
| United Kingdom | PECR as amended, the UK GDPR, and ICO guidance published April 29, 2026                                                   |
| Other markets  | Applicable local electronic privacy, consumer, and data-protection requirements                                           |

Nigeria's GAID specifically addresses cookies and similar tracking tools, including clear notices, consent choices, and information on withdrawing consent.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://ndpc.gov.ng\&sz=32)

ndpc.gov.ng



The European Data Protection Board's final October 2024 guidance also explains that device-access rules can extend beyond traditional cookies to technologies such as tracking pixels, URLs, and local processing.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.edpb.europa.eu\&sz=32)

European Data Protection Board



These are important distinctions for Tellann because its software includes browser-based telemetry and managed application demonstrations.

# 12. Publication readiness

Before publishing the policy as a complete and accurate account of Tellann's live practices, I would require these checks:

| Priority | Verification                                                      |
| -------- | ----------------------------------------------------------------- |
| Critical | Complete a production cookie and browser-storage inventory        |
| Critical | Confirm that optional tracking cannot execute before permission   |
| Critical | Test consent acceptance, rejection, withdrawal, and persistence   |
| Critical | Confirm which authentication credentials are browser-stored       |
| Critical | Audit SDK session storage and persistent event queues             |
| High     | Inspect payment-provider integrations and loaded resources        |
| High     | Verify independent marketing, dashboard, and docs origins         |
| High     | Document actual cookie names, domains, providers, and expirations |
| High     | Confirm service-worker and push-notification storage              |
| High     | Connect footer Cookie Settings to a working preference center     |
| High     | Align the policy with `/privacy` and `/terms`                     |
| High     | Obtain final legal review and publish the approved version        |

## Final recommendation

The strongest implementation for Tellann is a single consent-management architecture with separate enforcement for marketing, platform operation, and customer-application instrumentation.

The `/cookies` page should disclose the actual technologies in use, not simply provide a generic legal explanation. Its registry should be maintained alongside the code and verified automatically during deployment.

For the first release, I would prioritize necessary authentication and security storage, a properly functioning optional analytics consent mechanism if analytics is installed, clear privacy controls, and an accurate published cookie inventory. Marketing pixels and sophisticated cross-site attribution can be introduced later if they offer enough business value to justify the additional privacy obligations.

This gives Tellann a policy consistent with its local-first, privacy-by-design product philosophy without making claims its deployed systems have not yet demonstrated.