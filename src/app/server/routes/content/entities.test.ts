import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { RouteContext } from '../types';
import { entityRoutes } from './entities';

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
  const root = await mkdtemp(join(tmpdir(), 'papercamp-entities-route-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), PLAN_DONE);
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), PLAN_IN_PROGRESS);
  await writeFile(join(root, 'papercamp', 'config.json'), JSON.stringify({ nextId: { idea: 5 } }));
  return root;
}

function route(root: string, method: 'POST' | 'PATCH', path: string) {
  const found = entityRoutes({
    root,
    activity: { notifyChanged: () => {}, publish: () => {} },
  } as unknown as RouteContext).find((r) => r.method === method && r.path === path);
  if (!found) throw new Error(`no ${method} ${path} route registered`);
  return found;
}

function fakeReq(url: string, body: string): IncomingMessage {
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

describe('PATCH /api/entities on a closed entity', () => {
  it('rejects a new phase added to a done plan', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq(
        '/api/entities?id=IDEA-1',
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
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq(
        '/api/entities?id=IDEA-1',
        JSON.stringify({ fixes: [{ done: false, text: 'New fix' }] }),
      ),
      res,
    );
    expect(status()).toBe(409);
  });

  it('rejects reopening a done plan back to in-progress', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq('/api/entities?id=IDEA-1', JSON.stringify({ status: 'in-progress' })),
      res,
    );
    expect(status()).toBe(409);
  });

  it('rejects a body edit on a done plan', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq('/api/entities?id=IDEA-1', JSON.stringify({ body: 'Rewritten.' })),
      res,
    );
    expect(status()).toBe(409);
  });

  it('still allows toggling an existing phase done state on a done plan', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq(
        '/api/entities?id=IDEA-1',
        JSON.stringify({ phases: [{ done: false, text: 'First phase' }] }),
      ),
      res,
    );
    expect(status()).toBe(200);
  });

  it('still allows dropping a done plan', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq('/api/entities?id=IDEA-1', JSON.stringify({ status: 'dropped' })),
      res,
    );
    expect(status()).toBe(200);
  });

  it('still allows adding a new phase to an active plan', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq(
        '/api/entities?id=IDEA-2',
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

describe('PATCH /api/entities', () => {
  it('404s on an unknown id', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq('/api/entities?id=IDEA-999', JSON.stringify({ status: 'done' })),
      res,
    );
    expect(status()).toBe(404);
  });

  it('400s with no id', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq('/api/entities', JSON.stringify({ status: 'done' })),
      res,
    );
    expect(status()).toBe(400);
  });

  it('toggles one phase by index via `phase`, leaving the others untouched', async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, 'papercamp', 'ideas', 'IDEA-2.md'),
      `---
id: IDEA-2
title: Active plan
type: feat
status: in-progress
created: 2026-07-01
---
Plan body.

### Phases
- [ ] First phase
- [ ] Second phase
`,
    );
    const { res, status } = fakeRes();
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq('/api/entities?id=IDEA-2', JSON.stringify({ phase: { index: 1, done: true } })),
      res,
    );
    expect(status()).toBe(200);

    const planFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), 'utf-8');
    expect(planFile).toContain('- [ ] First phase');
    expect(planFile).toContain('- [x] Second phase');
  });

  it('400s a `phase` index out of range', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq('/api/entities?id=IDEA-2', JSON.stringify({ phase: { index: 5, done: true } })),
      res,
    );
    expect(status()).toBe(400);
  });

  it('lands two concurrent phase toggles on different indexes', async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, 'papercamp', 'ideas', 'IDEA-2.md'),
      `---
id: IDEA-2
title: Active plan
type: feat
status: in-progress
created: 2026-07-01
---
Plan body.

### Phases
- [ ] First phase
- [ ] Second phase
`,
    );
    const patch = route(root, 'PATCH', '/api/entities');
    const first = fakeRes();
    const second = fakeRes();
    await Promise.all([
      patch.handle(
        fakeReq('/api/entities?id=IDEA-2', JSON.stringify({ phase: { index: 0, done: true } })),
        first.res,
      ),
      patch.handle(
        fakeReq('/api/entities?id=IDEA-2', JSON.stringify({ phase: { index: 1, done: true } })),
        second.res,
      ),
    ]);
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);

    const planFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), 'utf-8');
    expect(planFile).toContain('- [x] First phase');
    expect(planFile).toContain('- [x] Second phase');
  });

  it('a thread append survives a concurrent log PATCH', async () => {
    const root = await makeRoot();
    const threadRes = fakeRes();
    const patchRes = fakeRes();
    await Promise.all([
      route(root, 'POST', '/api/entities/thread').handle(
        fakeReq(
          '/api/entities/thread?id=IDEA-2',
          JSON.stringify({ kind: 'note', text: 'A concurrent note.' }),
        ),
        threadRes.res,
      ),
      route(root, 'PATCH', '/api/entities').handle(
        fakeReq(
          '/api/entities?id=IDEA-2',
          JSON.stringify({ log: [{ date: '2026-07-02', text: 'A concurrent log line.' }] }),
        ),
        patchRes.res,
      ),
    ]);
    expect(threadRes.status()).toBe(200);
    expect(patchRes.status()).toBe(200);

    const planFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), 'utf-8');
    expect(planFile).toContain('A concurrent note.');
    expect(planFile).toContain('A concurrent log line.');
  });
});

