import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { parsePlans } from '../../core/parser';
import type {
  AgentId,
  AgentTaskState,
  AgentTaskStatus,
  PaperCampConfig,
  PhaseItem,
  PlanEntry,
} from '../../types/index';
import { type AgentAdapter, resolveAgent } from './agents';

const MAX_LINES = 50;

interface AgentTask {
  planTitle: string;
  planId?: string;
  // Absent for a plan-scoped task (e.g. a convergence audit spanning every phase),
  // present for a single-phase task.
  phaseIndex?: number;
  // Only set for plan-scoped tasks, to check success against: did Phases or Log grow?
  planBaseline?: { phases: number; log: number };
  status: AgentTaskStatus;
  agentId: AgentId;
  adapter: AgentAdapter;
  sessionId?: string;
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
      const raw = await readFile(join(root, 'papercamp', 'plans.md'), 'utf-8');
      const { entries } = parsePlans(raw);
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
          task.phaseIndex !== undefined
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
      if (parsed.sessionId) task.sessionId = parsed.sessionId;
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

  // Shared by start()/startForPlan(): synchronous on purpose, same race-avoidance
  // reasoning as the busy-guard above — no `await` between the guard check and
  // reserving `current`.
  function launch(
    plan: PlanEntry,
    prompt: string,
    scope: Pick<AgentTask, 'phaseIndex' | 'planBaseline'>,
  ): Result {
    if (current && current.status !== 'done' && current.status !== 'error') {
      return { ok: false, error: 'An agent task is already running' };
    }
    const { id: agentId, adapter } = resolveAgent(plan.agent ?? readDefaultAgentId(root));
    const proc = spawnAgent(adapter, adapter.buildArgs(prompt));
    const task: AgentTask = {
      planTitle: plan.title,
      planId: plan.id,
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
    const phase = plan.phases[phaseIndex];
    if (!phase) {
      return { ok: false, error: 'Phase not found' };
    }
    const prompt = buildAgentPrompt(plan, phase, phaseIndex);
    return launch(plan, prompt, { phaseIndex });
  }

  // Plan-scoped launch mode: no single phase, so success is judged by whether the
  // agent appended anything to Phases or Log rather than whether one checkbox flipped.
  function startForPlan(plan: PlanEntry, prompt: string): Result {
    return launch(plan, prompt, {
      planBaseline: { phases: plan.phases.length, log: plan.log?.length ?? 0 },
    });
  }

  function resume(message: string): Result {
    if (!current || current.status !== 'running') {
      return { ok: false, error: 'No running agent task to steer' };
    }
    if (!current.adapter.capabilities.supportsResume) {
      return { ok: false, error: 'This agent does not support mid-task steering' };
    }
    if (!current.sessionId) {
      return { ok: false, error: 'Agent session not started yet — try again shortly' };
    }

    const prior = current;
    prior.status = 'stopping';
    if (!prior.proc.killed) prior.proc.kill();

    const proc = spawnAgent(
      prior.adapter,
      prior.adapter.buildArgs(message, { resumeSessionId: prior.sessionId }),
    );
    const task: AgentTask = {
      planTitle: prior.planTitle,
      planId: prior.planId,
      phaseIndex: prior.phaseIndex,
      planBaseline: prior.planBaseline,
      status: 'starting',
      agentId: prior.agentId,
      adapter: prior.adapter,
      sessionId: prior.sessionId,
      proc,
      lines: prior.lines,
    };
    current = task;
    attachReader(task);
    setStatus(task, 'running');
    return { ok: true };
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
      planTitle: current.planTitle,
      planId: current.planId,
      phaseIndex: current.phaseIndex,
      agentId: current.agentId,
      sessionId: current.sessionId,
      lines: [...current.lines],
    };
  }

  return {
    start,
    startForPlan,
    resume,
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

export type AgentManager = ReturnType<typeof createAgentManager>;
