import type { GitStatusResponse } from '@/types/index';

export const fetchGitStatus = async (): Promise<GitStatusResponse> => {
  const response = await fetch('/api/git/status');
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to load git status' }));
    throw new Error(err.error);
  }
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
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Commit failed' }));
    throw new Error(err.error);
  }
};

export const pushChanges = async (): Promise<void> => {
  const response = await fetch('/api/git/push', { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Push failed' }));
    throw new Error(err.error);
  }
};

export const suggestCommitMessage = async (
  files: string[],
): Promise<{ title: string; message: string }> => {
  const response = await fetch('/api/git/suggest-commit-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: 'Failed to suggest a commit message' }));
    throw new Error(err.error);
  }
  return response.json();
};
