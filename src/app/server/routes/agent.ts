import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  buildFixReviewPrompt,
  buildInstallToolbarPrompt,
  buildIssueFixPrompt,
  buildPrReviewPrompt,
} from '@/app/features/plans/prompts';
import { fetchCiReleaseState } from '@/core/ci';
import { createIdea, readCorpus, resolveEntityFilePath, updateEntity } from '@/core/corpus';
import { loadDeskConfig } from '@/core/desk-config';
import { detectPackageManager } from '@/core/desk-discovery/evidence';
import { detectToolbarHostState } from '@/core/desk-discovery/toolbar-host';
import { fetchPrDiff, fetchUnresolvedThreads, resolvePrsByEntity } from '@/core/git-pr';
import { checkNeedsForRun } from '@/core/needs';
import { parseSuggestions } from '@/core/parse';
import { readProjectConfig } from '@/core/project-config';
import { entityToPlan } from '@/core/readers';
import { PAPER_CAMP_VERSION } from '@/core/scaffold';
import { todayDateString } from '@/core/serialize';
import { isClosedEntity } from '@/core/status';
import { logFromThread, promoteThreadMessage } from '@/core/thread';
import type {
  AgentTaskState,
  EntityEntry,
  IdeaEntry,
  IdeaStatus,
  Issue,
  PhaseItem,
  PlanEntry,
  PrReviewStatus,
} from '@/types/index';
import { getAgentSignIn, markAgentSignedIn, markAgentSignedOut } from '../agent-signin';
import { resolveAgent } from '../agents';
import {
  clearAgentAuthStatusCache,
  clearCapabilitiesCache,
  probeAgentAuthStatus,
} from '../capabilities';
import { probeSignIn } from '../capacity-probe';
import { checkStaleBaseForRunAll, planFile, readMaybe } from '../helpers';
import { readJson, requestUrl, sendJson } from '../http';
import { getCurrentLoginRelay, startClaudeLoginRelay } from '../login-relay';
import { readReviewedShas } from '../pr-review-state';
import type { Route, RouteContext } from './types';

async function findThreadEntity(root: string, planId: string): Promise<EntityEntry | undefined> {
  const { entries } = await readCorpus(root);
  return entries.find((e) => e.id === planId && e.kind !== 'note');
}

// Known renames from this project's own history, cheap enough to
// fix with plain substitution before spending a model call on the rest of the drift.
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

// Skips the YAML frontmatter and any checked phase line (plus its indented
// continuation lines) — the same guardrails the AI reconcile pass itself enforces.
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

const LIVE_STATUSES = new Set(['starting', 'running', 'stopping']);

export function withoutFinishedLines(task: AgentTaskState): AgentTaskState {
  if (LIVE_STATUSES.has(task.status)) return task;
  const { lines: _lines, ...rest } = task;
  return rest as AgentTaskState;
}

async function findPlanById(root: string, planId: string): Promise<PlanEntry | undefined> {
  const { entries } = await readCorpus(root);
  const entity = entries.find((e) => e.id === planId && e.kind !== 'note');
  return entity ? entityToPlan(entity) : undefined;
}

function toIdeaEntry(e: EntityEntry): IdeaEntry {
  return {
    id: e.id,
    title: e.title,
    body: e.body,
    kind: e.kind === 'note' ? 'note' : undefined,
    status: e.kind === 'note' ? (e.status as IdeaStatus) : undefined,
    log: logFromThread(e.thread),
  };
}

async function findIdeaById(root: string, ideaId: string): Promise<IdeaEntry | undefined> {
  const { entries } = await readCorpus(root);
  const entity = entries.find((e) => e.id === ideaId);
  return entity ? toIdeaEntry(entity) : undefined;
}

type ActionResult = { ok: true } | { ok: false; error: string; status?: number; kind?: 'auth' };

