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

export interface DeskCheckManagerState {
  runtimes: Map<string, CheckRuntime>;
  running: Set<string>;
  clients: Set<ServerResponse>;
}

export function createEmptyCheckState(): DeskCheckManagerState {
  return { runtimes: new Map(), running: new Set(), clients: new Set() };
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
  const { runtimes, running, clients } = state;

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

  function runCheck(name: string): void {
    const check = loadManifestChecks(root).find((c) => c.name === name);
    if (!check) throw new Error(`No check named "${name}" in the desk manifest`);
    if (running.has(name)) return;
    running.add(name);
    setResult(name, 'running', '');

    const proc = spawn(check.cmd, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: true });
    let out = '';
    proc.stdout?.on('data', (d: Buffer) => {
      out += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      out += d.toString();
    });
    proc.on('close', (code) => {
      running.delete(name);
      setResult(name, code === 0 ? 'pass' : 'fail', out);
    });
    proc.on('error', (err) => {
      running.delete(name);
      setResult(name, 'fail', `Failed to spawn check: ${err.message}`);
    });
  }

  function getStatus(): DeskCheckState[] {
    return loadManifestChecks(root).map((check) => {
      const runtime = runtimeFor(check.name);
      return {
        name: check.name,
        cmd: check.cmd,
        status: runtime.status,
        lastRun: runtime.lastRun,
        output: runtime.output,
      };
    });
  }

  return {
    runCheck,
    getStatus,
    getState: (): DeskCheckManagerState => state,
    subscribe(res: ServerResponse) {
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
  };
}
