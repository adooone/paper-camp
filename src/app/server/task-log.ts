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
export async function logTaskCompletion(
  root: string,
  task: CompletedTask,
  outcome: 'done' | 'error',
): Promise<void> {
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
  // Output file first: appending to tasks.log is what makes the row visible, and a
  // row whose output file does not exist yet reads as "No output recorded" — which
  // the client then caches. Writing in this order means a visible row always has
  // its output behind it.
  const file = taskLogFile(root, task.id);
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, task.lines.join('\n'), 'utf-8');
  } catch (err) {
    console.error(`papercamp: could not write task output for ${task.id}:`, err);
    return;
  }
  await appendFile(campFile(root, 'tasks.log'), `${JSON.stringify(entry)}\n`, 'utf-8').catch(
    (err) => {
      console.error(`papercamp: could not append task ${task.id} to tasks.log:`, err);
    },
  );
}
