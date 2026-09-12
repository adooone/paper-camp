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
