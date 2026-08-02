import { spawnSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  CommentStats,
  EntityEntry,
  EntityStatus,
  ProjectStats,
  TaskLogEntry,
  TasksPerWeek,
} from '../types/index';
import { parseTaskLog } from './parse';
import { readEntitiesWithDerivedStatus } from './readers';

async function walk(dir: string): Promise<string[]> {
  const names = await readdir(dir).catch(() => []);
  const files: string[] = [];
  for (const name of names) {
    const path = join(dir, name);
    files.push(...((await stat(path)).isDirectory() ? await walk(path) : [path]));
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

// comment-stats.mjs already walks src/ excluding *.test.ts(x); shelling out to it
// keeps this route and the standalone script reporting the same number.
function runCommentStats(root: string): CommentStats {
  const result = spawnSync('node', [join(root, 'scripts', 'comment-stats.mjs'), '--json'], {
    cwd: root,
    encoding: 'utf-8',
  });
  if (result.status !== 0 || !result.stdout) return { commentLines: 0, sourceLines: 0, ratio: 0 };
  const { commentLines, sourceLines, ratio } = JSON.parse(result.stdout);
  return { commentLines, sourceLines, ratio };
}

async function readTestCoveragePct(root: string): Promise<number | null> {
  const raw = await readFile(join(root, 'coverage', 'coverage-summary.json'), 'utf-8').catch(
    () => null,
  );
  if (!raw) return null;
  const { total } = JSON.parse(raw);
  return total?.lines?.pct ?? null;
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

export async function computeProjectStats(root: string): Promise<ProjectStats> {
  const ideasDir = join(root, 'papercamp', 'ideas');
  const [testLines, testCoveragePct, { entries }, taskLogRaw] = await Promise.all([
    countTestLines(root),
    readTestCoveragePct(root),
    readEntitiesWithDerivedStatus(ideasDir),
    readFile(join(root, 'papercamp', 'tasks.log'), 'utf-8').catch(() => ''),
  ]);
  const { openQuestions, decisions } = countThreadNotes(entries);
  return {
    generatedAt: new Date().toISOString(),
    comments: runCommentStats(root),
    testLines,
    testCoveragePct,
    entitiesByStatus: countEntitiesByStatus(entries),
    openQuestions,
    decisions,
    tasksPerWeek: tasksPerWeek(parseTaskLog(taskLogRaw)),
  };
}
