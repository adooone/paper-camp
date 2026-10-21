import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { corpusFingerprint, readCorpus } from '@/core/corpus';
import { loadDeskConfig } from '@/core/desk-config';
import { findConsistencyIssues } from '@/core/parse';
import { deriveSubjectVocabulary, parseRoadmap } from '@/core/roadmap';
import type { CheckStatus, DeskCheckState, FailingCheck } from '../../types';
import { BIOME_FIX_COMMAND } from './biome-fix';
import { readMaybe } from './helpers';

export interface CheckFingerprint {
  headSha: string | null;
  treeHash: string | null;
}

const EMPTY_FINGERPRINT: CheckFingerprint = { headSha: null, treeHash: null };

export interface CheckRuntime {
  status: CheckStatus;
  lastRun: string | null;
  output: string;
  // The tree this result was produced against — lets a baseline reuse it instead
  // of re-running the check when nothing has changed since (IDEA-255, IDEA-308).
  headSha: string | null;
  treeHash: string | null;
}

function emptyRuntime(): CheckRuntime {
  return { status: 'stale', lastRun: null, output: '', ...EMPTY_FINGERPRINT };
}

export class MissingFixCmdError extends Error {}

function run(cmd: string, cwd: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: true });
    let output = '';
    proc.stdout?.on('data', (d: Buffer) => {
      output += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      output += d.toString();
    });
    proc.on('close', (code) => resolve({ code, output }));
    proc.on('error', (err) =>
      resolve({ code: null, output: `Failed to spawn check: ${err.message}` }),
    );
  });
}

export interface DocsCheckRuntime {
  fingerprint: string;
  passed: boolean;
  output: string;
}

export interface DeskCheckManagerState {
  runtimes: Map<string, CheckRuntime>;
  inFlight: Map<string, Promise<CheckStatus>>;
  // Docs has no on-demand Stack check, so its cached result and the corpus
  // fingerprint it was produced on (not HEAD, since Docs reads the tree) travel together here.
  docs: DocsCheckRuntime | null;
}

