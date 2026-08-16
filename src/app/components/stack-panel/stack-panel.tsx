import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { useAppStore } from '@/app/stores/app-store';
import { Divider, IconButton, Spinner } from '@dendelion/paper-ui';
import { useEffect, useRef } from 'react';
import { AgentSection } from './agent-section';
import { DeskSection } from './desk-section';
import { HealthSection } from './health-section';

interface StackPanelProps {
  open: boolean;
  onToggle: () => void;
  // When pinned, the reopen handle and close button are both hidden.
  pinned?: boolean;
}

export const StackPanel = ({ open, onToggle, pinned = false }: StackPanelProps) => {
  const isOpen = open || pinned;
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

  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadStatus = useAppStore((s) => s.loadStatus);
  const consistency = useAppStore((s) => s.consistency);
  const loadConsistency = useAppStore((s) => s.loadConsistency);
  const doctor = useAppStore((s) => s.doctor);
  const loadDoctor = useAppStore((s) => s.loadDoctor);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const loadAgentStatus = useAppStore((s) => s.loadAgentStatus);
  const loadSuggestions = useAppStore((s) => s.loadSuggestions);
  const loadArchivableIdeas = useAppStore((s) => s.loadArchivableIdeas);
  const refreshRef = useRef({
    loadPlans,
    loadStatus,
    loadConsistency,
    loadDoctor,
    loadGitStatus,
    loadAgentStatus,
    loadSuggestions,
    loadArchivableIdeas,
  });
  useEffect(() => {
    refreshRef.current = {
      loadPlans,
      loadStatus,
      loadConsistency,
      loadDoctor,
      loadGitStatus,
      loadAgentStatus,
      loadSuggestions,
      loadArchivableIdeas,
    };
  });

  useEffect(() => {
    refreshRef.current.loadStatus();
    refreshRef.current.loadConsistency();
    refreshRef.current.loadDoctor();
    refreshRef.current.loadGitStatus();
    refreshRef.current.loadAgentStatus();
    refreshRef.current.loadArchivableIdeas();
  }, []);

  // Catches remote changes (a PR merged on GitHub) faster than the server's own poll.
  useEffect(() => {
    const handleFocus = () => {
      refreshRef.current.loadPlans();
      refreshRef.current.loadGitStatus();
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
      // Keeps the commit gate's consistency check warm for other pages (e.g. deliver-controls)
      // even while this panel — which no longer renders it — is what's mounted.
      if (payload.type === 'status') {
        schedule('status', () => refreshRef.current.loadStatus(), 80);
        return;
      }
      // Agent progress, including the one-shot commit-suggest run.
      if (payload.type === 'agent') {
        schedule('agent', () => refreshRef.current.loadAgentStatus(), 120);
        return;
      }
      // A file actually changed on disk: the only tick broad enough to reload everything.
      // Debounced so an agent writing several files in succession doesn't stampede all six loaders.
      if (payload.message !== 'changed') return;
      schedule(
        'activity',
        () => {
          refreshRef.current.loadPlans();
          refreshRef.current.loadSuggestions();
          refreshRef.current.loadStatus();
          refreshRef.current.loadConsistency();
          refreshRef.current.loadDoctor();
          refreshRef.current.loadGitStatus();
          refreshRef.current.loadAgentStatus();
          refreshRef.current.loadArchivableIdeas();
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

  return (
    <>
      {!isOpen && (
        <div
          // var() so utilities.css can nudge it toward one-handed thumb reach below the
          // phone breakpoint.
          className="fixed right-0 top-[var(--pc-stack-toggle-top,50%)] z-[300] rounded-l-md shadow-[-2px_0_8px_rgba(0,0,0,0.15)] bg-desk-bg bg-chalkboard [background-repeat:repeat,no-repeat] [background-size:200px_200px,auto]"
          style={{ transform: 'translateY(-50%)' }}
        >
          <IconButton
            icon={
              agentActive ? (
                <Spinner size="small" surface="chalkboard" label="Agent running" />
              ) : anyChecksFailing ? (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full bg-chalk-fail-text shadow-[0_0_6px_rgba(214,160,160,0.9)]"
                />
              ) : (
                <span className="text-2xs">S</span>
              )
            }
            surface="chalkboard"
            size="small"
            label={
              agentActive
                ? 'Open stack panel — agent running'
                : anyChecksFailing
                  ? 'Open stack panel — checks failing'
                  : 'Open stack panel'
            }
            onClick={onToggle}
            className={`w-7 h-[64px] rounded-l-md ${
              agentActive
                ? 'shadow-[inset_0_0_0_1px_rgba(214,196,160,0.6)]'
                : anyChecksFailing
                  ? 'shadow-[inset_0_0_0_1px_rgba(214,160,160,0.6)]'
                  : ''
            }`}
          />
        </div>
      )}
      <aside
        ref={panelRef}
        // Below the phone breakpoint the fixed 480px would overflow the viewport itself.
        // Above the Layout header (z-200) — the panel owns the full right edge.
        aria-label="Stack"
        className="fixed inset-y-0 right-0 z-[300] flex w-[min(480px,100vw)] flex-col overflow-hidden border-l-4 border-paper-950/[12%] text-desk-text bg-desk-bg bg-chalkboard [background-repeat:repeat,no-repeat] [background-size:200px_200px,auto]"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-6">
          <h2 className="m-0 font-display-luminari text-base font-bold text-desk-chalk">Stack</h2>
          {!pinned && (
            <IconButton
              icon={<span className="text-sm leading-none">&times;</span>}
              surface="chalkboard"
              size="small"
              label="Close stack panel"
              onClick={onToggle}
              className="h-7 w-7 border border-desk-border"
            />
          )}
        </div>
        <Divider surface="chalkboard" />
        <div className="flex min-h-0 flex-1 flex-col">
          <AgentSection />
          <DeskSection />
          <HealthSection />
        </div>
      </aside>
    </>
  );
};
