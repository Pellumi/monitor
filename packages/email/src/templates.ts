import { EmailCategory } from '@sots/db';

export type EmailTemplateKey =
  | 'auth-otp'
  | 'auth-welcome'
  | 'team-invite'
  | 'org-created'
  | 'app-created'
  | 'api-key-created'
  | 'sdk-install-guide'
  | 'sdk-first-event'
  | 'demo-start-reminder'
  | 'demo-completed-processing'
  | 'demo-report-ready'
  | 'report-export-ready'
  | 'demo-analysis-failed'
  | 'coverage-degraded'
  | 'missing-critical-flow'
  | 'endpoint-slow'
  | 'billing-payment-failed'
  | 'billing-receipt'
  | 'usage-limit-warning'
  | 'security-new-device'
  | 'privacy-rule-updated';

export interface BuiltinEmailTemplate {
  key: EmailTemplateKey;
  category: EmailCategory;
  subject: string;
  preheader: string;
  requiredVariables: string[];
  defaultFrom: SenderKey;
  purpose: string;
  primaryCtaLabel: string;
  primaryUrlVariable?: string;
  designLabel?: string;
  headline?: string;
  secondaryCtaLabel?: string;
  secondaryUrlVariable?: string;
  emphasisVariable?: string;
}

export type SenderKey = 'hello' | 'security' | 'reports' | 'alerts' | 'billing' | 'support';

