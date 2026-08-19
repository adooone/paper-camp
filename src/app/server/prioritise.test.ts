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

function writeRunOrder(root: string, lines: string[]): void {
  writeFileSync(
    join(root, 'papercamp', 'run-order.md'),
    lines.length ? `${lines.join('\n')}\n` : '',
  );
}

function readRunOrder(root: string): string[] {
  const raw = (() => {
    try {
      return readFileSync(join(root, 'papercamp', 'run-order.md'), 'utf-8');
    } catch {
      return '';
    }
  })();
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function readLog(root: string, id: string): string[] {
  const raw = readFileSync(join(root, 'papercamp', 'ideas', `${id}.md`), 'utf-8');
  const match = raw.match(/### Thread\n([\s\S]*?)(\n###|$)/);
  if (!match) return [];
  return match[1]
    .trim()
    .split('\n')
    .filter((line) => line.includes('[log]'));
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
  it('rejects malformed JSON, naming the JSON problem', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () => '{not json}';

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'was not valid JSON',
    );
  });

  it('rejects a verdict missing the order/why shape', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () => JSON.stringify({ order: ['IDEA-1', 'IDEA-2'] });

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'missing an `order` array or a `why` string',
    );
  });

  it('rejects a verdict with the wrong count of ordered ids, naming both counts', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () => JSON.stringify({ order: ['IDEA-1'], why: 'kept first' });

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'ordered 1 ideas but 2 are active',
    );
  });

  it('rejects a verdict with a duplicated id, naming the id', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () => JSON.stringify({ order: ['IDEA-1', 'IDEA-1'], why: 'a\nb' });

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'listed id "IDEA-1" more than once',
    );
  });

  it('rejects a verdict with an id outside the active set, naming the id', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () => JSON.stringify({ order: ['IDEA-1', 'IDEA-9'], why: 'a\nb' });

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'included id "IDEA-9", which is not in the active set',
    );
  });

  it('rejects a `why` whose line count does not match the order, naming both counts', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () =>
      JSON.stringify({ order: ['IDEA-1', 'IDEA-2'], why: 'only one reason' });

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'why" had 1 line(s) but the order has 2 ids',
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
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
    });
    writeRunOrder(root, ['IDEA-1 — First', 'IDEA-2 — Second']);

    const result = await applyPrioritiseVerdict(root, {
      order: ['IDEA-2', 'IDEA-1'],
      why: 'unblocks IDEA-1\nwaits on IDEA-2',
    });

    expect(result.moved.sort()).toEqual(['IDEA-1', 'IDEA-2']);
    expect(result.annotated.sort()).toEqual(['IDEA-1', 'IDEA-2']);
    expect(readRunOrder(root)).toEqual(['IDEA-2 — Second', 'IDEA-1 — First']);
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
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
    });
    writeRunOrder(root, ['IDEA-1 — First', 'IDEA-2 — Second']);

    const result = await applyPrioritiseVerdict(root, {
      order: ['IDEA-1', 'IDEA-2'],
      why: 'stays first\nstays second',
    });

    expect(result.moved).toEqual([]);
    expect(result.annotated).toEqual([]);
    expect(readLog(root, 'IDEA-1')).toEqual([]);
    expect(readLog(root, 'IDEA-2')).toEqual([]);
  });

  it('keeps the reorder and reports the failure when annotating a moved idea fails', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'planned',
      created: '2026-07-01',
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
    });
    writeRunOrder(root, ['IDEA-1 — First', 'IDEA-2 — Second']);
    const idea2File = join(root, 'papercamp', 'ideas', 'IDEA-2.md');
    chmodSync(idea2File, 0o444);

    try {
      const result = await applyPrioritiseVerdict(root, {
        order: ['IDEA-2', 'IDEA-1'],
        why: 'unblocks IDEA-1\nwaits on IDEA-2',
      });

      expect(result.moved.sort()).toEqual(['IDEA-1', 'IDEA-2']);
      expect(result.annotated).toEqual(['IDEA-1']);
      expect(result.annotationError).toContain('IDEA-2');
      expect(readRunOrder(root)).toEqual(['IDEA-2 — Second', 'IDEA-1 — First']);
    } finally {
      chmodSync(idea2File, 0o644);
    }
  });
});
