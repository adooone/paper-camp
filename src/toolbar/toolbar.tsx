import { useFocusClient } from '@/app/hooks/use-focus-client';
import { useScoutClient } from '@/app/hooks/use-scout-client';
import { useStatusClient } from '@/app/hooks/use-status-client';
import { fetchConfig } from '@/app/services/system';
import { useEffect, useState } from 'react';
import { ScoutCard } from './scout/scout-card';
import { ScoutTrigger } from './scout/scout-trigger';

const DEFAULT_ROUTE = '/paper-camp';

export interface ToolbarProps {
  route?: string;
}

export const Toolbar = ({ route: injectedRoute }: ToolbarProps) => {
  const status = useStatusClient();
  const focusPlan = useFocusClient();
  const scout = useScoutClient();
  const [route, setRoute] = useState(injectedRoute ?? DEFAULT_ROUTE);

  useEffect(() => {
    fetchConfig().then((config) => {
      const configuredRoute = config?.integration?.route;
      if (configuredRoute) setRoute(configuredRoute);
    });
  }, []);

  const deskUrl = focusPlan ? `${route}/plans/${encodeURIComponent(focusPlan.title)}` : route;

  return (
    <ScoutTrigger>
      <ScoutCard
        status={status}
        focusPlan={focusPlan}
        openQuestions={scout.openQuestions}
        onRefreshScout={scout.refresh}
        deskUrl={deskUrl}
      />
    </ScoutTrigger>
  );
};
