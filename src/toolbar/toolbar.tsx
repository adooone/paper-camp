import { StatusBarCore } from '@/app/components/shell/status-bar-core';
import { useChecksClient } from '@/app/hooks/use-checks-client';
import { useFocusClient } from '@/app/hooks/use-focus-client';
import { useRunsClient } from '@/app/hooks/use-runs-client';
import { useScoutClient } from '@/app/hooks/use-scout-client';
import { useStatusClient } from '@/app/hooks/use-status-client';
import { fetchConfig } from '@/app/services/system';
import type { PlanEntry, ToolbarSegmentId } from '@/types/index';
import { useEffect, useState } from 'react';
import { FocusPanel } from './focus-panel';
import { ScoutPanel } from './scout-panel';
import { ToolbarLink } from './toolbar-link';
import { type ToolbarSegment, ToolbarShell } from './toolbar-shell';
import { ToolbarPanelCard } from './toolbar-side-panel';
import { useToolbarShell } from './use-toolbar-shell';

const DEFAULT_ROUTE = '/paper-camp';

// Focus, Scout, Desk — the extension set that carries the strip (IDEA-129/133).
// Capture dissolved into a Scout card (IDEA-138 phase 5) — no standalone segment.
const DEFAULT_SEGMENTS: ToolbarSegmentId[] = ['focus', 'scout', 'desk'];

export interface ToolbarProps {
  route?: string;
}

export const Toolbar = ({ route: injectedRoute }: ToolbarProps) => {
  const status = useStatusClient();
  const checks = useChecksClient();
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

  const scoutGlance = scout.openQuestionCount > 0 ? `Scout · ${scout.openQuestionCount}` : 'Scout';

  const onRunNextPhase = () => {
    if (focusPlan?.id && nextPhaseIndex >= 0) runs.onRunNextPhase(focusPlan.id, nextPhaseIndex);
  };

  const allSegments: ToolbarSegment[] = [
    {
      id: 'focus',
      glance: focusGlance,
      pinned: true,
      panel: focusPlan ? (
        <FocusPanel
          plan={focusPlan}
          onOpenIdea={() => openIdea(focusPlan)}
          activeTask={runs.activeTask}
          stopping={runs.stopping}
          launching={runs.launching}
          canRunNextPhase={canRunNextPhase}
          onStop={runs.onStop}
          onRunNextPhase={onRunNextPhase}
        />
      ) : undefined,
    },
    {
      id: 'scout',
      glance: scoutGlance,
      pinned: true,
      panel: (
        <ScoutPanel
          focusPlan={focusPlan}
          openQuestions={scout.openQuestions}
          status={status}
          checks={checks}
          onOpenIdea={openIdea}
          onOpenDesk={handleOpenDesk}
          onRefresh={scout.refresh}
        />
      ),
    },
    {
      id: 'desk',
      glance: 'Desk',
      panel: (
        <ToolbarPanelCard>
          <ToolbarLink onClick={handleOpenDesk}>Open full desk →</ToolbarLink>
        </ToolbarPanelCard>
      ),
    },
  ];

  const segments = allSegments.filter((segment) =>
    allowedSegments.includes(segment.id as ToolbarSegmentId),
  );

  return (
    <ToolbarShell
      renderStatusBar={(trailing) => (
        <StatusBarCore {...status} onOpenSetup={handleOpenDesk} trailing={trailing} />
      )}
      segments={segments}
      activePanelId={shell.activePanelId}
      onSelectSegment={shell.onSelectSegment}
    />
  );
};
