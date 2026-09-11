import { type ChildProcess, spawn } from 'node:child_process';
import { killWithEscalation } from '../app/server/agent-process';
import { extractUsage, parseLine } from '../app/server/agents/claude-code';
import type { ResolvedNightCheck } from '../core/night-checks';
import { parseNightCheckFindings, parseNightConfirmVerdict } from '../core/night-findings';
import { buildNightCheckPrompt, buildNightConfirmPrompt } from '../core/night-prompts';
import {
  addNightWorktree,
  diffChunkSinceCommit,
  listChunkFiles,
  removeNightWorktree,
  resolveHeadCommit,
} from '../core/night-worktree';
import type {
  AgentConfig,
  NightCheckPassRecord,
  NightChunkPassResult,
  NightFinding,
  NightPassUsage,
  NightRawFinding,
  RateLimitSnapshot,
} from '../types/index';

export interface NightAgentRunResult {
  ok: boolean;
  resultText: string;
  isError: boolean;
  cappedByTurns: boolean;
  numTurns: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  rateLimit?: RateLimitSnapshot;
}

const NO_TOKENS = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };

function emptyUsage(): NightPassUsage {
  return { numTurns: 0, costUsd: 0, cappedByTurns: false, ...NO_TOKENS };
}

export type SpawnAgentFn = (args: string[], cwd: string) => ChildProcess;

export function spawnClaude(args: string[], cwd: string): ChildProcess {
  return spawn('claude', args, { cwd, stdio: ['pipe', 'pipe', 'ignore'] });
}

