// Implémentation de la base de données pour le web utilisant IndexedDB
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface RestaurantDBSchema extends DBSchema {
  tables: {
    key: string;
    value: {
      id: string;
      number: number;
      capacity: number;
      status: string;
      created_at: number;
      updated_at: number;
    };
    indexes: { number: number };
  };
  menu_items: {
    key: string;
    value: {
      id: string;
      name: string;
      description: string;
      category: string;
      price: number;
      available: number;
      created_at: number;
      updated_at: number;
    };
    indexes: { category: string; available: number };
  };
  supply_items: {
    key: string;
    value: {
      id: string;
      name: string;
      unit: string;
      current_stock: number;
      min_stock: number;
      created_at: number;
      updated_at: number;
    };
    indexes: { name: string };
  };
  supply_orders: {
    key: string;
    value: {
      id: string;
      date: number;
      status: string;
      created_at: number;
      updated_at: number;
    };
  };
  supply_order_items: {
    key: string;
    value: {
      id: string;
      order_id: string;
      item_id: string;
      item_name: string;
      quantity: number;
      unit: string;
      cost: number;
    };
    indexes: { order_id: string; item_id: string };
  };
  orders: {
    key: string;
    value: {
      id: string;
      table_id: string;
      table_number: number;
      status: string;
      total: number;
      created_at: number;
      updated_at: number;
    };
    indexes: { table_id: string; status: string };
  };
  order_items: {
    key: string;
    value: {
      id: string;
      order_id: string;
      menu_item_id: string;
      menu_item_name: string;
      category: string;
      price: number;
      quantity: number;
      parent_item_id: string | null;
    };
    indexes: { order_id: string; parent_item_id: string };
  };
}

let db: IDBPDatabase<RestaurantDBSchema> | null = null;

export const initWebDB = async (): Promise<IDBPDatabase<RestaurantDBSchema>> => {
  if (db) return db;

  db = await openDB<RestaurantDBSchema>('restaurant-db', 1, {
    upgrade(database) {
      // Table tables
      if (!database.objectStoreNames.contains('tables')) {
        const tableStore = database.createObjectStore('tables', { keyPath: 'id' });
        tableStore.createIndex('number', 'number', { unique: true });
      }

      // Table menu_items
      if (!database.objectStoreNames.contains('menu_items')) {
        const menuStore = database.createObjectStore('menu_items', { keyPath: 'id' });
        menuStore.createIndex('category', 'category');
        menuStore.createIndex('available', 'available');
      }

      // Table supply_items
      if (!database.objectStoreNames.contains('supply_items')) {
        const supplyStore = database.createObjectStore('supply_items', { keyPath: 'id' });
        supplyStore.createIndex('name', 'name', { unique: true });
      }

      // Table supply_orders
      if (!database.objectStoreNames.contains('supply_orders')) {
        database.createObjectStore('supply_orders', { keyPath: 'id' });
      }

      // Table supply_order_items
      if (!database.objectStoreNames.contains('supply_order_items')) {
        const orderItemsStore = database.createObjectStore('supply_order_items', { keyPath: 'id' });
        orderItemsStore.createIndex('order_id', 'order_id');
        orderItemsStore.createIndex('item_id', 'item_id');
      }

      // Table orders
      if (!database.objectStoreNames.contains('orders')) {
        const ordersStore = database.createObjectStore('orders', { keyPath: 'id' });
        ordersStore.createIndex('table_id', 'table_id');
        ordersStore.createIndex('status', 'status');
      }

      // Table order_items
      if (!database.objectStoreNames.contains('order_items')) {
        const orderItemsStore = database.createObjectStore('order_items', { keyPath: 'id' });
        orderItemsStore.createIndex('order_id', 'order_id');
        orderItemsStore.createIndex('parent_item_id', 'parent_item_id');
      }
    },
  });

  return db;
};

export const getWebDB = (): IDBPDatabase<RestaurantDBSchema> => {
  if (!db) {
    throw new Error('Base de données web non initialisée. Appelez initWebDB() d\'abord.');
  }
  return db;
};

// Cache en mémoire pour les opérations synchrones sur le web
const memoryCache: Map<string, any> = new Map();

// Wrapper pour simuler l'API SQLite sur IndexedDB
export class WebSQLiteDatabase {
  private db: IDBPDatabase<RestaurantDBSchema>;

