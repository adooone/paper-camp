import type { PlanEntry, ThreadMessage } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { collectOpenQuestions } from '../helpers';

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'Untitled',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
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

describe('collectOpenQuestions', () => {
  it('ignores plans with no open questions', () => {
    const plans = [
      plan({ id: 'IDEA-1', thread: [] }),
      plan({ id: 'IDEA-2', thread: [question({ state: 'resolved' })] }),
      plan({ id: 'IDEA-3', thread: [{ kind: 'chat', date: '2026-01-01', text: 'hi' }] }),
    ];
    expect(collectOpenQuestions(plans)).toEqual([]);
  });

  it('treats a missing state as open', () => {
    const plans = [plan({ id: 'IDEA-1', thread: [question({ state: undefined })] })];
    expect(collectOpenQuestions(plans)).toHaveLength(1);
  });

  it('orders groups oldest-question-first, and questions within a group oldest-first', () => {
    const older = question({ date: '2026-01-01', text: 'older' });
    const newer = question({ date: '2026-02-01', text: 'newer' });
    const plans = [
      plan({ id: 'IDEA-2', title: 'Second', thread: [newer] }),
      plan({ id: 'IDEA-1', title: 'First', thread: [newer, older] }),
    ];
    const groups = collectOpenQuestions(plans);
    expect(groups.map((g) => g.plan.id)).toEqual(['IDEA-1', 'IDEA-2']);
    expect(groups[0].questions.map((q) => q.text)).toEqual(['older', 'newer']);
  });
});
