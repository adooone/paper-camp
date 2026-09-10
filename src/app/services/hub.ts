import type { MachineProjectSummary } from '@/types/index';

/**
 * A project is chosen once it's embedded under a mount prefix or paired with
 * a runtime it dialled. The hosted client starts with neither.
 */
export function hasChosenProject(mountPrefix: string, runtimeUrl: string): boolean {
  return mountPrefix !== '' || runtimeUrl !== '';
}

/**
 * The third way in, and the one `paper-camp dev` uses: a bundle a runtime
 * serves is same-origin with that runtime's API, so the repo serving the
 * page IS the project — nothing to pair, register, or leave. Only a probe
 * separates it from a hosted bundle, which has no API at its own origin: the
 * daemon root and any other static host answer `/api/*` with a 404.
 */
export async function servesOwnRuntime(
  runtimeUrl: string,
  fetchApi: (path: string) => Promise<{ ok: boolean }>,
): Promise<boolean> {
  if (runtimeUrl !== '') return false;
  try {
    const response = await fetchApi('/api/package-name');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Reuses the same `?runtime=&token=` query params `runtime-connection.ts`
 * already reads and persists, so an address is adopted exactly like a
 * registration link — a pasted or discovered one carries no token, a
 * machine's own project does.
 */
export function runtimeAdditionUrl(
  currentPath: string,
  runtimeUrl: string,
  pairingToken?: string | null,
): string {
  const params = new URLSearchParams({ runtime: runtimeUrl });
  if (pairingToken) params.set('token', pairingToken);
  return `${currentPath}?${params}`;
}

/**
 * A registered runtime has no announced project name yet, so the address
 * itself is the only row label available.
 */
export function runtimeRowLabel(runtimeUrl: string): string {
  try {
    return new URL(runtimeUrl).host;
  } catch {
    return runtimeUrl;
  }
}

/**
 * A daemon-served project is just a runtime whose base URL happens to be
 * `<machine>/p/<slug>` — the existing runtime-add flow opens it unchanged.
 */
export function machineProjectRuntimeUrl(machineUrl: string, slug: string): string {
  return `${machineUrl}/p/${slug}`;
}

/**
 * A discovered peer already sitting in the registry is not still "addable" —
 * compared by runtimeUrl, the same identity a runtime entry's `projectEntryId` uses.
 */
export function pickableTailnetPeers<T extends { runtimeUrl: string }>(
  peers: T[],
  chosenRuntimeUrls: string[],
): T[] {
  const chosen = new Set(chosenRuntimeUrls);
  return peers.filter((peer) => !chosen.has(peer.runtimeUrl));
}

export function pickableMachineProjects(
  machineUrl: string,
  projects: MachineProjectSummary[],
  chosenRuntimeUrls: string[],
): MachineProjectSummary[] {
  const chosen = new Set(chosenRuntimeUrls);
  return projects.filter(
    (project) => !chosen.has(machineProjectRuntimeUrl(machineUrl, project.slug)),
  );
}

/**
 * The slug a `?machine=` link should skip the project list for: the most
 * recently dialled project this browser already opened on that machine
 * (last in `chosenRuntimeUrls`, which is dial order), else the machine's
 * only project on a first visit. A missing project is never auto-opened —
 * that folder is gone, so the list is where its `rm` hint lives.
 */
export function resolveMachineProjectSlug(
  machineUrl: string,
  projects: MachineProjectSummary[],
  chosenRuntimeUrls: string[],
): string | null {
  const present = projects.filter((project) => !project.missing);
  const bySlug = new Map(
    present.map((project) => [machineProjectRuntimeUrl(machineUrl, project.slug), project.slug]),
  );
  const lastDialled = [...chosenRuntimeUrls].reverse().find((url) => bySlug.has(url));
  if (lastDialled) return bySlug.get(lastDialled) ?? null;
  return present.length === 1 ? present[0].slug : null;
}

/**
 * The origin serving this SPA is a machine, not just a hosted bundle, when
 * there's no mount prefix to say otherwise and that origin answers its own
 * `/api/machine/projects` — the state a `paper-camp start`/`daemon` root is
 * in before any project is picked. Same-origin, so the request passes the
 * daemon's Host check the way loopback and LAN already do — no pairing
 * token involved, unlike a `?machine=&token=` link.
 */
export async function detectThisMachine(
  mountPrefix: string,
  origin: string,
  fetchMachineProjects: (machineUrl: string) => Promise<MachineProjectSummary[] | null>,
): Promise<MachineProjectSummary[] | null> {
  if (mountPrefix !== '') return null;
  return fetchMachineProjects(origin);
}

export function daemonStartCommand(hubOrigin: string): string {
  return new URL(hubOrigin).protocol === 'https:'
    ? 'paper-camp start --tailnet'
    : 'paper-camp start';
}
