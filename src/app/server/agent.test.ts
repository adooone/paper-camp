import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { computePlanContentHash } from '../../core/content-hash';
import { parseEntityFile } from '../../core/parser';
import { entityToPlan } from '../../core/readers';
import type { PhaseItem, PlanEntry } from '../../types/index';
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
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

beforeEach(() => {
  agentScript.current = 'process.exit(0)';
  agentScript.buildArgs = undefined;
});

async function makeRoot(planMd: string): Promise<{ root: string; plan: PlanEntry }> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-agent-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), planMd);
  const plan = entityToPlan(parseEntityFile(planMd).entries[0]);
  return { root, plan };
}

type Manager = ReturnType<typeof createAgentManager>;

async function waitForStatus(
  manager: Manager,
  done: (status: string) => boolean,
  timeoutMs = 10_000,
): Promise<string> {
  const start = Date.now();
  for (;;) {
    const status = manager.getStatus()?.status;
    if (status && done(status)) return status;
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `timed out waiting; last status: ${status}, lines: ${manager.getStatus()?.lines.join(' | ')}`,
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
    expect(manager.getStatus()?.lines.join('\n')).toContain('checkbox did not flip');
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
    expect(manager.getStatus()?.lines.join('\n')).toContain('agent error');
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
    expect(manager.getStatus()?.lines.join('\n')).toContain('project checks failed');
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

describe('start (single phase)', () => {
  it('finishes cleanly when the agent checks off the phase', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = FLIP_NEXT_CHECKBOX;
    const manager = createAgentManager(root);

    expect(manager.start(plan, 0)).toEqual({ ok: true });
    expect(await waitForStatus(manager, settled)).toBe('done');
    // The post-run verification is async; give it a beat before asserting no warning.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(manager.getStatus()?.lines.join('\n')).not.toContain('verify manually');
  });

  it('warns when the agent exits cleanly without checking off the phase', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    agentScript.current = 'process.exit(0)';
    const manager = createAgentManager(root);

    manager.start(plan, 0);
    expect(await waitForStatus(manager, settled)).toBe('done');
    const start = Date.now();
    while (
      !manager.getStatus()?.lines.join('\n').includes('verify manually') &&
      Date.now() - start < 5000
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(manager.getStatus()?.lines.join('\n')).toContain(
      'did not check off this phase in the plan file',
    );
  });

  it('rejects a phase index that does not exist', async () => {
    const { root, plan } = await makeRoot(PLAN_TWO_PHASES);
    const manager = createAgentManager(root);
    expect(manager.start(plan, 99)).toEqual({ ok: false, error: 'Phase not found' });
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
    expect(manager.getStatus()).toBeNull();

    manager.startRunAllPhases(plan);
    const state = manager.getStatus();
    expect(state).toMatchObject({
      taskKind: 'run-all',
      planTitle: 'Test plan',
      planId: 'IDEA-1',
      agentId: 'claude-code',
    });
    await waitForStatus(manager, settled);
  });
});

describe('startBatchAudit', () => {
  // status: review so readAllPlanFiles' candidate filter (review/done) picks it up.
  const PLAN_REVIEW = `---
id: IDEA-1
title: Test plan
type: feat
status: review
created: 2026-07-01
---
Plan body.

### Phases
- [x] First phase
- [ ] Second phase
`;

  function withAuditStamp(md: string, hash: string, date = '2026-07-01'): string {
    return md.replace(
      'created: 2026-07-01\n',
      `created: 2026-07-01\naudited: ${date}\naudited-hash: ${hash}\n`,
    );
  }

  it('skips a plan whose audited-hash still matches its content', async () => {
    const { body, phases } = parseEntityFile(PLAN_REVIEW).entries[0];
    const hash = computePlanContentHash({ body, phases });
    const { root } = await makeRoot(withAuditStamp(PLAN_REVIEW, hash));
    const onAuditComplete = vi.fn(async () => {});
    const manager = createAgentManager(root, onAuditComplete);

    expect(manager.startBatchAudit()).toEqual({ ok: true });
    expect(await waitForStatus(manager, settled)).toBe('done');
    const lines = manager.getStatus()?.lines.join('\n');
    expect(lines).toContain('[skip] IDEA-1 — up to date');
    expect(lines).toContain('0 audited, 1 skipped, 0 failed');
    expect(onAuditComplete).not.toHaveBeenCalled();
  });

  it('re-audits a plan whose content changed since its audited-hash was stamped', async () => {
    const { root } = await makeRoot(withAuditStamp(PLAN_REVIEW, 'stale-hash-does-not-match'));
    agentScript.current = FLIP_NEXT_CHECKBOX;
    const onAuditComplete = vi.fn(async () => {});
    const manager = createAgentManager(root, onAuditComplete);

    expect(manager.startBatchAudit()).toEqual({ ok: true });
    expect(await waitForStatus(manager, settled)).toBe('done');
    const lines = manager.getStatus()?.lines.join('\n');
    expect(lines).toContain('[audit] IDEA-1 Test plan');
    expect(lines).toContain('1 audited, 0 skipped, 0 failed');
    expect(onAuditComplete).toHaveBeenCalledWith('IDEA-1', 0);
  });

  it('audits a plan that has never been audited (no audited-hash yet)', async () => {
    const { root } = await makeRoot(PLAN_REVIEW);
    agentScript.current = FLIP_NEXT_CHECKBOX;
    const onAuditComplete = vi.fn(async () => {});
    const manager = createAgentManager(root, onAuditComplete);

    expect(manager.startBatchAudit()).toEqual({ ok: true });
    expect(await waitForStatus(manager, settled)).toBe('done');
    expect(manager.getStatus()?.lines.join('\n')).not.toContain('[skip]');
    expect(onAuditComplete).toHaveBeenCalledWith('IDEA-1', 0);
  });
});
