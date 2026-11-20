import { useNavigate } from '@tanstack/react-router';
import { CommitSheet } from '../git/commit-sheet';
import styles from '../git/git.module.css';
import { useGitScreen } from '../hooks/use-git-screen';
import { useProjectName } from '../hooks/use-project-name';
import { BackHeader } from '../shell/back-header';
import {
  ACTION_BUSY,
  ACTION_IDLE,
  commitEyebrow,
  describeDivergence,
  describeEntryStatus,
  describeSync,
  type GitAction,
  hygieneStamp,
  syncStamp,
} from '../shell/git-model';
import { relativeDay } from '../shell/repo-status';
import { SCREEN_PATHS } from '../shell/screens';
import { Button } from '../ui/button';
import { Hand } from '../ui/hand';
import { ListLabel, ListRow } from '../ui/list';
import { Stamp } from '../ui/stamp';

export const GitPage = () => {
  const screen = useGitScreen();
  const projectName = useProjectName();
  const navigate = useNavigate();
  const { repo, running, outcome } = screen;
  const busyLabel = (action: GitAction) =>
    running === action ? ACTION_BUSY[action] : ACTION_IDLE[action];
  const actionButton = (action: GitAction, variant: 'primary' | 'secondary' = 'primary') => (
    <Button
      label={busyLabel(action)}
      variant={variant}
      onPress={() => screen.run(action)}
      disabled={running !== null}
    />
  );

  return (
    <div className={styles.page}>
      <BackHeader
        onBack={() => void navigate({ to: SCREEN_PATHS.projects })}
        label={projectName ?? 'Git'}
      />
      <div className={styles.content}>
        {screen.load === 'loading' ? (
          <div className={styles.note}>
            <Hand size="sm" color="inkSoft">
              Asking the daemon about the repository…
            </Hand>
          </div>
        ) : null}
        {screen.load === 'unreachable' ? (
          <div className={styles.note}>
            <Hand size="sm" color="inkSoft">
              Couldn't reach the daemon.
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

        {repo ? (
          <>
            <div className={styles.list}>
              <ListLabel
                trailing={
                  <Stamp meaning={hygieneStamp(repo.hygiene).meaning}>
                    {hygieneStamp(repo.hygiene).label}
                  </Stamp>
                }
              >
                Branch
              </ListLabel>
              <ListRow
                title={repo.branch || '(detached)'}
                detail={describeSync(repo)}
                trailing={<Stamp meaning={syncStamp(repo).meaning}>{syncStamp(repo).label}</Stamp>}
              />
              <div className={styles.actions}>
                {repo.diverged ? actionButton('fix-divergence') : null}
                {repo.behind > 0 && !repo.diverged ? actionButton('pull') : null}
                {repo.ahead > 0 && !repo.diverged ? actionButton('push') : null}
                {actionButton('sync', 'secondary')}
              </div>
              {repo.diverged && !outcome ? (
                <div className={styles.note}>
                  <Hand size="sm" color="inkSoft">
                    {describeDivergence(repo, repo.entries.length)}
                  </Hand>
                </div>
              ) : null}
              {outcome ? (
                <div className={styles.note}>
                  <Hand size="sm" color={outcome.ok ? 'good' : 'danger'}>
                    {outcome.message}
                  </Hand>
                  {outcome.conflictedFiles?.map((path) => (
                    <Hand key={path} size="xs" font="mono">
                      {path}
                    </Hand>
                  ))}
                  {outcome.conflictPrompt ? (
                    <Button
                      label={screen.handingOff ? 'Launching…' : 'Hand it to an agent'}
                      variant="secondary"
                      size="sm"
                      disabled={screen.handingOff || running !== null}
                      onPress={() => screen.handOff(outcome.conflictPrompt ?? '')}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className={styles.list}>
              <ListLabel
                trailing={
                  repo.entries.length > 0 ? (
                    <Stamp meaning="running">{String(repo.entries.length)}</Stamp>
                  ) : undefined
                }
              >
                Changes
              </ListLabel>
              {repo.entries.length === 0 ? (
                <div className={styles.note}>
                  <Hand size="sm" color="inkSoft">
                    The working tree is clean.
                  </Hand>
                </div>
              ) : (
                <>
                  {repo.entries.map((entry) => {
                    const stamp = describeEntryStatus(entry);
                    return (
                      <ListRow
                        key={entry.path}
                        title={
                          <Hand size="sm" font="mono" numberOfLines={1}>
                            {entry.path}
                          </Hand>
                        }
                        detail={entry.renameSource ? `from ${entry.renameSource}` : undefined}
                        trailing={<Stamp meaning={stamp.meaning}>{stamp.label}</Stamp>}
                      />
                    );
                  })}
                  <Button
                    label="Commit all…"
                    variant="secondary"
                    onPress={screen.openCommit}
                    disabled={running !== null}
                    className={styles.inline}
                  />
                </>
              )}
            </div>

            {repo.stashes.length > 0 ? (
              <div className={styles.list}>
                <ListLabel>Stashes</ListLabel>
                {repo.stashes.map((stash) => (
                  <ListRow
                    key={stash.index}
                    title={stash.message}
                    eyebrow={`stash@{${stash.index}}`}
                    trailing={stash.own ? <Stamp meaning="parked">daemon</Stamp> : undefined}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {screen.commits.length > 0 ? (
          <div className={styles.list}>
            <ListLabel>Recent commits</ListLabel>
            {screen.commits.map((commit) => (
              <ListRow
                key={commit.hash}
                title={commit.subject}
                eyebrow={commitEyebrow([commit.prefix, commit.ideaId, relativeDay(commit.date)])}
                trailing={commit.pushed ? undefined : <Stamp meaning="parked">local</Stamp>}
                muted={commit.pushed}
              />
            ))}
          </div>
        ) : null}
      </div>

      <CommitSheet
        visible={screen.committing}
        entries={repo?.entries ?? []}
        onClose={screen.closeCommit}
        suggest={screen.suggest}
        commit={screen.commit}
      />
    </div>
  );
};
