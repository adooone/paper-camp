import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { formatIdeaFile, formatPlanFile } from '../serialize/serializer';
import { parseFrontmatter, parseIdeaFile, parsePlanFile } from './parser';

const testSchema = z.object({
  id: z.string(),
  title: z.string(),
  count: z.number().optional(),
});

describe('parseFrontmatter', () => {
  it('parses valid YAML frontmatter and returns body', () => {
    const content = `---
id: FEAT-24
title: Test plan
count: 3
---
Body content here.
`;
    const result = parseFrontmatter(content, testSchema);
    expect(result.warnings).toEqual([]);
    expect(result.data).toEqual({ id: 'FEAT-24', title: 'Test plan', count: 3 });
    expect(result.body).toBe('Body content here.');
  });

  it('returns empty warnings when no frontmatter is present', () => {
    const content = 'Just plain markdown without frontmatter.';
    const result = parseFrontmatter(content, testSchema);
    expect(result.warnings).toEqual([]);
    expect(result.data).toBeNull();
    expect(result.body).toBe(content);
  });

  it('parses frontmatter with CRLF line endings', () => {
    const content = '---\r\nid: FEAT-1\r\ntitle: Windows plan\r\n---\r\nBody text.\r\n';
    const result = parseFrontmatter(content, testSchema);
    expect(result.warnings).toEqual([]);
    expect(result.data).toEqual({ id: 'FEAT-1', title: 'Windows plan' });
    expect(result.body).toBe('Body text.');
  });

  it('warns on malformed YAML', () => {
    const content = `---
unclosed: "string
---`;
    const result = parseFrontmatter(content, testSchema);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('Invalid YAML frontmatter');
    expect(result.data).toBeNull();
  });

  it('warns when frontmatter YAML is not an object', () => {
    const content = `---
- just
- an
- array
---
body`;
    const result = parseFrontmatter(content, testSchema);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('did not produce an object');
    expect(result.data).toBeNull();
  });

  it('warns on schema validation failure', () => {
    const content = `---
id: FEAT-24
title: 12345
---
body`;
    const result = parseFrontmatter(content, testSchema);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('expected string');
    expect(result.data).toBeNull();
  });
});

