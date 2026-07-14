import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import { AGENT_LABELS, type AgentTaskStatus } from '@/types/index';
import { Accordion, Card, CloseIcon, IconButton, Spinner, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';
import {
  chalkStatusFill,
  chalkStatusText,
  deskChalk,
  deskTextMuted,
  sectionLabelStyle,
} from './shared';

export const AgentSection = () => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const stopAgentTask = useAppStore((s) => s.stopAgent);
  const [agentLogExpanded, setAgentLogExpanded] = useState(false);

  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        padding: space[6],
      }}
    >
      <div style={sectionLabelStyle}>Agent</div>
      <Card surface="chalkboard" size="small" className="stack-card-fill">
        {agentStatus ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: space[2],
                marginBottom: space[1],
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: fontFamily.serif,
                  fontWeight: 600,
                  fontSize: fontSize.sm,
                  color: deskChalk,
                  // minWidth: 0 lets this flex item shrink below its content
                  // width — without it overflow/ellipsis never triggers.
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {agentStatus.planTitle}
                {agentStatus.taskKind === 'phase' && agentStatus.phaseIndex !== undefined
                  ? ` — phase ${agentStatus.phaseIndex + 1}`
                  : agentStatus.taskKind === 'audit'
                    ? ' — audit'
                    : agentStatus.taskKind === 'batch-reconcile'
                      ? ' — batch reconcile'
                      : agentStatus.taskKind === 'reconcile'
                        ? ' — reconcile'
                        : agentStatus.taskKind === 'fix-review'
                          ? ' — fixing review comments'
                          : agentStatus.taskKind === 'draft'
                            ? ' — drafting'
                            : agentStatus.taskKind === 'extend'
                              ? ' — extending'
                              : agentStatus.taskKind === 'commit-suggest'
                                ? ' — suggesting commit message'
                                : agentStatus.taskKind === 'overlap-check'
                                  ? ' — checking overlap'
                                  : agentStatus.taskKind === 'sync'
                                    ? ' — syncing to main'
                                    : agentStatus.taskKind === 'run-all'
                                      ? ' — run all phases'
                                      : ''}{' '}
                · {AGENT_LABELS[agentStatus.agentId]}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
                {(() => {
                  const statusFill: Record<AgentTaskStatus, string> = {
                    starting: chalkStatusFill.running,
                    running: chalkStatusFill.running,
                    stopping: chalkStatusFill.running,
                    done: chalkStatusFill.pass,
                    error: chalkStatusFill.fail,
                  };
                  const statusText: Record<AgentTaskStatus, string> = {
                    starting: chalkStatusText.running,
                    running: chalkStatusText.running,
                    stopping: chalkStatusText.running,
                    done: chalkStatusText.pass,
                    error: chalkStatusText.fail,
                  };
                  return (
                    <Stamp
                      surface="chalkboard"
                      size="small"
                      fillColor={statusFill[agentStatus.status]}
                      textColor={statusText[agentStatus.status]}
                    >
                      {agentStatus.status}
                    </Stamp>
                  );
                })()}
                {(agentStatus.status === 'running' ||
                  agentStatus.status === 'starting' ||
                  agentStatus.status === 'stopping') && (
                  <IconButton
                    icon={<CloseIcon />}
                    variant="ghost"
                    size="small"
                    label="Stop agent"
                    onClick={stopAgentTask}
                    disabled={agentStatus.status === 'stopping'}
                  />
                )}
              </div>
            </div>
            {agentStatus.lines.length > 0 && (
              <>
                <span
                  style={{
                    fontFamily: fontFamily.mono,
                    fontSize: fontSize['2xs'],
                    color: deskTextMuted,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: space[2],
                    flexShrink: 0,
                  }}
                >
                  {agentStatus.lines[agentStatus.lines.length - 1]}
                </span>
                <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
                  <Accordion
                    title={`${agentStatus.lines.length} line${agentStatus.lines.length === 1 ? '' : 's'}`}
                    expanded={agentLogExpanded}
                    onToggle={() => setAgentLogExpanded(!agentLogExpanded)}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: space[1],
                        fontFamily: fontFamily.mono,
                        fontSize: fontSize['2xs'],
                        color: deskTextMuted,
                        paddingTop: space[2],
                        maxHeight: 160,
                        overflowY: 'auto',
                      }}
                    >
                      {agentStatus.lines.map((line, i) => (
                        <span key={`${i}-${line}`} style={{ whiteSpace: 'pre-wrap' }}>
                          {line}
                        </span>
                      ))}
                    </div>
                  </Accordion>
                </div>
              </>
            )}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p style={{ opacity: 0.5, fontSize: fontSize.xs, margin: 0 }}>No agent running.</p>
          </div>
        )}
      </Card>
    </div>
  );
};
