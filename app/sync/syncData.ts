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

function upsertTable(table: Table): void {
  const db = getDB();
  const existing = tableService.getTableById(table.id);
  if (!existing) {
    db.execSync(`
      INSERT INTO tables (id, number, capacity, status, created_at, updated_at)
      VALUES ('${table.id}', ${table.number}, ${table.capacity}, '${table.status}', ${table.created_at}, ${table.updated_at})
    `);
  } else if (table.updated_at >= existing.updated_at) {
    db.execSync(`
      UPDATE tables SET number = ${table.number}, capacity = ${table.capacity},
      status = '${table.status}', updated_at = ${table.updated_at}
      WHERE id = '${table.id}'
    `);
  }
}

function upsertMenuItem(item: MenuItem): void {
  const db = getDB();
  const existing = menuService.getMenuItemById(item.id);
  const avail = item.available ? 1 : 0;
  if (!existing) {
    db.execSync(`
      INSERT INTO menu_items (id, name, description, category, price, available, created_at, updated_at)
      VALUES ('${item.id}', '${item.name.replace(/'/g, "''")}', '${(item.description || '').replace(/'/g, "''")}', '${item.category}', ${item.price}, ${avail}, ${item.created_at}, ${item.updated_at})
    `);
  } else if (item.updated_at >= existing.updated_at) {
    db.execSync(`
      UPDATE menu_items SET name = '${item.name.replace(/'/g, "''")}',
      description = '${(item.description || '').replace(/'/g, "''")}', category = '${item.category}',
      price = ${item.price}, available = ${avail}, updated_at = ${item.updated_at}
      WHERE id = '${item.id}'
    `);
  }
}

function upsertInvoice(invoice: Invoice): void {
  const existing = invoiceService.getInvoiceById(invoice.id);
  const db = getDB();
  if (!existing) {
    db.execSync(`
      INSERT INTO invoices (id, order_id, invoice_number, table_number, subtotal, tax_rate, tax_amount, total, status, created_at, paid_at)
      VALUES ('${invoice.id}', '${invoice.order_id}', '${invoice.invoice_number}', ${invoice.table_number}, ${invoice.subtotal}, ${invoice.tax_rate}, ${invoice.tax_amount}, ${invoice.total}, '${invoice.status}', ${invoice.created_at}, ${invoice.paid_at ?? 'NULL'})
    `);
  } else {
    db.execSync(`
      UPDATE invoices SET status = '${invoice.status}', paid_at = ${invoice.paid_at ?? 'NULL'},
      total = ${invoice.total}, subtotal = ${invoice.subtotal}, tax_amount = ${invoice.tax_amount}
      WHERE id = '${invoice.id}'
    `);
  }
}

function upsertSupplyItem(item: SupplyItem): void {
  const db = getDB();
  const existing = supplyItemService.getSupplyItemById(item.id);
  if (!existing) {
    db.execSync(`
      INSERT INTO supply_items (id, name, unit, current_stock, min_stock, created_at, updated_at)
      VALUES ('${item.id}', '${item.name.replace(/'/g, "''")}', '${item.unit}', ${item.current_stock}, ${item.min_stock}, ${item.created_at}, ${item.updated_at})
    `);
  } else if (item.updated_at >= existing.updated_at) {
    db.execSync(`
      UPDATE supply_items SET name = '${item.name.replace(/'/g, "''")}', unit = '${item.unit}',
      current_stock = ${item.current_stock}, min_stock = ${item.min_stock}, updated_at = ${item.updated_at}
      WHERE id = '${item.id}'
    `);
  }
}

function upsertSupplyOrder(order: SupplyOrder): void {
  const existing = supplyOrderService.getSupplyOrderById(order.id);
  const db = getDB();
  if (!existing) {
    db.execSync(`
      INSERT INTO supply_orders (id, date, status, created_at, updated_at)
      VALUES ('${order.id}', ${order.date}, '${order.status}', ${order.created_at}, ${order.updated_at})
    `);
  } else {
    db.execSync(`
      UPDATE supply_orders SET status = '${order.status}', updated_at = ${order.updated_at}
      WHERE id = '${order.id}'
    `);
    db.execSync(`DELETE FROM supply_order_items WHERE order_id = '${order.id}'`);
  }
  for (const entry of order.items) {
    db.execSync(`
      INSERT INTO supply_order_items (id, order_id, item_id, item_name, quantity, unit, cost)
      VALUES ('${entry.id}', '${order.id}', '${entry.supply_item_id}', '${entry.supply_item_name.replace(/'/g, "''")}', ${entry.quantity}, '${entry.unit}', ${entry.cost ?? 0})
    `);
  }
}

export function importSyncSnapshot(snapshot: SyncSnapshot): void {
  snapshot.tables.forEach(upsertTable);
  snapshot.menu_items.forEach(upsertMenuItem);
  snapshot.orders.forEach((o) => orderService.upsertOrderFromNetwork(o));
  snapshot.invoices.forEach(upsertInvoice);
  snapshot.supply_items.forEach(upsertSupplyItem);
  snapshot.supply_orders.forEach(upsertSupplyOrder);
}
