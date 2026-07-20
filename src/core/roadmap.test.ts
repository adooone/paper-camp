import { describe, expect, it } from 'vitest';
import { parseRoadmap, removeRoadmapItem } from './roadmap';

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

## Horizon 2 — A deeper desk

- **Goal & roadmap in the app** — this file rendered as a first-class surface.
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
    expect(horizons[0].items).toEqual([
      {
        name: 'First-run experience',
        description:
          '`init` produces a welcoming empty corpus: seeded example idea, empty states that teach.',
      },
      { name: 'Packaging', description: 'one command in any repo.' },
    ]);
  });

  it('returns an empty roadmap for markdown with no matching headings', () => {
    expect(parseRoadmap('# Just a doc\n\nNo headings here.')).toEqual({ goal: '', horizons: [] });
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
    expect(horizons[0].items).toHaveLength(2);
  });

  it('removes a wrapped item bullet including its continuation lines', () => {
    const result = removeRoadmapItem(
      SAMPLE,
      'Horizon 1 — Ready for daily use',
      'First-run experience',
    );
    const { horizons } = parseRoadmap(result);
    expect(horizons[0].items).toEqual([
      { name: 'Packaging', description: 'one command in any repo.' },
    ]);
    expect(result).not.toContain('First-run experience');
    expect(result).not.toContain('seeded');
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
    expect(horizons[0].items.map((i) => i.name)).toEqual(['First-run experience']);
    expect(horizons[1].items.map((i) => i.name)).toEqual(['Goal & roadmap in the app']);
  });
});
