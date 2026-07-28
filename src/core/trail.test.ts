import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearPrCache } from './git-pr/pr-lookup';
import { formatEntityFile } from './serialize/serializer';
import { findReleaseLineForId, resolveEntityTrail } from './trail';

const originalPath = process.env.PATH;

function installFailingGh(): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-trail-gh-'));
  writeFileSync(join(dir, 'gh'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(dir, 'gh'), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

function installGh(rows: object[]): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-trail-gh-'));
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\necho '${JSON.stringify(rows)}'\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

beforeEach(() => {
  clearPrCache();
  installFailingGh();
});
afterEach(() => {
  process.env.PATH = originalPath;
  clearPrCache();
});

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-trail-root-'));
  mkdirSync(join(root, 'papercamp', 'ideas', 'archive'), { recursive: true });
  return root;
}

function writeIdea(root: string, entity: Parameters<typeof formatEntityFile>[0]): void {
  writeFileSync(
    join(root, 'papercamp', 'ideas', `${entity.id}.md`),
    `${formatEntityFile(entity)}\n`,
  );
}

describe('findReleaseLineForId', () => {
  it('finds the line stamped with the id', () => {
    const changelog = [
      '# Changelog',
      '* **app:** Something else ([abc](url))',
      '* **core:** Trace an idea from roadmap to release (IDEA-93) ([def](url))',
    ].join('\n');
    expect(findReleaseLineForId(changelog, 'IDEA-93')).toBe(
      '* **core:** Trace an idea from roadmap to release (IDEA-93) ([def](url))',
    );
  });

  it('returns undefined when no line carries the id', () => {
    expect(
      findReleaseLineForId('# Changelog\n* **app:** Something else', 'IDEA-93'),
    ).toBeUndefined();
  });
});

describe('resolveEntityTrail', () => {
  it('assembles the idea, phases, task runs, PR and release line for an entity', async () => {
    const root = makeRoot();
    writeIdea(root, {
      id: 'IDEA-93',
      title: 'Trace an idea from roadmap to release',
      type: 'feat',
      status: 'in-progress',
      created: '2026-07-25',
      tags: ['core'],
      body: 'Provenance trail.',
      phases: [{ text: 'Model the provenance trail', done: false }],
    });
    writeFileSync(
      join(root, 'papercamp', 'tasks.log'),
      `${JSON.stringify({
        id: 't1',
        taskKind: 'run',
        planId: 'IDEA-93',
        planTitle: 'Trace an idea from roadmap to release',
        agentId: 'claude-code',
        startedAt: '2026-07-26T00:00:00Z',
        endedAt: '2026-07-26T00:01:00Z',
        outcome: 'done',
      })}\n`,
    );
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      '# Changelog\n* **core:** Trace an idea from roadmap to release (IDEA-93) ([abc](url))\n',
    );

    const trail = await resolveEntityTrail(root, 'IDEA-93');

    expect(trail.idea).toEqual({
      reached: true,
      data: { title: 'Trace an idea from roadmap to release', status: 'in-progress', type: 'feat' },
    });
    expect(trail.phases.reached).toBe(true);
    expect(trail.phases.data).toHaveLength(1);
    expect(trail.taskRuns.reached).toBe(true);
    expect(trail.taskRuns.data).toHaveLength(1);
    expect(trail.commits).toEqual({ reached: false });
    expect(trail.pr).toEqual({ reached: false });
    expect(trail.releaseLine).toEqual({
      reached: true,
      data: '* **core:** Trace an idea from roadmap to release (IDEA-93) ([abc](url))',
    });
  });

  it('resolves the PR when gh reports one', async () => {
    const root = makeRoot();
    writeIdea(root, {
      id: 'IDEA-1',
      title: 'Some work',
      type: 'feat',
      status: 'in-progress',
      created: '2026-07-01',
      tags: [],
      body: 'x',
    });
    installGh([
      {
        number: 7,
        url: 'https://github.com/o/r/pull/7',
        state: 'OPEN',
        isDraft: false,
        headRefName: 'feat/idea-1-some-work',
        body: '',
        reviewDecision: '',
      },
    ]);

    const trail = await resolveEntityTrail(root, 'IDEA-1');

    expect(trail.pr.reached).toBe(true);
    expect(trail.pr.data?.number).toBe(7);
  });

  it('marks every hop unreached for an unknown id', async () => {
    const root = makeRoot();
    const trail = await resolveEntityTrail(root, 'IDEA-999');
    expect(trail).toEqual({
      id: 'IDEA-999',
      idea: { reached: false },
      phases: { reached: false },
      taskRuns: { reached: false, data: [] },
      commits: { reached: false },
      pr: { reached: false },
      releaseLine: { reached: false },
    });
  });
});
