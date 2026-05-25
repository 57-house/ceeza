import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { initWebDB, WebSQLiteDatabase } from './webDatabase';

let db: SQLite.SQLiteDatabase | null = null;
let webDb: WebSQLiteDatabase | null = null;
let dbInitialized = false;
let initPromise: Promise<void> | null = null;

async function runInit(): Promise<void> {
  if (Platform.OS === 'web') {
    const idb = await initWebDB();
    webDb = new WebSQLiteDatabase(idb);
    await webDb.whenReady();
    console.log('Base de données IndexedDB initialisée avec succès');
    return;
  }

  db = SQLite.openDatabaseSync('restaurant.db');

  db.execSync(`
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      number INTEGER UNIQUE NOT NULL,
      capacity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS supply_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS supply_orders (
      id TEXT PRIMARY KEY,
      date INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS supply_order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      cost REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES supply_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES supply_items(id)
    );
  `);

  try {
    db.execSync(`
      ALTER TABLE supply_order_items ADD COLUMN cost REAL NOT NULL DEFAULT 0;
    `);
  } catch (error) {
    console.log('Colonne cost déjà présente ou erreur de migration:', error);
  }

  db.execSync(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      table_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      total REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (table_id) REFERENCES tables(id)
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      invoice_number TEXT NOT NULL UNIQUE,
      table_number INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      tax_rate REAL NOT NULL DEFAULT 0.10,
      tax_amount REAL NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at INTEGER NOT NULL,
      paid_at INTEGER,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
  `);

  try {
    db.execSync(`ALTER TABLE invoices ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING';`);
  } catch {
    // colonne déjà présente
  }
  try {
    db.execSync(`ALTER TABLE invoices ADD COLUMN paid_at INTEGER;`);
  } catch {
    // colonne déjà présente
  }
  try {
    db.execSync(`UPDATE invoices SET status = 'PAID', paid_at = created_at WHERE status IS NULL OR status = '';`);
  } catch {
    // migration optionnelle
  }

  db.execSync(`
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      menu_item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      parent_item_id TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
      FOREIGN KEY (parent_item_id) REFERENCES order_items(id)
    );
  `);

  console.log('Base de données initialisée avec succès');
}

export const initDB = async (): Promise<void> => {
  if (dbInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await runInit();
      dbInitialized = true;
    } catch (error) {
      initPromise = null;
      db = null;
      webDb = null;
      console.error('Erreur lors de l\'initialisation de la base de données:', error);
      throw error;
    }
  })();

  return initPromise;
};

/** Attend que initDB() soit terminé (à utiliser dans les écrans avant tout accès DB). */
export const waitForDB = async (): Promise<void> => {
  if (dbInitialized) return;
  await initDB();
};

export const isDBReady = (): boolean => dbInitialized;

export const getDB = (): SQLite.SQLiteDatabase => {
  if (Platform.OS === 'web') {
    if (!webDb) {
      throw new Error('Base de données web non initialisée. Appelez initDB() d\'abord.');
    }
    return webDb as any;
  }

  if (!db) {
    throw new Error('Base de données non initialisée. Appelez initDB() d\'abord.');
  }
  return db;
};
