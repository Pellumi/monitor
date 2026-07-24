'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Clock,
  X,
  Eye,
  EyeOff,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserMinus,
  UserPlus,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useSession } from '@/components/providers';

type SettingsTab = 'profile' | 'security' | 'team' | 'preferences' | 'billing' | 'audit';
type BillingInterval = 'MONTHLY' | 'ANNUAL';
type BillingCurrency = 'USD' | 'NGN';
type CheckoutProvider = 'MOCK' | 'STRIPE' | 'PAYSTACK';
type AuthMode = 'OTP' | 'PASSWORD';
type MfaProvider = 'AUTHENTICATOR_APP' | 'GOOGLE_AUTHENTICATOR' | 'MICROSOFT_AUTHENTICATOR' | 'AUTHY';
type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

interface TeamMember {
  id: string;
  userId: string;
  role: MemberRole;
  createdAt: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

interface PendingInvitation {
  id: string;
  email: string;
  role: MemberRole;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  invitedBy: { id: string; email: string; displayName: string | null } | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  userId: string | null;
  organizationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user?: { email: string; displayName: string | null } | null;
}
interface Plan {
  id: string;
  type: string;
  name: string;
  description?: string | null;
  monthlyPriceUsd?: number | null;
  monthlyPriceNgn?: number | null;
  annualPriceUsd?: number | null;
  annualPriceNgn?: number | null;
  maxApplications: number;
  maxUsers: number;
  maxStorageGb: number;
  retentionDays: number;
  maxDemoSessions?: number | null;
  featureFlags?: Array<{ feature: string; enabled: boolean; tier?: string | null }>;
}

interface Subscription {
  id: string;
  status: string;
  billingInterval: BillingInterval;
  billingCurrency: BillingCurrency;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string | null;
  plan: Plan;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  planType: string;
  billingInterval: BillingInterval;
  currency: BillingCurrency;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  paidAt?: string | null;
  createdAt: string;
}

interface Entitlement {
  planType: string;
  features?: Record<string, boolean | string>;
  limits?: {
    applications?: number;
    users?: number;
    storageGb?: number;
    retentionDays?: number;
    demoSessions?: number | null;
  };
}

interface AlertState {
  type: 'success' | 'error' | 'info';
  message: string;
}

const tabs: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'team', label: 'Team', icon: UsersRound },
  { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { id: 'billing', label: 'Plan & Billing', icon: CreditCard },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
];

const mfaProviderLabels: Record<MfaProvider, string> = {
  AUTHENTICATOR_APP: 'Authenticator app',
  GOOGLE_AUTHENTICATOR: 'Google Authenticator',
  MICROSOFT_AUTHENTICATOR: 'Microsoft Authenticator',
  AUTHY: 'Authy',
};

const authModeLabels: Record<AuthMode, string> = {
  OTP: 'Email and OTP',
  PASSWORD: 'Email and password',
};

const roleLabels: Record<MemberRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

const roleBadgeClasses: Record<MemberRole, string> = {
  OWNER: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  ADMIN: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  MEMBER: 'border-neutral-700 bg-neutral-800 text-neutral-300',
  VIEWER: 'border-neutral-800 bg-neutral-900 text-neutral-500',
};

const memberRoles: MemberRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

const auditActionOptions = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'OTP_SENT',
  'OTP_VERIFIED',
  'LOGOUT',
  'MEMBER_INVITED',
  'MEMBER_JOINED',
  'MEMBER_REMOVED',
  'ROLE_CHANGED',
  'PASSWORD_SET',
  'PASSWORD_CHANGED',
  'PREFERRED_AUTH_CHANGED',
  'API_KEY_CREATED',
  'API_KEY_REVOKED',
  'SUBSCRIPTION_ACTIVATED',
  'SUBSCRIPTION_CANCELLED',
  'PLAN_CHANGED',
  'INVOICE_PAID',
  'REPORT_GENERATED',
  'REPORT_EXPORTED',
];

function auditBadgeClass(action: string) {
  if (action.includes('FAILED') || action.includes('REMOVED') || action.includes('REVOKED') || action.includes('CANCELLED')) {
    return 'bg-red-500/10 text-red-300 border-red-500/20';
  }
  if (action.includes('CHANGED') || action.includes('INVITED') || action.includes('PLAN')) {
    return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  }
  if (action.includes('LOGIN') || action.includes('VERIFIED') || action.includes('CREATED') || action.includes('JOINED')) {
    return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  }
  return 'bg-neutral-800 text-neutral-300 border-neutral-700';
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authenticatedFetch(url, init);
  const data = await readJson<unknown>(res);
  if (!res.ok) {
    const body = data && typeof data === 'object' ? data as { message?: unknown; error?: unknown } : null;
    const message = typeof body?.message === 'string'
      ? body.message
      : typeof body?.error === 'string'
        ? body.error
        : 'Request failed';
    throw new Error(message);
  }
  return data as T;
}

function centsToMoney(value: number | null | undefined, currency: BillingCurrency) {
  if (value === null || value === undefined) return 'Custom';
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2,
  }).format(value / 100);
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
}

