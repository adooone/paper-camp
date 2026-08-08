import type { AgentId, DefaultAgentsMap, IntegrationConfig, PaperCampConfig } from '@/types/index';
import { apiUrl } from '../api-base';

export const fetchConfig = async (): Promise<PaperCampConfig | null> => {
  try {
    const response = await fetch(apiUrl('/api/config'));
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
  setupDismissed?: boolean;
  integration?: IntegrationConfig;
}): Promise<SaveConfigResult> => {
  try {
    const response = await fetch(apiUrl('/api/config'), {
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
