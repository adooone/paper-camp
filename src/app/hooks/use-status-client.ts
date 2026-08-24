import type { AgentTaskStatus, BranchHygieneStatus, RateLimitSnapshot } from '@/types/index';
import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToActivityStream } from '../services/activity-stream';
import { fetchAgentStatus } from '../services/agent-api';
import {
  commitChanges,
  fetchGitStatus,
  pullFromOrigin,
  pushChanges,
  suggestCommitMessage,
  syncToMain,
} from '../services/git-api';
import { fetchAgentAuthStatus, fetchCapabilities } from '../services/system';

// The embed has no store of its own — this is the Scout panel's independent poll-and-mutate
// client for its git banner, distinct from the desk's StatusBarCore/useAppStore path.
export type StatusClientState = {
  gitBranch: string | null;
  gitAhead: number;
  changedFileCount: number;
  agentActive: boolean;
  activeTaskStatus?: AgentTaskStatus;
  agentNotSignedIn: boolean;
  capabilityGapCount: number;
  rateLimit: RateLimitSnapshot | null;
  gitBranchHygiene: BranchHygieneStatus | null;
  commitInFlight: boolean;
  gitActionBusy: boolean;
  pushing: boolean;
  syncing: boolean;
  pulling: boolean;
  suggesting: boolean;
  onSync: () => void;
  onPush: () => void;
  onPull: () => void;
  onQuickCommit: () => void;
  suggestCommit: () => Promise<{ title: string; message: string } | null>;
  commitWithTitle: (title: string, message?: string) => Promise<boolean>;
};

type GitAction = 'push' | 'sync' | 'pull';

const ACTIVE_TASK_STATUSES: AgentTaskStatus[] = ['starting', 'running', 'stopping'];

