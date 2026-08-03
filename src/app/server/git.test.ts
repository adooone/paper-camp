import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { PlanEntry } from '../../types';
import { createGitManager } from './git';

// Every test works against a real throwaway git repo: createGitManager shells out to
// the git binary, and the bugs this file guards against (a fresh feature branch
// reported as stale) live in how real git answers `branch --merged` / `rev-list`,
// not in anything a mock would exercise.
//
// Managers are created with watching disabled: the recursive fs watchers live for
// the whole process, and Node's recursive-watch fallback crashes with an uncatchable
// ENOENT when afterAll deletes the temp repos out from under them.
const gitManager = (root: string) => createGitManager(root, { watch: false });

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

async function initRepo(branch = 'main'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-git-test-'));
  roots.push(root);
  git(root, 'init', '-b', branch);
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'hello\n');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'initial commit');
  return root;
}

async function commitFile(root: string, name: string, content: string, message: string) {
  await writeFile(join(root, name), content);
  git(root, 'add', '--', name);
  git(root, 'commit', '-m', message);
}

/** Creates a bare repo, wires it up as `origin`, and pushes main with upstream set. */
async function addOrigin(root: string): Promise<string> {
  const remote = await mkdtemp(join(tmpdir(), 'papercamp-git-remote-'));
  roots.push(remote);
  git(remote, 'init', '--bare', '-b', 'main');
  git(root, 'remote', 'add', 'origin', remote);
  git(root, 'push', '-u', 'origin', 'main');
  return remote;
}

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'Some plan',
  status: 'planned',
  created: '2026-07-01',
  tags: [],
  body: '',
  phases: [],
  ...overrides,
});

