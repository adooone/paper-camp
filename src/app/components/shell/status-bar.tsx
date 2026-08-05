import { useBranchSync } from '@/app/hooks/use-branch-sync';
import {
  selectAgentNotSignedIn,
  selectCapabilityGapCount,
  useAppStore,
} from '@/app/stores/app-store';
import { useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { StatusBarCore } from './status-bar-core';

export const StatusBar = () => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const gitStatus = useAppStore((s) => s.gitStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const gitBranchHygiene = useAppStore((s) => s.gitBranchHygiene);
  const quickCommit = useAppStore((s) => s.quickCommit);
  const commitInFlight = useAppStore((s) => s.commitInFlight);
  const capabilityGapCount = useAppStore(selectCapabilityGapCount);
  const agentNotSignedIn = useAppStore(selectAgentNotSignedIn);
  const { pushing, syncing, pulling, gitActionBusy, handlePush, handleSync, handlePull } =
    useBranchSync();
  const { toast } = useToast();
  const navigate = useNavigate();

  const activeTask = agentStatus.find(
    (t) => t.status === 'running' || t.status === 'starting' || t.status === 'stopping',
  );
  const agentActive = activeTask !== undefined;

  const changedFileCount = gitStatus?.length ?? 0;

  const handleQuickCommit = async () => {
    if (commitInFlight || changedFileCount === 0) return;
    const result = await quickCommit();
    if (result.ok) {
      toast({
        title: 'Committed',
        description: result.warning ?? result.title,
        variant: result.warning ? 'warning' : 'success',
      });
    } else {
      toast({ title: 'Commit failed', description: result.error, variant: 'error' });
    }
  };

  const handleOpenSetup = () =>
    navigate({ to: '/settings/$section', params: { section: 'setup' } });

  return (
    <StatusBarCore
      gitBranch={gitBranch}
      gitAhead={gitAhead}
      changedFileCount={changedFileCount}
      agentActive={agentActive}
      activeTaskStatus={activeTask?.status}
      agentNotSignedIn={agentNotSignedIn}
      capabilityGapCount={capabilityGapCount}
      gitBranchHygiene={gitBranchHygiene}
      commitInFlight={commitInFlight}
      gitActionBusy={gitActionBusy}
      pushing={pushing}
      syncing={syncing}
      pulling={pulling}
      onSync={handleSync}
      onPush={handlePush}
      onPull={handlePull}
      onQuickCommit={handleQuickCommit}
      onOpenSetup={handleOpenSetup}
    />
  );
};
