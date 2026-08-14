import { watch } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { resolvePrsByEntity } from '@/core/git-pr';
import { readWorkEntries } from '@/core/readers';
import type { AgentManager } from './agent';
import { invalidateCorpusCache } from './corpus-cache';
import type { GitManager } from './git';
import { triggerPrReviews } from './pr-review-trigger';
import { runRunOrderPass } from './run-order-pass';

// Consumers route on `payload.type`; a bare `changed` message is the generic
// "something on disk moved, reload broadly" signal.
export type ActivityManager = ReturnType<typeof createActivityManager>;

// A PR merging on GitHub touches nothing on disk, so the fs watcher below never fires for it.
const PR_POLL_INTERVAL_MS = 60_000;

export function createActivityManager(
  root: string,
  git: Pick<GitManager, 'getCurrentBranch'>,
  agent: Pick<AgentManager, 'startPrReview'>,
) {
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

  // Only shells out to `gh` when there's something worth watching — an idle repo
  // with no plan awaiting review never pays for a poll.
  async function pollOpenPrs() {
    try {
      const { entries } = await readWorkEntries(join(root, 'papercamp', 'ideas'));
      const watched = entries.filter((e) => e.status === 'review');
      if (watched.length === 0) return;

      const fresh = await resolvePrsByEntity(root, 0);
      if (!fresh) return;

      const changed = watched.some((e) => fresh.get(e.id ?? '')?.state !== e.pr?.state);
      if (changed) {
        invalidateCorpusCache();
        scheduleRunPass();
      }

      await triggerPrReviews(root, git, agent, watched, fresh);
    } catch (err) {
      console.error('PR poll failed:', err);
    }
  }
  // Boot sweep, then the recurring 60s poll — a restart must not wait a full
  // interval to catch a PR that went ready+green while paper-camp was down.
  void pollOpenPrs();
  setInterval(pollOpenPrs, PR_POLL_INTERVAL_MS);

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
