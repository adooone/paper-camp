import type { ServerResponse } from 'node:http';
import { invalidateCorpus } from '@/core/corpus';
import { runRunOrderPass } from './run-order-pass';

// Consumers route on `payload.type`; a bare `changed` message is the generic
// "something on disk moved, reload broadly" signal.
export type ActivityManager = ReturnType<typeof createActivityManager>;

export interface ActivityManagerState {
  clients: Set<ServerResponse>;
}

export function createEmptyActivityState(): ActivityManagerState {
  return { clients: new Set() };
}

const HEARTBEAT_INTERVAL_MS = 25_000;

export function createActivityManager(
  root: string,
  state: ActivityManagerState = createEmptyActivityState(),
) {
  const { clients } = state;
  let runPassTimer: ReturnType<typeof setTimeout> | null = null;
  let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let rerunQueued = false;

  function writeToClients(payload: Record<string, unknown>) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients) {
      try {
        client.write(data);
      } catch {
        clients.delete(client);
      }
    }
  }

  function broadcast() {
    writeToClients({
      message: 'changed',
      timestamp: new Date().toISOString(),
      type: 'activity',
    });
  }

  function scheduleBroadcast() {
    if (broadcastTimer) clearTimeout(broadcastTimer);
    broadcastTimer = setTimeout(() => {
      broadcastTimer = null;
      broadcast();
    }, 100);
  }

  // Serializes passes: an event arriving while one is in flight queues a rerun
  // instead of starting a second read/write cycle against a stale snapshot.
  function runPass() {
    if (inFlight) {
      rerunQueued = true;
      return;
    }
    inFlight = runRunOrderPass(root)
      .then((changed) => {
        if (changed.length > 0) broadcast();
      })
      .catch((err) => {
        console.error('run-order pass failed:', err);
      })
      .finally(() => {
        inFlight = null;
        if (rerunQueued) {
          rerunQueued = false;
          scheduleRunPass();
        }
      });
  }

  function scheduleRunPass() {
    if (runPassTimer) clearTimeout(runPassTimer);
    runPassTimer = setTimeout(() => {
      runPassTimer = null;
      runPass();
    }, 300);
  }

  return {
    // Called by every write path in place of a papercamp/ watcher — the daemon
    // knows its own writes, so it invalidates and re-broadcasts right there.
    notifyChanged() {
      invalidateCorpus(root);
      scheduleBroadcast();
      scheduleRunPass();
    },
    publish(payload: { type: string } & Record<string, unknown>) {
      writeToClients(payload);
    },
    // Handed to a hot-reloaded replacement instance so both share this exact
    // clients set instead of the new instance starting deaf.
    getState: (): ActivityManagerState => state,
    subscribe(res: ServerResponse) {
      clients.add(res);
      const hello = JSON.stringify({
        message: 'changed',
        type: 'activity',
        timestamp: new Date().toISOString(),
      });
      res.write(`data: ${hello}\n\n`);
      // Redialled proxies (cloudflared, tailscale serve) drop idle connections
      // silently; the ping keeps this one alive without the browser ever seeing it.
      const heartbeat = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          clients.delete(res);
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);
      heartbeat.unref?.();
      res.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(res);
      });
    },
  };
}
