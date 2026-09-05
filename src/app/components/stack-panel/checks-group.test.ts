import type { DoctorFindingSummary } from '@/core/doctor';
import type { AgentTaskState, ConsistencyIssue, DeskCheckState } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { activeCheckFix, firstFailingCheck } from './checks-group';

const task = (overrides: Partial<AgentTaskState>): AgentTaskState =>
  ({
    id: 't1',
    taskKind: 'issue-fix',
    status: 'running',
    issueId: 'check:lint',
    ...overrides,
  }) as AgentTaskState;

describe('activeCheckFix', () => {
  it('is null with no issue-fix task in flight', () => {
    expect(activeCheckFix([], 'check:lint')).toBeNull();
    expect(activeCheckFix([task({ status: 'done' })], 'check:lint')).toBeNull();
    expect(activeCheckFix([task({ taskKind: 'phase' })], 'check:lint')).toBeNull();
  });

  it('reports the fix for this check as own', () => {
    expect(activeCheckFix([task({})], 'check:lint')).toBe('own');
  });

  it('reports a fix for a different issue as other', () => {
    expect(activeCheckFix([task({ issueId: 'check:test' })], 'check:lint')).toBe('other');
  });
});

const check = (overrides: Partial<DeskCheckState> = {}): DeskCheckState => ({
  name: 'lint',
  cmd: 'pnpm lint',
  status: 'pass',
  lastRun: null,
  output: '',
  ...overrides,
});

const cleanDoctor: DoctorFindingSummary = { findings: [], errorCount: 0, warningCount: 0 };

const docsIssue: ConsistencyIssue = {
  kind: 'title-style',
  section: 'plans',
  title: 'IDEA-1',
  message: 'Title style — 44 chars over the 40-char limit',
};

describe('firstFailingCheck', () => {
  it('is null when every check, doctor, and docs pass', () => {
    expect(firstFailingCheck([check()], cleanDoctor, [])).toBeNull();
  });

  it('prefers a failing desk check and carries its command and output', () => {
    const failing = firstFailingCheck(
      [check({ status: 'fail', output: 'error: unused var' })],
      cleanDoctor,
      [docsIssue],
    );
    expect(failing?.id).toBe('check:lint');
    expect(failing?.reason).toContain('pnpm lint');
    expect(failing?.output).toBe('error: unused var');
  });

  it('reports doctor errors as a failing check with the findings as output', () => {
    const doctor: DoctorFindingSummary = {
      findings: [
        { file: 'papercamp/ideas/IDEA-1.md', line: 3, message: 'bad id', severity: 'error' },
        { file: 'papercamp/ideas/IDEA-2.md', line: 1, message: 'note', severity: 'warning' },
      ] as DoctorFindingSummary['findings'],
      errorCount: 1,
      warningCount: 1,
    };
    const failing = firstFailingCheck([check()], doctor, []);
    expect(failing?.id).toBe('check:doctor');
    expect(failing?.output).toBe('papercamp/ideas/IDEA-1.md:3 — bad id');
  });

  it('reports docs findings as a failing check', () => {
    const failing = firstFailingCheck([check()], cleanDoctor, [docsIssue]);
    expect(failing?.id).toBe('check:docs');
    expect(failing?.sourceKey).toBe('docs');
    expect(failing?.output).toBe(docsIssue.message);
  });
});
