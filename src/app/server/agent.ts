import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { parseIdeas, parsePlans } from '../../core/parser';
import type {
  AgentId,
  AgentTaskState,
  AgentTaskStatus,
  IdeaEntry,
  PaperCampConfig,
  PhaseItem,
  PlanEntry,
} from '../../types/index';
import { type AgentAdapter, resolveAgent } from './agents';

const MAX_LINES = 50;

type TaskKind = 'phase' | 'audit' | 'draft' | 'extend';

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
  // For idea-extend tasks: snapshot the idea's body before launch so we can detect changes.
  ideaBodyBaseline?: string;
  status: AgentTaskStatus;
  agentId: AgentId;
  adapter: AgentAdapter;
  proc: ChildProcess;
  lines: string[];
}

// Synchronous on purpose: start() must reserve `current` with no `await` between its
// busy-guard check and the assignment, or two concurrent launches can both pass the
// guard before either reserves the slot. Reading one small local config file
// synchronously closes that race entirely instead of working around it.
function readDefaultAgentId(root: string): AgentId | undefined {
  try {
    const raw = readFileSync(join(root, '.paper-camp', 'config.json'), 'utf-8');
    const config = JSON.parse(raw) as PaperCampConfig;
    return config.defaultAgent;
  } catch {
    return undefined;
  }
}

type Result = { ok: true } | { ok: false; error: string };

function buildAgentPrompt(plan: PlanEntry, phase: PhaseItem, phaseIndex: number): string {
  return `You're working on phase ${phaseIndex + 1} ("${phase.text}") of the plan "${plan.title}" (${plan.id ?? 'no id'}) in papercamp/plans.md.

${phase.description ?? ''}

Plan context: ${plan.body}

Do only this phase. When done, check it off in plans.md (- [ ] -> - [x]) and append what you did to progress.md. If this was the last unchecked phase, set the plan's Status to \`review\`, not \`done\`, per this repo's AGENTS.md.`;
}

export function createAgentManager(root: string) {
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
        const raw = await readFile(join(root, 'papercamp', 'ideas.md'), 'utf-8');
        const entries = parseIdeas(raw);
        const idea = entries.find((e) => e.id === task.ideaId);
        if (!idea) return null;
        if (task.ideaBodyBaseline === undefined) return null;
        return idea.body !== task.ideaBodyBaseline;
      }
      const raw = await readFile(join(root, 'papercamp', 'plans.md'), 'utf-8');
      const { entries } = parsePlans(raw);
      if (task.ideaId !== undefined) {
        return entries.some((p) => p.idea === task.ideaId);
      }
      const plan =
        entries.find((p) => p.id === task.planId) ??
        entries.find((p) => p.title === task.planTitle);
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
            : task.ideaId !== undefined
              ? `Warning: agent finished but no plan linking idea: ${task.ideaId} appeared in plans.md — verify manually`
              : task.phaseIndex !== undefined
                ? 'Warning: agent finished but did not check off this phase in plans.md — verify manually'
                : 'Warning: agent finished but appended nothing to Phases or Log — verify manually';
        pushLine(task, warning);
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
      'taskKind' | 'phaseIndex' | 'planBaseline' | 'ideaId' | 'ideaBodyBaseline'
    >,
  ): Result {
    if (isBusy()) {
      return { ok: false, error: 'An agent task is already running' };
    }
    const { id: agentId, adapter } = resolveAgent(
      identity.agentOverride ?? readDefaultAgentId(root),
    );
    const proc = spawnAgent(adapter, adapter.buildArgs(prompt));
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
  function startForPlan(plan: PlanEntry, prompt: string): Result {
    return launch({ planTitle: plan.title, planId: plan.id, agentOverride: plan.agent }, prompt, {
      taskKind: 'audit',
      planBaseline: { phases: plan.phases.length, log: plan.log?.length ?? 0 },
    });
  }

  // Idea-drafting launch mode: there's no plan yet (and so no per-plan agent override
  // either) — the plan only exists once the agent writes it, so success is judged by
  // whether a new plan entry linking this idea's id shows up in plans.md.
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
  // body in place in ideas.md. Success is judged by whether that idea's body text
  // actually changed.
  function startForIdeaExtend(idea: IdeaEntry, prompt: string): Result {
    if (!idea.id) {
      return { ok: false, error: 'Idea has no id to extend' };
    }
    return launch({ planTitle: `Extend ${idea.id}` }, prompt, {
      taskKind: 'extend',
      ideaId: idea.id,
      ideaBodyBaseline: idea.body,
    });
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

  return {
    start,
    startForPlan,
    startForIdea,
    startForIdeaExtend,
    stop,
    getStatus,
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
  startForPlan: (plan: PlanEntry, prompt: string) => Result;
  startForIdea: (idea: IdeaEntry, prompt: string) => Result;
  startForIdeaExtend: (idea: IdeaEntry, prompt: string) => Result;
  stop: () => Result;
  getStatus: () => AgentTaskState | null;
  subscribe: (res: ServerResponse) => void;
  killCurrent: () => void;
}
