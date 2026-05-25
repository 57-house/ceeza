import { Platform } from 'react-native';

/** Port du hub sync (tablette maître ou npm run server en dev) */
export const SYNC_PORT = 8765;

/**
 * URL WebSocket — uniquement pour le mode dev avec `npm run server` sur PC.
 * En production : mode tablette maître (TCP), pas de WebSocket.
 */
export const getDevWebSocketUrl = (): string => {
  const fromEnv = process.env.EXPO_PUBLIC_WS_URL;
  if (fromEnv) {
    return fromEnv;
  }
  if (Platform.OS === 'web') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `ws://${host}:${SYNC_PORT}`;
  }
  return `ws://localhost:${SYNC_PORT}`;
};

/** @deprecated Utiliser getDevWebSocketUrl */
export const getWebSocketUrl = getDevWebSocketUrl;

export const WS_PORT = SYNC_PORT;
