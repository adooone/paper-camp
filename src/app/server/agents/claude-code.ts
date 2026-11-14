import { classifyAnchor } from '@/core/phase-progress';
import type {
  AgentRunOptions,
  ChatPermissionAsk,
  PhaseMilestone,
  RateLimitSnapshot,
  RateLimitWindow,
  RateLimitWindowKey,
  RunUsage,
} from '@/types/index';
import { type ParsedChatLine, clip, describePaperCampTool, stringField } from './chat';

export interface ParsedAgentLine {
  text: string;
  done?: boolean;
  error?: boolean;
  reason?: string;
  sessionId?: string;
  milestone?: PhaseMilestone;
  usage?: RunUsage;
  rateLimit?: RateLimitSnapshot;
  turnContextTokens?: number;
}

function readNum(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function dominantModel(
  json: Record<string, unknown>,
  modelUsage: Record<string, Record<string, unknown>> | undefined,
): string | undefined {
  if (typeof json.model === 'string') return json.model;
  if (!modelUsage) return undefined;
  let best: string | undefined;
  let bestOut = -1;
  for (const [name, u] of Object.entries(modelUsage)) {
    const out = readNum(u?.outputTokens);
    if (out > bestOut) {
      bestOut = out;
      best = name;
    }
  }
  return best;
}

export function extractUsage(json: Record<string, unknown>): RunUsage {
  const modelUsage = json.modelUsage as Record<string, Record<string, unknown>> | undefined;
  const usage = (json.usage ?? {}) as Record<string, unknown>;
  let inputTokens = readNum(usage.input_tokens);
  let outputTokens = readNum(usage.output_tokens);
  let cacheCreationTokens = readNum(usage.cache_creation_input_tokens);
  let cacheReadTokens = readNum(usage.cache_read_input_tokens);
  if (modelUsage) {
    inputTokens = outputTokens = cacheCreationTokens = cacheReadTokens = 0;
    for (const u of Object.values(modelUsage)) {
      if (!u || typeof u !== 'object') continue;
      inputTokens += readNum(u.inputTokens);
      outputTokens += readNum(u.outputTokens);
      cacheCreationTokens += readNum(u.cacheCreationInputTokens);
      cacheReadTokens += readNum(u.cacheReadInputTokens);
    }
  }
  return {
    durationMs: readNum(json.duration_ms),
    numTurns: readNum(json.num_turns),
    model: dominantModel(json, modelUsage),
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    costUsd: readNum(json.total_cost_usd),
  };
}

// Sum of everything the turn's request carried — the figure that tracks toward
// the context window limit, not just the freshly-billed `input_tokens` slice.
function extractContextTokens(usage: Record<string, unknown>): number {
  return (
    readNum(usage.input_tokens) +
    readNum(usage.cache_creation_input_tokens) +
    readNum(usage.cache_read_input_tokens)
  );
}

const WINDOW_KEYS: RateLimitWindowKey[] = ['five_hour', 'seven_day'];

function extractWindows(
  value: unknown,
): Partial<Record<RateLimitWindowKey, RateLimitWindow>> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const source = value as Record<string, unknown>;
  const windows: Partial<Record<RateLimitWindowKey, RateLimitWindow>> = {};
  for (const key of WINDOW_KEYS) {
    const raw = source[key];
    if (typeof raw !== 'object' || raw === null) continue;
    const { utilization, resetsAt } = raw as Record<string, unknown>;
    if (typeof utilization !== 'number' || !Number.isFinite(utilization)) continue;
    windows[key] = {
      utilization,
      ...(typeof resetsAt === 'number' && Number.isFinite(resetsAt) && { resetsAt }),
    };
  }
  return Object.keys(windows).length > 0 ? windows : undefined;
}

function extractRateLimit(json: Record<string, unknown>): RateLimitSnapshot | null {
  // `rate_limit_info` is what the CLI actually emits; the others are older spellings.
  const rl = (json.rate_limit_info ?? json.rate_limit ?? json.rateLimit ?? json) as Record<
    string,
    unknown
  >;
  const status = typeof rl.status === 'string' ? rl.status : undefined;
  if (!status) return null;
  const rateLimitType =
    typeof rl.rateLimitType === 'string'
      ? rl.rateLimitType
      : typeof rl.rate_limit_type === 'string'
        ? rl.rate_limit_type
        : undefined;
  const resetsAtRaw = rl.resetsAt ?? rl.resets_at;
  const resetsAt =
    typeof resetsAtRaw === 'number' && Number.isFinite(resetsAtRaw) ? resetsAtRaw : undefined;
  const overage = Boolean(rl.isUsingOverage ?? rl.overage ?? rl.usingOverage ?? rl.overageActive);
  const unifiedWindows = extractWindows(rl.unifiedWindows);
  return {
    status,
    rateLimitType,
    resetsAt,
    overage,
    ...(unifiedWindows && { unifiedWindows }),
  };
}

