import { useNavigate, useParams } from '@tanstack/react-router';
import { useMediaQuery } from '@/app/hooks/use-media-query';
import type { LogRow } from '@/types/index';
import { useEntryScreen } from '../hooks/use-entry-screen';
import { useLogScreen } from '../hooks/use-log-screen';
import { useProjectName } from '../hooks/use-project-name';
import { EntryView } from '../log/entry-view';
import { LogChips } from '../log/log-chips';
import { LogListRow } from '../log/log-row';
import { BackHeader } from '../shell/back-header';
import { SCREEN_PATHS, WIDE_QUERY } from '../shell/screens';
import { EmptyState } from '../ui/empty-state';
import { Hand } from '../ui/hand';
import { ListLabel } from '../ui/list';
import { SkeletonRows } from '../ui/skeleton-rows';
import styles from './log-page.module.css';

function EntryColumn({
  row,
  reload,
  onBack,
}: {
  row: LogRow;
  reload: () => Promise<void>;
  onBack?: () => void;
}) {
  const screen = useEntryScreen(row, reload);
  const navigate = useNavigate();
  return (
    <EntryView
      row={row}
      screen={screen}
      onBack={onBack}
      onOpenIdea={(ideaId) =>
        void navigate({ to: `${SCREEN_PATHS.ideas}/${encodeURIComponent(ideaId)}` })
      }
      onDiscuss={(ideaId) => void navigate({ to: SCREEN_PATHS.chat, search: { about: ideaId } })}
    />
  );
}

export const LogPage = () => {
  const screen = useLogScreen();
  const projectName = useProjectName();
  const navigate = useNavigate();
  const wide = useMediaQuery(WIDE_QUERY);
  const { entryId } = useParams({ strict: false }) as { entryId?: string };
  const selected = entryId ? screen.find(entryId) : undefined;
  const open = (row: LogRow) => () =>
    void navigate({ to: `${SCREEN_PATHS.log}/${encodeURIComponent(row.id)}` });
  const toList = () => void navigate({ to: SCREEN_PATHS.log });
  const showList = wide || !entryId;
  const showDetail = wide || Boolean(entryId);
  const visible = screen.waiting.length + screen.feed.length;

  return (
    <div className={styles.split}>
      {showList ? (
        <section className={styles.listColumn} aria-label="Log">
          <BackHeader
            onBack={() => void navigate({ to: SCREEN_PATHS.projects })}
            label={projectName ?? 'Log'}
          />
          <LogChips
            filters={screen.filters}
            onToggleOutcome={screen.toggleOutcome}
            onToggleType={screen.toggleType}
          />
          <div className={styles.rows}>
            {visible === 0 && screen.load === 'loading' ? <SkeletonRows /> : null}
            {visible === 0 && screen.load === 'unreachable' ? (
              <div className={styles.centered}>
                <Hand size="md" color="inkSoft">
                  Couldn't reach the daemon.
                </Hand>
              </div>
            ) : null}
            {visible === 0 && screen.load === 'ready' ? (
              <EmptyState
                title={screen.total === 0 ? 'Nothing logged yet' : 'Nothing matches'}
                line={
                  screen.total === 0
                    ? 'Runs and the things waiting on you will land here.'
                    : 'Clear a filter to see more of the log.'
                }
                actionLabel={screen.total === 0 ? 'Start a run' : undefined}
                onAction={
                  screen.total === 0 ? () => void navigate({ to: SCREEN_PATHS.ideas }) : undefined
                }
              />
            ) : null}
            {screen.waiting.length > 0 ? (
              <div className={styles.group}>
                <ListLabel>Waiting on you</ListLabel>
                {screen.waiting.map((row) => (
                  <LogListRow
                    key={row.id}
                    row={row}
                    selected={row.id === selected?.id}
                    onPress={open(row)}
                  />
                ))}
              </div>
            ) : null}
            {screen.feed.map((row) => (
              <LogListRow
                key={row.id}
                row={row}
                selected={row.id === selected?.id}
                onPress={open(row)}
              />
            ))}
          </div>
        </section>
      ) : null}
      {showDetail ? (
        <section className={styles.detailColumn} aria-label="Run">
          {selected ? (
            <EntryColumn
              key={selected.id}
              row={selected}
              reload={screen.reload}
              onBack={wide ? undefined : toList}
            />
          ) : entryId && screen.load === 'loading' ? (
            <SkeletonRows />
          ) : (
            <EmptyState
              title={entryId ? "Couldn't find this entry" : 'Pick a run'}
              line={entryId ? 'It is no longer in the log.' : 'Its details and output open here.'}
              actionLabel={entryId && !wide ? 'Back to the log' : undefined}
              onAction={entryId && !wide ? toList : undefined}
            />
          )}
        </section>
      ) : null}
    </div>
  );
};
