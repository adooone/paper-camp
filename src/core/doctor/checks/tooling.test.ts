import { describe, expect, it } from 'vitest';
import type { DoctorContext } from '../doctor';
import { toolingChecks } from './tooling';

function run(hasPermissionsAllow?: boolean) {
  const context: DoctorContext = { files: [], config: null, hasPermissionsAllow };
  return toolingChecks.flatMap((check) => check(context));
}

describe('missing-permissions-allow', () => {
  it('warns when the project has no permissions.allow list', () => {
    const findings = run(false);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: '.claude/settings.json',
      rule: 'missing-permissions-allow',
    });
    expect(findings[0].message).toContain('init --settings');
  });

  it('is silent when the project has a permissions.allow list', () => {
    expect(run(true)).toEqual([]);
  });

  it('is silent when the context does not report on permissions.allow at all', () => {
    expect(run(undefined)).toEqual([]);
  });
});

function runDraftPr(
  draftPr: boolean | undefined,
  draftPrWorkflowContent?: string | null,
  pullRequestTemplateContent?: string | null,
) {
  const context: DoctorContext = {
    files: [],
    config: {
      nextId: { idea: 1 },
      defaultAgents: { phase: { agent: 'claude-code' } },
      desk: draftPr === undefined ? undefined : { ci: { repo: 'a/b', draftPr } },
    } as never,
    draftPrWorkflowContent,
    pullRequestTemplateContent,
  };
  return toolingChecks.flatMap((check) => check(context));
}

describe('draft-pr-template-outdated / draft-pr-template-unmanaged', () => {
  it('is silent when the setting is off', () => {
    expect(runDraftPr(false, null, null)).toEqual([]);
  });

  it('is silent when the setting is unset', () => {
    expect(runDraftPr(undefined, null, null)).toEqual([]);
  });

  it('warns when a file is missing while the setting is on', () => {
    const findings = runDraftPr(true, null, '<!-- paper-camp draft-pr template v1 -->\nbody');
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: '.github/workflows/draft-pr.yml',
      rule: 'draft-pr-template-outdated',
    });
  });

  it('warns when a file carries an older template version', () => {
    const findings = runDraftPr(
      true,
      '# paper-camp draft-pr template v0\nname: Draft PR',
      '<!-- paper-camp draft-pr template v1 -->\nbody',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: '.github/workflows/draft-pr.yml',
      rule: 'draft-pr-template-outdated',
    });
  });

  it('warns without offering a fix when a file has no template header', () => {
    const findings = runDraftPr(
      true,
      'name: Draft PR\non: push',
      '<!-- paper-camp draft-pr template v1 -->\nbody',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: '.github/workflows/draft-pr.yml',
      rule: 'draft-pr-template-unmanaged',
    });
  });

  it('is silent when both files carry the current template version', () => {
    expect(
      runDraftPr(
        true,
        '# paper-camp draft-pr template v1\nname: Draft PR',
        '<!-- paper-camp draft-pr template v1 -->\nbody',
      ),
    ).toEqual([]);
  });
});
