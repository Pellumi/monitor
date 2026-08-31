import { BillingInterval, MemberRole, PrismaClient } from '@tellann/db';
import { NotificationEmailService, appUrl, buildIdempotencyKey } from '@tellann/email';
import { generateInvoicePdf, type InvoiceDocumentData } from './receipt';
import { formatTaxRate } from './tax';

/**
 * Invoice documents and their delivery (BSS §16, §18).
 *
 * One builder serves both faces of the same record: an unpaid invoice is a
 * request for payment, a paid one is a receipt. They share a number, a period,
 * and a tax breakdown, so producing them from a single source keeps what the
 * payer downloads identical to what they were emailed.
 */

const MAJOR_UNITS = 100;

export function formatMoney(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'NGN' ? 2 : 2,
  }).format(minorUnits / MAJOR_UNITS);
}

export interface InvoiceContext {
  prisma: PrismaClient;
  emailService: NotificationEmailService;
}

/**
 * Assembles everything the PDF needs. Returns null when the invoice does not
 * exist, so callers can answer 404 without a second query.
 */
export async function buildInvoiceDocument(prisma: PrismaClient, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return null;

  const [organization, payer] = await Promise.all([
    prisma.organization.findUnique({ where: { id: invoice.organizationId }, select: { name: true } }),
    invoice.payerUserId
      ? prisma.user.findUnique({
          where: { id: invoice.payerUserId },
          select: { email: true, displayName: true, billingProfile: true },
        })
      : null,
  ]);

  const profile = payer?.billingProfile ?? null;
  const isPaid = invoice.status === 'PAID';

  const data: InvoiceDocumentData = {
    kind: isPaid ? 'RECEIPT' : 'INVOICE',
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.createdAt.toISOString(),
    paidAt: invoice.paidAt?.toISOString() ?? null,
    status: invoice.status,
    reason: invoice.reason,

    billedToName: profile?.legalName || payer?.displayName || organization?.name || 'Tellann customer',
    billedToEmail: profile?.billingEmail || payer?.email || '',
    billedToAddress: [
      profile?.addressLine1,
      profile?.addressLine2,
      [profile?.city, profile?.region, profile?.postalCode].filter(Boolean).join(', '),
      profile?.countryCode,
    ].filter((line): line is string => Boolean(line && line.trim())),
    taxId: profile?.taxId ?? null,
    organizationName: organization?.name ?? '',

    planName: `${invoice.planType} — ${invoice.billingInterval === BillingInterval.ANNUAL ? 'Annual' : 'Monthly'}`,
    billingPeriodStart: invoice.periodStart.toISOString(),
    billingPeriodEnd: invoice.periodEnd.toISOString(),

    currency: invoice.currency,
    subtotal: formatMoney(invoice.subtotal, invoice.currency),
    taxLabel: invoice.taxLabel,
    taxRate: invoice.taxRate ? formatTaxRate(invoice.taxRate) : null,
    taxJurisdiction: invoice.taxJurisdiction,
    tax: formatMoney(invoice.tax, invoice.currency),
    total: formatMoney(invoice.total, invoice.currency),

    provider: invoice.provider ?? '',
    providerReference: invoice.providerReference ?? '',
  };

  const pdf = await generateInvoicePdf(data);
  const filename = `tellann-${isPaid ? 'receipt' : 'invoice'}-${invoice.invoiceNumber}.pdf`;
  return { invoice, data, pdf, filename };
}

/**
 * Emails the invoice document to the organization's billing contacts with the
 * PDF attached. A paid invoice goes out as a receipt, an unpaid one as a
 * request for payment; both are idempotent on the invoice and its status, so a
 * webhook replay cannot double-send while a genuine paid-after-pending
 * transition still delivers.
 */
export async function deliverInvoiceDocument(
  { prisma, emailService }: InvoiceContext,
  invoiceId: string,
): Promise<void> {
  const built = await buildInvoiceDocument(prisma, invoiceId);
  if (!built) return;
  const { invoice, data, pdf, filename } = built;
  const isPaid = invoice.status === 'PAID';

  await emailService.sendToOrganizationMembers({
    templateKey: 'billing-receipt',
    organizationId: invoice.organizationId,
    eventType: isPaid ? 'BILLING_RECEIPT' : 'BILLING_INVOICE',
    severity: 'LOW',
    variables: {
      organizationName: data.organizationName,
      planName: data.planName,
      amountPaid: data.total,
      invoiceNumber: data.invoiceNumber,
      billingUrl: appUrl('/settings/billing'),
      receiptSizeKb: Math.ceil(pdf.length / 1024),
    },
    attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
    idempotencyKey: buildIdempotencyKey(['billing-document', invoice.id, invoice.status]),
    roles: [MemberRole.OWNER, MemberRole.ADMIN],
  });
}
