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
