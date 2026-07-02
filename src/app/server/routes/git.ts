import { readPlansMerged } from '../../../core/readers';
import { findFocusPlan } from '../../features/plans/helpers';
import { suggestCommitMessage } from '../commit-suggest';
import { campFile } from '../helpers';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

const DIRTY_SYNC_PROMPT = `Sync the current branch to main by:
1. Stashing or committing any uncommitted changes (do not use \`git reset --hard\` or \`git clean -fd\` without an explicit confirmation step)
2. Relocating any mis-filed content (e.g., any new plans written to the legacy \`papercamp/plans.md\` instead of per-file \`papercamp/plans/*.md\`)
3. Checking out main: \`git checkout main\`
4. Fetching from origin: \`git fetch --prune\`
5. Fast-forwarding the merge: \`git merge --ff-only origin/main\`
6. Confirming success

Report the final branch and status to verify the sync completed.`;

export function gitRoutes({ root, git, agent }: RouteContext): Route[] {
  return [
    // GET /api/git/status — return working tree status
    {
      method: 'GET',
      path: '/api/git/status',
      handle: async (_req, res) => {
        const entries = await git.getStatus();
        const branch = git.getCurrentBranch();
        const ahead = await git.getAheadCount();
        const branchHygiene = await git.getBranchHygieneStatus();
        sendJson(res, 200, { branch, entries, ahead, branchHygiene });
      },
    },

    // POST /api/git/push — push the current branch to its upstream
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

    // POST /api/git/commit — stage files and create a commit
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

    // POST /api/git/sync — sync to main (clean: inline, dirty: agent task)
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
          // Inline sync: checkout main, fetch, fast-forward merge
          await git.runGitSync();
          sendJson(res, 200, { ok: true });
          return;
        }

        // Dirty mode: launch agent task
        const result = agent.startSync(DIRTY_SYNC_PROMPT);
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    // POST /api/git/suggest-commit-message — agent-written title/body from the actual diff
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
          const { entries } = await readPlansMerged(
            campFile(root, 'plans'),
            campFile(root, 'plans.md'),
          );
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
