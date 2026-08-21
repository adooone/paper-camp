import { randomBytes } from 'node:crypto';

export interface PairingManagerState {
  token: string;
  origins: Set<string>;
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