export const builtinTemplates: BuiltinEmailTemplate[] = [
  {
    key: 'auth-otp',
    category: EmailCategory.SECURITY,
    subject: 'Your Tellann verification code',
    preheader: 'Use this one-time code to continue signing in.',
    requiredVariables: ['code', 'expiresInMinutes'],
    defaultFrom: 'security',
    purpose: 'Verify that this email address belongs to you.',
    primaryCtaLabel: 'Open Tellann',
    primaryUrlVariable: 'appUrl',
    designLabel: 'Auth // Verification',
    headline: 'Verify your identity',
    emphasisVariable: 'code',
  },
  {
    key: 'auth-welcome',
    category: EmailCategory.ONBOARDING,
    subject: 'Welcome to Tellann',
    preheader: 'Your account is ready. Create an application and install the SDK next.',
    requiredVariables: ['userName', 'dashboardUrl'],
    defaultFrom: 'hello',
    purpose: 'Your Tellann account is verified and ready for setup.',
    primaryCtaLabel: 'Open dashboard',
    primaryUrlVariable: 'dashboardUrl',
    designLabel: 'Auth // Welcome',
    headline: 'Sequence initiated',
    secondaryCtaLabel: 'Documentation',
    secondaryUrlVariable: 'docsUrl',
  },
  {
    key: 'team-invite',
    category: EmailCategory.TEAM,
    subject: 'You have been invited to {{organizationName}} on Tellann',
    preheader: 'Accept the invite to join your team workspace.',
    requiredVariables: ['organizationName', 'role', 'inviteUrl'],
    defaultFrom: 'hello',
    purpose: 'A teammate invited you to collaborate in Tellann.',
    primaryCtaLabel: 'Accept invite',
    primaryUrlVariable: 'inviteUrl',
    designLabel: 'Org // Invitation',
    headline: 'Join infrastructure node',
    emphasisVariable: 'role',
  },
  {
    key: 'org-created',
    category: EmailCategory.ONBOARDING,
    subject: '{{organizationName}} is ready on Tellann',
    preheader: 'Your workspace has been created.',
    requiredVariables: ['organizationName', 'dashboardUrl'],
    defaultFrom: 'hello',
    purpose: 'Your organization workspace has been created.',
    primaryCtaLabel: 'Open workspace',
    primaryUrlVariable: 'dashboardUrl',
    designLabel: 'Org // Success',
    headline: 'New workspace registered',
    emphasisVariable: 'organizationName',
  },
  {
    key: 'app-created',
    category: EmailCategory.ONBOARDING,
    subject: '{{applicationName}} is registered',
    preheader: 'Create an API key and install the SDK to start receiving telemetry.',
    requiredVariables: ['applicationName', 'dashboardUrl'],
    defaultFrom: 'hello',
    purpose: 'Your application is registered and ready for SDK setup.',
    primaryCtaLabel: 'Configure SDK',
    primaryUrlVariable: 'dashboardUrl',
    designLabel: 'App // Confirmation',
    headline: 'Application provisioned',
    emphasisVariable: 'applicationName',
  },
  {
    key: 'api-key-created',
    category: EmailCategory.TEAM,
    subject: 'API key created for {{applicationName}}',
    preheader: 'A new key was created. Tellann never sends raw API secrets by email.',
    requiredVariables: ['applicationName', 'environmentName', 'keyPrefix', 'dashboardUrl'],
    defaultFrom: 'security',
    purpose: 'A new API key was created for SDK ingestion.',
    primaryCtaLabel: 'Review API keys',
    primaryUrlVariable: 'dashboardUrl',
    designLabel: 'Security // Alert',
    headline: 'New API key generated',
    emphasisVariable: 'keyPrefix',
  },
  {
    key: 'sdk-install-guide',
    category: EmailCategory.ONBOARDING,
    subject: 'Install the Tellann SDK for {{applicationName}}',
    preheader: 'Use your one-time API key view in the dashboard, then verify installation.',
    requiredVariables: ['applicationName', 'docsUrl', 'dashboardUrl'],
    defaultFrom: 'hello',
    purpose: 'Install the SDK so Tellann can receive the first telemetry event.',
    primaryCtaLabel: 'Open SDK guide',
    primaryUrlVariable: 'docsUrl',
    designLabel: 'Dev // SDK Guide',
    headline: 'Connect the dots',
    secondaryCtaLabel: 'Open application',
    secondaryUrlVariable: 'dashboardUrl',
    emphasisVariable: 'applicationName',
  },
  {
    key: 'sdk-first-event',
    category: EmailCategory.ONBOARDING,
    subject: 'Tellann received the first event from {{applicationName}}',
    preheader: 'Telemetry is connected. Start a demonstration to generate quality insight.',
    requiredVariables: ['applicationName', 'dashboardUrl'],
    defaultFrom: 'hello',
    purpose: 'Your SDK installation is sending telemetry successfully.',
    primaryCtaLabel: 'Start demonstration',
    primaryUrlVariable: 'dashboardUrl',
    designLabel: 'System // Pulse',
    headline: 'First signal received',
    emphasisVariable: 'applicationName',
  },
  {
    key: 'demo-start-reminder',
    category: EmailCategory.ONBOARDING,
    subject: 'Start your first Tellann demonstration',
    preheader: 'Your SDK is connected. Walk through a core flow to generate a report.',
    requiredVariables: ['applicationName', 'dashboardUrl'],
    defaultFrom: 'hello',
    purpose: 'Move from connected telemetry to the first demonstrated workflow.',
    primaryCtaLabel: 'Start demo',
    primaryUrlVariable: 'dashboardUrl',
    designLabel: 'Dev // Reminder',
    headline: 'Complete the cycle',
    emphasisVariable: 'applicationName',
  },
  {
    key: 'demo-completed-processing',
    category: EmailCategory.REPORTS,
    subject: 'Tellann is analyzing your demonstration',
    preheader: 'Your demo completed and analysis is now running.',
    requiredVariables: ['applicationName', 'dashboardUrl'],
    defaultFrom: 'reports',
    purpose: 'Your demonstration was captured and queued for analysis.',
    primaryCtaLabel: 'Open dashboard',
    primaryUrlVariable: 'dashboardUrl',
    designLabel: 'Analysis // Processing',
    headline: 'Analysis sequence initiated',
    emphasisVariable: 'sessionId',
  },
  {
    key: 'demo-report-ready',
    category: EmailCategory.REPORTS,
    subject: 'Your Tellann QA report is ready',
    preheader: 'Review coverage, missing flows, missing states, and endpoint signals.',
    requiredVariables: ['applicationName', 'reportUrl'],
    defaultFrom: 'reports',
    purpose: 'Tellann generated a QA report from your demonstration.',
    primaryCtaLabel: 'Open report',
    primaryUrlVariable: 'reportUrl',
  },
  {
    key: 'report-export-ready',
    category: EmailCategory.REPORTS,
    subject: 'Your {{format}} report export is ready',
    preheader: 'The requested report export finished successfully.',
    requiredVariables: ['applicationName', 'format', 'reportUrl'],
    defaultFrom: 'reports',
    purpose: 'Your report export completed.',
    primaryCtaLabel: 'Open report',
    primaryUrlVariable: 'reportUrl',
  },
  {
    key: 'demo-analysis-failed',
    category: EmailCategory.ALERTS,
    subject: 'Tellann could not analyze {{applicationName}}',
    preheader: 'The demonstration analysis failed. Review the application and try again.',
    requiredVariables: ['applicationName', 'dashboardUrl'],
    defaultFrom: 'alerts',
    purpose: 'A demonstration analysis job failed and needs attention.',
    primaryCtaLabel: 'Review application',
    primaryUrlVariable: 'dashboardUrl',
  },
  {
    key: 'coverage-degraded',
    category: EmailCategory.ALERTS,
    subject: '{{applicationName}} coverage dropped to {{coverageScore}}%',
    preheader: 'Behavioral coverage declined versus the previous snapshot.',
    requiredVariables: ['applicationName', 'previousCoverageScore', 'coverageScore', 'dashboardUrl'],
    defaultFrom: 'alerts',
    purpose: 'Tellann detected a meaningful drop in behavioral coverage.',
    primaryCtaLabel: 'Review coverage',
    primaryUrlVariable: 'dashboardUrl',
  },
  {
    key: 'missing-critical-flow',
    category: EmailCategory.ALERTS,
    subject: 'Critical missing flow detected in {{applicationName}}',
    preheader: 'Tellann found a high-risk path that has not been demonstrated.',
    requiredVariables: ['applicationName', 'missingFlowCount', 'dashboardUrl'],
    defaultFrom: 'alerts',
    purpose: 'A missing high-risk workflow path was detected.',
    primaryCtaLabel: 'Review missing flows',
    primaryUrlVariable: 'dashboardUrl',
  },
  {
    key: 'endpoint-slow',
    category: EmailCategory.ALERTS,
    subject: 'Slow endpoint detected in {{applicationName}}',
    preheader: 'An endpoint exceeded the configured latency threshold.',
    requiredVariables: ['applicationName', 'endpoint', 'avgMs', 'dashboardUrl'],
    defaultFrom: 'alerts',
    purpose: 'Tellann found an endpoint that is slower than expected.',
    primaryCtaLabel: 'Review endpoint',
    primaryUrlVariable: 'dashboardUrl',
  },
  {
    key: 'billing-payment-failed',
    category: EmailCategory.BILLING,
    subject: 'Payment failed for {{organizationName}}',
    preheader: 'Update billing to avoid interruption.',
    requiredVariables: ['organizationName', 'billingUrl'],
    defaultFrom: 'billing',
    purpose: 'A subscription payment failed or moved past due.',
    primaryCtaLabel: 'Open billing',
    primaryUrlVariable: 'billingUrl',
  },
  {
    key: 'billing-receipt',
    category: EmailCategory.BILLING,
    subject: 'Your Tellann receipt — {{invoiceNumber}}',
    preheader: 'Payment confirmed. Your PDF receipt is attached.',
    requiredVariables: ['organizationName', 'planName', 'amountPaid', 'invoiceNumber', 'billingUrl'],
    defaultFrom: 'billing',
    purpose: 'Payment receipt delivered after a successful subscription activation.',
    primaryCtaLabel: 'Open billing',
    primaryUrlVariable: 'billingUrl',
  },
  {
    key: 'usage-limit-warning',
    category: EmailCategory.BILLING,
    subject: '{{organizationName}} reached {{percentUsed}}% of a plan limit',
    preheader: 'Review usage before the limit blocks a workflow.',
    requiredVariables: ['organizationName', 'metric', 'percentUsed', 'usageUrl'],
    defaultFrom: 'billing',
    purpose: 'Your organization is approaching or has reached a plan usage limit.',
    primaryCtaLabel: 'Review usage',
    primaryUrlVariable: 'usageUrl',
  },
  {
    key: 'security-new-device',
    category: EmailCategory.SECURITY,
    subject: 'New sign-in to Tellann',
    preheader: 'A new session was created for your account.',
    requiredVariables: ['ipAddress', 'userAgent', 'securityUrl'],
    defaultFrom: 'security',
    purpose: 'A new device or browser signed in to your Tellann account.',
    primaryCtaLabel: 'Review sessions',
    primaryUrlVariable: 'securityUrl',
  },
  {
    key: 'privacy-rule-updated',
    category: EmailCategory.COMPLIANCE,
    subject: 'Privacy rule updated for {{organizationName}}',
    preheader: 'A privacy configuration changed in your workspace.',
    requiredVariables: ['organizationName', 'ruleName', 'settingsUrl'],
    defaultFrom: 'security',
    purpose: 'A privacy rule was changed and should be reviewed for compliance.',
    primaryCtaLabel: 'Review privacy settings',
    primaryUrlVariable: 'settingsUrl',
  },
];

export function getBuiltinTemplate(key: string): BuiltinEmailTemplate | undefined {
  return builtinTemplates.find((template) => template.key === key);
}
