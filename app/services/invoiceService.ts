import { v4 as uuidv4 } from 'uuid';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import { getDB } from '../db/database';
import { pushLocalSync } from '../sync/syncBridge';
import { DEFAULT_TVA_RATE } from '../config/restaurant';
import { Invoice, InvoiceStatus } from '../types/invoice';
import { Order, OrderStatus } from '../types/order';
import { buildInvoiceHtml, computeInvoiceAmounts } from '../utils/invoiceHtml';
import { encodeInvoiceQr, parseInvoiceQr } from '../utils/invoiceQr';
import { orderService } from './orderService';
import { tableService } from './tableService';

const BILLABLE_STATUSES: OrderStatus[] = ['READY', 'SERVED'];

function normalizeInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    order_id: row.order_id as string,
    invoice_number: row.invoice_number as string,
    table_number: row.table_number as number,
    subtotal: row.subtotal as number,
    tax_rate: row.tax_rate as number,
    tax_amount: row.tax_amount as number,
    total: row.total as number,
    status: ((row.status as string) || 'PENDING') as InvoiceStatus,
    created_at: row.created_at as number,
    paid_at: (row.paid_at as number | null) ?? null,
  };
}

export const invoiceService = {
  hasInvoice: (orderId: string): boolean => {
    return invoiceService.getInvoiceByOrderId(orderId) !== null;
  },

  getInvoiceByOrderId: (orderId: string): Invoice | null => {
    const db = getDB();
    try {
      const row = db.getFirstSync<Record<string, unknown>>(
        'SELECT * FROM invoices WHERE order_id = ?',
        [orderId]
      );
      return row ? normalizeInvoice(row) : null;
    } catch (error) {
      console.error('Erreur getInvoiceByOrderId:', error);
      return null;
    }
  },

  getInvoiceById: (invoiceId: string): Invoice | null => {
    const db = getDB();
    try {
      const row = db.getFirstSync<Record<string, unknown>>(
        'SELECT * FROM invoices WHERE id = ?',
        [invoiceId]
      );
      return row ? normalizeInvoice(row) : null;
    } catch (error) {
      console.error('Erreur getInvoiceById:', error);
      return null;
    }
  },

  getInvoiceByNumber: (invoiceNumber: string): Invoice | null => {
    const db = getDB();
    try {
      const row = db.getFirstSync<Record<string, unknown>>(
        'SELECT * FROM invoices WHERE invoice_number = ?',
        [invoiceNumber.trim()]
      );
      return row ? normalizeInvoice(row) : null;
    } catch (error) {
      console.error('Erreur getInvoiceByNumber:', error);
      return null;
    }
  },

  resolveInvoiceFromScan: (raw: string): Invoice | null => {
    const id = parseInvoiceQr(raw);
    if (id) {
      const byId = invoiceService.getInvoiceById(id);
      if (byId) return byId;
    }
    return invoiceService.getInvoiceByNumber(raw.trim());
  },

  getAllInvoices: (): Invoice[] => {
    const db = getDB();
    try {
      const rows =
        db.getAllSync<Record<string, unknown>>(
          'SELECT * FROM invoices ORDER BY created_at DESC',
          []
        ) ?? [];
      return rows.map(normalizeInvoice);
    } catch (error) {
      console.error('Erreur getAllInvoices:', error);
      return [];
    }
  },

  getPendingInvoices: (): Invoice[] => {
    const db = getDB();
    try {
      const rows =
        db.getAllSync<Record<string, unknown>>(
          "SELECT * FROM invoices WHERE status = 'PENDING' ORDER BY created_at DESC",
          []
        ) ?? [];
      return rows.map(normalizeInvoice);
    } catch (error) {
      console.error('Erreur getPendingInvoices:', error);
      return [];
    }
  },

  getPaidInvoices: (): Invoice[] => {
    const db = getDB();
    try {
      const rows =
        db.getAllSync<Record<string, unknown>>(
          "SELECT * FROM invoices WHERE status = 'PAID' ORDER BY paid_at DESC",
          []
        ) ?? [];
      return rows.map(normalizeInvoice);
    } catch (error) {
      console.error('Erreur getPaidInvoices:', error);
      return [];
    }
  },

  getBillableOrders: (): Order[] => {
    const orders: Order[] = [];
    for (const status of BILLABLE_STATUSES) {
      orders.push(...orderService.getOrdersByStatus(status));
    }
    return orders.filter((o) => !invoiceService.hasInvoice(o.id));
  },

  generateNextInvoiceNumber: (): string => {
    const db = getDB();
    const today = new Date();
    const prefix = `FAC-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    try {
      const all = invoiceService.getAllInvoices();
      const todayInvoices = all.filter((inv) => inv.invoice_number.startsWith(prefix));
      const seq = todayInvoices.length + 1;
      return `${prefix}-${String(seq).padStart(3, '0')}`;
    } catch {
      return `${prefix}-001`;
    }
  },

  /** Crée une facture en attente de paiement (avec QR code à l'impression) */
  createInvoice: (orderId: string, taxRate: number = DEFAULT_TVA_RATE): Invoice => {
    const order = orderService.getOrderById(orderId);
    if (!order) {
      throw new Error('Commande introuvable');
    }
    if (!BILLABLE_STATUSES.includes(order.status)) {
      throw new Error('La commande doit être terminée (prête ou servie) pour être facturée');
    }
    if (invoiceService.hasInvoice(orderId)) {
      throw new Error('Une facture existe déjà pour cette commande');
    }
    if (order.items.length === 0 || order.total <= 0) {
      throw new Error('La commande est vide');
    }

    const db = getDB();
    const id = uuidv4();
    const now = Date.now();
    const invoiceNumber = invoiceService.generateNextInvoiceNumber();
    const { subtotal, tax_amount, total } = computeInvoiceAmounts(order.total, taxRate);

    db.execSync(`
      INSERT INTO invoices (id, order_id, invoice_number, table_number, subtotal, tax_rate, tax_amount, total, status, created_at, paid_at)
      VALUES ('${id}', '${orderId}', '${invoiceNumber}', ${order.table_number}, ${subtotal}, ${taxRate}, ${tax_amount}, ${total}, 'PENDING', ${now}, NULL)
    `);

    const invoice = {
      id,
      order_id: orderId,
      invoice_number: invoiceNumber,
      table_number: order.table_number,
      subtotal,
      tax_rate: taxRate,
      tax_amount,
      total,
      status: 'PENDING' as const,
      created_at: now,
      paid_at: null,
    };
    pushLocalSync({ type: 'INVOICE_SYNC', invoice });
    return invoice;
  },

  markInvoiceAsPaid: (invoiceId: string): Invoice => {
    const invoice = invoiceService.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Facture introuvable');
    }
    if (invoice.status === 'PAID') {
      throw new Error('Cette facture est déjà payée');
    }

    const order = orderService.getOrderById(invoice.order_id);
    if (!order) {
      throw new Error('Commande associée introuvable');
    }

    const db = getDB();
    const now = Date.now();

    db.execSync(`
      UPDATE invoices
      SET status = 'PAID', paid_at = ${now}
      WHERE id = '${invoiceId}'
    `);

    orderService.updateOrderStatus(invoice.order_id, 'PAID');
    tableService.updateTableStatus(order.table_id, 'AVAILABLE');

    const paid = { ...invoice, status: 'PAID' as const, paid_at: now };
    pushLocalSync({ type: 'INVOICE_PAID', invoice: paid });
    return paid;
  },

  markInvoiceAsPaidFromScan: (raw: string): Invoice => {
    const invoice = invoiceService.resolveInvoiceFromScan(raw);
    if (!invoice) {
      throw new Error('Facture non reconnue — scannez le QR ou saisissez le numéro');
    }
    return invoiceService.markInvoiceAsPaid(invoice.id);
  },

  getInvoiceHtml: async (invoice: Invoice): Promise<string | null> => {
    const order = orderService.getOrderById(invoice.order_id);
    if (!order) return null;
    return buildInvoiceHtml(invoice, order, encodeInvoiceQr(invoice.id));
  },

  printInvoice: async (invoice: Invoice): Promise<void> => {
    const html = await invoiceService.getInvoiceHtml(invoice);
    if (!html) {
      throw new Error('Impossible de générer la facture');
    }

    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return;
    }

    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Facture ${invoice.invoice_number}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      await Print.printAsync({ html });
    }
  },

  createAndPrintInvoice: async (orderId: string): Promise<Invoice> => {
    const invoice = invoiceService.createInvoice(orderId);
    try {
      await invoiceService.printInvoice(invoice);
    } catch (error) {
      console.error('Erreur impression:', error);
      Alert.alert(
        'Facture créée',
        `Facture ${invoice.invoice_number} créée. Scannez le QR en caisse pour encaisser, ou marquez-la payée manuellement.`
      );
    }
    return invoice;
  },
};
