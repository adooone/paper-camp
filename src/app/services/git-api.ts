import type { GitStatusResponse } from '@/types/index';

// Shared error-unwrap for the git API calls — unwrap the server's { error } body
// (falling back to a generic message) and throw it. Extracted per the "3 copies" rule.
async function throwIfNotOk(response: Response, fallbackError: string): Promise<void> {
  if (response.ok) return;
  const err = await response.json().catch(() => ({ error: fallbackError }));
  throw new Error(err.error);
}

export const fetchGitStatus = async (): Promise<GitStatusResponse> => {
  const response = await fetch('/api/git/status');
  await throwIfNotOk(response, 'Failed to load git status');
  return response.json();
};

export const commitChanges = async (
  files: string[],
  title: string,
  message?: string,
): Promise<void> => {
  const response = await fetch('/api/git/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, title, message }),
  });
  await throwIfNotOk(response, 'Commit failed');
};

export const pushChanges = async (): Promise<void> => {
  const response = await fetch('/api/git/push', { method: 'POST' });
  await throwIfNotOk(response, 'Push failed');
};

export const suggestCommitMessage = async (
  files: string[],
): Promise<{ title: string; message: string }> => {
  const response = await fetch('/api/git/suggest-commit-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  await throwIfNotOk(response, 'Failed to suggest a commit message');
  return response.json();
};

export const syncToMain = async (mode: 'clean' | 'dirty'): Promise<void> => {
  const response = await fetch('/api/git/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  await throwIfNotOk(response, 'Sync failed');
};
