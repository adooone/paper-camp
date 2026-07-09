import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearPrCache } from './pr';
import {
  entityToIdea,
  entityToPlan,
  readEntities,
  readEntitiesWithDerivedStatus,
  readNoteEntries,
  readWorkEntries,
} from './readers';
import { formatEntityFile } from './serializer';

const originalPath = process.env.PATH;

/** Puts a fake `gh` on PATH that prints the given `gh pr list --json` rows. */
function installGh(rows: object[]): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-readers-gh-'));
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\necho '${JSON.stringify(rows)}'\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

/** Puts a fake `gh` on PATH that exits non-zero — i.e. GitHub is unreachable. */
function installFailingGh(): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-readers-gh-'));
  writeFileSync(join(dir, 'gh'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(dir, 'gh'), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

/** A PR row for entity `id` in `state`, matched via its `**Plan:**` body line. */
const prRow = (
  id: string,
  state: string,
  extra: { isDraft?: boolean; number?: number; url?: string } = {},
) => ({
  number: extra.number ?? 1,
  url: extra.url ?? 'u',
  state,
  isDraft: extra.isDraft ?? false,
  headRefName: '',
  body: `**Plan:** \`${id}\``,
});

// Default every test to "GitHub unreachable" so nothing shells out to the real
// gh; tests exercising PR state install their own fake gh, which wins on PATH.
beforeEach(() => {
  clearPrCache();
  installFailingGh();
});
afterEach(() => {
  process.env.PATH = originalPath;
  clearPrCache();
});

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
    // GitHub unreachable (beforeEach) -> IDEA-1 falls back to its stored status.
    const { entries } = await readWorkEntries(makeCorpus());
    expect(entries.map((e) => e.id).sort()).toEqual(['IDEA-1', 'IDEA-3']);
    const active = entries.find((e) => e.id === 'IDEA-1');
    expect(active?.kind).toBe('feat');
    expect(active?.status).toBe('in-progress');
    expect(active?.phases).toHaveLength(2);
    expect(active?.idea).toBeUndefined();
  });

  it('readNoteEntries maps notes to IdeaEntry shape', async () => {
    const { entries } = await readNoteEntries(makeCorpus());
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('IDEA-2');
    expect(entries[0].kind).toBe('note');
    expect(entries[0].status).toBe('open');
  });

  it('entityToPlan and entityToIdea preserve identity fields', async () => {
    const { entries } = await readEntities(makeCorpus());
    const work = entries.find((e) => e.id === 'IDEA-3');
    const note = entries.find((e) => e.id === 'IDEA-2');
    expect(work && entityToPlan(work).id).toBe('IDEA-3');
    expect(work && entityToPlan(work).kind).toBe('fix');
    expect(note && entityToIdea(note).title).toBe('A note');
  });
});

describe('status derivation from PR state', () => {
  it('is idea with no phases, planned with phases and no PR', async () => {
    installGh([]); // gh resolves, repo has no PRs
    const dir = tmpIdeas();
    write(dir, {
      id: 'IDEA-1',
      title: 'Just an idea',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
    });
    write(dir, {
      id: 'IDEA-2',
      title: 'Planned',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: false }],
    });
    const byId = Object.fromEntries(
      (await readWorkEntries(dir)).entries.map((e) => [e.id, e.status]),
    );
    expect(byId['IDEA-1']).toBe('idea');
    expect(byId['IDEA-2']).toBe('planned');
  });

  it('is in-progress with an open PR and unchecked phases, review when all are checked', async () => {
    installGh([prRow('IDEA-3', 'OPEN'), prRow('IDEA-4', 'OPEN')]);
    const dir = tmpIdeas();
    write(dir, {
      id: 'IDEA-3',
      title: 'Active',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [
        { text: 'One', done: true },
        { text: 'Two', done: false },
      ],
    });
    write(dir, {
      id: 'IDEA-4',
      title: 'Ready',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: true }],
    });
    const byId = Object.fromEntries(
      (await readWorkEntries(dir)).entries.map((e) => [e.id, e.status]),
    );
    expect(byId['IDEA-3']).toBe('in-progress');
    expect(byId['IDEA-4']).toBe('review');
  });

  it('is done from a merged PR and dropped from a closed one', async () => {
    installGh([prRow('IDEA-5', 'MERGED'), prRow('IDEA-6', 'CLOSED')]);
    const dir = tmpIdeas();
    write(dir, {
      id: 'IDEA-5',
      title: 'Shipped',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: true }],
    });
    write(dir, {
      id: 'IDEA-6',
      title: 'Abandoned',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: false }],
    });
    const byId = Object.fromEntries(
      (await readWorkEntries(dir)).entries.map((e) => [e.id, e.status]),
    );
    expect(byId['IDEA-5']).toBe('done');
    expect(byId['IDEA-6']).toBe('dropped');
  });

  it('falls back to the stored override when GitHub is unreachable', async () => {
    // beforeEach already installed a failing gh.
    const dir = tmpIdeas();
    write(dir, {
      id: 'IDEA-7',
      title: 'Stored review',
      type: 'feat',
      status: 'review',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: true }],
    });
    expect((await readWorkEntries(dir)).entries.find((e) => e.id === 'IDEA-7')?.status).toBe(
      'review',
    );
  });

  it('threads the resolved PR (number/url/state) onto the PlanEntry for the badge', async () => {
    installGh([prRow('IDEA-8', 'OPEN', { number: 42, url: 'https://github.com/o/r/pull/42' })]);
    const dir = tmpIdeas();
    write(dir, {
      id: 'IDEA-8',
      title: 'Badge',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: true }],
    });
    expect((await readWorkEntries(dir)).entries.find((e) => e.id === 'IDEA-8')?.pr).toEqual({
      number: 42,
      url: 'https://github.com/o/r/pull/42',
      state: 'open',
    });
  });

  it('never persists the derived status back onto the raw EntityEntry', async () => {
    installGh([prRow('IDEA-9', 'OPEN')]);
    const dir = tmpIdeas();
    write(dir, {
      id: 'IDEA-9',
      title: 'Active',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: false }],
    });
    await readEntitiesWithDerivedStatus(dir);
    const { entries: raw } = await readEntities(dir);
    expect(raw.find((e) => e.id === 'IDEA-9')?.status).toBeUndefined();
  });
});

describe('readEntitiesWithDerivedStatus', () => {
  it('replaces status with the derived value for work entities, leaving notes untouched', async () => {
    installGh([prRow('IDEA-10', 'OPEN')]);
    const dir = tmpIdeas();
    write(dir, {
      id: 'IDEA-10',
      title: 'Active',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: false }],
    });
    write(dir, {
      id: 'IDEA-11',
      title: 'A note',
      kind: 'note',
      status: 'open',
      created: '2026-07-01',
      body: 'x',
    });
    const { entries, warnings } = await readEntitiesWithDerivedStatus(dir);
    expect(warnings).toEqual([]);
    expect(entries.find((e) => e.id === 'IDEA-10')?.status).toBe('in-progress');
    expect(entries.find((e) => e.id === 'IDEA-11')?.status).toBe('open');
  });
});
