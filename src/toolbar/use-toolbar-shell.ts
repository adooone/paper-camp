import { useCallback, useEffect, useRef, useState } from 'react';
import { shouldCollapse } from './toolbar-idle';

const IDLE_MS = 4000;
const TICK_MS = 1000;

export interface ToolbarShellState {
  expanded: boolean;
  activePanelId: string | null;
  onExpand: () => void;
  onSelectSegment: (id: string) => void;
}

export function useToolbarShell(idleMs = IDLE_MS): ToolbarShellState {
  const [expanded, setExpanded] = useState(true);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const lastActivityRef = useRef(Date.now());
  const activePanelRef = useRef(activePanelId);
  activePanelRef.current = activePanelId;

  const notifyActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setExpanded(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const idleSince = Date.now() - lastActivityRef.current;
      if (shouldCollapse(idleSince, idleMs, activePanelRef.current !== null)) {
        setExpanded(false);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [idleMs]);

  const onExpand = useCallback(() => notifyActivity(), [notifyActivity]);

  const onSelectSegment = useCallback(
    (id: string) => {
      notifyActivity();
      setActivePanelId((current) => (current === id ? null : id));
    },
    [notifyActivity],
  );

  return { expanded, activePanelId, onExpand, onSelectSegment };
}
