import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { parseEntityFile, parsePlanFile } from '../../core/parse';
import { entityToPlan, readEntities, readEntitiesWithDerivedStatus } from '../../core/readers';
import { computePlanContentHash } from '../../core/serialize';
import {
  type AgentId,
  type AgentTaskState,
  type AgentTaskStatus,
  DEFAULT_AGENTS,
  type DefaultAgentsMap,
  type IdeaEntry,
  type PaperCampConfig,
  type PhaseItem,
  type PlanEntry,
  type ReconcileQueueItem,
  type TaskKind,
  coerceAgentConfig,
} from '../../types/index';
import { buildReconcilePrompt } from '../features/plans/prompts';
import { AGENTS, type AgentAdapter, resolveAgent } from './agents';

const MAX_LINES = 50;
// Maximum wall-clock time per phase before treating it as a stall/clarifying-question hang.
const PHASE_TIMEOUT_MS = 30 * 60 * 1000;

interface AgentTask {
  taskKind: TaskKind;
  planTitle: string;
  planId?: string;
  // Absent for a plan-scoped task (e.g. a convergence audit spanning every phase),
  // present for a single-phase task.
  phaseIndex?: number;
  // Only set for plan-scoped tasks, to check success against: did Phases or Log grow?
  planBaseline?: { phases: number; log: number };
  // Only set for an idea-drafting task, which has neither planId nor phaseIndex since
  // the plan doesn't exist yet — success is checked by idea id instead.
  ideaId?: string;
  // For idea-extend tasks: snapshot the idea's Log entry count before launch, since
  // extend now appends a dated Log entry rather than rewriting the body in place.
  ideaLogBaseline?: number;
  // For reconcile tasks: snapshot of body + phase text before launch, since a reconcile
  // rewrites prose in place rather than growing Phases/Log like an audit does.
  reconcileBaseline?: string;
  // For fix-review tasks: the branch's HEAD commit hash before launch. This task edits
  // arbitrary source files (whatever each review thread points at), so there's no
  // markdown snapshot to diff against like reconcile — success is judged by whether
  // the agent committed (and pushed) at least once, per its prompt's instructions.
  fixReviewBaseline?: string;
  // For a batch-reconcile sweep: one entry per entity whose reconcile actually changed
  // its prose, holding the pre-run snapshot so the client can review/revert it later.
  // Read by GET /api/agent/reconcile-queue.
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

/** Current HEAD commit hash of the repo at `root`, or `null` if `git` can't resolve it. */
function getHeadCommit(root: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => resolve(code === 0 ? stdout.trim() : null));
    proc.on('error', () => resolve(null));
  });
}

/** True if local HEAD matches its upstream remote-tracking ref, i.e. the push landed. */
function isHeadPushed(root: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['rev-parse', 'HEAD', '@{u}'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(false);
        return;
      }
      const [head, upstream] = stdout.trim().split('\n');
      resolve(Boolean(head) && head === upstream);
    });
    proc.on('error', () => resolve(false));
  });
}

