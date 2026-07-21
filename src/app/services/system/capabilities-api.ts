import type { CapabilityResult } from '@/types/index';

export const fetchCapabilities = async (): Promise<CapabilityResult[] | null> => {
  const response = await fetch('/api/capabilities');
  if (!response.ok) return null;
  const body = (await response.json()) as { capabilities: CapabilityResult[] };
  return body.capabilities;
};
