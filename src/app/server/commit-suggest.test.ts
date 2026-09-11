import { describe, expect, it, vi } from 'vitest';
import { suggestCommitMessage } from './commit-suggest';

const convention = { types: ['feat', 'fix'], scopes: ['app', 'cli'], scopeRequired: true };
const reply = (title: string) => JSON.stringify({ title, message: '' });

describe('suggestCommitMessage', () => {
  it('returns a title that fits the convention on the first try', async () => {
    const run = vi.fn<(prompt: string) => Promise<string>>(async () =>
      reply('fix(app): Stage every file'),
    );
    const result = await suggestCommitMessage('diff', undefined, run, convention);
    expect(result.title).toBe('fix(app): Stage every file');
    expect(run).toHaveBeenCalledOnce();
  });

  it('sends a rejected title back once with the reason, then accepts the fixed one', async () => {
    const run = vi
      .fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce(reply('fix(git): Stage every file'))
      .mockResolvedValueOnce(reply('fix(app): Stage every file'));
    const result = await suggestCommitMessage('diff', undefined, run, convention);
    expect(result.title).toBe('fix(app): Stage every file');
    expect(run).toHaveBeenCalledTimes(2);
    expect(String(run.mock.calls[1][0])).toContain('scope "git" is not allowed');
  });

  it('surfaces the violation when the second try is rejected too', async () => {
    const run = vi.fn<(prompt: string) => Promise<string>>(async () =>
      reply('test(app): add cases'),
    );
    await expect(suggestCommitMessage('diff', undefined, run, convention)).rejects.toThrow(
      'type "test" is not allowed',
    );
  });

  it('puts the repo scopes into the prompt', async () => {
    const run = vi.fn<(prompt: string) => Promise<string>>(async () => reply('fix(cli): Trim'));
    await suggestCommitMessage('diff', undefined, run, convention);
    expect(String(run.mock.calls[0][0])).toContain('required and one of this fixed list: app, cli');
  });
});
