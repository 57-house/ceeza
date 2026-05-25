import { SyncSnapshot } from './syncTypes';

const SERVER_DEVICE_ID = 'ceeza-server';
const MAX_CLIENTS = 20;

export interface HubConnection {
  id: string;
  send: (payload: string) => void;
}

let latestSnapshot: SyncSnapshot | null = null;
let latestSnapshotAt = 0;

export function mergeHubSnapshot(snapshot: SyncSnapshot | undefined): void {
  if (!snapshot || typeof snapshot.exported_at !== 'number') return;
  if (!latestSnapshot || snapshot.exported_at >= latestSnapshotAt) {
    latestSnapshot = snapshot;
    latestSnapshotAt = snapshot.exported_at;
  }
}

export function getHubSnapshot(): SyncSnapshot | null {
  return latestSnapshot;
}

export function handleHubMessage(
  raw: string,
  sender: HubConnection,
  connections: HubConnection[],
  onClientCount: (count: number) => void
): void {
  let message: { type: string; deviceId?: string; snapshot?: SyncSnapshot; message?: string };
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }

  const broadcast = (payload: object, exceptId?: string) => {
    const text = JSON.stringify(payload);
    connections.forEach((c) => {
      if (c.id !== exceptId) {
        try {
          c.send(text);
        } catch {
          // connexion fermée
        }
      }
    });
  };

  const sendTo = (targetId: string, payload: object) => {
    const text = JSON.stringify(payload);
    const target = connections.find((c) => c.id === targetId);
    target?.send(text);
  };

  switch (message.type) {
    case 'SYNC_SNAPSHOT':
      if (message.snapshot) {
        mergeHubSnapshot(message.snapshot);
      }
      broadcast(message, sender.id);
      break;

    case 'SYNC_REQUEST':
      if (latestSnapshot) {
        sendTo(sender.id, {
          type: 'SYNC_SNAPSHOT',
          deviceId: SERVER_DEVICE_ID,
          snapshot: latestSnapshot,
        });
      } else {
        const peers = connections.filter((c) => c.id !== sender.id);
        if (peers.length > 0) {
          peers[0].send(
            JSON.stringify({
              type: 'SYNC_REQUEST_RELAY',
              deviceId: message.deviceId,
            })
          );
        }
      }
      break;

    default:
      broadcast(message, sender.id);
      break;
  }

  onClientCount(connections.length);
}

export function buildWelcomeMessages(): object[] {
  const msgs: object[] = [
    { type: 'CLIENT_COUNT', count: 0, max: MAX_CLIENTS },
  ];
  if (latestSnapshot) {
    msgs.push({
      type: 'SYNC_SNAPSHOT',
      deviceId: SERVER_DEVICE_ID,
      snapshot: latestSnapshot,
    });
  }
  return msgs;
}

export function getMaxClients(): number {
  return MAX_CLIENTS;
}
