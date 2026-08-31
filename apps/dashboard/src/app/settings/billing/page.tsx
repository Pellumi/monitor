'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { Button, buttonVariants } from '@/components/ui/button';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/empty-state';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type BillingInterval = 'MONTHLY' | 'ANNUAL';
type BillingCurrency = 'USD' | 'NGN';

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
  action?: 'SUBSCRIBE' | 'UPGRADE' | 'DOWNGRADE' | 'CURRENT' | 'CONTACT_SALES';
  allowedEffectiveModes?: Array<'IMMEDIATE' | 'NEXT_RENEWAL'>;
  displayPriceMonthly?: number | null;
  displayPriceAnnual?: number | null;
}

interface PlanCatalog {
  currency: BillingCurrency;
  countryRequired: boolean;
  /** Processors that settle this payer's currency, in preference order. */
  availableProviders: PaymentProvider[];
  defaultProvider: PaymentProvider | null;
  currentPlanType: string;
  plans: Plan[];
}

type PaymentProvider = 'PAYSTACK' | 'FLUTTERWAVE';

const PROVIDER_LABELS: Record<PaymentProvider, { name: string; methods: string }> = {
  PAYSTACK:    { name: 'Paystack',    methods: 'Card, bank transfer, USSD, mobile money' },
  FLUTTERWAVE: { name: 'Flutterwave', methods: 'Card, Google Pay, Apple Pay, bank transfer' },
};

interface ChangePreview {
  previewId: string;
  direction: 'UPGRADE' | 'DOWNGRADE' | 'INTERVAL_CHANGE';
  currency: BillingCurrency;
  amountDue: number;
  creditAmount: number;
  nextCycleAmount: number;
  currentRenewalDate: string;
  expiresAt: string;
  supportedEffectiveModes: Array<'IMMEDIATE' | 'NEXT_RENEWAL'>;
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
  activeProvider?: string | null;
  trialStartedAt?: string | null;
  graceEndsAt?: string | null;
  nextBillingAt?: string | null;
  paymentMethodBrand?: string | null;
  paymentMethodLast4?: string | null;
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
  taxRate?: number;
  taxLabel?: string | null;
  total: number;
  status: string;
  reason?: string;
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

interface TrialEligibility {
  eligible: boolean;
  reason: string | null;
  trialDays: number;
  planType: string;
  planName: string | null;
  currency: BillingCurrency;
  firstChargeFormatted: string;
  firstChargeOn: string;
  availableProviders: PaymentProvider[];
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
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Request failed') as Error & { code?: string };
    err.code = data?.error;
    throw err;
  }
  return data as T;
}

