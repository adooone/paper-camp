import { useNavigate } from '@tanstack/react-router';
import styles from '../docs/docs.module.css';
import { useDocsScreen } from '../hooks/use-docs-screen';
import { useProjectName } from '../hooks/use-project-name';
import { BackHeader } from '../shell/back-header';
import { resultsLine } from '../shell/docs-model';
import { docPath, RELEASES_PATH, SCREEN_PATHS } from '../shell/screens';
import { EmptyState } from '../ui/empty-state';
import { Hand } from '../ui/hand';
import { ListLabel, ListRow } from '../ui/list';
import { SkeletonRows } from '../ui/skeleton-rows';
import { Stamp } from '../ui/stamp';

const Chevron = () => (
  <Hand size="lg" color="inkFaint">
    ›
  </Hand>
);

export const DocsPage = () => {
  const screen = useDocsScreen();
  const projectName = useProjectName();
  const navigate = useNavigate();
  const searching = screen.query.trim() !== '';
  const open = (name: string) => () => void navigate({ to: docPath(name) });

  return (
    <div className={styles.page}>
      <BackHeader
        onBack={() => void navigate({ to: SCREEN_PATHS.projects })}
        label={projectName ?? 'Docs'}
      />
      <div className={styles.content}>
        {/* folk-ui's Input is a sketched field; the phone's search is a plain stroked input. */}
        <input
          type="search"
          value={screen.query}
          onChange={(event) => screen.setQuery(event.target.value)}
          placeholder="Search docs…"
          aria-label="Search docs"
          className={styles.search}
        />
        {screen.load === 'loading' ? <SkeletonRows /> : null}
        {screen.load === 'ready' && searching ? (
          screen.matches.length === 0 ? (
            <EmptyState
              title="No results"
              line={`Nothing in the docs matches "${screen.query.trim()}".`}
            />
          ) : (
            <div className={styles.group}>
              <ListLabel>{resultsLine(screen.matches.length, screen.query)}</ListLabel>
              {screen.matches.map((match) => (
                <ListRow
                  key={match.name}
                  title={match.name}
                  detail={match.snippet}
                  accessibilityLabel={`Open ${match.name}`}
                  onPress={open(match.name)}
                />
              ))}
            </div>
          )
        ) : null}
        {screen.load === 'ready' && !searching ? (
          <>
            <div className={styles.group}>
              <ListLabel>Repo docs</ListLabel>
              {screen.docs.length === 0 ? (
                <div className={styles.note}>
                  <Hand size="sm" color="inkSoft">
                    No docs in the repository yet.
                  </Hand>
                </div>
              ) : null}
              {screen.docs.map((doc) => (
                <ListRow
                  key={doc.name}
                  title={doc.name}
                  trailing={<Chevron />}
                  accessibilityLabel={`Open ${doc.name}`}
                  onPress={open(doc.name)}
                />
              ))}
            </div>
            <div className={styles.group}>
              <ListLabel>Release notes</ListLabel>
              <ListRow
                title="Releases"
                detail="Every release, newest first"
                trailing={
                  screen.releaseVersions.length > 0 ? (
                    <Stamp meaning="idle">{String(screen.releaseVersions.length)}</Stamp>
                  ) : (
                    <Chevron />
                  )
                }
                accessibilityLabel="Open the releases"
                onPress={() => void navigate({ to: RELEASES_PATH })}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
