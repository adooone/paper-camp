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
    expect(parseLine(line)).toEqual({
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
});
