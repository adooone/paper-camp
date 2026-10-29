import { findFocusPlan } from '@/app/features/plans/helpers';
import { readCommitConvention } from '@/core/commit-convention';
import { readCorpus } from '@/core/corpus';
import { readBranches, readFirstParentLog } from '@/core/git-log';
import { squashMergePr } from '@/core/git-pr';
import { entityToPlan, readEntities } from '@/core/readers';
import type { GitSyncFailure } from '@/types/index';
import type { AgentManager } from '../agent';
import { suggestCommitMessage } from '../commit-suggest';
import { FetchFailedError } from '../git';
import { launchResolveConflict } from '../git-chat';
import { planFile } from '../helpers';
import { readJson, requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

// A genuine content conflict needs domain judgement, so it's never auto-escalated —
// the client offers a one-click "ask the agent to resolve" instead (/api/git/resolve-conflict).
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
  const recovery = agent.launch(
    'sync',
    { planTitle: 'Recover sync to main' },
    result.recoveryPrompt,
  );
  return {
    error: result.message,
    stage: result.stage,
    stashPending: result.stashPending,
    recovering: recovery.ok,
    recoveryError: recovery.ok ? undefined : recovery.error,
  };
}

export function gitRoutes({ root, git, agent, activity }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/git/status',
      handle: async (_req, res) => {
        const [snapshot, stashes] = await Promise.all([git.getStatusSnapshot(), git.getStashes()]);
        const hygiene = await git.getBranchHygieneStatus(snapshot);
        // No `# branch.ab` header means no upstream; fall back to the same
        // mainRef()-based divergence `getBranchHygieneStatus` already computed.
        const ahead = snapshot.hasUpstream ? snapshot.ahead : hygiene.ahead;
        const behind = snapshot.hasUpstream ? snapshot.behind : hygiene.behind;
        sendJson(res, 200, {
          branch: snapshot.branch,
          entries: snapshot.entries,
          ahead,
          behind,
          diverged: ahead > 0 && behind > 0,
          branchHygiene: hygiene.status,
          stashPending: stashes.some((stash) => stash.own),
          stashes,
        });
      },
    },

    {
      method: 'POST',
      path: '/api/git/branch',
      handle: async (req, res) => {
        try {
          const { planId } = (await readJson<{ planId?: string }>(req)) ?? {};
          if (!planId) {
            sendJson(res, 400, { error: 'planId is required' });
            return;
          }
          const { entries } = await readEntities(planFile(root, 'ideas'));
          const entity = entries.find((e) => e.id === planId && e.kind !== 'note');
          if (!entity) {
            sendJson(res, 404, { error: 'entity not found' });
            return;
          }
          const warning = await git.ensureBranch(entityToPlan(entity));
          activity.notifyChanged();
          sendJson(res, 200, { ok: true, branch: git.getCurrentBranch(), warning });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },

    // The tree is checked before the merge, not after, so a dirty tree never lands
    // a merge it then can't switch away from cleanly.
    {
      method: 'POST',
      path: '/api/git/complete-idea',
      handle: async (req, res) => {
        try {
          const { planId } = (await readJson<{ planId?: string }>(req)) ?? {};
          if (!planId) {
            sendJson(res, 400, { error: 'planId is required' });
            return;
          }
          const { work } = await readCorpus(root, { live: true });
          const plan = work.find((e) => e.id === planId);
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
          activity.notifyChanged();
          // The PR merged upstream at this point, so a failure below is reported as
          // merged-but-unfinished rather than rolled into the generic 409 catch below.
          try {
            const { remoteDeleted } = await git.returnToMain();
            activity.notifyChanged();
            sendJson(res, 200, {
              ok: true,
              branch: git.getCurrentBranch(),
              remoteDeleted,
            });
          } catch (error) {
            activity.notifyChanged();
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
          const { planId } = (await readJson<{ planId?: string }>(req)) ?? {};
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
          activity.notifyChanged();
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
          const { files, title, message } =
            (await readJson<{
              files?: string[];
              title?: string;
              message?: string;
            }>(req)) ?? {};
          if (!title?.trim()) {
            sendJson(res, 400, { error: 'title is required' });
            return;
          }
          await git.commit(files ?? [], title.trim(), message?.trim());
          activity.notifyChanged();
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
          const { path } = (await readJson<{ path?: string }>(req)) ?? {};
          if (!path) {
            sendJson(res, 400, { error: 'path is required' });
            return;
          }
          await git.stagePath(path);
          activity.notifyChanged();
          sendJson(res, 200, { ok: true });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },

    {
      method: 'POST',
      path: '/api/git/stage-all',
      handle: async (_req, res) => {
        try {
          await git.stageAll();
          activity.notifyChanged();
          sendJson(res, 200, { ok: true });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },

    {
      method: 'POST',
      path: '/api/git/unstage-all',
      handle: async (_req, res) => {
        try {
          await git.unstageAll();
          activity.notifyChanged();
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
          const { path } = (await readJson<{ path?: string }>(req)) ?? {};
          if (!path) {
            sendJson(res, 400, { error: 'path is required' });
            return;
          }
          await git.unstagePath(path);
          activity.notifyChanged();
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
          activity.notifyChanged();
          sendJson(res, 200, { ok: true, state: await git.getLiveState() });
        } catch (error) {
          sendJson(res, 409, { error: (error as Error).message });
        }
      },
    },

    // Never launched automatically — only on explicit human confirmation of the
    // prompt /sync or /fix-divergence returned for stage: 'conflicted'.
    {
      method: 'POST',
      path: '/api/git/resolve-conflict',
      handle: async (req, res) => {
        try {
          const { prompt } = (await readJson<{ prompt?: string }>(req)) ?? {};
          if (!prompt) {
            sendJson(res, 400, { error: 'prompt is required' });
            return;
          }
          const result = await launchResolveConflict(prompt, git, agent);
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
          activity.notifyChanged();
          sendJson(res, 200, { ok: true, state: await git.getLiveState() });
        } catch (error) {
          if (error instanceof FetchFailedError) {
            sendJson(res, 502, { error: error.message });
            return;
          }
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
          activity.notifyChanged();
          sendJson(res, 200, { ok: true, state: await git.getLiveState() });
        } catch (error) {
          sendJson(res, 409, { error: (error as Error).message });
        }
      },
    },

    // The branch list only shows on a clean tree, so a dirty 409 here is the rare
    // case of a change landing between page load and the click.
    {
      method: 'POST',
      path: '/api/git/checkout',
      handle: async (req, res) => {
        try {
          const { branch } = (await readJson<{ branch?: string }>(req)) ?? {};
          if (!branch) {
            sendJson(res, 400, { error: 'branch is required' });
            return;
          }
          await git.checkoutBranch(branch);
          activity.notifyChanged();
          sendJson(res, 200, { ok: true, branch: git.getCurrentBranch() });
        } catch (error) {
          sendJson(res, 409, { error: (error as Error).message });
        }
      },
    },

    {
      method: 'GET',
      path: '/api/git/branches',
      handle: async (_req, res) => {
        sendJson(res, 200, await readBranches(root));
      },
    },

    {
      method: 'GET',
      path: '/api/git/log',
      handle: async (req, res) => {
        const skip = Number.parseInt(requestUrl(req).searchParams.get('skip') ?? '0', 10);
        const page = await readFirstParentLog(root, Number.isNaN(skip) ? 0 : skip);
        sendJson(res, 200, page);
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
          const { files } = (await readJson<{ files?: string[] }>(req)) ?? {};
          if (!files?.length) {
            sendJson(res, 400, { error: 'files is required' });
            return;
          }
          const diffText = await git.diff(files);
          const { work } = await readCorpus(root, { live: true });
          const activePlan = findFocusPlan(work);
          const suggestion = await suggestCommitMessage(
            diffText,
            activePlan?.id,
            (prompt) => agent.runReadOnlyPrompt('commit-suggest', prompt, 'Suggest commit message'),
            await readCommitConvention(root),
          );
          sendJson(res, 200, suggestion);
        } catch (error) {
          const kind = (error as { kind?: 'auth' }).kind;
          sendJson(res, 400, { error: (error as Error).message, ...(kind ? { kind } : {}) });
        }
      },
    },
  ];
}
