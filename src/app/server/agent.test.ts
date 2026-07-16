import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { parseEntityFile } from '@/core/parse';
import { entityToPlan } from '@/core/readers';
import type { PhaseItem, PlanEntry, ReviewThread } from '@/types/index';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAgentPrompt, createAgentManager } from './agent';

// The manager is exercised with a fake adapter whose "agent" is a short `node -e`
// script — the real spawn/readline/verification machinery runs, only the AI CLI is
// substituted. `agentScript.current` is what each spawned agent executes.
const agentScript = vi.hoisted(() => ({
  current: 'process.exit(0)',
  buildArgs: undefined as ((prompt: string) => string[]) | undefined,
}));

vi.mock('./agents', () => {
  const adapter = {
    command: process.execPath,
    buildArgs: (prompt: string) =>
      agentScript.buildArgs ? agentScript.buildArgs(prompt) : ['-e', agentScript.current],
    parseLine: (line: string) => (line.trim() ? { text: line.trim() } : null),
    options: {},
  };
  return {
    AGENTS: { 'claude-code': adapter, opencode: adapter },
    resolveAgent: () => ({ id: 'claude-code', adapter }),
  };
});

// Reads the plan file relative to the agent's cwd and flips the first unchecked
// checkbox — the minimal "agent did its phase" behavior.
const FLIP_NEXT_CHECKBOX = `
const fs = require('node:fs');
const p = 'papercamp/ideas/IDEA-1.md';
fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('- [ ]', '- [x]'));
`;

const PLAN_TWO_PHASES = `---
id: IDEA-1
title: Test plan
type: feat
status: in-progress
created: 2026-07-01
---
Plan body.

### Phases
- [ ] First phase
- [ ] Second phase
`;

const roots: string[] = [];

afterAll(async () => {
  // maxRetries/retryDelay: a few tests deliberately leave a subprocess killed but not
  // yet reaped when their assertions finish; its close handler can still append to
  // tasks.log after this cleanup starts, racing a bare rm into ENOTEMPTY.
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })),
  );
});

beforeEach(() => {
  agentScript.current = 'process.exit(0)';
  agentScript.buildArgs = undefined;
});

const run = promisify(execFile);

/** Like makeRoot, but also inits a real git repo with one commit and a bare remote
 * tracked as upstream — startFixReview needs an actual HEAD to snapshot/compare, and
 * isHeadPushed needs a real `@{u}` to check the commit actually landed remotely. */
async function makeGitRoot(planMd: string): Promise<{ root: string; plan: PlanEntry }> {
  const { root, plan } = await makeRoot(planMd);
  const remote = await mkdtemp(join(tmpdir(), 'papercamp-agent-test-remote-'));
  roots.push(remote);
  await run('git', ['init', '-q', '--bare', remote]);
  await run('git', ['init', '-q'], { cwd: root });
  await run('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  await run('git', ['config', 'user.name', 'Test'], { cwd: root });
  await run('git', ['add', '-A'], { cwd: root });
  await run('git', ['commit', '-q', '-m', 'initial'], { cwd: root });
  await run('git', ['remote', 'add', 'origin', remote], { cwd: root });
  await run('git', ['push', '-q', '-u', 'origin', 'HEAD'], { cwd: root });
  return { root, plan };
}

async function makeRoot(planMd: string): Promise<{ root: string; plan: PlanEntry }> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-agent-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), planMd);
  const plan = entityToPlan(parseEntityFile(planMd).entries[0]);
  return { root, plan };
}

type Manager = ReturnType<typeof createAgentManager>;

// Most-recently-launched task — mirrors the old single-slot getStatus() shape for
// tests that only ever have one task in flight at a time.
function currentStatus(manager: Manager) {
  return manager.getStatus()[0];
}

