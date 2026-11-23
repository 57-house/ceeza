import { getDB } from '../db/database';
import { pushLocalSync } from '../sync/syncBridge';
import { sqlEscape } from '../utils/sqlEscape';
import {
  stableMenuItemId,
  stableOrderId,
  stableOrderItemId,
  stableTableId,
} from '../utils/stableId';
import { Order, OrderItem, OrderStatus } from '../types/order';
import { MenuItem } from '../types/menu';
import { tableService } from './tableService';

function syncOrder(orderId: string): void {
  const order = orderService.getOrderById(orderId);
  if (order) pushLocalSync({ type: 'ORDER_SYNC', order });
}

type OrderLineDraft = {
  id: string;
  menu_item_id: string;
  menu_item_name: string;
  category: string;
  price: number;
  quantity: number;
  parent_item_id: string | null;
};

function writeOrderLine(db: ReturnType<typeof getDB>, orderId: string, line: OrderLineDraft): void {
  db.execSync(`
    INSERT OR REPLACE INTO order_items (id, order_id, menu_item_id, menu_item_name, category, price, quantity, parent_item_id)
    VALUES ('${line.id}', '${orderId}', '${line.menu_item_id}', '${sqlEscape(line.menu_item_name)}', '${line.category}', ${line.price}, ${line.quantity}, ${line.parent_item_id ? `'${line.parent_item_id}'` : 'NULL'})
  `);
}

function collectOrderLines(orderId: string, items: OrderItem[]): Map<string, OrderLineDraft> {
  const lines = new Map<string, OrderLineDraft>();

  const add = (
    name: string,
    menuItemId: string,
    category: string,
    price: number,
    quantity: number,
    parentLineId: string | null
  ) => {
    const id = stableOrderItemId(orderId, name, parentLineId);
    const canonicalMenuId = stableMenuItemId(name);
    const prev = lines.get(id);
    if (prev) {
      prev.quantity += quantity;
      return;
    }
    lines.set(id, {
      id,
      menu_item_id: canonicalMenuId,
      menu_item_name: name,
      category,
      price,
      quantity,
      parent_item_id: parentLineId,
    });
  };

  for (const item of items) {
    add(item.menu_item_name, item.menu_item_id, item.category, item.price, item.quantity, null);
    const parentLineId = stableOrderItemId(orderId, item.menu_item_name, null);
    for (const sup of item.supplements || []) {
      add(
        sup.menu_item_name,
        sup.menu_item_id,
        sup.category,
        sup.price,
        sup.quantity,
        parentLineId
      );
    }
  }

  return lines;
}

