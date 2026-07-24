import { watch } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { invalidateCorpusCache } from './corpus-cache';
import { runRunOrderPass } from './run-order-pass';

// The only consumer (stack-panel.tsx) ignores the event payload and treats every
// tick as a generic "something changed, reload everything" signal.
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

  try {
    // Cache invalidation runs on every raw event, not just the debounced broadcast,
    // so a read racing a write never sees stale entries.
    watch(join(root, 'papercamp'), { recursive: true }, () => {
      invalidateCorpusCache();
      scheduleRunPass();
    });
  } catch {
    // papercamp/ doesn't exist yet (uninitialized project) — nothing to watch.
  }

  return {
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
