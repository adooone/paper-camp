import { PAIRING_TOKEN_HEADER } from '@/types/index';

let base = '';
let pairingToken: string | null = null;

export function setApiBase(value: string): void {
  base = value;
}

export function setApiPairingToken(value: string | null): void {
  pairingToken = value;
}

export function apiUrl(path: string): string {
  return `${base}${path}`;
}

/** A trusted host reached over a non-loopback origin (LAN, tunnel) can't rely on
 *  Origin alone — browsers omit it on same-origin GETs — so every request carries
 *  the pairing token whenever this client holds one; isForbiddenRequest ignores
 *  the header once Origin or loopback already established trust. */
export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!pairingToken) return fetch(url, init);
  const headers = new Headers(init.headers);
  headers.set(PAIRING_TOKEN_HEADER, pairingToken);
  return fetch(url, { ...init, headers });
}
