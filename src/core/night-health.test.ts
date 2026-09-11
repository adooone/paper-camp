import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { NightHealthMap } from '../types/index';
import {
  chunkCoveragePct,
  computeChurnByChunk,
  computeNightHealthMap,
  markChunkReviewed,
  scoreChunk,
  selectNightChunks,
} from './night-health';

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

const gitRoots: string[] = [];

function initGitRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-night-health-'));
  gitRoots.push(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  return root;
}

function commitFiles(root: string, files: string[], subject: string): void {
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), `${file}\n${subject}\n`);
  }
  git(root, 'add', '.');
  git(root, 'commit', '-m', subject);
}

afterAll(() => {
  for (const root of gitRoots) rmSync(root, { recursive: true, force: true });
});

describe('scoreChunk', () => {
  const base = {
    churnCommits: 0,
    lines: 0,
    coveragePct: 100,
    openFindings: 0,
    daysSinceReviewed: 0,
  };

  it('is at its lowest when every signal is healthy', () => {
    expect(scoreChunk(base)).toBe(0);
  });

  it('rises with churn', () => {
    expect(scoreChunk({ ...base, churnCommits: 20 })).toBeGreaterThan(scoreChunk(base));
  });

  it('rises with size', () => {
    expect(scoreChunk({ ...base, lines: 3000 })).toBeGreaterThan(scoreChunk(base));
  });

  it('rises as coverage drops, and treats unknown coverage as a midpoint', () => {
    const uncovered = scoreChunk({ ...base, coveragePct: 0 });
    const unknown = scoreChunk({ ...base, coveragePct: null });
    const fullyCovered = scoreChunk(base);
    expect(uncovered).toBeGreaterThan(unknown);
    expect(unknown).toBeGreaterThan(fullyCovered);
  });

  it('rises with open findings', () => {
    expect(scoreChunk({ ...base, openFindings: 5 })).toBeGreaterThan(scoreChunk(base));
  });

  it('treats a never-reviewed chunk as the longest possible gap', () => {
    const never = scoreChunk({ ...base, daysSinceReviewed: null });
    const justReviewed = scoreChunk(base);
    const longAgo = scoreChunk({ ...base, daysSinceReviewed: 30 });
    expect(never).toBe(longAgo);
    expect(never).toBeGreaterThan(justReviewed);
  });
});

describe('chunkCoveragePct', () => {
  const summary = {
    total: { lines: { total: 999, covered: 999 } },
    '/root/src/app/a.ts': { lines: { total: 10, covered: 5 } },
    '/root/src/app/sub/b.ts': { lines: { total: 10, covered: 10 } },
    '/root/src/core/c.ts': { lines: { total: 10, covered: 0 } },
  };

  it('sums lines for every file under the chunk, including nested files', () => {
    expect(chunkCoveragePct(summary, '/root/src/app')).toBe(75);
  });

  it('ignores files outside the chunk and the total row', () => {
    expect(chunkCoveragePct(summary, '/root/src/core')).toBe(0);
  });

  it('is null when no files fall under the chunk', () => {
    expect(chunkCoveragePct(summary, '/root/src/missing')).toBeNull();
  });

  it('is null when there is no coverage summary', () => {
    expect(chunkCoveragePct(null, '/root/src/app')).toBeNull();
  });
});

describe('computeChurnByChunk', () => {
  it('counts a commit once per chunk it touches, even with multiple files in that chunk', async () => {
    const root = initGitRepo();
    commitFiles(root, ['src/app/a.ts', 'src/app/b.ts'], 'feat(app): two files');
    commitFiles(root, ['src/app/a.ts', 'src/core/c.ts'], 'feat: touch both chunks');
    commitFiles(root, ['src/vite/d.ts'], 'feat(vite): unrelated chunk');

    const counts = await computeChurnByChunk(root, ['src/app', 'src/core']);
    expect(counts.get('src/app')).toBe(2);
    expect(counts.get('src/core')).toBe(1);
    expect(counts.has('src/vite')).toBe(false);
  });

  it('is zero for a repo with no matching commits', async () => {
    const root = initGitRepo();
    commitFiles(root, ['README.md'], 'chore: seed');

    const counts = await computeChurnByChunk(root, ['src/app']);
    expect(counts.get('src/app')).toBe(0);
  });
});

