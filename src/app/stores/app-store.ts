import {
  DEFAULT_PLAN_LIST_FILTERS,
  type PlanListFilters,
  type PlanSortKey,
} from '@/app/features/plans/helpers';
import type {
  AgentTaskState,
  BranchHygieneStatus,
  CheckName,
  ConsistencyIssue,
  DecisionEntry,
  GitStatusEntry,
  GitStatusResponse,
  IdeaEntry,
  IdeaStatus,
  OpenQuestionEntry,
  ParseResult,
  PlanEntry,
  PlanStatus,
  ProgressEntry,
  SuggestionEntry,
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
  fetchConsistency,
  fetchDecisions,
  fetchIdeas,
  fetchOpenQuestions,
  fetchPlans,
  fetchProgress,
  fetchRepoDocs,
  fetchSuggestions,
} from '../services/content';
import { commitChanges, fetchGitStatus, suggestCommitMessage } from '../services/git-api';
import type { StatusState } from '../services/status-api';
import { fetchStatus, triggerCheck, triggerQualityFix } from '../services/status-api';

type AppStore = {
  plans: ParseResult<PlanEntry> | null;
  plansLoading: boolean;
  plansError: string | null;
  loadPlans: () => Promise<void>;

  ideaEntries: IdeaEntry[];
  loadIdeas: () => Promise<void>;

  // Plans-list filters, lifted here so the left filter column and the list itself
  // (separate subtrees since the column renders in the sidebar slot) share one source.
  planFilters: PlanListFilters;
  togglePlanStatus: (status: PlanStatus) => void;
  togglePlanTag: (tag: string) => void;
  toggleNoteStatus: (status: IdeaStatus) => void;
  setPlanSearch: (search: string) => void;
  setPlanSortKey: (sortKey: PlanSortKey) => void;
  togglePlanSortDirection: () => void;

  decisions: DecisionEntry[];
  decisionsLoading: boolean;
  loadDecisions: () => Promise<void>;

  openQuestions: OpenQuestionEntry[];
  openQuestionsLoading: boolean;
  loadOpenQuestions: () => Promise<void>;

  suggestions: SuggestionEntry[];
  suggestionsLoading: boolean;
  loadSuggestions: () => Promise<void>;

  progress: ProgressEntry[];
  progressLoading: boolean;
  loadProgress: () => Promise<void>;

  repoDocs: { name: string; content: string }[];
  repoDocsLoading: boolean;
  loadRepoDocs: () => Promise<void>;

  activeDocTitle: string | null;
  setActiveDocTitle: (title: string | null) => void;

  docSearchQuery: string;
  setDocSearchQuery: (query: string) => void;

  activeSettingsSection: string;
  setActiveSettingsSection: (section: string) => void;

  settingsConfigFiles: string[];
  setSettingsConfigFiles: (files: string[]) => void;

  status: StatusState | null;
  loadStatus: () => Promise<void>;
  runCheck: (name: CheckName) => Promise<void>;
  fixQuality: () => Promise<void>;
  // One-click commit for the status bar: suggests a message from the diff and
  // commits every changed file (the same suggest+commit the Stack form uses).
  // Returns a result so the caller can toast success/failure.
  quickCommit: () => Promise<{ ok: boolean; title?: string; error?: string; warning?: string }>;
  // Shared across the status bar's quickCommit and the Stack panel's commit
  // form so the two flows can't race the same commit request.
  commitInFlight: boolean;
  setCommitInFlight: (inFlight: boolean) => void;

  consistency: ConsistencyIssue[];
  loadConsistency: () => Promise<void>;

  gitStatus: GitStatusEntry[] | null;
  gitBranch: string | null;
  gitAhead: number;
  gitBranchHygiene: BranchHygieneStatus | null;
  // Resolves to false when the refresh silently failed (state is unchanged/stale)
  // so callers like quickCommit can tell that apart from a real success.
  loadGitStatus: () => Promise<boolean>;

  agentStatus: AgentTaskState | null;
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
  stopAgent: () => Promise<void>;

  // Snapshot captured when a single-plan reconcile is launched, held at store level
  // (not in the button component) so an in-flight reconcile's completion is still
  // handled if the user navigates away before the agent finishes. Consumed by
  // loadAgentStatus when the reconcile task reaches 'done', at which point it's
  // pushed onto reconcileQueue.
  pendingReconcile: ReconcilePreview | null;
  // Ordered queue of proposed rewrites awaiting review, one entry per entity, each
  // held for a before/after diff panel until the user approves (keeps it) or
  // discards (reverts it). Fed either by a single Reconcile completing (one entry)
  // or by a batch reconcile sweep completing (many entries at once, fetched from
  // GET /api/agent/reconcile-queue — see loadAgentStatus).
  reconcileQueue: ReconcilePreview[];
  removeFromReconcileQueue: (planId: string) => void;
  // Guards loadAgentStatus against re-fetching/re-appending the same batch reconcile
  // sweep's results on every poll while its task stays 'done' as `current`.
  batchReconcileConsumed: boolean;
};

interface ReconcilePreview {
  planId: string;
  before: { body: string; phases: PlanEntry['phases'] };
}

