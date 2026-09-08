import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { deskConfigSchema } from '@/core/parse';
import type { CheckStatus, DeskCheck, DeskCheckState } from '../../types';

interface CheckRuntime {
  status: CheckStatus;
  lastRun: string | null;
  output: string;
}

function emptyRuntime(): CheckRuntime {
  return { status: 'stale', lastRun: null, output: '' };
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

export interface DeskCheckManagerState {
  runtimes: Map<string, CheckRuntime>;
  inFlight: Map<string, Promise<CheckStatus>>;
  clients: Set<ServerResponse>;
}

export function createEmptyCheckState(): DeskCheckManagerState {
  return { runtimes: new Map(), inFlight: new Map(), clients: new Set() };
}

export type DeskCheckManager = ReturnType<typeof createDeskCheckManager>;

export function loadManifestChecks(root: string): DeskCheck[] {
  let raw: string;
  try {
    raw = readFileSync(join(root, 'papercamp', 'config.json'), 'utf-8');
  } catch {
    return [];
  }
  try {
    const parsed = deskConfigSchema.safeParse(JSON.parse(raw).desk ?? {});
    return parsed.success ? (parsed.data.checks ?? []) : [];
  } catch {
    return [];
  }
}

export function createDeskCheckManager(
  root: string,
  state: DeskCheckManagerState = createEmptyCheckState(),
) {
  const { runtimes, inFlight, clients } = state;

  function runtimeFor(name: string): CheckRuntime {
    let runtime = runtimes.get(name);
    if (!runtime) {
      runtime = emptyRuntime();
      runtimes.set(name, runtime);
    }
    return runtime;
  }

  function broadcast(name: string) {
    const data = `data: ${JSON.stringify({ message: `check: ${name}`, timestamp: new Date().toISOString(), type: 'check' })}\n\n`;
    for (const client of clients) {
      try {
        client.write(data);
      } catch {
        clients.delete(client);
      }
    }
  }

  function setResult(name: string, status: CheckStatus, output: string) {
    const runtime = runtimeFor(name);
    runtime.status = status;
    runtime.output = output;
    runtime.lastRun = new Date().toISOString();
    broadcast(name);
  }

  // Joins a run already in flight instead of spawning a second one — two
  // `pnpm test` processes racing over the coverage dir crashes vitest.
  function runCheck(name: string): Promise<CheckStatus> {
    const alreadyRunning = inFlight.get(name);
    if (alreadyRunning) return alreadyRunning;

    const check = loadManifestChecks(root).find((c) => c.name === name);
    if (!check) throw new Error(`No check named "${name}" in the desk manifest`);

    const promise = (async () => {
      setResult(name, 'running', '');
      const { code, output } = await run(check.cmd, root);
      inFlight.delete(name);
      const status = code === 0 ? 'pass' : 'fail';
      setResult(name, status, output);
      return status;
    })();
    inFlight.set(name, promise);
    return promise;
  }

  async function runFix(name: string): Promise<DeskCheckState> {
    const check = loadManifestChecks(root).find((c) => c.name === name);
    if (!check) throw new Error(`No check named "${name}" in the desk manifest`);
    if (!check.fixCmd) throw new MissingFixCmdError(`Check "${name}" has no fix command`);

    await run(check.fixCmd, root);
    await runCheck(name);
    return getStatus().find((c) => c.name === name) as DeskCheckState;
  }

  function getStatus(): DeskCheckState[] {
    return loadManifestChecks(root).map((check) => {
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

  return {
    runCheck,
    runFix,
    getStatus,
    getState: (): DeskCheckManagerState => state,
    subscribe(res: ServerResponse) {
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
  };
}
