/**
 * Tax computation for subscription invoices (BSS §17).
 *
 * BSS §17 requires every invoice to state the tax amount, the rate, and the
 * jurisdiction. Rates are keyed on the payer's ISO billing country, which is
 * the only tax-relevant fact Tellann holds, and are expressed in basis points
 * so the printed rate is exact rather than a rounded float.
 *
 * Prices are TAX-INCLUSIVE by default. PPS §4 publishes ₦20,000/month for
 * Local; adding 7.5% VAT on top would charge ₦21,500 and silently break the
 * advertised price, which PPS §14 treats as a pricing change requiring formal
 * review. Instead the published price is the total and the VAT component is
 * extracted from it for display and remittance. Set BILLING_TAX_MODE=EXCLUSIVE
 * to add tax on top instead — that IS a price change and needs pricing sign-off.
 */

export type TaxMode = 'INCLUSIVE' | 'EXCLUSIVE';

export interface TaxRule {
  /** Rate in basis points — 750 = 7.5%. */
  rateBasisPoints: number;
  label: string;
  jurisdiction: string;
}

/**
 * Jurisdictions where Tellann is registered to collect. A country absent from
 * this table is charged no tax — that is a deliberate "not registered here"
 * statement, not an oversight, and it is what keeps the invoice honest.
 */
const TAX_RULES: Record<string, TaxRule> = {
  NG: { rateBasisPoints: 750, label: 'VAT', jurisdiction: 'NG' },
};

export function taxMode(): TaxMode {
  return process.env.BILLING_TAX_MODE?.trim().toUpperCase() === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE';
}

export function taxRuleFor(countryCode?: string | null): TaxRule | null {
  if (!countryCode) return null;
  const override = process.env[`BILLING_TAX_RATE_${countryCode.toUpperCase()}`];
  const rule = TAX_RULES[countryCode.toUpperCase()];
  if (override != null && override.trim()) {
    const parsed = Number(override);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return {
        rateBasisPoints: Math.round(parsed),
        label: rule?.label ?? 'Tax',
        jurisdiction: countryCode.toUpperCase(),
      };
    }
  }
  return rule ?? null;
}

export interface TaxedAmount {
  /** Net of tax, in minor units. */
  subtotal: number;
  /** Tax charged, in minor units. */
  tax: number;
  /** What the payer is actually charged, in minor units. */
  total: number;
  taxRate: number;
  taxLabel: string | null;
  taxJurisdiction: string | null;
}

/**
 * Splits a price into its net and tax components.
 *
 * `listPrice` is the catalog price in minor units. Under INCLUSIVE mode it is
 * the total the payer is charged and tax is extracted from it; under EXCLUSIVE
 * mode it is the net and tax is added on top.
 */
export function applyTax(listPrice: number, countryCode?: string | null): TaxedAmount {
  const rule = taxRuleFor(countryCode);
  if (!rule || rule.rateBasisPoints <= 0) {
    return {
      subtotal: listPrice,
      tax: 0,
      total: listPrice,
      taxRate: 0,
      taxLabel: null,
      taxJurisdiction: countryCode?.toUpperCase() ?? null,
    };
  }

  const rate = rule.rateBasisPoints;
  if (taxMode() === 'EXCLUSIVE') {
    const tax = Math.round((listPrice * rate) / 10_000);
    return {
      subtotal: listPrice,
      tax,
      total: listPrice + tax,
      taxRate: rate,
      taxLabel: rule.label,
      taxJurisdiction: rule.jurisdiction,
    };
  }

  // Inclusive: the published price already contains the tax. Derive the net by
  // dividing out the rate, then take tax as the remainder so subtotal + tax is
  // always exactly the total — rounding can never leak a minor unit.
  const subtotal = Math.round((listPrice * 10_000) / (10_000 + rate));
  return {
    subtotal,
    tax: listPrice - subtotal,
    total: listPrice,
    taxRate: rate,
    taxLabel: rule.label,
    taxJurisdiction: rule.jurisdiction,
  };
}

/** Formats a basis-point rate for display, e.g. 750 → "7.5%". */
export function formatTaxRate(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(basisPoints % 100 === 0 ? 0 : 1)}%`;
}
