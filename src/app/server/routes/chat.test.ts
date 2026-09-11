import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { chatRoutes } from './chat';
import type { RouteContext } from './types';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-chat-route-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp'), { recursive: true });
  await writeFile(
    join(root, 'papercamp', 'config.json'),
    JSON.stringify({
      version: 1,
      projectName: 'test',
      initializedAt: '2026-01-01',
      nextId: { idea: 1, ticket: 1 },
    }),
    'utf-8',
  );
  return root;
}

function route(root: string, method: string, ctx: Partial<RouteContext> = {}) {
  const found = chatRoutes({
    root,
    activity: { notifyChanged: () => {} },
    agent: { getStatus: () => [] } as unknown as RouteContext['agent'],
    git: {} as unknown as RouteContext['git'],
    status: {} as unknown as RouteContext['status'],
    ...ctx,
  } as RouteContext).find((r) => r.path === '/api/chat' && r.method === method);
  if (!found) throw new Error(`no ${method} route registered for /api/chat`);
  return found;
}

function fakeReq(body = ''): IncomingMessage {
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

function agentCtx(runChatReply: (prompt: string) => Promise<string>): Partial<RouteContext> {
  return {
    agent: { runChatReply, getStatus: () => [] } as unknown as RouteContext['agent'],
  };
}

describe('GET /api/chat', () => {
  it('returns an empty thread when chat.md does not exist yet', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, 'GET').handle(fakeReq(), res);
    expect(status()).toBe(200);
    expect(json()).toEqual({ thread: [] });
  });

  it('returns the parsed thread', async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, 'papercamp', 'chat.md'),
      '### Thread\n- [x] 2026-09-11 [chat] Hello\n',
      'utf-8',
    );
    const { res, status, json } = fakeRes();
    await route(root, 'GET').handle(fakeReq(), res);
    expect(status()).toBe(200);
    expect(json()).toEqual({ thread: [{ kind: 'chat', date: '2026-09-11', text: 'Hello' }] });
  });
});

describe('POST /api/chat', () => {
  it('drafts and creates a new idea for the add_idea move', async () => {
    const root = await makeRoot();
    const runChatReply = vi.fn(async () =>
      JSON.stringify({
        result: JSON.stringify({ move: 'add_idea', title: 'Dark mode toggle', content: 'Body.' }),
      }),
    );

    const { res, status, json } = fakeRes();
    await route(root, 'POST', agentCtx(runChatReply)).handle(
      fakeReq(JSON.stringify({ text: 'We should add a dark mode toggle' })),
      res,
    );

    expect(status()).toBe(200);
    expect(json()).toEqual({ ok: true });
    expect(runChatReply).toHaveBeenCalledOnce();

    const chatFile = await readFile(join(root, 'papercamp', 'chat.md'), 'utf-8');
    expect(chatFile).toContain('[chat] We should add a dark mode toggle');
    expect(chatFile).toMatch(/\[chat\] \[agent\] Added \[\[IDEA-\d+]] — Dark mode toggle\./);

    const ideaFiles = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8').catch(
      () => null,
    );
    expect(ideaFiles).toContain('Dark mode toggle');
  });

  it('routes a message about an existing idea through the feedback path', async () => {
    const root = await makeRoot();
    await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
    await writeFile(
      join(root, 'papercamp', 'ideas', 'IDEA-9.md'),
      [
        '---',
        'id: IDEA-9',
        'title: Existing idea',
        'type: feat',
        'status: in-progress',
        'created: 2026-09-10',
        'tags: []',
        '---',
        '',
        'Body.',
        '',
      ].join('\n'),
      'utf-8',
    );

    const runChatReply = vi.fn(async () =>
      JSON.stringify({ result: JSON.stringify({ move: 'entity', entityId: 'IDEA-9' }) }),
    );
    const runFeedbackReply = vi.fn(async () => JSON.stringify({ reply: 'Noted, thanks.' }));

    const { res, status, json } = fakeRes();
    await route(root, 'POST', {
      agent: {
        runChatReply,
        runFeedbackReply,
        getStatus: () => [],
      } as unknown as RouteContext['agent'],
    }).handle(fakeReq(JSON.stringify({ text: 'the log view is clipped again' })), res);

    expect(status()).toBe(200);
    expect(json()).toEqual({ ok: true });

    const chatFile = await readFile(join(root, 'papercamp', 'chat.md'), 'utf-8');
    expect(chatFile).toContain('[chat] [agent] Noted, thanks. — see [[IDEA-9]].');

    const ideaFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-9.md'), 'utf-8');
    expect(ideaFile).toContain('the log view is clipped again');
    expect(ideaFile).toContain('Noted, thanks.');
  });

  it('replies directly for the answer move', async () => {
    const root = await makeRoot();
    const runChatReply = vi.fn(async () =>
      JSON.stringify({ result: JSON.stringify({ move: 'answer', reply: 'Nothing is running.' }) }),
    );

    const { res, status, json } = fakeRes();
    await route(root, 'POST', agentCtx(runChatReply)).handle(
      fakeReq(JSON.stringify({ text: 'What is running?' })),
      res,
    );

    expect(status()).toBe(200);
    expect(json()).toEqual({ ok: true });

    const chatFile = await readFile(join(root, 'papercamp', 'chat.md'), 'utf-8');
    expect(chatFile).toContain('[chat] What is running?');
    expect(chatFile).toContain('[chat] [agent] Nothing is running.');
  });

  it('keeps the user message on disk even when the agent run fails', async () => {
    const root = await makeRoot();
    const runChatReply = vi.fn(async () => {
      throw new Error('agent unavailable');
    });

    const { res, status, json } = fakeRes();
    await route(root, 'POST', agentCtx(runChatReply)).handle(
      fakeReq(JSON.stringify({ text: 'Hello?' })),
      res,
    );

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true, error: 'agent unavailable' });

    const chatFile = await readFile(join(root, 'papercamp', 'chat.md'), 'utf-8');
    expect(chatFile).toContain('[chat] Hello?');
    expect(chatFile).not.toContain('[agent]');
  });

  it('rejects an empty message', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, 'POST').handle(fakeReq(JSON.stringify({ text: '  ' })), res);
    expect(status()).toBe(400);
    expect(json()).toEqual({ error: 'text is required' });
  });
});

describe('DELETE /api/chat', () => {
  it('clears the thread except unanswered questions', async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, 'papercamp', 'chat.md'),
      [
        '### Thread',
        '- [x] 2026-09-11 [chat] Hello',
        '- [ ] 2026-09-11 [question] [agent] Which auth flow?',
        '- [x] 2026-09-11 [question] [agent] Resolved one',
      ].join('\n'),
      'utf-8',
    );

    const { res, status, json } = fakeRes();
    await route(root, 'DELETE').handle(fakeReq(), res);
    expect(status()).toBe(200);
    expect(json()).toEqual({ ok: true });

    const chatFile = await readFile(join(root, 'papercamp', 'chat.md'), 'utf-8');
    expect(chatFile).toContain('Which auth flow?');
    expect(chatFile).not.toContain('Hello');
    expect(chatFile).not.toContain('Resolved one');
  });
});