export function buildAgentPrompt(plan: PlanEntry, phase: PhaseItem, phaseIndex: number): string {
  const details = phase.description ? `Phase details:\n${phase.description}\n\n` : '';
  return `You are executing exactly one phase of the plan "${plan.title}" (${plan.id ?? 'no id'}): phase ${phaseIndex + 1}, "${phase.text}". The plan is a single file at papercamp/ideas/${plan.id ?? '<ID>'}.md.

${details}Plan context: ${plan.body}

Do only this phase — do not start any other phase, even if it looks quick.

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
  let current: AgentTask | null = null;

  function broadcast(message: string) {
    const data = `data: ${JSON.stringify({ message, timestamp: new Date().toISOString(), type: 'agent' })}\n\n`;
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
    broadcast(text);
  }

  function setStatus(task: AgentTask, status: AgentTaskStatus) {
    task.status = status;
    broadcast(`agent: ${status}`);
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
        if (task.fixReviewBaseline === undefined) return null;
        const head = await getHeadCommit(root);
        if (head === null || head === task.fixReviewBaseline) return false;
        return await isHeadPushed(root);
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
      const { entries } = await readEntities(join(root, 'papercamp', 'ideas'));
      if (task.ideaId !== undefined) {
        // In-place drafting: success is the entity gaining its Phases section.
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
    didTaskProgress(task).then((progressed) => {
      if (current === task && progressed === false) {
        const warning =
          task.taskKind === 'extend'
            ? `Warning: agent finished but the idea body for ${task.ideaId} did not change — verify manually`
            : task.taskKind === 'reconcile'
              ? 'Warning: agent finished but the plan body and phase text did not change — verify manually'
              : task.taskKind === 'fix-review'
                ? 'Warning: agent finished but no new commit was pushed — verify manually'
                : task.ideaId !== undefined
                  ? `Warning: agent finished but ${task.ideaId} gained no Phases section — verify manually`
                  : task.phaseIndex !== undefined
                    ? 'Warning: agent finished but did not check off this phase in the plan file — verify manually'
                    : 'Warning: agent finished but appended nothing to Phases or Log — verify manually';
        pushLine(task, warning);
      }
      if (current === task && task.taskKind === 'audit' && task.planId && progressed === true) {
        onAuditComplete?.(task.planId, 0).catch(() => {});
      }
    });
  }

  function attachReader(task: AgentTask) {
    if (!task.proc.stdout) return;
    const rl = createInterface({ input: task.proc.stdout });
    rl.on('line', (line) => {
      if (current !== task || !line.trim()) return;
      const parsed = task.adapter.parseLine(line);
      if (!parsed) return;
      pushLine(task, parsed.text);
      if (parsed.done) {
        finishTask(task, Boolean(parsed.error));
      }
    });

    task.proc.on('close', (code) => {
      if (current !== task) return;
      if (task.status === 'starting' || task.status === 'running') {
        finishTask(task, code !== 0);
      } else if (task.status === 'stopping') {
        setStatus(task, 'done');
      }
    });

    task.proc.on('error', (err) => {
      if (current !== task) return;
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

  function isBusy(): boolean {
    return current !== null && current.status !== 'done' && current.status !== 'error';
  }

  // Shared by start()/startForPlan()/startForIdea(): synchronous on purpose, same
  // race-avoidance reasoning as the busy-guard above — no `await` between the guard
  // check and reserving `current`.
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
      | 'fixReviewBaseline'
    >,
  ): Result {
    if (isBusy()) {
      return { ok: false, error: 'An agent task is already running' };
    }
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
    const task: AgentTask = {
      planTitle: identity.planTitle,
      planId: identity.planId,
      status: 'starting',
      agentId,
      adapter,
      proc,
      lines: [],
      ...scope,
    };
    current = task;
    attachReader(task);
    setStatus(task, 'running');
    return { ok: true };
  }

  function start(plan: PlanEntry, phaseIndex: number): Result {
    if (isBusy()) {
      return { ok: false, error: 'An agent task is already running' };
    }
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

  // Plan-scoped launch mode: no single phase, so success is judged by whether the
  // agent appended anything to Phases or Log rather than whether one checkbox flipped.
  // Reconcile tasks rewrite prose in place instead, so they're judged against a
  // snapshot of body + phase text rather than the Phases/Log growth baseline.
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

  // Fix-review launch mode: unlike every other plan-scoped launch, this one runs on
  // the plan's existing branch against an already-open PR and is judged by whether
  // the agent committed at least once (per its prompt, it also pushes) — there's no
  // markdown snapshot to diff since it edits whatever files the review threads point
  // at. Async only because it needs the pre-launch HEAD commit; launch() itself still
  // does its busy-check/reserve synchronously once called.
  async function startFixReview(plan: PlanEntry, prompt: string): Promise<Result> {
    const fixReviewBaseline = (await getHeadCommit(root)) ?? undefined;
    return launch({ planTitle: plan.title, planId: plan.id, agentOverride: plan.agent }, prompt, {
      taskKind: 'fix-review',
      fixReviewBaseline,
    });
  }

  // Idea-drafting launch mode: there's no plan yet (and so no per-plan agent override
  // either) — the plan only exists once the agent writes it, so success is judged by
  // whether the entity's file gained a Phases section (in-place drafting).
  function startForIdea(idea: IdeaEntry, prompt: string): Result {
    if (!idea.id) {
      return { ok: false, error: 'Idea has no id to link a drafted plan back to' };
    }
    return launch({ planTitle: `Draft plan for ${idea.id}` }, prompt, {
      taskKind: 'draft',
      ideaId: idea.id,
    });
  }

  // Idea-extend launch mode: given an idea, explores the codebase and rewrites its
  // body in place in its papercamp/ideas/ file. Success is judged by whether that idea's body text
  // actually changed.
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

  function startSync(prompt: string): Result {
    return launch({ planTitle: 'Sync to main' }, prompt, { taskKind: 'sync' });
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

  // Batch reconcile: sweep every open non-note entity (idea/planned/in-progress/review)
  // and run a reconcile pass on each, rewording only prose that has drifted from the
  // code. Runs entities sequentially, updating task.proc before each spawn so stop()
  // kills the right subprocess. Snapshots each entity's body + phase text as the
  // `before` baseline right before its run, since (unlike single Reconcile, where the client captures that
  // snapshot at launch) the server is the only party in the loop here.
  function startBatchReconcile(): Result {
    if (isBusy()) {
      return { ok: false, error: 'An agent task is already running' };
    }
    const defaultAgents = readDefaultAgentIds(root);
    // Task-level agent is for status display only; each entity re-resolves its own
    // below so a per-entity `agent:` override in a mixed batch is honored.
    const { id: agentId, adapter } = resolveAgent({ defaultAgents, taskKind: 'reconcile' });

    // Stub proc — replaced per entity in the loop. Already-exited is fine: stop() sets
    // task.status = 'stopping' first; kill() on a dead process is a no-op.
    const stubProc = spawn('sh', ['-c', 'exit 0'], {
      cwd: root,
      stdio: 'ignore',
    });
    const task: AgentTask = {
      taskKind: 'batch-reconcile',
      planTitle: 'Batch reconcile',
      status: 'starting',
      agentId,
      adapter,
      proc: stubProc,
      lines: [],
      reconcileResults: [],
    };
    current = task;
    setStatus(task, 'running');

    (async () => {
      try {
        const { entries } = await readEntitiesWithDerivedStatus(join(root, 'papercamp', 'ideas'));
        const candidates = entries
          .filter((e) => e.kind !== 'note' && e.status !== 'done' && e.status !== 'dropped')
          .map((e) => entityToPlan(e));

        if (candidates.length === 0) {
          if (current === task) {
            pushLine(task, 'No open ideas or plans to reconcile.');
            setStatus(task, 'done');
          }
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
          if (current !== task || task.status === 'stopping') break;
          if (!plan.id) {
            skipped++;
            continue;
          }

          const planFile = await findBatchPlanFile(join(root, 'papercamp', 'ideas'), plan.id);
          if (!planFile) {
            skipped++;
            continue;
          }

          // Snapshot the before baseline right before this entity's run — full phase
          // objects (not just text) so a changed entity's snapshot is reusable as-is
          // for a client-side revert/diff, matching single Reconcile's `before` shape.
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
              if (current !== task) return;
              const parsed = entAdapter.parseLine(line);
              if (parsed?.text && parsed.text !== 'Agent is working…') {
                pushLine(task, `  ${parsed.text}`);
              }
            });
          }
          // Drain stderr — an unread pipe can fill and hang the subprocess.
          proc.stderr?.on('data', () => {});

          // Wait with a timeout so one entity's stall/clarifying-question hang is a
          // failure rather than blocking the whole sweep and pinning the agent slot
          // (isBusy() stuck true) — same SIGTERM→SIGKILL escalation as startRunAllPhases.
          let timedOut = false;
          const procDone = new Promise<boolean>((resolve) => {
            proc.on('close', (code) => resolve(code === 0));
            proc.on('error', () => resolve(false));
          });
          const timeoutHandle = setTimeout(() => {
            timedOut = true;
            if (!proc.killed) proc.kill('SIGTERM');
            setTimeout(() => {
              if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
            }, 5000);
          }, PHASE_TIMEOUT_MS);
          const success = await procDone;
          clearTimeout(timeoutHandle);

          if (current !== task) return;

          if (timedOut) {
            failed++;
            pushLine(task, `[timeout] ${plan.id} — no progress for ${PHASE_TIMEOUT_MS / 60000}min`);
            continue;
          }

          if (success) {
            let changed = false;
            try {
              // parseEntityFile (not parsePlanFile) — candidates include backlog ideas
              // (status: idea), whose frontmatter parsePlanFile's plan-only status
              // schema rejects.
              const rawAfter = await readFile(planFile, 'utf-8');
              const parsedAfter = parseEntityFile(rawAfter);
              const after = parsedAfter.entries[0]
                ? entityToPlan(parsedAfter.entries[0])
                : undefined;
              changed = after
                ? JSON.stringify({ body: after.body, phases: after.phases.map((p) => p.text) }) !==
                  JSON.stringify({ body: before.body, phases: before.phases.map((p) => p.text) })
                : false;
            } catch {
              /* changed stays false */
            }
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

        if (current !== task) return;

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
        if (current === task) {
          pushLine(task, `Batch reconcile failed: ${(err as Error).message}`);
          setStatus(task, 'error');
        }
      }
    })();

    return { ok: true };
  }

  // Run all unchecked phases sequentially, spawning a fresh agent per phase.
  // Iterates unchecked phases in order on whatever branch is checked out —
  // branch management is manual (see the "Branch creation is manual" decision).
  // Stops on first failure; calls onPhaseCommit (wired at construction) after each verified success.
  function startRunAllPhases(plan: PlanEntry, runProjectChecks?: () => Promise<boolean>): Result {
    if (isBusy()) {
      return { ok: false, error: 'An agent task is already running' };
    }
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
    const task: AgentTask = {
      taskKind: 'run-all',
      planTitle: plan.title,
      planId: plan.id,
      status: 'starting',
      agentId,
      adapter,
      proc: stubProc,
      lines: [],
    };
    current = task;
    setStatus(task, 'running');

    (async () => {
      try {
        const total = plan.phases.length;
        let completed = 0;
        let failed = 0;

        for (const { phase, i } of unchecked) {
          if (current !== task || task.status === 'stopping') break;

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
              if (current !== task) return;
              const parsed = adapter.parseLine(line);
              if (parsed?.text && parsed.text !== 'Agent is working…') {
                pushLine(task, `  ${parsed.text}`);
              }
            });
          }
          proc.stderr?.on('data', () => {});

          // Wait for the agent with a timeout so a stall or clarifying-question
          // hang is treated as a failure rather than blocking indefinitely.
          let timedOut = false;
          const procDone = new Promise<boolean>((resolve) => {
            proc.on('close', (code) => resolve(code === 0));
            proc.on('error', () => resolve(false));
          });
          const timeoutHandle = setTimeout(() => {
            timedOut = true;
            if (!proc.killed) proc.kill('SIGTERM');
            // SIGTERM can be ignored; without escalation `await procDone` never
            // resolves and this run-all task blocks the agent slot forever — same
            // reasoning as the escalation in stop().
            setTimeout(() => {
              if (proc.exitCode === null && proc.signalCode === null) {
                proc.kill('SIGKILL');
              }
            }, 5000);
          }, PHASE_TIMEOUT_MS);
          const exitedOk = await procDone;
          clearTimeout(timeoutHandle);

          if (current !== task) return;

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
            if (current !== task) return;
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

        if (current !== task) return;

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
        if (current === task) {
          pushLine(task, `Run all phases failed: ${(err as Error).message}`);
          setStatus(task, 'error');
        }
      }
    })();

    return { ok: true };
  }

  // Read-only, one-shot task: ask the configured agent a question and hand back its raw
  // text reply, without ever touching a file. Uses the configured agent's binary but
  // constructs its own arguments so it never picks up the shared adapter's
  // `--permission-mode auto` flag — these calls must stay deny-by-default since the
  // model is only ever supposed to read the prompt text handed to it on stdin.
  const READONLY_PROMPT_TIMEOUT_MS = 60_000;
  const STDIN_MAX_BYTES = 10 * 1024 * 1024;

  function runReadOnlyPrompt(
    prompt: string,
    taskKind: 'commit-suggest' | 'overlap-check',
    planTitle: string,
  ): Promise<string> {
    if (isBusy()) {
      return Promise.reject(new Error('An agent task is already running'));
    }
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
    const args = isClaude ? ['-p', '--output-format', 'json'] : ['run', '--format', 'json'];
    if (model) args.push(isClaude ? '--model' : '-m', model);
    if (effort) args.push(isClaude ? '--effort' : '--variant', effort);

    return new Promise((resolve, reject) => {
      const proc = spawn(adapter.command, args, {
        cwd: root,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const task: AgentTask = {
        taskKind,
        planTitle,
        status: 'starting',
        agentId,
        adapter,
        proc,
        lines: [],
      };
      current = task;
      setStatus(task, 'running');

      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn();
      };
      const timeout = setTimeout(() => {
        settle(() => {
          if (current === task) {
            pushLine(task, `${planTitle} timed out`);
            setStatus(task, 'error');
            if (!proc.killed) proc.kill('SIGTERM');
            // Escalate if SIGTERM is ignored (e.g. stuck reading stdin), so the
            // child doesn't leak — same as stop()/run-all/batch-reconcile.
            setTimeout(() => {
              if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
            }, 5000);
          }
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
        if (current !== task) return;
        settle(() => {
          if (task.status === 'stopping') {
            setStatus(task, 'done');
            reject(new Error('Stopped'));
            return;
          }
          if (code === 0) {
            setStatus(task, 'done');
            // opencode outputs JSON events — extract text content to find the response.
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
        if (current !== task) return;
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

  function stop(): Result {
    if (!current) {
      return { ok: false, error: 'No agent task running' };
    }
    const task = current;
    setStatus(task, 'stopping');
    if (!task.proc.killed) task.proc.kill('SIGTERM');
    // SIGTERM can be ignored or delayed indefinitely; without this escalation a hung
    // process leaves `current` stuck in 'stopping' forever, permanently blocking start().
    setTimeout(() => {
      if (current === task && task.status === 'stopping') {
        task.proc.kill('SIGKILL');
      }
    }, 5000);
    return { ok: true };
  }

  function getStatus(): AgentTaskState | null {
    if (!current) return null;
    return {
      status: current.status,
      taskKind: current.taskKind,
      planTitle: current.planTitle,
      planId: current.planId,
      phaseIndex: current.phaseIndex,
      ideaId: current.ideaId,
      agentId: current.agentId,
      lines: [...current.lines],
    };
  }

  // The most recent batch-reconcile sweep's per-entity results, or null if the
  // current (or most recently finished) task isn't a batch-reconcile sweep. Stays
  // available until the next agent task launch replaces `current`.
  function getReconcileQueue(): ReconcileQueueItem[] | null {
    if (!current || current.taskKind !== 'batch-reconcile') return null;
    return [...(current.reconcileResults ?? [])];
  }

  return {
    start,
    startForPlan,
    startFixReview,
    startForIdea,
    startForIdeaExtend,
    startBatchReconcile,
    startRunAllPhases,
    startSync,
    runCommitSuggest,
    runOverlapCheck,
    stop,
    getStatus,
    getReconcileQueue,
    subscribe(res: ServerResponse) {
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
    killCurrent() {
      if (current?.proc && !current.proc.killed) {
        current.proc.kill();
      }
    },
  };
}

export interface AgentManager {
  start: (plan: PlanEntry, phaseIndex: number) => Result;
  startForPlan: (plan: PlanEntry, prompt: string, taskKind?: 'audit' | 'reconcile') => Result;
  startFixReview: (plan: PlanEntry, prompt: string) => Promise<Result>;
  startForIdea: (idea: IdeaEntry, prompt: string) => Result;
  startForIdeaExtend: (idea: IdeaEntry, prompt: string) => Result;
  startBatchReconcile: () => Result;
  startRunAllPhases: (plan: PlanEntry, runProjectChecks?: () => Promise<boolean>) => Result;
  startSync: (prompt: string) => Result;
  runCommitSuggest: (prompt: string) => Promise<string>;
  runOverlapCheck: (prompt: string) => Promise<string>;
  stop: () => Result;
  getStatus: () => AgentTaskState | null;
  getReconcileQueue: () => ReconcileQueueItem[] | null;
  subscribe: (res: ServerResponse) => void;
  killCurrent: () => void;
}
