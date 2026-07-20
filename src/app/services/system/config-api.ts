import type { AgentId, DefaultAgentsMap, PaperCampConfig } from '@/types/index';

export const fetchConfig = async (): Promise<PaperCampConfig | null> => {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

export interface SaveConfigResult {
  ok: boolean;
  error?: string;
}

export const saveConfig = async (updates: {
  port?: number;
  projectName?: string;
  defaultAgent?: AgentId;
  defaultAgents?: DefaultAgentsMap;
  subjects?: string[];
}): Promise<SaveConfigResult> => {
  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: body?.error };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
};
