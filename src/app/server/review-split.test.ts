import { describe, expect, it } from 'vitest';
import type { LogEntry, PlanEntry } from '../../types/index';
import { splitReview } from './review-split';

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'A plan',
  status: 'review',
  created: '2026-07-01',
  tags: [],
  body: '',
  phases: [],
  ...overrides,
});

const points: LogEntry[] = [
  { date: '2026-07-27', text: 'The retry loop never backs off' },
  { date: '2026-07-27', text: 'We should also cover the export flow' },
];

describe('splitReview', () => {
  it('rejects with nothing to split when the plan has no review points', async () => {
    await expect(splitReview(plan({ id: 'IDEA-1' }), [], async () => '')).rejects.toThrow(
      'no review points',
    );
  });

  it('rejects a split that omits a point', async () => {
    const runPrompt = async () =>
      JSON.stringify({ items: [{ n: 1, kind: 'idea', title: 'x', body: 'y' }] });

    await expect(splitReview(plan({ id: 'IDEA-1' }), points, runPrompt)).rejects.toThrow(
      'every review point exactly once',
    );
  });

  it('rejects a split with a duplicate point number', async () => {
    const runPrompt = async () =>
      JSON.stringify({
        items: [
          { n: 1, kind: 'idea', title: 'x', body: 'y' },
          { n: 1, kind: 'idea', title: 'x2', body: 'y2' },
        ],
      });

    await expect(splitReview(plan({ id: 'IDEA-1' }), points, runPrompt)).rejects.toThrow(
      'every review point exactly once',
    );
  });

  it('rejects a rework item with no phases', async () => {
    const runPrompt = async () =>
      JSON.stringify({
        items: [
          { n: 1, kind: 'rework', phases: [] },
          { n: 2, kind: 'idea', title: 'x', body: 'y' },
        ],
      });

    await expect(splitReview(plan({ id: 'IDEA-1' }), points, runPrompt)).rejects.toThrow(
      'malformed',
    );
  });

  it('rejects an idea item missing a body', async () => {
    const runPrompt = async () =>
      JSON.stringify({
        items: [
          { n: 1, kind: 'rework', phases: [{ text: 'Fix the backoff' }] },
          { n: 2, kind: 'idea', title: 'Export flow' },
        ],
      });

    await expect(splitReview(plan({ id: 'IDEA-1' }), points, runPrompt)).rejects.toThrow(
      'malformed',
    );
  });

  it('maps each point to its proposed rework or follow-up idea, in point order', async () => {
    const runPrompt = async () =>
      JSON.stringify({
        items: [
          { n: 2, kind: 'idea', title: 'Cover exports', body: 'Add export coverage separately.' },
          {
            n: 1,
            kind: 'rework',
            phases: [{ text: 'Add exponential backoff', description: 'src/retry.ts' }],
          },
        ],
      });

    const result = await splitReview(plan({ id: 'IDEA-1' }), points, runPrompt);

    expect(result).toEqual({
      items: [
        {
          point: 'The retry loop never backs off',
          kind: 'rework',
          phases: [{ text: 'Add exponential backoff', description: 'src/retry.ts' }],
        },
        {
          point: 'We should also cover the export flow',
          kind: 'idea',
          followUp: { title: 'Cover exports', body: 'Add export coverage separately.' },
        },
      ],
    });
  });

  it('accepts a verdict wrapped in a markdown code fence', async () => {
    const verdict = {
      items: [
        { n: 1, kind: 'rework', phases: [{ text: 'Add exponential backoff' }] },
        { n: 2, kind: 'idea', title: 'Cover exports', body: 'Add export coverage separately.' },
      ],
    };
    const runPrompt = async () => `\`\`\`json\n${JSON.stringify(verdict)}\n\`\`\``;

    const result = await splitReview(plan({ id: 'IDEA-1' }), points, runPrompt);
    expect(result.items).toHaveLength(2);
  });
});
