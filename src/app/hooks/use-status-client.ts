import type { AgentTaskStatus, RateLimitSnapshot } from '@/types/index';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StatusBarCoreProps } from '../components/shell/status-bar-core';
import { fetchAgentStatus } from '../services/agent-api';
import { apiUrl } from '../services/api-base';
import {
  commitChanges,
  fetchGitStatus,
  pullFromOrigin,
  pushChanges,
  suggestCommitMessage,
  syncToMain,
} from '../services/git-api';
import { fetchAgentAuthStatus, fetchCapabilities } from '../services/system';

// Extends (doesn't modify) StatusBarCoreProps — the desk's StatusBarCore only
// destructures its own known props, so extra fields here are invisible to it;
// TypeScript's excess-property check only fires on object literals, not on a
// value passed through a variable/spread.
export type StatusClientState = Omit<StatusBarCoreProps, 'onOpenSetup'> & {
  suggesting: boolean;
  suggestCommit: () => Promise<{ title: string; message: string } | null>;
  commitWithTitle: (title: string, message?: string) => Promise<boolean>;
};

type GitAction = 'push' | 'sync' | 'pull';

const ACTIVE_TASK_STATUSES: AgentTaskStatus[] = ['starting', 'running', 'stopping'];

export function useStatusClient(): StatusClientState {
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  const [gitAhead, setGitAhead] = useState(0);
  const [changedFileCount, setChangedFileCount] = useState(0);
  const [gitBranchHygiene, setGitBranchHygiene] =
    useState<StatusBarCoreProps['gitBranchHygiene']>(null);
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
    const source = new EventSource(apiUrl('/api/activity/stream'));
    const timers: Record<string, ReturnType<typeof setTimeout> | undefined> = {};
    const schedule = (key: string, run: () => void, ms: number) => {
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = setTimeout(run, ms);
    };
    source.onmessage = (event) => {
      let payload: { message?: string; type?: string };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
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
    };
    return () => {
      for (const timer of Object.values(timers)) if (timer) clearTimeout(timer);
      source.close();
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

  // Split out of onQuickCommit for a compose flow (edit-before-commit): the
  // embed has no store, so — like onQuickCommit — this reads the same
  // changedFilesRef rather than taking a files argument from the caller.
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
