import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { logTaskCompletion, logTaskStart } from '../app/server/task-log';
import {
  daemonStatePath,
  fetchMachineNightGate,
  readRunningDaemonState,
} from '../core/daemon-state';
import {
  type MachineProject,
  type MachineRegistry,
  clearNightProject,
  defaultRegistryPath,
  loadRegistry,
  saveRegistry,
  setNightProject,
} from '../core/machine-registry';
import { resolveNightChecks } from '../core/night-checks';
import { markChunkReviewed } from '../core/night-health';
import {
  appendNightFindings,
  dropOverlappingFindings,
  readNightFindings,
} from '../core/night-suggestions';
import { readEntitiesWithDerivedStatus } from '../core/readers';
import { todayDateString } from '../core/serialize';
import {
  DEFAULT_AGENTS,
  DEFAULT_NIGHT_CONFIG,
  type MachineNightGateResponse,
  type NightChunkPassResult,
  type NightConfig,
  type NightFinding,
  type NightFindingSeverity,
  type NightGateBlockReason,
  type NightSuggestionEntry,
  coerceAgentConfig,
} from '../types/index';
import { runNightChunkPass } from './night-pass';

export async function readNightConfig(root: string): Promise<NightConfig | undefined> {
  const raw = await readFile(join(root, 'papercamp', 'config.json'), 'utf-8').catch(() => null);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { night?: NightConfig };
    return parsed.night;
  } catch {
    return undefined;
  }
}

export interface ResolvedNightConfig {
  ceiling: number;
  floor: number;
  maxChunks: number;
  threshold: number;
  maxTurns: number;
  maxCostUsd: number;
  window?: NightConfig['window'];
  roots?: string[];
}

export function resolveNightConfig(config: NightConfig | undefined): ResolvedNightConfig {
  return {
    ceiling: config?.ceiling ?? DEFAULT_NIGHT_CONFIG.ceiling,
    floor: config?.floor ?? DEFAULT_NIGHT_CONFIG.floor,
    maxChunks: config?.maxChunks ?? DEFAULT_NIGHT_CONFIG.maxChunks,
    threshold: config?.threshold ?? DEFAULT_NIGHT_CONFIG.threshold,
    maxTurns: config?.maxTurns ?? DEFAULT_NIGHT_CONFIG.maxTurns,
    maxCostUsd: config?.maxCostUsd ?? DEFAULT_NIGHT_CONFIG.maxCostUsd,
    window: config?.window,
    roots: config?.roots,
  };
}

function formatNightSettings(resolved: ResolvedNightConfig): string {
  const lines = [
    `  ceiling (5h):   ${resolved.ceiling}%`,
    `  floor (7d):     ${resolved.floor}%`,
    `  window:         ${resolved.window ? `${resolved.window.from}–${resolved.window.to}` : '(none)'}`,
    `  roots:          ${resolved.roots?.join(', ') ?? '(every folder one level under src/)'}`,
    `  maxChunks:      ${resolved.maxChunks}`,
    `  threshold:      ${resolved.threshold}`,
    `  maxTurns:       ${resolved.maxTurns}`,
    `  maxCostUsd:     $${resolved.maxCostUsd}`,
  ];
  return lines.join('\n');
}

const GATE_REASON_LABEL: Record<NightGateBlockReason, string> = {
  'dashboard-active': 'dashboard active in the last 30m',
  'task-running': 'an agent task is running',
  'no-capacity-snapshot': 'no capacity snapshot yet',
  'five-hour-ceiling': '5h ceiling exceeded',
  'seven-day-floor': '7d floor exceeded',
  'outside-window': 'outside the configured window',
  paused: 'paused for tonight',
};

function formatGateLine(response: MachineNightGateResponse | null): string {
  if (!response) {
    return '  gate:           unknown — start the daemon (`paper-camp daemon` or `paper-camp start`) to evaluate it live';
  }
  if (response.projectMissing) {
    return '  gate:           unknown — the selected project is no longer registered';
  }
  if (!response.gate) {
    return '  gate:           unknown — no project selected';
  }
  if (response.gate.open) {
    return '  gate:           open';
  }
  const reasons = response.gate.reasons.map((reason) => GATE_REASON_LABEL[reason]).join(', ');
  return `  gate:           blocked — ${reasons}`;
}

