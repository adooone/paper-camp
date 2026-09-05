import type {
  AgentTaskState,
  Issue,
  LoginRelayState,
  MountContext,
  PrReviewStatus,
  ReconcileQueueItem,
} from '@/types/index';
import { apiFetch, apiUrl } from './api-base';

const handleAgentResponse = async (
  response: Response,
  fallback = 'Launch failed',
): Promise<void> => {
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: fallback }));
    throw new Error(err.error);
  }
};

export const fetchAgentStatus = async (): Promise<AgentTaskState[]> => {
  const response = await apiFetch(apiUrl('/api/agent/status'));
  return response.json();
};

export const fetchReconcileQueue = async (): Promise<ReconcileQueueItem[] | null> => {
  const response = await apiFetch(apiUrl('/api/agent/reconcile-queue'));
  return response.json();
};

export const launchAgent = async (planId: string, phaseIndex: number): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/launch'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, phaseIndex }),
  });
  await handleAgentResponse(response);
};

export const launchPlanAudit = async (planId: string, prompt: string): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/launch-audit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, prompt }),
  });
  await handleAgentResponse(response);
};

export const launchPlanReconcile = async (planId: string, prompt: string): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/launch-reconcile'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, prompt }),
  });
  await handleAgentResponse(response);
};

export const launchPlanDraft = async (ideaId: string, prompt: string): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/launch-draft'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ideaId, prompt }),
  });
  await handleAgentResponse(response);
};

export const launchIdeaExtend = async (ideaId: string, prompt: string): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/launch-extend'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ideaId, prompt }),
  });
  await handleAgentResponse(response);
};

export const launchSuggestIdeas = async (prompt: string): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/launch-suggest'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  await handleAgentResponse(response);
};

export const launchBatchReconcile = async (): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/launch-reconcile-all'), { method: 'POST' });
  await handleAgentResponse(response);
};

export const launchBatchDraft = async (ids: string[]): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/launch-draft-all'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  await handleAgentResponse(response);
};

export const launchRunAll = async (planId: string): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/launch-run-all'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
  });
  await handleAgentResponse(response);
};

export const launchFixReview = async (planId: string): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/launch-fix-review'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
  });
  await handleAgentResponse(response);
};

export const launchPrReview = async (planId: string): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/launch-pr-review'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
  });
  await handleAgentResponse(response);
};

export const launchIssueFix = async (
  issueId: string,
  title: string,
  reason: string,
  output: string | undefined,
): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/issue-fix'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueId, title, reason, output }),
  });
  await handleAgentResponse(response);
};

export const promoteIssue = async (
  issue: Issue,
): Promise<{ promotedTo: string; kind: 'fix' | 'append' | 'idea' }> => {
  const response = await apiFetch(apiUrl('/api/agent/promote-issue'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Failed to promote issue (${response.status})`);
  return data;
};

export const fetchPrReviewStatus = async (planId: string): Promise<PrReviewStatus | null> => {
  try {
    const response = await fetch(
      apiUrl(`/api/agent/pr-review-status?planId=${encodeURIComponent(planId)}`),
    );
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

export const postFeedbackMessage = async (
  planId: string,
  text: string,
  context?: MountContext,
): Promise<{ error?: string; undo?: { commitSha: string } }> => {
  const response = await apiFetch(apiUrl('/api/agent/feedback-message'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, text, context }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Failed to send message');
  return data as { error?: string; undo?: { commitSha: string } };
};

export const promoteFeedbackMessage = async (
  planId: string,
  index: number,
  target: 'decision' | 'log',
  note?: string,
): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/feedback-promote'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, index, target, note }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Failed to promote message (${response.status})`);
  }
};

export const summarizeFeedbackSession = async (
  planId: string,
): Promise<{ skipped?: boolean; summary?: string }> => {
  const response = await apiFetch(apiUrl('/api/agent/feedback-summarize'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.error ?? `Failed to summarize feedback (${response.status})`);
  return data as { skipped?: boolean; summary?: string };
};

export const undoFeedbackEdit = async (
  planId: string,
  commitSha: string,
): Promise<{ error?: string }> => {
  const response = await apiFetch(apiUrl('/api/agent/feedback-undo'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, commitSha }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Failed to undo edit');
  return data as { error?: string };
};

export const stopAgent = async (taskId?: string): Promise<void> => {
  const response = await apiFetch(apiUrl('/api/agent/stop'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId }),
  });
  await handleAgentResponse(response, 'Stop failed');
};

export const startLoginRelay = async (): Promise<LoginRelayState> => {
  const response = await apiFetch(apiUrl('/api/agent/login-relay/start'), { method: 'POST' });
  return response.json();
};

export const fetchLoginRelayStatus = async (): Promise<LoginRelayState | null> => {
  const response = await apiFetch(apiUrl('/api/agent/login-relay/status'));
  return response.json();
};

export const cancelLoginRelay = async (): Promise<void> => {
  await apiFetch(apiUrl('/api/agent/login-relay/cancel'), { method: 'POST' });
};

export const submitLoginRelayCode = async (code: string): Promise<LoginRelayState> => {
  const response = await apiFetch(apiUrl('/api/agent/login-relay/code'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  await handleAgentResponse(response, 'Failed to submit sign-in code');
  return response.json();
};
