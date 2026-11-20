import { describe, expect, it } from 'vitest';
import type { AgentTaskState } from '@/types/index';
import {
  firstOpenPhase,
  ideaTasks,
  isLiveTask,
  taskEntityId,
  walkEndMessage,
  walkIndex,
  walkTaskFor,
} from './plan-walk';

const task = (extra: Partial<AgentTaskState>): AgentTaskState =>
  ({
    id: 't',
    status: 'running',
    taskKind: 'phase',
    planTitle: 'Plan',
    startedAt: '2026-11-20T10:00:00Z',
    agentId: 'claude-code',
    lines: [],
    ...extra,
  }) as AgentTaskState;

describe('taskEntityId and isLiveTask', () => {
  it('reads the plan id, falling back to the idea id', () => {
    expect(taskEntityId(task({ planId: 'IDEA-1', ideaId: 'IDEA-2' }))).toBe('IDEA-1');
    expect(taskEntityId(task({ ideaId: 'IDEA-2' }))).toBe('IDEA-2');
  });

  it('counts starting, running and stopping as live', () => {
    expect(isLiveTask(task({ status: 'starting' }))).toBe(true);
    expect(isLiveTask(task({ status: 'stopping' }))).toBe(true);
    expect(isLiveTask(task({ status: 'done' }))).toBe(false);
  });
});

describe('ideaTasks', () => {
  it('splits the idea tasks into the live one and the newest ended one', () => {
    const tasks = [
      task({ id: 'a', planId: 'IDEA-1', status: 'done', startedAt: '2026-11-19T10:00:00Z' }),
      task({ id: 'b', planId: 'IDEA-1', status: 'error', startedAt: '2026-11-20T09:00:00Z' }),
      task({ id: 'c', planId: 'IDEA-1', status: 'running' }),
      task({ id: 'd', planId: 'IDEA-2', status: 'running' }),
    ];
    const result = ideaTasks(tasks, 'IDEA-1');
    expect(result.running?.id).toBe('c');
    expect(result.ended?.id).toBe('b');
  });

  it('is empty for an idea with no tasks', () => {
    expect(ideaTasks([task({ planId: 'IDEA-2' })], 'IDEA-1')).toEqual({
      running: null,
      ended: null,
    });
  });
});

describe('walk', () => {
  const phases = [{ done: true }, { done: false }, { done: false }];

  it('finds the first open phase', () => {
    expect(firstOpenPhase(phases)).toBe(1);
    expect(firstOpenPhase([{ done: true }])).toBe(-1);
  });

  it('follows the run-all task for this idea only', () => {
    const walk = task({ taskKind: 'run-all', planId: 'IDEA-1', phaseIndex: 2 });
    expect(walkTaskFor(walk, 'IDEA-1')).toBe(walk);
    expect(walkTaskFor(walk, 'IDEA-9')).toBeNull();
    expect(walkTaskFor(task({ taskKind: 'phase', planId: 'IDEA-1' }), 'IDEA-1')).toBeNull();
  });

  it('indexes the walk by its phase, or the first open one while starting', () => {
    const walk = task({ taskKind: 'run-all', planId: 'IDEA-1', phaseIndex: 2 });
    expect(walkIndex(walk, false, phases)).toEqual({ index: 2 });
    expect(walkIndex(null, true, phases)).toEqual({ index: 1 });
    expect(walkIndex(null, false, phases)).toBeNull();
  });

  it('words how a walk ended only when it failed', () => {
    const ended = (extra: Partial<AgentTaskState>) =>
      walkEndMessage(task({ taskKind: 'run-all', status: 'error', ...extra }));
    expect(ended({ errorKind: 'question' })).toContain('parked a question');
    expect(ended({})).toContain('failed phase');
    expect(walkEndMessage(task({ taskKind: 'run-all', status: 'done' }))).toBeNull();
    expect(walkEndMessage(task({ taskKind: 'phase', status: 'error' }))).toBeNull();
  });
});
