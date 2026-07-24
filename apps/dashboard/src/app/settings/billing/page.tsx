'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  X,
  RefreshCw,
  Zap,
  ArrowUpRight,
  Receipt,
  Building2,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useSession } from '@/components/providers';
import { Switch, SegmentedControl } from '@/components/ui/switch';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type BillingInterval = 'MONTHLY' | 'ANNUAL';
type BillingCurrency = 'USD' | 'NGN';
type CheckoutProvider = 'MOCK' | 'STRIPE' | 'PAYSTACK';

interface Plan {
  id: string;
  type: string;
  name: string;
  description?: string | null;
  monthlyPriceUsd?: number | null;
  monthlyPriceNgn?: number | null;
  annualPriceUsd?: number | null;
  annualPriceNgn?: number | null;
  maxApplications: number | null;
  maxUsers: number | null;
  maxStorageGb: number | null;
  retentionDays: number | null;
  maxDemoSessions?: number | null;
  eligible?: boolean;
  eligibilityReason?: string | null;
  highlights?: string[];
  exportFormats?: string[];
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
  trialEndsAt?: string | null;
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

interface BillingProfile {
  countryCode: string;
  legalName?: string | null;
  billingEmail?: string | null;
}

interface UsageSummary {
  usage: Array<{ metric: string; value: number; limit: number | null; percent: number; thresholdAlert80: boolean; thresholdAlert100: boolean }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authenticatedFetch(url, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || data?.error || 'Request failed');
  return data as T;
}

/** Map raw API / validation errors to user-friendly copy. */
function friendlyError(raw: string): string {
  const map: Array<[RegExp, string]> = [
    [/planType must be one of/i, `This plan is not available for checkout right now. Please select a different plan or try again later.`],
    [/organization.*not found/i, `We couldn\u2019t find your organization. Please refresh the page and try again.`],
    [/subscription.*already.*active/i, `You already have an active subscription. Cancel your current plan before switching.`],
    [/insufficient.*permissions?/i, `You don\u2019t have permission to manage billing. Ask your organization owner for access.`],
    [/provider.*not.*configured/i, `The selected payment processor is not configured yet. Please choose a different one.`],
    [/currency.*not.*supported/i, `The selected currency is not supported by this payment processor. Please choose a different currency or processor.`],
    [/rate.?limit/i, `Too many requests. Please wait a moment and try again.`],
    [/network|fetch|timeout/i, `Network error. Please check your connection and try again.`],
  ];
  for (const [pattern, friendly] of map) {
    if (pattern.test(raw)) return friendly;
  }
  // Fallback: if it looks like a raw validation message (contains "must be"), genericise it
  if (/must be/i.test(raw)) return 'Something went wrong with your request. Please try again or contact support.';
  return raw;
}

function centsToMoney(value: number | null | undefined, currency: BillingCurrency) {
  if (value == null) return 'Custom';
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2,
  }).format(value / 100);
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
}

