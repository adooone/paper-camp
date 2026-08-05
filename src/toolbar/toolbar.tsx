import { StatusBarCore } from '@/app/components/shell/status-bar-core';
import { useStatusClient } from '@/app/hooks/use-status-client';
import { type ToolbarSegment, ToolbarShell } from './toolbar-shell';
import { useToolbarShell } from './use-toolbar-shell';

const CAMP_ROUTE = '/__camp';

const openDesk = () => window.open(CAMP_ROUTE, '_blank', 'noopener,noreferrer');

export const Toolbar = () => {
  const status = useStatusClient();
  const shell = useToolbarShell();

  const shipGlance = status.gitBranch
    ? `${status.gitBranch}${status.changedFileCount > 0 ? ` (${status.changedFileCount})` : ''}`
    : 'ship';

  const segments: ToolbarSegment[] = [
    {
      id: 'ship',
      glance: shipGlance,
      panel: <StatusBarCore {...status} onOpenSetup={openDesk} />,
    },
  ];

  return (
    <ToolbarShell
      segments={segments}
      expanded={shell.expanded}
      activePanelId={shell.activePanelId}
      onExpand={shell.onExpand}
      onSelectSegment={shell.onSelectSegment}
    />
  );
};
