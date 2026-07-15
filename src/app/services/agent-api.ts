import type { AgentTaskState, ReconcileQueueItem } from '@/types/index';

export const fetchAgentStatus = async (): Promise<AgentTaskState | null> => {
  const response = await fetch('/api/agent/status');
  return response.json();
};

export const fetchReconcileQueue = async (): Promise<ReconcileQueueItem[] | null> => {
  const response = await fetch('/api/agent/reconcile-queue');
  return response.json();
};

export const launchAgent = async (planId: string, phaseIndex: number): Promise<void> => {
  const response = await fetch('/api/agent/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, phaseIndex }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Launch failed' }));
    throw new Error(err.error);
  }
};

export const launchPlanAudit = async (planId: string, prompt: string): Promise<void> => {
  const response = await fetch('/api/agent/launch-audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, prompt }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Launch failed' }));
    throw new Error(err.error);
  }
};

export const launchPlanReconcile = async (planId: string, prompt: string): Promise<void> => {
  const response = await fetch('/api/agent/launch-reconcile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, prompt }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Launch failed' }));
    throw new Error(err.error);
  }
};

export const launchPlanDraft = async (ideaId: string, prompt: string): Promise<void> => {
  const response = await fetch('/api/agent/launch-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ideaId, prompt }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Launch failed' }));
    throw new Error(err.error);
  }
};

export const launchIdeaExtend = async (ideaId: string, prompt: string): Promise<void> => {
  const response = await fetch('/api/agent/launch-extend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ideaId, prompt }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Launch failed' }));
    throw new Error(err.error);
  }
};

export const launchSuggestIdeas = async (prompt: string): Promise<void> => {
  const response = await fetch('/api/agent/launch-suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Launch failed' }));
    throw new Error(err.error);
  }
};

export const launchBatchReconcile = async (): Promise<void> => {
  const response = await fetch('/api/agent/launch-reconcile-all', { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Launch failed' }));
    throw new Error(err.error);
  }
};

export const launchRunAll = async (planId: string): Promise<void> => {
  const response = await fetch('/api/agent/launch-run-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Launch failed' }));
    throw new Error(err.error);
  }
};

export const launchFixReview = async (planId: string): Promise<void> => {
  const response = await fetch('/api/agent/launch-fix-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Launch failed' }));
    throw new Error(err.error);
  }
};

export const stopAgent = async (): Promise<void> => {
  const response = await fetch('/api/agent/stop', { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Stop failed' }));
    throw new Error(err.error);
  }
};
