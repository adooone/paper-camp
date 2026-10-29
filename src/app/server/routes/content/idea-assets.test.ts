import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { RouteContext } from '../types';
import { ideaAssetRoutes } from './idea-assets';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

const IDEA = `---
id: IDEA-1
title: Has files
type: feat
status: idea
created: 2026-07-01
---
Idea body.
`;

async function makeRoot(config?: unknown): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-idea-assets-route-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), IDEA);
  if (config !== undefined) {
    await writeFile(join(root, 'papercamp', 'config.json'), JSON.stringify(config), 'utf-8');
  }
  return root;
}

function route(root: string, method: 'GET' | 'POST' | 'DELETE', path: string) {
  const found = ideaAssetRoutes({
    root,
    activity: { notifyChanged: () => {}, publish: () => {} },
  } as unknown as RouteContext).find((r) => r.method === method && r.path === path);
  if (!found) throw new Error(`no ${method} ${path} route registered`);
  return found;
}

function fakeReq(url: string, body = ''): IncomingMessage {
  const listeners: Record<string, (chunk?: string) => void> = {};
  const req = {
    url,
    headers: {},
    on(event: string, cb: (chunk?: string) => void) {
      listeners[event] = cb;
      return req;
    },
  } as unknown as IncomingMessage;
  queueMicrotask(() => {
    listeners.data?.(body);
    listeners.end?.();
  });
  return req;
}

function fakeRes(): {
  res: ServerResponse;
  status: () => number;
  json: () => unknown;
  body: () => Buffer;
  header: (name: string) => string | undefined;
} {
  let statusCode = 0;
  let chunk: Buffer | string = '';
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    end: (data?: Buffer | string) => {
      chunk = data ?? '';
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
  } as unknown as ServerResponse;
  return {
    res,
    status: () => statusCode,
    json: () => JSON.parse(chunk.toString()),
    body: () => Buffer.from(chunk),
    header: (name: string) => headers[name.toLowerCase()],
  };
}

