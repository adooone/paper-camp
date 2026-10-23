import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPrCache } from '../../core/git-pr/pr';
import { formatEntityFile } from '../../core/serialize/entity-file';
import type { PlanEntry } from '../../types/index';
import type { AgentTask } from './agent';
import { createAgentManager } from './agent';
import { applyPrioritiseVerdict, getPrioritiseVerdict } from './prioritise';

// Mirrors routes/content/ideas.ts's retry adaptor: binds a retry to the first
// attempt's task instead of opening a second one (IDEA-312), and never
// auto-settles — the task stays 'running' until the caller finalizes it once it
// knows whether the verdict was accepted or every attempt failed.
function prioritisePrompt(manager: ReturnType<typeof createAgentManager>): {
  run: (prompt: string, retryReason?: string) => Promise<string>;
  task: () => AgentTask | undefined;
} {
  let task: AgentTask | undefined;
  return {
    run: (prompt: string, retryReason?: string): Promise<string> => {
      if (retryReason !== undefined && task) {
        return manager.runReadOnlyPrompt('prioritise', prompt, 'Prioritise queue', {
          task,
          retryReason,
          autoSettle: false,
        });
      }
      return manager.runReadOnlyPrompt('prioritise', prompt, 'Prioritise queue', {
        autoSettle: false,
        onTask: (t) => {
          task = t;
        },
      });
    },
    task: () => task,
  };
}

vi.mock('./local-adapters', () => ({
  claudeAuthStatus: vi.fn(() => Promise.resolve(null)),
}));

// A command whose argv is whatever hardcoded flags agent.ts's runReadOnlyPrompt
// builds ('-p --output-format json') — this script ignores them entirely and
// answers from PRIORITISE_RESPONSES/PRIORITISE_COUNTER_FILE instead, so a test
// can script a different reply per call without the child process sharing any
// JS state with the test. Read lazily (the getter runs well after module eval,
// once a test is actually driving the manager) so it isn't in the TDZ of the
// vi.mock factory, which vitest hoists above this file's own declarations.
let readOnlyAgentPath: string | undefined;
function fakeReadOnlyAgentPath(): string {
  if (readOnlyAgentPath) return readOnlyAgentPath;
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-prioritise-agent-'));
  const path = join(dir, 'fake-agent.js');
  writeFileSync(
    path,
    [
      '#!/usr/bin/env node',
      'const fs = require("fs");',
      'const responses = JSON.parse(process.env.PRIORITISE_RESPONSES || "[]");',
      'const counterFile = process.env.PRIORITISE_COUNTER_FILE;',
      'let n = 0;',
      'try { n = parseInt(fs.readFileSync(counterFile, "utf8"), 10); } catch {}',
      'fs.writeFileSync(counterFile, String(n + 1));',
      'const resp = responses[n] || { stdout: "" };',
      'process.stdout.write(resp.stdout || "");',
      'if (resp.stderr) process.stderr.write(resp.stderr);',
      'process.exit(resp.exit || 0);',
      '',
    ].join('\n'),
  );
  chmodSync(path, 0o755);
  readOnlyAgentPath = path;
  return path;
}

vi.mock('./agents', () => {
  const adapter = {
    get command() {
      return fakeReadOnlyAgentPath();
    },
    buildArgs: () => [],
    buildReadOnlyArgs: () => [],
    parseLine: (line: string) => ({ text: line.trim() }),
    options: {},
  };
  return {
    AGENTS: { 'claude-code': adapter, opencode: adapter },
    resolveAgent: () => ({ id: 'claude-code', adapter }),
  };
});

const originalPath = process.env.PATH;

