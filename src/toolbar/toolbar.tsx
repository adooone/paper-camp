import { StatusBarCore } from '@/app/components/shell/status-bar-core';
import { useCheckStatusClient } from '@/app/hooks/use-check-status-client';
import { useFocusClient } from '@/app/hooks/use-focus-client';
import { useRunsClient } from '@/app/hooks/use-runs-client';
import { useScoutClient } from '@/app/hooks/use-scout-client';
import { useStatusClient } from '@/app/hooks/use-status-client';
import { fetchConfig } from '@/app/services/system';
import type { PlanEntry, ToolbarSegmentId } from '@/types/index';
import { useEffect, useState } from 'react';
import { FocusPanel } from './focus-panel';
import { RunsPanel } from './runs-panel';
import { ScoutPanel } from './scout-panel';
import { ShipPanel } from './ship-panel';
import { ToolbarLink } from './toolbar-link';
import { type ToolbarSegment, ToolbarShell } from './toolbar-shell';
import { useToolbarShell } from './use-toolbar-shell';

const DEFAULT_ROUTE = '/__camp';

// v1/v2/v3/Scout have all landed — Focus, Scout, Desk, Ship, Runs.
const DEFAULT_SEGMENTS: ToolbarSegmentId[] = ['focus', 'scout', 'runs', 'ship', 'desk'];

export interface ToolbarProps {
  route?: string;
}

export const Toolbar = ({ route: injectedRoute }: ToolbarProps) => {
  const status = useStatusClient();
  const checkStatus = useCheckStatusClient();
  const runs = useRunsClient();
  const focusPlan = useFocusClient();
  const scout = useScoutClient();
  const shell = useToolbarShell();
  const [allowedSegments, setAllowedSegments] = useState<ToolbarSegmentId[]>(DEFAULT_SEGMENTS);
  const [route, setRoute] = useState(injectedRoute ?? DEFAULT_ROUTE);

  useEffect(() => {
    fetchConfig().then((config) => {
      const configured = config?.integration?.toolbar?.segments;
      if (configured) setAllowedSegments(configured);
      const configuredRoute = config?.integration?.route;
      if (configuredRoute) setRoute(configuredRoute);
    });
  }, []);

  const handleOpenDesk = () => window.open(`${route}/`, '_blank', 'noopener,noreferrer');

  const shipGlance = status.gitBranch
    ? `${status.gitBranch}${status.changedFileCount > 0 ? ` (${status.changedFileCount})` : ''}`
    : 'ship';

  const openIdea = (plan: PlanEntry) => {
    window.open(
      `${route}/plans/${encodeURIComponent(plan.title)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const focusGlance = focusPlan
    ? `${focusPlan.id ?? focusPlan.title} · ${focusPlan.phases.filter((p) => p.done).length}/${focusPlan.phases.length}`
    : 'no active plan';

  const nextPhaseIndex = focusPlan?.phases.findIndex((phase) => !phase.done) ?? -1;
  const canRunNextPhase = Boolean(focusPlan?.id) && nextPhaseIndex >= 0;

  const runsGlance = runs.activeTask ? `${runs.activeTask.taskKind}…` : 'runs';

  const scoutGlance = scout.openQuestionCount > 0 ? `Scout · ${scout.openQuestionCount}` : 'Scout';

  const onRunNextPhase = () => {
    if (focusPlan?.id && nextPhaseIndex >= 0) runs.onRunNextPhase(focusPlan.id, nextPhaseIndex);
  };

  const allSegments: ToolbarSegment[] = [
    {
      id: 'focus',
      glance: focusGlance,
      panel: focusPlan ? (
        <FocusPanel plan={focusPlan} onOpenIdea={() => openIdea(focusPlan)} />
      ) : undefined,
    },
    {
      id: 'scout',
      glance: scoutGlance,
      panel: (
        <ScoutPanel
          focusPlan={focusPlan}
          openQuestions={scout.openQuestions}
          onOpenIdea={openIdea}
          onRefresh={scout.refresh}
        />
      ),
    },
    {
      id: 'runs',
      glance: runsGlance,
      panel: (
        <RunsPanel
          activeTask={runs.activeTask}
          recentTasks={runs.recentTasks}
          stopping={runs.stopping}
          launching={runs.launching}
          canRunNextPhase={canRunNextPhase}
          onStop={runs.onStop}
          onRunNextPhase={onRunNextPhase}
        />
      ),
    },
    {
      id: 'ship',
      glance: shipGlance,
      panel: <ShipPanel {...status} {...checkStatus} onOpenSetup={handleOpenDesk} />,
    },
    {
      id: 'desk',
      glance: 'Desk',
      panel: <ToolbarLink onClick={handleOpenDesk}>Open full desk →</ToolbarLink>,
    },
  ];

  const segments = allSegments.filter((segment) =>
    allowedSegments.includes(segment.id as ToolbarSegmentId),
  );

  return (
    <ToolbarShell
      statusBar={<StatusBarCore {...status} onOpenSetup={handleOpenDesk} />}
      segments={segments}
      activePanelId={shell.activePanelId}
      onSelectSegment={shell.onSelectSegment}
    />
  );
};
