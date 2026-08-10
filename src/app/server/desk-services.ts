import { readFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { deskConfigSchema } from '@/core/parse';
import type * as Pty from 'node-pty';
import type { DeskService, ServiceHealth, ServiceRunStatus, ServiceState } from '../../types';

const MAX_LOG_LINES = 500;
const HEALTH_POLL_MS = 5000;
const HEALTH_TIMEOUT_MS = 3000;
const KILL_GRACE_MS = 5000;

const ESC = String.fromCharCode(27);
const ANSI_ESCAPE_RE = new RegExp(
  `${ESC}[[\\]()#;?]*(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]`,
  'g',
);

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_RE, '');
}

interface RunningService {
  status: ServiceRunStatus;
  health: ServiceHealth;
  proc: Pty.IPty | null;
  pid: number | null;
  startedAt: string | null;
  exitCode: number | null;
  log: string[];
  partial: string;
  healthTimer: ReturnType<typeof setInterval> | null;
}

function emptyRuntime(): RunningService {
  return {
    status: 'stopped',
    health: 'unknown',
    proc: null,
    pid: null,
    startedAt: null,
    exitCode: null,
    log: [],
    partial: '',
    healthTimer: null,
  };
}

export interface DeskServiceManagerState {
  runtimes: Map<string, RunningService>;
  clients: Set<ServerResponse>;
}

export function createEmptyServiceState(): DeskServiceManagerState {
  return { runtimes: new Map(), clients: new Set() };
}

export type DeskServiceManager = ReturnType<typeof createDeskServiceManager>;

function loadManifestServices(root: string): DeskService[] {
  let raw: string;
  try {
    raw = readFileSync(join(root, 'papercamp', 'config.json'), 'utf-8');
  } catch {
    return [];
  }
  try {
    const parsed = deskConfigSchema.safeParse(JSON.parse(raw).desk ?? {});
    return parsed.success ? (parsed.data.services ?? []) : [];
  } catch {
    return [];
  }
}

export function createDeskServiceManager(
  root: string,
  state: DeskServiceManagerState = createEmptyServiceState(),
) {
  const { runtimes, clients } = state;

  function runtimeFor(name: string): RunningService {
    let runtime = runtimes.get(name);
    if (!runtime) {
      runtime = emptyRuntime();
      runtimes.set(name, runtime);
    }
    return runtime;
  }

  function broadcast(name: string) {
    const data = `data: ${JSON.stringify({ message: `service: ${name}`, timestamp: new Date().toISOString(), type: 'service' })}\n\n`;
    for (const client of clients) {
      try {
        client.write(data);
      } catch {
        clients.delete(client);
      }
    }
  }

  function appendLog(runtime: RunningService, chunk: string) {
    const combined = runtime.partial + stripAnsi(chunk);
    const parts = combined.split('\n');
    runtime.partial = parts.pop() ?? '';
    for (const line of parts) runtime.log.push(line);
    if (runtime.log.length > MAX_LOG_LINES) {
      runtime.log.splice(0, runtime.log.length - MAX_LOG_LINES);
    }
  }

  function stopHealthPolling(runtime: RunningService) {
    if (runtime.healthTimer) {
      clearInterval(runtime.healthTimer);
      runtime.healthTimer = null;
    }
  }

  function startHealthPolling(name: string, service: DeskService, runtime: RunningService) {
    if (!service.healthcheck) return;
    stopHealthPolling(runtime);
    const url = service.healthcheck;
    const poll = async () => {
      if (runtime.status !== 'running') return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      let next: ServiceHealth;
      try {
        const res = await fetch(url, { signal: controller.signal });
        next = res.ok ? 'up' : 'down';
      } catch {
        next = 'down';
      } finally {
        clearTimeout(timeout);
      }
      if (runtime.status === 'running' && runtime.health !== next) {
        runtime.health = next;
        broadcast(name);
      }
    };
    runtime.healthTimer = setInterval(poll, HEALTH_POLL_MS);
    void poll();
  }

  async function start(name: string): Promise<void> {
    const service = loadManifestServices(root).find((s) => s.name === name);
    if (!service) throw new Error(`No service named "${name}" in the desk manifest`);
    const runtime = runtimeFor(name);
    if (runtime.status === 'running' || runtime.status === 'stopping') return;

    runtime.status = 'running';
    runtime.log = [];
    runtime.partial = '';
    runtime.exitCode = null;
    runtime.health = 'unknown';

    let pty: typeof import('node-pty');
    try {
      pty = await import('node-pty');
    } catch (err) {
      runtime.status = 'crashed';
      runtime.log.push(`Cannot start service — node-pty unavailable: ${(err as Error).message}`);
      broadcast(name);
      return;
    }

    let proc: Pty.IPty;
    try {
      proc = pty.spawn('sh', ['-c', service.cmd], {
        name: 'xterm-color',
        cols: 200,
        rows: 40,
        cwd: root,
        env: process.env as Record<string, string>,
      });
    } catch (err) {
      runtime.status = 'crashed';
      runtime.log.push(`Failed to spawn service: ${(err as Error).message}`);
      broadcast(name);
      return;
    }

    runtime.proc = proc;
    runtime.pid = proc.pid;
    runtime.status = 'running';
    runtime.startedAt = new Date().toISOString();
    broadcast(name);

    proc.onData((chunk) => appendLog(runtime, chunk));
    proc.onExit(({ exitCode }) => {
      stopHealthPolling(runtime);
      if (runtime.partial) {
        runtime.log.push(runtime.partial);
        runtime.partial = '';
      }
      runtime.proc = null;
      runtime.pid = null;
      runtime.startedAt = null;
      runtime.exitCode = exitCode;
      runtime.health = 'unknown';
      runtime.status = runtime.status === 'stopping' || exitCode === 0 ? 'stopped' : 'crashed';
      broadcast(name);
    });

    startHealthPolling(name, service, runtime);
  }

  function stop(name: string): void {
    const runtime = runtimes.get(name);
    if (!runtime?.proc || runtime.status !== 'running') return;
    runtime.status = 'stopping';
    stopHealthPolling(runtime);
    broadcast(name);
    const proc = runtime.proc;
    let exited = false;
    proc.onExit(() => {
      exited = true;
    });
    proc.kill();
    setTimeout(() => {
      if (!exited) proc.kill('SIGKILL');
    }, KILL_GRACE_MS);
  }

  function toState(service: DeskService, runtime: RunningService): ServiceState {
    return {
      name: service.name,
      cmd: service.cmd,
      port: service.port,
      hasHealthcheck: Boolean(service.healthcheck),
      status: runtime.status,
      health: runtime.health,
      pid: runtime.pid,
      startedAt: runtime.startedAt,
      exitCode: runtime.exitCode,
    };
  }

  function getStatus(): ServiceState[] {
    return loadManifestServices(root).map((service) => toState(service, runtimeFor(service.name)));
  }

  function getLog(name: string): string | null {
    const service = loadManifestServices(root).find((s) => s.name === name);
    if (!service) return null;
    const runtime = runtimeFor(name);
    return runtime.log.join('\n');
  }

  async function killAll(): Promise<void> {
    for (const runtime of runtimes.values()) {
      stopHealthPolling(runtime);
      runtime.proc?.kill();
    }
  }

  return {
    start,
    stop,
    getStatus,
    getLog,
    killAll,
    getState: (): DeskServiceManagerState => state,
    subscribe(res: ServerResponse) {
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
  };
}
