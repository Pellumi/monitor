'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  X,
  Eye,
  EyeOff,
  CreditCard,
  FileText,
  ShieldCheck,
  SlidersHorizontal,
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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await readJson<any>(res);
  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Request failed');
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
    <section className={cn('rounded-lg border border-neutral-800 bg-neutral-900 p-5', className)}>
      {children}
    </section>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-1 text-sm text-neutral-400">{description}</p>
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
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</span>
      <div className="relative">
        <input
          {...inputProps}
          type={inputType}
          className={cn(
            'w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:text-neutral-500',
            isPasswordType && 'pr-10',
            className,
          )}
        />
        {isPasswordType ? (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      {help ? <span className="mt-1 block text-[11px] text-neutral-500">{help}</span> : null}
    </label>
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: React.ReactNode }) {
  const { label, children, className, ...selectProps } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</span>
      <select
        {...selectProps}
        className={cn(
          'w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:text-neutral-500',
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
        'inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
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
  const [checkoutProvider, setCheckoutProvider] = useState<CheckoutProvider>('MOCK');
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

  const selectedMembership = memberships.find((membership) => membership.organization.id === selectedOrgId);
  const currentPlanType = subscription?.plan?.type || selectedOrg?.subscription?.planType || entitlement?.planType || 'FREE';
  const canManageTeam = enabledFeature(entitlement, 'TEAM_COLLABORATION');
  const canViewAuditLogs = enabledFeature(entitlement, 'AUDIT_LOGS');

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
        requestJson<Plan[]>('/api-gateway/billing/plans'),
        requestJson<Subscription | null>(`/api-gateway/billing/organizations/${selectedOrgId}/subscription`),
        requestJson<Invoice[]>(`/api-gateway/billing/organizations/${selectedOrgId}/invoices`),
        requestJson<Entitlement>(`/api-gateway/organizations/${selectedOrgId}/entitlement`),
      ]);
      setPlans(nextPlans);
      setSubscription(nextSubscription);
      setInvoices(nextInvoices);
      setEntitlement(nextEntitlement);
      if (nextSubscription?.billingInterval) setBillingInterval(nextSubscription.billingInterval);
      if (nextSubscription?.billingCurrency) setBillingCurrency(nextSubscription.billingCurrency);
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to load billing settings.' });
    } finally {
      setIsLoadingBilling(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    const names = splitDisplayName(user?.displayName);
    setOtherNames(names.otherNames);
    setSurname(names.surname);
  }, [user?.displayName]);

  useEffect(() => {
    if (user?.preferredAuthMode) {
      setAuthMode(user.preferredAuthMode);
    }
  }, [user?.preferredAuthMode]);

  useEffect(() => {
    if (!user?.id) return;
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
  }, [user?.id]);

  useEffect(() => {
    void loadBillingData();
  }, [loadBillingData]);

  useEffect(() => {
    setCheckoutProvider(billingCurrency === 'NGN' ? 'PAYSTACK' : 'STRIPE');
  }, [billingCurrency]);

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
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to update profile.' });
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
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Password update failed.' });
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
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Preferred authentication update failed.' });
    } finally {
      setIsSavingSecurity(false);
    }
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
    void navigator.clipboard.writeText('SOTS-MFA-J3K9-X27Y-Q8W1');
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
        window.location.href = checkout.checkoutUrl;
      }
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Checkout failed.' });
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
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Could not cancel subscription.' });
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
            Manage identity, security, team access, preferences, billing, and governance for SOTS.
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

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="h-fit rounded-lg border border-neutral-800 bg-neutral-900 p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition',
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

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
                              SOTS-MFA-J3K9-X27Y-Q8W1
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
            <Card className="space-y-6">
              <SectionHeader
                title="Team Management"
                description="Invite or remove organization members when the active plan includes team collaboration."
              />
              <div className="rounded-lg border border-neutral-800">
                {memberships.map((membership) => (
                  <div key={membership.id} className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 last:border-b-0">
                    <div>
                      <div className="text-sm font-semibold text-white">{membership.organization.name}</div>
                      <div className="text-xs text-neutral-500">
                        {membership.organization.id === selectedOrgId ? user.email : 'Current user membership'}
                      </div>
                    </div>
                    <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-semibold text-neutral-300">
                      {membership.role}
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <TextInput
                  label="Invite Email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="teammate@company.com"
                  disabled={!canManageTeam}
                />
                <div className="flex items-end">
                  <PrimaryButton type="button" disabled>
                    Invite Member
                  </PrimaryButton>
                </div>
              </div>
              <div className={cn('rounded-lg border p-4 text-sm', canManageTeam ? 'border-indigo-900/50 bg-indigo-950/30 text-indigo-200' : 'border-amber-900/50 bg-amber-950/30 text-amber-200')}>
                {canManageTeam
                  ? 'Your plan allows team collaboration. The database has memberships and invitations, but invite/remove endpoints are not exposed yet.'
                  : 'Team collaboration starts on the Team plan. Upgrade before inviting organization members.'}
              </div>
            </Card>
          ) : null}

          {activeTab === 'preferences' ? (
            <Card className="space-y-6">
              <SectionHeader
                title="Notifications & Preferences"
                description="Choose which operational messages SOTS should prioritize for this account."
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
                  <SelectInput label="Currency" value={billingCurrency} onChange={(event) => setBillingCurrency(event.target.value as BillingCurrency)}>
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
              <SectionHeader
                title="Audit Logs"
                description="Review important interactions such as logins, organization creation, MFA changes, team membership, and billing activity."
              />
              <div className={cn('rounded-lg border p-4 text-sm', canViewAuditLogs ? 'border-indigo-900/50 bg-indigo-950/30 text-indigo-200' : 'border-amber-900/50 bg-amber-950/30 text-amber-200')}>
                {canViewAuditLogs
                  ? 'Audit logging is enabled for this plan, and auth events are being written. A read endpoint for audit log review is still needed.'
                  : 'Audit logs are available on Business and Enterprise plans.'}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['Login events', 'LOGIN_SUCCESS, OTP_SENT, OTP_VERIFIED, LOGOUT'],
                  ['Team events', 'MEMBER_INVITED, MEMBER_JOINED, MEMBER_REMOVED, ROLE_CHANGED'],
                  ['Security events', 'MFA_ENABLED, MFA_DISABLED, SESSION_REFRESHED'],
                  ['Billing events', 'Checkout and invoice events are available in billing history.'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
                    <div className="font-semibold text-white">{title}</div>
                    <div className="mt-1 text-xs text-neutral-500">{body}</div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
