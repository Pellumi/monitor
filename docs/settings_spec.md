



# Tellann Settings Architecture

Your current navigation is too narrow, and two gates are misplaced:

- **Security & MFA must not require SSO.** Every user needs session controls and MFA. Only the SSO subsection should be Enterprise-gated.
- **Ingestion Keys must not require Session Recording.** SDK keys are required for basic application onboarding and telemetry ingestion, even when replay is disabled. The platform API already treats API-key management as a core onboarding capability. fileciteturn0file15

The settings area should distinguish three scopes clearly:

- **Personal settings** affect the signed-in user.
- **Workspace settings** affect the organization.
- **Application settings** affect a selected application or environment.

Without visible scope boundaries, users will eventually change an organization-wide policy while believing they are changing a personal preference.

---

## 1. Recommended Settings Navigation

```ts
import {
  User,
  SlidersHorizontal,
  Bell,
  Building2,
  Users,
  Shield,
  KeyRound,
  EyeOff,
  Database,
  Plug,
  CreditCard,
  ScrollText,
} from "lucide-react";

type SettingsScope = "USER" | "ORGANIZATION" | "APPLICATION";

type SettingsNavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  scope: SettingsScope;
  requiredPermission?: string;
  requiredFeature?: string;
};

type SettingsNavSection = {
  label: string;
  items: SettingsNavItem[];
};

export const settingsNavigation: SettingsNavSection[] = [
  {
    label: "Personal",
    items: [
      {
        name: "Profile",
        href: "/settings/profile",
        icon: User,
        scope: "USER",
      },
      {
        name: "Preferences",
        href: "/settings/preferences",
        icon: SlidersHorizontal,
        scope: "USER",
      },
      {
        name: "Notifications",
        href: "/settings/notifications",
        icon: Bell,
        scope: "USER",
      },
      {
        name: "Security & Sessions",
        href: "/settings/security",
        icon: Shield,
        scope: "USER",
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        name: "Organisation",
        href: "/settings/organization",
        icon: Building2,
        scope: "ORGANIZATION",
        requiredPermission: "organization:update",
      },
      {
        name: "Members & Access",
        href: "/settings/members",
        icon: Users,
        scope: "ORGANIZATION",
        requiredFeature: "TEAM_COLLABORATION",
        requiredPermission: "members:read",
      },
      {
        name: "Audit Logs",
        href: "/settings/audit-logs",
        icon: ScrollText,
        scope: "ORGANIZATION",
        requiredFeature: "AUDIT_LOGS",
        requiredPermission: "audit:read",
      },
    ],
  },
  {
    label: "Developer & Data",
    items: [
      {
        name: "Ingestion Keys",
        href: "/settings/ingestion-keys",
        icon: KeyRound,
        scope: "APPLICATION",
        requiredPermission: "ingestion_keys:read",
      },
      {
        name: "Privacy & Capture",
        href: "/settings/privacy",
        icon: EyeOff,
        scope: "APPLICATION",
        requiredPermission: "privacy:read",
      },
      {
        name: "Storage & Retention",
        href: "/settings/data",
        icon: Database,
        scope: "ORGANIZATION",
        requiredPermission: "retention:read",
      },
      {
        name: "Integrations",
        href: "/settings/integrations",
        icon: Plug,
        scope: "ORGANIZATION",
        requiredPermission: "integrations:read",
      },
    ],
  },
  {
    label: "Plan",
    items: [
      {
        name: "Billing & Usage",
        href: "/settings/billing",
        icon: CreditCard,
        scope: "ORGANIZATION",
        requiredPermission: "billing:read",
      },
    ],
  },
];
```

Do not hide entire pages simply because one section is unavailable. Show the page, expose the available controls, and mark higher-plan capabilities with a restrained upgrade indicator.

---

# 2. Personal Settings

## Profile

**Route:** `/settings/profile`

This page manages the user’s identity inside Tellann.

### Account information

- Profile image
- First name and last name
- Display name
- Job title
- Team or department
- Email address
- Email verification status
- Connected identity provider
- Account creation date

Changing the email address should require verification before the old address is replaced.

### Personal defaults

- Default workspace
- Default application
- Default environment
- Personal timezone
- Locale and date format
- Preferred documentation language
- Preferred start page

### Account lifecycle

- Export personal account information
- Leave workspace
- Deactivate account
- Delete personal account

A workspace owner must transfer ownership before leaving or deleting their account.

### Access

Available on every plan.

---

## Preferences

