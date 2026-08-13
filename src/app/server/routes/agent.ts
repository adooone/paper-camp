import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { buildFixReviewPrompt } from '@/app/features/plans/prompts';
import { fetchUnresolvedThreads, resolvePrsByEntity } from '@/core/git-pr';
import { entityToPlan, readEntities } from '@/core/readers';
import { agentThreadMessage, todayDateString } from '@/core/serialize';
import { chatSinceLastLog, logFromThread, promoteThreadMessage } from '@/core/thread';
import type {
  EntityEntry,
  IdeaEntry,
  IdeaStatus,
  MountContext,
  PlanEntry,
  ThreadMessage,
} from '@/types/index';
import { readDefaultAgentIds } from '../agent';
import { resolveAgent } from '../agents';
import { probeAgentAuthStatus } from '../capabilities';
import {
  addsOpenFix,
  applyFeedbackEdit,
  replyToFeedback,
  summarizeFeedback,
} from '../feedback-reply';
import {
  campFile,
  checkBranchConflictForPlan,
  entityFileInput,
  fileExists,
  regenerateIndexes,
  writeEntityFile,
} from '../helpers';
import { readBody, sendJson } from '../http';
import { getCurrentLoginRelay, startClaudeLoginRelay } from '../login-relay';
import { appendNotification } from '../notification-log';
import type { Route, RouteContext } from './types';

async function resolveEntityFilePath(root: string, entityId: string): Promise<string | null> {
  const primary = join(campFile(root, 'ideas'), `${entityId}.md`);
  if (await fileExists(primary)) return primary;
  const archived = join(campFile(root, 'ideas'), 'archive', `${entityId}.md`);
  if (await fileExists(archived)) return archived;
  return null;
}

