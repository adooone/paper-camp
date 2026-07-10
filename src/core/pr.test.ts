import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearPrCache, resolvePrsByEntity } from './pr';

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

interface Row {
  number: number;
  url: string;
  state: string;
  isDraft: boolean;
  headRefName: string;
  body: string;
}
const row = (o: Partial<Row>): Row => ({
  number: 1,
  url: 'u',
  state: 'OPEN',
  isDraft: false,
  headRefName: '',
  body: '',
  ...o,
});

describe('resolvePrsByEntity', () => {
  const originalPath = process.env.PATH;
  beforeEach(() => clearPrCache());
  afterEach(() => {
    process.env.PATH = originalPath;
  });

  const withGh = (rows: Row[]) => {
    const { root, callCount } = installFakeGh(`echo '${JSON.stringify(rows)}'`);
    process.env.PATH = `${root}:${originalPath}`;
    return { root, callCount };
  };

  it('indexes PRs by the **Plan:** id in the body', async () => {
    const { root } = withGh([
      row({
        number: 7,
        url: 'x',
        state: 'MERGED',
        body: 'intro. **Plan:** `IDEA-56` for the plan.',
      }),
    ]);
    const prs = await resolvePrsByEntity(root);
    expect(prs?.get('IDEA-56')).toEqual({ number: 7, url: 'x', state: 'merged' });
  });

  it('falls back to the head branch id prefix when the body has no Plan line', async () => {
    const { root } = withGh([
      row({ number: 3, state: 'OPEN', isDraft: true, headRefName: 'feat/idea-12-some-title' }),
    ]);
    const prs = await resolvePrsByEntity(root);
    expect(prs?.get('IDEA-12')?.state).toBe('draft');
  });

  it('keeps the most-advanced PR when an entity has several', async () => {
    const { root } = withGh([
      row({ number: 1, state: 'CLOSED', body: '**Plan:** `IDEA-1`' }),
      row({ number: 2, state: 'MERGED', body: '**Plan:** `IDEA-1`' }),
      row({ number: 3, state: 'OPEN', body: '**Plan:** `IDEA-1`' }),
    ]);
    const prs = await resolvePrsByEntity(root);
    expect(prs?.get('IDEA-1')?.state).toBe('merged');
  });

  it('ignores PRs with no resolvable entity id', async () => {
    const { root } = withGh([row({ headRefName: 'main', body: 'no plan line' })]);
    const prs = await resolvePrsByEntity(root);
    expect(prs?.size).toBe(0);
  });

  it('resolves undefined when gh exits non-zero (offline/unauthenticated)', async () => {
    const { root } = installFakeGh(`echo 'boom' >&2\nexit 1`);
    process.env.PATH = `${root}:${originalPath}`;
    expect(await resolvePrsByEntity(root)).toBeUndefined();
  });

  it('resolves undefined on unparseable output', async () => {
    const { root } = installFakeGh(`echo 'not json'`);
    process.env.PATH = `${root}:${originalPath}`;
    expect(await resolvePrsByEntity(root)).toBeUndefined();
  });

  it('caches within the TTL, only re-invoking gh after it elapses', async () => {
    const { root, callCount } = withGh([row({ body: '**Plan:** `IDEA-2`' })]);
    await resolvePrsByEntity(root, 1000 * 60);
    await resolvePrsByEntity(root, 1000 * 60);
    expect(callCount()).toBe(1);
    await resolvePrsByEntity(root, 0);
    expect(callCount()).toBe(2);
  });

  it('does not cache a failed lookup — the next read retries', async () => {
    const { root, callCount } = installFakeGh(`echo 'boom' >&2\nexit 1`);
    process.env.PATH = `${root}:${originalPath}`;
    expect(await resolvePrsByEntity(root, 1000 * 60)).toBeUndefined();
    expect(await resolvePrsByEntity(root, 1000 * 60)).toBeUndefined();
    expect(callCount()).toBe(2);
  });
});
