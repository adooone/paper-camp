import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assignEntityId, formatEntityFile } from '../serialize/serializer';
import { parseEntityFile } from './parser';

describe('parseEntityFile', () => {
  it('parses a full entity with phases, log, and clarifications', () => {
    const content = `---
id: IDEA-45
title: Single-file entities
type: feat
status: in-progress
created: 2026-07-05
updated: 2026-07-05
tags:
  - core
  - ideas
---

Rationale prose.

### Clarifications
- 2026-07-05: scope confirmed

### Phases
- [x] First phase
      With a description line.
- [ ] Second phase

### Log
- 2026-07-05: drafted
`;
    const { entries, warnings } = parseEntityFile(content);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.id).toBe('IDEA-45');
    expect(e.type).toBe('feat');
    expect(e.status).toBe('in-progress');
    expect(e.body).toBe('Rationale prose.');
    expect(e.phases).toHaveLength(2);
    expect(e.phases[0].done).toBe(true);
    expect(e.phases[0].description).toBe('With a description line.');
    expect(e.log).toEqual([{ date: '2026-07-05', text: 'drafted' }]);
    expect(e.clarifications).toEqual([{ date: '2026-07-05', text: 'scope confirmed' }]);
  });

  it('parses a subject key when present', () => {
    const content = `---
id: IDEA-47
title: Has a subject
status: idea
created: 2026-07-05
subject: Onboarding
---
Prose.
`;
    const { entries, warnings } = parseEntityFile(content);
    expect(warnings).toEqual([]);
    expect(entries[0].subject).toBe('Onboarding');
  });

  it('leaves subject undefined when the key is absent (virtual "No subject")', () => {
    const content = `---
id: IDEA-48
title: No subject
status: idea
created: 2026-07-05
---
Prose.
`;
    const { entries, warnings } = parseEntityFile(content);
    expect(warnings).toEqual([]);
    expect(entries[0].subject).toBeUndefined();
  });

  it('parses an order key when present', () => {
    const content = `---
id: IDEA-49
title: Has an order
status: idea
created: 2026-07-05
order: 3
---
Prose.
`;
    const { entries, warnings } = parseEntityFile(content);
    expect(warnings).toEqual([]);
    expect(entries[0].order).toBe(3);
  });

  it('leaves order undefined when the key is absent (unordered)', () => {
    const content = `---
id: IDEA-50
title: No order
status: idea
created: 2026-07-05
---
Prose.
`;
    const { entries, warnings } = parseEntityFile(content);
    expect(warnings).toEqual([]);
    expect(entries[0].order).toBeUndefined();
  });

  it('parses a phaseless idea-status entity (the pre-plan state)', () => {
    const content = `---
id: IDEA-46
title: A fresh thought
status: idea
created: 2026-07-05
---
Just prose, no plan yet.
`;
    const { entries, warnings } = parseEntityFile(content);
    expect(warnings).toEqual([]);
    expect(entries[0].status).toBe('idea');
    expect(entries[0].type).toBeUndefined();
    expect(entries[0].phases).toEqual([]);
  });

  it('parses a note with a note status', () => {
    const content = `---
id: IDEA-37
title: Fable capability-window tasks
kind: note
status: done
created: 2026-07-02
---
Usage pattern, no plan needed.
`;
    const { entries, warnings } = parseEntityFile(content);
    expect(warnings).toEqual([]);
    expect(entries[0].kind).toBe('note');
    expect(entries[0].status).toBe('done');
  });

  it('rejects a plan-track status on a note', () => {
    const content = `---
id: IDEA-1
title: Bad note
kind: note
status: in-progress
created: 2026-07-05
---
`;
    const { entries, warnings } = parseEntityFile(content);
    expect(entries).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('rejects status open on a non-note', () => {
    const content = `---
id: IDEA-2
title: Bad idea
status: open
created: 2026-07-05
---
`;
    const { entries, warnings } = parseEntityFile(content);
    expect(entries).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('warns when a note carries phases but keeps the entry', () => {
    const content = `---
id: IDEA-3
title: Note with phases
kind: note
status: open
created: 2026-07-05
---
Body.

### Phases
- [ ] Should not be here
`;
    const { entries, warnings } = parseEntityFile(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].phases).toHaveLength(1);
    expect(warnings.some((w) => w.message.includes('note entities must not carry'))).toBe(true);
  });
});

describe('formatEntityFile round-trip', () => {
  it('round-trips a full entity through formatEntityFile -> parseEntityFile', () => {
    const input = {
      id: 'IDEA-45',
      title: 'Single-file entities',
      type: 'feat',
      status: 'planned',
      created: '2026-07-05',
      updated: '2026-07-05',
      audited: '2026-07-05',
      auditedHash: 'abc123',
      tags: ['core', 'ideas'],
      subject: 'Core infra',
      order: 0,
      body: 'Rationale prose.',
      phases: [
        { text: 'First phase', done: true, description: 'Details.' },
        { text: 'Review-found phase', done: false, source: 'review' as const },
      ],
      log: [{ date: '2026-07-05', text: 'drafted' }],
      clarifications: [{ date: '2026-07-05', text: 'scope confirmed' }],
    };
    const serialized = formatEntityFile(input);
    const { entries, warnings } = parseEntityFile(serialized);
    expect(warnings).toEqual([]);
    const e = entries[0];
    expect(e.id).toBe(input.id);
    expect(e.type).toBe('feat');
    expect(e.status).toBe('planned');
    expect(e.auditedHash).toBe('abc123');
    expect(e.subject).toBe('Core infra');
    expect(e.order).toBe(0);
    expect(e.body).toBe(input.body);
    expect(e.phases).toHaveLength(2);
    expect(e.phases[1].source).toBe('review');
    expect(e.log).toEqual(input.log);
    expect(e.clarifications).toEqual(input.clarifications);
  });

  it('writes no body heading and omits absent optionals', () => {
    const serialized = formatEntityFile({
      id: 'IDEA-46',
      title: 'A fresh thought',
      status: 'idea',
      created: '2026-07-05',
      body: 'Just prose.',
    });
    expect(serialized).not.toContain('## IDEA-46');
    expect(serialized).not.toContain('type:');
    expect(serialized).not.toContain('kind:');
    expect(serialized).not.toContain('idea:');
    expect(serialized).not.toContain('subject:');
    expect(serialized).not.toContain('order:');
    const { entries } = parseEntityFile(serialized);
    expect(entries[0].body).toBe('Just prose.');
    expect(entries[0].subject).toBeUndefined();
    expect(entries[0].order).toBeUndefined();
  });
});

describe('assignEntityId', () => {
  it('mints sequential lifetime IDEA-N ids from the unified counter', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'entity-id-'));
    const configPath = join(dir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ nextId: { idea: 45 } }));

    expect(await assignEntityId(configPath)).toBe('IDEA-45');
    expect(await assignEntityId(configPath)).toBe('IDEA-46');
    expect(JSON.parse(readFileSync(configPath, 'utf-8')).nextId.idea).toBe(47);
  });
});