export function runNightAgentPrompt(opts: {
  cwd: string;
  prompt: string;
  model?: string;
  effort?: string;
  maxTurns: number;
  maxCostUsd: number;
  spawnAgent?: SpawnAgentFn;
}): Promise<NightAgentRunResult> {
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    'auto',
    '--strict-mcp-config',
    '--disallowedTools',
    'Edit',
    'Write',
    'NotebookEdit',
    'WebFetch',
    'WebSearch',
    '--max-budget-usd',
    String(opts.maxCostUsd),
  ];
  if (opts.model) args.push('--model', opts.model);
  if (opts.effort) args.push('--effort', opts.effort);

  return new Promise((resolve, reject) => {
    const proc = (opts.spawnAgent ?? spawnClaude)(args, opts.cwd);
    let turns = 0;
    let cappedByTurns = false;
    let buffered = '';
    let settled = false;
    let rateLimit: RateLimitSnapshot | undefined;

    const settle = (result: NightAgentRunResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    proc.stdin?.on('error', () => {});
    proc.stdin?.write(opts.prompt);
    proc.stdin?.end();

    proc.stdout?.on('data', (chunk: Buffer) => {
      buffered += chunk.toString();
      let newlineIndex = buffered.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = buffered.slice(0, newlineIndex).trim();
        buffered = buffered.slice(newlineIndex + 1);
        newlineIndex = buffered.indexOf('\n');
        if (!line) continue;
        let json: Record<string, unknown>;
        try {
          json = JSON.parse(line);
        } catch {
          continue;
        }
        const parsedRateLimit = parseLine(line)?.rateLimit;
        if (parsedRateLimit) rateLimit = parsedRateLimit;
        if (json.type === 'assistant') {
          turns += 1;
          if (turns > opts.maxTurns && !cappedByTurns) {
            cappedByTurns = true;
            killWithEscalation(proc);
          }
        } else if (json.type === 'result') {
          const { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens } =
            extractUsage(json);
          settle({
            ok: true,
            resultText: typeof json.result === 'string' ? json.result : '',
            isError: Boolean(json.is_error),
            cappedByTurns,
            numTurns: typeof json.num_turns === 'number' ? json.num_turns : turns,
            costUsd: typeof json.total_cost_usd === 'number' ? json.total_cost_usd : 0,
            inputTokens,
            outputTokens,
            cacheCreationTokens,
            cacheReadTokens,
            rateLimit,
          });
        }
      }
    });
    proc.on('close', () => {
      settle({
        ok: false,
        resultText: '',
        isError: true,
        cappedByTurns,
        numTurns: turns,
        costUsd: 0,
        ...NO_TOKENS,
        rateLimit,
      });
    });
    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function usageOf(run: NightAgentRunResult): NightPassUsage {
  return {
    numTurns: run.numTurns,
    costUsd: run.costUsd,
    cappedByTurns: run.cappedByTurns,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    cacheCreationTokens: run.cacheCreationTokens,
    cacheReadTokens: run.cacheReadTokens,
  };
}

function addUsage(a: NightPassUsage, b: NightPassUsage): NightPassUsage {
  return {
    numTurns: a.numTurns + b.numTurns,
    costUsd: a.costUsd + b.costUsd,
    cappedByTurns: a.cappedByTurns || b.cappedByTurns,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
  };
}

async function confirmFinding(
  worktreePath: string,
  checkName: string,
  finding: NightRawFinding,
  agentConfig: AgentConfig,
  maxTurns: number,
  maxCostUsd: number,
  spawnAgent: SpawnAgentFn | undefined,
): Promise<{ finding: NightFinding | null; usage: NightPassUsage; rateLimit?: RateLimitSnapshot }> {
  const prompt = buildNightConfirmPrompt({ checkName, finding });
  const run = await runNightAgentPrompt({
    cwd: worktreePath,
    prompt,
    model: agentConfig.model,
    effort: agentConfig.effort,
    maxTurns,
    maxCostUsd,
    spawnAgent,
  });
  const usage = usageOf(run);
  const rateLimit = run.rateLimit;
  if (!run.ok || run.isError) return { finding: null, usage, rateLimit };

  const verdict = parseNightConfirmVerdict(run.resultText);
  if (!verdict?.confirmed || !verdict.severity) return { finding: null, usage, rateLimit };
  return {
    finding: { ...finding, severity: verdict.severity, check: checkName },
    usage,
    rateLimit,
  };
}

export async function runNightChunkPass(opts: {
  root: string;
  chunkPath: string;
  sinceCommit: string | null;
  checks: ResolvedNightCheck[];
  agentConfig: AgentConfig;
  maxTurns: number;
  maxCostUsd: number;
  spawnAgent?: SpawnAgentFn;
}): Promise<NightChunkPassResult> {
  if (opts.agentConfig.agent !== 'claude-code') {
    throw new Error(
      `night shift checks require the claude-code agent (got "${opts.agentConfig.agent}") — only its CLI supports the tool restrictions and cost cap a read-only pass depends on`,
    );
  }

  const reviewedCommit = await resolveHeadCommit(opts.root);
  const worktreePath = await addNightWorktree(opts.root, reviewedCommit);

  let usage = emptyUsage();
  const findings: NightFinding[] = [];
  const checks: NightCheckPassRecord[] = [];
  let rateLimit: RateLimitSnapshot | undefined;

  try {
    const files = await listChunkFiles(opts.root, reviewedCommit, opts.chunkPath);
    const diff = await diffChunkSinceCommit(
      opts.root,
      opts.chunkPath,
      opts.sinceCommit,
      reviewedCommit,
    );

    for (const check of opts.checks) {
      const startedAt = new Date().toISOString();
      let checkUsage = emptyUsage();
      let findingsCount = 0;

      const prompt = buildNightCheckPrompt({
        name: check.name,
        instructions: check.instructions,
        chunkPath: opts.chunkPath,
        files,
        sinceCommit: opts.sinceCommit,
        diff,
      });
      const run = await runNightAgentPrompt({
        cwd: worktreePath,
        prompt,
        model: opts.agentConfig.model,
        effort: opts.agentConfig.effort,
        maxTurns: opts.maxTurns,
        maxCostUsd: opts.maxCostUsd,
        spawnAgent: opts.spawnAgent,
      });
      checkUsage = addUsage(checkUsage, usageOf(run));
      if (run.rateLimit) rateLimit = run.rateLimit;
      const ok = run.ok && !run.isError;

      const rawFindings = ok ? parseNightCheckFindings(run.resultText) : undefined;
      if (rawFindings) {
        for (const rawFinding of rawFindings) {
          const confirmation = await confirmFinding(
            worktreePath,
            check.name,
            rawFinding,
            opts.agentConfig,
            opts.maxTurns,
            opts.maxCostUsd,
            opts.spawnAgent,
          );
          checkUsage = addUsage(checkUsage, confirmation.usage);
          if (confirmation.rateLimit) rateLimit = confirmation.rateLimit;
          if (confirmation.finding) {
            findings.push(confirmation.finding);
            findingsCount += 1;
          }
        }
      }

      usage = addUsage(usage, checkUsage);
      checks.push({
        check: check.name,
        startedAt,
        endedAt: new Date().toISOString(),
        ok,
        usage: checkUsage,
        findingsCount,
      });
    }
  } finally {
    await removeNightWorktree(opts.root, worktreePath);
  }

  return { chunkPath: opts.chunkPath, reviewedCommit, findings, usage, checks, rateLimit };
}