/** Puts a fake `gh` on PATH that exits non-zero, so status derives from stored fields alone. */
function installFailingGh(): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-prioritise-gh-'));
  writeFileSync(join(dir, 'gh'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(dir, 'gh'), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

beforeEach(() => {
  clearPrCache();
  installFailingGh();
});
afterEach(() => {
  process.env.PATH = originalPath;
  clearPrCache();
});

function tmpRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-root-'));
  mkdirSync(join(root, 'papercamp', 'ideas', 'archive'), { recursive: true });
  return root;
}

function write(root: string, entity: Parameters<typeof formatEntityFile>[0]): void {
  writeFileSync(
    join(root, 'papercamp', 'ideas', `${entity.id}.md`),
    `${formatEntityFile(entity)}\n`,
  );
}

function writeRunOrder(root: string, lines: string[]): void {
  writeFileSync(
    join(root, 'papercamp', 'run-order.md'),
    lines.length ? `${lines.join('\n')}\n` : '',
  );
}

function readRunOrder(root: string): string[] {
  const raw = (() => {
    try {
      return readFileSync(join(root, 'papercamp', 'run-order.md'), 'utf-8');
    } catch {
      return '';
    }
  })();
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

// logTaskCompletion's write is fire-and-forget off setStatus(), so it can land
// slightly after getStatus() already reports the terminal status — poll.
async function readTaskLogRows(
  root: string,
  taskId: string,
): Promise<{ outcome?: string; reason?: string }[]> {
  const logPath = join(root, 'papercamp', 'tasks.log');
  const start = Date.now();
  while (Date.now() - start < 2000) {
    try {
      const raw = readFileSync(logPath, 'utf-8');
      const rows = raw
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((entry) => entry.id === taskId && entry.outcome);
      if (rows.length > 0) return rows;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return [];
}

function readLog(root: string, id: string): string[] {
  const raw = readFileSync(join(root, 'papercamp', 'ideas', `${id}.md`), 'utf-8');
  const match = raw.match(/### Thread\n([\s\S]*?)(\n###|$)/);
  if (!match) return [];
  return match[1]
    .trim()
    .split('\n')
    .filter((line) => line.includes('[log]'));
}

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'A plan',
  status: 'planned',
  created: '2026-07-01',
  tags: [],
  needs: [],
  body: '',
  phases: [],
  ...overrides,
});

describe('getPrioritiseVerdict', () => {
  it('retries once with the validation failure fed back, then gives up', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const prompts: string[] = [];
    const retryReasons: (string | undefined)[] = [];
    const runPrompt = async (prompt: string, retryReason?: string) => {
      prompts.push(prompt);
      retryReasons.push(retryReason);
      return '{not json}';
    };

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'was not valid JSON',
    );
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('Your previous response was invalid');
    expect(prompts[1]).toContain('was not valid JSON');
    // The retryReason is how the caller (agent.runPrioritise) knows to bind the
    // second attempt to the first one's task instead of opening a new one.
    expect(retryReasons[0]).toBeUndefined();
    expect(retryReasons[1]).toContain('was not valid JSON');
  });

  it('accepts a corrected verdict on the retry', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    let call = 0;
    const runPrompt = async () => {
      call += 1;
      if (call === 1) return '{not json}';
      return JSON.stringify({ order: ['IDEA-2', 'IDEA-1'], why: ['a', 'b'] });
    };

    const verdict = await getPrioritiseVerdict(worklist, '', runPrompt);
    expect(verdict).toEqual({ order: ['IDEA-2', 'IDEA-1'], why: ['a', 'b'] });
    expect(call).toBe(2);
  });

  it('excludes a plan with an unmet need from the active set (IDEA-291)', async () => {
    const worklist = [
      plan({ id: 'IDEA-1' }),
      plan({
        id: 'IDEA-2',
        resolvedNeeds: [{ raw: 'IDEA-1', id: 'IDEA-1', found: true, done: false }],
      }),
    ];
    const runPrompt = async () => JSON.stringify({ order: ['IDEA-1'], why: ['only one active'] });

    const verdict = await getPrioritiseVerdict(worklist, '', runPrompt);
    expect(verdict).toEqual({ order: ['IDEA-1'], why: ['only one active'] });
  });

  it('rejects a verdict missing the order/why shape', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () => JSON.stringify({ order: ['IDEA-1', 'IDEA-2'] });

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'missing an `order` array or a `why` array',
    );
  });

  it('rejects a verdict with the wrong count of ordered ids, naming both counts', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () => JSON.stringify({ order: ['IDEA-1'], why: ['kept first'] });

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'ordered 1 ideas but 2 are active',
    );
  });

  it('rejects a verdict with a duplicated id, naming the id', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () => JSON.stringify({ order: ['IDEA-1', 'IDEA-1'], why: ['a', 'b'] });

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'listed id "IDEA-1" more than once',
    );
  });

  it('rejects a verdict with an id outside the active set, naming the id', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () => JSON.stringify({ order: ['IDEA-1', 'IDEA-9'], why: ['a', 'b'] });

    await expect(getPrioritiseVerdict(worklist, '', runPrompt)).rejects.toThrow(
      'included id "IDEA-9", which is not in the active set',
    );
  });

  it('retries once when `why` has fewer reasons than ordered ids', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    let call = 0;
    const runPrompt = async () => {
      call += 1;
      if (call === 1) return JSON.stringify({ order: ['IDEA-1', 'IDEA-2'], why: ['only one'] });
      return JSON.stringify({ order: ['IDEA-1', 'IDEA-2'], why: ['first', 'second'] });
    };

    const verdict = await getPrioritiseVerdict(worklist, '', runPrompt);
    expect(verdict).toEqual({ order: ['IDEA-1', 'IDEA-2'], why: ['first', 'second'] });
    expect(call).toBe(2);
  });

  it('keeps a valid ordering when the retry still under-supplies reasons', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    let call = 0;
    const runPrompt = async () => {
      call += 1;
      return JSON.stringify({ order: ['IDEA-1', 'IDEA-2'], why: ['only one reason'] });
    };

    const verdict = await getPrioritiseVerdict(worklist, '', runPrompt);
    expect(verdict).toEqual({ order: ['IDEA-1', 'IDEA-2'], why: ['only one reason'] });
    expect(call).toBe(2);
  });

  it('splits a legacy newline-delimited `why` string onto the right ideas', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const runPrompt = async () =>
      JSON.stringify({ order: ['IDEA-1', 'IDEA-2'], why: 'first\nsecond' });

    const verdict = await getPrioritiseVerdict(worklist, '', runPrompt);
    expect(verdict).toEqual({ order: ['IDEA-1', 'IDEA-2'], why: ['first', 'second'] });
  });

  it('accepts a full permutation of the active ids', async () => {
    const worklist = [
      plan({ id: 'IDEA-1' }),
      plan({ id: 'IDEA-2' }),
      plan({ id: 'IDEA-3', status: 'idea' }),
    ];
    const runPrompt = async () =>
      JSON.stringify({ order: ['IDEA-2', 'IDEA-1'], why: ['blocks first', 'second'] });

    const verdict = await getPrioritiseVerdict(worklist, '', runPrompt);
    expect(verdict).toEqual({ order: ['IDEA-2', 'IDEA-1'], why: ['blocks first', 'second'] });
  });
});

