import { fetchCapabilities } from '@/app/services/system';
import type {
  BranchHygieneStatus,
  CapabilityResult,
  CheckName,
  ConsistencyIssue,
  GitStatusEntry,
} from '@/types/index';
import { fetchConsistency } from '../../services/content';
import { commitChanges, fetchGitStatus, suggestCommitMessage } from '../../services/git-api';
import type { StatusState } from '../../services/status-api';
import {
  dropServerCaches,
  fetchStatus,
  triggerCheck,
  triggerQualityFix,
} from '../../services/status-api';
import type { GetState, SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type StatusSlice = {
  status: StatusState | null;
  loadStatus: () => Promise<void>;
  refreshAll: () => Promise<{ ok: boolean; error?: string }>;
  refreshing: boolean;
  runCheck: (name: CheckName) => Promise<void>;
  fixQuality: () => Promise<void>;
  quickCommit: () => Promise<{ ok: boolean; title?: string; error?: string; warning?: string }>;
  // Shared by the status bar and the Stack panel so the two commit flows can't race.
  commitInFlight: boolean;
  setCommitInFlight: (inFlight: boolean) => void;

  // Shared across every useBranchSync() mount so push/sync/pull can't run concurrently.
  activeGitAction: 'push' | 'sync' | 'pull' | null;
  setActiveGitAction: (action: 'push' | 'sync' | 'pull' | null) => void;

  consistency: ConsistencyIssue[];
  loadConsistency: () => Promise<void>;

  gitStatus: GitStatusEntry[] | null;
  gitBranch: string | null;
  gitAhead: number;
  gitBranchHygiene: BranchHygieneStatus | null;
  // Resolves false on failure (state left stale) so callers like quickCommit can tell.
  loadGitStatus: () => Promise<boolean>;

  // Empty until loaded; gating selectors treat empty as "unknown" and don't block on it.
  capabilities: CapabilityResult[];
  loadCapabilities: () => Promise<void>;
};

export function createStatusSlice(set: SetState, get: GetState): StatusSlice {
  return {
    status: null,
    refreshing: false,
    loadStatus: loadSlice(set, fetchStatus, (data) => ({ status: data })),
    refreshAll: async () => {
      set({ refreshing: true });
      try {
        await dropServerCaches().catch(() => {});
        await Promise.all([
          get().loadPlans(),
          get().loadIdeas(),
          get().loadArchivableIdeas(),
          get().loadSuggestions(),
          get().loadStatus(),
          get().loadConsistency(),
          get().loadGitStatus(),
          get().loadAgentStatus(),
          get().loadAgentAuthStatus(),
        ]);
        // plansError is the one loader that surfaces failure; the rest swallow theirs.
        const error = get().plansError;
        return error ? { ok: false, error } : { ok: true };
      } finally {
        set({ refreshing: false });
      }
    },
    runCheck: async (name) => {
      try {
        await triggerCheck(name);
      } catch {}
    },
    fixQuality: async () => {
      try {
        await triggerQualityFix();
      } catch {}
    },

    commitInFlight: false,
    setCommitInFlight: (inFlight) => set({ commitInFlight: inFlight }),

    activeGitAction: null,
    setActiveGitAction: (action) => set({ activeGitAction: action }),
    quickCommit: async () => {
      const { gitStatus, loadGitStatus, commitInFlight } = get();
      if (commitInFlight) {
        return { ok: false, error: 'A commit is already in progress' };
      }
      if (!gitStatus || gitStatus.length === 0) {
        return { ok: false, error: 'Nothing to commit' };
      }
      const files = gitStatus.map((e) => e.path);
      set({ commitInFlight: true });
      try {
        const { title, message } = await suggestCommitMessage(files);
        await commitChanges(files, title, message || undefined);
        const refreshed = await loadGitStatus();
        return refreshed
          ? { ok: true, title }
          : {
              ok: true,
              title,
              warning: 'Committed, but the git status refresh failed — reload to confirm',
            };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      } finally {
        set({ commitInFlight: false });
      }
    },

    consistency: [],
    loadConsistency: loadSlice(set, fetchConsistency, (data) => ({ consistency: data })),

    gitStatus: null,
    gitBranch: null,
    gitAhead: 0,
    gitBranchHygiene: null,
    loadGitStatus: async () => {
      try {
        const { branch, entries, ahead, branchHygiene } = await fetchGitStatus();
        set({
          gitStatus: entries,
          gitBranch: branch,
          gitAhead: ahead,
          gitBranchHygiene: branchHygiene,
        });
        return true;
      } catch {
        return false;
      }
    },

    capabilities: [],
    loadCapabilities: loadSlice(
      set,
      fetchCapabilities,
      (data) => ({ capabilities: data ?? [] }),
      () => ({ capabilities: [] }),
    ),
  };
}
