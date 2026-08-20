import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CheckName, PlanEntry } from '@/types/index';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { agentRoutes } from './agent';
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

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-agent-route-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), PLAN_WITH_OPEN_QUESTION);
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), PLAN_IN_REVIEW);
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-3.md'), PLAN_DONE);
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
  const found = agentRoutes({ root, ...ctx } as RouteContext).find((r) => r.path === path);
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

describe('POST /api/agent/feedback-message resuming a question-parked run', () => {
  it('resolves the open question and resumes a run parked on it once the reply answers it', async () => {
    const root = await makeRoot();
    const runFeedbackReply = vi.fn(async () =>
      JSON.stringify({ reply: 'Go ahead and read it.', answersQuestion: true }),
    );
    const resumeQuestionParkedTasks = vi.fn(
      async (_planId: string, _runProjectChecks?: () => Promise<CheckName[]>) => ({
        resumed: true,
      }),
    );
    const runChecksAndWait = vi.fn(async () => [] as CheckName[]);

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/feedback-message', {
      agent: { runFeedbackReply, resumeQuestionParkedTasks } as unknown as RouteContext['agent'],
      status: { runChecksAndWait } as unknown as RouteContext['status'],
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-1', text: 'Use OAuth.' })), res);

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true });

    expect(resumeQuestionParkedTasks).toHaveBeenCalledOnce();
    expect(resumeQuestionParkedTasks.mock.calls[0][0]).toBe('IDEA-1');
    const runProjectChecks = resumeQuestionParkedTasks.mock.calls[0][1] as () => Promise<unknown>;
    await runProjectChecks();
    expect(runChecksAndWait).toHaveBeenCalledOnce();

    const planFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(planFile).toContain(
      '- [x] 2026-08-04 [question] [agent] Run-all parked on phase 1 ("First phase") — the agent needs a decision: which auth flow should this use?',
    );
  });

  it('does not resume anything when the reply does not answer the open question', async () => {
    const root = await makeRoot();
    const runFeedbackReply = vi.fn(async () => JSON.stringify({ reply: 'Noted, thanks.' }));
    const resumeQuestionParkedTasks = vi.fn(
      async (_planId: string, _runProjectChecks?: () => Promise<CheckName[]>) => ({
        resumed: false,
      }),
    );

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/feedback-message', {
      agent: { runFeedbackReply, resumeQuestionParkedTasks } as unknown as RouteContext['agent'],
      status: {} as unknown as RouteContext['status'],
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-1', text: 'Just an aside.' })), res);

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true });
    expect(resumeQuestionParkedTasks).not.toHaveBeenCalled();

    const planFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    expect(planFile).toContain(
      '- [ ] 2026-08-04 [question] [agent] Run-all parked on phase 1 ("First phase") — the agent needs a decision: which auth flow should this use?',
    );
  });
});

