import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CheckName } from '@/types/index';
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

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-agent-route-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), PLAN_WITH_OPEN_QUESTION);
  return root;
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
