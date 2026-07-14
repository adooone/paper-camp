import type { AgentRunOptions } from '@/types/index';

export interface ParsedAgentLine {
  text: string;
  done?: boolean;
  error?: boolean;
}

export function buildArgs(prompt: string, opts?: AgentRunOptions): string[] {
  const args = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    'auto',
    // These are headless, terminal-only jobs. Hard-block every path out of the
    // terminal so a phase can't try to "visually check" the running app — a
    // prompt instruction alone can't stop a tool the agent can actually reach.
    // --strict-mcp-config drops ALL ambient MCP servers (the developer's
    // browser / computer-use / chrome servers get inherited otherwise, since
    // there's no project .mcp.json), independent of their names; --disallowedTools
    // blocks the built-in web tools. Verification must go through the terminal
    // (type-check / lint / tests), never a browser or fetched URL.
    '--strict-mcp-config',
    '--disallowedTools',
    'WebFetch',
    'WebSearch',
  ];
  if (opts?.model) args.push('--model', opts.model);
  if (opts?.effort) args.push('--effort', opts.effort);
  return args;
}

/**
 * Shape confirmed by a live `claude -p ... --output-format stream-json` smoke test
 * (see decisions.md, "Confirm Claude Code's headless stream-json shape..."), not guessed
 * from --help. Unknown subtypes fall through to a generic status line rather than being
 * dropped or throwing, since new bookkeeping subtypes (e.g. thinking_tokens) can appear.
 */
export function parseLine(line: string): ParsedAgentLine | null {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(line);
  } catch {
    return null;
  }

  switch (json.type) {
    case 'system': {
      if (json.subtype === 'init') {
        return { text: 'Agent session started' };
      }
      if (json.subtype === 'post_turn_summary' && typeof json.status_detail === 'string') {
        return { text: json.status_detail };
      }
      return null;
    }
    case 'rate_limit_event':
      return null;
    case 'assistant': {
      const message = json.message as { content?: unknown[] } | undefined;
      const blocks = message?.content ?? [];
      for (const block of blocks) {
        const b = block as { type?: string; name?: string; text?: string };
        if (b.type === 'tool_use') {
          return { text: `Running ${b.name ?? 'a tool'}…` };
        }
        if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
          return { text: b.text.trim() };
        }
      }
      return null;
    }
    case 'user': {
      const message = json.message as { content?: unknown[] } | undefined;
      const content = message?.content;
      const block = Array.isArray(content) ? (content[0] as Record<string, unknown>) : undefined;
      if (block?.is_error) {
        const text = typeof block.content === 'string' ? block.content : 'Tool call failed';
        return { text: `Error: ${text}`, error: true };
      }
      return { text: 'Tool finished' };
    }
    case 'result': {
      const error = Boolean(json.is_error);
      const result = typeof json.result === 'string' ? json.result.trim() : '';
      const text = result || (error ? 'Agent run failed' : 'Agent run finished');
      return { text, done: true, error };
    }
    default:
      return { text: 'Agent is working…' };
  }
}
