import { Fragment, type ReactNode } from 'react';

export type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'h3'; id: string; text: string };

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
        <span key={index} className="terms-tbd" title="To be confirmed before publication">
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
  { type: 'p', text: 'Welcome to Tellann.' },
  {
    type: 'p',
    text:
      'These Terms of Service ("Terms") govern your access to and use of Tellann, a software quality intelligence platform that helps developers, quality assurance professionals, and organizations understand application behavior, assess workflow coverage, reconcile intended functionality against observed evidence, and investigate software quality issues.',
  },
  {
    type: 'p',
    text:
      'These Terms form a legally binding agreement between you, or the organization you represent, and [Full Legal Entity Name] ("Tellann," "we," "us," or "our").',
  },
  {
    type: 'p',
    text:
      'Please read these Terms carefully before creating an account, installing Tellann software, subscribing to a paid plan, connecting an application, or otherwise using our Services.',
  },
  {
    type: 'p',
    text:
      '**By accepting these Terms during registration, subscription, or another agreement process, you agree to be bound by them.** If you are accepting on behalf of an organization, you represent that you are authorized to do so.',
  },
  { type: 'p', text: 'If you do not agree, you must not use the Services.' },
  {
    type: 'p',
    text:
      'These Terms should be read together with our Privacy Policy, applicable Data Processing Agreement, product-specific terms, and any separately executed enterprise agreement.',
  },
];

