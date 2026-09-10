import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { NightFinding, NightSuggestionEntry, TaskLogEntry } from '../types/index';
import {
  NIGHT_FINDINGS_HEADING,
  appendNightFindings,
  buildNightReportGroups,
  dropOverlappingFindings,
  isOverlappingFinding,
  parseNightFindings,
  readNightFindings,
  removeNightFindingLine,
} from './night-suggestions';

function entry(overrides: Partial<NightSuggestionEntry> = {}): NightSuggestionEntry {
  return {
    date: '2026-09-10',
    check: 'bugs',
    chunk: 'src/core',
    file: 'src/core/a.ts',
    line: 12,
    commit: 'abc1234',
    severity: 'high',
    message: 'Off-by-one in the turn counter.',
    ...overrides,
  };
}

describe('appendNightFindings / parseNightFindings', () => {
  it('round-trips a single finding written to an empty file', () => {
    const written = appendNightFindings('', [entry()]);
    expect(written).toContain(NIGHT_FINDINGS_HEADING);
    expect(parseNightFindings(written)).toEqual([entry()]);
  });

  it('appends under an existing heading rather than duplicating it', () => {
    const first = appendNightFindings('', [entry()]);
    const second = appendNightFindings(first, [entry({ file: 'src/core/b.ts' })]);
    expect(second.match(/## Night findings/g)).toHaveLength(1);
    expect(parseNightFindings(second)).toHaveLength(2);
  });

  it('adds the heading after existing plain suggestions, leaving them untouched', () => {
    const plain = '- 2026-09-01: Some idea — a plain suggestion\n';
    const written = appendNightFindings(plain, [entry()]);
    expect(written).toContain('- 2026-09-01: Some idea — a plain suggestion');
    expect(written).toContain(NIGHT_FINDINGS_HEADING);
    expect(parseNightFindings(written)).toEqual([entry()]);
  });

  it('is a no-op for an empty entry list', () => {
    expect(appendNightFindings('unchanged', [])).toBe('unchanged');
  });

  it('ignores a plain suggestion line and parses a night line with no line number', () => {
    const markdown = [
      '- 2026-09-01: Regular idea — not a night finding',
      '- night: 2026-09-10 | check=bugs | chunk=src/core | file=src/core/a.ts | line=- | commit=abc1234 | severity=normal | No line number here.',
    ].join('\n');
    const parsed = parseNightFindings(markdown);
    expect(parsed).toEqual([
      entry({ line: null, severity: 'normal', message: 'No line number here.' }),
    ]);
  });

  it('ignores a malformed night line missing a required field', () => {
    const markdown =
      '- night: 2026-09-10 | check=bugs | chunk=src/core | commit=abc1234 | severity=high | message only 5 fields';
    expect(parseNightFindings(markdown)).toEqual([]);
  });

  it('ignores an unrecognized severity value', () => {
    const markdown =
      '- night: 2026-09-10 | check=bugs | chunk=src/core | file=a.ts | line=1 | commit=abc | severity=urgent | msg';
    expect(parseNightFindings(markdown)).toEqual([]);
  });
});

describe('isOverlappingFinding / dropOverlappingFindings', () => {
  function finding(overrides: Partial<NightFinding> = {}): NightFinding {
    return {
      file: 'src/core/a.ts',
      line: 12,
      message: 'The turn counter starts from zero instead of one.',
      severity: 'high',
      check: 'bugs',
      ...overrides,
    };
  }

  it('matches an open idea whose title and body overlap the finding message', () => {
    const openIdeas = [
      { title: 'Fix turn counter zero', body: 'The turn counter starts from zero instead of one' },
    ];
    expect(isOverlappingFinding(finding(), openIdeas, [])).toBe(true);
  });

  it('does not match an unrelated open idea', () => {
    const openIdeas = [{ title: 'Improve onboarding flow', body: 'Add a welcome screen' }];
    expect(isOverlappingFinding(finding(), openIdeas, [])).toBe(false);
  });

  it('matches an earlier finding with the same file and a similar message', () => {
    const earlier = [entry({ file: 'src/core/a.ts', message: 'Turn counter starts from zero' })];
    expect(isOverlappingFinding(finding(), [], earlier)).toBe(true);
  });

  it('does not match an earlier finding in a different file, even with the same message', () => {
    const earlier = [
      entry({
        file: 'src/core/other.ts',
        message: 'The turn counter starts from zero instead of one.',
      }),
    ];
    expect(isOverlappingFinding(finding(), [], earlier)).toBe(false);
  });

  it('drops only the overlapping findings from a list', () => {
    const clean = finding({ file: 'src/core/b.ts', message: 'Unrelated issue entirely.' });
    const dup = finding();
    const earlier = [entry({ file: 'src/core/a.ts', message: finding().message })];
    expect(dropOverlappingFindings([clean, dup], [], earlier)).toEqual([clean]);
  });
});

describe('removeNightFindingLine', () => {
  it('removes the one matching line and leaves the rest of the file intact', () => {
    const written = appendNightFindings('some preamble\n', [
      entry({ file: 'src/core/a.ts' }),
      entry({ file: 'src/core/b.ts' }),
    ]);
    const updated = removeNightFindingLine(written, entry({ file: 'src/core/a.ts' }));
    expect(updated).toContain('some preamble');
    expect(parseNightFindings(updated)).toEqual([entry({ file: 'src/core/b.ts' })]);
  });

  it('is a no-op when no line matches', () => {
    const written = appendNightFindings('', [entry()]);
    const updated = removeNightFindingLine(written, entry({ file: 'src/core/other.ts' }));
    expect(updated).toBe(written);
  });

  it('does not remove a plain suggestion line even with a coincidentally matching date', () => {
    const markdown = '- 2026-09-10: Some idea — a plain suggestion\n';
    expect(removeNightFindingLine(markdown, entry())).toBe(markdown);
  });
});

describe('buildNightReportGroups', () => {
  function nightReviewEntry(overrides: Partial<TaskLogEntry> = {}): TaskLogEntry {
    return {
      id: 'x',
      taskKind: 'night-review',
      planTitle: 'src/core · bugs',
      agentId: 'claude-code',
      startedAt: '2026-09-10T02:00:00.000Z',
      endedAt: '2026-09-10T02:01:00.000Z',
      outcome: 'done',
      usage: {
        durationMs: 60_000,
        numTurns: 4,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0.12,
      },
      ...overrides,
    };
  }

  it('groups findings and passes by date, summing cost and counting passes', () => {
    const groups = buildNightReportGroups(
      [entry({ date: '2026-09-10' })],
      [
        nightReviewEntry({ id: '1' }),
        nightReviewEntry({ id: '2', usage: { ...nightReviewEntry().usage!, costUsd: 0.08 } }),
      ],
    );
    expect(groups).toEqual([
      {
        date: '2026-09-10',
        passCount: 2,
        costUsd: 0.2,
        findings: [entry({ date: '2026-09-10' })],
      },
    ]);
  });

  it('includes a date with passes but no confirmed findings', () => {
    const groups = buildNightReportGroups([], [nightReviewEntry()]);
    expect(groups).toEqual([{ date: '2026-09-10', passCount: 1, costUsd: 0.12, findings: [] }]);
  });

  it('ignores task log entries of other kinds', () => {
    const groups = buildNightReportGroups(
      [],
      [nightReviewEntry({ taskKind: 'phase' }), nightReviewEntry({ taskKind: 'audit' })],
    );
    expect(groups).toEqual([]);
  });

  it('sorts groups by date, most recent first', () => {
    const groups = buildNightReportGroups(
      [entry({ date: '2026-09-08' }), entry({ date: '2026-09-10' })],
      [],
    );
    expect(groups.map((g) => g.date)).toEqual(['2026-09-10', '2026-09-08']);
  });
});

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function initGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-night-suggestions-'));
  dirs.push(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  await mkdir(join(root, 'src', 'core'), { recursive: true });
  await mkdir(join(root, 'papercamp'), { recursive: true });
  await writeFile(join(root, 'src', 'core', 'a.ts'), 'export const a = 1;\n', 'utf-8');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'seed');
  return root;
}

describe('readNightFindings', () => {
  it('keeps a finding whose file has not changed since its commit', async () => {
    const root = await initGitRepo();
    const commit = git(root, 'rev-parse', 'HEAD');
    await writeFile(
      join(root, 'papercamp', 'suggestions.md'),
      appendNightFindings('', [entry({ file: 'src/core/a.ts', commit })]),
      'utf-8',
    );

    expect(await readNightFindings(root)).toEqual([entry({ file: 'src/core/a.ts', commit })]);
  });

  it('expires a finding whose file changed after its commit', async () => {
    const root = await initGitRepo();
    const commit = git(root, 'rev-parse', 'HEAD');
    await writeFile(join(root, 'src', 'core', 'a.ts'), 'export const a = 2;\n', 'utf-8');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'change a.ts');
    await writeFile(
      join(root, 'papercamp', 'suggestions.md'),
      appendNightFindings('', [entry({ file: 'src/core/a.ts', commit })]),
      'utf-8',
    );

    expect(await readNightFindings(root)).toEqual([]);
  });

  it('is empty when there is no suggestions.md yet', async () => {
    const root = await initGitRepo();
    expect(await readNightFindings(root)).toEqual([]);
  });
});
