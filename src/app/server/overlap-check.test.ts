import { describe, expect, it } from 'vitest';
import { checkIdeaOverlap } from './overlap-check';

describe('checkIdeaOverlap', () => {
  it('rejects empty text without calling the agent', async () => {
    await expect(
      checkIdeaOverlap('   ', [], async () => {
        throw new Error('should not be called');
      }),
    ).rejects.toThrow('Nothing to check');
  });

  it('parses a verdict object returned directly', async () => {
    const verdict = await checkIdeaOverlap(
      'New idea text',
      [],
      async () => '{"verdict":"new","targetId":null,"reasoning":"no overlap"}',
    );
    expect(verdict).toEqual({ verdict: 'new', targetId: null, reasoning: 'no overlap' });
  });

  it('unwraps a verdict object nested inside a JSON result wrapper', async () => {
    const output = JSON.stringify({
      result: '{"verdict":"existing","targetId":"IDEA-1","reasoning":"same as IDEA-1"}',
    });
    const verdict = await checkIdeaOverlap('New idea text', [], async () => output);
    expect(verdict).toEqual({
      verdict: 'existing',
      targetId: 'IDEA-1',
      reasoning: 'same as IDEA-1',
    });
  });

  it('extracts the verdict object from surrounding prose', async () => {
    const output = 'Here is my answer:\n{"verdict":"extend","targetId":"IDEA-2"}\nThanks.';
    const verdict = await checkIdeaOverlap('New idea text', [], async () => output);
    expect(verdict).toEqual({ verdict: 'extend', targetId: 'IDEA-2', reasoning: '' });
  });

  it('throws when no object can be extracted from the output', async () => {
    await expect(checkIdeaOverlap('New idea text', [], async () => 'no json here')).rejects.toThrow(
      'Agent did not return a parseable overlap verdict',
    );
  });

  it('throws when the verdict field is missing', async () => {
    await expect(
      checkIdeaOverlap('New idea text', [], async () => '{"targetId":null}'),
    ).rejects.toThrow('Agent returned an unrecognized verdict');
  });

  it('throws when the verdict field is not a recognized value', async () => {
    await expect(
      checkIdeaOverlap('New idea text', [], async () => '{"verdict":"maybe"}'),
    ).rejects.toThrow('Agent returned an unrecognized verdict');
  });
});
