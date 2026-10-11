import type { MachineProjectsResponse } from '@/types/index';
import { addMachine } from './machine-store';

const MACHINE_URL_PARAM = 'machine';
const PAIRING_TOKEN_PARAM = 'token';
const PAIR_HASH_PREFIX = '#pair=';

export interface MachineConnection {
  machineUrl: string;
  pairingToken: string | null;
}

// Absent whenever the visit carries no `?machine=` link — the daemon's own,
// distinct from `?runtime=` so this hub never mistakes the daemon root for a project.
export function readMachineConnection(location: { search: string } | null): MachineConnection {
  const params = new URLSearchParams(location?.search ?? '');
  return {
    machineUrl: params.get(MACHINE_URL_PARAM) ?? '',
    pairingToken: params.get(PAIRING_TOKEN_PARAM),
  };
}

/**
 * A `?machine=&token=` visit is remembered immediately, before `main.tsx`
 * rewrites the URL to the bare hub path — `machine-store.ts` is what still
 * knows about it once that happens.
 */
export function loadMachineConnection(location: { search: string } | null): MachineConnection {
  const connection = readMachineConnection(location);
  if (connection.machineUrl) addMachine(connection.machineUrl, connection.pairingToken);
  return connection;
}

export const machineConnection = loadMachineConnection(
  typeof window === 'undefined' ? null : window.location,
);

export interface PairCodeInput {
  code: string;
  host: string;
  machineUrl: string;
}

/** `7KQ4-M9XZ@deimos.pitta-ray.ts.net`, as `paper-camp pair` prints it and a
 *  phone's QR code or a pasted code carries it — scheme is always `https`,
 *  never a LAN address or a tunnel (IDEA-292). */
export function parsePairCode(raw: string): PairCodeInput | null {
  const trimmed = raw.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return null;
  const host = trimmed.slice(at + 1);
  return { code: trimmed.slice(0, at), host, machineUrl: `https://${host}` };
}

/** The first label of a tailnet hostname, for a short "Can't reach deimos"
 *  rather than its full `deimos.pitta-ray.ts.net` (IDEA-292). */
export function hostLabel(host: string): string {
  return host.split('.')[0];
}

/** `#pair=` never reaches the server, unlike a `?machine=&token=` link's
 *  query string — the whole point of putting the code in the fragment
 *  (IDEA-292). Clearing the fragment is the caller's job, since that's a DOM
 *  effect this pure reader has no business doing. */
export function readPairCodeFromHash(hash: string): PairCodeInput | null {
  if (!hash.startsWith(PAIR_HASH_PREFIX)) return null;
  return parsePairCode(decodeURIComponent(hash.slice(PAIR_HASH_PREFIX.length)));
}

export type PairMachineOutcome =
  | { ok: true; machineUrl: string; pairingToken: string }
  | { ok: false; reason: 'unreachable' | 'rejected' };

/** Stores the token exactly as a `?machine=&token=` link's token is stored
 *  today via `addMachine` — only how the token is obtained differs, so
 *  nothing after pairing changes (IDEA-292). */
export async function pairMachine(
  machineUrl: string,
  code: string,
  probeMachine: (machineUrl: string) => Promise<MachineProjectsResponse | null>,
  redeemCode: (
    machineUrl: string,
    code: string,
  ) => Promise<{ token: string; origin: string } | null>,
): Promise<PairMachineOutcome> {
  const reachable = await probeMachine(machineUrl);
  if (!reachable) return { ok: false, reason: 'unreachable' };
  const result = await redeemCode(machineUrl, code);
  if (!result) return { ok: false, reason: 'rejected' };
  addMachine(machineUrl, result.token);
  return { ok: true, machineUrl, pairingToken: result.token };
}

/**
 * The redirect a successful code pairing takes, carrying `machine` and
 * `token` onto this origin exactly as a pasted `?machine=&token=` link
 * would — so `machineConnection`'s existing reader picks it up unchanged
 * (IDEA-292).
 */
export function buildMachineLink(
  machineUrl: string,
  token: string,
  origin: string,
  prefix: string,
): string {
  const params = new URLSearchParams({ [MACHINE_URL_PARAM]: machineUrl });
  if (token) params.set(PAIRING_TOKEN_PARAM, token);
  return `${origin}${prefix || '/'}?${params}`;
}