/** Map raw API / validation errors to user-friendly copy. */
function friendlyError(raw: string): string {
  const map: Array<[RegExp, string]> = [
    [/PAYSTACK_AUTHORIZATION_REQUIRED|Authorize Paystack/i, `Paystack authorization is required to change this subscription. Redirecting to Paystack authorization...`],
    [/PAYMENT_METHOD_REAUTHORIZATION_REQUIRED/i, `Payment method reauthorization is required before changing plans. Redirecting...`],
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTHLY');
  const [billingCurrency, setBillingCurrency] = useState<BillingCurrency>('USD');
  const [countryRequired, setCountryRequired] = useState(false);
  const [changePreview, setChangePreview] = useState<ChangePreview | null>(null);
  const [changePlan, setChangePlan] = useState<Plan | null>(null);
  const [changeEffectiveMode, setChangeEffectiveMode] = useState<'IMMEDIATE' | 'NEXT_RENEWAL'>('IMMEDIATE');
  const [checkoutState, setCheckoutState] = useState<'PREPARING' | 'AWAITING' | 'VERIFYING' | 'ACTIVE' | 'CANCELLED' | 'FAILED' | null>(null);
  const [testProvider, setTestProvider] = useState<'FLUTTERWAVE' | 'PAYSTACK' | 'MOCK' | ''>('');
  const [availableProviders, setAvailableProviders] = useState<PaymentProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [trial, setTrial] = useState<TrialEligibility | null>(null);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
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
  // ── Load all billing data ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [catalog, nextSub, nextInvoices, nextEnt, nextProfile, nextUsage, nextTrial] = await Promise.all([
        requestJson<PlanCatalog>(`/api-gateway/billing/plans?organizationId=${encodeURIComponent(selectedOrgId)}`),
        requestJson<Subscription | null>(`/api-gateway/billing/organizations/${selectedOrgId}/subscription`).catch(() => null),
        requestJson<Invoice[]>(`/api-gateway/billing/organizations/${selectedOrgId}/invoices`).catch(() => [] as Invoice[]),
        requestJson<Entitlement>(`/api-gateway/organizations/${selectedOrgId}/entitlement`).catch(() => null as unknown as Entitlement),
        requestJson<BillingProfile | null>(`/api-gateway/billing/users/me/profile`).catch(() => null),
        requestJson<UsageSummary | null>(`/api-gateway/usage/organization/${selectedOrgId}`).catch(() => null),
        requestJson<TrialEligibility | null>(`/api-gateway/billing/trial/eligibility?organizationId=${encodeURIComponent(selectedOrgId)}`).catch(() => null),
      ]);
      setPlans(catalog.plans);
      setBillingCurrency(catalog.currency);
      setCountryRequired(catalog.countryRequired);
      setAvailableProviders(catalog.availableProviders ?? []);
      setSelectedProvider((current) =>
        current && (catalog.availableProviders ?? []).includes(current) ? current : catalog.defaultProvider);
      setSubscription(nextSub);
      setInvoices(nextInvoices);
      setEntitlement(nextEnt);
      setBillingProfile(nextProfile);
      setTrial(nextTrial);
      setUsageSummary(nextUsage);
      if (nextSub?.billingInterval) setBillingInterval(nextSub.billingInterval);
    } catch (err: any) {
      setError(err.message || 'Failed to load billing data.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const invoiceId = query.get('invoiceId');
    if (query.get('cancelled')) { setCheckoutState('CANCELLED'); return; }
    if (!invoiceId) return;
    let stopped = false; let attempts = 0;
    setCheckoutState('VERIFYING');
    const poll = async () => {
      const transactionId = query.get('transaction_id');
      const suffix = transactionId ? `?transaction_id=${encodeURIComponent(transactionId)}` : '';
      try {
        const result = await requestJson<{ status: string }>(`/api-gateway/billing/checkouts/${invoiceId}/status${suffix}`);
        if (stopped) return;
        if (result.status === 'VERIFIED') { setCheckoutState('ACTIVE'); await load(); return; }
        if (['FAILED', 'CANCELLED'].includes(result.status)) { setCheckoutState(result.status as 'FAILED' | 'CANCELLED'); return; }
      } catch { if (attempts >= 9) setCheckoutState('FAILED'); }
      attempts += 1;
      if (!stopped && attempts < 10) window.setTimeout(() => void poll(), 2000);
    };
    void poll();
    return () => { stopped = true; };
  }, [load]);

  const usageByMetric = new Map((usageSummary?.usage ?? []).map((item) => [item.metric, item]));

  // ── Checkout ────────────────────────────────────────────────────────────────
  async function handleCheckout(plan: Plan) {
    if (!selectedOrgId) return;
    setIsCheckingOut(true);
    setCheckoutState('PREPARING');
    setError(null);
    try {
      const body: Record<string, unknown> = {
        organizationId: selectedOrgId,
        planType: plan.type,
        billingInterval,
        successUrl: `${window.location.origin}/settings/billing?success=1`,
        cancelUrl: `${window.location.origin}/settings/billing?cancelled=1`,
      };
      if (selectedProvider) body.provider = selectedProvider;
      if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_BILLING_ALLOW_TEST_PROVIDER_OVERRIDE === 'true' && testProvider) body.provider = testProvider;
      const data = await requestJson<{ checkoutUrl?: string; url?: string; authorizationUrl?: string }>('/api-gateway/billing/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const redirectUrl = data.checkoutUrl ?? data.url ?? data.authorizationUrl;
      if (redirectUrl) { setCheckoutState('AWAITING'); window.location.href = redirectUrl; }
    } catch (err: any) {
      setError(friendlyError(err.message || 'Checkout failed. Please try again.'));
      setCheckoutState('FAILED');
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

  async function previewPlanChange(plan: Plan) {
    if (!selectedOrgId) return;
    setIsCheckingOut(true);
    setError(null);
    try {
      const preview = await requestJson<ChangePreview>('/api-gateway/billing/subscriptions/changes/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: selectedOrgId, planType: plan.type, billingInterval }),
      });
      setChangePlan(plan);
      setChangePreview(preview);
      setChangeEffectiveMode(
        preview.direction === 'DOWNGRADE' || !preview.supportedEffectiveModes.includes('IMMEDIATE')
          ? 'NEXT_RENEWAL'
          : 'IMMEDIATE',
      );
    } catch (err: any) {
      setError(friendlyError(err.message || 'Could not preview this plan change.'));
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function confirmPlanChange(effectiveMode: 'IMMEDIATE' | 'NEXT_RENEWAL') {
    if (!selectedOrgId || !changePreview) return;
    setIsCheckingOut(true);
    setError(null);
    try {
      const result = await requestJson<{ checkoutUrl?: string }>('/api-gateway/billing/subscriptions/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          previewId: changePreview.previewId,
          effectiveMode,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setChangePreview(null);
      setChangePlan(null);
      await load();
    } catch (err: any) {
      if (err?.code === 'PAYMENT_METHOD_REAUTHORIZATION_REQUIRED' || String(err?.message || '').includes('PAYMENT_METHOD_REAUTHORIZATION_REQUIRED')) {
        setError('Add a payment method before changing plans. Redirecting…');
        void updatePaymentMethod();
        return;
      }
      if (err?.code === 'UPGRADE_CHARGE_DECLINED') {
        setError(`${err.message} `.trim());
        return;
      }
      setError(friendlyError(err.message || 'Could not change the subscription.'));
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

  async function retryPayment() {
    if (!selectedOrgId) return;
    setIsCheckingOut(true);
    setError(null);
    try {
      await requestJson('/api-gateway/billing/subscriptions/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: selectedOrgId }),
      });
      setError('Payment retry scheduled. Refresh shortly to see the result.');
    } catch (err: any) {
      setError(friendlyError(err.message || 'Could not retry payment.'));
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function updatePaymentMethod() {
    if (!selectedOrgId) return;
    setIsCheckingOut(true);
    setError(null);
    try {
      const result = await requestJson<{ checkoutUrl: string }>('/api-gateway/billing/payment-method/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          successUrl: `${window.location.origin}/settings/billing?payment_method=updated`,
        }),
      });
      window.location.href = result.checkoutUrl;
    } catch (err: any) {
      setError(friendlyError(err.message || 'Could not open the secure card update.'));
      setIsCheckingOut(false);
    }
  }

  // ── Start the free trial ────────────────────────────────────────────────────
  async function startTrial() {
    if (!selectedOrgId) return;
    setIsStartingTrial(true);
    setError(null);
    try {
      const result = await requestJson<{ checkoutUrl: string }>('/api-gateway/billing/trial/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          ...(selectedProvider ? { provider: selectedProvider } : {}),
          successUrl: `${window.location.origin}/settings/billing?trial=started`,
        }),
      });
      window.location.href = result.checkoutUrl;
    } catch (err: any) {
      setError(friendlyError(err.message || 'Could not start your trial.'));
      setIsStartingTrial(false);
    }
  }

  // ── Download an invoice or receipt ──────────────────────────────────────────
  async function downloadInvoice(invoice: Invoice) {
    try {
      const response = await authenticatedFetch(`/api-gateway/billing/invoices/${invoice.id}/document`);
      if (!response.ok) throw new Error('The document could not be generated.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tellann-${invoice.status === 'PAID' ? 'receipt' : 'invoice'}-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(friendlyError(err.message || 'Could not download the document.'));
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
        <Button
          id="billing-refresh-btn"
          onClick={() => void load()}
          variant="secondary"
          className="h-9 px-3 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_BILLING_ALLOW_TEST_PROVIDER_OVERRIDE === 'true' ? (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-amber-300" htmlFor="billing-test-provider">Local test provider</label>
          <select id="billing-test-provider" value={testProvider} onChange={(event) => setTestProvider(event.target.value as typeof testProvider)} className="ml-3 rounded-md border border-amber-800 bg-black px-3 py-2 text-sm text-white">
            <option value="">Automatic routing</option><option value="PAYSTACK">Paystack</option><option value="FLUTTERWAVE">Flutterwave</option><option value="MOCK">Mock tests only</option>
          </select>
          <p className="mt-2 text-xs text-amber-200/70">This control is unavailable in production. Currency and plan eligibility remain enforced by the billing API.</p>
        </div>
      ) : null}

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setError(null)}
            className="shrink-0 rounded p-0.5 text-red-400 transition hover:bg-red-900/30 hover:text-red-200 h-6 w-6"
            aria-label="Dismiss error"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}
      {checkoutState && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-neutral-200" role="status">
          {checkoutState === 'PREPARING' && 'Preparing secure checkout…'}
          {checkoutState === 'AWAITING' && 'Awaiting payment on the provider page…'}
          {checkoutState === 'VERIFYING' && 'Verifying payment with the provider…'}
          {checkoutState === 'ACTIVE' && 'Payment verified. Your paid plan is active.'}
          {checkoutState === 'CANCELLED' && 'Checkout was cancelled. Your current plan is unchanged.'}
          {checkoutState === 'FAILED' && 'Payment could not be verified. Your current plan is unchanged.'}
        </div>
      )}
      {subscription && ['GRACE_PERIOD', 'PAST_DUE', 'SUSPENDED'].includes(subscription.status) && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-800 bg-amber-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-200">Your latest subscription payment failed.</p>
            <p className="mt-1 text-xs text-amber-300/70">
              {subscription.graceEndsAt
                ? `Your plan stays active until ${formatDate(subscription.graceEndsAt)}. We retry daily — after that this organization moves to the Free plan.`
                : 'We will retry shortly. Update your card if the problem persists.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="accent" onClick={() => void retryPayment()} disabled={isCheckingOut} className="border-amber-700 text-amber-100 hover:border-amber-500 hover:bg-amber-950/20 px-3 py-2 text-xs font-semibold h-auto">Retry now</Button>
            <Button type="button" variant="accent" onClick={() => void updatePaymentMethod()} disabled={isCheckingOut} className="bg-amber-200 text-black hover:bg-amber-100 px-3 py-2 text-xs font-semibold h-auto">Update card</Button>
          </div>
        </div>
      )}
      {/* ── Free trial offer ── */}
      {trial?.eligible && isFreePlan && (
        <div className="flex flex-col gap-4 rounded-lg border border-violet-800/70 bg-violet-950/20 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-2xl gap-3">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
            <div>
              <h3 className="text-sm font-semibold text-violet-100">
                Try {trial.planName} free for {trial.trialDays} days
              </h3>
              <p className="mt-1 text-xs leading-5 text-violet-200/70">
                Add a card to unlock the full {trial.planName} plan straight away. Nothing is
                charged until {formatDate(trial.firstChargeOn)}, when your first payment of{' '}
                {trial.firstChargeFormatted} is taken. Cancel or change plan any time before then
                and you pay nothing.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={() => void startTrial()}
            disabled={isStartingTrial}
            className="shrink-0"
          >
            {isStartingTrial ? 'Starting…' : `Start ${trial.trialDays}-day trial`}
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Trial in progress ── */}
      {subscription?.status === 'TRIAL' && subscription.trialEndsAt && (
        <div className="flex flex-col gap-3 rounded-lg border border-violet-800/70 bg-violet-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-violet-100">
              You are on a free {subscription.plan?.name} trial
            </p>
            <p className="mt-1 text-xs text-violet-200/70">
              Your first payment is due {formatDate(subscription.trialEndsAt)}
              {subscription.paymentMethodLast4
                ? `, charged to the card ending ${subscription.paymentMethodLast4}`
                : ''}
              . Cancel or switch plan before then and nothing is taken.
            </p>
          </div>
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
                    ? isFreePlan ? 'No renewal date' : `Renews ${formatDate(subscription.currentPeriodEnd)}`
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
                <Button
                  id="billing-cancel-btn"
                  onClick={handleCancelClick}
                  disabled={isCancelling}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-neutral-500 underline underline-offset-2 hover:text-red-400 hover:bg-transparent p-0"
                >
                  {isCancelling ? 'Cancelling\u2026' : 'Cancel subscription'}
                </Button>
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

        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
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
          {availableProviders.length > 1 && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Payment Processor
              </label>
              <div className="flex flex-wrap gap-2">
                {availableProviders.map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setSelectedProvider(provider)}
                    aria-pressed={selectedProvider === provider}
                    title={PROVIDER_LABELS[provider].methods}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left transition-colors',
                      selectedProvider === provider
                        ? 'border-white bg-white/10 text-white'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200',
                    )}
                  >
                    <span className="block text-sm font-semibold">{PROVIDER_LABELS[provider].name}</span>
                    <span className="block text-[11px] leading-4 text-neutral-500">{PROVIDER_LABELS[provider].methods}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="text-right">
            <p className="text-sm font-semibold text-white">Prices shown in {billingCurrency}</p>
            <Link href={countryRequired ? "/settings/profile#billing-profile" : "/settings/profile"} className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-300">
              {countryRequired ? 'Complete billing profile' : `Based on ${billingProfile?.countryCode ?? 'your billing country'}`}
            </Link>
          </div>
        </div>
      </Card>

      {/* ── Plan selector ── */}
      <Card>
        <SectionHeader
          title="Available Plans"
          description="Upgrades activate immediately via checkout. Downgrades take effect at the next renewal period."
        />
        {countryRequired ? (
          <div className="flex flex-col gap-5 rounded-lg border border-amber-800/70 bg-amber-950/20 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex max-w-2xl gap-3">
              <div>
                <h3 className="text-sm font-semibold text-amber-100">Complete your billing profile to view plans</h3>
                <p className="mt-1 text-xs leading-5 text-amber-200/70">
                  Select your billing country so Tellann can show the correct currency, eligible plans, and payment processors. Your billing profile is personal and applies to every organization you pay for. No subscription change will be made.
                </p>
              </div>
            </div>
            <Link href="/settings/profile#billing-profile" className={cn(buttonVariants({ variant: 'primary' }), 'shrink-0')}>
              Complete billing profile <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            variant="neutral"
            illustration="list"
            layout="compact"
            eyebrow="Plan catalog"
            title="Plans are temporarily unavailable"
            description="Refresh this page shortly. Your current subscription remains unchanged."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.filter((plan) => plan.type !== 'LOCAL' || plan.eligible).map((plan) => {
              const displayCurrency = billingCurrency;
              const price = billingInterval === 'ANNUAL' ? plan.displayPriceAnnual : plan.displayPriceMonthly;
              const isCurrent = plan.type === currentPlanType;
              const isEnterprise = plan.type === 'ENTERPRISE';
              const action = plan.action ?? (isCurrent ? 'CURRENT' : 'SUBSCRIBE');
              const needsCheckout = action === 'SUBSCRIBE';
              const needsChangePreview = action === 'UPGRADE' || action === 'DOWNGRADE';

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
                  <Button
                    id={`plan-checkout-${plan.type.toLowerCase()}`}
                    onClick={() => isEnterprise
                      ? void handleEnterpriseSalesRequest()
                      : needsCheckout
                        ? void handleCheckout(plan)
                        : needsChangePreview
                          ? void previewPlanChange(plan)
                          : undefined}
                    disabled={isCurrent || isCheckingOut || plan.type === 'FREE'}
                    variant={isCurrent ? "secondary" : isEnterprise ? "secondary" : "primary"}
                    className={cn(
                      'mt-5 w-full',
                      isCurrent && 'cursor-default border border-[#262626] bg-[#1a1a1a] text-neutral-400 font-mono hover:bg-[#1a1a1a]',
                      isEnterprise && 'border border-[#262626] bg-transparent text-neutral-400 hover:border-neutral-500 hover:text-white',
                    )}
                  >
                    {isCurrent ? 'Current Plan' : isEnterprise ? 'Contact Sales' : (
                      <>{action === 'DOWNGRADE' ? 'Downgrade' : action === 'UPGRADE' ? 'Upgrade' : 'Subscribe'} <ArrowUpRight className="h-4 w-4" /></>
                    )}
                  </Button>
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
                <th className="px-4 py-3 text-right">Document</th>
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
                      {invoice.tax > 0 && (
                        <span className="block text-[11px] font-normal text-neutral-500">
                          incl. {centsToMoney(invoice.tax, invoice.currency)} {invoice.taxLabel ?? 'tax'}
                        </span>
                      )}
                    </td>
                    <td className={cn('px-4 py-3 font-semibold', INVOICE_STATUS_COLOR[invoice.status] ?? 'text-neutral-400')}>
                      {invoice.status}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">
                      {formatDate(invoice.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void downloadInvoice(invoice)}
                        className="text-xs font-semibold text-neutral-300 underline underline-offset-2 hover:text-white"
                      >
                        {invoice.status === 'PAID' ? 'Receipt' : 'Invoice'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-4">
                    <EmptyState
                      variant="neutral"
                      illustration="report"
                      layout="compact"
                      eyebrow="Billing history"
                      title="No invoices yet"
                      description="Your first invoice will appear after a completed payment."
                    />
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
            <Button
              onClick={() => setShowCancelDialog(false)}
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 rounded-lg p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </Button>

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
              <Button
                onClick={() => setShowCancelDialog(false)}
                variant="secondary"
              >
                Keep My Plan
              </Button>
              <Button
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                loading={isCancelling}
                variant="danger"
              >
                Yes, Cancel Subscription
              </Button>
            </div>
          </div>
        </div>
      )}
      {changePreview && changePlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-plan-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-md border border-[#262626] bg-[#131313] shadow-2xl transition-all">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#262626] bg-[#131313] px-6 py-4">
              <div>
                <h3 id="change-plan-title" className="text-lg font-bold text-white tracking-tight">
                  {changePreview.direction === 'DOWNGRADE' ? 'Schedule Downgrade' : `Change to ${changePlan.name}`}
                </h3>
              </div>
              <span className="inline-block shrink-0 rounded border border-[#444748] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#8e9192]">
                Billing // {changePreview.direction === 'DOWNGRADE' ? 'Downgrade' : 'Plan Change'}
              </span>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#c4c7c8] leading-relaxed">
                Your next full charge will be{' '}
                <span className="font-semibold text-white font-mono">
                  {centsToMoney(changePreview.nextCycleAmount, changePreview.currency)}
                </span>
                .
              </p>

              {/* Data Table */}
              <div className="rounded border border-[#262626] bg-black divide-y divide-[#262626] font-mono text-xs">
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-[#8e9192] uppercase tracking-wider text-[11px]">Target Plan</span>
                  <span className="text-white font-medium">{changePlan.name}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-[#8e9192] uppercase tracking-wider text-[11px]">Next Cycle Amount</span>
                  <span className="text-white font-medium">{centsToMoney(changePreview.nextCycleAmount, changePreview.currency)}</span>
                </div>
                {!isFreePlan ? (
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-[#8e9192] uppercase tracking-wider text-[11px]">Renewal Date</span>
                    <span className="text-white font-medium">{formatDate(changePreview.currentRenewalDate)}</span>
                  </div>
                ) : null}
                {changePreview.supportedEffectiveModes.includes('IMMEDIATE') && (
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-[#8e9192] uppercase tracking-wider text-[11px]">Amount Due Today</span>
                    <span className="text-emerald-400 font-medium">{centsToMoney(changePreview.amountDue, changePreview.currency)}</span>
                  </div>
                )}
              </div>

              {/* Notice Box */}
              <div className="rounded border border-[#262626] bg-black p-4 text-xs text-[#c4c7c8] leading-relaxed">
                {changePreview.direction === 'DOWNGRADE' ? (
                  <p>Your current plan remains active until <span className="font-semibold text-white font-mono">{formatDate(changePreview.currentRenewalDate)}</span>. There is no charge today.</p>
                ) : isFreePlan ? (
                  <p>Pay <span className="font-semibold text-white font-mono">{centsToMoney(changePreview.amountDue, changePreview.currency)}</span> to activate {changePlan.name} now.</p>
                ) : (
                  <p>Start now for <span className="font-semibold text-white font-mono">{centsToMoney(changePreview.amountDue, changePreview.currency)}</span>, or keep your current plan until <span className="font-semibold text-white font-mono">{formatDate(changePreview.currentRenewalDate)}</span>.</p>
                )}
              </div>

              {!isFreePlan && changePreview.direction !== 'DOWNGRADE' && changePreview.supportedEffectiveModes.includes('IMMEDIATE') && changePreview.supportedEffectiveModes.includes('NEXT_RENEWAL') ? (
                <div className="flex flex-col gap-3 rounded border border-[#262626] bg-black p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">When should this change start?</p>
                    <p className="mt-1 text-[11px] text-[#8e9192]">Choose whether to activate immediately <br /> or at your next renewal.</p>
                  </div>
                  <Switch
                    id="plan-change-timing"
                    checked={changeEffectiveMode === 'NEXT_RENEWAL'}
                    onCheckedChange={(nextCycle) => setChangeEffectiveMode(nextCycle ? 'NEXT_RENEWAL' : 'IMMEDIATE')}
                    labels={['Start now', 'Next cycle']}
                  />
                </div>
              ) : null}
            </div>

            {/* Footer Actions */}
            <div className="flex w-full flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 border-t border-[#262626] bg-black px-6 py-4">
              <button
                type="button"
                onClick={() => { setChangePreview(null); setChangePlan(null); }}
                className="rounded bg-[#262626] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#333333] transition-colors"
                disabled={isCheckingOut}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmPlanChange(changeEffectiveMode)}
                disabled={isCheckingOut}
                className="rounded flex-1 bg-white px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-black hover:bg-neutral-200 transition-colors disabled:opacity-50"
              >
                {changePreview.direction === 'DOWNGRADE'
                  ? 'Schedule Downgrade'
                  : changeEffectiveMode === 'NEXT_RENEWAL'
                    ? 'Start Next Cycle'
                    : `Pay ${centsToMoney(changePreview.amountDue, changePreview.currency)} & Start Now`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
