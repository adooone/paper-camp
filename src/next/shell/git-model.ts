import type { BranchHygieneStatus, GitStatusEntry } from '@/types/index';
import type { StampMeaning } from '../ui/stamp';

export interface GitSync {
  ahead: number;
  behind: number;
  diverged: boolean;
}

export type GitAction = 'pull' | 'push' | 'sync' | 'fix-divergence';

export interface GitOutcome {
  ok: boolean;
  message: string;
  conflictedFiles?: string[];
  conflictPrompt?: string;
}

interface LabelledStamp {
  label: string;
  meaning: StampMeaning;
}

const HYGIENE: Record<string, LabelledStamp> = {
  fine: { label: 'clean', meaning: 'done' },
  'clean-on-main': { label: 'clean', meaning: 'done' },
  dirty: { label: 'dirty', meaning: 'parked' },
  'stale-merged': { label: 'stale', meaning: 'failed' },
};

export function hygieneStamp(hygiene: BranchHygieneStatus): LabelledStamp {
  return HYGIENE[hygiene] ?? { label: hygiene.replace(/-/g, ' '), meaning: 'idle' };
}

export function describeSync({ ahead, behind }: GitSync): string {
  const parts = [
    ahead > 0 ? `${ahead} to push` : null,
    behind > 0 ? `${behind} to pull` : null,
  ].filter(Boolean);
  return parts.length === 0 ? 'Up to date with the remote' : parts.join(' · ');
}

export function syncStamp({ ahead, behind, diverged }: GitSync): LabelledStamp {
  if (diverged) return { label: 'diverged', meaning: 'failed' };
  if (ahead === 0 && behind === 0) return { label: 'synced', meaning: 'done' };
  const label = [ahead > 0 ? `↑${ahead}` : null, behind > 0 ? `↓${behind}` : null]
    .filter(Boolean)
    .join(' ');
  return { label, meaning: 'parked' };
}

export function describeDivergence({ ahead }: GitSync, changed: number): string {
  const commits = ahead === 1 ? 'your commit' : `your ${ahead} commits`;
  const rebase = `Fix divergence replays ${commits} on top of the remote; Push appears once that is done.`;
  const refused = 'The remote has moved on, so a push would be refused.';
  return changed > 0
    ? `${refused} The rebase needs a clean tree: commit the changes first, then ${rebase}`
    : `${refused} ${rebase}`;
}

export function describeEntryStatus(entry: GitStatusEntry): LabelledStamp {
  const code = entry.status;
  if (code === '??') return { label: 'new', meaning: 'parked' };
  if (code.includes('U') || code === 'AA' || code === 'DD') {
    return { label: 'conflict', meaning: 'failed' };
  }
  const index = code[0] ?? ' ';
  const tree = code[1] ?? ' ';
  const flag = index !== ' ' ? index : tree;
  if (flag === 'A') return { label: 'added', meaning: 'done' };
  if (flag === 'D') return { label: 'deleted', meaning: 'failed' };
  if (flag === 'R') return { label: 'renamed', meaning: 'running' };
  if (flag === 'C') return { label: 'copied', meaning: 'running' };
  return entry.staged
    ? { label: 'staged', meaning: 'done' }
    : { label: 'modified', meaning: 'running' };
}

export const ACTION_DONE: Record<GitAction, string> = {
  pull: 'Pulled.',
  push: 'Pushed.',
  sync: 'Synced to main.',
  'fix-divergence': 'Rebased onto the remote.',
};

export const ACTION_BUSY: Record<GitAction, string> = {
  pull: 'Pulling…',
  push: 'Pushing…',
  sync: 'Syncing…',
  'fix-divergence': 'Rebasing…',
};

export const ACTION_IDLE: Record<GitAction, string> = {
  pull: 'Pull',
  push: 'Push',
  sync: 'Sync to main',
  'fix-divergence': 'Fix divergence',
};

export const CONFLICT_MESSAGE =
  'The rebase stopped on a conflict. Hand it to an agent, or resolve it on the machine.';

export function commitEyebrow(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' · ');
}
