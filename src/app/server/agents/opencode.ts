import { classifyAnchor } from '@/core/phase-progress';
import type { AgentRunOptions } from '@/types/index';
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

const PERMISSION_DENIAL_ERROR = 'The user rejected permission to use this specific tool call.';

const PERMISSION_VERBS: Record<string, string> = {
  read: 'read',
  write: 'write',
  edit: 'edit',
  bash: 'run',
  webfetch: 'fetch',
};

// Only file-path tools give us a target we can actually call "outside
// workspace" — a denied bash command or URL fetch isn't a workspace-boundary
// question, so those get a generic denial reason instead.
const EXTERNAL_DIRECTORY_TOOLS = new Set(['read', 'write', 'edit']);

function permissionTarget(
  tool: string,
  input: Record<string, unknown> | undefined,
): string | undefined {
  if (!input) return undefined;
  if (tool === 'bash') return typeof input.command === 'string' ? input.command : undefined;
  if (tool === 'webfetch') return typeof input.url === 'string' ? input.url : undefined;
  return typeof input.filePath === 'string' ? input.filePath : undefined;
}

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
      const state = part.state as Record<string, unknown> | undefined;
      const input = state?.input as Record<string, unknown> | undefined;
      if (tool && state?.status === 'error' && state.error === PERMISSION_DENIAL_ERROR) {
        const target = permissionTarget(tool, input);
        const verb = PERMISSION_VERBS[tool] ?? tool;
        const reason =
          target && EXTERNAL_DIRECTORY_TOOLS.has(tool)
            ? `${verb} outside workspace: ${target}`
            : target
              ? `${verb} denied by permission ask: ${target}`
              : `${verb} denied by permission ask`;
        return { text: reason, error: true, reason };
      }
      const desc = input?.description;
      const label = tool ? TOOL_LABELS[tool] : 'Running tool';
      const detail = typeof desc === 'string' && desc.trim() ? `: ${desc.trim()}` : '';
      if (!tool) return null;
      const milestone = classifyAnchor(tool, input) ?? undefined;
      return { text: `${label}${detail}…`, ...(milestone && { milestone }) };
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