  constructor(database: IDBPDatabase<RestaurantDBSchema>) {
    this.db = database;
    // Initialiser le cache en chargeant toutes les données
    // Note: Cette opération est asynchrone mais le cache sera rempli progressivement
    this.initializeCache().catch(error => {
      console.error('Erreur lors de l\'initialisation du cache:', error);
    });
  }

  private async initializeCache() {
    try {
      // Charger toutes les données dans le cache
      const tables = await this.db.getAll('tables');
      const menuItems = await this.db.getAll('menu_items');
      const supplyItems = await this.db.getAll('supply_items');
      const orders = await this.db.getAll('orders');
      const orderItems = await this.db.getAll('order_items');
      const supplyOrders = await this.db.getAll('supply_orders');
      const supplyOrderItems = await this.db.getAll('supply_order_items');

      memoryCache.set('tables', tables);
      memoryCache.set('menu_items', menuItems);
      memoryCache.set('supply_items', supplyItems);
      memoryCache.set('orders', orders);
      memoryCache.set('order_items', orderItems);
      memoryCache.set('supply_orders', supplyOrders);
      memoryCache.set('supply_order_items', supplyOrderItems);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du cache:', error);
    }
  }

  execSync(sql: string): void {
    // Parser le SQL pour déterminer l'opération
    const upperSql = sql.toUpperCase().trim();
    
    if (upperSql.includes('INSERT INTO')) {
      this.handleInsertSync(sql);
    } else if (upperSql.includes('UPDATE')) {
      this.handleUpdateSync(sql);
    } else if (upperSql.includes('DELETE FROM')) {
      this.handleDeleteSync(sql);
    } else if (upperSql.includes('CREATE TABLE')) {
      // Les tables sont déjà créées par IndexedDB
      return;
    } else if (upperSql.includes('ALTER TABLE')) {
      // Migration - ignorée pour IndexedDB
      return;
    }
  }

