import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readEntities } from './readers';
import { formatEntityFile } from './serialize/entity-file';

function tmpIdeas(): string {
  const dir = mkdtempSync(join(tmpdir(), 'entities-'));
  mkdirSync(join(dir, 'archive'), { recursive: true });
  return dir;
}

function write(
  dir: string,
  entity: Parameters<typeof formatEntityFile>[0],
  archived = false,
): void {
  const target = archived ? join(dir, 'archive', `${entity.id}.md`) : join(dir, `${entity.id}.md`);
  writeFileSync(target, `${formatEntityFile(entity)}\n`);
}

function makeCorpus(): string {
  const dir = tmpIdeas();
  write(dir, {
    id: 'IDEA-1',
    title: 'Active work',
    type: 'feat',
    status: 'in-progress',
    created: '2026-07-01',
    tags: ['core'],
    body: 'Doing things.',
    phases: [
      { text: 'One', done: true },
      { text: 'Two', done: false },
    ],
  });
  write(dir, {
    id: 'IDEA-2',
    title: 'A note',
    kind: 'note',
    status: 'open',
    created: '2026-07-02',
    body: 'Reference material.',
  });
  write(
    dir,
    {
      id: 'IDEA-3',
      title: 'Shipped work',
      type: 'fix',
      status: 'done',
      created: '2026-06-01',
      body: 'It was fixed.',
    },
    true,
  );
  writeFileSync(join(dir, 'index.md'), '# Ideas\n\n| Id |\n');
  return dir;
}

describe('readEntities', () => {
  it('reads live and archived entities, skipping index.md', async () => {
    const { entries, warnings, fileCount } = await readEntities(makeCorpus());
    expect(warnings).toEqual([]);
    expect(fileCount).toBe(3);
    expect(entries.map((e) => e.id).sort()).toEqual(['IDEA-1', 'IDEA-2', 'IDEA-3']);
  });

  it('returns empty for a missing directory', async () => {
    const { entries, warnings, fileCount } = await readEntities('/nonexistent/nowhere');
    expect(entries).toEqual([]);
    expect(warnings).toEqual([]);
    expect(fileCount).toBe(0);
  });

  it('resolves order from a sibling run-order.md, overriding stale frontmatter order', async () => {
    const root = mkdtempSync(join(tmpdir(), 'papercamp-readers-root-'));
    const dir = join(root, 'ideas');
    mkdirSync(join(dir, 'archive'), { recursive: true });
    write(dir, {
      id: 'IDEA-1',
      title: 'Second in the list',
      type: 'feat',
      status: 'planned',
      created: '2026-07-01',
      order: 9, // stale — the list below is authoritative
      body: 'x',
    });
    write(dir, {
      id: 'IDEA-2',
      title: 'First in the list',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
      body: 'x',
    });
    write(dir, {
      id: 'IDEA-3',
      title: 'Not in the list',
      type: 'feat',
      status: 'idea',
      created: '2026-07-03',
      body: 'x',
    });
    mkdirSync(join(root, '.local'), { recursive: true });
    writeFileSync(
      join(root, '.local', 'run-order.md'),
      'IDEA-2 — First in the list\nIDEA-1 — Second in the list\n',
    );

    const { entries } = await readEntities(dir);
    const byId = Object.fromEntries(entries.map((e) => [e.id, e.order]));
    expect(byId['IDEA-2']).toBe(1);
    expect(byId['IDEA-1']).toBe(2);
    expect(byId['IDEA-3']).toBeUndefined();
  });

  it('surfaces parse warnings for invalid files without dropping the rest', async () => {
    const dir = makeCorpus();
    // status open without kind: note fails the schema refine
    writeFileSync(
      join(dir, 'IDEA-9.md'),
      '---\nid: IDEA-9\ntitle: Broken\nstatus: open\ncreated: 2026-07-01\n---\n',
    );
    const { entries, warnings } = await readEntities(dir);
    expect(warnings.length).toBeGreaterThan(0);
    expect(entries.map((e) => e.id).sort()).toEqual(['IDEA-1', 'IDEA-2', 'IDEA-3']);
  });
});
