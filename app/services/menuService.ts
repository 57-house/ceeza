import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db/database';
import { pushLocalSync } from '../sync/syncBridge';
import { MenuItem, MenuCategory } from '../types/menu';

export const menuService = {
  // Ajouter un nouvel élément au menu
  addMenuItem: (
    name: string,
    description: string,
    category: MenuCategory,
    price: number
  ): MenuItem => {
    const db = getDB();
    const id = uuidv4();
    const now = Date.now();

    try {
      db.execSync(`
        INSERT INTO menu_items (id, name, description, category, price, available, created_at, updated_at)
        VALUES ('${id}', '${name.replace(/'/g, "''")}', '${description.replace(/'/g, "''")}', '${category}', ${price}, 1, ${now}, ${now})
      `);

      const item = {
        id,
        name,
        description,
        category,
        price,
        available: true,
        created_at: now,
        updated_at: now,
      };
      pushLocalSync({ type: 'MENU_SYNC', item });
      return item;
    } catch (error) {
      console.error('Erreur dans addMenuItem:', error);
      throw error;
    }
  },

  // Récupérer tous les éléments du menu
  getAllMenuItems: (): MenuItem[] => {
    const db = getDB();
    try {
      const result = db.getAllSync<MenuItem>(
        'SELECT * FROM menu_items ORDER BY category, name ASC',
        []
      );
      return (result || []).map((item) => ({
        ...item,
        available: Number(item.available) === 1,
      }));
    } catch (error) {
      console.error('Erreur dans getAllMenuItems:', error);
      return [];
    }
  },

  // Récupérer les éléments par catégorie
  getMenuItemsByCategory: (category: MenuCategory): MenuItem[] => {
    const db = getDB();
    try {
      const result = db.getAllSync<MenuItem>(
        'SELECT * FROM menu_items WHERE category = ? AND available = 1 ORDER BY name ASC',
        [category]
      );
      return (result || []).map((item) => ({
        ...item,
        available: Number(item.available) === 1,
      }));
    } catch (error) {
      console.error('Erreur dans getMenuItemsByCategory:', error);
      return [];
    }
  },

  // Récupérer un élément par ID
  getMenuItemById: (id: string): MenuItem | null => {
    const db = getDB();
    try {
      const result = db.getFirstSync<MenuItem>(
        'SELECT * FROM menu_items WHERE id = ?',
        [id]
      );
      if (!result) return null;
      return {
        ...result,
        available: Number(result.available) === 1,
      };
    } catch (error) {
      console.error('Erreur dans getMenuItemById:', error);
      return null;
    }
  },

  // Mettre à jour un élément du menu
  updateMenuItem: (
    id: string,
    name: string,
    description: string,
    category: MenuCategory,
    price: number,
    available: boolean
  ): void => {
    const db = getDB();
    try {
      db.execSync(`
        UPDATE menu_items 
        SET name = '${name.replace(/'/g, "''")}', 
            description = '${description.replace(/'/g, "''")}', 
            category = '${category}', 
            price = ${price}, 
            available = ${available ? 1 : 0}, 
            updated_at = ${Date.now()}
        WHERE id = '${id}'
      `);
      const updated = menuService.getMenuItemById(id);
      if (updated) pushLocalSync({ type: 'MENU_SYNC', item: updated });
    } catch (error) {
      console.error('Erreur dans updateMenuItem:', error);
      throw error;
    }
  },

  // Basculer la disponibilité d'un élément
  toggleAvailability: (id: string): void => {
    const db = getDB();
    try {
      const item = menuService.getMenuItemById(id);
      if (!item) throw new Error('Élément non trouvé');
      
      db.execSync(`
        UPDATE menu_items 
        SET available = ${item.available ? 0 : 1}, 
            updated_at = ${Date.now()}
        WHERE id = '${id}'
      `);
      const updated = menuService.getMenuItemById(id);
      if (updated) pushLocalSync({ type: 'MENU_SYNC', item: updated });
    } catch (error) {
      console.error('Erreur dans toggleAvailability:', error);
      throw error;
    }
  },

  // Supprimer un élément du menu
  deleteMenuItem: (id: string): void => {
    const db = getDB();
    try {
      db.execSync(`DELETE FROM menu_items WHERE id = '${id}'`);
      pushLocalSync({ type: 'MENU_DELETE', id });
    } catch (error) {
      console.error('Erreur dans deleteMenuItem:', error);
      throw error;
    }
  },
};

