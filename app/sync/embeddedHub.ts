import { SYNC_PORT } from '../config/network';
import {
  buildWelcomeMessages,
  getMaxClients,
  handleHubMessage,
  HubConnection,
} from './hubLogic';
import { getTcpSocket } from './tcpNative';

interface ClientState {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket: any;
  buffer: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let server: any = null;
const clients = new Map<string, ClientState>();
let clientCountCallback: ((count: number) => void) | null = null;
let nextClientId = 1;

function getConnections(): HubConnection[] {
  return [...clients.values()].map((c) => ({
    id: c.id,
    send: (payload: string) => {
      try {
        c.socket.write(`${payload}\n`);
      } catch {
        // ignore
      }
    },
  }));
}

function notifyCount(): void {
  const count = clients.size;
  clientCountCallback?.(count);
  const payload = JSON.stringify({ type: 'CLIENT_COUNT', count, max: getMaxClients() });
  clients.forEach((c) => {
    try {
      c.socket.write(`${payload}\n`);
    } catch {
      // ignore
    }
  });
}

function processBuffer(client: ClientState): void {
  let newlineIndex = client.buffer.indexOf('\n');
  while (newlineIndex >= 0) {
    const line = client.buffer.slice(0, newlineIndex).trim();
    client.buffer = client.buffer.slice(newlineIndex + 1);
    if (line) {
      handleHubMessage(line, { id: client.id, send: (p) => client.socket.write(`${p}\n`) }, getConnections(), () =>
        notifyCount()
      );
    }
    newlineIndex = client.buffer.indexOf('\n');
  }
}

export function startEmbeddedHub(onClientCount: (count: number) => void): () => void {
  const TcpSocket = getTcpSocket();
  if (!TcpSocket) {
    console.warn('[hub] TCP indisponible — development build requise (pas Expo Go)');
    return () => {};
  }

  if (server) {
    return stopEmbeddedHub;
  }

  clientCountCallback = onClientCount;

  server = TcpSocket.createServer((socket) => {
    if (clients.size >= getMaxClients()) {
      socket.write(
        `${JSON.stringify({
          type: 'SYNC_ERROR',
          message: `Limite de ${getMaxClients()} appareils atteinte.`,
        })}\n`
      );
      socket.destroy();
      return;
    }

    const id = `c${nextClientId++}`;
    const client: ClientState = { id, socket, buffer: '' };
    clients.set(id, client);

    for (const msg of buildWelcomeMessages()) {
      socket.write(`${JSON.stringify(msg)}\n`);
    }
    notifyCount();

    socket.on('data', (data: string | Buffer) => {
      client.buffer += typeof data === 'string' ? data : data.toString('utf8');
      processBuffer(client);
    });

    socket.on('error', () => {
      clients.delete(id);
      notifyCount();
    });

    socket.on('close', () => {
      clients.delete(id);
      notifyCount();
    });
  });

  server?.listen({ port: SYNC_PORT, host: '0.0.0.0' }, () => {
    console.log(`[hub] Tablette maître — port ${SYNC_PORT}`);
  });

  server?.on('error', (err: Error) => {
    console.error('[hub] Erreur serveur:', err);
  });

  return stopEmbeddedHub;
}

export function stopEmbeddedHub(): void {
  clients.forEach((c) => {
    try {
      c.socket.destroy();
    } catch {
      // ignore
    }
  });
  clients.clear();
  if (server) {
    try {
      server.close();
    } catch {
      // ignore
    }
    server = null;
  }
  clientCountCallback = null;
}

export function getEmbeddedHubClientCount(): number {
  return clients.size;
}

export function broadcastFromHub(payload: object): void {
  const text = JSON.stringify(payload);
  clients.forEach((c) => {
    try {
      c.socket.write(`${text}\n`);
    } catch {
      // ignore
    }
  });
}