describe('PATCH /api/entities on a note', () => {
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
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq('/api/entities?id=IDEA-3', JSON.stringify({ status: 'done' })),
      res,
    );
    expect(status()).toBe(200);
    const archived = await readFile(
      join(root, 'papercamp', 'ideas', 'archive', 'IDEA-3.md'),
      'utf-8',
    );
    expect(archived).toContain('status: done');
  });
});

describe('PATCH /api/entities reopening an archived entity', () => {
  it('moves the file back out of archive/, since an archived file always derives done', async () => {
    const root = await makeRoot();
    const archiveDir = join(root, 'papercamp', 'ideas', 'archive');
    await mkdir(archiveDir, { recursive: true });
    await writeFile(
      join(archiveDir, 'IDEA-4.md'),
      PLAN_IN_PROGRESS.replace('IDEA-2', 'IDEA-4').replace('Active plan', 'Archived plan'),
    );
    const { res, status } = fakeRes();
    await route(root, 'PATCH', '/api/entities').handle(
      fakeReq('/api/entities?id=IDEA-4', JSON.stringify({ status: null })),
      res,
    );
    expect(status()).toBe(200);
    const reopened = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-4.md'), 'utf-8');
    expect(reopened).not.toContain('status: done');
  });
});

describe('POST /api/entities', () => {
  it('mints a new idea', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, 'POST', '/api/entities').handle(
      fakeReq('/api/entities', JSON.stringify({ title: 'A new idea' })),
      res,
    );
    expect(status()).toBe(201);
    expect(json()).toMatchObject({ ok: true, id: expect.stringMatching(/^IDEA-\d+$/) });
  });

  it('400s without a title', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/entities').handle(
      fakeReq('/api/entities', JSON.stringify({})),
      res,
    );
    expect(status()).toBe(400);
  });
});

describe('POST /api/entities/thread', () => {
  it('appends a log message to the thread', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/entities/thread').handle(
      fakeReq(
        '/api/entities/thread?id=IDEA-2',
        JSON.stringify({ kind: 'log', text: 'Did a thing.' }),
      ),
      res,
    );
    expect(status()).toBe(200);
    const planFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), 'utf-8');
    expect(planFile).toContain('Did a thing.');
  });
});

describe('POST /api/entities/thread/promote', () => {
  it('distills a thread message into a log entry', async () => {
    const root = await makeRoot();
    const threadRes = fakeRes();
    await route(root, 'POST', '/api/entities/thread').handle(
      fakeReq(
        '/api/entities/thread?id=IDEA-2',
        JSON.stringify({ kind: 'chat', text: 'Thinking out loud.' }),
      ),
      threadRes.res,
    );
    expect(threadRes.status()).toBe(200);

    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/entities/thread/promote').handle(
      fakeReq(
        '/api/entities/thread/promote?id=IDEA-2',
        JSON.stringify({ index: 0, target: 'log' }),
      ),
      res,
    );
    expect(status()).toBe(200);
    const planFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), 'utf-8');
    expect(planFile).toContain('Thinking out loud.');
  });
});

describe('POST /api/entities/archive', () => {
  it('drops and archives an open entity', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/entities/archive').handle(
      fakeReq('/api/entities/archive?id=IDEA-2', ''),
      res,
    );
    expect(status()).toBe(200);
    const archived = await readFile(
      join(root, 'papercamp', 'ideas', 'archive', 'IDEA-2.md'),
      'utf-8',
    );
    expect(archived).toContain('status: dropped');
  });
});
