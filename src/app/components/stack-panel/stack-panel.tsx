import { useAppStore } from '@/app/stores/app-store';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import { Divider, IconButton, Spinner } from '@dendelion/paper-ui';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
import { AgentSection } from './agent-section';
import { CommitSection } from './commit-section';

interface StackPanelProps {
  open: boolean;
  onToggle: () => void;
  // When pinned, the reopen handle and close button are both hidden.
  pinned?: boolean;
}

export const StackPanel = ({ open, onToggle, pinned = false }: StackPanelProps) => {
  const isOpen = open || pinned;
  const loadPlans = useAppStore((s) => s.loadPlans);
  const statusData = useAppStore((s) => s.status);
  const loadStatus = useAppStore((s) => s.loadStatus);
  const consistency = useAppStore((s) => s.consistency);
  const loadConsistency = useAppStore((s) => s.loadConsistency);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const loadAgentStatus = useAppStore((s) => s.loadAgentStatus);
  const loadSuggestions = useAppStore((s) => s.loadSuggestions);
  const loadArchivableIdeas = useAppStore((s) => s.loadArchivableIdeas);
  const shouldReduceMotion = useReducedMotion();
  const refreshRef = useRef({
    loadPlans,
    loadStatus,
    loadConsistency,
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
      loadGitStatus,
      loadAgentStatus,
      loadSuggestions,
      loadArchivableIdeas,
    };
  });

  useEffect(() => {
    refreshRef.current.loadStatus();
    refreshRef.current.loadConsistency();
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
    const es = new EventSource('/api/activity/stream');
    // One timer per event type: an agent streaming a line per log row must not keep
    // pushing a pending check refresh out of reach.
    const timers: Record<string, ReturnType<typeof setTimeout> | undefined> = {};
    const schedule = (key: string, run: () => void, ms: number) => {
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = setTimeout(run, ms);
    };
    es.onmessage = (event) => {
      const payload = JSON.parse(event.data) as {
        message?: string;
        type?: string;
        taskId?: string;
      };
      // Check stamps (Quality/Tests/Consistency) live entirely off these — the
      // 'running' tick IS the loading state, so it must reach loadStatus.
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
          refreshRef.current.loadGitStatus();
          refreshRef.current.loadAgentStatus();
          refreshRef.current.loadArchivableIdeas();
        },
        250,
      );
    };
    return () => {
      for (const timer of Object.values(timers)) if (timer) clearTimeout(timer);
      es.close();
    };
  }, []);

  const { qualityStatus, testStatus, consistencyStatus } = useMemo(
    () => deriveCheckStatuses(statusData),
    [statusData],
  );
  // Plan *document* consistency (orphan subjects) — a separate concern from the
  // code-consistency check, surfaced in its own "Docs" stamp.
  const hasDocIssues = consistency.length > 0;
  const anyChecksFailing =
    qualityStatus === 'fail' ||
    testStatus === 'fail' ||
    consistencyStatus === 'fail' ||
    hasDocIssues;
  const agentActive = agentStatus.some(
    (t) => t.status === 'running' || t.status === 'starting' || t.status === 'stopping',
  );

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, x: 20 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeOut' }}
            // var() so utilities.css can nudge it toward one-handed thumb reach below the
            // phone breakpoint; transform stays inline since framer-motion owns that CSS
            // property for the x animation and would clobber a class-based translateY.
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
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.3,
          ease: [0.4, 0, 0.2, 1],
        }}
        // Below the phone breakpoint the fixed 480px would overflow the viewport itself.
        // Above the Layout header (z-200) — the panel owns the full right edge.
        className="fixed inset-y-0 right-0 z-[300] flex w-[min(480px,100vw)] flex-col overflow-hidden border-l-4 border-paper-950/[12%] text-desk-text bg-desk-bg bg-chalkboard [background-repeat:repeat,no-repeat] [background-size:200px_200px,auto]"
      >
        <div className="flex h-20 shrink-0 items-center justify-between px-6">
          <span className="font-display-luminari text-base font-bold text-desk-chalk">Stack</span>
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
          <Divider surface="chalkboard" />
          <CommitSection />
        </div>
      </motion.div>
    </>
  );
};