describe('parsePlanFile', () => {
  it('parses a valid plan file with frontmatter, phases, and log', () => {
    const content = `---
id: FEAT-24
title: Plan storage architecture
kind: feat
status: in-progress
idea: IDEA-20
agent: opencode
created: 2026-06-28
tags: [core, cli]
---
Description and rationale.

### Phases
- [x] Design per-file schema
- [ ] Build frontmatter parser

### Log
- 2026-06-28: Initial design drafted
`;
    const { entries, warnings } = parsePlanFile(content);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.id).toBe('FEAT-24');
    expect(entry.title).toBe('Plan storage architecture');
    expect(entry.kind).toBe('feat');
    expect(entry.status).toBe('in-progress');
    expect(entry.idea).toBe('IDEA-20');
    expect(entry.agent).toBe('opencode');
    expect(entry.created).toBe('2026-06-28');
    expect(entry.tags).toEqual(['core', 'cli']);
    expect(entry.body).toBe('Description and rationale.');
    expect(entry.phases).toHaveLength(2);
    expect(entry.phases[0]).toEqual({ done: true, text: 'Design per-file schema' });
    expect(entry.phases[1]).toEqual({ done: false, text: 'Build frontmatter parser' });
    expect(entry.log).toHaveLength(1);
    expect(entry.log![0]).toEqual({ date: '2026-06-28', text: 'Initial design drafted' });
  });

  it('returns warnings when frontmatter is missing', () => {
    const content = 'Just a body without frontmatter.';
    const { entries, warnings } = parsePlanFile(content);
    expect(entries).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('returns warnings on invalid frontmatter', () => {
    const content = `---
id: FEAT-24
title: Test plan
kind: feat
status: not-a-status
created: 2026-06-28
---
body`;
    const { entries, warnings } = parsePlanFile(content);
    expect(entries).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  it('parses a plan with no phases or log', () => {
    const content = `---
id: FEAT-1
title: Minimal plan
kind: fix
status: done
created: 2026-06-01
---
Simple body text.
`;
    const { entries, warnings } = parsePlanFile(content);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('FEAT-1');
    expect(entries[0].phases).toEqual([]);
    expect(entries[0].log).toEqual([]);
  });

  it('parses a plan with tags as array', () => {
    const content = `---
id: FEAT-5
title: Tagged plan
kind: feat
status: planned
created: 2026-06-15
tags: [app, settings]
---
Body.
`;
    const { entries } = parsePlanFile(content);
    expect(entries[0].tags).toEqual(['app', 'settings']);
  });

  it('defaults tags to empty array when absent', () => {
    const content = `---
id: FEAT-5
title: Untagged plan
kind: feat
status: planned
created: 2026-06-15
---
Body.
`;
    const { entries } = parsePlanFile(content);
    expect(entries[0].tags).toEqual([]);
  });
});

describe('parseIdeaFile', () => {
  it('parses a valid idea file', () => {
    const content = `---
id: IDEA-20
title: Plan storage architecture
---
Full prose body with rationale.
`;
    const { entries, warnings } = parseIdeaFile(content);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('IDEA-20');
    expect(entries[0].title).toBe('Plan storage architecture');
    expect(entries[0].body).toBe('Full prose body with rationale.');
  });

  it('parses an idea with no body', () => {
    const content = `---
id: IDEA-1
title: Minimal idea
---`;
    const { entries, warnings } = parseIdeaFile(content);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('IDEA-1');
    expect(entries[0].body).toBe('');
  });

  it('returns warnings when frontmatter is missing', () => {
    const content = 'Some prose without frontmatter.';
    const { entries, warnings } = parseIdeaFile(content);
    expect(entries).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('carries an explicit frontmatter status through for notes', () => {
    const content = `---
id: IDEA-37
title: Fable capability-window tasks
kind: note
status: done
---
Closed without a plan.
`;
    const { entries, warnings } = parseIdeaFile(content);
    expect(warnings).toEqual([]);
    expect(entries[0].kind).toBe('note');
    expect(entries[0].status).toBe('done');
  });

  it('rejects a status on a plan-bearing idea', () => {
    const content = `---
id: IDEA-1
title: Some idea
status: done
---
`;
    const { entries, warnings } = parseIdeaFile(content);
    expect(entries).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('status is only valid on ideas with kind: note');
  });

  it('leaves status undefined when frontmatter has none', () => {
    const content = `---
id: IDEA-20
title: Plan storage architecture
---
Body.
`;
    const { entries } = parseIdeaFile(content);
    expect(entries[0].status).toBeUndefined();
  });

  it('parses a Log section and strips it from the body', () => {
    const content = `---
id: IDEA-20
title: Plan storage architecture
---
## IDEA-20: Plan storage architecture

Original prose, untouched.

### Log
- 2026-07-01: Explored the storage layer and found the relevant files
- 2026-07-02: Sharpened the approach after a second pass
`;
    const { entries, warnings } = parseIdeaFile(content);
    expect(warnings).toEqual([]);
    expect(entries[0].body).toBe(
      '## IDEA-20: Plan storage architecture\n\nOriginal prose, untouched.',
    );
    expect(entries[0].log).toEqual([
      { date: '2026-07-01', text: 'Explored the storage layer and found the relevant files' },
      { date: '2026-07-02', text: 'Sharpened the approach after a second pass' },
    ]);
  });
});

describe('formatPlanFile round-trip', () => {
  it('round-trips a full plan through parsePlanFile -> formatPlanFile -> parsePlanFile', () => {
    const input = {
      id: 'FEAT-24',
      title: 'Plan storage architecture',
      kind: 'feat' as const,
      status: 'in-progress' as const,
      idea: 'IDEA-20',
      agent: 'opencode' as const,
      created: '2026-06-28',
      tags: ['core', 'cli'],
      body: 'Description and rationale.',
      phases: [
        { done: true, text: 'Design per-file schema' },
        { done: false, text: 'Build frontmatter parser' },
      ],
      log: [{ date: '2026-06-28', text: 'Initial design drafted' }],
    };

    const serialized = formatPlanFile(input);
    const { entries, warnings } = parsePlanFile(serialized);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(input.id);
    expect(entries[0].title).toBe(input.title);
    expect(entries[0].kind).toBe(input.kind);
    expect(entries[0].status).toBe(input.status);
    expect(entries[0].idea).toBe(input.idea);
    expect(entries[0].agent).toBe(input.agent);
    expect(entries[0].created).toBe(input.created);
    expect(entries[0].tags).toEqual(input.tags);
    expect(entries[0].body).toBe(input.body);
    expect(entries[0].phases).toEqual(input.phases);
    expect(entries[0].log).toEqual(input.log);
  });

  it('round-trips a plan with no optional fields', () => {
    const input = {
      id: 'FEAT-1',
      title: 'Minimal plan',
      kind: 'fix' as const,
      status: 'done' as const,
      created: '2026-06-01',
      body: 'Simple body.',
    };

    const serialized = formatPlanFile(input);
    const { entries } = parsePlanFile(serialized);
    expect(entries[0].id).toBe('FEAT-1');
    expect(entries[0].tags).toEqual([]);
  });

  it('round-trips phase descriptions', () => {
    const input = {
      id: 'FEAT-5',
      title: 'Phase descriptions plan',
      kind: 'feat' as const,
      status: 'in-progress' as const,
      created: '2026-06-15',
      phases: [
        {
          done: false,
          text: 'Write tests',
          description: 'Cover the happy path and error cases.',
        },
      ],
    };

    const serialized = formatPlanFile(input);
    const { entries } = parsePlanFile(serialized);
    expect(entries[0].phases).toEqual([
      { done: false, text: 'Write tests', description: 'Cover the happy path and error cases.' },
    ]);
  });

  it('round-trips phase with [review] source', () => {
    const input = {
      id: 'FEAT-24',
      title: 'Review-source phase plan',
      kind: 'feat' as const,
      status: 'in-progress' as const,
      created: '2026-06-28',
      phases: [{ done: false, text: 'Fix review findings', source: 'review' as const }],
    };

    const serialized = formatPlanFile(input);
    const { entries } = parsePlanFile(serialized);
    expect(entries[0].phases).toEqual([
      { done: false, text: 'Fix review findings', source: 'review' },
    ]);
  });

  it('round-trips clarifications', () => {
    const input = {
      id: 'FEAT-30',
      title: 'Clarified plan',
      kind: 'feat' as const,
      status: 'in-progress' as const,
      created: '2026-06-30',
      body: 'Body.',
      clarifications: [
        { date: '2026-07-01', text: 'Only the dashboard is in scope' },
        { date: '2026-07-02', text: 'Ship behind a flag' },
      ],
      phases: [{ done: false, text: 'Do the work' }],
    };

    const serialized = formatPlanFile(input);
    const { entries, warnings } = parsePlanFile(serialized);
    expect(warnings).toEqual([]);
    expect(entries[0].clarifications).toEqual(input.clarifications);
    expect(entries[0].body).toBe('Body.');
    expect(entries[0].phases).toEqual(input.phases);
  });

  it('round-trips the audited field', () => {
    const input = {
      id: 'FEAT-25',
      title: 'Batch plan freshness audit',
      kind: 'feat' as const,
      status: 'in-progress' as const,
      created: '2026-06-30',
      audited: '2026-07-01',
    };

    const serialized = formatPlanFile(input);
    const { entries, warnings } = parsePlanFile(serialized);
    expect(warnings).toEqual([]);
    expect(entries[0].audited).toBe('2026-07-01');
  });

  it('omits audited from frontmatter when not set', () => {
    const input = {
      id: 'FEAT-1',
      title: 'No audit yet',
      kind: 'feat' as const,
      status: 'planned' as const,
      created: '2026-06-01',
    };

    const serialized = formatPlanFile(input);
    expect(serialized).not.toContain('audited');
    const { entries } = parsePlanFile(serialized);
    expect(entries[0].audited).toBeUndefined();
  });
});

describe('formatIdeaFile round-trip', () => {
  it('round-trips an idea through formatIdeaFile -> parseIdeaFile', () => {
    const serialized = formatIdeaFile({
      id: 'IDEA-20',
      title: 'Plan storage architecture',
      body: 'Full rationale body.',
    });
    const { entries } = parseIdeaFile(serialized);
    expect(entries[0].id).toBe('IDEA-20');
    expect(entries[0].title).toBe('Plan storage architecture');
    expect(entries[0].body).toBe('## IDEA-20: Plan storage architecture\n\nFull rationale body.');
  });

  it('round-trips an idea with no body', () => {
    const serialized = formatIdeaFile({
      id: 'IDEA-1',
      title: 'Minimal idea',
    });
    const { entries } = parseIdeaFile(serialized);
    expect(entries[0].id).toBe('IDEA-1');
    expect(entries[0].body).toBe('## IDEA-1: Minimal idea');
  });

  it('round-trips an idea with Log entries, leaving the body untouched', () => {
    const serialized = formatIdeaFile({
      id: 'IDEA-20',
      title: 'Plan storage architecture',
      body: 'Full rationale body.',
      log: [
        { date: '2026-07-01', text: 'Extended with findings from the codebase' },
        { date: '2026-07-02', text: 'A second extend pass' },
      ],
    });
    const { entries, warnings } = parseIdeaFile(serialized);
    expect(warnings).toEqual([]);
    expect(entries[0].body).toBe('## IDEA-20: Plan storage architecture\n\nFull rationale body.');
    expect(entries[0].log).toEqual([
      { date: '2026-07-01', text: 'Extended with findings from the codebase' },
      { date: '2026-07-02', text: 'A second extend pass' },
    ]);
  });
});
