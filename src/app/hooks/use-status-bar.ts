import {
  selectAgentNotSignedIn,
  selectCapabilityGapCount,
  selectLatestRateLimit,
  useAppStore,
} from '@/app/stores/app-store';
import type { AgentTaskStatus } from '@/types/index';
import { useNavigate } from '@tanstack/react-router';

export interface StatusBarState {
  gitBranch: string | null;
  gitAhead: number;
  changedFileCount: number;
  agentActive: boolean;
  activeTaskStatus: AgentTaskStatus | undefined;
  agentNotSignedIn: boolean;
  capabilityGapCount: number;
  rateLimit: ReturnType<typeof selectLatestRateLimit>;
  unreadNotificationCount: number;
  onOpenSetup: () => void;
  onOpenGit: () => void;
  onOpenNotifications: () => void;
}

export function useStatusBar(): StatusBarState {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const gitStatus = useAppStore((s) => s.gitStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const capabilityGapCount = useAppStore(selectCapabilityGapCount);
  const agentNotSignedIn = useAppStore(selectAgentNotSignedIn);
  const rateLimit = useAppStore(selectLatestRateLimit);
  const unreadNotificationCount = useAppStore(
    (s) => s.notifications?.filter((n) => n.kind === 'question' || !n.read).length ?? 0,
  );
  const navigate = useNavigate();

  const activeTask = agentStatus.find(
    (t) => t.status === 'running' || t.status === 'starting' || t.status === 'stopping',
  );

  return {
    gitBranch,
    gitAhead,
    changedFileCount: gitStatus?.length ?? 0,
    agentActive: activeTask !== undefined,
    activeTaskStatus: activeTask?.status,
    agentNotSignedIn,
    capabilityGapCount,
    rateLimit,
    unreadNotificationCount,
    onOpenSetup: () => navigate({ to: '/settings/$section', params: { section: 'setup' } }),
    onOpenGit: () => navigate({ to: '/git' }),
    onOpenNotifications: () => navigate({ to: '/inbox' }),
  };
}