async function printNightStatus(registry: MachineRegistry): Promise<void> {
  if (!registry.night) {
    console.log('paper-camp: night shift is off');
    return;
  }
  const project = registry.projects.find((p) => p.slug === registry.night?.slug);
  if (!project) {
    console.log(
      `paper-camp: night shift is set to "${registry.night.slug}", but that project is no longer registered`,
    );
    return;
  }
  console.log(`paper-camp: night shift runs for "${project.slug}" (${project.path})`);
  const config = await readNightConfig(project.path);
  console.log(formatNightSettings(resolveNightConfig(config)));

  const daemonState = await readRunningDaemonState(daemonStatePath());
  const gateResponse = daemonState ? await fetchMachineNightGate(daemonState.port) : null;
  console.log(formatGateLine(gateResponse));
}

async function readLastReviewedCommit(root: string, chunkPath: string): Promise<string | null> {
  const raw = await readFile(join(root, 'papercamp', 'night.json'), 'utf-8').catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      chunks?: Array<{ path?: string; lastReviewedCommit?: string | null }>;
    };
    const chunk = parsed.chunks?.find((c) => c.path === chunkPath);
    return chunk?.lastReviewedCommit ?? null;
  } catch {
    return null;
  }
}

const SEVERITY_LABEL: Record<NightFindingSeverity, string> = {
  critical: 'critical',
  high: 'high',
  normal: 'normal',
};

function formatPassResult(result: NightChunkPassResult, written: number, dropped: number): string {
  const lines = [
    `paper-camp: reviewed "${result.chunkPath}" at ${result.reviewedCommit.slice(0, 7)} — ` +
      `${result.findings.length} confirmed finding(s), ${written} written, ${dropped} dropped as overlap, ` +
      `${result.usage.numTurns} turn(s), $${result.usage.costUsd.toFixed(2)}` +
      `${result.usage.cappedByTurns ? ' (turn-capped)' : ''}`,
  ];
  for (const finding of result.findings) {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    lines.push(`  [${SEVERITY_LABEL[finding.severity]}] ${location} — ${finding.message}`);
  }
  return lines.join('\n');
}

async function logNightReviewPasses(root: string, result: NightChunkPassResult): Promise<void> {
  const last = result.checks.at(-1);
  for (const check of result.checks) {
    const id = randomUUID();
    const planTitle = `${result.chunkPath} · ${check.check}`;
    await logTaskStart(root, {
      id,
      taskKind: 'night-review',
      planTitle,
      agentId: 'claude-code',
      startedAt: check.startedAt,
    });
    await logTaskCompletion(
      root,
      {
        id,
        taskKind: 'night-review',
        planTitle,
        agentId: 'claude-code',
        startedAt: check.startedAt,
        lines: [],
        runUsage: {
          durationMs: Date.parse(check.endedAt) - Date.parse(check.startedAt),
          numTurns: check.usage.numTurns,
          inputTokens: check.usage.inputTokens,
          outputTokens: check.usage.outputTokens,
          cacheCreationTokens: check.usage.cacheCreationTokens,
          cacheReadTokens: check.usage.cacheReadTokens,
          costUsd: check.usage.costUsd,
        },
        ...(check === last && result.rateLimit ? { rateLimit: result.rateLimit } : {}),
      },
      check.ok ? 'done' : 'error',
    );
  }
}

async function readOpenIdeaCandidates(root: string): Promise<{ title: string; body: string }[]> {
  const { entries } = await readEntitiesWithDerivedStatus(join(root, 'papercamp', 'ideas'));
  return entries
    .filter((idea) => idea.status !== 'done' && idea.status !== 'dropped')
    .map((idea) => ({ title: idea.title, body: idea.body }));
}

