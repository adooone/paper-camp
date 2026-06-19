import { describe, expect, it } from 'vitest';
import { parseDecisions, parseOpenQuestions, parsePlans, parseProgress } from './parser';

describe('parsePlans', () => {
  it('parses a well-formed plan with phases', () => {
    const md = `## Markdown storage layer

**Status:** in-progress
**Created:** 2026-06-18
**Tags:** core, parser

Use frontmatter-style fields per entry instead of a database.

### Phases
- [x] Decide on storage format
- [ ] Write zod schemas
- [ ] Build parser
`;
    const { entries, warnings } = parsePlans(md);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      title: 'Markdown storage layer',
      status: 'in-progress',
      created: '2026-06-18',
      tags: ['core', 'parser'],
      body: 'Use frontmatter-style fields per entry instead of a database.',
    });
    expect(entries[0].phases).toEqual([
      { done: true, text: 'Decide on storage format' },
      { done: false, text: 'Write zod schemas' },
      { done: false, text: 'Build parser' },
    ]);
  });

  it('parses multiple plans in one file', () => {
    const md = `## First plan

**Status:** done
**Created:** 2026-01-01

Body one.

## Second plan

**Status:** idea
**Created:** 2026-02-02

Body two.
`;
    const { entries, warnings } = parsePlans(md);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(2);
    expect(entries[0].title).toBe('First plan');
    expect(entries[1].title).toBe('Second plan');
  });

  it('warns instead of throwing on an invalid status', () => {
    const md = `## Broken plan

**Status:** not-a-real-status
**Created:** 2026-06-18

Body.
`;
    const { entries, warnings } = parsePlans(md);
    expect(entries).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].title).toBe('Broken plan');
  });

  it('warns instead of throwing on a missing required field', () => {
    const md = `## No created date

**Status:** idea

Body.
`;
    const { entries, warnings } = parsePlans(md);
    expect(entries).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  it('defaults tags to an empty array when absent', () => {
    const md = `## No tags

**Status:** idea
**Created:** 2026-06-18

Body.
`;
    const { entries } = parsePlans(md);
    expect(entries[0].tags).toEqual([]);
  });
});

describe('parseDecisions', () => {
  it('parses a decided entry', () => {
    const md = `## Markdown, not a database

**Date:** 2026-06-18
**Status:** decided

**Context:** AI assistants need zero-setup access.
**Decision:** Use markdown with per-entry fields.
`;
    const { entries, warnings } = parseDecisions(md);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe('decided');
    expect(entries[0].date).toBe('2026-06-18');
    expect(entries[0].supersededBy).toBeUndefined();
  });

  it('captures superseded-by when present', () => {
    const md = `## Old approach

**Date:** 2026-01-01
**Status:** superseded
**Superseded-by:** New approach

Body.
`;
    const { entries } = parseDecisions(md);
    expect(entries[0].supersededBy).toBe('New approach');
  });
});

describe('parseOpenQuestions', () => {
  it('parses an open question', () => {
    const md = `## Should dev bundle a server?

**Status:** open
**Raised:** 2026-06-18

Needs a decision before the dashboard ships.
`;
    const { entries, warnings } = parseOpenQuestions(md);
    expect(warnings).toEqual([]);
    expect(entries[0]).toMatchObject({ status: 'open', raised: '2026-06-18' });
  });

  it('captures resolved-by when resolved', () => {
    const md = `## Storage format?

**Status:** resolved
**Raised:** 2026-06-01
**Resolved-by:** Markdown, not a database

Body.
`;
    const { entries } = parseOpenQuestions(md);
    expect(entries[0].resolvedBy).toBe('Markdown, not a database');
  });
});

describe('parseProgress', () => {
  it('groups bullets under date headings', () => {
    const md = `## 2026-06-18
- Decided on markdown over a database
- Drafted schemas

## 2026-06-17
- Wrote the about.md technical reference
`;
    const entries = parseProgress(md);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      date: '2026-06-18',
      items: ['Decided on markdown over a database', 'Drafted schemas'],
    });
    expect(entries[1]).toEqual({
      date: '2026-06-17',
      items: ['Wrote the about.md technical reference'],
    });
  });

  it('returns an empty array for an empty file', () => {
    expect(parseProgress('')).toEqual([]);
  });
});