describe('agent.runPrioritise through getPrioritiseVerdict (IDEA-312)', () => {
  beforeEach(() => {
    const counterFile = join(mkdtempSync(join(tmpdir(), 'papercamp-prioritise-counter-')), 'n');
    process.env.PRIORITISE_COUNTER_FILE = counterFile;
  });

  afterEach(() => {
    process.env.PRIORITISE_COUNTER_FILE = '';
    process.env.PRIORITISE_RESPONSES = '';
  });

  it('binds the retry to the first attempt task instead of opening a second one, never going done in between', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const secondVerdict = JSON.stringify({ order: ['IDEA-2', 'IDEA-1'], why: ['first', 'second'] });
    process.env.PRIORITISE_RESPONSES = JSON.stringify([
      { stdout: '{not json}' },
      { stdout: secondVerdict },
    ]);
    const root = tmpRoot();
    const manager = createAgentManager(root);
    const prompt = prioritisePrompt(manager);

    const verdict = await getPrioritiseVerdict(worklist, '', prompt.run);
    const tasks = manager.getStatus().filter((t) => t.taskKind === 'prioritise');
    expect(tasks).toHaveLength(1);
    // Still 'running' — the route only finalizes once it knows the verdict stuck.
    expect(tasks[0].status).toBe('running');
    const task = prompt.task();
    if (!task) throw new Error('expected a task');
    await manager.finalizeReadOnlyTask(task, 'done');

    expect(verdict).toEqual({ order: ['IDEA-2', 'IDEA-1'], why: ['first', 'second'] });
    expect(manager.getStatus().find((t) => t.id === task.id)?.status).toBe('done');
    const lines = task.lines.join('\n');
    expect(lines).toContain('[retry] Agent verdict was not valid JSON');
    expect(lines).toContain(secondVerdict);

    const rows = await readTaskLogRows(root, task.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe('done');
  });

  it('clears errorReason and errorKind from a failed attempt once the retry succeeds', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    const secondVerdict = JSON.stringify({ order: ['IDEA-2', 'IDEA-1'], why: ['first', 'second'] });
    process.env.PRIORITISE_RESPONSES = JSON.stringify([
      { stdout: '', exit: 1 },
      { stdout: secondVerdict },
    ]);
    const root = tmpRoot();
    const manager = createAgentManager(root);
    const prompt = prioritisePrompt(manager);

    const verdict = await getPrioritiseVerdict(worklist, '', prompt.run);
    const task = prompt.task();
    if (!task) throw new Error('expected a task');
    await manager.finalizeReadOnlyTask(task, 'done');

    expect(verdict).toEqual({ order: ['IDEA-2', 'IDEA-1'], why: ['first', 'second'] });
    const status = manager.getStatus().find((t) => t.id === task.id);
    expect(status?.status).toBe('done');
    expect(status?.errorKind).toBeUndefined();

    const rows = await readTaskLogRows(root, task.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('reason');
  });

  it('settles as error once every attempt fails, with one error row', async () => {
    const worklist = [plan({ id: 'IDEA-1' }), plan({ id: 'IDEA-2' })];
    process.env.PRIORITISE_RESPONSES = JSON.stringify([
      { stdout: '{not json}' },
      { stdout: '{still not json}' },
    ]);
    const root = tmpRoot();
    const manager = createAgentManager(root);
    const prompt = prioritisePrompt(manager);

    await expect(getPrioritiseVerdict(worklist, '', prompt.run)).rejects.toThrow();
    const task = prompt.task();
    if (!task) throw new Error('expected a task');
    await manager.finalizeReadOnlyTask(task, 'error');

    const rows = await readTaskLogRows(root, task.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe('error');
  });
});

describe('applyPrioritiseVerdict', () => {
  it('reorders the queue and appends the matching why line to each moved idea', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'planned',
      created: '2026-07-01',
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
    });
    writeRunOrder(root, ['IDEA-1 — First', 'IDEA-2 — Second']);

    const result = await applyPrioritiseVerdict(root, {
      order: ['IDEA-2', 'IDEA-1'],
      why: ['unblocks IDEA-1', 'waits on IDEA-2'],
    });

    expect(result.moved.sort()).toEqual(['IDEA-1', 'IDEA-2']);
    expect(result.annotated.sort()).toEqual(['IDEA-1', 'IDEA-2']);
    expect(readRunOrder(root)).toEqual(['IDEA-2 — Second', 'IDEA-1 — First']);
    expect(readLog(root, 'IDEA-2')).toEqual([expect.stringContaining('unblocks IDEA-1')]);
    expect(readLog(root, 'IDEA-1')).toEqual([expect.stringContaining('waits on IDEA-2')]);
  });

  it('replaces its own previous run-order note instead of stacking another', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'planned',
      created: '2026-07-01',
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
    });
    writeRunOrder(root, ['IDEA-1 — First', 'IDEA-2 — Second']);

    await applyPrioritiseVerdict(root, {
      order: ['IDEA-2', 'IDEA-1'],
      why: ['first reason for 2', 'first reason for 1'],
    });
    await applyPrioritiseVerdict(root, {
      order: ['IDEA-1', 'IDEA-2'],
      why: ['second reason for 1', 'second reason for 2'],
    });

    // One note per idea after two runs, carrying only the latest reason.
    expect(readLog(root, 'IDEA-1')).toEqual([expect.stringContaining('second reason for 1')]);
    expect(readLog(root, 'IDEA-2')).toEqual([expect.stringContaining('second reason for 2')]);
    expect(readLog(root, 'IDEA-1')[0]).not.toContain('first reason');
  });

  it('leaves an agent log that is not a run-order note alone', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'planned',
      created: '2026-07-01',
      thread: [
        { kind: 'log', from: 'agent', date: '2026-07-01', text: 'Feedback summary worth keeping' },
      ],
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
    });
    writeRunOrder(root, ['IDEA-1 — First', 'IDEA-2 — Second']);

    await applyPrioritiseVerdict(root, {
      order: ['IDEA-2', 'IDEA-1'],
      why: ['reason for 2', 'reason for 1'],
    });

    const logs = readLog(root, 'IDEA-1');
    expect(logs).toHaveLength(2);
    expect(logs[0]).toContain('Feedback summary worth keeping');
    expect(logs[1]).toContain('reason for 1');
  });

  it('falls back to a generic reason for ids without a matching why line', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'planned',
      created: '2026-07-01',
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
    });
    writeRunOrder(root, ['IDEA-1 — First', 'IDEA-2 — Second']);

    const result = await applyPrioritiseVerdict(root, {
      order: ['IDEA-2', 'IDEA-1'],
      why: ['only one reason'],
    });

    expect(result.moved.sort()).toEqual(['IDEA-1', 'IDEA-2']);
    expect(result.annotated.sort()).toEqual(['IDEA-1', 'IDEA-2']);
    expect(readLog(root, 'IDEA-2')).toEqual([expect.stringContaining('only one reason')]);
    expect(readLog(root, 'IDEA-1')).toEqual([
      expect.stringContaining('Reprioritised by the shuffle agent.'),
    ]);
  });

  it('still annotates every idea when the order already matches, with no run-order write', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'planned',
      created: '2026-07-01',
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
    });
    writeRunOrder(root, ['IDEA-1 — First', 'IDEA-2 — Second']);

    const result = await applyPrioritiseVerdict(root, {
      order: ['IDEA-1', 'IDEA-2'],
      why: ['stays first', 'stays second'],
    });

    expect(result.moved).toEqual([]);
    expect(result.annotated.sort()).toEqual(['IDEA-1', 'IDEA-2']);
    expect(readLog(root, 'IDEA-1')).toEqual([expect.stringContaining('stays first')]);
    expect(readLog(root, 'IDEA-2')).toEqual([expect.stringContaining('stays second')]);
    expect(readRunOrder(root)).toEqual(['IDEA-1 — First', 'IDEA-2 — Second']);
  });

  it('keeps the reorder and reports the failure when annotating a moved idea fails', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'planned',
      created: '2026-07-01',
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
    });
    writeRunOrder(root, ['IDEA-2 — Second', 'IDEA-1 — First']);
    const idea2File = join(root, 'papercamp', 'ideas', 'IDEA-2.md');
    chmodSync(idea2File, 0o444);

    try {
      const result = await applyPrioritiseVerdict(root, {
        order: ['IDEA-1', 'IDEA-2'],
        why: ['unblocks IDEA-1', 'waits on IDEA-2'],
      });

      expect(result.moved.sort()).toEqual(['IDEA-1', 'IDEA-2']);
      expect(result.annotated).toEqual(['IDEA-1']);
      expect(result.annotationError).toContain('IDEA-2');
      expect(readRunOrder(root)).toEqual(['IDEA-1 — First', 'IDEA-2 — Second']);
    } finally {
      chmodSync(idea2File, 0o644);
    }
  });
});
