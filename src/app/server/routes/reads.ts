import { join } from 'node:path';
import { findConsistencyIssues, parseSuggestions, parseTaskLog } from '@/core/parse';
import { findArchivableIdeas, readNoteEntries, readWorkEntries } from '@/core/readers';
import { deriveSubjectVocabulary, parseRoadmap, resolveRoadmap } from '@/core/roadmap';
import { computeProjectStats } from '@/core/stats';
import { DEFAULT_AGENTS, type ProjectStats, coerceAgentConfig } from '@/types/index';
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
      const [plansResult, roadmapRaw] = await Promise.all([
        cachedWorkEntries(root),
        readMaybe(join(root, 'ROADMAP.md')),
      ]);
      const subjectVocabulary = roadmapRaw ? deriveSubjectVocabulary(parseRoadmap(roadmapRaw)) : [];
      return findConsistencyIssues(plansResult.entries, subjectVocabulary);
    },
  },
  {
    path: '/api/stats',
    handler: async (root): Promise<ProjectStats> => computeProjectStats(root),
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
          // Older configs predate this bucket — default it to sonnet/medium rather
          // than the bare-claude-code fallback coerceAgentConfig(undefined) gives.
          feedback: config.defaultAgents.feedback
            ? coerceAgentConfig(config.defaultAgents.feedback)
            : DEFAULT_AGENTS.feedback,
        };
      }
      // subjects is regenerated from ROADMAP.md on every read rather than trusted from
      // disk — the roadmap is the only writable source of the vocabulary (IDEA-95).
      const roadmapRaw = await readMaybe(join(root, 'ROADMAP.md'));
      config.subjects = roadmapRaw ? deriveSubjectVocabulary(parseRoadmap(roadmapRaw)) : [];
      return config;
    },
  },
  {
    path: '/api/roadmap',
    handler: async (root) => {
      const raw = await readMaybe(join(root, 'ROADMAP.md'));
      if (!raw) return null;
      const [{ entries }, taskLogRaw, changelog] = await Promise.all([
        cachedWorkEntries(root),
        readMaybe(campFile(root, 'tasks.log')),
        readMaybe(join(root, 'CHANGELOG.md')),
      ]);
      return resolveRoadmap(parseRoadmap(raw), entries, parseTaskLog(taskLogRaw), changelog);
    },
  },
  {
    path: '/api/docs',
    handler: async (root) => {
      const docNames = ['USAGE.md', 'MAIN.md', 'README.md', 'CHANGELOG.md', 'LICENSE'];
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
