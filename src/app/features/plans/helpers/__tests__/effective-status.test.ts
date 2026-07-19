import type { AgentTaskState, PlanEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { effectiveStatus, runningTaskForPlan } from '../helpers';

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'Untitled',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
  body: '',
  phases: [],
  ...overrides,
});

const task = (overrides: Partial<AgentTaskState>): AgentTaskState => ({
  id: 't1',
  status: 'running',
  taskKind: 'phase',
  planTitle: 'Untitled',
  agentId: 'claude-code',
  lines: [],
  ...overrides,
});

describe('runningTaskForPlan', () => {
  it('finds a running task matching the plan id', () => {
    const tasks = [task({ planId: 'IDEA-1' })];
    expect(runningTaskForPlan('IDEA-1', tasks)).toBe(tasks[0]);
  });

  it('ignores done/error tasks and non-matching ids', () => {
    const tasks = [task({ planId: 'IDEA-1', status: 'done' }), task({ planId: 'IDEA-2' })];
    expect(runningTaskForPlan('IDEA-1', tasks)).toBeUndefined();
  });

  it('returns undefined without a plan id', () => {
    expect(runningTaskForPlan(undefined, [task({ planId: 'IDEA-1' })])).toBeUndefined();
  });
});

describe('effectiveStatus', () => {
  it('overlays in-progress when a task is running for the plan', () => {
    const p = plan({ id: 'IDEA-1', status: 'planned' });
    expect(effectiveStatus(p, [task({ planId: 'IDEA-1' })])).toBe('in-progress');
  });

  it('leaves status untouched with no running task', () => {
    const p = plan({ id: 'IDEA-1', status: 'review' });
    expect(effectiveStatus(p, [])).toBe('review');
  });

  it('never overlays a terminal done/dropped status', () => {
    const done = plan({ id: 'IDEA-1', status: 'done' });
    const dropped = plan({ id: 'IDEA-2', status: 'dropped' });
    const tasks = [task({ planId: 'IDEA-1' }), task({ planId: 'IDEA-2', id: 't2' })];
    expect(effectiveStatus(done, tasks)).toBe('done');
    expect(effectiveStatus(dropped, tasks)).toBe('dropped');
  });
});
