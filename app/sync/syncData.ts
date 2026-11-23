import { getDB } from '../db/database';
import { invoiceService } from '../services/invoiceService';
import { menuService } from '../services/menuService';
import { orderService } from '../services/orderService';
import { supplyItemService } from '../services/supplyItemService';
import { supplyOrderService, SupplyOrder } from '../services/supplyOrderService';
import { tableService } from '../services/tableService';
import { Invoice } from '../types/invoice';
import { MenuItem } from '../types/menu';
import { Order } from '../types/order';
import { Table } from '../types/table';
import { SupplyItem } from '../types/supply';
import { sqlEscape } from '../utils/sqlEscape';
import {
  stableInvoiceId,
  stableInvoiceNumber,
  stableMenuItemId,
  stableSupplyItemId,
  stableSupplyOrderId,
  stableSupplyEntryId,
} from '../utils/stableId';
import { SyncSnapshot } from './syncTypes';

function getAllOrdersForSync(): Order[] {
  const db = getDB();
  try {
    const rows = db.getAllSync<{ id: string }>(
      'SELECT * FROM orders ORDER BY created_at DESC',
      []
    );
    return rows
      .map((r) => orderService.getOrderById(r.id))
      .filter((o): o is Order => o !== null);
  } catch {
    return [];
  }
}

function getAllSupplyOrdersForSync(): SupplyOrder[] {
  const db = getDB();
  try {
    const rows = db.getAllSync<{ id: string }>(
      'SELECT * FROM supply_orders ORDER BY created_at DESC',
      []
    );
    return rows
      .map((r) => supplyOrderService.getSupplyOrderById(r.id))
      .filter((o): o is SupplyOrder => o !== null);
  } catch {
    return [];
  }
}

export function exportSyncSnapshot(): SyncSnapshot {
  return {
    tables: tableService.getAllTables(),
    menu_items: menuService.getAllMenuItems(),
    orders: getAllOrdersForSync(),
    invoices: invoiceService.getAllInvoices(),
    supply_items: supplyItemService.getAllSupplyItems(),
    supply_orders: getAllSupplyOrdersForSync(),
    exported_at: Date.now(),
  };
}

export function upsertTable(table: Table): void {
  tableService.upsertFromSync(table);
}

function dedupeTablesByNumber(tables: Table[]): Table[] {
  const byNumber = new Map<number, Table>();
  for (const t of tables) {
    const prev = byNumber.get(t.number);
    if (!prev || t.updated_at >= prev.updated_at) {
      byNumber.set(t.number, t);
    }
  }
  return [...byNumber.values()];
}

export function upsertMenuItem(item: MenuItem): void {
  const db = getDB();
  const id = item.id ?? stableMenuItemId(item.name);
  const avail = item.available ? 1 : 0;
  db.execSync(`
    INSERT OR REPLACE INTO menu_items (id, name, description, category, price, available, created_at, updated_at)
    VALUES ('${id}', '${sqlEscape(item.name)}', '${sqlEscape(item.description || '')}', '${item.category}', ${item.price}, ${avail}, ${item.created_at}, ${item.updated_at})
  `);
}

export function deleteInvoice(id: string): void {
  const db = getDB();
  db.execSync(`DELETE FROM invoices WHERE id = '${id}'`);
}

export function upsertInvoice(invoice: Invoice): void {
  const db = getDB();
  const id = invoice.id ?? stableInvoiceId(invoice.order_id);
  const order = orderService.getOrderById(invoice.order_id);
  const invoiceNumber = order
    ? stableInvoiceNumber(order.table_number, order.created_at)
    : invoice.invoice_number;

  const linked =
    invoice.linked_order_ids != null
      ? `'${sqlEscape(invoice.linked_order_ids)}'`
      : 'NULL';

  db.execSync(`
    INSERT OR REPLACE INTO invoices (id, order_id, invoice_number, table_number, subtotal, tax_rate, tax_amount, total, status, created_at, paid_at, linked_order_ids)
    VALUES ('${id}', '${invoice.order_id}', '${sqlEscape(invoiceNumber)}', ${invoice.table_number}, ${invoice.subtotal}, ${invoice.tax_rate}, ${invoice.tax_amount}, ${invoice.total}, '${invoice.status}', ${invoice.created_at}, ${invoice.paid_at ?? 'NULL'}, ${linked})
  `);
}

export function upsertSupplyItem(item: SupplyItem): void {
  const db = getDB();
  const id = item.id ?? stableSupplyItemId(item.name);
  db.execSync(`
    INSERT OR REPLACE INTO supply_items (id, name, unit, current_stock, min_stock, created_at, updated_at)
    VALUES ('${id}', '${sqlEscape(item.name)}', '${item.unit}', ${item.current_stock}, ${item.min_stock}, ${item.created_at}, ${item.updated_at})
  `);
}

export function upsertSupplyOrder(order: SupplyOrder): void {
  const db = getDB();
  const id = order.id ?? stableSupplyOrderId(order.date);
  db.execSync(`
    INSERT OR REPLACE INTO supply_orders (id, date, status, created_at, updated_at)
    VALUES ('${id}', ${order.date}, '${order.status}', ${order.created_at}, ${order.updated_at})
  `);
  db.execSync(`DELETE FROM supply_order_items WHERE order_id = '${id}'`);
  for (const entry of order.items) {
    const supplyItemId = entry.supply_item_id ?? stableSupplyItemId(entry.supply_item_name);
    const entryId = entry.id ?? stableSupplyEntryId(id, supplyItemId);
    db.execSync(`
      INSERT OR REPLACE INTO supply_order_items (id, order_id, item_id, item_name, quantity, unit, cost)
      VALUES ('${entryId}', '${id}', '${supplyItemId}', '${sqlEscape(entry.supply_item_name)}', ${entry.quantity}, '${entry.unit}', ${entry.cost ?? 0})
    `);
  }
}

export function importSyncSnapshot(snapshot: SyncSnapshot): void {
  dedupeTablesByNumber(snapshot.tables).forEach(upsertTable);
  snapshot.menu_items.forEach(upsertMenuItem);
  snapshot.orders.forEach((o) => orderService.upsertOrderFromNetwork(o));
  snapshot.invoices.forEach(upsertInvoice);
  snapshot.supply_items.forEach(upsertSupplyItem);
  snapshot.supply_orders.forEach(upsertSupplyOrder);
}
