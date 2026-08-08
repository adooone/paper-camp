import { spawn } from 'node:child_process';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  CapacityStat,
  CommentStats,
  EntityEntry,
  EntityStatus,
  IdeaCost,
  ProjectStats,
  RunUsage,
  TaskLogEntry,
  TasksPerWeek,
  UsagePerWeek,
} from '../types/index';
import { parseTaskLog } from './parse';
import { readEntitiesWithDerivedStatus } from './readers';

async function walk(dir: string): Promise<string[]> {
  const names = await readdir(dir).catch(() => []);
  const files: string[] = [];
  for (const name of names) {
    const path = join(dir, name);
    const info = await lstat(path).catch(() => null);
    if (!info) continue;
    if (info.isDirectory()) files.push(...(await walk(path)));
    else if (info.isFile()) files.push(path);
  }
  return files;
}

async function countTestLines(root: string): Promise<number> {
  const files = (await walk(join(root, 'src'))).filter((f) => /\.test\.tsx?$/.test(f));
  let total = 0;
  for (const file of files) {
    total += (await readFile(file, 'utf-8')).split('\n').length;
  }
  return total;
}

const COMMENT_STATS_TIMEOUT_MS = 10_000;
const ZERO_COMMENT_STATS: CommentStats = { commentLines: 0, sourceLines: 0, ratio: 0 };

// comment-stats.mjs already walks src/ excluding *.test.ts(x); shelling out to it
// keeps this route and the standalone script reporting the same number.
function runCommentStats(root: string): Promise<CommentStats> {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [join(root, 'scripts', 'comment-stats.mjs'), '--json'], {
      cwd: root,
      timeout: COMMENT_STATS_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.on('close', (code) => {
      if (code !== 0 || !stdout) return resolve(ZERO_COMMENT_STATS);
      try {
        const { commentLines, sourceLines, ratio } = JSON.parse(stdout);
        resolve({ commentLines, sourceLines, ratio });
      } catch {
        resolve(ZERO_COMMENT_STATS);
      }
    });
    proc.on('error', () => resolve(ZERO_COMMENT_STATS));
  });
}

async function readTestCoveragePct(root: string): Promise<number | null> {
  const raw = await readFile(join(root, 'coverage', 'coverage-summary.json'), 'utf-8').catch(
    () => null,
  );
  if (!raw) return null;
  try {
    const { total } = JSON.parse(raw);
    return total?.lines?.pct ?? null;
  } catch {
    return null;
  }
}

