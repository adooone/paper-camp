import type { ChildProcess } from 'node:child_process';

// SIGTERM can be ignored or delayed indefinitely; escalate to SIGKILL so a stuck
// process never blocks the caller forever.
export function killWithEscalation(proc: ChildProcess, graceMs = 5000): void {
  if (!proc.killed) proc.kill('SIGTERM');
  setTimeout(() => {
    if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
  }, graceMs);
}

const STALL_CHECK_INTERVAL_MS = 1000;

// A stalled or clarifying-question hang becomes a timeout failure rather than
// blocking the caller indefinitely. Idle time resets on every streamed line, so a
// long but active phase survives; the wall-clock cap catches a phase that streams
// forever without ever finishing.
export function runProcessWithTimeout(
  proc: ChildProcess,
  idleMs: number,
  wallClockMs: number,
  getLastStreamAt: () => number,
): Promise<{ ok: boolean; timedOut: boolean }> {
  return new Promise((resolve) => {
    let timedOut = false;
    const startedAt = Date.now();
    const procDone = new Promise<boolean>((res) => {
      proc.on('close', (code) => res(code === 0));
      proc.on('error', () => res(false));
    });
    const checkHandle = setInterval(() => {
      const now = Date.now();
      if (now - getLastStreamAt() >= idleMs || now - startedAt >= wallClockMs) {
        timedOut = true;
        killWithEscalation(proc);
      }
    }, STALL_CHECK_INTERVAL_MS);
    procDone.then((ok) => {
      clearInterval(checkHandle);
      resolve({ ok, timedOut });
    });
  });
}
