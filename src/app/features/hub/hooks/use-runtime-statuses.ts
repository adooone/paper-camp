import type { RuntimeConnection } from '@/app/services/runtime-connection';
import {
  fetchAgentStatusAt,
  fetchPackageNameAt,
  fetchRuntimeVersionAt,
  projectDisplayName,
} from '@/app/services/system';
import { CLIENT_VERSION } from '@/app/services/version';
import { canReachRuntime } from '@/core/runtime-reachability';
import type { AgentTaskState, AgentTaskStatus } from '@/types/index';
import { useEffect, useState } from 'react';

export interface RuntimeStatus {
  name: string | null;
  reachable: boolean;
  remoteVersion: string | null;
  versionSkew: boolean;
  schemeBlocked: boolean;
  runningPlanTitle: string | null;
}

const UNREACHABLE: Omit<RuntimeStatus, 'schemeBlocked'> = {
  name: null,
  reachable: false,
  remoteVersion: null,
  versionSkew: false,
  runningPlanTitle: null,
};

const ACTIVE_TASK_STATUSES: AgentTaskStatus[] = ['starting', 'running', 'stopping'];

function activePlanTitle(tasks: AgentTaskState[] | null): string | null {
  return tasks?.find((task) => ACTIVE_TASK_STATUSES.includes(task.status))?.planTitle ?? null;
}

const STATUS_POLL_MS = 5_000;

/** Asks each registered runtime what project it serves, what version it's on, and
 *  whether it has a task in flight, in parallel, on the same poll cadence. A runtime
 *  that is down, or that refuses this origin, has no response to any of these —
 *  reported as unreachable (shown as offline) rather than the list waiting on it or a
 *  row silently vanishing. `schemeBlocked` flags the one case that needs no round trip
 *  to know: an http runtime this page's https origin refuses outright as mixed content. */
export function useRuntimeStatuses(runtimes: RuntimeConnection[]): Record<string, RuntimeStatus> {
  const [statuses, setStatuses] = useState<Record<string, RuntimeStatus>>({});
  const urls = runtimes.map((runtime) => runtime.runtimeUrl).join('\n');

  useEffect(() => {
    let cancelled = false;
    const list = urls === '' ? [] : urls.split('\n');

    const poll = () => {
      Promise.all(
        list.map(async (url) => {
          const schemeBlocked = !canReachRuntime(window.location.origin, url);
          const [name, remoteVersion, tasks] = await Promise.all([
            fetchPackageNameAt(url),
            fetchRuntimeVersionAt(url),
            fetchAgentStatusAt(url),
          ]);
          const status: RuntimeStatus =
            remoteVersion === null
              ? { ...UNREACHABLE, schemeBlocked }
              : {
                  name: name ? projectDisplayName(name) : null,
                  reachable: true,
                  remoteVersion,
                  versionSkew: remoteVersion !== CLIENT_VERSION,
                  schemeBlocked,
                  runningPlanTitle: activePlanTitle(tasks),
                };
          return [url, status] as const;
        }),
      ).then((resolved) => {
        if (cancelled) return;
        setStatuses(Object.fromEntries(resolved));
      });
    };

    poll();
    const timer = list.length === 0 ? undefined : setInterval(poll, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [urls]);

  return statuses;
}
