import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearPrCache,
  fetchUnresolvedThreads,
  resolvePlanForPrRef,
  resolvePrsByEntity,
} from './pr';

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

/** Like `installFakeGh`, but dispatches on the subcommand: `gh pr ...` answers
 * with `prListScript`, `gh api ...` (the review-signal enrichment call) with
 * `apiScript` — defaults to a harmless empty-PR response so tests that don't
 * care about enrichment aren't affected by it firing for open/draft rows. */
function installFakeGhDispatch(
  prListScript: string,
  apiScript = `echo '{"data":{"repository":{"pullRequest":null}}}'`,
): { root: string; callCount: () => number } {
  return installFakeGh(`if [ "$1" = "api" ]; then\n${apiScript}\nelse\n${prListScript}\nfi`);
}

interface Row {
  number: number;
  url: string;
  state: string;
  isDraft: boolean;
  headRefName: string;
  body: string;
  reviewDecision: string;
}
const row = (o: Partial<Row>): Row => ({
  number: 1,
  url: 'u',
  state: 'OPEN',
  isDraft: false,
  headRefName: '',
  body: '',
  reviewDecision: '',
  ...o,
});

describe('resolvePrsByEntity', () => {
  const originalPath = process.env.PATH;
  beforeEach(() => clearPrCache());
  afterEach(() => {
    process.env.PATH = originalPath;
  });

  const withGh = (rows: Row[], apiScript?: string) => {
    const { root, callCount } = installFakeGhDispatch(`echo '${JSON.stringify(rows)}'`, apiScript);
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

  it('maps reviewDecision straight from the list pass, no gh api call needed', async () => {
    const { root, callCount } = withGh(
      [
        row({
          number: 9,
          url: 'https://github.com/o/r/pull/9',
          state: 'OPEN',
          body: '**Plan:** `IDEA-9`',
          reviewDecision: 'CHANGES_REQUESTED',
        }),
      ],
      `echo 'boom' >&2 && exit 1`,
    );
    const prs = await resolvePrsByEntity(root);
    expect(prs?.get('IDEA-9')?.reviewDecision).toBe('changes-requested');
    // The gh api call still happens (thread/activity signal), but reviewDecision itself
    // didn't need it — confirm the failing fake api script didn't wipe the mapped value.
    expect(callCount()).toBe(2);
  });

  it('omits reviewDecision when gh reports no decision yet', async () => {
    const { root } = withGh([
      row({ url: 'https://github.com/o/r/pull/1', body: '**Plan:** `IDEA-3`', reviewDecision: '' }),
    ]);
    const prs = await resolvePrsByEntity(root);
    expect(prs?.get('IDEA-3')?.reviewDecision).toBeUndefined();
  });

  it('fetches unresolved thread count and push-activity signal for open/draft PRs via gh api', async () => {
    const apiScript = `echo '{"data":{"repository":{"pullRequest":{
      "reviewThreads":{"nodes":[{"isResolved":true},{"isResolved":false},{"isResolved":false}]},
      "commits":{"nodes":[{"commit":{"committedDate":"2026-07-01T00:00:00Z"}}]},
      "comments":{"nodes":[{"createdAt":"2026-07-02T00:00:00Z"}]},
      "reviews":{"nodes":[]}
    }}}}'`;
    const { root } = withGh(
      [row({ url: 'https://github.com/o/r/pull/4', body: '**Plan:** `IDEA-4`' })],
      apiScript,
    );
    const prs = await resolvePrsByEntity(root);
    const info = prs?.get('IDEA-4');
    expect(info?.unresolvedThreadCount).toBe(2);
    expect(info?.hasNewCommentsSincePush).toBe(true);
  });

  it('reports no new comments when the last push is after the last comment/review', async () => {
    const apiScript = `echo '{"data":{"repository":{"pullRequest":{
      "reviewThreads":{"nodes":[]},
      "commits":{"nodes":[{"commit":{"committedDate":"2026-07-05T00:00:00Z"}}]},
      "comments":{"nodes":[{"createdAt":"2026-07-02T00:00:00Z"}]},
      "reviews":{"nodes":[{"createdAt":"2026-07-01T00:00:00Z"}]}
    }}}}'`;
    const { root } = withGh(
      [row({ url: 'https://github.com/o/r/pull/5', body: '**Plan:** `IDEA-5`' })],
      apiScript,
    );
    const prs = await resolvePrsByEntity(root);
    const info = prs?.get('IDEA-5');
    expect(info?.unresolvedThreadCount).toBe(0);
    expect(info?.hasNewCommentsSincePush).toBe(false);
  });

  it('does not fetch review-thread signal for merged/closed PRs', async () => {
    const { root, callCount } = withGh(
      [row({ url: 'https://github.com/o/r/pull/6', state: 'MERGED', body: '**Plan:** `IDEA-6`' })],
      `echo 'boom' >&2 && exit 1`,
    );
    const prs = await resolvePrsByEntity(root);
    expect(prs?.get('IDEA-6')?.unresolvedThreadCount).toBeUndefined();
    expect(callCount()).toBe(1);
  });

  it('leaves review-thread signal undefined when the gh api enrichment call fails', async () => {
    const { root } = withGh(
      [row({ url: 'https://github.com/o/r/pull/8', body: '**Plan:** `IDEA-8`' })],
      `echo 'boom' >&2 && exit 1`,
    );
    const prs = await resolvePrsByEntity(root);
    const info = prs?.get('IDEA-8');
    expect(info?.unresolvedThreadCount).toBeUndefined();
    expect(info?.hasNewCommentsSincePush).toBeUndefined();
    expect(info?.state).toBe('open');
  });
});

describe('fetchUnresolvedThreads', () => {
  const originalPath = process.env.PATH;
  afterEach(() => {
    process.env.PATH = originalPath;
  });

  it('returns each unresolved thread as its first comment, skipping resolved ones', async () => {
    const { root } = installFakeGh(`echo '{"data":{"repository":{"pullRequest":{
      "reviewThreads":{"nodes":[
        {"isResolved":true,"comments":{"nodes":[{"path":"a.ts","line":1,"body":"resolved","author":{"login":"bot"}}]}},
        {"isResolved":false,"comments":{"nodes":[{"path":"b.ts","line":42,"body":"fix this","author":{"login":"reviewer"}}]}},
        {"isResolved":false,"comments":{"nodes":[{"path":null,"line":null,"body":"general note","author":null}]}}
      ]}
    }}}}'`);
    process.env.PATH = `${root}:${originalPath}`;

    const threads = await fetchUnresolvedThreads(root, 'https://github.com/o/r/pull/1');
    expect(threads).toEqual([
      { path: 'b.ts', line: 42, author: 'reviewer', body: 'fix this' },
      { body: 'general note' },
    ]);
  });

  it('resolves an empty array when the url is not a GitHub PR url', async () => {
    expect(await fetchUnresolvedThreads('/tmp', 'not-a-pr-url')).toEqual([]);
  });

  it('resolves an empty array when gh fails', async () => {
    const { root } = installFakeGh(`echo 'boom' >&2\nexit 1`);
    process.env.PATH = `${root}:${originalPath}`;
    expect(await fetchUnresolvedThreads(root, 'https://github.com/o/r/pull/2')).toEqual([]);
  });
});

describe('resolvePlanForPrRef', () => {
  const originalPath = process.env.PATH;
  afterEach(() => {
    process.env.PATH = originalPath;
  });

  /** Fake `gh` answering `pr view` with `viewScript` regardless of the ref passed. */
  function withGhPrView(viewScript: string): { root: string } {
    const { root } = installFakeGh(
      `if [ "$1" = "pr" ] && [ "$2" = "view" ]; then\n${viewScript}\nelse\nexit 1\nfi`,
    );
    process.env.PATH = `${root}:${originalPath}`;
    return { root };
  }

  function writeEntityFile(root: string, id: string, extra = ''): void {
    mkdirSync(join(root, 'papercamp', 'ideas'), { recursive: true });
    writeFileSync(
      join(root, 'papercamp', 'ideas', `${id}.md`),
      `---\nid: ${id}\ntitle: Some plan\ntype: feat\ntags:\n  - ci\n  - github\ncreated: 2026-07-01\n---\n\nBody.\n\n### Phases\n- [x] Phase one\n- [ ] Phase two\n${extra}`,
    );
  }

  it('resolves the plan id from the PR body Plan line and returns kind/tags/phases', async () => {
    const { root } = withGhPrView(
      `echo '{"body":"intro. **Plan:** \`IDEA-9\` for the plan.","headRefName":"feat/idea-9-x"}'`,
    );
    writeEntityFile(root, 'IDEA-9');

    const resolved = await resolvePlanForPrRef(root, '42');
    expect(resolved).toEqual({
      id: 'IDEA-9',
      kind: 'feat',
      tags: ['ci', 'github'],
      phases: [
        { done: true, text: 'Phase one', description: undefined, source: undefined },
        { done: false, text: 'Phase two', description: undefined, source: undefined },
      ],
    });
  });

  it('falls back to the head branch id prefix when the PR body has no Plan line', async () => {
    const { root } = withGhPrView(
      `echo '{"body":"no plan line","headRefName":"feat/idea-12-some-title"}'`,
    );
    writeEntityFile(root, 'IDEA-12');

    const resolved = await resolvePlanForPrRef(root, 'feat/idea-12-some-title');
    expect(resolved?.id).toBe('IDEA-12');
  });

  it('falls back to parsing the ref itself as a branch when no PR exists yet', async () => {
    const { root } = installFakeGh('exit 1');
    process.env.PATH = `${root}:${originalPath}`;
    writeEntityFile(root, 'IDEA-20');

    const resolved = await resolvePlanForPrRef(root, 'feat/idea-20-some-title');
    expect(resolved?.id).toBe('IDEA-20');
  });

  it('resolves undefined when no id can be resolved at all', async () => {
    const { root } = withGhPrView(`echo '{"body":"nothing here","headRefName":"main"}'`);
    expect(await resolvePlanForPrRef(root, 'main')).toBeUndefined();
  });

  it('resolves undefined when the resolved id has no matching entity file', async () => {
    const { root } = withGhPrView(
      `echo '{"body":"**Plan:** \`IDEA-99\`","headRefName":"feat/idea-99-x"}'`,
    );
    expect(await resolvePlanForPrRef(root, '1')).toBeUndefined();
  });
});
