import type { ChildProcess } from 'node:child_process';

// SIGTERM can be ignored or delayed indefinitely; escalate to SIGKILL so a stuck
// process never blocks the caller forever.
export function killWithEscalation(proc: ChildProcess, graceMs = 5000): void {
  if (!proc.killed) proc.kill('SIGTERM');
  setTimeout(() => {
    if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
  }, graceMs);
}

// A stalled or clarifying-question hang becomes a timeout failure rather than
// blocking the caller indefinitely.
export function runProcessWithTimeout(
  proc: ChildProcess,
  timeoutMs: number,
): Promise<{ ok: boolean; timedOut: boolean }> {
  return new Promise((resolve) => {
    let timedOut = false;
    const procDone = new Promise<boolean>((res) => {
      proc.on('close', (code) => res(code === 0));
      proc.on('error', () => res(false));
    });
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      killWithEscalation(proc);
    }, timeoutMs);
    procDone.then((ok) => {
      clearTimeout(timeoutHandle);
      resolve({ ok, timedOut });
    });
  });
}