describe('getBranchHygieneStatus', () => {
  it('reports a fresh feature branch at main tip as fine, not stale', async () => {
    // Regression: `git branch --merged main` lists a branch whose tip equals main's,
    // so without the behind-count guard a just-created branch looked "stale-merged".
    const root = await initRepo();
    git(root, 'checkout', '-b', 'feat/feat-1-new-work');
    const manager = gitManager(root);
    expect(await manager.getBranchHygieneStatus()).toBe('fine');
  });

  it('reports a fresh feature branch with uncommitted work as dirty, not stale', async () => {
    const root = await initRepo();
    git(root, 'checkout', '-b', 'feat/feat-1-new-work');
    await writeFile(join(root, 'wip.txt'), 'work in progress\n');
    const manager = gitManager(root);
    expect(await manager.getBranchHygieneStatus()).toBe('dirty');
  });

  it('reports a branch with unmerged local commits as fine', async () => {
    const root = await initRepo();
    git(root, 'checkout', '-b', 'feat/feat-2-active');
    await commitFile(root, 'feature.txt', 'new feature\n', 'add feature');
    const manager = gitManager(root);
    expect(await manager.getBranchHygieneStatus()).toBe('fine');
  });

  it('reports stale-merged after a no-ff merge into main (PR-style merge)', async () => {
    const root = await initRepo();
    git(root, 'checkout', '-b', 'feat/feat-3-done');
    await commitFile(root, 'feature.txt', 'done\n', 'finish feature');
    git(root, 'checkout', 'main');
    git(root, 'merge', '--no-ff', '-m', 'merge feature', 'feat/feat-3-done');
    git(root, 'checkout', 'feat/feat-3-done');
    const manager = gitManager(root);
    expect(await manager.getBranchHygieneStatus()).toBe('stale-merged');
  });

  it('reports stale-merged after a ff merge once main advances past the branch', async () => {
    const root = await initRepo();
    git(root, 'checkout', '-b', 'feat/feat-4-done');
    await commitFile(root, 'feature.txt', 'done\n', 'finish feature');
    git(root, 'checkout', 'main');
    git(root, 'merge', '--ff-only', 'feat/feat-4-done');
    await commitFile(root, 'later.txt', 'later\n', 'later work on main');
    git(root, 'checkout', 'feat/feat-4-done');
    const manager = gitManager(root);
    expect(await manager.getBranchHygieneStatus()).toBe('stale-merged');
  });

  it('reports stale-merged even when the working tree is dirty', async () => {
    const root = await initRepo();
    git(root, 'checkout', '-b', 'feat/feat-5-done');
    await commitFile(root, 'feature.txt', 'done\n', 'finish feature');
    git(root, 'checkout', 'main');
    git(root, 'merge', '--no-ff', '-m', 'merge feature', 'feat/feat-5-done');
    git(root, 'checkout', 'feat/feat-5-done');
    await writeFile(join(root, 'stray.txt'), 'stray\n');
    const manager = gitManager(root);
    expect(await manager.getBranchHygieneStatus()).toBe('stale-merged');
  });

  it('reports stale-merged via origin/main when the local main ref is stale', async () => {
    // The real workflow: PR merged on the remote, local main never checked out
    // since — comparing against local main alone never sees the merge.
    const root = await initRepo();
    await addOrigin(root);
    git(root, 'checkout', '-b', 'feat/feat-6-done');
    await commitFile(root, 'feature.txt', 'done\n', 'finish feature');
    git(root, 'checkout', 'main');
    git(root, 'merge', '--no-ff', '-m', 'merge feature', 'feat/feat-6-done');
    git(root, 'push', 'origin', 'main');
    git(root, 'reset', '--hard', 'HEAD~1');
    git(root, 'checkout', 'feat/feat-6-done');
    const manager = gitManager(root);
    expect(await manager.getBranchHygieneStatus()).toBe('stale-merged');
  });

  it('reports fine for a fresh branch cut from a stale local main', async () => {
    // Regression: with origin/main as the merged-ness reference, a zero-commit
    // branch from a lagging local main is an ancestor of origin/main and behind
    // it — the exact stale-merged signature, but nothing was ever merged.
    const root = await initRepo();
    await addOrigin(root);
    await commitFile(root, 'later.txt', 'later\n', 'later work on main');
    git(root, 'push', 'origin', 'main');
    git(root, 'reset', '--hard', 'HEAD~1');
    git(root, 'checkout', '-b', 'feat/feat-9-fresh');
    const manager = gitManager(root);
    expect(await manager.getBranchHygieneStatus()).toBe('fine');
  });

  it('reports clean-on-main on a clean main checkout', async () => {
    const root = await initRepo();
    const manager = gitManager(root);
    expect(await manager.getBranchHygieneStatus()).toBe('clean-on-main');
  });

  it('reports dirty on main with uncommitted changes', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'README.md'), 'changed\n');
    const manager = gitManager(root);
    expect(await manager.getBranchHygieneStatus()).toBe('dirty');
  });

  it('treats master like main', async () => {
    const root = await initRepo('master');
    const manager = gitManager(root);
    expect(await manager.getBranchHygieneStatus()).toBe('clean-on-main');
  });
});

describe('isMergedIntoMain', () => {
  it('returns false on main itself', async () => {
    const root = await initRepo();
    const manager = gitManager(root);
    expect(await manager.isMergedIntoMain()).toBe(false);
  });

  it('returns true for a fresh branch still at main tip', async () => {
    // This is why getBranchHygieneStatus needs the behind-count guard: git considers
    // a zero-commit branch "merged" the moment it is created.
    const root = await initRepo();
    git(root, 'checkout', '-b', 'feat/feat-1-fresh');
    const manager = gitManager(root);
    expect(await manager.isMergedIntoMain()).toBe(true);
  });

  it('returns false for a branch with commits not on main', async () => {
    const root = await initRepo();
    git(root, 'checkout', '-b', 'feat/feat-2-active');
    await commitFile(root, 'feature.txt', 'new\n', 'add feature');
    const manager = gitManager(root);
    expect(await manager.isMergedIntoMain()).toBe(false);
  });
});

