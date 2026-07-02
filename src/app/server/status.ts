import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { CheckName, CheckResult, CheckStatus } from '../../types';

interface StatusSnapshot {
  lint: CheckResult;
  format: CheckResult;
  test: CheckResult;
}

const CHECK_COMMANDS: Record<CheckName, string> = {
  lint: 'npx biome lint .',
  format: 'npx biome format .',
  test: 'npx vitest run',
};

export type StatusManager = ReturnType<typeof createStatusManager>;

export function createStatusManager(root: string) {
  const clients = new Set<ServerResponse>();
  const snapshot: StatusSnapshot = {
    lint: { status: 'stale', lastRun: null, output: '' },
    format: { status: 'stale', lastRun: null, output: '' },
    test: { status: 'stale', lastRun: null, output: '' },
  };
  const running = new Set<CheckName>();
  const queued = new Set<CheckName>();

  function broadcast(event: { message: string; timestamp: string }) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
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
    if (running.has(name)) {
      queued.add(name);
      return;
    }
    running.add(name);
    setResult(name, 'running', '');

    const cmd = CHECK_COMMANDS[name];
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

    const proc = spawn('npx biome check . --write', {
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

  // One-shot: spawn fresh processes for all three checks and resolve true only if
  // all pass. Intentionally bypasses the queue so callers get a clean result that
  // reflects the current working tree rather than a stale cached status.
  function runChecksAndWait(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const names: CheckName[] = ['lint', 'format', 'test'];
      const passed: Record<CheckName, boolean | null> = { lint: null, format: null, test: null };
      let pending = names.length;

      function onDone(name: CheckName, ok: boolean) {
        passed[name] = ok;
        pending--;
        if (pending === 0) resolve(names.every((n) => passed[n] === true));
      }

      for (const name of names) {
        const proc = spawn(CHECK_COMMANDS[name], { cwd: root, stdio: 'ignore', shell: true });
        proc.on('close', (code) => onDone(name, code === 0));
        proc.on('error', () => onDone(name, false));
      }
    });
  }

  return {
    getStatus(): StatusSnapshot {
      return {
        lint: { ...snapshot.lint },
        format: { ...snapshot.format },
        test: { ...snapshot.test },
      };
    },
    runCheck,
    runChecksAndWait,
    runQualityFix,
    subscribe(res: ServerResponse) {
      clients.add(res);
      for (const name of ['lint', 'format', 'test'] as CheckName[]) {
        const result = snapshot[name];
        if (result.status !== 'stale') {
          res.write(
            `data: ${JSON.stringify({ message: `${name}: ${result.status}`, timestamp: result.lastRun })}\n\n`,
          );
        }
      }
      res.on('close', () => clients.delete(res));
    },
  };
}
