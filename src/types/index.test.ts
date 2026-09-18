import { describe, expect, it } from 'vitest';
import { agentConfigsEqual, coerceAgentConfig } from './index';

describe('coerceAgentConfig', () => {
  it('falls back to claude-code for a string with an unknown agent id', () => {
    expect(coerceAgentConfig('not-a-real-agent')).toEqual({ agent: 'claude-code' });
  });

  it('accepts a valid agent id passed as a string', () => {
    expect(coerceAgentConfig('opencode')).toEqual({ agent: 'opencode' });
  });

  it('falls back to claude-code when agent is missing or invalid', () => {
    expect(coerceAgentConfig({})).toEqual({ agent: 'claude-code' });
    expect(coerceAgentConfig({ agent: 'bogus' })).toEqual({ agent: 'claude-code' });
    expect(coerceAgentConfig(null)).toEqual({ agent: 'claude-code' });
    expect(coerceAgentConfig(undefined)).toEqual({ agent: 'claude-code' });
  });

  it('drops non-string model and effort instead of throwing', () => {
    expect(coerceAgentConfig({ agent: 'claude-code', model: 42, effort: {} })).toEqual({
      agent: 'claude-code',
    });
  });

  it('keeps valid string model and effort', () => {
    expect(coerceAgentConfig({ agent: 'claude-code', model: 'sonnet', effort: 'high' })).toEqual({
      agent: 'claude-code',
      model: 'sonnet',
      effort: 'high',
    });
  });
});

describe('agentConfigsEqual', () => {
  it('treats an undefined model as equal to an empty-string model', () => {
    expect(agentConfigsEqual({ agent: 'claude-code' }, { agent: 'claude-code', model: '' })).toBe(
      true,
    );
  });

  it('is true for identical agent and model', () => {
    expect(
      agentConfigsEqual(
        { agent: 'claude-code', model: 'sonnet' },
        { agent: 'claude-code', model: 'sonnet' },
      ),
    ).toBe(true);
  });

  it('is false when the agent differs', () => {
    expect(
      agentConfigsEqual(
        { agent: 'claude-code', model: 'sonnet' },
        { agent: 'opencode', model: 'sonnet' },
      ),
    ).toBe(false);
  });

  it('is false when the model differs', () => {
    expect(
      agentConfigsEqual(
        { agent: 'claude-code', model: 'sonnet' },
        { agent: 'claude-code', model: 'opus' },
      ),
    ).toBe(false);
  });

  it('ignores effort differences', () => {
    expect(
      agentConfigsEqual(
        { agent: 'claude-code', model: 'sonnet', effort: 'low' },
        { agent: 'claude-code', model: 'sonnet', effort: 'high' },
      ),
    ).toBe(true);
  });
});
