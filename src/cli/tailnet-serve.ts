import { spawn } from 'node:child_process';

export const TAILNET_NOT_RUNNING_MESSAGE =
  'papercamp: --tailnet needs Tailscale running and logged in on this machine ' +
  '(`tailscale status` should show it Running). Skipping tailnet serve.';

export const TAILNET_HTTPS_CERTS_ADMIN_LINK = 'https://login.tailscale.com/admin/dns';

export const TAILNET_HTTPS_CERTS_MISSING_MESSAGE = `Tailnet HTTPS certificates are not enabled. Enable them once in the Tailscale admin console (${TAILNET_HTTPS_CERTS_ADMIN_LINK}) under DNS → HTTPS Certificates, then rerun \`paper-camp dev --tailnet\`.`;

// `tailscale serve`/`cert` report one of these verbatim, checked against the installed
// binary — there is no distinct error code to switch on.
const MISSING_HTTPS_CERTS_PATTERN =
  /cert(ificate)? support is not enabled\/configured for your tailnet/i;

export function isMissingHttpsCertsError(output: string): boolean {
  return MISSING_HTTPS_CERTS_PATTERN.test(output);
}

export function tailnetServeArgs(port: number): string[] {
  return ['serve', '--bg', '--https=443', '/', `http://localhost:${port}`];
}

export interface TailnetServeResult {
  ok: boolean;
  output: string;
}

/** Registers this dev server behind the tailnet's stable HTTPS address. `--bg` makes
 *  the serve config outlive this command, so unlike the cloudflared quick tunnel this
 *  is a one-shot call, not a child process to keep alive. Needs sudo for the
 *  privileged :443 bind and, on first run, to provision the certificate — stdin stays
 *  attached so a password prompt reaches the user's terminal. */
export function runTailnetServe(port: number): Promise<TailnetServeResult> {
  return new Promise((resolve) => {
    const proc = spawn('sudo', ['tailscale', ...tailnetServeArgs(port)], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    let output = '';
    proc.stdout?.on('data', (d: Buffer) => {
      output += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      output += d.toString();
    });
    proc.on('close', (code) => resolve({ ok: code === 0, output }));
    proc.on('error', (error) => resolve({ ok: false, output: error.message }));
  });
}
