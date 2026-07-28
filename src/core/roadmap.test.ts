import type { PlanEntry, TaskLogEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  addRoadmapCandidate,
  addRoadmapItem,
  deriveRoadmapEvents,
  deriveSubjectVocabulary,
  linkRoadmapItem,
  parseRoadmap,
  removeRoadmapItem,
  resolveRoadmap,
} from './roadmap';

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'Untitled',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
  body: '',
  phases: [],
  ...overrides,
});

const SAMPLE = `# Roadmap

Some intro prose that isn't inside a load-bearing heading.

## The goal

**A paper desk where one person directs a fleet of agents.**

More prose about the goal spanning
two lines.

## How this file works

This section should be ignored entirely.

## Horizon 1 — Ready for daily use

Some horizon prose.

- **First-run experience** — \`init\` produces a welcoming empty corpus: seeded
  example idea, empty states that teach.
- **Packaging** — one command in any repo.
- **Mobile control desk** — direct the flow from a phone.
  - Responsive polish for phone widths
  - PWA manifest + install to home screen
  - Push notifications for task/check events

## Horizon 2 — A deeper desk

- **Goal & roadmap in the app** — this file rendered as a first-class surface.

## Standing concerns

Not horizons: these never ship and never graduate.

- **Infrastructure** — the machinery around the work.
- **Code health** — refactors and slimming passes.
`;

describe('parseRoadmap', () => {
  it('extracts the goal, tolerant of prose before and after it', () => {
    const { goal } = parseRoadmap(SAMPLE);
    expect(goal).toBe(
      '**A paper desk where one person directs a fleet of agents.**\n\nMore prose about the goal spanning\ntwo lines.',
    );
  });

  it('extracts horizons in order, skipping non-horizon h2 sections', () => {
    const { horizons } = parseRoadmap(SAMPLE);
    expect(horizons.map((h) => h.title)).toEqual([
      'Horizon 1 — Ready for daily use',
      'Horizon 2 — A deeper desk',
    ]);
  });

  it('joins a wrapped item description onto one line', () => {
    const { horizons } = parseRoadmap(SAMPLE);
    expect(horizons[0].items[0]).toEqual({
      name: 'First-run experience',
      description:
        '`init` produces a welcoming empty corpus: seeded example idea, empty states that teach.',
      candidates: [],
      linked: [],
    });
    expect(horizons[0].items[1]).toEqual({
      name: 'Packaging',
      description: 'one command in any repo.',
      candidates: [],
      linked: [],
    });
  });

  it('collects indented `- ` bullets under an item as candidates', () => {
    const { horizons } = parseRoadmap(SAMPLE);
    expect(horizons[0].items[2]).toEqual({
      name: 'Mobile control desk',
      description: 'direct the flow from a phone.',
      candidates: [
        'Responsive polish for phone widths',
        'PWA manifest + install to home screen',
        'Push notifications for task/check events',
      ],
      linked: [],
    });
  });

  it('collects indented `→ ` bullets under an item as linked, distinct from candidates', () => {
    const withLink = SAMPLE.replace(
      '  - Push notifications for task/check events\n',
      '  - Push notifications for task/check events\n  - → IDEA-42\n',
    );
    const { horizons } = parseRoadmap(withLink);
    expect(horizons[0].items[2]).toEqual({
      name: 'Mobile control desk',
      description: 'direct the flow from a phone.',
      candidates: [
        'Responsive polish for phone widths',
        'PWA manifest + install to home screen',
        'Push notifications for task/check events',
      ],
      linked: ['IDEA-42'],
    });
  });

  it('still treats indented prose without a bullet marker as description continuation', () => {
    const withContinuation = SAMPLE.replace(
      '- **Mobile control desk** — direct the flow from a phone.\n',
      '- **Mobile control desk** — direct the flow from a phone,\n  wrapped onto a second line.\n',
    );
    const { horizons } = parseRoadmap(withContinuation);
    expect(horizons[0].items[2]).toEqual({
      name: 'Mobile control desk',
      description: 'direct the flow from a phone, wrapped onto a second line.',
      candidates: [
        'Responsive polish for phone widths',
        'PWA manifest + install to home screen',
        'Push notifications for task/check events',
      ],
      linked: [],
    });
  });

  it('returns an empty roadmap for markdown with no matching headings', () => {
    expect(parseRoadmap('# Just a doc\n\nNo headings here.')).toEqual({
      goal: '',
      horizons: [],
      standingConcerns: [],
    });
  });

  it('parses `## Standing concerns` as a distinct, non-horizon kind', () => {
    const { standingConcerns } = parseRoadmap(SAMPLE);
    expect(standingConcerns).toEqual([
      {
        name: 'Infrastructure',
        description: 'the machinery around the work.',
        candidates: [],
        linked: [],
      },
      {
        name: 'Code health',
        description: 'refactors and slimming passes.',
        candidates: [],
        linked: [],
      },
    ]);
  });
});

