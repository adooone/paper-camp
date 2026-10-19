import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CorpusError,
  appendThread,
  corpusFingerprint,
  createIdea,
  invalidateCorpus,
  readCorpus,
  updateEntity,
} from './corpus';
import { clearPrCache } from './git-pr/pr';
import { readEntities } from './readers';
import { formatEntityFile } from './serialize/entity-file';

const originalPath = process.env.PATH;

/** Puts a fake `gh` on PATH that prints the given `gh pr list --json` rows. */
function installGh(rows: object[]): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-corpus-gh-'));
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\necho '${JSON.stringify(rows)}'\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

/** Puts a fake `gh` on PATH that exits non-zero — i.e. GitHub is unreachable. */
function installFailingGh(): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-corpus-gh-'));
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

function tmpRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-corpus-'));
  mkdirSync(join(root, 'papercamp', 'ideas', 'archive'), { recursive: true });
  return root;
}

function ideasDirOf(root: string): string {
  return join(root, 'papercamp', 'ideas');
}

function write(
  root: string,
  entity: Parameters<typeof formatEntityFile>[0],
  archived = false,
): void {
  const dir = ideasDirOf(root);
  const target = archived ? join(dir, 'archive', `${entity.id}.md`) : join(dir, `${entity.id}.md`);
  writeFileSync(target, `${formatEntityFile(entity)}\n`);
}

function makeCorpus(): string {
  const root = tmpRoot();
  write(root, {
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
  write(root, {
    id: 'IDEA-2',
    title: 'A note',
    kind: 'note',
    status: 'open',
    created: '2026-07-02',
    body: 'Reference material.',
  });
  write(
    root,
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
  writeFileSync(join(ideasDirOf(root), 'index.md'), '# Ideas\n\n| Id |\n');
  return root;
}

describe('readCorpus — entity views', () => {
  it('work maps non-notes to PlanEntry shape with kind from type', async () => {
    // GitHub unreachable (beforeEach) -> IDEA-1 falls back to its stored status.
    const { work } = await readCorpus(makeCorpus(), { live: true });
    expect(work.map((e) => e.id).sort()).toEqual(['IDEA-1', 'IDEA-3']);
    const active = work.find((e) => e.id === 'IDEA-1');
    expect(active?.kind).toBe('feat');
    expect(active?.status).toBe('in-progress');
    expect(active?.phases).toHaveLength(2);
    expect(active?.idea).toBeUndefined();
  });

  it('notes maps notes to IdeaEntry shape', async () => {
    const { notes } = await readCorpus(makeCorpus(), { live: true });
    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe('IDEA-2');
    expect(notes[0].kind).toBe('note');
    expect(notes[0].status).toBe('open');
  });
});

describe('readCorpus — status derivation from PR state', () => {
  it('is idea with no phases, planned with phases and no PR', async () => {
    installGh([]); // gh resolves, repo has no PRs
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'Just an idea',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Planned',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: false }],
    });
    const { work } = await readCorpus(root, { live: true });
    const byId = Object.fromEntries(work.map((e) => [e.id, e.status]));
    expect(byId['IDEA-1']).toBe('idea');
    expect(byId['IDEA-2']).toBe('planned');
  });

  it('is in-progress with an open PR and unchecked phases, review when all are checked', async () => {
    installGh([prRow('IDEA-3', 'OPEN'), prRow('IDEA-4', 'OPEN')]);
    const root = tmpRoot();
    write(root, {
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
    write(root, {
      id: 'IDEA-4',
      title: 'Ready',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: true }],
    });
    const { work } = await readCorpus(root, { live: true });
    const byId = Object.fromEntries(work.map((e) => [e.id, e.status]));
    expect(byId['IDEA-3']).toBe('in-progress');
    expect(byId['IDEA-4']).toBe('review');
  });

  it('is done from a merged PR and dropped from a closed one', async () => {
    installGh([prRow('IDEA-5', 'MERGED'), prRow('IDEA-6', 'CLOSED')]);
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-5',
      title: 'Shipped',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: true }],
    });
    write(root, {
      id: 'IDEA-6',
      title: 'Abandoned',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: false }],
    });
    const { work } = await readCorpus(root, { live: true });
    const byId = Object.fromEntries(work.map((e) => [e.id, e.status]));
    expect(byId['IDEA-5']).toBe('done');
    expect(byId['IDEA-6']).toBe('dropped');
  });

  it('falls back to the stored override when GitHub is unreachable', async () => {
    // beforeEach already installed a failing gh.
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-7',
      title: 'Stored review',
      type: 'feat',
      status: 'review',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: true }],
    });
    const { work } = await readCorpus(root, { live: true });
    expect(work.find((e) => e.id === 'IDEA-7')?.status).toBe('review');
  });

  it('threads the resolved PR (number/url/state) onto the PlanEntry for the badge', async () => {
    installGh([prRow('IDEA-8', 'OPEN', { number: 42, url: 'https://github.com/o/r/pull/42' })]);
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-8',
      title: 'Badge',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: true }],
    });
    const { work } = await readCorpus(root, { live: true });
    expect(work.find((e) => e.id === 'IDEA-8')?.pr).toEqual({
      number: 42,
      url: 'https://github.com/o/r/pull/42',
      state: 'open',
    });
  });

  it('never persists the derived status back onto the raw EntityEntry file', async () => {
    installGh([prRow('IDEA-9', 'OPEN')]);
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-9',
      title: 'Active',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: false }],
    });
    await readCorpus(root, { live: true });
    const raw = await readEntities(ideasDirOf(root));
    expect(raw.entries.find((e) => e.id === 'IDEA-9')?.status).toBeUndefined();
  });
});

