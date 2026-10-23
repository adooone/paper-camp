import { capabilitiesQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { fetchCapabilitiesPayload } from '@/app/services/system';
import type { CapabilityResult } from '@/types/index';
import { useQuery } from '@tanstack/react-query';

export interface UseCapabilitiesResult {
  capabilities: CapabilityResult[];
  runtimeVersion: string | null;
}

export function useCapabilities(): UseCapabilitiesResult {
  const { runtimeUrl } = useRuntimeConnection();
  const { data } = useQuery({
    queryKey: capabilitiesQueryKey(runtimeUrl),
    queryFn: fetchCapabilitiesPayload,
  });
  return { capabilities: data?.capabilities ?? [], runtimeVersion: data?.version ?? null };
}

// Capabilities haven't loaded yet: don't block launches on an unknown state.
function hasAnyAgent(capabilities: CapabilityResult[]): boolean {
  return (
    capabilities.length === 0 ||
    capabilities.some((c) => c.id.startsWith('agent:') && c.status === 'ok')
  );
}

function ghOk(capabilities: CapabilityResult[]): boolean {
  const gh = capabilities.find((c) => c.id === 'gh');
  return gh === undefined || gh.status === 'ok';
}

function capabilityGapCount(capabilities: CapabilityResult[]): number {
  return capabilities.filter((c) => c.status !== 'ok').length;
}

export function useHasAnyAgent(): boolean {
  const { capabilities } = useCapabilities();
  return hasAnyAgent(capabilities);
}

export function useGhOk(): boolean {
  const { capabilities } = useCapabilities();
  return ghOk(capabilities);
}

export function useCapabilityGapCount(): number {
  const { capabilities } = useCapabilities();
  return capabilityGapCount(capabilities);
}
