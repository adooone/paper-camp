import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChatPermissionCard, permissionQuestion } from './chat-permission-card';

describe('permissionQuestion', () => {
  it('phrases a shell command as a run', () => {
    expect(permissionQuestion({ tool: 'Bash', target: 'pnpm test' })).toEqual({
      verb: 'Run',
      target: 'pnpm test',
    });
  });

  it('phrases opencode tools the same way', () => {
    expect(permissionQuestion({ tool: 'bash', target: 'pnpm test' }).verb).toBe('Run');
    expect(permissionQuestion({ tool: 'edit', target: 'src/a.ts' }).verb).toBe('Edit');
  });

  it('falls back to the tool name', () => {
    expect(permissionQuestion({ tool: 'mcp__github__create_issue' })).toEqual({
      verb: 'Use mcp__github__create_issue',
    });
    expect(permissionQuestion({ tool: 'Grep', target: 'TODO' })).toEqual({
      verb: 'Use Grep on',
      target: 'TODO',
    });
  });
});

describe('ChatPermissionCard', () => {
  it('names the tool and target and offers the three choices', () => {
    const html = renderToStaticMarkup(
      <ChatPermissionCard ask={{ tool: 'Bash', target: 'pnpm test' }} onChoose={vi.fn()} />,
    );
    expect(html).toContain('Run');
    expect(html).toContain('pnpm test');
    expect(html).toContain('<code');
    for (const label of ['Allow once', 'Always allow', 'Skip']) expect(html).toContain(label);
  });

  it('disables the choices while a turn is running', () => {
    const html = renderToStaticMarkup(
      <ChatPermissionCard
        ask={{ tool: 'Bash', target: 'pnpm test' }}
        disabled
        onChoose={vi.fn()}
      />,
    );
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });
});
