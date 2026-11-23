import { initWebDB, WebSQLiteDatabase } from './webDatabase';

let webDb: WebSQLiteDatabase | null = null;
let dbInitialized = false;
let initPromise: Promise<void> | null = null;

async function runInit(): Promise<void> {
  const idb = await initWebDB();
  webDb = new WebSQLiteDatabase(idb);
  await webDb.whenReady();
  console.log('Base de données IndexedDB initialisée avec succès');
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
      webDb = null;
      console.error("Erreur lors de l'initialisation de la base de données:", error);
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

export const getDB = (): WebSQLiteDatabase => {
  if (!webDb) {
    throw new Error("Base de données web non initialisée. Appelez initDB() d'abord.");
  }
  return webDb;
};
