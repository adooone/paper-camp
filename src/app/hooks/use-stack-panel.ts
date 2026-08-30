import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { useAppStore } from '@/app/stores/app-store';
import { type RefObject, useEffect, useRef } from 'react';

export interface StackPanelState {
  panelRef: RefObject<HTMLElement>;
  anyChecksFailing: boolean;
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

  const consistency = useAppStore((s) => s.consistency);
  const doctor = useAppStore((s) => s.doctor);
  const agentStatus = useAppStore((s) => s.agentStatus);

  useEffect(() => {
    const {
      loadStatus,
      loadConsistency,
      loadDoctor,
      loadGitStatus,
      loadAgentStatus,
      loadArchivableIdeas,
    } = useAppStore.getState();
    loadStatus();
    loadConsistency();
    loadDoctor();
    loadGitStatus();
    loadAgentStatus();
    loadArchivableIdeas();
  }, []);

  // Catches remote changes (a PR merged on GitHub) faster than the server's own poll.
  useEffect(() => {
    const handleFocus = () => {
      useAppStore.getState().loadPlans();
      useAppStore.getState().loadGitStatus();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    // One timer per event type: an agent streaming a line per log row must not keep
    // pushing a pending check refresh out of reach.
    const timers: Record<string, ReturnType<typeof setTimeout> | undefined> = {};
    const schedule = (key: string, run: () => void, ms: number) => {
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = setTimeout(run, ms);
    };
    const unsubscribe = subscribeToActivityStream((payload) => {
      // Keeps the commit gate's consistency check warm for other pages (e.g. deliver-checks-row)
      // even while this panel — which no longer renders it — is what's mounted.
      if (payload.type === 'status') {
        schedule('status', () => useAppStore.getState().loadStatus(), 80);
        return;
      }
      // Agent progress, including the one-shot commit-suggest run.
      if (payload.type === 'agent') {
        schedule('agent', () => useAppStore.getState().loadAgentStatus(), 120);
        return;
      }
      // A file actually changed on disk: the only tick broad enough to reload everything.
      // Debounced so an agent writing several files in succession doesn't stampede all six loaders.
      if (payload.message !== 'changed') return;
      schedule(
        'activity',
        () => {
          const {
            loadPlans,
            loadSuggestions,
            loadStatus,
            loadConsistency,
            loadDoctor,
            loadGitStatus,
            loadAgentStatus,
            loadArchivableIdeas,
          } = useAppStore.getState();
          loadPlans();
          loadSuggestions();
          loadStatus();
          loadConsistency();
          loadDoctor();
          loadGitStatus();
          loadAgentStatus();
          loadArchivableIdeas();
        },
        250,
      );
    });
    return () => {
      for (const timer of Object.values(timers)) if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const { checks: deskChecks } = useDeskChecks();
  // Plan *document* consistency (orphan subjects) — a separate concern from the
  // code-consistency check, surfaced in its own "Docs" stamp.
  const hasDocIssues = consistency.length > 0;
  const anyChecksFailing =
    deskChecks.some((check) => check.status === 'fail') || hasDocIssues || doctor.errorCount > 0;
  const agentActive = agentStatus.some(
    (t) => t.status === 'running' || t.status === 'starting' || t.status === 'stopping',
  );

  return { panelRef, anyChecksFailing, agentActive };
}
