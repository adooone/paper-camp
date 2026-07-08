import { spawnSync } from 'node:child_process';
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

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
}

/** A throwaway repo with papercamp/ideas/ at its root, so readEntities can resolve branches. */
function initRepoWithIdeas(): { root: string; ideasDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-readers-test-'));
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  const ideasDir = join(root, 'papercamp', 'ideas');
  mkdirSync(ideasDir, { recursive: true });
  writeFileSync(join(root, 'README.md'), 'hello\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-m', 'init');
  return { root, ideasDir };
}

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

describe('status derivation via git branch existence', () => {
  it('derives in-progress/review from real branches and planned when none exists', async () => {
    const { root, ideasDir } = initRepoWithIdeas();

    // No phases at all -> idea, regardless of the stored override.
    writeFileSync(
      join(ideasDir, 'IDEA-1.md'),
      `${formatEntityFile({
        id: 'IDEA-1',
        title: 'Just an idea',
        type: 'feat',
        created: '2026-07-01',
        body: 'Not planned yet.',
      })}\n`,
    );
    // Phases, no branch -> planned.
    writeFileSync(
      join(ideasDir, 'IDEA-2.md'),
      `${formatEntityFile({
        id: 'IDEA-2',
        title: 'Planned work',
        type: 'feat',
        created: '2026-07-01',
        body: 'Ready to branch.',
        phases: [{ text: 'One', done: false }],
      })}\n`,
    );
    // Phases, branch exists, not all checked -> in-progress.
    writeFileSync(
      join(ideasDir, 'IDEA-3.md'),
      `${formatEntityFile({
        id: 'IDEA-3',
        title: 'Active work',
        type: 'feat',
        created: '2026-07-01',
        body: 'In flight.',
        phases: [
          { text: 'One', done: true },
          { text: 'Two', done: false },
        ],
      })}\n`,
    );
    // Phases, branch exists, all checked -> review.
    writeFileSync(
      join(ideasDir, 'IDEA-4.md'),
      `${formatEntityFile({
        id: 'IDEA-4',
        title: 'Ready for review',
        type: 'feat',
        created: '2026-07-01',
        body: 'Done with phases.',
        phases: [{ text: 'One', done: true }],
      })}\n`,
    );
    git(root, 'branch', 'feat/idea-3-active-work');
    git(root, 'branch', 'feat/idea-4-ready-for-review');

    const { entries } = await readWorkEntries(ideasDir);
    const byId = Object.fromEntries(entries.map((e) => [e.id, e.status]));
    expect(byId['IDEA-1']).toBe('idea');
    expect(byId['IDEA-2']).toBe('planned');
    expect(byId['IDEA-3']).toBe('in-progress');
    expect(byId['IDEA-4']).toBe('review');
  });

  it('does not persist derived status back onto the raw EntityEntry', async () => {
    const { root, ideasDir } = initRepoWithIdeas();
    writeFileSync(
      join(ideasDir, 'IDEA-5.md'),
      `${formatEntityFile({
        id: 'IDEA-5',
        title: 'Active work',
        type: 'feat',
        created: '2026-07-01',
        body: 'In flight.',
        phases: [{ text: 'One', done: false }],
      })}\n`,
    );
    git(root, 'branch', 'feat/idea-5-active-work');

    const { entries } = await readEntities(ideasDir);
    const raw = entries.find((e) => e.id === 'IDEA-5');
    // The stored file never set `status`, so the raw entry stays undefined even
    // though the branch exists and would derive to in-progress in the view layer.
    expect(raw?.status).toBeUndefined();
  });
});