  private handleInsertSync(sql: string) {
    // Parser basique pour INSERT
    const insertMatch = sql.match(/INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (!insertMatch) return;

    const tableName = insertMatch[1].toLowerCase();
    const columns = insertMatch[2].split(',').map(c => c.trim());
    const values = this.parseValues(insertMatch[3]);

    const record: any = {};
    columns.forEach((col, idx) => {
      let value = values[idx];
      // Convertir les types
      if (value === 'NULL') {
        record[col] = null;
      } else if (!isNaN(Number(value)) && value !== '') {
        record[col] = Number(value);
      } else {
        record[col] = value.replace(/^'|'$/g, '').replace(/''/g, "'");
      }
    });

    // Mettre à jour le cache immédiatement
    const cache = memoryCache.get(tableName) || [];
    cache.push(record);
    memoryCache.set(tableName, cache);

    // Ajouter à IndexedDB de manière asynchrone
    Promise.resolve().then(async () => {
      try {
        await this.db.put(tableName as any, record);
      } catch (error) {
        console.error('Erreur lors de l\'insertion dans IndexedDB:', error);
        // En cas d'erreur, retirer du cache
        const currentCache = memoryCache.get(tableName) || [];
        const index = currentCache.findIndex((r: any) => r.id === record.id);
        if (index >= 0) {
          currentCache.splice(index, 1);
          memoryCache.set(tableName, currentCache);
        }
      }
    });
  }

  private parseValues(valuesStr: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < valuesStr.length; i++) {
      const char = valuesStr[i];
      
      if ((char === "'" || char === '"') && (i === 0 || valuesStr[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        }
        current += char;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      values.push(current.trim());
    }
    return values;
  }

  private handleUpdateSync(sql: string) {
    const updateMatch = sql.match(/UPDATE (\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?/i);
    if (!updateMatch) return;

    const tableName = updateMatch[1].toLowerCase();
    const setClause = updateMatch[2];
    const whereClause = updateMatch[3];
    const updates = this.parseSetClause(setClause);

    // Mettre à jour le cache immédiatement
    const cache = memoryCache.get(tableName) || [];
    cache.forEach((record: any) => {
      if (!whereClause || this.matchesWhere(record, whereClause)) {
        Object.assign(record, updates);
      }
    });
    memoryCache.set(tableName, cache);

    // Mettre à jour IndexedDB de manière asynchrone
    Promise.resolve().then(async () => {
      try {
        const allRecords = await this.db.getAll(tableName as any);
        for (const record of allRecords) {
          if (!whereClause || this.matchesWhere(record, whereClause)) {
            Object.assign(record, updates);
            await this.db.put(tableName as any, record);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la mise à jour dans IndexedDB:', error);
        // Recharger le cache depuis IndexedDB en cas d'erreur
        await this.initializeCache();
      }
    });
  }

  private parseSetClause(setClause: string): any {
    const updates: any = {};
    const pairs = setClause.split(',').map(p => p.trim());
    
    pairs.forEach(pair => {
      const [key, value] = pair.split('=').map(s => s.trim());
      if (value === 'NULL') {
        updates[key] = null;
      } else if (!isNaN(Number(value)) && value !== '') {
        updates[key] = Number(value);
      } else {
        updates[key] = value.replace(/^'|'$/g, '').replace(/''/g, "'");
      }
    });
    
    return updates;
  }

  private matchesWhere(record: any, whereClause: string): boolean {
    // Parser basique pour WHERE
    const upperWhere = whereClause.toUpperCase();
    
    // Gérer les conditions multiples avec AND
    const andConditions = whereClause.split(/\s+AND\s+/i);
    
    for (const condition of andConditions) {
      if (condition.includes('id =')) {
        const idMatch = condition.match(/id\s*=\s*'([^']+)'/i);
        if (idMatch && record.id !== idMatch[1]) return false;
      } else if (condition.includes('number =')) {
        const numMatch = condition.match(/number\s*=\s*(\d+)/i);
        if (numMatch && record.number !== Number(numMatch[1])) return false;
      } else if (condition.includes('table_id =')) {
        const tableIdMatch = condition.match(/table_id\s*=\s*'([^']+)'/i);
        if (tableIdMatch && record.table_id !== tableIdMatch[1]) return false;
      } else if (condition.includes("status =")) {
        const statusMatch = condition.match(/status\s*=\s*'([^']+)'/i);
        if (statusMatch && record.status !== statusMatch[1]) return false;
      } else if (condition.includes('order_id =')) {
        const orderIdMatch = condition.match(/order_id\s*=\s*'([^']+)'/i);
        if (orderIdMatch && record.order_id !== orderIdMatch[1]) return false;
      } else if (condition.includes('parent_item_id IS NULL')) {
        if (record.parent_item_id !== null && record.parent_item_id !== undefined) return false;
      } else if (condition.includes('parent_item_id IS NOT NULL')) {
        if (record.parent_item_id === null || record.parent_item_id === undefined) return false;
      } else if (condition.includes('name =')) {
        const nameMatch = condition.match(/name\s*=\s*'([^']+)'/i);
        if (nameMatch && record.name !== nameMatch[1]) return false;
      }
    }
    
    return true;
  }

  private handleDeleteSync(sql: string) {
    const deleteMatch = sql.match(/DELETE FROM (\w+)(?:\s+WHERE\s+(.+))?/i);
    if (!deleteMatch) return;

    const tableName = deleteMatch[1].toLowerCase();
    const whereClause = deleteMatch[2];

    // Mettre à jour le cache immédiatement
    const cache = memoryCache.get(tableName) || [];
    if (whereClause) {
      const filtered = cache.filter((record: any) => !this.matchesWhere(record, whereClause));
      memoryCache.set(tableName, filtered);
    } else {
      memoryCache.set(tableName, []);
    }

    // Supprimer de IndexedDB de manière asynchrone
    Promise.resolve().then(async () => {
      try {
        if (whereClause) {
          const allRecords = await this.db.getAll(tableName as any);
          for (const record of allRecords) {
            if (this.matchesWhere(record, whereClause)) {
              await this.db.delete(tableName as any, record.id);
            }
          }
        } else {
          await this.db.clear(tableName as any);
        }
      } catch (error) {
        console.error('Erreur lors de la suppression dans IndexedDB:', error);
        // Recharger le cache depuis IndexedDB en cas d'erreur
        await this.initializeCache();
      }
    });
  }

