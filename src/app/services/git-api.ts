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

export const createPlanBranch = async (planId: string): Promise<string> => {
  const response = await fetch(apiUrl('/api/git/branch'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Failed to create branch');
  return data.branch as string;
};
