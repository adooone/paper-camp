import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearPrCache, resolvePrMerged } from './pr';

/** Puts a fake `gh` on PATH that answers from `script` and counts invocations
 * (via a call-count file), so tests don't shell out to the real GitHub CLI. */
function installFakeGh(script: string): { root: string; callCount: () => number } {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-pr-test-'));
  const countFile = join(root, 'calls');
  writeFileSync(countFile, '0');
  writeFileSync(
    join(root, 'gh'),
    `#!/bin/sh\nn=$(cat "${countFile}")\necho $((n + 1)) > "${countFile}"\n${script}\n`,
  );
  chmodSync(join(root, 'gh'), 0o755);
  return { root, callCount: () => Number.parseInt(readFileSync(countFile, 'utf-8').trim(), 10) };
}

describe('resolvePrMerged', () => {
  const originalPath = process.env.PATH;

  beforeEach(() => {
    clearPrCache();
  });

  afterEach(() => {
    process.env.PATH = originalPath;
  });

  it('resolves true when gh reports a merged PR', async () => {
    const { root } = installFakeGh(`echo '[{"state":"MERGED"}]'`);
    process.env.PATH = `${root}:${originalPath}`;
    expect(await resolvePrMerged(root, 'feat/idea-1-thing')).toBe(true);
  });

  it('resolves false when gh finds no matching PR', async () => {
    const { root } = installFakeGh(`echo '[]'`);
    process.env.PATH = `${root}:${originalPath}`;
    expect(await resolvePrMerged(root, 'feat/idea-1-thing')).toBe(false);
  });

  it('resolves false for an open (unmerged) PR', async () => {
    const { root } = installFakeGh(`echo '[{"state":"OPEN"}]'`);
    process.env.PATH = `${root}:${originalPath}`;
    expect(await resolvePrMerged(root, 'feat/idea-1-thing')).toBe(false);
  });

  it('resolves undefined when gh exits non-zero (unauthenticated, offline, ...)', async () => {
    const { root } = installFakeGh(`echo 'boom' >&2\nexit 1`);
    process.env.PATH = `${root}:${originalPath}`;
    expect(await resolvePrMerged(root, 'feat/idea-1-thing')).toBeUndefined();
  });

  it('resolves undefined when gh returns unparseable output', async () => {
    const { root } = installFakeGh(`echo 'not json'`);
    process.env.PATH = `${root}:${originalPath}`;
    expect(await resolvePrMerged(root, 'feat/idea-1-thing')).toBeUndefined();
  });

  it('caches within the TTL, only re-invoking gh after it elapses', async () => {
    const { root, callCount } = installFakeGh(`echo '[{"state":"MERGED"}]'`);
    process.env.PATH = `${root}:${originalPath}`;
    await resolvePrMerged(root, 'feat/idea-2-thing', 1000 * 60);
    await resolvePrMerged(root, 'feat/idea-2-thing', 1000 * 60);
    expect(callCount()).toBe(1);

    await resolvePrMerged(root, 'feat/idea-2-thing', 0);
    expect(callCount()).toBe(2);
  });
});
