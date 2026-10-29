import { join } from 'node:path';
import { readCorpus } from '@/core/corpus';
import { detectToolbarHostState } from '@/core/desk-discovery/toolbar-host';
import { describeFindings, runDoctor } from '@/core/doctor';
import { buildNightReportGroups, readNightFindings } from '@/core/night-suggestions';
import { mergeNotifications } from '@/core/notifications';
import { readParkedQuestions } from '@/core/parked-questions';
import { findConsistencyIssues, parseSuggestions, readTaskLog } from '@/core/parse';
import { readProjectConfig } from '@/core/project-config';
import { deriveSubjectVocabulary, parseRoadmap, resolveRoadmap } from '@/core/roadmap';
import { computeProjectStats } from '@/core/stats';
import { isArchivable } from '@/core/status';
import { resolveReleaseRanges } from '@/core/trail';
import { localFile, planFile, readMaybe } from '../helpers';
import { sendJson } from '../http';
import { readNotifications } from '../notification-log';
import type { Route, RouteContext } from './types';

/** `GET` routes that only ever read project state — every handler answers the same
 *  way, so they're declared as `(root) => data` and wrapped into `Route`s once. */
const READS: { path: string; handler: (root: string) => Promise<unknown> }[] = [
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
    handler: async (root) => {
      const { work, warnings } = await readCorpus(root, { live: true });
      return { entries: work, warnings };
    },
  },
  {
    path: '/api/suggestions',
    handler: async (root) => ({
      entries: parseSuggestions(await readMaybe(planFile(root, 'suggestions.md'))),
    }),
  },
  {
    path: '/api/tasks',
    handler: async (root) => ({
      entries: readTaskLog(await readMaybe(localFile(root, 'tasks.log'))),
    }),
  },
  {
    path: '/api/night-findings',
    handler: async (root) => {
      const [findings, taskLog] = await Promise.all([
        readNightFindings(root),
        readTaskLog(await readMaybe(localFile(root, 'tasks.log'))),
      ]);
      return { groups: buildNightReportGroups(findings, taskLog) };
    },
  },
  {
    path: '/api/ideas',
    handler: async (root) => {
      const { notes, warnings } = await readCorpus(root, { live: true });
      return { entries: notes, warnings };
    },
  },
  {
    path: '/api/archivable-ideas',
    handler: async (root) => {
      const { entries, prs } = await readCorpus(root, { live: true });
      return entries.flatMap((e) => {
        const pr = prs?.get(e.id);
        return pr && isArchivable(e, pr) ? [{ id: e.id, title: e.title, pr }] : [];
      });
    },
  },
  {
    path: '/api/parked-questions',
    handler: async (root) => {
      const { entries } = await readCorpus(root, { live: true });
      return readParkedQuestions(entries);
    },
  },
  {
    path: '/api/notifications',
    handler: async (root) => {
      const [{ entries }, stored] = await Promise.all([
        readCorpus(root, { live: true }),
        readNotifications(root),
      ]);
      return mergeNotifications(readParkedQuestions(entries), stored);
    },
  },
  {
    path: '/api/consistency',
    handler: async (root) => {
      const [{ work }, roadmapRaw] = await Promise.all([
        readCorpus(root, { live: true }),
        readMaybe(join(root, 'ROADMAP.md')),
      ]);
      const subjectVocabulary = roadmapRaw ? deriveSubjectVocabulary(parseRoadmap(roadmapRaw)) : [];
      return findConsistencyIssues(work, subjectVocabulary);
    },
  },
  {
    path: '/api/doctor',
    handler: async (root) => describeFindings(await runDoctor(join(root, 'papercamp'))),
  },
  {
    path: '/api/stats',
    handler: async (root) => computeProjectStats(root),
  },
  {
    path: '/api/config',
    handler: async (root) => {
      const config = readProjectConfig(root);
      if (!config.raw) return null;
      return {
        ...config.raw,
        defaultAgents: config.defaultAgents,
        desk: config.desk,
        subjects: config.subjects,
      };
    },
  },
  {
    path: '/api/roadmap',
    handler: async (root) => {
      const raw = await readMaybe(join(root, 'ROADMAP.md'));
      if (!raw) return null;
      const [{ work }, changelog] = await Promise.all([
        readCorpus(root, { live: true }),
        readMaybe(join(root, 'CHANGELOG.md')),
      ]);
      return resolveRoadmap(parseRoadmap(raw), work, changelog);
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
    path: '/api/releases',
    handler: async (root) => {
      const changelog = await readMaybe(join(root, 'CHANGELOG.md'));
      return { versions: resolveReleaseRanges(changelog).map((r) => r.version) };
    },
  },
  {
    path: '/api/toolbar/host-app',
    handler: async (root) => detectToolbarHostState(root),
  },
];

export function readRoutes({ root }: RouteContext): Route[] {
  return READS.map(({ path, handler }) => ({
    method: 'GET' as const,
    path,
    handle: async (_req, res) => {
      sendJson(res, 200, await handler(root));
    },
  }));
}
