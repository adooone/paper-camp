import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPlanDraftPrompt } from '@/app/features/plans/prompts';
import { useEntity } from '@/app/hooks/use-entity';
import { fetchPlans, patchEntity } from '@/app/services/content';
import { entityQueryKey, worklistQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { useAppStore } from '@/app/stores/app-store';
import {
  firstOpenPhase,
  type IdeaTasks,
  ideaTasks,
  walkEndMessage,
  walkIndex,
  walkTaskFor,
} from '@/app/stores/plan-walk';
import type { EntityDetailEntry, PlanStatus, TaskKind } from '@/types/index';
import { tailOf } from '../shell/idea-model';
import { useAgentStatusStream } from './use-agent-status-stream';

export type IdeaLoad = 'loading' | 'failed' | 'ready';

export interface IdeaScreenState {
  load: IdeaLoad;
  idea: EntityDetailEntry | null;
  placeholder: boolean;
  tasks: IdeaTasks;
  activeIndex: number | null;
  liveKind: TaskKind | null;
  tail: string[];
  walk: { index: number } | null;
  error: string | null;
  busy: string | null;
  transitionBusy: PlanStatus | null;
  locked: boolean;
  runNext: () => void;
  runAll: () => void;
  draft: () => void;
  stop: () => void;
  transition: (target: PlanStatus) => void;
}

const failure = (cause: unknown): string =>
  cause instanceof Error ? cause.message : 'Action failed.';

export function useIdeaScreen(ideaId: string): IdeaScreenState {
  useAgentStatusStream();
  const { runtimeUrl } = useRuntimeConnection();
  const queryClient = useQueryClient();
  const entity = useEntity(ideaId);
  const agentStatus = useAppStore((state) => state.agentStatus);
  const loadAgentStatus = useAppStore((state) => state.loadAgentStatus);
  const launchAgent = useAppStore((state) => state.launchAgent);
  const launchRunAll = useAppStore((state) => state.launchRunAll);
  const launchPlanDraft = useAppStore((state) => state.launchPlanDraft);
  const stopAgent = useAppStore((state) => state.stopAgent);
  const [busy, setBusy] = useState<string | null>(null);
  const [transitionBusy, setTransitionBusy] = useState<PlanStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const sawWalk = useRef(false);

  const idea = entity.data ?? null;
  const placeholder = entity.isPlaceholderData;
  const phases = idea?.phases ?? [];
  const tasks = useMemo(() => ideaTasks(agentStatus, ideaId), [agentStatus, ideaId]);
  const walkTask = walkTaskFor(tasks.running, ideaId);
  if (walkTask) sawWalk.current = true;
  const walk = walkIndex(walkTask, starting, phases);
  const activeIndex = tasks.running?.phaseIndex ?? null;
  const liveKind = tasks.running && activeIndex == null ? tasks.running.taskKind : null;

  const reload = useCallback(async () => {
    await Promise.all([
      loadAgentStatus(),
      queryClient.invalidateQueries({ queryKey: entityQueryKey(runtimeUrl, ideaId) }),
      queryClient.invalidateQueries({ queryKey: worklistQueryKey(runtimeUrl) }),
    ]);
  }, [loadAgentStatus, queryClient, runtimeUrl, ideaId]);

  const endMessage = tasks.ended ? walkEndMessage(tasks.ended) : null;
  useEffect(() => {
    if (sawWalk.current && endMessage) setError(endMessage);
  }, [endMessage]);

  const runningId = tasks.running?.id ?? null;
  const previousRunningId = useRef(runningId);
  useEffect(() => {
    if (previousRunningId.current !== null && runningId !== previousRunningId.current) {
      void reload();
    }
    previousRunningId.current = runningId;
  }, [runningId, reload]);

  const attempt = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setBusy(key);
      setError(null);
      try {
        await action();
        await reload();
      } catch (cause) {
        setError(failure(cause));
      } finally {
        setBusy(null);
      }
    },
    [reload],
  );

  const runNext = useCallback(() => {
    const index = firstOpenPhase(phases);
    if (index < 0) {
      setError('Every phase is already done.');
      return;
    }
    void attempt('run-next', () => launchAgent(ideaId, index));
  }, [attempt, launchAgent, ideaId, phases]);

  const runAll = useCallback(() => {
    if (firstOpenPhase(phases) < 0) {
      setError('Every phase is already done.');
      return;
    }
    setStarting(true);
    setError(null);
    launchRunAll(ideaId)
      .then(reload)
      .catch((cause) => setError(`Run all could not start: ${failure(cause)}`))
      .finally(() => setStarting(false));
  }, [launchRunAll, ideaId, phases, reload]);

  const draft = useCallback(() => {
    if (!idea) return;
    void attempt('draft', async () => {
      const others = await fetchPlans()
        .then((result) => result.entries)
        .catch(() => []);
      const prompt = buildPlanDraftPrompt(
        { id: ideaId, title: idea.title, body: idea.body },
        others,
      );
      await launchPlanDraft(ideaId, prompt);
    });
  }, [attempt, idea, ideaId, launchPlanDraft]);

  const stop = useCallback(() => {
    const taskId = walkTask?.id ?? tasks.running?.id;
    if (!taskId) return;
    stopAgent(taskId)
      .then(reload)
      .catch((cause) => setError(failure(cause)));
  }, [stopAgent, walkTask, tasks.running, reload]);

  const transition = useCallback(
    (target: PlanStatus) => {
      setTransitionBusy(target);
      setError(null);
      patchEntity(ideaId, { status: target })
        .then(reload)
        .catch((cause) => setError(failure(cause)))
        .finally(() => setTransitionBusy(null));
    },
    [ideaId, reload],
  );

  const load: IdeaLoad = idea ? 'ready' : entity.isError ? 'failed' : 'loading';

  return {
    load,
    idea,
    placeholder,
    tasks,
    activeIndex,
    liveKind,
    tail: tailOf(tasks.running),
    walk,
    error,
    busy,
    transitionBusy,
    locked: walk !== null || tasks.running !== null,
    runNext,
    runAll,
    draft,
    stop,
    transition,
  };
}
