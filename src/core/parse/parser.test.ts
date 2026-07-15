import { describe, expect, it } from 'vitest';
import type { DecisionEntry, OpenQuestionEntry, PlanEntry } from '../../types/index';
import {
  findConsistencyIssues,
  parseDecisions,
  parseEntityFile,
  parseIdeas,
  parseOpenQuestions,
  parsePlans,
  parseProgress,
  parseSuggestions,
} from './parser';

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

  it('parses optional kind and id fields', () => {
    const md = `## Short title

**Status:** idea
**Kind:** feat
**Id:** FEAT-3
**Created:** 2026-06-18

Body.
`;
    const { entries, warnings } = parsePlans(md);
    expect(warnings).toEqual([]);
    expect(entries[0]).toMatchObject({
      title: 'Short title',
      status: 'idea',
      kind: 'feat',
      id: 'FEAT-3',
    });
  });

  it('parses optional idea backlink field', () => {
    const md = `## Short title

**Status:** idea
**Kind:** feat
**Id:** FEAT-4
**Idea:** IDEA-2
**Created:** 2026-06-18

Body.
`;
    const { entries, warnings } = parsePlans(md);
    expect(warnings).toEqual([]);
    expect(entries[0]).toMatchObject({
      title: 'Short title',
      idea: 'IDEA-2',
    });
  });

  it('parses phase descriptions from indented continuation lines', () => {
    const md = `## Short title

**Status:** idea
**Created:** 2026-06-18

Body.

### Phases
- [x] Decide on storage format
- [ ] Write zod schemas
      Handles malformed \`### Phases\` blocks without throwing — collects a ParseWarning
      instead, so one bad entry doesn't take down parsing for the whole file.
- [ ] Build parser
`;
    const { entries, warnings } = parsePlans(md);
    expect(warnings).toEqual([]);
    expect(entries[0].phases).toEqual([
      { done: true, text: 'Decide on storage format' },
      {
        done: false,
        text: 'Write zod schemas',
        description:
          "Handles malformed `### Phases` blocks without throwing — collects a ParseWarning\ninstead, so one bad entry doesn't take down parsing for the whole file.",
      },
      { done: false, text: 'Build parser' },
    ]);
  });

  it('extracts Log entries out of the body', () => {
    const md = `## Short title

**Status:** in-progress
**Created:** 2026-06-18

Body.

### Log
- 2026-06-18: Started implementation
- 2026-06-19: Finished parser
`;
    const { entries, warnings } = parsePlans(md);
    expect(warnings).toEqual([]);
    expect(entries[0].log).toEqual([
      { date: '2026-06-18', text: 'Started implementation' },
      { date: '2026-06-19', text: 'Finished parser' },
    ]);
    expect(entries[0].body).toBe('Body.');
  });

  it('extracts Clarifications entries out of the body', () => {
    const md = `## Short title

**Status:** in-progress
**Created:** 2026-06-18

Body.

### Clarifications
- 2026-06-20: Scope limited to the dashboard
`;
    const { entries, warnings } = parsePlans(md);
    expect(warnings).toEqual([]);
    expect(entries[0].clarifications).toEqual([
      { date: '2026-06-20', text: 'Scope limited to the dashboard' },
    ]);
    expect(entries[0].body).toBe('Body.');
  });

  it('stops a Phases section at the next sub-heading', () => {
    const md = `## Short title

**Status:** in-progress
**Created:** 2026-06-18

Body.

### Phases
- [ ] Only phase

### Log
- 2026-06-18: Note
`;
    const { entries } = parsePlans(md);
    expect(entries[0].phases).toEqual([{ done: false, text: 'Only phase' }]);
    expect(entries[0].log).toEqual([{ date: '2026-06-18', text: 'Note' }]);
  });

  it('parses the [review] inline tag as phase.source', () => {
    const md = `## Short title

**Status:** in-progress
**Created:** 2026-06-18

Body.

### Phases
- [x] Decide on storage format
- [ ] [review] Fix off-by-one in pagination
`;
    const { entries, warnings } = parsePlans(md);
    expect(warnings).toEqual([]);
    expect(entries[0].phases).toEqual([
      { done: true, text: 'Decide on storage format' },
      { done: false, text: 'Fix off-by-one in pagination', source: 'review' },
    ]);
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

  it('captures blocks when set', () => {
    const md = `## Should dev bundle a server?

**Status:** open
**Raised:** 2026-06-18
**Blocks:** FEAT-2

Needs a decision before the dashboard ships.
`;
    const { entries } = parseOpenQuestions(md);
    expect(entries[0].blocks).toBe('FEAT-2');
  });
});

