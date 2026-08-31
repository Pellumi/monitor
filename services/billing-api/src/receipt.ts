/* eslint-disable @typescript-eslint/no-var-requires */
// PDFKit is CommonJS-only — use require() directly
// @types/pdfkit must be installed as a devDependency
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as new (opts?: { size?: string; margin?: number }) => any;

/**
 * The billing document. One template renders both faces of an invoice record:
 * unpaid it is a request for payment, paid it is a receipt. Amounts arrive
 * pre-formatted so the money formatting matches the dashboard exactly, and the
 * tax line is itemized because BSS §17 requires the amount, rate, and
 * jurisdiction to appear on the document itself.
 */
export interface InvoiceDocumentData {
  kind: 'INVOICE' | 'RECEIPT';
  invoiceNumber: string;
  issuedAt: string;
  paidAt: string | null;
  status: string;
  reason: string;

  billedToName: string;
  billedToEmail: string;
  billedToAddress: string[];
  taxId: string | null;
  organizationName: string;

  planName: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;

  currency: string;
  subtotal: string;
  taxLabel: string | null;
  taxRate: string | null;
  taxJurisdiction: string | null;
  tax: string;
  total: string;

  provider: string;
  providerReference: string;
}

const INK = '#111827';
const MUTED = '#6B7280';
const RULE = '#E5E7EB';
const RULE_STRONG = '#D1D5DB';
const PANEL = '#F9FAFB';

const LEFT = 50;
const RIGHT = 545;

