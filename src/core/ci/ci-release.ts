import { spawn } from 'node:child_process';
import type {
  CiReleaseState,
  CiRun,
  CiRunStatus,
  DeskCi,
  DraftPrReadiness,
  ReleasePr,
} from '../../types/index';

const DRAFT_PR_WORKFLOW_FILE = 'draft-pr.yml';

const GH_TIMEOUT_MS = 15_000;
const CI_CACHE_TTL_MS = 60_000;

interface GhRunRow {
  databaseId?: number;
  workflowName: string;
  status: string;
  conclusion: string;
  url: string;
  headBranch: string;
}

interface GhJobRow {
  name: string;
  conclusion: string;
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

interface GhSecretRow {
  name: string;
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

export function latestRunPerWorkflow(
  rows: GhRunRow[],
  branch: string,
): (CiRun & { runId?: number })[] {
  const seen = new Set<string>();
  const runs: (CiRun & { runId?: number })[] = [];
  for (const row of rows) {
    if (row.headBranch !== branch || seen.has(row.workflowName)) continue;
    seen.add(row.workflowName);
    runs.push({
      workflow: row.workflowName,
      status: mapRunStatus(row.status, row.conclusion),
      url: row.url || null,
      ...(row.databaseId !== undefined && { runId: row.databaseId }),
    });
  }
  return runs;
}

export function failedJobNames(jobs: GhJobRow[]): string[] {
  return jobs.filter((job) => job.conclusion === 'failure').map((job) => job.name);
}

// Only a failed run is asked for its jobs — one extra `gh` call per red workflow.
async function withFailedJobs(
  repo: string,
  runs: (CiRun & { runId?: number })[],
): Promise<CiRun[]> {
  return Promise.all(
    runs.map(async ({ runId, ...run }) => {
      if (run.status !== 'failure' || runId === undefined) return run;
      const view = await ghJson<{ jobs?: GhJobRow[] }>([
        'run',
        'view',
        String(runId),
        '-R',
        repo,
        '--json',
        'jobs',
      ]);
      const failedJobs = failedJobNames(view?.jobs ?? []);
      return failedJobs.length > 0 ? { ...run, failedJobs } : run;
    }),
  );
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

// The Draft PR workflow runs on idea branches, not the tracked branch, so its latest
// run is picked across all branches rather than filtered by `latestRunPerWorkflow`.
export function latestDraftPrRun(rows: GhRunRow[]): CiRun | null {
  const row = rows[0];
  if (!row) return null;
  return {
    workflow: row.workflowName,
    status: mapRunStatus(row.status, row.conclusion),
    url: row.url || null,
  };
}

export function hasSecret(rows: GhSecretRow[], name: string): boolean {
  return rows.some((row) => row.name === name);
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

  const [runRows, prRows, releaseRows, draftPrRunRows, draftPrSecretRows] = await Promise.all([
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
      'databaseId,workflowName,status,conclusion,url,headBranch',
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
    ci.draftPr
      ? ghJson<GhRunRow[]>([
          'run',
          'list',
          '-R',
          ci.repo,
          '--workflow',
          DRAFT_PR_WORKFLOW_FILE,
          '--limit',
          '1',
          '--json',
          'databaseId,workflowName,status,conclusion,url,headBranch',
        ])
      : Promise.resolve<GhRunRow[] | undefined>(undefined),
    ci.draftPr
      ? ghJson<{ secrets: GhSecretRow[] }>(['api', `repos/${ci.repo}/actions/secrets`])
      : Promise.resolve<{ secrets: GhSecretRow[] } | undefined>(undefined),
  ]);

  const available = runRows !== undefined || prRows !== undefined || releaseRows !== undefined;
  const releasedTag = releaseRows?.[0]?.tagName ?? null;

  const draftPr: DraftPrReadiness | null = ci.draftPr
    ? {
        scoutAppId: hasSecret(draftPrSecretRows?.secrets ?? [], 'SCOUT_APP_ID'),
        scoutPrivateKey: hasSecret(draftPrSecretRows?.secrets ?? [], 'SCOUT_PRIVATE_KEY'),
        lastRun: draftPrRunRows ? latestDraftPrRun(draftPrRunRows) : null,
      }
    : null;

  const state: CiReleaseState = {
    repo: ci.repo,
    branch,
    available,
    runs: runRows ? await withFailedJobs(ci.repo, latestRunPerWorkflow(runRows, branch)) : [],
    releasePr: prRows ? pickReleasePr(prRows) : null,
    releasedVersion: releasedTag ? releasedTag.replace(/^v/, '') : null,
    draftPr,
  };

  if (available) cache.set(key, { state, fetchedAt: Date.now() });
  return state;
}
