import { RefreshButton, useRefreshAll } from '@/app/features/plans/actions/refresh-button';
import { useProjectIdentity } from '@/app/hooks';
import { useStatusBar } from '@/app/hooks/use-status-bar';
import { StatusBarCore } from './status-bar-core';

export const StatusBar = () => {
  const statusBar = useStatusBar();
  const { projectName, iconDataUri } = useProjectIdentity();
  const { refresh, refreshing } = useRefreshAll();
  const trailing = <RefreshButton withText />;
  const trailingEntry = {
    id: 'refresh',
    label: refreshing ? 'Refreshing…' : 'Refresh data',
    disabled: refreshing,
    onSelect: refresh,
  };
  return (
    <StatusBarCore
      {...statusBar}
      projectName={projectName}
      projectIconDataUri={iconDataUri}
      trailing={trailing}
      trailingEntry={trailingEntry}
    />
  );
};
