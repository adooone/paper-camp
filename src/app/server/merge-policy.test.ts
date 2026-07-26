import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getMergePolicy } from './merge-policy';

const originalPath = process.env.PATH;
const roots: string[] = [];

/** Prepends a fake executable named `name` running `script` onto PATH. */
function installBin(name: string, script: string): void {
  const dir = mkdtempSync(join(tmpdir(), `papercamp-mergepolicy-bin-${name}-`));
  writeFileSync(join(dir, name), `#!/bin/sh\n${script}\n`);
  chmodSync(join(dir, name), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-mergepolicy-root-'));
  roots.push(root);
});

afterEach(async () => {
  process.env.PATH = originalPath;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('getMergePolicy', () => {
  it('reports unavailable when gh is not on PATH', async () => {
    process.env.PATH = '/nonexistent';
    const result = await getMergePolicy(roots[0]);
    expect(result.status).toBe('unavailable');
  }, 15000);

  it('reports unavailable when gh cannot resolve the repo (unauthenticated/no origin)', async () => {
    installBin('gh', 'exit 1');
    const result = await getMergePolicy(roots[0]);
    expect(result.status).toBe('unavailable');
  }, 15000);

  it('reports unavailable when the repos/{owner}/{repo} call fails', async () => {
    installBin(
      'gh',
      [
        'if [ "$1" = "repo" ]; then echo \'{"nameWithOwner":"acme/widgets"}\'; exit 0; fi',
        'exit 1',
      ].join('\n'),
    );
    const result = await getMergePolicy(roots[0]);
    expect(result.status).toBe('unavailable');
  }, 15000);

  it('reports ok with the five merge fields when gh succeeds', async () => {
    installBin(
      'gh',
      [
        'if [ "$1" = "repo" ]; then echo \'{"nameWithOwner":"acme/widgets"}\'; exit 0; fi',
        'if [ "$1" = "api" ]; then echo \'{"allow_squash_merge":true,"allow_merge_commit":false,"allow_rebase_merge":true,"squash_merge_commit_title":"COMMIT_OR_PR_TITLE","squash_merge_commit_message":"COMMIT_MESSAGES"}\'; exit 0; fi',
        'exit 1',
      ].join('\n'),
    );
    const result = await getMergePolicy(roots[0]);
    expect(result).toEqual({
      status: 'ok',
      repo: 'acme/widgets',
      policy: {
        allowSquashMerge: true,
        allowMergeCommit: false,
        allowRebaseMerge: true,
        squashMergeCommitTitle: 'COMMIT_OR_PR_TITLE',
        squashMergeCommitMessage: 'COMMIT_MESSAGES',
      },
    });
  }, 15000);
});