describe('findConsistencyIssues', () => {
  const decision = (overrides: Partial<DecisionEntry>): DecisionEntry => ({
    title: 'Some decision',
    date: '2026-06-01',
    status: 'decided',
    body: '',
    ...overrides,
  });
  const question = (overrides: Partial<OpenQuestionEntry>): OpenQuestionEntry => ({
    title: 'Some question',
    status: 'open',
    raised: '2026-06-01',
    body: '',
    ...overrides,
  });
  const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
    title: 'Some plan',
    status: 'planned',
    created: '2026-06-01',
    tags: [],
    body: '',
    phases: [],
    ...overrides,
  });

  it('returns no issues when references all resolve', () => {
    const decisions = [decision({ title: 'New approach' })];
    const questions = [question({ title: 'Q1', status: 'resolved', resolvedBy: 'New approach' })];
    expect(findConsistencyIssues(decisions, questions, [])).toEqual([]);
  });

  it('flags a dangling superseded-by', () => {
    const decisions = [decision({ title: 'Old approach', supersededBy: 'Nonexistent' })];
    expect(findConsistencyIssues(decisions, [], [])).toEqual([
      expect.objectContaining({ kind: 'dangling-superseded-by', title: 'Old approach' }),
    ]);
  });

  it('flags a dangling resolved-by', () => {
    const questions = [question({ title: 'Q1', status: 'resolved', resolvedBy: 'Nonexistent' })];
    expect(findConsistencyIssues([], questions, [])).toEqual([
      expect.objectContaining({ kind: 'dangling-resolved-by', title: 'Q1' }),
    ]);
  });

  it('flags an open question blocking an in-progress or review plan', () => {
    const questions = [question({ title: 'Q1', blocks: 'FEAT-2' })];
    const plans = [plan({ title: 'Plan A', id: 'FEAT-2', status: 'in-progress' })];
    expect(findConsistencyIssues([], questions, plans)).toEqual([
      expect.objectContaining({ kind: 'blocked-plan-active', title: 'Q1', planId: 'FEAT-2' }),
    ]);
  });

  it('does not flag a blocked plan that is still planned', () => {
    const questions = [question({ title: 'Q1', blocks: 'FEAT-2' })];
    const plans = [plan({ title: 'Plan A', id: 'FEAT-2', status: 'planned' })];
    expect(findConsistencyIssues([], questions, plans)).toEqual([]);
  });

  it('does not flag a blocking question that has already been resolved', () => {
    const questions = [question({ title: 'Q1', status: 'resolved', blocks: 'FEAT-2' })];
    const plans = [plan({ title: 'Plan A', id: 'FEAT-2', status: 'in-progress' })];
    expect(findConsistencyIssues([], questions, plans)).toEqual([]);
  });
});

describe('parseIdeas', () => {
  it('splits sections on --- separators and extracts IDEA ids from headings', () => {
    const md = `## IDEA-1: First idea

Body one.

---

## IDEA-2: Second idea

Body two.
`;
    const ideas = parseIdeas(md);
    expect(ideas).toHaveLength(2);
    expect(ideas[0]).toMatchObject({ id: 'IDEA-1', title: 'First idea' });
    expect(ideas[0].body).toContain('Body one.');
    expect(ideas[1]).toMatchObject({ id: 'IDEA-2', title: 'Second idea' });
  });

  it('keeps a section without an IDEA prefix, with a null id', () => {
    const md = `## Just a heading

Some body.
`;
    const ideas = parseIdeas(md);
    expect(ideas).toEqual([
      { id: null, title: 'Just a heading', body: '## Just a heading\n\nSome body.' },
    ]);
  });

  it('falls back to the first line as title when there is no heading', () => {
    const ideas = parseIdeas('A stray thought without markdown.\nMore prose.');
    expect(ideas).toHaveLength(1);
    expect(ideas[0].id).toBeNull();
    expect(ideas[0].title).toBe('A stray thought without markdown.');
  });
});

describe('parseEntityFile', () => {
  const entity = (phasesHeading: string) => `---
id: IDEA-99
title: Tolerant heading
type: feat
created: 2026-07-13
---

Body prose.

${phasesHeading}
- [x] first
- [ ] second
`;

  it('extracts phases under the canonical ### heading', () => {
    const { entries, warnings } = parseEntityFile(entity('### Phases'));
    expect(warnings).toEqual([]);
    expect(entries[0].phases).toEqual([
      { done: true, text: 'first' },
      { done: false, text: 'second' },
    ]);
  });

  it('still extracts phases when a linter demoted ### Phases to ## Phases', () => {
    // Regression: a generic markdown-heading "fix" (### → ##) must not silently
    // make the whole Phases section vanish. The serializer re-canonicalizes to ###.
    const { entries } = parseEntityFile(entity('## Phases'));
    expect(entries[0].phases).toEqual([
      { done: true, text: 'first' },
      { done: false, text: 'second' },
    ]);
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

describe('parseSuggestions', () => {
  it('parses a dated title + one-line description entry', () => {
    const md =
      '- 2026-07-15: Cache the docs sidebar tree — repeated navigation re-parses the same markdown on every click.\n';
    const entries = parseSuggestions(md);
    expect(entries).toEqual([
      {
        date: '2026-07-15',
        title: 'Cache the docs sidebar tree',
        description: 'repeated navigation re-parses the same markdown on every click.',
      },
    ]);
  });

  it('parses multiple appended entries in order', () => {
    const md = `- 2026-07-14: First idea — first description.
- 2026-07-15: Second idea — second description.
`;
    const entries = parseSuggestions(md);
    expect(entries).toHaveLength(2);
    expect(entries[0].title).toBe('First idea');
    expect(entries[1].title).toBe('Second idea');
  });

  it('ignores non-matching lines', () => {
    const md = `# Suggestions\n\nSome free prose that isn't an entry.\n`;
    expect(parseSuggestions(md)).toEqual([]);
  });

  it('returns an empty array for an empty file', () => {
    expect(parseSuggestions('')).toEqual([]);
  });
});
