import { SYNC_PORT } from '../config/network';
import { getTcpSocket } from './tcpNative';

export interface TcpSyncCallbacks {
  onOpen: () => void;
  onMessage: (data: string) => void;
  onClose: () => void;
  onError: () => void;
}

export function connectTcpSyncClient(
  masterHost: string,
  callbacks: TcpSyncCallbacks
): { send: (payload: object) => void; close: () => void } {
  const noop = { send: () => {}, close: () => {} };
  const TcpSocket = getTcpSocket();
  if (!TcpSocket) {
    callbacks.onError();
    return noop;
  }

  let buffer = '';
  let socket: ReturnType<typeof TcpSocket.createConnection> | null = null;

  socket = TcpSocket.createConnection({ port: SYNC_PORT, host: masterHost }, () => {
    callbacks.onOpen();
  });

  socket.on('data', (data: string | Buffer) => {
    buffer += typeof data === 'string' ? data : data.toString('utf8');
    let idx = buffer.indexOf('\n');
    while (idx >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) {
        callbacks.onMessage(line);
      }
      idx = buffer.indexOf('\n');
    }
  });

  socket.on('error', () => {
    callbacks.onError();
  });

  socket.on('close', () => {
    callbacks.onClose();
  });

  return {
    send: (payload: object) => {
      if (socket) {
        try {
          socket.write(`${JSON.stringify(payload)}\n`);
        } catch {
          // ignore
        }
      }
    },
    close: () => {
      try {
        socket?.destroy();
      } catch {
        // ignore
      }
      socket = null;
    },
  };
}