describe('computeNightHealthMap', () => {
  async function makeProject(root: string): Promise<void> {
    await mkdir(join(root, 'papercamp'), { recursive: true });
    await writeFile(
      join(root, 'papercamp', 'config.json'),
      JSON.stringify({ version: 1, projectName: 'demo', initializedAt: '2026-01-01T00:00:00Z' }),
      'utf-8',
    );
  }

  it('scores every top-level folder under src/, highest score first', async () => {
    const root = initGitRepo();
    await makeProject(root);
    commitFiles(root, ['src/app/a.ts', 'src/app/b.ts', 'src/app/c.ts'], 'feat(app): grow it');
    commitFiles(root, ['src/core/a.ts'], 'feat(core): a small file');

    const map = await computeNightHealthMap(root);
    const paths = map.chunks.map((c) => c.path);
    expect(paths.sort()).toEqual(['src/app', 'src/core']);
    const app = map.chunks.find((c) => c.path === 'src/app');
    const core = map.chunks.find((c) => c.path === 'src/core');
    expect(app?.signals.churnCommits).toBe(1);
    expect(core?.signals.churnCommits).toBe(1);
    expect(map.chunks[0].score).toBeGreaterThanOrEqual(map.chunks[1].score);
  });

  it('uses night.roots from config.json when set', async () => {
    const root = initGitRepo();
    await makeProject(root);
    await writeFile(
      join(root, 'papercamp', 'config.json'),
      JSON.stringify({
        version: 1,
        projectName: 'demo',
        initializedAt: '2026-01-01T00:00:00Z',
        night: { roots: ['packages'] },
      }),
      'utf-8',
    );
    commitFiles(root, ['packages/foo/a.ts'], 'feat(foo): seed');
    commitFiles(root, ['src/app/a.ts'], 'feat(app): should be ignored');

    const map = await computeNightHealthMap(root);
    expect(map.chunks.map((c) => c.path)).toEqual(['packages/foo']);
  });

  it('persists the map to papercamp/night.json and carries lastReviewed state forward', async () => {
    const root = initGitRepo();
    await makeProject(root);
    commitFiles(root, ['src/app/a.ts'], 'feat(app): seed');

    await computeNightHealthMap(root);
    const nightJsonPath = join(root, 'papercamp', 'night.json');
    const persisted = JSON.parse(await readFile(nightJsonPath, 'utf-8'));
    expect(persisted.chunks.find((c: { path: string }) => c.path === 'src/app')).toBeTruthy();

    const reviewedAt = '2026-01-01T00:00:00.000Z';
    persisted.chunks = persisted.chunks.map((c: { path: string }) =>
      c.path === 'src/app'
        ? { ...c, lastReviewedAt: reviewedAt, lastReviewedCommit: 'deadbeef' }
        : c,
    );
    await writeFile(nightJsonPath, JSON.stringify(persisted), 'utf-8');

    const map = await computeNightHealthMap(root);
    const app = map.chunks.find((c) => c.path === 'src/app');
    expect(app?.lastReviewedAt).toBe(reviewedAt);
    expect(app?.lastReviewedCommit).toBe('deadbeef');
    expect(app?.signals.daysSinceReviewed).toBeGreaterThan(0);
  });

  it('reads coverage-summary.json when present', async () => {
    const root = initGitRepo();
    await makeProject(root);
    commitFiles(root, ['src/app/a.ts'], 'feat(app): seed');
    await mkdir(join(root, 'coverage'), { recursive: true });
    await writeFile(
      join(root, 'coverage', 'coverage-summary.json'),
      JSON.stringify({
        total: { lines: { total: 10, covered: 10 } },
        [join(root, 'src', 'app', 'a.ts')]: { lines: { total: 10, covered: 2 } },
      }),
      'utf-8',
    );

    const map = await computeNightHealthMap(root);
    const app = map.chunks.find((c) => c.path === 'src/app');
    expect(app?.signals.coveragePct).toBe(20);
  });

  it('is empty when there is no src/ directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'papercamp-night-health-plain-'));
    gitRoots.push(root);
    await makeProject(root);

    const map = await computeNightHealthMap(root);
    expect(map.chunks).toEqual([]);
  });
});

describe('markChunkReviewed and selectNightChunks', () => {
  it('persists the reviewed commit and time for a chunk in night.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'papercamp-night-mark-'));
    await markChunkReviewed(root, 'src/app', 'abc1234', '2026-09-11T02:00:00.000Z');
    const raw = await readFile(join(root, 'papercamp', 'night.json'), 'utf-8');
    const chunk = (JSON.parse(raw) as NightHealthMap).chunks.find((c) => c.path === 'src/app');
    expect(chunk?.lastReviewedCommit).toBe('abc1234');
    expect(chunk?.lastReviewedAt).toBe('2026-09-11T02:00:00.000Z');
    rmSync(root, { recursive: true, force: true });
  });

  it('picks chunks above the threshold, highest first, capped, skipping the excluded', () => {
    const map: NightHealthMap = {
      generatedAt: '2026-09-11T00:00:00.000Z',
      chunks: ['src/a:30', 'src/b:90', 'src/c:70', 'src/d:50'].map((entry) => {
        const [path, score] = entry.split(':');
        return {
          path,
          score: Number(score),
          signals: {
            churnCommits: 0,
            lines: 0,
            coveragePct: null,
            openFindings: 0,
            daysSinceReviewed: null,
          },
          lastReviewedAt: null,
          lastReviewedCommit: null,
        };
      }),
    };
    const picked = selectNightChunks(map, {
      threshold: 40,
      maxChunks: 2,
      exclude: new Set(['src/b']),
    });
    expect(picked.map((c) => c.path)).toEqual(['src/c', 'src/d']);
  });
});
