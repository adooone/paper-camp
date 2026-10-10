import { apiUrl } from './api-base';

export type ActivityMessage = { message?: string; type?: string };
export type ActivityListener = (payload: ActivityMessage) => void;

const MIN_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;

interface Connection {
  source: EventSource | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectDelay: number;
  listeners: Set<ActivityListener>;
}

// Keyed by runtime URL, '' meaning the current project — a bookmarked scope
// opens one EventSource per runtime in scope instead of a single global one.
const connections = new Map<string, Connection>();

function streamUrl(runtimeUrl: string): string {
  return runtimeUrl === '' ? apiUrl('/api/activity/stream') : `${runtimeUrl}/api/activity/stream`;
}

function handleMessage(connection: Connection, event: MessageEvent<string>): void {
  let payload: ActivityMessage;
  try {
    payload = JSON.parse(event.data);
  } catch {
    return;
  }
  for (const listener of connection.listeners) listener(payload);
}

function connect(runtimeUrl: string, connection: Connection): void {
  const source = new EventSource(streamUrl(runtimeUrl));
  source.onmessage = (event) => handleMessage(connection, event);
  source.onopen = () => {
    connection.reconnectDelay = MIN_RECONNECT_DELAY_MS;
  };
  source.onerror = () => {
    connection.source?.close();
    connection.source = null;
    if (connection.listeners.size === 0) return;
    connection.reconnectTimer = setTimeout(() => {
      connection.reconnectTimer = null;
      connect(runtimeUrl, connection);
    }, connection.reconnectDelay);
    connection.reconnectDelay = Math.min(connection.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  };
  connection.source = source;
}

export function subscribeToActivityStream(listener: ActivityListener, runtimeUrl = ''): () => void {
  let connection = connections.get(runtimeUrl);
  if (!connection) {
    connection = {
      source: null,
      reconnectTimer: null,
      reconnectDelay: MIN_RECONNECT_DELAY_MS,
      listeners: new Set(),
    };
    connections.set(runtimeUrl, connection);
  }
  connection.listeners.add(listener);
  if (!connection.source && !connection.reconnectTimer) connect(runtimeUrl, connection);

  return () => {
    const current = connections.get(runtimeUrl);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;
    if (current.reconnectTimer) {
      clearTimeout(current.reconnectTimer);
      current.reconnectTimer = null;
    }
    current.source?.close();
    connections.delete(runtimeUrl);
  };
}
