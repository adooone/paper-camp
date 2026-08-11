import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { buildReconcilePrompt } from '@/app/features/plans/prompts';
import { parseEntityFile, parsePlanFile, parseSuggestions } from '@/core/parse';
import { advanceAnchor } from '@/core/phase-progress';
import { entityToPlan, readEntities, readEntitiesWithDerivedStatus } from '@/core/readers';
import { agentThreadMessage, computePlanContentHash } from '@/core/serialize';
import { logFromThread } from '@/core/thread';
import {
  type AgentId,
  type AgentTaskState,
  type AgentTaskStatus,
  type CheckName,
  DEFAULT_AGENTS,
  type DefaultAgentsMap,
  type FixReviewResult,
  type IdeaEntry,
  type PaperCampConfig,
  type PhaseItem,
  type PhaseMilestone,
  type PhaseRunRecord,
  type PlanEntry,
  type RateLimitSnapshot,
  type ReconcileQueueItem,
  type ReviewThread,
  type RunUsage,
  type TaskKind,
  coerceAgentConfig,
} from '@/types/index';
import { killWithEscalation, runProcessWithTimeout } from './agent-process';
import { AGENTS, type AgentAdapter, resolveAgent } from './agents';
import { parseFixReviewResult, settleReviewThreads } from './fix-review-settle';
import { campFile, entityFileInput, fileExists, readMaybe, writeEntityFile } from './helpers';
import { appendNotification } from './notification-log';
import { UNLOGGED_TASK_KINDS, logTaskCompletion } from './task-log';

const MAX_LINES = 50;
const PHASE_TIMEOUT_MS = 30 * 60 * 1000;
const FIX_ATTEMPT_CAP = 2;
const AUTH_ERROR_MARKER = 'Not logged in · Please run /login';
const NEEDS_DECISION_MARKER = 'NEEDS-DECISION:';

function isAuthError(text: string): boolean {
  return text.includes(AUTH_ERROR_MARKER);
}

function humanizeTaskKind(kind: TaskKind): string {
  return kind.replace(/-/g, ' ');
}

// Lets the phase or fix-pass agent short-circuit straight to escalation when
// it hits a genuine ambiguity or product choice, instead of guessing or
// spinning through the fix-attempt cap.
function extractBlocker(text: string): string | undefined {
  const idx = text.indexOf(NEEDS_DECISION_MARKER);
  if (idx === -1) return undefined;
  return text.slice(idx + NEEDS_DECISION_MARKER.length).trim() || undefined;
}

export interface AgentTask {
  id: string;
  taskKind: TaskKind;
  planTitle: string;
  planId?: string;
  startedAt: string;
  phaseIndex?: number;
  /** Set while run-all's post-phase Fixes loop is on this item; checked ahead of
   * `phaseIndex` in didTaskProgress since a stale phaseIndex can linger from the
   * phase loop that ran before it. */
  fixIndex?: number;
  fixAttempt?: number;
  fixAttemptCap?: number;
  blocker?: string;
  planBaseline?: { phases: number; log: number };
  ideaId?: string;
  ideaLogBaseline?: number;
  reconcileBaseline?: string;
  suggestBaseline?: number;
  // Kept in prompt-numbered order so the agent's 1-based verdicts map to thread ids.
  fixReviewThreads?: ReviewThread[];
  fixReviewResult?: FixReviewResult;
  reconcileResults?: ReconcileQueueItem[];
  status: AgentTaskStatus;
  agentId: AgentId;
  adapter: AgentAdapter;
  proc: ChildProcess;
  lines: string[];
  phaseAnchor?: PhaseMilestone;
  anchorEnteredAt?: number;
  lastStreamAt?: number;
  errorKind?: 'auth' | 'question';
  errorReason?: string;
  runUsage?: RunUsage;
  rateLimit?: RateLimitSnapshot;
  phaseRuns?: PhaseRunRecord[];
}

export function readDefaultAgentIds(root: string): DefaultAgentsMap {
  try {
    const raw = readFileSync(join(root, 'papercamp', 'config.json'), 'utf-8');
    const config = JSON.parse(raw) as Record<string, unknown> & { defaultAgent?: AgentId };
    const rawAgents = config.defaultAgents as Record<string, unknown> | undefined;
    if (rawAgents) {
      return {
        phase: coerceAgentConfig(rawAgents.phase),
        planDraft: coerceAgentConfig(rawAgents.planDraft),
        ideaExtend: coerceAgentConfig(rawAgents.ideaExtend),
        commitSuggest: coerceAgentConfig(rawAgents.commitSuggest),
        feedback: rawAgents.feedback
          ? coerceAgentConfig(rawAgents.feedback)
          : DEFAULT_AGENTS.feedback,
      };
    }
    if (config.defaultAgent) {
      const id = config.defaultAgent;
      return {
        phase: { agent: id },
        planDraft: { agent: id },
        ideaExtend: { agent: id },
        commitSuggest: { agent: id },
        feedback: { agent: id },
      };
    }
    return DEFAULT_AGENTS;
  } catch {
    return DEFAULT_AGENTS;
  }
}

type Result = { ok: true } | { ok: false; error: string };

export function buildAgentPrompt(
  plan: PlanEntry,
  phase: PhaseItem,
  phaseIndex: number,
  toleratedRed: CheckName[] = [],
): string {
  const details = phase.description ? `Phase details:\n${phase.description}\n\n` : '';
  const toleratedNote =
    toleratedRed.length > 0
      ? `The following check(s) are already red before this phase and are pre-existing or known-flaky: ${toleratedRed.join(', ')}. Do not try to fix them — leave them exactly as they are.\n\n`
      : '';
  return `You are executing exactly one phase of the plan "${plan.title}" (${plan.id ?? 'no id'}): phase ${phaseIndex + 1}, "${phase.text}". The plan is a single file at papercamp/ideas/${plan.id ?? '<ID>'}.md.

${toleratedNote}${details}Plan context: ${plan.body}

Do only this phase — do not start any other phase, even if it looks quick.

Comments: do NOT add any comments to the code — none, the code is the documentation, reasoning goes in the commit message. Exception: per docs/CODE_STYLE.md, raw HTML used because paper-ui has no equivalent still needs its one-line inline comment explaining the gap.

You are headless with no browser or display. Verify only with terminal commands (\`pnpm run check-types\`) — never open the app, navigate to a URL, or take screenshots, even if the phase describes a visual check; note in the commit message that it's left to a human instead.

Leave the whole repo green before you finish, not just the files you edited: run \`pnpm run check-types\` and fix anything red. Keep such fixes minimal and correct.

If you hit a genuine blocker — an ambiguous requirement or a real product decision only a human can make, not just something you haven't figured out yet — do not guess. Output a single line starting with \`${NEEDS_DECISION_MARKER}\` followed by your question, then stop without finishing the phase.

When the work is done:
1. In the plan file's \`### Phases\` list, change this phase's checkbox from \`- [ ]\` to \`- [x]\`. Do not change any other line.
2. If every phase in the list is now checked, set the plan's \`status:\` frontmatter field to \`review\` — never \`done\`; per this repo's AGENTS.md a human promotes plans to done.`;
}

