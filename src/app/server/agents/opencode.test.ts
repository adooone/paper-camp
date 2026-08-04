import { describe, expect, it } from 'vitest';
import { parseLine } from './opencode';

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
      input: { filePath: '/home/user/dev/paper-ui/src/components/select/select.tsx' },
      error: 'The user rejected permission to use this specific tool call.',
    });

    expect(parseLine(line)).toEqual({
      text: 'read outside workspace: /home/user/dev/paper-ui/src/components/select/select.tsx',
      error: true,
      reason: 'read outside workspace: /home/user/dev/paper-ui/src/components/select/select.tsx',
    });
  });

  it('extracts a reason for a denied bash command', () => {
    const line = toolUseLine('bash', {
      status: 'error',
      input: { command: 'rm -rf /' },
      error: 'The user rejected permission to use this specific tool call.',
    });

    expect(parseLine(line)).toEqual({
      text: 'run outside workspace: rm -rf /',
      error: true,
      reason: 'run outside workspace: rm -rf /',
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
