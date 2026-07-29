import type { GitStatusEntry, GitSyncFailure } from '@/types/index';

// Read-only assembly: turns a deterministic sync failure into everything an agent
// needs to finish the job with judgment, since the fast path (git.ts's runGitSync)
// gives up rather than guessing at a stash conflict or diverged rebase.
export function buildGitSyncRecoveryPrompt(
  failure: Pick<GitSyncFailure, 'stage' | 'message' | 'stashPending'>,
  branch: string,
  status: GitStatusEntry[],
): string {
  const statusList = status.length
    ? status.map((entry) => `${entry.status} ${entry.path}`).join('\n')
    : '(clean)';

  return `The deterministic sync-to-main path failed and needs your judgment to finish it. Goal: get this repo onto the latest origin/main without losing any real work — uncommitted changes, stashed changes, or commits that only exist locally.

Where it failed: the "${failure.stage}" step of the fetch / drop-disposable-changes / stash / merge-or-rebase / pop sequence.
Git's error: ${failure.message}

Current branch: ${branch}
${
  failure.stashPending
    ? 'A stash from this attempt is still on the stack (`git stash list`) — it must be popped or its contents otherwise recovered, not dropped.'
    : 'No stash is pending from this attempt.'
}

Working tree status (\`git status --porcelain\`) at the time of failure:
${statusList}

Task:
1. Inspect the actual state of the repo yourself — \`git status\`, \`git stash list\`, \`git log\`, \`git diff\` — rather than trusting the summary above as complete; it may have changed since the failure.
2. Resolve whatever the deterministic path could not: a stash that will not pop cleanly, files already present where the switch wanted to write, a rebase conflict on a diverged branch, or anything else blocking the way onto latest main.
3. End with the working tree on \`main\`, up to date with \`origin/main\`, and with every piece of real local work either merged in, or still present (as a stash, a commit, or a working-tree change) with nothing silently discarded.
4. If a conflict requires a judgment call between two versions of a real change, resolve it in favor of keeping both intents where possible; if genuinely irreconcilable, leave the conflict markers unresolved and explain the tradeoff instead of guessing.

Do not force-push, do not \`git reset --hard\` away anything not already safely captured elsewhere, and do not drop a stash you have not first confirmed is safe to lose.`;
}
