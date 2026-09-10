import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from '../types/index';
import type { SpawnAgentFn } from './night-pass';
import { runNightAgentPrompt, runNightChunkPass } from './night-pass';

function fakeProc() {
  const stdout = new EventEmitter();
  const stdin = { write: vi.fn(), end: vi.fn(), on: vi.fn() };
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stdin: typeof stdin;
    kill: (signal?: string) => boolean;
    killed: boolean;
  };
  proc.stdout = stdout;
  proc.stdin = stdin;
  proc.killed = false;
  proc.kill = vi.fn(() => {
    proc.killed = true;
    return true;
  });
  return proc;
}

function line(json: Record<string, unknown>): Buffer {
  return Buffer.from(`${JSON.stringify(json)}\n`);
}

describe('runNightAgentPrompt', () => {
  it('resolves with the final result text, cost, and turn count', async () => {
    const proc = fakeProc();
    const spawnAgent = vi.fn().mockReturnValue(proc) as unknown as SpawnAgentFn;

    const promise = runNightAgentPrompt({
      cwd: '/tmp',
      prompt: 'hello',
      maxTurns: 10,
      maxCostUsd: 1,
      spawnAgent,
    });
    proc.stdout.emit('data', line({ type: 'assistant' }));
    proc.stdout.emit(
      'data',
      line({ type: 'result', result: '[]', is_error: false, num_turns: 1, total_cost_usd: 0.02 }),
    );

    expect(await promise).toEqual({
      ok: true,
      resultText: '[]',
      isError: false,
      cappedByTurns: false,
      numTurns: 1,
      costUsd: 0.02,
    });
    expect(proc.stdin.write).toHaveBeenCalledWith('hello');
  });

  it('handles a JSON line split across two data events', async () => {
    const proc = fakeProc();
    const spawnAgent = vi.fn().mockReturnValue(proc) as unknown as SpawnAgentFn;

    const promise = runNightAgentPrompt({
      cwd: '/tmp',
      prompt: 'p',
      maxTurns: 10,
      maxCostUsd: 1,
      spawnAgent,
    });
    const wholeLine = `${JSON.stringify({ type: 'result', result: 'ok', num_turns: 1, total_cost_usd: 0 })}\n`;
    proc.stdout.emit('data', Buffer.from(wholeLine.slice(0, 10)));
    proc.stdout.emit('data', Buffer.from(wholeLine.slice(10)));

    expect((await promise).resultText).toBe('ok');
  });

  it('ignores lines that do not parse as JSON', async () => {
    const proc = fakeProc();
    const spawnAgent = vi.fn().mockReturnValue(proc) as unknown as SpawnAgentFn;

    const promise = runNightAgentPrompt({
      cwd: '/tmp',
      prompt: 'p',
      maxTurns: 10,
      maxCostUsd: 1,
      spawnAgent,
    });
    proc.stdout.emit('data', Buffer.from('not json\n'));
    proc.stdout.emit(
      'data',
      line({ type: 'result', result: 'ok', num_turns: 0, total_cost_usd: 0 }),
    );

    expect((await promise).resultText).toBe('ok');
  });

  it('kills the process and marks it turn-capped once assistant turns exceed the cap', async () => {
    const proc = fakeProc();
    const spawnAgent = vi.fn().mockReturnValue(proc) as unknown as SpawnAgentFn;

    const promise = runNightAgentPrompt({
      cwd: '/tmp',
      prompt: 'p',
      maxTurns: 2,
      maxCostUsd: 1,
      spawnAgent,
    });
    proc.stdout.emit('data', line({ type: 'assistant' }));
    proc.stdout.emit('data', line({ type: 'assistant' }));
    proc.stdout.emit('data', line({ type: 'assistant' }));
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');

    proc.emit('close');
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.cappedByTurns).toBe(true);
    expect(result.numTurns).toBe(3);
  });

  it('resolves not-ok when the process closes with no result line', async () => {
    const proc = fakeProc();
    const spawnAgent = vi.fn().mockReturnValue(proc) as unknown as SpawnAgentFn;

    const promise = runNightAgentPrompt({
      cwd: '/tmp',
      prompt: 'p',
      maxTurns: 10,
      maxCostUsd: 1,
      spawnAgent,
    });
    proc.emit('close');

    expect(await promise).toEqual({
      ok: false,
      resultText: '',
      isError: true,
      cappedByTurns: false,
      numTurns: 0,
      costUsd: 0,
    });
  });

  it('rejects when the process fails to spawn', async () => {
    const proc = fakeProc();
    const spawnAgent = vi.fn().mockReturnValue(proc) as unknown as SpawnAgentFn;

    const promise = runNightAgentPrompt({
      cwd: '/tmp',
      prompt: 'p',
      maxTurns: 10,
      maxCostUsd: 1,
      spawnAgent,
    });
    proc.emit('error', new Error('ENOENT'));

    await expect(promise).rejects.toThrow('ENOENT');
  });

  it('passes disallowed tools, budget cap, model, and effort as CLI args', async () => {
    const proc = fakeProc();
    const spawnAgent = vi.fn().mockReturnValue(proc) as unknown as SpawnAgentFn;

    const promise = runNightAgentPrompt({
      cwd: '/work',
      prompt: 'p',
      model: 'sonnet',
      effort: 'medium',
      maxTurns: 10,
      maxCostUsd: 2.5,
      spawnAgent,
    });
    proc.stdout.emit(
      'data',
      line({ type: 'result', result: 'ok', num_turns: 0, total_cost_usd: 0 }),
    );
    await promise;

    expect(spawnAgent).toHaveBeenCalledWith(
      expect.arrayContaining([
        '--disallowedTools',
        'Edit',
        'Write',
        'NotebookEdit',
        'WebFetch',
        'WebSearch',
        '--max-budget-usd',
        '2.5',
        '--model',
        'sonnet',
        '--effort',
        'medium',
      ]),
      '/work',
    );
  });
});

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
}

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function initGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-night-pass-'));
  dirs.push(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  await mkdir(join(root, 'src', 'core'), { recursive: true });
  await writeFile(join(root, 'src', 'core', 'a.ts'), 'export const a = 1;\n', 'utf-8');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'seed');
  return root;
}

