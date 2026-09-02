import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { machineConfigDir } from '@/core/machine-registry';
import { campFile } from './helpers';

export interface PairingManagerState {
  token: string;
  origins: Set<string>;
}

interface PersistedPairingState {
  token: string;
  origins: string[];
}

export const projectPairingPath = (root: string) => campFile(root, '.pairing.json');

/** Beside the machine registry — one token pairs the hub to every project a
 * daemon serves, replacing a mounted project's own `papercamp/.pairing.json`. */
export const machinePairingPath = () => join(machineConfigDir(), 'pairing.json');

function isPersistedPairingState(value: unknown): value is PersistedPairingState {
  const v = value as Partial<PersistedPairingState> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.token === 'string' &&
    Array.isArray(v.origins) &&
    v.origins.every((origin) => typeof origin === 'string')
  );
}

/** Resolves `undefined` on a missing or malformed file — callers mint a fresh
 * state in that case, same as a first-ever boot. */
export async function loadPairingState(path: string): Promise<PairingManagerState | undefined> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (error) {
    // ENOENT is a first-ever boot or a revoked (deleted) file — anything else
    // (EACCES, EISDIR) means the state is there and unreadable, worth surfacing.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('papercamp: could not read pairing state:', error);
    }
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPersistedPairingState(parsed)) return undefined;
    return { token: parsed.token, origins: new Set(parsed.origins) };
  } catch {
    return undefined;
  }
}

/** Mode 0600: the token in this file is equivalent to a bearer credential.
 * Written to a sibling temp path and renamed into place — the rename is atomic,
 * so a concurrent save or a crash mid-write can never leave a truncated file
 * for `loadPairingState` to trip over, and since the temp file is always newly
 * created, its mode is 0600 regardless of what the replaced file's mode was. */
export async function savePairingState(path: string, state: PairingManagerState): Promise<void> {
  const payload: PersistedPairingState = { token: state.token, origins: [...state.origins] };
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: 'utf-8',
    mode: 0o600,
  });
  await rename(tmpPath, path);
}

/** Loads persisted state for a restart, or mints a fresh token and empty origin
 * set — the same path a first-ever boot and a revoked (deleted) file both take.
 * `minted` tells the caller whether this state still needs to be persisted. */
export async function loadOrMintPairingState(
  path: string,
): Promise<{ state: PairingManagerState; minted: boolean }> {
  const loaded = await loadPairingState(path);
  if (loaded) return { state: loaded, minted: false };
  return { state: createPairingManager().getState(), minted: true };
}

export interface PairingManager {
  token: string;
  isPairedOrigin: (origin: string) => boolean;
  pair: (candidateToken: string, origin: string) => boolean;
  getState: () => PairingManagerState;
}

/** Trust for a hosted client that only network topology can't establish — the
 *  token is printed once when the runtime starts, and pairing adds the client's
 *  exact origin to an allow-list `isForbiddenRequest` then treats as trusted. */
export function createPairingManager(
  state?: PairingManagerState,
  onPair?: (origin: string) => void,
): PairingManager {
  const token = state?.token ?? randomBytes(32).toString('hex');
  const origins = state?.origins ?? new Set<string>();

  return {
    token,
    isPairedOrigin: (origin) => origins.has(origin),
    pair: (candidateToken, origin) => {
      if (candidateToken !== token) return false;
      origins.add(origin);
      onPair?.(origin);
      return true;
    },
    getState: () => ({ token, origins }),
  };
}
