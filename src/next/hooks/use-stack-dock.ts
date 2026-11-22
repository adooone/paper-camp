import { useState } from 'react';
import { useMediaQuery } from '@/app/hooks/use-media-query';
import { STACK_DOCK_QUERY } from '../shell/screens';

export interface StackDockState {
  docked: boolean;
  open: boolean;
  show: () => void;
  hide: () => void;
}

export function useStackDock(): StackDockState {
  const docked = useMediaQuery(STACK_DOCK_QUERY);
  const [overlayOpen, setOverlayOpen] = useState(false);
  return {
    docked,
    open: docked || overlayOpen,
    show: () => setOverlayOpen(true),
    hide: () => setOverlayOpen(false),
  };
}
