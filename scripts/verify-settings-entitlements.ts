import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient, type MemberRole, type PlanType } from '@prisma/client';

process.loadEnvFile?.('.env');

const prisma = new PrismaClient();
const gateway = process.env.API_GATEWAY_INTERNAL_URL ?? 'http://127.0.0.1:3000';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`SETTINGS_ACCEPTANCE_FAILED: ${message}`);
}

function token(user: { id: string; email: string }) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET || 'tellann-default-jwt-secret-change-in-production', { expiresIn: '20m' });
}

async function request(pathname: string, bearer: string, init: RequestInit = {}, expectedStatus?: number) {
  const response = await fetch(`${gateway}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${bearer}`,
      ...init.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (expectedStatus !== undefined) {
    assert(response.status === expectedStatus, `${init.method ?? 'GET'} ${pathname} expected ${expectedStatus}, received ${response.status}: ${text}`);
  } else {
    assert(response.ok, `${init.method ?? 'GET'} ${pathname} returned ${response.status}: ${text}`);
  }
  return body as any;
}

async function createUser(label: string) {
  return prisma.user.create({ data: { email: `${label}-${crypto.randomUUID()}@example.com`, displayName: label } });
}

async function createOrganization(label: string, owner: { id: string }, planType: PlanType) {
  const suffix = crypto.randomUUID();
  const plan = await prisma.plan.findUniqueOrThrow({ where: { type: planType } });
  // Billing identity is user-scoped — the owner is the payer of record.
  await prisma.userBillingProfile.upsert({
    where: { userId: owner.id },
    create: { userId: owner.id, countryCode: 'US', legalName: `${label} payer` },
    update: {},
  });
  return prisma.organization.create({
    data: {
      name: `${label} organization`,
      slug: `${label.toLowerCase()}-${suffix}`,
      createdByUserId: owner.id,
      memberships: { create: { userId: owner.id, role: 'OWNER' } },
      subscription: {
        create: {
          planId: plan.id,
          payerUserId: owner.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60_000),
        },
      },
    },
  });
}

const desktopMatrix = {
  FREE: {
    DESKTOP_GUIDED_RUNS: true,
    DOCUMENT_FLOW_INFERENCE: false,
    AUTOMATED_INSTRUMENTATION: false,
    SHARED_RUN_GOVERNANCE: false,
    BROWSER_TRACE_CAPTURE: false,
    VISUAL_ACCESSIBILITY_ANALYSIS: 'BASIC',
  },
  LOCAL: {
    DESKTOP_GUIDED_RUNS: true,
    DOCUMENT_FLOW_INFERENCE: 'STANDARD',
    AUTOMATED_INSTRUMENTATION: false,
    SHARED_RUN_GOVERNANCE: false,
    BROWSER_TRACE_CAPTURE: 'BASIC',
    VISUAL_ACCESSIBILITY_ANALYSIS: 'STANDARD',
  },
  SOLO: {
    DESKTOP_GUIDED_RUNS: true,
    DOCUMENT_FLOW_INFERENCE: 'ADVANCED',
    AUTOMATED_INSTRUMENTATION: 'BASIC',
    SHARED_RUN_GOVERNANCE: false,
    BROWSER_TRACE_CAPTURE: 'ADVANCED',
    VISUAL_ACCESSIBILITY_ANALYSIS: 'ADVANCED',
  },
  TEAM: {
    DESKTOP_GUIDED_RUNS: true,
    DOCUMENT_FLOW_INFERENCE: 'ADVANCED',
    AUTOMATED_INSTRUMENTATION: 'ADVANCED',
    SHARED_RUN_GOVERNANCE: true,
    BROWSER_TRACE_CAPTURE: 'ADVANCED',
    VISUAL_ACCESSIBILITY_ANALYSIS: 'ADVANCED',
  },
  BUSINESS: {
    DESKTOP_GUIDED_RUNS: true,
    DOCUMENT_FLOW_INFERENCE: 'ADVANCED',
    AUTOMATED_INSTRUMENTATION: 'ADVANCED',
    SHARED_RUN_GOVERNANCE: true,
    BROWSER_TRACE_CAPTURE: 'ADVANCED',
    VISUAL_ACCESSIBILITY_ANALYSIS: 'ADVANCED',
  },
  ENTERPRISE: {
    DESKTOP_GUIDED_RUNS: true,
    DOCUMENT_FLOW_INFERENCE: 'ADVANCED',
    AUTOMATED_INSTRUMENTATION: 'ADVANCED',
    SHARED_RUN_GOVERNANCE: true,
    BROWSER_TRACE_CAPTURE: 'ADVANCED',
    VISUAL_ACCESSIBILITY_ANALYSIS: 'ADVANCED',
  },
} as const;

