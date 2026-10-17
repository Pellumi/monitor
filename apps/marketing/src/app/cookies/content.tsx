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
        <span key={index} className="cookies-tbd" title="To be confirmed before publication">
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
            <table key={index} className="cookies-inline-table">
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
    text: 'At Tellann, we believe that understanding how digital services operate should not require unnecessary or undisclosed tracking.',
  },
  {
    type: 'p',
    text:
      'This Cookie Policy explains how Tellann ("Tellann," "we," "us," or "our") uses cookies, browser storage, and similar technologies in connection with our websites, applications, and related services.',
  },
  {
    type: 'p',
    text:
      'It describes the purposes of these technologies, the information they may process, the choices available to you, and how our practices relate to our broader Privacy Policy.',
  },
  {
    type: 'p',
    text:
      'Some technologies are necessary to provide the services you request, maintain security, and keep your account functioning. Others may support preferences, performance measurement, analytics, or marketing where enabled and legally permitted.',
  },
  { type: 'p', text: 'We seek to provide clear information and meaningful choices concerning technologies that are not strictly necessary.' },
  { type: 'p', text: 'Please read this Policy together with our Privacy Policy and Terms of Service.' },
];

export const sections: LegalSection[] = [
  {
    id: 's1',
    number: '1',
    heading: 'What Are Cookies?',
    blocks: [
      { type: 'p', text: 'Cookies are small pieces of information that a website can ask your browser to store on your device.' },
      {
        type: 'p',
        text: 'They may be sent back to the relevant website during subsequent requests, allowing the website to recognize a session, retain certain settings, or perform other functions.',
      },
      { type: 'p', text: 'Cookies may be used to:' },
      {
        type: 'ul',
        items: [
          'Maintain authenticated sessions.',
          'Provide security and protect against abuse.',
          'Remember appropriate user preferences.',
          'Support application functionality.',
          'Measure website performance.',
          'Understand permitted website usage.',
          'Support advertising or campaign measurement where enabled and authorized.',
        ],
      },
      {
        type: 'p',
        text:
          'Cookies are not inherently harmful, but their privacy implications depend on the information collected, how that information is combined, who receives it, and the purposes for which it is used.',
      },
    ],
  },
  {
    id: 's2',
    number: '2',
    heading: 'What Are Similar Technologies?',
    blocks: [
      {
        type: 'p',
        text: 'In addition to traditional HTTP cookies, websites and applications may use other mechanisms to store information on a device or retrieve information from it.',
      },
      { type: 'p', text: 'These can include:' },
      {
        type: 'ul',
        items: [
          '**Local storage:** Browser storage that can retain information beyond a single page load.',
          '**Session storage:** Browser storage generally associated with a particular browsing session or tab.',
          '**IndexedDB:** Structured browser-side storage that applications can use to retain larger datasets.',
          '**Cache Storage:** Browser storage that may be used by service workers to retain website or application resources.',
          '**Web beacons and tracking pixels:** Resources that may communicate information when a page or message is opened.',
          '**Device identifiers and fingerprinting:** Methods that may use device, browser, or environmental characteristics to recognize or distinguish devices.',
          '**Software development kit storage:** Storage used by embedded application libraries to maintain local state, queues, or session context.',
          '**Push subscription records:** Browser-managed subscription information used to deliver notifications after the necessary permission is granted.',
          '**Other device-access mechanisms:** Technologies that read information stored on a device for a defined purpose.',
        ],
      },
      { type: 'p', text: 'Not every technology listed above is necessarily deployed by Tellann.' },
      { type: 'p', text: 'This Policy describes the categories relevant to our platform and requires the accompanying technology inventory to identify the mechanisms actually in use.' },
    ],
  },
  {
    id: 's3',
    number: '3',
    heading: 'Where This Policy Applies',
    blocks: [
      { type: 'p', text: 'This Policy applies to storage and access technologies used directly by Tellann or by authorized service providers through Tellann-controlled services.' },
      { type: 'p', text: 'These may include:' },
      { type: 'h3', id: 's3-1', text: '3.1 Public marketing website' },
      { type: 'p', text: "Pages explaining Tellann's products, pricing, company, documentation, resources, and legal policies." },
      { type: 'h3', id: 's3-2', text: '3.2 Authenticated dashboard' },
      { type: 'p', text: 'The browser-based application used to manage organizations, applications, workflows, reports, billing, and other supported capabilities.' },
      { type: 'h3', id: 's3-3', text: '3.3 Authentication interfaces' },
      { type: 'p', text: 'Pages or flows used for login, verification, account recovery, multi-factor authentication, or federated identity.' },
      { type: 'h3', id: 's3-4', text: '3.4 Billing and checkout' },
      { type: 'p', text: 'Subscription and payment interfaces, including integrations with authorized payment processors.' },
      { type: 'h3', id: 's3-5', text: '3.5 Documentation and related web applications' },
      { type: 'p', text: "Technical documentation, SDK instructions, developer resources, and other Tellann-controlled web experiences." },
      { type: 'h3', id: 's3-6', text: '3.6 Customer applications using Tellann integrations' },
      {
        type: 'p',
        text: "Applications operated by customers that use Tellann's SDKs may have their own browser storage and telemetry collection arrangements.",
      },
      { type: 'p', text: "The customer's application operator generally determines the purposes and legal basis for processing data from that application's users." },
      { type: 'h3', id: 's3-7', text: '3.7 Managed demonstration environments' },
      { type: 'p', text: "Tellann's Desktop Agent may operate a managed browser to demonstrate customer application workflows." },
      { type: 'p', text: "Cookies belonging to the demonstrated application are distinct from cookies belonging to Tellann's own websites." },
    ],
  },
  {
    id: 's4',
    number: '4',
    heading: 'Types of Cookies and Technologies',
    blocks: [
      { type: 'p', text: 'We classify relevant technologies according to their actual purposes.' },
      { type: 'h3', id: 's4-1', text: '4.1 Strictly necessary technologies' },
      { type: 'p', text: 'Strictly necessary technologies enable functions that are essential to delivering a requested service or maintaining necessary security.' },
      { type: 'p', text: 'Depending on the deployed architecture, they may support:' },
      {
        type: 'ul',
        items: [
          'Authentication and session continuity.',
          'Secure access to organizational resources.',
          'Login and account security.',
          'Protection against request forgery.',
          'Security and abuse prevention.',
          'Load balancing and service continuity.',
          'Remembering cookie consent decisions.',
          'Other functions strictly necessary to deliver a service requested by the user.',
        ],
      },
      { type: 'p', text: 'Where a technology qualifies for a lawful exemption from consent, it may operate without optional tracking consent.' },
      { type: 'p', text: 'Such classification depends on the actual purpose and applicable law, not simply on how we label the technology.' },
      { type: 'h3', id: 's4-2', text: '4.2 Functional and preference technologies' },
      { type: 'p', text: 'Functional technologies may remember settings such as:' },
      {
        type: 'ul',
        items: ['Appearance and theme preferences.', 'Language selections.', 'Interface display choices.', 'Certain accessibility preferences.', 'Other user-selected settings.'],
      },
      { type: 'p', text: 'Where such storage is necessary to deliver a specific preference requested by the user, an applicable legal exception may permit its use.' },
      { type: 'p', text: 'Where the storage extends beyond that purpose or is not exempt, we obtain the necessary consent.' },
      { type: 'h3', id: 's4-3', text: '4.3 Analytics technologies' },
      { type: 'p', text: 'Where deployed, analytics technologies may help us understand:' },
      {
        type: 'ul',
        items: [
          'Which pages receive visits.',
          'How visitors navigate our website.',
          'Website loading and performance.',
          'How visitors find our content.',
          'Aggregate interactions with public pages.',
          'Technical issues affecting user experience.',
          'Whether website content is useful.',
        ],
      },
      { type: 'p', text: 'Depending on the tool and configuration, analytics may involve browser identifiers, storage, request metadata, or third-party processing.' },
      { type: 'p', text: 'Analytics technologies are enabled only where an applicable consent or exemption permits their use.' },
      { type: 'h3', id: 's4-4', text: '4.4 Performance and diagnostic technologies' },
      { type: 'p', text: 'Performance and diagnostic mechanisms may help identify:' },
      {
        type: 'ul',
        items: ['Failed requests.', 'Client-side errors.', 'Slow page rendering.', 'Browser compatibility problems.', 'Unavailable services.', 'Other technical failures.'],
      },
      { type: 'p', text: 'Some diagnostic activity may be necessary for service security or operation.' },
      { type: 'p', text: 'Other diagnostic or user-measurement technologies may require consent or another applicable legal exception.' },
      { type: 'p', text: 'We assess these mechanisms according to their actual purposes and the information they access.' },
      { type: 'h3', id: 's4-5', text: '4.5 Marketing and advertising technologies' },
      { type: 'p', text: 'If Tellann enables marketing or advertising technologies, they may support:' },
      {
        type: 'ul',
        items: [
          'Campaign performance measurement.',
          'Advertising attribution.',
          'Conversion tracking.',
          'Audience measurement.',
          'Remarketing.',
          'Advertising personalization.',
          'Tracking across websites or services.',
        ],
      },
      { type: 'p', text: 'These technologies are not automatically necessary for operating Tellann.' },
      { type: 'p', text: 'Where required, they will remain inactive until valid consent is obtained.' },
      {
        type: 'p',
        text: 'We do not treat acceptance of our Terms of Service, ordinary website navigation, or the creation of an account as blanket consent to advertising tracking.',
      },
      { type: 'h3', id: 's4-6', text: '4.6 Third-party embedded content' },
      { type: 'p', text: 'Some pages may include content supplied by external platforms, such as:' },
      { type: 'ul', items: ['Videos.', 'Embedded documentation.', 'Interactive demonstrations.', 'Social media content.', 'External support or communication widgets.'] },
      { type: 'p', text: 'Such providers may use their own cookies or similar technologies.' },
      { type: 'p', text: 'Where an embedded feature requires non-essential device access, it will be subject to the applicable consent requirements.' },
      { type: 'p', text: 'We may instead display a placeholder or require a user action before loading the external content.' },
    ],
  },
  {
    id: 's5',
    number: '5',
    heading: 'First-Party and Third-Party Cookies',
    blocks: [
      { type: 'h3', id: 's5-1', text: '5.1 First-party cookies' },
      { type: 'p', text: 'First-party cookies are associated with the website or domain the user is visiting.' },
      { type: 'p', text: 'Tellann-controlled applications may use first-party storage for authorized service functions.' },
      { type: 'p', text: 'First-party status alone does not make a cookie exempt from consent requirements.' },
      { type: 'h3', id: 's5-2', text: '5.2 Third-party cookies' },
      { type: 'p', text: 'Third-party cookies are associated with a domain or provider different from the website being visited.' },
      { type: 'p', text: 'They may be introduced through embedded services, external authentication, payment interfaces, analytics, or advertising technologies.' },
      {
        type: 'p',
        text: 'Whether a third party can store or access information depends on the provider, browser behavior, technical integration, and applicable permissions.',
      },
      { type: 'h3', id: 's5-3', text: '5.3 Third-party accountability' },
      {
        type: 'p',
        text: 'Where Tellann intentionally enables an external technology through its services, we assess its purposes, information-sharing arrangements, and relevant legal requirements.',
      },
      { type: 'p', text: 'The actual providers used must be identified in the published cookie inventory or linked processing disclosures.' },
    ],
  },
  {
    id: 's6',
    number: '6',
    heading: 'Session Cookies and Persistent Cookies',
    blocks: [
      { type: 'h3', id: 's6-1', text: '6.1 Session cookies' },
      { type: 'p', text: 'Session cookies are generally temporary and are designed to support activity during a browsing session.' },
      { type: 'p', text: 'Their practical lifetime depends on browser behavior and the configuration of the relevant service.' },
      { type: 'h3', id: 's6-2', text: '6.2 Persistent cookies' },
      { type: 'p', text: 'Persistent cookies remain available beyond a single browsing session until their configured expiration or deletion.' },
      { type: 'p', text: 'They may support appropriate preference retention, permitted analytics, or other disclosed purposes.' },
      { type: 'h3', id: 's6-3', text: '6.3 Duration' },
      { type: 'p', text: 'Each deployed cookie must have a defined purpose and an appropriate lifespan.' },
      { type: 'p', text: 'Expiration periods must not be longer than necessary for the relevant purpose and applicable legal requirements.' },
      { type: 'p', text: "The exact duration of each cookie or persistent storage item is documented in Tellann's current technology inventory." },
    ],
  },
  {
    id: 's7',
    number: '7',
    heading: 'Authentication and Account Security',
    blocks: [
      { type: 'p', text: 'Tellann uses authentication and authorization mechanisms to protect user accounts and organizations.' },
      { type: 'p', text: 'Depending on the deployed authentication architecture, browser-based session management may involve:' },
      {
        type: 'ul',
        items: ['Cookies.', 'Bearer access tokens.', 'Refresh-session mechanisms.', 'Temporary verification state.', 'Other secure session mechanisms.'],
      },
      { type: 'p', text: 'We do not assume that a particular authentication value is stored in a cookie unless the deployed system actually uses that arrangement.' },
      { type: 'p', text: 'Authentication-related storage is intended to support functions such as:' },
      {
        type: 'ul',
        items: [
          'Signing in.',
          'Maintaining an authorized session.',
          'Confirming session validity.',
          'Protecting accounts against unauthorized use.',
          'Supporting logout and session revocation.',
          'Maintaining appropriate authentication continuity.',
        ],
      },
      { type: 'p', text: 'Authentication technologies must be configured with safeguards appropriate to the risks of their use.' },
      { type: 'p', text: 'Disabling technologies essential for authentication may prevent successful login or other protected functionality.' },
    ],
  },
  {
    id: 's8',
    number: '8',
    heading: 'Organizational Workspaces and Dashboard Preferences',
    blocks: [
      { type: 'p', text: 'Tellann supports organization-based access to application intelligence and administrative functionality.' },
      { type: 'p', text: 'Depending on the implemented features, browser storage may help preserve:' },
      { type: 'ul', items: ['Appropriate interface preferences.', 'Selected appearance settings.', 'Temporary navigation state.', 'Other user-requested interface behavior.'] },
      {
        type: 'p',
        text: 'Organization membership, billing entitlements, and authoritative access permissions are enforced by the platform and must not depend solely on browser-stored values.',
      },
      { type: 'p', text: 'Browser preferences must not grant unauthorized access or override server-side permission decisions.' },
    ],
  },
  {
    id: 's9',
    number: '9',
    heading: 'Website Analytics and Product Measurement',
    blocks: [
      { type: 'p', text: 'Tellann may evaluate the use and performance of its own websites and services for legitimate operational or business purposes.' },
      { type: 'p', text: 'Website analytics and product telemetry are distinct activities.' },
      { type: 'p', text: 'For example:' },
      {
        type: 'ul',
        items: [
          "Measuring visits to the Tellann pricing page concerns the Tellann website.",
          "Recording a customer's demonstrated checkout workflow concerns the customer's application.",
          'Measuring a completed QA report-generation task concerns Tellann platform operation.',
        ],
      },
      { type: 'p', text: 'These activities may involve different information, technical mechanisms, responsible organizations, and legal bases.' },
      {
        type: 'p',
        text: 'The fact that Tellann offers behavioral analysis tools does not mean that all visitors to the Tellann marketing website are automatically subjected to customer-style session replay.',
      },
      { type: 'p', text: 'Optional browser-based analytics and tracking remain subject to the applicable consent or exemption requirements.' },
    ],
  },
  {
    id: 's10',
    number: '10',
    heading: 'Tellann SDKs and Customer Application Cookies',
    blocks: [
      { type: 'p', text: 'Tellann provides SDKs designed to collect supported application behavior and technical events.' },
      { type: 'p', text: 'These integrations may record information such as:' },
      {
        type: 'ul',
        items: [
          'Navigation events.',
          'Application state transitions.',
          'UI interaction events.',
          'Workflow boundaries.',
          'Session identifiers.',
          'API timing and response metadata.',
          'Error events.',
        ],
      },
      { type: 'h3', id: 's10-1', text: '10.1 Distinction between events and cookies' },
      { type: 'p', text: 'Behavioral events are not inherently cookies.' },
      { type: 'p', text: 'An event can be transmitted without using an HTTP cookie, while an SDK may separately use browser storage to maintain session context or buffer events.' },
      { type: 'p', text: 'The exact storage behavior depends on the SDK version and configuration.' },
      { type: 'h3', id: 's10-2', text: '10.2 Customer control' },
      { type: 'p', text: 'The organization operating the instrumented application generally determines why the application is being analyzed and what lawful notices or permissions are required.' },
      { type: 'h3', id: 's10-3', text: '10.3 Storage and identifier disclosures' },
      { type: 'p', text: "Where a Tellann SDK stores identifiers or other information in a user's browser, the integration documentation must explain:" },
      {
        type: 'ul',
        items: [
          'The storage mechanism.',
          'The data stored.',
          'Its purpose.',
          'Its lifespan.',
          'Whether it is essential or optional.',
          'The responsible controller.',
          'Applicable consent requirements.',
        ],
      },
      { type: 'h3', id: 's10-4', text: '10.4 Consent enforcement' },
      { type: 'p', text: 'Customers must configure their applications to comply with applicable privacy and device-access requirements.' },
      {
        type: 'p',
        text: "Where lawful consent is required for an SDK's storage or collection behavior, integration must not cause the relevant optional processing to begin before the necessary authorization.",
      },
      { type: 'h3', id: 's10-5', text: '10.5 Customer privacy notices' },
      { type: 'p', text: "The customer's own privacy and cookie notices generally govern observation of the customer's application users." },
      { type: 'p', text: "Tellann's public Cookie Policy does not replace those notices." },
    ],
  },
  {
    id: 's11',
    number: '11',
    heading: 'Session Replay and Demonstration Sessions',
    blocks: [
      { type: 'p', text: 'Tellann provides telemetry-based session reconstruction for supported application demonstrations.' },
      { type: 'h3', id: 's11-1', text: '11.1 Session identification' },
      { type: 'p', text: 'A demonstration may use technical identifiers to associate events with a particular application, environment, session, or QA run.' },
      { type: 'h3', id: 's11-2', text: '11.2 Replay behavior' },
      { type: 'p', text: 'Session Replay reconstructs a timeline from available application events.' },
      { type: 'p', text: "It is not necessarily a video or pixel-accurate recording of a user's entire screen." },
      { type: 'h3', id: 's11-3', text: '11.3 Restricted values' },
      { type: 'p', text: "Tellann's telemetry collection rules exclude protected values such as authentication secrets, payment credentials, and other restricted information." },
      { type: 'h3', id: 's11-4', text: '11.4 Application cookies' },
      { type: 'p', text: 'A managed browser may receive cookies from the application being demonstrated.' },
      { type: 'p', text: "Those cookies can be necessary for the customer's application to authenticate users or execute workflows." },
      { type: 'p', text: "Their existence does not mean those cookie values should be included in Tellann's recorded telemetry." },
      { type: 'h3', id: 's11-5', text: '11.5 Customer responsibility' },
      { type: 'p', text: 'The customer remains responsible for determining whether its application requires notices, consent, or other safeguards before user behavior is collected or demonstrated.' },
    ],
  },
  {
    id: 's12',
    number: '12',
    heading: 'Desktop Agent and Device Storage',
    blocks: [
      { type: 'p', text: 'The Tellann Desktop Agent is a locally installed application used to support source-code analysis, instrumentation, and managed browser demonstrations.' },
      { type: 'p', text: "It is distinct from the Tellann marketing website and browser dashboard." },
      { type: 'h3', id: 's12-1', text: '12.1 Device-bound credentials' },
      {
        type: 'p',
        text: 'The Desktop Agent is designed to hold platform device-session credentials and applicable run credentials using operating-system-protected storage.',
      },
      { type: 'p', text: 'These credentials are not ordinary website analytics cookies.' },
      { type: 'h3', id: 's12-2', text: '12.2 Workspace information' },
      {
        type: 'p',
        text: "Workspace paths, repository information, code-derived analysis, and locally stored configuration are governed by Tellann's desktop security and privacy requirements.",
      },
      { type: 'h3', id: 's12-3', text: '12.3 Locally buffered evidence' },
      { type: 'p', text: 'Supported SDKs and local components may buffer events or evidence to manage temporary connectivity interruptions.' },
      { type: 'p', text: 'Such buffering is not automatically equivalent to a tracking cookie.' },
      { type: 'h3', id: 's12-4', text: '12.4 System browser authorization' },
      { type: 'p', text: "The Desktop Agent uses the user's system browser for platform authorization." },
      { type: 'p', text: 'Cookies or other authentication technologies used during this process are governed by the applicable Tellann authentication service and its disclosed storage practices.' },
      { type: 'h3', id: 's12-5', text: '12.5 Managed browser context' },
      {
        type: 'p',
        text: "A customer application's cookies and local storage within a managed demonstration browser belong to that application's execution context and must not be confused with Tellann's marketing analytics.",
      },
    ],
  },
  {
    id: 's13',
    number: '13',
    heading: 'Payment Processors and Checkout',
    blocks: [
      { type: 'p', text: "Tellann's documented payment integrations include Paystack and Flutterwave, subject to the selected currency and available processor." },
      { type: 'p', text: 'When a customer proceeds to checkout, an authorized payment provider may use cookies or other technologies for:' },
      {
        type: 'ul',
        items: ['Payment authentication.', 'Fraud prevention.', 'Transaction security.', 'Maintaining checkout state.', 'Payment processing.', "Other purposes disclosed by the payment provider."],
      },
      { type: 'p', text: "The technology used depends on the live integration and the provider's practices." },
      { type: 'p', text: 'Payment-provider cookies are not automatically classified as Tellann advertising or analytics cookies.' },
      {
        type: 'p',
        text: 'Where a payment provider sets non-essential technologies through a Tellann-controlled integration, applicable transparency and consent requirements must still be satisfied.',
      },
      { type: 'p', text: "Customers may consult the relevant payment provider's privacy and cookie information for additional details." },
    ],
  },
  {
    id: 's14',
    number: '14',
    heading: 'Notifications and Push Services',
    blocks: [
      { type: 'p', text: 'Tellann may support in-app, web push, email, and desktop notifications.' },
      { type: 'h3', id: 's14-1', text: '14.1 Web push' },
      { type: 'p', text: 'Web push requires a supported browser and the necessary notification permission.' },
      { type: 'p', text: 'Push functionality may involve a browser-managed subscription endpoint, related cryptographic information, and notification preferences.' },
      { type: 'p', text: 'These are not inherently cookies, although related application storage may be used.' },
      { type: 'h3', id: 's14-2', text: '14.2 Desktop notifications' },
      { type: 'p', text: 'Desktop notifications are handled through the installed application and operating-system notification facilities, subject to supported configuration.' },
      { type: 'h3', id: 's14-3', text: '14.3 Email tracking' },
      {
        type: 'p',
        text: 'If Tellann uses email-open pixels, tracked links, or comparable technologies, those mechanisms must be assessed and disclosed according to their purpose and applicable law.',
      },
      { type: 'p', text: 'Transactional email delivery does not, by itself, authorize unrelated marketing tracking.' },
      { type: 'h3', id: 's14-4', text: '14.4 Preferences' },
      { type: 'p', text: 'Users may manage optional communication preferences through supported settings.' },
      { type: 'p', text: 'Browser or operating-system notification permissions can also be changed through the relevant device controls.' },
    ],
  },
  {
    id: 's15',
    number: '15',
    heading: 'Information Processed Through Cookies and Similar Technologies',
    blocks: [
      { type: 'p', text: 'Depending on the purpose and deployed technology, information accessed or collected may include:' },
      {
        type: 'ul',
        items: [
          'Random session or preference identifiers.',
          'Consent choices.',
          'Browser and device characteristics.',
          'Relevant authentication state.',
          'Page or route information.',
          'Website interaction events.',
          'Referral and campaign parameters.',
          'Timing and performance measurements.',
          'Relevant security indicators.',
          'Approximate network-derived location, where used.',
          'Other data specifically disclosed in the current technology inventory.',
        ],
      },
      { type: 'p', text: 'Some information may constitute personal data when it identifies or can reasonably be linked to an individual.' },
      { type: 'p', text: 'We assess such processing under applicable data protection law and our Privacy Policy.' },
    ],
  },
  {
    id: 's16',
    number: '16',
    heading: 'Our Legal Approach to Cookies',
    blocks: [
      { type: 'p', text: 'Tellann operates with users and customers in potentially different jurisdictions.' },
      {
        type: 'p',
        text: "Applicable cookie and device-access requirements depend on the circumstances, including the website operator, users' locations, purposes, and technology.",
      },
      { type: 'h3', id: 's16-1', text: '16.1 Necessary technologies' },
      { type: 'p', text: 'Technologies genuinely necessary for requested services or qualifying security functions may operate without separate cookie consent where an applicable legal exception permits this.' },
      { type: 'h3', id: 's16-2', text: '16.2 Optional technologies' },
      { type: 'p', text: 'Where consent is required, optional storage and access will not begin until valid consent is obtained.' },
      { type: 'h3', id: 's16-3', text: '16.3 Specific purposes' },
      { type: 'p', text: "A user's consent to analytics does not automatically authorize advertising personalization or unrelated third-party tracking." },
      { type: 'h3', id: 's16-4', text: '16.4 Valid consent' },
      { type: 'p', text: 'Where consent is required, it must be freely given, appropriately informed, specific to the relevant purposes, and expressed through a valid affirmative action.' },
      { type: 'h3', id: 's16-5', text: '16.5 Consent withdrawal' },
      { type: 'p', text: 'Users must be able to withdraw consent through accessible controls.' },
      { type: 'p', text: 'Withdrawal stops future processing dependent on that consent, subject to the technical and legal scope of the request.' },
      { type: 'h3', id: 's16-6', text: '16.6 Legal exceptions' },
      { type: 'p', text: 'Certain jurisdictions provide limited exceptions for particular statistical or user-interface preference technologies.' },
      {
        type: 'p',
        text: 'Tellann will rely on an exception only where the particular implementation satisfies its conditions, including applicable information and objection requirements.',
      },
    ],
  },
  {
    id: 's17',
    number: '17',
    heading: 'Managing Your Cookie Preferences',
    blocks: [
      { type: 'p', text: 'Where Tellann uses optional cookies or similar technologies, visitors can manage the applicable purposes through our cookie preference controls.' },
      { type: 'p', text: 'Available choices should include:' },
      {
        type: 'ul',
        items: [
          'Accepting eligible optional technologies.',
          'Rejecting technologies that require consent.',
          'Reviewing individual purpose categories.',
          'Saving customized preferences.',
          'Revisiting and changing previous choices.',
          'Withdrawing consent for applicable purposes.',
        ],
      },
      { type: 'p', text: 'Strictly necessary technologies may remain enabled where they qualify for an applicable legal exception.' },
      { type: 'p', text: 'Where we rely on a lawful exception that requires an objection mechanism, the relevant objection control will also be provided.' },
      { type: 'p', text: 'The preference interface must accurately reflect the current deployed technologies and their purposes.' },
    ],
  },
  {
    id: 's18',
    number: '18',
    heading: 'Withdrawing Consent',
    blocks: [
      { type: 'p', text: "You may withdraw consent for applicable optional technologies through Tellann's cookie preference controls." },
      { type: 'p', text: 'Withdrawal should be effective for future optional storage and access without unnecessary obstacles.' },
      { type: 'p', text: 'Following withdrawal, Tellann should:' },
      {
        type: 'ol',
        items: [
          'Stop the affected optional technologies from executing.',
          'Prevent further optional tracking events dependent on the withdrawn permission.',
          'Remove accessible non-essential identifiers where technically appropriate.',
          'Update the recorded preference.',
          'Apply the new preference to relevant Tellann-controlled services where supported.',
        ],
      },
      { type: 'p', text: 'Withdrawing consent does not automatically delete every historical record already lawfully processed.' },
      { type: 'p', text: 'Requests concerning previously collected personal data are handled under the Privacy Policy and applicable data protection rights.' },
    ],
  },
  {
    id: 's19',
    number: '19',
    heading: 'Browser and Device Controls',
    blocks: [
      { type: 'p', text: 'Most browsers provide settings for viewing, deleting, or restricting cookies and other stored site data.' },
      { type: 'p', text: 'Depending on the browser, you may be able to:' },
      {
        type: 'ul',
        items: [
          'Delete cookies.',
          'Clear local or session storage.',
          'Remove website data.',
          'Restrict third-party cookies.',
          'Block selected storage mechanisms.',
          'Manage notification permissions.',
          'Control website permissions and privacy protections.',
        ],
      },
      { type: 'p', text: "These settings operate independently of Tellann's own preference management." },
      { type: 'p', text: 'Deleting necessary session information may sign you out or interrupt certain features.' },
      { type: 'p', text: 'Blocking essential functionality may prevent authentication, payment, or other requested services from operating correctly.' },
      { type: 'p', text: 'Browser settings should not be treated as a substitute for collecting consent where Tellann has a separate obligation to obtain it.' },
    ],
  },
  {
    id: 's20',
    number: '20',
    heading: 'Retention and Expiration',
    blocks: [
      { type: 'p', text: 'Cookies and similar technologies may have different storage lifetimes.' },
      { type: 'p', text: 'These depend on:' },
      {
        type: 'ul',
        items: ['The specific technology.', 'Its purpose.', 'Whether it is session-based or persistent.', 'Browser behavior.', 'Security and operational needs.', 'User preferences.', 'Applicable legal requirements.'],
      },
      { type: 'p', text: 'The active cookie inventory identifies the duration of each deployed item.' },
      { type: 'p', text: 'Where consent is recorded, the consent record may be retained for an appropriate accountability period separate from the expiration of the browser-stored preference.' },
      { type: 'p', text: 'Deleting a cookie does not necessarily delete corresponding server-side records.' },
      { type: 'p', text: "Data retained by Tellann's account, billing, security, or behavioral-analysis systems follows the applicable Privacy Policy, retention schedule, and contractual requirements." },
    ],
  },
  {
    id: 's21',
    number: '21',
    heading: 'Third-Party Technologies and Providers',
    blocks: [
      { type: 'p', text: 'Where Tellann uses third-party storage or tracking technologies, the relevant providers will be identified in the technology inventory.' },
      { type: 'p', text: 'The inventory will specify:' },
      {
        type: 'ul',
        items: [
          'Provider or responsible party.',
          'Technology or cookie name.',
          'Domain or storage scope.',
          'Purpose.',
          'Data categories processed.',
          'Retention or expiration.',
          'Applicable consent category.',
          'Relevant provider privacy information.',
        ],
      },
      {
        type: 'p',
        text: "The inclusion of a provider in Tellann's payment, hosting, or software architecture does not by itself establish that the provider sets browser cookies.",
      },
      { type: 'p', text: 'Only verified, deployed technologies are listed as active.' },
    ],
  },
  {
    id: 's22',
    number: '22',
    heading: 'Data Transfers and Disclosure',
    blocks: [
      { type: 'p', text: 'Cookie-related information may be processed by Tellann or approved service providers as necessary for the specified purpose.' },
      { type: 'p', text: 'Where such processing involves personal data, applicable privacy, security, confidentiality, and international transfer requirements apply.' },
      { type: 'p', text: 'We do not authorize unrelated reuse of customer information merely because a service provider is involved in delivering functionality.' },
      { type: 'p', text: 'Additional information about processing responsibilities and third-party recipients is available in the Privacy Policy and applicable subprocessor disclosures.' },
    ],
  },
  {
    id: 's23',
    number: '23',
    heading: "Children's Privacy",
    blocks: [
      { type: 'p', text: "Tellann's primary Services are intended for software development professionals and organizations." },
      { type: 'p', text: 'We do not design optional advertising or tracking technologies for profiling children.' },
      {
        type: 'p',
        text: 'Where a customer uses Tellann in connection with an application accessed by children, that customer must assess and meet applicable child privacy, notice, consent, and monitoring requirements.',
      },
      { type: 'p', text: "Tellann's technical processing responsibilities remain governed by the applicable agreements and legal obligations." },
    ],
  },
  {
    id: 's24',
    number: '24',
    heading: 'Do Not Track and Global Privacy Signals',
    blocks: [
      { type: 'p', text: 'Browsers or privacy tools may transmit preference signals indicating a desire to restrict tracking.' },
      { type: 'p', text: 'Tellann will evaluate and honor signals to the extent required by applicable law and supported by its implemented consent-management systems.' },
      { type: 'p', text: 'Where legally recognized signals are supported, their behavior should be documented in the relevant privacy controls.' },
      { type: 'p', text: 'Tellann will not claim universal support for a particular browser privacy signal unless its handling has been implemented and verified.' },
    ],
  },
  {
    id: 's25',
    number: '25',
    heading: 'Changes to Our Cookie Practices',
    blocks: [
      { type: 'p', text: 'We may update the technologies used to operate or improve the Services.' },
      {
        type: 'p',
        text: 'When a material new non-essential purpose, provider, or tracking mechanism is introduced, we will update the relevant disclosures and obtain fresh consent where required.',
      },
      { type: 'p', text: 'We may also update this Policy to reflect:' },
      {
        type: 'ul',
        items: [
          'New technical functionality.',
          'Changes to authentication or security mechanisms.',
          'New integrations.',
          'Changes to applicable privacy requirements.',
          'Changes in service providers.',
          'Updated consent-management controls.',
        ],
      },
      { type: 'p', text: 'Material changes will be communicated where required.' },
    ],
  },
  {
    id: 's26',
    number: '26',
    heading: 'Relationship With Other Tellann Policies',
    blocks: [
      { type: 'p', text: 'This Cookie Policy should be read together with:' },
      { type: 'p', text: '**Terms of Service:** [https://tellann.co/terms](https://tellann.co/terms)' },
      { type: 'p', text: '**Privacy Policy:** [https://tellann.co/privacy](https://tellann.co/privacy)' },
      { type: 'p', text: '**Subprocessor Information:** [Publish verified URL]' },
      { type: 'p', text: '**Data Processing Agreement:** [Publish verified URL]' },
      {
        type: 'p',
        text: 'The Privacy Policy provides broader details concerning our processing of personal data, including lawful bases, retention, individual rights, and security measures.',
      },
      { type: 'p', text: 'The Terms of Service establish the contractual conditions governing access to Tellann.' },
      { type: 'p', text: 'This Cookie Policy addresses the specific storage and access technologies described here.' },
    ],
  },
  {
    id: 's27',
    number: '27',
    heading: 'Contact Information',
    blocks: [
      { type: 'p', text: 'If you have questions about this Cookie Policy or how Tellann uses browser storage and similar technologies, contact:' },
      { type: 'p', text: '**Tellann**' },
      { type: 'p', text: 'Legal Entity: [Full registered legal name]' },
      { type: 'p', text: 'Registered Address: [Verified registered address]' },
      { type: 'p', text: 'Privacy Email: [Verified privacy contact]' },
      { type: 'p', text: 'Website: [https://tellann.co](https://tellann.co)' },
      { type: 'p', text: 'You may also contact the appropriate data protection authority where applicable.' },
      { type: 'p', text: 'For Nigeria, the relevant data protection regulator is the Nigeria Data Protection Commission.' },
      { type: 'p', text: '**Regulator Website:** [https://ndpc.gov.ng](https://ndpc.gov.ng)' },
    ],
  },
];
