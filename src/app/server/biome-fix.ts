import { spawn } from 'node:child_process';

// Shared by the "Fix" action, the run-all verification gate's pre-check, and the
// per-phase commit hook.
export const BIOME_FIX_COMMAND = 'npx biome check . --write';

const BIOME_FIX_TIMEOUT_MS = 60_000;

// Best-effort: resolves even on a non-zero exit (unfixable lint) — the writer
// still applies every fix it can, and real failures surface through check-types.
// A hung process is killed after the timeout so it can't stall the phase commit.
export function runBiomeFix(root: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn(BIOME_FIX_COMMAND, { cwd: root, stdio: 'ignore', shell: true });
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      done();
    }, BIOME_FIX_TIMEOUT_MS);
    proc.on('close', done);
    proc.on('error', done);
  });
}
