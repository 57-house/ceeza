import { v5 as uuidv5 } from 'uuid';
import { getDevicePhysicalIdOrFallback } from './devicePhysicalId';

const APP_NAMESPACE = uuidv5('ceeza-restaurant-v1', uuidv5.DNS);

export function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

/** Tous les IDs incluent l'adresse / identifiant physique de l'appareil créateur. */
function stableId(kind: string, key: string): string {
  const device = getDevicePhysicalIdOrFallback();
  return uuidv5(`${device}|${kind}:${key}`, APP_NAMESPACE);
}

export function stableTableId(tableNumber: number): string {
  return stableId('table', String(tableNumber));
}

export function stableMenuItemId(name: string): string {
  return stableId('menu', normalizeKey(name));
}

export function stableSupplyItemId(name: string): string {
  return stableId('supply-item', normalizeKey(name));
}

export function stableSupplyOrderId(dateTimestamp: number): string {
  return stableId('supply-order', String(dateTimestamp));
}

export function stableSupplyEntryId(supplyOrderId: string, supplyItemId: string): string {
  return stableId('supply-entry', `${supplyOrderId}|${supplyItemId}`);
}

export function stableOrderId(tableNumber: number, createdAt: number): string {
  return stableId('order', `${tableNumber}|${createdAt}`);
}

export function stableOrderItemId(
  orderId: string,
  menuItemName: string,
  parentLineId: string | null
): string {
  return stableId(
    'order-item',
    `${orderId}|${normalizeKey(menuItemName)}|${parentLineId ?? 'root'}`
  );
}

export function stableInvoiceId(orderId: string): string {
  return stableId('invoice', orderId);
}

export function stableTableInvoiceId(tableNumber: number, orderIds: string[]): string {
  return stableId('table-invoice', `${tableNumber}|${[...orderIds].sort().join(',')}`);
}

export function stableInvoiceNumber(tableNumber: number, orderCreatedAt: number): string {
  const short = stableId('inv-num', `${tableNumber}|${orderCreatedAt}`).slice(0, 8).toUpperCase();
  return `FAC-${tableNumber}-${short}`;
}
