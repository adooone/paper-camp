import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatChatFile } from '@/core/chat-file';
import type { ThreadMessage } from '@/types/index';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgentManager } from './agent';

const fake = vi.hoisted(() => ({ script: '', callsFile: '' }));

vi.mock('./local-adapters', () => ({
  claudeAuthStatus: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./agents', async () => {
  const claudeCode =
    await vi.importActual<typeof import('./agents/claude-code')>('./agents/claude-code');
  const adapter = {
    command: process.execPath,
    buildArgs: () => ['-e', 'process.exit(0)'],
    buildReadOnlyArgs: () => [],
    buildChatArgs: (prompt: string, opts?: { resume?: string }) => [
      '-e',
      `require('node:fs').appendFileSync(${JSON.stringify(fake.callsFile)}, JSON.stringify({ prompt: process.argv[1], resume: process.argv[2] }) + '\\n');\n${fake.script}`,
      prompt,
      opts?.resume ?? '',
    ],
    parseLine: () => null,
    parseChatLine: claudeCode.parseChatLine,
    options: {},
  };
  return {
    AGENTS: { 'claude-code': adapter, opencode: adapter },
    resolveAgent: () => ({ id: 'claude-code' as const, adapter }),
  };
});

function emit(events: Record<string, unknown>[]): string {
  return events.map((event) => `console.log(${JSON.stringify(JSON.stringify(event))});`).join('\n');
}

function reply(sessionId: string, text: string, extra: Record<string, unknown> = {}): string {
  return emit([
    { type: 'system', subtype: 'init', session_id: sessionId },
    { type: 'stream_event', event: { type: 'message_start' } },
    {
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: text.slice(0, 3) } },
    },
    {
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: text.slice(3) } },
    },
    { type: 'result', is_error: false, result: text, session_id: sessionId, ...extra },
  ]);
}

let root: string;
let events: Record<string, unknown>[];

function manager() {
  return createAgentManager(
    root,
    {},
    {
      state: {
        tasks: new Map(),
        lastLaunchedId: undefined,
        lastExclusiveLaunchedId: undefined,
        pendingFixReviewResult: null,
      },
      publish: (payload) => events.push(payload),
    },
  );
}

