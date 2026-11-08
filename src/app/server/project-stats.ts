import { computeProjectStats } from '@/core/stats';
import type { ProjectStats } from '@/types/index';

const DEBOUNCE_MS = 2_000;

export interface ProjectStatsStore {
  get: () => Promise<ProjectStats>;
  schedule: () => void;
  close: () => void;
}

export function createProjectStatsStore(
  root: string,
  compute: (root: string) => Promise<ProjectStats> = computeProjectStats,
  debounceMs = DEBOUNCE_MS,
): ProjectStatsStore {
  let current: Promise<ProjectStats> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function run(): Promise<ProjectStats> {
    const pending = compute(root);
    const previous = current;
    current = pending;
    pending.catch(() => {
      if (current === pending) current = previous;
    });
    return pending;
  }

  current = null;
  run().catch(() => undefined);

  return {
    get: () => current ?? run(),
    schedule() {
      if (closed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        run().catch(() => undefined);
      }, debounceMs);
      timer.unref?.();
    },
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
