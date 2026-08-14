import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearCiCache } from '@/core/ci';
import type { PlanEntry, PrInfo } from '@/types/index';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { readReviewedShas } from './pr-review-state';
import { triggerPrReviews } from './pr-review-trigger';

const roots: string[] = [];
const originalPath = process.env.PATH;

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

afterEach(() => {
  process.env.PATH = originalPath;
  clearCiCache();
});

const BRANCH = 'feat/idea-1-add-thing';

function makeRoot(opts: { ci?: boolean } = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-pr-review-trigger-'));
  mkdirSync(join(root, 'papercamp'), { recursive: true });
  const desk = opts.ci === false ? {} : { ci: { repo: 'o/r', branch: 'main' } };
  writeFileSync(join(root, 'papercamp', 'config.json'), JSON.stringify({ desk }));
  roots.push(root);
  return root;
}

/** Fake `gh` answering CI-release calls (`run list`/`release list`) green by
 * default, and `pr diff` with a fixed diff — `diffScript`/`ciRunsScript` let a
 * test override either independently. */
function installFakeGh(opts: {
  diffScript?: string;
  ciRunsScript?: string;
}): { root: string } {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-pr-review-gh-'));
  const runsScript =
    opts.ciRunsScript ??
    `echo '[{"workflowName":"CI","status":"completed","conclusion":"success","url":"u","headBranch":"${BRANCH}"}]'`;
  const diffScript = opts.diffScript ?? `echo 'diff content'`;
  writeFileSync(
    join(root, 'gh'),
    `#!/bin/sh
if [ "$1" = "run" ]; then
${runsScript}
elif [ "$1" = "release" ]; then
echo '[]'
elif [ "$1" = "pr" ] && [ "$2" = "diff" ]; then
${diffScript}
else
echo '[]'
fi
`,
  );
  chmodSync(join(root, 'gh'), 0o755);
  roots.push(root);
  return { root };
}

const plan = (overrides: Partial<PlanEntry> = {}): PlanEntry => ({
  title: 'Add thing',
  status: 'review',
  kind: 'feat',
  id: 'IDEA-1',
  created: '2026-06-30',
  tags: ['app'],
  body: 'Body prose.',
  phases: [{ done: true, text: 'Do the thing' }],
  ...overrides,
});

const pr = (overrides: Partial<PrInfo> = {}): PrInfo => ({
  number: 7,
  url: 'https://github.com/o/r/pull/7',
  state: 'open',
  headSha: 'sha-1',
  headBranch: BRANCH,
  ...overrides,
});

