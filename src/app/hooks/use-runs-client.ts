import type { AgentTaskState } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';
import { fetchAgentStatus, launchAgent, stopAgent } from '../services/agent-api';
import { apiUrl } from '../services/api-base';

const ACTIVE_STATUSES: AgentTaskState['status'][] = ['starting', 'running', 'stopping'];
const RECENT_OUTCOME_COUNT = 3;

export interface RunsClientState {
  activeTask: AgentTaskState | undefined;
  recentTasks: AgentTaskState[];
  stopping: boolean;
  launching: boolean;
  onStop: () => Promise<void>;
  onRunNextPhase: (planId: string, phaseIndex: number) => Promise<void>;
}

export function useRunsClient(): RunsClientState {
  const [tasks, setTasks] = useState<AgentTaskState[]>([]);
  const [stopping, setStopping] = useState(false);
  const [launching, setLaunching] = useState(false);

  const load = useCallback(async () => {
    try {
      setTasks(await fetchAgentStatus());
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const source = new EventSource(apiUrl('/api/activity/stream'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.onmessage = (event) => {
      let payload: { type?: string };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.type !== 'agent') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 120);
    };
    return () => {
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [load]);

  const activeTask = tasks.find((task) => ACTIVE_STATUSES.includes(task.status));
  const recentTasks = tasks
    .filter(
      (task) => task.id !== activeTask?.id && (task.status === 'done' || task.status === 'error'),
    )
    .slice(0, RECENT_OUTCOME_COUNT);

  const onStop = useCallback(async () => {
    if (!activeTask || stopping) return;
    setStopping(true);
    try {
      await stopAgent(activeTask.id);
      await load();
    } finally {
      setStopping(false);
    }
  }, [activeTask, stopping, load]);

  const onRunNextPhase = useCallback(
    async (planId: string, phaseIndex: number) => {
      if (launching) return;
      setLaunching(true);
      try {
        await launchAgent(planId, phaseIndex);
        await load();
      } finally {
        setLaunching(false);
      }
    },
    [launching, load],
  );

  return { activeTask, recentTasks, stopping, launching, onStop, onRunNextPhase };
}
