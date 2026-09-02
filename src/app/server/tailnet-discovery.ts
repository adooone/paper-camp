import { readTailnetStatus } from '@/core/tailnet';
import type { TailnetPeerRuntime } from '@/types/index';

const PROBE_TIMEOUT_MS = 1500;
const DEFAULT_DEV_PORT = 3333;

async function probePeer(dnsName: string): Promise<TailnetPeerRuntime | null> {
  const runtimeUrl = `http://${dnsName}:${DEFAULT_DEV_PORT}`;
  try {
    const response = await fetch(`${runtimeUrl}/api/capabilities`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: string };
    return { dnsName, runtimeUrl, version: body.version ?? null };
  } catch {
    return null;
  }
}

async function probeAllPeers(): Promise<TailnetPeerRuntime[]> {
  const status = await readTailnetStatus();
  if (!status) return [];
  const results = await Promise.all(status.onlinePeers.map((peer) => probePeer(peer.dnsName)));
  return results.filter((result): result is TailnetPeerRuntime => result !== null);
}

// Session-scoped: reprobing every online peer on each hub load would be slow and
// noisy, so a result lives until the process restarts or a caller asks to refresh.
let cached: Promise<TailnetPeerRuntime[]> | undefined;

export async function discoverTailnetPeerRuntimes(refresh = false): Promise<TailnetPeerRuntime[]> {
  if (refresh) cached = undefined;
  cached ??= probeAllPeers();
  return cached;
}

export function resetTailnetPeerDiscoveryCache(): void {
  cached = undefined;
}