describe('readCorpus — board status rollup from tickets', () => {
  it('rolls a board up from its tickets, capping at review', async () => {
    installGh([]); // gh resolves, repo has no PRs
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-30',
      title: 'Empty board',
      kind: 'board',
      created: '2026-07-01',
      body: 'x',
    });
    write(root, {
      id: 'IDEA-31',
      title: 'Board with a done ticket',
      kind: 'board',
      created: '2026-07-01',
      body: 'x',
    });
    write(root, {
      id: 'TICKET-1',
      title: 'Done ticket',
      kind: 'ticket',
      idea: 'IDEA-31',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: true }],
      status: 'done',
    });
    const { work } = await readCorpus(root, { live: true });
    const byId = Object.fromEntries(work.map((e) => [e.id, e.status]));
    expect(byId['IDEA-30']).toBe('idea');
    expect(byId['IDEA-31']).toBe('review');
    expect(byId['TICKET-1']).toBe('done');
  });

  it('respects a manually stamped done/dropped board status instead of the rollup', async () => {
    installGh([]);
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-32',
      title: 'Manually closed board',
      kind: 'board',
      status: 'dropped',
      created: '2026-07-01',
      body: 'x',
    });
    const { work } = await readCorpus(root, { live: true });
    const byId = Object.fromEntries(work.map((e) => [e.id, e.status]));
    expect(byId['IDEA-32']).toBe('dropped');
  });
});

describe('readCorpus — status derivation from main-branch commit activity', () => {
  it('advances a no-PR idea from main commits referencing its id: in-progress, then review once all phases are checked', async () => {
    installGh([]); // gh resolves, repo has no PRs
    const root = mkdtempSync(join(tmpdir(), 'papercamp-corpus-git-'));
    mkdirSync(join(root, 'papercamp', 'ideas', 'archive'), { recursive: true });
    const run = (...args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf-8' });
    run('init', '-b', 'main');
    run('config', 'user.email', 'test@example.com');
    run('config', 'user.name', 'Test User');
    run('config', 'commit.gpgsign', 'false');
    writeFileSync(join(root, 'a.txt'), 'a\n');
    run('add', '.');
    run('commit', '-m', 'feat(core): Add the thing\n\nRefs: IDEA-20');
    writeFileSync(join(root, 'b.txt'), 'b\n');
    run('add', '.');
    run('commit', '-m', 'feat(core): Finish it\n\nRefs: IDEA-21');

    write(root, {
      id: 'IDEA-20',
      title: 'In progress via main',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [
        { text: 'One', done: true },
        { text: 'Two', done: false },
      ],
    });
    write(root, {
      id: 'IDEA-21',
      title: 'Review via main',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: true }],
    });

    const { work } = await readCorpus(root, { live: true });
    const byId = Object.fromEntries(work.map((e) => [e.id, e.status]));
    expect(byId['IDEA-20']).toBe('in-progress');
    expect(byId['IDEA-21']).toBe('review');
  });
});

