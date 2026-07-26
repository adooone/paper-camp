import type { MarginNote } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { resolveAppliedNotes } from '../helpers';

const note = (overrides: Partial<MarginNote>): MarginNote => ({
  anchor: { kind: 'body' },
  prose: 'note',
  state: 'open',
  ...overrides,
});

describe('resolveAppliedNotes', () => {
  it('resolves an open note matching an applied anchor and prose', () => {
    const notes = [note({ prose: 'tighten this up' })];
    const result = resolveAppliedNotes(notes, [note({ prose: 'tighten this up' })]);
    expect(result[0].state).toBe('resolved');
  });

  it('leaves notes untouched when their anchor does not match', () => {
    const notes = [note({ anchor: { kind: 'phase', index: 0 } })];
    const applied = [note({ anchor: { kind: 'phase', index: 1 } })];
    expect(resolveAppliedNotes(notes, applied)[0].state).toBe('open');
  });

  it('leaves notes untouched when their prose does not match', () => {
    const notes = [note({ prose: 'a' })];
    const applied = [note({ prose: 'b' })];
    expect(resolveAppliedNotes(notes, applied)[0].state).toBe('open');
  });

  it('leaves already-resolved notes alone even if they match', () => {
    const notes = [note({ prose: 'done already', state: 'resolved' })];
    const result = resolveAppliedNotes(notes, [note({ prose: 'done already' })]);
    expect(result[0].state).toBe('resolved');
  });

  it('handles an empty or undefined notes list', () => {
    expect(resolveAppliedNotes(undefined, [note({})])).toEqual([]);
    expect(resolveAppliedNotes([], [note({})])).toEqual([]);
  });
});
