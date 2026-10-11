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

export interface PairCodeResult {
  token: string;
  origin: string;
}

/** The registry holds machines this client is not currently pointed at, so the
 *  base URL is explicit — posting the code a human read off `paper-camp pair`
 *  in place of a token this client doesn't have yet (IDEA-292). */
export const pairWithCode = async (
  machineUrl: string,
  code: string,
): Promise<PairCodeResult | null> => {
  try {
    const response = await fetch(`${machineUrl}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) return null;
    return (await response.json()) as PairCodeResult;
  } catch {
    return null;
  }
};
