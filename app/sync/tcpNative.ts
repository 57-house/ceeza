import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type TcpSocketModule = typeof import('react-native-tcp-socket').default;

let cachedModule: TcpSocketModule | null | undefined;

/** Expo Go n'inclut pas react-native-tcp-socket. */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export function isLocalTcpSyncAvailable(): boolean {
  if (Platform.OS === 'web' || isExpoGo()) return false;
  return getTcpSocket() !== null;
}

/** Charge le module natif TCP uniquement hors Expo Go (évite le crash au démarrage). */
export function getTcpSocket(): TcpSocketModule | null {
  if (Platform.OS === 'web' || isExpoGo()) return null;
  if (cachedModule !== undefined) return cachedModule;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('react-native-tcp-socket').default as TcpSocketModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}
