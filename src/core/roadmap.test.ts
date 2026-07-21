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
- **Mobile control desk** — direct the flow from a phone.
  - Responsive polish for phone widths
  - PWA manifest + install to home screen
  - Push notifications for task/check events

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
    expect(horizons[0].items[0]).toEqual({
      name: 'First-run experience',
      description:
        '`init` produces a welcoming empty corpus: seeded example idea, empty states that teach.',
      candidates: [],
    });
    expect(horizons[0].items[1]).toEqual({
      name: 'Packaging',
      description: 'one command in any repo.',
      candidates: [],
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
    });
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