export const sections: LegalSection[] = [
  {
    id: 's1',
    number: '1',
    heading: 'Definitions',
    blocks: [
      { type: 'p', text: 'For purposes of these Terms:' },
      { type: 'p', text: '**"Account"** means the identity and associated credentials used to access Tellann.' },
      {
        type: 'p',
        text: '**"Organization"** means a workspace, company, team, or other customer entity registered within the platform.',
      },
      {
        type: 'p',
        text: '**"Authorized User"** means an individual permitted by an Organization to access its Tellann resources.',
      },
      {
        type: 'p',
        text:
          '**"Services"** means Tellann’s websites, cloud platform, dashboard, desktop software, SDKs, APIs, documentation, reporting features, integrations, and other functionality made available by Tellann.',
      },
      {
        type: 'p',
        text:
          '**"Desktop Agent"** means Tellann’s locally installed application for workspace binding, codebase analysis, instrumentation, and managed application demonstrations.',
      },
      {
        type: 'p',
        text: '**"SDK"** means software development kits, libraries, or integration components supplied by Tellann for application telemetry collection.',
      },
      {
        type: 'p',
        text:
          '**"Customer Data"** means information, materials, telemetry, application metadata, declared workflows, submitted documents, and other content provided to or processed through the Services on behalf of a customer.',
      },
      {
        type: 'p',
        text:
          '**"Customer Source Code"** means source files, repositories, configuration files, and other proprietary software materials belonging to or lawfully controlled by a customer.',
      },
      {
        type: 'p',
        text:
          '**"Derived Artifacts"** means analysis projections, code graphs, reconstructed sessions, workflow models, findings, coverage measurements, and related outputs generated through processing Customer Data.',
      },
      {
        type: 'p',
        text: '**"QA Report"** means a report, finding, visualization, summary, or export generated by Tellann from available evidence.',
      },
      { type: 'p', text: '**"Subscription"** means an entitlement to a particular plan for an applicable billing period.' },
      { type: 'p', text: '**"Paid Plan"** means an eligible subscription other than the Free plan.' },
      {
        type: 'p',
        text: '**"Documentation"** means the applicable technical instructions, product descriptions, and published integration guidance.',
      },
      {
        type: 'p',
        text:
          '**"Applicable Law"** means laws and regulations governing the relevant party, activities, jurisdiction, or data-processing operation.',
      },
    ],
  },
  {
    id: 's2',
    number: '2',
    heading: 'Eligibility and Authority',
    blocks: [
      { type: 'h3', id: 's2-1', text: '2.1 Minimum eligibility' },
      { type: 'p', text: 'You must be legally capable of entering into a binding agreement under Applicable Law.' },
      {
        type: 'p',
        text: 'Individuals who lack legal capacity may not independently enter into paid agreements or administer organizational accounts.',
      },
      { type: 'h3', id: 's2-2', text: '2.2 Organizational authority' },
      {
        type: 'p',
        text:
          'If you register, subscribe, or use the Services on behalf of an Organization, you represent and warrant that you have authority to:',
      },
      {
        type: 'ul',
        items: [
          "Accept these Terms on the Organization's behalf.",
          'Connect or authorize the connection of relevant applications.',
          'Grant the permissions necessary for the applicable Services.',
          'Authorize payments where you are the designated payer.',
          'Manage resources within your assigned organizational role.',
        ],
      },
      {
        type: 'p',
        text:
          "The Organization is responsible for activities conducted by its Authorized Users within the authority granted to them, subject to Tellann's own obligations under these Terms and Applicable Law.",
      },
      { type: 'h3', id: 's2-3', text: '2.3 Accurate information' },
      {
        type: 'p',
        text: 'You agree to provide accurate registration, billing, and contact information and to keep it reasonably current.',
      },
      {
        type: 'p',
        text: 'You must not deliberately misrepresent your identity, billing country, organizational authority, or eligibility for a plan.',
      },
    ],
  },
  {
    id: 's3',
    number: '3',
    heading: 'Account Registration and Security',
    blocks: [
      { type: 'h3', id: 's3-1', text: '3.1 Account creation' },
      { type: 'p', text: 'Certain Services require registration and authentication.' },
      {
        type: 'p',
        text:
          'Tellann may provide password-based authentication, one-time verification codes, multi-factor authentication, device authorization, and organization-based identity management, depending on the available functionality and plan.',
      },
      { type: 'h3', id: 's3-2', text: '3.2 Account responsibilities' },
      { type: 'p', text: 'You must take reasonable steps to protect your account, including:' },
      {
        type: 'ul',
        items: [
          'Safeguarding passwords and access credentials.',
          'Not sharing personal login credentials with unauthorized persons.',
          'Maintaining the security of devices used to access Tellann.',
          'Revoking credentials and device access that are no longer required.',
          'Promptly reporting suspected account compromise.',
        ],
      },
      { type: 'h3', id: 's3-3', text: '3.3 Organization membership and permissions' },
      { type: 'p', text: 'Tellann supports organizational access roles, including Owner, Admin, Member, and Viewer.' },
      {
        type: 'p',
        text: 'The permissions available to each user depend on the user’s role, organizational configuration, and subscribed plan.',
      },
      {
        type: 'p',
        text: 'Organization Owners are responsible for controlling membership, ownership transfers, and other privileged organizational operations.',
      },
      { type: 'h3', id: 's3-4', text: '3.4 Device sessions and API credentials' },
      { type: 'p', text: 'Desktop device sessions, SDK ingestion credentials, and programmatic access tokens are separate authentication mechanisms.' },
      { type: 'p', text: 'You must use each credential only for its intended purpose.' },
      {
        type: 'p',
        text:
          'You must not publish secret credentials, deliberately bypass permission boundaries, or provide unauthorized third parties with access to organizational resources.',
      },
      { type: 'h3', id: 's3-5', text: '3.5 Unauthorized access' },
      {
        type: 'p',
        text:
          'You must notify Tellann promptly after becoming aware of unauthorized access, stolen credentials, compromised devices, or suspected misuse of your Organization.',
      },
      {
        type: 'p',
        text: 'Tellann may revoke compromised credentials or restrict access where reasonably necessary to protect users and the Services.',
      },
    ],
  },
  {
    id: 's4',
    number: '4',
    heading: 'Description and Scope of Services',
    blocks: [
      { type: 'h3', id: 's4-1', text: '4.1 Core functionality' },
      { type: 'p', text: 'Tellann provides tools for observing, reconstructing, and analyzing application behavior.' },
      {
        type: 'p',
        text: "Depending on the currently available features and the customer's subscription, the Services may include:",
      },
      {
        type: 'ul',
        items: [
          'Application registration and environment management.',
          'Declaration and management of intended application workflows.',
          'Locally managed developer demonstrations.',
          'Frontend and backend behavioral data capture.',
          'Session reconstruction and replay.',
          'Behavior graph creation and workflow discovery.',
          'Workflow, state, transition, and endpoint coverage analysis.',
          'Identification of unobserved states and paths.',
          'Reconciliation of declared intent against observed behavior.',
          'Endpoint and error analysis.',
          'Visual and accessibility findings.',
          'QA reporting and export.',
          'Codebase and product-document analysis.',
          'Team collaboration and organizational administration.',
        ],
      },
      { type: 'p', text: 'Functionality is subject to actual product availability, technical compatibility, and applicable plan entitlements.' },
      { type: 'h3', id: 's4-2', text: '4.2 Evidence-based analysis' },
      { type: 'p', text: 'Tellann generates analytical results from available application evidence.' },
      {
        type: 'p',
        text:
          'A report may identify an unobserved workflow, a possible missing state, a discrepancy between declaration and observation, or another quality concern.',
      },
      { type: 'p', text: '**An unobserved workflow is not necessarily a defective or unimplemented workflow.**' },
      {
        type: 'p',
        text:
          'Likewise, an observed workflow is not proof that every implementation condition, security requirement, edge case, or user experience is correct.',
      },
      {
        type: 'p',
        text: 'Users remain responsible for interpreting analytical results and conducting any additional validation required for their applications.',
      },
      { type: 'h3', id: 's4-3', text: '4.3 Product evolution' },
      {
        type: 'p',
        text:
          'Tellann may develop additional capabilities involving production monitoring, workflow health, real-user journey intelligence, regression detection, assisted validation, and autonomous quality intelligence.',
      },
      {
        type: 'p',
        text:
          'A capability described on a roadmap, in conceptual documentation, or in promotional material does not become an available or contractually included Service merely because it has been announced.',
      },
      {
        type: 'p',
        text:
          'Any new capability involving materially different data processing, additional fees, or authority to modify customer systems may require separate notice, authorization, or agreement.',
      },
      { type: 'h3', id: 's4-4', text: '4.4 Technical compatibility' },
      {
        type: 'p',
        text: 'Certain functionality requires compatible operating systems, runtimes, frameworks, network access, application instrumentation, or desktop environments.',
      },
      {
        type: 'p',
        text:
          'Tellann does not warrant compatibility with every programming language, application architecture, browser, database, operating system, or third-party service.',
      },
    ],
  },
  {
    id: 's5',
    number: '5',
    heading: 'License to Use Tellann',
    blocks: [
      { type: 'h3', id: 's5-1', text: '5.1 Service license' },
      {
        type: 'p',
        text:
          'Subject to these Terms and applicable payment obligations, Tellann grants you a limited, non-exclusive, non-transferable, non-sublicensable right to access and use the Services during your applicable subscription or authorized access period.',
      },
      {
        type: 'p',
        text: 'Use is permitted for lawful internal development, testing, quality assurance, application analysis, and related organizational purposes.',
      },
      { type: 'h3', id: 's5-2', text: '5.2 Software license' },
      {
        type: 'p',
        text: "Tellann grants you permission to install and execute supported Desktop Agent and SDK components for authorized use with the Services.",
      },
      {
        type: 'p',
        text: 'You may not distribute proprietary Tellann components to unrelated third parties, resell access, or operate an unauthorized competing hosted service based on Tellann software.',
      },
      {
        type: 'p',
        text: 'The preceding restrictions do not override rights expressly granted under any applicable open-source license.',
      },
      { type: 'h3', id: 's5-3', text: '5.3 Open-source components' },
      { type: 'p', text: 'Some software components may be provided under separate open-source licenses.' },
      { type: 'p', text: 'Those licenses govern the relevant components to the extent of any inconsistency with these Terms.' },
      { type: 'h3', id: 's5-4', text: '5.4 Restrictions' },
      { type: 'p', text: 'Except where expressly permitted by law or an applicable license, you must not:' },
      {
        type: 'ul',
        items: [
          'Remove proprietary notices.',
          'Circumvent subscription or authorization controls.',
          'Sell or sublicense proprietary platform access without authorization.',
          'Misrepresent Tellann software as your own proprietary product.',
          'Copy proprietary internal implementations for unauthorized redistribution.',
          'Interfere with the security or availability of the Services.',
        ],
      },
    ],
  },
  {
    id: 's6',
    number: '6',
    heading: 'Customer Applications and Authorized Access',
    blocks: [
      { type: 'h3', id: 's6-1', text: '6.1 Rights to connected systems' },
      {
        type: 'p',
        text: 'You may connect, analyze, instrument, or demonstrate only applications, repositories, environments, and systems that you own or are lawfully authorized to access.',
      },
      {
        type: 'p',
        text: 'You are responsible for obtaining any necessary permissions from employers, clients, customers, repository owners, or other relevant parties.',
      },
      { type: 'h3', id: 's6-2', text: '6.2 Application configuration' },
      { type: 'p', text: 'You are responsible for:' },
      {
        type: 'ul',
        items: [
          'Selecting the appropriate application and environment.',
          'Maintaining valid integration credentials.',
          'Configuring telemetry collection within lawful boundaries.',
          'Testing integration changes.',
          'Ensuring the connected application remains adequately protected.',
        ],
      },
      { type: 'h3', id: 's6-3', text: '6.3 Testing environments' },
      {
        type: 'p',
        text:
          'Where practical, application demonstrations and instrumentation should first be conducted in development, staging, or other controlled environments.',
      },
      {
        type: 'p',
        text:
          'If you authorize operations against a production system, you remain responsible for assessing the operational risk of those actions and for ensuring the relevant feature is intended and permitted for production use.',
      },
      { type: 'h3', id: 's6-4', text: '6.4 Third-party systems' },
      {
        type: 'p',
        text:
          "Your use of Tellann does not grant permission to bypass third-party authentication, violate repository permissions, or exceed authorization granted by another service provider.",
      },
    ],
  },
  {
    id: 's7',
    number: '7',
    heading: 'Desktop Agent and Local Workspace Access',
    blocks: [
      { type: 'h3', id: 's7-1', text: '7.1 Nature of local access' },
      { type: 'p', text: 'The Desktop Agent may require permission to access a local software workspace.' },
      { type: 'p', text: 'Depending on enabled functionality, this access can include:' },
      {
        type: 'ul',
        items: [
          'Reading supported project files.',
          'Examining repository structure and metadata.',
          'Creating code analysis projections.',
          'Identifying workflow checkpoints.',
          'Examining branch and version-control state.',
          'Preparing instrumentation changes.',
          'Running permitted local validation operations.',
          'Launching and controlling managed browser demonstration sessions.',
        ],
      },
      { type: 'h3', id: 's7-2', text: '7.2 Source-code handling' },
      { type: 'p', text: "Tellann's intended operating model is local-first." },
      { type: 'p', text: "Customer Source Code is analyzed on the user's machine by default." },
      {
        type: 'p',
        text: "Derived analysis information may be transmitted to Tellann's Services where required to provide the requested functionality.",
      },
      {
        type: 'p',
        text: 'Raw source files or source archives must not be transmitted to Tellann without explicit authorization for a stated purpose.',
      },
      { type: 'h3', id: 's7-3', text: '7.3 Source upload consent' },
      {
        type: 'p',
        text: 'Where a feature requires uploading raw source materials, Tellann must identify the purpose of the upload and obtain the required authorization.',
      },
      {
        type: 'p',
        text: 'Consent to one upload does not constitute ongoing permission to upload the same repository for other purposes.',
      },
      {
        type: 'p',
        text: 'Source archives uploaded under such authorization are subject to purpose-limited handling and deletion requirements.',
      },
      { type: 'h3', id: 's7-4', text: '7.4 Workspace binding' },
      { type: 'p', text: 'Binding a workspace authorizes the Desktop Agent to perform supported operations within the approved scope.' },
      {
        type: 'p',
        text: "Such authorization does not transfer ownership of the repository or grant unrestricted control of the user's computer.",
      },
      { type: 'p', text: 'A user may revoke workspace access by using available unbinding, permission, or device-revocation mechanisms.' },
      { type: 'h3', id: 's7-5', text: '7.5 Device security' },
      {
        type: 'p',
        text:
          'You are responsible for securing the local device on which the Desktop Agent runs, including maintaining appropriate system permissions, malware protection, access controls, and backups.',
      },
      {
        type: 'p',
        text: 'Tellann is responsible for implementing the security controls it undertakes to provide within its software and hosted Services.',
      },
    ],
  },
  {
    id: 's8',
    number: '8',
    heading: 'Instrumentation and Source-Code Modification',
    blocks: [
      { type: 'h3', id: 's8-1', text: '8.1 Instrumentation functionality' },
      {
        type: 'p',
        text: "Certain subscription tiers may permit the Desktop Agent to propose changes to a customer's working tree for behavioral instrumentation.",
      },
      {
        type: 'p',
        text: 'Such changes may introduce tracking hooks, SDK configuration, workflow markers, or other approved integration components.',
      },
      { type: 'h3', id: 's8-2', text: '8.2 Human authorization' },
      {
        type: 'p',
        text: "Tellann must not intentionally apply an instrumentation plan to a customer's working tree without the required explicit approval.",
      },
      {
        type: 'p',
        text: 'Where an instrumentation feature is available, the customer must be provided with a reviewable description or diff of proposed changes before approval.',
      },
      { type: 'h3', id: 's8-3', text: '8.3 Reversibility' },
      {
        type: 'p',
        text: 'Supported instrumentation operations must provide a recorded rollback mechanism for reverting the changes made by the approved plan.',
      },
      {
        type: 'p',
        text:
          'Rollback is intended to reverse Tellann-generated instrumentation changes. It does not replace normal source-control practices, repository backups, or independent verification.',
      },
      { type: 'h3', id: 's8-4', text: '8.4 Branch governance' },
      {
        type: 'p',
        text: "Where supported, organizational branch policies and time-limited checkout permissions govern the Desktop Agent's authorization to switch branches and apply modifications.",
      },
      { type: 'h3', id: 's8-5', text: '8.5 Customer responsibility' },
      {
        type: 'p',
        text: 'You are responsible for reviewing proposed changes, confirming their suitability, and conducting appropriate tests before committing or deploying modified software.',
      },
      {
        type: 'p',
        text:
          'Tellann remains responsible for failures caused by its breach of applicable contractual obligations, subject to the remedies and limitations permitted by Applicable Law.',
      },
      { type: 'h3', id: 's8-6', text: '8.6 No unrestricted modification authority' },
      {
        type: 'p',
        text:
          'Installation of the Desktop Agent or acceptance of these Terms does not grant Tellann unrestricted authority to modify, commit, deploy, or otherwise change customer applications.',
      },
      {
        type: 'p',
        text: 'Any future autonomous modification or remediation capability requires a separately defined authorization scope, including revocation and appropriate safeguards.',
      },
    ],
  },
  {
    id: 's9',
    number: '9',
    heading: 'Behavioral Capture, Telemetry, and Session Replay',
    blocks: [
      { type: 'h3', id: 's9-1', text: '9.1 Captured information' },
      { type: 'p', text: 'Depending on the enabled integrations and features, Tellann may process application behavior data such as:' },
      {
        type: 'ul',
        items: [
          'Page visits and navigation transitions.',
          'UI interactions and form-event metadata.',
          'Application state and workflow transitions.',
          'API request and response metadata.',
          'Timing and performance information.',
          'Error classifications.',
          'Session and demonstration identifiers.',
          'Browser diagnostic findings.',
        ],
      },
      { type: 'p', text: 'Collection is governed by the applicable Documentation, privacy controls, and data-processing terms.' },
      { type: 'h3', id: 's9-2', text: '9.2 Session replay' },
      { type: 'p', text: "Tellann's Session Replay functionality reconstructs behavioral timelines from recorded telemetry." },
      { type: 'p', text: "Session Replay is not necessarily a video or pixel-accurate recording of a user's screen." },
      { type: 'p', text: 'Its completeness and accuracy depend on the available and successfully processed evidence.' },
      { type: 'h3', id: 's9-3', text: '9.3 Sensitive information' },
      {
        type: 'p',
        text:
          'Application telemetry must not be configured to intentionally capture prohibited sensitive material such as plaintext passwords, private keys, authentication tokens, full payment credentials, government identity records, or protected health information.',
      },
      {
        type: 'p',
        text:
          'Tellann implements privacy and protected-value controls within supported components, but customers remain responsible for their own application-specific data handling and configurations.',
      },
      { type: 'h3', id: 's9-4', text: '9.4 Customer notice and consent' },
      {
        type: 'p',
        text:
          'Where your use of Tellann involves observing employees, customers, testers, or end users, you are responsible for providing legally required notices, establishing a valid legal basis, and obtaining consent where required.',
      },
      {
        type: 'p',
        text: 'You must not use Tellann as an undisclosed surveillance tool or for unauthorized monitoring of individuals.',
      },
      { type: 'h3', id: 's9-5', text: '9.5 Limitations' },
      {
        type: 'p',
        text: 'Tellann may reject, exclude, aggregate, mask, or otherwise restrict telemetry where necessary to enforce privacy, security, technical, or contractual requirements.',
      },
    ],
  },
  {
    id: 's10',
    number: '10',
    heading: 'Declared Intent, Reconciliation, and Quality Analysis',
    blocks: [
      { type: 'h3', id: 's10-1', text: '10.1 Declared intent' },
      { type: 'p', text: "Users may describe expected application workflows, states, and transitions through Tellann's supported interfaces." },
      {
        type: 'p',
        text: 'These declarations constitute customer-provided expectations and do not independently establish that the declared functionality exists.',
      },
      { type: 'h3', id: 's10-2', text: '10.2 Observed behavior' },
      { type: 'p', text: 'Tellann reconstructs observed behavior from the available captured evidence.' },
      {
        type: 'p',
        text: 'Observed behavior represents what the platform recorded and processed, not necessarily the complete set of possible application behaviors.',
      },
      { type: 'h3', id: 's10-3', text: '10.3 Reconciliation' },
      {
        type: 'p',
        text:
          'Tellann may compare declared intent against observed behavior and classify confirmed behavior, unobserved expected behavior, and observed but undeclared behavior.',
      },
      {
        type: 'p',
        text: 'These classifications support quality investigation and are not conclusive legal, security, or regulatory certifications.',
      },
      { type: 'h3', id: 's10-4', text: '10.4 Recommendations and findings' },
      { type: 'p', text: 'Recommendations are provided to help customers investigate potential improvements.' },
      {
        type: 'p',
        text: 'Users remain responsible for determining their relevance, correctness, and suitability before implementing changes.',
      },
      { type: 'h3', id: 's10-5', text: '10.5 Quality assurance responsibility' },
      { type: 'p', text: 'Tellann supplements existing quality assurance processes.' },
      {
        type: 'p',
        text: 'It does not eliminate the need for independent testing, code review, security assessments, accessibility verification, operational monitoring, or release governance.',
      },
    ],
  },
  {
    id: 's11',
    number: '11',
    heading: 'Customer Data Ownership and Intellectual Property',
    blocks: [
      { type: 'h3', id: 's11-1', text: '11.1 Customer ownership' },
      {
        type: 'p',
        text:
          'As between Tellann and the customer, the customer retains all rights, title, and interest in Customer Source Code, customer-authored materials, proprietary application information, and Customer Data, except for materials owned by third parties.',
      },
      { type: 'p', text: 'Nothing in these Terms transfers ownership of your repository or proprietary software to Tellann.' },
      { type: 'h3', id: 's11-2', text: '11.2 Processing license' },
      {
        type: 'p',
        text:
          'You grant Tellann a limited, non-exclusive license to host, transmit, process, reproduce, display, and transform Customer Data only as reasonably necessary to provide, secure, maintain, support, and improve the contracted Services in accordance with these Terms and applicable data-processing arrangements.',
      },
      {
        type: 'p',
        text: 'This license ends when no longer required for those permitted purposes, subject to applicable retention and legal obligations.',
      },
      { type: 'h3', id: 's11-3', text: '11.3 Generated reports and outputs' },
      {
        type: 'p',
        text:
          'Customers may use, reproduce, download, share, and internally modify their generated QA Reports, workflow analyses, and customer-specific analytical outputs for lawful business and engineering purposes.',
      },
      {
        type: 'p',
        text:
          "To the extent that Tellann owns rights in customer-specific generated output, Tellann grants the customer a perpetual, worldwide, non-exclusive, royalty-free license to use and distribute that output, subject to applicable third-party rights and confidentiality obligations.",
      },
      {
        type: 'p',
        text:
          "This does not transfer ownership of Tellann's underlying software, algorithms, generic report templates, analytical methods, or platform infrastructure.",
      },
      { type: 'h3', id: 's11-4', text: '11.4 Tellann intellectual property' },
      {
        type: 'p',
        text: "Tellann retains ownership of its proprietary software, trademarks, interfaces, algorithms, Documentation, product designs, service architecture, and other intellectual property.",
      },
      { type: 'h3', id: 's11-5', text: '11.5 Feedback' },
      {
        type: 'p',
        text:
          "If you voluntarily provide product suggestions or feedback, Tellann may use that feedback to develop and improve its Services without compensation, provided it does not disclose confidential Customer Data or proprietary source materials without authorization.",
      },
    ],
  },
  {
    id: 's12',
    number: '12',
    heading: 'Aggregated and Anonymized Information',
    blocks: [
      { type: 'h3', id: 's12-1', text: '12.1 Operational statistics' },
      {
        type: 'p',
        text: 'Tellann may generate statistical information about service performance, usage, system reliability, feature utilization, and other operational characteristics.',
      },
      { type: 'p', text: 'Such information must be handled in accordance with the applicable privacy and data-processing requirements.' },
      { type: 'h3', id: 's12-2', text: '12.2 Structural pattern analysis' },
      {
        type: 'p',
        text:
          'Tellann may generate anonymized, aggregated structural patterns from application behavior graphs to improve supported workflow modeling and suggestion capabilities.',
      },
      {
        type: 'p',
        text:
          'Such patterns must not identify an individual customer or expose customer-specific source code, raw telemetry payloads, confidential application content, or identifiable business information.',
      },
      { type: 'h3', id: 's12-3', text: '12.3 Cross-organization protection' },
      {
        type: 'p',
        text: "Tellann must not make another customer's identifiable records or proprietary behavioral data available through structural pattern matching.",
      },
      {
        type: 'p',
        text: 'Cross-organization use is limited to non-identifying, aggregated structural information within the permitted processing purpose.',
      },
      { type: 'h3', id: 's12-4', text: '12.4 Exclusion requests' },
      {
        type: 'p',
        text:
          "Organizations requiring exclusion from eligible cross-organization structural aggregation may request the applicable exclusion through Tellann's supported organizational configuration or contact process.",
      },
      {
        type: 'p',
        text: 'The scope and implementation of that exclusion must be disclosed and honored in accordance with the applicable policy or agreement.',
      },
    ],
  },
  {
    id: 's13',
    number: '13',
    heading: 'Assisted Intelligence and Automated Suggestions',
    blocks: [
      { type: 'h3', id: 's13-1', text: '13.1 Assisted functionality' },
      {
        type: 'p',
        text:
          'Tellann may use automated or model-assisted capabilities for limited activities, including draft workflow generation, suggestion enrichment, domain inference, and processing of supported product documentation.',
      },
      { type: 'p', text: 'Availability may vary by plan and release.' },
      { type: 'h3', id: 's13-2', text: '13.2 Third-party processing' },
      {
        type: 'p',
        text:
          'Where an assisted feature uses an external model provider, sanitized information necessary for the requested task may be transmitted to that provider, subject to applicable privacy safeguards and data-processing arrangements.',
      },
      { type: 'h3', id: 's13-3', text: '13.3 Human review' },
      { type: 'p', text: 'Model-generated suggestions and drafts may contain mistakes, omissions, or inaccurate interpretations.' },
      {
        type: 'p',
        text: 'They must be reviewed by an authorized user before being incorporated into customer-declared intent or other consequential configurations.',
      },
      { type: 'h3', id: 's13-4', text: '13.4 Analytical results' },
      {
        type: 'p',
        text: 'Model assistance must not be treated as independent proof that an application is correct, secure, or production-ready.',
      },
      { type: 'h3', id: 's13-5', text: '13.5 Customer content and training' },
      {
        type: 'p',
        text:
          'Use of Tellann does not itself grant unrestricted permission to use Customer Source Code or confidential Customer Data for unrelated general-purpose model training.',
      },
      { type: 'p', text: 'Any such use requires a separately established lawful basis, appropriate contractual authorization, and clear disclosure.' },
      { type: 'h3', id: 's13-6', text: '13.6 Future autonomous features' },
      {
        type: 'p',
        text:
          'Any future capability that executes tests, proposes remediation, or modifies customer systems autonomously will be subject to additional authorization and controls appropriate to the nature of the action.',
      },
    ],
  },
  {
    id: 's14',
    number: '14',
    heading: 'Data Protection and Privacy',
    blocks: [
      { type: 'h3', id: 's14-1', text: '14.1 Privacy framework' },
      {
        type: 'p',
        text: "Tellann processes personal information in accordance with Applicable Law, its Privacy Policy, and relevant contractual data-protection obligations.",
      },
      { type: 'h3', id: 's14-2', text: '14.2 Data controller and processor roles' },
      {
        type: 'p',
        text:
          'For personal information collected directly for account administration, billing, security, and business operations, Tellann may act as an independent data controller.',
      },
      {
        type: 'p',
        text:
          "Where Tellann processes personal data contained in customer application telemetry or other Customer Data on the customer's behalf, Tellann generally acts as a data processor or equivalent service provider, as determined by the relevant law and processing circumstances.",
      },
      { type: 'h3', id: 's14-3', text: '14.3 Customer responsibilities' },
      {
        type: 'p',
        text:
          'Customers are responsible for ensuring that their instructions, integrations, and collection practices are lawful, including maintaining appropriate notices, consent mechanisms where required, and other legal bases.',
      },
      { type: 'h3', id: 's14-4', text: '14.4 Tellann responsibilities' },
      {
        type: 'p',
        text:
          'Tellann is responsible for implementing the technical and organizational safeguards applicable to its role and for handling Customer Data within the authorized scope.',
      },
      { type: 'h3', id: 's14-5', text: '14.5 Data Processing Agreement' },
      {
        type: 'p',
        text:
          'Where required, processing of personal data on behalf of a customer will be governed by a Data Processing Agreement ("DPA") addressing the relevant processing activities, security measures, subprocessors, assistance obligations, and data return or deletion requirements.',
      },
      { type: 'h3', id: 's14-6', text: '14.6 International transfers' },
      {
        type: 'p',
        text: 'International transfers of personal data must comply with applicable cross-border transfer requirements and any necessary contractual safeguards.',
      },
      { type: 'h3', id: 's14-7', text: '14.7 Privacy rights' },
      {
        type: 'p',
        text: 'Individuals may have legal rights relating to access, correction, deletion, portability, objection, restriction, or other matters.',
      },
      { type: 'p', text: 'Requests will be handled according to the applicable controller–processor relationship and Applicable Law.' },
    ],
  },
  {
    id: 's15',
    number: '15',
    heading: 'Data Security and Confidentiality',
    blocks: [
      { type: 'h3', id: 's15-1', text: '15.1 Security measures' },
      {
        type: 'p',
        text:
          'Tellann will implement reasonable and appropriate technical and organizational measures for protecting the Services and Customer Data, taking account of the nature of the processing and relevant contractual obligations.',
      },
      {
        type: 'p',
        text: 'These may include access controls, encryption, session management, credential protection, tenant isolation, logging, and security monitoring, as applicable.',
      },
      { type: 'h3', id: 's15-2', text: '15.2 Shared responsibility' },
      { type: 'p', text: 'Tellann is responsible for securing the infrastructure and software components under its control.' },
      {
        type: 'p',
        text: 'Customers are responsible for securing their applications, connected systems, devices, local workspaces, access permissions, and their own infrastructure.',
      },
      { type: 'h3', id: 's15-3', text: '15.3 Confidentiality' },
      {
        type: 'p',
        text:
          "Each party must protect the other party's non-public confidential information using reasonable care and may disclose it only where authorized, necessary for permitted service operations under suitable confidentiality obligations, or legally required.",
      },
      {
        type: 'p',
        text:
          'Confidentiality obligations do not apply to information lawfully public, independently developed without misuse, or lawfully obtained from an unrestricted third party.',
      },
      { type: 'h3', id: 's15-4', text: '15.4 Security incidents' },
      {
        type: 'p',
        text: 'Tellann will investigate confirmed security incidents affecting systems under its control and provide legally or contractually required notifications and cooperation.',
      },
      { type: 'p', text: 'Customers must promptly notify Tellann of suspected unauthorized use of their accounts or integrations.' },
      { type: 'h3', id: 's15-5', text: '15.5 No absolute security guarantee' },
      { type: 'p', text: 'No internet-connected system can be guaranteed immune from every vulnerability or operational failure.' },
      {
        type: 'p',
        text: "This statement does not reduce Tellann's obligation to maintain the safeguards it contractually promises or those required by law.",
      },
    ],
  },
  {
    id: 's16',
    number: '16',
    heading: 'Subscriptions, Plans, and Usage Limits',
    blocks: [
      { type: 'h3', id: 's16-1', text: '16.1 Available plans' },
      { type: 'p', text: "Tellann's commercial plan structure includes:" },
      { type: 'ul', items: ['Free.', 'Local (Nigeria only).', 'Solo.', 'Team.', 'Business.', 'Enterprise.'] },
      {
        type: 'p',
        text: 'The features and limits associated with each plan are described on the applicable pricing, entitlement, or subscription pages.',
      },
      { type: 'h3', id: 's16-2', text: '16.2 Organization-scoped subscriptions' },
      { type: 'p', text: 'Subscriptions grant entitlements to a particular Organization.' },
      {
        type: 'p',
        text: 'Application limits, active user seats, storage, retention, environments, and applicable credentials are measured or enforced at the organizational level.',
      },
      { type: 'h3', id: 's16-3', text: '16.3 Billing identity' },
      {
        type: 'p',
        text:
          'The paying user maintains billing information that may determine the available billing currency, payment processors, and regional plan eligibility for Organizations they pay for.',
      },
      { type: 'h3', id: 's16-4', text: '16.4 Usage limits' },
      { type: 'p', text: "You agree to remain within your plan's applicable resource limits." },
      {
        type: 'p',
        text: 'Tellann may prevent new resource creation, restrict additional ingestion, or limit unavailable features when an applicable quota is reached.',
      },
      { type: 'h3', id: 's16-5', text: '16.5 User seats' },
      { type: 'p', text: 'Where applicable, user seats include active Organization members and unexpired invitations.' },
      {
        type: 'p',
        text: "Revoking an invitation or removing a member releases the corresponding occupied seat, according to the platform's metering rules.",
      },
      { type: 'h3', id: 's16-6', text: '16.6 Feature availability' },
      { type: 'p', text: 'A subscription does not grant access to features excluded from the plan or not yet generally available.' },
      { type: 'h3', id: 's16-7', text: '16.7 Usage transparency' },
      { type: 'p', text: 'Tellann will identify customer-facing billable units and applicable limits.' },
      { type: 'p', text: 'Measurement of operational events or internal compute consumption does not by itself create a charge.' },
    ],
  },
  {
    id: 's17',
    number: '17',
    heading: 'Free Trials',
    blocks: [
      { type: 'h3', id: 's17-1', text: '17.1 Trial period' },
      { type: 'p', text: 'Eligible new paying users may receive a 14-day trial of the applicable introductory paid plan.' },
      { type: 'p', text: 'The documented introductory trial is Solo, or Local for eligible Nigeria-billed customers.' },
      { type: 'h3', id: 's17-2', text: '17.2 Payment authorization' },
      { type: 'p', text: 'Starting the trial requires an accepted, chargeable payment method.' },
      {
        type: 'p',
        text: 'A nominal card authorization may be performed to verify that the payment method is usable. This is not the subscription charge.',
      },
      { type: 'p', text: "Any temporary authorization hold is subject to the payment processor and issuing bank's handling." },
      { type: 'h3', id: 's17-3', text: '17.3 Trial access' },
      { type: 'p', text: 'During the trial, the Organization receives the applicable trial-plan entitlements.' },
      { type: 'h3', id: 's17-4', text: '17.4 Automatic conversion' },
      {
        type: 'p',
        text:
          'Unless cancelled or otherwise changed before the trial ends, the trial converts to a paid subscription and the first subscription payment becomes due at the disclosed conversion date.',
      },
      {
        type: 'p',
        text: 'The trial conversion terms, amount, and payment schedule must be clearly displayed before the customer authorizes the trial.',
      },
      { type: 'h3', id: 's17-5', text: '17.5 Cancellation during trial' },
      { type: 'p', text: 'You may cancel before the trial ends to prevent the first subscription charge.' },
      { type: 'p', text: 'Cancelling a trial does not require purchasing a paid plan.' },
      { type: 'h3', id: 's17-6', text: '17.6 Trial eligibility' },
      {
        type: 'p',
        text: 'Trial eligibility is limited to one trial per paying user and one trial per Organization, subject to reasonable enforcement controls.',
      },
      { type: 'h3', id: 's17-7', text: '17.7 Enterprise evaluations' },
      {
        type: 'p',
        text: 'Enterprise evaluations may be governed by separately negotiated agreements and do not automatically follow the standard trial process.',
      },
    ],
  },
  {
    id: 's18',
    number: '18',
    heading: 'Billing, Payments, and Taxes',
    blocks: [
      { type: 'h3', id: 's18-1', text: '18.1 Subscription fees' },
      {
        type: 'p',
        text: 'Paid subscription fees are charged according to the selected plan, billing currency, and billing period displayed at checkout.',
      },
      { type: 'h3', id: 's18-2', text: '18.2 Billing intervals' },
      { type: 'p', text: 'Tellann offers monthly and annual subscriptions where available.' },
      {
        type: 'p',
        text: 'Under the documented billing model, monthly cycles renew after 30 days and annual cycles after 365 days, unless an applicable agreement specifies otherwise.',
      },
      { type: 'h3', id: 's18-3', text: '18.3 Automatic renewal' },
      { type: 'p', text: 'Paid subscriptions renew automatically unless cancelled or changed before the applicable renewal date.' },
      {
        type: 'p',
        text: 'The billing interface must disclose the renewal schedule and provide a method for managing or cancelling renewal.',
      },
      { type: 'h3', id: 's18-4', text: '18.4 Payment processing' },
      { type: 'p', text: 'Tellann may use authorized third-party payment processors to collect subscription payments.' },
      { type: 'p', text: 'Supported methods and processors depend on billing currency, payer eligibility, and current processor availability.' },
      { type: 'h3', id: 's18-5', text: '18.5 Payment authorization' },
      {
        type: 'p',
        text:
          'By subscribing, you authorize Tellann and its designated payment processor to charge the disclosed amounts, including authorized renewals and prorated subscription changes, using your selected payment method.',
      },
      { type: 'h3', id: 's18-6', text: '18.6 Currency' },
      { type: 'p', text: 'Charges are made in the billing currency established for your subscription.' },
      { type: 'p', text: 'Currency conversion charges or other charges imposed independently by your bank or payment provider may apply.' },
      { type: 'h3', id: 's18-7', text: '18.7 Taxes' },
      { type: 'p', text: 'Applicable taxes are determined according to relevant tax laws and the disclosed billing arrangements.' },
      {
        type: 'p',
        text: "Tellann's documented pricing policy is to display tax-inclusive subscription prices, with applicable tax components identified on invoices.",
      },
      { type: 'p', text: 'No additional tax or fee will be imposed contrary to the disclosed checkout terms or mandatory law.' },
      { type: 'h3', id: 's18-8', text: '18.8 Invoices' },
      { type: 'p', text: "Tellann makes applicable invoices and payment receipts available through its billing functionality." },
      { type: 'h3', id: 's18-9', text: '18.9 Billing disputes' },
      {
        type: 'p',
        text: 'If you believe a payment was incorrect or unauthorized, you should contact Tellann through the billing support channel with relevant transaction information.',
      },
      { type: 'p', text: 'Nothing in these Terms limits statutory payment-dispute or chargeback rights.' },
    ],
  },
  {
    id: 's19',
    number: '19',
    heading: 'Upgrades, Downgrades, and Overages',
    blocks: [
      { type: 'h3', id: 's19-1', text: '19.1 Upgrades' },
      { type: 'p', text: 'Upgrades to a higher paid plan may take effect immediately.' },
      {
        type: 'p',
        text:
          'Where the change increases the subscription price, the additional amount will be prorated for the unused portion of the billing period and disclosed before the change is authorized.',
      },
      { type: 'h3', id: 's19-2', text: '19.2 Downgrades' },
      { type: 'p', text: 'Scheduled downgrades ordinarily take effect at the next renewal.' },
      { type: 'p', text: 'The Organization may retain existing higher-tier access until the downgrade becomes effective.' },
      { type: 'h3', id: 's19-3', text: '19.3 Downgrade consequences' },
      {
        type: 'p',
        text: 'A downgrade may reduce application limits, seats, retention periods, storage allowances, available report formats, or other entitlements.',
      },
      { type: 'p', text: 'Tellann will provide information or warnings about relevant limits.' },
      {
        type: 'p',
        text:
          'Existing data is not deleted solely because a downgrade event occurs, but data may subsequently become subject to the shorter retention period of the new plan.',
      },
      { type: 'h3', id: 's19-4', text: '19.4 Phase 1 metering' },
      { type: 'p', text: 'During the Behavioral QA & Intent Platform phase, Tellann does not separately charge for:' },
      {
        type: 'ul',
        items: [
          'Individual telemetry events.',
          'Demonstration sessions on paid plans.',
          'Session replay operations.',
          'Behavior graph generation.',
          'Reconciliation operations.',
          'QA report generation or export.',
          'Included assisted intelligence consumption.',
          'Use of the Desktop Agent itself.',
        ],
      },
      { type: 'p', text: 'Applicable application, seat, storage, retention, and other resource entitlements remain enforceable.' },
      { type: 'h3', id: 's19-5', text: '19.5 Future usage-based billing' },
      {
        type: 'p',
        text: "Future production-event billing, AI-consumption billing, or other usage-based charges will not apply merely because such features appear on Tellann's roadmap.",
      },
      { type: 'p', text: 'New charges require appropriate advance disclosure, pricing terms, and authorization consistent with Applicable Law.' },
    ],
  },
  {
    id: 's20',
    number: '20',
    heading: 'Failed Payments and Grace Periods',
    blocks: [
      { type: 'h3', id: 's20-1', text: '20.1 Failed renewal' },
      { type: 'p', text: 'If a subscription renewal payment fails, the Organization enters the documented payment-recovery process.' },
      { type: 'h3', id: 's20-2', text: '20.2 Grace period' },
      { type: 'p', text: 'Tellann provides a seven-day grace period for failed recurring payments under the standard subscription model.' },
      {
        type: 'p',
        text: 'During that period, the Organization retains its existing paid-plan entitlements while payment recovery is attempted.',
      },
      { type: 'h3', id: 's20-3', text: '20.3 Payment retries' },
      {
        type: 'p',
        text: 'Tellann may retry the authorized payment method once per day during the grace period and provide payment failure notifications.',
      },
      { type: 'p', text: 'Updating the payment method may trigger another collection attempt.' },
      { type: 'h3', id: 's20-4', text: '20.4 End of grace period' },
      { type: 'p', text: 'If payment is not recovered by the end of the grace period, the Organization is automatically returned to the Free plan.' },
      { type: 'h3', id: 's20-5', text: '20.5 Data consequences' },
      { type: 'p', text: 'The return to Free does not itself immediately delete existing Customer Data.' },
      {
        type: 'p',
        text:
          'However, Free plan quotas and retention rules begin to apply, and data exceeding the applicable retention window may subsequently be deleted through ordinary retention processing.',
      },
      { type: 'h3', id: 's20-6', text: '20.6 Suspension for cause' },
      { type: 'p', text: 'Payment-related downgrade is separate from suspension imposed for security, abuse, legal, or other contractual reasons.' },
    ],
  },
  {
    id: 's21',
    number: '21',
    heading: 'Cancellation and Refunds',
    blocks: [
      { type: 'h3', id: 's21-1', text: '21.1 Cancellation' },
      { type: 'p', text: 'The designated paying user may cancel an eligible recurring subscription through the available billing interface or authorized support process.' },
      { type: 'h3', id: 's21-2', text: '21.2 Effect of cancellation' },
      {
        type: 'p',
        text:
          'Unless the customer requests an earlier termination that Tellann accepts, or Applicable Law requires otherwise, cancellation stops future renewal and the subscription remains available through the end of the already-paid term.',
      },
      { type: 'p', text: 'After that term, the Organization may continue under the Free plan, subject to its entitlements and retention rules.' },
      { type: 'h3', id: 's21-3', text: '21.3 Trial cancellation' },
      { type: 'p', text: 'A valid cancellation completed before the disclosed trial conversion time prevents the first paid subscription charge.' },
      { type: 'h3', id: 's21-4', text: '21.4 Refund requests' },
      {
        type: 'p',
        text: 'Payment for an already-started subscription period is not automatically refunded solely because the customer cancels renewal or does not use the Services.',
      },
      {
        type: 'p',
        text:
          'Refunds, credits, subscription extensions, or other appropriate remedies may be available for duplicate or unauthorized charges, material service failures, incorrect billing, or other qualifying circumstances.',
      },
      { type: 'p', text: 'Tellann will assess requests reasonably and in accordance with Applicable Law.' },
      { type: 'h3', id: 's21-5', text: '21.5 Mandatory rights' },
      {
        type: 'p',
        text:
          'Nothing in these Terms excludes rights or remedies that cannot lawfully be restricted, including rights concerning materially defective, misrepresented, or undelivered services.',
      },
    ],
  },
  {
    id: 's22',
    number: '22',
    heading: 'Data Retention, Export, and Deletion',
    blocks: [
      { type: 'h3', id: 's22-1', text: '22.1 Retention' },
      {
        type: 'p',
        text: 'Customer Data is retained according to applicable plan limits, published retention rules, and legal or contractual obligations.',
      },
      { type: 'p', text: 'Different categories of data may have different retention requirements where expressly disclosed.' },
      { type: 'h3', id: 's22-2', text: '22.2 Plan changes' },
      { type: 'p', text: "Changes to an Organization's subscription may change the applicable data-retention window." },
      { type: 'p', text: 'Customers should export necessary records before reducing or ending their subscription.' },
      { type: 'h3', id: 's22-3', text: '22.3 Export' },
      { type: 'p', text: 'Authorized users may export supported Customer Data and generated reports in formats made available by their entitlements.' },
      { type: 'p', text: 'Exports remain subject to applicable security, privacy, and access controls.' },
      { type: 'h3', id: 's22-4', text: '22.4 Organization deletion' },
      { type: 'p', text: 'An authorized Organization Owner may request deletion through supported administrative functionality or a verified support process.' },
      { type: 'p', text: 'Tellann may require appropriate identity and authority verification before executing a deletion request.' },
      { type: 'h3', id: 's22-5', text: '22.5 Deletion processing' },
      {
        type: 'p',
        text:
          'Following valid deletion or termination instructions, Tellann will delete or return relevant Customer Data in accordance with applicable retention rules, data-processing agreements, technical deletion schedules, and legal obligations.',
      },
      {
        type: 'p',
        text: 'Limited copies may remain in protected backups or records where lawfully required, subject to restricted access and subsequent deletion.',
      },
      { type: 'h3', id: 's22-6', text: '22.6 Purpose-limited source archives' },
      {
        type: 'p',
        text:
          'Source archives uploaded with express permission for a defined purpose are subject to deletion when that purpose is complete, independently of ordinary subscription retention.',
      },
      { type: 'h3', id: 's22-7', text: '22.7 Local copies' },
      {
        type: 'p',
        text: "Uninstalling the Desktop Agent does not necessarily delete data previously transmitted to the cloud Services.",
      },
      {
        type: 'p',
        text: "Likewise, deleting cloud data does not automatically remove source files or other materials stored in the customer's own workspace.",
      },
    ],
  },
  {
    id: 's23',
    number: '23',
    heading: 'Acceptable Use and Prohibited Activities',
    blocks: [
      { type: 'p', text: 'You must not use Tellann to:' },
      {
        type: 'ol',
        items: [
          'Access or analyze applications, repositories, accounts, or systems without authorization.',
          'Harvest passwords, credentials, authentication tokens, or private information.',
          'Conduct unlawful or undisclosed surveillance.',
          'Intentionally transmit prohibited sensitive data in violation of applicable privacy requirements.',
          'Deploy malicious code, malware, ransomware, or unauthorized persistence mechanisms.',
          "Attack, impair, overload, or circumvent Tellann's services, security, billing, or access controls.",
          'Misrepresent organizational authority, location-based eligibility, or payment identity.',
          'Use the platform to facilitate fraud, unlawful discrimination, or other illegal activities.',
          'Redistribute proprietary Tellann software in violation of applicable license terms.',
          "Interfere with other customers' data, environments, or tenancy boundaries.",
          'Use the platform to perform unauthorized security tests or destructive operations against third-party systems.',
          'Attempt to bypass enforced plan limits or obtain features through deliberately fraudulent means.',
        ],
      },
      {
        type: 'p',
        text: 'Legitimate security research, authorized testing, and lawful software interoperability are not prohibited merely because they involve technical investigation.',
      },
      {
        type: 'p',
        text: "Any testing against Tellann-operated infrastructure must follow Tellann's published vulnerability disclosure or testing authorization policy.",
      },
    ],
  },
  {
    id: 's24',
    number: '24',
    heading: 'Third-Party Services and Integrations',
    blocks: [
      {
        type: 'p',
        text: 'Tellann may interact with third-party frameworks, repositories, identity providers, payment processors, hosting providers, or other technology platforms.',
      },
      { type: 'p', text: 'Use of those services may be governed by separate agreements between the customer and the third-party provider.' },
      { type: 'p', text: 'Tellann does not grant customers rights to third-party software or systems beyond those it is authorized to grant.' },
      {
        type: 'p',
        text: "Tellann remains responsible for its own contractual obligations and for third-party service providers to the extent required by Applicable Law or applicable agreements.",
      },
      {
        type: 'p',
        text: 'The customer is responsible for maintaining any independent subscriptions, licenses, credentials, or permissions required for their connected systems.',
      },
    ],
  },
  {
    id: 's25',
    number: '25',
    heading: 'Enterprise and Self-Hosted Deployments',
    blocks: [
      { type: 'h3', id: 's25-1', text: '25.1 Enterprise agreements' },
      {
        type: 'p',
        text: 'Enterprise subscriptions may be governed by negotiated commercial agreements, order forms, support terms, and Data Processing Agreements.',
      },
      { type: 'h3', id: 's25-2', text: '25.2 Self-hosted deployments' },
      {
        type: 'p',
        text:
          'Where an Enterprise customer elects an authorized self-hosted deployment, the customer ordinarily controls its hosting infrastructure, network environment, local operational security, and deployment configuration.',
      },
      {
        type: 'p',
        text: "Tellann's responsibilities for licensing, updates, support, vulnerabilities, and deployment assistance are established by the applicable enterprise agreement.",
      },
      { type: 'h3', id: 's25-3', text: '25.3 Service levels' },
      {
        type: 'p',
        text:
          'Any binding uptime commitment, service credit, incident response time, or dedicated support obligation is governed by an applicable Service Level Agreement ("SLA") or negotiated contract.',
      },
      { type: 'p', text: "General technical objectives in Tellann's engineering documentation do not independently establish an SLA." },
      { type: 'h3', id: 's25-4', text: '25.4 Conflicting terms' },
      {
        type: 'p',
        text:
          'A mutually executed enterprise agreement or order form takes precedence over these public Terms to the extent of a direct conflict concerning the same subject.',
      },
      { type: 'p', text: 'Mandatory data protection terms and applicable law retain their required priority.' },
    ],
  },
  {
    id: 's26',
    number: '26',
    heading: 'Service Availability, Maintenance, and Changes',
    blocks: [
      { type: 'h3', id: 's26-1', text: '26.1 Availability' },
      { type: 'p', text: 'Tellann will use commercially reasonable efforts to operate and maintain the Services in accordance with applicable commitments.' },
      {
        type: 'p',
        text: 'Temporary interruptions may occur because of maintenance, network failures, security incidents, third-party outages, or other operational circumstances.',
      },
      { type: 'h3', id: 's26-2', text: '26.2 Maintenance' },
      { type: 'p', text: 'Tellann may perform scheduled or emergency maintenance.' },
      { type: 'p', text: 'Reasonable advance notice will be provided for material planned disruptions where practicable.' },
      { type: 'h3', id: 's26-3', text: '26.3 Updates' },
      { type: 'p', text: 'Tellann may update its software, APIs, SDKs, and other functionality.' },
      {
        type: 'p',
        text: 'Changes affecting independently versioned integrations will be managed according to the applicable compatibility and deprecation policies.',
      },
      { type: 'h3', id: 's26-4', text: '26.4 Material service reductions' },
      {
        type: 'p',
        text:
          'Tellann will provide reasonable notice of material reductions or discontinuation of paid functionality, except where immediate action is reasonably required for security, legal compliance, or prevention of harm.',
      },
      { type: 'p', text: 'Applicable remedies will be provided where required by law or contract.' },
      { type: 'h3', id: 's26-5', text: '26.5 Roadmap information' },
      { type: 'p', text: 'Published roadmaps and development plans communicate present intentions, not unconditional commitments.' },
    ],
  },
  {
    id: 's27',
    number: '27',
    heading: 'Suspension and Termination',
    blocks: [
      { type: 'h3', id: 's27-1', text: '27.1 Customer termination' },
      { type: 'p', text: 'Customers may stop using the Services and cancel their subscriptions in accordance with these Terms.' },
      { type: 'h3', id: 's27-2', text: '27.2 Suspension by Tellann' },
      { type: 'p', text: 'Tellann may temporarily restrict or suspend access where reasonably necessary because of:' },
      {
        type: 'ul',
        items: [
          'Material violations of these Terms.',
          'Unauthorized access or credible security threats.',
          'Fraud or payment misuse.',
          'Unlawful activity.',
          'Material risk to other customers or the platform.',
          'Legal or regulatory requirements.',
        ],
      },
      { type: 'p', text: 'Where practicable, Tellann will provide notice and an opportunity to remedy the issue before suspension.' },
      { type: 'h3', id: 's27-3', text: '27.3 Suspension scope' },
      { type: 'p', text: 'Suspension should be proportionate to the relevant risk.' },
      {
        type: 'p',
        text: 'Where safe and legally permissible, affected Organizations may retain restricted access to existing reports and data exports during suspension.',
      },
      { type: 'h3', id: 's27-4', text: '27.4 Termination for material breach' },
      {
        type: 'p',
        text:
          'Either party may terminate the agreement for a material breach that remains unremedied following reasonable notice and an appropriate opportunity to cure, except where immediate termination is legally justified.',
      },
      { type: 'h3', id: 's27-5', text: '27.5 Effect of termination' },
      { type: 'p', text: 'Upon termination, rights to use the terminated Services cease, except for rights expressly surviving termination.' },
      {
        type: 'p',
        text:
          'Accrued payment obligations, applicable confidentiality duties, intellectual property provisions, dispute provisions, and lawful data retention obligations may survive.',
      },
    ],
  },
  {
    id: 's28',
    number: '28',
    heading: 'Disclaimers and Analytical Limitations',
    blocks: [
      { type: 'h3', id: 's28-1', text: '28.1 Nature of the Services' },
      { type: 'p', text: 'Tellann provides software quality analysis and supporting engineering tools.' },
      {
        type: 'p',
        text: "Its results depend on the information available to the system, the customer's configuration, and the completeness of the relevant evidence.",
      },
      { type: 'h3', id: 's28-2', text: '28.2 No guarantee of defect-free software' },
      {
        type: 'p',
        text:
          'Tellann does not guarantee that its use will identify every defect, vulnerability, accessibility issue, regression, performance problem, or unimplemented workflow.',
      },
      { type: 'h3', id: 's28-3', text: '28.3 No certification' },
      {
        type: 'p',
        text:
          "Unless expressly agreed in writing, Tellann's analytical outputs do not constitute an independent security certification, regulatory compliance certification, professional audit opinion, or warranty that a customer application is safe for release.",
      },
      { type: 'h3', id: 's28-4', text: '28.4 Professional judgment' },
      { type: 'p', text: 'Customers remain responsible for engineering decisions, deployment approval, and evaluating software quality.' },
      { type: 'h3', id: 's28-5', text: '28.5 Statutory rights' },
      {
        type: 'p',
        text: 'To the extent permitted by Applicable Law, the Services are provided subject to the express warranties and commitments in the applicable agreement.',
      },
      { type: 'p', text: 'No disclaimer excludes an obligation or remedy that cannot lawfully be excluded.' },
    ],
  },
  {
    id: 's29',
    number: '29',
    heading: 'Limitation of Liability',
    blocks: [
      { type: 'h3', id: 's29-1', text: '29.1 Excluded losses' },
      {
        type: 'p',
        text:
          'To the extent permitted by Applicable Law, neither party will be liable to the other for indirect, incidental, special, or consequential losses, including lost profits or business opportunities, arising from these Terms.',
      },
      {
        type: 'p',
        text:
          'This exclusion applies only to the extent such losses may lawfully be excluded and does not override express commitments or legally protected remedies.',
      },
      { type: 'h3', id: 's29-2', text: '29.2 Aggregate liability' },
      {
        type: 'p',
        text: "Subject to Section 29.3 and any separately agreed enterprise liability provisions, each party's aggregate contractual liability arising from the Services will not exceed the greater of:",
      },
      {
        type: 'ul',
        items: [
          'The subscription fees paid or payable for the affected Organization during the twelve months preceding the event giving rise to the claim; or',
          'USD 100, or its equivalent in the applicable billing currency.',
        ],
      },
      { type: 'h3', id: 's29-3', text: '29.3 Exceptions' },
      {
        type: 'p',
        text:
          'Nothing in these Terms limits or excludes liability for fraud, fraudulent misrepresentation, willful misconduct, or other matters for which exclusion or limitation is prohibited by Applicable Law.',
      },
      {
        type: 'p',
        text: 'Applicable statutory consumer remedies, legally non-excludable data protection obligations, and liabilities arising from intentional misconduct remain unaffected.',
      },
      { type: 'h3', id: 's29-4', text: '29.4 Reasonableness' },
      { type: 'p', text: 'Any limitation is subject to applicable fairness, enforceability, consumer protection, and mandatory legal requirements.' },
    ],
  },
  {
    id: 's30',
    number: '30',
    heading: 'Indemnification',
    blocks: [
      { type: 'h3', id: 's30-1', text: '30.1 Customer indemnification' },
      {
        type: 'p',
        text: 'To the extent permitted by Applicable Law, an Organization agrees to defend and indemnify Tellann against third-party claims directly arising from:',
      },
      {
        type: 'ul',
        items: [
          "The Organization's intentional unlawful use of the Services.",
          'Its infringement of third-party intellectual property rights through materials it supplies.',
          "Its unauthorized monitoring or unlawful collection of third-party data.",
          "Its deliberate violation of third-party system access rights.",
        ],
      },
      {
        type: 'p',
        text:
          "This obligation applies only to the extent the claim is attributable to the Organization's conduct and not to Tellann's breach, negligence, or unlawful acts.",
      },
      { type: 'h3', id: 's30-2', text: '30.2 Claim management' },
      {
        type: 'p',
        text: 'The indemnified party must provide reasonably prompt notice, reasonable cooperation, and an appropriate opportunity for the indemnifying party to manage the defense.',
      },
      { type: 'p', text: 'No settlement may impose a non-monetary obligation or admission of wrongdoing on the indemnified party without its consent.' },
      { type: 'h3', id: 's30-3', text: '30.3 Mandatory protections' },
      { type: 'p', text: 'Indemnification does not remove statutory rights or obligations that cannot legally be excluded or transferred.' },
    ],
  },
  {
    id: 's31',
    number: '31',
    heading: 'Governing Law and Dispute Resolution',
    blocks: [
      { type: 'h3', id: 's31-1', text: '31.1 Governing law' },
      {
        type: 'p',
        text: 'These Terms are governed by the laws of [Confirmed Governing Jurisdiction], excluding conflict-of-laws principles to the extent legally permissible.',
      },
      {
        type: 'p',
        text: "Where Tellann's contracting entity is incorporated and operates in Nigeria, the intended default governing law is Nigerian law.",
      },
      { type: 'h3', id: 's31-2', text: '31.2 Informal dispute resolution' },
      {
        type: 'p',
        text: 'Before commencing formal proceedings, either party may notify the other of a dispute and attempt to resolve it through good-faith discussions.',
      },
      { type: 'p', text: 'The parties should ordinarily allow thirty days for informal resolution, unless urgent relief is required.' },
      { type: 'h3', id: 's31-3', text: '31.3 Court jurisdiction' },
      {
        type: 'p',
        text:
          'Subject to mandatory legal protections and any separately agreed dispute-resolution procedure, proceedings may be brought before courts of competent jurisdiction in [Confirmed Jurisdiction].',
      },
      { type: 'h3', id: 's31-4', text: '31.4 Statutory rights' },
      {
        type: 'p',
        text:
          'Nothing in this section prevents a consumer or data subject from exercising non-waivable rights, contacting an applicable regulator, or bringing proceedings in a forum that Applicable Law requires to remain available.',
      },
    ],
  },
  {
    id: 's32',
    number: '32',
    heading: 'Changes to These Terms',
    blocks: [
      { type: 'h3', id: 's32-1', text: '32.1 Amendments' },
      {
        type: 'p',
        text: 'Tellann may update these Terms to reflect changes in the Services, legal requirements, security practices, or commercial operations.',
      },
      { type: 'h3', id: 's32-2', text: '32.2 Material changes' },
      {
        type: 'p',
        text:
          'We will provide reasonable advance notice of material changes, ordinarily at least thirty days before they become effective, unless an earlier change is reasonably required by law or an urgent security concern.',
      },
      { type: 'h3', id: 's32-3', text: '32.3 Notification methods' },
      { type: 'p', text: 'Notices may be delivered through the Services, email, or another appropriate communication channel associated with the Account.' },
      { type: 'h3', id: 's32-4', text: '32.4 Acceptance of revised terms' },
      { type: 'p', text: 'Where legally required or where material contractual changes call for renewed agreement, Tellann will obtain the appropriate acceptance.' },
      {
        type: 'p',
        text:
          'If you do not agree with materially revised terms, you may discontinue the affected Services or cancel renewal, subject to applicable contractual and statutory rights.',
      },
      { type: 'h3', id: 's32-5', text: '32.5 Previous versions' },
      { type: 'p', text: 'Tellann may maintain previous versions and revision histories of the Terms for reference and auditability.' },
    ],
  },
  {
    id: 's33',
    number: '33',
    heading: 'General Legal Provisions',
    blocks: [
      { type: 'h3', id: 's33-1', text: '33.1 Entire agreement' },
      {
        type: 'p',
        text: 'These Terms, together with any applicable accepted order form, DPA, product-specific conditions, and other incorporated agreements, constitute the agreement regarding the relevant Services.',
      },
      { type: 'h3', id: 's33-2', text: '33.2 Order of precedence' },
      {
        type: 'p',
        text: 'Where agreements conflict, the applicable executed enterprise agreement or order form controls its expressly negotiated subject matter.',
      },
      { type: 'p', text: 'An applicable DPA governs conflicting provisions concerning personal-data processing.' },
      { type: 'p', text: 'Mandatory international data-transfer clauses and Applicable Law prevail where required.' },
      { type: 'h3', id: 's33-3', text: '33.3 Severability' },
      { type: 'p', text: 'If a provision is found unenforceable, the remaining provisions remain effective to the extent legally possible.' },
      { type: 'h3', id: 's33-4', text: '33.4 No waiver' },
      { type: 'p', text: 'Failure to enforce a provision on one occasion does not waive the right to enforce it later.' },
      { type: 'h3', id: 's33-5', text: '33.5 Assignment' },
      {
        type: 'p',
        text:
          "Neither party may assign the agreement in a way that materially prejudices the other party's rights without required authorization, except for a lawful corporate restructuring or business transfer subject to appropriate continuity and notice safeguards.",
      },
      { type: 'h3', id: 's33-6', text: '33.6 Independent parties' },
      { type: 'p', text: 'The parties are independent contractors. These Terms do not create an employment, agency, partnership, or joint venture relationship.' },
      { type: 'h3', id: 's33-7', text: '33.7 Force majeure' },
      {
        type: 'p',
        text:
          'Neither party is responsible for failure or delay caused by circumstances beyond its reasonable control, excluding payment obligations already due and subject to Applicable Law.',
      },
      { type: 'p', text: 'The affected party must take reasonable steps to mitigate the impact.' },
      { type: 'h3', id: 's33-8', text: '33.8 Electronic agreements' },
      { type: 'p', text: 'These Terms may be accepted electronically using an authorized online acceptance mechanism.' },
      { type: 'h3', id: 's33-9', text: '33.9 Survival' },
      {
        type: 'p',
        text:
          'Provisions concerning confidentiality, intellectual property, accrued obligations, permitted retention, disputes, and other matters intended to survive will remain effective after termination to the extent necessary.',
      },
    ],
  },
  {
    id: 's34',
    number: '34',
    heading: 'Contact Information',
    blocks: [
      { type: 'p', text: 'For questions about these Terms, your subscription, or your contractual rights, contact:' },
      { type: 'p', text: '**Tellann**' },
      { type: 'p', text: 'Legal Entity: [Full Registered Legal Name]' },
      { type: 'p', text: 'Registration Number: [Company Registration Number]' },
      { type: 'p', text: 'Registered Address: [Registered Business Address]' },
      { type: 'p', text: 'General Contact: [Verified Contact Email]' },
      { type: 'p', text: 'Legal Contact: [Verified Legal Email]' },
      { type: 'p', text: 'Privacy Contact: [Verified Privacy Email]' },
      { type: 'p', text: 'Website: https://tellann.co' },
      { type: 'p', text: 'For product support, please use the official support channel identified within the Tellann platform or website.' },
    ],
  },
];
