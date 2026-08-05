import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatEntityFile } from '@/core/serialize';
import { afterAll, describe, expect, it } from 'vitest';
import { releaseNotesRoutes } from './release-notes';
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
  const root = mkdtempSync(join(tmpdir(), 'papercamp-release-notes-route-'));
  roots.push(root);
  mkdirSync(join(root, 'papercamp', 'ideas'), { recursive: true });
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  return root;
}

function route(root: string, path: string) {
  const found = releaseNotesRoutes({ root } as RouteContext).find((r) => r.path === path);
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

describe('GET /api/release-notes', () => {
  it('rejects a request with no version', async () => {
    const root = initGitRepo();
    const { res, status, json } = fakeRes();
    await route(root, '/api/release-notes').handle(fakeReq('/api/release-notes'), res);
    expect(status()).toBe(400);
    expect(json()).toEqual({ error: 'version is required' });
  });

  it('returns null when the version has no CHANGELOG range', async () => {
    const root = initGitRepo();
    writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n');
    const { res, status, json } = fakeRes();
    await route(root, '/api/release-notes').handle(
      fakeReq('/api/release-notes?version=v9.9.9'),
      res,
    );
    expect(status()).toBe(200);
    expect(json()).toBeNull();
  });

  it('returns the ideas grouped by section for a known release', async () => {
    const root = initGitRepo();
    writeFileSync(
      join(root, 'papercamp', 'ideas', 'IDEA-1.md'),
      `${formatEntityFile({
        id: 'IDEA-1',
        title: 'Do the thing',
        type: 'feat',
        status: 'done',
        created: '2026-07-01',
      })}\n`,
    );
    writeFileSync(join(root, 'a.txt'), 'a\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'chore(repo): seed main');
    git(root, 'tag', 'v0.1.0');
    writeFileSync(join(root, 'b.txt'), 'b\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'feat(core): Do the thing (IDEA-1) (#1)');
    git(root, 'tag', 'v0.2.0');
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      '# Changelog\n\n## [0.2.0](https://github.com/o/r/compare/v0.1.0...v0.2.0) (2026-08-06)\n',
    );

    const { res, status, json } = fakeRes();
    await route(root, '/api/release-notes').handle(
      fakeReq('/api/release-notes?version=v0.2.0'),
      res,
    );
    expect(status()).toBe(200);
    expect(json()).toEqual([
      { label: 'Features', ideas: [{ id: 'IDEA-1', title: 'Do the thing' }] },
    ]);
  });
});
