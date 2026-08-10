import { describe, expect, it } from 'vitest';
import type { PaperCampConfig } from '../../../types/index';
import type { DoctorContext, DoctorEntityFile } from '../doctor';
import { metadataChecks } from './metadata';

function run(files: DoctorEntityFile[], config: PaperCampConfig | null = null) {
  const context: DoctorContext = { files, config };
  return metadataChecks.flatMap((check) => check(context));
}

function file(
  id: string,
  frontmatter: Record<string, unknown>,
  archived = false,
): DoctorEntityFile {
  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return {
    id,
    path: `papercamp/ideas${archived ? '/archive' : ''}/${id}.md`,
    content: `---\n${yaml}\n---\n\nBody.\n`,
    archived,
  };
}

const valid = (id: string, over: Record<string, unknown> = {}, archived = false) =>
  file(id, { id, title: 'A title', status: 'idea', created: '2026-01-01', ...over }, archived);

describe('metadata checks', () => {
  it('passes a well-formed corpus', () => {
    const findings = run([valid('IDEA-1'), valid('IDEA-2')], {
      nextId: { idea: 3 },
    } as PaperCampConfig);
    expect(findings).toEqual([]);
  });

  it('flags a frontmatter schema violation', () => {
    const findings = run([valid('IDEA-1', { created: 'nope' })]);
    const f = findings.find((x) => x.rule === 'frontmatter-schema');
    expect(f).toBeDefined();
    expect(f?.message).toContain('created');
  });

  it('flags missing frontmatter at line 1', () => {
    const findings = run([
      {
        id: 'IDEA-1',
        path: 'papercamp/ideas/IDEA-1.md',
        content: 'no frontmatter',
        archived: false,
      },
    ]);
    expect(findings).toContainEqual(
      expect.objectContaining({
        rule: 'frontmatter-schema',
        line: 1,
        message: 'missing YAML frontmatter block',
      }),
    );
  });

  it('flags a filename/id mismatch', () => {
    const findings = run([valid('IDEA-9', { id: 'IDEA-7' })]);
    const f = findings.find((x) => x.rule === 'filename-id-mismatch');
    expect(f?.message).toContain('IDEA-7');
    expect(f?.message).toContain('IDEA-9.md');
  });

  it('flags duplicate ids across ideas and archive', () => {
    const findings = run([valid('IDEA-1'), valid('IDEA-1', {}, true)]).filter(
      (x) => x.rule === 'duplicate-id',
    );
    expect(findings).toHaveLength(2);
    expect(findings[0].message).toContain('2 files');
  });

  it('flags an id at or beyond the config counter', () => {
    const findings = run([valid('IDEA-5')], { nextId: { idea: 5 } } as PaperCampConfig).filter(
      (x) => x.rule === 'id-counter-stale',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('nextId.idea (5)');
  });

  it('does not flag the counter when config has no idea counter', () => {
    const findings = run([valid('IDEA-99')], {} as PaperCampConfig).filter(
      (x) => x.rule === 'id-counter-stale',
    );
    expect(findings).toEqual([]);
  });
});
