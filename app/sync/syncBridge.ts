import type { SyncMessage } from './syncTypes';

let broadcaster: ((message: SyncMessage) => void) | null = null;

export function registerSyncBroadcaster(fn: (message: SyncMessage) => void): void {
  broadcaster = fn;
}

/** Appelé par les services après une écriture locale → envoi réseau */
export function pushLocalSync(message: SyncMessage): void {
  broadcaster?.(message);
}
