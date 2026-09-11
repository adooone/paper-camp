import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function runGitOrThrow(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else
        reject(new Error(`git ${args.join(' ')} failed: ${stderr.trim() || `exit code ${code}`}`));
    });
    proc.on('error', reject);
  });
}

export async function addNightWorktree(root: string, commit: string): Promise<string> {
  const worktreePath = await mkdtemp(join(tmpdir(), 'paper-camp-night-'));
  await runGitOrThrow(root, ['worktree', 'add', '--detach', worktreePath, commit]);
  return worktreePath;
}

export async function removeNightWorktree(root: string, worktreePath: string): Promise<void> {
  try {
    await runGitOrThrow(root, ['worktree', 'remove', '--force', worktreePath]);
  } catch {
    await rm(worktreePath, { recursive: true, force: true }).catch(() => {});
    await runGitOrThrow(root, ['worktree', 'prune']).catch(() => {});
  }
}

export async function resolveHeadCommit(root: string): Promise<string> {
  return (await runGitOrThrow(root, ['rev-parse', 'HEAD'])).trim();
}

export async function listChunkFiles(
  root: string,
  commit: string,
  chunkPath: string,
): Promise<string[]> {
  const output = await runGitOrThrow(root, [
    'ls-tree',
    '-r',
    '--name-only',
    commit,
    '--',
    chunkPath,
  ]);
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function diffChunkSinceCommit(
  root: string,
  chunkPath: string,
  sinceCommit: string | null,
  reviewedCommit: string,
): Promise<string> {
  if (!sinceCommit) return '';
  return runGitOrThrow(root, ['diff', sinceCommit, reviewedCommit, '--', chunkPath]);
}

export async function hasFileChangedSince(
  root: string,
  file: string,
  commit: string,
): Promise<boolean> {
  const output = await runGitOrThrow(root, ['diff', '--name-only', commit, 'HEAD', '--', file]);
  return output.trim() !== '';
}