async function reportNightPass(
  project: Pick<MachineProject, 'slug' | 'path'>,
  result: NightChunkPassResult,
): Promise<{ written: number; dropped: number }> {
  await logNightReviewPasses(project.path, result);
  await markChunkReviewed(project.path, result.chunkPath, result.reviewedCommit);

  if (result.findings.length === 0) return { written: 0, dropped: 0 };

  const [openIdeas, earlierFindings] = await Promise.all([
    readOpenIdeaCandidates(project.path),
    readNightFindings(project.path),
  ]);
  const accepted = dropOverlappingFindings(result.findings, openIdeas, earlierFindings);
  const dropped = result.findings.length - accepted.length;
  if (accepted.length === 0) return { written: 0, dropped };

  const suggestionsPath = join(project.path, 'papercamp', 'suggestions.md');
  const raw = await readFile(suggestionsPath, 'utf-8').catch(() => '');
  const date = todayDateString();
  const entries: NightSuggestionEntry[] = accepted.map((finding: NightFinding) => ({
    date,
    check: finding.check,
    chunk: result.chunkPath,
    file: finding.file,
    line: finding.line,
    commit: result.reviewedCommit,
    severity: finding.severity,
    message: finding.message,
  }));
  await writeFile(suggestionsPath, appendNightFindings(raw, entries), 'utf-8');
  return { written: accepted.length, dropped };
}

export async function runNightPass(
  project: Pick<MachineProject, 'slug' | 'path'>,
  chunkPath: string,
): Promise<boolean> {
  const nightConfig = await readNightConfig(project.path);
  const resolved = resolveNightConfig(nightConfig);
  const checks = resolveNightChecks(nightConfig);
  if (checks.length === 0) {
    console.error('paper-camp: no checks are enabled for this project');
    return false;
  }

  const rawAgentConfig = await readFile(join(project.path, 'papercamp', 'config.json'), 'utf-8')
    .then((raw) => (JSON.parse(raw) as { defaultAgents?: { nightShift?: unknown } }).defaultAgents)
    .catch(() => undefined);
  const agentConfig = coerceAgentConfig(rawAgentConfig?.nightShift ?? DEFAULT_AGENTS.nightShift);

  const sinceCommit = await readLastReviewedCommit(project.path, chunkPath);

  console.log(
    `paper-camp: running ${checks.length} check(s) against "${chunkPath}" in "${project.slug}"…`,
  );
  try {
    const result = await runNightChunkPass({
      root: project.path,
      chunkPath,
      sinceCommit,
      checks,
      agentConfig,
      maxTurns: resolved.maxTurns,
      maxCostUsd: resolved.maxCostUsd,
    });
    const { written, dropped } = await reportNightPass(project, result);
    console.log(formatPassResult(result, written, dropped));
    return true;
  } catch (error) {
    console.error(`paper-camp: night pass failed — ${(error as Error).message}`);
    return false;
  }
}

export async function runNight(target: string | undefined, chunk?: string): Promise<boolean> {
  if (!target) {
    console.error('Usage: paper-camp night <slug> | off | status | run <chunk>');
    return false;
  }

  const path = defaultRegistryPath();
  const registry = await loadRegistry(path);

  if (target === 'status') {
    await printNightStatus(registry);
    return true;
  }

  if (target === 'run') {
    if (!chunk) {
      console.error('Usage: paper-camp night run <chunk>');
      return false;
    }
    if (!registry.night) {
      console.error('paper-camp: night shift is off — run `paper-camp night <slug>` first');
      return false;
    }
    const project = registry.projects.find((p) => p.slug === registry.night?.slug);
    if (!project) {
      console.error(
        `paper-camp: "${registry.night.slug}" is no longer registered — run \`paper-camp ls\` to see registered projects.`,
      );
      return false;
    }
    return runNightPass(project, chunk);
  }

  if (target === 'off') {
    if (!registry.night) {
      console.log('paper-camp: night shift is already off');
      return true;
    }
    await saveRegistry(path, clearNightProject(registry));
    console.log('paper-camp: night shift turned off');
    return true;
  }

  const result = setNightProject(registry, target);
  if (!result.ok) {
    console.error(
      `No registered project with slug "${target}" — run \`paper-camp ls\` to see registered projects.`,
    );
    return false;
  }
  await saveRegistry(path, result.registry);
  const project = result.registry.projects.find((p) => p.slug === target) as MachineProject;
  console.log(`paper-camp: night shift set to "${project.slug}" (${project.path})`);
  return true;
}
