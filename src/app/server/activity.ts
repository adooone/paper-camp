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

  try {
    // Cache invalidation runs on every raw event, not just the debounced broadcast,
    // so a read racing a write never sees stale entries.
    watch(join(root, 'papercamp'), { recursive: true }, () => {
      invalidateCorpusCache();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // Runs before the broadcast so clients that reload on the tick see the
        // corrected order rather than a stale one on the next tick.
        runRunOrderPass(root)
          .catch(() => {})
          .finally(broadcast);
      }, 300);
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
