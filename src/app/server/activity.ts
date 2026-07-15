import { watch } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { invalidateCorpusCache } from './corpus-cache';

/**
 * Live-refresh notifier over SSE. Watches the whole papercamp/ directory and
 * pushes a tick whenever anything under it changes, so connected dashboards
 * refetch.
 *
 * It deliberately does NOT synthesize a human-readable activity feed: the only
 * consumer (stack-panel.tsx) ignores the event payload and treats every tick as
 * a generic "something changed, reload everything" signal. Watching the
 * directory recursively covers the per-file `plans/` and `ideas/` trees (incl.
 * `plans/archive/`) as well as the monolithic `decisions.md`,
 * `open-questions.md`, and `progress.md` — replacing the old hardcoded list that
 * still pointed at the removed legacy `plans.md`.
 */
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
    // Debounced so a burst of writes (e.g. a plan file plus its regenerated
    // index.md) collapses into a single refresh tick. The /api/plans and
    // /api/ideas corpus cache (corpus-cache.ts) is invalidated on every raw
    // event, not just the debounced tick, so a read racing a write never sees
    // stale entries.
    watch(join(root, 'papercamp'), { recursive: true }, () => {
      invalidateCorpusCache();
      if (timer) clearTimeout(timer);
      timer = setTimeout(broadcast, 300);
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
