/**
 * Hub WebSocket Ceeza — jusqu'à 10+ appareils sur le même réseau.
 * Lancer avec : npm run server
 */
const { WebSocketServer } = require('ws');

const PORT = process.env.WS_PORT || 8765;
const MAX_CLIENTS = 20;
const SERVER_DEVICE_ID = 'ceeza-server';

const wss = new WebSocketServer({ port: PORT });

wss.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[ceeza] Le port ${PORT} est déjà utilisé (serveur déjà lancé ?).\n` +
        `  → Fermez l'autre terminal, ou : netstat -ano | findstr :${PORT} puis taskkill /PID <pid> /F\n` +
        `  → Ou utilisez un autre port : WS_PORT=8766 npm run server`
    );
    process.exit(1);
  }
  console.error('[ceeza] Erreur serveur:', err);
  process.exit(1);
});

/** Dernier snapshot connu (le plus récent gagne) */
let latestSnapshot = null;
let latestSnapshotAt = 0;

function clientCount() {
  return [...wss.clients].filter((c) => c.readyState === 1).length;
}

function broadcast(message, exceptWs = null) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== exceptWs && client.readyState === 1) {
      client.send(payload);
    }
  });
}

function sendClientCount() {
  broadcast({
    type: 'CLIENT_COUNT',
    count: clientCount(),
    max: MAX_CLIENTS,
  });
}

function mergeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot.exported_at !== 'number') return;
  if (!latestSnapshot || snapshot.exported_at >= latestSnapshotAt) {
    latestSnapshot = snapshot;
    latestSnapshotAt = snapshot.exported_at;
  }
}

function sendSnapshotTo(ws, snapshot) {
  if (!snapshot || ws.readyState !== 1) return;
  ws.send(
    JSON.stringify({
      type: 'SYNC_SNAPSHOT',
      deviceId: SERVER_DEVICE_ID,
      snapshot,
    })
  );
}

console.log(`[ceeza] Hub sync — ws://0.0.0.0:${PORT} (jusqu'à ${MAX_CLIENTS} appareils)`);
console.log(`[ceeza] Mobile : EXPO_PUBLIC_WS_URL=ws://IP_DU_PC:${PORT}`);

wss.on('connection', (ws) => {
  const count = clientCount();
  if (count > MAX_CLIENTS) {
    ws.send(
      JSON.stringify({
        type: 'SYNC_ERROR',
        message: `Limite de ${MAX_CLIENTS} appareils atteinte. Réessayez plus tard.`,
      })
    );
    ws.close();
    return;
  }

  console.log(`[ceeza] Appareil connecté (${count}/${MAX_CLIENTS})`);

  ws.send(
    JSON.stringify({
      type: 'CLIENT_COUNT',
      count,
      max: MAX_CLIENTS,
    })
  );

  if (latestSnapshot) {
    sendSnapshotTo(ws, latestSnapshot);
  }

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (message.type) {
      case 'SYNC_SNAPSHOT':
        if (message.snapshot) {
          mergeSnapshot(message.snapshot);
        }
        broadcast(message, ws);
        break;

      case 'SYNC_REQUEST':
        if (latestSnapshot) {
          sendSnapshotTo(ws, latestSnapshot);
        } else {
          const peers = [...wss.clients].filter(
            (c) => c !== ws && c.readyState === 1
          );
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
        broadcast(message, ws);
        break;
    }
  });

  ws.on('close', () => {
    console.log(`[ceeza] Appareil déconnecté (${clientCount()}/${MAX_CLIENTS})`);
    sendClientCount();
  });
});
