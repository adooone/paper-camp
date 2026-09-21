import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
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

function route(root: string, path: string) {
  const found = gitRoutes({ root } as RouteContext).find((r) => r.path === path);
  if (!found) throw new Error(`no route registered for ${path}`);
  return found;
}

function fakeReq(url: string): IncomingMessage {
  return { url, headers: {} } as IncomingMessage;
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
