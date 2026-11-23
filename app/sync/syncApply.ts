import { invoiceService } from '../services/invoiceService';
import { orderService } from '../services/orderService';
import { tableService } from '../services/tableService';
import { getDB } from '../db/database';
import {
  deleteInvoice,
  importSyncSnapshot,
  upsertInvoice,
  upsertMenuItem,
  upsertSupplyItem,
  upsertSupplyOrder,
  upsertTable,
} from './syncData';
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
        upsertTable(message.table);
        break;
      case 'TABLE_DELETE': {
        const db = getDB();
        db.execSync(`DELETE FROM tables WHERE id = '${message.id}'`);
        break;
      }

      case 'MENU_SYNC':
        upsertMenuItem(message.item);
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
        upsertInvoice(message.invoice);
        break;
      case 'INVOICE_PAID':
        upsertInvoice(message.invoice);
        if (message.invoice.status === 'PAID') {
          orderService.applyRemoteOrderStatus(message.invoice.order_id, 'PAID');
          const order = orderService.getOrderById(message.invoice.order_id);
          if (order) {
            tableService.updateTableStatus(order.table_id, 'AVAILABLE');
          }
        }
        break;
      case 'INVOICE_DELETE':
        deleteInvoice(message.id);
        break;

      case 'ORDER_READY':
        if (orderService.getOrderById(message.orderId)) {
          orderService.applyRemoteOrderStatus(message.orderId, 'READY');
        }
        break;

      case 'SUPPLY_ITEM_SYNC':
        upsertSupplyItem(message.item);
        break;
      case 'SUPPLY_ITEM_DELETE': {
        const db = getDB();
        db.execSync(`DELETE FROM supply_items WHERE id = '${message.id}'`);
        break;
      }

      case 'SUPPLY_ORDER_SYNC':
        upsertSupplyOrder(message.order);
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