export function createEmptyCheckState(): DeskCheckManagerState {
  return { runtimes: new Map(), inFlight: new Map(), docs: null };
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

export type DeskCheckManager = ReturnType<typeof createDeskCheckManager>;

export function createDeskCheckManager(
  root: string,
  getFingerprint?: () => Promise<CheckFingerprint>,
  publish?: (payload: { type: string } & Record<string, unknown>) => void,
  state: DeskCheckManagerState = createEmptyCheckState(),
) {
  const { runtimes, inFlight } = state;

  function runtimeFor(name: string): CheckRuntime {
    let runtime = runtimes.get(name);
    if (!runtime) {
      runtime = emptyRuntime();
      runtimes.set(name, runtime);
    }
    return runtime;
  }

  function broadcast(name: string) {
    publish?.({ message: `check: ${name}`, timestamp: new Date().toISOString(), type: 'check' });
  }

  function setResult(
    name: string,
    status: CheckStatus,
    output: string,
    fingerprint: CheckFingerprint,
  ) {
    const runtime = runtimeFor(name);
    runtime.status = status;
    runtime.output = output;
    runtime.lastRun = new Date().toISOString();
    runtime.headSha = fingerprint.headSha;
    runtime.treeHash = fingerprint.treeHash;
    broadcast(name);
  }

  // Joins a run already in flight instead of spawning a second one — two
  // concurrent vitest runs racing over the same working tree crashes vitest.
  function runCheck(name: string): Promise<CheckStatus> {
    const alreadyRunning = inFlight.get(name);
    if (alreadyRunning) return alreadyRunning;

    const check = (loadDeskConfig(root).checks ?? []).find((c) => c.name === name);
    if (!check) throw new Error(`No check named "${name}" in the desk manifest`);

    const promise = (async () => {
      // Captured before the command starts, so a commit landing mid-run can't stamp this
      // result with a fingerprint it predates; a failing lookup still lets the check settle.
      const fingerprint = getFingerprint
        ? await getFingerprint().catch(() => EMPTY_FINGERPRINT)
        : EMPTY_FINGERPRINT;
      setResult(name, 'running', '', fingerprint);
      const { code, output } = await run(check.cmd, root);
      inFlight.delete(name);
      const status = code === 0 ? 'pass' : 'fail';
      setResult(name, status, output, fingerprint);
      return status;
    })();
    inFlight.set(name, promise);
    return promise;
  }

  async function runFix(name: string): Promise<DeskCheckState> {
    const check = (loadDeskConfig(root).checks ?? []).find((c) => c.name === name);
    if (!check) throw new Error(`No check named "${name}" in the desk manifest`);
    if (!check.fixCmd) throw new MissingFixCmdError(`Check "${name}" has no fix command`);

    await run(check.fixCmd, root);
    await runCheck(name);
    return getStatus().find((c) => c.name === name) as DeskCheckState;
  }

  function getStatus(): DeskCheckState[] {
    return (loadDeskConfig(root).checks ?? []).map((check) => {
      const runtime = runtimeFor(check.name);
      return {
        name: check.name,
        cmd: check.cmd,
        fixCmd: check.fixCmd,
        status: runtime.status,
        lastRun: runtime.lastRun,
        output: runtime.output,
      };
    });
  }

  async function runManifestCheck(
    name: string,
    hasVitest: boolean,
  ): Promise<{ passed: boolean; output: string }> {
    if (name === 'test' && !hasVitest) return { passed: true, output: '' };
    // A run already in flight predates this call — wait it out so the fresh
    // runCheck below reports on the current code, not a stale join.
    const stale = inFlight.get(name);
    if (stale) await stale;
    const status = await runCheck(name);
    return { passed: status === 'pass', output: runtimes.get(name)?.output ?? '' };
  }

  // Mirrors the Stack panel's Docs stamp (IDEA-156): doc findings computed from
  // the corpus, not a spawned command.
  async function runDocsCheck(): Promise<DocsCheckRuntime> {
    const [{ work: entries, fingerprint }, roadmapRaw] = await Promise.all([
      readCorpus(root, { live: true }),
      readMaybe(join(root, 'ROADMAP.md')),
    ]);
    const subjectVocabulary = roadmapRaw ? deriveSubjectVocabulary(parseRoadmap(roadmapRaw)) : [];
    const issues = findConsistencyIssues(entries, subjectVocabulary);
    return {
      fingerprint,
      passed: issues.length === 0,
      output: issues.map((issue) => issue.message).join('\n'),
    };
  }

  async function runDocsCheckAndCache(): Promise<{ passed: boolean; output: string }> {
    const result = await runDocsCheck();
    state.docs = result;
    return result;
  }

  // Bypasses the queue and runs the auto-fixer first, so pre-existing formatting
  // nits can't hard-fail an autonomous run-all phase; always runs every check.
  async function runChecksAndWait(): Promise<FailingCheck[]> {
    await new Promise<void>((resolve, reject) => {
      const fix = spawn(BIOME_FIX_COMMAND, { cwd: root, stdio: 'ignore', shell: true });
      fix.once('close', () => resolve());
      fix.once('error', reject);
    });

    const names = (loadDeskConfig(root).checks ?? []).map((c) => c.name);
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
    return failing;
  }

  // Reuses each check's own last result when it was produced on the current tree,
  // whether from an earlier sweep or an on-demand Stack click.
  async function getCachedOrRunChecks(): Promise<FailingCheck[]> {
    const { headSha, treeHash } = getFingerprint
      ? await getFingerprint().catch(() => EMPTY_FINGERPRINT)
      : EMPTY_FINGERPRINT;
    const names = (loadDeskConfig(root).checks ?? []).map((c) => c.name);
    const hasVitest = repoHasVitest(root);

    const deskFresh = (name: string): boolean => {
      if (name === 'test' && !hasVitest) return true;
      const runtime = runtimes.get(name);
      if (!runtime) return false;
      if (
        headSha === null ||
        treeHash === null ||
        runtime.headSha === null ||
        runtime.treeHash === null
      )
        return false;
      return (
        runtime.headSha === headSha &&
        runtime.treeHash === treeHash &&
        (runtime.status === 'pass' || runtime.status === 'fail')
      );
    };
    const corpusFp = await corpusFingerprint(join(root, 'papercamp', 'ideas'));
    const docsFresh = state.docs?.fingerprint === corpusFp;

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
    runCheck,
    runFix,
    getStatus,
    runChecksAndWait,
    getCachedOrRunChecks,
    getState: (): DeskCheckManagerState => state,
  };
}