describe('deriveSubjectVocabulary', () => {
  it('orders horizon items by horizon, then appends standing concerns last', () => {
    expect(deriveSubjectVocabulary(parseRoadmap(SAMPLE))).toEqual([
      'First-run experience',
      'Packaging',
      'Mobile control desk',
      'Goal & roadmap in the app',
      'Infrastructure',
      'Code health',
    ]);
  });

  it('returns an empty vocabulary for a roadmap with no items', () => {
    expect(deriveSubjectVocabulary(parseRoadmap('# Just a doc\n\nNo headings here.'))).toEqual([]);
  });
});

describe('removeRoadmapItem', () => {
  it('removes a single-line item bullet and leaves the rest untouched', () => {
    const result = removeRoadmapItem(
      SAMPLE,
      'Horizon 2 — A deeper desk',
      'Goal & roadmap in the app',
    );
    const { horizons } = parseRoadmap(result);
    expect(horizons[1].items).toEqual([]);
    expect(horizons[0].items).toHaveLength(3);
  });

  it('removes a wrapped item bullet including its continuation lines', () => {
    const result = removeRoadmapItem(
      SAMPLE,
      'Horizon 1 — Ready for daily use',
      'First-run experience',
    );
    const { horizons } = parseRoadmap(result);
    expect(horizons[0].items[0]).toEqual({
      name: 'Packaging',
      description: 'one command in any repo.',
      candidates: [],
      linked: [],
    });
    expect(result).not.toContain('First-run experience');
    expect(result).not.toContain('seeded');
  });

  it('removes an item bullet along with its candidate bullets', () => {
    const result = removeRoadmapItem(
      SAMPLE,
      'Horizon 1 — Ready for daily use',
      'Mobile control desk',
    );
    const { horizons } = parseRoadmap(result);
    expect(horizons[0].items.map((i) => i.name)).toEqual(['First-run experience', 'Packaging']);
    expect(result).not.toContain('Mobile control desk');
    expect(result).not.toContain('Responsive polish for phone widths');
  });

  it('removes a single candidate bullet, leaving the item and its other candidates in place', () => {
    const result = removeRoadmapItem(
      SAMPLE,
      'Horizon 1 — Ready for daily use',
      'Mobile control desk',
      'PWA manifest + install to home screen',
    );
    const { horizons } = parseRoadmap(result);
    expect(horizons[0].items[2]).toEqual({
      name: 'Mobile control desk',
      description: 'direct the flow from a phone.',
      candidates: [
        'Responsive polish for phone widths',
        'Push notifications for task/check events',
      ],
      linked: [],
    });
    expect(result).not.toContain('PWA manifest + install to home screen');
  });

  it('is a no-op when the candidate name does not match', () => {
    expect(
      removeRoadmapItem(
        SAMPLE,
        'Horizon 1 — Ready for daily use',
        'Mobile control desk',
        'No such candidate',
      ),
    ).toBe(SAMPLE);
  });

  it('is a no-op when the horizon does not exist', () => {
    expect(removeRoadmapItem(SAMPLE, 'Horizon 9 — Nope', 'First-run experience')).toBe(SAMPLE);
  });

  it('is a no-op when the item name does not match', () => {
    expect(removeRoadmapItem(SAMPLE, 'Horizon 1 — Ready for daily use', 'No such item')).toBe(
      SAMPLE,
    );
  });

  it('round-trips against the real ROADMAP.md-shaped grammar without corrupting later horizons', () => {
    const result = removeRoadmapItem(SAMPLE, 'Horizon 1 — Ready for daily use', 'Packaging');
    const { horizons } = parseRoadmap(result);
    expect(horizons[0].items.map((i) => i.name)).toEqual([
      'First-run experience',
      'Mobile control desk',
    ]);
    expect(horizons[1].items.map((i) => i.name)).toEqual(['Goal & roadmap in the app']);
  });
});

