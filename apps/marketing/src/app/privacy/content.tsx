import { Fragment, type ReactNode } from 'react';

export type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'h3'; id: string; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

export type LegalSection = {
  id: string;
  number: string;
  heading: string;
  blocks: Block[];
};

/**
 * Renders **bold** spans and [bracketed TBD fields] without dangerouslySetInnerHTML.
 * Bracketed fields are flagged visually because the draft is not yet legally
 * finalized — see the draft notice in the page header.
 */
export function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^[\]]+\])/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <span key={index} className="privacy-tbd" title="To be confirmed before publication">
          {part}
        </span>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function SectionBody({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'p') return <p key={index}>{renderInline(block.text)}</p>;
        if (block.type === 'ul') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === 'table') {
          return (
            <table key={index} className="privacy-inline-table">
              <thead>
                <tr>
                  {block.headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{renderInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        return (
          <h3 key={index} id={block.id}>
            {block.text}
          </h3>
        );
      })}
    </>
  );
}

export const introduction: Block[] = [
  {
    type: 'p',
    text: 'At Tellann, we believe that understanding software behavior should not require sacrificing the privacy of the people who build, operate, or use that software.',
  },
  {
    type: 'p',
    text:
      'This Privacy Policy describes how Tellann ("Tellann," "we," "us," or "our") collects, processes, stores, discloses, retains, and protects information in connection with our website, software quality intelligence platform, desktop applications, software development kits, APIs, and related services.',
  },
  {
    type: 'p',
    text: 'It also explains the rights available to individuals whose personal information we process and the responsibilities shared between Tellann and organizations using our Services.',
  },
  { type: 'p', text: 'Our privacy principles are:' },
  {
    type: 'ul',
    items: [
      '**Data minimization:** We seek to process only the information necessary for a defined purpose.',
      '**Local-first source handling:** Customer source code remains on the developer’s machine by default.',
      '**Privacy by design:** Sensitive information should be excluded or protected as early as possible in the collection process.',
      '**Purpose limitation:** Information is processed for defined, legitimate purposes.',
      '**Customer control:** Organizations retain authority over their applications, submitted information, and authorized users.',
      '**Transparency:** Customers should understand what information enters Tellann and how that information is used.',
      '**Accountability:** Sensitive operations and material access decisions should be traceable and subject to appropriate controls.',
    ],
  },
  { type: 'p', text: 'Please read this Privacy Policy carefully.' },
];

