import { describe, expect, it } from 'vitest';
import { buildChatArgs, buildChatEnv, mergePermission, parseChatLine, parseLine } from './opencode';

function toolUseLine(tool: string, state: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'tool_use',
    part: { tool, state },
  });
}

describe('opencode parseLine', () => {
  it('extracts a human reason from an external_directory permission denial on read', () => {
    const line = toolUseLine('read', {
      status: 'error',
      input: { filePath: '/home/user/dev/folk-ui/src/components/select/select.tsx' },
      error: 'The user rejected permission to use this specific tool call.',
    });

    expect(parseLine(line)).toEqual({
      text: 'read outside workspace: /home/user/dev/folk-ui/src/components/select/select.tsx',
      error: true,
      reason: 'read outside workspace: /home/user/dev/folk-ui/src/components/select/select.tsx',
    });
  });

  it('extracts a generic denial reason for a denied bash command', () => {
    const line = toolUseLine('bash', {
      status: 'error',
      input: { command: 'rm -rf /' },
      error: 'The user rejected permission to use this specific tool call.',
    });

    expect(parseLine(line)).toEqual({
      text: 'run denied by permission ask: rm -rf /',
      error: true,
      reason: 'run denied by permission ask: rm -rf /',
    });
  });

  it('leaves ordinary tool_use events untouched', () => {
    const line = toolUseLine('read', {
      status: 'completed',
      input: { filePath: 'src/index.ts' },
    });

    expect(parseLine(line)).toEqual({ text: 'Reading file…' });
  });

  it('ignores an unrelated tool error', () => {
    const line = toolUseLine('bash', {
      status: 'error',
      input: { command: 'exit 1' },
      error: 'command failed',
    });

    const parsed = parseLine(line);
    expect(parsed?.error).toBeUndefined();
    expect(parsed?.reason).toBeUndefined();
  });
});

describe('opencode buildChatArgs', () => {
  it('runs a fresh session without --session', () => {
    expect(buildChatArgs('hello')).toEqual(['run', 'hello', '--format', 'json']);
  });

  it('continues the chat session with --session', () => {
    expect(buildChatArgs('hello', { resume: 'ses_1', model: 'm' })).toEqual([
      'run',
      'hello',
      '--format',
      'json',
      '--session',
      'ses_1',
      '-m',
      'm',
    ]);
  });
});

describe('opencode mergePermission', () => {
  it('adds a command pattern to bash, keeping the existing default', () => {
    expect(
      mergePermission({ bash: 'ask', edit: 'ask' }, [{ tool: 'bash', target: 'pnpm test' }]),
    ).toEqual({
      bash: { '*': 'ask', 'pnpm test': 'allow' },
      edit: 'ask',
    });
  });

  it('extends existing bash patterns and globs a clipped command', () => {
    expect(
      mergePermission({ bash: { 'git *': 'allow' } }, [
        { tool: 'bash', target: 'pnpm vitest run …' },
      ]),
    ).toEqual({ bash: { 'git *': 'allow', 'pnpm vitest run*': 'allow' } });
  });

  it('allows a non-shell tool outright', () => {
    expect(mergePermission(undefined, [{ tool: 'webfetch', target: 'https://x.dev' }])).toEqual({
      webfetch: 'allow',
    });
  });
});

describe('opencode buildChatEnv', () => {
  it('carries a once-allowed tool in OPENCODE_PERMISSION', () => {
    const env = buildChatEnv({ allow: [{ tool: 'bash', target: 'pnpm test' }] });
    expect(JSON.parse(env?.OPENCODE_PERMISSION ?? '{}')).toEqual({
      bash: { 'pnpm test': 'allow' },
    });
  });

  it('sets nothing without an allow', () => {
    expect(buildChatEnv({})).toBeUndefined();
  });
});

describe('opencode parseChatLine', () => {
  it('carries the session id and the text of a text part', () => {
    const line = JSON.stringify({ type: 'text', sessionID: 'ses_1', part: { text: ' Hello ' } });
    expect(parseChatLine(line)).toEqual({ sessionId: 'ses_1', text: 'Hello' });
  });

  it('describes a tool call with its target', () => {
    const line = JSON.stringify({
      type: 'tool_use',
      sessionID: 'ses_1',
      part: { tool: 'read', state: { status: 'completed', input: { filePath: 'src/a.ts' } } },
    });
    expect(parseChatLine(line)).toEqual({ sessionId: 'ses_1', tools: ['Reading src/a.ts'] });
  });

  it('names a paper-camp MCP tool', () => {
    const line = JSON.stringify({
      type: 'tool_use',
      part: {
        tool: 'paper-camp_update_phase',
        state: { status: 'completed', input: { id: 'IDEA-4' } },
      },
    });
    expect(parseChatLine(line)).toEqual({ tools: ['Updating a phase of IDEA-4'] });
  });

  it('reports a permission ask as a permission with tool and target', () => {
    const line = toolUseLine('bash', {
      status: 'error',
      input: { command: 'pnpm test' },
      error: 'The user rejected permission to use this specific tool call.',
    });
    expect(parseChatLine(line)).toEqual({ permissions: [{ tool: 'bash', target: 'pnpm test' }] });
  });

  it('keeps only the session id from other events', () => {
    const line = JSON.stringify({ type: 'step_start', sessionID: 'ses_1', part: {} });
    expect(parseChatLine(line)).toEqual({ sessionId: 'ses_1' });
    expect(parseChatLine('not json')).toBeNull();
  });
});
