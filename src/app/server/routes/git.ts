import { findFocusPlan } from '@/app/features/plans/helpers';
import { entityToPlan, readEntities, readWorkEntries } from '@/core/readers';
import { suggestCommitMessage } from '../commit-suggest';
import { campFile } from '../helpers';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

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
      handle: async (_req, res) => {
        try {
          await git.runGitSync();
          sendJson(res, 200, { ok: true });
        } catch (error) {
          sendJson(res, 409, { error: (error as Error).message });
        }
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
