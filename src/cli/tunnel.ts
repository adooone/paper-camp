import { type ChildProcess, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface QuickTunnel {
  process: ChildProcess;
  url: string;
}

const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

export function extractTunnelUrl(output: string): string | null {
  return output.match(TUNNEL_URL_PATTERN)?.[0] ?? null;
}

export const CLOUDFLARED_MISSING_MESSAGE =
  '`cloudflared` is required for --share but was not found on PATH. Install it from ' +
  'https://developers.cloudflare.com/cloudflared/install-and-setup/installation/ ' +
  '(macOS: `brew install cloudflared`), then try again.';

export function isCloudflaredAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('cloudflared', ['--version'], { stdio: 'ignore' });
    proc.on('error', () => resolve(false));
    proc.on('exit', (code) => resolve(code === 0));
  });
}

/** `cloudflared` reads /etc/cloudflared/config.yml unless told otherwise, so on a
 *  machine already running a named tunnel `--url` silently joins that tunnel and
 *  serves its ingress rules instead — every request to the quick address hitting
 *  whatever catch-all it ends in. An empty config file is the only way to opt out. */
export function quickTunnelArgs(port: number, configPath: string): string[] {
  return ['--config', configPath, 'tunnel', '--url', `http://localhost:${port}`];
}

/** Spawns an account-less `cloudflared` quick tunnel pointed at the local dev
 *  server and resolves once its https address shows up in the process output —
 *  cloudflared only prints the address, there is no flag to have it returned
 *  structured. Rejects if the binary is missing or exits before printing one. */
export function startQuickTunnel(port: number): Promise<QuickTunnel> {
  return new Promise((resolve, reject) => {
    const configPath = join(tmpdir(), 'paper-camp-quick-tunnel.yml');
    try {
      writeFileSync(configPath, '');
    } catch (error) {
      reject(error);
      return;
    }
    const proc = spawn('cloudflared', quickTunnelArgs(port, configPath), {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;
    const onOutput = (data: Buffer) => {
      if (settled) return;
      const url = extractTunnelUrl(data.toString());
      if (!url) return;
      settled = true;
      proc.stdout?.off('data', onOutput);
      proc.stderr?.off('data', onOutput);
      // cloudflared keeps logging connection/metrics lines for the tunnel's
      // whole life; leaving the pipe undrained backs up its stdio and stalls it.
      proc.stdout?.resume();
      proc.stderr?.resume();
      resolve({ process: proc, url });
    };
    proc.stdout?.on('data', onOutput);
    proc.stderr?.on('data', onOutput);

    proc.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    proc.on('exit', (code) => {
      if (settled) return;
      settled = true;
      reject(new Error(`cloudflared exited before printing a tunnel address (code ${code})`));
    });
  });
}
