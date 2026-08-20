import type { FileDiffEntry, GitStatusResponse } from '@/types/index';
import { apiUrl } from './api-base';

// Sits above the server's own 30s cap so the server's command-named timeout
// error is what wins whenever a call stalls; this only covers a response
// that never arrives at all.
const GIT_TIMEOUT_MS = 45_000;

async function throwIfNotOk(response: Response, fallbackError: string): Promise<void> {
  if (response.ok) return;
  const err = await response.json().catch(() => ({ error: fallbackError }));
  throw new Error(err.error);
}

export const fetchGitStatus = async (): Promise<GitStatusResponse> => {
  const response = await fetch(apiUrl('/api/git/status'), {
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  await throwIfNotOk(response, 'Failed to load git status');
  return response.json();
};

export const fetchFileDiffs = async (): Promise<FileDiffEntry[]> => {
  const response = await fetch(apiUrl('/api/git/diff'), {
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  await throwIfNotOk(response, 'Failed to load diff');
  const data = await response.json();
  return data.files;
};

export const fetchStashDiff = async (index: number): Promise<string> => {
  const response = await fetch(apiUrl(`/api/git/stash-diff?index=${index}`), {
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  await throwIfNotOk(response, 'Failed to load stash diff');
  const data = await response.json();
  return data.patch;
};

export const commitChanges = async (
  files: string[],
  title: string,
  message?: string,
): Promise<void> => {
  const response = await fetch(apiUrl('/api/git/commit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, title, message }),
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  await throwIfNotOk(response, 'Commit failed');
};

export const stagePath = async (path: string): Promise<void> => {
  const response = await fetch(apiUrl('/api/git/stage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  await throwIfNotOk(response, 'Stage failed');
};

export const unstagePath = async (path: string): Promise<void> => {
  const response = await fetch(apiUrl('/api/git/unstage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  await throwIfNotOk(response, 'Unstage failed');
};

export const pushChanges = async (): Promise<void> => {
  const response = await fetch(apiUrl('/api/git/push'), {
    method: 'POST',
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  await throwIfNotOk(response, 'Push failed');
};

export const suggestCommitMessage = async (
  files: string[],
): Promise<{ title: string; message: string }> => {
  const response = await fetch(apiUrl('/api/git/suggest-commit-message'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  await throwIfNotOk(response, 'Failed to suggest a commit message');
  return response.json();
};

export type SyncResult =
  | { ok: true }
  // The deterministic path failed and a recovery agent was launched (or, if
  // `recovering` is false, failed to launch) instead of throwing at the caller.
  | { ok: false; recovering: boolean; message: string }
  // A genuine content conflict — never auto-escalated. `conflictPrompt` is fed
  // to resolveConflict() only on explicit "ask the agent to resolve" confirmation.
  | { ok: false; recovering: false; conflictPrompt: string; message: string };

export const syncToMain = async (): Promise<SyncResult> => {
  const response = await fetch(apiUrl('/api/git/sync'), {
    method: 'POST',
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  if (response.status === 202) {
    const data = await response.json();
    return data.conflictPrompt
      ? { ok: false, recovering: false, conflictPrompt: data.conflictPrompt, message: data.error }
      : { ok: false, recovering: data.recovering, message: data.error };
  }
  await throwIfNotOk(response, 'Sync failed');
  return { ok: true };
};

// Fast-forward the current branch from origin in place (no branch switch).
export const pullFromOrigin = async (): Promise<void> => {
  const response = await fetch(apiUrl('/api/git/pull'), {
    method: 'POST',
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  await throwIfNotOk(response, 'Pull failed');
};

// Rebase the current branch onto its diverged remote; on conflict the server
// hands off to a recovery agent instead of throwing (see SyncResult).
export const fixGitDivergence = async (): Promise<SyncResult> => {
  const response = await fetch(apiUrl('/api/git/fix-divergence'), {
    method: 'POST',
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  if (response.status === 202) {
    const data = await response.json();
    return data.conflictPrompt
      ? { ok: false, recovering: false, conflictPrompt: data.conflictPrompt, message: data.error }
      : { ok: false, recovering: data.recovering, message: data.error };
  }
  await throwIfNotOk(response, 'Fix failed');
  return { ok: true };
};

// Launches the resolve-conflict agent against a paused-then-aborted rebase — only
// called on explicit "ask the agent to resolve" confirmation from the sync-failed toast.
export const resolveConflict = async (prompt: string): Promise<{ ok: boolean; error?: string }> => {
  const response = await fetch(apiUrl('/api/git/resolve-conflict'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  try {
    return await response.json();
  } catch {
    return { ok: false, error: `Unexpected response (status ${response.status})` };
  }
};

// Squash-merges the plan's PR and returns to a current main — the one action
// that replaces "Approve & close" (IDEA-194); `deriveStatus` picks up `done`
// once the merged PR is re-read, so no status patch happens here.
export const completeIdea = async (
  planId: string,
): Promise<{ branch: string; remoteDeleted: boolean }> => {
  const response = await fetch(apiUrl('/api/git/complete-idea'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Failed to complete idea');
  return { branch: data.branch as string, remoteDeleted: data.remoteDeleted as boolean };
};

export const createPlanBranch = async (
  planId: string,
): Promise<{ branch: string; warning?: string }> => {
  const response = await fetch(apiUrl('/api/git/branch'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Failed to create branch');
  return { branch: data.branch as string, warning: data.warning as string | undefined };
};
