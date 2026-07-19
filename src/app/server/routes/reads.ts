import { join } from 'node:path';
import {
  findConsistencyIssues,
  parseDecisions,
  parseOpenQuestions,
  parseProgress,
  parseSuggestions,
  parseTaskLog,
} from '@/core/parse';
import { findArchivableIdeas, readNoteEntries, readWorkEntries } from '@/core/readers';
import { coerceAgentConfig } from '@/types/index';
import { cached } from '../corpus-cache';
import { campFile, readMaybe } from '../helpers';
import { listConfigFiles } from './system';
import type { ReadRoute } from './types';

/** Cached readWorkEntries — shared by /api/plans and /api/consistency, one root per key. */
const cachedWorkEntries = (root: string) =>
  cached(`work:${root}`, () => readWorkEntries(campFile(root, 'ideas')));

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
    handler: async (root) => cachedWorkEntries(root),
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
    path: '/api/suggestions',
    handler: async (root) => ({
      entries: parseSuggestions(await readMaybe(campFile(root, 'suggestions.md'))),
    }),
  },
  {
    path: '/api/tasks',
    handler: async (root) => ({
      entries: parseTaskLog(await readMaybe(campFile(root, 'tasks.log'))),
    }),
  },
  {
    path: '/api/ideas',
    handler: async (root) =>
      cached(`notes:${root}`, () => readNoteEntries(campFile(root, 'ideas'))),
  },
  {
    path: '/api/archivable-ideas',
    handler: async (root) =>
      cached(`archivable:${root}`, () => findArchivableIdeas(campFile(root, 'ideas'))),
  },
  {
    path: '/api/consistency',
    handler: async (root) => {
      const [decisionsRaw, openQuestionsRaw, plansResult] = await Promise.all([
        readMaybe(campFile(root, 'decisions.md')),
        readMaybe(campFile(root, 'open-questions.md')),
        cachedWorkEntries(root),
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
      // Coerce legacy bare-string defaultAgents into { agent, model?, effort? } —
      // old config.json files predate FEAT-26 and would otherwise crash the page.
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