async function waitForStatus(
  manager: Manager,
  done: (status: string) => boolean,
  timeoutMs = 10_000,
): Promise<string> {
  const start = Date.now();
  for (;;) {
    const status = currentStatus(manager)?.status;
    if (status && done(status)) return status;
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `timed out waiting; last status: ${status}, lines: ${currentStatus(manager)?.lines.join(' | ')}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const settled = (status: string) => status === 'done' || status === 'error';

describe('buildAgentPrompt', () => {
  const plan = entityToPlan(parseEntityFile(PLAN_TWO_PHASES).entries[0]);

  it('names the phase 1-based, the plan id, and the per-plan file path', () => {
    const prompt = buildAgentPrompt(plan, plan.phases[1], 1);
    expect(prompt).toContain('phase 2');
    expect(prompt).toContain('"Second phase"');
    expect(prompt).toContain('IDEA-1');
    expect(prompt).toContain('papercamp/ideas/IDEA-1.md');
    expect(prompt).toContain('Plan body.');
  });

  it('includes the phase description when present', () => {
    const phase: PhaseItem = { done: false, text: 'With detail', description: 'Detailed steps.' };
    expect(buildAgentPrompt(plan, phase, 0)).toContain('Detailed steps.');
  });
});

describe('startRunAllPhases', () => {
  it('runs each unchecked phase, committing after each, then completes the run', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = FLIP_NEXT_CHECKBOX;
    const commits: number[] = [];
    const onRunComplete = vi.fn(async () => {});
    const runProjectChecks = vi.fn(async () => true);
    const manager = createAgentManager(
      root,
      undefined,
      async (_plan, _phase, phaseIndex) => {
        commits.push(phaseIndex);
      },
      onRunComplete,
    );

    const result = manager.startRunAllPhases(plan, runProjectChecks);
    expect(result).toEqual({ ok: true });

    expect(await waitForStatus(manager, settled)).toBe('done');
    expect(commits).toEqual([0, 1]);
    expect(runProjectChecks).toHaveBeenCalledTimes(2);
    expect(onRunComplete).toHaveBeenCalledOnce();

    const after = parseEntityFile(
      await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8'),
    );
    expect(after.entries[0].phases.every((phase) => phase.done)).toBe(true);
  });

  it('only runs phases that are still unchecked', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES.replace('- [ ] First', '- [x] First'));
    agentScript.current = FLIP_NEXT_CHECKBOX;
    const prompts: string[] = [];
    agentScript.buildArgs = (prompt) => {
      prompts.push(prompt);
      return ['-e', agentScript.current];
    };
    const commits: number[] = [];
    const manager = createAgentManager(root, undefined, async (_p, _ph, i) => {
      commits.push(i);
    });

    expect(manager.startRunAllPhases(plan)).toEqual({ ok: true });
    expect(await waitForStatus(manager, settled)).toBe('done');
    expect(commits).toEqual([1]);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('Second phase');
  });

  it('stops with an error when the phase checkbox does not flip', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = 'process.exit(0)'; // exits cleanly but edits nothing
    const spawns: string[] = [];
    agentScript.buildArgs = (prompt) => {
      spawns.push(prompt);
      return ['-e', agentScript.current];
    };
    const onPhaseCommit = vi.fn(async () => {});
    const onRunComplete = vi.fn(async () => {});
    const manager = createAgentManager(root, undefined, onPhaseCommit, onRunComplete);

    manager.startRunAllPhases(plan);
    expect(await waitForStatus(manager, settled)).toBe('error');
    expect(currentStatus(manager)?.lines.join('\n')).toContain('checkbox did not flip');
    // Stopped after the first phase: no second spawn, no commit, no review handoff.
    expect(spawns).toHaveLength(1);
    expect(onPhaseCommit).not.toHaveBeenCalled();
    expect(onRunComplete).not.toHaveBeenCalled();
  });

  it('stops with an error when the agent exits nonzero', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = 'process.exit(3)';
    const onPhaseCommit = vi.fn(async () => {});
    const manager = createAgentManager(root, undefined, onPhaseCommit);

    manager.startRunAllPhases(plan);
    expect(await waitForStatus(manager, settled)).toBe('error');
    expect(currentStatus(manager)?.lines.join('\n')).toContain('agent error');
    expect(onPhaseCommit).not.toHaveBeenCalled();
  });

  it('stops without committing when project checks fail', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = FLIP_NEXT_CHECKBOX;
    const onPhaseCommit = vi.fn(async () => {});
    const onRunComplete = vi.fn(async () => {});
    const manager = createAgentManager(root, undefined, onPhaseCommit, onRunComplete);

    manager.startRunAllPhases(plan, async () => false);
    expect(await waitForStatus(manager, settled)).toBe('error');
    expect(currentStatus(manager)?.lines.join('\n')).toContain('project checks failed');
    expect(onPhaseCommit).not.toHaveBeenCalled();
    expect(onRunComplete).not.toHaveBeenCalled();
  });

  it('rejects a run when every phase is already checked', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES.replace(/- \[ \]/g, '- [x]'));
    const manager = createAgentManager(root);
    expect(manager.startRunAllPhases(plan)).toEqual({
      ok: false,
      error: 'No unchecked phases to run',
    });
  });

  it('rejects concurrent starts while a run is in flight', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = 'setTimeout(() => process.exit(0), 5000)';
    const manager = createAgentManager(root);

    expect(manager.startRunAllPhases(plan)).toEqual({ ok: true });
    expect(manager.startRunAllPhases(plan)).toEqual({
      ok: false,
      error: 'An agent task is already running',
    });
    expect(manager.start(plan, 0)).toEqual({
      ok: false,
      error: 'An agent task is already running',
    });

    manager.stop();
    await waitForStatus(manager, settled);
  });

  it('winds down as done when stopped mid-run, without finishing the run', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = 'setTimeout(() => process.exit(0), 5000)';
    const onRunComplete = vi.fn(async () => {});
    const manager = createAgentManager(root, undefined, undefined, onRunComplete);

    manager.startRunAllPhases(plan);
    expect(manager.stop()).toEqual({ ok: true });
    expect(await waitForStatus(manager, settled)).toBe('done');
    expect(onRunComplete).not.toHaveBeenCalled();
  });
});

describe('write-set collision gate', () => {
  it('admits a disjoint entity-writer while one is running, but rejects same-entity and exclusive launches', async () => {
    const { root, plan: plan1 } = await makeRoot(PLAN_TWO_PHASES);
    const plan2Md = PLAN_TWO_PHASES.replace('IDEA-1', 'IDEA-2').replace('Test plan', 'Second plan');
    await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), plan2Md);
    const plan2 = entityToPlan(parseEntityFile(plan2Md).entries[0]);

    agentScript.current = 'setTimeout(() => process.exit(0), 400)';
    const manager = createAgentManager(root);

    expect(manager.startForPlan(plan1, 'prompt', 'reconcile')).toEqual({ ok: true });
    // Different entity: admitted even though a reconcile is already running (the
    // write-set gate replaces the old blanket isBusy() flag).
    expect(manager.startForPlan(plan2, 'prompt', 'reconcile')).toEqual({ ok: true });
    // Same entity as the now-current task: still rejected.
    expect(manager.startForPlan(plan2, 'prompt', 'reconcile')).toEqual({
      ok: false,
      error: 'An agent task is already running',
    });
    // Exclusive kind (worktree-wide): rejected regardless of which entity is idle.
    expect(manager.start(plan1, 0)).toEqual({
      ok: false,
      error: 'An agent task is already running',
    });

    // Let both spawned children exit on their own before the test ends.
    await new Promise((resolve) => setTimeout(resolve, 600));
  });

  it('rejects a launch colliding with an older running task, not just the most recently launched one', async () => {
    const { root, plan: plan1 } = await makeRoot(PLAN_TWO_PHASES);
    const plan2Md = PLAN_TWO_PHASES.replace('IDEA-1', 'IDEA-2').replace('Test plan', 'Second plan');
    await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-2.md'), plan2Md);
    const plan2 = entityToPlan(parseEntityFile(plan2Md).entries[0]);

    agentScript.current = 'setTimeout(() => process.exit(0), 400)';
    const manager = createAgentManager(root);

    // Two disjoint entity-writers running at once: IDEA-1 (launched first) and
    // IDEA-2 (launched second, now the most-recently-launched task).
    expect(manager.startForPlan(plan1, 'prompt', 'reconcile')).toEqual({ ok: true });
    expect(manager.startForPlan(plan2, 'prompt', 'reconcile')).toEqual({ ok: true });
    // A second IDEA-1 reconcile must still collide with the *older* running task,
    // even though it's no longer the most recently launched one — the gate has to
    // check every running task in the registry, not just the last slot.
    expect(manager.startForPlan(plan1, 'prompt', 'reconcile')).toEqual({
      ok: false,
      error: 'An agent task is already running',
    });

    // Let both spawned children exit on their own before the test ends.
    await new Promise((resolve) => setTimeout(resolve, 600));
  });

  it('rejects a suggest-ideas launch while an exclusive task is running', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = 'setTimeout(() => process.exit(0), 400)';
    const manager = createAgentManager(root);

    expect(manager.start(plan, 0)).toEqual({ ok: true });
    expect(await manager.startSuggest('prompt')).toEqual({
      ok: false,
      error: 'An agent task is already running',
    });

    manager.stop();
    await waitForStatus(manager, settled);
  });

  it('registers a read-only prompt as a task, but never lets it collide with a real launch', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    const manager = createAgentManager(root);

    // Fire-and-forget: runCommitSuggest registers and starts its task synchronously,
    // before the (broken-on-purpose, since this manager only mocks the phase
    // adapter) child process resolves the promise — swallow the rejection.
    const pending = manager.runCommitSuggest('prompt').catch(() => undefined);
    const readOnlyTask = manager.getStatus().find((t) => t.taskKind === 'commit-suggest');
    expect(readOnlyTask?.status).toBe('running');

    // A read-only task's write-set is `{ scope: 'none' }` — even while it's still
    // registered as running, it must never collide with a real launch's write-set.
    expect(manager.start(plan, 0)).toEqual({ ok: true });

    manager.stop();
    await pending;
    await waitForStatus(manager, settled);
  });
});

describe('start (single phase)', () => {
  it('finishes cleanly when the agent checks off the phase', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = FLIP_NEXT_CHECKBOX;
    const manager = createAgentManager(root);

    expect(manager.start(plan, 0)).toEqual({ ok: true });
    expect(await waitForStatus(manager, settled)).toBe('done');
    // The post-run verification is async; give it a beat before asserting no warning.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(currentStatus(manager)?.lines.join('\n')).not.toContain('verify manually');
  });

  it('warns when the agent exits cleanly without checking off the phase', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = 'process.exit(0)';
    const manager = createAgentManager(root);

    manager.start(plan, 0);
    expect(await waitForStatus(manager, settled)).toBe('done');
    const start = Date.now();
    while (
      !currentStatus(manager)?.lines.join('\n').includes('verify manually') &&
      Date.now() - start < 5000
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(currentStatus(manager)?.lines.join('\n')).toContain(
      'did not check off this phase in the plan file',
    );
  });

  it('rejects a phase index that does not exist', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    const manager = createAgentManager(root);
    expect(manager.start(plan, 99)).toEqual({ ok: false, error: 'Phase not found' });
  });
});

describe('task log', () => {
  it('appends a done entry with kind, plan, agent, and start/end to papercamp/tasks.log', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = FLIP_NEXT_CHECKBOX;
    const manager = createAgentManager(root);

    manager.start(plan, 0);
    const taskId = currentStatus(manager)?.id;
    expect(await waitForStatus(manager, settled)).toBe('done');

    const raw = await readFile(join(root, 'papercamp', 'tasks.log'), 'utf-8');
    const lines = raw.trim().split('\n');
    const entry = JSON.parse(lines[lines.length - 1]);
    expect(entry).toMatchObject({
      id: taskId,
      taskKind: 'phase',
      planId: 'IDEA-1',
      planTitle: 'Test plan',
      agentId: 'claude-code',
      outcome: 'done',
    });
    expect(new Date(entry.startedAt).getTime()).toBeLessThanOrEqual(
      new Date(entry.endedAt).getTime(),
    );
  });

  it('appends an error entry when the agent exits nonzero', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = 'process.exit(3)';
    const manager = createAgentManager(root);

    manager.start(plan, 0);
    expect(await waitForStatus(manager, settled)).toBe('error');

    const raw = await readFile(join(root, 'papercamp', 'tasks.log'), 'utf-8');
    const entry = JSON.parse(raw.trim().split('\n').at(-1) ?? '{}');
    expect(entry.outcome).toBe('error');
  });

  it('persists the finished task’s output lines to a per-task file', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = FLIP_NEXT_CHECKBOX;
    const manager = createAgentManager(root);

    manager.start(plan, 0);
    const taskId = currentStatus(manager)?.id;
    expect(await waitForStatus(manager, settled)).toBe('done');

    // The write is fire-and-forget off setStatus(), so it can land slightly after
    // getStatus() already reports 'done' — poll instead of reading once.
    const logPath = join(root, 'papercamp', '.task-logs', `${taskId}.log`);
    const start = Date.now();
    const expected = currentStatus(manager)?.lines.join('\n');
    let raw: string | undefined;
    while (Date.now() - start < 2000) {
      try {
        raw = await readFile(logPath, 'utf-8');
        if (raw === expected) break;
      } catch {
        // Ignore ENOENT while waiting for the fire-and-forget write
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(raw).toBe(expected);
  });
});

describe('startFixReview', () => {
  const THREADS: ReviewThread[] = [
    { id: 'PRRT_one', path: 'src/a.ts', body: 'first comment' },
    { id: 'PRRT_two', path: 'src/b.ts', body: 'second comment' },
  ];

  /** The agent's contract is its final JSON line — it must NOT commit. */
  const reportScript = (result: unknown) =>
    `console.log(${JSON.stringify(JSON.stringify(result))});`;

  const VERDICT = {
    commit: { title: 'fix(app): Address review comments', message: 'body\n\nRefs: IDEA-9' },
    addressed: [1],
    skipped: [{ n: 2, why: 'repo is kebab-case' }],
  };

  it('finishes cleanly and maps the agent verdict back to thread ids', async () => {
    const { root, plan } = await makeGitRoot(PLAN_TWO_PHASES);
    agentScript.current = reportScript(VERDICT);
    const manager = createAgentManager(root);

    const result = manager.startFixReview(plan, 'fix these comments', THREADS);
    expect(result).toEqual({ ok: true });
    expect(await waitForStatus(manager, settled)).toBe('done');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(currentStatus(manager)?.lines.join('\n')).not.toContain('verify manually');
    // 1-based verdicts resolve against the thread list the prompt numbered.
    expect(manager.getFixReviewResult()).toEqual({
      commit: VERDICT.commit,
      addressed: ['PRRT_one'],
      skipped: [{ threadId: 'PRRT_two', why: 'repo is kebab-case' }],
    });
  });

  it('treats a run that skips every comment as success, not a failure', async () => {
    const { root, plan } = await makeGitRoot(PLAN_TWO_PHASES);
    agentScript.current = reportScript({
      commit: { title: 'chore(app): No changes needed', message: '' },
      addressed: [],
      skipped: [
        { n: 1, why: 'wrong about this codebase' },
        { n: 2, why: 'conflicts with the established style' },
      ],
    });
    const manager = createAgentManager(root);

    manager.startFixReview(plan, 'fix these comments', THREADS);
    expect(await waitForStatus(manager, settled)).toBe('done');
    await new Promise((resolve) => setTimeout(resolve, 200));
    // Evaluating every comment and correctly rejecting them all IS the job done.
    expect(currentStatus(manager)?.lines.join('\n')).not.toContain('verify manually');
    expect(manager.getFixReviewResult()?.addressed).toEqual([]);
    expect(manager.getFixReviewResult()?.skipped).toHaveLength(2);
  });

  it('warns when the agent exits without reporting a verdict', async () => {
    const { root, plan } = await makeGitRoot(PLAN_TWO_PHASES);
    agentScript.current = 'process.exit(0)';
    const manager = createAgentManager(root);

    manager.startFixReview(plan, 'fix these comments', THREADS);
    expect(await waitForStatus(manager, settled)).toBe('done');
    const start = Date.now();
    while (
      !currentStatus(manager)?.lines.join('\n').includes('verify manually') &&
      Date.now() - start < 5000
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(currentStatus(manager)?.lines.join('\n')).toContain(
      'without reporting which comments it addressed',
    );
    expect(manager.getFixReviewResult()).toBeNull();
  });

  it('rejects a verdict that omits a thread index', async () => {
    const { root, plan } = await makeGitRoot(PLAN_TWO_PHASES);
    agentScript.current = reportScript({
      commit: { title: 'fix(app): Address review comments', message: 'body' },
      addressed: [1],
      skipped: [],
    });
    const manager = createAgentManager(root);

    manager.startFixReview(plan, 'fix these comments', THREADS);
    expect(await waitForStatus(manager, settled)).toBe('done');
    const start = Date.now();
    while (
      !currentStatus(manager)?.lines.join('\n').includes('verify manually') &&
      Date.now() - start < 5000
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(manager.getFixReviewResult()).toBeNull();
  });

  it('rejects a verdict with a duplicate thread index', async () => {
    const { root, plan } = await makeGitRoot(PLAN_TWO_PHASES);
    agentScript.current = reportScript({
      commit: { title: 'fix(app): Address review comments', message: 'body' },
      addressed: [1, 1],
      skipped: [{ n: 2, why: 'not applicable' }],
    });
    const manager = createAgentManager(root);

    manager.startFixReview(plan, 'fix these comments', THREADS);
    expect(await waitForStatus(manager, settled)).toBe('done');
    const start = Date.now();
    while (
      !currentStatus(manager)?.lines.join('\n').includes('verify manually') &&
      Date.now() - start < 5000
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(manager.getFixReviewResult()).toBeNull();
  });

  it('rejects a verdict that lists the same thread as both addressed and skipped', async () => {
    const { root, plan } = await makeGitRoot(PLAN_TWO_PHASES);
    agentScript.current = reportScript({
      commit: { title: 'fix(app): Address review comments', message: 'body' },
      addressed: [1],
      skipped: [{ n: 1, why: 'also skipped' }],
    });
    const manager = createAgentManager(root);

    manager.startFixReview(plan, 'fix these comments', THREADS);
    expect(await waitForStatus(manager, settled)).toBe('done');
    const start = Date.now();
    while (
      !currentStatus(manager)?.lines.join('\n').includes('verify manually') &&
      Date.now() - start < 5000
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(manager.getFixReviewResult()).toBeNull();
  });

  it('rejects concurrent starts while another agent task is running', async () => {
    const { root, plan } = await makeGitRoot(PLAN_TWO_PHASES);
    agentScript.current = 'setTimeout(() => process.exit(0), 5000)';
    const manager = createAgentManager(root);

    expect(manager.start(plan, 0)).toEqual({ ok: true });
    expect(manager.startFixReview(plan, 'fix these comments', THREADS)).toEqual({
      ok: false,
      error: 'An agent task is already running',
    });

    manager.stop();
    await waitForStatus(manager, settled);
  });
});

describe('stop and getStatus', () => {
  it('reports an error when nothing is running', async () => {
    const { root } = await makeRoot(PLAN_TWO_PHASES);
    const manager = createAgentManager(root);
    expect(manager.stop()).toEqual({ ok: false, error: 'No agent task running' });
  });

  it('exposes the running task shape through getStatus', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = FLIP_NEXT_CHECKBOX;
    const manager = createAgentManager(root);
    expect(manager.getStatus()).toEqual([]);

    manager.startRunAllPhases(plan);
    const state = currentStatus(manager);
    expect(state).toMatchObject({
      taskKind: 'run-all',
      planTitle: 'Test plan',
      planId: 'IDEA-1',
      agentId: 'claude-code',
    });
    await waitForStatus(manager, settled);
  });
});

describe('startBatchReconcile / getReconcileQueue', () => {
  const IDEA_OPEN = `---
id: IDEA-1
title: Test idea
type: feat
status: idea
created: 2026-07-01
---
Plan body.
`;

  const REWRITE_BODY = `
const fs = require('node:fs');
const p = 'papercamp/ideas/IDEA-1.md';
fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('Plan body.', 'Updated plan body.'));
`;

  it('returns null before any batch reconcile has run', async () => {
    const { root } = await makeRoot(IDEA_OPEN);
    const manager = createAgentManager(root);
    expect(manager.getReconcileQueue()).toBeNull();
  });

  it('queues a before snapshot for an entity whose prose actually changed', async () => {
    const { root } = await makeRoot(IDEA_OPEN);
    agentScript.current = REWRITE_BODY;
    const manager = createAgentManager(root);

    expect(manager.startBatchReconcile()).toEqual({ ok: true });
    expect(await waitForStatus(manager, settled)).toBe('done');
    expect(currentStatus(manager)?.lines.join('\n')).toContain('[done] IDEA-1 — updated');

    const queue = manager.getReconcileQueue();
    expect(queue).toEqual([
      { planId: 'IDEA-1', title: 'Test idea', before: { body: 'Plan body.', phases: [] } },
    ]);
  });

  it('leaves the queue empty when no entity actually drifted', async () => {
    const { root } = await makeRoot(IDEA_OPEN);
    agentScript.current = 'process.exit(0)';
    const manager = createAgentManager(root);

    expect(manager.startBatchReconcile()).toEqual({ ok: true });
    expect(await waitForStatus(manager, settled)).toBe('done');
    expect(currentStatus(manager)?.lines.join('\n')).toContain('[done] IDEA-1 — no drift found');
    expect(manager.getReconcileQueue()).toEqual([]);
  });

  it('picks up an entity with no stored status override via its derived status', async () => {
    // No `status:` field at all (the IDEA-56 default going forward) — the old
    // filter (`e.status !== undefined && openStatuses.has(e.status)`) would have
    // skipped this entity entirely; deriving status instead still finds it open.
    const NO_STORED_STATUS = `---
id: IDEA-1
title: Test idea
type: feat
created: 2026-07-01
---
Plan body.

### Phases
- [ ] First phase
`;
    const { root } = await makeRoot(NO_STORED_STATUS);
    agentScript.current = REWRITE_BODY;
    const manager = createAgentManager(root);

    expect(manager.startBatchReconcile()).toEqual({ ok: true });
    expect(await waitForStatus(manager, settled)).toBe('done');
    expect(currentStatus(manager)?.lines.join('\n')).toContain('[done] IDEA-1 — updated');
  });

  it('excludes an entity whose stored status is done', async () => {
    const DONE = `---
id: IDEA-1
title: Test idea
type: feat
status: done
created: 2026-07-01
---
Plan body.
`;
    const { root } = await makeRoot(DONE);
    const manager = createAgentManager(root);

    expect(manager.startBatchReconcile()).toEqual({ ok: true });
    expect(await waitForStatus(manager, settled)).toBe('done');
    expect(currentStatus(manager)?.lines.join('\n')).toContain(
      'No open ideas or plans to reconcile.',
    );
  });

  it('returns null once a different task kind becomes current', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = REWRITE_BODY;
    const manager = createAgentManager(root);

    manager.startBatchReconcile();
    await waitForStatus(manager, settled);

    agentScript.current = FLIP_NEXT_CHECKBOX;
    manager.start(plan, 0);
    expect(manager.getReconcileQueue()).toBeNull();
  });
});
