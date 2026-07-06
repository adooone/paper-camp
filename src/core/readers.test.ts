import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  entityToIdea,
  entityToPlan,
  readEntities,
  readNoteEntries,
  readWorkEntries,
} from './readers';
import { formatEntityFile } from './serializer';

function makeCorpus(): string {
  const dir = mkdtempSync(join(tmpdir(), 'entities-'));
  mkdirSync(join(dir, 'archive'), { recursive: true });

  writeFileSync(
    join(dir, 'IDEA-1.md'),
    `${formatEntityFile({
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
    })}\n`,
  );
  writeFileSync(
    join(dir, 'IDEA-2.md'),
    `${formatEntityFile({
      id: 'IDEA-2',
      title: 'A note',
      kind: 'note',
      status: 'open',
      created: '2026-07-02',
      body: 'Reference material.',
    })}\n`,
  );
  writeFileSync(
    join(dir, 'archive', 'IDEA-3.md'),
    `${formatEntityFile({
      id: 'IDEA-3',
      title: 'Shipped work',
      type: 'fix',
      status: 'done',
      created: '2026-06-01',
      body: 'It was fixed.',
    })}\n`,
  );
  writeFileSync(join(dir, 'index.md'), '# Ideas\n\n| Id |\n');
  return dir;
}

describe('readEntities', () => {
  it('reads live and archived entities, skipping index.md', async () => {
    const dir = makeCorpus();
    const { entries, warnings, fileCount } = await readEntities(dir);
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

describe('entity views', () => {
  it('readWorkEntries maps non-notes to PlanEntry shape with kind from type', async () => {
    const dir = makeCorpus();
    const { entries } = await readWorkEntries(dir);
    expect(entries.map((e) => e.id).sort()).toEqual(['IDEA-1', 'IDEA-3']);
    const active = entries.find((e) => e.id === 'IDEA-1');
    expect(active?.kind).toBe('feat');
    expect(active?.status).toBe('in-progress');
    expect(active?.phases).toHaveLength(2);
    expect(active?.idea).toBeUndefined();
  });

  it('readNoteEntries maps notes to IdeaEntry shape', async () => {
    const dir = makeCorpus();
    const { entries } = await readNoteEntries(dir);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('IDEA-2');
    expect(entries[0].kind).toBe('note');
    expect(entries[0].status).toBe('open');
  });

  it('entityToPlan and entityToIdea preserve identity fields', async () => {
    const dir = makeCorpus();
    const { entries } = await readEntities(dir);
    const work = entries.find((e) => e.id === 'IDEA-3');
    const note = entries.find((e) => e.id === 'IDEA-2');
    expect(work && entityToPlan(work).id).toBe('IDEA-3');
    expect(work && entityToPlan(work).kind).toBe('fix');
    expect(note && entityToIdea(note).title).toBe('A note');
  });
});
