import { color, fontFamily, fontSize, layout, lineHeight, space } from '@/app/styles/tokens';
import {
  AGENT_LABELS,
  type AgentTaskStatus,
  type CheckName,
  type CheckStatus,
} from '@/types/index';
import {
  Accordion,
  Alert,
  Button,
  Card,
  CodeBlock,
  IconButton,
  Input,
  Stamp,
  Textarea,
} from '@dendelion/paper-ui';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findFocusPlan } from '../features/plans/helpers';
import { commitChanges } from '../services/git-api';
import { useAppStore } from '../stores/app-store';

const CHALKBOARD_TEXTURE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.15 0 0 0 0 0.28 0 0 0 0 0.20 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)' opacity='1'/%3E%3C/svg%3E")`;

const deskBg = color.deskBg;
const deskLight = color.deskLight;
const deskText = color.deskText;
const deskTextMuted = color.deskTextMuted;
const deskBorder = color.deskBorder;
const deskChalk = color.deskChalk;

interface StackPanelProps {
  open: boolean;
  onToggle: () => void;
}

interface SseEvent {
  message: string;
  timestamp: string;
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: fontFamily.serif,
  fontSize: fontSize.base,
  fontWeight: 600,
  color: deskTextMuted,
  marginBottom: space[3],
};

