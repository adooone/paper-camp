import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCorpus } from '@/core/corpus';
import { squashMergePr } from '@/core/git-pr';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { FetchFailedError, createGitManager } from '../git';
import { gitRoutes } from './git';
import type { RouteContext } from './types';

// `spawn` wrapped in a vi.fn so a test can count real git invocations — a bare
// vi.spyOn can't redefine this module's export.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});
const spawnMock = vi.mocked(spawn);

vi.mock('@/core/git-pr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/git-pr')>();
  return { ...actual, squashMergePr: vi.fn() };
});
const squashMergePrMock = vi.mocked(squashMergePr);

vi.mock('@/core/corpus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/corpus')>();
  return { ...actual, readCorpus: vi.fn() };
});
const readCorpusMock = vi.mocked(readCorpus);

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function initGitRepo(commitCount: number): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-git-route-'));
  roots.push(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  for (let i = 0; i < commitCount; i++) {
    writeFileSync(join(root, `file-${i}.txt`), `${i}\n`);
    git(root, 'add', '.');
    git(root, 'commit', '-m', `chore(repo): commit ${i}`);
  }
  return root;
}

function route(
  root: string,
  path: string,
  overrides: {
    git?: RouteContext['git'];
    activity?: { notifyChanged: (area: unknown) => void };
  } = {},
) {
  const found = gitRoutes({
    root,
    git: overrides.git ?? createGitManager(root),
    activity: overrides.activity ?? { notifyChanged: () => {}, publish: () => {} },
  } as RouteContext).find((r) => r.path === path);
  if (!found) throw new Error(`no route registered for ${path}`);
  return found;
}

function fakeReq(url: string): IncomingMessage {
  return { url, headers: {} } as IncomingMessage;
}

function fakeReqWithBody(url: string, body: unknown): IncomingMessage {
  const listeners: Record<string, ((chunk?: string) => void)[]> = {};
  return {
    url,
    headers: {},
    on: (event: string, cb: (chunk?: string) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      if (event === 'end') {
        for (const dataCb of listeners.data ?? []) dataCb(JSON.stringify(body));
        cb();
      }
      return undefined as unknown as IncomingMessage;
    },
  } as unknown as IncomingMessage;
}

