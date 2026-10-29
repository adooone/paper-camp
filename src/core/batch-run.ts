import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { CheckName, RateLimitSnapshot } from '../types/index';
import { localFile } from './local-paths';

export interface BatchRunRules {
  /** Add a run-order idea unblocked mid-batch by the one that just finished. */
  pickupUnblocked: boolean;
  /** Percent utilisation; defaults to the night settings' value when unset. */
  ceiling?: number;
  floor?: number;
  onCeiling: 'wait' | 'stop';
  /** Epoch ms — stop before starting the next idea once past this. */
  stopAtMs?: number;
  maxIdeas?: number;
  maxCostUsd?: number;
  /** Cut `idea/IDEA-N` from freshly fetched main for each idea instead of committing
   * straight to main — for a project that ships through PRs (IDEA-321). */
  branchPerIdea?: boolean;
}

export const DEFAULT_BATCH_RUN_RULES: BatchRunRules = {
  pickupUnblocked: true,
  onCeiling: 'wait',
};

export type BatchRunItemOutcome =
  | 'queued'
  | 'running'
  | 'review'
  | 'needs-you'
  | 'needs-human'
  | 'failed-clean'
  | 'failed-dirty'
  | 'red-checks'
  | 'auth'
  | 'conflict'
  | 'skipped'
  | 'stopped';

export interface BatchRunItem {
  id: string;
  title: string;
  outcome: BatchRunItemOutcome;
  reason?: string;
  /** The per-idea run-all task id, once it has started. */
  taskId?: string;
}

export type BatchRunPauseReason =
  | { kind: 'capacity-ceiling'; resetsAt?: number }
  | { kind: 'capacity-floor' }
  | { kind: 'failed-dirty'; id: string }
  | { kind: 'red-checks'; id: string }
  | { kind: 'auth'; id: string }
  | { kind: 'conflict'; id: string; conflictPrompt: string };

export type BatchRunStatus = 'running' | 'paused' | 'done' | 'interrupted';

export interface BatchRunState {
  taskId: string;
  startedAt: string;
  updatedAt: string;
  rules: BatchRunRules;
  /** Checks already red when the batch started — fixed for every idea in the run,
   * rather than each idea recomputing its own baseline (IDEA-321). */
  toleratedRed: CheckName[];
  /** The ids ticked when the batch was started, in run order. */
  initialIds: string[];
  items: BatchRunItem[];
  ideasRun: number;
  costUsd: number;
  status: BatchRunStatus;
  pause?: BatchRunPauseReason;
}

function batchStatePath(root: string): string {
  return localFile(root, 'batch.json');
}

/** Best-effort, like the other `.local` caches: a write failure must not fail the
 * batch run that triggered it — worst case a restart loses the latest snapshot. */
export async function writeBatchRunState(root: string, state: BatchRunState): Promise<void> {
  const path = batchStatePath(root);
  try {
    await mkdir(dirname(path), { recursive: true });
    const tmpPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
    await rename(tmpPath, path);
  } catch (err) {
    console.error(`papercamp: could not persist batch run state for ${root}:`, err);
  }
}

export async function readBatchRunState(root: string): Promise<BatchRunState | null> {
  const raw = await readFile(batchStatePath(root), 'utf-8').catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BatchRunState;
  } catch {
    return null;
  }
}

export async function clearBatchRunState(root: string): Promise<void> {
  await rm(batchStatePath(root), { force: true });
}

/** A daemon restart mid-batch leaves nothing in memory to finish the run, so the
 * persisted state is marked `interrupted` — distinct from `paused`, which the batch
 * itself chose — and the app offers *Resume* either way (IDEA-321). */
export async function markBatchRunInterrupted(root: string): Promise<boolean> {
  const state = await readBatchRunState(root);
  if (!state || state.status !== 'running') return false;
  await writeBatchRunState(root, {
    ...state,
    status: 'interrupted',
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export type CapacityGateResult =
  | { open: true }
  | { open: false; reason: 'ceiling'; resetsAt?: number }
  | { open: false; reason: 'floor' };

/** The night gate (`evaluateNightGate`), slimmed to the two rate-limit checks the
 * batch cares about — no dashboard-idle or time-window reason, since the user
 * started this themselves (IDEA-321). */
export function evaluateBatchCapacityGate(input: {
  snapshot: RateLimitSnapshot | null;
  ceiling: number;
  floor: number;
}): CapacityGateResult {
  const fiveHour = input.snapshot?.unifiedWindows?.five_hour;
  const sevenDay = input.snapshot?.unifiedWindows?.seven_day;
  if (sevenDay && sevenDay.utilization * 100 > input.floor) {
    return { open: false, reason: 'floor' };
  }
  if (fiveHour && fiveHour.utilization * 100 > input.ceiling) {
    return { open: false, reason: 'ceiling', resetsAt: fiveHour.resetsAt };
  }
  return { open: true };
}

export type BudgetStopResult =
  | { stop: false }
  | { stop: true; reason: 'clock' | 'max-ideas' | 'max-cost' };

/** The clock/count/cost limits set in the batch sheet — checked before starting the
 * next idea, so a limit crossed mid-idea still lets that idea finish. */
export function evaluateBatchBudget(input: {
  now: number;
  stopAtMs?: number;
  ideasRun: number;
  maxIdeas?: number;
  costUsd: number;
  maxCostUsd?: number;
}): BudgetStopResult {
  if (input.stopAtMs !== undefined && input.now >= input.stopAtMs) {
    return { stop: true, reason: 'clock' };
  }
  if (input.maxIdeas !== undefined && input.ideasRun >= input.maxIdeas) {
    return { stop: true, reason: 'max-ideas' };
  }
  if (input.maxCostUsd !== undefined && input.costUsd >= input.maxCostUsd) {
    return { stop: true, reason: 'max-cost' };
  }
  return { stop: false };
}
