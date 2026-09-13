import { RefreshButton, useRefreshAll } from '@/app/features/plans/actions/refresh-button';
import { useStatusBar } from '@/app/hooks/use-status-bar';
import { StatusBarCore, statusBarOverflowCandidates } from './status-bar-core';
import { useStatusBarOverflow } from './status-bar-overflow';

export const StatusBar = () => {
  const statusBar = useStatusBar();
  const { refresh, refreshing } = useRefreshAll();
  const trailing = <RefreshButton withText />;
  const trailingEntry = {
    id: 'refresh',
    label: refreshing ? 'Refreshing…' : 'Refresh data',
    disabled: refreshing,
    onSelect: refresh,
  };
  const overflow = useStatusBarOverflow(
    statusBarOverflowCandidates({ ...statusBar, trailing, trailingEntry }),
  );
  return (
    <StatusBarCore
      {...statusBar}
      trailing={trailing}
      trailingEntry={trailingEntry}
      overflow={overflow}
    />
  );
};
