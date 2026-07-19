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
import { computePlanContentHash } from '@/core/serialize';
import {
  type AgentId,
  type AgentTaskState,
  type AgentTaskStatus,
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
import { campFile, readMaybe } from './helpers';
import { logTaskCompletion } from './task-log';

const MAX_LINES = 50;
const PHASE_TIMEOUT_MS = 30 * 60 * 1000;

interface AgentTask {
  id: string;
  taskKind: TaskKind;
  planTitle: string;
  planId?: string;
  startedAt: string;
  phaseIndex?: number;
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
}

function readDefaultAgentIds(root: string): DefaultAgentsMap {
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

export function buildAgentPrompt(plan: PlanEntry, phase: PhaseItem, phaseIndex: number): string {
  const details = phase.description ? `Phase details:\n${phase.description}\n\n` : '';
  return `You are executing exactly one phase of the plan "${plan.title}" (${plan.id ?? 'no id'}): phase ${phaseIndex + 1}, "${phase.text}". The plan is a single file at papercamp/ideas/${plan.id ?? '<ID>'}.md.

${details}Plan context: ${plan.body}

Do only this phase — do not start any other phase, even if it looks quick.

Comments: the code is the documentation. Default to zero comments. Per docs/CODE_STYLE.md §7, a comment ships only if it states a *why* that is not derivable from the code AND would cost a future reader real debugging time AND fits in one line. Never narrate what the code does, restate a type, label a block, or explain your reasoning for a change — that belongs in the commit message and your progress.md bullet, not the source. When in doubt, delete it.

Execution environment: you are a headless automated agent running in a terminal. There is no browser, display, or GUI available to you. Verify your work only with terminal commands — type-check, lint, and tests (e.g. \`pnpm run check-types\`, \`pnpm run lint\`, \`pnpm test\`). Never attempt visual or browser-based verification: do not open the app in a browser, navigate to a dev-server URL or address, take screenshots, or run any GUI/visual check — even if this phase or the plan text describes one (e.g. "check in Chrome", a \`host:port\` address, "visual pass"). If a phase's only verification is visual, make the code change, then note in your progress.md bullet that visual confirmation is left to a human, and do not block on it.

Leave the build green before you finish. The verification that gates this phase runs lint, format, type-check, and tests over the WHOLE project — not just the files you edited. Run \`pnpm run check-types\` and \`npx biome check . --write\` and make the entire repo pass. If a lint, format, or type error appears anywhere — including in a file you did not modify and did not introduce — fix it. "It's unrelated to my phase" / "it's pre-existing" is never a reason to leave a red check: a broken check blocks this phase regardless of who caused it. Keeping the whole project's checks green is part of completing your phase, not a separate phase — so this does not conflict with "do only this phase." Keep such incidental fixes minimal and correct.

When the work is done:
1. In the plan file's \`### Phases\` list, change this phase's checkbox from \`- [ ]\` to \`- [x]\`. Do not change any other line.
2. Add one bullet describing what you did under today's \`## YYYY-MM-DD\` heading at the top of progress.md (create the heading at the top if today's is not there yet — newest day stays first).
3. If every phase in the list is now checked, set the plan's \`status:\` frontmatter field to \`review\` — never \`done\`; per this repo's AGENTS.md a human promotes plans to done.`;
}

export function createAgentManager(
  root: string,
  onAuditComplete?: (planId: string, gapPhases: number) => Promise<void>,
  onPhaseCommit?: (plan: PlanEntry, phase: PhaseItem, phaseIndex: number) => Promise<void>,
  onRunComplete?: (plan: PlanEntry) => Promise<void>,
) {
  const clients = new Set<ServerResponse>();
  const tasks = new Map<string, AgentTask>();
  let lastLaunchedId: string | undefined;

  function currentTask(): AgentTask | undefined {
    return lastLaunchedId ? tasks.get(lastLaunchedId) : undefined;
  }

  function runningTasks(): AgentTask[] {
    return [...tasks.values()].filter((task) => !isTaskDone(task));
  }

  function isSuperseded(task: AgentTask): boolean {
    return lastLaunchedId !== task.id;
  }

  function registerTask(task: AgentTask): void {
    tasks.set(task.id, task);
    lastLaunchedId = task.id;
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

  // Outlives task replacement: a human can launch another run before pushing,
  // and the verdict must still be there to settle threads once the fix is pushed.
  let pendingFixReviewResult: FixReviewResult | null = null;

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
    broadcast(`agent: ${status}`, task.id);
    if (status === 'done' || status === 'error') {
      logTaskCompletion(root, task, status);
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
    setStatus(task, error ? 'error' : 'done');
    if (error) return;
    if (task.taskKind === 'fix-review') {
      task.fixReviewResult = parseFixReviewResult(task.lines, task.fixReviewThreads ?? []);
      if (task.fixReviewResult) {
        pendingFixReviewResult = task.fixReviewResult;
        settleReviewThreads(root, task.fixReviewResult, (text) => pushLine(task, text));
      }
    }
    didTaskProgress(task).then((progressed) => {
      if (progressed === false) {
        const warning =
          task.taskKind === 'extend'
            ? `Warning: agent finished but the idea body for ${task.ideaId} did not change — verify manually`
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
      if (task.taskKind === 'audit' && task.planId && progressed === true) {
        onAuditComplete?.(task.planId, 0).catch(() => {});
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

    task.proc.on('close', (code) => {
      if (isTaskDone(task)) return;
      if (task.status === 'starting' || task.status === 'running') {
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
    'batch-reconcile',
    'draft',
    'extend',
  ]);
  const READONLY_KINDS = new Set<TaskKind>(['commit-suggest', 'overlap-check']);

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
          // Drain stderr — an unread pipe can fill and hang the subprocess.
          proc.stderr?.on('data', () => {});

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

  function startRunAllPhases(plan: PlanEntry, runProjectChecks?: () => Promise<boolean>): Result {
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

        for (const { phase, i } of unchecked) {
          if (isSuperseded(task) || task.status === 'stopping') break;

          // Set phaseIndex so didTaskProgress can verify the right checkbox.
          task.phaseIndex = i;
          pushLine(task, `[phase ${i + 1}/${total}] ${phase.text}`);

          const prompt = buildAgentPrompt(plan, phase, i);
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
              }
            });
          }
          proc.stderr?.on('data', () => {});

          const { ok: exitedOk, timedOut } = await runProcessWithTimeout(proc, PHASE_TIMEOUT_MS);

          if (isSuperseded(task)) return;

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
            const checksOk = await runProjectChecks();
            if (isSuperseded(task)) return;
            if (!checksOk) {
              failed++;
              pushLine(task, `[fail] phase ${i + 1} — project checks failed, stopping`);
              break;
            }
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
    taskKind: 'commit-suggest' | 'overlap-check',
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
      ideaId: task.ideaId,
      agentId: task.agentId,
      lines: [...task.lines],
      ...(task.fixReviewResult ? { suggestedCommit: task.fixReviewResult.commit } : {}),
    }));
  }

  function getReconcileQueue(): ReconcileQueueItem[] | null {
    const task = currentTask();
    if (!task || task.taskKind !== 'batch-reconcile') return null;
    return [...(task.reconcileResults ?? [])];
  }

  function getFixReviewResult(): FixReviewResult | null {
    return pendingFixReviewResult;
  }

  function consumeFixReviewResult(): void {
    pendingFixReviewResult = null;
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
    runCommitSuggest,
    runOverlapCheck,
    stop,
    getStatus,
    getReconcileQueue,
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

export interface AgentManager {
  start: (plan: PlanEntry, phaseIndex: number) => Result;
  startForPlan: (plan: PlanEntry, prompt: string, taskKind?: 'audit' | 'reconcile') => Result;
  startFixReview: (plan: PlanEntry, prompt: string, threads: ReviewThread[]) => Result;
  getFixReviewResult: () => FixReviewResult | null;
  consumeFixReviewResult: () => void;
  startForIdea: (idea: IdeaEntry, prompt: string) => Result;
  startForIdeaExtend: (idea: IdeaEntry, prompt: string) => Result;
  startBatchReconcile: () => Result;
  startRunAllPhases: (plan: PlanEntry, runProjectChecks?: () => Promise<boolean>) => Result;
  startSuggest: (prompt: string) => Promise<Result>;
  runCommitSuggest: (prompt: string) => Promise<string>;
  runOverlapCheck: (prompt: string) => Promise<string>;
  stop: (taskId?: string) => Result;
  getStatus: () => AgentTaskState[];
  getReconcileQueue: () => ReconcileQueueItem[] | null;
  subscribe: (res: ServerResponse) => void;
  killCurrent: () => Promise<void>;
}
