import type { AgentAuthStatus, CapabilityResult } from '@/types/index';

export const fetchCapabilities = async (): Promise<CapabilityResult[] | null> => {
  const response = await fetch('/api/capabilities');
  if (!response.ok) return null;
  const body = (await response.json()) as { capabilities: CapabilityResult[] };
  return body.capabilities;
};

export const fetchAgentAuthStatus = async (): Promise<AgentAuthStatus | null> => {
  const response = await fetch('/api/agent/auth-status');
  if (!response.ok) return null;
  return (await response.json()) as AgentAuthStatus;
};
