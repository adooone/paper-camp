import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, layout, space } from '@/app/styles/tokens';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import { Divider, IconButton, Spinner } from '@dendelion/paper-ui';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
import { AgentSection } from './agent-section';
import { CommitSection } from './commit-section';
import {
  CHALKBOARD_TEXTURE,
  chalkStatusText,
  deskBg,
  deskBorder,
  deskChalk,
  deskLight,
  deskText,
} from './shared';
import { StatusSection } from './status-section';

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
  const shouldReduceMotion = useReducedMotion();
  const refreshRef = useRef({
    loadPlans,
    loadStatus,
    loadConsistency,
    loadGitStatus,
    loadAgentStatus,
    loadSuggestions,
  });
  useEffect(() => {
    refreshRef.current = {
      loadPlans,
      loadStatus,
      loadConsistency,
      loadGitStatus,
      loadAgentStatus,
      loadSuggestions,
    };
  });

  useEffect(() => {
    refreshRef.current.loadStatus();
    refreshRef.current.loadConsistency();
    refreshRef.current.loadGitStatus();
    refreshRef.current.loadAgentStatus();
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
  // Plan/decision *document* consistency (dangling refs, blocked plans) — a separate
  // concern from the code-consistency check, surfaced in its own "Docs" stamp.
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
            style={{
              position: 'fixed',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 300, // above the Layout header's z-200
              borderRadius: '6px 0 0 6px',
              background: deskBg,
              backgroundImage: `${CHALKBOARD_TEXTURE}, linear-gradient(135deg, ${deskLight} 0%, ${deskBg} 60%)`,
              backgroundRepeat: 'repeat, no-repeat',
              backgroundSize: '200px 200px, auto',
              boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
            }}
          >
            <IconButton
              icon={
                agentActive ? (
                  <Spinner size="small" surface="chalkboard" label="Agent running" />
                ) : anyChecksFailing ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: chalkStatusText.fail,
                      boxShadow: '0 0 6px rgba(214, 160, 160, 0.9)',
                    }}
                  />
                ) : (
                  <span style={{ fontSize: fontSize['2xs'] }}>S</span>
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
              style={{
                width: 28,
                height: 64,
                borderRadius: '6px 0 0 6px',
                boxShadow: agentActive
                  ? 'inset 0 0 0 1px rgba(214, 196, 160, 0.6)'
                  : anyChecksFailing
                    ? 'inset 0 0 0 1px rgba(214, 160, 160, 0.6)'
                    : undefined,
              }}
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
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: layout.stackPanelWidth,
          borderLeft: '4px solid rgba(61, 53, 43, 0.12)',
          backgroundColor: deskBg,
          backgroundImage: `${CHALKBOARD_TEXTURE}, linear-gradient(135deg, ${deskLight} 0%, ${deskBg} 60%)`,
          backgroundRepeat: 'repeat, no-repeat',
          backgroundSize: '200px 200px, auto',
          color: deskText,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          // Above the Layout header (z-200) — the panel owns the full right edge.
          zIndex: 300,
        }}
      >
        <div
          style={{
            height: 80,
            padding: `0 ${space[6]}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: fontFamily.serif,
              fontSize: fontSize.base,
              fontWeight: 700,
              color: deskChalk,
            }}
          >
            Stack
          </span>
          {!pinned && (
            <IconButton
              icon={<span style={{ fontSize: fontSize.sm, lineHeight: 1 }}>&times;</span>}
              surface="chalkboard"
              size="small"
              label="Close stack panel"
              onClick={onToggle}
              style={{ width: 28, height: 28, border: `1px solid ${deskBorder}` }}
            />
          )}
        </div>
        <Divider surface="chalkboard" />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: fontFamily.body,
          }}
        >
          <AgentSection />
          <Divider surface="chalkboard" />
          <StatusSection />
          <CommitSection />
        </div>
      </motion.div>
    </>
  );
};
