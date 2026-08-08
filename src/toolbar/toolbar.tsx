import { useChecksClient } from '@/app/hooks/use-checks-client';
import { useFocusClient } from '@/app/hooks/use-focus-client';
import { useScoutClient } from '@/app/hooks/use-scout-client';
import { useStatusClient } from '@/app/hooks/use-status-client';
import { fetchConfig } from '@/app/services/system';
import type { PlanEntry } from '@/types/index';
import { useEffect, useState } from 'react';
import { IslandCard } from './island/island-card';
import { IslandTrigger } from './island/island-trigger';
import { ScoutPanel } from './scout-panel';
import { ToolbarSidePanel } from './toolbar-side-panel';
import { useToolbarShell } from './use-toolbar-shell';

const DEFAULT_ROUTE = '/paper-camp';

export interface ToolbarProps {
  route?: string;
}

export const Toolbar = ({ route: injectedRoute }: ToolbarProps) => {
  const status = useStatusClient();
  const checks = useChecksClient();
  const focusPlan = useFocusClient();
  const scout = useScoutClient();
  const shell = useToolbarShell();
  const [route, setRoute] = useState(injectedRoute ?? DEFAULT_ROUTE);

  useEffect(() => {
    fetchConfig().then((config) => {
      const configuredRoute = config?.integration?.route;
      if (configuredRoute) setRoute(configuredRoute);
    });
  }, []);

  const openIdea = (plan: PlanEntry) => {
    window.open(
      `${route}/plans/${encodeURIComponent(plan.title)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const scoutGlance = scout.openQuestionCount > 0 ? `Scout · ${scout.openQuestionCount}` : 'Scout';
  const toggleChat = () => shell.onSelectSegment('scout');

  return (
    <>
      <ToolbarSidePanel
        open={shell.activePanelId === 'scout'}
        title={scoutGlance}
        onClose={toggleChat}
      >
        <ScoutPanel
          focusPlan={focusPlan}
          openQuestions={scout.openQuestions}
          onOpenIdea={openIdea}
          onRefresh={scout.refresh}
        />
      </ToolbarSidePanel>
      <IslandTrigger>
        <IslandCard
          status={status}
          checks={checks}
          focusPlan={focusPlan}
          onOpenStack={toggleChat}
        />
      </IslandTrigger>
    </>
  );
};
