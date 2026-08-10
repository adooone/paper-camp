import { describe, expect, it } from 'vitest';
import type { DoctorContext, DoctorEntityFile } from './doctor';
import type { DoctorFinding } from './finding';
import { planDoctorFixes } from './fix';

function file(over: Partial<DoctorEntityFile>): DoctorEntityFile {
  return {
    id: 'IDEA-1',
    path: 'papercamp/ideas/IDEA-1.md',
    content: '',
    archived: false,
    ...over,
  };
}

function finding(over: Partial<DoctorFinding>): DoctorFinding {
  return {
    file: 'papercamp/ideas/IDEA-1.md',
    line: 5,
    rule: 'archive-placement',
    message: 'msg',
    ...over,
  };
}

describe('planDoctorFixes', () => {
  it('migrates a closed entity in ideas/ into archive/', () => {
    const context: DoctorContext = { files: [file({})], config: null };
    const plan = planDoctorFixes(context, [finding({})]);
    expect(plan.actions).toEqual([
      { kind: 'move', from: 'papercamp/ideas/IDEA-1.md', to: 'papercamp/ideas/archive/IDEA-1.md' },
    ]);
    expect(plan.fixed).toHaveLength(1);
    expect(plan.unfixable).toEqual([]);
  });

  it('migrates an active entity out of archive/ back into ideas/', () => {
    const archived = file({ path: 'papercamp/ideas/archive/IDEA-1.md', archived: true });
    const context: DoctorContext = { files: [archived], config: null };
    const plan = planDoctorFixes(context, [finding({ file: archived.path })]);
    expect(plan.actions).toEqual([
      { kind: 'move', from: 'papercamp/ideas/archive/IDEA-1.md', to: 'papercamp/ideas/IDEA-1.md' },
    ]);
  });

  it('leaves findings with no registered fixer for manual attention', () => {
    const context: DoctorContext = { files: [file({})], config: null };
    const plan = planDoctorFixes(context, [finding({ rule: 'frontmatter-schema' })]);
    expect(plan.actions).toEqual([]);
    expect(plan.fixed).toEqual([]);
    expect(plan.unfixable).toHaveLength(1);
  });
});
