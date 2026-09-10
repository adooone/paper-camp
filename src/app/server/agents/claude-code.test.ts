import { describe, expect, it } from 'vitest';
import { buildArgs, parseLine } from './claude-code';

describe('claude-code buildArgs', () => {
  it('omits --resume when no session id is given', () => {
    expect(buildArgs('do the thing')).not.toContain('--resume');
  });

  it('passes --resume <session-id> when one is given', () => {
    const args = buildArgs('do the thing', { resume: 'sess-123' });
    const idx = args.indexOf('--resume');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(args[idx + 1]).toBe('sess-123');
  });
});

describe('claude-code parseLine', () => {
  it('captures session_id from a result event', () => {
    const line = JSON.stringify({
      type: 'result',
      is_error: false,
      result: 'Done',
      session_id: 'sess-abc',
    });
    expect(parseLine(line)).toMatchObject({
      text: 'Done',
      done: true,
      error: false,
      sessionId: 'sess-abc',
    });
  });

  it('leaves sessionId undefined when the result event has none', () => {
    const line = JSON.stringify({ type: 'result', is_error: false, result: 'Done' });
    expect(parseLine(line)?.sessionId).toBeUndefined();
  });

  it('reports the subtype as the reason when the CLI fails without a message', () => {
    const line = JSON.stringify({
      type: 'result',
      is_error: true,
      result: '',
      subtype: 'error_max_turns',
    });
    const parsed = parseLine(line);
    expect(parsed?.error).toBe(true);
    expect(parsed?.reason).toBe('error_max_turns');
    expect(parsed?.text).toBe('error_max_turns');
  });

  it('prefers the CLI message over the subtype when both are present', () => {
    const line = JSON.stringify({
      type: 'result',
      is_error: true,
      result: 'ran out of context',
      subtype: 'error_during_execution',
    });
    expect(parseLine(line)?.reason).toBe('ran out of context');
  });

  it('carries no reason on a successful result', () => {
    const line = JSON.stringify({
      type: 'result',
      is_error: false,
      result: 'Done',
      subtype: 'success',
    });
    const parsed = parseLine(line);
    expect(parsed?.reason).toBeUndefined();
    expect(parsed?.text).toBe('Done');
  });

  it('still falls back when the CLI gives neither message nor subtype', () => {
    const parsed = parseLine(JSON.stringify({ type: 'result', is_error: true, result: '' }));
    expect(parsed?.text).toBe('Agent run failed');
    expect(parsed?.reason).toBeUndefined();
  });

  it('captures usage, duration, and model from a result event', () => {
    const line = JSON.stringify({
      type: 'result',
      is_error: false,
      result: 'Done',
      duration_ms: 400000,
      num_turns: 12,
      total_cost_usd: 1.23,
      modelUsage: {
        'claude-fable-5': {
          inputTokens: 1_200_000,
          outputTokens: 38_000,
          cacheCreationInputTokens: 5000,
          cacheReadInputTokens: 900_000,
        },
      },
    });
    expect(parseLine(line)?.usage).toEqual({
      durationMs: 400000,
      numTurns: 12,
      model: 'claude-fable-5',
      inputTokens: 1_200_000,
      outputTokens: 38_000,
      cacheCreationTokens: 5000,
      cacheReadTokens: 900_000,
      costUsd: 1.23,
    });
  });

  it('skips null modelUsage entries without throwing', () => {
    const line = JSON.stringify({
      type: 'result',
      is_error: false,
      result: 'Done',
      modelUsage: {
        'claude-fable-5': { inputTokens: 100, outputTokens: 20 },
        broken: null,
      },
    });
    const usage = parseLine(line)?.usage;
    expect(usage?.inputTokens).toBe(100);
    expect(usage?.outputTokens).toBe(20);
  });

  it('falls back to the top-level usage bucket when modelUsage is absent', () => {
    const line = JSON.stringify({
      type: 'result',
      is_error: false,
      result: 'Done',
      usage: { input_tokens: 100, output_tokens: 200 },
    });
    const usage = parseLine(line)?.usage;
    expect(usage?.inputTokens).toBe(100);
    expect(usage?.outputTokens).toBe(200);
    expect(usage?.model).toBeUndefined();
  });

  it('captures the latest rate_limit_event snapshot without a visible line', () => {
    const line = JSON.stringify({
      type: 'rate_limit_event',
      rate_limit: {
        status: 'allowed_warning',
        rateLimitType: 'five_hour',
        resetsAt: 1_700_000_000,
        overage: false,
      },
    });
    expect(parseLine(line)).toEqual({
      text: '',
      rateLimit: {
        status: 'allowed_warning',
        rateLimitType: 'five_hour',
        resetsAt: 1_700_000_000,
        overage: false,
      },
    });
  });

  // The shape the CLI actually emits, captured from a live `claude -p` run: the payload
  // sits under `rate_limit_info` and carries a real utilization per plan window.
  it('reads the live rate_limit_info payload including both plan windows', () => {
    const line = JSON.stringify({
      type: 'rate_limit_event',
      rate_limit_info: {
        status: 'allowed',
        rateLimitType: 'five_hour',
        resetsAt: 1_788_436_800,
        overageStatus: 'rejected',
        isUsingOverage: false,
        unifiedWindows: {
          five_hour: { utilization: 0.11, resetsAt: 1_788_436_800 },
          seven_day: { utilization: 0.06, resetsAt: 1_788_768_000 },
        },
      },
    });
    expect(parseLine(line)?.rateLimit).toEqual({
      status: 'allowed',
      rateLimitType: 'five_hour',
      resetsAt: 1_788_436_800,
      overage: false,
      unifiedWindows: {
        five_hour: { utilization: 0.11, resetsAt: 1_788_436_800 },
        seven_day: { utilization: 0.06, resetsAt: 1_788_768_000 },
      },
    });
  });

  it('takes isUsingOverage as the overage flag', () => {
    const line = JSON.stringify({
      type: 'rate_limit_event',
      rate_limit_info: { status: 'allowed', isUsingOverage: true },
    });
    expect(parseLine(line)?.rateLimit?.overage).toBe(true);
  });

  it('omits unifiedWindows when a window carries no numeric utilization', () => {
    const line = JSON.stringify({
      type: 'rate_limit_event',
      rate_limit_info: { status: 'allowed', unifiedWindows: { five_hour: {} } },
    });
    expect(parseLine(line)?.rateLimit?.unifiedWindows).toBeUndefined();
  });

  it('drops a rate_limit_event that carries no status', () => {
    expect(parseLine(JSON.stringify({ type: 'rate_limit_event' }))).toBeNull();
  });

  it('sums the turn context from an assistant text message usage', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'Looking at the file.' }],
        usage: {
          input_tokens: 100_000,
          cache_creation_input_tokens: 5000,
          cache_read_input_tokens: 20_000,
        },
      },
    });
    expect(parseLine(line)).toMatchObject({
      text: 'Looking at the file.',
      turnContextTokens: 125_000,
    });
  });

  it('carries the turn context alongside a tool_use block', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', name: 'Read', input: {} }],
        usage: { input_tokens: 50_000 },
      },
    });
    expect(parseLine(line)).toMatchObject({
      text: 'Running Read…',
      turnContextTokens: 50_000,
    });
  });

  it('reports the turn context even when the message has no displayable block', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [], usage: { input_tokens: 50_000 } },
    });
    expect(parseLine(line)).toEqual({ text: '', turnContextTokens: 50_000 });
  });

  it('omits turnContextTokens when the assistant message carries no usage', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Hello' }] },
    });
    expect(parseLine(line)?.turnContextTokens).toBeUndefined();
  });

  it('drops an assistant message with no usage and no displayable block', () => {
    const line = JSON.stringify({ type: 'assistant', message: { content: [] } });
    expect(parseLine(line)).toBeNull();
  });
});
