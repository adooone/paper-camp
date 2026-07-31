import { describe, expect, it } from 'vitest';
import type { PhaseItem, PlanEntry } from '../../types/index';
import { applyFeedbackEdit, replyToFeedback } from './feedback-reply';

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'A plan',
  status: 'idea',
  created: '2026-07-01',
  tags: [],
  body: '',
  phases: [],
  ...overrides,
});

describe('replyToFeedback', () => {
  it('rejects when the agent returns no parseable JSON', async () => {
    await expect(replyToFeedback(plan({ id: 'IDEA-1' }), async () => 'not json')).rejects.toThrow(
      'did not return a reply',
    );
  });

  it('rejects when the JSON has no reply text', async () => {
    const runPrompt = async () => JSON.stringify({ edit: { body: 'x' } });
    await expect(replyToFeedback(plan({ id: 'IDEA-1' }), runPrompt)).rejects.toThrow(
      'did not return a reply',
    );
  });

  it('returns a plain reply with no edit or spinOff', async () => {
    const runPrompt = async () => JSON.stringify({ reply: 'Sure, noted.' });
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), runPrompt);
    expect(result).toEqual({ reply: 'Sure, noted.' });
  });

  it('carries a phase edit through', async () => {
    const runPrompt = async () =>
      JSON.stringify({
        reply: 'Added a phase for that.',
        edit: { phases: [{ op: 'add', text: 'Cover the export flow' }] },
      });
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), runPrompt);
    expect(result).toEqual({
      reply: 'Added a phase for that.',
      edit: { phases: [{ op: 'add', text: 'Cover the export flow' }] },
    });
  });

  it('drops a reword edit missing its index', async () => {
    const runPrompt = async () =>
      JSON.stringify({
        reply: 'Reworded.',
        edit: { phases: [{ op: 'reword', text: 'New title' }] },
      });
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), runPrompt);
    expect(result).toEqual({ reply: 'Reworded.' });
  });

  it('never combines edit and spinOff — edit wins if the agent sends both', async () => {
    const runPrompt = async () =>
      JSON.stringify({
        reply: 'That is out of scope here.',
        edit: { body: 'irrelevant' },
        spinOff: { title: 'Follow-up idea', body: 'A separate piece of work.' },
      });
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), runPrompt);
    expect(result.edit).toEqual({ body: 'irrelevant' });
    expect(result.spinOff).toBeUndefined();
  });

  it('carries a spinOff through when sent alone', async () => {
    const runPrompt = async () =>
      JSON.stringify({
        reply: 'That is out of scope here.',
        spinOff: { title: 'Follow-up idea', body: 'A separate piece of work.' },
      });
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), runPrompt);
    expect(result.spinOff).toEqual({ title: 'Follow-up idea', body: 'A separate piece of work.' });
    expect(result.edit).toBeUndefined();
  });

  it('accepts a reply wrapped in a markdown code fence', async () => {
    const runPrompt = async () => '```json\n{"reply": "Got it."}\n```';
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), runPrompt);
    expect(result).toEqual({ reply: 'Got it.' });
  });
});

describe('applyFeedbackEdit', () => {
  const phases: PhaseItem[] = [
    { done: true, text: 'First phase' },
    { done: false, text: 'Second phase', description: 'old detail' },
  ];

  it('appends an added phase', () => {
    const result = applyFeedbackEdit(phases, { phases: [{ op: 'add', text: 'Third phase' }] });
    expect(result.phases).toEqual([...phases, { done: false, text: 'Third phase' }]);
  });

  it('rewords an existing phase by its 1-based index, keeping its done state', () => {
    const result = applyFeedbackEdit(phases, {
      phases: [{ op: 'reword', index: 2, text: 'Second phase, revised' }],
    });
    expect(result.phases).toEqual([
      phases[0],
      { done: false, text: 'Second phase, revised', description: 'old detail' },
    ]);
  });

  it('ignores a reword whose index is out of range', () => {
    const result = applyFeedbackEdit(phases, {
      phases: [{ op: 'reword', index: 9, text: 'Nowhere' }],
    });
    expect(result.phases).toEqual(phases);
  });

  it('carries a body replacement through', () => {
    const result = applyFeedbackEdit(phases, { body: 'Corrected body text.' });
    expect(result).toEqual({ body: 'Corrected body text.' });
  });
});