  getAllSync<T>(query: string, params: any[]): T[] {
    // Parser la requête SQL pour déterminer la table
    const upperQuery = query.toUpperCase();
    
    if (upperQuery.includes('FROM TABLES') || upperQuery.includes('FROM tables')) {
      const cache = memoryCache.get('tables') || [];
      let result = [...cache] as T[];
      
      if (upperQuery.includes('WHERE id =')) {
        const id = params[0];
        result = cache.filter((item: any) => item.id === id) as T[];
      } else if (upperQuery.includes('WHERE number =')) {
        const number = params[0];
        result = cache.filter((item: any) => item.number === number) as T[];
      }
      
      if (upperQuery.includes('ORDER BY number')) {
        result.sort((a: any, b: any) => a.number - b.number);
      }
      return result;
    } else if (upperQuery.includes('FROM MENU_ITEMS') || upperQuery.includes('FROM menu_items')) {
      const cache = memoryCache.get('menu_items') || [];
      let result = [...cache] as T[];
      
      if (upperQuery.includes('WHERE category =')) {
        const category = params[0];
        result = cache.filter((item: any) => item.category === category) as T[];
      }
      if (upperQuery.includes('WHERE available =')) {
        const available = params[0];
        result = result.filter((item: any) => (item.available === 1 ? 1 : 0) === available) as T[];
      } else if (upperQuery.includes('available = 1')) {
        result = result.filter((item: any) => item.available === 1) as T[];
      }
      if (upperQuery.includes('WHERE id =')) {
        const id = params[0];
        result = cache.filter((item: any) => item.id === id) as T[];
      }
      
      if (upperQuery.includes('ORDER BY category') || upperQuery.includes('ORDER BY name')) {
        result.sort((a: any, b: any) => {
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          return a.name.localeCompare(b.name);
        });
      } else if (upperQuery.includes('ORDER BY name')) {
        result.sort((a: any, b: any) => a.name.localeCompare(b.name));
      }
      return result;
    } else if (upperQuery.includes('FROM SUPPLY_ITEMS') || upperQuery.includes('FROM supply_items')) {
      const cache = memoryCache.get('supply_items') || [];
      let result = [...cache] as T[];
      
      if (upperQuery.includes('WHERE id =')) {
        const id = params[0];
        result = cache.filter((item: any) => item.id === id) as T[];
      } else if (upperQuery.includes('WHERE name =')) {
        const name = params[0];
        result = cache.filter((item: any) => item.name === name) as T[];
      }
      
      if (upperQuery.includes('ORDER BY name')) {
        result.sort((a: any, b: any) => a.name.localeCompare(b.name));
      }
      return result;
    } else if (upperQuery.includes('FROM ORDERS') || upperQuery.includes('FROM orders')) {
      const cache = memoryCache.get('orders') || [];
      let result = [...cache] as T[];
      
      if (upperQuery.includes('WHERE table_id =')) {
        const tableId = params[0];
        result = cache.filter((item: any) => item.table_id === tableId) as T[];
        if (upperQuery.includes("status = 'OPEN'")) {
          result = result.filter((item: any) => item.status === 'OPEN') as T[];
        }
      } else if (upperQuery.includes('WHERE id =')) {
        const id = params[0];
        result = cache.filter((item: any) => item.id === id) as T[];
      }
      
      if (upperQuery.includes('ORDER BY created_at')) {
        result.sort((a: any, b: any) => b.created_at - a.created_at);
      }
      return result;
    } else if (upperQuery.includes('FROM ORDER_ITEMS') || upperQuery.includes('FROM order_items')) {
      const cache = memoryCache.get('order_items') || [];
      let result = [...cache] as T[];
      
      if (upperQuery.includes('WHERE order_id =')) {
        const orderId = params[0];
        result = cache.filter((item: any) => item.order_id === orderId) as T[];
        if (upperQuery.includes('parent_item_id IS NULL')) {
          result = result.filter((item: any) => !item.parent_item_id) as T[];
        } else if (upperQuery.includes('parent_item_id IS NOT NULL')) {
          result = result.filter((item: any) => item.parent_item_id) as T[];
        }
      }
      
      if (upperQuery.includes('ORDER BY created_at')) {
        result.sort((a: any, b: any) => a.created_at - b.created_at);
      }
      return result;
    } else if (upperQuery.includes('FROM SUPPLY_ORDERS') || upperQuery.includes('FROM supply_orders')) {
      const cache = memoryCache.get('supply_orders') || [];
      let result = [...cache] as T[];
      
      if (upperQuery.includes('WHERE date BETWEEN')) {
        const startDate = params[0];
        const endDate = params[1];
        result = cache.filter((item: any) => item.date >= startDate && item.date <= endDate) as T[];
      } else if (upperQuery.includes('WHERE id =')) {
        const id = params[0];
        result = cache.filter((item: any) => item.id === id) as T[];
      }
      
      if (upperQuery.includes('ORDER BY created_at')) {
        result.sort((a: any, b: any) => b.created_at - a.created_at);
      }
      return result;
    } else if (upperQuery.includes('FROM SUPPLY_ORDER_ITEMS') || upperQuery.includes('FROM supply_order_items')) {
      const cache = memoryCache.get('supply_order_items') || [];
      let result = [...cache] as T[];
      
      if (upperQuery.includes('WHERE order_id =')) {
        const orderId = params[0];
        result = cache.filter((item: any) => item.order_id === orderId) as T[];
      }
      return result;
    } else if (upperQuery.includes('SELECT SUM')) {
      // Pour les requêtes SUM, on doit parser différemment
      if (upperQuery.includes('FROM order_items') && upperQuery.includes('WHERE order_id')) {
        const orderId = params[0];
        const cache = memoryCache.get('order_items') || [];
        const items = cache.filter((item: any) => item.order_id === orderId);
        const total = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
        return [{ total }] as T[];
      }
    }
    
    return [];
  }