// Shared by every feedback-thread route (message, undo, promote, summarize): finds
// the plan-kind entity a planId names, plus the file it currently lives at.
async function resolveFeedbackEntity(
  root: string,
  planId: string,
): Promise<{ entries: EntityEntry[]; entity: EntityEntry; targetFile: string } | null> {
  const ideasDir = campFile(root, 'ideas');
  const { entries } = await readEntities(ideasDir);
  const entity = entries.find((e) => e.id === planId && e.kind !== 'note');
  if (!entity) return null;
  const targetFile =
    (await resolveEntityFilePath(root, entity.id)) ?? join(ideasDir, `${entity.id}.md`);
  return { entries, entity, targetFile };
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

async function findPlanById(root: string, planId: string): Promise<PlanEntry | undefined> {
  const { entries } = await readEntities(campFile(root, 'ideas'));
  const entity = entries.find((e) => e.id === planId && e.kind !== 'note');
  return entity ? entityToPlan(entity) : undefined;
}

function toIdeaEntry(e: EntityEntry): IdeaEntry {
  return {
    id: e.id,
    title: e.title,
    body: e.body,
    kind: e.kind,
    status: e.kind === 'note' ? (e.status as IdeaStatus) : undefined,
    log: logFromThread(e.thread),
  };
}

async function findIdeaById(root: string, ideaId: string): Promise<IdeaEntry | undefined> {
  const { entries } = await readEntities(campFile(root, 'ideas'));
  const entity = entries.find((e) => e.id === ideaId);
  return entity ? toIdeaEntry(entity) : undefined;
}

type ActionResult = { ok: true } | { ok: false; error: string; status?: number };

export function agentRoutes({ root, git, status, agent }: RouteContext): Route[] {
  async function resolvePlan(
    planId: string,
  ): Promise<{ ok: true; plan: PlanEntry } | { ok: false; error: string; status: number }> {
    const plan = await findPlanById(root, planId);
    if (!plan) return { ok: false, status: 404, error: 'plan not found' };
    const conflict = await checkBranchConflictForPlan(root, git, plan.id);
    if (conflict) return { ok: false, status: 409, error: conflict };
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
    parse: (raw: string) => TBody | null,
    invalidError: string,
    run: (body: TBody) => Promise<ActionResult> | ActionResult,
  ): Route {
    return {
      method: 'POST',
      path,
      handle: async (req, res) => {
        const raw = await readBody(req);
        const body = parse(raw);
        if (body === null) {
          sendJson(res, 400, { error: invalidError });
          return;
        }
        const result = await run(body);
        if (!result.ok) {
          sendJson(res, result.status ?? 409, { error: result.error });
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
        sendJson(res, 200, agent.getStatus());
      },
    },

    {
      method: 'GET',
      path: '/api/agent/auth-status',
      handle: async (_req, res) => {
        const defaultAgents = readDefaultAgentIds(root);
        const { id } = resolveAgent({ defaultAgents, taskKind: 'phase' });
        sendJson(res, 200, await probeAgentAuthStatus(id, root));
      },
    },

    {
      method: 'POST',
      path: '/api/agent/login-relay/start',
      handle: async (_req, res) => {
        const handle = await startClaudeLoginRelay(root, {
          onLoginConfirmed: () => {
            agent
              .resumeAuthParkedTasks(() => status.runChecksAndWait())
              .catch((err) => {
                console.error('Failed to resume auth-parked tasks after sign-in', err);
              });
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

    planActionRoute(
      '/api/agent/launch',
      (raw) => {
        const { planId, phaseIndex } = JSON.parse(raw) as { planId?: string; phaseIndex?: number };
        if (!planId || typeof phaseIndex !== 'number') return null;
        return { planId, phaseIndex };
      },
      'planId and phaseIndex are required',
      async ({ planId, phaseIndex }) => {
        const resolved = await resolvePlan(planId);
        if (!resolved.ok) return resolved;
        return agent.start(resolved.plan, phaseIndex);
      },
    ),

    planActionRoute(
      '/api/agent/launch-audit',
      (raw) => {
        const { planId, prompt } = JSON.parse(raw) as { planId?: string; prompt?: string };
        if (!planId || !prompt) return null;
        return { planId, prompt };
      },
      'planId and prompt are required',
      async ({ planId, prompt }) => {
        const resolved = await resolvePlan(planId);
        if (!resolved.ok) return resolved;
        return agent.startForPlan(resolved.plan, prompt);
      },
    ),

    planActionRoute(
      '/api/agent/launch-reconcile',
      (raw) => {
        const { planId, prompt } = JSON.parse(raw) as { planId?: string; prompt?: string };
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
        return agent.startForPlan(resolved.plan, prompt, 'reconcile');
      },
    ),

    // No branch-conflict guard: drafting only edits the idea's markdown, not code.
    planActionRoute(
      '/api/agent/launch-draft',
      (raw) => {
        const { ideaId, prompt } = JSON.parse(raw) as { ideaId?: string; prompt?: string };
        if (!ideaId || !prompt) return null;
        return { ideaId, prompt };
      },
      'ideaId and prompt are required',
      async ({ ideaId, prompt }) => {
        const resolved = await resolveIdea(ideaId);
        if (!resolved.ok) return resolved;
        return agent.startForIdea(resolved.idea, prompt);
      },
    ),

    // No branch-conflict guard: extending only edits the idea's prose/log, not code.
    planActionRoute(
      '/api/agent/launch-extend',
      (raw) => {
        const { ideaId, prompt } = JSON.parse(raw) as { ideaId?: string; prompt?: string };
        if (!ideaId || !prompt) return null;
        return { ideaId, prompt };
      },
      'ideaId and prompt are required',
      async ({ ideaId, prompt }) => {
        const resolved = await resolveIdea(ideaId);
        if (!resolved.ok) return resolved;
        return agent.startForIdeaExtend(resolved.idea, prompt);
      },
    ),

    // No branch-conflict guard: this only appends lines to suggestions.md, not code.
    planActionRoute(
      '/api/agent/launch-suggest',
      (raw) => {
        const { prompt } = JSON.parse(raw) as { prompt?: string };
        return prompt ? { prompt } : null;
      },
      'prompt is required',
      ({ prompt }) => agent.startSuggest(prompt),
    ),

    planActionRoute(
      '/api/agent/launch-reconcile-all',
      () => ({}),
      '',
      async () => {
        const conflict = await checkBranchConflictForPlan(root, git);
        if (conflict) return { ok: false, error: conflict };
        return agent.startBatchReconcile();
      },
    ),

    // No branch-conflict guard: drafting only edits idea markdown, not code.
    planActionRoute(
      '/api/agent/launch-draft-all',
      (raw) => {
        const { ids } = JSON.parse(raw) as { ids?: unknown };
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
      ({ ids }) => agent.startBatchDraft(ids),
    ),

    planActionRoute(
      '/api/agent/launch-run-all',
      (raw) => {
        const { planId } = JSON.parse(raw) as { planId?: string };
        return planId ? { planId } : null;
      },
      'planId is required',
      async ({ planId }) => {
        const resolved = await resolvePlan(planId);
        if (!resolved.ok) return resolved;
        return agent.startRunAllPhases(resolved.plan, () => status.runChecksAndWait());
      },
    ),

    planActionRoute(
      '/api/agent/launch-fix-review',
      (raw) => {
        const { planId } = JSON.parse(raw) as { planId?: string };
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
        return agent.startFixReview(plan, prompt, threads);
      },
    ),

    {
      method: 'POST',
      path: '/api/agent/feedback-message',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { planId, text, context } = JSON.parse(reqBody) as {
          planId?: string;
          text?: string;
          context?: MountContext;
        };
        if (!planId || !text?.trim()) {
          sendJson(res, 400, { error: 'planId and text are required' });
          return;
        }

        const resolved = await resolveFeedbackEntity(root, planId);
        if (!resolved) {
          sendJson(res, 404, { error: 'plan not found' });
          return;
        }
        const { entries, entity, targetFile } = resolved;

        const userMessage: ThreadMessage = {
          kind: 'chat',
          date: todayDateString(),
          text: text.trim(),
        };
        const threadWithUser = [...(entity.thread ?? []), userMessage];

        // Written before the agent runs so the user's message survives a slow or
        // failed run — the reply below is a second, best-effort append on top.
        await writeEntityFile(
          targetFile,
          entityFileInput(entity, { thread: threadWithUser, updated: todayDateString() }),
        );

        let error: string | undefined;
        let thread = threadWithUser;
        let undo: { commitSha: string } | undefined;
        try {
          const plan = entityToPlan({ ...entity, thread: threadWithUser });
          const otherEntities = entries.filter((e) => e.id !== entity.id);
          const result = await replyToFeedback(
            plan,
            otherEntities,
            agent.runFeedbackReply,
            context,
          );
          const overrides = result.edit ? applyFeedbackEdit(entity, result.edit) : {};

          // The agent flags when this message answers a question it asked earlier —
          // reclassify it from a plain log line to a clarification so it's visible
          // to future runs (readers.ts's clarificationsFromThread) and other agents,
          // and resolve the open question it answers so a run parked on it (IDEA-125)
          // is eligible to resume below.
          const withClarification = result.answersQuestion
            ? threadWithUser.map((m, i) =>
                i === threadWithUser.length - 1 ? { ...m, kind: 'clarification' as const } : m,
              )
            : threadWithUser;
          const openQuestionIndex = result.answersQuestion
            ? withClarification.findLastIndex(
                (m) => m.kind === 'question' && (m.state ?? 'open') === 'open',
              )
            : -1;
          const answeredThread =
            openQuestionIndex === -1
              ? withClarification
              : withClarification.map((m, i) =>
                  i === openQuestionIndex ? { ...m, state: 'resolved' as const } : m,
                );

          let replyText = result.reply;

          // A feedback edit that adds an undone Fix to an already-finished plan is new
          // work: reopen it so it re-enters the run-order queue and run-all implements it —
          // otherwise the edit lands on a closed plan and nothing ever runs (or shows). The
          // same signal arms the fixes run's auto-launch (IDEA-149).
          const reopen = addsOpenFix(entity.fixes, overrides.fixes);
          if (reopen) replyText = `${replyText} (reopened this idea to re-run)`;

          thread = [...answeredThread, agentThreadMessage(replyText, 'chat')];
          await writeEntityFile(
            targetFile,
            entityFileInput(entity, {
              thread,
              updated: todayDateString(),
              ...overrides,
              ...(reopen ? { status: 'in-progress' } : {}),
            }),
          );
          void appendNotification(root, {
            id: randomUUID(),
            kind: 'reply',
            entityId: entity.id,
            entityTitle: entity.title,
            text: replyText,
          });

          // Resolving an open question is exactly the confirmation cue a run-all
          // parked on it (IDEA-125) is waiting for — re-enter it now instead of
          // leaving it failed until someone notices and relaunches by hand.
          if (openQuestionIndex !== -1) {
            await agent.resumeQuestionParkedTasks(entity.id, () => status.runChecksAndWait());
          }

          // Only a plan edit needs an Undo — commit it on its own so a revert can't
          // also sweep in unrelated dirty files elsewhere in the working tree. Committed
          // before the auto-launch below so the run's worker never writes phase-run
          // changes into a commit still being staged for this feedback edit.
          if (overrides.phases || overrides.fixes || overrides.body) {
            const relFile = relative(root, targetFile);
            await git.commit(
              [relFile],
              `${entity.type ?? 'feat'}(ideas): apply feedback edit to ${entity.id}`,
              `Refs: ${entity.id}`,
              { noVerify: true },
            );
            undo = { commitSha: await git.getHeadSha() };
          }

          // Same path the "Run fixes" button uses — the fix phase already landed in
          // the file above (and is now committed), so this starts implementing it as
          // the reply posts. Guarded the same way the button's resolvePlan is: a branch
          // conflict here is rejected instead of auto-launching into it. Busy agents are
          // already turned away by startRunAllPhases's own admit() guard.
          if (reopen) {
            const conflict = await checkBranchConflictForPlan(root, git, entity.id);
            if (!conflict) {
              const reopenedPlan = entityToPlan({
                ...entity,
                thread,
                updated: todayDateString(),
                ...overrides,
                status: 'in-progress',
              });
              agent.startRunAllPhases(reopenedPlan, () => status.runChecksAndWait());
            }
          }
        } catch (err) {
          error = (err as Error).message;
        }

        await regenerateIndexes(root);
        sendJson(res, 200, { ok: true, ...(error ? { error } : {}), ...(undo ? { undo } : {}) });
      },
    },

    {
      method: 'POST',
      path: '/api/agent/feedback-undo',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { planId, commitSha } = JSON.parse(reqBody) as {
          planId?: string;
          commitSha?: string;
        };
        if (!planId || !commitSha) {
          sendJson(res, 400, { error: 'planId and commitSha are required' });
          return;
        }

        const resolved = await resolveFeedbackEntity(root, planId);
        if (!resolved) {
          sendJson(res, 404, { error: 'plan not found' });
          return;
        }
        const { targetFile } = resolved;
        const relFile = relative(root, targetFile);

        // The commit must still be the file's tip — a later edit landing on top would
        // make a blind revert clobber that newer change instead of just this one.
        const lastCommit = await git.getLastCommitFor(relFile);
        if (lastCommit !== commitSha) {
          sendJson(res, 409, { error: 'This edit can no longer be undone' });
          return;
        }

        try {
          await git.revert(commitSha);
        } catch (err) {
          sendJson(res, 400, { error: (err as Error).message });
          return;
        }

        await regenerateIndexes(root);
        sendJson(res, 200, { ok: true });
      },
    },

    // Distills one ephemeral `chat` message into a durable thread kind — deterministic,
    // no agent call, mirroring how applyFeedbackEdit above never touches a file itself
    // beyond what the route writes. `note` carries the promote-to-idea breadcrumb (the
    // idea itself is minted through the ordinary POST /api/ideas, then this call marks
    // the source message as captured — see useSendFeedbackMessage's sibling hook).
    {
      method: 'POST',
      path: '/api/agent/feedback-promote',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { planId, index, target, note } = JSON.parse(reqBody) as {
          planId?: string;
          index?: number;
          target?: 'decision' | 'log';
          note?: string;
        };
        if (!planId || typeof index !== 'number' || (target !== 'decision' && target !== 'log')) {
          sendJson(res, 400, { error: 'planId, index, and a decision/log target are required' });
          return;
        }

        const resolved = await resolveFeedbackEntity(root, planId);
        if (!resolved) {
          sendJson(res, 404, { error: 'plan not found' });
          return;
        }
        const { entity, targetFile } = resolved;
        const thread = entity.thread ?? [];
        if (thread[index]?.kind !== 'chat') {
          sendJson(res, 404, { error: 'no chat message at that index' });
          return;
        }

        await writeEntityFile(
          targetFile,
          entityFileInput(entity, {
            thread: promoteThreadMessage(thread, index, target, note?.trim() || undefined),
            updated: todayDateString(),
          }),
        );
        await regenerateIndexes(root);
        sendJson(res, 200, { ok: true });
      },
    },

    // Fires once a chat session goes quiet (client-side inactivity timer — see
    // useFeedbackQuietSummary), distilling the exchange since the last log entry into
    // one durable line. A no-op (skipped: true) when nothing chat-kind followed it,
    // so re-firing on an already-quiet thread never appends a duplicate summary.
    {
      method: 'POST',
      path: '/api/agent/feedback-summarize',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { planId } = JSON.parse(reqBody) as { planId?: string };
        if (!planId) {
          sendJson(res, 400, { error: 'planId is required' });
          return;
        }

        const resolved = await resolveFeedbackEntity(root, planId);
        if (!resolved) {
          sendJson(res, 404, { error: 'plan not found' });
          return;
        }
        const { entity, targetFile } = resolved;
        const messages = chatSinceLastLog(entity.thread);
        if (messages.length === 0) {
          sendJson(res, 200, { ok: true, skipped: true });
          return;
        }

        try {
          const plan = entityToPlan(entity);
          const summary = await summarizeFeedback(plan, messages, agent.runFeedbackReply);
          const thread = [...(entity.thread ?? []), agentThreadMessage(summary)];
          await writeEntityFile(
            targetFile,
            entityFileInput(entity, { thread, updated: todayDateString() }),
          );
          await regenerateIndexes(root);
          sendJson(res, 200, { ok: true, summary });
        } catch (err) {
          sendJson(res, 500, { error: (err as Error).message });
        }
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
      path: '/api/agent/stop',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { taskId } = reqBody ? (JSON.parse(reqBody) as { taskId?: string }) : {};
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
