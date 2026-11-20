import { useCallback, useMemo, useState } from 'react';
import {
  commitChanges,
  fixGitDivergence,
  pullFromOrigin,
  pushChanges,
  resolveConflict,
  type SyncResult,
  suggestCommitMessage,
  syncToMain,
} from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import type {
  BranchHygieneStatus,
  GitLogCommit,
  GitStashEntry,
  GitStatusEntry,
} from '@/types/index';
import { ACTION_DONE, CONFLICT_MESSAGE, type GitAction, type GitOutcome } from '../shell/git-model';
import { useAgentStatusStream } from './use-agent-status-stream';

export interface GitRepo {
  branch: string;
  entries: GitStatusEntry[];
  stashes: GitStashEntry[];
  ahead: number;
  behind: number;
  diverged: boolean;
  hygiene: BranchHygieneStatus;
}

export interface GitScreenState {
  load: 'loading' | 'unreachable' | 'ready';
  repo: GitRepo | null;
  commits: GitLogCommit[];
  running: GitAction | null;
  outcome: GitOutcome | null;
  handingOff: boolean;
  committing: boolean;
  openCommit: () => void;
  closeCommit: () => void;
  reload: () => Promise<void>;
  run: (action: GitAction) => void;
  handOff: (prompt: string) => void;
  suggest: (files: string[]) => Promise<{ title: string; message: string }>;
  commit: (files: string[], title: string, message: string) => Promise<string | null>;
}

const failure = (cause: unknown): string =>
  cause instanceof Error ? cause.message : 'Action failed.';

const performers: Record<GitAction, () => Promise<SyncResult | undefined>> = {
  pull: async () => pullFromOrigin().then(() => undefined),
  push: async () => pushChanges().then(() => undefined),
  sync: syncToMain,
  'fix-divergence': fixGitDivergence,
};

function outcomeOf(action: GitAction, result: SyncResult | undefined): GitOutcome {
  if (!result || result.ok) return { ok: true, message: ACTION_DONE[action] };
  if ('conflictPrompt' in result) {
    return {
      ok: false,
      message: CONFLICT_MESSAGE,
      conflictedFiles: result.conflictedFiles ?? [],
      conflictPrompt: result.conflictPrompt,
    };
  }
  return {
    ok: false,
    message: result.recovering
      ? `${result.message} An agent is recovering it; watch the Log.`
      : result.message,
  };
}

export function useGitScreen(): GitScreenState {
  useAgentStatusStream();
  const branch = useAppStore((state) => state.gitBranch);
  const entries = useAppStore((state) => state.gitStatus);
  const stashes = useAppStore((state) => state.gitStashes);
  const ahead = useAppStore((state) => state.gitAhead);
  const behind = useAppStore((state) => state.gitBehind);
  const diverged = useAppStore((state) => state.gitDiverged);
  const hygiene = useAppStore((state) => state.gitBranchHygiene);
  const commits = useAppStore((state) => state.gitLogCommits);
  const logFailed = useAppStore((state) => state.gitLogLoadFailed);
  const running = useAppStore((state) => state.activeGitAction);
  const setRunning = useAppStore((state) => state.setActiveGitAction);
  const loadGitStatus = useAppStore((state) => state.loadGitStatus);
  const loadGitLog = useAppStore((state) => state.loadGitLog);
  const [outcome, setOutcome] = useState<GitOutcome | null>(null);
  const [handingOff, setHandingOff] = useState(false);
  const [committing, setCommitting] = useState(false);

  const reload = useCallback(async () => {
    await Promise.all([loadGitStatus(), loadGitLog()]);
  }, [loadGitStatus, loadGitLog]);

  const run = useCallback(
    (action: GitAction) => {
      if (useAppStore.getState().activeGitAction) return;
      setRunning(action);
      setOutcome(null);
      performers[action]()
        .then((result) => setOutcome(outcomeOf(action, result)))
        .catch((cause) => setOutcome({ ok: false, message: failure(cause) }))
        .finally(() => {
          setRunning(null);
          void reload();
        });
    },
    [setRunning, reload],
  );

  const handOff = useCallback((prompt: string) => {
    if (!prompt) return;
    setHandingOff(true);
    resolveConflict(prompt)
      .then((result) =>
        setOutcome(
          result.ok
            ? { ok: true, message: 'An agent is resolving the conflict; watch the Log.' }
            : { ok: false, message: result.error ?? 'The agent did not start.' },
        ),
      )
      .catch((cause) => setOutcome({ ok: false, message: failure(cause) }))
      .finally(() => setHandingOff(false));
  }, []);

  const commit = useCallback(
    async (files: string[], title: string, message: string) => {
      try {
        await commitChanges(files, title, message || undefined);
      } catch (cause) {
        return failure(cause);
      }
      setCommitting(false);
      setOutcome({ ok: true, message: 'Committed.' });
      void reload();
      return null;
    },
    [reload],
  );

  return useMemo(() => {
    const repo: GitRepo | null =
      branch === null
        ? null
        : {
            branch,
            entries: entries ?? [],
            stashes,
            ahead,
            behind,
            diverged,
            hygiene: hygiene ?? 'fine',
          };
    return {
      load: repo ? 'ready' : logFailed ? 'unreachable' : 'loading',
      repo,
      commits: commits ?? [],
      running,
      outcome,
      handingOff,
      committing,
      openCommit: () => setCommitting(true),
      closeCommit: () => setCommitting(false),
      reload,
      run,
      handOff,
      suggest: suggestCommitMessage,
      commit,
    };
  }, [
    branch,
    entries,
    stashes,
    ahead,
    behind,
    diverged,
    hygiene,
    commits,
    logFailed,
    running,
    outcome,
    handingOff,
    committing,
    reload,
    run,
    handOff,
    commit,
  ]);
}