describe('POST /api/agent/feedback-message reply notification', () => {
  it('appends an unread reply notification carrying the agent reply text', async () => {
    const root = await makeRoot();
    const runFeedbackReply = vi.fn(async () => JSON.stringify({ reply: 'Noted, thanks.' }));

    const { res, status } = fakeRes();
    await route(root, '/api/agent/feedback-message', {
      agent: { runFeedbackReply } as unknown as RouteContext['agent'],
      status: {} as unknown as RouteContext['status'],
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-1', text: 'Just an aside.' })), res);

    expect(status()).toBe(200);

    const logPath = join(root, 'papercamp', 'notifications.log');
    const start = Date.now();
    let entries: { kind?: string; entityId?: string; text?: string; read?: boolean }[] = [];
    while (Date.now() - start < 2000) {
      try {
        const raw = await readFile(logPath, 'utf-8');
        entries = raw
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        if (entries.length) break;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'reply',
      entityId: 'IDEA-1',
      entityTitle: 'Test plan',
      text: 'Noted, thanks.',
      read: false,
    });
  });
});

describe('POST /api/agent/feedback-message auto-launching fixes', () => {
  it('fires the run-all path once a reply records a new open fix on a reviewed plan', async () => {
    const root = await makeRoot();
    const runFeedbackReply = vi.fn(async () =>
      JSON.stringify({
        reply: 'Fixed the typo.',
        edit: { phases: [{ op: 'add', text: 'Fix the typo' }] },
      }),
    );
    const startRunAllPhases = vi.fn(
      (_plan: PlanEntry, _runProjectChecks?: () => Promise<CheckName[]>) => ({ ok: true }) as const,
    );
    const runChecksAndWait = vi.fn(async () => [] as CheckName[]);

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/feedback-message', {
      agent: { runFeedbackReply, startRunAllPhases } as unknown as RouteContext['agent'],
      status: { runChecksAndWait } as unknown as RouteContext['status'],
      git: fakeGit(),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-2', text: 'There is a typo.' })), res);

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true });

    expect(startRunAllPhases).toHaveBeenCalledOnce();
    const [launchedPlan, runProjectChecks] = startRunAllPhases.mock.calls[0];
    expect(launchedPlan).toMatchObject({
      id: 'IDEA-2',
      status: 'in-progress',
      fixes: [{ done: false, text: 'Fix the typo' }],
    });
    await runProjectChecks?.();
    expect(runChecksAndWait).toHaveBeenCalledOnce();

    const planFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), 'utf-8');
    expect(planFile).toContain('status: in-progress');
  });

  it('does not fire the run-all path when the reply adds no open fix', async () => {
    const root = await makeRoot();
    const runFeedbackReply = vi.fn(async () => JSON.stringify({ reply: 'Just noting this.' }));
    const startRunAllPhases = vi.fn(
      (_plan: PlanEntry, _runProjectChecks?: () => Promise<CheckName[]>) => ({ ok: true }) as const,
    );

    const { res, status } = fakeRes();
    await route(root, '/api/agent/feedback-message', {
      agent: { runFeedbackReply, startRunAllPhases } as unknown as RouteContext['agent'],
      status: {} as unknown as RouteContext['status'],
      git: fakeGit(),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-2', text: 'Just an aside.' })), res);

    expect(status()).toBe(200);
    expect(startRunAllPhases).not.toHaveBeenCalled();

    const planFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), 'utf-8');
    expect(planFile).toContain('status: review');
  });

  it('does not re-trigger on a reply that only answers a parked question, even alongside resume', async () => {
    const root = await makeRoot();
    const runFeedbackReply = vi.fn(async () =>
      JSON.stringify({ reply: 'Go ahead and read it.', answersQuestion: true }),
    );
    const resumeQuestionParkedTasks = vi.fn(async () => ({ resumed: true }));
    const startRunAllPhases = vi.fn(
      (_plan: PlanEntry, _runProjectChecks?: () => Promise<CheckName[]>) => ({ ok: true }) as const,
    );

    const { res, status } = fakeRes();
    await route(root, '/api/agent/feedback-message', {
      agent: {
        runFeedbackReply,
        resumeQuestionParkedTasks,
        startRunAllPhases,
      } as unknown as RouteContext['agent'],
      status: { runChecksAndWait: vi.fn() } as unknown as RouteContext['status'],
      git: fakeGit(),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-1', text: 'Use OAuth.' })), res);

    expect(status()).toBe(200);
    expect(resumeQuestionParkedTasks).toHaveBeenCalledOnce();
    expect(startRunAllPhases).not.toHaveBeenCalled();
  });

  it('does not crash and still records the fix when an agent is already busy on the plan', async () => {
    const root = await makeRoot();
    const runFeedbackReply = vi.fn(async () =>
      JSON.stringify({
        reply: 'Fixed the typo.',
        edit: { phases: [{ op: 'add', text: 'Fix the typo' }] },
      }),
    );
    const startRunAllPhases = vi.fn(
      (_plan: PlanEntry, _runProjectChecks?: () => Promise<CheckName[]>) =>
        ({ ok: false, error: 'An agent task is already running' }) as const,
    );

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/feedback-message', {
      agent: { runFeedbackReply, startRunAllPhases } as unknown as RouteContext['agent'],
      status: {
        runChecksAndWait: vi.fn(async () => [] as CheckName[]),
      } as unknown as RouteContext['status'],
      git: fakeGit(),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-2', text: 'There is a typo.' })), res);

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true });
    expect(startRunAllPhases).toHaveBeenCalledOnce();

    const planFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), 'utf-8');
    expect(planFile).toContain('Fix the typo');
    expect(planFile).toContain('status: in-progress');
  });

  it('does not auto-launch when another plan owns the current branch', async () => {
    const root = await makeRoot();
    const runFeedbackReply = vi.fn(async () =>
      JSON.stringify({
        reply: 'Fixed the typo.',
        edit: { phases: [{ op: 'add', text: 'Fix the typo' }] },
      }),
    );
    const startRunAllPhases = vi.fn(
      (_plan: PlanEntry, _runProjectChecks?: () => Promise<CheckName[]>) => ({ ok: true }) as const,
    );

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/feedback-message', {
      agent: { runFeedbackReply, startRunAllPhases } as unknown as RouteContext['agent'],
      status: {
        runChecksAndWait: vi.fn(async () => [] as CheckName[]),
      } as unknown as RouteContext['status'],
      git: fakeGit({ getFeatureBranchPlanId: vi.fn(() => 'IDEA-1') }),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-2', text: 'There is a typo.' })), res);

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true });
    expect(startRunAllPhases).not.toHaveBeenCalled();
  });

  it('commits the feedback edit before launching the fixes run', async () => {
    const root = await makeRoot();
    const runFeedbackReply = vi.fn(async () =>
      JSON.stringify({
        reply: 'Fixed the typo.',
        edit: { phases: [{ op: 'add', text: 'Fix the typo' }] },
      }),
    );
    const callOrder: string[] = [];
    const commit = vi.fn(async () => {
      callOrder.push('commit');
    });
    const startRunAllPhases = vi.fn(
      (_plan: PlanEntry, _runProjectChecks?: () => Promise<CheckName[]>) => {
        callOrder.push('launch');
        return { ok: true } as const;
      },
    );

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/feedback-message', {
      agent: { runFeedbackReply, startRunAllPhases } as unknown as RouteContext['agent'],
      status: {
        runChecksAndWait: vi.fn(async () => [] as CheckName[]),
      } as unknown as RouteContext['status'],
      git: fakeGit({ commit }),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-2', text: 'There is a typo.' })), res);

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true });
    expect(commit).toHaveBeenCalledOnce();
    expect(startRunAllPhases).toHaveBeenCalledOnce();
    expect(callOrder).toEqual(['commit', 'launch']);
  });
});