const MCP_CONFIG = JSON.stringify({
  mcpServers: { 'paper-camp': { command: 'paper-camp', args: ['mcp'] } },
});

function baseArgs(prompt: string): string[] {
  return [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    'auto',
    // --strict-mcp-config drops ambient MCP servers (browser/computer-use),
    // keeping only the paper-camp server named in --mcp-config.
    '--mcp-config',
    MCP_CONFIG,
    '--strict-mcp-config',
  ];
}

function runOptionArgs(opts?: AgentRunOptions): string[] {
  const args: string[] = [];
  if (opts?.model) args.push('--model', opts.model);
  if (opts?.effort) args.push('--effort', opts.effort);
  if (opts?.resume) args.push('--resume', opts.resume);
  return args;
}

export function buildArgs(prompt: string, opts?: AgentRunOptions): string[] {
  return [
    ...baseArgs(prompt),
    '--disallowedTools',
    'WebFetch',
    'WebSearch',
    ...runOptionArgs(opts),
  ];
}

const PATH_TOOLS = new Set(['Read', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit']);

function clippedPrefix(target: string): string | undefined {
  return target.endsWith('…') ? target.slice(0, -1).trimEnd() : undefined;
}

export function permissionRule(ask: ChatPermissionAsk): string {
  const { tool, target } = ask;
  if (!target) return tool;
  if (tool === 'Bash') {
    const prefix = clippedPrefix(target);
    return prefix ? `Bash(${prefix}:*)` : `Bash(${target})`;
  }
  if (tool === 'WebFetch') {
    try {
      return `WebFetch(domain:${new URL(target).hostname})`;
    } catch {
      return tool;
    }
  }
  if (PATH_TOOLS.has(tool) && !clippedPrefix(target)) {
    return target.startsWith('/') ? `${tool}(/${target})` : `${tool}(${target})`;
  }
  return tool;
}

export function buildChatArgs(prompt: string, opts?: AgentRunOptions): string[] {
  const allowed = (opts?.allow ?? []).map(permissionRule);
  return [
    ...baseArgs(prompt),
    '--include-partial-messages',
    ...(allowed.length > 0 ? ['--allowedTools', ...allowed] : []),
    ...runOptionArgs(opts),
  ];
}

// Must never pick up the shared `--permission-mode auto` flag, since a read-only
// prompt only reads a prompt on stdin.
export function buildReadOnlyArgs(opts?: AgentRunOptions): string[] {
  const args = ['-p', '--output-format', 'json'];
  if (opts?.model) args.push('--model', opts.model);
  if (opts?.effort) args.push('--effort', opts.effort);
  return args;
}

/** Shape confirmed by a live stream-json smoke test (decisions.md), not --help docs.
 *  Unknown subtypes fall through to a generic status line since new ones can appear. */
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
    case 'rate_limit_event': {
      const rateLimit = extractRateLimit(json);
      return rateLimit ? { text: '', rateLimit } : null;
    }
    case 'assistant': {
      const message = json.message as
        | { content?: unknown[]; usage?: Record<string, unknown> }
        | undefined;
      const blocks = message?.content ?? [];
      const turnContextTokens = message?.usage ? extractContextTokens(message.usage) : undefined;
      const withContext = (line: ParsedAgentLine): ParsedAgentLine =>
        turnContextTokens === undefined ? line : { ...line, turnContextTokens };
      for (const block of blocks) {
        const b = block as {
          type?: string;
          name?: string;
          text?: string;
          input?: Record<string, unknown>;
        };
        if (b.type === 'tool_use') {
          const milestone = classifyAnchor(b.name ?? '', b.input) ?? undefined;
          return withContext({
            text: `Running ${b.name ?? 'a tool'}…`,
            ...(milestone && { milestone }),
          });
        }
        if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
          return withContext({ text: b.text.trim() });
        }
      }
      return turnContextTokens === undefined ? null : { text: '', turnContextTokens };
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
      // The CLI names why it stopped in `subtype` when `result` is empty; without this
      // fallback, `task.errorReason` stays undefined and the reason exists nowhere.
      const subtype = typeof json.subtype === 'string' ? json.subtype : undefined;
      const detail = result || (error ? subtype : undefined);
      const text = detail ?? (error ? 'Agent run failed' : 'Agent run finished');
      const sessionId = typeof json.session_id === 'string' ? json.session_id : undefined;
      return {
        text,
        done: true,
        error,
        ...(error && detail ? { reason: detail } : {}),
        sessionId,
        usage: extractUsage(json),
      };
    }
    default:
      return { text: 'Agent is working…' };
  }
}

