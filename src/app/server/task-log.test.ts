import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { logTaskCompletion } from './task-log';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-tasklog-'));
  mkdirSync(join(root, 'papercamp', '.task-logs'), { recursive: true });
  return root;
}

function entry(id: string, endedAt: string) {
  return JSON.stringify({
    id,
    taskKind: 'phase',
    planTitle: 'Old run',
    agentId: 'claude-code',
    startedAt: endedAt,
    endedAt,
    outcome: 'done',
  });
}

function seed(root: string, rows: { id: string; daysAgo: number }[]): void {
  const lines = rows.map((r) =>
    entry(r.id, new Date(Date.now() - r.daysAgo * DAY_MS).toISOString()),
  );
  writeFileSync(join(root, 'papercamp', 'tasks.log'), `${lines.join('\n')}\n`, 'utf-8');
  for (const r of rows) {
    writeFileSync(join(root, 'papercamp', '.task-logs', `${r.id}.log`), 'output', 'utf-8');
  }
}

const ids = (root: string) =>
  readFileSync(join(root, 'papercamp', 'tasks.log'), 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l).id as string);

const completed = (id: string) => ({
  id,
  taskKind: 'phase' as const,
  planTitle: 'New run',
  agentId: 'claude-code' as const,
  startedAt: new Date().toISOString(),
  lines: ['line one'],
});

describe('logTaskCompletion retention', () => {
  it('drops runs older than the retention window and keeps recent ones', async () => {
    const root = makeRoot();
    seed(root, [
      { id: 'aaaaaaaa-0000-0000-0000-000000000001', daysAgo: 10 },
      { id: 'aaaaaaaa-0000-0000-0000-000000000002', daysAgo: 4 },
      { id: 'bbbbbbbb-0000-0000-0000-000000000003', daysAgo: 1 },
    ]);

    await logTaskCompletion(root, completed('cccccccc-0000-0000-0000-000000000004'), 'done');

    expect(ids(root)).toEqual([
      'bbbbbbbb-0000-0000-0000-000000000003',
      'cccccccc-0000-0000-0000-000000000004',
    ]);
  });

  it('deletes the output files of dropped runs so no row outlives its log', async () => {
    const root = makeRoot();
    seed(root, [
      { id: 'aaaaaaaa-0000-0000-0000-000000000001', daysAgo: 10 },
      { id: 'bbbbbbbb-0000-0000-0000-000000000003', daysAgo: 1 },
    ]);

    await logTaskCompletion(root, completed('cccccccc-0000-0000-0000-000000000004'), 'done');

    const files = readdirSync(join(root, 'papercamp', '.task-logs')).sort();
    expect(files).toEqual([
      'bbbbbbbb-0000-0000-0000-000000000003.log',
      'cccccccc-0000-0000-0000-000000000004.log',
    ]);
  });

  it('keeps the just-written run and its output', async () => {
    const root = makeRoot();
    seed(root, [{ id: 'aaaaaaaa-0000-0000-0000-000000000001', daysAgo: 30 }]);

    const id = 'dddddddd-0000-0000-0000-000000000005';
    await logTaskCompletion(root, completed(id), 'error');

    expect(ids(root)).toEqual([id]);
    expect(readFileSync(join(root, 'papercamp', '.task-logs', `${id}.log`), 'utf-8')).toBe(
      'line one',
    );
  });
});
