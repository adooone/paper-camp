import { appendFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseTaskLog } from '@/core/parse';
import type {
  AgentId,
  PhaseRunRecord,
  RateLimitSnapshot,
  RunUsage,
  TaskKind,
  TaskLogEntry,
} from '@/types/index';
import { campFile, readMaybe, taskLogFile } from './helpers';

const RETENTION_DAYS = 3;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Serialized: rewriting tasks.log is read-modify-write, so concurrent completions would drop
// each other. Also covers each completion's output-write + row-append, so a prune never sees one without the other.
let taskChain: Promise<unknown> = Promise.resolve();

// Drops runs past the retention window — rows and their output files, so no row outlives
// its log. Best-effort: a failed prune never fails a task.
async function pruneExpiredTasks(root: string): Promise<void> {
  const path = campFile(root, 'tasks.log');
  const raw = await readMaybe(path);
  if (!raw) return;
  const entries = parseTaskLog(raw);
  const cutoff = Date.now() - RETENTION_MS;
  const kept = entries.filter((e) => {
    const ended = Date.parse(e.endedAt);
    return Number.isNaN(ended) || ended >= cutoff;
  });
  if (kept.length === entries.length) return;

  await writeFile(path, kept.map((e) => `${JSON.stringify(e)}\n`).join(''), 'utf-8');

  // Sweep by what survived, so files orphaned by an earlier prune are collected too.
  const keptIds = new Set(kept.map((e) => e.id));
  const dir = dirname(taskLogFile(root, 'x'));
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return;
  }
  await Promise.all(
    files
      .filter((f) => f.endsWith('.log') && !keptIds.has(f.slice(0, -4)))
      .map((f) => rm(join(dir, f), { force: true }).catch(() => {})),
  );
}

interface CompletedTask {
  id: string;
  taskKind: TaskKind;
  planId?: string;
  planTitle: string;
  agentId: AgentId;
  startedAt: string;
  lines: string[];
  errorReason?: string;
  runUsage?: RunUsage;
  phaseRuns?: PhaseRunRecord[];
  rateLimit?: RateLimitSnapshot;
  issueId?: string;
}

// Read-only helper runs (commit-message suggestion, capture-time overlap check) produce no
// lasting artifact — recording them would just dirty the tracked tasks.log on every use.
export const UNLOGGED_TASK_KINDS = new Set<TaskKind>(['commit-suggest', 'overlap-check']);

// Best-effort: a log write failure must never take down the task it's recording.
export function logTaskCompletion(
  root: string,
  task: CompletedTask,
  outcome: 'done' | 'error' | 'superseded',
): Promise<void> {
  if (UNLOGGED_TASK_KINDS.has(task.taskKind)) return Promise.resolve();
  const run = taskChain.then(async () => {
    const entry: TaskLogEntry = {
      id: task.id,
      taskKind: task.taskKind,
      planId: task.planId,
      planTitle: task.planTitle,
      agentId: task.agentId,
      startedAt: task.startedAt,
      endedAt: new Date().toISOString(),
      outcome,
      ...(task.errorReason ? { reason: task.errorReason } : {}),
      ...(task.runUsage ? { usage: task.runUsage } : {}),
      ...(task.phaseRuns?.length ? { phaseRuns: task.phaseRuns } : {}),
      ...(task.rateLimit ? { rateLimit: task.rateLimit } : {}),
      ...(task.issueId ? { issueId: task.issueId } : {}),
    };
    // Output file before the row: a visible row with no output file reads as "No output recorded".
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
    await pruneExpiredTasks(root).catch((err) => {
      console.error('papercamp: could not prune expired task logs:', err);
    });
  });
  taskChain = run.catch(() => undefined);
  return run;
}
