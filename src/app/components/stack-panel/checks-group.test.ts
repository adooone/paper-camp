import type { DeskCheckState } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { fixPrompt } from './checks-group';

const check = (overrides: Partial<DeskCheckState> = {}): DeskCheckState => ({
  name: 'lint',
  cmd: 'pnpm lint',
  status: 'fail',
  lastRun: null,
  output: '',
  ...overrides,
});

describe('fixPrompt', () => {
  it('includes the check name, command, and captured output', () => {
    const prompt = fixPrompt(
      check({ name: 'lint', cmd: 'pnpm lint', output: 'error: unused var' }),
    );
    expect(prompt).toContain('Fix the failing "lint" check in this repo.');
    expect(prompt).toContain('The command was `pnpm lint`.');
    expect(prompt).toContain('error: unused var');
  });

  it('falls back to a placeholder when there is no captured output', () => {
    expect(fixPrompt(check({ output: '' }))).toContain('(no output captured)');
  });
});
