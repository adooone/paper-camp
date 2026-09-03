import { RefreshButton } from '@/app/features/plans/actions/refresh-button';
import { useStatusBar } from '@/app/hooks/use-status-bar';
import { StatusBarCore } from './status-bar-core';

export const StatusBar = () => {
  const statusBar = useStatusBar();
  return <StatusBarCore {...statusBar} trailing={<RefreshButton withText />} />;
};