**Route:** `/settings/preferences`

The database specification already anticipates user dashboard preferences, but critical security or billing configuration should not be hidden inside an unstructured JSON object. fileciteturn0file4

### Interface preferences

- Light, dark or system theme
- Compact or comfortable density
- Sidebar expanded or collapsed
- Reduced motion
- High-contrast mode
- Table page size
- Persist filters between visits

### Navigation preferences

- Default landing page
- Remember last application
- Remember last environment
- Open reports in the same or a new tab
- Recently viewed applications

### Behaviour Graph preferences

- Default graph layout
- Show or hide transition frequency
- Show confidence indicators
- Collapse low-frequency branches
- Default graph zoom
- State label verbosity
- Highlight missing states automatically

The Behaviour Graph is Tellann’s central behavioural model, so graph preferences deserve first-class treatment rather than being buried inside generic dashboard configuration. fileciteturn0file8

### Session Replay preferences

- Default playback speed
- Auto-play replay
- Show API events
- Show error events
- Show state transitions
- Skip inactive periods
- Default timeline grouping

### Report preferences

- Default report type
- Default export format
- Include raw evidence by default
- Show technical details
- Show executive summary first

Free should default to JSON export because the current packaging limits Free exports to JSON. fileciteturn0file20

### Access

Available on every plan.

---

## Notifications

**Route:** `/settings/notifications`

The Notification Service is expected to support in-app notifications, email and webhooks. fileciteturn0file6

### Personal delivery channels

- In-app notifications
- Email notifications
- Browser notifications
- Webhook delivery where entitled
- Slack or Microsoft Teams when integrations are introduced

### MVP notification events

The first version should support:

| Category | Events |
|---|---|
| Demonstrations | Recording completed, processing completed, processing failed |
| Reports | Report generated, report generation failed, export ready |
| Coverage | Coverage below threshold, coverage decreased between demonstrations |
| Quality gaps | Critical missing flow, critical missing state |
| Endpoints | High error rate, endpoint latency above threshold |
| Ingestion | No events received, invalid key usage, key nearing expiry |
| Storage | 80%, 90% and 100% storage usage |
| Workspace | Invitation received, role changed, access revoked |
| Security | New login, MFA changed, session revoked |
| Billing | Payment failed, invoice ready, plan limit reached |

### Notification controls

- Instant, daily digest or weekly digest
- Severity threshold
- Per-application subscriptions
- Per-environment subscriptions
- Quiet hours
- Email digest time
- Mute individual workflows
- Mute resolved findings
- Notify only when a finding changes

### Organisation notification rules

Team and higher plans should allow administrators to configure shared rules such as:

- Notify QA members when critical missing flows are detected.
- Notify developers when endpoint analysis fails.
- Notify owners when application or storage limits are reached.
- Route billing events only to billing administrators.

### Phase boundaries

Do not expose notifications for anomaly detection, live production degradation, regression detection or autonomous recommendations during MVP. Those capabilities are explicitly outside the Phase 1 scope. fileciteturn0file14

---

## Security & Sessions

**Route:** `/settings/security`

This page must always be visible.

### Personal authentication

- Enable or disable TOTP MFA
- Add authenticator application
- Recovery codes
- Email verification status
- Password or passwordless authentication controls
- Hardware security keys when supported
- Recent authentication activity

### Active sessions

- Device
- Browser
- Approximate location
- Last activity
- Created date
- Current-session indicator
- Revoke individual session
- Sign out of all other sessions

Session expiration, revocation, device tracking, idle timeouts and refresh-token rotation are part of the intended security architecture. fileciteturn0file18

### Organisation security controls

Visible only to authorised workspace administrators:

- Require MFA for all members
- Session idle timeout
- Maximum session duration
- Allowed email domains
- Block personal email domains
- Invitation expiry
- Require verified email
- Revoke sessions after role changes

### Enterprise SSO section

Only this subsection should require the `SSO` entitlement:

- SAML configuration
- OIDC configuration
- Domain verification
- Just-in-time provisioning
- Default SSO role
- Enforce SSO
- Disable password authentication
- Identity-provider metadata
- SSO test mode
- Emergency owner access

### Enterprise network controls

- IP allowlist
- Private networking
- SCIM provisioning
- Custom session policies
- Customer-managed identity provider

---

# 3. Workspace Settings

## Organisation

**Route:** `/settings/organization`

### Workspace identity

- Organisation name
- Workspace slug
- Workspace logo
- Organisation ID
- Primary timezone
- Default application
- Default environment

