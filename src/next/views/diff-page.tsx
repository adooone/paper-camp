import { useNavigate } from '@tanstack/react-router';
import styles from '../diff/diff.module.css';
import { FileDiff } from '../diff/file-diff';
import { useDiffScreen } from '../hooks/use-diff-screen';
import { useProjectName } from '../hooks/use-project-name';
import { BackHeader } from '../shell/back-header';
import { diffSummary } from '../shell/diff-model';
import { SCREEN_PATHS } from '../shell/screens';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Hand } from '../ui/hand';
import { SkeletonRows } from '../ui/skeleton-rows';

export const DiffPage = () => {
  const screen = useDiffScreen();
  const projectName = useProjectName();
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <BackHeader
        onBack={() => void navigate({ to: SCREEN_PATHS.projects })}
        label={projectName ?? 'Diff'}
      />
      <div className={styles.content}>
        {screen.load === 'loading' ? <SkeletonRows /> : null}
        {screen.load === 'unreachable' ? (
          <div className={styles.note}>
            <Hand size="sm" color="inkSoft">
              Couldn't load the working-tree diff.
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
        {screen.load === 'ready' && screen.files.length === 0 ? (
          <EmptyState
            title="Nothing to review"
            line="The working tree is clean."
            actionLabel="Open git"
            onAction={() => void navigate({ to: SCREEN_PATHS.git })}
          />
        ) : null}
        {screen.load === 'ready' && screen.files.length > 0 ? (
          <>
            <div className={styles.bar}>
              <Hand size="sm" color="inkSoft">
                {diffSummary(screen.files)}
              </Hand>
              <Button
                label={screen.allStaged ? 'Unstage all' : 'Stage all'}
                variant="secondary"
                size="sm"
                onPress={screen.toggleAll}
                disabled={screen.bulkPending}
              />
            </div>
            <div className={styles.board}>
              {screen.files.map((entry) => (
                <FileDiff
                  key={entry.path}
                  entry={entry}
                  collapsed={screen.isCollapsed(entry)}
                  pending={screen.isPending(entry.path)}
                  onToggleCollapsed={() => screen.toggleCollapsed(entry)}
                  onToggleStaged={() => screen.toggleStaged(entry)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
