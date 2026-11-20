import type { AgentTaskState } from '@/types/index';

export interface WalkPhase {
  done?: boolean;
}

export interface IdeaTasks {
  running: AgentTaskState | null;
  ended: AgentTaskState | null;
}

const LIVE: AgentTaskState['status'][] = ['starting', 'running', 'stopping'];

export const isLiveTask = (task: AgentTaskState): boolean => LIVE.includes(task.status);

export const taskEntityId = (task: AgentTaskState): string | undefined =>
  task.planId ?? task.ideaId;

export function ideaTasks(tasks: AgentTaskState[], ideaId: string): IdeaTasks {
  const forIdea = tasks.filter((task) => taskEntityId(task) === ideaId);
  const ended =
    forIdea
      .filter((task) => task.status === 'done' || task.status === 'error')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
  return { running: forIdea.find(isLiveTask) ?? null, ended };
}

export const firstOpenPhase = (phases: WalkPhase[]): number =>
  phases.findIndex((phase) => !phase.done);

export function walkTaskFor(running: AgentTaskState | null, ideaId: string): AgentTaskState | null {
  return running && running.taskKind === 'run-all' && running.planId === ideaId ? running : null;
}

export function walkIndex(
  walkTask: AgentTaskState | null,
  starting: boolean,
  phases: WalkPhase[],
): { index: number } | null {
  const firstUnchecked = Math.max(0, firstOpenPhase(phases));
  if (walkTask) return { index: walkTask.phaseIndex ?? firstUnchecked };
  return starting ? { index: firstUnchecked } : null;
}

export function walkEndMessage(ended: AgentTaskState): string | null {
  if (ended.taskKind !== 'run-all' || ended.status !== 'error') return null;
  return ended.errorKind === 'question'
    ? 'Run all parked a question — answer it to continue.'
    : 'Run all stopped on a failed phase.';
}