const PAPER_CAMP_TOOL_PREFIX = 'mcp__paper-camp__';

function describeTool(name: string, input: Record<string, unknown> | undefined): string | null {
  if (name.startsWith(PAPER_CAMP_TOOL_PREFIX)) {
    return describePaperCampTool(name.slice(PAPER_CAMP_TOOL_PREFIX.length), input);
  }
  const target = stringField(
    input,
    'file_path',
    'notebook_path',
    'command',
    'pattern',
    'url',
    'query',
  );
  switch (name) {
    case 'TodoWrite':
      return null;
    case 'Read':
      return target ? `Reading ${target}` : 'Reading a file';
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return target ? `Editing ${target}` : 'Editing a file';
    case 'Write':
      return target ? `Writing ${target}` : 'Writing a file';
    case 'Bash':
      return target ? `Running ${target}` : 'Running a command';
    case 'Grep':
      return target ? `Searching for ${target}` : 'Searching the code';
    case 'Glob':
      return target ? `Finding ${target}` : 'Finding files';
    case 'WebFetch':
      return target ? `Fetching ${target}` : 'Fetching a page';
    case 'WebSearch':
      return target ? `Searching the web for ${target}` : 'Searching the web';
    default:
      return `Using ${name}`;
  }
}

function readPermissionDenials(value: unknown): ChatPermissionAsk[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const { tool_name, tool_input } = raw as Record<string, unknown>;
    if (typeof tool_name !== 'string') return [];
    const input = tool_input as Record<string, unknown> | undefined;
    const target = stringField(
      input,
      'command',
      'file_path',
      'notebook_path',
      'url',
      'path',
      'pattern',
      'query',
    );
    return [{ tool: tool_name, ...(target && { target }) }];
  });
}

export function parseChatLine(line: string): ParsedChatLine | null {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(line);
  } catch {
    return null;
  }

  switch (json.type) {
    case 'system':
      return json.subtype === 'init' && typeof json.session_id === 'string'
        ? { sessionId: json.session_id }
        : null;
    case 'stream_event': {
      const event = json.event as Record<string, unknown> | undefined;
      if (event?.type === 'message_start') return { messageStart: true };
      const delta = event?.delta as Record<string, unknown> | undefined;
      if (
        event?.type === 'content_block_delta' &&
        delta?.type === 'text_delta' &&
        typeof delta.text === 'string'
      ) {
        return { delta: delta.text };
      }
      return null;
    }
    case 'assistant': {
      const blocks = (json.message as { content?: unknown[] } | undefined)?.content ?? [];
      const tools = blocks.flatMap((block) => {
        const b = block as { type?: string; name?: string; input?: Record<string, unknown> };
        if (b.type !== 'tool_use' || typeof b.name !== 'string') return [];
        const label = describeTool(b.name, b.input);
        return label ? [clip(label)] : [];
      });
      return tools.length > 0 ? { tools } : null;
    }
    case 'result': {
      const error = Boolean(json.is_error);
      const result = typeof json.result === 'string' ? json.result.trim() : '';
      const subtype = typeof json.subtype === 'string' ? json.subtype : undefined;
      const permissions = readPermissionDenials(json.permission_denials);
      return {
        done: true,
        error,
        result,
        ...(error && { reason: result || subtype || 'Agent run failed' }),
        ...(typeof json.session_id === 'string' && { sessionId: json.session_id }),
        ...(permissions.length > 0 && { permissions }),
        usage: extractUsage(json),
      };
    }
    default:
      return null;
  }
}
