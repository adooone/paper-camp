import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readAllIdeaFiles, readAllPlanFiles, readIdeasMerged, readPlansMerged } from './readers';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-readers-test-'));
  roots.push(root);
  return root;
}

function planFile(id: string, title: string, status = 'planned'): string {
  return `---
id: ${id}
title: ${title}
kind: feat
status: ${status}
created: 2026-07-01
---
Body of ${id}.
`;
}

function ideaFile(id: string, title: string): string {
  return `---
id: ${id}
title: ${title}
---
Body of ${id}.
`;
}

describe('readAllPlanFiles', () => {
  it('reads plans from the directory and its archive, excluding index.md', async () => {
    const root = await makeRoot();
    const plansDir = join(root, 'plans');
    await mkdir(join(plansDir, 'archive'), { recursive: true });
    await writeFile(join(plansDir, 'FEAT-1.md'), planFile('FEAT-1', 'Active plan'));
    await writeFile(join(plansDir, 'index.md'), '# Plans\n\n| table |\n');
    await writeFile(
      join(plansDir, 'archive', 'FEAT-2.md'),
      planFile('FEAT-2', 'Archived plan', 'done'),
    );
    await writeFile(join(plansDir, 'archive', 'index.md'), '# Archive\n');

    const { entries, warnings, fileCount } = await readAllPlanFiles(plansDir);
    expect(warnings).toEqual([]);
    expect(fileCount).toBe(2);
    expect(entries.map((entry) => entry.id).sort()).toEqual(['FEAT-1', 'FEAT-2']);
  });

  it('warns on an invalid plan file without dropping the valid ones', async () => {
    const root = await makeRoot();
    const plansDir = join(root, 'plans');
    await mkdir(plansDir, { recursive: true });
    await writeFile(join(plansDir, 'FEAT-1.md'), planFile('FEAT-1', 'Valid plan'));
    await writeFile(join(plansDir, 'FEAT-2.md'), planFile('FEAT-2', 'Bad status', 'nope'));

    const { entries, warnings } = await readAllPlanFiles(plansDir);
    expect(entries.map((entry) => entry.id)).toEqual(['FEAT-1']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].title).toBe('FEAT-2');
  });

  it('warns on an unreadable (empty) plan file', async () => {
    const root = await makeRoot();
    const plansDir = join(root, 'plans');
    await mkdir(plansDir, { recursive: true });
    await writeFile(join(plansDir, 'FEAT-1.md'), '');

    const { entries, warnings } = await readAllPlanFiles(plansDir);
    expect(entries).toEqual([]);
    expect(warnings).toEqual([{ title: 'FEAT-1.md', message: 'Could not read plan file' }]);
  });

  it('returns an empty result for a missing directory', async () => {
    const root = await makeRoot();
    const result = await readAllPlanFiles(join(root, 'does-not-exist'));
    expect(result).toEqual({ entries: [], warnings: [], fileCount: 0 });
  });
});

describe('readAllIdeaFiles', () => {
  it('reads idea files non-recursively, excluding index.md', async () => {
    const root = await makeRoot();
    const ideasDir = join(root, 'ideas');
    await mkdir(join(ideasDir, 'archive'), { recursive: true });
    await writeFile(join(ideasDir, 'IDEA-1.md'), ideaFile('IDEA-1', 'First idea'));
    await writeFile(join(ideasDir, 'index.md'), '# Ideas\n');
    await writeFile(join(ideasDir, 'archive', 'IDEA-2.md'), ideaFile('IDEA-2', 'Buried idea'));

    const { entries, warnings, fileCount } = await readAllIdeaFiles(ideasDir);
    expect(warnings).toEqual([]);
    expect(fileCount).toBe(1);
    expect(entries.map((entry) => entry.id)).toEqual(['IDEA-1']);
  });
});

describe('readPlansMerged', () => {
  const monolithic = `## Old FEAT-1 title

**Status:** planned
**Id:** FEAT-1
**Created:** 2026-01-01

Mono body one.

## Mono only plan

**Status:** idea
**Id:** FEAT-9
**Created:** 2026-01-02

Mono body nine.
`;

  it('prefers the per-file version of a plan over its monolithic duplicate', async () => {
    const root = await makeRoot();
    const plansDir = join(root, 'plans');
    await mkdir(plansDir, { recursive: true });
    await writeFile(join(plansDir, 'FEAT-1.md'), planFile('FEAT-1', 'New FEAT-1 title'));
    const monoPath = join(root, 'plans.md');
    await writeFile(monoPath, monolithic);

    const { entries, warnings } = await readPlansMerged(plansDir, monoPath);
    expect(warnings).toEqual([]);
    expect(entries.map((entry) => [entry.id, entry.title])).toEqual([
      ['FEAT-1', 'New FEAT-1 title'],
      ['FEAT-9', 'Mono only plan'],
    ]);
  });

  it('falls back to the monolithic file when no per-file plans exist', async () => {
    const root = await makeRoot();
    const monoPath = join(root, 'plans.md');
    await writeFile(monoPath, monolithic);

    const { entries } = await readPlansMerged(join(root, 'plans'), monoPath);
    expect(entries.map((entry) => entry.id)).toEqual(['FEAT-1', 'FEAT-9']);
  });

  it('returns per-file plans alone when the monolithic file is missing', async () => {
    const root = await makeRoot();
    const plansDir = join(root, 'plans');
    await mkdir(plansDir, { recursive: true });
    await writeFile(join(plansDir, 'FEAT-1.md'), planFile('FEAT-1', 'Only per-file'));

    const { entries } = await readPlansMerged(plansDir, join(root, 'plans.md'));
    expect(entries.map((entry) => entry.id)).toEqual(['FEAT-1']);
  });
});

describe('readIdeasMerged', () => {
  const monolithic = `## IDEA-1: Old first idea

Old body one.

---

## IDEA-2: Mono only idea

Body two.

---

Just a headingless stray thought.
`;

  it('prefers per-file ideas and keeps monolithic-only and id-less sections', async () => {
    const root = await makeRoot();
    const ideasDir = join(root, 'ideas');
    await mkdir(ideasDir, { recursive: true });
    await writeFile(join(ideasDir, 'IDEA-1.md'), ideaFile('IDEA-1', 'New first idea'));
    const monoPath = join(root, 'ideas.md');
    await writeFile(monoPath, monolithic);

    const { entries } = await readIdeasMerged(ideasDir, monoPath);
    expect(entries.map((entry) => [entry.id, entry.title])).toEqual([
      ['IDEA-1', 'New first idea'],
      ['IDEA-2', 'Mono only idea'],
      [null, 'Just a headingless stray thought.'],
    ]);
  });

  it('returns an empty result when neither source exists', async () => {
    const root = await makeRoot();
    const { entries, warnings } = await readIdeasMerged(
      join(root, 'ideas'),
      join(root, 'ideas.md'),
    );
    expect(entries).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('parses the monolithic file alone when no per-file ideas exist', async () => {
    const root = await makeRoot();
    const monoPath = join(root, 'ideas.md');
    await writeFile(monoPath, monolithic);

    const { entries } = await readIdeasMerged(join(root, 'ideas'), monoPath);
    expect(entries.map((entry) => entry.id)).toEqual(['IDEA-1', 'IDEA-2', null]);
  });
});