describe('addRoadmapItem', () => {
  it('appends a new item bullet at the end of the horizon, round-tripping through parseRoadmap', () => {
    const result = addRoadmapItem(
      SAMPLE,
      'Horizon 1 — Ready for daily use',
      'Offline mode',
      'work with no connection.',
    );
    const { horizons } = parseRoadmap(result);
    expect(horizons[0].items.map((i) => i.name)).toEqual([
      'First-run experience',
      'Packaging',
      'Mobile control desk',
      'Offline mode',
    ]);
    expect(horizons[0].items[3]).toEqual({
      name: 'Offline mode',
      description: 'work with no connection.',
      candidates: [],
      linked: [],
    });
  });

  it('does not disturb the following horizon', () => {
    const result = addRoadmapItem(SAMPLE, 'Horizon 1 — Ready for daily use', 'Offline mode', 'x.');
    const { horizons } = parseRoadmap(result);
    expect(horizons[1].items.map((i) => i.name)).toEqual(['Goal & roadmap in the app']);
  });

  it('is a no-op when the horizon does not exist', () => {
    expect(addRoadmapItem(SAMPLE, 'Horizon 9 — Nope', 'Offline mode', 'x.')).toBe(SAMPLE);
  });
});

describe('addRoadmapCandidate', () => {
  it('appends a new candidate bullet under the item, round-tripping through parseRoadmap', () => {
    const result = addRoadmapCandidate(
      SAMPLE,
      'Horizon 1 — Ready for daily use',
      'Mobile control desk',
      'Offline queueing',
    );
    const { horizons } = parseRoadmap(result);
    expect(horizons[0].items[2]).toEqual({
      name: 'Mobile control desk',
      description: 'direct the flow from a phone.',
      candidates: [
        'Responsive polish for phone widths',
        'PWA manifest + install to home screen',
        'Push notifications for task/check events',
        'Offline queueing',
      ],
      linked: [],
    });
  });

  it('adds a first candidate to an item with none yet', () => {
    const result = addRoadmapCandidate(
      SAMPLE,
      'Horizon 1 — Ready for daily use',
      'Packaging',
      'Homebrew formula',
    );
    const { horizons } = parseRoadmap(result);
    expect(horizons[0].items[1]).toEqual({
      name: 'Packaging',
      description: 'one command in any repo.',
      candidates: ['Homebrew formula'],
      linked: [],
    });
  });

  it('is a no-op when the horizon does not exist', () => {
    expect(
      addRoadmapCandidate(SAMPLE, 'Horizon 9 — Nope', 'Mobile control desk', 'Offline queueing'),
    ).toBe(SAMPLE);
  });

  it('is a no-op when the item does not exist', () => {
    expect(
      addRoadmapCandidate(SAMPLE, 'Horizon 1 — Ready for daily use', 'No such item', 'x'),
    ).toBe(SAMPLE);
  });
});

describe('linkRoadmapItem', () => {
  it('appends a link bullet under the item, round-tripping through parseRoadmap', () => {
    const result = linkRoadmapItem(
      SAMPLE,
      'Horizon 1 — Ready for daily use',
      'Packaging',
      'IDEA-42',
    );
    const { horizons } = parseRoadmap(result);
    expect(horizons[0].items[1]).toEqual({
      name: 'Packaging',
      description: 'one command in any repo.',
      candidates: [],
      linked: ['IDEA-42'],
    });
  });

  it('leaves existing candidates in place when adding a link', () => {
    const result = linkRoadmapItem(
      SAMPLE,
      'Horizon 1 — Ready for daily use',
      'Mobile control desk',
      'IDEA-42',
    );
    const { horizons } = parseRoadmap(result);
    expect(horizons[0].items[2]).toEqual({
      name: 'Mobile control desk',
      description: 'direct the flow from a phone.',
      candidates: [
        'Responsive polish for phone widths',
        'PWA manifest + install to home screen',
        'Push notifications for task/check events',
      ],
      linked: ['IDEA-42'],
    });
  });

  it('is a no-op when the horizon does not exist', () => {
    expect(linkRoadmapItem(SAMPLE, 'Horizon 9 — Nope', 'Packaging', 'IDEA-42')).toBe(SAMPLE);
  });

  it('is a no-op when the item does not exist', () => {
    expect(
      linkRoadmapItem(SAMPLE, 'Horizon 1 — Ready for daily use', 'No such item', 'IDEA-42'),
    ).toBe(SAMPLE);
  });
});

