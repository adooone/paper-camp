import { findFocusPlan } from '@/app/features/plans/helpers';
import { entityToPlan, readEntities, readWorkEntries } from '@/core/readers';
import { suggestCommitMessage } from '../commit-suggest';
import { campFile } from '../helpers';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

const DIRTY_SYNC_PROMPT = `Sync the current branch to main by:
1. Stashing or committing any uncommitted changes (do not use \`git reset --hard\` or \`git clean -fd\` without an explicit confirmation step)
2. Relocating any mis-filed content (e.g., any new entities written to a legacy path like \`papercamp/plans.md\` or \`papercamp/plans/\` instead of per-file \`papercamp/ideas/*.md\`)
3. Checking out main: \`git checkout main\`
4. Fetching from origin: \`git fetch --prune\`
5. Fast-forwarding the merge: \`git merge --ff-only origin/main\`
6. Confirming success

Report the final branch and status to verify the sync completed.`;

export function gitRoutes({ root, git, agent }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/git/status',
      handle: async (_req, res) => {
        const branch = git.getCurrentBranch();
        // getStatus and getBranchHygieneStatus both run `git status` under the hood;
        // running them concurrently races on .git/index.lock. getAheadCount spawns an
        // unrelated `git rev-list`, so it stays parallel with the first status call.
        const [entries, ahead] = await Promise.all([git.getStatus(), git.getAheadCount()]);
        const branchHygiene = await git.getBranchHygieneStatus();
        sendJson(res, 200, { branch, entries, ahead, branchHygiene });
      },
    },

    // Branch management is manual: nothing else in the app switches branches.
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
          git.ensureBranch(entityToPlan(entity));
          sendJson(res, 200, { ok: true, branch: git.getCurrentBranch() });
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
          sendJson(res, 200, { ok: true });
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
      path: '/api/git/sync',
      handle: async (req, res) => {
        const body = await readBody(req);
        const { mode } = JSON.parse(body) as { mode?: string };
        if (mode !== 'clean' && mode !== 'dirty') {
          sendJson(res, 400, { error: "mode must be 'clean' or 'dirty'" });
          return;
        }

        if (mode === 'clean') {
          // Re-verify cleanliness server-side — the client's `mode` is derived from
          // a possibly-stale status snapshot, and checking out main against an
          // actually-dirty tree could fail confusingly or carry changes onto main.
          const currentStatus = await git.getStatus();
          if (currentStatus.length > 0) {
            sendJson(res, 409, { error: 'Working tree is no longer clean — refresh and retry' });
            return;
          }
          await git.runGitSync();
          sendJson(res, 200, { ok: true });
          return;
        }

        const result = agent.startSync(DIRTY_SYNC_PROMPT);
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    // Plain fast-forward pull of the current branch — distinct from /sync, which
    // switches to main first. Used by the Stack panel's "Pull" quick-action so a
    // stale local branch (e.g. main behind origin/main) can be refreshed in place.
    {
      method: 'POST',
      path: '/api/git/pull',
      handle: async (_req, res) => {
        try {
          await git.runGitPull();
          sendJson(res, 200, { ok: true });
        } catch (error) {
          sendJson(res, 409, { error: (error as Error).message });
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
