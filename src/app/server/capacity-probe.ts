import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { RateLimitSnapshot } from '@/types/index';
import { parseLine } from './agents/claude-code';

const PROBE_TIMEOUT_MS = 20_000;

/** The CLI emits `rate_limit_event` as the second line of the stream, before any model
 *  output, so killing on it costs no generated tokens — measured at ~3.4s. */
export function probeCapacity(root: string): Promise<RateLimitSnapshot | null> {
  return new Promise((resolve) => {
    const proc = spawn(
      'claude',
      ['-p', 'hi', '--output-format', 'stream-json', '--verbose', '--strict-mcp-config'],
      { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    let settled = false;
    const settle = (value: RateLimitSnapshot | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      proc.kill('SIGTERM');
      resolve(value);
    };
    const timer = setTimeout(() => settle(null), PROBE_TIMEOUT_MS);

    createInterface({ input: proc.stdout }).on('line', (line) => {
      const rateLimit = parseLine(line)?.rateLimit;
      if (rateLimit) settle(rateLimit);
    });
    proc.on('error', () => settle(null));
    proc.on('close', () => settle(null));
  });
}
