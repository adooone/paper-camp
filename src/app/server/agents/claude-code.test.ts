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

  it('drops a rate_limit_event that carries no status', () => {
    expect(parseLine(JSON.stringify({ type: 'rate_limit_event' }))).toBeNull();
  });
});
