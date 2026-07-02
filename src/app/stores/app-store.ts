import { deriveIdeaStatuses } from '@/core/idea-status';
import type {
  AgentTaskState,
  BranchHygieneStatus,
  CheckName,
  ConsistencyIssue,
  DecisionEntry,
  GitStatusEntry,
  GitStatusResponse,
  IdeaEntry,
  OpenQuestionEntry,
  ParseResult,
  PlanEntry,
  ProgressEntry,
} from '@/types/index';
import { create } from 'zustand';
import {
  fetchAgentStatus,
  launchAgent,
  launchBatchAudit,
  launchIdeaExtend,
  launchPlanAudit,
  launchPlanDraft,
  launchPlanReconcile,
  launchRunAll,
  stopAgent,
} from '../services/agent-api';
import {
  fetchConsistency,
  fetchDecisions,
  fetchOpenQuestions,
  fetchProgress,
  fetchRepoDocs,
} from '../services/docs-api';
import { fetchGitStatus } from '../services/git-api';
import { fetchIdeas } from '../services/ideas-api';
import { fetchPlans } from '../services/plans-api';
import type { StatusState } from '../services/status-api';
import { fetchStatus, triggerCheck, triggerQualityFix } from '../services/status-api';

type AppStore = {
  plans: ParseResult<PlanEntry> | null;
  plansLoading: boolean;
  plansError: string | null;
  loadPlans: () => Promise<void>;

  ideaEntries: IdeaEntry[];
  loadIdeas: () => Promise<void>;

  activePlanTitle: string | null;
  setActivePlanTitle: (title: string | null) => void;

  activeIdeaTitle: string | null;
  setActiveIdeaTitle: (title: string | null) => void;

  view: 'list' | 'board';
  setView: (v: 'list' | 'board') => void;

  decisions: DecisionEntry[];
  decisionsLoading: boolean;
  loadDecisions: () => Promise<void>;

  openQuestions: OpenQuestionEntry[];
  openQuestionsLoading: boolean;
  loadOpenQuestions: () => Promise<void>;

  progress: ProgressEntry[];
  progressLoading: boolean;
  loadProgress: () => Promise<void>;

  repoDocs: { name: string; content: string }[];
  repoDocsLoading: boolean;
  loadRepoDocs: () => Promise<void>;

  activeDocSection: 'decisions' | 'questions' | 'progress' | 'repo-docs' | null;
  setActiveDocSection: (
    section: 'decisions' | 'questions' | 'progress' | 'repo-docs' | null,
  ) => void;

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

  consistency: ConsistencyIssue[];
  loadConsistency: () => Promise<void>;

  gitStatus: GitStatusEntry[] | null;
  gitBranch: string | null;
  gitAhead: number;
  gitBranchHygiene: BranchHygieneStatus | null;
  loadGitStatus: () => Promise<void>;

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
  launchBatchAudit: () => Promise<void>;
  launchRunAll: (planId: string) => Promise<void>;
  stopAgent: () => Promise<void>;

  // Snapshot captured when a reconcile is launched, held at store level (not in
  // the button component) so an in-flight reconcile's completion is still handled
  // if the user navigates away before the agent finishes. Consumed by
  // loadAgentStatus when the reconcile task reaches 'done'.
  pendingReconcile: ReconcilePreview | null;
  // The proposed rewrite from a reconcile agent run, held for a before/after
  // diff panel until the user approves (keeps it) or discards (reverts it).
  reconcilePreview: ReconcilePreview | null;
  setReconcilePreview: (preview: ReconcilePreview | null) => void;
};

export interface ReconcilePreview {
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
      const { ideaEntries } = get();
      set({
        plans: data,
        plansError: null,
        plansLoading: false,
        ideaEntries: deriveIdeaStatuses(ideaEntries, data.entries),
      });
    } catch (err) {
      set({ plansError: String(err), plansLoading: false });
    }
  },

  ideaEntries: [],
  loadIdeas: async () => {
    try {
      const result = await fetchIdeas();
      const { plans } = get();
      set({
        ideaEntries: deriveIdeaStatuses(result.entries, plans?.entries ?? []),
      });
    } catch {
      set({ ideaEntries: [] });
    }
  },

  activePlanTitle: null,
  setActivePlanTitle: (title) => set({ activePlanTitle: title }),

  activeIdeaTitle: null,
  setActiveIdeaTitle: (title) => set({ activeIdeaTitle: title }),

  view: 'list',
  setView: (v) => set({ view: v }),

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
      const { activeDocSection } = get();
      if (!activeDocSection && data.files.some((f) => f.name === 'MAIN.md')) {
        set({ activeDocSection: 'repo-docs', activeDocTitle: 'MAIN.md' });
      }
    } catch {
      set({ repoDocs: [], repoDocsLoading: false });
    }
  },

  activeDocSection: null,
  setActiveDocSection: (section) => set({ activeDocSection: section }),

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
    } catch {
      // ignore
    }
  },
  fixQuality: async () => {
    try {
      await triggerQualityFix();
    } catch {
      // ignore
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
    } catch {
      // keep previous status
    }
  },

  agentStatus: null,
  loadAgentStatus: async () => {
    try {
      const data = await fetchAgentStatus();
      set({ agentStatus: data });

      // Hand a finished reconcile's snapshot to the diff panel. Lives here (not
      // in ReconcileButton) so it fires regardless of which plan view is mounted.
      const pending = get().pendingReconcile;
      if (pending && data?.taskKind === 'reconcile' && data.planId === pending.planId) {
        if (data.status === 'done') {
          // loadPlans first: if it throws, pendingReconcile stays set and retries.
          await get().loadPlans();
          set({ reconcilePreview: pending, pendingReconcile: null });
        } else if (data.status === 'error') {
          set({ pendingReconcile: null });
        }
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
  launchBatchAudit: async () => {
    await launchBatchAudit();
    await get().loadAgentStatus();
  },
  launchRunAll: async (planId) => {
    await launchRunAll(planId);
    await get().loadAgentStatus();
  },
  stopAgent: async () => {
    await stopAgent();
    await get().loadAgentStatus();
  },

  pendingReconcile: null,
  reconcilePreview: null,
  setReconcilePreview: (preview) => set({ reconcilePreview: preview }),
}));