export const StackPanel = ({ open, onToggle }: StackPanelProps) => {
  const plans = useAppStore((s) => s.plans);
  const loadProgress = useAppStore((s) => s.loadProgress);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const statusData = useAppStore((s) => s.status);
  const loadStatus = useAppStore((s) => s.loadStatus);
  const runTests = useAppStore((s) => s.runTests);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const gitStatus = useAppStore((s) => s.gitStatus);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const loadAgentStatus = useAppStore((s) => s.loadAgentStatus);
  const stopAgentTask = useAppStore((s) => s.stopAgent);
  const resumeAgentTask = useAppStore((s) => s.resumeAgent);
  const [steeringMessage, setSteeringMessage] = useState('');
  const [steering, setSteering] = useState(false);
  const [liveEvents, setLiveEvents] = useState<SseEvent[]>([]);
  const [expandedFail, setExpandedFail] = useState<CheckName | null>(null);
  const [commitExpanded, setCommitExpanded] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [commitTitle, setCommitTitle] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [addRefs, setAddRefs] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const refreshRef = useRef({
    loadProgress,
    loadPlans,
    loadStatus,
    loadGitStatus,
    loadAgentStatus,
  });
  refreshRef.current = { loadProgress, loadPlans, loadStatus, loadGitStatus, loadAgentStatus };

  useEffect(() => {
    refreshRef.current.loadProgress();
    refreshRef.current.loadStatus();
    refreshRef.current.loadGitStatus();
    refreshRef.current.loadAgentStatus();
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/activity/stream');
    es.onmessage = (e) => {
      try {
        const event: SseEvent = JSON.parse(e.data);
        setLiveEvents((prev) => {
          if (prev.length > 0 && prev[0].message === event.message) return prev;
          return [event, ...prev];
        });
        refreshRef.current.loadProgress();
        refreshRef.current.loadPlans();
        refreshRef.current.loadStatus();
        refreshRef.current.loadGitStatus();
        refreshRef.current.loadAgentStatus();
      } catch {
        // ignore malformed events
      }
    };
    es.onerror = () => {
      setLiveEvents((prev) => {
        if (prev.length === 0 || prev[0].message !== 'Connection lost, retrying…') {
          return [
            { message: 'Connection lost, retrying…', timestamp: new Date().toISOString() },
            ...prev,
          ];
        }
        return prev;
      });
    };
    return () => es.close();
  }, []);

  const activePlan = useMemo(() => findFocusPlan(plans?.entries), [plans?.entries]);

  const suggestedTitle = useMemo(() => {
    if (!activePlan) return '';
    const kind = activePlan.kind ?? 'feat';
    return `${kind}: ${activePlan.title}`;
  }, [activePlan]);

  useEffect(() => {
    if (suggestedTitle && !commitTitle) {
      setCommitTitle(suggestedTitle);
    }
  }, [suggestedTitle, commitTitle]);

  useEffect(() => {
    if (gitStatus) {
      setSelectedFiles(new Set(gitStatus.map((e) => e.path)));
    }
  }, [gitStatus]);

  const handleToggleFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleCommit = useCallback(async () => {
    if (!commitTitle.trim()) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const msg =
        addRefs && activePlan?.id ? `${commitMessage}\n\nRefs: ${activePlan.id}` : commitMessage;
      await commitChanges([...selectedFiles], commitTitle.trim(), msg.trim() || undefined);
      setCommitTitle(suggestedTitle);
      setCommitMessage('');
      setAddRefs(false);
      setCommitExpanded(false);
    } catch (err) {
      setCommitError((err as Error).message);
    } finally {
      setCommitting(false);
    }
  }, [commitTitle, commitMessage, selectedFiles, addRefs, activePlan, suggestedTitle]);

  const handleSendSteering = useCallback(async () => {
    if (!steeringMessage.trim()) return;
    setSteering(true);
    try {
      await resumeAgentTask(steeringMessage.trim());
      setSteeringMessage('');
    } finally {
      setSteering(false);
    }
  }, [steeringMessage, resumeAgentTask]);

  return (
    <>
      <AnimatePresence>
        {!open && (
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
              zIndex: 100,
              borderRadius: '6px 0 0 6px',
              background: deskBg,
              backgroundImage: `${CHALKBOARD_TEXTURE}, linear-gradient(135deg, ${deskLight} 0%, ${deskBg} 60%)`,
              backgroundRepeat: 'repeat, no-repeat',
              backgroundSize: '200px 200px, auto',
              boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
            }}
          >
            <IconButton
              icon={<span style={{ fontSize: fontSize['2xs'] }}>S</span>}
              variant="chalkboard"
              size="small"
              label="Open stack panel"
              onClick={onToggle}
              style={{ width: 28, height: 64, borderRadius: '6px 0 0 6px' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        animate={{ x: open ? 0 : '100%' }}
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
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: 80,
            padding: `0 ${space[6]}`,
            borderBottom: `1px solid ${deskBorder}`,
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
          <IconButton
            icon={<span style={{ fontSize: fontSize.sm, lineHeight: 1 }}>&times;</span>}
            variant="chalkboard"
            size="small"
            label="Close stack panel"
            onClick={onToggle}
            style={{ width: 28, height: 28, border: `1px solid ${deskBorder}` }}
          />
        </div>
        <div
          style={{
            flex: 1,
            padding: space[6],
            overflowY: 'auto',
            fontFamily: fontFamily.body,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(200, 210, 195, 0.3) transparent',
          }}
        >
          <div style={{ marginBottom: space[8] }}>
            <div style={sectionLabelStyle}>Status</div>
            <div
              style={{
                display: 'flex',
                gap: space[2],
                flexWrap: 'wrap',
                marginBottom: space[4],
              }}
            >
              {(['lint', 'format', 'test'] as CheckName[]).map((name) => {
                const result = statusData?.[name];
                const status: CheckStatus = result?.status ?? 'stale';
                const statusFill: Record<CheckStatus, string> = {
                  pass: '#2d5a3b',
                  fail: '#5a2d2d',
                  running: '#5a4a2d',
                  stale: 'transparent',
                };
                const statusText: Record<CheckStatus, string | undefined> = {
                  pass: '#b5d6b5',
                  fail: '#d6a0a0',
                  running: '#d6c4a0',
                  stale: undefined,
                };
                const label = `${name.charAt(0).toUpperCase() + name.slice(1)}`;
                const isExpanded = expandedFail === name && status === 'fail';
                return (
                  <div key={name}>
                    <button
                      type="button"
                      onClick={() => {
                        if (status === 'fail') {
                          setExpandedFail(isExpanded ? null : name);
                        }
                      }}
                      style={{
                        cursor: status === 'fail' ? 'pointer' : 'default',
                        display: 'inline-flex',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                      }}
                    >
                      <Stamp
                        variant="chalkboard"
                        size="small"
                        fillColor={statusFill[status]}
                        textColor={statusText[status]}
                      >
                        {label}
                        {status === 'running' ? '…' : ''}
                      </Stamp>
                    </button>
                    {isExpanded && result && (
                      <div style={{ marginTop: space[2] }}>
                        <CodeBlock code={result.output || '(no output)'} variant="chalkboard" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={runTests}
              disabled={statusData?.test?.status === 'running'}
              style={{
                fontFamily: fontFamily.handwritten,
                fontSize: fontSize.sm,
                color: deskChalk,
                background: 'rgba(200, 210, 195, 0.1)',
                border: `1px solid ${deskBorder}`,
                borderRadius: 4,
                padding: `${space[1]} ${space[3]}`,
                cursor: statusData?.test?.status === 'running' ? 'not-allowed' : 'pointer',
                opacity: statusData?.test?.status === 'running' ? 0.5 : 1,
              }}
            >
              {statusData?.test?.status === 'running' ? 'Running…' : 'Run tests'}
            </button>
          </div>

          <div style={{ marginBottom: space[8] }}>
            <div style={sectionLabelStyle}>Commit</div>
            {gitStatus && gitStatus.length > 0 ? (
              <>
                <Accordion
                  title={`${gitStatus.length} file${gitStatus.length === 1 ? '' : 's'} changed`}
                  expanded={commitExpanded}
                  onToggle={() => setCommitExpanded(!commitExpanded)}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: space[2],
                      paddingTop: space[2],
                    }}
                  >
                    {gitStatus.map((entry) => (
                      <label
                        key={entry.path}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: space[2],
                          fontFamily: fontFamily.mono,
                          fontSize: fontSize['2xs'],
                          color: deskChalk,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(entry.path)}
                          onChange={() => handleToggleFile(entry.path)}
                          style={{ accentColor: deskChalk }}
                        />
                        <span
                          style={{
                            color: entry.staged ? deskChalk : deskTextMuted,
                            minWidth: 24,
                          }}
                        >
                          {entry.status}
                        </span>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {entry.path}
                        </span>
                      </label>
                    ))}
                  </div>
                </Accordion>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: space[3],
                    marginTop: space[3],
                  }}
                >
                  <Input
                    variant="chalkboard"
                    size="small"
                    placeholder="Commit title"
                    value={commitTitle}
                    onChange={(e) => setCommitTitle(e.currentTarget.value)}
                  />
                  <Textarea
                    variant="chalkboard"
                    size="small"
                    placeholder="Commit message (optional)"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.currentTarget.value)}
                    rows={2}
                  />
                  {activePlan?.id && (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: space[2],
                        fontFamily: fontFamily.handwritten,
                        fontSize: fontSize.sm,
                        color: deskChalk,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={addRefs}
                        onChange={() => setAddRefs(!addRefs)}
                        style={{ accentColor: deskChalk }}
                      />
                      Add Refs: {activePlan.id}
                    </label>
                  )}
                  {commitError && (
                    <Alert variant="chalkboard" dismissible onDismiss={() => setCommitError(null)}>
                      {commitError}
                    </Alert>
                  )}
                  <Button
                    variant="chalkboard"
                    size="small"
                    fullWidth
                    disabled={selectedFiles.size === 0 || !commitTitle.trim() || committing}
                    onClick={handleCommit}
                  >
                    {committing ? 'Committing…' : 'Commit'}
                  </Button>
                </div>
              </>
            ) : (
              <p style={{ opacity: 0.5, fontSize: fontSize.xs }}>No changed files.</p>
            )}
          </div>

          <div style={{ marginBottom: space[8] }}>
            <div style={sectionLabelStyle}>Agent</div>
            {agentStatus ? (
              <Card variant="chalkboard" size="small">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: space[2],
                    marginBottom: space[2],
                  }}
                >
                  <span
                    style={{
                      fontFamily: fontFamily.serif,
                      fontWeight: 600,
                      fontSize: fontSize.sm,
                      color: deskChalk,
                    }}
                  >
                    {agentStatus.planTitle}
                    {agentStatus.phaseIndex !== undefined
                      ? ` — phase ${agentStatus.phaseIndex + 1}`
                      : ''}{' '}
                    · {AGENT_LABELS[agentStatus.agentId]}
                  </span>
                  {(() => {
                    const statusFill: Record<AgentTaskStatus, string> = {
                      starting: '#5a4a2d',
                      running: '#5a4a2d',
                      stopping: '#5a4a2d',
                      done: '#2d5a3b',
                      error: '#5a2d2d',
                    };
                    const statusText: Record<AgentTaskStatus, string> = {
                      starting: '#d6c4a0',
                      running: '#d6c4a0',
                      stopping: '#d6c4a0',
                      done: '#b5d6b5',
                      error: '#d6a0a0',
                    };
                    return (
                      <Stamp
                        variant="chalkboard"
                        size="small"
                        fillColor={statusFill[agentStatus.status]}
                        textColor={statusText[agentStatus.status]}
                      >
                        {agentStatus.status}
                      </Stamp>
                    );
                  })()}
                </div>
                {agentStatus.lines.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: space[1],
                      fontFamily: fontFamily.mono,
                      fontSize: fontSize['2xs'],
                      color: deskTextMuted,
                      marginBottom: space[3],
                      maxHeight: 120,
                      overflowY: 'auto',
                    }}
                  >
                    {agentStatus.lines.slice(-5).map((line, i) => (
                      <span key={`${i}-${line}`} style={{ whiteSpace: 'pre-wrap' }}>
                        {line}
                      </span>
                    ))}
                  </div>
                )}
                {(agentStatus.status === 'running' ||
                  agentStatus.status === 'starting' ||
                  agentStatus.status === 'stopping') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
                    {agentStatus.status === 'running' && (
                      <div style={{ display: 'flex', gap: space[2] }}>
                        <Input
                          variant="chalkboard"
                          size="small"
                          placeholder="Steer the agent…"
                          value={steeringMessage}
                          onChange={(e) => setSteeringMessage(e.currentTarget.value)}
                        />
                        <Button
                          variant="primary"
                          size="small"
                          className="btn-violet"
                          onClick={handleSendSteering}
                          disabled={steering || !steeringMessage.trim()}
                        >
                          Send
                        </Button>
                      </div>
                    )}
                    <Button
                      variant="primary"
                      size="small"
                      className="btn-orange"
                      onClick={stopAgentTask}
                      disabled={agentStatus.status === 'stopping'}
                    >
                      Stop
                    </Button>
                  </div>
                )}
              </Card>
            ) : (
              <p style={{ opacity: 0.5, fontSize: fontSize.xs }}>No agent running.</p>
            )}
          </div>

          <div style={{ marginBottom: space[8] }}>
            <div style={sectionLabelStyle}>Active</div>
            {activePlan ? (
              <Card variant="chalkboard" size="small">
                <h3
                  style={{
                    fontFamily: fontFamily.serif,
                    fontWeight: 600,
                    fontSize: fontSize.sm,
                    color: deskChalk,
                    margin: 0,
                    lineHeight: lineHeight.snug,
                  }}
                >
                  {activePlan.title}
                </h3>
                {(() => {
                  const current = activePlan.phases.find((p) => !p.done);
                  if (!current) return null;
                  return (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: space[2],
                        fontFamily: fontFamily.handwritten,
                        fontSize: fontSize.lg,
                        fontWeight: 400,
                        lineHeight: lineHeight.tight,
                        color: deskText,
                        opacity: 0.9,
                      }}
                    >
                      <span style={{ flexShrink: 0, width: 14, textAlign: 'center' }}>○</span>
                      <span>{current.text}</span>
                    </div>
                  );
                })()}
              </Card>
            ) : (
              <p style={{ opacity: 0.5, fontSize: fontSize.xs }}>No active plan.</p>
            )}
          </div>

          {liveEvents.length > 0 && (
            <div style={{ marginBottom: space[8] }}>
              <div style={sectionLabelStyle}>Live</div>
              <Card variant="chalkboard" size="small">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: space[3],
                  }}
                >
                  {liveEvents.map((ev, i) => (
                    <motion.div
                      key={`${ev.timestamp}-${i}`}
                      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.2,
                        ease: 'easeOut',
                        delay: shouldReduceMotion ? 0 : i * 0.03,
                      }}
                      style={{
                        fontFamily: fontFamily.handwritten,
                        fontSize: fontSize.lg,
                        fontWeight: 400,
                        lineHeight: lineHeight.tight,
                        color: deskChalk,
                      }}
                    >
                      {ev.message}
                    </motion.div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};