describe('ideaAssetRoutes', () => {
  it('lists an empty folder as no assets', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, 'GET', '/api/ideas/assets').handle(
      fakeReq('/api/ideas/assets?id=IDEA-1'),
      res,
    );
    expect(status()).toBe(200);
    expect(json()).toEqual({ ok: true, assets: [] });
  });

  it('404s listing assets for an idea that does not exist', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, 'GET', '/api/ideas/assets').handle(
      fakeReq('/api/ideas/assets?id=IDEA-9'),
      res,
    );
    expect(status()).toBe(404);
    expect(json()).toEqual({ error: 'idea "IDEA-9" not found' });
  });

  it('uploads a file via a data URI and lists it back', async () => {
    const root = await makeRoot();
    const dataUri = `data:text/plain;base64,${Buffer.from('hello').toString('base64')}`;
    const post = fakeRes();
    await route(root, 'POST', '/api/ideas/assets').handle(
      fakeReq('/api/ideas/assets?id=IDEA-1', JSON.stringify({ name: 'note.txt', dataUri })),
      post.res,
    );
    expect(post.status()).toBe(200);
    expect(post.json()).toMatchObject({ ok: true, asset: { name: 'note.txt', size: 5 } });

    const list = fakeRes();
    await route(root, 'GET', '/api/ideas/assets').handle(
      fakeReq('/api/ideas/assets?id=IDEA-1'),
      list.res,
    );
    expect((list.json() as { assets: unknown[] }).assets).toHaveLength(1);
  });

  it('refuses an upload with an unsafe name', async () => {
    const root = await makeRoot();
    const dataUri = `data:text/plain;base64,${Buffer.from('hi').toString('base64')}`;
    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/ideas/assets').handle(
      fakeReq('/api/ideas/assets?id=IDEA-1', JSON.stringify({ name: '../evil.txt', dataUri })),
      res,
    );
    expect(status()).toBe(400);
  });

  it('refuses an upload over the configured size limit', async () => {
    const root = await makeRoot({ assets: { maxFileSizeMb: 0.000001 } });
    const dataUri = `data:text/plain;base64,${Buffer.from('this is too big').toString('base64')}`;
    const { res, status, json } = fakeRes();
    await route(root, 'POST', '/api/ideas/assets').handle(
      fakeReq('/api/ideas/assets?id=IDEA-1', JSON.stringify({ name: 'big.txt', dataUri })),
      res,
    );
    expect(status()).toBe(400);
    expect((json() as { error: string }).error).toMatch(/limit/);
  });

  it('serves a file with its MIME type and no sandbox CSP for a plain text file', async () => {
    const root = await makeRoot();
    await mkdir(join(root, 'papercamp', 'assets', 'IDEA-1'), { recursive: true });
    await writeFile(join(root, 'papercamp', 'assets', 'IDEA-1', 'note.txt'), 'hello');
    const { res, status, body, header } = fakeRes();
    await route(root, 'GET', '/api/ideas/asset').handle(
      fakeReq('/api/ideas/asset?id=IDEA-1&name=note.txt'),
      res,
    );
    expect(status()).toBe(200);
    expect(body().toString()).toBe('hello');
    expect(header('Content-Type')).toBe('text/plain');
    expect(header('Content-Security-Policy')).toBeUndefined();
  });

  it('serves HTML with a sandbox CSP and no allow-same-origin', async () => {
    const root = await makeRoot();
    await mkdir(join(root, 'papercamp', 'assets', 'IDEA-1'), { recursive: true });
    await writeFile(join(root, 'papercamp', 'assets', 'IDEA-1', 'mockup.html'), '<html></html>');
    const { res, header } = fakeRes();
    await route(root, 'GET', '/api/ideas/asset').handle(
      fakeReq('/api/ideas/asset?id=IDEA-1&name=mockup.html'),
      res,
    );
    expect(header('Content-Type')).toBe('text/html');
    expect(header('Content-Security-Policy')).toBe('sandbox allow-scripts');
  });

  it('refuses a traversal attempt in the file name', async () => {
    const root = await makeRoot();
    await mkdir(join(root, 'papercamp', 'assets', 'IDEA-1'), { recursive: true });
    const { res, status } = fakeRes();
    await route(root, 'GET', '/api/ideas/asset').handle(
      fakeReq('/api/ideas/asset?id=IDEA-1&name=..%2F..%2Fconfig.json'),
      res,
    );
    expect(status()).toBe(400);
  });

  it('404s a file that does not exist', async () => {
    const root = await makeRoot();
    await mkdir(join(root, 'papercamp', 'assets', 'IDEA-1'), { recursive: true });
    const { res, status } = fakeRes();
    await route(root, 'GET', '/api/ideas/asset').handle(
      fakeReq('/api/ideas/asset?id=IDEA-1&name=missing.txt'),
      res,
    );
    expect(status()).toBe(404);
  });

  it('deletes a file', async () => {
    const root = await makeRoot();
    const dir = join(root, 'papercamp', 'assets', 'IDEA-1');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'note.txt'), 'hello');
    const { res, status } = fakeRes();
    await route(root, 'DELETE', '/api/ideas/asset').handle(
      fakeReq('/api/ideas/asset?id=IDEA-1&name=note.txt'),
      res,
    );
    expect(status()).toBe(200);
    await expect(readFile(join(dir, 'note.txt'))).rejects.toThrow();
  });

  it('404s deleting a file that does not exist', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'DELETE', '/api/ideas/asset').handle(
      fakeReq('/api/ideas/asset?id=IDEA-1&name=missing.txt'),
      res,
    );
    expect(status()).toBe(404);
  });

  it('refuses a traversal attempt in a delete', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'DELETE', '/api/ideas/asset').handle(
      fakeReq('/api/ideas/asset?id=IDEA-1&name=..%2Fideas%2FIDEA-1.md'),
      res,
    );
    expect(status()).toBe(400);
  });
});
