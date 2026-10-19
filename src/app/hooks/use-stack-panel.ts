import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { refreshPlans } from '@/app/services/query-client';
import { useAppStore } from '@/app/stores/app-store';
import { type RefObject, useEffect, useRef } from 'react';

export interface StackPanelState {
  panelRef: RefObject<HTMLElement>;
  agentActive: boolean;
}

export function useStackPanel(
  isOpen: boolean,
  pinned: boolean,
  onToggle: () => void,
): StackPanelState {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (panelRef.current) panelRef.current.inert = !isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || pinned) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggle();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pinned, onToggle]);

  const agentStatus = useAppStore((s) => s.agentStatus);

  useEffect(() => {
    const {
      loadStatus,
      loadConsistency,
      loadDoctor,
      loadGitStatus,
      loadAgentStatus,
      loadArchivableIdeas,
      loadTaskLog,
    } = useAppStore.getState();
    loadStatus();
    loadConsistency();
    loadDoctor();
    loadGitStatus();
    loadAgentStatus();
    loadArchivableIdeas();
    loadTaskLog();
  }, []);

  // Catches remote changes (a PR merged on GitHub) faster than the server's own poll.
  useEffect(() => {
    const handleFocus = () => {
      refreshPlans();
      useAppStore.getState().loadGitStatus();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToActivityStream((payload) => {
      // Agent progress, including the one-shot commit-suggest run.
      if (payload.type !== 'agent') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => useAppStore.getState().loadAgentStatus(), 120);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const agentActive = agentStatus.some(
    (t) => t.status === 'running' || t.status === 'starting' || t.status === 'stopping',
  );

  return { panelRef, agentActive };
}
