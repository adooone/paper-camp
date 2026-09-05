import { spawn } from 'node:child_process';

export interface ProbeResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const DEFAULT_TIMEOUT_MS = 5000;
const KILL_SIGNAL = 'SIGTERM';

// `gh`/`claude`/`opencode --version` are the slowest probes; a shorter timeout
// here reports one as slow instead of stalling every other probe alongside it.
export const VERSION_PROBE_TIMEOUT_MS = 2000;

export function run(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
      killSignal: KILL_SIGNAL,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on('close', (code, signal) =>
      resolve({ code, stdout, stderr, timedOut: code === null && signal === KILL_SIGNAL }),
    );
    // Missing binary: spawn emits 'error' instead of 'close'.
    proc.on('error', () => resolve({ code: null, stdout: '', stderr: '', timedOut: false }));
  });
}
