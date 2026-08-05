import { StatusBarCore } from '@/app/components/shell/status-bar-core';
import { useFocusClient } from '@/app/hooks/use-focus-client';
import { useStatusClient } from '@/app/hooks/use-status-client';
import { fetchConfig } from '@/app/services/system';
import type { ToolbarSegmentId } from '@/types/index';
import { useEffect, useState } from 'react';
import { FocusPanel } from './focus-panel';
import { ToolbarLink } from './toolbar-link';
import { type ToolbarSegment, ToolbarShell } from './toolbar-shell';
import { useToolbarShell } from './use-toolbar-shell';

const CAMP_ROUTE = '/__camp';

// v1 ships read-only + links only; 'ship' (write actions) and the unbuilt
// 'scout'/'runs' join the default set as their phases land (v2/v3).
const DEFAULT_SEGMENTS: ToolbarSegmentId[] = ['focus', 'desk'];

const openDesk = () => window.open(CAMP_ROUTE, '_blank', 'noopener,noreferrer');

export const Toolbar = () => {
  const status = useStatusClient();
  const focusPlan = useFocusClient();
  const shell = useToolbarShell();
  const [allowedSegments, setAllowedSegments] = useState<ToolbarSegmentId[]>(DEFAULT_SEGMENTS);

  useEffect(() => {
    fetchConfig().then((config) => {
      const configured = config?.integration?.toolbar?.segments;
      if (configured) setAllowedSegments(configured);
    });
  }, []);

  const shipGlance = status.gitBranch
    ? `${status.gitBranch}${status.changedFileCount > 0 ? ` (${status.changedFileCount})` : ''}`
    : 'ship';

  const openIdea = () => {
    if (!focusPlan) return;
    window.open(
      `${CAMP_ROUTE}/plans/${encodeURIComponent(focusPlan.title)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const focusGlance = focusPlan
    ? `${focusPlan.id ?? focusPlan.title} · ${focusPlan.phases.filter((p) => p.done).length}/${focusPlan.phases.length}`
    : 'no active plan';

  const allSegments: ToolbarSegment[] = [
    {
      id: 'focus',
      glance: focusGlance,
      panel: focusPlan ? <FocusPanel plan={focusPlan} onOpenIdea={openIdea} /> : undefined,
    },
    {
      id: 'ship',
      glance: shipGlance,
      panel: <StatusBarCore {...status} onOpenSetup={openDesk} />,
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
