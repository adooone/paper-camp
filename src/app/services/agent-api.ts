import type { AgentTaskState } from '@/types/index';

export const fetchAgentStatus = async (): Promise<AgentTaskState | null> => {
  const response = await fetch('/api/agent/status');
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

export const resumeAgent = async (message: string): Promise<void> => {
  const response = await fetch('/api/agent/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Resume failed' }));
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
