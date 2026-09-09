import { spawn } from 'node:child_process';

export const TAILNET_NOT_RUNNING_MESSAGE =
  'papercamp: --tailnet needs Tailscale running and logged in on this machine ' +
  '(`tailscale status` should show it Running). Skipping tailnet serve.';

export const TAILNET_HTTPS_CERTS_ADMIN_LINK = 'https://login.tailscale.com/admin/dns';

export const TAILNET_HTTPS_CERTS_MISSING_MESSAGE = `Tailnet HTTPS certificates are not enabled. Enable them once in the Tailscale admin console (${TAILNET_HTTPS_CERTS_ADMIN_LINK}) under DNS → HTTPS Certificates, then rerun with \`--tailnet\`.`;

// `tailscale serve`/`cert` report one of these verbatim, checked against the installed
// binary — there is no distinct error code to switch on.
const MISSING_HTTPS_CERTS_PATTERN =
  /cert(ificate)? support is not enabled\/configured for your tailnet/i;

export function isMissingHttpsCertsError(output: string): boolean {
  return MISSING_HTTPS_CERTS_PATTERN.test(output);
}

export function tailnetServeArgs(port: number): string[] {
  // No mount path argument: `tailscale serve` (1.60+) takes only the target and
  // rejects a bare `/` as an invalid argument format.
  return ['serve', '--bg', '--https=443', `http://localhost:${port}`];
}

export interface TailnetServeResult {
  ok: boolean;
  output: string;
}

const SERVE_TIMEOUT_MS = 20_000;

export const TAILNET_SERVE_NOT_ENABLED_MESSAGE =
  'Tailscale Serve is not enabled on your tailnet. Enable it once from the link Tailscale prints below, then rerun with `--tailnet`.';

export const TAILNET_OPERATOR_MESSAGE =
  'This user may not configure Tailscale. Run `sudo tailscale set --operator=$USER` once, then rerun with `--tailnet`.';

const SERVE_NOT_ENABLED_PATTERN = /serve is not enabled/i;
const OPERATOR_PATTERN = /access denied|permission denied|operator/i;

/** One line naming the remedy for a failed `tailscale serve`, followed by the
 * CLI's own output so the enable link it prints is not lost. */
export function tailnetFailureMessage(output: string): string {
  const reason = isMissingHttpsCertsError(output)
    ? TAILNET_HTTPS_CERTS_MISSING_MESSAGE
    : SERVE_NOT_ENABLED_PATTERN.test(output)
      ? TAILNET_SERVE_NOT_ENABLED_MESSAGE
      : OPERATOR_PATTERN.test(output)
        ? TAILNET_OPERATOR_MESSAGE
        : 'tailscale serve failed.';
  const detail = output.trim();
  return `papercamp: Tailnet failed — ${reason}${detail ? `\n${detail}` : ''}`;
}

/** Registers this server behind the tailnet's stable HTTPS address. `--bg` makes
 *  the serve config outlive this command, so unlike the cloudflared quick tunnel this
 *  is a one-shot call, not a child process to keep alive. Runs as the current user —
 *  the daemon is detached with no terminal for a sudo prompt, so the one-time
 *  `tailscale set --operator` grant is the supported path. Bounded, because the CLI
 *  waits indefinitely when Serve is not enabled on the tailnet. */
export function runTailnetServe(port: number): Promise<TailnetServeResult> {
  return new Promise((resolve) => {
    const proc = spawn('tailscale', tailnetServeArgs(port), {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let settled = false;
    const settle = (result: TailnetServeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      settle({ ok: false, output: `${output}\n(timed out after ${SERVE_TIMEOUT_MS / 1000}s)` });
    }, SERVE_TIMEOUT_MS);
    proc.stdout?.on('data', (d: Buffer) => {
      output += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      output += d.toString();
    });
    proc.on('close', (code) => settle({ ok: code === 0, output }));
    proc.on('error', (error) => settle({ ok: false, output: error.message }));
  });
}