function fakeRes(): { res: ServerResponse; status: () => number; json: () => unknown } {
  let statusCode = 0;
  let body = '';
  const res = {
    setHeader: () => {},
    end: (chunk: string) => {
      body = chunk;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
  } as unknown as ServerResponse;
  return { res, status: () => statusCode, json: () => JSON.parse(body) };
}

describe('GET /api/git/status', () => {
  it('reports branch, entries, and hygiene from the combined snapshot', async () => {
    const root = initGitRepo(1);
    writeFileSync(join(root, 'untracked.txt'), 'x\n');
    const { res, status, json } = fakeRes();
    await route(root, '/api/git/status').handle(fakeReq('/api/git/status'), res);
    expect(status()).toBe(200);
    const body = json() as {
      branch: string;
      entries: { path: string }[];
      ahead: number;
      behind: number;
      diverged: boolean;
      branchHygiene: string;
      stashPending: boolean;
      stashes: unknown[];
    };
    expect(body.branch).toBe('main');
    expect(body.entries).toContainEqual(expect.objectContaining({ path: 'untracked.txt' }));
    expect(body.ahead).toBe(0);
    expect(body.behind).toBe(0);
    expect(body.diverged).toBe(false);
    expect(body.branchHygiene).toBe('dirty');
    expect(body.stashPending).toBe(false);
    expect(body.stashes).toEqual([]);
  });

  it('derives stashPending from the stash list, not a separate call', async () => {
    const root = initGitRepo(1);
    writeFileSync(join(root, 'file-0.txt'), 'changed\n');
    git(root, 'stash', 'push', '-m', 'papercamp-sync');
    const { res, json } = fakeRes();
    await route(root, '/api/git/status').handle(fakeReq('/api/git/status'), res);
    const body = json() as { stashPending: boolean };
    expect(body.stashPending).toBe(true);
  });

  it('reports ahead for a branch with no upstream instead of 0', async () => {
    const root = initGitRepo(1);
    git(root, 'checkout', '-b', 'feat/feat-1-no-upstream');
    for (let i = 0; i < 2; i++) {
      writeFileSync(join(root, `own-${i}.txt`), `${i}\n`);
      git(root, 'add', '.');
      git(root, 'commit', '-m', `chore: own commit ${i}`);
    }
    const { res, json } = fakeRes();
    await route(root, '/api/git/status').handle(fakeReq('/api/git/status'), res);
    const body = json() as { ahead: number; behind: number; branchHygiene: string };
    expect(body.ahead).toBe(2);
    expect(body.behind).toBe(0);
    expect(body.branchHygiene).toBe('fine');
  });

  it('spawns at most four git processes on a feature branch', async () => {
    const root = initGitRepo(1);
    git(root, 'checkout', '-b', 'feat/feat-1-work');
    writeFileSync(join(root, 'feature.txt'), 'x\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'feat: own work');
    const manager = createGitManager(root);
    // Prime and let the throttled background origin/main refresh settle before
    // measuring — a fresh manager's first poll fires it (and resolves mainRef
    // cold), but a steady-state poll (the common case — SSE-driven, frequent)
    // hits neither again within the 60s throttle window.
    await route(root, '/api/git/status', { git: manager }).handle(
      fakeReq('/api/git/status'),
      res(),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));

    spawnMock.mockClear();
    await route(root, '/api/git/status', { git: manager }).handle(
      fakeReq('/api/git/status'),
      res(),
    );
    expect(spawnMock.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('spawns exactly four git processes on a stale feature branch behind origin/main', async () => {
    const root = initGitRepo(1);
    const remote = mkdtempSync(join(tmpdir(), 'papercamp-git-remote-'));
    roots.push(remote);
    git(remote, 'init', '--bare', '-b', 'main');
    git(root, 'remote', 'add', 'origin', remote);
    git(root, 'push', '-u', 'origin', 'main');
    git(root, 'checkout', '-b', 'feat/feat-1-done');
    writeFileSync(join(root, 'feature.txt'), 'done\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'finish feature');
    git(root, 'checkout', 'main');
    git(root, 'merge', '--no-ff', '-m', 'merge feature', 'feat/feat-1-done');
    git(root, 'push', 'origin', 'main');
    git(root, 'reset', '--hard', 'HEAD~1');
    git(root, 'checkout', 'feat/feat-1-done');
    const manager = createGitManager(root);
    // Prime and let the throttled background origin/main refresh settle before
    // measuring — a fresh manager's first poll fires it, but a steady-state poll
    // (the common case — SSE-driven, frequent) hits neither again within the 60s window.
    await route(root, '/api/git/status', { git: manager }).handle(
      fakeReq('/api/git/status'),
      res(),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));

    spawnMock.mockClear();
    const { res: statusRes, json } = fakeRes();
    await route(root, '/api/git/status', { git: manager }).handle(
      fakeReq('/api/git/status'),
      statusRes,
    );
    expect((json() as { branchHygiene: string }).branchHygiene).toBe('stale-merged');
    expect(spawnMock.mock.calls.length).toBe(4);
  });

  it('spawns at most three git processes on main', async () => {
    const root = initGitRepo(1);
    const manager = createGitManager(root);
    await route(root, '/api/git/status', { git: manager }).handle(
      fakeReq('/api/git/status'),
      res(),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));

    spawnMock.mockClear();
    await route(root, '/api/git/status', { git: manager }).handle(
      fakeReq('/api/git/status'),
      res(),
    );
    expect(spawnMock.mock.calls.length).toBeLessThanOrEqual(3);
  });
});

function res(): ServerResponse {
  return fakeRes().res;
}

describe('GET /api/git/log', () => {
  it('returns the first-parent log with no skip param', async () => {
    const root = initGitRepo(2);
    const { res, status, json } = fakeRes();
    await route(root, '/api/git/log').handle(fakeReq('/api/git/log'), res);
    expect(status()).toBe(200);
    const body = json() as { hasMore: boolean; commits: { subject: string }[] };
    expect(body.hasMore).toBe(false);
    expect(body.commits.map((c) => c.subject)).toEqual(['commit 1', 'commit 0']);
  });

  it('applies the skip param', async () => {
    const root = initGitRepo(2);
    const { res, status, json } = fakeRes();
    await route(root, '/api/git/log').handle(fakeReq('/api/git/log?skip=1'), res);
    expect(status()).toBe(200);
    const body = json() as { commits: { subject: string }[] };
    expect(body.commits.map((c) => c.subject)).toEqual(['commit 0']);
  });

  // Number.parseInt('garbage', 10) is NaN; the route falls back to 0 instead of
  // passing NaN through to readFirstParentLog's --skip= flag.
  it('falls back to skip=0 when the skip param is not a number', async () => {
    const root = initGitRepo(2);
    const { res, status, json } = fakeRes();
    await route(root, '/api/git/log').handle(fakeReq('/api/git/log?skip=garbage'), res);
    expect(status()).toBe(200);
    const body = json() as { commits: { subject: string }[] };
    expect(body.commits.map((c) => c.subject)).toEqual(['commit 1', 'commit 0']);
  });
});

describe('POST /api/git/pull', () => {
  it('answers 502 when the fetch fails instead of a generic 409', async () => {
    const root = initGitRepo(1);
    const { res, status, json } = fakeRes();
    const git = {
      ...createGitManager(root),
      runGitPull: vi.fn().mockRejectedValue(new FetchFailedError('fatal: unable to access origin')),
    } as unknown as RouteContext['git'];

    await route(root, '/api/git/pull', { git }).handle(fakeReq('/api/git/pull'), res);

    expect(status()).toBe(502);
    expect(json()).toMatchObject({ error: 'fatal: unable to access origin' });
  });
});

describe('POST /api/git/stash-restore', () => {
  function strandRepo(): string {
    const root = initGitRepo(1);
    mkdirSync(join(root, 'papercamp', 'ideas'), { recursive: true });
    writeFileSync(join(root, 'papercamp', 'config.json'), 'base\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'chore(repo): add config');
    writeFileSync(join(root, 'papercamp', 'config.json'), 'stashed\n');
    writeFileSync(join(root, 'papercamp', 'ideas', 'IDEA-9.md'), 'idea nine\n');
    return root;
  }

  async function restore(root: string, index: unknown) {
    const notifyChanged = vi.fn();
    const { res, status, json } = fakeRes();
    await route(root, '/api/git/stash-restore', {
      activity: { notifyChanged },
    }).handle(fakeReqWithBody('/api/git/stash-restore', { index }), res);
    return { status: status(), body: json(), notifyChanged };
  }

  it('puts tracked and untracked papercamp/ files back and drops the stash', async () => {
    const root = strandRepo();
    git(root, 'stash', 'push', '--include-untracked', '-m', 'papercamp-reconcile');

    const { status, body, notifyChanged } = await restore(root, 0);

    expect(status).toBe(200);
    expect(body).toEqual({
      restored: ['papercamp/config.json', 'papercamp/ideas/IDEA-9.md'],
      refused: [],
      leftInStash: [],
      dropped: true,
    });
    expect(readFileSync(join(root, 'papercamp', 'config.json'), 'utf-8')).toBe('stashed\n');
    expect(readFileSync(join(root, 'papercamp', 'ideas', 'IDEA-9.md'), 'utf-8')).toBe(
      'idea nine\n',
    );
    expect(git(root, 'stash', 'list')).toBe('');
    expect(git(root, 'diff', '--cached', '--name-only')).toBe('');
    expect(notifyChanged).toHaveBeenCalledWith(['git', 'corpus']);
  });

  it('refuses a papercamp/ file that changed on disk, naming it, and keeps the stash', async () => {
    const root = strandRepo();
    git(root, 'stash', 'push', '--include-untracked', '-m', 'papercamp-reconcile');
    writeFileSync(join(root, 'papercamp', 'config.json'), 'edited since\n');

    const { status, body } = await restore(root, 0);

    expect(status).toBe(200);
    expect(body).toEqual({
      restored: ['papercamp/ideas/IDEA-9.md'],
      refused: ['papercamp/config.json'],
      leftInStash: [],
      dropped: false,
    });
    expect(readFileSync(join(root, 'papercamp', 'config.json'), 'utf-8')).toBe('edited since\n');
    expect(git(root, 'stash', 'list')).toContain('papercamp-reconcile');
  });

  it('leaves files outside papercamp/ in the stash and names them', async () => {
    const root = strandRepo();
    writeFileSync(join(root, 'file-0.txt'), 'source edit\n');
    git(root, 'stash', 'push', '--include-untracked', '-m', 'papercamp-sync');

    const { body } = await restore(root, 0);

    expect(body).toMatchObject({ refused: [], leftInStash: ['file-0.txt'], dropped: false });
    expect(existsSync(join(root, 'papercamp', 'ideas', 'IDEA-9.md'))).toBe(true);
    expect(readFileSync(join(root, 'file-0.txt'), 'utf-8')).toBe('0\n');
    expect(git(root, 'stash', 'list')).toContain('papercamp-sync');
  });

  it('refuses a stash paper-camp did not make', async () => {
    const root = strandRepo();
    git(root, 'stash', 'push', '--include-untracked', '-m', 'human wip');

    const { status, body } = await restore(root, 0);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: expect.stringContaining('not a paper-camp stash') });
    expect(git(root, 'stash', 'list')).toContain('human wip');
  });

  it('answers 400 without an index', async () => {
    const root = initGitRepo(1);
    expect((await restore(root, undefined)).status).toBe(400);
  });
});

describe('mutating git routes signal activity.notifyChanged', () => {
  it('POST /api/git/stage', async () => {
    const root = initGitRepo(1);
    writeFileSync(join(root, 'untracked.txt'), 'x\n');
    const notifyChanged = vi.fn();
    const { res, status } = fakeRes();
    await route(root, '/api/git/stage', { activity: { notifyChanged } }).handle(
      fakeReqWithBody('/api/git/stage', { path: 'untracked.txt' }),
      res,
    );
    expect(status()).toBe(200);
    expect(notifyChanged).toHaveBeenCalledOnce();
  });

  it('POST /api/git/stage-all', async () => {
    const root = initGitRepo(1);
    writeFileSync(join(root, 'untracked.txt'), 'x\n');
    const notifyChanged = vi.fn();
    const { res, status } = fakeRes();
    await route(root, '/api/git/stage-all', {
      activity: { notifyChanged },
    }).handle(fakeReq('/api/git/stage-all'), res);
    expect(status()).toBe(200);
    expect(notifyChanged).toHaveBeenCalledOnce();
  });

  it('POST /api/git/unstage', async () => {
    const root = initGitRepo(1);
    writeFileSync(join(root, 'untracked.txt'), 'x\n');
    git(root, 'add', 'untracked.txt');
    const notifyChanged = vi.fn();
    const { res, status } = fakeRes();
    await route(root, '/api/git/unstage', {
      activity: { notifyChanged },
    }).handle(fakeReqWithBody('/api/git/unstage', { path: 'untracked.txt' }), res);
    expect(status()).toBe(200);
    expect(notifyChanged).toHaveBeenCalledOnce();
  });

  it('POST /api/git/unstage-all', async () => {
    const root = initGitRepo(1);
    writeFileSync(join(root, 'untracked.txt'), 'x\n');
    git(root, 'add', 'untracked.txt');
    const notifyChanged = vi.fn();
    const { res, status } = fakeRes();
    await route(root, '/api/git/unstage-all', {
      activity: { notifyChanged },
    }).handle(fakeReq('/api/git/unstage-all'), res);
    expect(status()).toBe(200);
    expect(notifyChanged).toHaveBeenCalledOnce();
  });

  it('POST /api/git/commit', async () => {
    const root = initGitRepo(1);
    writeFileSync(join(root, 'untracked.txt'), 'x\n');
    const notifyChanged = vi.fn();
    const { res, status } = fakeRes();
    await route(root, '/api/git/commit', {
      activity: { notifyChanged },
    }).handle(
      fakeReqWithBody('/api/git/commit', { files: ['untracked.txt'], title: 'chore: add file' }),
      res,
    );
    expect(status()).toBe(200);
    expect(notifyChanged).toHaveBeenCalledOnce();
  });

  it('POST /api/git/checkout', async () => {
    const root = initGitRepo(1);
    git(root, 'branch', 'feature');
    const notifyChanged = vi.fn();
    const { res, status } = fakeRes();
    await route(root, '/api/git/checkout', {
      activity: { notifyChanged },
    }).handle(fakeReqWithBody('/api/git/checkout', { branch: 'feature' }), res);
    expect(status()).toBe(200);
    expect(notifyChanged).toHaveBeenCalledOnce();
  });

  it('does not notify when a route fails', async () => {
    const root = initGitRepo(1);
    const notifyChanged = vi.fn();
    const { res, status } = fakeRes();
    await route(root, '/api/git/checkout', {
      activity: { notifyChanged },
    }).handle(fakeReqWithBody('/api/git/checkout', { branch: 'does-not-exist' }), res);
    expect(status()).toBe(409);
    expect(notifyChanged).not.toHaveBeenCalled();
  });
});

describe('POST /api/git/complete-idea', () => {
  function completeIdeaGit(overrides: {
    returnToMain?: () => Promise<{ remoteDeleted: boolean }>;
  }) {
    return {
      getFeatureBranchPlanId: () => 'IDEA-1',
      assertCleanWorkingTree: vi.fn().mockResolvedValue(undefined),
      getCurrentBranch: vi.fn().mockReturnValue('feat/idea-1-work'),
      returnToMain: overrides.returnToMain ?? vi.fn().mockResolvedValue({ remoteDeleted: true }),
    } as unknown as RouteContext['git'];
  }

  it('notifies after the merge and again after returnToMain succeeds', async () => {
    const root = initGitRepo(1);
    readCorpusMock.mockResolvedValue({
      work: [{ id: 'IDEA-1', pr: { number: 42 } }],
    } as unknown as Awaited<ReturnType<typeof readCorpus>>);
    squashMergePrMock.mockResolvedValue({ ok: true });
    const order: string[] = [];
    const notifyChanged = vi.fn(() => order.push('notify'));
    const returnToMain = vi.fn(async () => {
      order.push('returnToMain');
      return { remoteDeleted: true };
    });
    const { res, status, json } = fakeRes();

    await route(root, '/api/git/complete-idea', {
      git: completeIdeaGit({ returnToMain }),
      activity: { notifyChanged },
    }).handle(fakeReqWithBody('/api/git/complete-idea', { planId: 'IDEA-1' }), res);

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true });
    expect(notifyChanged).toHaveBeenCalledTimes(2);
    expect(order).toEqual(['notify', 'returnToMain', 'notify']);
  });

  it('notifies again after returnToMain fails on the merged-but-unfinished path', async () => {
    const root = initGitRepo(1);
    readCorpusMock.mockResolvedValue({
      work: [{ id: 'IDEA-1', pr: { number: 42 } }],
    } as unknown as Awaited<ReturnType<typeof readCorpus>>);
    squashMergePrMock.mockResolvedValue({ ok: true });
    const notifyChanged = vi.fn();
    const returnToMain = vi.fn().mockRejectedValue(new Error('checkout failed'));
    const { res, status, json } = fakeRes();

    await route(root, '/api/git/complete-idea', {
      git: completeIdeaGit({ returnToMain }),
      activity: { notifyChanged },
    }).handle(fakeReqWithBody('/api/git/complete-idea', { planId: 'IDEA-1' }), res);

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true, merged: true });
    expect(notifyChanged).toHaveBeenCalledTimes(2);
  });
});
