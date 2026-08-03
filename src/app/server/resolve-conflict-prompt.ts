import type { GitSyncFailure } from '@/types/index';

// Read-only assembly for the `resolve-conflict` task: unlike buildGitSyncRecoveryPrompt's
// broad "fix whatever's broken" prompt, this is scoped to one paused-then-aborted rebase —
// reproduce it, apply the same domain judgement a human would, and land it.
export function buildResolveConflictPrompt(
  failure: Pick<GitSyncFailure, 'conflictedFiles' | 'conflictRef' | 'conflictedContent'>,
  branch: string,
): string {
  const ref = failure.conflictRef ?? 'origin/main';
  const contentByPath = new Map(
    (failure.conflictedContent ?? []).map((entry) => [entry.path, entry.content]),
  );
  const filesBlock = (failure.conflictedFiles ?? [])
    .map((path) => {
      const content = contentByPath.get(path);
      if (!content) return `### ${path}\n(content unavailable)`;
      // A four-backtick fence survives the three-backtick fences that papercamp
      // markdown files themselves carry — a shorter fence would let file content
      // close it early and blur the line between data and instructions.
      const truncated = content.endsWith('... (truncated)');
      return `### ${path}${truncated ? ' (truncated)' : ''}\n\`\`\`\`\n${content}\n\`\`\`\``;
    })
    .join('\n\n');

  return `A rebase of \`${branch}\` onto \`${ref}\` hit a genuine content conflict and was aborted for safety before you were invoked. Reproduce it and land it.

Conflicted files, as last seen before the abort (re-running the rebase below reproduces the same markers):

${filesBlock}

Domain judgement to apply while resolving markers:
- \`papercamp/run-order.md\` lists in-flight plan ids, one per line. Keep the union of every line still relevant, but drop lines for plans that are already finished (done/dropped) rather than keeping stale entries.
- Any append-only log (e.g. \`papercamp/tasks.log\`) should keep both sides' entries — union them, don't pick one side over the other.
- For anything else, keep both real changes' intent where possible; if genuinely irreconcilable, leave it unresolved and explain the tradeoff instead of guessing.

Task:
1. Run \`git rebase '${ref}'\` yourself — it will hit the same conflict.
2. Resolve the markers in each conflicted file above, applying the judgement above.
3. \`git add\` the resolved files.
4. \`git rebase --continue\`. If a later commit in the same rebase hits another conflict, keep resolving it the same way until the rebase finishes.
5. If you cannot confidently resolve a conflict, run \`git rebase --abort\` to leave the repo clean and explain why instead of guessing.`;
}
