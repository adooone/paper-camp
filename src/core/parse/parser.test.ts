import { describe, expect, it } from 'vitest';
import type { PlanEntry } from '../../types/index';
import { formatEntityFile } from '../serialize/serializer';
import { notesFromThread, reviewFromThread } from '../thread';
import {
  findConsistencyIssues,
  parseEntityFile,
  parseIdeas,
  parseNotificationLog,
  parsePlans,
  parseSuggestions,
  parseTaskLog,
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

  it('parses the [manual] inline tag as phase.source', () => {
    const md = `## Short title

**Status:** in-progress
**Created:** 2026-06-18

Body.

### Phases
- [x] Decide on storage format
- [x] [manual] Smaller toolbar button text
`;
    const { entries, warnings } = parsePlans(md);
    expect(warnings).toEqual([]);
    expect(entries[0].phases).toEqual([
      { done: true, text: 'Decide on storage format' },
      { done: true, text: 'Smaller toolbar button text', source: 'manual' },
    ]);
  });
});

describe('findConsistencyIssues', () => {
  const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
    title: 'Some plan',
    status: 'planned',
    created: '2026-06-01',
    tags: [],
    body: '',
    phases: [],
    ...overrides,
  });

  it('returns no issues when there are no orphan subjects', () => {
    expect(findConsistencyIssues([])).toEqual([]);
  });

  it('flags a plan whose subject is not in the roadmap vocabulary', () => {
    const plans = [plan({ title: 'Plan A', id: 'FEAT-2', subject: 'Retired subject' })];
    expect(findConsistencyIssues(plans, ['Packaging'])).toEqual([
      expect.objectContaining({ kind: 'orphan-subject', title: 'Plan A', planId: 'FEAT-2' }),
    ]);
  });

  it('does not flag a plan whose subject is in the roadmap vocabulary', () => {
    const plans = [plan({ title: 'Plan A', id: 'FEAT-2', subject: 'Packaging' })];
    expect(findConsistencyIssues(plans, ['Packaging'])).toEqual([]);
  });

  it('does not flag a plan with no subject', () => {
    const plans = [plan({ title: 'Plan A', id: 'FEAT-2' })];
    expect(findConsistencyIssues(plans, ['Packaging'])).toEqual([]);
  });

  it('does not flag an archived plan even when its subject was pruned from the roadmap', () => {
    const plans = [
      plan({ title: 'Shipped', id: 'FEAT-9', subject: 'Retired subject', archived: true }),
    ];
    expect(findConsistencyIssues(plans, ['Packaging'])).toEqual([]);
  });

  it('flags an active idea whose title runs past 40 characters', () => {
    const plans = [
      plan({
        title: 'Desk is broken under the mount, router basepath and a friendlier route',
        id: 'IDEA-139',
      }),
    ];
    expect(findConsistencyIssues(plans)).toEqual([
      expect.objectContaining({
        kind: 'title-style',
        title: expect.any(String),
        planId: 'IDEA-139',
      }),
    ]);
  });

  it('flags an active idea with an em-dash subtitle even under 40 characters', () => {
    const plans = [plan({ title: 'Desk breaks — router basepath', id: 'IDEA-140' })];
    expect(findConsistencyIssues(plans)).toEqual([
      expect.objectContaining({ kind: 'title-style', planId: 'IDEA-140' }),
    ]);
  });

  it('does not flag a short, clean active title', () => {
    const plans = [plan({ title: 'Desk breaks under the mount', id: 'IDEA-1' })];
    expect(findConsistencyIssues(plans)).toEqual([]);
  });

  it('does not flag a long title on a done or dropped idea', () => {
    const longTitle = 'Desk is broken under the mount, router basepath and a friendlier route';
    const plans = [
      plan({ title: longTitle, id: 'IDEA-8', status: 'done' }),
      plan({ title: longTitle, id: 'IDEA-9', status: 'dropped' }),
    ];
    expect(findConsistencyIssues(plans)).toEqual([]);
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

  it('extracts Notes entries out of the body', () => {
    const md = `---
id: IDEA-99
title: Tolerant heading
type: feat
created: 2026-07-13
---

Body prose.

### Notes
- [ ] [phase:1] Reconsider the retry backoff here
- [x] [body] Already addressed in the rewrite
`;
    const { entries, warnings } = parseEntityFile(md);
    expect(warnings).toEqual([]);
    expect(notesFromThread(entries[0].thread)).toEqual([
      {
        anchor: { kind: 'body' },
        prose: '[phase 1] Reconsider the retry backoff here',
        state: 'open',
        kind: 'note',
      },
      {
        anchor: { kind: 'body' },
        prose: 'Already addressed in the rewrite',
        state: 'resolved',
        kind: 'note',
      },
    ]);
    expect(entries[0].body).toBe('Body prose.');
  });

  it('extracts a decision/question kind tag on Notes entries', () => {
    const md = `---
id: IDEA-99
title: Tolerant heading
type: feat
created: 2026-07-13
---

Body prose.

### Notes
- [ ] [body] [decision] Ship the v2 API without a compat shim
- [ ] [phase:1] [question] Does this need a migration?
`;
    const { entries, warnings } = parseEntityFile(md);
    expect(warnings).toEqual([]);
    expect(notesFromThread(entries[0].thread)).toEqual([
      {
        anchor: { kind: 'body' },
        prose: 'Ship the v2 API without a compat shim',
        state: 'open',
        kind: 'decision',
      },
      {
        anchor: { kind: 'body' },
        prose: '[phase 1] Does this need a migration?',
        state: 'open',
        kind: 'question',
      },
    ]);
  });

  it('round-trips a decision note kind through formatEntityFile', () => {
    const written = formatEntityFile({
      id: 'IDEA-99',
      title: 'Tolerant heading',
      type: 'feat',
      created: '2026-07-13',
      body: 'Body prose.',
      thread: [
        {
          kind: 'decision',
          text: 'Ship the v2 API without a compat shim',
          state: 'open',
        },
      ],
    });
    const { entries, warnings } = parseEntityFile(written);
    expect(warnings).toEqual([]);
    expect(notesFromThread(entries[0].thread)).toEqual([
      {
        anchor: { kind: 'body' },
        prose: 'Ship the v2 API without a compat shim',
        state: 'open',
        kind: 'decision',
      },
    ]);
  });

  it('round-trips notes through formatEntityFile', () => {
    const written = formatEntityFile({
      id: 'IDEA-99',
      title: 'Tolerant heading',
      type: 'feat',
      created: '2026-07-13',
      body: 'Body prose.',
      thread: [
        {
          kind: 'note',
          text: 'Reconsider the retry backoff here',
          state: 'open',
        },
        { kind: 'note', text: 'Already addressed in the rewrite', state: 'resolved' },
      ],
    });
    const { entries, warnings } = parseEntityFile(written);
    expect(warnings).toEqual([]);
    expect(notesFromThread(entries[0].thread)).toEqual([
      {
        anchor: { kind: 'body' },
        prose: 'Reconsider the retry backoff here',
        state: 'open',
        kind: 'note',
      },
      {
        anchor: { kind: 'body' },
        prose: 'Already addressed in the rewrite',
        state: 'resolved',
        kind: 'note',
      },
    ]);
  });

  it('extracts Review entries out of the body', () => {
    const md = `---
id: IDEA-99
title: Tolerant heading
type: feat
created: 2026-07-13
---

Body prose.

### Review
- 2026-07-27: The phase 2 rollout plan is missing a rollback step
`;
    const { entries, warnings } = parseEntityFile(md);
    expect(warnings).toEqual([]);
    expect(reviewFromThread(entries[0].thread)).toEqual([
      { date: '2026-07-27', text: 'The phase 2 rollout plan is missing a rollback step' },
    ]);
    expect(entries[0].body).toBe('Body prose.');
  });

  it('round-trips review entries through formatEntityFile', () => {
    const written = formatEntityFile({
      id: 'IDEA-99',
      title: 'Tolerant heading',
      type: 'feat',
      created: '2026-07-13',
      body: 'Body prose.',
      thread: [
        {
          kind: 'review',
          date: '2026-07-27',
          text: 'The phase 2 rollout plan is missing a rollback step',
        },
      ],
    });
    const { entries, warnings } = parseEntityFile(written);
    expect(warnings).toEqual([]);
    expect(reviewFromThread(entries[0].thread)).toEqual([
      { date: '2026-07-27', text: 'The phase 2 rollout plan is missing a rollback step' },
    ]);
  });

  it('extracts Fixes entries out of the body, separate from Phases', () => {
    const md = `---
id: IDEA-99
title: Tolerant heading
type: feat
created: 2026-07-13
---

Body prose.

### Phases
- [x] first

### Fixes
- [ ] Docs check regressed after the first phase
      Found during review, not part of the original build.
- [x] Undo button didn't revert body edits
`;
    const { entries, warnings } = parseEntityFile(md);
    expect(warnings).toEqual([]);
    expect(entries[0].phases).toEqual([{ done: true, text: 'first' }]);
    expect(entries[0].fixes).toEqual([
      {
        done: false,
        text: 'Docs check regressed after the first phase',
        description: 'Found during review, not part of the original build.',
      },
      { done: true, text: "Undo button didn't revert body edits" },
    ]);
  });

  it('round-trips fixes through formatEntityFile', () => {
    const written = formatEntityFile({
      id: 'IDEA-99',
      title: 'Tolerant heading',
      type: 'feat',
      created: '2026-07-13',
      body: 'Body prose.',
      phases: [{ text: 'first', done: true }],
      fixes: [{ text: 'Docs check regressed', done: false, description: 'Found during review.' }],
    });
    const { entries, warnings } = parseEntityFile(written);
    expect(warnings).toEqual([]);
    expect(entries[0].fixes).toEqual([
      { text: 'Docs check regressed', done: false, description: 'Found during review.' },
    ]);
  });

  it('omits the Fixes section when no fixes are present', () => {
    const written = formatEntityFile({
      id: 'IDEA-99',
      title: 'Tolerant heading',
      type: 'feat',
      created: '2026-07-13',
      body: 'Body prose.',
      phases: [{ text: 'first', done: true }],
    });
    expect(written).not.toContain('### Fixes');
    const { entries } = parseEntityFile(written);
    expect(entries[0].fixes).toBeUndefined();
  });
});

