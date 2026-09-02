import type { ServerResponse } from 'node:http';
import { invalidateCorpusCache } from './corpus-cache';
import { runRunOrderPass } from './run-order-pass';

// Consumers route on `payload.type`; a bare `changed` message is the generic
// "something on disk moved, reload broadly" signal.
export type ActivityManager = ReturnType<typeof createActivityManager>;

export function createActivityManager(root: string) {
  const clients = new Set<ServerResponse>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let rerunQueued = false;

  function broadcast() {
    const data = `data: ${JSON.stringify({
      message: 'changed',
      timestamp: new Date().toISOString(),
      type: 'activity',
    })}\n\n`;
    for (const client of clients) {
      try {
        client.write(data);
      } catch {
        clients.delete(client);
      }
    }
  }

  // Serializes passes: an event arriving while one is in flight queues a rerun
  // instead of starting a second read/write cycle against a stale snapshot.
  function runPass() {
    if (inFlight) {
      rerunQueued = true;
      return;
    }
    inFlight = runRunOrderPass(root)
      .then(() => {
        broadcast();
      })
      .catch((err) => {
        console.error('run-order pass failed:', err);
        rerunQueued = true;
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
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      runPass();
    }, 300);
  }

  return {
    // Called by every write path in place of a papercamp/ watcher — the daemon
    // knows its own writes, so it invalidates and re-broadcasts right there.
    notifyChanged() {
      invalidateCorpusCache();
      scheduleRunPass();
    },
    subscribe(res: ServerResponse) {
      clients.add(res);
      const connected = JSON.stringify({
        message: 'Watching for changes…',
        timestamp: new Date().toISOString(),
      });
      res.write(`data: ${connected}\n\n`);
      res.on('close', () => clients.delete(res));
    },
  };
}
