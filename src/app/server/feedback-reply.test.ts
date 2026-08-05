import { describe, expect, it } from 'vitest';
import type { PhaseItem, PlanEntry, ThreadMessage } from '../../types/index';
import { applyFeedbackEdit, replyToFeedback, summarizeFeedback } from './feedback-reply';

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
    await expect(
      replyToFeedback(plan({ id: 'IDEA-1' }), [], async () => 'not json'),
    ).rejects.toThrow('did not return a reply');
  });

  it('rejects when the JSON has no reply text', async () => {
    const runPrompt = async () => JSON.stringify({ edit: { body: 'x' } });
    await expect(replyToFeedback(plan({ id: 'IDEA-1' }), [], runPrompt)).rejects.toThrow(
      'did not return a reply',
    );
  });

  it('returns a plain reply with no edit or spinOff', async () => {
    const runPrompt = async () => JSON.stringify({ reply: 'Sure, noted.' });
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), [], runPrompt);
    expect(result).toEqual({ reply: 'Sure, noted.' });
  });

  it('carries a phase edit through', async () => {
    const runPrompt = async () =>
      JSON.stringify({
        reply: 'Added a phase for that.',
        edit: { phases: [{ op: 'add', text: 'Cover the export flow' }] },
      });
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), [], runPrompt);
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
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), [], runPrompt);
    expect(result).toEqual({ reply: 'Reworded.' });
  });

  it('ignores any spinOff the agent emits — this chat never creates ideas', async () => {
    const runPrompt = async () =>
      JSON.stringify({
        reply: 'Added that here.',
        edit: { body: 'reworked' },
        spinOff: { title: 'Follow-up idea', body: 'A separate piece of work.' },
      });
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), [], runPrompt);
    expect(result).toEqual({ reply: 'Added that here.', edit: { body: 'reworked' } });
  });

  it('accepts a reply wrapped in a markdown code fence', async () => {
    const runPrompt = async () => '```json\n{"reply": "Got it."}\n```';
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), [], runPrompt);
    expect(result).toEqual({ reply: 'Got it.' });
  });

  it('carries answersQuestion through when the agent flags it', async () => {
    const runPrompt = async () =>
      JSON.stringify({ reply: 'Right, scope is just the export flow.', answersQuestion: true });
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), [], runPrompt);
    expect(result).toEqual({
      reply: 'Right, scope is just the export flow.',
      answersQuestion: true,
    });
  });

  it('omits answersQuestion when the agent sends false', async () => {
    const runPrompt = async () =>
      JSON.stringify({ reply: 'Just noting that.', answersQuestion: false });
    const result = await replyToFeedback(plan({ id: 'IDEA-1' }), [], runPrompt);
    expect(result).toEqual({ reply: 'Just noting that.' });
  });
});

describe('summarizeFeedback', () => {
  const messages: ThreadMessage[] = [
    { kind: 'chat', text: 'What should we do about X?', from: 'user' },
    { kind: 'chat', text: "Let's go with Y.", from: 'agent' },
  ];

  it('rejects when the agent returns no parseable JSON', async () => {
    await expect(
      summarizeFeedback(plan({ id: 'IDEA-1' }), messages, async () => 'not json'),
    ).rejects.toThrow('did not return a summary');
  });

  it('rejects when the JSON has no summary text', async () => {
    const runPrompt = async () => JSON.stringify({ nothing: true });
    await expect(summarizeFeedback(plan({ id: 'IDEA-1' }), messages, runPrompt)).rejects.toThrow(
      'did not return a summary',
    );
  });

  it('returns the trimmed summary', async () => {
    const runPrompt = async () => JSON.stringify({ summary: '  Settled on approach Y.  ' });
    const result = await summarizeFeedback(plan({ id: 'IDEA-1' }), messages, runPrompt);
    expect(result).toBe('Settled on approach Y.');
  });

  it('accepts a summary wrapped in the claude -p JSON envelope', async () => {
    const runPrompt = async () =>
      JSON.stringify({ result: JSON.stringify({ summary: 'Settled on approach Y.' }) });
    const result = await summarizeFeedback(plan({ id: 'IDEA-1' }), messages, runPrompt);
    expect(result).toBe('Settled on approach Y.');
  });
});

describe('applyFeedbackEdit', () => {
  const phases: PhaseItem[] = [
    { done: true, text: 'First phase' },
    { done: false, text: 'Second phase', description: 'old detail' },
  ];

  it('appends an added phase when the plan is still in progress', () => {
    const result = applyFeedbackEdit(
      { phases, status: 'in-progress' },
      { phases: [{ op: 'add', text: 'Third phase' }] },
    );
    expect(result.phases).toEqual([...phases, { done: false, text: 'Third phase' }]);
    expect(result.fixes).toBeUndefined();
  });

  it('rewords an existing phase by its 1-based index, keeping its done state', () => {
    const result = applyFeedbackEdit(
      { phases, status: 'in-progress' },
      { phases: [{ op: 'reword', index: 2, text: 'Second phase, revised' }] },
    );
    expect(result.phases).toEqual([
      phases[0],
      { done: false, text: 'Second phase, revised', description: 'old detail' },
    ]);
  });

  it('ignores a reword whose index is out of range', () => {
    const result = applyFeedbackEdit(
      { phases, status: 'in-progress' },
      { phases: [{ op: 'reword', index: 9, text: 'Nowhere' }] },
    );
    expect(result.phases).toEqual(phases);
  });

  it('carries a body replacement through', () => {
    const result = applyFeedbackEdit(
      { phases, status: 'in-progress' },
      { body: 'Corrected body text.' },
    );
    expect(result).toEqual({ body: 'Corrected body text.' });
  });

  it('routes an added phase into fixes when the plan is already in review', () => {
    const donePhases: PhaseItem[] = [{ done: true, text: 'First phase' }];
    const result = applyFeedbackEdit(
      { phases: donePhases, status: 'review' },
      { phases: [{ op: 'add', text: 'A late fix' }] },
    );
    expect(result.phases).toEqual(donePhases);
    expect(result.fixes).toEqual([{ done: false, text: 'A late fix', description: undefined }]);
  });

  it('routes an added phase into fixes when the plan is already done, appending existing fixes', () => {
    const donePhases: PhaseItem[] = [{ done: true, text: 'First phase' }];
    const existingFixes: PhaseItem[] = [{ done: true, text: 'Earlier fix' }];
    const result = applyFeedbackEdit(
      { phases: donePhases, fixes: existingFixes, status: 'done' },
      { phases: [{ op: 'add', text: 'Another fix' }] },
    );
    expect(result.fixes).toEqual([
      ...existingFixes,
      { done: false, text: 'Another fix', description: undefined },
    ]);
  });
});