async function calls(): Promise<{ prompt: string; resume: string }[]> {
  const raw = await readFile(fake.callsFile, 'utf-8');
  return raw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

async function savedSession(): Promise<unknown> {
  return JSON.parse(await readFile(join(root, 'papercamp/.local/chat-session.json'), 'utf-8'));
}

async function saveSession(session: Record<string, unknown>): Promise<void> {
  await mkdir(join(root, 'papercamp/.local'), { recursive: true });
  await writeFile(join(root, 'papercamp/.local/chat-session.json'), JSON.stringify(session));
}

function chatEvents(): Record<string, unknown>[] {
  return events.filter((event) => event.type === 'chat');
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'papercamp-chat-turn-'));
  await mkdir(join(root, 'papercamp'), { recursive: true });
  fake.callsFile = join(root, 'calls.jsonl');
  events = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('runChatTurn', () => {
  it('starts a session with the preamble, streams the reply and saves the session', async () => {
    fake.script = `${emit([
      { type: 'system', subtype: 'init', session_id: 'sess-1' },
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Read', input: { file_path: `${root}/src/routes/chat.ts` } },
          ],
        },
      },
    ])}\n${reply('sess-1', 'Hello there')}`;
    const agent = manager();

    const text = await agent.runChatTurn('which file handles chat?', {
      branch: { name: 'main', dirty: ['src/a.ts'] },
    });

    expect(text).toBe('Hello there');
    const [call] = await calls();
    expect(call.resume).toBe('');
    expect(call.prompt).toContain('You are Paper Scout');
    expect(call.prompt).toContain('Branch: main, dirty: src/a.ts');
    expect(call.prompt).toContain('Active runs: none');
    expect(call.prompt.endsWith('which file handles chat?')).toBe(true);
    expect(await savedSession()).toEqual({ sessionId: 'sess-1', agent: 'claude-code' });

    const chat = chatEvents();
    expect(chat.filter((e) => e.stage).map((e) => e.stage)).toEqual([
      'reading',
      'thinking',
      'replying',
      'done',
    ]);
    expect(chat.filter((e) => e.tool).map((e) => e.tool)).toEqual(['Reading src/routes/chat.ts']);
    expect(chat.filter((e) => e.chunk).map((e) => e.chunk)).toEqual(['Hel', 'Hello there']);

    const [task] = agent.getStatus();
    expect(task).toMatchObject({ taskKind: 'chat', status: 'done', planTitle: 'Project chat' });
  });

  it('resumes the saved session and sends only the status and the new message', async () => {
    await saveSession({ sessionId: 'sess-1', agent: 'claude-code' });
    fake.script = reply('sess-1', 'Second answer');

    const text = await manager().runChatTurn('and then?');

    expect(text).toBe('Second answer');
    const [call] = await calls();
    expect(call.resume).toBe('sess-1');
    expect(call.prompt).not.toContain('You are Paper Scout');
    expect(call.prompt).toBe('Branch: unknown\nActive runs: none\n\nand then?');
  });

  it('starts fresh and replays the last chat messages when the resume fails', async () => {
    await saveSession({ sessionId: 'gone', agent: 'claude-code' });
    const history: ThreadMessage[] = Array.from({ length: 12 }, (_, i) => ({
      kind: 'chat',
      date: '2026-11-14T10:00',
      text: `message ${i}`,
      ...(i % 2 ? { from: 'agent' as const } : {}),
    }));
    history.push({ kind: 'chat', date: '2026-11-14T10:30', text: 'where were we?' });
    await writeFile(join(root, 'papercamp/chat.md'), formatChatFile(history));
    fake.script = `if (process.argv[2]) { console.error('No conversation found with session ID: gone'); process.exit(1); }\n${reply('sess-2', 'Fresh answer')}`;

    const text = await manager().runChatTurn('where were we?');

    expect(text).toBe('Fresh answer');
    const [resumed, fresh] = await calls();
    expect(resumed.resume).toBe('gone');
    expect(fresh.resume).toBe('');
    expect(fresh.prompt).toContain('You are Paper Scout');
    expect(fresh.prompt).toContain('User: message 2\n');
    expect(fresh.prompt).toContain('Scout: message 11\n');
    expect(fresh.prompt).not.toContain(': message 1\n');
    expect(fresh.prompt.split('where were we?')).toHaveLength(2);
    expect(await savedSession()).toEqual({ sessionId: 'sess-2', agent: 'claude-code' });
  });

  it('ignores a session saved by another agent', async () => {
    await saveSession({ sessionId: 'oc-1', agent: 'opencode' });
    fake.script = reply('sess-3', 'New agent');

    await manager().runChatTurn('hi');

    const [call] = await calls();
    expect(call.resume).toBe('');
    expect(call.prompt).toContain('You are Paper Scout');
  });

  it('publishes each permission denial as a permission event', async () => {
    fake.script = reply('sess-1', 'I need to run the tests.', {
      permission_denials: [
        { tool_name: 'Bash', tool_use_id: 't1', tool_input: { command: 'pnpm test' } },
      ],
    });

    await manager().runChatTurn('run the tests');

    expect(chatEvents().filter((e) => e.permission)).toEqual([
      expect.objectContaining({ permission: { tool: 'Bash', target: 'pnpm test' } }),
    ]);
  });

  it('rejects with the failure, publishes failed and records the task as an error', async () => {
    fake.script = emit([
      { type: 'result', is_error: true, result: 'API overloaded', session_id: 'sess-1' },
    ]);
    const agent = manager();

    await expect(agent.runChatTurn('hello')).rejects.toThrow('API overloaded');

    expect(chatEvents().at(-1)).toMatchObject({ stage: 'failed', error: 'API overloaded' });
    expect(agent.getStatus()[0]).toMatchObject({ taskKind: 'chat', status: 'error' });
  });
});
