import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEntityFile } from '@/core/parse';
import { entityToPlan } from '@/core/readers';
import type { PlanEntry } from '@/types/index';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgentManager } from './agent';

// Reproduces IDEA-125's original report end to end: an opencode run reading a sibling
// repo (~/dev/paper-ui) as an API reference gets an `external_directory` permission
// denial. Unlike agent.test.ts's fake adapter (which simulates the `reason` contract
// with a synthetic "PERMISSION-DENIED:" marker), this wires opencode's *real*
// parseLine so the actual JSON shape opencode emits for a denied tool call is what
// drives the park/record/resume pipeline.
const agentScript = vi.hoisted(() => ({ current: 'process.exit(0)' }));

vi.mock('./agents', async () => {
  const opencode = await vi.importActual<typeof import('./agents/opencode')>('./agents/opencode');
  const adapter = {
    command: process.execPath,
    buildArgs: () => ['-e', agentScript.current],
    parseLine: opencode.parseLine,
    options: {},
  };
  return {
    AGENTS: { 'claude-code': adapter, opencode: adapter },
    resolveAgent: () => ({ id: 'opencode' as const, adapter }),
  };
});

const SIBLING_REPO_PATH = '/home/user/dev/paper-ui/src/components/select/select.tsx';

const DENIED_READ_SCRIPT = `
console.log(JSON.stringify({
  type: 'tool_use',
  part: {
    tool: 'read',
    state: {
      status: 'error',
      input: { filePath: ${JSON.stringify(SIBLING_REPO_PATH)} },
      error: 'The user rejected permission to use this specific tool call.',
    },
  },
}));
process.exit(1);
`;

const FLIP_NEXT_CHECKBOX = `
const fs = require('node:fs');
const p = 'papercamp/ideas/IDEA-1.md';
fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('- [ ]', '- [x]'));
`;

const PLAN_ONE_PHASE = `---
id: IDEA-1
title: Test plan
type: feat
status: in-progress
created: 2026-07-01
---
Plan body.

### Phases
- [ ] Read the sibling repo's select component
`;

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })),
  );
});

beforeEach(() => {
  agentScript.current = 'process.exit(0)';
});

async function makeRoot(): Promise<{ root: string; plan: PlanEntry }> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-agent-opencode-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), PLAN_ONE_PHASE);
  const plan = entityToPlan(parseEntityFile(PLAN_ONE_PHASE).entries[0]);
  return { root, plan };
}

type Manager = ReturnType<typeof createAgentManager>;

function currentStatus(manager: Manager) {
  return manager.getStatus()[0];
}

const settled = (status: string) => status === 'done' || status === 'error';

async function waitForStatus(manager: Manager, done: (status: string) => boolean): Promise<string> {
  for (;;) {
    const status = currentStatus(manager)?.status;
    if (status && done(status)) return status;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('opencode external_directory permission ask (IDEA-125)', () => {
  it('parks the run, records the cause in tasks.log, and resumes on answer', async () => {
    const { root, plan } = await makeRoot();
    agentScript.current = DENIED_READ_SCRIPT;
    const manager = createAgentManager(root);

    manager.startRunAllPhases(plan);
    expect(await waitForStatus(manager, settled)).toBe('error');
    expect(currentStatus(manager)?.errorKind).toBe('question');
    const lines = currentStatus(manager)?.lines.join('\n') ?? '';
    expect(lines).toContain(`agent needs a decision: read outside workspace: ${SIBLING_REPO_PATH}`);

    const planFile = await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8');
    const parsedPlan = entityToPlan(parseEntityFile(planFile).entries[0]);
    const parked = parsedPlan.thread?.find((m) => m.kind === 'question');
    expect(parked?.state).toBe('open');
    expect(parked?.text).toContain(`read outside workspace: ${SIBLING_REPO_PATH}`);

    const taskLog = await readFile(join(root, 'papercamp', 'tasks.log'), 'utf-8');
    const entry = taskLog
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .find((e) => e.planId === 'IDEA-1');
    expect(entry.outcome).toBe('error');
    expect(entry.reason).toBe(`read outside workspace: ${SIBLING_REPO_PATH}`);

    agentScript.current = FLIP_NEXT_CHECKBOX;
    const { resumed } = await manager.resumeQuestionParkedTasks(plan.id as string);
    expect(resumed).toBe(true);
    expect(await waitForStatus(manager, settled)).toBe('done');
    expect(currentStatus(manager)?.errorKind).toBeUndefined();

    const after = parseEntityFile(
      await readFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), 'utf-8'),
    );
    expect(after.entries[0].phases.every((phase) => phase.done)).toBe(true);
  });
});
