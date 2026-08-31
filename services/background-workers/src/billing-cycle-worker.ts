/**
 * Drives the recurring billing cycle.
 *
 * The cycle itself lives in billing-api, where the processor clients, tax
 * rules, and invoice delivery already are. This worker owns only the schedule,
 * so exactly one process decides when payers are charged — running the charge
 * loop in the API would repeat it once per replica.
 */

const DEFAULT_BILLING_API = `http://127.0.0.1:${process.env.BILLING_API_PORT ?? 3009}`;

export interface BillingCycleSummary {
  trialsConverted: number;
  renewalsCharged: number;
  chargesFailed: number;
  gracePeriodsStarted: number;
  plansLapsed: number;
  trialWarningsSent: number;
}

let warnedAboutSecret = false;

export async function runBillingCycle(): Promise<BillingCycleSummary | null> {
  const secret = process.env.BILLING_INTERNAL_SECRET?.trim();
  if (!secret) {
    // Warn once rather than every minute — the message is actionable, the
    // repetition is not.
    if (!warnedAboutSecret) {
      warnedAboutSecret = true;
      console.warn(
        '[billing-cycle] BILLING_INTERNAL_SECRET is not set. Renewals, trial conversions, '
        + 'and grace-period expiry will not run until it is configured on both '
        + 'background-workers and billing-api.',
      );
    }
    return null;
  }

  const baseUrl = process.env.BILLING_API_URL?.trim() || DEFAULT_BILLING_API;
  const response = await fetch(`${baseUrl}/billing/internal/billing-cycle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tellann-internal-secret': secret },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Billing cycle failed with ${response.status}: ${body.slice(0, 300)}`);
  }
  return await response.json() as BillingCycleSummary;
}
