import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { getPrMapFetchedAt } from '@/core/git-pr';
import { findConsistencyIssues } from '@/core/parse';
import { readWorkEntries } from '@/core/readers';
import { deriveSubjectVocabulary, parseRoadmap } from '@/core/roadmap';
import type { CheckName, CheckResult, CheckStatus, FailingCheck } from '../../types';
import { BIOME_FIX_COMMAND } from './biome-fix';
import type { DeskCheckManager } from './desk-checks';
import { loadManifestChecks } from './desk-checks';
import type { GitManager } from './git';
import { campFile, readMaybe } from './helpers';

interface StatusSnapshot {
  // Codebase consistency (knip + depcruise) — mirrors the CI "Consistency" job.
  // Not a desk check: it gates commits, not the dev-loop dashboard.
  consistency: CheckResult;
}

export interface StatusPayload extends StatusSnapshot {
  prFetchedAt: number | null;
}

const CONSISTENCY_COMMAND = 'pnpm run consistency';

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
  snapshot: StatusSnapshot;
  // Must outlive a hot reload: a fresh Set would forget a running child process,
  // letting another consistency run stack on top of the one still running.
  running: Set<CheckName>;
  queued: Set<CheckName>;
  clients: Set<ServerResponse>;
  // The HEAD `snapshot.consistency`'s result was produced against — lets a
  // baseline reuse a result the Stack already produced (IDEA-255).
  consistencyHeadSha: string | null;
  // Docs has no on-demand Stack check to hold a live snapshot, so its cached
  // result and the HEAD it was produced on travel together here (IDEA-255).
  docs: { headSha: string; passed: boolean; output: string } | null;
}

export function createEmptyStatusState(): StatusManagerState {
  return {
    snapshot: {
      consistency: { status: 'stale', cmd: CONSISTENCY_COMMAND, lastRun: null, output: '' },
    },
    running: new Set<CheckName>(),
    queued: new Set<CheckName>(),
    clients: new Set<ServerResponse>(),
    consistencyHeadSha: null,
    docs: null,
  };
}

