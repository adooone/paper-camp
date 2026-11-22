import { useNavigate } from '@tanstack/react-router';
import { useProjectName } from '../hooks/use-project-name';
import { useStatsScreen } from '../hooks/use-stats-screen';
import { BackHeader } from '../shell/back-header';
import { SCREEN_PATHS } from '../shell/screens';
import { statTiles } from '../shell/stats-model';
import { StatTile } from '../stats/stat-tile';
import styles from '../stats/stats.module.css';
import { Button } from '../ui/button';
import { Hand } from '../ui/hand';
import { SkeletonRows } from '../ui/skeleton-rows';

export const StatsPage = () => {
  const screen = useStatsScreen();
  const projectName = useProjectName();
  const navigate = useNavigate();
  const { stats } = screen;

  return (
    <div className={styles.page}>
      <BackHeader
        onBack={() => void navigate({ to: SCREEN_PATHS.projects })}
        label={projectName ?? 'Stats'}
      />
      <div className={styles.content}>
        <Hand size="sm" color="inkSoft">
          A read-only look at project health — none of these numbers gate anything.
        </Hand>
        {screen.load === 'loading' ? <SkeletonRows /> : null}
        {screen.load === 'unreachable' ? (
          <div className={styles.note}>
            <Hand size="sm" color="inkSoft">
              Couldn't load stats.
            </Hand>
            <Button
              label="Try again"
              variant="secondary"
              size="sm"
              onPress={screen.reload}
              className={styles.inline}
            />
          </div>
        ) : null}
        {stats ? (
          <>
            <div className={styles.grid}>
              {statTiles(stats).map((tile) => (
                <StatTile key={tile.key} tile={tile} />
              ))}
            </div>
            <div className={styles.footer}>
              <Hand size="xs" color="inkFaint">
                Generated {new Date(stats.generatedAt).toLocaleString()}
              </Hand>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
