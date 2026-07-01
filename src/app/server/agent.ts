import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import {
  parsePlanFile,
  readAllPlanFiles,
  readIdeasMerged,
  readPlansMerged,
} from '../../core/parser';
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
  type TaskKind,
  coerceAgentConfig,
} from '../../types/index';
import { buildConvergenceAuditPrompt } from '../features/plans/prompts';
import { AGENTS, type AgentAdapter, resolveAgent } from './agents';

const MAX_LINES = 50;

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
  return `You're working on phase ${phaseIndex + 1} ("${phase.text}") of the plan "${plan.title}" (${plan.id ?? 'no id'}), stored as a single file at papercamp/plans/${plan.id ?? '<ID>'}.md.

${phase.description ?? ''}

Plan context: ${plan.body}

Do only this phase. When done, check it off in that file's \`### Phases\` list (- [ ] -> - [x]) and append what you did to progress.md. If this was the last unchecked phase, set the plan's \`status:\` frontmatter field to \`review\`, not \`done\`, per this repo's AGENTS.md.`;
}

export function createAgentManager(
  root: string,
  ensureBranch: (plan: PlanEntry) => void = () => {},
  onAuditComplete?: (planId: string, gapPhases: number) => Promise<void>,
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
        const ideasDir = join(root, 'papercamp', 'ideas');
        const { entries } = await readIdeasMerged(ideasDir, join(root, 'papercamp', 'ideas.md'));
        const idea = entries.find((e) => e.id === task.ideaId);
        if (!idea) return null;
        if (task.ideaBodyBaseline === undefined) return null;
        return idea.body !== task.ideaBodyBaseline;
      }
      const plansDir = join(root, 'papercamp', 'plans');
      const { entries } = await readPlansMerged(plansDir, join(root, 'papercamp', 'plans.md'));
      if (task.ideaId !== undefined) {
        return entries.some((p: { idea?: string }) => p.idea === task.ideaId);
      }
      const plan =
        entries.find((p: { id?: string }) => p.id === task.planId) ??
        entries.find((p: { title: string }) => p.title === task.planTitle);
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
              ? `Warning: agent finished but no plan linking idea: ${task.ideaId} appeared in papercamp/plans/ — verify manually`
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
      'taskKind' | 'phaseIndex' | 'planBaseline' | 'ideaId' | 'ideaBodyBaseline'
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
    ensureBranch(plan);
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
  // whether a new plan file linking this idea's id shows up in papercamp/plans/.
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
      ideaBodyBaseline: idea.body,
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

  // Batch audit: iterate every review/done plan and run a convergence audit on each,
  // skipping plans whose "audited" marker is newer than the file's last modification.
  // Runs plans sequentially; updates task.proc before each spawn so stop() kills the
  // right subprocess.
  function startBatchAudit(): Result {
    if (isBusy()) {
      return { ok: false, error: 'An agent task is already running' };
    }
    const defaultAgents = readDefaultAgentIds(root);
    const {
      id: agentId,
      adapter,
      model,
      effort,
    } = resolveAgent({ defaultAgents, taskKind: 'audit' });

    // Stub proc — replaced per plan in the loop. Already-exited is fine: stop() sets
    // task.status = 'stopping' first; kill() on a dead process is a no-op.
    const stubProc = spawn('sh', ['-c', 'exit 0'], {
      cwd: root,
      stdio: 'ignore',
    });
    const task: AgentTask = {
      taskKind: 'batch-audit',
      planTitle: 'Batch audit',
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
        const plansDir = join(root, 'papercamp', 'plans');
        const { entries } = await readAllPlanFiles(plansDir);
        const candidates = entries.filter((p) => p.status === 'review' || p.status === 'done');

        if (candidates.length === 0) {
          if (current === task) {
            pushLine(task, 'No plans with status "review" or "done" to audit.');
            setStatus(task, 'done');
          }
          return;
        }

        pushLine(task, `Auditing ${candidates.length} plan(s)…`);
        let audited = 0;
        let skipped = 0;
        let failed = 0;

        for (const plan of candidates) {
          if (current !== task || task.status === 'stopping') break;
          if (!plan.id) {
            skipped++;
            continue;
          }

          const planFile = await findBatchPlanFile(plansDir, plan.id);
          if (!planFile) {
            skipped++;
            continue;
          }

          if (plan.audited) {
            const fileStat = await stat(planFile).catch(() => null);
            const mtimeDate = fileStat ? fileStat.mtime.toISOString().slice(0, 10) : null;
            if (mtimeDate && plan.audited >= mtimeDate) {
              pushLine(task, `[skip] ${plan.id} — up to date`);
              skipped++;
              continue;
            }
          }

          pushLine(task, `[audit] ${plan.id} ${plan.title}`);
          const prompt = buildConvergenceAuditPrompt(plan);
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
          // Drain stderr — an unread pipe can fill and hang the subprocess.
          proc.stderr?.on('data', () => {});

          const success = await new Promise<boolean>((resolve) => {
            proc.on('close', (code) => resolve(code === 0));
            proc.on('error', () => resolve(false));
          });

          if (current !== task) return;

          if (success) {
            let gapPhases = 0;
            try {
              const rawAfter = await readFile(planFile, 'utf-8');
              const parsedAfter = parsePlanFile(rawAfter);
              const afterCount = parsedAfter.entries[0]?.phases.length ?? plan.phases.length;
              gapPhases = Math.max(0, afterCount - plan.phases.length);
            } catch {
              /* gapPhases stays 0 */
            }
            await onAuditComplete?.(plan.id, gapPhases);
            audited++;
            pushLine(
              task,
              gapPhases > 0
                ? `[done] ${plan.id} — ${gapPhases} gap phase${gapPhases === 1 ? '' : 's'} added`
                : `[done] ${plan.id}`,
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

        pushLine(task, `Audit complete — ${audited} audited, ${skipped} skipped, ${failed} failed`);
        setStatus(task, failed > 0 ? 'error' : 'done');
      } catch (err) {
        if (current === task) {
          pushLine(task, `Batch audit failed: ${(err as Error).message}`);
          setStatus(task, 'error');
        }
      }
    })();

    return { ok: true };
  }

  // Read-only, one-shot task: ask the configured agent to turn a diff into a commit
  // message.  Uses the configured agent's binary but constructs its own arguments so it
  // never picks up the shared adapter's `--permission-mode auto` flag — this call must
  // stay deny-by-default since the model is only ever supposed to read the diff text.
  const COMMIT_SUGGEST_TIMEOUT_MS = 60_000;
  const STDIN_MAX_BYTES = 10 * 1024 * 1024;

  function runCommitSuggest(prompt: string): Promise<string> {
    if (isBusy()) {
      return Promise.reject(new Error('An agent task is already running'));
    }
    if (Buffer.byteLength(prompt, 'utf-8') > STDIN_MAX_BYTES) {
      return Promise.reject(new Error('Commit suggestion prompt exceeds the 10MB stdin limit'));
    }
    const defaultAgents = readDefaultAgentIds(root);
    const {
      id: agentId,
      adapter,
      model,
      effort,
    } = resolveAgent({
      defaultAgents,
      taskKind: 'commit-suggest',
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
        taskKind: 'commit-suggest',
        planTitle: 'Suggest commit message',
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
            pushLine(task, 'Commit suggestion timed out');
            setStatus(task, 'error');
            if (!proc.killed) proc.kill('SIGTERM');
          }
          reject(new Error('Commit suggestion timed out'));
        });
      }, COMMIT_SUGGEST_TIMEOUT_MS);

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
    startBatchAudit,
    startSync,
    runCommitSuggest,
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
  startBatchAudit: () => Result;
  startSync: (prompt: string) => Result;
  runCommitSuggest: (prompt: string) => Promise<string>;
  stop: () => Result;
  getStatus: () => AgentTaskState | null;
  subscribe: (res: ServerResponse) => void;
  killCurrent: () => void;
}