describe('triggerPrReviews', () => {
  it('launches a review when open, CI green, unreviewed, and on the current branch', async () => {
    const root = makeRoot();
    const { root: ghRoot } = installFakeGh({});
    process.env.PATH = `${ghRoot}:${originalPath}`;

    const startPrReview = vi.fn().mockReturnValue({ ok: true });
    await triggerPrReviews(
      root,
      { getCurrentBranch: () => BRANCH },
      { startPrReview },
      [plan()],
      new Map([['IDEA-1', pr()]]),
    );

    expect(startPrReview).toHaveBeenCalledTimes(1);
    const [launchedPlan, launchedPrompt, launchedSha] = startPrReview.mock.calls[0];
    expect(launchedPlan.id).toBe('IDEA-1');
    expect(launchedPrompt).toContain('diff content');
    expect(launchedSha).toBe('sha-1');
  });

  it('skips a draft PR', async () => {
    const root = makeRoot();
    const { root: ghRoot } = installFakeGh({});
    process.env.PATH = `${ghRoot}:${originalPath}`;

    const startPrReview = vi.fn();
    await triggerPrReviews(
      root,
      { getCurrentBranch: () => BRANCH },
      { startPrReview },
      [plan()],
      new Map([['IDEA-1', pr({ state: 'draft' })]]),
    );
    expect(startPrReview).not.toHaveBeenCalled();
  });

  it('skips when CI is not green', async () => {
    const root = makeRoot();
    const { root: ghRoot } = installFakeGh({
      ciRunsScript: `echo '[{"workflowName":"CI","status":"completed","conclusion":"failure","url":"u","headBranch":"${BRANCH}"}]'`,
    });
    process.env.PATH = `${ghRoot}:${originalPath}`;

    const startPrReview = vi.fn();
    await triggerPrReviews(
      root,
      { getCurrentBranch: () => BRANCH },
      { startPrReview },
      [plan()],
      new Map([['IDEA-1', pr()]]),
    );
    expect(startPrReview).not.toHaveBeenCalled();
  });

  it('skips a SHA already recorded as reviewed', async () => {
    const root = makeRoot();
    const { root: ghRoot } = installFakeGh({});
    process.env.PATH = `${ghRoot}:${originalPath}`;
    const { recordReviewedSha } = await import('./pr-review-state');
    await recordReviewedSha(root, 'IDEA-1', 'sha-1');

    const startPrReview = vi.fn();
    await triggerPrReviews(
      root,
      { getCurrentBranch: () => BRANCH },
      { startPrReview },
      [plan()],
      new Map([['IDEA-1', pr()]]),
    );
    expect(startPrReview).not.toHaveBeenCalled();
    expect(await readReviewedShas(root)).toEqual({ 'IDEA-1': 'sha-1' });
  });

  it('records the SHA once the poll observes a posted Scout review, without launching a task', async () => {
    const root = makeRoot();
    const { root: ghRoot } = installFakeGh({});
    process.env.PATH = `${ghRoot}:${originalPath}`;

    const startPrReview = vi.fn();
    await triggerPrReviews(
      root,
      { getCurrentBranch: () => BRANCH },
      { startPrReview },
      [plan()],
      new Map([['IDEA-1', pr({ scoutReviewObserved: true })]]),
    );
    expect(startPrReview).not.toHaveBeenCalled();
    expect(await readReviewedShas(root)).toEqual({ 'IDEA-1': 'sha-1' });
  });

  it('keeps retrying an unobserved SHA — a computed review may still be in flight', async () => {
    const root = makeRoot();
    const { root: ghRoot } = installFakeGh({});
    process.env.PATH = `${ghRoot}:${originalPath}`;

    const startPrReview = vi.fn().mockReturnValue({ ok: true });
    await triggerPrReviews(
      root,
      { getCurrentBranch: () => BRANCH },
      { startPrReview },
      [plan()],
      new Map([['IDEA-1', pr()]]),
    );
    expect(startPrReview).toHaveBeenCalledTimes(1);
    expect(await readReviewedShas(root)).toEqual({});
  });

  it('fires again once a new commit changes the head SHA', async () => {
    const root = makeRoot();
    const { root: ghRoot } = installFakeGh({});
    process.env.PATH = `${ghRoot}:${originalPath}`;
    const { recordReviewedSha } = await import('./pr-review-state');
    await recordReviewedSha(root, 'IDEA-1', 'sha-old');

    const startPrReview = vi.fn().mockReturnValue({ ok: true });
    await triggerPrReviews(
      root,
      { getCurrentBranch: () => BRANCH },
      { startPrReview },
      [plan()],
      new Map([['IDEA-1', pr({ headSha: 'sha-new' })]]),
    );
    expect(startPrReview).toHaveBeenCalledTimes(1);
    expect(startPrReview.mock.calls[0][2]).toBe('sha-new');
  });

  it('skips when root is checked out on a different branch than the PR', async () => {
    const root = makeRoot();
    const { root: ghRoot } = installFakeGh({});
    process.env.PATH = `${ghRoot}:${originalPath}`;

    const startPrReview = vi.fn();
    await triggerPrReviews(
      root,
      { getCurrentBranch: () => 'main' },
      { startPrReview },
      [plan()],
      new Map([['IDEA-1', pr()]]),
    );
    expect(startPrReview).not.toHaveBeenCalled();
  });

  it('skips entirely when no desk.ci is configured — no CI signal to confirm green', async () => {
    const root = makeRoot({ ci: false });
    const { root: ghRoot } = installFakeGh({});
    process.env.PATH = `${ghRoot}:${originalPath}`;

    const startPrReview = vi.fn();
    await triggerPrReviews(
      root,
      { getCurrentBranch: () => BRANCH },
      { startPrReview },
      [plan()],
      new Map([['IDEA-1', pr()]]),
    );
    expect(startPrReview).not.toHaveBeenCalled();
  });

  it('skips an entity with no PR info resolved yet', async () => {
    const root = makeRoot();
    const { root: ghRoot } = installFakeGh({});
    process.env.PATH = `${ghRoot}:${originalPath}`;

    const startPrReview = vi.fn();
    await triggerPrReviews(
      root,
      { getCurrentBranch: () => BRANCH },
      { startPrReview },
      [plan()],
      new Map(),
    );
    expect(startPrReview).not.toHaveBeenCalled();
  });
});
