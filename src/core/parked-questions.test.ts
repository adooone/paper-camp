import { mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { EntityEntry, ThreadMessage } from '../types/index';
import { collectParkedQuestions, readParkedQuestions } from './parked-questions';
import { formatEntityFile } from './serialize/entity-file';

const entity = (overrides: Partial<EntityEntry>): EntityEntry => ({
  id: 'IDEA-1',
  title: 'Untitled',
  created: '2026-01-01',
  tags: [],
  body: '',
  phases: [],
  ...overrides,
});

const question = (overrides: Partial<ThreadMessage>): ThreadMessage => ({
  kind: 'question',
  date: '2026-01-01',
  text: 'Need a decision',
  from: 'agent',
  state: 'open',
  ...overrides,
});

const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

describe('collectParkedQuestions', () => {
  it('collects only open questions, ignoring resolved questions and other message kinds', () => {
    const entities = [
      entity({ id: 'IDEA-1', title: 'First', thread: [question({ text: 'q1' })] }),
      entity({
        id: 'IDEA-2',
        title: 'Second',
        thread: [question({ text: 'resolved', state: 'resolved' })],
      }),
      entity({
        id: 'IDEA-3',
        title: 'Third',
        thread: [{ kind: 'log', date: '2026-01-01', text: 'did stuff' }],
      }),
      entity({ id: 'IDEA-4', title: 'Fourth', thread: [] }),
      entity({ id: 'IDEA-5', title: 'Fifth' }),
    ];
    const result = collectParkedQuestions(entities);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ entityId: 'IDEA-1', entityTitle: 'First', text: 'q1' });
  });

  it('treats a missing state as open', () => {
    const entities = [entity({ thread: [question({ state: undefined })] })];
    expect(collectParkedQuestions(entities)).toHaveLength(1);
  });

  it('collects every open question across multiple entities, including more than one per entity', () => {
    const entities = [
      entity({ id: 'IDEA-1', thread: [question({ text: 'q1' }), question({ text: 'q2' })] }),
      entity({ id: 'IDEA-2', thread: [question({ text: 'q3' })] }),
    ];
    const result = collectParkedQuestions(entities);
    expect(result.map((q) => q.text).sort()).toEqual(['q1', 'q2', 'q3']);
  });

  it('carries the date and age through unchanged', () => {
    const entities = [entity({ thread: [question({ date: daysAgo(3) })] })];
    expect(collectParkedQuestions(entities)[0]).toMatchObject({ date: daysAgo(3), ageDays: 3 });
  });

  it('orders questions oldest-first by age', () => {
    const older = question({ date: daysAgo(10), text: 'older' });
    const newer = question({ date: daysAgo(1), text: 'newer' });
    const entities = [
      entity({ id: 'IDEA-1', thread: [newer] }),
      entity({ id: 'IDEA-2', thread: [older] }),
    ];
    const result = collectParkedQuestions(entities);
    expect(result.map((q) => q.text)).toEqual(['older', 'newer']);
  });

  it('sorts an undated question ahead of every dated question, however old', () => {
    const undated = question({ date: undefined, text: 'undated' });
    const ancient = question({ date: daysAgo(9999), text: 'ancient but dated' });
    const entities = [
      entity({ id: 'IDEA-1', thread: [ancient] }),
      entity({ id: 'IDEA-2', thread: [undated] }),
    ];
    const result = collectParkedQuestions(entities);
    expect(result.map((q) => q.text)).toEqual(['undated', 'ancient but dated']);
    expect(result[0].ageDays).toBe(Number.POSITIVE_INFINITY);
  });
});

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

function tmpIdeas(): string {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-parked-questions-'));
  roots.push(dir);
  return dir;
}

function write(dir: string, entity: Parameters<typeof formatEntityFile>[0]): void {
  writeFileSync(join(dir, `${entity.id}.md`), `${formatEntityFile(entity)}\n`);
}

describe('readParkedQuestions', () => {
  it('scans every entity file in the ideas dir, oldest-first', async () => {
    const dir = tmpIdeas();
    write(dir, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'in-progress',
      created: '2026-01-01',
      thread: [question({ date: daysAgo(1), text: 'which auth flow?' })],
    });
    write(dir, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'in-progress',
      created: '2026-01-02',
      thread: [question({ date: daysAgo(5), text: 'ship now or wait?' })],
    });
    write(dir, {
      id: 'IDEA-3',
      title: 'Third',
      type: 'feat',
      status: 'in-progress',
      created: '2026-01-03',
      thread: [question({ text: 'already resolved', state: 'resolved' })],
    });

    const result = await readParkedQuestions(dir);
    expect(result.map((q) => q.entityId)).toEqual(['IDEA-2', 'IDEA-1']);
    expect(result.map((q) => q.text)).toEqual(['ship now or wait?', 'which auth flow?']);
  });

  it('returns an empty queue when nothing is parked', async () => {
    const dir = tmpIdeas();
    write(dir, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'in-progress',
      created: '2026-01-01',
    });
    expect(await readParkedQuestions(dir)).toEqual([]);
  });
});
