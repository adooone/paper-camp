import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { CheckName, CheckResult, CheckStatus } from '../../types';
import { BIOME_FIX_COMMAND } from './biome-fix';
import { loadManifestChecks } from './desk-checks';

interface StatusSnapshot {
  // Codebase consistency (knip + depcruise) — mirrors the CI "Consistency" job.
  // Not a desk check: it gates commits, not the dev-loop dashboard.
  consistency: CheckResult;
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
  // The in-flight guard. Must outlive a hot reload: a fresh Set would forget the
  // child process a previous instance spawned, so every server-file edit would
  // let another consistency run stack on top of the one still running.
  running: Set<CheckName>;
  queued: Set<CheckName>;
  clients: Set<ServerResponse>;
}

export function createEmptyStatusState(): StatusManagerState {
  return {
    snapshot: {
      consistency: { status: 'stale', cmd: CONSISTENCY_COMMAND, lastRun: null, output: '' },
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

  // Bypasses the queue for a result reflecting the live tree; runs the auto-fixer
  // first so pre-existing formatting nits can't hard-fail an autonomous run-all phase — only
  // real lint/test failures do. Sources commands from the desk manifest (IDEA-162) rather than
  // a hardcoded list, so it stays in sync with whatever the project actually declares.
  // Resolves with the names of checks still red, so callers can tell which
  // checks a change actually broke apart from checks that were already red.
  function runChecksAndWait(): Promise<CheckName[]> {
    return new Promise<CheckName[]>((resolve) => {
      const runChecks = () => {
        const manifestChecks = loadManifestChecks(root);
        const names = (['lint', 'test'] as const).filter((n) =>
          manifestChecks.some((c) => c.name === n),
        );
        const passed = new Map<CheckName, boolean>();
        const finished = new Set<CheckName>();
        let pending = names.length;
        if (pending === 0) {
          resolve([]);
          return;
        }

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
          const cmd = manifestChecks.find((c) => c.name === name)!.cmd;
          const proc = spawn(cmd, { cwd: root, stdio: 'ignore', shell: true });
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
        consistency: { ...snapshot.consistency },
      };
    },
    getState: (): StatusManagerState => state,
    runCheck,
    runChecksAndWait,
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
