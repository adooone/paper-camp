import type { AgentTaskState, LogRow } from '@/types/index';
import type { EntryScreenState } from '../hooks/use-entry-screen';
import { BackHeader } from '../shell/back-header';
import {
  entryMetrics,
  formatDate,
  outcomeLabel,
  outcomeMeaning,
  parkedFor,
} from '../shell/log-model';
import { Button } from '../ui/button';
import { Hand } from '../ui/hand';
import { KraftCard } from '../ui/kraft-card';
import { Stamp } from '../ui/stamp';
import styles from './log.module.css';
import { OutputBoard } from './output-board';

interface EntryViewProps {
  row: LogRow;
  screen: EntryScreenState;
  onBack?: () => void;
  onOpenIdea: (ideaId: string) => void;
  onDiscuss: (ideaId: string) => void;
}

function LiveExtras({ task }: { task: AgentTaskState }) {
  return (
    <div className={styles.live}>
      <Hand size="base" bold>
        Live task
      </Hand>
      <div className={styles.liveLine}>
        <Hand size="sm" color="inkSoft">
          {task.taskKind} · {task.agentId}
        </Hand>
        {task.phaseIndex == null ? null : (
          <Hand size="sm" color="inkSoft">
            phase {task.phaseIndex + 1}
          </Hand>
        )}
        {task.errorKind ? <Stamp meaning="parked">{task.errorKind}</Stamp> : null}
      </div>
    </div>
  );
}

function Details({
  row,
  live,
  onOpenIdea,
}: {
  row: LogRow;
  live: AgentTaskState | null;
  onOpenIdea: (id: string) => void;
}) {
  const { source } = row;
  if (source.kind === 'running') {
    return (
      <KraftCard>
        <div className={styles.details}>
          <div className={styles.detailsTop}>
            <Hand size="lg" bold>
              {source.task.planTitle}
            </Hand>
            <Stamp meaning={outcomeMeaning[row.outcome]}>{source.task.status}</Stamp>
          </div>
          <LiveExtras task={source.task} />
        </div>
      </KraftCard>
    );
  }
  if (source.kind === 'task') {
    const { entry } = source;
    return (
      <KraftCard>
        <div className={styles.details}>
          <div className={styles.detailsTop}>
            <Hand size="lg" bold>
              {entry.planTitle}
            </Hand>
            <Stamp meaning={outcomeMeaning[row.outcome]}>{outcomeLabel[row.outcome]}</Stamp>
          </div>
          <Hand size="sm" color="inkSoft">
            {entry.taskKind} · {entry.agentId}
          </Hand>
          <div className={styles.metrics}>
            {entryMetrics(entry).map((metric) => (
              <div key={metric.label} className={styles.metric}>
                <Hand size="xs" color="inkFaint">
                  {metric.label}
                </Hand>
                <Hand size="sm">{metric.value}</Hand>
              </div>
            ))}
          </div>
          {entry.planId ? (
            <Button
              label={`Open idea ${entry.planId}`}
              variant="secondary"
              size="sm"
              className={styles.openIdea}
              onPress={() => onOpenIdea(entry.planId ?? '')}
            />
          ) : null}
          {live ? <LiveExtras task={live} /> : null}
        </div>
      </KraftCard>
    );
  }
  if (source.kind === 'reply') {
    const { notification } = source;
    return (
      <KraftCard>
        <div className={styles.details}>
          <div className={styles.detailsTop}>
            <Hand size="lg" bold>
              {notification.entityTitle}
            </Hand>
            <Stamp meaning={notification.read ? 'done' : 'running'}>
              {notification.read ? 'read' : 'unread'}
            </Stamp>
          </div>
          <Hand size="sm" color="inkSoft">
            {notification.kind} · {formatDate(notification.date)}
          </Hand>
          <Hand size="base">{notification.text}</Hand>
        </div>
      </KraftCard>
    );
  }
  if (source.kind === 'question') {
    const { question } = source;
    return (
      <KraftCard>
        <div className={styles.details}>
          <div className={styles.detailsTop}>
            <Hand size="lg" bold>
              {question.entityTitle}
            </Hand>
            <Stamp meaning="parked">question</Stamp>
          </div>
          <Hand size="sm" color="inkSoft">
            parked for {parkedFor(question.ageDays)}
          </Hand>
          <Hand size="base">{question.text}</Hand>
        </div>
      </KraftCard>
    );
  }
  return null;
}

export function EntryView({ row, screen, onBack, onOpenIdea, onDiscuss }: EntryViewProps) {
  const { live, discussId, busy } = screen;
  const parked = live?.errorKind === 'question' && row.source.kind === 'running';
  const notification = row.source.kind === 'reply' ? row.source.notification : null;
  const hasActions = Boolean(notification || discussId || live);
  return (
    <article className={styles.entry}>
      {onBack ? (
        <BackHeader
          onBack={onBack}
          trailing={<Stamp meaning={outcomeMeaning[row.outcome]}>{row.source.kind}</Stamp>}
        />
      ) : null}
      <Details row={row} live={live} onOpenIdea={onOpenIdea} />
      {live ? (
        <>
          <Hand size="base" bold>
            Output
          </Hand>
          <OutputBoard key={live.id} taskId={live.id} live />
        </>
      ) : null}
      {parked ? (
        <KraftCard>
          <Hand size="base" bold>
            Agent is parked on a question
          </Hand>
          <Hand size="sm" color="inkSoft">
            Use Discuss in chat below to answer it.
          </Hand>
        </KraftCard>
      ) : null}
      {screen.error ? (
        <Hand size="sm" color="danger">
          {screen.error}
        </Hand>
      ) : null}
      {hasActions ? (
        <div className={styles.actionBar}>
          {notification ? (
            <Button
              label={
                busy === 'mark-read' ? 'Working…' : notification.read ? 'Already read' : 'Mark read'
              }
              onPress={screen.markRead}
              disabled={busy !== null || notification.read}
            />
          ) : null}
          {discussId ? (
            <Button label="Discuss in chat" onPress={() => onDiscuss(discussId)} />
          ) : null}
          {live ? (
            <Button
              label={busy === 'stop' ? 'Stopping…' : 'Stop'}
              variant="secondary"
              onPress={screen.stop}
              disabled={busy !== null}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
