import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { buildReconcilePrompt } from '@/app/features/plans/prompts';
import { parseEntityFile, parsePlanFile, parseSuggestions } from '@/core/parse';
import { entityToPlan, readEntities, readEntitiesWithDerivedStatus } from '@/core/readers';
import { computePlanContentHash, todayDateString } from '@/core/serialize';
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
  type PlanEntry,
  type ReconcileQueueItem,
  type ReviewThread,
  type TaskKind,
  coerceAgentConfig,
} from '@/types/index';
import { killWithEscalation, runProcessWithTimeout } from './agent-process';
import { AGENTS, type AgentAdapter, resolveAgent } from './agents';
import { parseFixReviewResult, settleReviewThreads } from './fix-review-settle';
import { campFile, entityFileInput, fileExists, readMaybe, writeEntityFile } from './helpers';
import { logTaskCompletion } from './task-log';

const MAX_LINES = 50;
const PHASE_TIMEOUT_MS = 30 * 60 * 1000;
const FIX_ATTEMPT_CAP = 2;
const AUTH_ERROR_MARKER = 'Not logged in · Please run /login';
const NEEDS_DECISION_MARKER = 'NEEDS-DECISION:';

function isAuthError(text: string): boolean {
  return text.includes(AUTH_ERROR_MARKER);
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
  errorKind?: 'auth';
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
      };
    }
    if (config.defaultAgent) {
      const id = config.defaultAgent;
      return {
        phase: { agent: id },
        planDraft: { agent: id },
        ideaExtend: { agent: id },
        commitSuggest: { agent: id },
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

You are headless with no browser or display. Verify only with terminal commands (\`pnpm run check-types\`, \`pnpm run lint\`, \`pnpm test\`) — never open the app, navigate to a URL, or take screenshots, even if the phase describes a visual check; note in the commit message that it's left to a human instead.

Leave the whole repo green before you finish, not just the files you edited: run \`pnpm run check-types\` and \`npx biome check . --write\` and fix anything red, including pre-existing failures elsewhere — that's part of completing this phase, not a separate one. Keep such fixes minimal and correct.

If you hit a genuine blocker — an ambiguous requirement or a real product decision only a human can make, not just something you haven't figured out yet — do not guess. Output a single line starting with \`${NEEDS_DECISION_MARKER}\` followed by your question, then stop without finishing the phase.

When the work is done:
1. In the plan file's \`### Phases\` list, change this phase's checkbox from \`- [ ]\` to \`- [x]\`. Do not change any other line.
2. If every phase in the list is now checked, set the plan's \`status:\` frontmatter field to \`review\` — never \`done\`; per this repo's AGENTS.md a human promotes plans to done.`;
}

export function buildFixPassPrompt(
  plan: PlanEntry,
  phaseIndex: number,
  introducedChecks: CheckName[],
): string {
  const phase = plan.phases[phaseIndex];
  const scope =
    introducedChecks.length > 0
      ? `The check(s) this phase broke: ${introducedChecks.join(', ')}. Only fix those — other checks that were already red before this phase started are pre-existing or known-flaky and are not your concern.`
      : "The project's lint/format/type-check/test checks are failing.";
  return `${scope} This is after phase ${phaseIndex + 1}, "${phase?.text ?? plan.title}", of the plan "${plan.title}" (${plan.id ?? 'no id'}).

Only make the failing checks pass — change nothing else: no new features, no refactors, no unrelated cleanup, no edits outside what the failures require, and do not touch the plan file.

Run \`pnpm run check-types\`, \`npx biome check . --write\`, and \`pnpm test\` to see what's red, fix exactly that, then stop.

If the failure requires a decision you can't make on your own — not just a fix you haven't found yet — output a single line starting with \`${NEEDS_DECISION_MARKER}\` followed by your question, then stop.`;
}

function createEmptyAgentState(): AgentManagerState {
  return {
    tasks: new Map(),
    clients: new Set(),
    lastLaunchedId: undefined,
    pendingFixReviewResult: null,
  };
}

export function createAgentManager(
  root: string,
  onAuditComplete?: (planId: string) => Promise<void>,
  onPhaseCommit?: (plan: PlanEntry, phase: PhaseItem, phaseIndex: number) => Promise<void>,
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
    return state.lastLaunchedId !== task.id;
  }

  function isStopping(task: AgentTask): boolean {
    return task.status === 'stopping';
  }

  // Writes a run-all escalation into the plan's `### Log` (Comments) so a human
  // sees the agent's question in the same place they'd leave one, and Apply-notes
  // / rework can pick the thread back up instead of the run dying with no trace.
  // Also flips the plan back to in-progress so a parked run surfaces in the
  // worklist as needing input rather than looking merely errored.
  async function escalateToLog(planId: string | undefined, message: string): Promise<void> {
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
        log: [...(entry.log ?? []), { date: todayDateString(), text: message }],
        ...(needsInput ? { status: 'in-progress' } : {}),
      }),
    );
  }

  function registerTask(task: AgentTask): void {
    tasks.set(task.id, task);
    state.lastLaunchedId = task.id;
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
    if (status === 'error') {
      const terminalLines = task.lines.flatMap((entry) => entry.split(/\r?\n/)).slice(-5);
      task.errorKind = terminalLines.some(isAuthError) ? 'auth' : undefined;
    }
    broadcast(`agent: ${status}`, task.id);
    if (status === 'done' || status === 'error') {
      void logTaskCompletion(root, task, status);
      pruneCompletedTasks();
    }
  }

  async function didTaskProgress(task: AgentTask): Promise<boolean | null> {
    try {
      if (task.taskKind === 'extend') {
        const { entries } = await readEntities(join(root, 'papercamp', 'ideas'));
        const idea = entries.find((e) => e.id === task.ideaId);
        if (!idea) return null;
        if (task.ideaLogBaseline === undefined) return null;
        return (idea.log?.length ?? 0) > task.ideaLogBaseline;
      }
      if (task.taskKind === 'fix-review') {
        return task.fixReviewResult !== undefined;
      }
      if (task.taskKind === 'reconcile' || task.taskKind === 'rework') {
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
      if (task.phaseIndex !== undefined) {
        return plan.phases[task.phaseIndex]?.done ?? null;
      }
      if (!task.planBaseline) return null;
      return (
        plan.phases.length > task.planBaseline.phases ||
        (plan.log?.length ?? 0) > task.planBaseline.log
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
        const warning =
          task.taskKind === 'extend'
            ? `Warning: agent finished but the idea body for ${task.ideaId} did not change — verify manually`
            : task.taskKind === 'rework'
              ? 'Warning: agent finished but your notes produced no change to the body or phases — verify manually'
              : task.taskKind === 'reconcile'
                ? 'Warning: agent finished but the plan body and phase text did not change — verify manually'
                : task.taskKind === 'suggest'
                  ? 'Agent finished without appending any suggestions — nothing new found'
                  : task.taskKind === 'fix-review'
                    ? 'Warning: agent finished without reporting which comments it addressed — verify manually'
                    : task.ideaId !== undefined
                      ? `Warning: agent finished but ${task.ideaId} gained no Phases section — verify manually`
                      : task.phaseIndex !== undefined
                        ? 'Warning: agent finished but did not check off this phase in the plan file — verify manually'
                        : 'Warning: agent finished but appended nothing to Phases or Log — verify manually';
        pushLine(task, warning);
      }
      setStatus(task, 'done');
      if (task.taskKind === 'audit' && task.planId && progressed === true) {
        onAuditComplete?.(task.planId).catch(() => {});
      }
    });
  }

  function isTaskDone(task: AgentTask): boolean {
    return task.status === 'done' || task.status === 'error';
  }

  function attachReader(task: AgentTask) {
    if (!task.proc.stdout) return;
    const rl = createInterface({ input: task.proc.stdout });
    rl.on('line', (line) => {
      if (isTaskDone(task) || !line.trim()) return;
      const parsed = task.adapter.parseLine(line);
      if (!parsed) return;
      pushLine(task, parsed.text);
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

  // 'worktree' collides with everything (one git tree); 'entities' only collides
  // on a shared id, unless `ids: 'all'` (batch-reconcile sweeps the whole corpus).
  type WriteSet =
    | { scope: 'none' }
    | { scope: 'suggestions' }
    | { scope: 'entities'; ids: 'all' | string[] }
    | { scope: 'worktree' };

  const EXCLUSIVE_KINDS = new Set<TaskKind>(['phase', 'run-all', 'fix-review', 'sync']);
  const ENTITY_WRITER_KINDS = new Set<TaskKind>([
    'audit',
    'reconcile',
    'rework',
    'batch-reconcile',
    'draft',
    'extend',
  ]);
  const READONLY_KINDS = new Set<TaskKind>([
    'commit-suggest',
    'overlap-check',
    'prioritise',
    'review-split',
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
    taskKind: 'audit' | 'reconcile' | 'rework' = 'audit',
  ): Result {
    return launch({ planTitle: plan.title, planId: plan.id, agentOverride: plan.agent }, prompt, {
      taskKind,
      // Rework rewrites body/phases in place like reconcile, so it needs the same
      // baseline snapshot to drive the before/after preview.
      ...(taskKind === 'reconcile' || taskKind === 'rework'
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
          const proc = spawn(entAdapter.command, entAdapter.buildArgs(prompt, { model, effort }), {
            cwd: root,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          task.proc = proc;

          if (proc.stdout) {
            const rl = createInterface({ input: proc.stdout });
            rl.on('line', (line) => {
              const parsed = entAdapter.parseLine(line);
              if (parsed?.text && parsed.text !== 'Agent is working…') {
                pushLine(task, `  ${parsed.text}`);
              }
            });
          }
          let stderr = '';
          proc.stderr?.on('data', (d: Buffer) => {
            stderr += d.toString();
          });

          const { ok: success, timedOut } = await runProcessWithTimeout(proc, PHASE_TIMEOUT_MS);

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
            pushLine(task, `[fail] ${plan.id} — agent error`);
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
    phaseIndex: number,
    adapter: AgentAdapter,
    model: string | undefined,
    effort: string | undefined,
    attempt: number,
    attemptCap: number,
    introducedChecks: CheckName[],
  ): Promise<{ ok: boolean; timedOut: boolean }> {
    pushLine(
      task,
      `[fix] phase ${phaseIndex + 1} — fix attempt ${attempt}/${attemptCap} for failing checks`,
    );
    const prompt = buildFixPassPrompt(plan, phaseIndex, introducedChecks);
    const proc = spawn(adapter.command, adapter.buildArgs(prompt, { model, effort }), {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    task.proc = proc;

    if (proc.stdout) {
      const rl = createInterface({ input: proc.stdout });
      rl.on('line', (line) => {
        if (isSuperseded(task)) return;
        const parsed = adapter.parseLine(line);
        if (parsed?.text && parsed.text !== 'Agent is working…') {
          pushLine(task, `  ${parsed.text}`);
          const blocker = extractBlocker(parsed.text);
          if (blocker) task.blocker = blocker;
        }
      });
    }

    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    return runProcessWithTimeout(proc, PHASE_TIMEOUT_MS).then((result) => {
      if (!result.ok && !result.timedOut && stderr.trim()) pushLine(task, stderr.trim());
      return result;
    });
  }

  function startRunAllPhases(
    plan: PlanEntry,
    runProjectChecks?: () => Promise<CheckName[]>,
  ): Result {
    const blocked = admit('run-all', plan.id);
    if (blocked) return blocked;
    const unchecked = plan.phases
      .map((phase, i) => ({ phase, i }))
      .filter(({ phase }) => !phase.done);

    if (unchecked.length === 0) {
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
        const total = plan.phases.length;
        let completed = 0;
        let failed = 0;
        // Checks already red before a phase ran — pre-existing or known-flaky
        // breakage this run didn't cause, so the fix loop never owns it.
        let toleratedRed = new Set<CheckName>(runProjectChecks ? await runProjectChecks() : []);
        if (isSuperseded(task)) return;
        if (toleratedRed.size > 0) {
          pushLine(
            task,
            `[verify] tolerating pre-existing red check(s): ${[...toleratedRed].join(', ')}`,
          );
        }

        for (const { phase, i } of unchecked) {
          if (isSuperseded(task) || task.status === 'stopping') break;

          // Set phaseIndex so didTaskProgress can verify the right checkbox.
          task.phaseIndex = i;
          pushLine(task, `[phase ${i + 1}/${total}] ${phase.text}`);

          const prompt = buildAgentPrompt(plan, phase, i, [...toleratedRed]);
          const proc = spawn(adapter.command, adapter.buildArgs(prompt, { model, effort }), {
            cwd: root,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          task.proc = proc;

          if (proc.stdout) {
            const rl = createInterface({ input: proc.stdout });
            rl.on('line', (line) => {
              if (isSuperseded(task)) return;
              const parsed = adapter.parseLine(line);
              if (parsed?.text && parsed.text !== 'Agent is working…') {
                pushLine(task, `  ${parsed.text}`);
                const blocker = extractBlocker(parsed.text);
                if (blocker) task.blocker = blocker;
              }
            });
          }
          let stderr = '';
          proc.stderr?.on('data', (d: Buffer) => {
            stderr += d.toString();
          });

          const { ok: exitedOk, timedOut } = await runProcessWithTimeout(proc, PHASE_TIMEOUT_MS);

          if (isSuperseded(task)) return;
          if (isStopping(task)) break;

          if (task.blocker) {
            failed++;
            pushLine(task, `[blocked] phase ${i + 1} — agent needs a decision: ${task.blocker}`);
            await escalateToLog(
              plan.id,
              `Run-all parked on phase ${i + 1} ("${phase.text}") — the agent needs a decision: ${task.blocker}`,
            );
            task.blocker = undefined;
            break;
          }

          if (timedOut) {
            failed++;
            pushLine(
              task,
              `[timeout] phase ${i + 1} — no progress for ${PHASE_TIMEOUT_MS / 60000}min, stopping`,
            );
            break;
          }

          if (!exitedOk) {
            failed++;
            if (stderr.trim()) pushLine(task, stderr.trim());
            pushLine(task, `[fail] phase ${i + 1} — agent error, stopping`);
            break;
          }

          const progressed = await didTaskProgress(task);
          if (!progressed) {
            failed++;
            pushLine(
              task,
              progressed === null
                ? `[fail] phase ${i + 1} — could not read plan after run, stopping`
                : `[fail] phase ${i + 1} — phase checkbox did not flip, stopping`,
            );
            break;
          }

          if (runProjectChecks) {
            pushLine(task, `[verify] phase ${i + 1} — running lint/format/test`);
            let failing = await runProjectChecks();
            if (isSuperseded(task)) return;
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

              const { timedOut: fixTimedOut } = await runFixPass(
                task,
                plan,
                i,
                adapter,
                model,
                effort,
                fixAttempt,
                FIX_ATTEMPT_CAP,
                introduced,
              );
              if (isSuperseded(task)) return;
              if (task.blocker) {
                fixBlocker = task.blocker;
                task.blocker = undefined;
                break;
              }
              if (fixTimedOut) {
                pushLine(
                  task,
                  `[fix] phase ${i + 1} — fix attempt ${fixAttempt}/${FIX_ATTEMPT_CAP} timed out`,
                );
              }

              pushLine(
                task,
                `[verify] phase ${i + 1} — re-running lint/format/test (attempt ${fixAttempt}/${FIX_ATTEMPT_CAP})`,
              );
              failing = await runProjectChecks();
              if (isSuperseded(task)) return;
              introduced = failing.filter((c) => !toleratedRed.has(c));
              checksOk = introduced.length === 0;
            }
            task.fixAttempt = undefined;
            task.fixAttemptCap = undefined;

            if (isStopping(task)) break;

            if (fixBlocker) {
              failed++;
              pushLine(task, `[blocked] phase ${i + 1} — agent needs a decision: ${fixBlocker}`);
              await escalateToLog(
                plan.id,
                `Run-all parked on phase ${i + 1} ("${phase.text}") — the fix pass needs a decision: ${fixBlocker}`,
              );
              break;
            }

            if (!checksOk) {
              failed++;
              pushLine(
                task,
                `[blocked] phase ${i + 1} — project checks still failing after ${fixAttempt} fix attempt(s)`,
              );
              await escalateToLog(
                plan.id,
                `Run-all parked on phase ${i + 1} ("${phase.text}") — project checks (${introduced.join(', ')}) are still failing after ${fixAttempt} fix attempt(s). Reply here with guidance to unblock and resume.`,
              );
              break;
            }

            // Carry forward whatever's still red (pre-existing/flaky) so the
            // next phase isn't blamed for breakage this run never introduced.
            toleratedRed = new Set(failing);
          }

          completed++;
          if (onPhaseCommit) {
            pushLine(task, `[commit] phase ${i + 1} — ${phase.text}`);
            await onPhaseCommit(plan, phase, i);
          }
        }

        if (isSuperseded(task)) return;

        if (task.status === 'stopping') {
          setStatus(task, 'done');
          return;
        }

        if (failed > 0) {
          pushLine(task, `Run stopped after ${completed} phase(s) completed, 1 failed`);
          setStatus(task, 'error');
        } else {
          pushLine(task, `All ${completed} phase(s) completed`);
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
        if (!isSuperseded(task)) {
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
    taskKind: 'commit-suggest' | 'overlap-check' | 'prioritise' | 'review-split',
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

  function runReviewSplit(prompt: string): Promise<string> {
    return runReadOnlyPrompt(prompt, 'review-split', 'Split review');
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
      ...(task.fixReviewResult ? { suggestedCommit: task.fixReviewResult.commit } : {}),
      ...(task.errorKind ? { errorKind: task.errorKind } : {}),
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
    startSuggest,
    startGitSyncRecovery,
    runCommitSuggest,
    runOverlapCheck,
    runPrioritise,
    runReviewSplit,
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
  // Outlives task replacement: a human can launch another run before pushing,
  // and the verdict must still be there to settle threads once the fix is pushed.
  pendingFixReviewResult: FixReviewResult | null;
  clients: Set<ServerResponse>;
}

export interface AgentManager {
  start: (plan: PlanEntry, phaseIndex: number) => Result;
  startForPlan: (
    plan: PlanEntry,
    prompt: string,
    taskKind?: 'audit' | 'reconcile' | 'rework',
  ) => Result;
  startFixReview: (plan: PlanEntry, prompt: string, threads: ReviewThread[]) => Result;
  getFixReviewResult: () => FixReviewResult | null;
  consumeFixReviewResult: () => void;
  startForIdea: (idea: IdeaEntry, prompt: string) => Result;
  startForIdeaExtend: (idea: IdeaEntry, prompt: string) => Result;
  startBatchReconcile: () => Result;
  startRunAllPhases: (plan: PlanEntry, runProjectChecks?: () => Promise<CheckName[]>) => Result;
  startSuggest: (prompt: string) => Promise<Result>;
  startGitSyncRecovery: (prompt: string) => Result;
  runCommitSuggest: (prompt: string) => Promise<string>;
  runOverlapCheck: (prompt: string) => Promise<string>;
  runPrioritise: (prompt: string) => Promise<string>;
  runReviewSplit: (prompt: string) => Promise<string>;
  stop: (taskId?: string) => Result;
  getStatus: () => AgentTaskState[];
  getReconcileQueue: () => ReconcileQueueItem[] | null;
  getState: () => AgentManagerState;
  subscribe: (res: ServerResponse) => void;
  killCurrent: () => Promise<void>;
}