export function useStatusClient(): StatusClientState {
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  const [gitAhead, setGitAhead] = useState(0);
  const [changedFileCount, setChangedFileCount] = useState(0);
  const [gitBranchHygiene, setGitBranchHygiene] = useState<BranchHygieneStatus | null>(null);
  const [agentActive, setAgentActive] = useState(false);
  const [activeTaskStatus, setActiveTaskStatus] = useState<AgentTaskStatus | undefined>(undefined);
  const [rateLimit, setRateLimit] = useState<RateLimitSnapshot | null>(null);
  const [agentNotSignedIn, setAgentNotSignedIn] = useState(false);
  const [capabilityGapCount, setCapabilityGapCount] = useState(0);
  const [commitInFlight, setCommitInFlight] = useState(false);
  const [gitAction, setGitAction] = useState<GitAction | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const changedFilesRef = useRef<string[]>([]);
  const gitActionRef = useRef<GitAction | null>(null);
  const commitInFlightRef = useRef(false);

  const loadGitStatus = useCallback(async () => {
    try {
      const { branch, entries, ahead, branchHygiene } = await fetchGitStatus();
      changedFilesRef.current = entries.map((entry) => entry.path);
      setGitBranch(branch);
      setGitAhead(ahead);
      setChangedFileCount(entries.length);
      setGitBranchHygiene(branchHygiene);
    } catch {}
  }, []);

  const loadAgentStatus = useCallback(async () => {
    try {
      const tasks = await fetchAgentStatus();
      const active = tasks.find((task) => ACTIVE_TASK_STATUSES.includes(task.status));
      setAgentActive(active !== undefined);
      setActiveTaskStatus(active?.status);
      setRateLimit(tasks.find((task) => task.rateLimit)?.rateLimit ?? null);
    } catch {}
  }, []);

  useEffect(() => {
    loadGitStatus();
    loadAgentStatus();
    fetchCapabilities().then((capabilities) =>
      setCapabilityGapCount(capabilities?.filter((c) => c.status !== 'ok').length ?? 0),
    );
    fetchAgentAuthStatus().then((status) => setAgentNotSignedIn(status?.loggedIn === false));
  }, [loadGitStatus, loadAgentStatus]);

  useEffect(() => {
    const timers: Record<string, ReturnType<typeof setTimeout> | undefined> = {};
    const schedule = (key: string, run: () => void, ms: number) => {
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = setTimeout(run, ms);
    };
    const unsubscribe = subscribeToActivityStream((payload) => {
      if (payload.type === 'status') {
        schedule('git', () => loadGitStatus(), 80);
        return;
      }
      if (payload.type === 'agent') {
        schedule('agent', () => loadAgentStatus(), 120);
        return;
      }
      if (payload.message !== 'changed') return;
      schedule(
        'activity',
        () => {
          loadGitStatus();
          loadAgentStatus();
        },
        250,
      );
    });
    return () => {
      for (const timer of Object.values(timers)) if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [loadGitStatus, loadAgentStatus]);

  const runGitAction = useCallback(async (kind: GitAction, action: () => Promise<void>) => {
    if (gitActionRef.current) return;
    gitActionRef.current = kind;
    setGitAction(kind);
    try {
      await action();
    } catch {
    } finally {
      gitActionRef.current = null;
      setGitAction(null);
    }
  }, []);

  const onPush = useCallback(() => {
    runGitAction('push', async () => {
      await pushChanges();
      await loadGitStatus();
    });
  }, [runGitAction, loadGitStatus]);

  const onSync = useCallback(() => {
    runGitAction('sync', async () => {
      const result = await syncToMain();
      if (!result.ok) throw new Error(result.message);
      await loadGitStatus();
    });
  }, [runGitAction, loadGitStatus]);

  const onPull = useCallback(() => {
    runGitAction('pull', async () => {
      await pullFromOrigin();
      await loadGitStatus();
    });
  }, [runGitAction, loadGitStatus]);

  const onQuickCommit = useCallback(() => {
    const files = changedFilesRef.current;
    if (commitInFlightRef.current || gitActionRef.current || files.length === 0) return;
    commitInFlightRef.current = true;
    setCommitInFlight(true);
    (async () => {
      try {
        const { title, message } = await suggestCommitMessage(files);
        await commitChanges(files, title, message || undefined);
        await loadGitStatus();
      } catch {
      } finally {
        commitInFlightRef.current = false;
        setCommitInFlight(false);
      }
    })();
  }, [loadGitStatus]);

  // Split out of onQuickCommit for a compose flow (edit-before-commit): reads the
  // same changedFilesRef, since the embed has no store to pass files through.
  const suggestCommit = useCallback(async () => {
    const files = changedFilesRef.current;
    if (files.length === 0) return null;
    setSuggesting(true);
    try {
      return await suggestCommitMessage(files);
    } catch {
      return null;
    } finally {
      setSuggesting(false);
    }
  }, []);

  const commitWithTitle = useCallback(
    async (title: string, message?: string) => {
      const files = changedFilesRef.current;
      const trimmedTitle = title.trim();
      if (
        commitInFlightRef.current ||
        gitActionRef.current ||
        files.length === 0 ||
        !trimmedTitle
      ) {
        return false;
      }
      commitInFlightRef.current = true;
      setCommitInFlight(true);
      try {
        await commitChanges(files, trimmedTitle, message?.trim() || undefined);
        await loadGitStatus();
        return true;
      } catch {
        return false;
      } finally {
        commitInFlightRef.current = false;
        setCommitInFlight(false);
      }
    },
    [loadGitStatus],
  );

  return {
    gitBranch,
    gitAhead,
    changedFileCount,
    agentActive,
    activeTaskStatus,
    agentNotSignedIn,
    capabilityGapCount,
    rateLimit,
    gitBranchHygiene,
    commitInFlight,
    gitActionBusy: gitAction !== null,
    pushing: gitAction === 'push',
    syncing: gitAction === 'sync',
    pulling: gitAction === 'pull',
    suggesting,
    onSync,
    onPush,
    onPull,
    onQuickCommit,
    suggestCommit,
    commitWithTitle,
  };
}
