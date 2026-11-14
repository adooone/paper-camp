import { describe, expect, it } from 'vitest';
import type { DoctorContext } from '../doctor';
import { localStateChecks } from './local-state';

function run(localStateDrift?: DoctorContext['localStateDrift']) {
  const context: DoctorContext = { files: [], config: null, localStateDrift };
  return localStateChecks.flatMap((check) => check(context));
}

describe('local-state-tracked-outside-plan', () => {
  it('reports one finding per tracked file outside the plan', () => {
    const findings = run({
      trackedOutsidePlan: ['papercamp/capacity.json', 'papercamp/.local/tasks.log'],
      hasLocalGitignore: true,
      hasGitattributesBlock: true,
      hasGitignoreBlock: true,
    });
    expect(findings).toContainEqual(
      expect.objectContaining({
        file: 'papercamp/capacity.json',
        rule: 'local-state-tracked-outside-plan',
      }),
    );
    expect(findings).toContainEqual(
      expect.objectContaining({
        file: 'papercamp/.local/tasks.log',
        rule: 'local-state-tracked-outside-plan',
      }),
    );
  });

  it('is silent when nothing drifted outside the plan', () => {
    expect(
      run({
        trackedOutsidePlan: [],
        hasLocalGitignore: true,
        hasGitattributesBlock: true,
        hasGitignoreBlock: true,
      }),
    ).toEqual([]);
  });
});

describe('local-state-missing-local-gitignore', () => {
  it('warns when papercamp/.local/.gitignore is missing', () => {
    const findings = run({
      trackedOutsidePlan: [],
      hasLocalGitignore: false,
      hasGitattributesBlock: true,
      hasGitignoreBlock: true,
    });
    expect(findings).toContainEqual(
      expect.objectContaining({
        file: 'papercamp/.local/.gitignore',
        rule: 'local-state-missing-local-gitignore',
      }),
    );
  });
});

describe('local-state-missing-gitattributes-block', () => {
  it('warns when .gitattributes has no paper-camp block', () => {
    const findings = run({
      trackedOutsidePlan: [],
      hasLocalGitignore: true,
      hasGitattributesBlock: false,
      hasGitignoreBlock: true,
    });
    expect(findings).toContainEqual(
      expect.objectContaining({
        file: '.gitattributes',
        rule: 'local-state-missing-gitattributes-block',
      }),
    );
  });
});

describe('local-state-missing-gitignore-block', () => {
  it('warns when .gitignore has no paper-camp block for the legacy local-state paths', () => {
    const findings = run({
      trackedOutsidePlan: [],
      hasLocalGitignore: true,
      hasGitattributesBlock: true,
      hasGitignoreBlock: false,
    });
    expect(findings).toEqual([
      expect.objectContaining({ file: '.gitignore', rule: 'local-state-missing-gitignore-block' }),
    ]);
  });
});

describe('local-state checks with no drift data at all', () => {
  it('stays silent rather than treating undefined as drift', () => {
    expect(run(undefined)).toEqual([]);
  });
});

describe('stranded-stash', () => {
  function runStashes(strandedStashes: DoctorContext['strandedStashes']) {
    const context: DoctorContext = { files: [], config: null, strandedStashes };
    return localStateChecks.flatMap((check) => check(context));
  }

  it('names each stash with its date and the papercamp/ files it holds', () => {
    const findings = runStashes([
      {
        index: 0,
        sha: 'abc',
        message: 'papercamp-reconcile',
        date: '2026-11-04',
        papercampFiles: [
          { path: 'papercamp/config.json', source: 'abc', base: 'abc^1' },
          { path: 'papercamp/ideas/IDEA-323.md', source: 'abc^3', base: null },
        ],
        otherFiles: ['src/app.ts'],
      },
      {
        index: 1,
        sha: 'def',
        message: 'papercamp-sync',
        date: '2026-11-03',
        papercampFiles: [],
        otherFiles: [],
      },
    ]);
    expect(findings).toEqual([
      {
        file: 'stash@{0}',
        line: 1,
        rule: 'stranded-stash',
        message: expect.stringMatching(
          /^papercamp-reconcile from 2026-11-04 holds papercamp\/config\.json, papercamp\/ideas\/IDEA-323\.md, plus 1 file outside papercamp\//,
        ),
      },
      expect.objectContaining({
        file: 'stash@{1}',
        rule: 'stranded-stash',
        message: expect.stringContaining('papercamp-sync from 2026-11-03'),
      }),
    ]);
  });

  it('is silent with no stranded stash', () => {
    expect(runStashes([])).toEqual([]);
  });
});
