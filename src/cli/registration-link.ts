import { hostname, networkInterfaces } from 'node:os';

export function buildRegistrationLinkForRuntime(runtimeUrl: string, pairingToken: string): string {
  const params = new URLSearchParams({ runtime: runtimeUrl, token: pairingToken });
  return `${runtimeUrl}/?${params}`;
}

export function buildRegistrationLink(
  port: number,
  pairingToken: string,
  host = 'localhost',
): string {
  return buildRegistrationLinkForRuntime(`http://${host}:${port}`, pairingToken);
}

// `localhost` only reaches the runtime from the machine running it, so a link built
// from it is dead in exactly the setup the hosted client exists for — a browser
// somewhere else. Every non-loopback address this host answers on is offered too,
// and the caller picks the one their browser can actually reach.
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
