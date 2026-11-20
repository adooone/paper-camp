import { useNavigate, useParams } from '@tanstack/react-router';
import { useMediaQuery } from '@/app/hooks/use-media-query';
import { useIdeasScreen } from '../hooks/use-ideas-screen';
import {
  isFoldable,
  progressOf,
  STATUS_HEADING,
  TAB_EMPTY,
  TAB_LABEL,
  WORK_TABS,
  type WorkTab,
} from '../shell/ideas-model';
import { SCREEN_PATHS, WIDE_QUERY } from '../shell/screens';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Hand } from '../ui/hand';
import { KraftCard } from '../ui/kraft-card';
import { ListLabel, ListRow } from '../ui/list';
import { SkeletonRows } from '../ui/skeleton-rows';
import { SubIsland } from '../ui/sub-island';
import { IdeaColumn } from './idea-column';
import styles from './ideas-page.module.css';

const NAV_ISLAND_SPACE = 84;

const isWorkTab = (id: string): id is WorkTab => WORK_TABS.some((tab) => tab === id);

export const IdeasPage = () => {
  const screen = useIdeasScreen();
  const navigate = useNavigate();
  const wide = useMediaQuery(WIDE_QUERY);
  const { ideaId } = useParams({ strict: false }) as { ideaId?: string };
  const backToList = () => void navigate({ to: SCREEN_PATHS.ideas });
  const open = (id: string) => () =>
    void navigate({ to: `${SCREEN_PATHS.ideas}/${encodeURIComponent(id)}` });
  const showList = wide || !ideaId;
  const showDetail = wide || Boolean(ideaId);
  const ready = screen.load === 'ready';

  const segments = (
    <SubIsland
      segments={WORK_TABS.map((id) => ({
        id,
        label: TAB_LABEL[id],
        count: screen.counts?.[id],
      }))}
      current={screen.tab}
      onSelect={(id) => isWorkTab(id) && screen.selectTab(id)}
      bottomSpace={wide ? 0 : NAV_ISLAND_SPACE}
      docked={!wide}
    />
  );

  return (
    <div className={styles.split}>
      {showList ? (
        <section className={styles.listColumn} aria-label="Ideas">
          {wide ? segments : null}
          {screen.load === 'loading' ? <SkeletonRows /> : null}
          {screen.load === 'unreachable' ? (
            <KraftCard>
              <Hand size="base" color="inkSoft">
                {screen.projectName ?? 'This project'} didn't answer, so the ideas can't be read.
              </Hand>
              <Button
                label="Try again"
                variant="secondary"
                size="sm"
                onPress={screen.retry}
                className={styles.retry}
              />
            </KraftCard>
          ) : null}
          {ready && screen.entries.length === 0 ? (
            <EmptyState
              title="No ideas yet"
              line={`Ideas on ${screen.projectName ?? 'this project'} will show up here.`}
            />
          ) : null}
          {ready && screen.entries.length > 0 && screen.groups.length === 0 ? (
            <div className={styles.centered}>
              <Hand size="base" color="inkSoft">
                {TAB_EMPTY[screen.tab]}
              </Hand>
            </div>
          ) : null}
          {screen.groups.map((group) => {
            const foldable = isFoldable(group.status);
            const isOpen = screen.isOpen(group.status);
            const count = group.entries.length;
            return (
              <div key={group.status} className={styles.group}>
                <ListLabel
                  onPress={foldable ? () => screen.toggle(group.status) : undefined}
                  trailing={
                    <Hand size="sm" bold color="inkSoft">
                      {foldable ? `${count} ${isOpen ? '▾' : '▸'}` : String(count)}
                    </Hand>
                  }
                >
                  {STATUS_HEADING[group.status]}
                </ListLabel>
                {isOpen
                  ? group.entries.map((entry) => (
                      <ListRow
                        key={entry.id}
                        eyebrow={entry.id}
                        title={entry.title}
                        detail={progressOf(entry) ?? undefined}
                        selected={entry.id === ideaId}
                        accessibilityLabel={`Open ${entry.title}`}
                        onPress={open(entry.id)}
                      />
                    ))
                  : null}
              </div>
            );
          })}
          {wide ? null : segments}
        </section>
      ) : null}
      {showDetail ? (
        <section className={styles.detailColumn} aria-label="Idea">
          <IdeaColumn
            ideaId={ideaId}
            entries={screen.entries}
            loading={screen.load === 'loading'}
            onBack={wide ? undefined : backToList}
          />
        </section>
      ) : null}
    </div>
  );
};
