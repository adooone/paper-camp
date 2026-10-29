import { parseEntityFile } from '@/core/parse/parser';
import { formatEntityFile } from '@/core/serialize';
import { describe, expect, it } from 'vitest';
import type { PhaseItem, ThreadMessage } from '../../types';
import { mergePapercampEntity } from './papercamp-merge';

function entityFile(overrides: {
  status?: string;
  updated?: string;
  phases: PhaseItem[];
  thread?: ThreadMessage[];
  body?: string;
}): string {
  return formatEntityFile({
    id: 'IDEA-1',
    title: 'Example idea',
    type: 'fix',
    status: overrides.status as never,
    created: '2026-10-01',
    updated: overrides.updated,
    tags: [],
    needs: [],
    body: overrides.body ?? 'Some prose.',
    phases: overrides.phases,
    thread: overrides.thread,
  });
}

function parse(content: string) {
  const entry = parseEntityFile(content).entries[0];
  if (!entry) throw new Error('fixture failed to parse');
  return entry;
}

describe('mergePapercampEntity', () => {
  it('ORs phase checkboxes ticked on either side', () => {
    const base = entityFile({
      status: 'in-progress',
      updated: '2026-10-28',
      phases: [
        { done: false, text: 'Phase A' },
        { done: false, text: 'Phase B' },
      ],
    });
    const ours = entityFile({
      status: 'in-progress',
      updated: '2026-10-28',
      phases: [
        { done: true, text: 'Phase A' },
        { done: false, text: 'Phase B' },
      ],
    });
    const theirs = entityFile({
      status: 'in-progress',
      updated: '2026-10-28',
      phases: [
        { done: false, text: 'Phase A' },
        { done: true, text: 'Phase B' },
      ],
    });

    const merged = mergePapercampEntity(base, ours, theirs);
    expect(merged).not.toBeNull();
    const entry = parse(merged as string);
    expect(entry.phases.map((p) => p.done)).toEqual([true, true]);
  });

  it('keeps the most advanced status and the newest updated date', () => {
    const base = entityFile({
      status: 'planned',
      updated: '2026-10-20',
      phases: [{ done: false, text: 'Phase A' }],
    });
    const ours = entityFile({
      status: 'review',
      updated: '2026-10-29',
      phases: [{ done: true, text: 'Phase A' }],
    });
    const theirs = entityFile({
      status: 'in-progress',
      updated: '2026-10-25',
      phases: [{ done: false, text: 'Phase A' }],
    });

    const merged = mergePapercampEntity(base, ours, theirs);
    const entry = parse(merged as string);
    expect(entry.status).toBe('review');
    expect(entry.updated).toBe('2026-10-29');
  });

  it('unions thread entries appended on either side', () => {
    const base = entityFile({
      status: 'in-progress',
      updated: '2026-10-28',
      phases: [{ done: false, text: 'Phase A' }],
      thread: [{ kind: 'log', date: '2026-10-28', text: 'started' }],
    });
    const ours = entityFile({
      status: 'in-progress',
      updated: '2026-10-29',
      phases: [{ done: true, text: 'Phase A' }],
      thread: [
        { kind: 'log', date: '2026-10-28', text: 'started' },
        { kind: 'log', date: '2026-10-29', text: 'ours ran it' },
      ],
    });
    const theirs = entityFile({
      status: 'in-progress',
      updated: '2026-10-29',
      phases: [{ done: false, text: 'Phase A' }],
      thread: [
        { kind: 'log', date: '2026-10-28', text: 'started' },
        { kind: 'log', date: '2026-10-29', text: 'theirs ran it' },
      ],
    });

    const merged = mergePapercampEntity(base, ours, theirs);
    const entry = parse(merged as string);
    expect(entry.thread?.map((m) => m.text)).toEqual(['started', 'ours ran it', 'theirs ran it']);
  });

  it('combines run totals when both sides ran the same phase', () => {
    const base = entityFile({
      status: 'in-progress',
      updated: '2026-10-28',
      phases: [{ done: false, text: 'Phase A' }],
    });
    const ours = entityFile({
      status: 'in-progress',
      updated: '2026-10-29',
      phases: [
        {
          done: true,
          text: 'Phase A',
          run: { durationMs: 60_000, inputTokens: 100, outputTokens: 200, attempts: 1 },
        },
      ],
    });
    const theirs = entityFile({
      status: 'in-progress',
      updated: '2026-10-29',
      phases: [
        {
          done: true,
          text: 'Phase A',
          run: { durationMs: 30_000, inputTokens: 50, outputTokens: 80, attempts: 1 },
        },
      ],
    });

    const merged = mergePapercampEntity(base, ours, theirs);
    const entry = parse(merged as string);
    expect(entry.phases[0].run).toEqual({
      durationMs: 90_000,
      inputTokens: 150,
      outputTokens: 280,
      attempts: 2,
    });
  });

  it('returns null when the same prose changed differently on both sides', () => {
    const base = entityFile({
      status: 'in-progress',
      updated: '2026-10-28',
      phases: [{ done: false, text: 'Phase A' }],
      body: 'Original prose.',
    });
    const ours = entityFile({
      status: 'in-progress',
      updated: '2026-10-29',
      phases: [{ done: false, text: 'Phase A' }],
      body: 'Ours rewrote this.',
    });
    const theirs = entityFile({
      status: 'in-progress',
      updated: '2026-10-29',
      phases: [{ done: false, text: 'Phase A' }],
      body: 'Theirs rewrote this differently.',
    });

    expect(mergePapercampEntity(base, ours, theirs)).toBeNull();
  });

  it('returns null when phase counts differ', () => {
    const base = entityFile({
      status: 'in-progress',
      updated: '2026-10-28',
      phases: [{ done: false, text: 'Phase A' }],
    });
    const ours = entityFile({
      status: 'in-progress',
      updated: '2026-10-29',
      phases: [{ done: false, text: 'Phase A' }],
    });
    const theirs = entityFile({
      status: 'in-progress',
      updated: '2026-10-29',
      phases: [
        { done: false, text: 'Phase A' },
        { done: false, text: 'Phase B' },
      ],
    });

    expect(mergePapercampEntity(base, ours, theirs)).toBeNull();
  });
});
