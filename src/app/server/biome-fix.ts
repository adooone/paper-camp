import { spawn } from 'node:child_process';

// Shared by the "Fix" action, the run-all verification gate's pre-check, and the
// per-phase commit hook.
export const BIOME_FIX_COMMAND = 'npx biome check . --write';

// Best-effort: resolves even on a non-zero exit (unfixable lint) — the writer
// still applies every fix it can, and real failures surface through check-types.
export function runBiomeFix(root: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn(BIOME_FIX_COMMAND, { cwd: root, stdio: 'ignore', shell: true });
    proc.on('close', () => resolve());
    proc.on('error', () => resolve());
  });
}
