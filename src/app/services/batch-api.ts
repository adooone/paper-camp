import type { BatchReadiness } from '@/core/batch-readiness';
import type { BatchRunRules, BatchRunState } from '@/core/batch-run';
import type { AgentTaskState } from '@/types/index';
import { apiFetch, apiUrl } from './api-base';

export interface BatchPreviewItem {
  id: string;
  title: string;
  readiness: BatchReadiness;
  phaseCount: number;
  costEstimateUsd: number | null;
}

export interface BatchPreview {
  order: BatchPreviewItem[];
  readyCount: number;
  costEstimate: { perPhaseUsd: number | null };
  capacity: unknown;
  git: {
    level: 'clean' | 'behind' | 'diverged' | 'dirty';
    behind: number;
    diverged: boolean;
    dirty: boolean;
  };
}

export interface BatchStatus {
  batch: BatchRunState | null;
  task: AgentTaskState | null;
  ideaTask: AgentTaskState | null;
}

const handleBatchResponse = async (response: Response, fallback: string): Promise<void> => {
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: fallback }));
    throw new Error(err.error ?? fallback);
  }
};

export const fetchBatchPreview = async (): Promise<BatchPreview> => {
  const response = await apiFetch(apiUrl('/api/batch/preview'));
  return response.json();
};

export const fetchBatchStatus = async (): Promise<BatchStatus> => {
  const response = await apiFetch(apiUrl('/api/batch/status'));
  return response.json();
};

export const startBatchRun = async (
  ids: string[],
  rules?: Partial<BatchRunRules>,
): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/batch/start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, rules }),
  });
  await handleBatchResponse(response, 'Failed to start the queue');
};

export const controlBatchRun = async (
  action: 'stop' | 'stop-after-phase' | 'stop-after-idea' | 'skip',
): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/batch/control'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  await handleBatchResponse(response, 'Failed to control the queue');
};

export const resumeBatchRun = async (): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/batch/resume'), { method: 'POST' });
  await handleBatchResponse(response, 'Failed to resume the queue');
};

export const endBatchRun = async (): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/batch/end'), { method: 'POST' });
  await handleBatchResponse(response, 'Failed to end the queue');
};
