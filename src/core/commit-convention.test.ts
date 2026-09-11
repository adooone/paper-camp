import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_COMMIT_CONVENTION,
  commitTitleViolation,
  readCommitConvention,
} from './commit-convention';

const strict = { types: ['feat', 'fix'], scopes: ['app', 'cli'], scopeRequired: true };

describe('commitTitleViolation', () => {
  it('accepts a title that matches the convention', () => {
    expect(commitTitleViolation('fix(app): Stage every file in one call', strict)).toBeNull();
  });

  it('names a type outside the enum', () => {
    expect(commitTitleViolation('test(app): add cases', strict)).toContain('type "test"');
  });

  it('names a missing scope when one is required, listing the choices', () => {
    expect(commitTitleViolation('fix: stage files', strict)).toContain('use one of app, cli');
  });

  it('names a scope outside the enum', () => {
    expect(commitTitleViolation('fix(git): stage files', strict)).toContain('scope "git"');
  });

  it('allows a bare type when no scope is required and no enum exists', () => {
    expect(commitTitleViolation('fix: stage files', DEFAULT_COMMIT_CONVENTION)).toBeNull();
  });

  it('rejects an empty subject and a trailing period', () => {
    expect(commitTitleViolation('fix(app):', strict)).toContain('empty');
    expect(commitTitleViolation('fix(app): done.', strict)).toContain('period');
  });
});

describe('readCommitConvention', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
    dirs.length = 0;
  });

  it('reads the type and scope enums and the scope requirement from .commitlintrc.json', async () => {
    const root = await mkdtemp(join(tmpdir(), 'paper-camp-commitlint-'));
    dirs.push(root);
    await writeFile(
      join(root, '.commitlintrc.json'),
      JSON.stringify({
        rules: {
          'type-enum': [2, 'always', ['feat', 'fix']],
          'scope-empty': [2, 'never'],
          'scope-enum': [2, 'always', ['app']],
        },
      }),
    );
    expect(await readCommitConvention(root)).toEqual({
      types: ['feat', 'fix'],
      scopes: ['app'],
      scopeRequired: true,
    });
  });

  it('falls back to the conventional defaults without the file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'paper-camp-commitlint-'));
    dirs.push(root);
    expect(await readCommitConvention(root)).toBe(DEFAULT_COMMIT_CONVENTION);
  });
});