### Workspace defaults

- Default report format
- Default graph visibility
- Default demonstration mode
- Default member role
- Default invitation expiry
- Default severity threshold

### Ownership

- Current owner
- Transfer ownership
- Billing contact
- Technical contact
- Security contact

### Region and deployment

Business may view the assigned region. Enterprise may configure:

- Data residency
- Deployment model
- Private networking
- Self-hosted licence information

### Danger zone

- Disable workspace
- Export workspace metadata
- Delete workspace
- Transfer ownership

Every destructive operation should require:

1. Recent authentication.
2. Exact workspace-name confirmation.
3. An audit-log entry.
4. A cooling-off period for workspace deletion.

---

## Members & Access

**Route:** `/settings/members`

### Members tab

- Name
- Email
- Status
- Role
- Assigned applications
- MFA status
- Last active
- Date joined

### Invitations tab

- Invite one or multiple users
- Resend invitation
- Revoke invitation
- Set invitation expiry
- Assign initial role
- Assign applications before acceptance

### Member actions

- Change role
- Grant application access
- Remove application access
- Suspend member
- Reactivate member
- Remove member
- Transfer resource ownership

### Roles

Base roles should reflect the product’s intended users and security model: Developer, QA Engineer, Product Manager, Engineering Manager and Organisation Admin. fileciteturn0file1 fileciteturn0file18

Recommended platform roles:

| Role | Purpose |
|---|---|
| Owner | Full control, billing, deletion and ownership |
| Admin | Workspace, members, applications and policies |
| Security Admin | Security, SSO, privacy and audit logs |
| Billing Admin | Plan, invoices, usage and payment methods |
| Engineering Manager | Reports, applications and quality visibility |
| QA Engineer | Demonstrations, sessions, graphs and reports |
| Developer | SDKs, keys, assigned applications and telemetry |
| Product Manager | Read-only workflow and quality insights |
| Viewer | Read-only assigned resources |

### RBAC packaging

- **Team:** fixed roles and application-level access.
- **Business:** advanced permission configuration.
- **Enterprise:** custom roles, SCIM groups and identity-provider mappings.

---

## Audit Logs

**Route:** `/settings/audit-logs`

### Logged activities

- Login success and failure
- MFA changes
- Member invitations
- Role changes
- Application creation or deletion
- Key creation, rotation and revocation
- Privacy-rule changes
- Retention-policy changes
- Report exports
- Billing changes
- SSO changes
- Workspace deletion requests

Audit records should show:

- Actor
- Action
- Resource
- Timestamp
- Result
- Source IP or masked network identifier
- Request ID
- Before-and-after values where safe

Security-sensitive actions must remain traceable and tamper-evident. fileciteturn0file18

### Plan access

- Business: standard audit history and filtering.
- Enterprise: longer retention, exports, API access and external SIEM forwarding.

---

# 4. Developer and Data Settings

## Ingestion Keys

**Route:** `/settings/ingestion-keys`

Call these **Ingestion Keys**, not general API keys. Management API tokens should live under Integrations.

### Key list

- Key name
- Application
- Environment
- Key prefix
- Status
- Created by
- Created date
- Last used
- Expiry date
- SDK type
- Allowed origins

### Key creation

- Select application
- Select environment
- Name the key
- Set expiry
- Select frontend, backend or both
- Add allowed browser origins
- Add permitted event categories
- Configure environment restriction

### Key security

- Reveal full key only once
- Copy warning
- Rotate key
- Grace period during rotation
- Revoke immediately
- View recent activity
- Detect unused keys
- Warn about keys embedded in unsupported locations

API keys are intended to be tenant-scoped, application-scoped, rotatable and expirable. fileciteturn0file18

### Access

Every plan needs ingestion keys. Limits should derive from application and environment entitlements rather than Session Replay access.

---

## Privacy & Capture

**Route:** `/settings/privacy`

This is a core settings page, not an Enterprise luxury. Tellann observes behaviour; privacy controls are part of the product’s foundation. The privacy specification requires privacy-by-default, custom masking rules and tenant-controlled collection. fileciteturn0file12

### Capture settings

- Enable navigation capture
- Enable click capture
- Enable form-interaction capture
- Enable state capture
- Enable API metadata capture
- Enable error capture
- Enable replay timeline
- Enable custom events
- Capture development, staging or demonstration environments

### Automatic privacy protections

Always enabled and not removable:

