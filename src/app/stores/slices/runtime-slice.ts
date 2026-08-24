import { apiUrl } from '@/app/services/api-base';
import { runtimeConnection } from '@/app/services/runtime-connection';
import type { SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type RuntimeSlice = {
  runtimeReachable: boolean;
  runtimeChecking: boolean;
  checkRuntimeReachable: () => Promise<void>;
};

// `paper-camp dev` serving this bundle to itself is the runtime, so there's nothing to
// probe — only a detached client pointed at a `runtime` URL needs to confirm it first.
const hasDetachedRuntime = !!runtimeConnection.runtimeUrl;

const PROBE_TIMEOUT_MS = 15_000;
const PROBE_RETRIES = 2;
const PROBE_RETRY_DELAY_MS = 1_500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A fresh --share tunnel can leave the first probe finding nothing — one miss
// shouldn't be a permanent verdict with no way for the user to prompt a retry.
export async function probeReachable(): Promise<boolean> {
  for (let attempt = 0; attempt <= PROBE_RETRIES; attempt++) {
    try {
      const response = await fetch(apiUrl('/api/package-name'), {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (response.ok) return true;
    } catch {}
    if (attempt < PROBE_RETRIES) await wait(PROBE_RETRY_DELAY_MS);
  }
  return false;
}

export function createRuntimeSlice(set: SetState): RuntimeSlice {
  return {
    runtimeReachable: !hasDetachedRuntime,
    runtimeChecking: hasDetachedRuntime,
    checkRuntimeReachable: loadSlice(
      set,
      async () => (hasDetachedRuntime ? probeReachable() : true),
      (reachable) => ({ runtimeReachable: reachable }),
      () => ({ runtimeReachable: false }),
      'runtimeChecking',
    ),
  };
}
