import 'react-native-get-random-values';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { getDevWebSocketUrl } from '../config/network';
import { registerSyncBroadcaster, pushLocalSync } from '../sync/syncBridge';
import { applySyncMessage, isApplyingRemoteSync } from '../sync/syncApply';
import { broadcastFromHub, getEmbeddedHubClientCount, startEmbeddedHub, stopEmbeddedHub } from '../sync/embeddedHub';
import { mergeHubSnapshot } from '../sync/hubLogic';
import { getSyncRole, getMasterHost } from '../sync/syncRoleStorage';
import { connectTcpSyncClient } from '../sync/tcpSyncClient';
import { isExpoGo, isLocalTcpSyncAvailable } from '../sync/tcpNative';
import { exportSyncSnapshot } from '../sync/syncData';
import { SyncMessage, SyncUiEvent } from '../sync/syncTypes';
import { Order } from '../types/order';
import { playOrderReadySound } from './soundService';

const SNAPSHOT_PUBLISH_DEBOUNCE_MS = 4000;

let deviceId: string | null = null;

function getDeviceId(): string {
  if (!deviceId) deviceId = uuidv4();
  return deviceId;
}
let isMasterMode = false;
let wsSocket: WebSocket | null = null;
let tcpClient: ReturnType<typeof connectTcpSyncClient> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let snapshotPublishTimer: ReturnType<typeof setTimeout> | null = null;
let snapshotRequested = false;
let connectedClients = 0;
let maxClients = 20;

const uiListeners = new Set<(event: SyncUiEvent) => void>();

function emitUi(event: SyncUiEvent): void {
  uiListeners.forEach((l) => l(event));
}

function sendPayload(payload: object): void {
  if (isMasterMode) {
    broadcastFromHub(payload);
    return;
  }
  if (tcpClient) {
    tcpClient.send(payload);
    return;
  }
  if (wsSocket?.readyState === WebSocket.OPEN) {
    wsSocket.send(JSON.stringify(payload));
  }
}

function scheduleSnapshotPublish(): void {
  if (snapshotPublishTimer) clearTimeout(snapshotPublishTimer);
  snapshotPublishTimer = setTimeout(() => {
    snapshotPublishTimer = null;
    if (isApplyingRemoteSync()) return;

    const snapshot = exportSyncSnapshot();
    if (isMasterMode) {
      mergeHubSnapshot(snapshot);
    }

    const msg = { type: 'SYNC_SNAPSHOT', deviceId: getDeviceId(), snapshot };
    if (isMasterMode) {
      broadcastFromHub(msg);
    } else {
      sendPayload(msg);
    }
  }, SNAPSHOT_PUBLISH_DEBOUNCE_MS);
}

function broadcast(message: SyncMessage): void {
  if (isApplyingRemoteSync()) return;
  sendPayload(message);
  scheduleSnapshotPublish();
  emitUi({ type: 'DATA_CHANGED', source: 'local' });
}

function handleRemoteMessage(data: string): void {
  let message: SyncMessage & { type: string; deviceId?: string };
  try {
    message = JSON.parse(data);
  } catch {
    return;
  }

  if (message.type === 'CLIENT_COUNT') {
    connectedClients = message.count ?? 0;
    maxClients = message.max ?? 20;
    emitUi({ type: 'CLIENT_COUNT', count: connectedClients, max: maxClients });
    return;
  }

  if (message.type === 'SYNC_ERROR') {
    emitUi({ type: 'SYNC_ERROR', message: message.message || 'Erreur sync' });
    return;
  }

  if (message.type === 'SYNC_REQUEST' || message.type === 'SYNC_REQUEST_RELAY') {
    if (message.deviceId !== getDeviceId() && message.type === 'SYNC_REQUEST_RELAY') {
      sendPayload({
        type: 'SYNC_SNAPSHOT',
        deviceId: getDeviceId(),
        snapshot: exportSyncSnapshot(),
      });
    }
    return;
  }

  if (message.type === 'SYNC_SNAPSHOT' && message.snapshot) {
    if (message.deviceId === getDeviceId()) return;
    applySyncMessage(message);
    emitUi({ type: 'DATA_CHANGED', source: 'snapshot' });
    return;
  }

  applySyncMessage(message as SyncMessage);

  if (message.type === 'ORDER_READY') {
    emitUi({
      type: 'ORDER_READY',
      orderId: message.orderId,
      tableNumber: message.tableNumber,
    });
    void playOrderReadySound();
  }

  emitUi({ type: 'DATA_CHANGED', source: 'remote' });
}

function requestFullSync(): void {
  if (isMasterMode) return;
  if (snapshotRequested) return;
  snapshotRequested = true;
  sendPayload({ type: 'SYNC_REQUEST', deviceId: getDeviceId() });
  setTimeout(() => {
    snapshotRequested = false;
  }, 8000);
}

