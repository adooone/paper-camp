import { apiFetch, apiUrl } from './api-base';

export interface GithubDeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface GithubDeviceTokenResult {
  access_token?: string;
  error?: string;
  error_description?: string;
  interval?: number;
}

export async function startGithubDeviceFlow(): Promise<GithubDeviceCode> {
  const response = await apiFetch(apiUrl('/api/github/device-code'), { method: 'POST' });
  if (!response.ok) throw new Error('Could not reach GitHub.');
  return response.json();
}

export async function pollGithubDeviceToken(deviceCode: string): Promise<GithubDeviceTokenResult> {
  const response = await apiFetch(apiUrl('/api/github/device-token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_code: deviceCode }),
  });
  return response.json();
}