export function agentRoutes({ root, git, checks, agent, activity }: RouteContext): Route[] {
  async function resolvePlan(
    planId: string,
  ): Promise<{ ok: true; plan: PlanEntry } | { ok: false; error: string; status: number }> {
    const plan = await findPlanById(root, planId);
    if (!plan) return { ok: false, status: 404, error: 'plan not found' };
    return { ok: true, plan };
  }

  async function resolveIdea(
    ideaId: string,
  ): Promise<{ ok: true; idea: IdeaEntry } | { ok: false; error: string; status: number }> {
    const idea = await findIdeaById(root, ideaId);
    if (!idea) return { ok: false, status: 404, error: 'idea not found' };
    return { ok: true, idea };
  }

  function planActionRoute<TBody>(
    path: string,
    parse: (raw: unknown) => TBody | null,
    invalidError: string,
    run: (body: TBody) => Promise<ActionResult> | ActionResult,
  ): Route {
    return {
      method: 'POST',
      path,
      handle: async (req, res) => {
        const raw = await readJson(req);
        const body = parse(raw);
        if (body === null) {
          sendJson(res, 400, { error: invalidError });
          return;
        }
        const result = await run(body);
        if (!result.ok) {
          sendJson(res, result.status ?? 409, {
            error: result.error,
            ...(result.kind && { kind: result.kind }),
          });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    };
  }

  return [
    {
      method: 'GET',
      path: '/api/agent/status',
      handle: (_req, res) => {
        sendJson(res, 200, agent.getStatus().map(withoutFinishedLines));
      },
    },

    {
      method: 'GET',
      path: '/api/agent/auth-status',
      handle: async (req, res) => {
        if (requestUrl(req).searchParams.has('recheck')) clearAgentAuthStatusCache();
        const defaultAgents = readProjectConfig(root).defaultAgents;
        const { id } = resolveAgent({ defaultAgents, taskKind: 'phase' });
        const status = await probeAgentAuthStatus(id, root);
        const signIn = getAgentSignIn(id);
        sendJson(
          res,
          200,
          signIn.signedOut ? { ...status, loggedIn: false, reason: signIn.reason } : status,
        );
      },
    },

    {
      method: 'POST',
      path: '/api/agent/auth-check',
      handle: async (_req, res) => {
        const probe = await probeSignIn(root);
        if (probe.signedIn) {
          clearCapabilitiesCache(root);
          markAgentSignedIn();
        } else if (probe.signedIn === false) {
          markAgentSignedOut(probe.reason ?? 'Claude is signed out');
        }
        sendJson(res, 200, probe);
      },
    },

    {
      method: 'POST',
      path: '/api/agent/login-relay/start',
      handle: async (_req, res) => {
        const handle = await startClaudeLoginRelay(root, {
          onLoginConfirmed: () => {
            clearCapabilitiesCache(root);
            markAgentSignedIn();
          },
        });
        sendJson(res, 200, handle.getState());
      },
    },

    {
      method: 'GET',
      path: '/api/agent/login-relay/status',
      handle: (_req, res) => {
        const handle = getCurrentLoginRelay();
        sendJson(res, 200, handle ? handle.getState() : null);
      },
    },

    {
      method: 'POST',
      path: '/api/agent/login-relay/cancel',
      handle: (_req, res) => {
        getCurrentLoginRelay()?.cancel();
        sendJson(res, 202, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/agent/login-relay/code',
      handle: async (req, res) => {
        const { code } = (await readJson<{ code?: string }>(req)) ?? {};
        if (!code?.trim()) {
          sendJson(res, 400, { error: 'code is required' });
          return;
        }
        const handle = getCurrentLoginRelay();
        if (!handle?.getState().needsCode) {
          sendJson(res, 409, { error: 'No code prompt is pending' });
          return;
        }
        handle.submitCode(code.trim());
        sendJson(res, 200, handle.getState());
      },
    },

    planActionRoute(
      '/api/agent/launch',
      (raw) => {
        const { planId, phaseIndex } = (raw ?? {}) as { planId?: string; phaseIndex?: number };
        if (!planId || typeof phaseIndex !== 'number') return null;
        return { planId, phaseIndex };
      },
      'planId and phaseIndex are required',
      async ({ planId, phaseIndex }) => {
        const resolved = await resolvePlan(planId);
        if (!resolved.ok) return resolved;
        const waits = await checkNeedsForRun(root, resolved.plan.needs, readCorpus);
        if (waits) return { ok: false, error: waits };
        return agent.start(
          resolved.plan,
          phaseIndex,
          () => checks.runChecksAndWait(),
          () => checks.getCachedOrRunChecks(),
        );
      },
    ),

    planActionRoute(
      '/api/agent/launch-audit',
      (raw) => {
        const { planId, prompt } = (raw ?? {}) as { planId?: string; prompt?: string };
        if (!planId || !prompt) return null;
        return { planId, prompt };
      },
      'planId and prompt are required',
      async ({ planId, prompt }) => {
        const resolved = await resolvePlan(planId);
        if (!resolved.ok) return resolved;
        const { plan } = resolved;
        return agent.launch(
          'audit',
          { planTitle: plan.title, planId: plan.id, agentOverride: plan.agent },
          prompt,
          {
            planBaseline: { phases: plan.phases.length, log: plan.log?.length ?? 0 },
          },
        );
      },
    ),

    planActionRoute(
      '/api/agent/launch-reconcile',
      (raw) => {
        const { planId, prompt } = (raw ?? {}) as { planId?: string; prompt?: string };
        if (!planId || !prompt) return null;
        return { planId, prompt };
      },
      'planId and prompt are required',
      async ({ planId, prompt }) => {
        const resolved = await resolvePlan(planId);
        if (!resolved.ok) return resolved;
        const filePath = await resolveEntityFilePath(root, planId);
        if (filePath) {
          const raw = await readFile(filePath, 'utf-8');
          const { content, changed } = applyKnownRenames(raw);
          if (changed) await writeFile(filePath, content, 'utf-8');
        }
        const { plan } = resolved;
        return agent.launch(
          'reconcile',
          { planTitle: plan.title, planId: plan.id, agentOverride: plan.agent },
          prompt,
          {
            reconcileBaseline: JSON.stringify({
              body: plan.body,
              phases: plan.phases.map((p) => p.text),
            }),
          },
        );
      },
    ),

    // No branch-conflict guard: drafting only edits the idea's markdown, not code.
    planActionRoute(
      '/api/agent/launch-draft',
      (raw) => {
        const { ideaId, prompt } = (raw ?? {}) as { ideaId?: string; prompt?: string };
        if (!ideaId || !prompt) return null;
        return { ideaId, prompt };
      },
      'ideaId and prompt are required',
      async ({ ideaId, prompt }) => {
        const resolved = await resolveIdea(ideaId);
        if (!resolved.ok) return resolved;
        const { idea } = resolved;
        if (!idea.id) return { ok: false, error: 'Idea has no id to link a drafted plan back to' };
        return agent.launch(
          'draft',
          { planTitle: `Draft plan for ${idea.id}`, notificationTitle: idea.title },
          prompt,
          { ideaId: idea.id },
        );
      },
    ),

    // No branch-conflict guard: extending only edits the idea's prose/log, not code.
    planActionRoute(
      '/api/agent/launch-extend',
      (raw) => {
        const { ideaId, prompt } = (raw ?? {}) as { ideaId?: string; prompt?: string };
        if (!ideaId || !prompt) return null;
        return { ideaId, prompt };
      },
      'ideaId and prompt are required',
      async ({ ideaId, prompt }) => {
        const resolved = await resolveIdea(ideaId);
        if (!resolved.ok) return resolved;
        const { idea } = resolved;
        if (!idea.id) return { ok: false, error: 'Idea has no id to extend' };
        return agent.launch(
          'extend',
          { planTitle: `Extend ${idea.id}`, notificationTitle: idea.title },
          prompt,
          { ideaId: idea.id, ideaLogBaseline: idea.log?.length ?? 0 },
        );
      },
    ),

    // No branch-conflict guard: this only appends lines to suggestions.md, not code.
    planActionRoute(
      '/api/agent/launch-suggest',
      (raw) => {
        const { prompt } = (raw ?? {}) as { prompt?: string };
        return prompt ? { prompt } : null;
      },
      'prompt is required',
      async ({ prompt }) => {
        const suggestBaseline = parseSuggestions(
          await readMaybe(planFile(root, 'suggestions.md')),
        ).length;
        return agent.launch('suggest', { planTitle: 'Suggest ideas' }, prompt, { suggestBaseline });
      },
    ),

    planActionRoute(
      '/api/agent/launch-reconcile-all',
      () => ({}),
      '',
      async () => {
        return agent.runBatch('batch-reconcile', 'all');
      },
    ),

    // No branch-conflict guard: drafting only edits idea markdown, not code.
    planActionRoute(
      '/api/agent/launch-draft-all',
      (raw) => {
        const { ids } = (raw ?? {}) as { ids?: unknown };
        if (
          !Array.isArray(ids) ||
          ids.length === 0 ||
          !ids.every((id) => typeof id === 'string' && id.trim().length > 0)
        ) {
          return null;
        }
        return { ids };
      },
      'ids is required',
      ({ ids }) => agent.runBatch('batch-draft', ids),
    ),

    planActionRoute(
      '/api/agent/launch-run-all',
      (raw) => {
        const { planId } = (raw ?? {}) as { planId?: string };
        return planId ? { planId } : null;
      },
      'planId is required',
      async ({ planId }) => {
        const resolved = await resolvePlan(planId);
        if (!resolved.ok) return resolved;
        const staleBase = await checkStaleBaseForRunAll(git, planId);
        if (staleBase) return { ok: false, error: staleBase };
        const waits = await checkNeedsForRun(root, resolved.plan.needs, readCorpus);
        if (waits) return { ok: false, error: waits };
        return agent.startRunAllPhases(
          resolved.plan,
          () => checks.runChecksAndWait(),
          () => checks.getCachedOrRunChecks(),
        );
      },
    ),

    planActionRoute(
      '/api/agent/launch-fix-review',
      (raw) => {
        const { planId } = (raw ?? {}) as { planId?: string };
        return planId ? { planId } : null;
      },
      'planId is required',
      async ({ planId }) => {
        const resolved = await resolvePlan(planId);
        if (!resolved.ok) return resolved;
        const { plan } = resolved;
        const prs = await resolvePrsByEntity(root);
        const pr = prs?.get(planId);
        if (!pr) return { ok: false, status: 404, error: 'No PR found for this plan' };
        const threads = await fetchUnresolvedThreads(root, pr.url);
        if (threads.length === 0) {
          return { ok: false, error: 'No unresolved review threads to fix' };
        }
        const prompt = buildFixReviewPrompt(plan, threads);
        // Same `threads` array the prompt numbered, so the agent's 1-based verdicts
        // map back to the right thread ids.
        return agent.launch(
          'fix-review',
          { planTitle: plan.title, planId: plan.id, agentOverride: plan.agent },
          prompt,
          { fixReviewThreads: threads },
        );
      },
    ),

    planActionRoute(
      '/api/agent/launch-pr-review',
      (raw) => {
        const { planId } = (raw ?? {}) as { planId?: string };
        return planId ? { planId } : null;
      },
      'planId is required',
      async ({ planId }) => {
        const resolved = await resolvePlan(planId);
        if (!resolved.ok) return resolved;
        const { plan } = resolved;
        const prs = await resolvePrsByEntity(root);
        const pr = prs?.get(planId);
        if (!pr || (pr.state !== 'open' && pr.state !== 'draft') || !pr.headSha) {
          return { ok: false, status: 404, error: 'No open PR found for this plan' };
        }
        const diff = await fetchPrDiff(root, String(pr.number));
        if (!diff) return { ok: false, error: 'Could not fetch the PR diff' };
        const prompt = buildPrReviewPrompt(plan, diff);
        // Launched by the "Review PR" action, not by any poll.
        return agent.launch(
          'pr-review',
          { planTitle: plan.title, planId: plan.id, agentOverride: plan.agent },
          prompt,
          { prReviewSha: pr.headSha, prReviewUrl: pr.url },
        );
      },
    ),

    planActionRoute(
      '/api/agent/issue-fix',
      (raw) => {
        const { issueId, title, reason, output } = (raw ?? {}) as {
          issueId?: string;
          title?: string;
          reason?: string;
          output?: string;
        };
        return issueId && title && reason ? { issueId, title, reason, output } : null;
      },
      'issueId, title, and reason are required',
      async ({ issueId, title, reason, output }) => {
        const prompt = buildIssueFixPrompt({ title, reason, output });
        // No planId/ideaId, so this never lands in the Inbox notifications; the
        // Issues page picks up the result from tasks.log (issueId) instead.
        return agent.launch('issue-fix', { planTitle: title }, prompt, { issueId });
      },
    ),

    planActionRoute(
      '/api/agent/install-toolbar',
      () => ({}),
      'unexpected error',
      async () => {
        const hostState = await detectToolbarHostState(root);
        if (!hostState.viteConfigPath) {
          return { ok: false, status: 400, error: 'No Vite config found for this project' };
        }
        const prompt = buildInstallToolbarPrompt(
          hostState.viteConfigPath,
          detectPackageManager(root),
          PAPER_CAMP_VERSION,
        );
        return agent.launch('install-toolbar', { planTitle: 'Install toolbar' }, prompt);
      },
    ),

    {
      method: 'POST',
      path: '/api/agent/promote-issue',
      handle: async (req, res) => {
        const { issue } = (await readJson<{ issue?: Issue }>(req)) ?? {};
        if (!issue?.id || !issue.title || !issue.reason) {
          sendJson(res, 400, { error: 'issue is required' });
          return;
        }

        const ideasDir = planFile(root, 'ideas');
        const { entries } = await readCorpus(root, { live: true });
        const parent = issue.entityId ? entries.find((e) => e.id === issue.entityId) : undefined;

        // An open parent keeps its inline Fixes list; only a closed/archived parent,
        // or no parent at all, spawns a linked entity (IDEA-187's boundary rule).
        if (parent && !isClosedEntity(parent)) {
          const targetFile =
            (await resolveEntityFilePath(root, parent.id)) ?? join(ideasDir, `${parent.id}.md`);
          await updateEntity(root, parent.id, (entry) => ({
            fixes: [
              ...(entry.fixes ?? []),
              { done: false, text: issue.title, description: issue.reason, source: 'issue' },
            ],
          }));
          await git.commit(
            [relative(root, targetFile)],
            `fix(ideas): add issue to ${parent.id}'s fixes`,
            `Refs: ${parent.id}`,
            { noVerify: true },
          );
          activity.notifyChanged('corpus');
          sendJson(res, 200, { promotedTo: parent.id, kind: 'append' });
          return;
        }

        const spawnedId = await createIdea(root, {
          title: issue.title,
          ...(parent ? { kind: 'fix' as const, type: 'fix' as const, idea: parent.id } : {}),
          issueSource: issue.id,
          content: issue.reason,
          phases: parent ? [{ done: false, text: issue.title, description: issue.reason }] : [],
        });
        const fixPath = join(ideasDir, `${spawnedId}.md`);
        await git.commit(
          [relative(root, fixPath)],
          `fix(ideas): spawn ${spawnedId} from issue ${issue.id}`,
          `Refs: ${spawnedId}`,
          { noVerify: true },
        );

        if (parent) {
          agent.startRunAllPhases(
            entityToPlan({
              id: spawnedId,
              title: issue.title,
              type: 'fix',
              kind: 'fix',
              idea: parent.id,
              issueSource: issue.id,
              created: todayDateString(),
              tags: [],
              needs: [],
              body: issue.reason,
              phases: [{ done: false, text: issue.title, description: issue.reason }],
            }),
            () => checks.runChecksAndWait(),
            () => checks.getCachedOrRunChecks(),
          );
        }

        activity.notifyChanged('corpus');
        sendJson(res, 200, { promotedTo: spawnedId, kind: parent ? 'fix' : 'idea' });
      },
    },

    {
      method: 'GET',
      path: '/api/agent/pr-review-status',
      handle: async (req, res) => {
        const planId = requestUrl(req).searchParams.get('planId');
        if (!planId) {
          sendJson(res, 400, { error: 'planId is required' });
          return;
        }
        const prs = await resolvePrsByEntity(root);
        const pr = prs?.get(planId);
        const reviewed = await readReviewedShas(root);
        const ci = loadDeskConfig(root).ci ?? null;
        let ciGreen: boolean | null = null;
        if (ci && pr?.headBranch) {
          const ciState = await fetchCiReleaseState(root, { ...ci, branch: pr.headBranch });
          ciGreen =
            ciState.available &&
            ciState.runs !== null &&
            ciState.runs.length > 0 &&
            ciState.runs.every((r) => r.status === 'success');
        }
        const result: PrReviewStatus = {
          ready: pr?.state === 'open',
          headSha: pr?.headSha ?? null,
          lastReviewedSha: reviewed[planId] ?? null,
          ciGreen,
        };
        sendJson(res, 200, result);
      },
    },

    // Distills one ephemeral `chat` message into a durable thread kind, deterministically.
    // `note` carries the promote-to-idea breadcrumb after the idea is minted elsewhere.
    {
      method: 'POST',
      path: '/api/agent/feedback-promote',
      handle: async (req, res) => {
        const { planId, index, target, note } =
          (await readJson<{
            planId?: string;
            index?: number;
            target?: 'decision' | 'log';
            note?: string;
          }>(req)) ?? {};
        if (!planId || typeof index !== 'number' || (target !== 'decision' && target !== 'log')) {
          sendJson(res, 400, { error: 'planId, index, and a decision/log target are required' });
          return;
        }

        const entity = await findThreadEntity(root, planId);
        if (!entity) {
          sendJson(res, 404, { error: 'plan not found' });
          return;
        }
        const thread = entity.thread ?? [];
        if (thread[index]?.kind !== 'chat') {
          sendJson(res, 404, { error: 'no chat message at that index' });
          return;
        }

        await updateEntity(root, planId, () => ({
          thread: promoteThreadMessage(thread, index, target, note?.trim() || undefined),
        }));
        activity.notifyChanged('corpus');
        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'GET',
      path: '/api/agent/reconcile-queue',
      handle: (_req, res) => {
        sendJson(res, 200, agent.getReconcileQueue());
      },
    },

    {
      method: 'POST',
      path: '/api/agent/reconcile-queue/consume',
      handle: (_req, res) => {
        agent.consumeReconcileQueue();
        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/agent/stop',
      handle: async (req, res) => {
        const { taskId } = (await readJson<{ taskId?: string }>(req)) ?? {};
        const result = agent.stop(taskId);
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },
  ];
}
