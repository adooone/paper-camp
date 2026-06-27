import { deriveIdeaStatuses, parseIdeas } from '@/core/parser';
import type {
  AgentTaskState,
  CheckName,
  ConsistencyIssue,
  DecisionEntry,
  GitStatusEntry,
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
  launchIdeaExtend,
  launchPlanAudit,
  launchPlanDraft,
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

  ideasContent: string | null;
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
  loadGitStatus: () => Promise<void>;

  agentStatus: AgentTaskState | null;
  loadAgentStatus: () => Promise<void>;
  launchAgent: (planId: string, phaseIndex: number) => Promise<void>;
  launchPlanAudit: (planId: string, prompt: string) => Promise<void>;
  launchPlanDraft: (ideaId: string, prompt: string) => Promise<void>;
  launchIdeaExtend: (ideaId: string, prompt: string) => Promise<void>;
  stopAgent: () => Promise<void>;
};

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

  ideasContent: null,
  ideaEntries: [],
  loadIdeas: async () => {
    try {
      const content = await fetchIdeas();
      const parsed = content.trim() ? parseIdeas(content) : [];
      const { plans } = get();
      set({
        ideasContent: content,
        ideaEntries: deriveIdeaStatuses(parsed, plans?.entries ?? []),
      });
    } catch {
      set({ ideasContent: null, ideaEntries: [] });
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
  loadGitStatus: async () => {
    try {
      const data = await fetchGitStatus();
      set({ gitStatus: data });
    } catch {
      // keep previous status
    }
  },

  agentStatus: null,
  loadAgentStatus: async () => {
    try {
      const data = await fetchAgentStatus();
      set({ agentStatus: data });
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
  launchPlanDraft: async (ideaId, prompt) => {
    await launchPlanDraft(ideaId, prompt);
    await get().loadAgentStatus();
  },
  launchIdeaExtend: async (ideaId, prompt) => {
    await launchIdeaExtend(ideaId, prompt);
    await get().loadAgentStatus();
  },
  stopAgent: async () => {
    await stopAgent();
    await get().loadAgentStatus();
  },
}));
