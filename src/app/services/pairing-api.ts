import { apiUrl } from './api-base';

export interface PairingInfo {
  hostedClientUrl: string;
  token: string;
}

export const fetchPairingInfo = async (): Promise<PairingInfo | null> => {
  try {
    const response = await fetch(apiUrl('/api/pairing'));
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

export type PairCodeResult =
  | { ok: true; token: string; origin: string }
  /** `rejected`: the code expired, was used, or never existed. `outdated`: the daemon
   *  predates pairing at its root. `failed`: anything else, with the HTTP status. */
  | { ok: false; reason: 'rejected' | 'outdated' }
  | { ok: false; reason: 'failed'; status: number | null };

/** The registry holds machines this client is not currently pointed at, so the
 *  base URL is explicit — posting the code a human read off `paper-camp pair`
 *  in place of a token this client doesn't have yet (IDEA-292). */
export const pairWithCode = async (machineUrl: string, code: string): Promise<PairCodeResult> => {
  try {
    const response = await fetch(`${machineUrl}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (response.ok) {
      const { token, origin } = (await response.json()) as { token: string; origin: string };
      return { ok: true, token, origin };
    }
    if (response.status === 403) return { ok: false, reason: 'rejected' };
    if (response.status === 404) return { ok: false, reason: 'outdated' };
    return { ok: false, reason: 'failed', status: response.status };
  } catch {
    return { ok: false, reason: 'failed', status: null };
  }
};
