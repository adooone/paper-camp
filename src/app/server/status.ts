import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPrMapFetchedAt } from '@/core/git-pr';
import { findConsistencyIssues } from '@/core/parse';
import { readWorkEntries } from '@/core/readers';
import { deriveSubjectVocabulary, parseRoadmap } from '@/core/roadmap';
import type { FailingCheck } from '../../types';
import { BIOME_FIX_COMMAND } from './biome-fix';
import type { DeskCheckManager } from './desk-checks';
import { loadManifestChecks } from './desk-checks';
import type { GitManager } from './git';
import { campFile, readMaybe } from './helpers';

export interface StatusPayload {
  prFetchedAt: number | null;
}

function repoHasVitest(root: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Boolean(deps.vitest);
  } catch {
    return false;
  }
}

export type StatusManager = ReturnType<typeof createStatusManager>;

export interface StatusManagerState {
  // Docs has no on-demand Stack check to hold a live snapshot, so its cached
  // result and the HEAD it was produced on travel together here (IDEA-255).
  docs: { headSha: string; passed: boolean; output: string } | null;
}

export function createEmptyStatusState(): StatusManagerState {
  return {
    docs: null,
  };
}

export function createStatusManager(
  root: string,
  checks: DeskCheckManager,
  git: GitManager,
  state: StatusManagerState = createEmptyStatusState(),
) {
  async function runManifestCheck(
    name: string,
    hasVitest: boolean,
  ): Promise<{ passed: boolean; output: string }> {
    if (name === 'test' && !hasVitest) return { passed: true, output: '' };
    // A run already in flight predates this call — wait it out so the fresh
    // runCheck below reports on the current code, not a stale join.
    const stale = checks.getState().inFlight.get(name);
    if (stale) await stale;
    const status = await checks.runCheck(name);
    return {
      passed: status === 'pass',
      output: checks.getState().runtimes.get(name)?.output ?? '',
    };
  }

  // Mirrors the Stack panel's Docs stamp (IDEA-156): doc findings computed from
  // the corpus, not a spawned command.
  async function runDocsCheck(): Promise<{ passed: boolean; output: string }> {
    const [{ entries }, roadmapRaw] = await Promise.all([
      readWorkEntries(campFile(root, 'ideas')),
      readMaybe(join(root, 'ROADMAP.md')),
    ]);
    const subjectVocabulary = roadmapRaw ? deriveSubjectVocabulary(parseRoadmap(roadmapRaw)) : [];
    const issues = findConsistencyIssues(entries, subjectVocabulary);
    return { passed: issues.length === 0, output: issues.map((issue) => issue.message).join('\n') };
  }

  async function runDocsCheckAndCache(): Promise<{ passed: boolean; output: string }> {
    const [result, headSha] = await Promise.all([runDocsCheck(), git.getHeadSha()]);
    state.docs = { headSha, ...result };
    return result;
  }

  // Bypasses the queue and runs the auto-fixer first, so pre-existing formatting
  // nits can't hard-fail an autonomous run-all phase; always runs every check.
  function runChecksAndWait(): Promise<FailingCheck[]> {
    return new Promise<FailingCheck[]>((resolve) => {
      const runChecks = async () => {
        const names = loadManifestChecks(root).map((c) => c.name);
        const hasVitest = repoHasVitest(root);
        const [deskResults, docsResult] = await Promise.all([
          Promise.all(names.map((name) => runManifestCheck(name, hasVitest))),
          runDocsCheckAndCache(),
        ]);
        const failing: FailingCheck[] = [];
        names.forEach((name, i) => {
          if (!deskResults[i].passed) {
            failing.push({ name: name as FailingCheck['name'], output: deskResults[i].output });
          }
        });
        if (!docsResult.passed) failing.push({ name: 'docs', output: docsResult.output });
        resolve(failing);
      };

      const fix = spawn(BIOME_FIX_COMMAND, { cwd: root, stdio: 'ignore', shell: true });
      fix.on('close', runChecks);
      fix.on('error', runChecks);
    });
  }

  // Reuses each check's own last result when it was produced on the current
  // HEAD, whether from an earlier sweep or an on-demand Stack click (IDEA-255).
  async function getCachedOrRunChecks(): Promise<FailingCheck[]> {
    const headSha = await git.getHeadSha();
    const names = loadManifestChecks(root).map((c) => c.name);
    const hasVitest = repoHasVitest(root);
    const runtimes = checks.getState().runtimes;

    const deskFresh = (name: string): boolean => {
      if (name === 'test' && !hasVitest) return true;
      const runtime = runtimes.get(name);
      return (
        runtime?.headSha === headSha && (runtime.status === 'pass' || runtime.status === 'fail')
      );
    };
    const docsFresh = state.docs?.headSha === headSha;

    const [deskResults, docsResult] = await Promise.all([
      Promise.all(
        names.map((name) => {
          if (!deskFresh(name)) return runManifestCheck(name, hasVitest);
          const runtime = runtimes.get(name);
          return Promise.resolve({
            passed: runtime?.status !== 'fail',
            output: runtime?.output ?? '',
          });
        }),
      ),
      docsFresh
        ? Promise.resolve({ passed: state.docs?.passed ?? false, output: state.docs?.output ?? '' })
        : runDocsCheckAndCache(),
    ]);
    const failing: FailingCheck[] = [];
    names.forEach((name, i) => {
      if (!deskResults[i].passed) {
        failing.push({ name: name as FailingCheck['name'], output: deskResults[i].output });
      }
    });
    if (!docsResult.passed) failing.push({ name: 'docs', output: docsResult.output });
    return failing;
  }

  return {
    async getStatus(): Promise<StatusPayload> {
      return {
        prFetchedAt: await getPrMapFetchedAt(root),
      };
    },
    getState: (): StatusManagerState => state,
    runChecksAndWait,
    getCachedOrRunChecks,
  };
}