  getFirstSync<T>(query: string, params: any[]): T | null {
    const results = this.getAllSync<T>(query, params);
    if (results.length > 0) {
      return results[0];
    }
    
    // Pour les requêtes COUNT, parser différemment
    const upperQuery = query.toUpperCase();
    if (upperQuery.includes('SELECT COUNT')) {
      if (upperQuery.includes('FROM tables') && upperQuery.includes('WHERE number =')) {
        const number = params[0];
        const cache = memoryCache.get('tables') || [];
        const count = cache.filter((item: any) => item.number === number).length;
        if (params.length > 1 && upperQuery.includes('id !=')) {
          const excludeId = params[1];
          const filtered = cache.filter((item: any) => item.number === number && item.id !== excludeId);
          return { count: filtered.length } as T;
        }
        return { count } as T;
      } else if (upperQuery.includes('FROM supply_items') && upperQuery.includes('WHERE name =')) {
        const name = params[0];
        const cache = memoryCache.get('supply_items') || [];
        let count = cache.filter((item: any) => item.name === name).length;
        if (params.length > 1 && upperQuery.includes('id !=')) {
          const excludeId = params[1];
          const filtered = cache.filter((item: any) => item.name === name && item.id !== excludeId);
          count = filtered.length;
        }
        return { count } as T;
      }
    }
    
    return null;
  }

  // Méthodes async pour IndexedDB (pour usage futur)
  async getAll<T>(storeName: keyof RestaurantDBSchema, indexName?: string, query?: any): Promise<T[]> {
    const store = this.db.transaction(storeName, 'readonly').objectStore(storeName);
    if (indexName && query !== undefined) {
      const index = store.index(indexName);
      return await index.getAll(query);
    }
    return await store.getAll();
  }

  async get<T>(storeName: keyof RestaurantDBSchema, key: string): Promise<T | undefined> {
    return await this.db.get(storeName, key);
  }

  async put<T>(storeName: keyof RestaurantDBSchema, value: T): Promise<void> {
    await this.db.put(storeName, value as any);
  }

  async delete(storeName: keyof RestaurantDBSchema, key: string): Promise<void> {
    await this.db.delete(storeName, key);
  }

  async clear(storeName: keyof RestaurantDBSchema): Promise<void> {
    await this.db.clear(storeName);
  }

  // Méthodes async pour IndexedDB
  async getAll<T>(storeName: keyof RestaurantDBSchema, indexName?: string, query?: any): Promise<T[]> {
    const store = this.db.transaction(storeName, 'readonly').objectStore(storeName);
    if (indexName && query !== undefined) {
      const index = store.index(indexName);
      return await index.getAll(query);
    }
    return await store.getAll();
  }

  async get<T>(storeName: keyof RestaurantDBSchema, key: string): Promise<T | undefined> {
    return await this.db.get(storeName, key);
  }

  async put<T>(storeName: keyof RestaurantDBSchema, value: T): Promise<void> {
    await this.db.put(storeName, value as any);
  }

  async delete(storeName: keyof RestaurantDBSchema, key: string): Promise<void> {
    await this.db.delete(storeName, key);
  }

  async clear(storeName: keyof RestaurantDBSchema): Promise<void> {
    await this.db.clear(storeName);
  }
}

