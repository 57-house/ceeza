import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db/database';
import { Order, OrderItem, OrderStatus } from '../types/order';
import { MenuItem } from '../types/menu';
import { tableService } from './tableService';

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

      return {
        id,
        table_id: tableId,
        table_number: tableNumber,
        status: 'OPEN',
        items: [],
        total: 0,
        created_at: now,
        updated_at: now,
      };
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
    } catch (error) {
      console.error('Erreur dans updateOrderStatus:', error);
      throw error;
    }
  },
};