describe('readCorpus — archivable ideas', () => {
  it('threads a merged PR onto a review/done idea still in ideasDir, for the caller to filter archivable', async () => {
    installGh([
      prRow('IDEA-12', 'MERGED', { number: 7, url: 'https://github.com/o/r/pull/7' }),
      prRow('IDEA-13', 'MERGED'),
      prRow('IDEA-14', 'OPEN'),
    ]);
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-12',
      title: 'Ready to archive',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: true }],
    });
    write(
      root,
      {
        id: 'IDEA-13',
        title: 'Already archived',
        type: 'feat',
        status: 'done',
        created: '2026-07-01',
        body: 'x',
        phases: [{ text: 'One', done: true }],
      },
      true,
    );
    write(root, {
      id: 'IDEA-14',
      title: 'Still open',
      type: 'feat',
      created: '2026-07-01',
      body: 'x',
      phases: [{ text: 'One', done: true }],
    });
    write(root, {
      id: 'IDEA-15',
      title: 'A note',
      kind: 'note',
      status: 'open',
      created: '2026-07-01',
      body: 'x',
    });

    const { entries, prs, resolved } = await readCorpus(root, { live: true });
    expect(resolved).toBe(true);
    const archivable = entries.find((e) => e.id === 'IDEA-12');
    expect(archivable?.archived).toBe(false);
    expect(prs?.get('IDEA-12')).toMatchObject({ state: 'merged' });
  });
});

describe('corpusFingerprint', () => {
  it('fingerprints the ideas files, their archive and run-order.md', async () => {
    const root = tmpRoot();
    const ideas = ideasDirOf(root);
    writeFileSync(join(ideas, 'IDEA-1.md'), 'one');
    const before = await corpusFingerprint(ideas);
    expect(await corpusFingerprint(ideas)).toBe(before);
    writeFileSync(join(ideas, 'IDEA-2.md'), 'two');
    const added = await corpusFingerprint(ideas);
    expect(added).not.toBe(before);
    writeFileSync(join(ideas, 'IDEA-2.md'), 'two, longer');
    utimesSync(join(ideas, 'IDEA-2.md'), new Date(), new Date(Date.now() + 5000));
    expect(await corpusFingerprint(ideas)).not.toBe(added);
  });
});

describe('readCorpus — caching', () => {
  it('serves the same snapshot for a repeat read with nothing changed on disk', async () => {
    installGh([]);
    const root = tmpRoot();
    write(root, { id: 'IDEA-1', title: 'A', type: 'feat', created: '2026-07-01', body: 'x' });

    const first = await readCorpus(root, { live: true });
    const second = await readCorpus(root, { live: true });
    expect(second).toBe(first);
  });

  it('reloads once invalidateCorpus clears this root', async () => {
    installGh([]);
    const root = tmpRoot();
    write(root, { id: 'IDEA-1', title: 'A', type: 'feat', created: '2026-07-01', body: 'x' });

    const first = await readCorpus(root, { live: true });
    invalidateCorpus(root);
    const second = await readCorpus(root, { live: true });
    expect(second).not.toBe(first);
    expect(second.entries.map((e) => e.id)).toEqual(['IDEA-1']);
  });

  it('reloads once a file under the ideas dir changes, even without an explicit invalidation', async () => {
    installGh([]);
    const root = tmpRoot();
    write(root, { id: 'IDEA-1', title: 'A', type: 'feat', created: '2026-07-01', body: 'x' });

    const first = await readCorpus(root, { live: true });
    write(root, { id: 'IDEA-2', title: 'B', type: 'feat', created: '2026-07-02', body: 'x' });
    const second = await readCorpus(root, { live: true });
    expect(second.entries.map((e) => e.id).sort()).toEqual(['IDEA-1', 'IDEA-2']);
    expect(first.entries.map((e) => e.id)).toEqual(['IDEA-1']);
  });
});