describe('runGitSync', () => {
  it('carries uncommitted and untracked changes onto main', async () => {
    const root = await initRepo();
    await addOrigin(root);
    git(root, 'checkout', '-b', 'feat/feat-7-done');
    await writeFile(join(root, 'README.md'), 'edited\n');
    await writeFile(join(root, 'notes.txt'), 'untracked\n');
    const manager = gitManager(root);

    await manager.runGitSync();

    expect(manager.getCurrentBranch()).toBe('main');
    expect(await readFile(join(root, 'README.md'), 'utf-8')).toBe('edited\n');
    expect(await readFile(join(root, 'notes.txt'), 'utf-8')).toBe('untracked\n');
    expect(git(root, 'stash', 'list')).toBe('');
  });

  it('restores staged changes as staged, not just as a working-tree edit', async () => {
    // Regression: a bare `git stash pop` drops the index, so a file staged
    // before sync would land back unstaged afterward.
    const root = await initRepo();
    await addOrigin(root);
    git(root, 'checkout', '-b', 'feat/feat-9-staged');
    await writeFile(join(root, 'README.md'), 'staged edit\n');
    git(root, 'add', 'README.md');
    const manager = gitManager(root);

    await manager.runGitSync();

    expect(git(root, 'diff', '--cached', '--name-only')).toBe('README.md');
  });

  it('leaves a pre-existing unrelated stash alone', async () => {
    const root = await initRepo();
    await addOrigin(root);
    git(root, 'checkout', '-b', 'feat/feat-10-prestash');
    await writeFile(join(root, 'pre.txt'), 'pre-existing\n');
    git(root, 'add', 'pre.txt');
    git(root, 'stash', 'push', '-m', 'unrelated-pre-existing-stash');
    await writeFile(join(root, 'README.md'), 'edited\n');
    const manager = gitManager(root);

    await manager.runGitSync();

    expect(await readFile(join(root, 'README.md'), 'utf-8')).toBe('edited\n');
    expect(git(root, 'stash', 'list')).toContain('unrelated-pre-existing-stash');
  });

  it('keeps a local run-order.md edit that differs from origin/main, unlike the generated ideas index', async () => {
    // run-order.md is intent (a chosen queue), so it must survive sync like any other
    // hand-edited file — unlike ideas/index.md, which is derived output safe to drop
    // and rebuild from the merged entities.
    const root = await initRepo();
    await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
    await writeFile(join(root, 'papercamp', 'run-order.md'), 'IDEA-1 — first\n');
    await writeFile(join(root, 'papercamp', 'ideas', 'index.md'), 'stale index\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'add run-order and ideas index');
    await addOrigin(root);
    git(root, 'checkout', '-b', 'feat/feat-11-runorder');
    await writeFile(join(root, 'papercamp', 'run-order.md'), 'IDEA-2 — second\nIDEA-1 — first\n');
    await writeFile(join(root, 'papercamp', 'ideas', 'index.md'), 'locally edited index\n');
    const manager = gitManager(root);

    await manager.runGitSync();

    expect(await readFile(join(root, 'papercamp', 'run-order.md'), 'utf-8')).toBe(
      'IDEA-2 — second\nIDEA-1 — first\n',
    );
    expect(await readFile(join(root, 'papercamp', 'ideas', 'index.md'), 'utf-8')).toBe(
      'stale index\n',
    );
  });

  it('rebases a diverged local main onto origin instead of failing', async () => {
    // The recurring "split": a direct-to-main commit sits locally while origin/main
    // advances via a squash-merge. Sync must replay the local commit on top, not fail.
    const root = await initRepo();
    await addOrigin(root);
    // origin/main advances by one commit that local main never saw.
    await commitFile(root, 'remote.txt', 'from remote\n', 'remote-only change');
    git(root, 'push', 'origin', 'main');
    git(root, 'reset', '--hard', 'HEAD~1');
    // local main gets its own commit — now diverged from origin/main.
    await commitFile(root, 'local.txt', 'from local\n', 'local-only change');
    const manager = gitManager(root);

    await manager.runGitSync();

    expect(manager.getCurrentBranch()).toBe('main');
    expect(await readFile(join(root, 'remote.txt'), 'utf-8')).toBe('from remote\n');
    expect(await readFile(join(root, 'local.txt'), 'utf-8')).toBe('from local\n');
    // Linear history: the local commit was replayed on top of the remote one.
    expect(git(root, 'log', '--oneline').split('\n')[0]).toContain('local-only change');
    expect(git(root, 'rev-list', '--count', 'main')).toBe('3');
  });

  it('reports a pop conflict and keeps the changes in the stash', async () => {
    const root = await initRepo();
    await addOrigin(root);
    git(root, 'checkout', '-b', 'feat/feat-8-conflict');
    // Conflicting upstream: main's README moves on the remote while the local
    // main ref stays behind, so the ff-merge is what brings the conflict in.
    git(root, 'checkout', 'main');
    await commitFile(root, 'README.md', 'upstream\n', 'upstream change');
    git(root, 'push', 'origin', 'main');
    git(root, 'reset', '--hard', 'HEAD~1');
    git(root, 'checkout', 'feat/feat-8-conflict');
    await writeFile(join(root, 'README.md'), 'local edit\n');
    const manager = gitManager(root);

    const result = await manager.runGitSync();
    expect(result).toMatchObject({ ok: false, stage: 'stash-pop', stashPending: true });
    expect((result as { message: string }).message).toMatch(/git stash/);
    expect(manager.getCurrentBranch()).toBe('main');
    expect(git(root, 'stash', 'list')).toContain('papercamp-sync');
  });
});

describe('fixDivergence', () => {
  it('rebases a diverged branch onto its remote instead of failing', async () => {
    const root = await initRepo();
    await addOrigin(root);
    // origin/main advances by one commit the local branch never saw.
    await commitFile(root, 'remote.txt', 'from remote\n', 'remote-only change');
    git(root, 'push', 'origin', 'main');
    git(root, 'reset', '--hard', 'HEAD~1');
    // local main gets its own commit — now diverged from origin/main.
    await commitFile(root, 'local.txt', 'from local\n', 'local-only change');
    const manager = gitManager(root);

    const result = await manager.fixDivergence();

    expect(result).toEqual({ ok: true });
    expect(await readFile(join(root, 'remote.txt'), 'utf-8')).toBe('from remote\n');
    expect(await readFile(join(root, 'local.txt'), 'utf-8')).toBe('from local\n');
    expect(git(root, 'log', '--oneline').split('\n')[0]).toContain('local-only change');
  });

  it('reports a reconcile conflict with a recovery prompt instead of throwing', async () => {
    const root = await initRepo();
    await addOrigin(root);
    await commitFile(root, 'README.md', 'upstream\n', 'upstream change');
    git(root, 'push', 'origin', 'main');
    git(root, 'reset', '--hard', 'HEAD~1');
    await commitFile(root, 'README.md', 'local change\n', 'local change');
    const manager = gitManager(root);

    const result = await manager.fixDivergence();

    expect(result).toMatchObject({ ok: false, stage: 'reconcile', stashPending: false });
    expect((result as { message: string }).message).toMatch(/conflict/);
    expect((result as { recoveryPrompt: string }).recoveryPrompt).toContain('main');
    // The aborted rebase must not leave the repo mid-conflict.
    expect(git(root, 'log', '--oneline', '-1')).toContain('local change');
  });

  it('reconciles an unpushed feature branch against origin/main, not a nonexistent upstream', async () => {
    const root = await initRepo();
    await addOrigin(root);
    git(root, 'checkout', '-b', 'feat/feat-9-unpushed');
    await commitFile(root, 'feature.txt', 'feature work\n', 'feature commit');
    // origin/main advances while the branch, never pushed, has no origin/<branch>.
    git(root, 'checkout', 'main');
    await commitFile(root, 'remote.txt', 'from remote\n', 'remote-only change');
    git(root, 'push', 'origin', 'main');
    git(root, 'checkout', 'feat/feat-9-unpushed');
    const manager = gitManager(root);

    const result = await manager.fixDivergence();

    expect(result).toEqual({ ok: true });
    expect(await readFile(join(root, 'remote.txt'), 'utf-8')).toBe('from remote\n');
    expect(await readFile(join(root, 'feature.txt'), 'utf-8')).toBe('feature work\n');
  });
});

describe('getAheadCount', () => {
  it('counts commits past the upstream when one is configured', async () => {
    const root = await initRepo();
    await addOrigin(root);
    const manager = gitManager(root);
    expect(await manager.getAheadCount()).toBe(0);
    await commitFile(root, 'a.txt', 'a\n', 'local commit');
    expect(await manager.getAheadCount()).toBe(1);
  });

  it('counts commits missing from every remote-tracking branch when no upstream is set', async () => {
    const root = await initRepo();
    await addOrigin(root);
    git(root, 'checkout', '-b', 'feat/feat-1-unpushed');
    await commitFile(root, 'a.txt', 'a\n', 'branch commit');
    const manager = gitManager(root);
    // Only the one new commit counts — history already on origin/main does not.
    expect(await manager.getAheadCount()).toBe(1);
  });

  it('counts every local commit when the repo has no remotes at all', async () => {
    const root = await initRepo();
    await commitFile(root, 'a.txt', 'a\n', 'second commit');
    const manager = gitManager(root);
    expect(await manager.getAheadCount()).toBe(2);
  });
});

describe('ensureBranch', () => {
  it('creates and checks out a kind/id-title branch, slugging the title', async () => {
    const root = await initRepo();
    const manager = gitManager(root);
    manager.ensureBranch(plan({ kind: 'feat', id: 'IDEA-42', title: 'Add User Auth!' }));
    expect(manager.getCurrentBranch()).toBe('feat/idea-42-add-user-auth');
  });

  it('branches from main even when currently on another branch', async () => {
    const root = await initRepo();
    const mainSha = git(root, 'rev-parse', 'HEAD');
    git(root, 'checkout', '-b', 'other-branch');
    await commitFile(root, 'other.txt', 'other\n', 'other work');
    const manager = gitManager(root);
    manager.ensureBranch(plan({ kind: 'fix', id: 'IDEA-1', title: 'Small fix' }));
    expect(manager.getCurrentBranch()).toBe('fix/idea-1-small-fix');
    expect(git(root, 'rev-parse', 'HEAD')).toBe(mainSha);
  });

  it('is a no-op when already on the plan branch', async () => {
    const root = await initRepo();
    git(root, 'checkout', '-b', 'feat/idea-42-add-user-auth');
    const shaBefore = git(root, 'rev-parse', 'HEAD');
    const manager = gitManager(root);
    manager.ensureBranch(plan({ kind: 'feat', id: 'IDEA-42', title: 'Add User Auth!' }));
    expect(manager.getCurrentBranch()).toBe('feat/idea-42-add-user-auth');
    expect(git(root, 'rev-parse', 'HEAD')).toBe(shaBefore);
  });

  it('checks out an existing branch instead of failing to recreate it', async () => {
    const root = await initRepo();
    git(root, 'checkout', '-b', 'feat/idea-7-existing-work');
    await commitFile(root, 'work.txt', 'work\n', 'branch work');
    const branchSha = git(root, 'rev-parse', 'HEAD');
    git(root, 'checkout', 'main');
    const manager = gitManager(root);
    manager.ensureBranch(plan({ kind: 'feat', id: 'IDEA-7', title: 'Existing work' }));
    expect(manager.getCurrentBranch()).toBe('feat/idea-7-existing-work');
    // Prior work on the branch is kept — not reset to main.
    expect(git(root, 'rev-parse', 'HEAD')).toBe(branchSha);
  });

  it('does nothing when the entity has no id', async () => {
    const root = await initRepo();
    const manager = gitManager(root);
    manager.ensureBranch(plan({ title: 'No id yet' }));
    expect(manager.getCurrentBranch()).toBe('main');
  });

  it('defaults the branch prefix to feat for an untyped entity', async () => {
    const root = await initRepo();
    const manager = gitManager(root);
    manager.ensureBranch(plan({ id: 'IDEA-9', title: 'Untyped work' }));
    expect(manager.getCurrentBranch()).toBe('feat/idea-9-untyped-work');
  });
});

describe('getFeatureBranchPlanId', () => {
  it('extracts the plan id from a kind/id-title branch', async () => {
    const root = await initRepo();
    git(root, 'checkout', '-b', 'feat/feat-30-run-all-phases');
    const manager = gitManager(root);
    expect(manager.getFeatureBranchPlanId()).toBe('FEAT-30');
  });

  it('returns null on main and on branches without the pattern', async () => {
    const root = await initRepo();
    const manager = gitManager(root);
    expect(manager.getFeatureBranchPlanId()).toBeNull();
    git(root, 'checkout', '-b', 'random-branch');
    expect(manager.getFeatureBranchPlanId()).toBeNull();
  });
});

describe('getStatus', () => {
  it('parses untracked, unstaged, and staged entries', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'untracked.txt'), 'new\n');
    await writeFile(join(root, 'README.md'), 'modified\n');
    await commitFile(root, 'staged.txt', 'v1\n', 'add staged.txt');
    await writeFile(join(root, 'staged.txt'), 'v2\n');
    git(root, 'add', '--', 'staged.txt');
    const manager = gitManager(root);
    const entries = await manager.getStatus();
    expect(entries).toContainEqual(
      expect.objectContaining({ path: 'untracked.txt', status: '??', staged: false }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ path: 'README.md', status: ' M', staged: false }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ path: 'staged.txt', status: 'M ', staged: true }),
    );
  });

  it('parses a staged rename with its source path', async () => {
    const root = await initRepo();
    await commitFile(root, 'old-name.txt', 'content\n', 'add file');
    git(root, 'mv', 'old-name.txt', 'new-name.txt');
    const manager = gitManager(root);
    const entries = await manager.getStatus();
    expect(entries).toContainEqual(
      expect.objectContaining({
        path: 'new-name.txt',
        status: 'R ',
        staged: true,
        renameSource: 'old-name.txt',
      }),
    );
  });
});

