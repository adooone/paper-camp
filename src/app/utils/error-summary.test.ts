import { describe, expect, it } from 'vitest';
import { oneLineErrorSummary } from './error-summary';

describe('oneLineErrorSummary', () => {
  it('picks the marked line out of multi-line git output', () => {
    expect(oneLineErrorSummary('To github…\n ! [rejected]\nhint: fetch first')).toBe(
      '! [rejected]',
    );
  });

  it('picks an error: line from CLI stderr', () => {
    expect(oneLineErrorSummary('Starting agent…\nerror: command not found\n')).toBe(
      'error: command not found',
    );
  });

  it('falls back to the last non-empty line when nothing is marked', () => {
    expect(oneLineErrorSummary('some context\nthe actual problem')).toBe('the actual problem');
  });

  it('returns the message unchanged for a single-line error', () => {
    expect(oneLineErrorSummary('agent CLI not found')).toBe('agent CLI not found');
  });

  it('turns commitlint output into the list of rejected rules', () => {
    const output = [
      '⧗   --- input ---',
      'stage all fix',
      '✖   subject may not be empty [subject-empty]',
      '✖   type may not be empty [type-empty]',
      '',
      '✖   found 2 problems, 0 warnings',
      'ⓘ   Get help: https://github.com/conventional-changelog/commitlint/#what-is-commitlint',
    ].join('\n');
    expect(oneLineErrorSummary(output)).toBe(
      'Commit message rejected by commitlint: subject may not be empty; type may not be empty',
    );
  });
});
