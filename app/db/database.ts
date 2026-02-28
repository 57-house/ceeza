import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { initWebDB, getWebDB, WebSQLiteDatabase } from './webDatabase';

let db: SQLite.SQLiteDatabase | null = null;
let webDb: WebSQLiteDatabase | null = null;

export const initDB = async () => {
  if (Platform.OS === 'web') {
    // Utiliser IndexedDB sur le web
    try {
      const idb = await initWebDB();
      webDb = new WebSQLiteDatabase(idb);
      // Attendre que le cache soit initialisé
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log('Base de données IndexedDB initialisée avec succès');
      return; // Les tables sont créées automatiquement par IndexedDB
    } catch (error) {
      console.error('Erreur lors de l\'initialisation IndexedDB:', error);
      throw error;
    }
  }

  // Utiliser SQLite sur mobile
  try {
    db = SQLite.openDatabaseSync('restaurant.db');
    
    // Créer la table des tables du restaurant
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

    // Créer la table des menus/plats
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

    // Créer la table des articles d'approvisionnement
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

    // Créer la table des approvisionnements
    db.execSync(`
      CREATE TABLE IF NOT EXISTS supply_orders (
        id TEXT PRIMARY KEY,
        date INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Créer la table des items d'approvisionnement (relation many-to-many)
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

    // Migration: Ajouter la colonne cost si elle n'existe pas
    try {
      db.execSync(`
        ALTER TABLE supply_order_items ADD COLUMN cost REAL NOT NULL DEFAULT 0;
      `);
    } catch (error) {
      // La colonne existe déjà, on ignore l'erreur
      console.log('Colonne cost déjà présente ou erreur de migration:', error);
    }

    // Créer la table des commandes
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

    // Créer la table des items de commande
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
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données:', error);
    throw error;
  }
};

export const getDB = (): SQLite.SQLiteDatabase => {
  if (Platform.OS === 'web') {
    // Sur le web, retourner un wrapper qui simule l'API SQLite
    if (!webDb) {
      throw new Error('Base de données web non initialisée. Appelez initDB() d\'abord.');
    }
    // @ts-ignore - On retourne un objet qui simule SQLiteDatabase
    return webDb as any;
  }

  if (!db) {
    throw new Error('Base de données non initialisée. Appelez initDB() d\'abord.');
  }
  return db;
};

