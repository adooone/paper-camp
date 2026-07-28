import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { trailRoutes } from './trail';
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

function initGitRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-trail-route-'));
  roots.push(root);
  mkdirSync(join(root, 'papercamp', 'ideas', 'archive'), { recursive: true });
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  return root;
}

function route(root: string, path: string) {
  const found = trailRoutes({ root } as RouteContext).find((r) => r.path === path);
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

describe('GET /api/trail', () => {
  it('rejects a request with no id', async () => {
    const root = initGitRepo();
    const { res, status, json } = fakeRes();
    await route(root, '/api/trail').handle(fakeReq('/api/trail'), res);
    expect(status()).toBe(400);
    expect(json()).toEqual({ error: 'id is required' });
  });

  it('returns the assembled trail for a known id', async () => {
    const root = initGitRepo();
    const { res, status, json } = fakeRes();
    await route(root, '/api/trail').handle(fakeReq('/api/trail?id=IDEA-1'), res);
    expect(status()).toBe(200);
    expect(json()).toMatchObject({ id: 'IDEA-1', idea: { reached: false } });
  });
});

describe('GET /api/trail/reverse', () => {
  it('rejects a request with neither sha nor line', async () => {
    const root = initGitRepo();
    const { res, status, json } = fakeRes();
    await route(root, '/api/trail/reverse').handle(fakeReq('/api/trail/reverse'), res);
    expect(status()).toBe(400);
    expect(json()).toEqual({ error: 'sha or line is required' });
  });

  it('resolves the id from a commit sha', async () => {
    const root = initGitRepo();
    writeFileSync(join(root, 'a.txt'), 'a\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'feat(core): Do the thing', '-m', 'Refs: IDEA-1');
    const sha = git(root, 'rev-parse', 'HEAD');

    const { res, status, json } = fakeRes();
    await route(root, '/api/trail/reverse').handle(fakeReq(`/api/trail/reverse?sha=${sha}`), res);
    expect(status()).toBe(200);
    expect(json()).toEqual({ id: 'IDEA-1' });
  });

  it('resolves the id from a release line', async () => {
    const root = initGitRepo();
    const line = encodeURIComponent(
      '* **core:** Trace an idea from roadmap to release (IDEA-93) ([abc](url))',
    );
    const { res, status, json } = fakeRes();
    await route(root, '/api/trail/reverse').handle(fakeReq(`/api/trail/reverse?line=${line}`), res);
    expect(status()).toBe(200);
    expect(json()).toEqual({ id: 'IDEA-93' });
  });

  it('returns a null id when nothing is traceable', async () => {
    const root = initGitRepo();
    writeFileSync(join(root, 'a.txt'), 'a\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'chore(repo): updates');
    const sha = git(root, 'rev-parse', 'HEAD');

    const { res, status, json } = fakeRes();
    await route(root, '/api/trail/reverse').handle(fakeReq(`/api/trail/reverse?sha=${sha}`), res);
    expect(status()).toBe(200);
    expect(json()).toEqual({ id: null });
  });
});
