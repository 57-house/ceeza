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
import { sqlEscape } from '../utils/sqlEscape';
import { OrderItem } from '../types/order';
import { stableInvoiceId, stableInvoiceNumber, stableTableInvoiceId } from '../utils/stableId';
import { orderService } from './orderService';
import { tableService } from './tableService';

const BILLABLE_STATUSES: OrderStatus[] = ['READY', 'SERVED'];

export type TableBillGroup = {
  tableId: string;
  tableNumber: number;
  orders: Order[];
  total: number;
};

function parseLinkedOrderIds(invoice: Invoice): string[] {
  if (!invoice.linked_order_ids) return [];
  try {
    const parsed = JSON.parse(invoice.linked_order_ids) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

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
    linked_order_ids: (row.linked_order_ids as string | null) ?? null,
  };
}

function invoiceCoversOrder(invoice: Invoice, orderId: string): boolean {
  if (invoice.order_id === orderId) return true;
  return parseLinkedOrderIds(invoice).includes(orderId);
}

function getInvoiceOrderIds(invoice: Invoice): string[] {
  const linked = parseLinkedOrderIds(invoice);
  if (linked.length > 0) return [...new Set(linked)];
  return [invoice.order_id];
}

export const invoiceService = {
  hasInvoice: (orderId: string): boolean => {
    if (invoiceService.getInvoiceByOrderId(orderId) !== null) return true;
    return invoiceService.getAllInvoices().some((inv) => invoiceCoversOrder(inv, orderId));
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

  getBillableOrdersForTable: (tableNumber: number): Order[] => {
    return invoiceService
      .getBillableOrders()
      .filter((o) => o.table_number === tableNumber)
      .sort((a, b) => a.created_at - b.created_at);
  },

  getBillableTableGroups: (): TableBillGroup[] => {
    const groups = new Map<number, Order[]>();
    for (const order of invoiceService.getBillableOrders()) {
      const list = groups.get(order.table_number) ?? [];
      list.push(order);
      groups.set(order.table_number, list);
    }
    return Array.from(groups.entries())
      .map(([tableNumber, orders]) => ({
        tableId: tableService.resolveTableId(tableNumber),
        tableNumber,
        orders: orders.sort((a, b) => a.created_at - b.created_at),
        total: orders.reduce((sum, o) => sum + o.total, 0),
      }))
      .sort((a, b) => a.tableNumber - b.tableNumber);
  },

  buildTableBill: (orders: Order[]): Order => {
    if (!orders.length) {
      throw new Error('Aucune commande à facturer');
    }
    const sorted = [...orders].sort((a, b) => a.created_at - b.created_at);
    const mergedItems: OrderItem[] = [];

    sorted.forEach((order, index) => {
      const prefix = sorted.length > 1 ? `[Cmd ${index + 1}] ` : '';
      order.items.forEach((item) => {
        mergedItems.push({
          ...item,
          id: `${order.id}-${item.id}`,
          menu_item_name: `${prefix}${item.menu_item_name}`,
          supplements: item.supplements?.map((sup) => ({
            ...sup,
            id: `${order.id}-${sup.id}`,
          })),
        });
      });
    });

    const total = sorted.reduce((sum, o) => sum + o.total, 0);
    const first = sorted[0];

    return {
      id: first.id,
      table_id: first.table_id,
      table_number: first.table_number,
      status: first.status,
      items: mergedItems,
      total,
      created_at: first.created_at,
      updated_at: Date.now(),
    };
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
    const id = stableInvoiceId(orderId);
    const now = Date.now();
    const invoiceNumber = stableInvoiceNumber(order.table_number, order.created_at);
    const { subtotal, tax_amount, total } = computeInvoiceAmounts(order.total, taxRate);

    db.execSync(`
      INSERT OR REPLACE INTO invoices (id, order_id, invoice_number, table_number, subtotal, tax_rate, tax_amount, total, status, created_at, paid_at, linked_order_ids)
      VALUES ('${id}', '${orderId}', '${invoiceNumber}', ${order.table_number}, ${subtotal}, ${taxRate}, ${tax_amount}, ${total}, 'PENDING', ${now}, NULL, NULL)
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
      linked_order_ids: null,
    };
    pushLocalSync({ type: 'INVOICE_SYNC', invoice });
    return invoice;
  },

  cancelPendingInvoice: (invoiceId: string): void => {
    const invoice = invoiceService.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Facture introuvable');
    }
    if (invoice.status !== 'PENDING') {
      throw new Error('Seules les factures en attente peuvent être annulées');
    }

    const db = getDB();
    db.execSync(`DELETE FROM invoices WHERE id = '${invoiceId}'`);
    pushLocalSync({ type: 'INVOICE_DELETE', id: invoiceId });
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

    for (const orderId of getInvoiceOrderIds(invoice)) {
      orderService.updateOrderStatus(orderId, 'PAID');
    }
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

  getOrdersForInvoice: (invoice: Invoice): Order[] => {
    return getInvoiceOrderIds(invoice)
      .map((id) => orderService.getOrderById(id))
      .filter((o): o is Order => o !== null)
      .sort((a, b) => a.created_at - b.created_at);
  },

  getInvoiceHtml: async (invoice: Invoice): Promise<string | null> => {
    const orders = invoiceService.getOrdersForInvoice(invoice);
    if (!orders.length) return null;
    const bill =
      orders.length > 1 ? invoiceService.buildTableBill(orders) : orders[0];
    return buildInvoiceHtml(invoice, bill, encodeInvoiceQr(invoice.id));
  },

  resolveBillableOrdersForTable: (tableNumber: number, orderIds: string[]): Order[] => {
    if (!orderIds.length) {
      throw new Error('Sélectionnez au moins une commande');
    }

    const orders: Order[] = [];

    for (const id of orderIds) {
      const order = orderService.getOrderById(id);
      if (
        !order ||
        order.table_number !== tableNumber ||
        !BILLABLE_STATUSES.includes(order.status) ||
        invoiceService.hasInvoice(id)
      ) {
        throw new Error('Une ou plusieurs commandes sélectionnées ne peuvent pas être facturées');
      }
      orders.push(order);
    }

    if (!orders.length) {
      throw new Error('Aucune commande valide sélectionnée');
    }

    return orders.sort((a, b) => a.created_at - b.created_at);
  },

  createInvoiceFromOrders: (
    tableNumber: number,
    orderIds: string[],
    taxRate: number = DEFAULT_TVA_RATE
  ): Invoice => {
    const orders = invoiceService.resolveBillableOrdersForTable(tableNumber, orderIds);
    if (orders.length === 1) {
      return invoiceService.createInvoice(orders[0].id, taxRate);
    }

    const sortedOrderIds = orders.map((o) => o.id);
    const mergedTotal = orders.reduce((sum, o) => sum + o.total, 0);
    if (mergedTotal <= 0) {
      throw new Error('Le total de la table est vide');
    }

    const db = getDB();
    const primaryOrderId = orders[0].id;
    const id = stableTableInvoiceId(tableNumber, sortedOrderIds);
    const now = Date.now();
    const invoiceNumber = stableInvoiceNumber(tableNumber, now);
    const { subtotal, tax_amount, total } = computeInvoiceAmounts(mergedTotal, taxRate);
    const linkedJson = sqlEscape(JSON.stringify(sortedOrderIds));

    db.execSync(`
      INSERT OR REPLACE INTO invoices (id, order_id, invoice_number, table_number, subtotal, tax_rate, tax_amount, total, status, created_at, paid_at, linked_order_ids)
      VALUES ('${id}', '${primaryOrderId}', '${invoiceNumber}', ${tableNumber}, ${subtotal}, ${taxRate}, ${tax_amount}, ${total}, 'PENDING', ${now}, NULL, '${linkedJson}')
    `);

    const invoice: Invoice = {
      id,
      order_id: primaryOrderId,
      invoice_number: invoiceNumber,
      table_number: tableNumber,
      subtotal,
      tax_rate: taxRate,
      tax_amount,
      total,
      status: 'PENDING',
      created_at: now,
      paid_at: null,
      linked_order_ids: JSON.stringify(sortedOrderIds),
    };
    pushLocalSync({ type: 'INVOICE_SYNC', invoice });
    return invoice;
  },

  createTableInvoice: (
    tableId: string,
    tableNumber: number,
    orderIds?: string[],
    taxRate: number = DEFAULT_TVA_RATE
  ): Invoice => {
    const ids =
      orderIds && orderIds.length > 0
        ? orderIds
        : invoiceService.getBillableOrdersForTable(tableNumber).map((o) => o.id);
    if (!ids.length) {
      throw new Error('Aucune commande à facturer pour cette table');
    }
    return invoiceService.createInvoiceFromOrders(tableNumber, ids, taxRate);
  },

  createAndPrintTableInvoice: async (
    tableId: string,
    tableNumber: number,
    orderIds?: string[]
  ): Promise<Invoice> => {
    const invoice = invoiceService.createTableInvoice(tableId, tableNumber, orderIds);
    try {
      await invoiceService.printInvoice(invoice);
    } catch (error) {
      console.error('Erreur impression:', error);
      Alert.alert(
        'Facture créée',
        `Facture ${invoice.invoice_number} créée pour la table ${tableNumber}. Scannez le QR en caisse pour encaisser.`
      );
    }
    return invoice;
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