- Never capture passwords
- Never capture payment card data
- Never capture tokens
- Never capture cookies
- Never capture authorisation headers
- Never capture private keys
- Never capture security answers

### Masking rules

- CSS selectors to mask
- Field names to mask
- DOM attributes to exclude
- URL query parameters to remove
- Request headers to remove
- Response headers to remove
- User identifiers to hash
- IP masking
- Text-content capture policy

Supported actions:

- Ignore
- Mask
- Hash
- Tokenise
- Redact

### Replay privacy

- Mask all input fields by default
- Allowlist safe fields
- Block selected routes
- Block selected components
- Disable replay for selected environments
- Preview captured data before saving a policy

### Rule testing

Include a “Test privacy configuration” tool that accepts a sample event and shows:

- Original payload
- Sanitised payload
- Blocked fields
- Applied rules
- Final transmitted payload

That feature will prevent silent privacy mistakes.

---

## Storage & Retention

**Route:** `/settings/data`

### Usage overview

- Current storage
- Included storage
- Replay storage
- Event storage
- Report storage
- Storage trend
- Estimated limit date

### Retention policies

- Raw events
- Session records
- Replay assets
- Reports
- Audit logs
- Generated exports

Current packaged defaults are:

| Plan | Managed retention |
|---|---:|
| Free | 14 days |
| Solo | 90 days |
| Team | 180 days |
| Business | 365 days |
| Enterprise | Custom |

These limits come from the current pricing specification. fileciteturn0file20

### Data management

- Delete sessions by date
- Delete an application’s data
- Export organisation data
- Request full deletion
- View deletion jobs
- Cancel pending deletion
- Configure automatic cleanup

### Enterprise controls

- Custom retention by data type
- Legal hold
- Data residency
- Bring-your-own storage
- Customer-managed encryption keys
- Self-hosted storage configuration

---

## Integrations

**Route:** `/settings/integrations`

### MVP integrations

- Outbound webhooks
- Management API tokens
- Report-delivery endpoints
- Notification endpoints

The API specification already includes webhook creation, listing and deletion. fileciteturn0file15

### Webhook configuration

- Name
- Destination URL
- Signing secret
- Subscribed events
- Application filters
- Environment filters
- Active status
- Retry history
- Last delivery status
- Test delivery
- Rotate signing secret

### Management API tokens

Separate these from SDK ingestion keys.

- Token name
- Scopes
- Expiration
- Last used
- Created by
- Revoke
- Rotate

### Later integrations

These should not be promised as MVP features until implemented:

- Slack
- Microsoft Teams
- Jira
- Linear
- GitHub
- GitLab
- PagerDuty
- Datadog
- Sentry

---

# 5. Billing & Usage

**Route:** `/settings/billing`

Only owners and billing administrators should manage billing.

### Plan overview

- Current plan
- Billing cycle
- Renewal date
- Plan status
- Upgrade
- Downgrade
- Cancel subscription

### Usage meters

Phase 1 billing should show customer-understandable metrics:

- Applications
- Members
- Storage
- Retention
- Demonstration sessions
- Report exports

Your pricing strategy explicitly avoids exposing event volume as a primary Phase 1 pricing metric. fileciteturn0file19

### Payment and invoicing

- Payment method
- Billing email
- Billing address
- Tax information
- Invoice history
- Download invoice
- Failed-payment notice
- Purchase-order details for Enterprise

### Usage alerts

- Notify at 70%, 80%, 90% and 100%
- Application-limit alert
- Member-limit alert
- Storage-limit alert
- Retention reduction warning

### Enterprise contract view

- Contract start and end
- Renewal date
- Account manager
- Support tier
- Contracted limits
- Deployment model
- SLA summary

---

# 6. Plan Access Matrix

Your formal pricing document currently defines **Free, Solo, Team, Business and Enterprise**, not Local. fileciteturn0file20

Therefore, Local should be formally documented before implementation. The cleanest definition is:

> **Local is a developer workstation edition, not free Enterprise self-hosting.**

It should run locally for evaluation and development, without managed cloud infrastructure, collaboration, email delivery, SLA or production support.

