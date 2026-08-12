import { apiUrl } from './api-base';

export type ActivityMessage = { message?: string; type?: string };
export type ActivityListener = (payload: ActivityMessage) => void;

let source: EventSource | null = null;
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

export function subscribeToActivityStream(listener: ActivityListener): () => void {
  listeners.add(listener);
  if (!source) {
    source = new EventSource(apiUrl('/api/activity/stream'));
    source.onmessage = handleMessage;
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && source) {
      source.close();
      source = null;
    }
  };
}
