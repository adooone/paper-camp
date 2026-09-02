import { spawn } from 'node:child_process';

export interface TailnetPeer {
  dnsName: string;
}

export interface TailnetStatus {
  selfDnsName: string;
  magicDnsSuffix: string;
  onlinePeers: TailnetPeer[];
}

function runTailscaleStatus(): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('tailscale', ['status', '--json'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.on('close', (code) => resolve(code === 0 ? stdout : null));
    // Missing binary: spawn emits 'error' instead of 'close'.
    proc.on('error', () => resolve(null));
  });
}

interface RawPeer {
  DNSName?: string;
  Online?: boolean;
}

interface RawStatus {
  BackendState?: string;
  Self?: { DNSName?: string };
  MagicDNSSuffix?: string;
  Peer?: Record<string, RawPeer>;
}

// MagicDNS names come back FQDN-style with a trailing dot; every caller wants
// the plain hostname.
const stripTrailingDot = (name: string) => name.replace(/\.$/, '');

/** Reads this machine's tailnet identity via the local `tailscale` CLI — no account
 *  or API token needed. Resolves to undefined when Tailscale is missing, not logged
 *  in, or backend-stopped, so every caller can fall back to today's behaviour
 *  without special-casing "no tailnet". */
export async function readTailnetStatus(): Promise<TailnetStatus | undefined> {
  const output = await runTailscaleStatus();
  if (output === null) return undefined;

  let parsed: RawStatus;
  try {
    parsed = JSON.parse(output);
  } catch {
    return undefined;
  }

  if (parsed.BackendState !== 'Running') return undefined;
  const selfDnsName = parsed.Self?.DNSName;
  const magicDnsSuffix = parsed.MagicDNSSuffix;
  if (!selfDnsName || !magicDnsSuffix) return undefined;

  const onlinePeers = Object.values(parsed.Peer ?? {})
    .filter((peer) => peer.Online === true && Boolean(peer.DNSName))
    .map((peer) => ({ dnsName: stripTrailingDot(peer.DNSName as string) }));

  return {
    selfDnsName: stripTrailingDot(selfDnsName),
    magicDnsSuffix: stripTrailingDot(magicDnsSuffix),
    onlinePeers,
  };
}
