import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { appendThread } from '@/core/corpus';
import type { AgentTaskState } from '@/types/index';
import { agentRoutes, withoutFinishedLines } from './agent';
import type { RouteContext } from './types';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

const PLAN_WITH_OPEN_QUESTION = `---
id: IDEA-1
title: Test plan
type: feat
status: in-progress
created: 2026-07-01
---
Plan body.

### Phases
- [ ] First phase

### Thread
- [ ] 2026-08-04 [question] [agent] Run-all parked on phase 1 ("First phase") — the agent needs a decision: which auth flow should this use?
`;

const PLAN_IN_REVIEW = `---
id: IDEA-2
title: Reviewed plan
type: feat
status: review
created: 2026-07-01
---
Plan body.

### Phases
- [x] First phase
`;

const PLAN_DONE = `---
id: IDEA-3
title: Shipped plan
type: feat
status: done
created: 2026-07-01
---
Plan body.

### Phases
- [x] First phase
`;

const PLAN_WAITS_ON_OPEN = `---
id: IDEA-4
title: Waits on open work
type: feat
status: planned
created: 2026-07-01
needs:
  - IDEA-2
---
Plan body.

### Phases
- [ ] First phase
`;

const PLAN_WAITS_ON_DONE = `---
id: IDEA-5
title: Waits on shipped work
type: feat
status: planned
created: 2026-07-01
needs:
  - IDEA-3
---
Plan body.

### Phases
- [ ] First phase
`;

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-agent-route-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), PLAN_WITH_OPEN_QUESTION);
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), PLAN_IN_REVIEW);
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-3.md'), PLAN_DONE);
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-4.md'), PLAN_WAITS_ON_OPEN);
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-5.md'), PLAN_WAITS_ON_DONE);
  await writeFile(
    join(root, 'papercamp', 'config.json'),
    JSON.stringify({ nextId: { idea: 100 } }),
  );
  return root;
}

function fakeGit(overrides: Partial<RouteContext['git']> = {}): RouteContext['git'] {
  return {
    commit: vi.fn(async () => {}),
    getHeadSha: vi.fn(async () => 'abc123'),
    getFeatureBranchPlanId: vi.fn(() => null),
    getBranchHygieneStatus: vi.fn(async () => 'clean-on-main'),
    ...overrides,
  } as unknown as RouteContext['git'];
}

function route(root: string, path: string, ctx: Partial<RouteContext> = {}) {
  const found = agentRoutes({
    root,
    activity: { notifyChanged: () => {}, publish: () => {} },
    ...ctx,
  } as RouteContext).find((r) => r.path === path);
  if (!found) throw new Error(`no route registered for ${path}`);
  return found;
}

function fakeReq(body: string): IncomingMessage {
  const listeners: Record<string, (chunk?: string) => void> = {};
  const req = {
    url: '',
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

describe('the idea thread routes', () => {
  it('no longer registers the feedback conversation routes', () => {
    const paths = agentRoutes({ root: '/tmp' } as RouteContext).map((r) => r.path);
    expect(paths).not.toContain('/api/agent/feedback-message');
    expect(paths).not.toContain('/api/agent/feedback-undo');
    expect(paths).not.toContain('/api/agent/feedback-summarize');
    expect(paths).toContain('/api/agent/feedback-promote');
  });

  it('feedback-promote turns a chat message into a decision', async () => {
    const root = await makeRoot();
    await appendThread(root, 'IDEA-2', {
      kind: 'chat',
      date: '2026-08-04',
      text: 'Keep the old route name',
    });

    const { res, status } = fakeRes();
    await route(root, '/api/agent/feedback-promote').handle(
      fakeReq(JSON.stringify({ planId: 'IDEA-2', index: 0, target: 'decision' })),
      res,
    );

    expect(status()).toBe(200);
    const written = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), 'utf-8');
    expect(written).toMatch(/\[decision\].*Keep the old route name/);
  });

  it('feedback-promote answers 404 for an unknown idea', async () => {
    const root = await makeRoot();
    const { res, status } = fakeRes();
    await route(root, '/api/agent/feedback-promote').handle(
      fakeReq(JSON.stringify({ planId: 'IDEA-99', index: 0, target: 'log' })),
      res,
    );
    expect(status()).toBe(404);
  });
});

