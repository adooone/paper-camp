import type { CiReleaseState, CiRunStatus } from '@/types/index';

export interface RepoGit {
  branch: string;
  changed: number;
  ahead: number;
  behind: number;
}

export interface RepoCommit {
  subject: string;
  date: string;
}

export const RUN_WORD: Record<CiRunStatus, string> = {
  success: 'passed',
  failure: 'failed',
  in_progress: 'running',
  queued: 'queued',
  cancelled: 'cancelled',
  unknown: 'unknown',
};

export function repoProgress({ branch, changed, ahead, behind }: RepoGit): string {
  return [
    branch,
    changed === 0 ? 'clean' : `${changed} changed`,
    ahead > 0 ? `ahead ${ahead}` : null,
    behind > 0 ? `behind ${behind}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function releaseLine(ci: CiReleaseState): string {
  const queued = ci.releasePr
    ? `${ci.releasePr.version ?? ci.releasePr.title} queued`
    : 'nothing queued';
  return `${ci.releasedVersion ?? 'unreleased'} · ${queued}`;
}

export function relativeDay(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.round((now - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}