describe('commit', () => {
  it('commits only the selected files, leaving other changes untouched', async () => {
    const root = await initRepo();
    await commitFile(root, 'a.txt', 'a1\n', 'add a');
    await commitFile(root, 'b.txt', 'b1\n', 'add b');
    await writeFile(join(root, 'a.txt'), 'a2\n');
    await writeFile(join(root, 'b.txt'), 'b2\n');
    const manager = gitManager(root);
    await manager.commit(['a.txt'], 'change a only');
    const committed = git(root, 'show', '--name-only', '--format=', 'HEAD');
    expect(committed).toContain('a.txt');
    expect(committed).not.toContain('b.txt');
    const entries = await manager.getStatus();
    expect(entries).toContainEqual(expect.objectContaining({ path: 'b.txt', status: ' M' }));
  });

  it('stages and commits an untracked file', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'new.txt'), 'new\n');
    const manager = gitManager(root);
    await manager.commit(['new.txt'], 'add new file');
    expect(git(root, 'show', '--name-only', '--format=', 'HEAD')).toContain('new.txt');
    expect(await manager.getStatus()).toEqual([]);
  });

  it('handles a file that is already fully staged', async () => {
    // `git add` on a path with nothing left to stage fails with "did not match any
    // files" — the commit path must skip the add for those.
    const root = await initRepo();
    await writeFile(join(root, 'README.md'), 'staged change\n');
    git(root, 'add', '--', 'README.md');
    const manager = gitManager(root);
    await manager.commit(['README.md'], 'commit staged change');
    expect(await manager.getStatus()).toEqual([]);
  });

  it('commits whatever is staged when the selection is empty', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'README.md'), 'staged change\n');
    git(root, 'add', '--', 'README.md');
    const manager = gitManager(root);
    await manager.commit([], 'commit staged');
    expect(git(root, 'log', '-1', '--format=%s')).toBe('commit staged');
    expect(await manager.getStatus()).toEqual([]);
  });

  it('includes the body as a second -m paragraph', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'README.md'), 'change\n');
    const manager = gitManager(root);
    await manager.commit(['README.md'], 'title line', 'body paragraph');
    expect(git(root, 'log', '-1', '--format=%B')).toContain('body paragraph');
  });

  it('commits a staged rename including the old path, not as a copy', async () => {
    // A pathspec-limited commit of only the new path records the add but leaves the
    // old path's staged deletion behind — HEAD keeps both files (rename becomes copy).
    const root = await initRepo();
    await commitFile(root, 'old-name.txt', 'content\n', 'add file');
    git(root, 'mv', 'old-name.txt', 'new-name.txt');
    const manager = gitManager(root);
    await manager.commit(['new-name.txt'], 'rename the file');
    expect(await manager.getStatus()).toEqual([]);
    const headFiles = git(root, 'ls-tree', '--name-only', 'HEAD');
    expect(headFiles).toContain('new-name.txt');
    expect(headFiles).not.toContain('old-name.txt');
  });

  it("rejects with git's stdout explanation when there is nothing to commit", async () => {
    // git writes "nothing to commit" to stdout, not stderr — a rejection built from
    // stderr alone would surface only a contentless "exited with code 1".
    const root = await initRepo();
    const manager = gitManager(root);
    await expect(manager.commit([], 'commit staged')).rejects.toThrow(/nothing to commit/);
  });

  it('handles non-ASCII filenames without octal quoting', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'файл.md'), 'вміст\n');
    const manager = gitManager(root);
    const entries = await manager.getStatus();
    expect(entries).toContainEqual(expect.objectContaining({ path: 'файл.md', status: '??' }));
    await manager.commit(['файл.md'], 'add cyrillic file');
    expect(await manager.getStatus()).toEqual([]);
  });

  it('treats selected paths literally instead of as glob pathspecs', async () => {
    const root = await initRepo();
    await commitFile(root, 'a*.txt', 'glob1\n', 'add glob-named file');
    await commitFile(root, 'ab.txt', 'ab1\n', 'add ab');
    await writeFile(join(root, 'a*.txt'), 'glob2\n');
    await writeFile(join(root, 'ab.txt'), 'ab2\n');
    const manager = gitManager(root);
    await manager.commit(['a*.txt'], 'change glob-named file only');
    // Without :(literal), the `a*.txt` pathspec would also sweep in ab.txt.
    const entries = await manager.getStatus();
    expect(entries).toContainEqual(expect.objectContaining({ path: 'ab.txt', status: ' M' }));
    expect(entries).toHaveLength(1);
  });
});

