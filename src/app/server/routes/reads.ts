import { join } from 'node:path';
import {
  findConsistencyIssues,
  parseDecisions,
  parseOpenQuestions,
  parseProgress,
} from '@/core/parse';
import { readNoteEntries, readWorkEntries } from '@/core/readers';
import { coerceAgentConfig } from '@/types/index';
import { campFile, readMaybe } from '../helpers';
import { listConfigFiles } from './system';
import type { ReadRoute } from './types';

export const readRoutes: ReadRoute[] = [
  {
    path: '/api/package-name',
    handler: async (root) => {
      const raw = await readMaybe(join(root, 'package.json'));
      if (!raw) return null;
      try {
        const pkg = JSON.parse(raw);
        return pkg.name ?? null;
      } catch {
        return null;
      }
    },
  },
  {
    path: '/api/plans',
    handler: async (root) => readWorkEntries(campFile(root, 'ideas')),
  },
  {
    path: '/api/progress',
    handler: async (root) => ({
      entries: parseProgress(await readMaybe(campFile(root, 'progress.md'))),
    }),
  },
  {
    path: '/api/decisions',
    handler: async (root) => parseDecisions(await readMaybe(campFile(root, 'decisions.md'))),
  },
  {
    path: '/api/open-questions',
    handler: async (root) =>
      parseOpenQuestions(await readMaybe(campFile(root, 'open-questions.md'))),
  },
  {
    path: '/api/ideas',
    handler: async (root) => readNoteEntries(campFile(root, 'ideas')),
  },
  {
    path: '/api/consistency',
    handler: async (root) => {
      const [decisionsRaw, openQuestionsRaw, plansResult] = await Promise.all([
        readMaybe(campFile(root, 'decisions.md')),
        readMaybe(campFile(root, 'open-questions.md')),
        readWorkEntries(campFile(root, 'ideas')),
      ]);
      const decisions = parseDecisions(decisionsRaw);
      const openQuestions = parseOpenQuestions(openQuestionsRaw);
      return findConsistencyIssues(decisions.entries, openQuestions.entries, plansResult.entries);
    },
  },
  {
    path: '/api/config',
    handler: async (root) => {
      const raw = await readMaybe(join(root, 'papercamp', 'config.json'));
      if (!raw) return null;
      const config = JSON.parse(raw);
      // Coerce legacy bare-string defaultAgents (e.g. "phase": "opencode") into
      // the { agent, model?, effort? } shape the settings UI expects — old
      // config.json files predate FEAT-26 and would otherwise crash the page.
      if (config?.defaultAgents) {
        config.defaultAgents = {
          phase: coerceAgentConfig(config.defaultAgents.phase),
          planDraft: coerceAgentConfig(config.defaultAgents.planDraft),
          ideaExtend: coerceAgentConfig(config.defaultAgents.ideaExtend),
          commitSuggest: coerceAgentConfig(config.defaultAgents.commitSuggest),
        };
      }
      return config;
    },
  },
  {
    path: '/api/docs',
    handler: async (root) => {
      const docNames = ['MAIN.md', 'README.md', 'CHANGELOG.md', 'LICENSE'];
      const files: { name: string; content: string }[] = [];
      for (const name of docNames) {
        const content = await readMaybe(join(root, name));
        if (content) files.push({ name, content });
      }
      return { files };
    },
  },
  {
    path: '/api/configs',
    handler: async (root) => listConfigFiles(root),
  },
];
