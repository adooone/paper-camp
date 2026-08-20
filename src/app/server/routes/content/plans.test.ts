import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { RouteContext } from '../types';
import { planRoutes } from './plans';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

const PLAN_DONE = `---
id: IDEA-1
title: Shipped plan
type: feat
status: done
created: 2026-07-01
---
Plan body.

### Phases
- [x] First phase
`;

const PLAN_IN_PROGRESS = `---
id: IDEA-2
title: Active plan
type: feat
status: in-progress
created: 2026-07-01
---
Plan body.

### Phases
- [ ] First phase
`;

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-plans-route-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), PLAN_DONE);
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), PLAN_IN_PROGRESS);
  return root;
}

function route(root: string) {
  const found = planRoutes({ root } as RouteContext).find(
    (r) => r.method === 'PATCH' && r.path === '/api/plans',
  );
  if (!found) throw new Error('no PATCH /api/plans route registered');
  return found;
}

function fakeReq(title: string, body: string): IncomingMessage {
  const listeners: Record<string, (chunk?: string) => void> = {};
  const req = {
    url: `/api/plans?title=${encodeURIComponent(title)}`,
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

describe('PATCH /api/plans on a closed entity', () => {
  it('rejects a new phase added to a done plan', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root).handle(
      fakeReq(
        'IDEA-1',
        JSON.stringify({
          phases: [
            { done: true, text: 'First phase' },
            { done: false, text: 'New phase' },
          ],
        }),
      ),
      res,
    );
    expect(status()).toBe(409);
    expect(json()).toMatchObject({ error: expect.stringContaining('read-only') });
  });

  it('rejects a new fix added to a done plan', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root).handle(
      fakeReq('IDEA-1', JSON.stringify({ fixes: [{ done: false, text: 'New fix' }] })),
      res,
    );
    expect(status()).toBe(409);
  });

  it('rejects reopening a done plan back to in-progress', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root).handle(fakeReq('IDEA-1', JSON.stringify({ status: 'in-progress' })), res);
    expect(status()).toBe(409);
  });

  it('rejects a body edit on a done plan', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root).handle(fakeReq('IDEA-1', JSON.stringify({ body: 'Rewritten.' })), res);
    expect(status()).toBe(409);
  });

  it('still allows toggling an existing phase done state on a done plan', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root).handle(
      fakeReq('IDEA-1', JSON.stringify({ phases: [{ done: false, text: 'First phase' }] })),
      res,
    );
    expect(status()).toBe(200);
  });

  it('still allows dropping a done plan', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root).handle(fakeReq('IDEA-1', JSON.stringify({ status: 'dropped' })), res);
    expect(status()).toBe(200);
  });

  it('still allows adding a new phase to an active plan', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root).handle(
      fakeReq(
        'IDEA-2',
        JSON.stringify({
          phases: [
            { done: false, text: 'First phase' },
            { done: false, text: 'Second phase' },
          ],
        }),
      ),
      res,
    );
    expect(status()).toBe(200);

    const planFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), 'utf-8');
    expect(planFile).toContain('Second phase');
  });
});
