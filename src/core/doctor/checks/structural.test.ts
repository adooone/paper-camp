import { describe, expect, it } from 'vitest';
import type { DoctorContext, DoctorEntityFile } from '../doctor';
import { structuralChecks } from './structural';

function run(files: DoctorEntityFile[]) {
  const context: DoctorContext = { files, config: null };
  return structuralChecks.flatMap((check) => check(context));
}

function file(id: string, body: string, over: Partial<DoctorEntityFile> = {}): DoctorEntityFile {
  return {
    id,
    path: `papercamp/ideas/${id}.md`,
    content: `---\nid: ${id}\ntitle: A title\nstatus: idea\ncreated: 2026-01-01\n---\n\n${body}\n`,
    archived: false,
    ...over,
  };
}

describe('phases-list-split', () => {
  it('accepts phases inside the Phases section', () => {
    const findings = run([file('IDEA-1', '### Phases\n- [x] Phase 1\n- [ ] Phase 2\n')]);
    expect(findings.filter((f) => f.rule === 'phases-list-split')).toEqual([]);
  });

  it('flags a phase orphaned under a Log section', () => {
    const body =
      '### Phases\n- [x] Phase 1\n\n### Log\n- [ ] Phase 2\n- 2026-01-02: a real log line\n';
    const findings = run([file('IDEA-1', body)]).filter((f) => f.rule === 'phases-list-split');
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('Phase 2');
  });

  it('does not mistake thread or note checkboxes for orphaned phases', () => {
    const body =
      '### Notes\n- [ ] [phase:1] a margin note\n\n### Thread\n- [x] 2026-01-02 [log] a log message\n';
    expect(run([file('IDEA-1', body)]).filter((f) => f.rule === 'phases-list-split')).toEqual([]);
  });
});

describe('note-has-phases', () => {
  it('flags a note that carries a Phases section', () => {
    const content =
      '---\nid: IDEA-1\ntitle: A note\nkind: note\nstatus: open\ncreated: 2026-01-01\n---\n\n### Phases\n- [ ] Phase 1\n';
    const findings = run([file('IDEA-1', '', { content })]).filter(
      (f) => f.rule === 'note-has-phases',
    );
    expect(findings).toHaveLength(1);
  });
});

describe('duplicate-phases-section', () => {
  it('accepts a single Phases section', () => {
    const findings = run([file('IDEA-1', '### Phases\n- [ ] Phase 1\n')]).filter(
      (f) => f.rule === 'duplicate-phases-section',
    );
    expect(findings).toEqual([]);
  });

  it('flags a second Phases heading', () => {
    const body = '### Phases\n- [ ] Phase 1\n\n### Phases\n- [ ] Redrafted phase\n';
    const findings = run([file('IDEA-1', body)]).filter(
      (f) => f.rule === 'duplicate-phases-section',
    );
    expect(findings).toHaveLength(1);
  });
});

describe('no-agent-phase', () => {
  it('flags a planned idea whose only phase is [manual]', () => {
    const content =
      '---\nid: IDEA-1\ntitle: X\ntype: feat\nstatus: planned\ncreated: 2026-01-01\n---\n\n### Phases\n- [ ] [manual] Compare on a phone\n';
    const findings = run([file('IDEA-1', '', { content })]).filter(
      (f) => f.rule === 'no-agent-phase',
    );
    expect(findings).toHaveLength(1);
  });

  it('flags an in-progress idea with no Phases section at all', () => {
    const content =
      '---\nid: IDEA-1\ntitle: X\ntype: feat\nstatus: in-progress\ncreated: 2026-01-01\n---\n\nBody.\n';
    const findings = run([file('IDEA-1', '', { content })]).filter(
      (f) => f.rule === 'no-agent-phase',
    );
    expect(findings).toHaveLength(1);
  });

  it('accepts a planned idea with at least one agent phase alongside a manual one', () => {
    const content =
      '---\nid: IDEA-1\ntitle: X\ntype: feat\nstatus: planned\ncreated: 2026-01-01\n---\n\n### Phases\n- [ ] Build the thing\n- [ ] [manual] Compare on a phone\n';
    expect(
      run([file('IDEA-1', '', { content })]).filter((f) => f.rule === 'no-agent-phase'),
    ).toEqual([]);
  });

  it('leaves a bare idea (not yet planned) alone', () => {
    const findings = run([file('IDEA-1', '')]).filter((f) => f.rule === 'no-agent-phase');
    expect(findings).toEqual([]);
  });

  it('leaves a note alone', () => {
    const content =
      '---\nid: IDEA-1\ntitle: X\nkind: note\nstatus: open\ncreated: 2026-01-01\n---\n\nBody.\n';
    expect(
      run([file('IDEA-1', '', { content })]).filter((f) => f.rule === 'no-agent-phase'),
    ).toEqual([]);
  });
});

describe('archive-placement', () => {
  it('flags a closed entity still under ideas/', () => {
    const content =
      '---\nid: IDEA-1\ntitle: X\ntype: feat\nstatus: dropped\ncreated: 2026-01-01\n---\n\nBody.\n';
    const findings = run([file('IDEA-1', '', { content })]).filter(
      (f) => f.rule === 'archive-placement',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('should be archived');
  });

  it('flags an active entity under archive/', () => {
    const content =
      '---\nid: IDEA-1\ntitle: X\ntype: feat\nstatus: in-progress\ncreated: 2026-01-01\n---\n\nBody.\n';
    const findings = run([
      file('IDEA-1', '', { content, archived: true, path: 'papercamp/ideas/archive/IDEA-1.md' }),
    ]).filter((f) => f.rule === 'archive-placement');
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('archive/');
  });

  it('leaves a correctly-placed done entity alone', () => {
    const content =
      '---\nid: IDEA-1\ntitle: X\ntype: feat\nstatus: done\ncreated: 2026-01-01\n---\n\nBody.\n';
    expect(
      run([
        file('IDEA-1', '', { content, archived: true, path: 'papercamp/ideas/archive/IDEA-1.md' }),
      ]).filter((f) => f.rule === 'archive-placement'),
    ).toEqual([]);
  });
});

describe('dangling-link', () => {
  it('flags a wikilink to an id no entity defines', () => {
    const findings = run([
      file('IDEA-1', 'See [[IDEA-999]] for context.'),
      file('IDEA-2', 'Nothing here.'),
    ]).filter((f) => f.rule === 'dangling-link');
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('IDEA-999');
  });

  it('accepts a wikilink to an existing entity', () => {
    const findings = run([
      file('IDEA-1', 'Related to [[IDEA-2]].'),
      file('IDEA-2', 'Body.'),
    ]).filter((f) => f.rule === 'dangling-link');
    expect(findings).toEqual([]);
  });
});
