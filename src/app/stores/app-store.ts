import {
  DEFAULT_PLAN_LIST_FILTERS,
  type PlanListFilters,
  type PlanSortKey,
} from '@/app/features/plans/helpers';
import { fetchCapabilities } from '@/app/services/system';
import type {
  AgentTaskState,
  ArchivableIdea,
  BranchHygieneStatus,
  CapabilityResult,
  CheckName,
  ConsistencyIssue,
  GitStatusEntry,
  GitStatusResponse,
  IdeaEntry,
  IdeaStatus,
  ParseResult,
  PlanEntry,
  PlanStatus,
  RoadmapItem,
  SuggestionEntry,
  TaskLogEntry,
} from '@/types/index';
import { create } from 'zustand';
import {
  fetchAgentStatus,
  fetchReconcileQueue,
  launchAgent,
  launchBatchReconcile,
  launchFixReview,
  launchIdeaExtend,
  launchPlanAudit,
  launchPlanDraft,
  launchPlanReconcile,
  launchRunAll,
  launchSuggestIdeas,
  stopAgent,
} from '../services/agent-api';
import {
  archiveIdeas as archiveIdeasApi,
  dismissSuggestion as dismissSuggestionApi,
  fetchArchivableIdeas,
  fetchConsistency,
  fetchIdeas,
  fetchPlans,
  fetchRepoDocs,
  fetchSuggestions,
  fetchTaskLog,
  promoteRoadmapItem as promoteRoadmapItemApi,
  promoteSuggestion as promoteSuggestionApi,
} from '../services/content';
import { commitChanges, fetchGitStatus, suggestCommitMessage } from '../services/git-api';
import type { StatusState } from '../services/status-api';
import {
  dropServerCaches,
  fetchStatus,
  triggerCheck,
  triggerQualityFix,
} from '../services/status-api';

export type AppStore = {
  plans: ParseResult<PlanEntry> | null;
  plansLoading: boolean;
  plansError: string | null;
  loadPlans: () => Promise<void>;

  ideaEntries: IdeaEntry[];
  loadIdeas: () => Promise<void>;

  archivableIdeas: ArchivableIdea[];
  loadArchivableIdeas: () => Promise<void>;
  archiveIdeas: (ids: string[]) => Promise<void>;

  // Lifted here (not local state) so the sidebar filter column and the list share one source.
  planFilters: PlanListFilters;
  togglePlanStatus: (status: PlanStatus) => void;
  togglePlanTag: (tag: string) => void;
  toggleNoteStatus: (status: IdeaStatus) => void;
  setPlanSearch: (search: string) => void;
  setSubjectFilter: (subject: string | null) => void;
  setPlanSortKey: (sortKey: PlanSortKey) => void;
  togglePlanSortDirection: () => void;

  suggestions: SuggestionEntry[];
  suggestionsLoading: boolean;
  loadSuggestions: () => Promise<void>;
  promoteSuggestion: (suggestion: SuggestionEntry) => Promise<string>;
  dismissSuggestion: (suggestion: SuggestionEntry) => Promise<void>;

  promoteRoadmapItem: (
    horizonTitle: string,
    item: RoadmapItem,
    subject?: string,
    candidateName?: string,
  ) => Promise<string>;

  taskLog: TaskLogEntry[];
  taskLogLoading: boolean;
  loadTaskLog: () => Promise<void>;

  repoDocs: { name: string; content: string }[];
  repoDocsLoading: boolean;
  loadRepoDocs: () => Promise<void>;

  activeDocTitle: string | null;
  setActiveDocTitle: (title: string | null) => void;

  docSearchQuery: string;
  setDocSearchQuery: (query: string) => void;

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

  agentStatus: AgentTaskState[];
  loadAgentStatus: () => Promise<void>;
  launchAgent: (planId: string, phaseIndex: number) => Promise<void>;
  launchPlanAudit: (planId: string, prompt: string) => Promise<void>;
  launchPlanReconcile: (
    planId: string,
    prompt: string,
    before: ReconcilePreview['before'],
  ) => Promise<void>;
  launchPlanDraft: (ideaId: string, prompt: string) => Promise<void>;
  launchIdeaExtend: (ideaId: string, prompt: string) => Promise<void>;
  launchBatchReconcile: () => Promise<void>;
  launchSuggestIdeas: (prompt: string) => Promise<void>;
  launchRunAll: (planId: string) => Promise<void>;
  launchFixReview: (planId: string) => Promise<void>;
  stopAgent: (taskId?: string) => Promise<void>;

  // Held at store level (not in the button component) so completion is still
  // handled by loadAgentStatus if the user navigates away before the agent finishes.
  pendingReconcile: ReconcilePreview | null;
  reconcileQueue: ReconcilePreview[];
  removeFromReconcileQueue: (planId: string) => void;
  // Guards loadAgentStatus against re-appending the same batch sweep on every poll.
  batchReconcileConsumed: boolean;
};

