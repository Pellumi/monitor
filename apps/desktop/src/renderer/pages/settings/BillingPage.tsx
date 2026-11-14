import { useEffect, useState } from "react";
import type { BillingInvoice, BillingPlanCatalog, BillingSubscription } from "@tellann/desktop-contracts";
import { Page, LoadingState, Status } from "../../pages";
import { Table } from "../../components/ui/table";
import { Modal, ModalActions } from "../../components/ui/modal";
import { formatEnum } from "../../components/desktop-ui";
import { useDesktop } from "../../desktop-context";
import { useActiveOrganization } from "./use-active-organization";
import { OrganizationSwitcher } from "./organization-switcher";

const SUCCESS_PREFIX = "tellann://billing-checkout/success";
const CANCEL_PREFIX = "tellann://billing-checkout/cancel";

async function pollCheckoutStatus(invoiceId: string): Promise<"PAID" | "FAILED" | "PENDING"> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { status } = await window.tellann!.billing.checkoutStatus(invoiceId);
    if (status !== "PENDING") return status;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  return "PENDING";
}

export function BillingPage() {
  const { organizationId, organizations, setOrganizationId } = useActiveOrganization();
  const { organizationRoles } = useDesktop();
  const [plans, setPlans] = useState<BillingPlanCatalog | null>(null);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const [preview, setPreview] = useState<{
    planType: string;
    result: Awaited<ReturnType<NonNullable<typeof window.tellann>["billing"]["previewChange"]>>;
  } | null>(null);

  const isOwner = organizationId ? organizationRoles[organizationId] === "OWNER" : false;

  const load = () => {
    window.tellann!.billing.plans().then(setPlans).catch((err) => setError(String((err as Error)?.message ?? err)));
    if (organizationId) {
      window.tellann!.billing.subscription(organizationId).then(setSubscription).catch(() => setSubscription(null));
      window.tellann!.billing.invoices(organizationId).then(setInvoices).catch(() => setInvoices([]));
    }
  };

  useEffect(load, [organizationId]);

  const runCheckout = async (planType: string, billingInterval: "MONTHLY" | "ANNUAL") => {
    if (!organizationId) return;
    setWorking(planType);
    setError(null);
    try {
      const response = await window.tellann!.billing.checkout({
        organizationId,
        planType,
        billingInterval,
        successUrl: SUCCESS_PREFIX,
        cancelUrl: CANCEL_PREFIX,
      });
      const result = await window.tellann!.billing.openCheckoutWindow(response.checkoutUrl, SUCCESS_PREFIX, CANCEL_PREFIX);
      if (result.status === "cancel") return;
      const status = await pollCheckoutStatus(response.invoiceId);
      if (status === "FAILED") setError("Payment was not completed.");
      load();
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setWorking(null);
    }
  };

  const startChange = async (planType: string) => {
    if (!organizationId) return;
    setWorking(planType);
    setError(null);
    try {
      const result = await window.tellann!.billing.previewChange({ organizationId, planType, billingInterval: "MONTHLY" });
      setPreview({ planType, result });
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setWorking(null);
    }
  };

  const applyChange = async (effectiveMode: "IMMEDIATE" | "NEXT_RENEWAL") => {
    if (!organizationId || !preview) return;
    setWorking(preview.planType);
    setError(null);
    try {
      const response = await window.tellann!.billing.applyChange({
        organizationId,
        previewId: preview.result.previewId,
        effectiveMode,
        idempotencyKey: crypto.randomUUID(),
      });
      if ((response as { status?: string })?.status === "PAYMENT_ACTION_REQUIRED") {
        const { checkoutUrl } = response as { checkoutUrl: string };
        const result = await window.tellann!.billing.openCheckoutWindow(checkoutUrl, SUCCESS_PREFIX, CANCEL_PREFIX);
        if (result.status === "success") load();
      } else {
        load();
      }
      setPreview(null);
    } catch (err) {
      const message = String((err as Error)?.message ?? err);
      if (message.includes("PAYMENT_METHOD_REQUIRED")) {
        setError("Add a payment method before changing plans.");
      } else {
        setError(message);
      }
    } finally {
      setWorking(null);
    }
  };

  if (!plans) return <LoadingState />;

  return (
    <Page
      title="Billing"
      description={`Prices shown in ${plans.currency}.`}
      toolbar={<OrganizationSwitcher organizations={organizations} organizationId={organizationId} onChange={setOrganizationId} />}
    >
      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      {subscription ? (
        <section className="content-card">
          <header className="settings-row-head">
            <h2>Current plan: {formatEnum(subscription.planType)}</h2>
            <Status>{subscription.status}</Status>
          </header>
          {subscription.trialEndsAt ? <p className="muted">Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}</p> : null}
          {subscription.currentPeriodEnd ? <p className="muted">Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p> : null}
        </section>
      ) : null}

      <div className="billing-plan-grid">
        {plans.plans.map((plan) => (
          <section className="content-card" key={plan.type}>
            <h2>{plan.name}</h2>
            <p className="billing-plan-price">
              {plan.monthlyPriceUsd !== null ? `$${plan.monthlyPriceUsd}/mo` : "Contact sales"}
            </p>
            <button
              type="button"
              className={`button ${plan.action === "CURRENT" ? "" : "primary"}`}
              disabled={plan.action === "CURRENT" || plan.action === "CONTACT_SALES" || !isOwner || working === plan.type}
              onClick={() => (plan.action === "SUBSCRIBE" ? runCheckout(plan.type, "MONTHLY") : startChange(plan.type))}
            >
              {working === plan.type ? "Working…" : formatEnum(plan.action)}
            </button>
          </section>
        ))}
      </div>

      {invoices?.length ? (
        <section className="content-card" style={{ marginTop: 16 }}>
          <h2>Invoices</h2>
          <Table
            columns={[
              { key: "date", header: "Date", width: "160px", render: (row: BillingInvoice) => new Date(row.createdAt).toLocaleDateString() },
              { key: "amount", header: "Amount", width: "120px", render: (row: BillingInvoice) => `${row.currency} ${row.amount}` },
              { key: "status", header: "Status", width: "120px", render: (row: BillingInvoice) => <Status>{row.status}</Status> },
            ]}
            rows={invoices}
            getKey={(row) => row.id}
          />
        </section>
      ) : null}

      <Modal isOpen={preview !== null} onClose={() => setPreview(null)} title="Confirm plan change">
        {preview ? (
          <div className="stack">
            <p>
              {preview.result.direction === "DOWNGRADE"
                ? `You'll move to this plan at your next renewal.`
                : `${preview.result.amountDue > 0 ? `You'll be charged $${preview.result.amountDue} now.` : `You'll receive a $${preview.result.creditAmount} credit.`}`}
            </p>
            <ModalActions
              onCancel={() => setPreview(null)}
              onConfirm={() => applyChange(preview.result.direction === "DOWNGRADE" ? "NEXT_RENEWAL" : "IMMEDIATE")}
              confirmLabel={working ? "Applying…" : "Confirm"}
              confirmDisabled={Boolean(working)}
            />
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}
