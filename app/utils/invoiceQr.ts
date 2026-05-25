/** Préfixe du QR code facture Ceeza */
export const QR_PREFIX = 'CEEZA:INV:';

export function encodeInvoiceQr(invoiceId: string): string {
  return `${QR_PREFIX}${invoiceId}`;
}

/** Extrait l'identifiant facture depuis les données scannées */
export function parseInvoiceQr(data: string): string | null {
  const trimmed = data.trim();
  if (trimmed.startsWith(QR_PREFIX)) {
    return trimmed.slice(QR_PREFIX.length);
  }
  try {
    const json = JSON.parse(trimmed) as { type?: string; id?: string };
    if (json.type === 'ceeza-invoice' && json.id) {
      return json.id;
    }
    if (json.id) {
      return json.id;
    }
  } catch {
    // pas du JSON
  }
  return null;
}
