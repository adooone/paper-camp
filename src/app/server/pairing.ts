import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { campFile } from './helpers';

export interface PairingManagerState {
  token: string;
  origins: Set<string>;
}

interface PersistedPairingState {
  token: string;
  origins: string[];
}

const pairingFilePath = (root: string) => campFile(root, '.pairing.json');

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
export async function loadPairingState(root: string): Promise<PairingManagerState | undefined> {
  try {
    const raw = await readFile(pairingFilePath(root), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!isPersistedPairingState(parsed)) return undefined;
    return { token: parsed.token, origins: new Set(parsed.origins) };
  } catch {
    return undefined;
  }
}

/** Mode 0600: the token in this file is equivalent to a bearer credential. */
export async function savePairingState(root: string, state: PairingManagerState): Promise<void> {
  const path = pairingFilePath(root);
  const payload: PersistedPairingState = { token: state.token, origins: [...state.origins] };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: 'utf-8',
    mode: 0o600,
  });
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
export function createPairingManager(state?: PairingManagerState): PairingManager {
  const token = state?.token ?? randomBytes(32).toString('hex');
  const origins = state?.origins ?? new Set<string>();

  return {
    token,
    isPairedOrigin: (origin) => origins.has(origin),
    pair: (candidateToken, origin) => {
      if (candidateToken !== token) return false;
      origins.add(origin);
      return true;
    },
    getState: () => ({ token, origins }),
  };
}
