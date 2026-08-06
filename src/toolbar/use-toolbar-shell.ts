import { useCallback, useState } from 'react';

export interface ToolbarShellState {
  activePanelId: string | null;
  onSelectSegment: (id: string) => void;
}

export function useToolbarShell(): ToolbarShellState {
  const [activePanelId, setActivePanelId] = useState<string | null>(null);

  const onSelectSegment = useCallback((id: string) => {
    setActivePanelId((current) => (current === id ? null : id));
  }, []);

  return { activePanelId, onSelectSegment };
}