describe('parseTaskLog', () => {
  it('parses one entry per JSON line', () => {
    const entryA = {
      id: 'a',
      taskKind: 'phase',
      planId: 'FEAT-1',
      planTitle: 'Some plan',
      agentId: 'claude-code',
      startedAt: '2026-07-15T10:00:00.000Z',
      endedAt: '2026-07-15T10:05:00.000Z',
      outcome: 'done',
    };
    const entryB = {
      id: 'b',
      taskKind: 'commit-suggest',
      planTitle: 'Some plan',
      agentId: 'claude-code',
      startedAt: '2026-07-15T10:06:00.000Z',
      endedAt: '2026-07-15T10:06:30.000Z',
      outcome: 'error',
    };
    const jsonl = `${JSON.stringify(entryA)}\n${JSON.stringify(entryB)}\n`;
    expect(parseTaskLog(jsonl)).toEqual([entryA, entryB]);
  });

  it('skips malformed lines and blank lines rather than failing the whole read', () => {
    const entry = {
      id: 'a',
      taskKind: 'phase',
      planTitle: 'Some plan',
      agentId: 'claude-code',
      startedAt: '2026-07-15T10:00:00.000Z',
      endedAt: '2026-07-15T10:05:00.000Z',
      outcome: 'done',
    };
    const jsonl = `${JSON.stringify(entry)}\n\nnot json\n`;
    expect(parseTaskLog(jsonl)).toEqual([entry]);
  });

  it('returns an empty array for an empty file', () => {
    expect(parseTaskLog('')).toEqual([]);
  });
});