function writeConfig(root: string, nextIdeaId = 2): void {
  writeFileSync(
    join(root, 'papercamp', 'config.json'),
    `${JSON.stringify({ nextId: { idea: nextIdeaId } }, null, 2)}\n`,
  );
}

describe('updateEntity', () => {
  it('mutates fields, stamps updated, and invalidates the cached snapshot', async () => {
    installGh([]);
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'A',
      type: 'feat',
      status: 'planned',
      created: '2026-07-01',
      body: 'x',
    });
    await readCorpus(root, { live: true });

    const entry = await updateEntity(root, 'IDEA-1', () => ({ title: 'Renamed' }));
    expect(entry.title).toBe('Renamed');

    const { entries } = await readEntities(ideasDirOf(root));
    const onDisk = entries.find((e) => e.id === 'IDEA-1');
    expect(onDisk?.title).toBe('Renamed');
    expect(onDisk?.updated).toBeTruthy();
  });

  it('resolves an archived entity and writes it back in place', async () => {
    const root = tmpRoot();
    write(
      root,
      {
        id: 'IDEA-1',
        title: 'Archived',
        type: 'fix',
        status: 'done',
        created: '2026-06-01',
        body: 'x',
      },
      true,
    );

    await updateEntity(root, 'IDEA-1', () => ({ subject: 'area' }));

    const { entries } = await readEntities(ideasDirOf(root));
    const onDisk = entries.find((e) => e.id === 'IDEA-1');
    expect(onDisk?.archived).toBe(true);
    expect(onDisk?.subject).toBe('area');
  });

  it('skips the write entirely when mutate returns undefined', async () => {
    const root = tmpRoot();
    write(root, { id: 'IDEA-1', title: 'A', type: 'feat', created: '2026-07-01', body: 'x' });
    const before = readEntities(ideasDirOf(root));

    const entry = await updateEntity(root, 'IDEA-1', () => undefined);
    expect(entry.title).toBe('A');
    const { entries } = await readEntities(ideasDirOf(root));
    expect((await before).entries[0].updated).toBe(entries[0].updated);
  });

  it('throws a 404 CorpusError for an id that does not resolve to a file', async () => {
    const root = tmpRoot();
    await expect(updateEntity(root, 'IDEA-99', () => ({ title: 'x' }))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('refuses a phase-add, fix-add, body edit, or status reopen on a done/archived entity', async () => {
    const root = tmpRoot();
    write(
      root,
      {
        id: 'IDEA-1',
        title: 'Done',
        type: 'feat',
        status: 'done',
        created: '2026-06-01',
        body: 'x',
        phases: [{ text: 'One', done: true }],
      },
      true,
    );

    await expect(
      updateEntity(root, 'IDEA-1', (entry) => ({
        phases: [...entry.phases, { text: 'Two', done: false }],
      })),
    ).rejects.toThrow(CorpusError);
    await expect(
      updateEntity(root, 'IDEA-1', (entry) => ({
        fixes: [...(entry.fixes ?? []), { text: 'Fix', done: false }],
      })),
    ).rejects.toThrow(CorpusError);
    await expect(updateEntity(root, 'IDEA-1', () => ({ body: 'new body' }))).rejects.toThrow(
      CorpusError,
    );
    await expect(updateEntity(root, 'IDEA-1', () => ({ status: 'in-progress' }))).rejects.toThrow(
      CorpusError,
    );
  });

  it('still allows status/thread/subject edits on a done/archived entity', async () => {
    const root = tmpRoot();
    write(
      root,
      {
        id: 'IDEA-1',
        title: 'Done',
        type: 'feat',
        status: 'done',
        created: '2026-06-01',
        body: 'x',
      },
      true,
    );

    const entry = await updateEntity(root, 'IDEA-1', () => ({ subject: 'area' }));
    expect(entry.subject).toBe('area');
  });

  it('archives a non-archived entity whose status moves to dropped', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'A',
      type: 'feat',
      status: 'in-progress',
      created: '2026-07-01',
      body: 'x',
    });

    await updateEntity(root, 'IDEA-1', () => ({ status: 'dropped' }));

    const { entries } = await readEntities(ideasDirOf(root));
    const onDisk = entries.find((e) => e.id === 'IDEA-1');
    expect(onDisk?.archived).toBe(true);
    expect(onDisk?.status).toBe('dropped');
  });

  it('unarchives an archived entity whose status override is cleared', async () => {
    const root = tmpRoot();
    write(
      root,
      {
        id: 'IDEA-1',
        title: 'A',
        type: 'feat',
        status: 'dropped',
        created: '2026-07-01',
        body: 'x',
      },
      true,
    );

    await updateEntity(root, 'IDEA-1', () => ({ status: undefined }));

    const { entries } = await readEntities(ideasDirOf(root));
    const onDisk = entries.find((e) => e.id === 'IDEA-1');
    expect(onDisk?.archived).toBe(false);
    expect(onDisk?.status).toBeUndefined();
  });
});

