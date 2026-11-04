import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { RateLimitSnapshot } from '@/types/index';
import { isAuthFailure } from './agent-signin';
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

export interface SignInProbe {
  /** null when the CLI failed for a reason that says nothing about sign-in. */
  signedIn: boolean | null;
  reason?: string;
}

const SIGN_IN_PROBE_TIMEOUT_MS = 45_000;

function lineType(line: string): unknown {
  try {
    return (JSON.parse(line) as { type?: unknown }).type;
  } catch {
    return undefined;
  }
}

/** `auth status` only checks that credentials exist; this makes a real request and
 *  stops at the first reply, so an expired session that cannot refresh shows up. */
export function probeSignIn(root: string): Promise<SignInProbe> {
  return new Promise((resolve) => {
    const proc = spawn(
      'claude',
      [
        '-p',
        'Reply with OK.',
        '--output-format',
        'stream-json',
        '--verbose',
        '--strict-mcp-config',
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let settled = false;
    let stderr = '';
    const settle = (value: SignInProbe) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      proc.kill('SIGTERM');
      resolve(value);
    };
    const timer = setTimeout(
      () => settle({ signedIn: null, reason: 'Claude did not answer in time' }),
      SIGN_IN_PROBE_TIMEOUT_MS,
    );

    createInterface({ input: proc.stdout }).on('line', (line) => {
      const parsed = parseLine(line);
      if (lineType(line) === 'assistant' && parsed?.text) {
        const failed = isAuthFailure(parsed.text);
        settle({ signedIn: !failed, ...(failed && { reason: parsed.text }) });
        return;
      }
      if (!parsed?.done) return;
      if (!parsed.error) settle({ signedIn: true });
      else settle({ signedIn: isAuthFailure(parsed.reason) ? false : null, reason: parsed.reason });
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('error', (err) => settle({ signedIn: null, reason: err.message }));
    proc.on('close', () => {
      const reason = stderr.trim() || undefined;
      settle({ signedIn: isAuthFailure(reason) ? false : null, reason });
    });
  });
}