describe('POST /api/agent/launch-run-all', () => {
  it('refuses to start when the current branch is behind main for this plan', async () => {
    const root = await makeRoot();
    const startRunAllPhases = vi.fn(() => ({ ok: true }) as const);
    const findStaleBaseRef = vi.fn(async () => ({ ref: 'main', done: 4, total: 4 }));

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/launch-run-all', {
      agent: { startRunAllPhases } as unknown as RouteContext['agent'],
      checks: { runChecksAndWait: vi.fn() } as unknown as RouteContext['checks'],
      git: fakeGit({ findStaleBaseRef }),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-2' })), res);

    expect(findStaleBaseRef).toHaveBeenCalledWith('IDEA-2');
    expect(startRunAllPhases).not.toHaveBeenCalled();
    expect(status()).toBe(409);
    expect(json()).toMatchObject({
      error: expect.stringContaining('IDEA-2 already has 4/4 phases complete on main'),
    });
  });

  it('starts run-all when the current branch is not stale', async () => {
    const root = await makeRoot();
    const startRunAllPhases = vi.fn(() => ({ ok: true }) as const);
    const findStaleBaseRef = vi.fn(async () => null);

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/launch-run-all', {
      agent: { startRunAllPhases } as unknown as RouteContext['agent'],
      checks: { runChecksAndWait: vi.fn() } as unknown as RouteContext['checks'],
      git: fakeGit({ findStaleBaseRef }),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-2' })), res);

    expect(startRunAllPhases).toHaveBeenCalledOnce();
    expect(status()).toBe(202);
    expect(json()).toMatchObject({ ok: true });
  });

  it('refuses to start while a needed idea is still open (IDEA-291)', async () => {
    const root = await makeRoot();
    const startRunAllPhases = vi.fn(() => ({ ok: true }) as const);

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/launch-run-all', {
      agent: { startRunAllPhases } as unknown as RouteContext['agent'],
      checks: { runChecksAndWait: vi.fn() } as unknown as RouteContext['checks'],
      git: fakeGit({ findStaleBaseRef: vi.fn(async () => null) }),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-4' })), res);

    expect(startRunAllPhases).not.toHaveBeenCalled();
    expect(status()).toBe(409);
    expect(json()).toMatchObject({ error: 'waits for IDEA-2' });
  });

  it('starts run-all once the needed idea is done', async () => {
    const root = await makeRoot();
    const startRunAllPhases = vi.fn(() => ({ ok: true }) as const);

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/launch-run-all', {
      agent: { startRunAllPhases } as unknown as RouteContext['agent'],
      checks: { runChecksAndWait: vi.fn() } as unknown as RouteContext['checks'],
      git: fakeGit({ findStaleBaseRef: vi.fn(async () => null) }),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-5' })), res);

    expect(startRunAllPhases).toHaveBeenCalledOnce();
    expect(status()).toBe(202);
    expect(json()).toMatchObject({ ok: true });
  });
});

describe('POST /api/agent/launch', () => {
  it('refuses to start a single phase while a needed idea is still open (IDEA-291)', async () => {
    const root = await makeRoot();
    const start = vi.fn(() => ({ ok: true }) as const);

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/launch', {
      agent: { start } as unknown as RouteContext['agent'],
      checks: { runChecksAndWait: vi.fn() } as unknown as RouteContext['checks'],
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-4', phaseIndex: 0 })), res);

    expect(start).not.toHaveBeenCalled();
    expect(status()).toBe(409);
    expect(json()).toMatchObject({ error: 'waits for IDEA-2' });
  });

  it('starts the phase once the needed idea is done', async () => {
    const root = await makeRoot();
    const start = vi.fn(() => ({ ok: true }) as const);

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/launch', {
      agent: { start } as unknown as RouteContext['agent'],
      checks: { runChecksAndWait: vi.fn() } as unknown as RouteContext['checks'],
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-5', phaseIndex: 0 })), res);

    expect(start).toHaveBeenCalledOnce();
    expect(status()).toBe(202);
    expect(json()).toMatchObject({ ok: true });
  });
});

describe('withoutFinishedLines', () => {
  const task = (status: AgentTaskState['status']) =>
    ({ id: 't', status, lines: ['a', 'b'] }) as unknown as AgentTaskState;

  it('keeps lines on tasks that are still live', () => {
    for (const status of ['starting', 'running', 'stopping'] as const) {
      expect(withoutFinishedLines(task(status)).lines).toEqual(['a', 'b']);
    }
  });

  it('drops lines from finished tasks', () => {
    for (const status of ['done', 'error', 'superseded'] as const) {
      expect('lines' in withoutFinishedLines(task(status))).toBe(false);
    }
  });
});