export function createStatusManager(
  root: string,
  checks: DeskCheckManager,
  git: GitManager,
  state: StatusManagerState = createEmptyStatusState(),
) {
  // Same containers a hot-reloaded replacement receives, so a still-running check's
  // process listeners and the new instance's guard read and write one shared set.
  const { snapshot, running, queued, clients } = state;

  // `type` lets the client route without refetching everything each tick (an agent
  // emits a line per log row); untyped events used to be dropped, making check clicks look dead.
  function broadcast(event: { message: string; timestamp: string }) {
    const data = `data: ${JSON.stringify({ ...event, type: 'status' })}\n\n`;
    for (const client of clients) {
      try {
        client.write(data);
      } catch {
        clients.delete(client);
      }
    }
  }

  function setResult(name: 'consistency', status: CheckStatus, output: string, cmd?: string) {
    snapshot[name] = {
      status,
      cmd: cmd ?? snapshot[name].cmd,
      lastRun: new Date().toISOString(),
      output,
    };
    broadcast({
      message: `${name}: ${status}`,
      timestamp: snapshot[name].lastRun!,
    });
    if (status !== 'running' && queued.has(name)) {
      queued.delete(name);
      runCheck(name);
    }
  }

  function runCheck(name: 'consistency') {
    if (running.has(name)) {
      queued.add(name);
      return;
    }
    running.add(name);
    setResult(name, 'running', '', CONSISTENCY_COMMAND);

    const proc = spawn(CONSISTENCY_COMMAND, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on('close', async (code) => {
      running.delete(name);
      const output = stdout + stderr;
      state.consistencyHeadSha = await git.getHeadSha();
      if (code === 0) {
        setResult(name, 'pass', output);
      } else {
        setResult(name, 'fail', output);
      }
    });

    proc.on('error', async (err) => {
      running.delete(name);
      state.consistencyHeadSha = await git.getHeadSha();
      setResult(name, 'fail', `Failed to spawn process: ${err.message}`);
    });
  }

  // Kept independent of runCheck's running/queued dedup (that gate is for on-demand
  // Stack clicks) — a sweep racing a manual click is rare and each run is read-only.
  function runConsistencyAndWait(): Promise<{ passed: boolean; output: string }> {
    return new Promise((resolve) => {
      setResult('consistency', 'running', '', CONSISTENCY_COMMAND);
      const proc = spawn(CONSISTENCY_COMMAND, {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });
      let output = '';
      proc.stdout?.on('data', (d: Buffer) => {
        output += d.toString();
      });
      proc.stderr?.on('data', (d: Buffer) => {
        output += d.toString();
      });
      proc.on('close', async (code) => {
        const pass = code === 0;
        state.consistencyHeadSha = await git.getHeadSha();
        setResult('consistency', pass ? 'pass' : 'fail', output);
        resolve({ passed: pass, output });
      });
      proc.on('error', async (err) => {
        state.consistencyHeadSha = await git.getHeadSha();
        const errOutput = `Failed to spawn process: ${err.message}`;
        setResult('consistency', 'fail', errOutput);
        resolve({ passed: false, output: errOutput });
      });
    });
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

  async function runManifestCheck(
    name: 'lint' | 'test',
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

  // Bypasses the queue and runs the auto-fixer first, so pre-existing formatting
  // nits can't hard-fail an autonomous run-all phase; always runs every check.
  function runChecksAndWait(): Promise<FailingCheck[]> {
    return new Promise<FailingCheck[]>((resolve) => {
      const runChecks = async () => {
        const manifestChecks = loadManifestChecks(root);
        const names = (['lint', 'test'] as const).filter((n) =>
          manifestChecks.some((c) => c.name === n),
        );
        const hasVitest = repoHasVitest(root);
        const [deskResults, consistencyResult, docsResult] = await Promise.all([
          Promise.all(names.map((name) => runManifestCheck(name, hasVitest))),
          runConsistencyAndWait(),
          runDocsCheckAndCache(),
        ]);
        const failing: FailingCheck[] = [];
        names.forEach((name, i) => {
          if (!deskResults[i].passed) failing.push({ name, output: deskResults[i].output });
        });
        if (!consistencyResult.passed) {
          failing.push({ name: 'consistency', output: consistencyResult.output });
        }
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
    const manifestChecks = loadManifestChecks(root);
    const names = (['lint', 'test'] as const).filter((n) =>
      manifestChecks.some((c) => c.name === n),
    );
    const hasVitest = repoHasVitest(root);
    const runtimes = checks.getState().runtimes;

    const deskFresh = (name: 'lint' | 'test'): boolean => {
      if (name === 'test' && !hasVitest) return true;
      const runtime = runtimes.get(name);
      return (
        runtime?.headSha === headSha && (runtime.status === 'pass' || runtime.status === 'fail')
      );
    };
    const consistencyFresh =
      state.consistencyHeadSha === headSha &&
      (snapshot.consistency.status === 'pass' || snapshot.consistency.status === 'fail');
    const docsFresh = state.docs?.headSha === headSha;

    const [deskResults, consistencyResult, docsResult] = await Promise.all([
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
      consistencyFresh
        ? Promise.resolve({
            passed: snapshot.consistency.status === 'pass',
            output: snapshot.consistency.output,
          })
        : runConsistencyAndWait(),
      docsFresh
        ? Promise.resolve({ passed: state.docs?.passed ?? false, output: state.docs?.output ?? '' })
        : runDocsCheckAndCache(),
    ]);
    const failing: FailingCheck[] = [];
    names.forEach((name, i) => {
      if (!deskResults[i].passed) failing.push({ name, output: deskResults[i].output });
    });
    if (!consistencyResult.passed) {
      failing.push({ name: 'consistency', output: consistencyResult.output });
    }
    if (!docsResult.passed) failing.push({ name: 'docs', output: docsResult.output });
    return failing;
  }

  return {
    async getStatus(): Promise<StatusPayload> {
      return {
        consistency: { ...snapshot.consistency },
        prFetchedAt: await getPrMapFetchedAt(root),
      };
    },
    getState: (): StatusManagerState => state,
    runCheck,
    runChecksAndWait,
    getCachedOrRunChecks,
    subscribe(res: ServerResponse) {
      clients.add(res);
      const result = snapshot.consistency;
      if (result.status !== 'stale') {
        res.write(
          `data: ${JSON.stringify({ message: `consistency: ${result.status}`, timestamp: result.lastRun, type: 'status' })}\n\n`,
        );
      }
      res.on('close', () => clients.delete(res));
    },
  };
}
