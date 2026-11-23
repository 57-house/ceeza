import { getDB } from '../db/database';
import { pushLocalSync } from '../sync/syncBridge';
import { sqlEscape } from '../utils/sqlEscape';
import { stableTableId } from '../utils/stableId';
import { Table, TableStatus } from '../types/table';

export const tableService = {
  /** ID canonique pour une table (même sur tous les appareils). */
  resolveTableId(tableNumber: number, fallbackId?: string): string {
    return stableTableId(tableNumber);
  },

  upsertFromSync(table: Table): void {
    const db = getDB();
    const byNumber = tableService.getTableByNumber(table.number);
    const id = byNumber?.id ?? table.id ?? stableTableId(table.number);
    const row: Table = { ...table, id };

    try {
      db.execSync(`
        INSERT OR REPLACE INTO tables (id, number, capacity, status, created_at, updated_at)
        VALUES ('${id}', ${row.number}, ${row.capacity}, '${row.status}', ${row.created_at}, ${row.updated_at})
      `);
    } catch (error) {
      console.warn('[sync] upsert table', row.number, error);
    }
  },

  addTable: (number: number, capacity: number): Table => {
    if (tableService.tableNumberExists(number)) {
      throw new Error(`La table numéro ${number} existe déjà`);
    }

    const db = getDB();
    const id = stableTableId(number);
    const now = Date.now();
    const table: Table = {
      id,
      number,
      capacity,
      status: 'AVAILABLE',
      created_at: now,
      updated_at: now,
    };

    db.execSync(`
      INSERT OR REPLACE INTO tables (id, number, capacity, status, created_at, updated_at)
      VALUES ('${id}', ${number}, ${capacity}, 'AVAILABLE', ${now}, ${now})
    `);
    pushLocalSync({ type: 'TABLE_SYNC', table });
    return table;
  },

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

  getTableByNumber: (number: number): Table | null => {
    return tableService.getTableById(stableTableId(number));
  },

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

  deleteTable: (id: string): void => {
    const db = getDB();
    db.execSync(`DELETE FROM tables WHERE id = '${id}'`);
    pushLocalSync({ type: 'TABLE_DELETE', id });
  },

  tableNumberExists: (number: number, excludeId?: string): boolean => {
    const canonical = stableTableId(number);
    if (excludeId && excludeId === canonical) return false;
    return tableService.getTableByNumber(number) !== null;
  },
};
