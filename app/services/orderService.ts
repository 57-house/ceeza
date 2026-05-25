import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db/database';
import { pushLocalSync } from '../sync/syncBridge';
import { Order, OrderItem, OrderStatus } from '../types/order';
import { MenuItem } from '../types/menu';
import { tableService } from './tableService';

function syncOrder(orderId: string): void {
  const order = orderService.getOrderById(orderId);
  if (order) pushLocalSync({ type: 'ORDER_SYNC', order });
}

export const orderService = {
  // Créer une nouvelle commande
  createOrder: (tableId: string, tableNumber: number): Order => {
    const db = getDB();
    const id = uuidv4();
    const now = Date.now();

    try {
      db.execSync(`
        INSERT INTO orders (id, table_id, table_number, status, total, created_at, updated_at)
        VALUES ('${id}', '${tableId}', ${tableNumber}, 'OPEN', 0, ${now}, ${now})
      `);

      // Mettre à jour le statut de la table
      tableService.updateTableStatus(tableId, 'OCCUPIED');

      const order = {
        id,
        table_id: tableId,
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

  /** Commande active sur une table (ouverte ou en cuisine) */
  getActiveOrderByTable: (tableId: string): Order | null => {
    const db = getDB();
    try {
      const orders = db.getAllSync<{
        id: string;
        table_id: string;
        table_number: number;
        status: string;
        total: number;
        created_at: number;
        updated_at: number;
      }>(
        "SELECT * FROM orders WHERE table_id = ? AND status IN ('OPEN', 'PREPARING') ORDER BY created_at DESC",
        [tableId]
      );

      if (!orders.length) return null;

      return orderService.getOrderById(orders[0].id);
    } catch (error) {
      console.error('Erreur dans getActiveOrderByTable:', error);
      return null;
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
      }>('SELECT * FROM orders WHERE status = ? ORDER BY created_at', [status]);

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
    const existing = orderService.getOrderById(order.id);

    if (!existing) {
      db.execSync(`
        INSERT INTO orders (id, table_id, table_number, status, total, created_at, updated_at)
        VALUES ('${order.id}', '${order.table_id}', ${order.table_number}, '${order.status}', ${order.total}, ${order.created_at}, ${order.updated_at})
      `);
    } else {
      db.execSync(`
        UPDATE orders
        SET status = '${order.status}', total = ${order.total}, updated_at = ${order.updated_at}
        WHERE id = '${order.id}'
      `);
      db.execSync(`DELETE FROM order_items WHERE order_id = '${order.id}'`);
    }

    for (const item of order.items) {
      db.execSync(`
        INSERT INTO order_items (id, order_id, menu_item_id, menu_item_name, category, price, quantity, parent_item_id)
        VALUES ('${item.id}', '${order.id}', '${item.menu_item_id}', '${item.menu_item_name.replace(/'/g, "''")}', '${item.category}', ${item.price}, ${item.quantity}, NULL)
      `);
      for (const sup of item.supplements || []) {
        db.execSync(`
          INSERT INTO order_items (id, order_id, menu_item_id, menu_item_name, category, price, quantity, parent_item_id)
          VALUES ('${sup.id}', '${order.id}', '${sup.menu_item_id}', '${sup.menu_item_name.replace(/'/g, "''")}', '${sup.category}', ${sup.price}, ${sup.quantity}, '${item.id}')
        `);
      }
    }

    tableService.updateTableStatus(order.table_id, 'OCCUPIED');
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
    const db = getDB();
    const itemId = uuidv4();

    try {
      db.execSync(`
        INSERT INTO order_items (id, order_id, menu_item_id, menu_item_name, category, price, quantity, parent_item_id)
        VALUES ('${itemId}', '${orderId}', '${menuItem.id}', '${menuItem.name.replace(/'/g, "''")}', '${menuItem.category}', ${menuItem.price}, ${quantity}, ${parentItemId ? `'${parentItemId}'` : 'NULL'})
      `);

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

