import { useNavigate } from '@tanstack/react-router';
import { useProjectName } from '../hooks/use-project-name';
import { useRoadmapScreen } from '../hooks/use-roadmap-screen';
import { HorizonGroup } from '../roadmap/horizon-group';
import { ItemRow } from '../roadmap/item-row';
import styles from '../roadmap/roadmap.module.css';
import { BackHeader } from '../shell/back-header';
import { goalLine, ideaStatusStamp, matchesSearch, openUnfiled } from '../shell/roadmap-model';
import { SCREEN_PATHS } from '../shell/screens';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Hand } from '../ui/hand';
import { ListLabel, ListRow } from '../ui/list';
import { SkeletonRows } from '../ui/skeleton-rows';
import { Stamp } from '../ui/stamp';

export const RoadmapPage = () => {
  const screen = useRoadmapScreen();
  const projectName = useProjectName();
  const navigate = useNavigate();
  const { roadmap } = screen;
  const horizons =
    roadmap?.horizons.map((horizon) => ({
      ...horizon,
      items: horizon.items.filter((item) => matchesSearch(item, screen.search)),
    })) ?? [];
  const concerns = roadmap?.standingConcerns.filter((item) => matchesSearch(item, screen.search));
  const unfiled = roadmap ? openUnfiled(roadmap.unfiled) : [];
  const openIdea = (id: string) => () =>
    void navigate({ to: `${SCREEN_PATHS.ideas}/${encodeURIComponent(id)}` });

  return (
    <div className={styles.page}>
      <BackHeader
        onBack={() => void navigate({ to: SCREEN_PATHS.projects })}
        label={projectName ?? 'Roadmap'}
      />
      <div className={styles.content}>
        {screen.load === 'loading' ? <SkeletonRows /> : null}
        {screen.load === 'unreachable' ? (
          <div className={styles.note}>
            <Hand size="sm" color="inkSoft">
              Couldn't load the roadmap.
            </Hand>
            <Button
              label="Try again"
              variant="secondary"
              size="sm"
              onPress={() => void screen.reload()}
              className={styles.inline}
            />
          </div>
        ) : null}
        {screen.load === 'missing' ? (
          <EmptyState title="No roadmap yet" line="There is no ROADMAP.md at the project root." />
        ) : null}
        {roadmap ? (
          <>
            {roadmap.goal ? (
              <Hand size="sm" color="inkSoft">
                {goalLine(roadmap.goal)}
              </Hand>
            ) : null}
            {/* folk-ui's Input is a sketched field; the phone's search is a plain stroked input. */}
            <input
              type="search"
              value={screen.search}
              onChange={(event) => screen.setSearch(event.target.value)}
              placeholder="Search roadmap…"
              aria-label="Search roadmap"
              className={styles.search}
            />
            {horizons.map((horizon) => (
              <HorizonGroup key={horizon.title} horizon={horizon} />
            ))}
            {concerns && concerns.length > 0 ? (
              <div className={styles.group}>
                <ListLabel>Standing concerns</ListLabel>
                {concerns.map((item) => (
                  <ItemRow key={item.name} item={item} />
                ))}
              </div>
            ) : null}
            {unfiled.length > 0 ? (
              <div className={styles.group}>
                <ListLabel trailing={<Stamp meaning="parked">{String(unfiled.length)}</Stamp>}>
                  Unfiled
                </ListLabel>
                <div className={styles.note}>
                  <Hand size="xs" color="inkFaint">
                    Ideas with no subject on the map.
                  </Hand>
                </div>
                {unfiled.map((entity) => {
                  const stamp = ideaStatusStamp(entity.status);
                  return (
                    <ListRow
                      key={entity.id}
                      title={entity.title}
                      eyebrow={entity.id}
                      trailing={<Stamp meaning={stamp.meaning}>{stamp.label}</Stamp>}
                      accessibilityLabel={`Open ${entity.id}`}
                      onPress={openIdea(entity.id)}
                    />
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};
