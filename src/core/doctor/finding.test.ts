import { describe, expect, it } from 'vitest';
import type { DoctorFinding } from './finding';
import { reportFindings, sortFindings } from './finding';

const finding = (over: Partial<DoctorFinding>): DoctorFinding => ({
  file: 'papercamp/ideas/IDEA-1.md',
  line: 1,
  rule: 'frontmatter-schema',
  message: 'msg',
  ...over,
});

describe('reportFindings', () => {
  it('reports a clean corpus with no issues', () => {
    const report = reportFindings([]);
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.text).toBe('paper-camp doctor: no issues found.');
  });

  it('emits an addressable file:line rule severity line per finding', () => {
    const report = reportFindings([
      finding({
        file: 'papercamp/ideas/IDEA-2.md',
        line: 7,
        rule: 'dangling-link',
        message: '[[IDEA-999]]',
      }),
    ]);
    expect(report.text).toContain('papercamp/ideas/IDEA-2.md:7');
    expect(report.text).toContain('warning');
    expect(report.text).toContain('dangling-link');
    expect(report.text).toContain('[[IDEA-999]]');
  });

  it('counts errors and warnings by the rule severity', () => {
    const report = reportFindings([
      finding({ rule: 'frontmatter-schema' }),
      finding({ rule: 'phases-list-split', line: 12 }),
      finding({ rule: 'dangling-link', line: 20 }),
    ]);
    expect(report.errorCount).toBe(2);
    expect(report.warningCount).toBe(1);
    expect(report.text).toContain('paper-camp doctor: 2 error(s), 1 warning(s).');
  });
});

describe('sortFindings', () => {
  it('orders by file, then line, then severity', () => {
    const sorted = sortFindings([
      finding({ file: 'papercamp/ideas/IDEA-2.md', line: 3, rule: 'dangling-link' }),
      finding({ file: 'papercamp/ideas/IDEA-1.md', line: 9, rule: 'dangling-link' }),
      finding({ file: 'papercamp/ideas/IDEA-1.md', line: 9, rule: 'frontmatter-schema' }),
    ]);
    expect(sorted.map((f) => [f.file, f.line, f.rule])).toEqual([
      ['papercamp/ideas/IDEA-1.md', 9, 'frontmatter-schema'],
      ['papercamp/ideas/IDEA-1.md', 9, 'dangling-link'],
      ['papercamp/ideas/IDEA-2.md', 3, 'dangling-link'],
    ]);
  });
});