function planPrice(plan: Plan, interval: BillingInterval, currency: BillingCurrency) {
  if (currency === 'NGN') return interval === 'ANNUAL' ? plan.annualPriceNgn : plan.monthlyPriceNgn;
  return interval === 'ANNUAL' ? plan.annualPriceUsd : plan.monthlyPriceUsd;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  ACTIVE:       { label: 'Active',       icon: CheckCircle2,   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  TRIAL:        { label: 'Trial',        icon: Zap,            color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
  PAST_DUE:     { label: 'Past Due',     icon: AlertTriangle,  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  GRACE_PERIOD: { label: 'Grace Period', icon: Clock,          color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  SUSPENDED:    { label: 'Suspended',    icon: XCircle,        color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
  CANCELLED:    { label: 'Cancelled',    icon: XCircle,        color: 'text-neutral-400', bg: 'bg-neutral-800 border-neutral-700' },
  EXPIRED:      { label: 'Expired',      icon: XCircle,        color: 'text-neutral-400', bg: 'bg-neutral-800 border-neutral-700' },
};

const INVOICE_STATUS_COLOR: Record<string, string> = {
  PAID:    'text-emerald-400',
  PENDING: 'text-amber-400',
  FAILED:  'text-red-400',
  VOID:    'text-neutral-500',
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-neutral-800 bg-neutral-900 p-6', className)}>
      {children}
    </section>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mt-1 text-sm text-neutral-400">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['ACTIVE'];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', cfg.bg, cfg.color)}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-neutral-950 p-4 text-center">
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { selectedOrgId, selectedOrg } = useSession();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [billingCountry, setBillingCountry] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTHLY');
  const [billingCurrency, setBillingCurrency] = useState<BillingCurrency>('USD');
  const [checkoutProvider, setCheckoutProvider] = useState<CheckoutProvider>('STRIPE');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const currentPlanType =
    subscription?.plan?.type ||
    (selectedOrg as any)?.subscription?.planType ||
    entitlement?.planType ||
    'FREE';

  const isFreePlan = currentPlanType === 'FREE';

  // ── Auto-select provider based on currency ──────────────────────────────────
  useEffect(() => {
    setCheckoutProvider(billingCurrency === 'NGN' ? 'PAYSTACK' : 'STRIPE');
  }, [billingCurrency]);

  // ── Load all billing data ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [nextPlans, nextSub, nextInvoices, nextEnt, nextProfile, nextUsage] = await Promise.all([
        requestJson<Plan[]>(`/api-gateway/billing/plans?organizationId=${encodeURIComponent(selectedOrgId)}`).catch(() => [] as Plan[]),
        requestJson<Subscription | null>(`/api-gateway/billing/organizations/${selectedOrgId}/subscription`).catch(() => null),
        requestJson<Invoice[]>(`/api-gateway/billing/organizations/${selectedOrgId}/invoices`).catch(() => [] as Invoice[]),
        requestJson<Entitlement>(`/api-gateway/organizations/${selectedOrgId}/entitlement`).catch(() => null as unknown as Entitlement),
        requestJson<BillingProfile | null>(`/api-gateway/billing/organizations/${selectedOrgId}/profile`).catch(() => null),
        requestJson<UsageSummary | null>(`/api-gateway/usage/organization/${selectedOrgId}`).catch(() => null),
      ]);
      setPlans(nextPlans);
      setSubscription(nextSub);
      setInvoices(nextInvoices);
      setEntitlement(nextEnt);
      setBillingProfile(nextProfile);
      setBillingCountry(nextProfile?.countryCode ?? '');
      setUsageSummary(nextUsage);
      if (nextSub?.billingInterval) setBillingInterval(nextSub.billingInterval);
      if (nextSub?.billingCurrency) setBillingCurrency(nextSub.billingCurrency);
    } catch (err: any) {
      setError(err.message || 'Failed to load billing data.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => { void load(); }, [load]);

  const usageByMetric = new Map((usageSummary?.usage ?? []).map((item) => [item.metric, item]));

  // ── Checkout ────────────────────────────────────────────────────────────────
  async function handleCheckout(plan: Plan) {
    if (!selectedOrgId) return;
    setIsCheckingOut(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        organizationId: selectedOrgId,
        planType: plan.type,
        planId: plan.id,
        provider: checkoutProvider,
        billingInterval,
        billingCurrency,
        successUrl: `${window.location.origin}/settings/billing?success=1`,
        cancelUrl: `${window.location.origin}/settings/billing?cancelled=1`,
      };
      const data = await requestJson<{ checkoutUrl?: string; url?: string; authorizationUrl?: string }>('/api-gateway/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const redirectUrl = data.checkoutUrl ?? data.url ?? data.authorizationUrl;
      if (redirectUrl) window.location.href = redirectUrl;
    } catch (err: any) {
      setError(friendlyError(err.message || 'Checkout failed. Please try again.'));
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function handleEnterpriseSalesRequest() {
    if (!selectedOrgId) return;
    setIsCheckingOut(true);
    setError(null);
    try {
      await requestJson(`/api-gateway/billing/organizations/${selectedOrgId}/enterprise-sales-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedCapabilities: ['SSO/OIDC/SAML', 'Custom retention', 'Data residency', 'Private networking'],
          deploymentPreference: 'To be discussed',
          notes: 'Requested from the billing plan comparison.',
        }),
      });
      setError('Enterprise request submitted. Our sales team will follow up with an authorized organization contact.');
    } catch (err: any) {
      setError(friendlyError(err.message || 'Could not submit the Enterprise request.'));
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function saveBillingCountry() {
    if (!selectedOrgId || !/^[A-Za-z]{2}$/.test(billingCountry.trim())) {
      setError('Enter a valid two-letter ISO billing country code, such as NG or US.');
      return;
    }
    setIsCheckingOut(true);
    setError(null);
    try {
      const profile = await requestJson<BillingProfile>(`/api-gateway/billing/organizations/${selectedOrgId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: billingCountry.trim().toUpperCase() }),
      });
      setBillingProfile(profile);
      await load();
    } catch (err: any) {
      setError(friendlyError(err.message || 'Could not update the billing country.'));
    } finally {
      setIsCheckingOut(false);
    }
  }

  // ── Cancel subscription ─────────────────────────────────────────────────────
  function handleCancelClick() {
    if (isFreePlan) return; // Free plan cannot be cancelled
    setShowCancelDialog(true);
  }

  async function handleConfirmCancel() {
    if (!selectedOrgId || !subscription) return;
    setShowCancelDialog(false);
    setIsCancelling(true);
    setError(null);
    try {
      await requestJson(`/api-gateway/billing/organizations/${selectedOrgId}/subscription/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      await load();
    } catch (err: any) {
      setError(friendlyError(err.message || 'Failed to cancel subscription.'));
    } finally {
      setIsCancelling(false);
    }
  }

  // ── Skeleton while loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-900" />
        <div className="h-64 animate-pulse rounded-xl bg-neutral-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Plan &amp; Billing</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Manage your subscription, upgrade your plan, and view payment history.
          </p>
        </div>
        <button
          id="billing-refresh-btn"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-300 transition hover:bg-neutral-800"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="shrink-0 rounded p-0.5 text-red-400 transition hover:bg-red-900/30 hover:text-red-200"
            aria-label="Dismiss error"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Current plan overview ── */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-600/20 p-2">
                <Building2 className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <div className="text-lg font-bold text-white">
                  {subscription?.plan?.name || currentPlanType}
                </div>
                <div className="text-xs text-neutral-500">
                  {subscription
                    ? `Renews ${formatDate(subscription.currentPeriodEnd)}`
                    : 'No active subscription'}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {subscription && <StatusBadge status={subscription.status} />}
            {subscription && !['CANCELLED', 'EXPIRED'].includes(subscription.status) && (
              isFreePlan ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600 cursor-default" title="You are on the Free plan. There is nothing to cancel.">
                  <Info className="h-3 w-3" />
                  Free plan
                </span>
              ) : (
                <button
                  id="billing-cancel-btn"
                  onClick={handleCancelClick}
                  disabled={isCancelling}
                  className="text-xs text-neutral-500 underline underline-offset-2 transition hover:text-red-400 disabled:cursor-not-allowed"
                >
                  {isCancelling ? 'Cancelling\u2026' : 'Cancel subscription'}
                </button>
              )
            )}
          </div>
        </div>

        {/* Limit tiles */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile
            label="Applications"
            value={`${usageByMetric.get('APPLICATIONS')?.value ?? 0} / ${entitlement?.limits?.applications ?? subscription?.plan?.maxApplications ?? '—'}`}
          />
          <MetricTile
            label="Team Members"
            value={`${usageByMetric.get('USERS')?.value ?? 0} / ${entitlement?.limits?.users ?? subscription?.plan?.maxUsers ?? '—'}`}
          />
          <MetricTile
            label="Storage"
            value={`${(usageByMetric.get('STORAGE_GB')?.value ?? 0).toFixed(2)} / ${entitlement?.limits?.storageGb ?? subscription?.plan?.maxStorageGb ?? '—'} GB`}
          />
          <MetricTile
            label="Retention"
            value={`${entitlement?.limits?.retentionDays ?? subscription?.plan?.retentionDays ?? '—'} days`}
          />
        </div>

        {/* Billing controls */}
        <div className="mt-6 flex flex-wrap items-center gap-6">
          <div>
            <label htmlFor="billing-country" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Billing Country
            </label>
            <div className="flex gap-2">
              <input
                id="billing-country"
                value={billingCountry}
                onChange={(event) => setBillingCountry(event.target.value.toUpperCase().slice(0, 2))}
                placeholder="NG"
                aria-label="Two-letter billing country code"
                className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm uppercase text-white"
              />
              <button type="button" onClick={() => void saveBillingCountry()} disabled={isCheckingOut || billingCountry === billingProfile?.countryCode} className="rounded-md border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-200 disabled:opacity-40">
                Save
              </button>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Billing Cycle
            </label>
            <Switch
              id="billing-interval-switch"
              checked={billingInterval === 'ANNUAL'}
              onCheckedChange={(annual) => setBillingInterval(annual ? 'ANNUAL' : 'MONTHLY')}
              labels={['Monthly', 'Annual']}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Currency
            </label>
            <Switch
              id="billing-currency-switch"
              checked={billingCurrency === 'NGN'}
              onCheckedChange={(ngn) => setBillingCurrency(ngn ? 'NGN' : 'USD')}
              labels={['USD ($)', 'NGN (\u20A6)']}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Processor
            </label>
            <SegmentedControl<CheckoutProvider>
              id="billing-processor-control"
              value={checkoutProvider}
              onChange={setCheckoutProvider}
              options={[
                { value: 'STRIPE', label: 'Stripe' },
                { value: 'PAYSTACK', label: 'Paystack' },
                { value: 'MOCK', label: 'Mock' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* ── Plan selector ── */}
      <Card>
        <SectionHeader
          title="Available Plans"
          description="Upgrades activate immediately via checkout. Downgrades take effect at the next renewal period."
        />
        {plans.length === 0 ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-950 py-10 text-center text-sm text-neutral-500">
            No plans available. Check back shortly or contact support.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.filter((plan) => plan.type !== 'LOCAL' || plan.eligible).map((plan) => {
              const isLocalPlan = plan.type === 'LOCAL';
              const displayCurrency: BillingCurrency = isLocalPlan ? 'NGN' : billingCurrency;
              const price = isLocalPlan ? planPrice(plan, billingInterval, 'NGN') : planPrice(plan, billingInterval, billingCurrency);
              const isCurrent = plan.type === currentPlanType;
              const isEnterprise = plan.type === 'ENTERPRISE';
              const isUpgrade = !isCurrent && !isEnterprise && plan.type !== 'FREE';

              return (
                <div
                  key={plan.id}
                  className={cn(
                    'relative flex flex-col rounded-md border p-5 transition',
                    isCurrent
                      ? 'border-white bg-[#131313]'
                      : 'border-[#262626] bg-[#000000] hover:border-neutral-600',
                  )}
                >
                  {isCurrent && (
                    <span className="absolute right-4 top-4 rounded-sm border border-[#444748] bg-black px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#8e9192]">
                      Current
                    </span>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{plan.name}</h3>
                    {plan.description && (
                      <p className="mt-1 text-xs text-neutral-500">{plan.description}</p>
                    )}
                    <div className="mt-4 text-3xl font-extrabold text-white font-mono">
                      {isEnterprise ? 'Custom' : centsToMoney(price, displayCurrency)}
                      {!isEnterprise && (
                        <span className="ml-1 text-sm font-normal text-neutral-500">
                          / {billingInterval === 'ANNUAL' ? 'yr' : 'mo'}
                        </span>
                      )}
                    </div>
                    <ul className="mt-4 space-y-1.5 text-xs text-neutral-400 font-mono">
                      <li>✦ {plan.maxApplications === null ? 'Custom' : plan.maxApplications} applications</li>
                      <li>✦ {plan.maxUsers === null ? 'Custom' : plan.maxUsers} team members</li>
                      <li>✦ {plan.maxStorageGb === null ? 'Custom' : `${plan.maxStorageGb} GB`} storage</li>
                      <li>✦ {plan.retentionDays === null ? 'Custom' : `${plan.retentionDays} days`} data retention</li>
                      {plan.highlights?.slice(0, 4).map((highlight) => <li key={highlight}>✓ {highlight}</li>)}
                      {plan.exportFormats?.length ? <li>✓ {plan.exportFormats.join(', ')} exports</li> : null}
                    </ul>
                  </div>
                  <button
                    id={`plan-checkout-${plan.type.toLowerCase()}`}
                    onClick={() => isEnterprise ? void handleEnterpriseSalesRequest() : isUpgrade ? void handleCheckout(plan) : undefined}
                    disabled={isCurrent || isCheckingOut || plan.type === 'FREE'}
                    className={cn(
                      'mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs font-semibold transition cursor-pointer',
                      isCurrent
                        ? 'cursor-default border border-[#262626] bg-[#1a1a1a] text-neutral-400 font-mono'
                        : isEnterprise
                        ? 'border border-[#262626] bg-transparent text-neutral-400 hover:border-neutral-500 hover:text-white'
                        : 'bg-white text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    {isCurrent ? 'Current Plan' : isEnterprise ? 'Contact Sales' : (
                      <>Start Checkout <ArrowUpRight className="h-4 w-4" /></>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Invoice history ── */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Payment History"
            description="All invoices generated for your subscription — renewals, upgrades, and payment events."
          />
          <Receipt className="h-5 w-5 shrink-0 text-neutral-600" />
        </div>
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="min-w-full divide-y divide-neutral-800 text-sm">
            <thead className="bg-neutral-950 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {invoices.length > 0 ? (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-neutral-950/50 transition">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-white">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 text-neutral-300">{invoice.planType}</td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">
                      {formatDate(invoice.periodStart)} → {formatDate(invoice.periodEnd)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {centsToMoney(invoice.total, invoice.currency)}
                    </td>
                    <td className={cn('px-4 py-3 font-semibold', INVOICE_STATUS_COLOR[invoice.status] ?? 'text-neutral-400')}>
                      {invoice.status}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">
                      {formatDate(invoice.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                    No invoices yet. Your first invoice will appear here after your first payment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Feature entitlements ── */}
      {entitlement?.features && Object.keys(entitlement.features).length > 0 && (
        <Card>
          <SectionHeader
            title="Feature Entitlements"
            description="Features active on your current plan. Upgrade to unlock more capabilities."
          />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(entitlement.features)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([feature, value]) => {
                const isEnabled = value === true || typeof value === 'string';
                return (
                  <div
                    key={feature}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs',
                      isEnabled
                        ? 'border-emerald-800/40 bg-emerald-950/20'
                        : 'border-neutral-800 bg-neutral-950',
                    )}
                  >
                    <span className={isEnabled ? 'text-neutral-200' : 'text-neutral-600'}>
                      {feature.replace(/_/g, ' ')}
                    </span>
                    <span className={cn('font-semibold', isEnabled ? 'text-emerald-400' : 'text-neutral-700')}>
                      {typeof value === 'string' ? value : isEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* ── Cancel Confirmation Dialog ── */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCancelDialog(false)}
          />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/50">
            {/* Close button */}
            <button
              onClick={() => setShowCancelDialog(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex flex-col items-center px-6 pt-8 pb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                <ShieldAlert className="h-7 w-7 text-red-400" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-white">Cancel Subscription?</h3>
              <p className="mt-2 text-center text-sm text-neutral-400 leading-relaxed">
                {`Are you sure you want to cancel your `}
                <span className="font-semibold text-white">{subscription?.plan?.name || currentPlanType}</span>
                {` plan?`}
              </p>
            </div>

            {/* Info box */}
            <div className="mx-6 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4 space-y-2">
              <div className="flex items-start gap-2.5 text-xs text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  {`Your plan will remain active until `}
                  <span className="font-semibold text-white">
                    {formatDate(subscription?.currentPeriodEnd)}
                  </span>
                  {`. After that, your organization will be downgraded to the Free plan.`}
                </span>
              </div>
              <ul className="ml-6 space-y-1 text-xs text-neutral-400">
                <li>{`\u2022 Usage limits will revert to Free plan levels`}</li>
                <li>{`\u2022 Data beyond the Free retention period may be archived`}</li>
                <li>{`\u2022 You can resubscribe at any time`}</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 px-6 pt-5 pb-6 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="inline-flex items-center justify-center rounded-lg border border-neutral-700 bg-transparent px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
              >
                Keep My Plan
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCancelling ? `Cancelling\u2026` : `Yes, Cancel Subscription`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