interface ReconcilePreview {
  planId: string;
  before: { body: string; phases: PlanEntry['phases'] };
}

export const selectAgentBusy = (s: AppStore) =>
  s.agentStatus.some((t) => t.status !== 'done' && t.status !== 'error');

// Capabilities haven't loaded yet: don't block launches on an unknown state.
export const selectHasAnyAgent = (s: AppStore) =>
  s.capabilities.length === 0 ||
  s.capabilities.some((c) => c.id.startsWith('agent:') && c.status === 'ok');

export const selectGhOk = (s: AppStore) => {
  const gh = s.capabilities.find((c) => c.id === 'gh');
  return gh === undefined || gh.status === 'ok';
};

export const selectCapabilityGapCount = (s: AppStore) =>
  s.capabilities.filter((c) => c.status !== 'ok').length;

type SetState = (partial: Partial<AppStore>) => void;

// Collapses the fetch → set-on-success → fallback-on-error shape every load-slice below
// re-spelled by hand; `loadingKey` is only needed by slices that show a spinner meanwhile.
function loadSlice<T>(
  set: SetState,
  fetcher: () => Promise<T>,
  apply: (data: T) => Partial<AppStore>,
  fallback: (err: unknown) => Partial<AppStore> = () => ({}),
  loadingKey?: keyof AppStore,
): () => Promise<void> {
  return async () => {
    if (loadingKey) set({ [loadingKey]: true } as Partial<AppStore>);
    try {
      const data = await fetcher();
      set({ ...apply(data), ...(loadingKey && { [loadingKey]: false }) });
    } catch (err) {
      set({ ...fallback(err), ...(loadingKey && { [loadingKey]: false }) });
    }
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  plans: null,
  plansLoading: false,
  plansError: null,
  loadPlans: loadSlice(
    set,
    fetchPlans,
    (data) => ({ plans: data, plansError: null }),
    (err) => ({ plansError: String(err) }),
    'plansLoading',
  ),

  ideaEntries: [],
  loadIdeas: loadSlice(
    set,
    fetchIdeas,
    (result) => ({ ideaEntries: result.entries }),
    () => ({ ideaEntries: [] }),
  ),

  archivableIdeas: [],
  loadArchivableIdeas: loadSlice(
    set,
    fetchArchivableIdeas,
    (entries) => ({ archivableIdeas: entries }),
    () => ({ archivableIdeas: [] }),
  ),
  archiveIdeas: async (ids) => {
    await archiveIdeasApi(ids);
    await Promise.all([get().loadArchivableIdeas(), get().loadPlans(), get().loadIdeas()]);
  },

  planFilters: DEFAULT_PLAN_LIST_FILTERS,
  togglePlanStatus: (status) =>
    set((s) => ({
      planFilters: {
        ...s.planFilters,
        statuses: s.planFilters.statuses.includes(status)
          ? s.planFilters.statuses.filter((x) => x !== status)
          : [...s.planFilters.statuses, status],
      },
    })),
  togglePlanTag: (tag) =>
    set((s) => ({
      planFilters: {
        ...s.planFilters,
        tags: s.planFilters.tags.includes(tag)
          ? s.planFilters.tags.filter((x) => x !== tag)
          : [...s.planFilters.tags, tag],
      },
    })),
  toggleNoteStatus: (status) =>
    set((s) => ({
      planFilters: {
        ...s.planFilters,
        noteStatuses: s.planFilters.noteStatuses.includes(status)
          ? s.planFilters.noteStatuses.filter((x) => x !== status)
          : [...s.planFilters.noteStatuses, status],
      },
    })),
  setPlanSearch: (search) => set((s) => ({ planFilters: { ...s.planFilters, search } })),
  setSubjectFilter: (subject) => set((s) => ({ planFilters: { ...s.planFilters, subject } })),
  setPlanSortKey: (sortKey) => set((s) => ({ planFilters: { ...s.planFilters, sortKey } })),
  togglePlanSortDirection: () =>
    set((s) => ({
      planFilters: {
        ...s.planFilters,
        sortDirection: s.planFilters.sortDirection === 'asc' ? 'desc' : 'asc',
      },
    })),

  suggestions: [],
  suggestionsLoading: true,
  loadSuggestions: loadSlice(
    set,
    fetchSuggestions,
    (data) => ({ suggestions: data.entries }),
    () => ({ suggestions: [] }),
    'suggestionsLoading',
  ),
  promoteSuggestion: async (suggestion) => {
    const { id } = await promoteSuggestionApi(suggestion);
    await Promise.all([get().loadSuggestions(), get().loadPlans(), get().loadIdeas()]);
    return id;
  },
  dismissSuggestion: async (suggestion) => {
    await dismissSuggestionApi(suggestion);
    await get().loadSuggestions();
  },

  promoteRoadmapItem: async (horizonTitle, item, subject, candidateName) => {
    const { id } = await promoteRoadmapItemApi(horizonTitle, item, subject, candidateName);
    await Promise.all([get().loadPlans(), get().loadIdeas()]);
    return id;
  },

  taskLog: [],
  taskLogLoading: true,
  loadTaskLog: loadSlice(
    set,
    fetchTaskLog,
    (data) => ({ taskLog: data.entries }),
    () => ({ taskLog: [] }),
    'taskLogLoading',
  ),

  repoDocs: [],
  repoDocsLoading: true,
  loadRepoDocs: async () => {
    set({ repoDocsLoading: true });
    try {
      const data = await fetchRepoDocs();
      set({ repoDocs: data.files, repoDocsLoading: false });
      const { activeDocTitle } = get();
      if (!activeDocTitle) {
        const readme = ['MAIN.md', 'README.md'].find((name) =>
          data.files.some((f) => f.name === name),
        );
        if (readme) set({ activeDocTitle: readme });
      }
    } catch {
      set({ repoDocs: [], repoDocsLoading: false });
    }
  },

  activeDocTitle: null,
  setActiveDocTitle: (title) => set({ activeDocTitle: title }),

  docSearchQuery: '',
  setDocSearchQuery: (query) => set({ docSearchQuery: query }),

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

  agentStatus: [],
  loadAgentStatus: async () => {
    try {
      const data = await fetchAgentStatus();
      set({ agentStatus: data });

      const pending = get().pendingReconcile;
      const reconcileTask = pending
        ? data.find((t) => t.taskKind === 'reconcile' && t.planId === pending.planId)
        : undefined;
      if (pending && reconcileTask) {
        if (reconcileTask.status === 'done') {
          // loadPlans first: if it throws, pendingReconcile stays set and retries.
          await get().loadPlans();
          set((s) => ({ reconcileQueue: [...s.reconcileQueue, pending], pendingReconcile: null }));
        } else if (reconcileTask.status === 'error') {
          set({ pendingReconcile: null });
        }
      }

      const batchTask = data.find((t) => t.taskKind === 'batch-reconcile');
      if (batchTask?.status === 'done' && !get().batchReconcileConsumed) {
        const results = await fetchReconcileQueue();
        if (results && results.length > 0) {
          await get().loadPlans();
          set((s) => ({
            reconcileQueue: [
              ...s.reconcileQueue,
              ...results.map((r) => ({ planId: r.planId, before: r.before })),
            ],
          }));
        }
        // Set only after the fetch+append succeeds, so a throw here leaves it false and retries.
        set({ batchReconcileConsumed: true });
      }
    } catch {}
  },
  launchAgent: async (planId, phaseIndex) => {
    await launchAgent(planId, phaseIndex);
    await get().loadAgentStatus();
  },
  launchPlanAudit: async (planId, prompt) => {
    await launchPlanAudit(planId, prompt);
    await get().loadAgentStatus();
  },
  launchPlanReconcile: async (planId, prompt, before) => {
    // Refuse rather than overwrite: clearing an existing pendingReconcile on a second
    // launch would strip its diff safety net, and a same-plan relaunch is reachable
    // (navigate away mid-reconcile and back resets ReconcileButton's local flag).
    const existing = get().pendingReconcile;
    if (existing) {
      throw new Error(
        existing.planId === planId
          ? 'A reconcile is already in progress for this plan'
          : 'A reconcile is already in progress for another plan',
      );
    }
    set({ pendingReconcile: { planId, before } });
    try {
      await launchPlanReconcile(planId, prompt);
    } catch (err) {
      set({ pendingReconcile: null });
      throw err;
    }
    await get().loadAgentStatus();
  },
  launchPlanDraft: async (ideaId, prompt) => {
    await launchPlanDraft(ideaId, prompt);
    await get().loadAgentStatus();
  },
  launchIdeaExtend: async (ideaId, prompt) => {
    await launchIdeaExtend(ideaId, prompt);
    await get().loadAgentStatus();
  },
  launchBatchReconcile: async () => {
    // Reset here, not by polling for a non-'done' status — a fast poll can miss it.
    set({ batchReconcileConsumed: false });
    await launchBatchReconcile();
    await get().loadAgentStatus();
  },
  launchSuggestIdeas: async (prompt) => {
    await launchSuggestIdeas(prompt);
    await get().loadAgentStatus();
  },
  launchRunAll: async (planId) => {
    await launchRunAll(planId);
    await get().loadAgentStatus();
  },
  launchFixReview: async (planId) => {
    await launchFixReview(planId);
    await get().loadAgentStatus();
  },
  stopAgent: async (taskId) => {
    try {
      await stopAgent(taskId);
    } finally {
      await get().loadAgentStatus();
    }
  },

  pendingReconcile: null,
  reconcileQueue: [],
  removeFromReconcileQueue: (planId) =>
    set((s) => ({ reconcileQueue: s.reconcileQueue.filter((item) => item.planId !== planId) })),
  batchReconcileConsumed: false,
}));
