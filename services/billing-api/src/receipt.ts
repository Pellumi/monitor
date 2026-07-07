/* eslint-disable @typescript-eslint/no-var-requires */
// PDFKit is CommonJS-only — use require() directly
// @types/pdfkit must be installed as a devDependency
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as new (opts?: { size?: string; margin?: number }) => any;

export interface ReceiptData {
  invoiceNumber: string;        // e.g. "INV-2024-00123"
  invoiceDate: string;          // ISO date string
  organizationName: string;
  organizationEmail: string;    // Billed-to email
  planName: string;             // e.g. "TEAM — Monthly"
  currency: string;             // e.g. "USD", "NGN"
  amountPaid: number;           // In major currency units (not cents/kobo)
  billingPeriodStart: string;   // ISO date
  billingPeriodEnd: string;     // ISO date
  provider: string;             // 'STRIPE' | 'PAYSTACK'
  providerReference: string;    // Stripe invoice ID or Paystack reference
}

/**
 * Generates a PDF receipt buffer for a paid invoice.
 *
 * Uses PDFKit to create a clean, branded receipt document.
 * Returns a Buffer that can be attached to an email or stored in object storage.
 */
export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ─── Header ──────────────────────────────────────────────
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('SOTS', 50, 50)
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#6B7280')
      .text('Software Observability & Testing Suite', 50, 78);

    // Receipt label
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('Payment Receipt', 0, 50, { align: 'right' })
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#6B7280')
      .text(`Invoice #${data.invoiceNumber}`, 0, 74, { align: 'right' })
      .text(formatDate(data.invoiceDate), 0, 88, { align: 'right' });

    // ─── Divider ─────────────────────────────────────────────
    doc
      .moveTo(50, 115)
      .lineTo(545, 115)
      .strokeColor('#E5E7EB')
      .lineWidth(1)
      .stroke();

    // ─── Billed To ───────────────────────────────────────────
    doc.y = 130;
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#6B7280')
      .text('BILLED TO', 50)
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text(data.organizationName, 50, doc.y + 4)
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#374151')
      .text(data.organizationEmail, 50, doc.y + 2);

    // ─── Summary table ────────────────────────────────────────
    const tableTop = 220;
    const col1 = 50;
    const col2 = 390;
    const col3 = 545;

    doc
      .rect(col1, tableTop, col3 - col1, 28)
      .fill('#F9FAFB')
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#6B7280')
      .text('DESCRIPTION', col1 + 8, tableTop + 9)
      .text('AMOUNT', col2 + 8, tableTop + 9);

    const row1Top = tableTop + 28;
    doc
      .moveTo(col1, tableTop)
      .lineTo(col3, tableTop)
      .strokeColor('#D1D5DB')
      .stroke();

    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#111827')
      .text(`${data.planName} Subscription`, col1 + 8, row1Top + 12)
      .fontSize(9)
      .fillColor('#6B7280')
      .text(
        `${formatDate(data.billingPeriodStart)} – ${formatDate(data.billingPeriodEnd)}`,
        col1 + 8,
        row1Top + 28,
      )
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text(formatAmount(data.amountPaid, data.currency), col2 + 8, row1Top + 12);

    // Total row
    const totalTop = row1Top + 60;
    doc
      .moveTo(col1, totalTop)
      .lineTo(col3, totalTop)
      .strokeColor('#D1D5DB')
      .stroke();

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('Total Paid', col1 + 8, totalTop + 12)
      .text(formatAmount(data.amountPaid, data.currency), col2 + 8, totalTop + 12);

    // ─── Payment details ──────────────────────────────────────
    const detailTop = totalTop + 60;
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#6B7280')
      .text('PAYMENT DETAILS', col1, detailTop);

    const details: [string, string][] = [
      ['Payment Method', data.provider === 'STRIPE' ? 'Card (via Stripe)' : 'Card (via Paystack)'],
      ['Transaction Reference', data.providerReference],
      ['Date', formatDate(data.invoiceDate)],
    ];

    let dy = detailTop + 16;
    for (const [label, value] of details) {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#374151')
        .text(label, col1, dy)
        .font('Helvetica')
        .fillColor('#111827')
        .text(value, 200, dy);
      dy += 18;
    }

    // ─── Footer ───────────────────────────────────────────────
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#9CA3AF')
      .text(
        'Thank you for your business. For support, contact support@sots.io',
        50,
        700,
        { align: 'center', width: 495 },
      )
      .text(
        'SOTS · Receipt generated automatically · Not a tax invoice',
        50,
        715,
        { align: 'center', width: 495 },
      );

    doc.end();
  });
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