export function countEntitiesByStatus(
  entities: EntityEntry[],
): Partial<Record<EntityStatus, number>> {
  const counts: Partial<Record<EntityStatus, number>> = {};
  for (const { status } of entities) {
    if (!status) continue;
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

export function countThreadNotes(entities: EntityEntry[]): {
  openQuestions: number;
  decisions: number;
} {
  let openQuestions = 0;
  let decisions = 0;
  for (const { thread = [] } of entities) {
    for (const message of thread) {
      if (message.kind === 'question' && (message.state ?? 'open') === 'open') openQuestions++;
      if (message.kind === 'decision') decisions++;
    }
  }
  return { openQuestions, decisions };
}

// ISO 8601 week — ties task activity to a calendar week regardless of which
// day it started on. Standard "shift to the week's Thursday" algorithm: a
// year's week 1 is whichever week owns that year's first Thursday.
export function isoWeekKey(dateStr: string): string {
  const date = new Date(dateStr);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((1 + (target.getTime() - yearStart.getTime()) / 86400000) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function tasksPerWeek(entries: TaskLogEntry[]): TasksPerWeek[] {
  const counts = new Map<string, number>();
  for (const { startedAt } of entries) {
    const week = isoWeekKey(startedAt);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));
}

function entryTokens(entry: TaskLogEntry): { inputTokens: number; outputTokens: number } {
  let inputTokens = 0;
  let outputTokens = 0;
  const add = (usage: RunUsage) => {
    inputTokens += usage.inputTokens;
    outputTokens += usage.outputTokens;
  };
  if (entry.phaseRuns?.length) for (const p of entry.phaseRuns) add(p.usage);
  else if (entry.usage) add(entry.usage);
  return { inputTokens, outputTokens };
}

function taskWallClockMs(entry: TaskLogEntry): number {
  const started = Date.parse(entry.startedAt);
  const ended = Date.parse(entry.endedAt);
  if (Number.isNaN(started) || Number.isNaN(ended)) return 0;
  return Math.max(0, ended - started);
}

export function usagePerWeek(entries: TaskLogEntry[]): UsagePerWeek[] {
  const buckets = new Map<string, { agentMs: number; inputTokens: number; outputTokens: number }>();
  for (const entry of entries) {
    if (Number.isNaN(Date.parse(entry.startedAt))) continue;
    const week = isoWeekKey(entry.startedAt);
    const bucket = buckets.get(week) ?? { agentMs: 0, inputTokens: 0, outputTokens: 0 };
    const { inputTokens, outputTokens } = entryTokens(entry);
    bucket.agentMs += taskWallClockMs(entry);
    bucket.inputTokens += inputTokens;
    bucket.outputTokens += outputTokens;
    buckets.set(week, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, b]) => ({
      week,
      agentMinutes: Math.round(b.agentMs / 60000),
      inputTokens: b.inputTokens,
      outputTokens: b.outputTokens,
    }));
}

export function medianPhaseDurationMs(entries: TaskLogEntry[]): number | null {
  const durations: number[] = [];
  for (const entry of entries) {
    if (entry.phaseRuns?.length) {
      for (const p of entry.phaseRuns) if (p.kind === 'phase') durations.push(p.usage.durationMs);
    } else if (entry.taskKind === 'phase' && entry.usage) {
      durations.push(entry.usage.durationMs);
    }
  }
  if (durations.length === 0) return null;
  durations.sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  return durations.length % 2 === 0 ? (durations[mid - 1] + durations[mid]) / 2 : durations[mid];
}

export function latestCapacity(entries: TaskLogEntry[]): CapacityStat | null {
  let latest: CapacityStat | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    if (!entry.rateLimit) continue;
    const at = Date.parse(entry.endedAt);
    if (Number.isNaN(at)) continue;
    if (at >= latestMs) {
      latestMs = at;
      latest = { snapshot: entry.rateLimit, capturedAt: entry.endedAt };
    }
  }
  return latest;
}

export function mostExpensiveIdeas(entries: TaskLogEntry[], limit = 5): IdeaCost[] {
  const byId = new Map<string, IdeaCost>();
  for (const entry of entries) {
    if (!entry.planId) continue;
    const { inputTokens, outputTokens } = entryTokens(entry);
    if (inputTokens === 0 && outputTokens === 0) continue;
    const cost = byId.get(entry.planId) ?? {
      planId: entry.planId,
      planTitle: entry.planTitle,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
    };
    cost.planTitle = entry.planTitle;
    cost.inputTokens += inputTokens;
    cost.outputTokens += outputTokens;
    cost.durationMs += taskWallClockMs(entry);
    byId.set(entry.planId, cost);
  }
  return [...byId.values()]
    .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens))
    .slice(0, limit);
}

export async function computeProjectStats(root: string): Promise<ProjectStats> {
  const ideasDir = join(root, 'papercamp', 'ideas');
  const [comments, testLines, testCoveragePct, { entries }, taskLogRaw] = await Promise.all([
    runCommentStats(root),
    countTestLines(root),
    readTestCoveragePct(root),
    readEntitiesWithDerivedStatus(ideasDir),
    readFile(join(root, 'papercamp', 'tasks.log'), 'utf-8').catch(() => ''),
  ]);
  const { openQuestions, decisions } = countThreadNotes(entries);
  const taskLog = parseTaskLog(taskLogRaw);
  return {
    generatedAt: new Date().toISOString(),
    comments,
    testLines,
    testCoveragePct,
    entitiesByStatus: countEntitiesByStatus(entries),
    openQuestions,
    decisions,
    tasksPerWeek: tasksPerWeek(taskLog),
    usagePerWeek: usagePerWeek(taskLog),
    medianPhaseDurationMs: medianPhaseDurationMs(taskLog),
    mostExpensiveIdeas: mostExpensiveIdeas(taskLog),
    capacity: latestCapacity(taskLog),
  };
}
