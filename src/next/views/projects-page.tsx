import { useNavigate } from '@tanstack/react-router';
import { useNow } from '../hooks/use-now';
import { useProjectsScreen } from '../hooks/use-projects-screen';
import { attentionMeaning, attentionTitle, newestLine, runDetail } from '../shell/projects-copy';
import { RepoStatusCard } from '../shell/repo-status-card';
import { SCREEN_PATHS } from '../shell/screens';
import { VersionStamp } from '../shell/version-stamp';
import { Hand } from '../ui/hand';
import { List, ListLabel, ListRow } from '../ui/list';
import { Stamp } from '../ui/stamp';
import styles from './projects-page.module.css';

const Chevron = () => (
  <Hand size="lg" color="inkFaint">
    ›
  </Hand>
);

export const ProjectsPage = () => {
  const screen = useProjectsScreen();
  const navigate = useNavigate();
  const now = useNow(1000);
  const open = (path: string) => () => void navigate({ to: path });
  const { loneRun } = screen;
  const lines = screen.lines.filter((line) => line.kind !== 'running' || !loneRun);

  return (
    <div className={styles.page}>
      {screen.projectName ? (
        <List>
          <ListLabel>{screen.projectName}</ListLabel>
          {screen.attentionReady && screen.lines.length === 0 ? (
            <div className={styles.note}>
              <Hand size="sm" color="inkSoft">
                Nothing needs you right now.
              </Hand>
            </div>
          ) : null}
          {screen.attentionReady && loneRun ? (
            <ListRow
              title={loneRun.task.planTitle}
              detail={
                <>
                  <Hand size="sm" color="inkSoft">
                    {runDetail(loneRun.task, loneRun.total, now)}
                  </Hand>
                  {newestLine(loneRun.task) ? (
                    <Hand size="xs" color="inkFaint" numberOfLines={1}>
                      {newestLine(loneRun.task)}
                    </Hand>
                  ) : null}
                </>
              }
              trailing={<Stamp meaning="running">running</Stamp>}
              accessibilityLabel={`Open ${loneRun.task.planTitle}`}
              onPress={open(SCREEN_PATHS.ideas)}
            />
          ) : null}
          {screen.attentionReady
            ? lines.map((line) => (
                <ListRow
                  key={line.kind}
                  title={attentionTitle(line, now)}
                  trailing={
                    <Stamp meaning={attentionMeaning[line.kind]}>{String(line.count)}</Stamp>
                  }
                  accessibilityLabel={attentionTitle(line, now)}
                  onPress={open(SCREEN_PATHS.log)}
                />
              ))
            : null}
          <ListRow
            title="Log"
            detail={
              screen.unreadCount > 0
                ? `${screen.unreadCount} unread`
                : 'Runs, replies and questions'
            }
            trailing={
              screen.unreadCount > 0 ? (
                <Stamp meaning="running">{String(screen.unreadCount)}</Stamp>
              ) : (
                <Chevron />
              )
            }
            accessibilityLabel="Open the log"
            onPress={open(SCREEN_PATHS.log)}
          />
          <ListRow
            title="Git"
            detail="Branch, changes, pull and push"
            trailing={<Chevron />}
            accessibilityLabel="Open the repository"
            onPress={open(SCREEN_PATHS.git)}
          />
          <ListRow
            title="Diff"
            detail="Working-tree changes, stage and unstage"
            trailing={<Chevron />}
            accessibilityLabel="Open the diff"
            onPress={open(SCREEN_PATHS.diff)}
          />
          <ListRow
            title="Roadmap"
            detail="Horizons and unfiled ideas"
            trailing={<Chevron />}
            accessibilityLabel="Open the roadmap"
            onPress={open(SCREEN_PATHS.roadmap)}
          />
          <ListRow
            title="Docs"
            detail="Repo docs and release notes"
            trailing={<Chevron />}
            accessibilityLabel="Open the docs"
            onPress={open(SCREEN_PATHS.docs)}
          />
          <ListRow
            title="Run order"
            detail="Queue, reorder and run ideas"
            trailing={<Chevron />}
            accessibilityLabel="Open the run order"
            onPress={open(SCREEN_PATHS.queue)}
          />
          <ListRow
            title="Night report"
            detail="Review findings by chunk"
            trailing={<Chevron />}
            accessibilityLabel="Open the night report"
            onPress={open(SCREEN_PATHS.night)}
          />
          <ListRow
            title="Stats"
            detail="Project health at a glance"
            trailing={<Chevron />}
            accessibilityLabel="Open the stats"
            onPress={open(SCREEN_PATHS.stats)}
          />
          <RepoStatusCard {...screen.repo} />
        </List>
      ) : null}
      <VersionStamp />
    </div>
  );
};
