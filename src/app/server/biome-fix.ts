import { spawn } from 'node:child_process';

const BIOME_FIX_COMMAND = 'npx biome check . --write';

const BIOME_FIX_TIMEOUT_MS = 60_000;

// Best-effort: non-zero exits still resolve, since real failures surface via check-types.
// Its own process group, so a timeout kills npx's whole chain and not just the shell.
export function runBiomeFix(
  root: string,
  command = BIOME_FIX_COMMAND,
  timeoutMs = BIOME_FIX_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn(command, { cwd: root, stdio: 'ignore', shell: true, detached: true });
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      try {
        if (proc.pid) process.kill(-proc.pid, 'SIGKILL');
      } catch {}
      done();
    }, timeoutMs);
    proc.on('close', done);
    proc.on('error', done);
  });
}