describe('resolveRoadmap', () => {
  it('joins linked ids to entity status and rolls up per item and per horizon', () => {
    const linked = linkRoadmapItem(
      linkRoadmapItem(SAMPLE, 'Horizon 1 — Ready for daily use', 'Packaging', 'IDEA-1'),
      'Horizon 1 — Ready for daily use',
      'Mobile control desk',
      'IDEA-2',
    );
    const roadmap = parseRoadmap(linked);
    const entities = [
      plan({ id: 'IDEA-1', status: 'done' }),
      plan({ id: 'IDEA-2', status: 'in-progress' }),
    ];

    const resolved = resolveRoadmap(roadmap, entities);

    expect(resolved.horizons[0].items[1]).toMatchObject({
      name: 'Packaging',
      links: [{ id: 'IDEA-1', status: 'done' }],
      rollup: { total: 1, done: 1 },
    });
    expect(resolved.horizons[0].items[2]).toMatchObject({
      name: 'Mobile control desk',
      links: [{ id: 'IDEA-2', status: 'in-progress' }],
      rollup: { total: 1, done: 0 },
    });
    expect(resolved.horizons[0].rollup).toEqual({ total: 2, done: 1 });
    expect(resolved.horizons[1].rollup).toEqual({ total: 0, done: 0 });
  });

  it('drops links whose entity no longer exists', () => {
    const linked = linkRoadmapItem(
      SAMPLE,
      'Horizon 1 — Ready for daily use',
      'Packaging',
      'IDEA-404',
    );
    const resolved = resolveRoadmap(parseRoadmap(linked), []);

    expect(resolved.horizons[0].items[1]).toMatchObject({
      links: [],
      rollup: { total: 0, done: 0 },
    });
  });
});

const task = (overrides: Partial<TaskLogEntry>): TaskLogEntry => ({
  id: 'task-1',
  taskKind: 'run-all',
  planTitle: 'Untitled',
  agentId: 'claude-code',
  startedAt: '2026-01-02T00:00:00.000Z',
  endedAt: '2026-01-02T00:01:00.000Z',
  outcome: 'done',
  ...overrides,
});

describe('deriveRoadmapEvents', () => {
  const linked = linkRoadmapItem(SAMPLE, 'Horizon 1 — Ready for daily use', 'Packaging', 'IDEA-1');
  const roadmap = parseRoadmap(linked);

  it('emits a created event for a linked entity, keyed to its horizon and item', () => {
    const entities = [plan({ id: 'IDEA-1', title: 'Packaging plan', created: '2026-01-01' })];
    const events = deriveRoadmapEvents(roadmap, entities, []);
    expect(events).toEqual([
      {
        date: '2026-01-01',
        kind: 'created',
        entityId: 'IDEA-1',
        horizonTitle: 'Horizon 1 — Ready for daily use',
        itemName: 'Packaging',
        label: 'Packaging plan created',
      },
    ]);
  });

  it('emits a task-run event from a tasks.log row keyed by planId', () => {
    const events = deriveRoadmapEvents(
      roadmap,
      [],
      [task({ planId: 'IDEA-1', taskKind: 'reconcile', startedAt: '2026-01-03T00:00:00.000Z' })],
    );
    expect(events).toEqual([
      {
        date: '2026-01-03T00:00:00.000Z',
        kind: 'task-run',
        entityId: 'IDEA-1',
        horizonTitle: 'Horizon 1 — Ready for daily use',
        itemName: 'Packaging',
        label: 'reconcile run (done)',
      },
    ]);
  });

  it('sorts the combined stream chronologically', () => {
    const entities = [plan({ id: 'IDEA-1', created: '2026-01-05' })];
    const taskLog = [task({ planId: 'IDEA-1', startedAt: '2026-01-02T00:00:00.000Z' })];
    const events = deriveRoadmapEvents(roadmap, entities, taskLog);
    expect(events.map((e) => e.kind)).toEqual(['task-run', 'created']);
  });

  it('ignores an entity or task run not linked to any roadmap item', () => {
    const entities = [plan({ id: 'IDEA-999', created: '2026-01-01' })];
    const taskLog = [task({ planId: 'IDEA-999' })];
    expect(deriveRoadmapEvents(roadmap, entities, taskLog)).toEqual([]);
  });

  it('ignores a tasks.log row with no planId', () => {
    expect(deriveRoadmapEvents(roadmap, [], [task({})])).toEqual([]);
  });
});
