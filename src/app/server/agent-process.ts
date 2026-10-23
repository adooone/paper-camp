import type { ChildProcess } from 'node:child_process';

// SIGTERM can be ignored or delayed indefinitely; escalate to SIGKILL so a stuck
// process never blocks the caller forever.
export function killWithEscalation(proc: ChildProcess, graceMs = 5000): void {
  if (!proc.killed) proc.kill('SIGTERM');
  setTimeout(() => {
    if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
  }, graceMs).unref();
}

const STALL_CHECK_INTERVAL_MS = 1000;

// A stalled or clarifying-question hang becomes a timeout rather than blocking forever.
// Idle time resets per streamed line, so an active phase survives; wall-clock catches one that never finishes.
export function runProcessWithTimeout(
  proc: ChildProcess,
  idleMs: number,
  wallClockMs: number,
  getLastStreamAt: () => number,
): Promise<{ ok: boolean; timedOut: boolean }> {
  return new Promise((resolve) => {
    let timedOut = false;
    let killed = false;
    const startedAt = Date.now();
    const procDone = new Promise<boolean>((res) => {
      proc.on('close', (code) => res(code === 0));
      proc.on('error', () => res(false));
    });
    const checkHandle = setInterval(() => {
      const now = Date.now();
      if (!killed && (now - getLastStreamAt() >= idleMs || now - startedAt >= wallClockMs)) {
        timedOut = true;
        killed = true;
        killWithEscalation(proc);
      }
    }, STALL_CHECK_INTERVAL_MS);
    procDone.then((ok) => {
      clearInterval(checkHandle);
      resolve({ ok, timedOut });
    });
  });
}
