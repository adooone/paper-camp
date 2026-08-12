import {
  selectAgentNotSignedIn,
  selectCapabilityGapCount,
  selectLatestRateLimit,
  useAppStore,
} from '@/app/stores/app-store';
import { useNavigate } from '@tanstack/react-router';
import { StatusBarCore } from './status-bar-core';

export const StatusBar = () => {
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
  const agentActive = activeTask !== undefined;

  const changedFileCount = gitStatus?.length ?? 0;

  const handleOpenSetup = () =>
    navigate({ to: '/settings/$section', params: { section: 'setup' } });

  const handleOpenGit = () => navigate({ to: '/git' });

  const handleOpenNotifications = () => navigate({ to: '/inbox' });

  return (
    <StatusBarCore
      gitBranch={gitBranch}
      gitAhead={gitAhead}
      changedFileCount={changedFileCount}
      agentActive={agentActive}
      activeTaskStatus={activeTask?.status}
      agentNotSignedIn={agentNotSignedIn}
      capabilityGapCount={capabilityGapCount}
      rateLimit={rateLimit}
      unreadNotificationCount={unreadNotificationCount}
      onOpenSetup={handleOpenSetup}
      onOpenGit={handleOpenGit}
      onOpenNotifications={handleOpenNotifications}
    />
  );
};