describe('parseNotificationLog', () => {
  it('parses one entry per JSON line', () => {
    const entryA = {
      id: 'notif-1',
      kind: 'completed',
      entityId: 'IDEA-1',
      entityTitle: 'First',
      text: 'run-all finished',
      date: '2026-07-15T10:05:00.000Z',
      read: false,
      outcome: 'done',
    };
    const entryB = {
      id: 'notif-2',
      kind: 'reply',
      entityId: 'IDEA-2',
      entityTitle: 'Second',
      text: 'Answered your question',
      date: '2026-07-15T10:06:00.000Z',
      read: true,
    };
    const jsonl = `${JSON.stringify(entryA)}\n${JSON.stringify(entryB)}\n`;
    expect(parseNotificationLog(jsonl)).toEqual([entryA, entryB]);
  });

  it('skips malformed lines and blank lines rather than failing the whole read', () => {
    const entry = {
      id: 'notif-1',
      kind: 'completed',
      entityId: 'IDEA-1',
      entityTitle: 'First',
      text: 'run-all finished',
      date: '2026-07-15T10:05:00.000Z',
      read: false,
    };
    const jsonl = `${JSON.stringify(entry)}\n\nnot json\n`;
    expect(parseNotificationLog(jsonl)).toEqual([entry]);
  });

  it('returns an empty array for an empty file', () => {
    expect(parseNotificationLog('')).toEqual([]);
  });

  it('skips syntactically valid but schema-invalid lines', () => {
    const valid = {
      id: 'notif-1',
      kind: 'completed',
      entityId: 'IDEA-1',
      entityTitle: 'First',
      text: 'run-all finished',
      date: '2026-07-15T10:05:00.000Z',
      read: false,
    };
    const missingFields = { id: 'notif-2', kind: 'completed' };
    const invalidKind = { ...valid, id: 'notif-3', kind: 'unexpected' };
    const invalidOutcome = { ...valid, id: 'notif-4', outcome: 'pending' };
    const jsonl = [
      JSON.stringify(valid),
      'null',
      JSON.stringify(missingFields),
      JSON.stringify(invalidKind),
      JSON.stringify(invalidOutcome),
    ].join('\n');
    expect(parseNotificationLog(jsonl)).toEqual([valid]);
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
