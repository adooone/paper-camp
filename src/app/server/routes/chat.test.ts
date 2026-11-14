import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

function routeAt(root: string, path: string, method: string, ctx: Partial<RouteContext> = {}) {
  const found = chatRoutes({
    root,
    activity: { notifyChanged: () => {}, publish: () => {} },
    agent: { getStatus: () => [] } as unknown as RouteContext['agent'],
    git: {
      getStatusSnapshot: async () => ({ branch: 'main', entries: [] }),
    } as unknown as RouteContext['git'],
    checks: {} as unknown as RouteContext['checks'],
    ...ctx,
  } as RouteContext).find((r) => r.path === path && r.method === method);
  if (!found) throw new Error(`no ${method} route registered for ${path}`);
  return found;
}

function route(root: string, method: string, ctx: Partial<RouteContext> = {}) {
  return routeAt(root, '/api/chat', method, ctx);
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function agentCtx(
  runChatTurn: (text: string, context?: unknown) => Promise<string>,
  status: unknown[] = [],
): Partial<RouteContext> {
  return {
    agent: {
      runChatTurn,
      getStatus: () => status,
    } as unknown as RouteContext['agent'],
  };
}

const chatPath = (root: string) => join(root, 'papercamp', 'chat.md');

async function waitForChat(root: string, needle: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const content = await readFile(chatPath(root), 'utf-8').catch(() => '');
    if (content.includes(needle)) return content;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`chat.md never contained ${needle}`);
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

  it('resolves a parked question whose idea has since closed', async () => {
    const root = await makeRoot();
    await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
    await writeFile(
      join(root, 'papercamp', 'ideas', 'IDEA-1.md'),
      [
        '---',
        'id: IDEA-1',
        'title: Done idea',
        'type: feat',
        'status: done',
        'created: 2026-01-01',
        '---',
        '',
      ].join('\n'),
      'utf-8',
    );
    await writeFile(
      join(root, 'papercamp', 'chat.md'),
      '### Thread\n- [ ] 2026-09-11 [question] [agent] [[IDEA-1]] Which auth flow?\n',
      'utf-8',
    );
    const { res, status, json } = fakeRes();
    await route(root, 'GET').handle(fakeReq(), res);
    expect(status()).toBe(200);
    expect(json()).toEqual({
      thread: [
        {
          kind: 'question',
          date: '2026-09-11',
          text: 'Which auth flow?',
          from: 'agent',
          state: 'resolved',
          entityId: 'IDEA-1',
        },
      ],
    });
  });
});

