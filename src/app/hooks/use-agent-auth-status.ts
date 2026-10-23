import { agentAuthStatusQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { fetchAgentAuthStatus } from '@/app/services/system';
import type { AgentAuthStatus } from '@/types/index';
import { useQuery } from '@tanstack/react-query';

function useAgentAuthStatus(): AgentAuthStatus | null {
  const { runtimeUrl } = useRuntimeConnection();
  const { data } = useQuery({
    queryKey: agentAuthStatusQueryKey(runtimeUrl),
    queryFn: fetchAgentAuthStatus,
  });
  return data ?? null;
}

// loggedIn: null means unknown (non claude-code agent, or the probe couldn't tell) — only
// an explicit false should surface as "not signed in".
export function useAgentNotSignedIn(): boolean {
  return useAgentAuthStatus()?.loggedIn === false;
}
