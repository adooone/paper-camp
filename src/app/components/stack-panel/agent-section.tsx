import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import { AGENT_LABELS, type AgentTaskState, type AgentTaskStatus } from '@/types/index';
import { Accordion, Card, CloseIcon, IconButton, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';
import {
  chalkStatusFill,
  chalkStatusText,
  deskChalk,
  deskTextMuted,
  sectionLabelStyle,
} from './shared';

const MAX_VISIBLE_TASKS = 3;

const taskSubtitle = (task: AgentTaskState): string => {
  switch (task.taskKind) {
    case 'phase':
      return task.phaseIndex !== undefined ? ` — phase ${task.phaseIndex + 1}` : '';
    case 'audit':
      return ' — audit';
    case 'batch-reconcile':
      return ' — batch reconcile';
    case 'reconcile':
      return ' — reconcile';
    case 'fix-review':
      return ' — fixing review comments';
    case 'draft':
      return ' — drafting';
    case 'extend':
      return ' — extending';
    case 'commit-suggest':
      return ' — suggesting commit message';
    case 'overlap-check':
      return ' — checking overlap';
    case 'sync':
      return ' — syncing to main';
    case 'run-all':
      return ' — run all phases';
    default:
      return '';
  }
};

const AgentTaskCard = ({
  task,
  onStop,
}: {
  task: AgentTaskState;
  onStop: (taskId: string) => void;
}) => {
  const [logExpanded, setLogExpanded] = useState(false);

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '0 0 auto',
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
          {task.planTitle}
          {taskSubtitle(task)} · {AGENT_LABELS[task.agentId]}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
          <Stamp
            surface="chalkboard"
            size="small"
            fillColor={statusFill[task.status]}
            textColor={statusText[task.status]}
          >
            {task.status}
          </Stamp>
          {(task.status === 'running' ||
            task.status === 'starting' ||
            task.status === 'stopping') && (
            <IconButton
              icon={<CloseIcon />}
              variant="ghost"
              size="small"
              label="Stop agent"
              onClick={() => onStop(task.id)}
              disabled={task.status === 'stopping'}
            />
          )}
        </div>
      </div>
      {task.lines.length > 0 && (
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
            {task.lines[task.lines.length - 1]}
          </span>
          <Accordion
            title={`${task.lines.length} line${task.lines.length === 1 ? '' : 's'}`}
            expanded={logExpanded}
            onToggle={() => setLogExpanded(!logExpanded)}
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
              {task.lines.map((line, i) => (
                <span key={`${i}-${line}`} style={{ whiteSpace: 'pre-wrap' }}>
                  {line}
                </span>
              ))}
            </div>
          </Accordion>
        </>
      )}
    </div>
  );
};

export const AgentSection = () => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const stopAgentTask = useAppStore((s) => s.stopAgent);
  const visibleTasks = agentStatus.slice(0, MAX_VISIBLE_TASKS);

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
        {visibleTasks.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: space[4],
              height: '100%',
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            {visibleTasks.map((task) => (
              <AgentTaskCard key={task.id} task={task} onStop={stopAgentTask} />
            ))}
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
