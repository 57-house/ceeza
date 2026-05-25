import { invoiceService } from '../services/invoiceService';
import { menuService } from '../services/menuService';
import { orderService } from '../services/orderService';
import { supplyItemService } from '../services/supplyItemService';
import { supplyOrderService } from '../services/supplyOrderService';
import { tableService } from '../services/tableService';
import { getDB } from '../db/database';
import { importSyncSnapshot } from './syncData';
import { SyncMessage } from './syncTypes';

let applyingRemote = false;

export function isApplyingRemoteSync(): boolean {
  return applyingRemote;
}

export function applySyncMessage(message: SyncMessage): void {
  applyingRemote = true;
  try {
    switch (message.type) {
      case 'SYNC_SNAPSHOT':
        if (message.snapshot) {
          importSyncSnapshot(message.snapshot);
        }
        break;

      case 'TABLE_SYNC':
        applyTableSync(message.table);
        break;
      case 'TABLE_DELETE': {
        const db = getDB();
        db.execSync(`DELETE FROM tables WHERE id = '${message.id}'`);
        break;
      }

      case 'MENU_SYNC':
        applyMenuSync(message.item);
        break;
      case 'MENU_DELETE': {
        const db = getDB();
        db.execSync(`DELETE FROM menu_items WHERE id = '${message.id}'`);
        break;
      }

      case 'ORDER_SYNC':
      case 'ORDER_PREPARING':
        orderService.upsertOrderFromNetwork(message.order);
        break;
      case 'ORDER_DELETE': {
        const db = getDB();
        db.execSync(`DELETE FROM order_items WHERE order_id = '${message.id}'`);
        db.execSync(`DELETE FROM orders WHERE id = '${message.id}'`);
        break;
      }

      case 'INVOICE_SYNC':
        applyInvoiceSync(message.invoice);
        break;
      case 'INVOICE_PAID':
        applyInvoiceSync(message.invoice);
        if (message.invoice.status === 'PAID') {
          orderService.applyRemoteOrderStatus(message.invoice.order_id, 'PAID');
          const order = orderService.getOrderById(message.invoice.order_id);
          if (order) {
            tableService.updateTableStatus(order.table_id, 'AVAILABLE');
          }
        }
        break;

      case 'ORDER_READY':
        if (orderService.getOrderById(message.orderId)) {
          orderService.applyRemoteOrderStatus(message.orderId, 'READY');
        }
        break;

      case 'SUPPLY_ITEM_SYNC':
        applySupplyItemSync(message.item);
        break;
      case 'SUPPLY_ITEM_DELETE': {
        const db = getDB();
        db.execSync(`DELETE FROM supply_items WHERE id = '${message.id}'`);
        break;
      }

      case 'SUPPLY_ORDER_SYNC':
        applySupplyOrderSync(message.order);
        break;

      case 'SYNC_REQUEST':
      case 'SYNC_REQUEST_RELAY':
      case 'CLIENT_COUNT':
      case 'SYNC_ERROR':
        break;
    }
  } finally {
    applyingRemote = false;
  }
}

function applyTableSync(table: import('../types/table').Table): void {
  const existing = tableService.getTableById(table.id);
  const db = getDB();
  if (!existing) {
    db.execSync(`
      INSERT INTO tables (id, number, capacity, status, created_at, updated_at)
      VALUES ('${table.id}', ${table.number}, ${table.capacity}, '${table.status}', ${table.created_at}, ${table.updated_at})
    `);
  } else if (table.updated_at >= existing.updated_at) {
    tableService.updateTableStatus(table.id, table.status);
    db.execSync(`
      UPDATE tables SET number = ${table.number}, capacity = ${table.capacity}, updated_at = ${table.updated_at}
      WHERE id = '${table.id}'
    `);
  }
}

function applyMenuSync(item: import('../types/menu').MenuItem): void {
  const existing = menuService.getMenuItemById(item.id);
  const db = getDB();
  const avail = item.available ? 1 : 0;
  if (!existing) {
    db.execSync(`
      INSERT INTO menu_items (id, name, description, category, price, available, created_at, updated_at)
      VALUES ('${item.id}', '${item.name.replace(/'/g, "''")}', '${(item.description || '').replace(/'/g, "''")}', '${item.category}', ${item.price}, ${avail}, ${item.created_at}, ${item.updated_at})
    `);
  } else if (item.updated_at >= existing.updated_at) {
    menuService.updateMenuItem(
      item.id,
      item.name,
      item.description || '',
      item.category,
      item.price,
      item.available
    );
  }
}

function applyInvoiceSync(invoice: import('../types/invoice').Invoice): void {
  const existing = invoiceService.getInvoiceById(invoice.id);
  const db = getDB();
  if (!existing) {
    db.execSync(`
      INSERT INTO invoices (id, order_id, invoice_number, table_number, subtotal, tax_rate, tax_amount, total, status, created_at, paid_at)
      VALUES ('${invoice.id}', '${invoice.order_id}', '${invoice.invoice_number}', ${invoice.table_number}, ${invoice.subtotal}, ${invoice.tax_rate}, ${invoice.tax_amount}, ${invoice.total}, '${invoice.status}', ${invoice.created_at}, ${invoice.paid_at ?? 'NULL'})
    `);
  } else {
    db.execSync(`
      UPDATE invoices SET status = '${invoice.status}', paid_at = ${invoice.paid_at ?? 'NULL'}, total = ${invoice.total}
      WHERE id = '${invoice.id}'
    `);
  }
}

function applySupplyItemSync(item: import('../types/supply').SupplyItem): void {
  const existing = supplyItemService.getSupplyItemById(item.id);
  const db = getDB();
  if (!existing) {
    db.execSync(`
      INSERT INTO supply_items (id, name, unit, current_stock, min_stock, created_at, updated_at)
      VALUES ('${item.id}', '${item.name.replace(/'/g, "''")}', '${item.unit}', ${item.current_stock}, ${item.min_stock}, ${item.created_at}, ${item.updated_at})
    `);
  } else if (item.updated_at >= existing.updated_at) {
    db.execSync(`
      UPDATE supply_items SET current_stock = ${item.current_stock}, min_stock = ${item.min_stock},
      name = '${item.name.replace(/'/g, "''")}', updated_at = ${item.updated_at}
      WHERE id = '${item.id}'
    `);
  }
}

function applySupplyOrderSync(order: import('../services/supplyOrderService').SupplyOrder): void {
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
    const itemId = entry.supply_item_id;
    const itemName = entry.supply_item_name;
    db.execSync(`
      INSERT INTO supply_order_items (id, order_id, item_id, item_name, quantity, unit, cost)
      VALUES ('${entry.id}', '${order.id}', '${itemId}', '${itemName.replace(/'/g, "''")}', ${entry.quantity}, '${entry.unit}', ${entry.cost ?? 0})
    `);
  }
}
