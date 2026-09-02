import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { RouteContext } from '../types';
import { ideaRoutes } from './ideas';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function makeRoot(nextId: Record<string, number> = { idea: 1, ticket: 1 }): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-ideas-route-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  await writeFile(
    join(root, 'papercamp', 'config.json'),
    JSON.stringify({ version: 1, projectName: 'test', initializedAt: '2026-01-01', nextId }),
  );
  return root;
}

function route(root: string, method: string, path: string) {
  const found = ideaRoutes({
    root,
    activity: { notifyChanged: () => {} },
  } as RouteContext).find((r) => r.method === method && r.path === path);
  if (!found) throw new Error(`no ${method} ${path} route registered`);
  return found;
}

function fakeReq(body: string): IncomingMessage {
  const listeners: Record<string, (chunk?: string) => void> = {};
  const req = {
    url: '/',
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

describe('POST /api/ideas', () => {
  it('writes a board entity when kind is board', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, 'POST', '/api/ideas').handle(
      fakeReq(JSON.stringify({ title: 'A board', kind: 'board' })),
      res,
    );
    expect(status()).toBe(201);
    const { id } = json() as { id: string };
    const content = await readFile(join(root, 'papercamp', 'ideas', `${id}.md`), 'utf-8');
    expect(content).toContain('kind: board');
    expect(content).toContain('status: idea');
  });
});

describe('POST /api/tickets', () => {
  it('mints a TICKET-N id and links it back to its board via idea:', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, 'POST', '/api/tickets').handle(
      fakeReq(JSON.stringify({ boardId: 'IDEA-30', title: 'First ticket' })),
      res,
    );
    expect(status()).toBe(201);
    const { id } = json() as { id: string };
    expect(id).toBe('TICKET-1');
    const content = await readFile(join(root, 'papercamp', 'ideas', `${id}.md`), 'utf-8');
    expect(content).toContain('kind: ticket');
    expect(content).toContain('idea: IDEA-30');
  });

  it('rejects a missing boardId or title', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/tickets').handle(
      fakeReq(JSON.stringify({ title: 'No board' })),
      res,
    );
    expect(status()).toBe(400);
  });
});