export function buildFixPassPrompt(
  plan: PlanEntry,
  label: string,
  itemText: string,
  introducedChecks: CheckName[],
): string {
  const scope =
    introducedChecks.length > 0
      ? `The check(s) this ${label.startsWith('fix') ? 'fix' : 'phase'} broke: ${introducedChecks.join(', ')}. Only fix those — other checks that were already red before it started are pre-existing or known-flaky and are not your concern.`
      : "The project's lint/format/type-check/test checks are failing.";
  return `${scope} This is after ${label}, "${itemText}", of the plan "${plan.title}" (${plan.id ?? 'no id'}).

Only make the failing checks pass — change nothing else: no new features, no refactors, no unrelated cleanup, no edits outside what the failures require, and do not touch the plan file.

Run \`pnpm run check-types\`, \`npx biome check . --write\`, and \`npx vitest run\` to see what's red, fix exactly that, then stop.

If the failure requires a decision you can't make on your own — not just a fix you haven't found yet — output a single line starting with \`${NEEDS_DECISION_MARKER}\` followed by your question, then stop.`;
}

// Implements one post-build Fix — a finding logged after the plan's phases already
// shipped, so it lives in its own `### Fixes` list rather than rewriting phase history.
export function buildFixItemPrompt(
  plan: PlanEntry,
  fix: PhaseItem,
  fixIndex: number,
  toleratedRed: CheckName[] = [],
): string {
  const details = fix.description ? `Fix details:\n${fix.description}\n\n` : '';
  const toleratedNote =
    toleratedRed.length > 0
      ? `The following check(s) are already red before this fix and are pre-existing or known-flaky: ${toleratedRed.join(', ')}. Do not try to fix them — leave them exactly as they are.\n\n`
      : '';
  return `You are implementing exactly one post-build Fix on the plan "${plan.title}" (${plan.id ?? 'no id'}): fix ${fixIndex + 1}, "${fix.text}". The plan is a single file at papercamp/ideas/${plan.id ?? '<ID>'}.md.

${toleratedNote}${details}Plan context: ${plan.body}

Do only this fix — do not start any other fix or phase, even if it looks quick.

Comments: do NOT add any comments to the code — none, the code is the documentation, reasoning goes in the commit message. Exception: per docs/CODE_STYLE.md, raw HTML used because paper-ui has no equivalent still needs its one-line inline comment explaining the gap.

You are headless with no browser or display. Verify only with terminal commands (\`pnpm run check-types\`) — never open the app, navigate to a URL, or take screenshots, even if the fix describes a visual check; note in the commit message that it's left to a human instead.

Leave the whole repo green before you finish, not just the files you edited: run \`pnpm run check-types\` and fix anything red. Keep such fixes minimal and correct.

If you hit a genuine blocker — an ambiguous requirement or a real product decision only a human can make, not just something you haven't figured out yet — do not guess. Output a single line starting with \`${NEEDS_DECISION_MARKER}\` followed by your question, then stop without finishing the fix.

When the work is done, in the plan file's \`### Fixes\` list, change this fix's checkbox from \`- [ ]\` to \`- [x]\`. Do not change any other line.`;
}

const NO_PROGRESS_WARNING_BY_KIND: Partial<Record<TaskKind, (task: AgentTask) => string>> = {
  extend: (task) =>
    `Warning: agent finished but the idea body for ${task.ideaId} did not change — verify manually`,
  reconcile: () =>
    'Warning: agent finished but the plan body and phase text did not change — verify manually',
  suggest: () => 'Agent finished without appending any suggestions — nothing new found',
  'fix-review': () =>
    'Warning: agent finished without reporting which comments it addressed — verify manually',
};

function noProgressWarning(task: AgentTask): string {
  const forKind = NO_PROGRESS_WARNING_BY_KIND[task.taskKind];
  if (forKind) return forKind(task);
  if (task.ideaId !== undefined) {
    return `Warning: agent finished but ${task.ideaId} gained no Phases section — verify manually`;
  }
  if (task.phaseIndex !== undefined) {
    return 'Warning: agent finished but did not check off this phase in the plan file — verify manually';
  }
  return 'Warning: agent finished but appended nothing to Phases or Log — verify manually';
}

function createEmptyAgentState(): AgentManagerState {
  return {
    tasks: new Map(),
    clients: new Set(),
    lastLaunchedId: undefined,
    lastExclusiveLaunchedId: undefined,
    pendingFixReviewResult: null,
  };
}

