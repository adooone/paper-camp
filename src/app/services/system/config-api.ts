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

export const saveConfig = async (updates: {
  port?: number;
  projectName?: string;
  defaultAgent?: AgentId;
  defaultAgents?: DefaultAgentsMap;
  subjects?: string[];
}): Promise<boolean> => {
  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return response.ok;
  } catch {
    return false;
  }
};