export const orderService = {
  // Créer une nouvelle commande
  createOrder: (tableId: string, tableNumber: number): Order => {
    const canonicalTableId = tableService.resolveTableId(tableNumber, tableId);
    const openOrder = orderService.getOpenOrderByTable(canonicalTableId);
    if (openOrder) {
      return openOrder;
    }

    const db = getDB();
    const now = Date.now();
    const id = stableOrderId(tableNumber, now);

    try {
      db.execSync(`
        INSERT OR REPLACE INTO orders (id, table_id, table_number, status, total, created_at, updated_at)
        VALUES ('${id}', '${canonicalTableId}', ${tableNumber}, 'OPEN', 0, ${now}, ${now})
      `);

      tableService.updateTableStatus(canonicalTableId, 'OCCUPIED');

      const order = {
        id,
        table_id: canonicalTableId,
        table_number: tableNumber,
        status: 'OPEN' as OrderStatus,
        items: [],
        total: 0,
        created_at: now,
        updated_at: now,
      };
      pushLocalSync({ type: 'ORDER_SYNC', order });
      return order;
    } catch (error) {
      console.error('Erreur dans createOrder:', error);
      throw error;
    }
  },

  // Récupérer une commande par ID
  getOrderById: (orderId: string): Order | null => {
    const db = getDB();
    try {
      const order = db.getFirstSync<{
        id: string;
        table_id: string;
        table_number: number;
        status: string;
        total: number;
        created_at: number;
        updated_at: number;
      }>('SELECT * FROM orders WHERE id = ?', [orderId]);

      if (!order) return null;

      const items = orderService.getOrderItems(orderId);
      const allSupplements = orderService.getOrderItemSupplements(orderId);

      // Associer les suppléments à leurs plats parents
      items.forEach((item) => {
        const itemSupplements = allSupplements.filter((sup) => {
          const supData = db.getFirstSync<{ parent_item_id: string | null }>(
            'SELECT parent_item_id FROM order_items WHERE id = ?',
            [sup.id]
          );
          return supData?.parent_item_id === item.id;
        });
        item.supplements = itemSupplements;
      });

      return {
        ...order,
        status: order.status as OrderStatus,
        items,
        total: order.total,
      };
    } catch (error) {
      console.error('Erreur dans getOrderById:', error);
      return null;
    }
  },

  // Récupérer la commande ouverte d'une table
  getOpenOrderByTable: (tableId: string): Order | null => {
    const db = getDB();
    try {
      const order = db.getFirstSync<{
        id: string;
        table_id: string;
        table_number: number;
        status: string;
        total: number;
        created_at: number;
        updated_at: number;
      }>(
        "SELECT * FROM orders WHERE table_id = ? AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1",
        [tableId]
      );

      if (!order) return null;

      return orderService.getOrderById(order.id);
    } catch (error) {
      console.error('Erreur dans getOpenOrderByTable:', error);
      return null;
    }
  },

  /** Commande en cours de saisie sur une table (statut ouvert uniquement) */
  getActiveOrderByTable: (tableId: string): Order | null => {
    return orderService.getOpenOrderByTable(tableId);
  },

  /** Commandes envoyées en cuisine pour une table, dans l'ordre d'envoi */
  getKitchenOrdersByTable: (tableId: string): Order[] => {
    const db = getDB();
    try {
      const rows = db.getAllSync<{
        id: string;
        table_id: string;
        table_number: number;
        status: string;
        total: number;
        created_at: number;
        updated_at: number;
      }>(
        "SELECT * FROM orders WHERE table_id = ? AND status = 'PREPARING' ORDER BY created_at ASC",
        [tableId]
      );

      return rows
        .map((row) => orderService.getOrderById(row.id))
        .filter((o): o is Order => o !== null);
    } catch (error) {
      console.error('Erreur dans getKitchenOrdersByTable:', error);
      return [];
    }
  },

  getOrdersByTable: (tableId: string): Order[] => {
    const db = getDB();
    try {
      const rows = db.getAllSync<{
        id: string;
        table_id: string;
        table_number: number;
        status: string;
        total: number;
        created_at: number;
        updated_at: number;
      }>('SELECT * FROM orders WHERE table_id = ? ORDER BY created_at DESC', [tableId]);

      return rows
        .map((row) => orderService.getOrderById(row.id))
        .filter((o): o is Order => o !== null);
    } catch (error) {
      console.error('Erreur dans getOrdersByTable:', error);
      return [];
    }
  },

  getOrdersByStatus: (status: OrderStatus): Order[] => {
    const db = getDB();
    try {
      const rows = db.getAllSync<{
        id: string;
        table_id: string;
        table_number: number;
        status: string;
        total: number;
        created_at: number;
        updated_at: number;
      }>('SELECT * FROM orders WHERE status = ? ORDER BY created_at ASC', [status]);

      return rows
        .map((row) => orderService.getOrderById(row.id))
        .filter((o): o is Order => o !== null);
    } catch (error) {
      console.error('Erreur dans getOrdersByStatus:', error);
      return [];
    }
  },

  completeKitchenOrder: (orderId: string): Order | null => {
    orderService.updateOrderStatus(orderId, 'READY');
    return orderService.getOrderById(orderId);
  },

  /** Synchronise une commande reçue du réseau (autre appareil) */
  upsertOrderFromNetwork: (order: Order): void => {
    const db = getDB();
    const orderId = order.id;
    const tableId = order.table_id;

    db.execSync(`
      INSERT OR REPLACE INTO orders (id, table_id, table_number, status, total, created_at, updated_at)
      VALUES ('${orderId}', '${tableId}', ${order.table_number}, '${order.status}', ${order.total}, ${order.created_at}, ${order.updated_at})
    `);
    db.execSync(`DELETE FROM order_items WHERE order_id = '${orderId}'`);

    const lines = collectOrderLines(orderId, order.items);
    lines.forEach((line) => writeOrderLine(db, orderId, line));

    if (order.status === 'OPEN' || order.status === 'PREPARING') {
      tableService.updateTableStatus(tableId, 'OCCUPIED');
    }
  },

  applyRemoteOrderStatus: (orderId: string, status: OrderStatus): void => {
    orderService.updateOrderStatus(orderId, status);
  },

  // Récupérer les items d'une commande
  getOrderItems: (orderId: string): OrderItem[] => {
    const db = getDB();
    try {
      const items = db.getAllSync<OrderItem>(
        "SELECT * FROM order_items WHERE order_id = ? AND parent_item_id IS NULL",
        [orderId]
      );
      return items || [];
    } catch (error) {
      console.error('Erreur dans getOrderItems:', error);
      return [];
    }
  },

  // Récupérer les suppléments d'une commande
  getOrderItemSupplements: (orderId: string): OrderItem[] => {
    const db = getDB();
    try {
      const supplements = db.getAllSync<OrderItem>(
        'SELECT * FROM order_items WHERE order_id = ? AND parent_item_id IS NOT NULL',
        [orderId]
      );
      return supplements || [];
    } catch (error) {
      console.error('Erreur dans getOrderItemSupplements:', error);
      return [];
    }
  },

  // Ajouter un item à la commande
  addItemToOrder: (
    orderId: string,
    menuItem: MenuItem,
    quantity: number = 1,
    parentItemId?: string
  ): string => {
    const currentOrder = orderService.getOrderById(orderId);
    if (!currentOrder || currentOrder.status !== 'OPEN') {
      throw new Error('Impossible d\'ajouter des articles à une commande déjà envoyée en cuisine');
    }

    const db = getDB();
    const parentLineId = parentItemId ?? null;
    const itemId = stableOrderItemId(orderId, menuItem.name, parentLineId);

    try {
      const existing = db.getFirstSync<{ quantity: number }>(
        'SELECT quantity FROM order_items WHERE id = ?',
        [itemId]
      );
      const qty = (existing?.quantity ?? 0) + quantity;
      writeOrderLine(db, orderId, {
        id: itemId,
        menu_item_id: stableMenuItemId(menuItem.name),
        menu_item_name: menuItem.name,
        category: menuItem.category,
        price: menuItem.price,
        quantity: qty,
        parent_item_id: parentLineId,
      });

      orderService.updateOrderTotal(orderId);
      syncOrder(orderId);
      return itemId;
    } catch (error) {
      console.error('Erreur dans addItemToOrder:', error);
      throw error;
    }
  },

  // Mettre à jour le total d'une commande
  updateOrderTotal: (orderId: string): void => {
    const db = getDB();
    try {
      const result = db.getFirstSync<{ total: number }>(
        'SELECT SUM(price * quantity) as total FROM order_items WHERE order_id = ?',
        [orderId]
      );

      const total = result?.total || 0;

      db.execSync(`
        UPDATE orders 
        SET total = ${total}, updated_at = ${Date.now()}
        WHERE id = '${orderId}'
      `);
    } catch (error) {
      console.error('Erreur dans updateOrderTotal:', error);
      throw error;
    }
  },

  // Supprimer un item de la commande
  removeItemFromOrder: (orderId: string, itemId: string): void => {
    const db = getDB();
    try {
      // Supprimer aussi les suppléments associés
      db.execSync(`
        DELETE FROM order_items 
        WHERE id = '${itemId}' OR parent_item_id = '${itemId}'
      `);

      orderService.updateOrderTotal(orderId);
      syncOrder(orderId);
    } catch (error) {
      console.error('Erreur dans removeItemFromOrder:', error);
      throw error;
    }
  },

  // Mettre à jour le statut d'une commande
  updateOrderStatus: (orderId: string, status: OrderStatus): void => {
    const db = getDB();
    try {
      db.execSync(`
        UPDATE orders 
        SET status = '${status}', updated_at = ${Date.now()}
        WHERE id = '${orderId}'
      `);
      syncOrder(orderId);
    } catch (error) {
      console.error('Erreur dans updateOrderStatus:', error);
      throw error;
    }
  },
};

