import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useMediaQuery } from '@/app/hooks/use-media-query';
import { useProjectName } from '../hooks/use-project-name';
import { useQueueScreen } from '../hooks/use-queue-screen';
import { BackHeader } from '../shell/back-header';
import {
  BACKLOG_EMPTY,
  gitLevelCopy,
  itemDetail,
  QUEUE_EMPTY,
  QUEUE_TAB_LABEL,
  QUEUE_TABS,
  type QueueTab,
  queueTotals,
  readinessStamp,
  totalsLine,
  unplannedIds,
} from '../shell/queue-model';
import { SCREEN_PATHS, WIDE_QUERY } from '../shell/screens';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Hand } from '../ui/hand';
import { ListLabel, ListRow } from '../ui/list';
import { SkeletonRows } from '../ui/skeleton-rows';
import { Stamp } from '../ui/stamp';
import { SubIsland } from '../ui/sub-island';
import { Switch } from '../ui/switch';
import styles from './queue-page.module.css';

const NAV_ISLAND_SPACE = 84;

const isQueueTab = (id: string): id is QueueTab => QUEUE_TABS.some((tab) => tab === id);

export const QueuePage = () => {
  const screen = useQueueScreen();
  const projectName = useProjectName();
  const navigate = useNavigate();
  const wide = useMediaQuery(WIDE_QUERY);
  const [tab, setTab] = useState<QueueTab>('queue');
  const { preview } = screen;
  const order = preview?.order ?? [];
  const backlog = preview?.backlog ?? [];
  const totals = queueTotals(order, screen.picked);
  const unplanned = unplannedIds(backlog);
  const runLabel = screen.needsSync
    ? screen.syncing
      ? 'Syncing…'
      : 'Sync first'
    : screen.starting
      ? 'Starting…'
      : 'Run queue';

  const segments = (
    <SubIsland
      segments={QUEUE_TABS.map((id) => ({
        id,
        label: QUEUE_TAB_LABEL[id],
        count: id === 'queue' ? order.length : backlog.length,
      }))}
      current={tab}
      onSelect={(id) => isQueueTab(id) && setTab(id)}
      bottomSpace={wide ? 0 : NAV_ISLAND_SPACE}
      docked={!wide}
    />
  );

  return (
    <div className={styles.page}>
      <BackHeader
        onBack={() => void navigate({ to: SCREEN_PATHS.projects })}
        label={projectName ?? 'Run order'}
      />
      {wide ? segments : null}
      <div className={styles.content}>
        {screen.load === 'loading' ? <SkeletonRows /> : null}
        {preview && tab === 'queue' ? (
          <>
            <div className={styles.toolbar}>
              <Button
                label={runLabel}
                size="sm"
                disabled={
                  screen.live ||
                  screen.starting ||
                  screen.syncing ||
                  (!screen.needsSync && totals.count === 0)
                }
                onPress={() => void screen.run()}
              />
              <Button
                label={screen.prioritising ? 'Prioritising…' : 'Prioritise'}
                variant="secondary"
                size="sm"
                disabled={screen.live || screen.prioritising || order.length < 2}
                onPress={() => void screen.prioritise()}
              />
            </div>
            <div className={styles.totals}>
              <Hand size="sm" color="inkSoft">
                {screen.live
                  ? 'A queue is running — controls are in the Stack.'
                  : totalsLine(totals)}
              </Hand>
              <Stamp meaning={screen.needsSync || preview.git.dirty ? 'parked' : 'done'}>
                {gitLevelCopy(preview.git.level)}
              </Stamp>
            </div>
            {order.length === 0 ? (
              <EmptyState title={QUEUE_EMPTY.title} line={QUEUE_EMPTY.line} />
            ) : (
              <div className={styles.group}>
                <ListLabel
                  trailing={
                    <Stamp meaning="done">{`${preview.readyCount} of ${order.length} ready`}</Stamp>
                  }
                >
                  Run order
                </ListLabel>
                {order.map((item, index) => {
                  const stamp = readinessStamp(item);
                  return (
                    <ListRow
                      key={item.id}
                      eyebrow={`${index + 1} · ${item.id}`}
                      title={item.title}
                      detail={
                        <span className={styles.meta}>
                          <Hand size="sm" color="inkSoft">
                            {itemDetail(item)}
                          </Hand>
                          <Stamp meaning={stamp.meaning}>{stamp.label}</Stamp>
                        </span>
                      }
                      trailing={
                        <span className={styles.controls}>
                          <Button
                            label="↑"
                            variant="ghost"
                            size="sm"
                            accessibilityLabel={`Move ${item.id} up`}
                            disabled={screen.live || index === 0}
                            onPress={() => void screen.move(item.id, -1)}
                          />
                          <Button
                            label="↓"
                            variant="ghost"
                            size="sm"
                            accessibilityLabel={`Move ${item.id} down`}
                            disabled={screen.live || index === order.length - 1}
                            onPress={() => void screen.move(item.id, 1)}
                          />
                          <Switch
                            value={screen.picked.has(item.id)}
                            label={`Run ${item.id}`}
                            disabled={screen.live || !item.readiness.ready}
                            onChange={() => screen.toggle(item.id)}
                          />
                        </span>
                      }
                    />
                  );
                })}
              </div>
            )}
          </>
        ) : null}
        {preview && tab === 'backlog' ? (
          <>
            {unplanned.length > 0 ? (
              <div className={styles.toolbar}>
                <Button
                  label={`Draft ${unplanned.length} ${unplanned.length === 1 ? 'idea' : 'ideas'}`}
                  size="sm"
                  disabled={screen.busy}
                  onPress={() => void screen.draftUnplanned()}
                />
              </div>
            ) : null}
            {backlog.length === 0 ? (
              <EmptyState title={BACKLOG_EMPTY.title} line={BACKLOG_EMPTY.line} />
            ) : (
              <div className={styles.group}>
                <ListLabel>Not in the queue yet</ListLabel>
                {backlog.map((item) => (
                  <ListRow
                    key={item.id}
                    eyebrow={item.id}
                    title={item.title}
                    trailing={
                      item.hasPhases ? (
                        <Button
                          label="Mark planned"
                          variant="secondary"
                          size="xs"
                          disabled={screen.busy}
                          onPress={() => void screen.markPlanned(item.id)}
                        />
                      ) : (
                        <Stamp meaning="idle">needs a plan</Stamp>
                      )
                    }
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
      {wide ? null : segments}
    </div>
  );
};
