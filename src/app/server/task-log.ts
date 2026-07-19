import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AgentId, TaskKind, TaskLogEntry } from '@/types/index';
import { campFile, taskLogFile } from './helpers';

interface CompletedTask {
  id: string;
  taskKind: TaskKind;
  planId?: string;
  planTitle: string;
  agentId: AgentId;
  startedAt: string;
  lines: string[];
}

// Best-effort: a log write failure must never take down the task it's recording.
export function logTaskCompletion(
  root: string,
  task: CompletedTask,
  outcome: 'done' | 'error',
): void {
  const entry: TaskLogEntry = {
    id: task.id,
    taskKind: task.taskKind,
    planId: task.planId,
    planTitle: task.planTitle,
    agentId: task.agentId,
    startedAt: task.startedAt,
    endedAt: new Date().toISOString(),
    outcome,
  };
  appendFile(campFile(root, 'tasks.log'), `${JSON.stringify(entry)}\n`, 'utf-8').catch(() => {});
  const file = taskLogFile(root, task.id);
  mkdir(dirname(file), { recursive: true })
    .then(() => writeFile(file, task.lines.join('\n'), 'utf-8'))
    .catch(() => {});
}
