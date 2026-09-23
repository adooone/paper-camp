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
  const found = planRoutes({
    root,
    activity: { notifyChanged: () => {} },
  } as RouteContext).find((r) => r.method === 'PATCH' && r.path === '/api/plans');
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

describe('PATCH /api/plans on a note', () => {
  const NOTE = `---
id: IDEA-3
title: A note
kind: note
status: open
created: 2026-09-01
---
Note body.
`;

  it('archives a note marked done, since a note has no PR to derive done from', async () => {
    const root = await makeRoot();
    await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-3.md'), NOTE);
    const { res, status } = fakeRes();
    await route(root).handle(fakeReq('A note', JSON.stringify({ status: 'done' })), res);
    expect(status()).toBe(200);
    const archived = await readFile(
      join(root, 'papercamp', 'ideas', 'archive', 'IDEA-3.md'),
      'utf-8',
    );
    expect(archived).toContain('status: done');
  });
});

describe('PATCH /api/plans reopening an archived entity', () => {
  it('moves the file back out of archive/, since an archived file always derives done', async () => {
    const root = await makeRoot();
    const archiveDir = join(root, 'papercamp', 'ideas', 'archive');
    await mkdir(archiveDir, { recursive: true });
    await writeFile(
      join(archiveDir, 'IDEA-4.md'),
      PLAN_IN_PROGRESS.replace('IDEA-2', 'IDEA-4').replace('Active plan', 'Archived plan'),
    );
    const { res, status } = fakeRes();
    await route(root).handle(fakeReq('Archived plan', JSON.stringify({ status: null })), res);
    expect(status()).toBe(200);
    const reopened = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-4.md'), 'utf-8');
    expect(reopened).not.toContain('status: done');
  });
});
