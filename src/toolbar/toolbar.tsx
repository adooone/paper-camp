import { useCheckStatusClient } from '@/app/hooks/use-check-status-client';
import { useFocusClient } from '@/app/hooks/use-focus-client';
import { useRunsClient } from '@/app/hooks/use-runs-client';
import { useStatusClient } from '@/app/hooks/use-status-client';
import { fetchConfig } from '@/app/services/system';
import type { ToolbarSegmentId } from '@/types/index';
import { useEffect, useState } from 'react';
import { FocusPanel } from './focus-panel';
import { RunsPanel } from './runs-panel';
import { ShipPanel } from './ship-panel';
import { ToolbarLink } from './toolbar-link';
import { type ToolbarSegment, ToolbarShell } from './toolbar-shell';
import { useToolbarShell } from './use-toolbar-shell';

const DEFAULT_ROUTE = '/__camp';

// v1/v2/v3 have all landed — Focus, Desk, Ship, Runs. 'scout' stays out until
// IDEA-130 lands.
const DEFAULT_SEGMENTS: ToolbarSegmentId[] = ['focus', 'runs', 'ship', 'desk'];

export const Toolbar = () => {
  const status = useStatusClient();
  const checkStatus = useCheckStatusClient();
  const runs = useRunsClient();
  const focusPlan = useFocusClient();
  const shell = useToolbarShell();
  const [allowedSegments, setAllowedSegments] = useState<ToolbarSegmentId[]>(DEFAULT_SEGMENTS);
  const [route, setRoute] = useState(DEFAULT_ROUTE);

  useEffect(() => {
    fetchConfig().then((config) => {
      const configured = config?.integration?.toolbar?.segments;
      if (configured) setAllowedSegments(configured);
      const configuredRoute = config?.integration?.route;
      if (configuredRoute) setRoute(configuredRoute);
    });
  }, []);

  const openDesk = () => window.open(route, '_blank', 'noopener,noreferrer');

  const shipGlance = status.gitBranch
    ? `${status.gitBranch}${status.changedFileCount > 0 ? ` (${status.changedFileCount})` : ''}`
    : 'ship';

  const openIdea = () => {
    if (!focusPlan) return;
    window.open(
      `${route}/plans/${encodeURIComponent(focusPlan.title)}`,
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

  const onRunNextPhase = () => {
    if (focusPlan?.id && nextPhaseIndex >= 0) runs.onRunNextPhase(focusPlan.id, nextPhaseIndex);
  };

  const allSegments: ToolbarSegment[] = [
    {
      id: 'focus',
      glance: focusGlance,
      panel: focusPlan ? <FocusPanel plan={focusPlan} onOpenIdea={openIdea} /> : undefined,
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
      panel: <ShipPanel {...status} {...checkStatus} onOpenSetup={openDesk} />,
    },
    {
      id: 'desk',
      glance: 'Desk',
      panel: <ToolbarLink onClick={openDesk}>Open full desk →</ToolbarLink>,
    },
  ];

  const segments = allSegments.filter((segment) =>
    allowedSegments.includes(segment.id as ToolbarSegmentId),
  );

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
