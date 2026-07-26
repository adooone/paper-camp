import { spawn } from 'node:child_process';
import type { MergePolicyResult } from '../../types';

interface ProbeResult {
  code: number | null;
  stdout: string;
}

const GH_TIMEOUT_MS = 15_000;

function runGh(args: string[], cwd: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const proc = spawn('gh', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: GH_TIMEOUT_MS,
      killSignal: 'SIGTERM',
    });
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    // Drain stderr — an unread pipe can fill and hang the subprocess.
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => resolve({ code, stdout }));
    proc.on('error', () => resolve({ code: null, stdout: '' }));
  });
}

async function resolveRepoSlug(root: string): Promise<string | undefined> {
  const result = await runGh(['repo', 'view', '--json', 'nameWithOwner'], root);
  if (result.code !== 0) return undefined;
  try {
    const parsed = JSON.parse(result.stdout) as { nameWithOwner?: string };
    return parsed.nameWithOwner;
  } catch {
    return undefined;
  }
}

interface GhRepoResponse {
  allow_squash_merge: boolean;
  allow_merge_commit: boolean;
  allow_rebase_merge: boolean;
  squash_merge_commit_title: string;
  squash_merge_commit_message: string;
}

export async function getMergePolicy(root: string): Promise<MergePolicyResult> {
  const repo = await resolveRepoSlug(root);
  if (!repo) {
    return {
      status: 'unavailable',
      reason:
        'gh CLI is missing, unauthenticated, or the repository has no reachable GitHub origin',
    };
  }
  const result = await runGh(['api', `repos/${repo}`], root);
  if (result.code !== 0) {
    return { status: 'unavailable', reason: `gh api repos/${repo} failed` };
  }
  try {
    const parsed = JSON.parse(result.stdout) as GhRepoResponse;
    return {
      status: 'ok',
      repo,
      policy: {
        allowSquashMerge: parsed.allow_squash_merge,
        allowMergeCommit: parsed.allow_merge_commit,
        allowRebaseMerge: parsed.allow_rebase_merge,
        squashMergeCommitTitle: parsed.squash_merge_commit_title,
        squashMergeCommitMessage: parsed.squash_merge_commit_message,
      },
    };
  } catch {
    return { status: 'unavailable', reason: `could not parse gh api response for ${repo}` };
  }
}