describe('appendThread', () => {
  it('appends a message to the entity thread', async () => {
    const root = tmpRoot();
    write(root, { id: 'IDEA-1', title: 'A', type: 'feat', created: '2026-07-01', body: 'x' });

    await appendThread(root, 'IDEA-1', { kind: 'log', date: '2026-07-02', text: 'did a thing' });

    const { entries } = await readEntities(ideasDirOf(root));
    expect(entries[0].thread).toEqual([{ kind: 'log', date: '2026-07-02', text: 'did a thing' }]);
  });

  it('still appends to a done/archived entity, unlike a phase or body edit', async () => {
    const root = tmpRoot();
    write(
      root,
      {
        id: 'IDEA-1',
        title: 'Done',
        type: 'feat',
        status: 'done',
        created: '2026-06-01',
        body: 'x',
      },
      true,
    );

    await appendThread(root, 'IDEA-1', { kind: 'note', text: 'late note', state: 'open' });

    const { entries } = await readEntities(ideasDirOf(root));
    expect(entries[0].thread).toHaveLength(1);
  });
});

describe('createIdea', () => {
  it('mints a plain idea with status: idea by default', async () => {
    const root = tmpRoot();
    writeConfig(root);

    const id = await createIdea(root, { title: 'New idea', content: 'Body text' });
    expect(id).toBe('IDEA-2');

    const { entries } = await readEntities(ideasDirOf(root));
    const created = entries.find((e) => e.id === id);
    expect(created?.title).toBe('New idea');
    expect(created?.status).toBe('idea');
    expect(created?.body).toBe('Body text');
  });

  it('mints a linked fix without defaulting its status', async () => {
    const root = tmpRoot();
    writeConfig(root);

    const id = await createIdea(root, {
      title: 'Follow-up fix',
      kind: 'fix',
      idea: 'IDEA-1',
      phases: [{ text: 'Do it', done: false }],
    });

    const { entries } = await readEntities(ideasDirOf(root));
    const created = entries.find((e) => e.id === id);
    expect(created?.kind).toBe('fix');
    expect(created?.idea).toBe('IDEA-1');
    expect(created?.status).toBeUndefined();
    expect(created?.phases).toHaveLength(1);
  });
});
