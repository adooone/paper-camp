import type { CiReleaseState } from '@/types/index';
import { Hand } from '../ui/hand';
import {
  type RepoCommit,
  type RepoGit,
  RUN_WORD,
  relativeDay,
  releaseLine,
  repoProgress,
} from './repo-status';
import styles from './repo-status-card.module.css';

interface RepoStatusCardProps {
  ci: CiReleaseState | null;
  git: RepoGit | null;
  latest: RepoCommit | null;
}

const MAX_RUNS = 3;

export function RepoStatusCard({ ci, git, latest }: RepoStatusCardProps) {
  if (!ci && !git) return null;
  const runs = ci?.available ? (ci.runs ?? []).slice(0, MAX_RUNS) : [];
  return (
    <div className={styles.card}>
      {runs.map((run) => (
        <div key={run.url ?? run.workflow} className={styles.row}>
          <span className={`${styles.dot} ${styles[run.status]}`} aria-hidden="true" />
          <Hand size="sm" bold numberOfLines={1}>
            {run.workflow}
          </Hand>
          <Hand size="sm" color="inkSoft" numberOfLines={1}>
            {`${RUN_WORD[run.status]}${run.failedJobs?.length ? ` · ${run.failedJobs.join(', ')}` : ''}`}
          </Hand>
        </div>
      ))}
      {ci?.available ? (
        <Hand size="sm" color="inkSoft" numberOfLines={1}>
          {releaseLine(ci)}
        </Hand>
      ) : null}
      {git ? (
        <Hand size="sm" color="inkSoft" numberOfLines={1}>
          {repoProgress(git)}
        </Hand>
      ) : null}
      {latest ? (
        <Hand size="xs" color="inkFaint" numberOfLines={1}>
          {`${latest.subject} · ${relativeDay(latest.date)}`}
        </Hand>
      ) : null}
    </div>
  );
}
