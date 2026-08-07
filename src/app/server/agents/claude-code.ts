import { classifyAnchor } from '@/core/phase-progress';
import type { AgentRunOptions, PhaseMilestone, RateLimitSnapshot, RunUsage } from '@/types/index';

export interface ParsedAgentLine {
  text: string;
  done?: boolean;
  error?: boolean;
  reason?: string;
  sessionId?: string;
  milestone?: PhaseMilestone;
  usage?: RunUsage;
  rateLimit?: RateLimitSnapshot;
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

function extractUsage(json: Record<string, unknown>): RunUsage {
  const modelUsage = json.modelUsage as Record<string, Record<string, unknown>> | undefined;
  const usage = (json.usage ?? {}) as Record<string, unknown>;
  let inputTokens = readNum(usage.input_tokens);
  let outputTokens = readNum(usage.output_tokens);
  let cacheCreationTokens = readNum(usage.cache_creation_input_tokens);
  let cacheReadTokens = readNum(usage.cache_read_input_tokens);
  if (modelUsage) {
    inputTokens = outputTokens = cacheCreationTokens = cacheReadTokens = 0;
    for (const u of Object.values(modelUsage)) {
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

function extractRateLimit(json: Record<string, unknown>): RateLimitSnapshot | null {
  const rl = (json.rate_limit ?? json.rateLimit ?? json) as Record<string, unknown>;
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
  const overage = Boolean(rl.overage ?? rl.usingOverage ?? rl.overageActive);
  return { status, rateLimitType, resetsAt, overage };
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
    // Headless jobs must be terminal-only: --strict-mcp-config drops ambient MCP
    // servers (browser/computer-use) and --disallowedTools blocks web tools, so a phase can't "visually check" the app.
    '--strict-mcp-config',
    '--disallowedTools',
    'WebFetch',
    'WebSearch',
  ];
  if (opts?.model) args.push('--model', opts.model);
  if (opts?.effort) args.push('--effort', opts.effort);
  if (opts?.resume) args.push('--resume', opts.resume);
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
      const message = json.message as { content?: unknown[] } | undefined;
      const blocks = message?.content ?? [];
      for (const block of blocks) {
        const b = block as {
          type?: string;
          name?: string;
          text?: string;
          input?: Record<string, unknown>;
        };
        if (b.type === 'tool_use') {
          const milestone = classifyAnchor(b.name ?? '', b.input) ?? undefined;
          return { text: `Running ${b.name ?? 'a tool'}…`, ...(milestone && { milestone }) };
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
      const sessionId = typeof json.session_id === 'string' ? json.session_id : undefined;
      return { text, done: true, error, sessionId, usage: extractUsage(json) };
    }
    default:
      return { text: 'Agent is working…' };
  }
}