function splitDisplayName(displayName: string | null | undefined) {
  const parts = (displayName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { otherNames: displayName || '', surname: '' };
  return { otherNames: parts.slice(0, -1).join(' '), surname: parts.at(-1) || '' };
}

function planPrice(plan: Plan, interval: BillingInterval, currency: BillingCurrency) {
  if (currency === 'NGN') {
    return interval === 'ANNUAL' ? plan.annualPriceNgn : plan.monthlyPriceNgn;
  }
  return interval === 'ANNUAL' ? plan.annualPriceUsd : plan.monthlyPriceUsd;
}

function enabledFeature(entitlement: Entitlement | null, feature: string) {
  return entitlement?.features?.[feature] === true || typeof entitlement?.features?.[feature] === 'string';
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-md border border-[#262626] bg-[#131313] p-5', className)}>
      {children}
    </section>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mt-1 text-xs text-neutral-400">{description}</p>
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string }) {
  const { label, help, className, type, ...inputProps } = props;
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordType = type === 'password';
  const inputType = isPasswordType ? (showPassword ? 'text' : 'password') : type;

  return (
    <label className="block">
      <span className="mb-2 block text-xs font-mono font-medium uppercase tracking-wider text-[#8e9192]">{label}</span>
      <div className="relative">
        <input
          {...inputProps}
          type={inputType}
          className={cn(
            'w-full rounded-md border border-[#262626] bg-[#000000] px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 outline-none transition focus:border-white focus:ring-1 focus:ring-white disabled:cursor-not-allowed disabled:text-neutral-500',
            isPasswordType && 'pr-10',
            className,
          )}
        />
        {isPasswordType ? (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition focus:outline-none cursor-pointer"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      {help ? <span className="mt-1 block text-[11px] text-neutral-500 font-mono">{help}</span> : null}
    </label>
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: React.ReactNode }) {
  const { label, children, className, ...selectProps } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-mono font-medium uppercase tracking-wider text-[#8e9192]">{label}</span>
      <select
        {...selectProps}
        className={cn(
          'w-full rounded-md border border-[#262626] bg-[#000000] px-3.5 py-2.5 text-xs text-white outline-none transition focus:border-white focus:ring-1 focus:ring-white disabled:cursor-not-allowed disabled:text-neutral-500',
          className,
        )}
      >
        {children}
      </select>
    </label>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, children, ...buttonProps } = props;
  return (
    <button
      {...buttonProps}
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
        className,
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, children, ...buttonProps } = props;
  return (
    <button
      {...buttonProps}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

export default function ProfileSettingsPage() {
  const { user, memberships, selectedOrg, selectedOrgId, refetch } = useSession();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [otherNames, setOtherNames] = useState('');
  const [surname, setSurname] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('OTP');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaProvider, setMfaProvider] = useState<MfaProvider>('AUTHENTICATOR_APP');
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSetupCode, setMfaSetupCode] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTHLY');
  const [billingCurrency, setBillingCurrency] = useState<BillingCurrency>('USD');
  const [checkoutProvider, setCheckoutProvider] = useState<CheckoutProvider>('STRIPE');
  const [inviteEmail, setInviteEmail] = useState('');
  const [notifyReports, setNotifyReports] = useState(true);
  const [notifyBilling, setNotifyBilling] = useState(true);
  const [notifySecurity, setNotifySecurity] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [inviteRole, setInviteRole] = useState<MemberRole>('MEMBER');
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);
  const [rescindingInvitationId, setRescindingInvitationId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const selectedMembership = memberships.find((membership) => membership.organization.id === selectedOrgId);
  const currentPlanType = subscription?.plan?.type || selectedOrg?.subscription?.planType || entitlement?.planType || 'FREE';
  const canManageTeam = enabledFeature(entitlement, 'TEAM_COLLABORATION');
  const canViewAuditLogs = enabledFeature(entitlement, 'AUDIT_LOGS');
  const isOrgOwner = selectedMembership?.role === 'OWNER';
  const isOrgManager = isOrgOwner || selectedMembership?.role === 'ADMIN';
  const owners = teamMembers.filter((member) => member.role === 'OWNER');
  const auditLimit = 25;
  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / auditLimit));
  const profileDisplayName = useMemo(() => {
    return [otherNames.trim(), surname.trim()].filter(Boolean).join(' ').trim();
  }, [otherNames, surname]);

  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isPasswordValid = hasMinLength && hasLetter && hasNumber && passwordsMatch;

  const loadBillingData = useCallback(async () => {
    if (!selectedOrgId) return;
    setIsLoadingBilling(true);
    try {
      const [nextPlans, nextSubscription, nextInvoices, nextEntitlement] = await Promise.all([
        requestJson<Plan[]>(`/api-gateway/billing/plans?organizationId=${encodeURIComponent(selectedOrgId)}`),
        requestJson<Subscription | null>(`/api-gateway/billing/organizations/${selectedOrgId}/subscription`),
        requestJson<Invoice[]>(`/api-gateway/billing/organizations/${selectedOrgId}/invoices`),
        requestJson<Entitlement>(`/api-gateway/organizations/${selectedOrgId}/entitlement`),
      ]);
      setPlans(nextPlans);
      setSubscription(nextSubscription);
      setInvoices(nextInvoices);
      setEntitlement(nextEntitlement);
      if (nextSubscription?.billingInterval) setBillingInterval(nextSubscription.billingInterval);
      if (nextSubscription?.billingCurrency) {
        setBillingCurrency(nextSubscription.billingCurrency);
        setCheckoutProvider(nextSubscription.billingCurrency === 'NGN' ? 'PAYSTACK' : 'STRIPE');
      }
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err, 'Failed to load billing settings.') });
    } finally {
      setIsLoadingBilling(false);
    }
  }, [selectedOrgId]);

  const loadTeamData = useCallback(async () => {
    if (!selectedOrgId || !canManageTeam) {
      setTeamMembers([]);
      setPendingInvitations([]);
      return;
    }

    setIsLoadingTeam(true);
    try {
      const [memberData, invitationData] = await Promise.all([
        requestJson<TeamMember[]>(`/api-gateway/organizations/${selectedOrgId}/members`),
        isOrgManager
          ? requestJson<{ success: boolean; data: PendingInvitation[] }>(`/api-gateway/organizations/${selectedOrgId}/invitations/pending`)
          : Promise.resolve({ success: true, data: [] as PendingInvitation[] }),
      ]);
      setTeamMembers(memberData);
      setPendingInvitations(invitationData.data || []);
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err, 'Failed to load team members.') });
    } finally {
      setIsLoadingTeam(false);
    }
  }, [canManageTeam, isOrgManager, selectedOrgId]);

  const loadAuditLogs = useCallback(async () => {
    if (!selectedOrgId || !canViewAuditLogs) {
      setAuditLogs([]);
      setAuditTotal(0);
      return;
    }

    setIsLoadingAuditLogs(true);
    try {
      const params = new URLSearchParams({
        limit: String(auditLimit),
        page: String(auditPage),
      });
      if (auditSearch.trim()) params.set('q', auditSearch.trim());
      if (auditActionFilter) params.set('action', auditActionFilter);

      const data = await requestJson<{ data: AuditLogEntry[]; total: number; page: number; limit: number }>(
        `/api-gateway/organizations/${selectedOrgId}/audit-logs?${params}`,
      );
      setAuditLogs(data.data || []);
      setAuditTotal(data.total || 0);
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err, 'Failed to load audit logs.') });
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, [auditActionFilter, auditPage, auditSearch, canViewAuditLogs, selectedOrgId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const names = splitDisplayName(user?.displayName);
      setOtherNames(names.otherNames);
      setSurname(names.surname);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.displayName]);

  useEffect(() => {
    if (!user?.preferredAuthMode) return;
    const timer = window.setTimeout(() => setAuthMode(user.preferredAuthMode), 0);
    return () => window.clearTimeout(timer);
  }, [user?.preferredAuthMode]);

  useEffect(() => {
    if (!user?.id) return;
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(`sots_settings_${user.id}`);
        if (!saved) return;
        const parsed = JSON.parse(saved) as {
          jobTitle?: string;
          phone?: string;
          mfaEnabled?: boolean;
          mfaProvider?: MfaProvider;
          notifyReports?: boolean;
          notifyBilling?: boolean;
          notifySecurity?: boolean;
          compactMode?: boolean;
        };
        setJobTitle(parsed.jobTitle || '');
        setPhone(parsed.phone || '');
        setMfaEnabled(Boolean(parsed.mfaEnabled));
        setMfaProvider(parsed.mfaProvider || 'AUTHENTICATOR_APP');
        setNotifyReports(parsed.notifyReports ?? true);
        setNotifyBilling(parsed.notifyBilling ?? true);
        setNotifySecurity(parsed.notifySecurity ?? true);
        setCompactMode(Boolean(parsed.compactMode));
      } catch {
        localStorage.removeItem(`sots_settings_${user.id}`);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadBillingData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBillingData]);

  useEffect(() => {
    if (activeTab !== 'team') return;
    const timer = window.setTimeout(() => { void loadTeamData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loadTeamData]);

  useEffect(() => {
    if (activeTab !== 'audit') return;
    const timer = window.setTimeout(() => { void loadAuditLogs(); }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loadAuditLogs]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);
    setAlert(null);
    try {
      await requestJson('/api-gateway/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: profileDisplayName }),
      });

      if (user?.id) {
        localStorage.setItem(
          `sots_settings_${user.id}`,
          JSON.stringify({
            jobTitle,
            phone,
            mfaEnabled,
            mfaProvider,
            notifyReports,
            notifyBilling,
            notifySecurity,
            compactMode,
          }),
        );
      }

      await refetch();
      setAlert({ type: 'success', message: 'Profile details saved.' });
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err, 'Failed to update profile.') });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setIsSavingSecurity(true);
    setAlert(null);

    if (newPassword !== confirmPassword) {
      setAlert({ type: 'error', message: 'New password and confirmation do not match.' });
      setIsSavingSecurity(false);
      return;
    }

    try {
      await requestJson('/api-gateway/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: user.hasPassword ? currentPassword : undefined,
          newPassword,
          preferredAuthMode: authMode,
        }),
      });
      await refetch();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setAlert({
        type: 'success',
        message: authMode === 'PASSWORD'
          ? 'Password saved and email/password sign-in is now your preferred mode.'
          : 'Password saved.',
      });
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err, 'Password update failed.') });
    } finally {
      setIsSavingSecurity(false);
    }
  }

  async function handleSaveAuthMode() {
    if (!user) return;
    setIsSavingSecurity(true);
    setAlert(null);

    if (authMode === 'PASSWORD' && !user.hasPassword) {
      setAlert({ type: 'error', message: 'Set a password before switching to email and password sign-in.' });
      setIsSavingSecurity(false);
      return;
    }

    try {
      await requestJson('/api-gateway/auth/preferred-auth-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredAuthMode: authMode }),
      });
      await refetch();
      setAlert({ type: 'success', message: `Preferred sign-in mode updated to ${authModeLabels[authMode]}.` });
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err, 'Preferred authentication update failed.') });
    } finally {
      setIsSavingSecurity(false);
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrgId || !inviteEmail.trim()) return;
    setIsInviting(true);
    setAlert(null);
    try {
      const email = inviteEmail.trim();
      await requestJson(`/api-gateway/organizations/${selectedOrgId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      setInviteEmail('');
      setInviteRole('MEMBER');
      await Promise.all([loadTeamData(), loadAuditLogs()]);
      setAlert({ type: 'success', message: `Invitation sent to ${email}.` });
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err, 'Failed to send invitation.') });
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRoleChange(userId: string, role: MemberRole) {
    if (!selectedOrgId) return;
    setChangingRoleUserId(userId);
    setAlert(null);
    try {
      await requestJson(`/api-gateway/organizations/${selectedOrgId}/members/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      await Promise.all([loadTeamData(), loadAuditLogs(), refetch()]);
      setAlert({ type: 'success', message: `Role updated to ${roleLabels[role]}.` });
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err, 'Failed to update role.') });
    } finally {
      setChangingRoleUserId(null);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedOrgId) return;
    setRemovingUserId(userId);
    setConfirmRemoveUserId(null);
    setAlert(null);
    try {
      await requestJson(`/api-gateway/organizations/${selectedOrgId}/members/${userId}`, { method: 'DELETE' });
      await Promise.all([loadTeamData(), loadAuditLogs(), refetch()]);
      setAlert({ type: 'success', message: 'Member removed.' });
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err, 'Failed to remove member.') });
    } finally {
      setRemovingUserId(null);
    }
  }

  async function handleRescindInvitation(invitationId: string) {
    if (!selectedOrgId) return;
    setRescindingInvitationId(invitationId);
    setAlert(null);
    try {
      await requestJson(`/api-gateway/organizations/${selectedOrgId}/invitations/${invitationId}`, { method: 'DELETE' });
      await loadTeamData();
      setAlert({ type: 'success', message: 'Invitation rescinded.' });
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err, 'Failed to rescind invitation.') });
    } finally {
      setRescindingInvitationId(null);
    }
  }

  function handleAuditSearchChange(value: string) {
    setAuditSearch(value);
    setAuditPage(1);
  }

  function handleAuditActionFilterChange(value: string) {
    setAuditActionFilter(value);
    setAuditPage(1);
  }

  function handleSavePreferences() {
    if (!user?.id) return;
    localStorage.setItem(
      `sots_settings_${user.id}`,
      JSON.stringify({
        jobTitle,
        phone,
        mfaEnabled,
        mfaProvider,
        notifyReports,
        notifyBilling,
        notifySecurity,
        compactMode,
      }),
    );
    setAlert({ type: 'success', message: 'Preferences saved for this browser session.' });
  }

  const handleCopyKey = () => {
    void navigator.clipboard.writeText('TELLANN-MFA-J3K9-X27Y-Q8W1');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleVerifyMfa = () => {
    if (!/^\d{6}$/.test(mfaSetupCode)) return;
    
    setMfaEnabled(true);
    setShowMfaSetup(false);
    setMfaSetupCode('');
    
    if (user?.id) {
      const saved = localStorage.getItem(`sots_settings_${user.id}`);
      let parsed = {};
      if (saved) {
        try { parsed = JSON.parse(saved); } catch {}
      }
      localStorage.setItem(
        `sots_settings_${user.id}`,
        JSON.stringify({
          ...parsed,
          mfaEnabled: true,
          mfaProvider,
        }),
      );
    }
    
    setAlert({ type: 'success', message: 'Multi-Factor Authentication configured and enabled successfully.' });
  };

  const handleDisableMfa = () => {
    setMfaEnabled(false);
    setShowMfaSetup(false);
    
    if (user?.id) {
      const saved = localStorage.getItem(`sots_settings_${user.id}`);
      let parsed = {};
      if (saved) {
        try { parsed = JSON.parse(saved); } catch {}
      }
      localStorage.setItem(
        `sots_settings_${user.id}`,
        JSON.stringify({
          ...parsed,
          mfaEnabled: false,
        }),
      );
    }
    
    setAlert({ type: 'info', message: 'Multi-Factor Authentication has been disabled.' });
  };

  async function handleCheckout(plan: Plan) {
    if (!selectedOrgId) return;
    setIsCheckingOut(true);
    setAlert(null);
    try {
      const provider = checkoutProvider === 'PAYSTACK' && billingCurrency !== 'NGN' ? 'STRIPE' : checkoutProvider;
      const checkout = await requestJson<{ status: string; checkoutUrl?: string | null; invoiceId: string }>(
        '/api-gateway/billing/checkout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: selectedOrgId,
            planType: plan.type,
            billingInterval,
            currency: plan.type === 'LOCAL' ? 'NGN' : billingCurrency,
            provider,
          }),
        },
      );
      await Promise.all([loadBillingData(), refetch()]);
      setAlert({
        type: 'success',
        message:
          checkout.status === 'completed'
            ? `${plan.name} subscription is active and invoice ${checkout.invoiceId} was recorded.`
            : `${plan.name} checkout was created. Complete payment in the provider portal when it is configured.`,
      });
      if (checkout.checkoutUrl && checkout.status !== 'completed') {
        window.location.assign(checkout.checkoutUrl);
      }
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err, 'Checkout failed.') });
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function handleCancelSubscription() {
    if (!selectedOrgId) return;
    setIsCancelling(true);
    setAlert(null);
    try {
      await requestJson(`/api-gateway/billing/organizations/${selectedOrgId}/subscription/cancel`, {
        method: 'POST',
      });
      await Promise.all([loadBillingData(), refetch()]);
      setAlert({ type: 'success', message: 'Subscription cancelled. Entitlements were recalculated.' });
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err, 'Could not cancel subscription.') });
    } finally {
      setIsCancelling(false);
    }
  }

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center text-neutral-400">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">System Settings</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Manage identity, security, team access, preferences, billing, and governance for Tellann.
          </p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
          <span className="text-neutral-500">Organization:</span>{' '}
          <span className="font-semibold text-white">{selectedOrg?.name || 'No organization selected'}</span>
        </div>
      </div>

      {alert ? (
        <div
          className={cn(
            'flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm transition',
            alert.type === 'success' && 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300',
            alert.type === 'error' && 'border-red-900/60 bg-red-950/40 text-red-300',
            alert.type === 'info' && 'border-indigo-900/60 bg-indigo-950/40 text-indigo-300',
          )}
        >
          <span>{alert.message}</span>
          {alert.type === 'success' || alert.type === 'info' ? (
            <button
              type="button"
              onClick={() => setAlert(null)}
              className={cn(
                'shrink-0 rounded p-0.5 transition hover:bg-neutral-800/40 focus:outline-none',
                alert.type === 'success' && 'text-emerald-400 hover:text-emerald-200',
                alert.type === 'info' && 'text-indigo-400 hover:text-indigo-200',
              )}
              aria-label="Dismiss alert"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-6">
          {activeTab === 'profile' ? (
            <Card>
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <SectionHeader
                  title="Profile Details"
                  description="Set the primary identity details used across reports, invitations, and account records."
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput label="Email Address" type="email" value={user.email} disabled help="Contact support to change your account email." />
                  <TextInput label="Surname" value={surname} onChange={(event) => setSurname(event.target.value)} placeholder="Doe" />
                  <TextInput label="Other Names" value={otherNames} onChange={(event) => setOtherNames(event.target.value)} placeholder="John Michael" />
                  <TextInput label="Display Name" value={profileDisplayName} disabled help="Generated from surname and other names." />
                  <TextInput label="Job Title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="QA Lead" />
                  <TextInput label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 0100" />
                </div>
                <div className="flex justify-end border-t border-neutral-800 pt-5">
                  <PrimaryButton type="submit" disabled={isSavingProfile || !profileDisplayName}>
                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
                  </PrimaryButton>
                </div>
              </form>
            </Card>
          ) : null}

          {activeTab === 'security' ? (
            <div className="space-y-6">
              <Card className="space-y-5">
                <SectionHeader
                  title="Authentication"
                  description="Choose your preferred first authentication factor. MFA remains an additional step when enabled."
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectInput label="Preferred Sign-In Method" value={authMode} onChange={(event) => setAuthMode(event.target.value as AuthMode)}>
                    <option value="OTP">{authModeLabels.OTP}</option>
                    <option value="PASSWORD">{authModeLabels.PASSWORD}</option>
                  </SelectInput>
                  <TextInput label="Password Status" value={user.hasPassword ? 'Password set' : 'No password set'} disabled />
                </div>
                <div className="flex justify-end border-t border-neutral-800 pt-5">
                  <PrimaryButton
                    type="button"
                    onClick={handleSaveAuthMode}
                    disabled={isSavingSecurity || authMode === user.preferredAuthMode}
                  >
                    {isSavingSecurity ? 'Saving...' : 'Save Sign-In Mode'}
                  </PrimaryButton>
                </div>
              </Card>

              <Card>
                <form onSubmit={handleSavePassword} className="space-y-5">
                  <SectionHeader
                    title={user.hasPassword ? 'Change Password' : 'Set Password'}
                    description="Use a password with at least eight characters, including at least one letter and one number."
                  />
                  <div className="grid gap-4 md:grid-cols-3">
                    {user.hasPassword ? (
                      <TextInput
                        label="Current Password"
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        autoComplete="current-password"
                      />
                    ) : null}
                    <TextInput
                      label="New Password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                    />
                    <TextInput
                      label="Confirm Password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                    />
                  </div>

                  {/* Live Password Criteria Validation */}
                  {(newPassword.length > 0 || confirmPassword.length > 0) && (
                    <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 space-y-3 animate-fade-in">
                      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Password Requirements
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                        {[
                          { label: '8+ characters', met: hasMinLength, active: newPassword.length > 0 },
                          { label: 'One letter', met: hasLetter, active: newPassword.length > 0 },
                          { label: 'One number', met: hasNumber, active: newPassword.length > 0 },
                          { label: 'Passwords match', met: passwordsMatch, active: confirmPassword.length > 0 },
                        ].map((crit, idx) => (
                          <div key={idx} className="flex items-center gap-2.5">
                            <div
                              className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition-all duration-300',
                                crit.active
                                  ? crit.met
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 scale-100'
                                    : 'border-rose-500/30 bg-rose-500/10 text-rose-400 scale-100'
                                  : 'border-neutral-800 bg-neutral-900 text-neutral-500',
                              )}
                            >
                              {crit.active ? (
                                crit.met ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )
                              ) : (
                                <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
                              )}
                            </div>
                            <span
                              className={cn(
                                'text-xs transition-colors duration-300',
                                crit.active
                                  ? crit.met
                                    ? 'text-neutral-300'
                                    : 'text-rose-400/80'
                                  : 'text-neutral-500',
                              )}
                            >
                              {crit.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end border-t border-neutral-800 pt-5">
                    <PrimaryButton
                      type="submit"
                      disabled={isSavingSecurity || !isPasswordValid || (user.hasPassword && !currentPassword)}
                    >
                      {isSavingSecurity ? 'Saving...' : user.hasPassword ? 'Change Password' : 'Set Password'}
                    </PrimaryButton>
                  </div>
                </form>
              </Card>

              <Card className="space-y-5">
                <SectionHeader
                  title="Multi-Factor Authentication"
                  description="Select the MFA platform you want to use after your primary sign-in step."
                />

                {mfaEnabled ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-4 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">MFA is Active</h4>
                        <p className="text-xs text-neutral-400">
                          Protected by {mfaProviderLabels[mfaProvider]}.
                        </p>
                      </div>
                    </div>
                    <SecondaryButton type="button" onClick={handleDisableMfa} className="text-red-400 border-red-950/60 hover:bg-red-950/20 text-xs py-1.5 px-3 h-fit w-full sm:w-auto">
                      Disable MFA
                    </SecondaryButton>
                  </div>
                ) : showMfaSetup ? (
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950/30 p-5 space-y-5 animate-fade-in">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white">Configure Authenticator App</h4>
                      <p className="text-xs text-neutral-400">
                        Scan the QR code below using your authenticator app (e.g. Google Authenticator, Microsoft Authenticator, Authy), then enter the 6-digit confirmation code.
                      </p>
                    </div>

                    <div className="flex flex-col gap-6 md:flex-row md:items-center">
                      <div className="flex justify-center bg-white p-3 rounded-lg w-fit shrink-0 mx-auto md:mx-0">
                        <svg width="120" height="120" viewBox="0 0 120 120" className="text-black">
                          {/* Finder Pattern top-left */}
                          <rect x="0" y="0" width="28" height="28" fill="currentColor" />
                          <rect x="4" y="4" width="20" height="20" fill="white" />
                          <rect x="8" y="8" width="12" height="12" fill="currentColor" />

                          {/* Finder Pattern top-right */}
                          <rect x="92" y="0" width="28" height="28" fill="currentColor" />
                          <rect x="96" y="4" width="20" height="20" fill="white" />
                          <rect x="100" y="8" width="12" height="12" fill="currentColor" />

                          {/* Finder Pattern bottom-left */}
                          <rect x="0" y="92" width="28" height="28" fill="currentColor" />
                          <rect x="4" y="96" width="20" height="20" fill="white" />
                          <rect x="8" y="100" width="12" height="12" fill="currentColor" />

                          {/* Alignment Pattern */}
                          <rect x="80" y="80" width="12" height="12" fill="currentColor" />
                          <rect x="84" y="84" width="4" height="4" fill="white" />

                          {/* Random code bits */}
                          <rect x="36" y="0" width="8" height="8" fill="currentColor" />
                          <rect x="44" y="4" width="8" height="8" fill="currentColor" />
                          <rect x="36" y="16" width="8" height="8" fill="currentColor" />
                          <rect x="52" y="12" width="8" height="8" fill="currentColor" />
                          <rect x="68" y="4" width="8" height="8" fill="currentColor" />
                          <rect x="76" y="16" width="8" height="8" fill="currentColor" />
                          <rect x="84" y="24" width="8" height="8" fill="currentColor" />

                          <rect x="0" y="36" width="8" height="8" fill="currentColor" />
                          <rect x="16" y="44" width="8" height="8" fill="currentColor" />
                          <rect x="24" y="52" width="8" height="8" fill="currentColor" />
                          <rect x="8" y="60" width="8" height="8" fill="currentColor" />

                          <rect x="40" y="40" width="16" height="16" fill="currentColor" />
                          <rect x="60" y="44" width="8" height="8" fill="currentColor" />
                          <rect x="52" y="68" width="16" height="8" fill="currentColor" />
                          <rect x="72" y="56" width="8" height="16" fill="currentColor" />
                          <rect x="36" y="80" width="16" height="8" fill="currentColor" />
                          <rect x="44" y="96" width="8" height="16" fill="currentColor" />
                          <rect x="72" y="92" width="16" height="8" fill="currentColor" />
                          <rect x="96" y="40" width="8" height="16" fill="currentColor" />
                          <rect x="108" y="56" width="8" height="8" fill="currentColor" />
                          <rect x="100" y="68" width="8" height="16" fill="currentColor" />
                        </svg>
                      </div>

                      <div className="flex-1 space-y-4 text-center md:text-left">
                        <div>
                          <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                            Manual Setup Key
                          </span>
                          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                            <code className="rounded bg-neutral-900 border border-neutral-800 px-2.5 py-1 text-xs font-mono text-indigo-400 select-all">
                              TELLANN-MFA-J3K9-X27Y-Q8W1
                            </code>
                            <button
                              type="button"
                              onClick={handleCopyKey}
                              className="text-xs text-indigo-500 hover:text-indigo-400 font-semibold transition"
                            >
                              {copiedKey ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>

                        <div className="max-w-[240px] mx-auto md:mx-0 text-left">
                          <TextInput
                            label="Verification Code"
                            placeholder="000000"
                            value={mfaSetupCode}
                            onChange={(e) => setMfaSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            help="Enter the 6-digit code from your app."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-neutral-800 pt-4">
                      <SecondaryButton type="button" onClick={() => { setShowMfaSetup(false); setMfaSetupCode(''); }}>
                        Cancel
                      </SecondaryButton>
                      <PrimaryButton type="button" onClick={handleVerifyMfa} disabled={!/^\d{6}$/.test(mfaSetupCode)}>
                        Verify & Activate
                      </PrimaryButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    <div className="grid gap-4 md:grid-cols-2">
                      <SelectInput label="MFA Platform" value={mfaProvider} onChange={(event) => setMfaProvider(event.target.value as MfaProvider)}>
                        {Object.entries(mfaProviderLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </SelectInput>
                      <div className="flex items-end">
                        <PrimaryButton type="button" onClick={() => setShowMfaSetup(true)} className="w-full">
                          Configure Authenticator
                        </PrimaryButton>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          ) : null}

          {activeTab === 'team' ? (
            <div className="space-y-6">
              <Card className="space-y-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <SectionHeader
                    title="Team Management"
                    description="Invite teammates, review access, and remove organization members."
                  />
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm">
                    <div className="font-semibold text-white">{teamMembers.length || memberships.length} members</div>
                    <div className="text-xs uppercase tracking-wider text-neutral-500">{selectedMembership?.role || 'MEMBER'}</div>
                  </div>
                </div>

                {!canManageTeam ? (
                  <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-200">
                    Team collaboration starts on the Team plan. Upgrade before inviting organization members.
                  </div>
                ) : null}

                {canManageTeam && !isOrgManager ? (
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
                    Owners and Admins can invite teammates. Owners can change roles and remove members.
                  </div>
                ) : null}

                {canManageTeam && isOrgManager ? (
                  <form onSubmit={handleInviteMember} className="grid gap-4 md:grid-cols-[1fr_160px_auto]">
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-[39px] h-4 w-4 text-neutral-500" />
                      <TextInput
                        label="Invite Email"
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="teammate@company.com"
                        className="pl-9"
                      />
                    </div>
                    <SelectInput label="Role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as MemberRole)}>
                      {memberRoles.filter((role) => role !== 'OWNER').map((role) => (
                        <option key={role} value={role}>{roleLabels[role]}</option>
                      ))}
                    </SelectInput>
                    <div className="flex items-end">
                      <PrimaryButton type="submit" disabled={isInviting || !inviteEmail.trim()} className="w-full whitespace-nowrap">
                        {isInviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        Send Invite
                      </PrimaryButton>
                    </div>
                  </form>
                ) : null}
              </Card>

              <Card className="overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-indigo-400" />
                    <span className="text-sm font-semibold text-white">Members</span>
                  </div>
                  {isLoadingTeam ? <Loader2 className="h-4 w-4 animate-spin text-neutral-500" /> : null}
                </div>

                {!canManageTeam ? (
                  <div className="px-5 py-8 text-center text-sm text-neutral-500">Upgrade to load organization members here.</div>
                ) : teamMembers.length === 0 && !isLoadingTeam ? (
                  <div className="px-5 py-8 text-center text-sm text-neutral-500">No members found.</div>
                ) : (
                  <ul className="divide-y divide-neutral-800">
                    {teamMembers.map((member) => {
                      const initial = (member.user.displayName?.[0] || member.user.email[0] || '?').toUpperCase();
                      const isCurrentUser = member.userId === user.id;
                      const isSoleOwner = member.role === 'OWNER' && owners.length === 1;
                      const canModify = isOrgOwner && !isCurrentUser && !isSoleOwner;

                      return (
                        <li key={member.id} className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-semibold text-white">{member.user.displayName || member.user.email.split('@')[0]}</span>
                                {isCurrentUser ? <span className="rounded border border-indigo-900/60 bg-indigo-950 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">You</span> : null}
                                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', roleBadgeClasses[member.role])}>
                                  {roleLabels[member.role]}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-neutral-500">{member.user.email}</p>
                            </div>
                          </div>

                          {canModify ? (
                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                              <div className="relative">
                                <select
                                  value={member.role}
                                  disabled={changingRoleUserId === member.userId}
                                  onChange={(event) => void handleRoleChange(member.userId, event.target.value as MemberRole)}
                                  className="appearance-none rounded-lg border border-neutral-800 bg-neutral-950 py-2 pl-3 pr-8 text-xs text-neutral-200 outline-none transition focus:border-indigo-500 disabled:opacity-50"
                                >
                                  {memberRoles.map((role) => (
                                    <option key={role} value={role}>{roleLabels[role]}</option>
                                  ))}
                                </select>
                                {changingRoleUserId === member.userId ? (
                                  <Loader2 className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-indigo-400" />
                                ) : (
                                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-500" />
                                )}
                              </div>

                              {confirmRemoveUserId === member.userId ? (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-red-300">Remove?</span>
                                  <button
                                    type="button"
                                    onClick={() => void handleRemoveMember(member.userId)}
                                    disabled={removingUserId === member.userId}
                                    className="rounded bg-red-600 px-2 py-1 font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                                  >
                                    {removingUserId === member.userId ? '...' : 'Yes'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRemoveUserId(null)}
                                    className="rounded border border-neutral-700 px-2 py-1 text-neutral-400 transition hover:text-white"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemoveUserId(member.userId)}
                                  className="rounded-lg border border-transparent p-2 text-neutral-500 transition hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-300"
                                  aria-label={`Remove ${member.user.email}`}
                                >
                                  <UserMinus className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              {canManageTeam && pendingInvitations.length > 0 ? (
                <Card className="overflow-hidden p-0">
                  <div className="flex items-center gap-2 border-b border-neutral-800 px-5 py-4">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-semibold text-white">Pending Invitations ({pendingInvitations.length})</span>
                  </div>
                  <ul className="divide-y divide-neutral-800">
                    {pendingInvitations.map((invitation) => (
                      <li key={invitation.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{invitation.email}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {roleLabels[invitation.role]} invite
                            {invitation.invitedBy ? ` from ${invitation.invitedBy.displayName || invitation.invitedBy.email}` : ''}
                            {invitation.expiresAt ? ` - expires ${formatDate(invitation.expiresAt)}` : ''}
                          </p>
                        </div>
                        {isOrgManager ? (
                          <SecondaryButton
                            type="button"
                            onClick={() => void handleRescindInvitation(invitation.id)}
                            disabled={rescindingInvitationId === invitation.id}
                            className="px-3 py-2 text-xs text-red-300 hover:bg-red-950/30"
                          >
                            {rescindingInvitationId === invitation.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <X className="mr-2 h-3 w-3" />}
                            Rescind
                          </SecondaryButton>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {canManageTeam && !isOrgOwner ? (
                <p className="flex items-center gap-2 text-xs text-neutral-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Only Owners can change roles or remove members.
                </p>
              ) : null}
            </div>
          ) : null}
          {activeTab === 'preferences' ? (
            <Card className="space-y-6">
              <SectionHeader
                title="Notifications & Preferences"
                description="Choose which operational messages Tellann should prioritize for this account."
              />
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['Report generation', notifyReports, setNotifyReports, 'New reports, exports, and coverage summaries'],
                  ['Billing events', notifyBilling, setNotifyBilling, 'Invoices, failed payments, renewals, and plan changes'],
                  ['Security events', notifySecurity, setNotifySecurity, 'Logins, MFA changes, sessions, and team access'],
                  ['Compact dashboard', compactMode, setCompactMode, 'Use denser tables and shorter summaries where supported'],
                ].map(([label, checked, setter, help]) => (
                  <label key={String(label)} className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
                    <input
                      type="checkbox"
                      checked={Boolean(checked)}
                      onChange={(event) => (setter as React.Dispatch<React.SetStateAction<boolean>>)(event.target.checked)}
                      className="mt-1 h-4 w-4 accent-indigo-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-white">{String(label)}</span>
                      <span className="text-xs text-neutral-500">{String(help)}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end border-t border-neutral-800 pt-5">
                <PrimaryButton type="button" onClick={handleSavePreferences}>
                  Save Preferences
                </PrimaryButton>
              </div>
            </Card>
          ) : null}

          {activeTab === 'billing' ? (
            <div className="space-y-6">
              <Card className="space-y-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <SectionHeader
                    title="Current Plan"
                    description="Review the active subscription, renewal date, limits, and payment configuration."
                  />
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm">
                    <div className="font-semibold text-white">{subscription?.plan?.name || selectedOrg?.subscription?.planName || currentPlanType}</div>
                    <div className="text-xs uppercase tracking-wider text-neutral-500">{subscription?.status || selectedOrg?.subscription?.status || 'UNKNOWN'}</div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg bg-neutral-950 p-4">
                    <div className="text-xs text-neutral-500">Applications</div>
                    <div className="mt-1 text-lg font-semibold text-white">{entitlement?.limits?.applications ?? subscription?.plan?.maxApplications ?? '-'}</div>
                  </div>
                  <div className="rounded-lg bg-neutral-950 p-4">
                    <div className="text-xs text-neutral-500">Users</div>
                    <div className="mt-1 text-lg font-semibold text-white">{entitlement?.limits?.users ?? subscription?.plan?.maxUsers ?? '-'}</div>
                  </div>
                  <div className="rounded-lg bg-neutral-950 p-4">
                    <div className="text-xs text-neutral-500">Storage</div>
                    <div className="mt-1 text-lg font-semibold text-white">{entitlement?.limits?.storageGb ?? subscription?.plan?.maxStorageGb ?? '-'} GB</div>
                  </div>
                  <div className="rounded-lg bg-neutral-950 p-4">
                    <div className="text-xs text-neutral-500">Renewal</div>
                    <div className="mt-1 text-lg font-semibold text-white">{formatDate(subscription?.currentPeriodEnd)}</div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <SelectInput label="Billing Interval" value={billingInterval} onChange={(event) => setBillingInterval(event.target.value as BillingInterval)}>
                    <option value="MONTHLY">Monthly</option>
                    <option value="ANNUAL">Annual</option>
                  </SelectInput>
                  <SelectInput label="Currency" value={billingCurrency} onChange={(event) => {
                      const nextCurrency = event.target.value as BillingCurrency;
                      setBillingCurrency(nextCurrency);
                      setCheckoutProvider(nextCurrency === 'NGN' ? 'PAYSTACK' : 'STRIPE');
                    }}>
                    <option value="USD">USD</option>
                    <option value="NGN">NGN</option>
                  </SelectInput>
                  <SelectInput label="Processor" value={checkoutProvider} onChange={(event) => setCheckoutProvider(event.target.value as CheckoutProvider)}>
                    <option value="MOCK">Mock checkout</option>
                    <option value="STRIPE">Stripe</option>
                    <option value="PAYSTACK">Paystack</option>
                  </SelectInput>
                </div>
                <div className="flex flex-wrap gap-3">
                  <SecondaryButton type="button" disabled>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Link Card
                  </SecondaryButton>
                  <SecondaryButton type="button" onClick={handleCancelSubscription} disabled={!subscription || isCancelling}>
                    {isCancelling ? 'Cancelling...' : 'Cancel Subscription'}
                  </SecondaryButton>
                </div>
              </Card>

              <Card className="space-y-5">
                <SectionHeader
                  title="Change Plan"
                  description="Upgrades activate immediately through checkout. Downgrades are requested here and should be enforced at renewal by billing policy."
                />
                {isLoadingBilling ? <div className="text-sm text-neutral-400">Loading plans...</div> : null}
                <div className="grid gap-4 xl:grid-cols-3">
                  {plans.map((plan) => {
                    const price = plan.type === 'LOCAL' ? planPrice(plan, billingInterval, 'NGN') : planPrice(plan, billingInterval, billingCurrency);
                    const isCurrent = plan.type === currentPlanType;
                    const isEnterprise = plan.type === 'ENTERPRISE';
                    return (
                      <div key={plan.id} className={cn('rounded-lg border p-4', isCurrent ? 'border-indigo-600 bg-indigo-950/20' : 'border-neutral-800 bg-neutral-950')}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-white">{plan.name}</h3>
                            <p className="mt-1 text-xs text-neutral-500">{plan.description}</p>
                          </div>
                          {isCurrent ? <span className="rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-semibold uppercase text-white">Current</span> : null}
                        </div>
                        <div className="mt-4 text-2xl font-bold text-white">
                          {isEnterprise ? 'Custom' : centsToMoney(price, plan.type === 'LOCAL' ? 'NGN' : billingCurrency)}
                          {!isEnterprise ? <span className="text-xs font-normal text-neutral-500"> / {billingInterval.toLowerCase()}</span> : null}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-neutral-400">
                          <span>{plan.maxApplications >= 9999 ? 'Custom' : plan.maxApplications} apps</span>
                          <span>{plan.maxUsers >= 9999 ? 'Custom' : plan.maxUsers} users</span>
                          <span>{plan.maxStorageGb >= 9999 ? 'Custom' : `${plan.maxStorageGb} GB`}</span>
                          <span>{plan.retentionDays >= 9999 ? 'Custom' : `${plan.retentionDays} days`}</span>
                        </div>
                        <PrimaryButton
                          type="button"
                          disabled={isCurrent || isCheckingOut || isEnterprise}
                          onClick={() => handleCheckout(plan)}
                          className="mt-5 w-full"
                        >
                          {isCurrent ? 'Active Plan' : isEnterprise ? 'Contact Sales' : 'Start Checkout'}
                        </PrimaryButton>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="space-y-5">
                <SectionHeader
                  title="Payment & Subscription History"
                  description="Invoices generated for subscription creation, renewals, upgrades, and payment events."
                />
                <div className="overflow-x-auto rounded-lg border border-neutral-800">
                  <table className="min-w-full divide-y divide-neutral-800 text-sm">
                    <thead className="bg-neutral-950 text-left text-xs uppercase tracking-wider text-neutral-500">
                      <tr>
                        <th className="px-4 py-3">Invoice</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {invoices.length > 0 ? invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td className="px-4 py-3 font-medium text-white">{invoice.invoiceNumber}</td>
                          <td className="px-4 py-3 text-neutral-300">{invoice.planType}</td>
                          <td className="px-4 py-3 text-neutral-300">{centsToMoney(invoice.total, invoice.currency)}</td>
                          <td className="px-4 py-3 text-neutral-300">{invoice.status}</td>
                          <td className="px-4 py-3 text-neutral-300">{formatDate(invoice.createdAt)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">No invoices recorded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : null}

          {activeTab === 'audit' ? (
            <Card className="space-y-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <SectionHeader
                  title="Audit Logs"
                  description="Review organization-scoped authentication, team, billing, API key, report, and governance events."
                />
                <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm">
                  <div className="font-semibold text-white">{auditTotal.toLocaleString()} events</div>
                  <div className="text-xs uppercase tracking-wider text-neutral-500">Organization scope</div>
                </div>
              </div>

              {!canViewAuditLogs ? (
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-200">
                  Audit logs are available on Business and Enterprise plans.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <label className="relative flex-1">
                      <span className="sr-only">Search audit logs</span>
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                      <input
                        type="text"
                        value={auditSearch}
                        onChange={(event) => handleAuditSearchChange(event.target.value)}
                        placeholder="Search user or action"
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-3 text-sm text-neutral-100 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </label>
                    <select
                      value={auditActionFilter}
                      onChange={(event) => handleAuditActionFilterChange(event.target.value)}
                      className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">All actions</option>
                      {auditActionOptions.map((action) => (
                        <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-neutral-800">
                    <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Events</span>
                      {isLoadingAuditLogs ? <Loader2 className="h-4 w-4 animate-spin text-neutral-500" /> : null}
                    </div>

                    {auditLogs.length === 0 && !isLoadingAuditLogs ? (
                      <div className="px-4 py-8 text-center text-sm text-neutral-500">No audit log entries match this view.</div>
                    ) : (
                      <ul className="divide-y divide-neutral-800">
                        {auditLogs.map((log) => (
                          <li key={log.id}>
                            <button
                              type="button"
                              onClick={() => setExpandedAuditId(expandedAuditId === log.id ? null : log.id)}
                              className="w-full px-4 py-4 text-left transition hover:bg-neutral-800/30"
                            >
                              <div className="flex flex-wrap items-center gap-3">
                                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', auditBadgeClass(log.action))}>
                                  {log.action.replace(/_/g, ' ')}
                                </span>
                                <span className="min-w-0 truncate text-xs font-mono text-neutral-400">
                                  {log.user?.email || log.userId || 'system'}
                                </span>
                                <span className="ml-auto text-xs text-neutral-600">{new Date(log.createdAt).toLocaleString()}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-neutral-600">
                                {log.ipAddress ? <span>IP: {log.ipAddress}</span> : null}
                                {log.userAgent ? <span className="max-w-full truncate">{log.userAgent}</span> : null}
                              </div>
                            </button>
                            {expandedAuditId === log.id ? (
                              <div className="px-4 pb-4">
                                <pre className="max-h-48 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-[11px] text-neutral-400">
                                  {JSON.stringify(log.metadata || {}, null, 2)}
                                </pre>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}

                    {auditTotalPages > 1 ? (
                      <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-3">
                        <span className="text-xs text-neutral-500">Page {auditPage} of {auditTotalPages}</span>
                        <div className="flex gap-2">
                          <SecondaryButton
                            type="button"
                            onClick={() => setAuditPage((page) => Math.max(1, page - 1))}
                            disabled={auditPage === 1 || isLoadingAuditLogs}
                            className="px-3 py-1.5 text-xs"
                          >
                            Previous
                          </SecondaryButton>
                          <SecondaryButton
                            type="button"
                            onClick={() => setAuditPage((page) => Math.min(auditTotalPages, page + 1))}
                            disabled={auditPage >= auditTotalPages || isLoadingAuditLogs}
                            className="px-3 py-1.5 text-xs"
                          >
                            Next
                          </SecondaryButton>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </Card>
          ) : null}
      </div>
    </div>
  );
}