describe('POST /api/chat', () => {
  it('acks once the user message is on disk, before the turn finishes', async () => {
    const root = await makeRoot();
    const reply = deferred<string>();
    const runChatTurn = vi.fn(() => reply.promise);

    const { res, status, json } = fakeRes();
    await route(root, 'POST', agentCtx(runChatTurn)).handle(
      fakeReq(JSON.stringify({ text: 'What is running?' })),
      res,
    );

    expect(status()).toBe(200);
    expect(json()).toEqual({ ok: true });
    expect(runChatTurn).toHaveBeenCalledWith('What is running?', {
      branch: { name: 'main', dirty: [] },
    });
    const before = await readFile(chatPath(root), 'utf-8');
    expect(before).toContain('[chat] What is running?');
    expect(before).not.toContain('[agent]');

    reply.resolve('Nothing is running.');
    expect(await waitForChat(root, '[agent]')).toContain('[chat] [agent] Nothing is running.');
  });

  it('passes the branch and its dirty files to the turn', async () => {
    const root = await makeRoot();
    const runChatTurn = vi.fn(async () => 'ok');

    const { res } = fakeRes();
    await route(root, 'POST', {
      ...agentCtx(runChatTurn),
      git: {
        getStatusSnapshot: async () => ({
          branch: 'feat/idea-1-x',
          entries: [{ path: 'src/a.ts', status: ' M', staged: false }],
        }),
      } as unknown as RouteContext['git'],
    }).handle(fakeReq(JSON.stringify({ text: 'Hi' })), res);

    expect(runChatTurn).toHaveBeenCalledWith('Hi', {
      branch: { name: 'feat/idea-1-x', dirty: ['src/a.ts'] },
    });
  });

  it('appends a failed turn as an agent message carrying the error', async () => {
    const root = await makeRoot();
    const runChatTurn = vi.fn(async () => {
      throw new Error('agent unavailable');
    });

    const { res, json } = fakeRes();
    await route(root, 'POST', agentCtx(runChatTurn)).handle(
      fakeReq(JSON.stringify({ text: 'Hello?' })),
      res,
    );

    expect(json()).toEqual({ ok: true });
    const chatFile = await waitForChat(root, '[agent]');
    expect(chatFile).toContain('[chat] Hello?');
    expect(chatFile).toContain('[chat] [agent] agent unavailable');
  });

  it('refuses while a chat turn is still running, without appending', async () => {
    const root = await makeRoot();
    const runChatTurn = vi.fn(async () => 'ok');

    const { res, status, json } = fakeRes();
    await route(
      root,
      'POST',
      agentCtx(runChatTurn, [{ taskKind: 'chat', status: 'running' }]),
    ).handle(fakeReq(JSON.stringify({ text: 'Again?' })), res);

    expect(status()).toBe(409);
    expect(json()).toEqual({ error: 'Scout is still answering the previous message' });
    expect(runChatTurn).not.toHaveBeenCalled();
    expect(await readFile(chatPath(root), 'utf-8').catch(() => '')).not.toContain('Again?');
  });

  it('answers a git request through the shortcut without starting a turn', async () => {
    const root = await makeRoot();
    const runChatTurn = vi.fn(async () => 'ok');

    const { res, json } = fakeRes();
    await route(root, 'POST', {
      ...agentCtx(runChatTurn),
      git: {
        getStatusSnapshot: async () => ({ branch: 'main', entries: [] }),
        runGitSync: async () => ({ ok: true }),
      } as unknown as RouteContext['git'],
    }).handle(fakeReq(JSON.stringify({ text: 'pull and push' })), res);

    expect(json()).toEqual({ ok: true });
    expect(runChatTurn).not.toHaveBeenCalled();
    expect(await readFile(chatPath(root), 'utf-8')).toContain('[chat] [agent] Synced');
  });

  it('rejects an empty message', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, 'POST').handle(fakeReq(JSON.stringify({ text: '  ' })), res);
    expect(status()).toBe(400);
    expect(json()).toEqual({ error: 'text is required' });
  });
});

describe('POST /api/chat/retry', () => {
  it('re-sends the last user message without appending it again', async () => {
    const root = await makeRoot();
    const today = new Date().toISOString().slice(0, 10);
    await writeFile(
      chatPath(root),
      [
        '### Thread',
        `- [x] ${today} [chat] What is running?`,
        `- [x] ${today} [chat] [agent] agent unavailable`,
      ].join('\n'),
      'utf-8',
    );
    const runChatTurn = vi.fn(async () => 'Nothing is running.');

    const { res, status, json } = fakeRes();
    await routeAt(root, '/api/chat/retry', 'POST', agentCtx(runChatTurn)).handle(fakeReq(), res);

    expect(status()).toBe(200);
    expect(json()).toEqual({ ok: true });
    expect(runChatTurn).toHaveBeenCalledWith('What is running?', expect.anything());
    const chatFile = await waitForChat(root, 'Nothing is running.');
    expect(chatFile.match(/What is running\?/g)).toHaveLength(1);
  });

  it('refuses when there is no user message to re-send', async () => {
    const root = await makeRoot();
    const runChatTurn = vi.fn(async () => 'ok');

    const { res, status } = fakeRes();
    await routeAt(root, '/api/chat/retry', 'POST', agentCtx(runChatTurn)).handle(fakeReq(), res);

    expect(status()).toBe(400);
    expect(runChatTurn).not.toHaveBeenCalled();
  });
});

