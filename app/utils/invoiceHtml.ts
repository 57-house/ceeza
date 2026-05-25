import QRCode from 'qrcode';
import { DEFAULT_TVA_RATE, RESTAURANT_INFO } from '../config/restaurant';
import { Invoice } from '../types/invoice';
import { Order, OrderItem } from '../types/order';

function formatMoney(amount: number): string {
  return `${amount.toFixed(2)} €`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderLine(item: OrderItem, indent = false): string {
  const lineTotal = item.price * item.quantity;
  const prefix = indent ? '&nbsp;&nbsp;+ ' : '';
  let html = `
    <tr>
      <td>${prefix}${item.quantity}× ${item.menu_item_name}</td>
      <td class="right">${formatMoney(item.price)}</td>
      <td class="right">${formatMoney(lineTotal)}</td>
    </tr>`;

  for (const sup of item.supplements || []) {
    html += renderLine(sup, true);
  }
  return html;
}

/** SVG : fonctionne sur mobile/web sans élément canvas (toDataURL échoue sur RN) */
async function generateQrMarkup(payload: string): Promise<string> {
  const svg = await QRCode.toString(payload, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    width: 140,
  });
  return svg;
}

export async function buildInvoiceHtml(
  invoice: Invoice,
  order: Order,
  qrPayload: string
): Promise<string> {
  const tvaPercent = (invoice.tax_rate * 100).toFixed(0);
  const itemRows = order.items.map((item) => renderLine(item)).join('');
  const qrSvg = await generateQrMarkup(qrPayload);

  const paymentStatus =
    invoice.status === 'PAID'
      ? `<p class="paid-badge">✓ PAYÉE le ${formatDate(invoice.paid_at || invoice.created_at)}</p>`
      : `<p class="pending-badge">Scannez le QR à la caisse pour payer</p>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #222; padding: 24px; max-width: 80mm; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #4CAF50; padding-bottom: 12px; }
    .name { font-size: 18px; font-weight: bold; color: #4CAF50; }
    .meta { font-size: 10px; color: #666; margin-top: 4px; line-height: 1.4; }
    .invoice-title { font-size: 14px; font-weight: bold; margin: 12px 0 8px; text-transform: uppercase; }
    .info { margin-bottom: 12px; font-size: 11px; }
    .info p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { text-align: left; font-size: 10px; color: #666; border-bottom: 1px solid #ddd; padding: 4px 0; }
    td { padding: 6px 0; vertical-align: top; }
    .right { text-align: right; }
    .totals { border-top: 2px solid #333; padding-top: 8px; margin-bottom: 16px; }
    .totals .row { display: flex; justify-content: space-between; margin: 4px 0; }
    .totals .total { font-size: 16px; font-weight: bold; margin-top: 8px; color: #4CAF50; }
    .qr-section { text-align: center; margin: 16px 0; padding: 12px; border: 1px dashed #ccc; border-radius: 8px; }
    .qr-section svg { width: 120px; height: 120px; display: block; margin: 0 auto; }
    .qr-hint { font-size: 10px; color: #666; margin-top: 8px; }
    .paid-badge { color: #4CAF50; font-weight: bold; text-align: center; margin: 8px 0; }
    .pending-badge { color: #FF9800; font-weight: bold; text-align: center; margin: 8px 0; font-size: 11px; }
    .footer { margin-top: 16px; text-align: center; font-size: 10px; color: #888; }
  </style>
</head>
<body>
  <div class="header">
    <div class="name">${RESTAURANT_INFO.name}</div>
    <div class="meta">
      ${RESTAURANT_INFO.address}<br/>
      ${RESTAURANT_INFO.city}<br/>
      Tél. ${RESTAURANT_INFO.phone}<br/>
      SIRET ${RESTAURANT_INFO.siret}
    </div>
  </div>

  <div class="invoice-title">Facture ${invoice.invoice_number}</div>
  ${paymentStatus}
  <div class="info">
    <p><strong>Table :</strong> ${invoice.table_number}</p>
    <p><strong>Date :</strong> ${formatDate(invoice.created_at)}</p>
    <p><strong>Réf. :</strong> ${invoice.id.slice(0, 8).toUpperCase()}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Article</th>
        <th class="right">P.U.</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Sous-total HT</span><span>${formatMoney(invoice.subtotal)}</span></div>
    <div class="row"><span>TVA (${tvaPercent}%)</span><span>${formatMoney(invoice.tax_amount)}</span></div>
    <div class="row total"><span>Total TTC</span><span>${formatMoney(invoice.total)}</span></div>
  </div>

  <div class="qr-section">
    ${qrSvg}
    <p class="qr-hint">Scannez à la caisse pour régler cette facture</p>
    <p class="qr-hint">${invoice.invoice_number}</p>
  </div>

  <div class="footer">
    Merci de votre visite !<br/>
    Ceeza — ${RESTAURANT_INFO.name}
  </div>
</body>
</html>`;
}

export function computeInvoiceAmounts(
  orderTotal: number,
  taxRate: number = DEFAULT_TVA_RATE
): { subtotal: number; tax_amount: number; total: number } {
  const subtotal = orderTotal / (1 + taxRate);
  const tax_amount = orderTotal - subtotal;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_amount: Math.round(tax_amount * 100) / 100,
    total: orderTotal,
  };
}
