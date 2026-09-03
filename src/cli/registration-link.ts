import { hostname, networkInterfaces } from 'node:os';
import { readTailnetStatus } from '../core/tailnet';

// Every link shares this origin so registrations land in one localStorage registry.
const DEFAULT_HOSTED_CLIENT_URL = 'https://paper-camp.vercel.app';

export function hostedClientUrl(): string {
  const configured = process.env.PAPERCAMP_HOSTED_CLIENT_URL?.trim();
  return (configured || DEFAULT_HOSTED_CLIENT_URL).replace(/\/+$/, '');
}

export function buildRegistrationLinkForRuntime(
  runtimeUrl: string,
  pairingToken: string,
  clientUrl = hostedClientUrl(),
): string {
  const params = new URLSearchParams({ runtime: runtimeUrl, token: pairingToken });
  return `${clientUrl}/?${params}`;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Whether a browser on `clientOrigin` will let a fetch through to `runtimeUrl`: browsers
 *  treat loopback as trustworthy regardless of scheme, but otherwise refuse an http: fetch
 *  from an https: page outright as mixed content, without ever attempting the request. */
export function canReachRuntime(clientOrigin: string, runtimeUrl: string): boolean {
  const runtime = new URL(runtimeUrl);
  if (LOOPBACK_HOSTS.has(runtime.hostname)) return true;
  const client = new URL(clientOrigin);
  return client.protocol !== 'https:' || runtime.protocol === 'https:';
}

type InterfaceEntries = Record<
  string,
  { family: string; internal: boolean; address: string }[] | undefined
>;

// Container/VM bridge addresses are unreachable from any other machine.
const VIRTUAL_INTERFACE = /^(docker|br-|veth|virbr|vmnet)/;

function isTailnetAddress(address: string): boolean {
  const [a, b] = address.split('.').map(Number);
  return a === 100 && b >= 64 && b <= 127;
}

function isPrivateAddress(address: string): boolean {
  const [a, b] = address.split('.').map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/**
 * The single address another device's browser is most likely to reach: a tailnet
 * IP works from the user's other devices even off-LAN, a private LAN IP beats a
 * public one that's almost always firewalled, and the bare hostname is a last
 * resort since it only resolves where MagicDNS/mDNS happens to cover it.
 */
export function bestNetworkHost(
  interfaces: InterfaceEntries,
  ownHostname: string,
): string | undefined {
  const addresses = Object.entries(interfaces)
    .filter(([name]) => !VIRTUAL_INTERFACE.test(name))
    .flatMap(([, entries]) => entries ?? [])
    .filter(
      (entry) =>
        entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.'),
    )
    .map((entry) => entry.address);
  return (
    addresses.find(isTailnetAddress) ??
    addresses.find(isPrivateAddress) ??
    addresses[0] ??
    (ownHostname || undefined)
  );
}

export interface NetworkRegistration {
  link?: string;
  blocked: boolean;
}

/** Hosted-client pairing link for the best reachable host, if the machine has one. A
 *  MagicDNS name is preferred whenever Tailscale is up — stable across reboots and IP
 *  churn, already trusted tokenlessly, and the only form that can carry a certificate.
 *  `blocked` reports a host that exists but that the hosted client's browser will
 *  refuse to fetch, so the caller can print the fix instead of a dead link. */
export async function networkRegistrationLink(
  port: number,
  pairingToken: string,
): Promise<NetworkRegistration> {
  const tailnet = await readTailnetStatus();
  const host =
    tailnet?.selfDnsName ?? bestNetworkHost(networkInterfaces() as InterfaceEntries, hostname());
  if (host === undefined) return { blocked: false };
  const runtimeUrl = `http://${host}:${port}`;
  if (!canReachRuntime(hostedClientUrl(), runtimeUrl)) return { blocked: true };
  return { link: buildRegistrationLinkForRuntime(runtimeUrl, pairingToken), blocked: false };
}
