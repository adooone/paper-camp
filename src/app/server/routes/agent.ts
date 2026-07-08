import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { entityToPlan, readEntities } from '../../../core/readers';
import type { EntityEntry, IdeaEntry, IdeaStatus, PlanEntry } from '../../../types/index';
import { campFile, checkBranchConflictForPlan, fileExists } from '../helpers';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

/** Resolves an entity's file path, checking the archive subdirectory as a fallback. */
async function resolveEntityFilePath(root: string, entityId: string): Promise<string | null> {
  const primary = join(campFile(root, 'ideas'), `${entityId}.md`);
  if (await fileExists(primary)) return primary;
  const archived = join(campFile(root, 'ideas'), 'archive', `${entityId}.md`);
  if (await fileExists(archived)) return archived;
  return null;
}

/**
 * Known path/identifier renames from this project's own history (see progress.md),
 * cheap enough to fix with plain substitution before spending a model call on the
 * rest of a plan's drift.
 */
const KNOWN_RENAMES: ReadonlyArray<readonly [string, string]> = [
  ['`plans.md`', '`papercamp/ideas/`'],
  ['`ideas.md`', '`papercamp/ideas/`'],
  ['papercamp/plans/', 'papercamp/ideas/'],
  ['.paper-camp/', 'papercamp/'],
  ['FocusTaskItem', 'FocusPhaseItem'],
  ['TaskItem', 'PhaseItem'],
  ['taskProgress', 'phaseProgress'],
  ['taskPercentage', 'phasePercentage'],
];

/**
 * Applies KNOWN_RENAMES line-by-line, skipping the YAML frontmatter and any
 * checked phase line (plus its indented continuation lines) — the same
 * guardrails the AI reconcile pass itself enforces.
 */
function applyKnownRenames(content: string): { content: string; changed: boolean } {
  const frontmatterEnd = content.startsWith('---\n') ? content.indexOf('\n---', 4) + 4 : -1;
  const frontmatter = frontmatterEnd >= 4 ? content.slice(0, frontmatterEnd) : '';
  const rest = frontmatterEnd >= 4 ? content.slice(frontmatterEnd) : content;

  const lines = rest.split('\n');
  let changed = false;
  let skippingCheckedPhase = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^- \[x\]/.test(line)) {
      skippingCheckedPhase = true;
      continue;
    }
    if (skippingCheckedPhase) {
      if (line.trim() === '' || /^\s+\S/.test(line)) continue;
      skippingCheckedPhase = false;
    }
    let updated = line;
    for (const [from, to] of KNOWN_RENAMES) {
      if (updated.includes(from)) updated = updated.split(from).join(to);
    }
    if (updated !== line) {
      changed = true;
      lines[i] = updated;
    }
  }

  return { content: frontmatter + lines.join('\n'), changed };
}

/** Work-entity lookup in PlanEntry shape, for the plan-scoped agent tasks. */
async function findPlanById(root: string, planId: string): Promise<PlanEntry | undefined> {
  const { entries } = await readEntities(campFile(root, 'ideas'));
  const entity = entries.find((e) => e.id === planId && e.kind !== 'note');
  return entity ? entityToPlan(entity) : undefined;
}

/** IdeaEntry view of any entity, for the idea-scoped tasks (draft/extend). */
function toIdeaEntry(e: EntityEntry): IdeaEntry {
  return {
    id: e.id,
    title: e.title,
    body: e.body,
    kind: e.kind,
    status: e.kind === 'note' ? (e.status as IdeaStatus) : undefined,
    log: e.log,
  };
}

async function findIdeaById(root: string, ideaId: string): Promise<IdeaEntry | undefined> {
  const { entries } = await readEntities(campFile(root, 'ideas'));
  const entity = entries.find((e) => e.id === ideaId);
  return entity ? toIdeaEntry(entity) : undefined;
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
        const filePath = await resolveEntityFilePath(root, planId);
        if (filePath) {
          const raw = await readFile(filePath, 'utf-8');
          const { content, changed } = applyKnownRenames(raw);
          if (changed) await writeFile(filePath, content, 'utf-8');
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

    // GET /api/agent/reconcile-queue — per-entity before snapshots from the most
    // recent batch reconcile sweep, for the client to turn into a review queue
    {
      method: 'GET',
      path: '/api/agent/reconcile-queue',
      handle: (_req, res) => {
        sendJson(res, 200, agent.getReconcileQueue());
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