describe('diff', () => {
  it('returns an empty string for an empty selection', async () => {
    const root = await initRepo();
    const manager = gitManager(root);
    expect(await manager.diff([])).toBe('');
  });

  it('includes tracked modifications as a unified diff', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'README.md'), 'changed\n');
    const manager = gitManager(root);
    const output = await manager.diff(['README.md']);
    expect(output).toContain('-hello');
    expect(output).toContain('+changed');
  });

  it('includes untracked file content as a new-file block', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'brand-new.txt'), 'fresh content\n');
    const manager = gitManager(root);
    const output = await manager.diff(['brand-new.txt']);
    expect(output).toContain('+++ b/brand-new.txt');
    expect(output).toContain('(new file)');
    expect(output).toContain('fresh content');
  });

  it('refuses to diff sensitive files', async () => {
    const root = await initRepo();
    await writeFile(join(root, '.env'), 'SECRET=1\n');
    const manager = gitManager(root);
    await expect(manager.diff(['.env'])).rejects.toThrow(/sensitive/);
    await expect(manager.diff(['config/.env.production'])).rejects.toThrow(/sensitive/);
    await expect(manager.diff(['certs/server.pem'])).rejects.toThrow(/sensitive/);
  });

  it('skips a file renamed from a sensitive source', async () => {
    const root = await initRepo();
    await commitFile(root, '.env', 'SECRET=1\n', 'add env');
    git(root, 'mv', '.env', 'settings.txt');
    const manager = gitManager(root);
    expect(await manager.diff(['settings.txt'])).toBe('');
  });

  it('omits symlink content instead of following the target', async () => {
    const root = await initRepo();
    await symlink('/etc/hostname', join(root, 'sneaky-link'));
    const manager = gitManager(root);
    const output = await manager.diff(['sneaky-link']);
    expect(output).toContain('(new file omitted: symlink)');
  });

  it('omits untracked files larger than the size cap', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'big.txt'), 'x'.repeat(500));
    const manager = gitManager(root);
    const output = await manager.diff(['big.txt'], 200);
    expect(output).toContain('(new file omitted: exceeds diff size cap)');
  });

  it('truncates combined output past the size cap', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'README.md'), `${'y'.repeat(500)}\n`);
    const manager = gitManager(root);
    const output = await manager.diff(['README.md'], 100);
    expect(output).toContain('... (truncated)');
    expect(output.length).toBeLessThan(200);
  });
});