| Settings capability | Free | Local | Solo | Team | Business | Enterprise |
|---|---:|---:|---:|---:|---:|---:|
| Profile | Full | Full | Full | Full | Full | Full |
| Personal preferences | Full | Full | Full | Full | Full | Full |
| In-app notifications | Yes | Local only | Yes | Yes | Yes | Yes |
| Email notifications | Basic | No | Yes | Yes | Yes | Yes |
| Shared notification rules | No | No | No | Yes | Yes | Yes |
| Profile MFA | Yes | Local account | Yes | Yes | Yes | Yes |
| Enforce workspace MFA | No | No | No | Yes | Yes | Yes |
| SSO/SAML/OIDC | No | No | No | No | No | Yes |
| Organisation settings | Basic | Local workspace | Basic | Full | Full | Full |
| Members | 1 | 1 | See note below | Up to 10 | Up to 50 | Custom |
| Fixed RBAC | No | No | No | Yes | Yes | Yes |
| Advanced/custom RBAC | No | No | No | No | Yes | Yes |
| Ingestion keys | Yes | Yes | Yes | Yes | Yes | Yes |
| Privacy defaults | Yes | Yes | Yes | Yes | Yes | Yes |
| Custom privacy rules | Limited | Local | Standard | Standard | Advanced | Custom |
| Storage view | Yes | Local disk | Yes | Yes | Yes | Yes |
| Custom retention | No | Local responsibility | No | No | Limited | Full |
| Management API | No | Local only | No | No | Yes | Yes |
| Webhooks | No | Local only | No | Limited | Full | Full |
| Audit logs | No | Local logs | No | No | Yes | Advanced |
| Billing page | Yes | Licence info | Yes | Yes | Yes | Contract |
| Self-hosted production | No | No | No | No | No | Yes |

## Solo-plan contradiction

The current packaging says:

- Solo targets individual professionals.
- Solo permits three users.
- Team Collaboration is excluded from Solo.

Those three statements do not fit together.

The clean recommendation is:

- **Solo: one member.**
- **Team: collaboration begins.**

Alternatively, Solo may retain three seats but provide no differentiated roles, shared dashboards or application-level permissions. That would be harder to explain and easier to misuse.

---

# 7. Page-Level Permission Model

Do not rely only on plan checks. Every request must also pass a permission check.

Recommended permissions:

```ts
type SettingsPermission =
  | "profile:update"
  | "preferences:update"
  | "notifications:update"
  | "organization:read"
  | "organization:update"
  | "organization:delete"
  | "members:read"
  | "members:invite"
  | "members:update"
  | "members:remove"
  | "roles:manage"
  | "security:read"
  | "security:manage"
  | "sso:manage"
  | "ingestion_keys:read"
  | "ingestion_keys:create"
  | "ingestion_keys:rotate"
  | "ingestion_keys:revoke"
  | "privacy:read"
  | "privacy:manage"
  | "retention:read"
  | "retention:manage"
  | "integrations:read"
  | "integrations:manage"
  | "audit:read"
  | "audit:export"
  | "billing:read"
  | "billing:manage";
```

Plan entitlement answers:

> Is this capability included?

Permission answers:

> Is this particular user allowed to perform it?

Both checks must happen on the server. Hiding a button in React is not authorisation.

---

# 8. Recommended Settings Data Model

Use dedicated tables for important policies and JSONB only for flexible interface preferences.

```txt
user_profiles
user_preferences
notification_preferences
notification_subscriptions
organization_settings
organization_security_settings
organization_memberships
organization_invitations
roles
permissions
role_permissions
application_access
ingestion_keys
ingestion_key_activity
application_capture_settings
privacy_rules
retention_policies
webhooks
webhook_deliveries
management_api_tokens
audit_logs
billing_accounts
subscriptions
usage_snapshots
data_deletion_requests
```

Avoid placing security, retention and billing rules inside a single `settings JSONB` column. Flexible blobs are convenient at first and become fog later: difficult to validate, migrate, audit and query.

---

# 9. MVP Implementation Order

## First release

1. Profile
2. Preferences
3. Personal notifications
4. Security and active sessions
5. Organisation
6. Members and invitations
7. Ingestion keys
8. Privacy and capture
9. Storage usage
10. Billing and plan usage

## Second release

1. Organisation-wide notification rules
2. Application-level access
3. Webhooks
4. Management API tokens
5. Audit logs
6. Data export and deletion workflows
7. Advanced retention controls

## Enterprise release

1. SSO
2. Domain verification
3. SCIM
4. IP restrictions
5. Custom roles
6. Custom retention
7. Data residency
8. Private networking
9. Self-hosted licence configuration

This keeps the settings surface aligned with Tellann’s real MVP: behavioural capture, demonstration sessions, replay, graphs, coverage, missing states, missing flows and reports—not settings for future intelligence that does not yet exist.