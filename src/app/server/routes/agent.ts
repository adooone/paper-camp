import { parseIdeas, parsePlans } from '../../../core/parser';
import { readAllIdeaFiles, readAllPlanFiles } from '../../../core/readers';
import type { IdeaEntry, PlanEntry } from '../../../types/index';
import { campFile, checkBranchConflictForPlan, readMaybe } from '../helpers';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

/** Per-file plan lookup with fallback to the legacy monolithic plans.md. */
async function findPlanById(root: string, planId: string): Promise<PlanEntry | undefined> {
  const { entries } = await readAllPlanFiles(campFile(root, 'plans'));
  const plan = entries.find((p) => p.id === planId);
  if (plan) return plan;
  const mono = parsePlans(await readMaybe(campFile(root, 'plans.md')));
  return mono.entries.find((p) => p.id === planId);
}

/** Per-file idea lookup with fallback to the legacy monolithic ideas.md. */
async function findIdeaById(root: string, ideaId: string): Promise<IdeaEntry | undefined> {
  const { entries } = await readAllIdeaFiles(campFile(root, 'ideas'));
  const idea = entries.find((i) => i.id === ideaId);
  if (idea) return idea;
  const mono = parseIdeas(await readMaybe(campFile(root, 'ideas.md')));
  return mono.find((i) => i.id === ideaId);
}

export function agentRoutes({ root, git, status, agent }: RouteContext): Route[] {
  return [
    // GET /api/agent/status — current agent task state, if any
    {
      method: 'GET',
      path: '/api/agent/status',
      handle: (_req, res) => {
        sendJson(res, 200, agent.getStatus());
      },
    },

    // POST /api/agent/launch — start a headless agent on one plan phase
    {
      method: 'POST',
      path: '/api/agent/launch',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { planId, phaseIndex } = JSON.parse(reqBody) as {
          planId?: string;
          phaseIndex?: number;
        };
        if (!planId || typeof phaseIndex !== 'number') {
          sendJson(res, 400, { error: 'planId and phaseIndex are required' });
          return;
        }
        const plan = await findPlanById(root, planId);
        if (!plan) {
          sendJson(res, 404, { error: 'plan not found' });
          return;
        }
        const conflict = await checkBranchConflictForPlan(root, git, plan.id);
        if (conflict) {
          sendJson(res, 409, { error: conflict });
          return;
        }
        const result = agent.start(plan, phaseIndex);
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    // POST /api/agent/launch-audit — start a headless agent on a plan-scoped convergence audit
    {
      method: 'POST',
      path: '/api/agent/launch-audit',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { planId, prompt } = JSON.parse(reqBody) as { planId?: string; prompt?: string };
        if (!planId || !prompt) {
          sendJson(res, 400, { error: 'planId and prompt are required' });
          return;
        }
        const plan = await findPlanById(root, planId);
        if (!plan) {
          sendJson(res, 404, { error: 'plan not found' });
          return;
        }
        const conflict = await checkBranchConflictForPlan(root, git, plan.id);
        if (conflict) {
          sendJson(res, 409, { error: conflict });
          return;
        }
        const result = agent.startForPlan(plan, prompt);
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    // POST /api/agent/launch-reconcile — start a headless agent that reconciles stale prose in a plan
    {
      method: 'POST',
      path: '/api/agent/launch-reconcile',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { planId, prompt } = JSON.parse(reqBody) as { planId?: string; prompt?: string };
        if (!planId || !prompt) {
          sendJson(res, 400, { error: 'planId and prompt are required' });
          return;
        }
        const plan = await findPlanById(root, planId);
        if (!plan) {
          sendJson(res, 404, { error: 'plan not found' });
          return;
        }
        const conflict = await checkBranchConflictForPlan(root, git, plan.id);
        if (conflict) {
          sendJson(res, 409, { error: conflict });
          return;
        }
        const result = agent.startForPlan(plan, prompt, 'reconcile');
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    // POST /api/agent/launch-draft — start a headless agent that drafts a new plan from an idea
    {
      method: 'POST',
      path: '/api/agent/launch-draft',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { ideaId, prompt } = JSON.parse(reqBody) as { ideaId?: string; prompt?: string };
        if (!ideaId || !prompt) {
          sendJson(res, 400, { error: 'ideaId and prompt are required' });
          return;
        }
        const idea = await findIdeaById(root, ideaId);
        if (!idea) {
          sendJson(res, 404, { error: 'idea not found' });
          return;
        }
        const conflict = await checkBranchConflictForPlan(root, git);
        if (conflict) {
          sendJson(res, 409, { error: conflict });
          return;
        }
        const result = agent.startForIdea(idea, prompt);
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    // POST /api/agent/launch-extend — start a headless agent to extend an idea's body
    {
      method: 'POST',
      path: '/api/agent/launch-extend',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { ideaId, prompt } = JSON.parse(reqBody) as { ideaId?: string; prompt?: string };
        if (!ideaId || !prompt) {
          sendJson(res, 400, { error: 'ideaId and prompt are required' });
          return;
        }
        const idea = await findIdeaById(root, ideaId);
        if (!idea) {
          sendJson(res, 404, { error: 'idea not found' });
          return;
        }
        const conflict = await checkBranchConflictForPlan(root, git);
        if (conflict) {
          sendJson(res, 409, { error: conflict });
          return;
        }
        const result = agent.startForIdeaExtend(idea, prompt);
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    // POST /api/agent/launch-audit-all — start a batch convergence audit across all review/done plans
    {
      method: 'POST',
      path: '/api/agent/launch-audit-all',
      handle: async (_req, res) => {
        // Batch audit can modify many plan files — gate it behind the same
        // active-plan guard the other write-capable agent routes use.
        const conflict = await checkBranchConflictForPlan(root, git);
        if (conflict) {
          sendJson(res, 409, { error: conflict });
          return;
        }
        const result = agent.startBatchAudit();
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    // POST /api/agent/launch-run-all — run every unchecked phase sequentially with per-phase commits
    {
      method: 'POST',
      path: '/api/agent/launch-run-all',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { planId } = JSON.parse(reqBody) as { planId?: string };
        if (!planId) {
          sendJson(res, 400, { error: 'planId is required' });
          return;
        }
        const plan = await findPlanById(root, planId);
        if (!plan) {
          sendJson(res, 404, { error: 'plan not found' });
          return;
        }
        const conflict = await checkBranchConflictForPlan(root, git, plan.id);
        if (conflict) {
          sendJson(res, 409, { error: conflict });
          return;
        }
        const result = agent.startRunAllPhases(plan, () => status.runChecksAndWait());
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    // POST /api/agent/stop — kill the running agent task
    {
      method: 'POST',
      path: '/api/agent/stop',
      handle: (_req, res) => {
        const result = agent.stop();
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },
  ];
}