const CLAUDE_CONFIG: AgentConfig = { agent: 'claude-code', model: 'sonnet', effort: 'medium' };

describe('runNightChunkPass', () => {
  it('rejects an agent config that is not claude-code, before touching the worktree', async () => {
    const root = await initGitRepo();
    const spawnAgent = vi.fn() as unknown as SpawnAgentFn;
    await expect(
      runNightChunkPass({
        root,
        chunkPath: 'src/core',
        sinceCommit: null,
        checks: [{ id: 'bugs', name: 'bugs', instructions: 'x' }],
        agentConfig: { agent: 'opencode' },
        maxTurns: 10,
        maxCostUsd: 1,
        spawnAgent,
      }),
    ).rejects.toThrow(/claude-code/);
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('runs a check, confirms a finding, and cleans up the worktree', async () => {
    const root = await initGitRepo();
    let call = 0;
    const spawnAgent: SpawnAgentFn = () => {
      call += 1;
      const proc = fakeProc();
      const isCheck = call === 1;
      setImmediate(() => {
        proc.stdout.emit(
          'data',
          line(
            isCheck
              ? {
                  type: 'result',
                  result: '[{"file": "src/core/a.ts", "line": 1, "message": "issue"}]',
                  num_turns: 1,
                  total_cost_usd: 0.01,
                }
              : {
                  type: 'result',
                  result: '{"confirmed": true, "severity": "high", "reasoning": "yes"}',
                  num_turns: 1,
                  total_cost_usd: 0.01,
                },
          ),
        );
      });
      return proc as unknown as ReturnType<SpawnAgentFn>;
    };

    const result = await runNightChunkPass({
      root,
      chunkPath: 'src/core',
      sinceCommit: null,
      checks: [{ id: 'bugs', name: 'bugs', instructions: 'x' }],
      agentConfig: CLAUDE_CONFIG,
      maxTurns: 10,
      maxCostUsd: 1,
      spawnAgent,
    });

    expect(result.findings).toEqual([
      { file: 'src/core/a.ts', line: 1, message: 'issue', severity: 'high', check: 'bugs' },
    ]);
    expect(result.usage.numTurns).toBe(2);
    expect(result.usage.costUsd).toBeCloseTo(0.02);
    expect(call).toBe(2);
    expect(result.checks).toEqual([
      expect.objectContaining({ check: 'bugs', ok: true, findingsCount: 1 }),
    ]);

    const worktreeListing = spawnSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: root,
      encoding: 'utf-8',
    }).stdout;
    expect(worktreeListing.trim().split('\n\n')).toHaveLength(1);
  });

  it('does not run a confirming pass when the check reports no findings', async () => {
    const root = await initGitRepo();
    let call = 0;
    const spawnAgent: SpawnAgentFn = () => {
      call += 1;
      const proc = fakeProc();
      setImmediate(() => {
        proc.stdout.emit(
          'data',
          line({ type: 'result', result: '[]', num_turns: 1, total_cost_usd: 0.01 }),
        );
      });
      return proc as unknown as ReturnType<SpawnAgentFn>;
    };

    const result = await runNightChunkPass({
      root,
      chunkPath: 'src/core',
      sinceCommit: null,
      checks: [{ id: 'bugs', name: 'bugs', instructions: 'x' }],
      agentConfig: CLAUDE_CONFIG,
      maxTurns: 10,
      maxCostUsd: 1,
      spawnAgent,
    });

    expect(result.findings).toEqual([]);
    expect(call).toBe(1);
  });

  it('drops a finding the confirming pass rejects', async () => {
    const root = await initGitRepo();
    let call = 0;
    const spawnAgent: SpawnAgentFn = () => {
      call += 1;
      const proc = fakeProc();
      const isCheck = call === 1;
      setImmediate(() => {
        proc.stdout.emit(
          'data',
          line(
            isCheck
              ? {
                  type: 'result',
                  result: '[{"file": "src/core/a.ts", "line": 1, "message": "issue"}]',
                  num_turns: 1,
                  total_cost_usd: 0,
                }
              : {
                  type: 'result',
                  result: '{"confirmed": false, "severity": null, "reasoning": "false positive"}',
                  num_turns: 1,
                  total_cost_usd: 0,
                },
          ),
        );
      });
      return proc as unknown as ReturnType<SpawnAgentFn>;
    };

    const result = await runNightChunkPass({
      root,
      chunkPath: 'src/core',
      sinceCommit: null,
      checks: [{ id: 'bugs', name: 'bugs', instructions: 'x' }],
      agentConfig: CLAUDE_CONFIG,
      maxTurns: 10,
      maxCostUsd: 1,
      spawnAgent,
    });

    expect(result.findings).toEqual([]);
  });
});
