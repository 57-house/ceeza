import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db/database';
import { pushLocalSync } from '../sync/syncBridge';
import { SupplyEntry, SupplyUnit } from '../types/supply';
import { supplyItemService } from './supplyItemService';

function syncSupplyOrder(orderId: string): void {
  const order = supplyOrderService.getSupplyOrderById(orderId);
  if (order) pushLocalSync({ type: 'SUPPLY_ORDER_SYNC', order });
}

export interface SupplyOrder {
  id: string;
  date: number;
  status: 'PENDING' | 'COMPLETED';
  items: SupplyEntry[];
  total_cost: number;
  created_at: number;
  updated_at: number;
}

export const supplyOrderService = {
  // Créer un nouvel approvisionnement
  createSupplyOrder: (date: number): string => {
    const db = getDB();
    const id = uuidv4();
    const now = Date.now();

    try {
      db.execSync(`
        INSERT INTO supply_orders (id, date, status, created_at, updated_at)
        VALUES ('${id}', ${date}, 'PENDING', ${now}, ${now})
      `);
      syncSupplyOrder(id);
      return id;
    } catch (error) {
      console.error('Erreur dans createSupplyOrder:', error);
      throw error;
    }
  },

  // Ajouter un article à un approvisionnement
  addItemToOrder: (
    orderId: string,
    itemId: string,
    itemName: string,
    quantity: number,
    unit: SupplyUnit,
    cost: number
  ): void => {
    const db = getDB();
    const entryId = uuidv4();

    try {
      db.execSync(`
        INSERT INTO supply_order_items (id, order_id, item_id, item_name, quantity, unit, cost)
        VALUES ('${entryId}', '${orderId}', '${itemId}', '${itemName.replace(/'/g, "''")}', ${quantity}, '${unit}', ${cost})
      `);
      syncSupplyOrder(orderId);
    } catch (error) {
      console.error('Erreur dans addItemToOrder:', error);
      throw error;
    }
  },

  // Finaliser un approvisionnement (mettre à jour les stocks)
  completeSupplyOrder: (orderId: string): void => {
    const db = getDB();
    try {
      // Récupérer tous les items de la commande
      const items = db.getAllSync<{
        item_id: string;
        quantity: number;
      }>(
        'SELECT item_id, quantity FROM supply_order_items WHERE order_id = ?',
        [orderId]
      );

      // Mettre à jour les stocks
      items.forEach((item) => {
        supplyItemService.updateStock(item.item_id, item.quantity);
      });

      // Marquer la commande comme complétée
      db.execSync(`
        UPDATE supply_orders 
        SET status = 'COMPLETED', updated_at = ${Date.now()}
        WHERE id = '${orderId}'
      `);
      syncSupplyOrder(orderId);
    } catch (error) {
      console.error('Erreur dans completeSupplyOrder:', error);
      throw error;
    }
  },

  // Récupérer un approvisionnement par ID
  getSupplyOrderById: (orderId: string): SupplyOrder | null => {
    const db = getDB();
    try {
      const order = db.getFirstSync<{
        id: string;
        date: number;
        status: string;
        created_at: number;
        updated_at: number;
      }>('SELECT * FROM supply_orders WHERE id = ?', [orderId]);

      if (!order) return null;

      const items = db.getAllSync<SupplyEntry>(
        `SELECT 
          id, 
          item_id as supply_item_id, 
          item_name as supply_item_name, 
          quantity, 
          unit, 
          cost,
          ${order.date} as date,
          ${order.created_at} as created_at
        FROM supply_order_items 
        WHERE order_id = ?`,
        [orderId]
      );

      const total_cost = items.reduce((sum, item) => sum + (item.cost || 0), 0);

      return {
        id: order.id,
        date: order.date,
        status: order.status as 'PENDING' | 'COMPLETED',
        items: items || [],
        total_cost,
        created_at: order.created_at,
        updated_at: order.updated_at,
      };
    } catch (error) {
      console.error('Erreur dans getSupplyOrderById:', error);
      return null;
    }
  },

  // Récupérer l'approvisionnement du jour
  getTodaySupplyOrder: (): SupplyOrder | null => {
    const db = getDB();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    try {
      const order = db.getFirstSync<{
        id: string;
        date: number;
        status: string;
        created_at: number;
        updated_at: number;
      }>(
        'SELECT * FROM supply_orders WHERE date = ? ORDER BY created_at DESC LIMIT 1',
        [todayTimestamp]
      );

      if (!order) return null;

      return supplyOrderService.getSupplyOrderById(order.id);
    } catch (error) {
      console.error('Erreur dans getTodaySupplyOrder:', error);
      return null;
    }
  },

  // Récupérer un approvisionnement par date
  getSupplyOrderByDate: (date: number): SupplyOrder | null => {
    const db = getDB();
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    const dateTimestamp = selectedDate.getTime();

    try {
      const order = db.getFirstSync<{
        id: string;
        date: number;
        status: string;
        created_at: number;
        updated_at: number;
      }>(
        'SELECT * FROM supply_orders WHERE date = ? ORDER BY created_at DESC LIMIT 1',
        [dateTimestamp]
      );

      if (!order) return null;

      return supplyOrderService.getSupplyOrderById(order.id);
    } catch (error) {
      console.error('Erreur dans getSupplyOrderByDate:', error);
      return null;
    }
  },

  // Supprimer un item d'un approvisionnement
  removeItemFromOrder: (orderId: string, itemId: string): void => {
    const db = getDB();
    try {
      db.execSync(`
        DELETE FROM supply_order_items 
        WHERE order_id = '${orderId}' AND item_id = '${itemId}'
      `);
    } catch (error) {
      console.error('Erreur dans removeItemFromOrder:', error);
      throw error;
    }
  },

  // Supprimer un approvisionnement
  deleteSupplyOrder: (orderId: string): void => {
    const db = getDB();
    try {
      db.execSync(`DELETE FROM supply_orders WHERE id = '${orderId}'`);
    } catch (error) {
      console.error('Erreur dans deleteSupplyOrder:', error);
      throw error;
    }
  },
};
