import { type ChildProcess, spawn } from 'node:child_process';

export interface QuickTunnel {
  process: ChildProcess;
  url: string;
}

const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

export function extractTunnelUrl(output: string): string | null {
  return output.match(TUNNEL_URL_PATTERN)?.[0] ?? null;
}

/** Spawns an account-less `cloudflared` quick tunnel pointed at the local dev
 *  server and resolves once its https address shows up in the process output —
 *  cloudflared only prints the address, there is no flag to have it returned
 *  structured. Rejects if the binary is missing or exits before printing one. */
export function startQuickTunnel(port: number): Promise<QuickTunnel> {
  return new Promise((resolve, reject) => {
    const proc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
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