export const useAppStore = create<AppStore>((set, get) => ({
  plans: null,
  plansLoading: false,
  plansError: null,
  loadPlans: async () => {
    set({ plansLoading: true });
    try {
      const data = await fetchPlans();
      set({
        plans: data,
        plansError: null,
        plansLoading: false,
      });
    } catch (err) {
      set({ plansError: String(err), plansLoading: false });
    }
  },

  ideaEntries: [],
  loadIdeas: async () => {
    try {
      const result = await fetchIdeas();
      set({ ideaEntries: result.entries });
    } catch {
      set({ ideaEntries: [] });
    }
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
  setPlanSortKey: (sortKey) => set((s) => ({ planFilters: { ...s.planFilters, sortKey } })),
  togglePlanSortDirection: () =>
    set((s) => ({
      planFilters: {
        ...s.planFilters,
        sortDirection: s.planFilters.sortDirection === 'asc' ? 'desc' : 'asc',
      },
    })),

  decisions: [],
  decisionsLoading: true,
  loadDecisions: async () => {
    set({ decisionsLoading: true });
    try {
      const data = await fetchDecisions();
      set({ decisions: data.entries, decisionsLoading: false });
    } catch {
      set({ decisions: [], decisionsLoading: false });
    }
  },

  openQuestions: [],
  openQuestionsLoading: true,
  loadOpenQuestions: async () => {
    set({ openQuestionsLoading: true });
    try {
      const data = await fetchOpenQuestions();
      set({ openQuestions: data.entries, openQuestionsLoading: false });
    } catch {
      set({ openQuestions: [], openQuestionsLoading: false });
    }
  },

  suggestions: [],
  suggestionsLoading: true,
  loadSuggestions: async () => {
    set({ suggestionsLoading: true });
    try {
      const data = await fetchSuggestions();
      set({ suggestions: data.entries, suggestionsLoading: false });
    } catch {
      set({ suggestions: [], suggestionsLoading: false });
    }
  },

  progress: [],
  progressLoading: true,
  loadProgress: async () => {
    set({ progressLoading: true });
    try {
      const data = await fetchProgress();
      set({ progress: data.entries, progressLoading: false });
    } catch {
      set({ progress: [], progressLoading: false });
    }
  },

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

  activeSettingsSection: 'general',
  setActiveSettingsSection: (section) => set({ activeSettingsSection: section }),

  settingsConfigFiles: [],
  setSettingsConfigFiles: (files) => set({ settingsConfigFiles: files }),

  status: null,
  loadStatus: async () => {
    try {
      const data = await fetchStatus();
      set({ status: data });
    } catch {
      // keep previous status
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
  loadConsistency: async () => {
    try {
      const data = await fetchConsistency();
      set({ consistency: data });
    } catch {
      // keep previous status
    }
  },

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
      // keep previous status
      return false;
    }
  },

  agentStatus: null,
  loadAgentStatus: async () => {
    try {
      const data = await fetchAgentStatus();
      set({ agentStatus: data });

      // Hand a finished single-plan reconcile's snapshot to the review queue. Lives
      // here (not in ReconcileButton) so it fires regardless of which plan view is
      // mounted.
      const pending = get().pendingReconcile;
      if (pending && data?.taskKind === 'reconcile' && data.planId === pending.planId) {
        if (data.status === 'done') {
          // loadPlans first: if it throws, pendingReconcile stays set and retries.
          await get().loadPlans();
          set((s) => ({ reconcileQueue: [...s.reconcileQueue, pending], pendingReconcile: null }));
        } else if (data.status === 'error') {
          set({ pendingReconcile: null });
        }
      }

      // Hand a finished batch reconcile sweep's per-entity snapshots to the review
      // queue, fetched from the server since (unlike single Reconcile) the client
      // never captured a `before` snapshot itself. Guarded by batchReconcileConsumed
      // so repeated polls of the same 'done' status don't re-append the same entries;
      // the guard is reset at the next launch (see launchBatchReconcile).
      if (
        data?.taskKind === 'batch-reconcile' &&
        data.status === 'done' &&
        !get().batchReconcileConsumed
      ) {
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
        // Mark consumed only after the fetch+append succeeds. If fetchReconcileQueue
        // throws, the catch below leaves the guard false so the next poll retries,
        // rather than permanently skipping a finished batch. The guard is reset at
        // launch (see launchBatchReconcile), not by observing a non-'done' poll.
        set({ batchReconcileConsumed: true });
      }
    } catch {
      // keep previous status
    }
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
    // Don't clobber an in-flight reconcile's snapshot: if one is already pending
    // (same plan or not), refuse rather than overwrite it. Only one agent task
    // runs at a time, so a second launch would 409 anyway — and clearing the slot
    // on that failure would strip the earlier reconcile's diff safety net. A
    // same-plan relaunch is reachable too (navigate away mid-reconcile and back —
    // ReconcileButton's local `launching` flag resets on remount).
    const existing = get().pendingReconcile;
    if (existing) {
      throw new Error(
        existing.planId === planId
          ? 'A reconcile is already in progress for this plan'
          : 'A reconcile is already in progress for another plan',
      );
    }
    // Record the pre-launch snapshot in the store before firing, so completion
    // is handled by loadAgentStatus even if the launching component unmounts.
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
    // Reset the consumed guard at launch (not by polling for an intermediate
    // non-'done' status, which a fast poll can miss) so this sweep's results
    // are shown even if the previous batch's 'done' was already consumed.
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
  stopAgent: async () => {
    await stopAgent();
    await get().loadAgentStatus();
  },

  pendingReconcile: null,
  reconcileQueue: [],
  removeFromReconcileQueue: (planId) =>
    set((s) => ({ reconcileQueue: s.reconcileQueue.filter((item) => item.planId !== planId) })),
  batchReconcileConsumed: false,
}));
