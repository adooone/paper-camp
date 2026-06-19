import type { DecisionEntry, OpenQuestionEntry, ParseResult, PlanEntry, ProgressEntry } from '@/types/index';
import { create } from 'zustand';
import { fetchDecisions, fetchOpenQuestions, fetchProgress, fetchRepoDocs } from '../services/docs-api';
import { fetchIdeas } from '../services/ideas-api';
import { fetchPlans } from '../services/plans-api';

interface IdeaEntry {
  title: string;
  body: string;
}

const parseIdeas = (content: string): IdeaEntry[] => {
  const sections = content.split(/\n---+\n/).filter(Boolean);
  return sections.map((section) => {
    const headingMatch = section.match(/^#{1,3}\s+(.+)/m);
    const title = headingMatch
      ? headingMatch[1].trim()
      : (section.trim().split('\n')[0]?.trim() ?? 'Untitled');
    return { title, body: section.trim() };
  });
};

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
  setActiveDocSection: (section: 'decisions' | 'questions' | 'progress' | 'repo-docs' | null) => void;

  activeDocTitle: string | null;
  setActiveDocTitle: (title: string | null) => void;

  docSearchQuery: string;
  setDocSearchQuery: (query: string) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  plans: null,
  plansLoading: false,
  plansError: null,
  loadPlans: async () => {
    set({ plansLoading: true });
    try {
      const data = await fetchPlans();
      set({ plans: data, plansError: null, plansLoading: false });
    } catch (err) {
      set({ plansError: String(err), plansLoading: false });
    }
  },

  ideasContent: null,
  ideaEntries: [],
  loadIdeas: async () => {
    try {
      const content = await fetchIdeas();
      set({ ideasContent: content, ideaEntries: content.trim() ? parseIdeas(content) : [] });
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
  decisionsLoading: false,
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
  openQuestionsLoading: false,
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
  progressLoading: false,
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
  repoDocsLoading: false,
  loadRepoDocs: async () => {
    set({ repoDocsLoading: true });
    try {
      const data = await fetchRepoDocs();
      set({ repoDocs: data.files, repoDocsLoading: false });
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
}));