export const sections: LegalSection[] = [
  {
    id: 's1',
    number: '1',
    heading: 'Who We Are',
    blocks: [
      { type: 'p', text: 'Tellann is a software quality intelligence platform that helps software teams understand, analyze, and validate application behavior.' },
      { type: 'p', text: 'Our Services include, subject to product availability:' },
      {
        type: 'ul',
        items: [
          'Application and organization management.',
          'Workflow intent declaration.',
          'Developer demonstration sessions.',
          'Frontend and backend behavioral telemetry collection.',
          'Session reconstruction and replay.',
          'Workflow discovery and behavior graphs.',
          'Coverage analysis and missing-state identification.',
          'Reconciliation of intended and observed behavior.',
          'Endpoint intelligence.',
          'Quality assurance reports.',
          'Desktop-based codebase and documentation analysis.',
          'Associated account, billing, notification, and support services.',
        ],
      },
      { type: 'p', text: 'The legal entity responsible for Tellann’s independent data-controller activities is:' },
      { type: 'p', text: '**[Full Legal Entity Name]**' },
      { type: 'p', text: 'Registration Number: [Number]' },
      { type: 'p', text: 'Registered Address: [Address]' },
      { type: 'p', text: 'Privacy Contact: [Privacy email address]' },
    ],
  },
  {
    id: 's2',
    number: '2',
    heading: 'Scope of This Policy',
    blocks: [
      { type: 'p', text: 'This Privacy Policy applies to personal information processed through:' },
      {
        type: 'ol',
        items: [
          'The Tellann marketing website and public documentation.',
          'Account registration, authentication, and user settings.',
          'Organizations, applications, memberships, and collaboration features.',
          'Billing, subscriptions, trials, payments, and invoices.',
          'The Tellann dashboard and associated APIs.',
          'The Tellann Desktop Agent.',
          'Customer applications instrumented using Tellann SDKs.',
          'Managed browser demonstrations and session reconstruction.',
          'Codebase analysis, documentation processing, and instrumentation.',
          'Behavior graphs, reconciliation, findings, and quality reports.',
          'Optional assisted intelligence functionality.',
          'Notifications, support requests, security operations, and customer communications.',
        ],
      },
      { type: 'p', text: 'This Policy also describes how we intend to address additional processing introduced by future features.' },
      {
        type: 'p',
        text: 'Not every capability described in Tellann’s technical roadmap is currently available. Future processing involving materially different personal information will be documented before the relevant functionality becomes available.',
      },
    ],
  },
  {
    id: 's3',
    number: '3',
    heading: 'Our Role in Processing Personal Information',
    blocks: [
      { type: 'p', text: 'Tellann processes information in different capacities depending on its purpose.' },
      { type: 'h3', id: 's3-1', text: '3.1 Tellann as a data controller' },
      { type: 'p', text: 'Tellann generally determines the purposes and means of processing information used to operate its own business and services.' },
      { type: 'p', text: 'This may include:' },
      {
        type: 'ul',
        items: [
          'User registration and account administration.',
          'Authentication and security.',
          'Billing administration.',
          'Customer communications.',
          'Technical support.',
          'Website operation and analytics.',
          'Fraud and abuse prevention.',
          'Compliance with legal requirements.',
          'Internal service reliability and operational monitoring.',
        ],
      },
      { type: 'p', text: 'For these activities, Tellann generally acts as an independent data controller.' },
      { type: 'h3', id: 's3-2', text: '3.2 Tellann as a data processor' },
      {
        type: 'p',
        text: 'When an organization uses Tellann to analyze its application or process its own application-related information, that organization generally determines the purposes for which the information is collected and used.',
      },
      { type: 'p', text: 'This includes personal data that may be present in:' },
      {
        type: 'ul',
        items: [
          'Authorized behavioral telemetry.',
          'Recorded application sessions.',
          'User interaction metadata.',
          'Customer application documents.',
          'Application-specific workflow evidence.',
          'Uploaded source materials.',
          'Customer-controlled reports and analytical outputs.',
        ],
      },
      { type: 'p', text: 'For these activities, Tellann generally acts as a data processor acting on the organization’s instructions.' },
      { type: 'h3', id: 's3-3', text: '3.3 Customer responsibilities' },
      {
        type: 'p',
        text: 'Organizations are responsible for establishing the lawful basis for collecting and disclosing information from their own application users, employees, testers, and other individuals.',
      },
      {
        type: 'p',
        text: 'Organizations must provide any required notices, obtain appropriate consent where necessary, and comply with applicable privacy and monitoring laws.',
      },
      { type: 'h3', id: 's3-4', text: '3.4 Data Processing Agreement' },
      {
        type: 'p',
        text:
          'Where required, processing on behalf of a customer is governed by a Data Processing Agreement ("DPA") establishing the relevant processing instructions, security measures, subprocessors, international transfers, cooperation, and deletion obligations.',
      },
    ],
  },
  {
    id: 's4',
    number: '4',
    heading: 'Categories of Information We Collect',
    blocks: [
      {
        type: 'p',
        text: 'The categories below distinguish personal information collected directly by Tellann from information provided by customers and technical information generated during platform use.',
      },
      { type: 'h3', id: 's4-1', text: '4.1 Account identity information' },
      { type: 'p', text: 'When you create an account or maintain a user profile, we may collect:' },
      {
        type: 'ul',
        items: [
          'Full name or display name.',
          'Email address.',
          'Account identifier.',
          'Profile image or avatar.',
          'Authentication preferences.',
          'Profile and interface preferences.',
          'Account creation and modification timestamps.',
          'Account status.',
          'Associated organizations and memberships.',
        ],
      },
      {
        type: 'p',
        text: '**Purpose:** To establish and maintain user accounts, identify authorized users, provide access to the Services, personalize account settings, and communicate account-related information.',
      },
      { type: 'h3', id: 's4-2', text: '4.2 Authentication and session information' },
      { type: 'p', text: 'To authenticate users and secure accounts, we process information such as:' },
      {
        type: 'ul',
        items: [
          'Authentication method.',
          'Securely handled password-verification information, where password authentication is used.',
          'One-time authentication challenges and verification status.',
          'Multi-factor authentication configuration and challenge results.',
          'Access-session identifiers and expiry metadata.',
          'Refresh-session and revocation information.',
          'Registered devices.',
          'Login timestamps.',
          'Successful and failed authentication attempts.',
          'Relevant authentication security events.',
        ],
      },
      {
        type: 'p',
        text: '**Purpose:** To authenticate users, maintain sessions, enforce access control, detect suspicious activity, and protect customer accounts.',
      },
      {
        type: 'p',
        text: 'Authentication credentials are handled through the designated authentication system. They are not treated as ordinary application telemetry.',
      },
      { type: 'h3', id: 's4-3', text: '4.3 Organization and membership information' },
      { type: 'p', text: 'When an Organization is created or administered, we may process:' },
      {
        type: 'ul',
        items: [
          'Organization name and identifier.',
          'Organization settings.',
          'Member identities.',
          'Roles and permissions.',
          'Invitations and invitation status.',
          'Invitation email addresses.',
          'Organizational security policies.',
          'Membership changes.',
          'Relevant administrative records.',
        ],
      },
      {
        type: 'p',
        text: '**Purpose:** To operate multi-user workspaces, enforce authorization boundaries, manage collaboration, and protect organizational resources.',
      },
      { type: 'h3', id: 's4-4', text: '4.4 Billing profile and subscription information' },
      { type: 'p', text: 'For subscription administration, we process:' },
      {
        type: 'ul',
        items: [
          'Payer name and billing email.',
          'Billing country.',
          'Billing address or tax details where required.',
          'Organization associated with the subscription.',
          'Selected plan.',
          'Billing currency.',
          'Subscription status.',
          'Trial eligibility.',
          'Trial start and conversion dates.',
          'Renewal dates.',
          'Subscription changes.',
          'Applicable resource entitlements.',
          'Cancellation status.',
        ],
      },
      {
        type: 'p',
        text: '**Purpose:** To administer subscriptions, establish plan and regional eligibility, calculate applicable charges, manage renewals, and maintain accounting records.',
      },
      {
        type: 'p',
        text: 'The billing profile belongs to the designated paying user, while subscription entitlements apply to the associated Organization.',
      },
      { type: 'h3', id: 's4-5', text: '4.5 Payment and transaction information' },
      { type: 'p', text: 'Payments are processed through authorized payment service providers.' },
      { type: 'p', text: 'Depending on the payment provider and transaction method, Tellann may receive:' },
      {
        type: 'ul',
        items: [
          'Payment transaction reference.',
          'Processor customer or payment-method reference.',
          'Payment status.',
          'Charge amount and currency.',
          'Payment timestamps.',
          'Authorized payment-method summary, where supplied.',
          'Invoice and receipt references.',
          'Refund or dispute status.',
          'Payment failure information.',
        ],
      },
      { type: 'p', text: 'Payment processors may separately collect full card or payment information required to authorize a transaction.' },
      {
        type: 'p',
        text: 'Tellann’s application-telemetry system is not designed to capture card numbers, CVVs, card PINs, or payment authentication secrets.',
      },
      { type: 'p', text: '**Purpose:** To verify payments, administer recurring billing, issue invoices, resolve payment issues, and prevent fraudulent transactions.' },
      { type: 'h3', id: 's4-6', text: '4.6 Subscription usage and metering information' },
      { type: 'p', text: 'Tellann measures resource consumption and entitlements, including:' },
      {
        type: 'ul',
        items: [
          'Number of registered applications.',
          'Active organization members.',
          'Outstanding invitations consuming seats.',
          'Registered environments.',
          'Ingestion credentials.',
          'Storage consumption.',
          'Applicable retention entitlements.',
          'Demonstration counts.',
          'Session counts.',
          'Report and export activity.',
          'Relevant API usage.',
        ],
      },
      {
        type: 'p',
        text: 'Some measurements are used for customer-facing quota enforcement; others support internal capacity planning, diagnostics, and abuse prevention.',
      },
      { type: 'p', text: 'Measurement does not necessarily mean that the activity is separately billable.' },
      { type: 'h3', id: 's4-7', text: '4.7 Website and network information' },
      {
        type: 'p',
        text: 'When you interact with our website or Services, our systems and applicable infrastructure providers may process technical information such as:',
      },
      {
        type: 'ul',
        items: [
          'IP address.',
          'Request timestamp.',
          'Requested URL or route.',
          'Browser or user-agent information.',
          'HTTP request metadata.',
          'Response status.',
          'Approximate location derived from network information where used.',
          'Security and abuse-detection metadata.',
          'Technical error and diagnostic information.',
        ],
      },
      {
        type: 'p',
        text: 'These categories may be processed in ordinary web and security infrastructure independently of customer application telemetry.',
      },
      { type: 'p', text: '**Purpose:** To deliver the website, maintain security, investigate technical failures, mitigate abuse, and monitor infrastructure reliability.' },
      { type: 'h3', id: 's4-8', text: '4.8 Website analytics and marketing information' },
      {
        type: 'p',
        text: 'Where website analytics or marketing measurement is enabled, and subject to applicable consent requirements, the information processed may include:',
      },
      {
        type: 'ul',
        items: ['Page visits.', 'Referral sources.', 'Campaign identifiers.', 'Navigation interactions.', 'Conversion events.', 'Aggregate performance and engagement metrics.'],
      },
      {
        type: 'p',
        text: 'If Tellann uses optional analytics cookies, advertising technologies, or third-party tracking tools, the relevant technologies, providers, purposes, and retention periods must be disclosed in our Cookie Policy and applicable consent controls.',
      },
      { type: 'p', text: 'We do not assume that every optional analytics or advertising technology is necessary to operate our Services.' },
      { type: 'h3', id: 's4-9', text: '4.9 Contact, support, and correspondence' },
      { type: 'p', text: 'When you communicate with us, we process the information necessary to respond, potentially including:' },
      {
        type: 'ul',
        items: [
          'Name.',
          'Email address.',
          'Organization details.',
          'Message content.',
          'Support request category.',
          'Technical descriptions.',
          'Diagnostic files or attachments you choose to supply.',
          'Correspondence history.',
          'Support request status.',
        ],
      },
      { type: 'p', text: '**Purpose:** To respond to enquiries, investigate issues, provide customer assistance, and improve support processes.' },
      { type: 'p', text: 'Please do not include passwords, private keys, unrestricted credentials, or unnecessary sensitive personal information in support submissions.' },
      { type: 'h3', id: 's4-10', text: '4.10 Notifications and communication preferences' },
      { type: 'p', text: 'Tellann may process:' },
      {
        type: 'ul',
        items: [
          'Notification preferences.',
          'Recipient account and organization identifiers.',
          'Email delivery destinations.',
          'Notification category.',
          'Notification content and identifiers.',
          'Read and dismissal status.',
          'Delivery attempts and outcomes.',
          'Web push subscription information, where permission is granted.',
          'Registered desktop delivery destinations.',
        ],
      },
      {
        type: 'p',
        text: '**Purpose:** To deliver account, billing, security, QA run, reporting, instrumentation, and other relevant service notifications.',
      },
      { type: 'h3', id: 's4-11', text: '4.11 Desktop device information' },
      { type: 'p', text: 'The Tellann Desktop Agent may process:' },
      {
        type: 'ul',
        items: [
          'Registered device identity.',
          'Operating-system and agent compatibility information.',
          'Agent version.',
          'Authorization and device-session state.',
          'Device registration and revocation records.',
          'Local configuration relevant to supported operations.',
          'Diagnostic and update information.',
        ],
      },
      {
        type: 'p',
        text: '**Purpose:** To authorize specific installations, secure desktop access, maintain software compatibility, and support local development workflows.',
      },
      { type: 'h3', id: 's4-12', text: '4.12 Local workspace and repository information' },
      { type: 'p', text: 'When you authorize the Desktop Agent to access a local workspace, it may process locally:' },
      {
        type: 'ul',
        items: [
          'Repository contents.',
          'Workspace path.',
          'Project structure.',
          'Source file contents.',
          'Framework and dependency information.',
          'Repository identity.',
          'Branch information.',
          'Version-control status.',
          'Snapshot references.',
          'Instrumentation targets.',
          'Applicable configuration and diagnostic information.',
        ],
      },
      {
        type: 'p',
        text: '**Purpose:** To understand the application structure, locate relevant workflow checkpoints, propose instrumentation, and perform authorized demonstrations.',
      },
      { type: 'p', text: 'Customer source files remain local by default. Processing a file locally does not mean uploading it to Tellann’s cloud.' },
      { type: 'h3', id: 's4-13', text: '4.13 Code-derived information transmitted to Tellann' },
      { type: 'p', text: 'To support codebase intelligence, the Desktop Agent may transmit derived information such as:' },
      {
        type: 'ul',
        items: [
          'File and symbol paths.',
          'Code graph relationships.',
          'Flow checkpoint locations.',
          'Structural analysis results.',
          'Analysis warnings.',
          'Repository snapshot references.',
          'Relevant instrumentation status and metadata.',
        ],
      },
      { type: 'p', text: 'These artifacts may contain confidential technical information and are treated as protected Customer Data.' },
      { type: 'h3', id: 's4-14', text: '4.14 Source-code uploads' },
      { type: 'p', text: 'Raw Customer Source Code and source archives are not part of Tellann’s default cloud-upload behavior.' },
      { type: 'p', text: 'Where a specific feature requires their upload, Tellann must obtain authorization identifying:' },
      {
        type: 'ul',
        items: [
          'The materials to be transferred.',
          'The stated purpose.',
          'The authorizing user.',
          'The time of authorization.',
          'The relevant destination and processing context.',
        ],
      },
      { type: 'p', text: 'Authorization for one upload does not automatically authorize subsequent uploads for different purposes.' },
      { type: 'p', text: 'Consented source archives are subject to deletion when the authorized purpose is complete.' },
      { type: 'h3', id: 's4-15', text: '4.15 Customer-provided documents' },
      { type: 'p', text: 'Users may submit product or software documentation, including:' },
      {
        type: 'ul',
        items: [
          'Requirements specifications.',
          'Workflow descriptions.',
          'Feature documentation.',
          'Product design documents.',
          'Application architecture descriptions.',
          'Other authorized development materials.',
        ],
      },
      { type: 'p', text: 'Tellann may process such materials to derive candidate workflows, states, or declarations for human review.' },
      { type: 'p', text: 'Where optional model assistance is used, appropriately sanitized document text may be processed by an authorized model provider.' },
      { type: 'h3', id: 's4-16', text: '4.16 Frontend application telemetry' },
      { type: 'p', text: 'The Tellann frontend SDK is designed to capture structured behavioral events such as:' },
      {
        type: 'ul',
        items: [
          'Page views.',
          'Route changes.',
          'Page exits.',
          'Button and link interactions.',
          'Component interactions.',
          'Tab and dropdown interactions.',
          'Form interaction events.',
          'Form validation outcomes.',
          'Application state changes.',
          'Workflow boundaries and outcomes.',
          'Client-side errors.',
        ],
      },
      {
        type: 'p',
        text: 'These events may include relevant non-sensitive metadata, such as a component identifier, page route, state name, or event timestamp.',
      },
      { type: 'p', text: '**Purpose:** To reconstruct demonstrated application behavior, identify workflows, and support quality analysis.' },
      { type: 'h3', id: 's4-17', text: '4.17 Backend telemetry' },
      { type: 'p', text: 'The backend SDK may collect technical execution metadata such as:' },
      {
        type: 'ul',
        items: [
          'API endpoint or normalized route.',
          'Request method.',
          'Response status.',
          'Execution duration.',
          'Error category.',
          'Endpoint execution metrics.',
          'Trace and correlation identifiers.',
          'Applicable application and environment identifiers.',
        ],
      },
      { type: 'p', text: '**Purpose:** To understand backend behavior and correlate it with frontend workflows.' },
      { type: 'p', text: 'Sensitive headers, authentication credentials, and protected payload values are excluded according to the supported collection rules.' },
      { type: 'h3', id: 's4-18', text: '4.18 Session and demonstration information' },
      { type: 'p', text: 'Tellann processes session and QA run information such as:' },
      {
        type: 'ul',
        items: [
          'Session identifier.',
          'Run identifier.',
          'Application and organization identifiers.',
          'Environment identifier.',
          'Event identifiers.',
          'Event types and versions.',
          'Timestamps.',
          'Sequence and correlation information.',
          'Session duration.',
          'Run lifecycle state.',
          'Evidence boundaries.',
          'Capture source and relevant agent version.',
        ],
      },
      {
        type: 'p',
        text: '**Purpose:** To reconstruct the event timeline, associate frontend and backend activity, generate evidence, and provide reproducible analysis.',
      },
      { type: 'h3', id: 's4-19', text: '4.19 Browser findings and replay information' },
      { type: 'p', text: 'During supported demonstrations, Tellann may process:' },
      {
        type: 'ul',
        items: [
          'Browser observations.',
          'Supported interaction traces.',
          'Network request metadata.',
          'Application errors.',
          'Visual and accessibility findings.',
          'Replay timelines.',
          'Evidence integrity information.',
          'Related run artifacts.',
        ],
      },
      {
        type: 'p',
        text: 'Session Replay is primarily a reconstruction of observed telemetry, rather than a conventional video recording of the entire screen.',
      },
      { type: 'h3', id: 's4-20', text: '4.20 Declared intent and workflow information' },
      { type: 'p', text: 'Tellann stores customer-declared information about expected application behavior, including:' },
      {
        type: 'ul',
        items: [
          'Declared workflows.',
          'States and transitions.',
          'Expected success and failure paths.',
          'Flow descriptions.',
          'Accepted or rejected suggestions.',
          'Declaration revisions.',
          'Approval information.',
          'Ruleset and provenance metadata.',
        ],
      },
      { type: 'p', text: '**Purpose:** To represent intended behavior and compare it with recorded evidence.' },
      { type: 'h3', id: 's4-21', text: '4.21 Derived behavioral intelligence' },
      { type: 'p', text: 'From available evidence and declarations, Tellann may generate:' },
      {
        type: 'ul',
        items: [
          'Observed Behavior Graphs.',
          'Workflow maps.',
          'State and transition inventories.',
          'Coverage calculations.',
          'Missing-state candidates.',
          'Missing-flow candidates.',
          'Reconciliation classifications.',
          'Endpoint findings.',
          'Graph versions and comparisons.',
          'QA report findings.',
          'Evidence-backed recommendations.',
        ],
      },
      { type: 'p', text: 'These outputs are connected to the relevant Organization and application.' },
      { type: 'p', text: 'Their accuracy and completeness depend on the quality and scope of available evidence.' },
      { type: 'h3', id: 's4-22', text: '4.22 Reports and exports' },
      { type: 'p', text: 'Tellann may store:' },
      {
        type: 'ul',
        items: [
          'Generated QA reports.',
          'Report versions and metadata.',
          'Related application or run identifiers.',
          'Export formats and generated files.',
          'Export history.',
          'Report generation status.',
        ],
      },
      { type: 'p', text: '**Purpose:** To provide quality intelligence to authorized users, support investigations, and maintain appropriate auditability.' },
      { type: 'h3', id: 's4-23', text: '4.23 Audit and security logs' },
      { type: 'p', text: 'Tellann may create records of actions including:' },
      {
        type: 'ul',
        items: [
          'Authentication attempts.',
          'Membership changes.',
          'Permission modifications.',
          'API credential creation or revocation.',
          'Desktop device registration or revocation.',
          'Workspace binding changes.',
          'Source upload authorization.',
          'Instrumentation approval and rollback.',
          'QA run lifecycle events.',
          'Report exports.',
          'Protected-value access.',
          'Billing and security configuration changes.',
          'Assisted intelligence invocations.',
        ],
      },
      { type: 'p', text: 'These records may include the acting user, affected resource, timestamp, result, and relevant organization identifier.' },
      {
        type: 'p',
        text: '**Purpose:** To maintain accountability, investigate security incidents, prevent unauthorized activity, and meet legal or contractual obligations.',
      },
      { type: 'h3', id: 's4-24', text: '4.24 Assisted intelligence information' },
      { type: 'p', text: 'Where supported model assistance is invoked, Tellann may process sanitized information such as:' },
      {
        type: 'ul',
        items: [
          'Declared flow and state names.',
          'Relevant, sanitized structural context.',
          'Appropriate customer-provided document text.',
          'Request and feature identifiers.',
          'Output suggestions.',
          'Invocation status.',
          'Attributed user and organization.',
          'Model consumption and operational cost metadata.',
        ],
      },
      {
        type: 'p',
        text:
          'Tellann’s Phase 1 analytical findings are intended to be produced through deterministic analysis of application evidence. Model assistance is limited to supplementary activities rather than serving as an independent source of analytical truth.',
      },
    ],
  },
  {
    id: 's5',
    number: '5',
    heading: 'Information We Intentionally Exclude From Application Telemetry',
    blocks: [
      { type: 'p', text: 'Tellann’s telemetry and replay systems are designed to exclude restricted information, including:' },
      { type: 'h3', id: 's5-1', text: '5.1 Authentication secrets' },
      {
        type: 'ul',
        items: ['Password values.', 'PINs.', 'Passphrases.', 'Security answers.', 'Access and refresh tokens.', 'Session authentication cookies.', 'Private authentication keys.'],
      },
      { type: 'h3', id: 's5-2', text: '5.2 Financial credentials' },
      {
        type: 'ul',
        items: [
          'Full payment card numbers.',
          'CVV or CVC values.',
          'Card PINs.',
          'Banking authentication credentials.',
          'Payment authorization secrets.',
          'Unnecessary bank account information.',
        ],
      },
      { type: 'h3', id: 's5-3', text: '5.3 Highly sensitive personal information' },
      {
        type: 'ul',
        items: [
          'Government identity numbers.',
          'Passport numbers.',
          'Driver’s license numbers.',
          'Medical records.',
          'Diagnoses.',
          'Prescriptions.',
          'Biometric templates.',
          'Other protected personal information not required for the authorized processing purpose.',
        ],
      },
      { type: 'h3', id: 's5-4', text: '5.4 Raw file contents' },
      { type: 'p', text: 'Customer application telemetry is not intended to capture raw contents of uploaded images, videos, audio files, or documents.' },
      { type: 'p', text: 'File-related events may include appropriately restricted metadata where relevant.' },
      { type: 'h3', id: 's5-5', text: '5.5 Important qualification' },
      { type: 'p', text: 'These exclusions govern application observation and telemetry.' },
      {
        type: 'p',
        text:
          'They do not prevent a user from deliberately submitting information through a separate, clearly identified workflow, nor do they eliminate the necessary processing of authentication or payment information by the appropriate systems.',
      },
      { type: 'p', text: 'Sensitive-field exclusion is a protective control, not a guarantee that every possible custom field name or application design will be classified correctly.' },
      { type: 'p', text: 'Customers must avoid deliberately transmitting restricted information through custom events or improperly configured integrations.' },
    ],
  },
  {
    id: 's6',
    number: '6',
    heading: 'How We Collect Information',
    blocks: [
      { type: 'p', text: 'We obtain information through several methods.' },
      { type: 'h3', id: 's6-1', text: '6.1 Direct submission' },
      { type: 'p', text: 'Information supplied during registration, billing, support, application setup, organization administration, and document submission.' },
      { type: 'h3', id: 's6-2', text: '6.2 Automated service operation' },
      {
        type: 'p',
        text: 'Technical information generated by authentication, session management, security monitoring, usage metering, service requests, and notification delivery.',
      },
      { type: 'h3', id: 's6-3', text: '6.3 Authorized customer integrations' },
      { type: 'p', text: 'Behavioral and technical information transmitted from supported SDKs and application integrations.' },
      { type: 'h3', id: 's6-4', text: '6.4 Local desktop processing' },
      { type: 'p', text: 'Information processed by the Desktop Agent within an authorized developer workspace.' },
      { type: 'h3', id: 's6-5', text: '6.5 Approved transfers' },
      { type: 'p', text: 'Materials explicitly approved for cloud upload, including selected documents or consented source archives.' },
      { type: 'h3', id: 's6-6', text: '6.6 Service providers' },
      {
        type: 'p',
        text: 'Limited information received from payment processors, identity providers, notification services, or other approved providers as necessary for their designated functions.',
      },
      { type: 'h3', id: 's6-7', text: '6.7 Generated information' },
      {
        type: 'p',
        text: 'Analytical records derived from submitted or observed information, including behavioral graphs, coverage reports, reconciliation findings, and usage statistics.',
      },
    ],
  },
  {
    id: 's7',
    number: '7',
    heading: 'Purposes and Lawful Bases for Processing',
    blocks: [
      { type: 'p', text: 'We process personal information only where there is an applicable lawful basis.' },
      { type: 'p', text: 'Depending on the jurisdiction and processing activity, the basis may include:' },
      { type: 'p', text: '**Performance of a contract:** Providing accounts, subscriptions, authentication, and requested services.' },
      {
        type: 'p',
        text: '**Compliance with a legal obligation:** Maintaining legally required financial records, responding to lawful requests, and complying with data protection obligations.',
      },
      {
        type: 'p',
        text:
          '**Legitimate interests:** Protecting the platform from abuse, maintaining reliability, investigating security incidents, and operating or improving services where the processing is lawful and does not override individuals’ rights.',
      },
      {
        type: 'p',
        text: '**Consent:** Processing that requires an affirmative choice, such as optional non-essential cookies, certain marketing communications, or an explicitly authorized expanded collection activity.',
      },
      { type: 'p', text: '**Other lawful bases:** Where recognized and appropriate under the applicable legislation.' },
      { type: 'p', text: 'Our processing purposes include:' },
      {
        type: 'ol',
        items: [
          'Creating and administering Tellann accounts.',
          'Authenticating users and securing devices.',
          'Maintaining organizational permissions.',
          'Providing subscribed features.',
          'Processing authorized application evidence.',
          'Constructing workflow and behavior models.',
          'Generating QA reports and analysis.',
          'Administering billing and resource entitlements.',
          'Providing technical support.',
          'Delivering necessary operational communications.',
          'Preventing fraud and unauthorized use.',
          'Maintaining infrastructure and service reliability.',
          'Improving supported product functionality through authorized and appropriately protected information.',
          'Meeting applicable legal and regulatory requirements.',
        ],
      },
      {
        type: 'p',
        text: 'Where Tellann is acting as a processor, the customer is generally responsible for establishing the lawful basis for collecting and instructing the processing of personal data within Customer Data.',
      },
    ],
  },
  {
    id: 's8',
    number: '8',
    heading: 'Desktop Agent, Local Processing, and Source-Code Privacy',
    blocks: [
      { type: 'h3', id: 's8-1', text: '8.1 Local-first processing' },
      { type: 'p', text: 'Tellann’s Desktop Agent is designed to perform source-code inspection and related operations on the developer’s machine by default.' },
      { type: 'p', text: 'Source-code analysis does not automatically require the transfer of complete source files to Tellann.' },
      { type: 'h3', id: 's8-2', text: '8.2 Derived information' },
      {
        type: 'p',
        text: 'To provide cloud-based intelligence and coordinated functionality, the Desktop Agent may transmit permitted projections, evidence, and operational metadata.',
      },
      { type: 'p', text: 'A code-derived projection is not necessarily anonymous. File paths and structural information may remain confidential or identify individuals and organizations.' },
      { type: 'h3', id: 's8-3', text: '8.3 Explicit source-upload authorization' },
      {
        type: 'p',
        text: 'Raw source files, source archives, and unreviewed working-tree diffs are not to be transmitted without specific, recorded authorization for the relevant purpose.',
      },
      { type: 'h3', id: 's8-4', text: '8.4 Instrumentation approval' },
      { type: 'p', text: 'The Desktop Agent may prepare proposed code changes. Authorized users review and approve applicable instrumentation plans before changes are made.' },
      { type: 'p', text: 'The authorization and change history are recorded where the relevant functionality is supported.' },
      { type: 'h3', id: 's8-5', text: '8.5 Run credentials' },
      { type: 'p', text: 'Credentials supplied to conduct demonstrations are intended to remain in operating-system-protected local storage.' },
      { type: 'p', text: 'They must not be uploaded to Tellann’s cloud as part of demonstration evidence.' },
      { type: 'h3', id: 's8-6', text: '8.6 Device sessions' },
      { type: 'p', text: 'Desktop authorization uses device-bound sessions that can be revoked independently of the user’s other authenticated sessions.' },
      { type: 'h3', id: 's8-7', text: '8.7 Local data lifecycle' },
      { type: 'p', text: 'Deleting cloud records does not automatically delete the original Customer Source Code or other files held on a developer’s own machine.' },
      { type: 'p', text: 'Users and organizations remain responsible for local repository and device administration.' },
    ],
  },
  {
    id: 's9',
    number: '9',
    heading: 'Session Replay and Behavioral Evidence',
    blocks: [
      { type: 'h3', id: 's9-1', text: '9.1 Purpose' },
      { type: 'p', text: 'Tellann reconstructs application sessions from recorded events so authorized users can understand what occurred during a demonstration.' },
      { type: 'h3', id: 's9-2', text: '9.2 Replay content' },
      { type: 'p', text: 'A replay can include navigation, UI interactions, application states, workflow transitions, errors, and permitted technical metadata.' },
      { type: 'h3', id: 's9-3', text: '9.3 Protected information' },
      { type: 'p', text: 'Sensitive fields and classified protected values are subject to applicable exclusion, protection, and display controls.' },
      { type: 'p', text: 'Protected values are not intended to appear in clear text within ordinary replay views, reports, findings, or exports.' },
      { type: 'h3', id: 's9-4', text: '9.4 Authorized reveal' },
      { type: 'p', text: 'Where the platform supports exceptional access to a protected captured value, such access requires appropriate user authorization and an audit record.' },
      { type: 'h3', id: 's9-5', text: '9.5 Evidence completeness' },
      { type: 'p', text: 'Events may be missing because of integration coverage, filtering, connectivity, processing, or other technical conditions.' },
      { type: 'p', text: 'Session Replay and related reports therefore represent available evidence, not necessarily a complete record of every application action.' },
      { type: 'h3', id: 's9-6', text: '9.6 User monitoring responsibilities' },
      { type: 'p', text: 'Customers must ensure that persons whose activity is recorded receive legally required notices and that observation occurs within lawful boundaries.' },
    ],
  },
  {
    id: 's10',
    number: '10',
    heading: 'Customer Documents and Assisted Intelligence',
    blocks: [
      { type: 'h3', id: 's10-1', text: '10.1 Document processing' },
      { type: 'p', text: 'Customer-provided product documents may be analyzed to identify potential application workflows and generate draft intent declarations.' },
      { type: 'h3', id: 's10-2', text: '10.2 Model-assisted features' },
      {
        type: 'p',
        text: 'Where an assisted capability requires a model provider, Tellann may submit limited, sanitized contextual information to that provider.',
      },
      { type: 'h3', id: 's10-3', text: '10.3 Restricted information' },
      { type: 'p', text: 'The intended model-processing boundary excludes raw source-file contents, credentials, protected values, and raw telemetry payloads.' },
      { type: 'h3', id: 's10-4', text: '10.4 Human approval' },
      { type: 'p', text: 'Model-generated suggestions do not automatically amend customer-declared intent or authorize changes to customer software.' },
      { type: 'h3', id: 's10-5', text: '10.5 Operational records' },
      {
        type: 'p',
        text: 'Tellann may maintain model invocation records, including feature type, status, consuming organization, invoking user, token usage, and cost.',
      },
      { type: 'h3', id: 's10-6', text: '10.6 Model training' },
      {
        type: 'p',
        text: 'Tellann does not obtain unrestricted permission to use confidential Customer Source Code or personal Customer Data for unrelated general-purpose model training merely because a customer uses the Services.',
      },
      {
        type: 'p',
        text: 'Processing by model providers is governed by the applicable feature disclosure, provider agreement, data-processing terms, and customer instructions.',
      },
      { type: 'p', text: 'Where any provider offers independent retention or training settings, these must be accurately described in the applicable processing documentation.' },
    ],
  },
  {
    id: 's11',
    number: '11',
    heading: 'Aggregated and Anonymized Structural Patterns',
    blocks: [
      { type: 'p', text: 'Tellann’s behavioral modeling architecture includes a capability to identify recurring structural patterns across applications.' },
      { type: 'h3', id: 's11-1', text: '11.1 Purpose' },
      { type: 'p', text: 'Aggregated structural analysis supports recognition of common application states, workflow paths, and possible missing branches.' },
      { type: 'h3', id: 's11-2', text: '11.2 Information used' },
      { type: 'p', text: 'The permitted structural index is limited to non-identifying state categories, standardized state names, and transition topology.' },
      {
        type: 'p',
        text: 'It is not intended to contain retrievable individual customer graph records, raw telemetry, customer names, proprietary field names, or identifying business metadata.',
      },
      { type: 'h3', id: 's11-3', text: '11.3 Aggregation' },
      { type: 'p', text: 'Contributions are represented in aggregate, frequency-weighted form.' },
      { type: 'p', text: 'The system must not reveal which customer contributed a particular pattern.' },
      { type: 'h3', id: 's11-4', text: '11.4 Protection against re-identification' },
      { type: 'p', text: 'Only genuinely non-identifying information may be treated as anonymized.' },
      { type: 'p', text: 'Hashed or pseudonymized personal information remains subject to privacy protections where individuals can still be identified.' },
      { type: 'h3', id: 's11-5', text: '11.5 Exclusion' },
      {
        type: 'p',
        text: 'Organizations requiring exclusion from cross-organization structural aggregation may request exclusion through the available organizational process or contact Tellann’s privacy team.',
      },
      { type: 'p', text: 'The applicable scope and method of exclusion will be confirmed before processing the request.' },
    ],
  },
  {
    id: 's12',
    number: '12',
    heading: 'How We Share Information',
    blocks: [
      { type: 'p', text: 'We may disclose information to the following recipient categories only where necessary and lawful.' },
      { type: 'h3', id: 's12-1', text: '12.1 Infrastructure providers' },
      { type: 'p', text: 'Hosting, storage, database, network, backup, and security providers operating components of the Services.' },
      { type: 'h3', id: 's12-2', text: '12.2 Payment processors' },
      { type: 'p', text: 'Approved providers handling payment authorization, recurring billing, payment verification, and transaction processing.' },
      { type: 'h3', id: 's12-3', text: '12.3 Communication providers' },
      { type: 'p', text: 'Providers supporting transactional email, notifications, web push, or other authorized messaging channels.' },
      { type: 'h3', id: 's12-4', text: '12.4 Identity and security providers' },
      { type: 'p', text: 'Providers assisting with authentication, identity verification, and platform protection where applicable.' },
      { type: 'h3', id: 's12-5', text: '12.5 Model providers' },
      { type: 'p', text: 'Authorized providers supporting an expressly invoked, bounded assisted-intelligence feature.' },
      { type: 'h3', id: 's12-6', text: '12.6 Authorized organization members' },
      { type: 'p', text: 'Information may be made available to other members of the same Organization according to their permissions and subscription entitlements.' },
      { type: 'h3', id: 's12-7', text: '12.7 Professional advisers' },
      { type: 'p', text: 'Legal, accounting, audit, or other professional advisers where required, subject to appropriate confidentiality obligations.' },
      { type: 'h3', id: 's12-8', text: '12.8 Legal and regulatory authorities' },
      { type: 'p', text: 'Information may be disclosed where lawfully required, including in response to valid legal process or binding regulatory obligations.' },
      { type: 'h3', id: 's12-9', text: '12.9 Business transactions' },
      {
        type: 'p',
        text: 'Information may be transferred as part of a lawful merger, acquisition, financing, or business restructuring, subject to confidentiality, applicable notice obligations, and continuing privacy protections.',
      },
      { type: 'h3', id: 's12-10', text: '12.10 No unrestricted disclosure' },
      { type: 'p', text: 'We do not authorize service providers to use Customer Data for unrelated purposes simply because they receive access while delivering services to Tellann.' },
      { type: 'p', text: 'We do not sell identifiable Customer Source Code, raw customer telemetry, or confidential QA reports as commercial datasets.' },
    ],
  },
  {
    id: 's13',
    number: '13',
    heading: 'Cookies and Similar Technologies',
    blocks: [
      { type: 'h3', id: 's13-1', text: '13.1 Essential technologies' },
      {
        type: 'p',
        text: 'Tellann may use strictly necessary cookies or comparable storage technologies for authentication, session security, fraud prevention, or features required to operate the requested service.',
      },
      { type: 'h3', id: 's13-2', text: '13.2 Functional preferences' },
      { type: 'p', text: 'Where enabled, preference storage may remember language, appearance, interface settings, or similar choices.' },
      { type: 'h3', id: 's13-3', text: '13.3 Analytics' },
      { type: 'p', text: 'Optional analytics technologies may help us understand website performance and engagement.' },
      { type: 'p', text: 'Where consent is legally required, such technologies will not be activated until valid consent is obtained.' },
      { type: 'h3', id: 's13-4', text: '13.4 Marketing technologies' },
      { type: 'p', text: 'Any advertising pixels, retargeting tools, or cross-site tracking technologies must be separately disclosed and subject to applicable consent requirements.' },
      { type: 'h3', id: 's13-5', text: '13.5 Managing preferences' },
      { type: 'p', text: 'Users may manage available preferences through Tellann’s cookie controls and applicable browser settings.' },
      { type: 'p', text: 'Rejecting optional tracking must not prevent access to the essential Services.' },
      { type: 'h3', id: 's13-6', text: '13.6 Cookie Policy' },
      {
        type: 'p',
        text: 'The names, providers, purposes, durations, and categories of deployed cookies or similar technologies are described in the applicable Cookie Policy.',
      },
    ],
  },
  {
    id: 's14',
    number: '14',
    heading: 'Notifications and Communications',
    blocks: [
      { type: 'p', text: 'Tellann may deliver operational notifications through supported channels such as:' },
      { type: 'ul', items: ['Email.', 'In-app notifications.', 'Web push.', 'Desktop notifications.'] },
      { type: 'p', text: 'Notifications may concern:' },
      {
        type: 'ul',
        items: [
          'Account security.',
          'Authentication events.',
          'Billing and subscription status.',
          'Quota usage.',
          'QA run completion.',
          'Report availability.',
          'Reconciliation and graph changes.',
          'Instrumentation outcomes.',
          'Important service updates.',
        ],
      },
      {
        type: 'p',
        text: 'Notifications may require the processing of account identifiers, recipient destinations, relevant event metadata, delivery status, and user preferences.',
      },
      { type: 'p', text: 'Users may manage optional notifications through available account settings.' },
      { type: 'p', text: 'Essential legal, security, and transaction notices may still be delivered where necessary and lawful.' },
      { type: 'p', text: 'Marketing communications, where offered, will follow applicable consent, objection, and unsubscribe requirements.' },
    ],
  },
  {
    id: 's15',
    number: '15',
    heading: 'Data Storage and Retention',
    blocks: [
      { type: 'h3', id: 's15-1', text: '15.1 General principle' },
      {
        type: 'p',
        text:
          'Tellann retains personal information and Customer Data for the period reasonably necessary to fulfill the purpose of processing, subject to documented retention schedules, subscription entitlements, applicable agreements, and legal obligations.',
      },
      { type: 'h3', id: 's15-2', text: '15.2 Customer-facing plan retention' },
      { type: 'p', text: 'For supported application evidence governed by plan retention, the documented maximum windows are:' },
      {
        type: 'table',
        headers: ['Plan', 'Retention window'],
        rows: [
          ['Free', '14 days'],
          ['Local', '30 days'],
          ['Solo', '90 days'],
          ['Team', '180 days'],
          ['Business', '365 days'],
          ['Enterprise', 'Contractually configured'],
        ],
      },
      { type: 'p', text: 'These windows do not necessarily govern every category of account, billing, security, or legally required record.' },
      { type: 'h3', id: 's15-3', text: '15.3 Evidence and derived artifacts' },
      {
        type: 'p',
        text: 'Demonstration evidence, reports, replay assets, graph records, and other analytical materials are subject to the applicable category-specific and organization-level retention rules.',
      },
      { type: 'p', text: 'The operative schedules must be disclosed consistently in the applicable retention documentation.' },
      { type: 'h3', id: 's15-4', text: '15.4 Source archives' },
      {
        type: 'p',
        text: 'A raw source archive uploaded with authorization for a defined purpose is subject to deletion when that purpose is completed, regardless of the ordinary subscription retention window.',
      },
      { type: 'h3', id: 's15-5', text: '15.5 Billing and accounting records' },
      { type: 'p', text: 'Records needed to comply with financial, tax, fraud prevention, or other legal obligations may be retained beyond an active subscription where required by law.' },
      { type: 'h3', id: 's15-6', text: '15.6 Security records' },
      {
        type: 'p',
        text:
          'Relevant logs may be retained where necessary for security investigations, lawful compliance, auditability, or the establishment and defense of legal claims, subject to appropriate safeguards.',
      },
      { type: 'h3', id: 's15-7', text: '15.7 Backups' },
      { type: 'p', text: 'Residual copies may temporarily remain in controlled backup systems until the applicable backup lifecycle completes.' },
      { type: 'p', text: 'Such copies remain subject to appropriate restrictions and are not retained indefinitely merely because they exist in backups.' },
      { type: 'h3', id: 's15-8', text: '15.8 Plan changes' },
      { type: 'p', text: 'Downgrading to a lower plan may change applicable retention limits.' },
      { type: 'p', text: 'The downgrade itself does not necessarily cause immediate deletion, but ordinary retention processing may subsequently delete information outside the new entitlement window.' },
      { type: 'h3', id: 's15-9', text: '15.9 End of subscription' },
      { type: 'p', text: 'Termination or cancellation of a subscription does not automatically mean that every account and organizational record is immediately erased.' },
      { type: 'p', text: 'Relevant access, export, deletion, and post-termination retention rules apply.' },
    ],
  },
  {
    id: 's16',
    number: '16',
    heading: 'Information Security',
    blocks: [
      {
        type: 'p',
        text: 'We design Tellann’s security architecture around least-privilege access, tenant isolation, secure transport, controlled local access, and auditability.',
      },
      { type: 'p', text: 'The documented security controls include:' },
      {
        type: 'ul',
        items: [
          'Encryption for data in transit.',
          'Encryption for sensitive data at rest.',
          'Authenticated API access.',
          'Organization-scoped authorization.',
          'Role-based permissions.',
          'Device-bound desktop sessions.',
          'Local credential protection.',
          'Workspace trust verification.',
          'Sensitive telemetry filtering.',
          'Protected-value handling.',
          'Audit logging.',
          'Security monitoring.',
          'Credential revocation.',
          'Controlled source-code modification.',
          'Backup and recovery procedures.',
        ],
      },
      { type: 'p', text: 'The exact controls available depend on the deployed system, feature status, and applicable agreement.' },
      { type: 'p', text: 'Customers remain responsible for securing their own applications, repositories, devices, and authorized access.' },
      { type: 'p', text: 'No technical system can be guaranteed completely immune from every security threat.' },
    ],
  },
  {
    id: 's17',
    number: '17',
    heading: 'International Data Transfers',
    blocks: [
      { type: 'p', text: 'Tellann may use infrastructure or approved service providers operating in jurisdictions outside the customer’s country.' },
      { type: 'p', text: 'Where personal information is transferred internationally, Tellann will apply safeguards required by Applicable Law.' },
      { type: 'p', text: 'These may include:' },
      {
        type: 'ul',
        items: [
          'Appropriate contractual transfer clauses.',
          'Recognized adequacy arrangements where applicable.',
          'Data processing agreements.',
          'Access restrictions.',
          'Encryption and appropriate technical safeguards.',
          'Transfer risk assessments where required.',
        ],
      },
      { type: 'p', text: 'Enterprise customers may have separately negotiated data residency or deployment arrangements.' },
      { type: 'p', text: 'Actual hosting regions and applicable transfer mechanisms are documented in the relevant service or data-processing disclosures.' },
    ],
  },
  {
    id: 's18',
    number: '18',
    heading: 'Your Privacy Rights',
    blocks: [
      { type: 'p', text: 'Depending on Applicable Law and Tellann’s processing role, individuals may have the right to:' },
      { type: 'h3', id: 's18-1', text: '18.1 Be informed' },
      { type: 'p', text: 'Receive information about the collection, use, disclosure, and retention of their personal data.' },
      { type: 'h3', id: 's18-2', text: '18.2 Access personal data' },
      { type: 'p', text: 'Request confirmation of whether personal information is being processed and obtain applicable access to that information.' },
      { type: 'h3', id: 's18-3', text: '18.3 Correct information' },
      { type: 'p', text: 'Request correction of inaccurate or incomplete personal information.' },
      { type: 'h3', id: 's18-4', text: '18.4 Request deletion' },
      { type: 'p', text: 'Request erasure where the legal requirements for deletion are met.' },
      { type: 'h3', id: 's18-5', text: '18.5 Restrict processing' },
      { type: 'p', text: 'Request restriction of certain processing activities in applicable circumstances.' },
      { type: 'h3', id: 's18-6', text: '18.6 Object to processing' },
      { type: 'p', text: 'Object to processing carried out under certain lawful bases, including eligible direct marketing activities.' },
      { type: 'h3', id: 's18-7', text: '18.7 Data portability' },
      { type: 'p', text: 'Request relevant personal data in a commonly used, machine-readable format where the right applies.' },
      { type: 'h3', id: 's18-8', text: '18.8 Withdraw consent' },
      { type: 'p', text: 'Withdraw previously granted consent for an optional activity where consent is the applicable lawful basis.' },
      { type: 'p', text: 'Withdrawal does not automatically invalidate earlier lawful processing or processing supported by a different valid legal basis.' },
      { type: 'h3', id: 's18-9', text: '18.9 Automated decision-making rights' },
      { type: 'p', text: 'Exercise applicable rights concerning qualifying decisions made solely by automated processing.' },
      { type: 'h3', id: 's18-10', text: '18.10 Lodge a complaint' },
      { type: 'p', text: 'Contact an applicable data protection supervisory authority if concerned about the handling of personal information.' },
      { type: 'p', text: 'These rights are not absolute and may be subject to applicable conditions, exceptions, or verification requirements.' },
    ],
  },
  {
    id: 's19',
    number: '19',
    heading: 'Exercising Your Rights',
    blocks: [
      { type: 'p', text: 'You may submit a privacy request to:' },
      { type: 'p', text: '**[Verified Privacy Contact Email]**' },
      { type: 'p', text: 'Where applicable, you may also use available account or organizational privacy controls.' },
      { type: 'p', text: 'We may require reasonable verification of identity or authority before disclosing, correcting, or deleting protected information.' },
      { type: 'p', text: 'We will respond within the time prescribed by applicable law and explain where a legal restriction prevents us from fulfilling a request.' },
      {
        type: 'p',
        text: 'If Tellann processes your information on behalf of a customer Organization, we may refer the request to that Organization or assist it in responding under the applicable Data Processing Agreement.',
      },
      { type: 'p', text: 'We will not disclose another individual’s or organization’s confidential information solely because a request is submitted.' },
    ],
  },
  {
    id: 's20',
    number: '20',
    heading: 'Organization-Controlled Personal Data',
    blocks: [
      { type: 'p', text: 'If your information was collected by an application, company, employer, or other organization using Tellann, that organization may be the appropriate data controller.' },
      {
        type: 'p',
        text: 'For example, if you use an application that has integrated Tellann’s SDK, the application operator generally determines the purpose and legal basis for recording permitted interaction data.',
      },
      { type: 'p', text: 'In these cases:' },
      {
        type: 'ul',
        items: [
          'The customer generally determines the permitted processing purpose.',
          'Tellann processes the information within its authorized processor role.',
          'The customer may control applicable data access and retention.',
          'Tellann assists with applicable privacy requests under its contractual and legal obligations.',
        ],
      },
      { type: 'p', text: 'Individuals may contact the application operator directly for requests concerning their use of that application.' },
      { type: 'p', text: 'This does not eliminate Tellann’s independent legal obligations.' },
    ],
  },
  {
    id: 's21',
    number: '21',
    heading: 'Data Breaches and Security Incidents',
    blocks: [
      { type: 'p', text: 'Tellann maintains procedures for identifying, investigating, containing, and addressing security incidents.' },
      { type: 'p', text: 'These procedures may include:' },
      {
        type: 'ul',
        items: [
          'Security-event detection.',
          'Incident classification.',
          'Containment and access revocation.',
          'Investigation.',
          'Remediation.',
          'Recovery.',
          'Post-incident review.',
          'Notification where legally or contractually required.',
        ],
      },
      { type: 'p', text: 'Where a personal-data breach occurs, Tellann will carry out the reporting, assistance, and notification responsibilities applicable to its role and the circumstances of the incident.' },
      { type: 'p', text: 'When processing data for a customer, Tellann will notify and cooperate with the customer as required by law and the applicable agreement.' },
    ],
  },
  {
    id: 's22',
    number: '22',
    heading: 'Automated Decisions and Profiling',
    blocks: [
      { type: 'p', text: 'Tellann uses automated software processing to analyze application behavior and generate engineering insights.' },
      { type: 'p', text: 'Such analysis may identify workflow gaps, states, transitions, or application-level quality findings.' },
      {
        type: 'p',
        text: 'During Phase 1, these analytical results are intended to evaluate software behavior rather than make decisions about the legal rights, employment, creditworthiness, or personal eligibility of individuals.',
      },
      { type: 'p', text: 'Tellann’s Phase 1 design does not include solely automated decisions intended to produce legal or similarly significant effects on individuals.' },
      { type: 'p', text: 'Any future processing that introduces qualifying automated personal decisions will require appropriate safeguards, disclosures, and lawful authorization before deployment.' },
    ],
  },
  {
    id: 's23',
    number: '23',
    heading: 'Children’s Privacy',
    blocks: [
      { type: 'p', text: 'Tellann is intended primarily for professional developers, software teams, and organizations.' },
      { type: 'p', text: 'It is not designed as a consumer service directed toward children.' },
      { type: 'p', text: 'We do not intentionally solicit personal information from children for independent marketing or direct account creation in circumstances prohibited by Applicable Law.' },
      { type: 'p', text: 'Where a customer operates software used by children, the customer is responsible for assessing whether Tellann’s observation capabilities are appropriate, lawful, and properly configured for that environment.' },
      { type: 'p', text: 'Children’s sensitive information must not be introduced into restricted telemetry categories contrary to Tellann’s documented rules.' },
      { type: 'p', text: 'If we become aware of prohibited processing involving children’s personal information, we will take appropriate action.' },
    ],
  },
  {
    id: 's24',
    number: '24',
    heading: 'Data Requests, Export, and Account Deletion',
    blocks: [
      { type: 'p', text: 'Authorized users may access account controls and export features available to their roles and plans.' },
      { type: 'p', text: 'Requests for Organization deletion, account removal, or data export are subject to:' },
      {
        type: 'ul',
        items: [
          'Appropriate authorization.',
          'Applicable retention requirements.',
          'Contractual processing obligations.',
          'Security verification.',
          'Legal restrictions.',
          'The technical scope of the request.',
        ],
      },
      {
        type: 'p',
        text: 'Deleting a user account, removing a member, cancelling a subscription, uninstalling the Desktop Agent, and deleting an Organization are distinct operations that may have different consequences.',
      },
      { type: 'p', text: 'We will explain those consequences through the relevant account or support process.' },
    ],
  },
  {
    id: 's25',
    number: '25',
    heading: 'Third-Party Websites and Services',
    blocks: [
      { type: 'p', text: 'Our website or Services may link to third-party websites, repositories, integration providers, or other external services.' },
      { type: 'p', text: 'Their privacy practices are governed by their own policies.' },
      { type: 'p', text: 'This Privacy Policy does not replace the independent terms or privacy notices of third parties that users choose to access.' },
      { type: 'p', text: 'Tellann remains responsible for its own use of authorized service providers as required by Applicable Law and relevant agreements.' },
    ],
  },
  {
    id: 's26',
    number: '26',
    heading: 'Future Platform Capabilities',
    blocks: [
      { type: 'p', text: 'Tellann’s longer-term product direction includes capabilities that may involve additional processing.' },
      { type: 'h3', id: 's26-1', text: '26.1 Production intelligence' },
      { type: 'p', text: 'Potential future activities include continuous production telemetry processing, real-user journey analysis, workflow health monitoring, and error correlation.' },
      { type: 'p', text: 'These are not described as generally available Phase 1 features.' },
      { type: 'h3', id: 's26-2', text: '26.2 Database intelligence' },
      { type: 'p', text: 'Future features may analyze permitted database execution and performance metadata.' },
      { type: 'p', text: 'They are not intended to require unrestricted collection of database contents or sensitive personal records.' },
      { type: 'h3', id: 's26-3', text: '26.3 Autonomous behavioral intelligence' },
      { type: 'p', text: 'Future features may include regression detection, test generation, failure simulation, and bounded automated remediation.' },
      { type: 'p', text: 'Capabilities that modify customer systems will require explicit, appropriately scoped authorization.' },
      { type: 'h3', id: 's26-4', text: '26.4 Privacy review before activation' },
      { type: 'p', text: 'Material new processing purposes, categories of personal data, providers, or automated actions will be assessed and disclosed before the relevant features become operational.' },
      { type: 'p', text: 'Where required, additional notices, agreements, or permissions will be obtained.' },
    ],
  },
  {
    id: 's27',
    number: '27',
    heading: 'Changes to This Privacy Policy',
    blocks: [
      { type: 'p', text: 'We may revise this Privacy Policy to reflect changes in:' },
      {
        type: 'ul',
        items: [
          'Our Services.',
          'Information collection practices.',
          'Processing purposes.',
          'Data protection requirements.',
          'Subprocessors and international transfers.',
          'Security and retention practices.',
          'Available privacy controls.',
        ],
      },
      { type: 'p', text: 'The effective date and last-updated date will reflect the applicable published version.' },
      { type: 'p', text: 'For material changes affecting privacy rights or processing expectations, Tellann will provide notice and obtain any additional authorization required by law.' },
      { type: 'p', text: 'Where appropriate, previous policy versions may be retained for transparency and auditability.' },
    ],
  },
  {
    id: 's28',
    number: '28',
    heading: 'Legal Framework',
    blocks: [
      { type: 'p', text: 'Tellann’s privacy obligations depend on the relevant processing activity and jurisdiction.' },
      { type: 'p', text: 'Applicable frameworks may include:' },
      {
        type: 'ul',
        items: [
          'The Nigeria Data Protection Act 2023.',
          'Applicable Nigeria Data Protection Commission directives and guidance.',
          'The European Union General Data Protection Regulation, where applicable.',
          'The United Kingdom’s applicable data protection and electronic privacy legislation, where applicable.',
          'Other privacy, communications, and consumer protection laws relevant to the affected individuals and operations.',
        ],
      },
      { type: 'p', text: 'Reference to these frameworks does not mean that every jurisdiction’s requirements apply to every processing activity.' },
    ],
  },
  {
    id: 's29',
    number: '29',
    heading: 'Contact and Complaints',
    blocks: [
      { type: 'p', text: 'For privacy enquiries, data protection requests, or concerns about this Policy, contact:' },
      { type: 'p', text: '**Tellann**' },
      { type: 'p', text: 'Legal Entity: [Full Registered Legal Name]' },
      { type: 'p', text: 'Registered Address: [Registered Address]' },
      { type: 'p', text: 'Privacy Email: [Verified Privacy Email]' },
      { type: 'p', text: 'Data Protection Officer: [Name or contact channel, if applicable]' },
      { type: 'p', text: 'Website: https://tellann.co' },
      { type: 'p', text: 'If you are dissatisfied with how your privacy concern has been handled, you may contact the appropriate data protection authority.' },
      { type: 'p', text: 'For Nigeria, the relevant authority is the Nigeria Data Protection Commission.' },
      { type: 'p', text: '**Regulatory Website:** https://ndpc.gov.ng' },
    ],
  },
];
