import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db/database';
import { pushLocalSync } from '../sync/syncBridge';
import { Table, TableStatus } from '../types/table';

export const tableService = {
  // Ajouter une nouvelle table
  addTable: (number: number, capacity: number): Table => {
    const db = getDB();
    const id = uuidv4();
    const now = Date.now();

    try {
      db.execSync(`
        INSERT INTO tables (id, number, capacity, status, created_at, updated_at)
        VALUES ('${id}', ${number}, ${capacity}, 'AVAILABLE', ${now}, ${now})
      `);

      const table = {
        id,
        number,
        capacity,
        status: 'AVAILABLE' as TableStatus,
        created_at: now,
        updated_at: now,
      };
      pushLocalSync({ type: 'TABLE_SYNC', table });
      return table;
    } catch (error) {
      console.error('Erreur dans addTable:', error);
      throw error;
    }
  },

  // Récupérer toutes les tables
  getAllTables: (): Table[] => {
    const db = getDB();
    try {
      const result = db.getAllSync<Table>(
        'SELECT * FROM tables ORDER BY number ASC',
        []
      );
      return result || [];
    } catch (error) {
      console.error('Erreur dans getAllTables:', error);
      return [];
    }
  },

  // Récupérer une table par ID
  getTableById: (id: string): Table | null => {
    const db = getDB();
    try {
      const result = db.getFirstSync<Table>(
        'SELECT * FROM tables WHERE id = ?',
        [id]
      );
      return result || null;
    } catch (error) {
      console.error('Erreur dans getTableById:', error);
      return null;
    }
  },

  // Mettre à jour le statut d'une table
  updateTableStatus: (id: string, status: TableStatus): void => {
    const db = getDB();
    const now = Date.now();
    db.execSync(`
      UPDATE tables 
      SET status = '${status}', updated_at = ${now}
      WHERE id = '${id}'
    `);
    const table = tableService.getTableById(id);
    if (table) {
      pushLocalSync({ type: 'TABLE_SYNC', table: { ...table, status, updated_at: now } });
    }
  },

  // Supprimer une table
  deleteTable: (id: string): void => {
    const db = getDB();
    db.execSync(`DELETE FROM tables WHERE id = '${id}'`);
    pushLocalSync({ type: 'TABLE_DELETE', id });
  },

  // Vérifier si un numéro de table existe déjà
  tableNumberExists: (number: number, excludeId?: string): boolean => {
    const db = getDB();
    let query = 'SELECT COUNT(*) as count FROM tables WHERE number = ?';
    const params: (string | number)[] = [number];
    
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    
    const result = db.getFirstSync<{ count: number }>(query, params);
    return (result?.count || 0) > 0;
  },
};

