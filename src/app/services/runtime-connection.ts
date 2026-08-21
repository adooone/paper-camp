const RUNTIME_URL_PARAM = 'runtime';
const PAIRING_TOKEN_PARAM = 'token';

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

export const runtimeConnection = readRuntimeConnection(
  typeof window === 'undefined' ? null : window.location,
);
