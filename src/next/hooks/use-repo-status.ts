import { useCiRelease } from '@/app/hooks/use-ci-release';
import { useAppStore } from '@/app/stores/app-store';
import type { CiReleaseState } from '@/types/index';
import type { RepoCommit, RepoGit } from '../shell/repo-status';

export interface RepoStatus {
  ci: CiReleaseState | null;
  git: RepoGit | null;
  latest: RepoCommit | null;
}

export function useRepoStatus(): RepoStatus {
  const { ci } = useCiRelease();
  const gitStatus = useAppStore((state) => state.gitStatus);
  const branch = useAppStore((state) => state.gitBranch);
  const ahead = useAppStore((state) => state.gitAhead);
  const behind = useAppStore((state) => state.gitBehind);
  const latest = useAppStore((state) => state.gitLogCommits?.[0] ?? null);
  return {
    ci,
    git: branch === null ? null : { branch, changed: gitStatus?.length ?? 0, ahead, behind },
    latest,
  };
}
