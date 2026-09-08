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
