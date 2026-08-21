import { findFocusPlan } from '@/app/features/plans/helpers';
import { squashMergePr } from '@/core/git-pr';
import { entityToPlan, readEntities, readWorkEntries } from '@/core/readers';
import type { GitSyncFailure } from '@/types/index';
import type { AgentManager } from '../agent';
import { suggestCommitMessage } from '../commit-suggest';
import { campFile } from '../helpers';
import { readBody, requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

// A genuine content conflict needs domain judgement, so it's never auto-escalated —
// the client offers a one-click "ask the agent to resolve" instead (see
// /api/git/resolve-conflict) so a bad auto-merge never lands unseen. Any other
// reconcile failure (fetch, checkout, ...) still gets the automatic recovery agent.
function syncFailurePayload(result: GitSyncFailure, agent: AgentManager) {
  if (result.stage === 'conflicted') {
    return {
      error: result.message,
      stage: result.stage,
      stashPending: result.stashPending,
      recovering: false,
      conflictedFiles: result.conflictedFiles,
      conflictPrompt: result.conflictPrompt,
    };
  }
  const recovery = agent.startGitSyncRecovery(result.recoveryPrompt);
  return {
    error: result.message,
    stage: result.stage,
    stashPending: result.stashPending,
    recovering: recovery.ok,
    recoveryError: recovery.ok ? undefined : recovery.error,
  };
}

export function gitRoutes({ root, git, agent }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/git/status',
      handle: async (_req, res) => {
        const branch = git.getCurrentBranch();
        // getStatus and getBranchHygieneStatus both run `git status`, which races on
        // .git/index.lock if run concurrently; getAheadCount/getBehindCount's `git
        // rev-list` doesn't.
        const [entries, ahead, behind, stashPending, stashes] = await Promise.all([
          git.getStatus(),
          git.getAheadCount(),
          git.getBehindCount(),
          git.hasPendingSyncStash(),
          git.getStashes(),
        ]);
        const branchHygiene = await git.getBranchHygieneStatus();
        sendJson(res, 200, {
          branch,
          entries,
          ahead,
          behind,
          diverged: ahead > 0 && behind > 0,
          branchHygiene,
          stashPending,
          stashes,
        });
      },
    },

    {
      method: 'POST',
      path: '/api/git/branch',
      handle: async (req, res) => {
        try {
          const body = await readBody(req);
          const { planId } = JSON.parse(body) as { planId?: string };
          if (!planId) {
            sendJson(res, 400, { error: 'planId is required' });
            return;
          }
          const { entries } = await readEntities(campFile(root, 'ideas'));
          const entity = entries.find((e) => e.id === planId && e.kind !== 'note');
          if (!entity) {
            sendJson(res, 404, { error: 'entity not found' });
            return;
          }
          const warning = await git.ensureBranch(entityToPlan(entity));
          sendJson(res, 200, { ok: true, branch: git.getCurrentBranch(), warning });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },

    // Squash-merges the plan's PR, then returns to a current main — the tree is
    // checked before the merge, not after, so a dirty tree never lands a merge it
    // then can't switch away from cleanly.
    {
      method: 'POST',
      path: '/api/git/complete-idea',
      handle: async (req, res) => {
        try {
          const body = await readBody(req);
          const { planId } = JSON.parse(body) as { planId?: string };
          if (!planId) {
            sendJson(res, 400, { error: 'planId is required' });
            return;
          }
          const { entries } = await readWorkEntries(campFile(root, 'ideas'));
          const plan = entries.find((e) => e.id === planId);
          if (!plan) {
            sendJson(res, 404, { error: 'entity not found' });
            return;
          }
          if (!plan.pr) {
            sendJson(res, 400, { error: `${planId} has no PR to merge` });
            return;
          }
          if (git.getFeatureBranchPlanId() !== planId) {
            sendJson(res, 409, {
              error: `Not on ${planId}'s branch — check it out before completing it`,
            });
            return;
          }
          await git.assertCleanWorkingTree();
          const featureBranch = git.getCurrentBranch();
          const merge = await squashMergePr(root, String(plan.pr.number));
          if (!merge.ok) {
            sendJson(res, 409, { error: merge.message });
            return;
          }
          // The PR merged upstream at this point — a failure below must not read
          // as "nothing happened", since it isn't. It's reported as merged-but-
          // unfinished rather than rolled into the generic 409 catch below.
          try {
            const { remoteDeleted } = await git.returnToMain();
            sendJson(res, 200, {
              ok: true,
              branch: git.getCurrentBranch(),
              remoteDeleted,
            });
          } catch (error) {
            sendJson(res, 200, {
              ok: true,
              merged: true,
              branch: git.getCurrentBranch(),
              needsAttention: `${planId}'s PR merged, but returning to main failed: ${(error as Error).message}. Run \`git fetch origin main && git checkout main && git merge --ff-only origin/main\`, then delete branch ${featureBranch} locally and on the remote.`,
            });
          }
        } catch (error) {
          sendJson(res, 409, { error: (error as Error).message });
        }
      },
    },

    {
      method: 'POST',
      path: '/api/git/verify-direct-completion',
      handle: async (req, res) => {
        try {
          const body = await readBody(req);
          const { planId } = JSON.parse(body) as { planId?: string };
          if (!planId) {
            sendJson(res, 400, { error: 'planId is required' });
            return;
          }
          const result = await git.verifyDirectCompletion(planId);
          sendJson(res, 200, result);
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },

    {
      method: 'POST',
      path: '/api/git/push',
      handle: async (_req, res) => {
        try {
          await git.push();
          sendJson(res, 200, { ok: true, state: await git.getLiveState() });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },

    {
      method: 'POST',
      path: '/api/git/commit',
      handle: async (req, res) => {
        try {
          const body = await readBody(req);
          const { files, title, message } = JSON.parse(body) as {
            files: string[];
            title: string;
            message?: string;
          };
          if (!title?.trim()) {
            sendJson(res, 400, { error: 'title is required' });
            return;
          }
          await git.commit(files ?? [], title.trim(), message?.trim());
          sendJson(res, 200, { ok: true });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },

    {
      method: 'POST',
      path: '/api/git/stage',
      handle: async (req, res) => {
        try {
          const body = await readBody(req);
          const { path } = JSON.parse(body) as { path?: string };
          if (!path) {
            sendJson(res, 400, { error: 'path is required' });
            return;
          }
          await git.stagePath(path);
          sendJson(res, 200, { ok: true });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },

    {
      method: 'POST',
      path: '/api/git/unstage',
      handle: async (req, res) => {
        try {
          const body = await readBody(req);
          const { path } = JSON.parse(body) as { path?: string };
          if (!path) {
            sendJson(res, 400, { error: 'path is required' });
            return;
          }
          await git.unstagePath(path);
          sendJson(res, 200, { ok: true });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },

    {
      method: 'POST',
      path: '/api/git/sync',
      handle: async (_req, res) => {
        try {
          const result = await git.runGitSync();
          if (!result.ok) {
            sendJson(res, 202, syncFailurePayload(result, agent));
            return;
          }
          sendJson(res, 200, { ok: true, state: await git.getLiveState() });
        } catch (error) {
          sendJson(res, 409, { error: (error as Error).message });
        }
      },
    },

    // One-click "ask the agent to resolve" from the sync-failed toast — never
    // launched automatically, only on explicit human confirmation of the prompt
    // /sync or /fix-divergence returned for stage: 'conflicted'.
    {
      method: 'POST',
      path: '/api/git/resolve-conflict',
      handle: async (req, res) => {
        try {
          const body = await readBody(req);
          const { prompt } = JSON.parse(body) as { prompt?: string };
          if (!prompt) {
            sendJson(res, 400, { error: 'prompt is required' });
            return;
          }
          const result = agent.startResolveConflict(prompt);
          sendJson(res, result.ok ? 200 : 409, result);
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },

    // Plain fast-forward pull of the current branch — distinct from /sync, which
    // switches to main first.
    {
      method: 'POST',
      path: '/api/git/pull',
      handle: async (_req, res) => {
        try {
          await git.runGitPull();
          sendJson(res, 200, { ok: true, state: await git.getLiveState() });
        } catch (error) {
          sendJson(res, 409, { error: (error as Error).message });
        }
      },
    },

    // "Fix git issues" — rebase the current branch onto its diverged remote;
    // escalates to the recovery agent on conflict, same as /sync.
    {
      method: 'POST',
      path: '/api/git/fix-divergence',
      handle: async (_req, res) => {
        try {
          const result = await git.fixDivergence();
          if (!result.ok) {
            sendJson(res, 202, syncFailurePayload(result, agent));
            return;
          }
          sendJson(res, 200, { ok: true, state: await git.getLiveState() });
        } catch (error) {
          sendJson(res, 409, { error: (error as Error).message });
        }
      },
    },

    {
      method: 'GET',
      path: '/api/git/diff',
      handle: async (_req, res) => {
        const files = await git.getWorkingDiff();
        sendJson(res, 200, { files });
      },
    },

    {
      method: 'GET',
      path: '/api/git/stash-diff',
      handle: async (req, res) => {
        const index = Number.parseInt(requestUrl(req).searchParams.get('index') ?? '', 10);
        if (Number.isNaN(index)) {
          sendJson(res, 400, { error: 'index is required' });
          return;
        }
        try {
          const patch = await git.showStash(index);
          sendJson(res, 200, { patch });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },

    {
      method: 'POST',
      path: '/api/git/suggest-commit-message',
      handle: async (req, res) => {
        try {
          const body = await readBody(req);
          const { files } = JSON.parse(body) as { files?: string[] };
          if (!files?.length) {
            sendJson(res, 400, { error: 'files is required' });
            return;
          }
          const diffText = await git.diff(files);
          const { entries } = await readWorkEntries(campFile(root, 'ideas'));
          const activePlan = findFocusPlan(entries);
          const suggestion = await suggestCommitMessage(
            diffText,
            activePlan?.id,
            agent.runCommitSuggest,
          );
          sendJson(res, 200, suggestion);
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },
  ];
}
