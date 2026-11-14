import { apiUrl } from '@/app/services/api-base';
import { servesOwnRuntime } from '@/app/services/hub';
import { mountPrefix } from '@/app/services/mount';
import { getRuntimeConnection } from '@/app/services/runtime-connection';
import type { SetState } from './slice-helpers';

export type RuntimeSlice = {
  runtimeReachable: boolean;
  runtimeChecking: boolean;
  runtimeSlow: boolean;
  checkRuntimeReachable: () => Promise<void>;
};

// Embedded serves itself, so there's nothing to probe; detached needs a probe to
// confirm; neither has no runtime, so it's just unreachable.
const hasEmbeddedRuntime = !!mountPrefix;

const PROBE_TIMEOUT_MS = 15_000;
const SLOW_PROBE_TIMEOUT_MS = 60_000;
const SLOW_RETRY_INTERVAL_MS = 30_000;
const PROBE_RETRIES = 2;

export type ProbeResult = 'reachable' | 'slow' | 'unreachable';
const PROBE_RETRY_DELAY_MS = 1_500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let selfServedProbe: Promise<boolean> | undefined;

// Probed once per process and shared with the boot-time hub decision in main.tsx,
// so a `paper-camp dev` origin is asked at most once.
export function probeSelfServed(): Promise<boolean> {
  if (!selfServedProbe) {
    selfServedProbe = servesOwnRuntime('', (path) => fetch(apiUrl(path)));
  }
  return selfServedProbe;
}

async function fetchPackageName(timeoutMs: number): Promise<'ok' | 'rejected' | 'timeout'> {
  try {
    const response = await fetch(apiUrl('/api/package-name'), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok ? 'ok' : 'rejected';
  } catch (error) {
    return (error as Error).name === 'TimeoutError' ? 'timeout' : 'rejected';
  }
}

// A fresh --share tunnel can leave the first probe finding nothing — one miss
// shouldn't be a permanent verdict with no way for the user to prompt a retry.
export async function probeReachable(): Promise<ProbeResult> {
  let slow = false;
  for (let attempt = 0; attempt <= PROBE_RETRIES; attempt++) {
    const outcome = await fetchPackageName(PROBE_TIMEOUT_MS);
    if (outcome === 'ok') return 'reachable';
    if (outcome === 'timeout') {
      if ((await fetchPackageName(SLOW_PROBE_TIMEOUT_MS)) === 'ok') slow = true;
      if (slow) return 'slow';
    }
    if (attempt < PROBE_RETRIES) await wait(PROBE_RETRY_DELAY_MS);
  }
  return 'unreachable';
}

export function createRuntimeSlice(set: SetState): RuntimeSlice {
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const probe = async (): Promise<ProbeResult> => {
    if (hasEmbeddedRuntime) return 'reachable';
    if (getRuntimeConnection().runtimeUrl) return probeReachable();
    return (await probeSelfServed()) ? 'reachable' : 'unreachable';
  };

  const apply = (result: ProbeResult, settled: Partial<RuntimeSlice> = {}) => {
    clearTimeout(retryTimer);
    set({ runtimeReachable: result === 'reachable', runtimeSlow: result === 'slow', ...settled });
    if (result === 'slow') {
      retryTimer = setTimeout(() => {
        probe()
          .then(apply)
          .catch(() => apply('unreachable'));
      }, SLOW_RETRY_INTERVAL_MS);
    }
  };

  return {
    runtimeReachable: hasEmbeddedRuntime,
    runtimeChecking: !hasEmbeddedRuntime,
    runtimeSlow: false,
    checkRuntimeReachable: async () => {
      set({ runtimeChecking: true });
      let result: ProbeResult;
      try {
        result = await probe();
      } catch {
        result = 'unreachable';
      }
      apply(result, { runtimeChecking: false });
    },
  };
}
