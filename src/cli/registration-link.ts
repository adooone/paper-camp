import { hostname, networkInterfaces } from 'node:os';

// The generic multi-project client this package deploys (IDEA-204) — the one
// place a runtime's registration accumulates into a cross-project registry,
// since that registry lives in this origin's localStorage. A link built from
// the runtime's own address instead would register it under that runtime's
// own origin, which no other project's runtime ever shares — never joining
// into one desk. A fork serving its own deployment overrides the origin.
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

export function buildRegistrationLink(
  port: number,
  pairingToken: string,
  host = 'localhost',
  clientUrl = hostedClientUrl(),
): string {
  return buildRegistrationLinkForRuntime(`http://${host}:${port}`, pairingToken, clientUrl);
}

/**
 * `localhost` only reaches the runtime from the machine running it, so a link built
 * from it is dead in exactly the setup the hosted client exists for — a browser
 * somewhere else. Returns every non-loopback address this host answers on too, so
 * the caller can offer one their browser can actually reach.
 */
export function reachableHosts(
  interfaces: Record<string, { family: string; internal: boolean; address: string }[] | undefined>,
  ownHostname: string,
): string[] {
  const addresses = Object.values(interfaces)
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
  return [...new Set(['localhost', ownHostname, ...addresses])].filter((host) => host !== '');
}

export function registrationLinks(port: number, pairingToken: string): string[] {
  return reachableHosts(
    networkInterfaces() as Parameters<typeof reachableHosts>[0],
    hostname(),
  ).map((host) => buildRegistrationLink(port, pairingToken, host));
}
