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
  return root;
}

function route(root: string, method: string, ctx: Partial<RouteContext> = {}) {
  const found = chatRoutes({
    root,
    activity: { notifyChanged: () => {} },
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
  it('persists the user message before running, then appends the agent reply', async () => {
    const root = await makeRoot();
    const runChatReply = vi.fn(async () => 'Sure thing.');

    const { res, status, json } = fakeRes();
    await route(root, 'POST', {
      agent: { runChatReply } as unknown as RouteContext['agent'],
    }).handle(fakeReq(JSON.stringify({ text: 'What is running?' })), res);

    expect(status()).toBe(200);
    expect(json()).toEqual({ ok: true });
    expect(runChatReply).toHaveBeenCalledOnce();

    const chatFile = await readFile(join(root, 'papercamp', 'chat.md'), 'utf-8');
    expect(chatFile).toContain('[chat] What is running?');
    expect(chatFile).toContain('[chat] [agent] Sure thing.');
  });

  it('keeps the user message on disk even when the agent run fails', async () => {
    const root = await makeRoot();
    const runChatReply = vi.fn(async () => {
      throw new Error('agent unavailable');
    });

    const { res, status, json } = fakeRes();
    await route(root, 'POST', {
      agent: { runChatReply } as unknown as RouteContext['agent'],
    }).handle(fakeReq(JSON.stringify({ text: 'Hello?' })), res);

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
