import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db/database';
import { SupplyItem, SupplyUnit } from '../types/supply';

export const supplyItemService = {
  // Ajouter un nouvel article d'approvisionnement
  addSupplyItem: (
    name: string,
    unit: SupplyUnit,
    min_stock: number
  ): SupplyItem => {
    const db = getDB();
    const id = uuidv4();
    const now = Date.now();

    try {
      db.execSync(`
        INSERT INTO supply_items (id, name, unit, current_stock, min_stock, created_at, updated_at)
        VALUES ('${id}', '${name.replace(/'/g, "''")}', '${unit}', 0, ${min_stock}, ${now}, ${now})
      `);

      return {
        id,
        name,
        unit,
        current_stock: 0,
        min_stock,
        created_at: now,
        updated_at: now,
      };
    } catch (error) {
      console.error('Erreur dans addSupplyItem:', error);
      throw error;
    }
  },

  // Récupérer tous les articles
  getAllSupplyItems: (): SupplyItem[] => {
    const db = getDB();
    try {
      const result = db.getAllSync<SupplyItem>(
        'SELECT * FROM supply_items ORDER BY name ASC',
        []
      );
      return result || [];
    } catch (error) {
      console.error('Erreur dans getAllSupplyItems:', error);
      return [];
    }
  },

  // Récupérer un article par ID
  getSupplyItemById: (id: string): SupplyItem | null => {
    const db = getDB();
    try {
      const result = db.getFirstSync<SupplyItem>(
        'SELECT * FROM supply_items WHERE id = ?',
        [id]
      );
      return result || null;
    } catch (error) {
      console.error('Erreur dans getSupplyItemById:', error);
      return null;
    }
  },

  // Mettre à jour un article
  updateSupplyItem: (
    id: string,
    name: string,
    unit: SupplyUnit,
    min_stock: number
  ): void => {
    const db = getDB();
    try {
      db.execSync(`
        UPDATE supply_items 
        SET name = '${name.replace(/'/g, "''")}', 
            unit = '${unit}', 
            min_stock = ${min_stock}, 
            updated_at = ${Date.now()}
        WHERE id = '${id}'
      `);
    } catch (error) {
      console.error('Erreur dans updateSupplyItem:', error);
      throw error;
    }
  },

  // Mettre à jour le stock d'un article
  updateStock: (id: string, quantity: number): void => {
    const db = getDB();
    try {
      db.execSync(`
        UPDATE supply_items 
        SET current_stock = current_stock + ${quantity}, 
            updated_at = ${Date.now()}
        WHERE id = '${id}'
      `);
    } catch (error) {
      console.error('Erreur dans updateStock:', error);
      throw error;
    }
  },

  // Récupérer les articles nécessitant un réapprovisionnement
  getItemsNeedingSupply: (): SupplyItem[] => {
    const db = getDB();
    try {
      const result = db.getAllSync<SupplyItem>(
        'SELECT * FROM supply_items WHERE current_stock <= min_stock ORDER BY (min_stock - current_stock) DESC',
        []
      );
      return result || [];
    } catch (error) {
      console.error('Erreur dans getItemsNeedingSupply:', error);
      return [];
    }
  },

  // Supprimer un article
  deleteSupplyItem: (id: string): void => {
    const db = getDB();
    try {
      db.execSync(`DELETE FROM supply_items WHERE id = '${id}'`);
    } catch (error) {
      console.error('Erreur dans deleteSupplyItem:', error);
      throw error;
    }
  },
};
