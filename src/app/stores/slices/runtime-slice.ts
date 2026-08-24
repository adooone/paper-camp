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

export function createRuntimeSlice(set: SetState): RuntimeSlice {
  return {
    runtimeReachable: !hasDetachedRuntime,
    runtimeChecking: hasDetachedRuntime,
    checkRuntimeReachable: loadSlice(
      set,
      async () => {
        if (!hasDetachedRuntime) return true;
        const response = await fetch(apiUrl('/api/package-name'));
        return response.ok;
      },
      (reachable) => ({ runtimeReachable: reachable }),
      () => ({ runtimeReachable: false }),
      'runtimeChecking',
    ),
  };
}