function scheduleReconnect(): void {
  if (isMasterMode) return;
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectSyncService();
  }, 3000);
}

function connectWebSocketDev(): void {
  const url = getDevWebSocketUrl();
  try {
    wsSocket = new WebSocket(url);
    wsSocket.onopen = () => {
      console.log('[sync] Dev WebSocket', url);
      emitUi({ type: 'CONNECTED' });
      setTimeout(requestFullSync, 500);
      scheduleSnapshotPublish();
    };
    wsSocket.onmessage = (e) => handleRemoteMessage(String(e.data));
    wsSocket.onclose = () => {
      emitUi({ type: 'DISCONNECTED' });
      wsSocket = null;
      scheduleReconnect();
    };
    wsSocket.onerror = () => wsSocket?.close();
  } catch {
    scheduleReconnect();
  }
}

function connectTcpClient(masterHost: string): void {
  tcpClient?.close();
  tcpClient = connectTcpSyncClient(masterHost, {
    onOpen: () => {
      console.log('[sync] Connecté à la maître', masterHost);
      emitUi({ type: 'CONNECTED' });
      setTimeout(requestFullSync, 500);
      scheduleSnapshotPublish();
    },
    onMessage: handleRemoteMessage,
    onClose: () => {
      emitUi({ type: 'DISCONNECTED' });
      tcpClient = null;
      scheduleReconnect();
    },
    onError: () => {
      tcpClient?.close();
    },
  });
}

function startMasterHub(): boolean {
  if (!isLocalTcpSyncAvailable()) {
    console.warn('[sync] Mode maître indisponible dans Expo Go — utilisez une development build');
    return false;
  }
  isMasterMode = true;
  startEmbeddedHub((count) => {
    connectedClients = count;
    emitUi({ type: 'CLIENT_COUNT', count, max: maxClients });
  });
  emitUi({ type: 'CONNECTED' });
  emitUi({ type: 'CLIENT_COUNT', count: 0, max: maxClients });
  console.log('[sync] Mode tablette maître actif');
  return true;
}

export function subscribeSync(listener: (event: SyncUiEvent) => void): () => void {
  uiListeners.add(listener);
  return () => uiListeners.delete(listener);
}

export type SyncEvent = SyncUiEvent;

export function getConnectedDevicesCount(): { count: number; max: number } {
  if (isMasterMode) {
    return { count: getEmbeddedHubClientCount(), max: maxClients };
  }
  return { count: connectedClients, max: maxClients };
}

export function isMasterDevice(): boolean {
  return isMasterMode;
}

export { isExpoGo, isLocalTcpSyncAvailable };

export async function connectSyncService(): Promise<void> {
  registerSyncBroadcaster(broadcast);

  disconnectSyncService();

  const role = await getSyncRole();

  if (role === 'master' && Platform.OS !== 'web' && isLocalTcpSyncAvailable()) {
    if (startMasterHub()) return;
  }

  isMasterMode = false;

  if (role === 'client' && Platform.OS !== 'web' && isLocalTcpSyncAvailable()) {
    const host = await getMasterHost();
    if (host) {
      connectTcpClient(host);
      return;
    }
  }

  if (Platform.OS === 'web' || process.env.EXPO_PUBLIC_WS_URL || isExpoGo()) {
    connectWebSocketDev();
    return;
  }

  console.warn('[sync] Configurez le rôle réseau (onglet Réseau) ou lancez npm run server');
}

export function disconnectSyncService(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (snapshotPublishTimer) {
    clearTimeout(snapshotPublishTimer);
    snapshotPublishTimer = null;
  }
  tcpClient?.close();
  tcpClient = null;
  wsSocket?.close();
  wsSocket = null;
  if (isMasterMode) {
    stopEmbeddedHub();
    isMasterMode = false;
  }
}

export function getSyncConnectionState(): 'connected' | 'disconnected' | 'master' {
  if (isMasterMode) return 'master';
  if (tcpClient || wsSocket?.readyState === WebSocket.OPEN) return 'connected';
  return 'disconnected';
}

export function broadcastOrderToKitchen(order: Order): void {
  pushLocalSync({ type: 'ORDER_SYNC', order });
  pushLocalSync({ type: 'ORDER_PREPARING', order });
}

export function broadcastOrderReady(order: Order): void {
  pushLocalSync({
    type: 'ORDER_READY',
    orderId: order.id,
    tableNumber: order.table_number,
  });
  const full = { ...order, status: 'READY' as const };
  pushLocalSync({ type: 'ORDER_SYNC', order: full });
}

export function broadcastInvoicePaid(invoice: import('../types/invoice').Invoice): void {
  pushLocalSync({ type: 'INVOICE_PAID', invoice });
}