async function addMember(organizationId: string, role: MemberRole, label: string) {
  const user = await createUser(label);
  await prisma.organizationMembership.create({ data: { organizationId, userId: user.id, role } });
  return user;
}

async function main() {
  const organizations = new Map<string, Awaited<ReturnType<typeof createOrganization>>>();
  const owners = new Map<string, Awaited<ReturnType<typeof createUser>>>();

  for (const planType of Object.keys(desktopMatrix) as PlanType[]) {
    const owner = await createUser(`settings-${planType.toLowerCase()}-owner`);
    const organization = await createOrganization(`Settings ${planType}`, owner, planType);
    owners.set(planType, owner);
    organizations.set(planType, organization);
    const entitlement = await request(`/organizations/${organization.id}/entitlement`, token(owner));
    assert(entitlement.planType === planType, `${planType} entitlement resolved as ${entitlement.planType}`);
    for (const [feature, expected] of Object.entries(desktopMatrix[planType])) {
      assert(entitlement.features[feature] === expected, `${planType}.${feature} expected ${expected}, received ${entitlement.features[feature]}`);
    }
  }

  const free = organizations.get('FREE')!;
  const freeOwner = owners.get('FREE')!;
  const freeToken = token(freeOwner);
  const profile = await request('/auth/me', freeToken);
  assert(profile.user.id === freeOwner.id && profile.memberships.some((item: any) => item.organization.id === free.id), 'Profile did not return tenant-scoped membership data');
  const updatedProfile = await request('/auth/me', freeToken, {
    method: 'PATCH', body: JSON.stringify({ displayName: 'Updated QA Owner', email: 'attempted-change@example.com', role: 'OWNER' }),
  });
  assert(updatedProfile.displayName === 'Updated QA Owner' && updatedProfile.email === freeOwner.email, 'Profile update did not isolate editable fields');

  const application = await prisma.application.create({ data: { name: 'Settings app', organizationId: free.id } });
  const environment = await prisma.environment.create({ data: { name: 'Settings staging', type: 'STAGING', applicationId: application.id } });
  const settingsPayload = await request(`/organizations/${free.id}/settings`, freeToken);
  const updatedSettings = await request(`/organizations/${free.id}/settings`, freeToken, {
    method: 'PUT',
    body: JSON.stringify({
      ...settingsPayload.settings,
      primaryTimezone: 'Africa/Lagos',
      defaultReportFormat: 'PDF',
      defaultSeverityThreshold: 'ERROR',
      defaultInvitationExpiryDays: 14,
      technicalContactEmail: 'qa@example.com',
      defaultApplicationId: application.id,
      defaultEnvironmentId: environment.id,
    }),
  });
  assert(updatedSettings.version === settingsPayload.settings.version + 1 && updatedSettings.primaryTimezone === 'Africa/Lagos', 'Organization settings did not persist with optimistic versioning');
  await request(`/organizations/${free.id}/settings`, freeToken, {
    method: 'PUT', body: JSON.stringify({ ...settingsPayload.settings, primaryTimezone: 'UTC' }),
  }, 409);
  await request(`/organizations/${free.id}/settings`, freeToken, {
    method: 'PUT', body: JSON.stringify({ ...updatedSettings, primaryTimezone: 'Invalid/Timezone' }),
  }, 400);

  const foreignApplication = await prisma.application.create({ data: { name: 'Foreign app', organizationId: organizations.get('SOLO')!.id } });
  await request(`/organizations/${free.id}/settings`, freeToken, {
    method: 'PUT', body: JSON.stringify({ ...updatedSettings, defaultApplicationId: foreignApplication.id }),
  }, 400);

  const freeMember = await addMember(free.id, 'MEMBER', 'settings-free-member');
  await request(`/organizations/${free.id}/settings`, token(freeMember), {
    method: 'PUT', body: JSON.stringify({ ...updatedSettings, primaryTimezone: 'UTC' }),
  }, 403);
  await request(`/organizations/${free.id}/invitations`, freeToken, {
    method: 'POST', body: JSON.stringify({ email: `free-invite-${crypto.randomUUID()}@example.com`, role: 'MEMBER' }),
  }, 403);

  const team = organizations.get('TEAM')!;
  const teamOwner = owners.get('TEAM')!;
  const teamOwnerToken = token(teamOwner);
  const teamAdmin = await addMember(team.id, 'ADMIN', 'settings-team-admin');
  const teamMember = await addMember(team.id, 'MEMBER', 'settings-team-member');
  await request(`/organizations/${team.id}/invitations`, token(teamAdmin), {
    method: 'POST', body: JSON.stringify({ email: 'not-an-email', role: 'MEMBER' }),
  }, 400);
  const invitationEmail = `team-invite-${crypto.randomUUID()}@example.com`;
  const invitation = await request(`/organizations/${team.id}/invitations`, token(teamAdmin), {
    method: 'POST', body: JSON.stringify({ email: invitationEmail, role: 'MEMBER' }),
  }, 201);
  const pending = await request(`/organizations/${team.id}/invitations/pending`, teamOwnerToken);
  assert(pending.data.some((item: any) => item.id === invitation.id && item.email === invitationEmail), 'Pending invitation was not organization-scoped');
  await request(`/organizations/${team.id}/invitations/${invitation.id}`, token(teamAdmin), { method: 'DELETE' });

  await request(`/organizations/${team.id}/members/${teamMember.id}/role`, token(teamAdmin), {
    method: 'PUT', body: JSON.stringify({ role: 'ADMIN' }),
  }, 403);
  const roleChange = await request(`/organizations/${team.id}/members/${teamMember.id}/role`, teamOwnerToken, {
    method: 'PUT', body: JSON.stringify({ role: 'ADMIN' }),
  });
  assert(roleChange.role === 'ADMIN', 'Owner role change was not persisted');
  await request(`/organizations/${team.id}/members/${teamOwner.id}/role`, teamOwnerToken, {
    method: 'PUT', body: JSON.stringify({ role: 'MEMBER' }),
  }, 409);
  await request(`/organizations/${team.id}/members/${teamMember.id}`, teamOwnerToken, { method: 'DELETE' });
  assert(!await prisma.organizationMembership.findUnique({ where: { userId_organizationId: { userId: teamMember.id, organizationId: team.id } } }), 'Removed member retained organization access');

  const usage = await request(`/usage/organization/${team.id}`, teamOwnerToken);
  assert(usage.usage.some((item: any) => item.metric === 'USERS' && item.value === 2), 'Live team-member usage was not reflected in billing metrics');
  await request(`/usage/organization/${team.id}`, freeToken, {}, 403);

  await request(`/organizations/${team.id}/members`, freeToken, {}, 403);
  await request(`/organizations/${team.id}/settings`, freeToken, {}, 403);
  await request(`/organizations/${team.id}/audit-logs`, teamOwnerToken, {}, 403);
  const business = organizations.get('BUSINESS')!;
  await request(`/organizations/${business.id}/audit-logs`, token(owners.get('BUSINESS')!));

  console.log(JSON.stringify({
    success: true,
    profileUpdateVerified: true,
    organizationSettingsVerified: true,
    staleWriteRejected: true,
    settingsValidationVerified: true,
    foreignDefaultReferenceRejected: true,
    nonManagerWriteRejected: true,
    teamInvitationAndRescindVerified: true,
    roleGovernanceVerified: true,
    lastOwnerProtected: true,
    memberRemovalVerified: true,
    liveUsageVerified: true,
    crossTenantUsageDenied: true,
    crossTenantSettingsDenied: true,
    exactDesktopEntitlementMatrixVerified: true,
    auditEntitlementBoundaryVerified: true,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