describe('POST /api/chat/allow', () => {
  const ask = { tool: 'Bash', target: 'pnpm test' };
  const allow = async (root: string, body: unknown, ctx: Partial<RouteContext>) => {
    const { res, status, json } = fakeRes();
    await routeAt(root, '/api/chat/allow', 'POST', ctx).handle(fakeReq(JSON.stringify(body)), res);
    return { status: status(), json: json() };
  };
  const settingsPath = (root: string) => join(root, '.claude', 'settings.json');

  it('re-sends the turn with the tool allowed once, leaving the settings alone', async () => {
    const root = await makeRoot();
    const runChatTurn = vi.fn(async () => 'Tests pass.');

    const result = await allow(root, { ...ask, choice: 'once' }, agentCtx(runChatTurn));

    expect(result).toEqual({ status: 200, json: { ok: true } });
    expect(runChatTurn).toHaveBeenCalledWith('Allowed once: Bash `pnpm test`. Go ahead.', {
      branch: { name: 'main', dirty: [] },
      allow: [ask],
    });
    expect(await waitForChat(root, 'Tests pass.')).toContain(
      '[chat] Allowed once: Bash `pnpm test`. Go ahead.',
    );
    await expect(access(settingsPath(root))).rejects.toThrow();
  });

  it('appends the rule to the claude-code allowlist on always, keeping what is there', async () => {
    const root = await makeRoot();
    await mkdir(join(root, '.claude'), { recursive: true });
    await writeFile(
      settingsPath(root),
      JSON.stringify({ permissions: { allow: ['Bash(git status)'] }, hooks: {} }),
    );
    const runChatTurn = vi.fn(async () => 'ok');

    await allow(root, { ...ask, choice: 'always' }, agentCtx(runChatTurn));
    await allow(root, { ...ask, choice: 'always' }, agentCtx(runChatTurn));

    const settings = JSON.parse(await readFile(settingsPath(root), 'utf-8'));
    expect(settings).toEqual({
      permissions: { allow: ['Bash(git status)', 'Bash(pnpm test)'] },
      hooks: {},
    });
    expect(runChatTurn).toHaveBeenLastCalledWith(
      'Always allowed: Bash `pnpm test`. Go ahead.',
      expect.objectContaining({ allow: [ask] }),
    );
  });

  it('writes opencode.json when the chat runs on opencode', async () => {
    const root = await makeRoot();
    const configPath = join(root, 'papercamp', 'config.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    await writeFile(
      configPath,
      JSON.stringify({ ...config, defaultAgents: { chat: { agent: 'opencode' } } }),
    );
    await writeFile(join(root, 'opencode.json'), JSON.stringify({ mcp: {} }));

    await allow(
      root,
      { tool: 'bash', target: 'pnpm test', choice: 'always' },
      agentCtx(vi.fn(async () => 'ok')),
    );

    expect(JSON.parse(await readFile(join(root, 'opencode.json'), 'utf-8'))).toEqual({
      mcp: {},
      permission: { bash: { 'pnpm test': 'allow' } },
    });
  });

  it('re-sends the turn without the tool on skip', async () => {
    const root = await makeRoot();
    const runChatTurn = vi.fn(async () => 'Skipped.');

    await allow(root, { ...ask, choice: 'skip' }, agentCtx(runChatTurn));

    expect(runChatTurn).toHaveBeenCalledWith('Skip Bash `pnpm test`. Carry on without it.', {
      branch: { name: 'main', dirty: [] },
    });
  });

  it('rejects an unknown choice', async () => {
    const root = await makeRoot();
    const runChatTurn = vi.fn(async () => 'ok');
    const result = await allow(root, { ...ask, choice: 'forever' }, agentCtx(runChatTurn));
    expect(result.status).toBe(400);
    expect(runChatTurn).not.toHaveBeenCalled();
  });

  it('refuses while a chat turn is still running', async () => {
    const root = await makeRoot();
    const runChatTurn = vi.fn(async () => 'ok');
    const result = await allow(
      root,
      { ...ask, choice: 'once' },
      agentCtx(runChatTurn, [{ taskKind: 'chat', status: 'running' }]),
    );
    expect(result.status).toBe(409);
    expect(runChatTurn).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/chat', () => {
  it('clears the thread except unanswered questions and drops the session file', async () => {
    const root = await makeRoot();
    await writeFile(
      chatPath(root),
      [
        '### Thread',
        '- [x] 2026-09-11 [chat] Hello',
        '- [ ] 2026-09-11 [question] [agent] Which auth flow?',
        '- [x] 2026-09-11 [question] [agent] Resolved one',
      ].join('\n'),
      'utf-8',
    );
    const sessionPath = join(root, 'papercamp', '.local', 'chat-session.json');
    await mkdir(join(root, 'papercamp', '.local'), { recursive: true });
    await writeFile(sessionPath, JSON.stringify({ sessionId: 's1', agent: 'claude-code' }));

    const { res, status, json } = fakeRes();
    await route(root, 'DELETE').handle(fakeReq(), res);
    expect(status()).toBe(200);
    expect(json()).toEqual({ ok: true });

    const chatFile = await readFile(chatPath(root), 'utf-8');
    expect(chatFile).toContain('Which auth flow?');
    expect(chatFile).not.toContain('Hello');
    expect(chatFile).not.toContain('Resolved one');
    await expect(access(sessionPath)).rejects.toThrow();
  });
});
