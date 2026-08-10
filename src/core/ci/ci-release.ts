import { spawn } from 'node:child_process';
import type { CiReleaseState, CiRun, CiRunStatus, DeskCi, ReleasePr } from '../../types/index';

const GH_TIMEOUT_MS = 15_000;
const CI_CACHE_TTL_MS = 60_000;

interface GhRunRow {
  workflowName: string;
  status: string;
  conclusion: string;
  url: string;
  headBranch: string;
}

interface GhPrRow {
  number: number;
  title: string;
  url: string;
  headRefName: string;
  labels: { name: string }[];
}

interface GhReleaseRow {
  tagName: string;
  isLatest?: boolean;
}

function ghJson<T>(args: string[]): Promise<T | undefined> {
  return new Promise((resolve) => {
    const proc = spawn('gh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      proc.kill();
      settle(() => resolve(undefined));
    }, GH_TIMEOUT_MS);
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => {
      settle(() => {
        if (code !== 0) {
          resolve(undefined);
          return;
        }
        try {
          resolve(JSON.parse(stdout) as T);
        } catch {
          resolve(undefined);
        }
      });
    });
    proc.on('error', () => settle(() => resolve(undefined)));
  });
}

export function mapRunStatus(status: string, conclusion: string): CiRunStatus {
  if (status !== 'completed') {
    return status === 'queued' ||
      status === 'requested' ||
      status === 'waiting' ||
      status === 'pending'
      ? 'queued'
      : 'in_progress';
  }
  switch (conclusion) {
    case 'success':
      return 'success';
    case 'failure':
    case 'timed_out':
    case 'startup_failure':
      return 'failure';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

export function parseVersion(text: string): string | null {
  const match = text.match(/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)/);
  return match ? match[1] : null;
}

export function latestRunPerWorkflow(rows: GhRunRow[], branch: string): CiRun[] {
  const seen = new Set<string>();
  const runs: CiRun[] = [];
  for (const row of rows) {
    if (row.headBranch !== branch || seen.has(row.workflowName)) continue;
    seen.add(row.workflowName);
    runs.push({
      workflow: row.workflowName,
      status: mapRunStatus(row.status, row.conclusion),
      url: row.url || null,
    });
  }
  return runs;
}

export function pickReleasePr(rows: GhPrRow[]): ReleasePr | null {
  const row = rows.find(
    (r) =>
      r.headRefName.startsWith('release-please--') ||
      r.labels.some((l) => l.name.startsWith('autorelease')),
  );
  if (!row) return null;
  return {
    number: row.number,
    title: row.title,
    url: row.url,
    version: parseVersion(row.title),
  };
}

const cache = new Map<string, { state: CiReleaseState; fetchedAt: number }>();

export function clearCiCache(): void {
  cache.clear();
}

export async function fetchCiReleaseState(
  ci: DeskCi,
  ttlMs = CI_CACHE_TTL_MS,
): Promise<CiReleaseState> {
  const branch = ci.branch ?? 'main';
  const key = `${ci.repo}#${branch}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.state;

  const [runRows, prRows, releaseRows] = await Promise.all([
    ghJson<GhRunRow[]>([
      'run',
      'list',
      '-R',
      ci.repo,
      '--branch',
      branch,
      '--limit',
      '20',
      '--json',
      'workflowName,status,conclusion,url,headBranch',
    ]),
    ci.releasePlease
      ? ghJson<GhPrRow[]>([
          'pr',
          'list',
          '-R',
          ci.repo,
          '--state',
          'open',
          '--limit',
          '30',
          '--json',
          'number,title,url,headRefName,labels',
        ])
      : Promise.resolve<GhPrRow[] | undefined>([]),
    ghJson<GhReleaseRow[]>(['release', 'list', '-R', ci.repo, '--limit', '1', '--json', 'tagName']),
  ]);

  const available = runRows !== undefined || prRows !== undefined || releaseRows !== undefined;
  const releasedTag = releaseRows?.[0]?.tagName ?? null;

  const state: CiReleaseState = {
    repo: ci.repo,
    branch,
    available,
    runs: runRows ? latestRunPerWorkflow(runRows, branch) : [],
    releasePr: prRows ? pickReleasePr(prRows) : null,
    releasedVersion: releasedTag ? releasedTag.replace(/^v/, '') : null,
  };

  if (available) cache.set(key, { state, fetchedAt: Date.now() });
  return state;
}