describe('POST /api/agent/feedback-message spawning a fix from a closed idea', () => {
  it('spawns a new linked fix entity instead of reopening a done plan', async () => {
    const root = await makeRoot();
    const runFeedbackReply = vi.fn(async () =>
      JSON.stringify({
        reply: 'Good catch.',
        edit: { phases: [{ op: 'add', text: 'Fix the regression' }] },
      }),
    );
    const startRunAllPhases = vi.fn(
      (_plan: PlanEntry, _runProjectChecks?: () => Promise<CheckName[]>) => ({ ok: true }) as const,
    );
    const commit = vi.fn(async () => {});

    const { res, status, json } = fakeRes();
    await route(root, '/api/agent/feedback-message', {
      agent: { runFeedbackReply, startRunAllPhases } as unknown as RouteContext['agent'],
      status: {
        runChecksAndWait: vi.fn(async () => [] as CheckName[]),
      } as unknown as RouteContext['status'],
      git: fakeGit({ commit }),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-3', text: 'This regressed.' })), res);

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true });

    const spawnedFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-100.md'), 'utf-8');
    expect(spawnedFile).toContain('kind: fix');
    expect(spawnedFile).toContain('idea: IDEA-3');
    expect(spawnedFile).toContain('Fix the regression');

    expect(commit).toHaveBeenCalledOnce();
    expect(startRunAllPhases).toHaveBeenCalledOnce();
    const [launchedPlan] = startRunAllPhases.mock.calls[0];
    expect(launchedPlan).toMatchObject({ id: 'IDEA-100', idea: 'IDEA-3', kind: 'fix' });

    const parentFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-3.md'), 'utf-8');
    expect(parentFile).toContain('status: done');
    expect(parentFile).not.toContain('Fix the regression');
    expect(parentFile).not.toContain('### Fixes');
  });

  it('does not spawn a fix when the reply adds no phase', async () => {
    const root = await makeRoot();
    const runFeedbackReply = vi.fn(async () => JSON.stringify({ reply: 'Just noting this.' }));
    const startRunAllPhases = vi.fn(() => ({ ok: true }) as const);

    const { res, status } = fakeRes();
    await route(root, '/api/agent/feedback-message', {
      agent: { runFeedbackReply, startRunAllPhases } as unknown as RouteContext['agent'],
      status: {} as unknown as RouteContext['status'],
      git: fakeGit(),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-3', text: 'Just an aside.' })), res);

    expect(status()).toBe(200);
    expect(startRunAllPhases).not.toHaveBeenCalled();
    await expect(
      readFile(join(root, 'papercamp', 'ideas', 'IDEA-100.md'), 'utf-8'),
    ).rejects.toThrow();
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
      status: { runChecksAndWait: vi.fn() } as unknown as RouteContext['status'],
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
      status: { runChecksAndWait: vi.fn() } as unknown as RouteContext['status'],
      git: fakeGit({ findStaleBaseRef }),
    }).handle(fakeReq(JSON.stringify({ planId: 'IDEA-2' })), res);

    expect(startRunAllPhases).toHaveBeenCalledOnce();
    expect(status()).toBe(202);
    expect(json()).toMatchObject({ ok: true });
  });
});
