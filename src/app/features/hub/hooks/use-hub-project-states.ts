import type { MachineReachState, ProjectRunState } from '@/app/services/hub-machines';
import {
  fetchAgentStatusAt,
  fetchPackageNameAt,
  fetchRuntimeVersionAt,
} from '@/app/services/system';
import type { AgentTaskState, AgentTaskStatus } from '@/types/index';
import { useEffect, useRef, useState } from 'react';

export interface ProjectLiveState {
  reach: MachineReachState;
  packageName: string | null;
  remoteVersion: string | null;
  runState: ProjectRunState;
}

const LOADING: ProjectLiveState = {
  reach: 'loading',
  packageName: null,
  remoteVersion: null,
  runState: { missing: false, running: false, runningIdeaId: null, interruptedCount: 0 },
};

const ACTIVE_TASK_STATUSES: AgentTaskStatus[] = ['starting', 'running', 'stopping'];
const STATUS_POLL_MS = 5_000;
/** `waiting` is a request still open past the point a healthy one answers — on
 * Chrome that is the local-network permission prompt the page cannot see. */
const WAITING_AFTER_MS = 4_000;

function activeTask(tasks: AgentTaskState[] | null): AgentTaskState | null {
  return tasks?.find((task) => ACTIVE_TASK_STATUSES.includes(task.status)) ?? null;
}

async function fetchOne(runtimeUrl: string): Promise<ProjectLiveState> {
  const [packageName, remoteVersion, tasks] = await Promise.all([
    fetchPackageNameAt(runtimeUrl),
    fetchRuntimeVersionAt(runtimeUrl),
    fetchAgentStatusAt(runtimeUrl),
  ]);
  if (remoteVersion === null) return { ...LOADING, reach: 'unreachable' };
  const task = activeTask(tasks);
  return {
    reach: 'ready',
    packageName,
    remoteVersion,
    runState: {
      missing: false,
      running: task !== null,
      runningIdeaId: task?.ideaId ?? null,
      interruptedCount: 0,
    },
  };
}

/** Polls every chosen project's own runtime for its package name, version, and
 * whether an agent task is in flight — a solo project (dialled directly, with
 * no daemon of its own) reads its `reach` from here; a daemon-served one is
 * covered by the machine's own report instead. */
export function useHubProjectStates(runtimeUrls: string[]): Record<string, ProjectLiveState> {
  const [states, setStates] = useState<Record<string, ProjectLiveState>>({});
  const mounted = useRef(true);
  const urls = runtimeUrls.join('\n');

  useEffect(() => {
    mounted.current = true;
    const list = urls === '' ? [] : urls.split('\n');

    const pollOnce = () => {
      for (const url of list) {
        fetchOne(url).then((result) => {
          if (mounted.current) setStates((current) => ({ ...current, [url]: result }));
        });
      }
    };

    for (const url of list) {
      setStates((current) => ({ ...current, [url]: current[url] ?? LOADING }));
      const slow = setTimeout(() => {
        if (!mounted.current) return;
        setStates((current) =>
          current[url]?.reach === 'loading'
            ? { ...current, [url]: { ...current[url], reach: 'waiting' } }
            : current,
        );
      }, WAITING_AFTER_MS);
      fetchOne(url).then((result) => {
        clearTimeout(slow);
        if (mounted.current) setStates((current) => ({ ...current, [url]: result }));
      });
    }

    const timer = list.length === 0 ? undefined : setInterval(pollOnce, STATUS_POLL_MS);
    return () => {
      mounted.current = false;
      if (timer) clearInterval(timer);
    };
  }, [urls]);

  return states;
}
