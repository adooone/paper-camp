import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearPrCache } from '../../core/git-pr/pr';
import { formatEntityFile } from '../../core/serialize/serializer';
import type { PlanEntry } from '../../types/index';
import { applyPrioritiseVerdict, getPrioritiseVerdict } from './prioritise';

const originalPath = process.env.PATH;

/** Puts a fake `gh` on PATH that exits non-zero, so status derives from stored fields alone. */
function installFailingGh(): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-prioritise-gh-'));
  writeFileSync(join(dir, 'gh'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(dir, 'gh'), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

beforeEach(() => {
  clearPrCache();
  installFailingGh();
});
afterEach(() => {
  process.env.PATH = originalPath;
  clearPrCache();
});

function tmpRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-root-'));
  mkdirSync(join(root, 'papercamp', 'ideas', 'archive'), { recursive: true });
  return root;
}

function write(root: string, entity: Parameters<typeof formatEntityFile>[0]): void {
  writeFileSync(
    join(root, 'papercamp', 'ideas', `${entity.id}.md`),
    `${formatEntityFile(entity)}\n`,
  );
}

function readOrder(root: string, id: string): number | undefined {
  const raw = readFileSync(join(root, 'papercamp', 'ideas', `${id}.md`), 'utf-8');
  const match = raw.match(/^order: (\d+)$/m);
  return match ? Number(match[1]) : undefined;
}

function readLog(root: string, id: string): string[] {
  const raw = readFileSync(join(root, 'papercamp', 'ideas', `${id}.md`), 'utf-8');
  const match = raw.match(/### Log\n([\s\S]*?)(\n###|$)/);
  if (!match) return [];
  return match[1].trim().split('\n').filter(Boolean);
}

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'A plan',
  status: 'planned',
  created: '2026-07-01',
  tags: [],
  body: '',
  phases: [],
  ...overrides,
});

describe('getPrioritiseVerdict', () => {
  it('rejects a verdict missing an active id', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () => JSON.stringify({ order: ['IDEA-1'], why: 'kept first' });

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'every active id exactly once',
    );
  });

  it('rejects a verdict with a duplicated id', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () => JSON.stringify({ order: ['IDEA-1', 'IDEA-1'], why: 'a\nb' });

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'every active id exactly once',
    );
  });

  it('accepts a full permutation of the active ids', async () => {
    const worklist = [
      plan({ id: 'IDEA-1' }),
      plan({ id: 'IDEA-2' }),
      plan({ id: 'IDEA-3', status: 'idea' }),
    ];
    const runPrompt = async () =>
      JSON.stringify({ order: ['IDEA-2', 'IDEA-1'], why: 'blocks first\nsecond' });

    const verdict = await getPrioritiseVerdict(worklist, '', runPrompt);
    expect(verdict).toEqual({ order: ['IDEA-2', 'IDEA-1'], why: 'blocks first\nsecond' });
  });
});

describe('applyPrioritiseVerdict', () => {
  it('reorders the queue and appends the matching why line to each moved idea', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'planned',
      created: '2026-07-01',
      order: 1,
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
      order: 2,
    });

    const moved = await applyPrioritiseVerdict(root, {
      order: ['IDEA-2', 'IDEA-1'],
      why: 'unblocks IDEA-1\nwaits on IDEA-2',
    });

    expect(moved.sort()).toEqual(['IDEA-1', 'IDEA-2']);
    expect(readOrder(root, 'IDEA-2')).toBe(1);
    expect(readOrder(root, 'IDEA-1')).toBe(2);
    expect(readLog(root, 'IDEA-2')).toEqual([expect.stringContaining('unblocks IDEA-1')]);
    expect(readLog(root, 'IDEA-1')).toEqual([expect.stringContaining('waits on IDEA-2')]);
  });

  it('leaves an already-matching order untouched, with no log writes', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'planned',
      created: '2026-07-01',
      order: 1,
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
      order: 2,
    });

    const moved = await applyPrioritiseVerdict(root, {
      order: ['IDEA-1', 'IDEA-2'],
      why: 'stays first\nstays second',
    });

    expect(moved).toEqual([]);
    expect(readLog(root, 'IDEA-1')).toEqual([]);
    expect(readLog(root, 'IDEA-2')).toEqual([]);
  });
});
