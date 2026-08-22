const RUNTIME_URL_PARAM = 'runtime';
const PAIRING_TOKEN_PARAM = 'token';
const RUNTIME_URL_KEY = 'paper-camp.runtimeUrl';
const PAIRING_TOKEN_KEY = 'paper-camp.pairingToken';

export interface RuntimeConnection {
  runtimeUrl: string;
  pairingToken: string | null;
}

// Absent when `paper-camp dev` serves this same bundle locally — a bare page
// load carries neither param, so apiUrl stays relative and no pairing is needed.
export function readRuntimeConnection(location: { search: string } | null): RuntimeConnection {
  const params = new URLSearchParams(location?.search ?? '');
  return {
    runtimeUrl: params.get(RUNTIME_URL_PARAM) ?? '',
    pairingToken: params.get(PAIRING_TOKEN_PARAM),
  };
}

// A pasted `?runtime=&token=` link only carries the connection on the visit
// that used it; storing it is what makes a later reload with no query string
// still dial the same runtime.
export function loadRuntimeConnection(
  location: { search: string } | null,
  storage: Storage | null,
): RuntimeConnection {
  const fromQuery = readRuntimeConnection(location);
  if (fromQuery.runtimeUrl) {
    storage?.setItem(RUNTIME_URL_KEY, fromQuery.runtimeUrl);
    if (fromQuery.pairingToken) storage?.setItem(PAIRING_TOKEN_KEY, fromQuery.pairingToken);
    else storage?.removeItem(PAIRING_TOKEN_KEY);
    return fromQuery;
  }
  return {
    runtimeUrl: storage?.getItem(RUNTIME_URL_KEY) ?? '',
    pairingToken: storage?.getItem(PAIRING_TOKEN_KEY) ?? null,
  };
}

export const runtimeConnection = loadRuntimeConnection(
  typeof window === 'undefined' ? null : window.location,
  typeof window === 'undefined' ? null : window.localStorage,
);
