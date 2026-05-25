import { useEffect, useState } from 'react';
import { waitForDB } from '../db/database';

/** Charge les données uniquement après initialisation de la base. */
export function useDatabaseReady(onReady: () => void, deps: unknown[] = []): void {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    waitForDB()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => console.error('Base de données indisponible:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    onReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ...deps]);
}
