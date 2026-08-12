import { apiUrl } from './api-base';

export type ActivityMessage = { message?: string; type?: string };
export type ActivityListener = (payload: ActivityMessage) => void;

const MIN_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;

let source: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = MIN_RECONNECT_DELAY_MS;
const listeners = new Set<ActivityListener>();

function handleMessage(event: MessageEvent<string>): void {
  let payload: ActivityMessage;
  try {
    payload = JSON.parse(event.data);
  } catch {
    return;
  }
  for (const listener of listeners) listener(payload);
}

function handleOpen(): void {
  reconnectDelay = MIN_RECONNECT_DELAY_MS;
}

function handleError(): void {
  source?.close();
  source = null;
  if (listeners.size === 0) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
}

function connect(): void {
  source = new EventSource(apiUrl('/api/activity/stream'));
  source.onmessage = handleMessage;
  source.onopen = handleOpen;
  source.onerror = handleError;
}

export function subscribeToActivityStream(listener: ActivityListener): () => void {
  listeners.add(listener);
  if (!source && !reconnectTimer) connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (source) {
      source.close();
      source = null;
    }
  };
}