describe('getWorkingDiff', () => {
  it('returns an empty list for a clean working tree', async () => {
    const root = await initRepo();
    const manager = gitManager(root);
    expect(await manager.getWorkingDiff()).toEqual([]);
  });

  it('reports add/remove counts for a tracked modification', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'README.md'), 'changed\n');
    const manager = gitManager(root);
    const [entry] = await manager.getWorkingDiff();
    expect(entry).toMatchObject({
      path: 'README.md',
      staged: false,
      binary: false,
      additions: 1,
      deletions: 1,
    });
    expect(entry.patch).toContain('-hello');
    expect(entry.patch).toContain('+changed');
  });

  it('reports an untracked file as all additions', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'brand-new.txt'), 'one\ntwo\n');
    const manager = gitManager(root);
    const [entry] = await manager.getWorkingDiff();
    expect(entry).toMatchObject({
      path: 'brand-new.txt',
      staged: false,
      binary: false,
      additions: 3,
      deletions: 0,
    });
    expect(entry.patch).toContain('one\ntwo\n');
  });

  it('combines staged and unstaged changes into one entry', async () => {
    const root = await initRepo();
    await commitFile(root, 'file.txt', 'v1\n', 'add file');
    await writeFile(join(root, 'file.txt'), 'v2\n');
    git(root, 'add', '--', 'file.txt');
    await writeFile(join(root, 'file.txt'), 'v3\n');
    const manager = gitManager(root);
    const [entry] = await manager.getWorkingDiff();
    expect(entry.path).toBe('file.txt');
    expect(entry.staged).toBe(true);
    expect(entry.patch).toContain('-v1');
    expect(entry.patch).toContain('+v3');
  });

  it('carries the rename source and includes it in the patch', async () => {
    const root = await initRepo();
    await commitFile(root, 'old-name.txt', 'content\n', 'add file');
    git(root, 'mv', 'old-name.txt', 'new-name.txt');
    const manager = gitManager(root);
    const [entry] = await manager.getWorkingDiff();
    expect(entry).toMatchObject({
      path: 'new-name.txt',
      renameSource: 'old-name.txt',
      staged: true,
    });
    expect(entry.patch).toContain('rename from old-name.txt');
  });

  it('collapses a rename with unrelated content instead of a full re-add', async () => {
    // Below git's rename-similarity threshold, `git diff` reports the old path as a
    // full deletion and the new path as a full addition rather than a single rename —
    // getWorkingDiff should still sum both counts and stub the patch, not dump both.
    const root = await initRepo();
    await commitFile(root, 'old-name.txt', 'aaaa\nbbbb\ncccc\ndddd\n', 'add file');
    git(root, 'mv', 'old-name.txt', 'new-name.txt');
    await writeFile(join(root, 'new-name.txt'), 'zzzz\nyyyy\nxxxx\nwwww\n');
    const manager = gitManager(root);
    const [entry] = await manager.getWorkingDiff();
    expect(entry).toMatchObject({
      path: 'new-name.txt',
      renameSource: 'old-name.txt',
      additions: 4,
      deletions: 4,
      patch: '',
    });
  });

  it('marks a binary file as such with zero counts', async () => {
    const root = await initRepo();
    await commitFile(root, 'data.bin', 'v1', 'add binary');
    // Real binary content: bytes git won't treat as text.
    await writeFile(join(root, 'data.bin'), Buffer.from([0, 1, 2, 255, 0, 254]));
    const manager = gitManager(root);
    const [entry] = await manager.getWorkingDiff();
    expect(entry).toMatchObject({
      path: 'data.bin',
      binary: true,
      additions: 0,
      deletions: 0,
      patch: '',
    });
  });

  it('omits untracked symlink content instead of following the target', async () => {
    const root = await initRepo();
    await symlink('/etc/hostname', join(root, 'sneaky-link'));
    const manager = gitManager(root);
    const [entry] = await manager.getWorkingDiff();
    expect(entry).toMatchObject({ path: 'sneaky-link', binary: true, patch: '' });
  });

  it('stubs an untracked file larger than the size cap', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'big.txt'), 'x'.repeat(500));
    const manager = gitManager(root);
    const [entry] = await manager.getWorkingDiff(200);
    expect(entry).toMatchObject({ contentKind: 'too-large', patch: '' });
  });

  it('truncates a tracked patch past the size cap', async () => {
    const root = await initRepo();
    await writeFile(join(root, 'README.md'), `${'y'.repeat(500)}\n`);
    const manager = gitManager(root);
    const [entry] = await manager.getWorkingDiff(100);
    expect(entry.patch).toContain('... (truncated)');
    expect(entry.patch.length).toBeLessThan(200);
  });
});
