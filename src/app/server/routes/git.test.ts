import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createGitManager } from '../git';
import { gitRoutes } from './git';
import type { RouteContext } from './types';

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
  overrides: { git?: RouteContext['git']; activity?: { notifyChanged: () => void } } = {},
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