export function createAgentManager(
  root: string,
  onAuditComplete?: (planId: string) => Promise<void>,
  onPhaseCommit?: (
    plan: PlanEntry,
    phase: PhaseItem,
    phaseIndex: number,
    run?: { usage: RunUsage; kind: 'phase' | 'fix' },
  ) => Promise<void>,
  onRunComplete?: (plan: PlanEntry) => Promise<void>,
  state: AgentManagerState = createEmptyAgentState(),
) {
  // `tasks`/`clients` are the same Map/Set a hot-reloaded replacement instance
  // receives via `state`, so in-flight process listeners (registered on this
  // closure) and the new instance's getStatus()/subscribe() read and write the
  // same underlying collections instead of drifting apart after the swap.
  const { tasks, clients } = state;

  function currentTask(): AgentTask | undefined {
    return state.lastLaunchedId ? tasks.get(state.lastLaunchedId) : undefined;
  }

  function runningTasks(): AgentTask[] {
    return [...tasks.values()].filter((task) => !isTaskDone(task));
  }

  function isSuperseded(task: AgentTask): boolean {
    return state.lastExclusiveLaunchedId !== task.id;
  }

  function isStopping(task: AgentTask): boolean {
    return task.status === 'stopping';
  }

  // Writes a run-all escalation into the plan's thread so a human sees the agent's
  // question in the same place they'd leave one, and the Feedback chat can pick it
  // back up instead of the run dying with no trace.
  // Also flips the plan back to in-progress so a parked run surfaces in the
  // worklist as needing input rather than looking merely errored, and tags the
  // task 'question' so resumeQuestionParkedTasks knows to re-enter it once the
  // Feedback chat's reply resolves the question.
  async function escalateToLog(
    task: AgentTask,
    planId: string | undefined,
    message: string,
  ): Promise<void> {
    task.errorKind = 'question';
    if (!planId) return;
    const ideasDir = campFile(root, 'ideas');
    const { entries } = await readEntities(ideasDir);
    const entry = entries.find((e) => e.id === planId && e.kind !== 'note');
    if (!entry) return;
    const primaryFile = join(ideasDir, `${planId}.md`);
    const file = (await fileExists(primaryFile))
      ? primaryFile
      : join(ideasDir, 'archive', `${planId}.md`);
    if (!(await fileExists(file))) return;
    const needsInput = entry.status !== 'done' && entry.status !== 'dropped';
    await writeEntityFile(
      file,
      entityFileInput(entry, {
        thread: [...(entry.thread ?? []), agentThreadMessage(message, 'question')],
        ...(needsInput ? { status: 'in-progress' } : {}),
      }),
    );
  }

  function registerTask(task: AgentTask): void {
    tasks.set(task.id, task);
    state.lastLaunchedId = task.id;
    if (EXCLUSIVE_KINDS.has(task.taskKind)) state.lastExclusiveLaunchedId = task.id;
  }

  function newTask(
    base: Pick<AgentTask, 'taskKind' | 'planTitle' | 'agentId' | 'adapter' | 'proc'> &
      Partial<AgentTask>,
  ): AgentTask {
    return {
      id: randomUUID(),
      startedAt: new Date().toISOString(),
      status: 'starting',
      lines: [],
      ...base,
    };
  }

  function registerAndStart(task: AgentTask): AgentTask {
    registerTask(task);
    setStatus(task, 'running');
    return task;
  }

  function broadcast(message: string, taskId?: string) {
    const data = `data: ${JSON.stringify({ message, timestamp: new Date().toISOString(), type: 'agent', taskId })}\n\n`;
    for (const client of clients) {
      try {
        client.write(data);
      } catch {
        clients.delete(client);
      }
    }
  }

  function pushLine(task: AgentTask, text: string) {
    task.lines.push(text);
    if (task.lines.length > MAX_LINES) task.lines.shift();
    broadcast(text, task.id);
  }

  const MAX_COMPLETED_TASKS = 20;

  function pruneCompletedTasks(): void {
    const completed = [...tasks.entries()].filter(([, t]) => isTaskDone(t));
    const excess = completed.length - MAX_COMPLETED_TASKS;
    for (let i = 0; i < excess; i++) {
      tasks.delete(completed[i][0]);
    }
  }

  function setStatus(task: AgentTask, status: AgentTaskStatus) {
    task.status = status;
    // Classify from the terminal output only: a genuine auth failure leaves the marker
    // among the last lines, whereas a transient blip earlier in a long multi-phase run
    // (that then recovered and failed the gate) must not mislabel the run as auth.
    // A 'question' tag set by escalateToLog is left alone — it already identifies the
    // parked cause more precisely than anything the terminal lines could tell us.
    if (status === 'error' && task.errorKind !== 'question') {
      const terminalLines = task.lines.flatMap((entry) => entry.split(/\r?\n/)).slice(-5);
      task.errorKind = terminalLines.some(isAuthError) ? 'auth' : undefined;
    }
    broadcast(`agent: ${status}`, task.id);
    if (status === 'done' || status === 'error' || status === 'superseded') {
      void logTaskCompletion(root, task, status);
      pruneCompletedTasks();
    }
    const entityId = task.planId ?? task.ideaId;
    if (
      (status === 'done' || status === 'error') &&
      entityId &&
      !UNLOGGED_TASK_KINDS.has(task.taskKind)
    ) {
      void appendNotification(root, {
        id: task.id,
        kind: 'completed',
        entityId,
        entityTitle: task.planTitle,
        text: `${humanizeTaskKind(task.taskKind)} ${status === 'done' ? 'finished' : 'failed'}`,
        outcome: status,
      });
    }
  }

  // Finalizes a task preempted by a newer exclusive-kind launch: loud and honest,
  // never silently swallowed and never mislabeled as an `error`.
  function finalizeSuperseded(task: AgentTask): void {
    pushLine(task, '[superseded] preempted by a newer run for this plan');
    setStatus(task, 'superseded');
  }

  async function didTaskProgress(task: AgentTask): Promise<boolean | null> {
    try {
      if (task.taskKind === 'extend') {
        const { entries } = await readEntities(join(root, 'papercamp', 'ideas'));
        const idea = entries.find((e) => e.id === task.ideaId);
        if (!idea) return null;
        if (task.ideaLogBaseline === undefined) return null;
        return logFromThread(idea.thread).length > task.ideaLogBaseline;
      }
      if (task.taskKind === 'fix-review') {
        return task.fixReviewResult !== undefined;
      }
      if (task.taskKind === 'reconcile') {
        const { entries } = await readEntities(join(root, 'papercamp', 'ideas'));
        const plan = entries.find((e) => e.id === task.planId && e.kind !== 'note');
        if (!plan || task.reconcileBaseline === undefined) return null;
        return (
          JSON.stringify({ body: plan.body, phases: plan.phases.map((p) => p.text) }) !==
          task.reconcileBaseline
        );
      }
      if (task.taskKind === 'suggest') {
        if (task.suggestBaseline === undefined) return null;
        const suggestions = parseSuggestions(await readMaybe(campFile(root, 'suggestions.md')));
        return suggestions.length > task.suggestBaseline;
      }
      const { entries } = await readEntities(join(root, 'papercamp', 'ideas'));
      if (task.ideaId !== undefined) {
        const target = entries.find((e) => e.id === task.ideaId);
        return target ? target.phases.length > 0 : null;
      }
      const plan =
        entries.find((e) => e.id === task.planId && e.kind !== 'note') ??
        entries.find((e) => e.title === task.planTitle && e.kind !== 'note');
      if (!plan) return null;
      if (task.fixIndex !== undefined) {
        return plan.fixes?.[task.fixIndex]?.done ?? null;
      }
      if (task.phaseIndex !== undefined) {
        return plan.phases[task.phaseIndex]?.done ?? null;
      }
      if (!task.planBaseline) return null;
      return (
        plan.phases.length > task.planBaseline.phases ||
        logFromThread(plan.thread).length > task.planBaseline.log
      );
    } catch {
      return null;
    }
  }

  function finishTask(task: AgentTask, error: boolean) {
    if (error) {
      setStatus(task, 'error');
      return;
    }
    if (task.taskKind === 'fix-review') {
      task.fixReviewResult = parseFixReviewResult(task.lines, task.fixReviewThreads ?? []);
      if (task.fixReviewResult) {
        state.pendingFixReviewResult = task.fixReviewResult;
        settleReviewThreads(root, task.fixReviewResult, (text) => pushLine(task, text));
      }
    }
    didTaskProgress(task).then((progressed) => {
      if (progressed === false) {
        pushLine(task, noProgressWarning(task));
      }
      setStatus(task, 'done');
      if (task.taskKind === 'audit' && task.planId && progressed === true) {
        onAuditComplete?.(task.planId).catch(() => {});
      }
    });
  }

  function isTaskDone(task: AgentTask): boolean {
    return task.status === 'done' || task.status === 'error' || task.status === 'superseded';
  }

  function noteAnchor(task: AgentTask, milestone: PhaseMilestone) {
    const advanced = advanceAnchor(task.phaseAnchor, milestone);
    if (advanced !== task.phaseAnchor) {
      task.phaseAnchor = advanced;
      task.anchorEnteredAt = Date.now();
    }
  }

  function attachReader(task: AgentTask) {
    if (!task.proc.stdout) return;
    task.lastStreamAt = Date.now();
    const rl = createInterface({ input: task.proc.stdout });
    rl.on('line', (line) => {
      if (isTaskDone(task) || !line.trim()) return;
      task.lastStreamAt = Date.now();
      const parsed = task.adapter.parseLine(line);
      if (!parsed) return;
      if (parsed.milestone) noteAnchor(task, parsed.milestone);
      if (parsed.reason) task.errorReason = parsed.reason;
      if (parsed.rateLimit) task.rateLimit = parsed.rateLimit;
      if (parsed.usage) task.runUsage = parsed.usage;
      if (parsed.text) pushLine(task, parsed.text);
      if (parsed.done) {
        finishTask(task, Boolean(parsed.error));
      }
    });

    let stderr = '';
    task.proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    task.proc.on('close', (code) => {
      if (isTaskDone(task)) return;
      if (task.status === 'starting' || task.status === 'running') {
        // Plain-text CLI failures (e.g. an auth error) never reach parseLine's JSON
        // parser, so this is the only place they surface in the task's own output.
        if (code !== 0 && stderr.trim()) pushLine(task, stderr.trim());
        finishTask(task, code !== 0);
      } else if (task.status === 'stopping') {
        setStatus(task, 'done');
      }
    });

    task.proc.on('error', (err) => {
      if (isTaskDone(task)) return;
      pushLine(task, `Failed to spawn agent: ${err.message}`);
      setStatus(task, 'error');
    });
  }

  function spawnAgent(adapter: AgentAdapter, args: string[]): ChildProcess {
    return spawn(adapter.command, args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  // Shared by batch-reconcile's per-entity loop, the fix pass, and run-all's
  // per-phase loop: spawn one agent process against `task.proc`, stream its
  // parsed lines, and resolve with the same { ok, timedOut, stderr } shape
  // each caller already made its own pass/fail decisions from.
  function runPhaseProcess(
    task: AgentTask,
    adapter: AgentAdapter,
    prompt: string,
    model: string | undefined,
    effort: string | undefined,
    opts: { guardSuperseded?: boolean; trackBlocker?: boolean; resume?: string } = {},
  ): Promise<{
    ok: boolean;
    timedOut: boolean;
    stderr: string;
    sessionId?: string;
    usage?: RunUsage;
  }> {
    // Cleared per attempt: this task object is reused across a queue's items and a
    // fix pass's retries, so a stale reason from an earlier, ultimately-successful
    // attempt must never be attributed to a later, unrelated failure.
    task.errorReason = undefined;
    task.phaseAnchor = undefined;
    task.anchorEnteredAt = undefined;
    task.lastStreamAt = Date.now();
    const proc = spawnAgent(
      adapter,
      adapter.buildArgs(prompt, { model, effort, resume: opts.resume }),
    );
    task.proc = proc;

    let sessionId: string | undefined;
    let usage: RunUsage | undefined;
    if (proc.stdout) {
      const rl = createInterface({ input: proc.stdout });
      rl.on('line', (line) => {
        if (opts.guardSuperseded && isSuperseded(task)) return;
        task.lastStreamAt = Date.now();
        const parsed = adapter.parseLine(line);
        if (parsed?.milestone) noteAnchor(task, parsed.milestone);
        if (parsed?.sessionId) sessionId = parsed.sessionId;
        if (parsed?.usage) usage = parsed.usage;
        if (parsed?.rateLimit) task.rateLimit = parsed.rateLimit;
        if (parsed?.reason) {
          task.errorReason = parsed.reason;
          if (opts.trackBlocker) task.blocker = parsed.reason;
        }
        if (parsed?.text && parsed.text !== 'Agent is working…') {
          pushLine(task, `  ${parsed.text}`);
          if (opts.trackBlocker) {
            const blocker = extractBlocker(parsed.text);
            if (blocker) task.blocker = blocker;
          }
        }
      });
    }

    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    return runProcessWithTimeout(proc, PHASE_TIMEOUT_MS).then((result) => ({
      ...result,
      stderr,
      sessionId,
      usage,
    }));
  }

  // 'worktree' collides with everything (one git tree); 'entities' only collides
  // on a shared id, unless `ids: 'all'` (batch-reconcile sweeps the whole corpus).
  type WriteSet =
    | { scope: 'none' }
    | { scope: 'suggestions' }
    | { scope: 'entities'; ids: 'all' | string[] }
    | { scope: 'worktree' };

  const EXCLUSIVE_KINDS = new Set<TaskKind>([
    'phase',
    'run-all',
    'fix-review',
    'sync',
    'resolve-conflict',
  ]);
  const ENTITY_WRITER_KINDS = new Set<TaskKind>([
    'audit',
    'reconcile',
    'batch-reconcile',
    'draft',
    'extend',
  ]);
  const READONLY_KINDS = new Set<TaskKind>([
    'commit-suggest',
    'overlap-check',
    'prioritise',
    'feedback',
  ]);

  function writeSetFor(taskKind: TaskKind, entityId?: string): WriteSet {
    if (READONLY_KINDS.has(taskKind)) return { scope: 'none' };
    if (EXCLUSIVE_KINDS.has(taskKind)) return { scope: 'worktree' };
    if (taskKind === 'suggest') return { scope: 'suggestions' };
    if (taskKind === 'batch-reconcile') return { scope: 'entities', ids: 'all' };
    if (ENTITY_WRITER_KINDS.has(taskKind)) {
      // No id (shouldn't happen in practice): fail closed to worktree-wide.
      return entityId ? { scope: 'entities', ids: [entityId] } : { scope: 'worktree' };
    }
    return { scope: 'worktree' };
  }

  function writeSetsCollide(a: WriteSet, b: WriteSet): boolean {
    if (a.scope === 'none' || b.scope === 'none') return false;
    if (a.scope === 'worktree' || b.scope === 'worktree') return true;
    if (a.scope === 'suggestions' || b.scope === 'suggestions') {
      return a.scope === b.scope;
    }
    if (a.ids === 'all' || b.ids === 'all') return true;
    return a.ids.some((id) => b.ids.includes(id));
  }

  function currentEntityId(task: AgentTask): string | undefined {
    return task.planId ?? task.ideaId;
  }

  function admit(taskKind: TaskKind, entityId?: string): Result | null {
    const incoming = writeSetFor(taskKind, entityId);
    for (const task of runningTasks()) {
      const running = writeSetFor(task.taskKind, currentEntityId(task));
      if (writeSetsCollide(running, incoming)) {
        return { ok: false, error: 'An agent task is already running' };
      }
    }
    return null;
  }

  // Synchronous, no `await` between the admit() check and registering the task,
  // so two colliding launches can't both pass the gate.
  function launch(
    identity: { planTitle: string; planId?: string; agentOverride?: AgentId },
    prompt: string,
    scope: Pick<
      AgentTask,
      | 'taskKind'
      | 'phaseIndex'
      | 'planBaseline'
      | 'ideaId'
      | 'ideaLogBaseline'
      | 'reconcileBaseline'
      | 'suggestBaseline'
      | 'fixReviewThreads'
    >,
  ): Result {
    const blocked = admit(scope.taskKind, identity.planId ?? scope.ideaId);
    if (blocked) return blocked;
    const defaultAgents = readDefaultAgentIds(root);
    const {
      id: agentId,
      adapter,
      model,
      effort,
    } = resolveAgent({
      agentId: identity.agentOverride,
      defaultAgents,
      taskKind: scope.taskKind,
    });
    const proc = spawnAgent(adapter, adapter.buildArgs(prompt, { model, effort }));
    const task = newTask({
      planTitle: identity.planTitle,
      planId: identity.planId,
      agentId,
      adapter,
      proc,
      ...scope,
    });
    registerAndStart(task);
    attachReader(task);
    return { ok: true };
  }

  async function findPlanById(planId: string): Promise<PlanEntry | undefined> {
    const { entries } = await readEntities(campFile(root, 'ideas'));
    const entity = entries.find((e) => e.id === planId && e.kind !== 'note');
    return entity ? entityToPlan(entity) : undefined;
  }

  function start(plan: PlanEntry, phaseIndex: number): Result {
    const blocked = admit('phase', plan.id);
    if (blocked) return blocked;
    const phase = plan.phases[phaseIndex];
    if (!phase) {
      return { ok: false, error: 'Phase not found' };
    }
    const prompt = buildAgentPrompt(plan, phase, phaseIndex);
    return launch({ planTitle: plan.title, planId: plan.id, agentOverride: plan.agent }, prompt, {
      taskKind: 'phase',
      phaseIndex,
    });
  }

  function startForPlan(
    plan: PlanEntry,
    prompt: string,
    taskKind: 'audit' | 'reconcile' = 'audit',
  ): Result {
    return launch({ planTitle: plan.title, planId: plan.id, agentOverride: plan.agent }, prompt, {
      taskKind,
      ...(taskKind === 'reconcile'
        ? {
            reconcileBaseline: JSON.stringify({
              body: plan.body,
              phases: plan.phases.map((p) => p.text),
            }),
          }
        : { planBaseline: { phases: plan.phases.length, log: plan.log?.length ?? 0 } }),
    });
  }

  function startFixReview(plan: PlanEntry, prompt: string, threads: ReviewThread[]): Result {
    return launch({ planTitle: plan.title, planId: plan.id, agentOverride: plan.agent }, prompt, {
      taskKind: 'fix-review',
      fixReviewThreads: threads,
    });
  }

  function startForIdea(idea: IdeaEntry, prompt: string): Result {
    if (!idea.id) {
      return { ok: false, error: 'Idea has no id to link a drafted plan back to' };
    }
    return launch({ planTitle: `Draft plan for ${idea.id}` }, prompt, {
      taskKind: 'draft',
      ideaId: idea.id,
    });
  }

  function startForIdeaExtend(idea: IdeaEntry, prompt: string): Result {
    if (!idea.id) {
      return { ok: false, error: 'Idea has no id to extend' };
    }
    return launch({ planTitle: `Extend ${idea.id}` }, prompt, {
      taskKind: 'extend',
      ideaId: idea.id,
      ideaLogBaseline: idea.log?.length ?? 0,
    });
  }

  async function startSuggest(prompt: string): Promise<Result> {
    const blocked = admit('suggest');
    if (blocked) return blocked;
    const suggestBaseline = parseSuggestions(
      await readMaybe(campFile(root, 'suggestions.md')),
    ).length;
    return launch({ planTitle: 'Suggest ideas' }, prompt, { taskKind: 'suggest', suggestBaseline });
  }

  // Automatic escalation from runGitSync's deterministic failure — no confirmation
  // step, since a blocked sync is exactly the "stuck" outcome this exists to avoid.
  function startGitSyncRecovery(prompt: string): Result {
    return launch({ planTitle: 'Recover sync to main' }, prompt, { taskKind: 'sync' });
  }

  // One-click "ask the agent to resolve" against a paused rebase, launched only on
  // explicit human confirmation from the sync-failed toast — unlike startGitSyncRecovery's
  // automatic escalation, a content conflict never gets auto-merged unseen.
  function startResolveConflict(prompt: string): Result {
    return launch({ planTitle: 'Resolve rebase conflict' }, prompt, {
      taskKind: 'resolve-conflict',
    });
  }

  async function findBatchPlanFile(plansDir: string, id: string): Promise<string | null> {
    const direct = join(plansDir, `${id}.md`);
    try {
      await stat(direct);
      return direct;
    } catch {}
    const archived = join(plansDir, 'archive', `${id}.md`);
    try {
      await stat(archived);
      return archived;
    } catch {}
    return null;
  }

  function startBatchReconcile(): Result {
    const blocked = admit('batch-reconcile');
    if (blocked) return blocked;
    const defaultAgents = readDefaultAgentIds(root);
    // Each entity re-resolves its own agent below, so a per-entity override is honored.
    const { id: agentId, adapter } = resolveAgent({ defaultAgents, taskKind: 'reconcile' });

    // Stub proc — replaced per entity in the loop.
    const stubProc = spawn('sh', ['-c', 'exit 0'], {
      cwd: root,
      stdio: 'ignore',
    });
    const task = registerAndStart(
      newTask({
        taskKind: 'batch-reconcile',
        planTitle: 'Batch reconcile',
        agentId,
        adapter,
        proc: stubProc,
        reconcileResults: [],
      }),
    );

    (async () => {
      try {
        const { entries } = await readEntitiesWithDerivedStatus(join(root, 'papercamp', 'ideas'));
        const candidates = entries
          .filter((e) => e.kind !== 'note' && e.status !== 'done' && e.status !== 'dropped')
          .map((e) => entityToPlan(e));

        if (candidates.length === 0) {
          pushLine(task, 'No open ideas or plans to reconcile.');
          setStatus(task, 'done');
          return;
        }

        pushLine(
          task,
          `Reconciling ${candidates.length} entit${candidates.length === 1 ? 'y' : 'ies'}…`,
        );
        let reconciled = 0;
        let skipped = 0;
        let failed = 0;
        const total = candidates.length;

        for (const [index, plan] of candidates.entries()) {
          if (task.status === 'stopping') break;
          if (!plan.id) {
            skipped++;
            continue;
          }

          const planFile = await findBatchPlanFile(join(root, 'papercamp', 'ideas'), plan.id);
          if (!planFile) {
            skipped++;
            continue;
          }

          const before = { body: plan.body, phases: plan.phases };

          pushLine(task, `[reconcile] ${plan.id} ${plan.title} (${index + 1}/${total})`);
          const {
            adapter: entAdapter,
            model,
            effort,
          } = resolveAgent({ agentId: plan.agent, defaultAgents, taskKind: 'reconcile' });
          const prompt = buildReconcilePrompt(plan);
          const {
            ok: success,
            timedOut,
            stderr,
          } = await runPhaseProcess(task, entAdapter, prompt, model, effort);

          if (timedOut) {
            failed++;
            pushLine(task, `[timeout] ${plan.id} — no progress for ${PHASE_TIMEOUT_MS / 60000}min`);
            continue;
          }

          if (success) {
            let changed = false;
            try {
              // parseEntityFile, not parsePlanFile: candidates include backlog ideas,
              // which parsePlanFile's plan-only status schema would reject.
              const rawAfter = await readFile(planFile, 'utf-8');
              const parsedAfter = parseEntityFile(rawAfter);
              const after = parsedAfter.entries[0]
                ? entityToPlan(parsedAfter.entries[0])
                : undefined;
              changed = after
                ? JSON.stringify({ body: after.body, phases: after.phases.map((p) => p.text) }) !==
                  JSON.stringify({ body: before.body, phases: before.phases.map((p) => p.text) })
                : false;
            } catch {}
            reconciled++;
            if (changed) {
              task.reconcileResults?.push({ planId: plan.id, title: plan.title, before });
            }
            pushLine(
              task,
              changed ? `[done] ${plan.id} — updated` : `[done] ${plan.id} — no drift found`,
            );
          } else {
            failed++;
            if (stderr.trim()) pushLine(task, stderr.trim());
            pushLine(
              task,
              task.errorReason
                ? `[fail] ${plan.id} — ${task.errorReason}`
                : `[fail] ${plan.id} — agent error`,
            );
          }
        }

        if (task.status === 'stopping') {
          setStatus(task, 'done');
          return;
        }

        pushLine(
          task,
          `Reconcile complete — ${reconciled} reconciled, ${skipped} skipped, ${failed} failed`,
        );
        setStatus(task, failed > 0 ? 'error' : 'done');
      } catch (err) {
        pushLine(task, `Batch reconcile failed: ${(err as Error).message}`);
        setStatus(task, 'error');
      }
    })();

    return { ok: true };
  }

  // Spawned in place of the phase agent when the post-phase gate goes red — a
  // distinct short prompt scoped to fixing checks, not the phase agent rerun.
  function runFixPass(
    task: AgentTask,
    plan: PlanEntry,
    label: string,
    itemText: string,
    adapter: AgentAdapter,
    model: string | undefined,
    effort: string | undefined,
    attempt: number,
    attemptCap: number,
    introducedChecks: CheckName[],
    resume: string | undefined,
  ): Promise<{ ok: boolean; timedOut: boolean; sessionId?: string }> {
    pushLine(task, `[fix] ${label} — fix attempt ${attempt}/${attemptCap} for failing checks`);
    const prompt = buildFixPassPrompt(plan, label, itemText, introducedChecks);
    return runPhaseProcess(task, adapter, prompt, model, effort, {
      guardSuperseded: true,
      trackBlocker: true,
      resume,
    }).then(({ ok, timedOut, stderr, sessionId }) => {
      if (!ok && !timedOut && stderr.trim()) pushLine(task, stderr.trim());
      return { ok, timedOut, sessionId };
    });
  }

  type QueueKind = 'phase' | 'fix';

  // Drives run-all's per-item loop — shared by the phases pass and the post-phase
  // Fixes pass, which differ only in which list/checkbox section they target.
  async function runQueue(
    task: AgentTask,
    plan: PlanEntry,
    kind: QueueKind,
    items: { item: PhaseItem; i: number }[],
    total: number,
    adapter: AgentAdapter,
    model: string | undefined,
    effort: string | undefined,
    runProjectChecks: (() => Promise<CheckName[]>) | undefined,
    initialToleratedRed: Set<CheckName>,
    initialSessionId: string | undefined,
  ): Promise<{
    completed: number;
    failed: number;
    toleratedRed: Set<CheckName>;
    sessionId: string | undefined;
    exit: 'superseded' | 'stopping' | 'ran';
  }> {
    let completed = 0;
    let failed = 0;
    let toleratedRed = initialToleratedRed;
    let sessionId = initialSessionId;

    for (const { item, i } of items) {
      if (isSuperseded(task) || task.status === 'stopping') break;

      // Set phaseIndex/fixIndex so didTaskProgress can verify the right checkbox.
      if (kind === 'phase') task.phaseIndex = i;
      else {
        task.fixIndex = i;
        task.phaseIndex = undefined;
      }
      pushLine(task, `[${kind} ${i + 1}/${total}] ${item.text}`);

      const prompt =
        kind === 'phase'
          ? buildAgentPrompt(plan, item, i, [...toleratedRed])
          : buildFixItemPrompt(plan, item, i, [...toleratedRed]);
      const {
        ok: exitedOk,
        timedOut,
        stderr,
        sessionId: newSessionId,
        usage: phaseUsage,
      } = await runPhaseProcess(task, adapter, prompt, model, effort, {
        guardSuperseded: true,
        trackBlocker: true,
        resume: sessionId,
      });
      if (newSessionId) sessionId = newSessionId;

      if (isSuperseded(task))
        return { completed, failed, toleratedRed, sessionId, exit: 'superseded' };
      if (isStopping(task)) break;

      if (task.blocker) {
        failed++;
        pushLine(task, `[blocked] ${kind} ${i + 1} — agent needs a decision: ${task.blocker}`);
        await escalateToLog(
          task,
          plan.id,
          `Run-all parked on ${kind} ${i + 1} ("${item.text}") — the agent needs a decision: ${task.blocker}`,
        );
        task.blocker = undefined;
        break;
      }

      if (timedOut) {
        failed++;
        pushLine(
          task,
          `[timeout] ${kind} ${i + 1} — no progress for ${PHASE_TIMEOUT_MS / 60000}min, stopping`,
        );
        break;
      }

      if (!exitedOk) {
        failed++;
        if (stderr.trim()) pushLine(task, stderr.trim());
        pushLine(
          task,
          task.errorReason
            ? `[fail] ${kind} ${i + 1} — ${task.errorReason}, stopping`
            : `[fail] ${kind} ${i + 1} — agent error, stopping`,
        );
        break;
      }

      const progressed = await didTaskProgress(task);
      if (!progressed) {
        failed++;
        pushLine(
          task,
          progressed === null
            ? `[fail] ${kind} ${i + 1} — could not read plan after run, stopping`
            : `[fail] ${kind} ${i + 1} — ${kind} checkbox did not flip, stopping`,
        );
        break;
      }

      if (runProjectChecks) {
        pushLine(task, `[verify] ${kind} ${i + 1} — running lint/format/test`);
        let failing = await runProjectChecks();
        if (isSuperseded(task))
          return { completed, failed, toleratedRed, sessionId, exit: 'superseded' };
        if (isStopping(task)) break;
        let introduced = failing.filter((c) => !toleratedRed.has(c));
        let checksOk = introduced.length === 0;

        let fixAttempt = 0;
        let fixBlocker: string | undefined;
        while (!checksOk && fixAttempt < FIX_ATTEMPT_CAP) {
          if (isSuperseded(task) || isStopping(task)) break;
          fixAttempt++;
          task.fixAttempt = fixAttempt;
          task.fixAttemptCap = FIX_ATTEMPT_CAP;

          const { timedOut: fixTimedOut, sessionId: fixSessionId } = await runFixPass(
            task,
            plan,
            `${kind} ${i + 1}`,
            item.text,
            adapter,
            model,
            effort,
            fixAttempt,
            FIX_ATTEMPT_CAP,
            introduced,
            sessionId,
          );
          if (fixSessionId) sessionId = fixSessionId;
          if (isSuperseded(task))
            return { completed, failed, toleratedRed, sessionId, exit: 'superseded' };
          if (task.blocker) {
            fixBlocker = task.blocker;
            task.blocker = undefined;
            break;
          }
          if (fixTimedOut) {
            pushLine(
              task,
              `[fix] ${kind} ${i + 1} — fix attempt ${fixAttempt}/${FIX_ATTEMPT_CAP} timed out`,
            );
          }

          pushLine(
            task,
            `[verify] ${kind} ${i + 1} — re-running lint/format/test (attempt ${fixAttempt}/${FIX_ATTEMPT_CAP})`,
          );
          failing = await runProjectChecks();
          if (isSuperseded(task))
            return { completed, failed, toleratedRed, sessionId, exit: 'superseded' };
          introduced = failing.filter((c) => !toleratedRed.has(c));
          checksOk = introduced.length === 0;
        }
        task.fixAttempt = undefined;
        task.fixAttemptCap = undefined;

        if (isStopping(task)) break;

        if (fixBlocker) {
          failed++;
          pushLine(task, `[blocked] ${kind} ${i + 1} — agent needs a decision: ${fixBlocker}`);
          await escalateToLog(
            task,
            plan.id,
            `Run-all parked on ${kind} ${i + 1} ("${item.text}") — the fix pass needs a decision: ${fixBlocker}`,
          );
          break;
        }

        if (!checksOk) {
          failed++;
          pushLine(
            task,
            `[blocked] ${kind} ${i + 1} — project checks still failing after ${fixAttempt} fix attempt(s)`,
          );
          await escalateToLog(
            task,
            plan.id,
            `Run-all parked on ${kind} ${i + 1} ("${item.text}") — project checks (${introduced.join(', ')}) are still failing after ${fixAttempt} fix attempt(s). Reply here with guidance to unblock and resume.`,
          );
          break;
        }

        // Carry forward whatever's still red (pre-existing/flaky) so the
        // next item isn't blamed for breakage this run never introduced.
        toleratedRed = new Set(failing);
      }

      completed++;
      if (phaseUsage) {
        task.phaseRuns ??= [];
        task.phaseRuns.push({ kind, index: i, usage: phaseUsage });
      }
      if (onPhaseCommit) {
        pushLine(task, `[commit] ${kind} ${i + 1} — ${item.text}`);
        await onPhaseCommit(plan, item, i, phaseUsage ? { usage: phaseUsage, kind } : undefined);
      }
    }

    return {
      completed,
      failed,
      toleratedRed,
      sessionId,
      exit: isSuperseded(task) ? 'superseded' : task.status === 'stopping' ? 'stopping' : 'ran',
    };
  }

  function startRunAllPhases(
    plan: PlanEntry,
    runProjectChecks?: () => Promise<CheckName[]>,
  ): Result {
    const blocked = admit('run-all', plan.id);
    if (blocked) return blocked;
    const unchecked = plan.phases
      .map((phase, i) => ({ item: phase, i }))
      .filter(({ item }) => !item.done);
    const uncheckedFixes = (plan.fixes ?? [])
      .map((fix, i) => ({ item: fix, i }))
      .filter(({ item }) => !item.done);

    if (unchecked.length === 0 && uncheckedFixes.length === 0) {
      return { ok: false, error: 'No unchecked phases to run' };
    }

    const defaultAgents = readDefaultAgentIds(root);
    const {
      id: agentId,
      adapter,
      model,
      effort,
    } = resolveAgent({ agentId: plan.agent, defaultAgents, taskKind: 'run-all' });

    const stubProc = spawn('sh', ['-c', 'exit 0'], { cwd: root, stdio: 'ignore' });
    const task = registerAndStart(
      newTask({
        taskKind: 'run-all',
        planTitle: plan.title,
        planId: plan.id,
        agentId,
        adapter,
        proc: stubProc,
      }),
    );

    (async () => {
      try {
        // Checks already red before this run — pre-existing or known-flaky
        // breakage this run didn't cause, so the fix loop never owns it.
        let toleratedRed = new Set<CheckName>(runProjectChecks ? await runProjectChecks() : []);
        if (isSuperseded(task)) {
          finalizeSuperseded(task);
          return;
        }
        if (toleratedRed.size > 0) {
          pushLine(
            task,
            `[verify] tolerating pre-existing red check(s): ${[...toleratedRed].join(', ')}`,
          );
        }

        const phaseResult = await runQueue(
          task,
          plan,
          'phase',
          unchecked,
          plan.phases.length,
          adapter,
          model,
          effort,
          runProjectChecks,
          toleratedRed,
          undefined,
        );
        toleratedRed = phaseResult.toleratedRed;

        if (phaseResult.exit === 'superseded') {
          finalizeSuperseded(task);
          return;
        }
        if (phaseResult.exit === 'stopping') {
          setStatus(task, 'done');
          return;
        }

        // Fixes only start once every phase has landed clean — a plan mid-build
        // never jumps ahead to post-build follow-ups.
        let fixResult: Awaited<ReturnType<typeof runQueue>> = {
          completed: 0,
          failed: 0,
          toleratedRed,
          sessionId: phaseResult.sessionId,
          exit: 'ran',
        };
        if (phaseResult.failed === 0 && uncheckedFixes.length > 0) {
          fixResult = await runQueue(
            task,
            plan,
            'fix',
            uncheckedFixes,
            (plan.fixes ?? []).length,
            adapter,
            model,
            effort,
            runProjectChecks,
            toleratedRed,
            phaseResult.sessionId,
          );

          if (fixResult.exit === 'superseded') {
            finalizeSuperseded(task);
            return;
          }
          if (fixResult.exit === 'stopping') {
            setStatus(task, 'done');
            return;
          }
        }

        const failed = phaseResult.failed + fixResult.failed;
        const summary = [
          unchecked.length > 0 || uncheckedFixes.length === 0
            ? `${phaseResult.completed} phase(s)`
            : undefined,
          uncheckedFixes.length > 0 ? `${fixResult.completed} fix(es)` : undefined,
        ]
          .filter(Boolean)
          .join(' and ');

        if (failed > 0) {
          pushLine(task, `Run stopped after ${summary} completed, 1 failed`);
          setStatus(task, 'error');
        } else {
          pushLine(task, `All ${summary} completed`);
          if (onRunComplete) {
            try {
              pushLine(task, '[review] setting plan status to review');
              await onRunComplete(plan);
            } catch (err) {
              pushLine(
                task,
                `Warning: could not set plan status to review: ${(err as Error).message}`,
              );
            }
          }
          setStatus(task, 'done');
        }
      } catch (err) {
        if (isSuperseded(task)) {
          if (!isTaskDone(task)) finalizeSuperseded(task);
        } else {
          pushLine(task, `Run all phases failed: ${(err as Error).message}`);
          setStatus(task, 'error');
        }
      }
    })();

    return { ok: true };
  }

  const READONLY_PROMPT_TIMEOUT_MS = 60_000;
  const STDIN_MAX_BYTES = 10 * 1024 * 1024;

  function runReadOnlyPrompt(
    prompt: string,
    taskKind: 'commit-suggest' | 'overlap-check' | 'prioritise' | 'feedback',
    planTitle: string,
  ): Promise<string> {
    if (Buffer.byteLength(prompt, 'utf-8') > STDIN_MAX_BYTES) {
      return Promise.reject(new Error('Prompt exceeds the 10MB stdin limit'));
    }
    const defaultAgents = readDefaultAgentIds(root);
    const {
      id: agentId,
      adapter,
      model,
      effort,
    } = resolveAgent({
      defaultAgents,
      taskKind,
    });

    const isClaude = agentId === 'claude-code';
    // Builds its own args instead of adapter.buildArgs: must never pick up the
    // shared `--permission-mode auto` flag, since this only reads a prompt on stdin.
    const args = isClaude ? ['-p', '--output-format', 'json'] : ['run', '--format', 'json'];
    if (model) args.push(isClaude ? '--model' : '-m', model);
    if (effort) args.push(isClaude ? '--effort' : '--variant', effort);

    return new Promise((resolve, reject) => {
      const proc = spawn(adapter.command, args, {
        cwd: root,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const task = registerAndStart(newTask({ taskKind, planTitle, agentId, adapter, proc }));

      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn();
      };
      const timeout = setTimeout(() => {
        settle(() => {
          pushLine(task, `${planTitle} timed out`);
          setStatus(task, 'error');
          killWithEscalation(proc);
          reject(new Error(`${planTitle} timed out`));
        });
      }, READONLY_PROMPT_TIMEOUT_MS);

      proc.stdin?.on('error', () => {});
      proc.stdin?.write(prompt);
      proc.stdin?.end();

      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      proc.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });
      proc.on('close', (code) => {
        settle(() => {
          if (code === 0) {
            setStatus(task, 'done');
            // opencode outputs JSON events; extract the text parts for the response.
            const result = isClaude
              ? stdout
              : stdout
                  .split('\n')
                  .map((line) => {
                    try {
                      const evt = JSON.parse(line);
                      if (evt?.type === 'text' && evt?.part?.text) return evt.part.text;
                    } catch {}
                    return null;
                  })
                  .filter(Boolean)
                  .join('\n');
            resolve(result);
          } else {
            const errText = stderr || `${adapter.command} exited with code ${code}`;
            pushLine(task, errText);
            setStatus(task, 'error');
            reject(new Error(errText));
          }
        });
      });
      proc.on('error', (err) => {
        settle(() => {
          pushLine(task, `Failed to spawn agent: ${err.message}`);
          setStatus(task, 'error');
          reject(err);
        });
      });
    });
  }

  function runCommitSuggest(prompt: string): Promise<string> {
    return runReadOnlyPrompt(prompt, 'commit-suggest', 'Suggest commit message');
  }

  function runOverlapCheck(prompt: string): Promise<string> {
    return runReadOnlyPrompt(prompt, 'overlap-check', 'Check idea overlap');
  }

  function runPrioritise(prompt: string): Promise<string> {
    return runReadOnlyPrompt(prompt, 'prioritise', 'Prioritise queue');
  }

  function runFeedbackReply(prompt: string, planTitle: string): Promise<string> {
    return runReadOnlyPrompt(prompt, 'feedback', planTitle);
  }

  function stop(taskId?: string): Result {
    const task = taskId ? tasks.get(taskId) : currentTask();
    if (!task || isTaskDone(task)) {
      return { ok: false, error: 'No agent task running' };
    }
    setStatus(task, 'stopping');
    killWithEscalation(task.proc);
    return { ok: true };
  }

  function getStatus(): AgentTaskState[] {
    return [...tasks.values()].reverse().map((task) => ({
      id: task.id,
      status: task.status,
      taskKind: task.taskKind,
      planTitle: task.planTitle,
      planId: task.planId,
      phaseIndex: task.phaseIndex,
      ...(task.fixAttempt !== undefined
        ? { fixAttempt: task.fixAttempt, fixAttemptCap: task.fixAttemptCap }
        : {}),
      ideaId: task.ideaId,
      agentId: task.agentId,
      lines: [...task.lines],
      ...(task.phaseAnchor ? { phaseAnchor: task.phaseAnchor } : {}),
      ...(task.anchorEnteredAt !== undefined ? { anchorEnteredAt: task.anchorEnteredAt } : {}),
      ...(task.lastStreamAt !== undefined ? { lastStreamAt: task.lastStreamAt } : {}),
      ...(task.fixReviewResult ? { suggestedCommit: task.fixReviewResult.commit } : {}),
      ...(task.errorKind ? { errorKind: task.errorKind } : {}),
      ...(task.rateLimit ? { rateLimit: task.rateLimit } : {}),
    }));
  }

  function getReconcileQueue(): ReconcileQueueItem[] | null {
    const task = currentTask();
    if (!task || task.taskKind !== 'batch-reconcile') return null;
    return [...(task.reconcileResults ?? [])];
  }

  function getFixReviewResult(): FixReviewResult | null {
    return state.pendingFixReviewResult;
  }

  function consumeFixReviewResult(): void {
    state.pendingFixReviewResult = null;
  }

  // The login relay's confirmation cue (IDEA-101): a run-all or single-phase task that
  // parked with errorKind 'auth' re-launches for the same plan instead of staying failed —
  // the checkbox it never flipped is exactly what `start`/`startRunAllPhases` pick up next.
  async function resumeAuthParkedTasks(
    runProjectChecks?: () => Promise<CheckName[]>,
  ): Promise<{ resumed: string[] }> {
    const parked = [...tasks.values()].filter(
      (task) =>
        task.status === 'error' &&
        task.errorKind === 'auth' &&
        task.planId &&
        (task.taskKind === 'run-all' || task.taskKind === 'phase'),
    );

    const resumed: string[] = [];
    for (const task of parked) {
      const planId = task.planId as string;
      const plan = await findPlanById(planId);
      if (!plan) continue;
      const result =
        task.taskKind === 'run-all'
          ? startRunAllPhases(plan, runProjectChecks)
          : task.phaseIndex !== undefined
            ? start(plan, task.phaseIndex)
            : { ok: false as const, error: 'Missing phase index' };
      if (result.ok) {
        task.errorKind = undefined;
        resumed.push(planId);
      }
    }
    return { resumed };
  }

  // The Feedback chat's resolution cue (IDEA-125): a run-all that parked with errorKind
  // 'question' — a permission ask or NEEDS-DECISION escalateToLog surfaced — re-launches
  // for the same plan once the human's reply resolves that question, picking back up at
  // whichever phase/fix is still unchecked instead of staying failed forever.
  async function resumeQuestionParkedTasks(
    planId: string,
    runProjectChecks?: () => Promise<CheckName[]>,
  ): Promise<{ resumed: boolean }> {
    const task = [...tasks.values()].find(
      (t) =>
        t.status === 'error' &&
        t.errorKind === 'question' &&
        t.planId === planId &&
        t.taskKind === 'run-all',
    );
    if (!task) return { resumed: false };
    const plan = await findPlanById(planId);
    if (!plan) return { resumed: false };
    const result = startRunAllPhases(plan, runProjectChecks);
    if (result.ok) task.errorKind = undefined;
    return { resumed: result.ok };
  }

  return {
    start,
    startForPlan,
    startFixReview,
    getFixReviewResult,
    consumeFixReviewResult,
    startForIdea,
    startForIdeaExtend,
    startBatchReconcile,
    startRunAllPhases,
    resumeAuthParkedTasks,
    resumeQuestionParkedTasks,
    startSuggest,
    startGitSyncRecovery,
    startResolveConflict,
    runCommitSuggest,
    runOverlapCheck,
    runPrioritise,
    runFeedbackReply,
    stop,
    getStatus,
    getReconcileQueue,
    // Handed to a hot-reloaded replacement instance's constructor so both share
    // this exact state object — in-flight tasks and their process listeners keep
    // updating the same Map/Set/scalars the new instance reads.
    getState: () => state,
    subscribe(res: ServerResponse) {
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
    // Kills every task's process, not just the most-recently-launched one, since
    // several can be running concurrently under the write-set gate.
    killCurrent(): Promise<void> {
      // `killed` only reflects whether kill() was called, not whether it exited.
      const stillRunning = (proc: ChildProcess) =>
        proc.exitCode === null && proc.signalCode === null;
      const procs = [...tasks.values()].map((task) => task.proc).filter(stillRunning);
      if (procs.length === 0) return Promise.resolve();
      for (const proc of procs) proc.kill('SIGTERM');
      return new Promise((resolve) => {
        let remaining = procs.length;
        const onExit = () => {
          remaining--;
          if (remaining <= 0) {
            clearTimeout(timer);
            resolve();
          }
        };
        for (const proc of procs) proc.once('exit', onExit);
        const timer = setTimeout(() => {
          for (const proc of procs) {
            if (stillRunning(proc)) proc.kill('SIGKILL');
          }
          resolve();
        }, 2000);
      });
    },
  };
}

export interface AgentManagerState {
  tasks: Map<string, AgentTask>;
  lastLaunchedId: string | undefined;
  lastExclusiveLaunchedId: string | undefined;
  // Outlives task replacement: a human can launch another run before pushing,
  // and the verdict must still be there to settle threads once the fix is pushed.
  pendingFixReviewResult: FixReviewResult | null;
  clients: Set<ServerResponse>;
}

export interface AgentManager {
  start: (plan: PlanEntry, phaseIndex: number) => Result;
  startForPlan: (plan: PlanEntry, prompt: string, taskKind?: 'audit' | 'reconcile') => Result;
  startFixReview: (plan: PlanEntry, prompt: string, threads: ReviewThread[]) => Result;
  getFixReviewResult: () => FixReviewResult | null;
  consumeFixReviewResult: () => void;
  startForIdea: (idea: IdeaEntry, prompt: string) => Result;
  startForIdeaExtend: (idea: IdeaEntry, prompt: string) => Result;
  startBatchReconcile: () => Result;
  startRunAllPhases: (plan: PlanEntry, runProjectChecks?: () => Promise<CheckName[]>) => Result;
  resumeAuthParkedTasks: (
    runProjectChecks?: () => Promise<CheckName[]>,
  ) => Promise<{ resumed: string[] }>;
  resumeQuestionParkedTasks: (
    planId: string,
    runProjectChecks?: () => Promise<CheckName[]>,
  ) => Promise<{ resumed: boolean }>;
  startSuggest: (prompt: string) => Promise<Result>;
  startGitSyncRecovery: (prompt: string) => Result;
  startResolveConflict: (prompt: string) => Result;
  runCommitSuggest: (prompt: string) => Promise<string>;
  runOverlapCheck: (prompt: string) => Promise<string>;
  runPrioritise: (prompt: string) => Promise<string>;
  runFeedbackReply: (prompt: string, planTitle: string) => Promise<string>;
  stop: (taskId?: string) => Result;
  getStatus: () => AgentTaskState[];
  getReconcileQueue: () => ReconcileQueueItem[] | null;
  getState: () => AgentManagerState;
  subscribe: (res: ServerResponse) => void;
  killCurrent: () => Promise<void>;
}
