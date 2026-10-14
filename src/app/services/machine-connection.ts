import type { MachineProjectsResponse } from '@/types/index';
import { addMachine } from './machine-store';
import type { PairCodeResult } from './pairing-api';

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

const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/** A code as typed or pasted (`1600-3ebr`, `16003EBR`) to the `1600-3EBR` form
 *  `paper-camp pair` prints, or null when it isn't eight code characters. */
export function normalizePairCode(raw: string): string | null {
  const compact = raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return CROCKFORD.test(compact) ? `${compact.slice(0, 4)}-${compact.slice(4)}` : null;
}

/** The machine field: a full address, or a short name like `deimos` completed from a
 *  machine this browser already knows on the same tailnet. Null when it can't resolve. */
export function resolveMachineHost(
  raw: string,
  knownMachineUrls: readonly string[],
): { host: string; machineUrl: string } | null {
  const host = raw
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .toLowerCase();
  if (!host || /[\s/@]/.test(host)) return null;
  if (host.includes('.')) return { host, machineUrl: `https://${host}` };
  for (const url of knownMachineUrls) {
    const known = url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const dot = known.indexOf('.');
    if (dot > 0 && known.endsWith('.ts.net')) {
      const full = `${host}${known.slice(dot)}`;
      return { host: full, machineUrl: `https://${full}` };
    }
  }
  return null;
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
  | { ok: false; reason: 'unreachable' | 'rejected' | 'outdated' }
  | { ok: false; reason: 'failed'; status: number | null };

/** Stores the token exactly as a `?machine=&token=` link's token is stored
 *  today via `addMachine` — only how the token is obtained differs, so
 *  nothing after pairing changes (IDEA-292). */
export async function pairMachine(
  machineUrl: string,
  code: string,
  probeMachine: (machineUrl: string) => Promise<MachineProjectsResponse | null>,
  redeemCode: (machineUrl: string, code: string) => Promise<PairCodeResult>,
): Promise<PairMachineOutcome> {
  const reachable = await probeMachine(machineUrl);
  if (!reachable) return { ok: false, reason: 'unreachable' };
  const result = await redeemCode(machineUrl, code);
  if (!result.ok) return result;
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
