import { Invoice } from '../types/invoice';
import { MenuItem } from '../types/menu';
import { Order } from '../types/order';
import { Table } from '../types/table';
import { SupplyItem } from '../types/supply';
import { SupplyOrder } from '../services/supplyOrderService';

export interface SyncSnapshot {
  tables: Table[];
  menu_items: MenuItem[];
  orders: Order[];
  invoices: Invoice[];
  supply_items: SupplyItem[];
  supply_orders: SupplyOrder[];
  exported_at: number;
}

export type SyncMessage =
  | { type: 'SYNC_REQUEST'; deviceId: string }
  | { type: 'SYNC_REQUEST_RELAY'; deviceId: string }
  | { type: 'SYNC_SNAPSHOT'; deviceId: string; snapshot: SyncSnapshot }
  | { type: 'SYNC_ERROR'; message: string }
  | { type: 'CLIENT_COUNT'; count: number; max: number }
  | { type: 'TABLE_SYNC'; table: Table }
  | { type: 'TABLE_DELETE'; id: string }
  | { type: 'MENU_SYNC'; item: MenuItem }
  | { type: 'MENU_DELETE'; id: string }
  | { type: 'ORDER_SYNC'; order: Order }
  | { type: 'ORDER_DELETE'; id: string }
  | { type: 'INVOICE_SYNC'; invoice: Invoice }
  | { type: 'INVOICE_PAID'; invoice: Invoice }
  | { type: 'SUPPLY_ITEM_SYNC'; item: SupplyItem }
  | { type: 'SUPPLY_ITEM_DELETE'; id: string }
  | { type: 'SUPPLY_ORDER_SYNC'; order: SupplyOrder }
  /** Rétrocompatibilité cuisine */
  | { type: 'ORDER_PREPARING'; order: Order }
  | { type: 'ORDER_READY'; orderId: string; tableNumber?: number };

export type SyncUiEvent =
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECTED' }
  | { type: 'DATA_CHANGED'; source: 'local' | 'remote' | 'snapshot' }
  | { type: 'ORDER_READY'; orderId: string; tableNumber?: number }
  | { type: 'CLIENT_COUNT'; count: number; max: number }
  | { type: 'SYNC_ERROR'; message: string };
