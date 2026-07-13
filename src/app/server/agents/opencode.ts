import type { AgentRunOptions } from '../../../types/index';
import type { ParsedAgentLine } from './claude-code';

export function buildArgs(prompt: string, opts?: AgentRunOptions): string[] {
  const args = ['run', prompt, '--format', 'json'];
  if (opts?.model) args.push('-m', opts.model);
  if (opts?.effort) args.push('--variant', opts.effort);
  return args;
}

const TOOL_LABELS: Record<string, string> = {
  bash: 'Running command',
  read: 'Reading file',
  edit: 'Editing file',
  write: 'Writing file',
  glob: 'Searching files',
  grep: 'Searching code',
  websearch: 'Searching web',
  webfetch: 'Fetching URL',
  question: 'Asking for input',
};

export function parseLine(line: string): ParsedAgentLine | null {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(line);
  } catch {
    return null;
  }

  const type = json.type as string | undefined;
  const part = json.part as Record<string, unknown> | undefined;

  if (!type || !part) return null;

  switch (type) {
    case 'step_start':
      return null;
    case 'text': {
      const text = part.text as string | undefined;
      if (text?.trim()) return { text: text.trim() };
      return null;
    }
    case 'tool_use': {
      const tool = part.tool as string | undefined;
      const input = part.state ? (part.state as Record<string, unknown>).input : undefined;
      const desc = input ? (input as Record<string, unknown>).description : undefined;
      const label = tool ? TOOL_LABELS[tool] : 'Running tool';
      const detail = typeof desc === 'string' && desc.trim() ? `: ${desc.trim()}` : '';
      return tool ? { text: `${label}${detail}…` } : null;
    }
    case 'step_finish': {
      const reason = part.reason as string | undefined;
      const text = reason === 'tool-calls' ? null : reason === 'stop' ? 'Done' : 'Step finished';
      if (!text) return null;
      return { text };
    }
    default:
      return null;
  }
}
