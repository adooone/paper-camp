import { spawn } from 'node:child_process';
import { readFileSync, watch } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { CheckName, CheckResult, CheckStatus } from '../../types';
import { BIOME_FIX_COMMAND } from './biome-fix';

interface StatusSnapshot {
  lint: CheckResult;
  format: CheckResult;
  test: CheckResult;
  consistency: CheckResult;
  build: CheckResult;
}

const CHECK_COMMANDS: Record<Exclude<CheckName, 'build'>, string> = {
  lint: 'npx biome lint .',
  format: 'npx biome format .',
  test: 'npx vitest run --passWithNoTests',
  // Codebase consistency — mirrors the CI "Consistency" job (dead code + architecture).
  consistency: 'pnpm run consistency',
};

/** Build has no sensible universal default — the project declares its own
 * command as `commands.build` in papercamp/config.json. Read fresh per run so
 * config edits apply without a server restart. */
function readBuildCommand(root: string): string | null {
  try {
    const config = JSON.parse(readFileSync(join(root, 'papercamp', 'config.json'), 'utf-8'));
    const command = config?.commands?.build;
    return typeof command === 'string' && command.trim() !== '' ? command : null;
  } catch {
    return null;
  }
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
  snapshot: StatusSnapshot;
  // The in-flight guard. Must outlive a hot reload: a fresh Set would forget the
  // child processes a previous instance spawned, so every server-file edit would
  // let another full lint/test stack on top of the ones still running.
  running: Set<CheckName>;
  queued: Set<CheckName>;
  clients: Set<ServerResponse>;
}

export function createEmptyStatusState(): StatusManagerState {
  return {
    snapshot: {
      lint: { status: 'stale', lastRun: null, output: '' },
      format: { status: 'stale', lastRun: null, output: '' },
      test: { status: 'stale', lastRun: null, output: '' },
      consistency: { status: 'stale', lastRun: null, output: '' },
      build: { status: 'stale', lastRun: null, output: '' },
    },
    running: new Set<CheckName>(),
    queued: new Set<CheckName>(),
    clients: new Set<ServerResponse>(),
  };
}

export function createStatusManager(
  root: string,
  state: StatusManagerState = createEmptyStatusState(),
) {
  // Same containers a hot-reloaded replacement receives, so a still-running check's
  // process listeners (owned by the old closure) and the new instance's guard read
  // and write one shared set instead of drifting apart across the swap.
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

  function setResult(name: CheckName, status: CheckStatus, output: string) {
    snapshot[name] = { status, lastRun: new Date().toISOString(), output };
    broadcast({
      message: `${name}: ${status}`,
      timestamp: snapshot[name].lastRun!,
    });
    if (status !== 'running' && queued.has(name)) {
      queued.delete(name);
      runCheck(name);
    }
  }

  function runCheck(name: CheckName) {
    if (name === 'test' && !repoHasVitest(root)) {
      setResult('test', 'pass', 'No test framework configured — nothing to run.');
      return;
    }
    const buildCommand = name === 'build' ? readBuildCommand(root) : null;
    if (name === 'build' && !buildCommand) {
      setResult(
        'build',
        'fail',
        'No build command configured — set commands.build in papercamp/config.json.',
      );
      return;
    }
    if (running.has(name)) {
      queued.add(name);
      return;
    }
    running.add(name);
    setResult(name, 'running', '');

    const cmd = name === 'build' ? (buildCommand as string) : CHECK_COMMANDS[name];
    const proc = spawn(cmd, {
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

    proc.on('close', (code) => {
      running.delete(name);
      const output = stdout + stderr;
      if (code === 0) {
        setResult(name, 'pass', output);
      } else {
        setResult(name, 'fail', output);
      }
    });

    proc.on('error', (err) => {
      running.delete(name);
      setResult(name, 'fail', `Failed to spawn process: ${err.message}`);
    });
  }

  function runQualityFix() {
    if (running.has('lint') || running.has('format')) return;
    setResult('lint', 'running', 'Applying automatic fixes…');
    setResult('format', 'running', 'Applying automatic fixes…');

    const proc = spawn(BIOME_FIX_COMMAND, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    proc.on('close', () => {
      runCheck('lint');
      runCheck('format');
    });

    proc.on('error', (err) => {
      const message = `Failed to spawn fix process: ${err.message}`;
      setResult('lint', 'fail', message);
      setResult('format', 'fail', message);
    });
  }

  const srcDir = join(root, 'src');
  let srcTimer: ReturnType<typeof setTimeout> | null = null;
  try {
    watch(srcDir, { recursive: true }, () => {
      if (srcTimer) clearTimeout(srcTimer);
      srcTimer = setTimeout(() => {
        runCheck('lint');
        runCheck('format');
      }, 1000);
    });
  } catch {
    // watcher not available (src/ doesn't exist or platform doesn't support recursive)
  }

  // Bypasses the queue for a result reflecting the live tree; runs the auto-fixer
  // first so pre-existing formatting nits can't hard-fail an autonomous run-all phase — only real lint/test failures do.
  // Resolves with the names of checks still red, so callers can tell which
  // checks a change actually broke apart from checks that were already red.
  function runChecksAndWait(): Promise<CheckName[]> {
    return new Promise<CheckName[]>((resolve) => {
      const runChecks = () => {
        // consistency (knip/depcruise) and build (manual, config-driven) are
        // dashboard actions, not part of this gate.
        const names: Exclude<CheckName, 'build'>[] = ['lint', 'format', 'test'];
        const passed = new Map<CheckName, boolean>();
        const finished = new Set<CheckName>();
        let pending = names.length;

        function onDone(name: CheckName, ok: boolean) {
          if (finished.has(name)) return;
          finished.add(name);
          passed.set(name, ok);
          pending--;
          if (pending === 0) resolve(names.filter((n) => passed.get(n) !== true));
        }

        const hasVitest = repoHasVitest(root);
        for (const name of names) {
          if (name === 'test' && !hasVitest) {
            onDone(name, true);
            continue;
          }
          const proc = spawn(CHECK_COMMANDS[name], { cwd: root, stdio: 'ignore', shell: true });
          proc.on('close', (code) => onDone(name, code === 0));
          proc.on('error', () => onDone(name, false));
        }
      };

      const fix = spawn(BIOME_FIX_COMMAND, { cwd: root, stdio: 'ignore', shell: true });
      fix.on('close', runChecks);
      fix.on('error', runChecks);
    });
  }

  return {
    getStatus(): StatusSnapshot {
      return {
        lint: { ...snapshot.lint },
        format: { ...snapshot.format },
        test: { ...snapshot.test },
        consistency: { ...snapshot.consistency },
        // Fallback for a hot-reloaded state object created before `build` existed.
        build: { ...(snapshot.build ?? { status: 'stale', lastRun: null, output: '' }) },
      };
    },
    getState: (): StatusManagerState => state,
    runCheck,
    runChecksAndWait,
    runQualityFix,
    subscribe(res: ServerResponse) {
      clients.add(res);
      for (const name of ['lint', 'format', 'test', 'consistency', 'build'] as CheckName[]) {
        const result = snapshot[name];
        if (result.status !== 'stale') {
          res.write(
            `data: ${JSON.stringify({ message: `${name}: ${result.status}`, timestamp: result.lastRun, type: 'status' })}\n\n`,
          );
        }
      }
      res.on('close', () => clients.delete(res));
    },
  };
}
