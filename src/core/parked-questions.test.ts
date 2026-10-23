import { describe, expect, it } from 'vitest';
import type { EntityEntry, ThreadMessage } from '../types/index';
import { collectParkedQuestions, resolveClosedIdeaQuestions } from './parked-questions';

const entity = (overrides: Partial<EntityEntry>): EntityEntry => ({
  id: 'IDEA-1',
  title: 'Untitled',
  created: '2026-01-01',
  tags: [],
  needs: [],
  body: '',
  phases: [],
  ...overrides,
});

const question = (overrides: Partial<ThreadMessage>): ThreadMessage => ({
  kind: 'question',
  date: '2026-01-01',
  text: 'Need a decision',
  from: 'agent',
  state: 'open',
  ...overrides,
});

const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

describe('collectParkedQuestions', () => {
  it('collects only open questions, ignoring resolved questions and other message kinds', () => {
    const entities = [
      entity({ id: 'IDEA-1', title: 'First', thread: [question({ text: 'q1' })] }),
      entity({
        id: 'IDEA-2',
        title: 'Second',
        thread: [question({ text: 'resolved', state: 'resolved' })],
      }),
      entity({
        id: 'IDEA-3',
        title: 'Third',
        thread: [{ kind: 'log', date: '2026-01-01', text: 'did stuff' }],
      }),
      entity({ id: 'IDEA-4', title: 'Fourth', thread: [] }),
      entity({ id: 'IDEA-5', title: 'Fifth' }),
    ];
    const result = collectParkedQuestions(entities);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ entityId: 'IDEA-1', entityTitle: 'First', text: 'q1' });
  });

  it('treats a missing state as open', () => {
    const entities = [entity({ thread: [question({ state: undefined })] })];
    expect(collectParkedQuestions(entities)).toHaveLength(1);
  });

  it('collects every open question across multiple entities, including more than one per entity', () => {
    const entities = [
      entity({ id: 'IDEA-1', thread: [question({ text: 'q1' }), question({ text: 'q2' })] }),
      entity({ id: 'IDEA-2', thread: [question({ text: 'q3' })] }),
    ];
    const result = collectParkedQuestions(entities);
    expect(result.map((q) => q.text).sort()).toEqual(['q1', 'q2', 'q3']);
  });

  it('carries the date and age through unchanged', () => {
    const entities = [entity({ thread: [question({ date: daysAgo(3) })] })];
    expect(collectParkedQuestions(entities)[0]).toMatchObject({ date: daysAgo(3), ageDays: 3 });
  });

  it('orders questions oldest-first by age', () => {
    const older = question({ date: daysAgo(10), text: 'older' });
    const newer = question({ date: daysAgo(1), text: 'newer' });
    const entities = [
      entity({ id: 'IDEA-1', thread: [newer] }),
      entity({ id: 'IDEA-2', thread: [older] }),
    ];
    const result = collectParkedQuestions(entities);
    expect(result.map((q) => q.text)).toEqual(['older', 'newer']);
  });

  it('sorts an undated question ahead of every dated question, however old', () => {
    const undated = question({ date: undefined, text: 'undated' });
    const ancient = question({ date: daysAgo(9999), text: 'ancient but dated' });
    const entities = [
      entity({ id: 'IDEA-1', thread: [ancient] }),
      entity({ id: 'IDEA-2', thread: [undated] }),
    ];
    const result = collectParkedQuestions(entities);
    expect(result.map((q) => q.text)).toEqual(['undated', 'ancient but dated']);
    expect(result[0].ageDays).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('closed ideas', () => {
  it('collects no parked question from a done, dropped or archived entity', () => {
    const entities = [
      entity({ id: 'IDEA-1', status: 'done', thread: [question({})] }),
      entity({ id: 'IDEA-2', status: 'dropped', thread: [question({})] }),
      entity({ id: 'IDEA-3', status: 'review', archived: true, thread: [question({})] }),
      entity({ id: 'IDEA-4', status: 'in-progress', thread: [question({})] }),
    ];
    expect(collectParkedQuestions(entities).map((q) => q.entityId)).toEqual(['IDEA-4']);
  });

  it('resolves a chat question whose [[idea]] has closed and leaves the rest open', () => {
    const entities = [entity({ id: 'IDEA-1', status: 'done' }), entity({ id: 'IDEA-4' })];
    const thread = [
      question({ text: 'Run-all parked', entityId: 'IDEA-1' }),
      question({ text: 'Run-all parked', entityId: 'IDEA-4' }),
      question({ text: 'No idea named' }),
    ];
    expect(resolveClosedIdeaQuestions(thread, entities).map((m) => m.state)).toEqual([
      'resolved',
      'open',
      'open',
    ]);
  });
});
