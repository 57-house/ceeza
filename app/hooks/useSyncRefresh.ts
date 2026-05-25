import { useEffect } from 'react';
import { subscribeSync } from '../services/syncService';

/** Recharge les données quand un autre appareil modifie la base (réseau local) */
export function useSyncRefresh(onRefresh: () => void): void {
  useEffect(() => {
    const unsubscribe = subscribeSync((event) => {
      if (
        event.type === 'DATA_CHANGED' ||
        event.type === 'ORDER_READY' ||
        event.type === 'CONNECTED'
      ) {
        onRefresh();
      }
    });
    return unsubscribe;
  }, [onRefresh]);
}