export async function generateInvoicePdf(data: InvoiceDocumentData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const isReceipt = data.kind === 'RECEIPT';

    // ─── Header ──────────────────────────────────────────────
    doc
      .fontSize(24).font('Helvetica-Bold').fillColor(INK)
      .text('Tellann', LEFT, 50)
      .fontSize(10).font('Helvetica').fillColor(MUTED)
      .text('Behavioral Quality Intelligence Platform', LEFT, 78);

    doc
      .fontSize(18).font('Helvetica-Bold').fillColor(INK)
      .text(isReceipt ? 'Payment Receipt' : 'Invoice', 0, 50, { align: 'right' })
      .fontSize(10).font('Helvetica').fillColor(MUTED)
      .text(`No. ${data.invoiceNumber}`, 0, 74, { align: 'right' })
      .text(`Issued ${formatDate(data.issuedAt)}`, 0, 88, { align: 'right' });

    if (!isReceipt) {
      doc.fillColor('#B45309').font('Helvetica-Bold')
        .text(labelForStatus(data.status), 0, 102, { align: 'right' });
    }

    doc.moveTo(LEFT, 122).lineTo(RIGHT, 122).strokeColor(RULE).lineWidth(1).stroke();

    // ─── Billed to ───────────────────────────────────────────
    let y = 140;
    doc
      .fontSize(9).font('Helvetica-Bold').fillColor(MUTED)
      .text('BILLED TO', LEFT, y);
    y += 14;
    doc.fontSize(12).font('Helvetica-Bold').fillColor(INK).text(data.billedToName, LEFT, y);
    y += 16;
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    if (data.billedToEmail) { doc.text(data.billedToEmail, LEFT, y); y += 13; }
    for (const line of data.billedToAddress) { doc.text(line, LEFT, y); y += 13; }
    if (data.taxId) { doc.text(`Tax ID: ${data.taxId}`, LEFT, y); y += 13; }
    if (data.organizationName && data.organizationName !== data.billedToName) {
      doc.fillColor(MUTED).text(`For ${data.organizationName}`, LEFT, y);
      y += 13;
    }

    // ─── Line items ──────────────────────────────────────────
    const tableTop = Math.max(y + 22, 250);
    const amountX = 400;

    doc
      .rect(LEFT, tableTop, RIGHT - LEFT, 26).fill(PANEL)
      .fontSize(9).font('Helvetica-Bold').fillColor(MUTED)
      .text('DESCRIPTION', LEFT + 8, tableTop + 9)
      .text('AMOUNT', amountX, tableTop + 9, { width: RIGHT - amountX - 8, align: 'right' });
    doc.moveTo(LEFT, tableTop).lineTo(RIGHT, tableTop).strokeColor(RULE_STRONG).stroke();

    const rowTop = tableTop + 26;
    doc
      .fontSize(11).font('Helvetica').fillColor(INK)
      .text(`${data.planName} subscription`, LEFT + 8, rowTop + 12)
      .fontSize(9).fillColor(MUTED)
      .text(
        `${formatDate(data.billingPeriodStart)} – ${formatDate(data.billingPeriodEnd)}${
          data.reason && data.reason !== 'SUBSCRIPTION' ? `  ·  ${titleCase(data.reason)}` : ''
        }`,
        LEFT + 8, rowTop + 28,
      )
      .fontSize(11).font('Helvetica').fillColor(INK)
      .text(data.subtotal, amountX, rowTop + 12, { width: RIGHT - amountX - 8, align: 'right' });

    // ─── Totals ──────────────────────────────────────────────
    let ty = rowTop + 56;
    doc.moveTo(LEFT, ty).lineTo(RIGHT, ty).strokeColor(RULE).stroke();
    ty += 12;

    const totalRow = (label: string, value: string, bold = false) => {
      doc
        .fontSize(bold ? 12 : 10)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(bold ? INK : '#374151')
        .text(label, LEFT + 8, ty, { width: amountX - LEFT - 16, align: 'right' })
        .text(value, amountX, ty, { width: RIGHT - amountX - 8, align: 'right' });
      ty += bold ? 22 : 18;
    };

    totalRow('Subtotal', data.subtotal);
    // The tax line is stated even at zero, so "no tax was charged" is explicit
    // rather than an omission the reader has to interpret.
    totalRow(
      data.taxLabel
        ? `${data.taxLabel}${data.taxRate ? ` (${data.taxRate})` : ''}${data.taxJurisdiction ? ` · ${data.taxJurisdiction}` : ''}`
        : 'Tax',
      data.tax,
    );

    doc.moveTo(amountX - 120, ty).lineTo(RIGHT, ty).strokeColor(RULE_STRONG).stroke();
    ty += 10;
    totalRow(isReceipt ? 'Total paid' : 'Amount due', data.total, true);

    // ─── Payment details ─────────────────────────────────────
    let dy = ty + 26;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(MUTED).text('PAYMENT DETAILS', LEFT, dy);
    dy += 16;

    const details: Array<[string, string]> = [
      ['Payment method', data.provider ? `Card via ${titleCase(data.provider)}` : 'Not yet paid'],
      ['Reference', data.providerReference || '—'],
      [isReceipt ? 'Paid on' : 'Issued on', formatDate(data.paidAt ?? data.issuedAt)],
    ];
    for (const [label, value] of details) {
      doc
        .fontSize(10).font('Helvetica-Bold').fillColor('#374151').text(label, LEFT, dy)
        .font('Helvetica').fillColor(INK).text(value, 200, dy);
      dy += 18;
    }

    // ─── Footer ──────────────────────────────────────────────
    const taxNote = data.taxLabel
      ? `This is a tax invoice. ${data.taxLabel} of ${data.tax} was charged under ${data.taxJurisdiction ?? 'the applicable'} tax rules.`
      : 'No tax was charged on this invoice.';
    doc
      .fontSize(9).font('Helvetica').fillColor('#9CA3AF')
      .text(taxNote, LEFT, 690, { align: 'center', width: RIGHT - LEFT })
      .text('Questions about this document? Contact support@tellann.co', LEFT, 706, { align: 'center', width: RIGHT - LEFT })
      .text('Tellann · Generated automatically', LEFT, 722, { align: 'center', width: RIGHT - LEFT });

    doc.end();
  });
}

function labelForStatus(status: string): string {
  if (status === 'PENDING') return 'AWAITING PAYMENT';
  if (status === 'FAILED') return 'PAYMENT FAILED';
  return status.replace(/_/g, ' ');
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().replace(/_/g, ' ');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}
