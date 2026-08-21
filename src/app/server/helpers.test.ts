import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CORPUS_FORMAT_VERSION, CorpusTooNewError } from '@/core/corpus-format';
import { readEntities } from '@/core/readers';
import type { EntityEntry } from '@/types/index';
import { afterAll, describe, expect, it } from 'vitest';
import { checkStaleBaseForRunAll, entityFileInput, writeEntityFile } from './helpers';

describe('entityFileInput', () => {
  it('carries unknownFrontmatter through so routine writes never drop it', () => {
    const entry: EntityEntry = {
      id: 'IDEA-1',
      title: 'Test',
      created: '2026-08-19',
      tags: [],
      body: '',
      phases: [],
      unknownFrontmatter: { formatVersion: 2 },
    };
    expect(entityFileInput(entry).unknownFrontmatter).toEqual({ formatVersion: 2 });
    expect(entityFileInput(entry, { status: 'done' }).unknownFrontmatter).toEqual({
      formatVersion: 2,
    });
  });

  it('writes back the stored order, not the run-order rank overlaid on read', async () => {
    const root = await mkdtemp(join(tmpdir(), 'papercamp-entity-file-input-'));
    const dir = join(root, 'ideas');
    await mkdir(join(dir, 'archive'), { recursive: true });
    await writeFile(
      join(dir, 'IDEA-1.md'),
      '---\nid: IDEA-1\ntitle: Test\ntype: feat\nstatus: planned\ncreated: 2026-07-01\norder: 9\n---\nx\n',
    );
    await writeFile(join(root, 'run-order.md'), 'IDEA-1 — Test\n');

    const { entries } = await readEntities(dir);
    const entry = entries.find((e) => e.id === 'IDEA-1');
    expect(entry?.order).toBe(1); // the overlaid rank, not the stale frontmatter value
    expect(entityFileInput(entry as EntityEntry).order).toBe(9);

    await rm(root, { recursive: true, force: true });
  });
});

describe('writeEntityFile', () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeCorpus(version: unknown): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'papercamp-write-entity-'));
    dirs.push(root);
    await mkdir(join(root, 'papercamp'), { recursive: true });
    await writeFile(join(root, 'papercamp', 'config.json'), JSON.stringify({ version }), 'utf-8');
    return root;
  }

  it('writes normally when the corpus format version is understood', async () => {
    const root = await makeCorpus(CORPUS_FORMAT_VERSION);
    const path = join(root, 'IDEA-1.md');
    await writeEntityFile(root, path, {
      id: 'IDEA-1',
      title: 'Test',
      created: '2026-08-19',
    });
    expect(await readFile(path, 'utf-8')).toContain('id: IDEA-1');
  });

  it('refuses to write when the corpus format version is newer than this paper-camp', async () => {
    const root = await makeCorpus(CORPUS_FORMAT_VERSION + 1);
    const path = join(root, 'IDEA-1.md');
    await expect(
      writeEntityFile(root, path, { id: 'IDEA-1', title: 'Test', created: '2026-08-19' }),
    ).rejects.toBeInstanceOf(CorpusTooNewError);
  });
});

describe('checkStaleBaseForRunAll', () => {
  it('returns null when the base is not stale', async () => {
    const git = { findStaleBaseRef: async () => null };
    expect(await checkStaleBaseForRunAll(git, 'IDEA-137')).toBeNull();
  });

  it('names the plan, the offending ref, and its count when stale', async () => {
    const git = {
      findStaleBaseRef: async () => ({ ref: 'main', done: 4, total: 4 }),
    };
    const message = await checkStaleBaseForRunAll(git, 'IDEA-137');
    expect(message).toContain('IDEA-137');
    expect(message).toContain('4/4');
    expect(message).toContain('main');
    expect(message).toMatch(/rebase or switch branches/i);
  });
});
