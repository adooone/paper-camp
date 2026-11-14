import { classifyAnchor } from '@/core/phase-progress';
import type { AgentRunOptions, ChatPermissionAsk } from '@/types/index';
import type { ParsedChatLine } from './chat';
import { clip, describePaperCampTool, stringField } from './chat';
import type { ParsedAgentLine } from './claude-code';

export function buildArgs(prompt: string, opts?: AgentRunOptions): string[] {
  const args = ['run', prompt, '--format', 'json'];
  if (opts?.model) args.push('-m', opts.model);
  if (opts?.effort) args.push('--variant', opts.effort);
  return args;
}

export function buildChatArgs(prompt: string, opts?: AgentRunOptions): string[] {
  const args = ['run', prompt, '--format', 'json'];
  if (opts?.resume) args.push('--session', opts.resume);
  if (opts?.model) args.push('-m', opts.model);
  if (opts?.effort) args.push('--variant', opts.effort);
  return args;
}

type PermissionConfig = Record<string, unknown>;

function bashPattern(target: string): string {
  return target.endsWith('…') ? `${target.slice(0, -1).trimEnd()}*` : target;
}

export function mergePermission(existing: unknown, asks: ChatPermissionAsk[]): PermissionConfig {
  const merged: PermissionConfig =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as PermissionConfig) }
      : {};
  for (const { tool, target } of asks) {
    const key = tool.toLowerCase();
    if (key !== 'bash' || !target) {
      merged[key] = 'allow';
      continue;
    }
    const current = merged.bash;
    const patterns =
      current && typeof current === 'object'
        ? { ...(current as PermissionConfig) }
        : typeof current === 'string'
          ? { '*': current }
          : {};
    merged.bash = { ...patterns, [bashPattern(target)]: 'allow' };
  }
  return merged;
}

export function buildChatEnv(opts?: AgentRunOptions): Record<string, string> | undefined {
  if (!opts?.allow?.length) return undefined;
  return { OPENCODE_PERMISSION: JSON.stringify(mergePermission(undefined, opts.allow)) };
}

export function buildReadOnlyArgs(opts?: AgentRunOptions): string[] {
  const args = ['run', '--format', 'json'];
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

// Only file-path tools give a target we can call "outside workspace" — a denied
// bash/webfetch isn't a workspace-boundary question, so it gets a generic denial.
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

const PAPER_CAMP_TOOL_PREFIX = 'paper-camp_';

const CHAT_TOOL_VERBS: Record<string, [string, string]> = {
  read: ['Reading', 'a file'],
  edit: ['Editing', 'a file'],
  write: ['Writing', 'a file'],
  bash: ['Running', 'a command'],
  grep: ['Searching for', 'the code'],
  glob: ['Finding', 'files'],
  webfetch: ['Fetching', 'a page'],
  websearch: ['Searching the web for', 'the web'],
};

function describeChatTool(tool: string, input: Record<string, unknown> | undefined): string | null {
  if (tool.startsWith(PAPER_CAMP_TOOL_PREFIX)) {
    return describePaperCampTool(tool.slice(PAPER_CAMP_TOOL_PREFIX.length), input);
  }
  if (tool === 'todowrite' || tool === 'todoread') return null;
  const verb = CHAT_TOOL_VERBS[tool];
  if (!verb) return `Using ${tool}`;
  const target = stringField(input, 'filePath', 'command', 'pattern', 'url', 'query');
  return target ? `${verb[0]} ${target}` : `${verb[0]} ${verb[1]}`;
}

export function parseChatLine(line: string): ParsedChatLine | null {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(line);
  } catch {
    return null;
  }

  const part = json.part as Record<string, unknown> | undefined;
  const sessionOnly = typeof json.sessionID === 'string' ? { sessionId: json.sessionID } : null;
  const session = sessionOnly ?? {};

  if (json.type === 'text') {
    const text = typeof part?.text === 'string' ? part.text.trim() : '';
    return text ? { ...session, text } : sessionOnly;
  }
  if (json.type !== 'tool_use' || typeof part?.tool !== 'string') return sessionOnly;

  const tool = part.tool;
  const state = part.state as Record<string, unknown> | undefined;
  const input = state?.input as Record<string, unknown> | undefined;
  if (state?.status === 'error' && state.error === PERMISSION_DENIAL_ERROR) {
    const target = permissionTarget(tool, input);
    return { ...session, permissions: [{ tool, ...(target && { target: clip(target) }) }] };
  }
  const label = describeChatTool(tool, input);
  return label ? { ...session, tools: [clip(label)] } : sessionOnly;
}
