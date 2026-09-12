import { apiUrl } from '../api-base';

export interface PushDeviceSummary {
  transport: 'webpush' | 'expo';
  name: string;
  lastDeliveryAt?: string;
  key: string;
}

export const fetchPushPublicKey = async (): Promise<string | null> => {
  try {
    const response = await fetch(apiUrl('/api/push/public-key'));
    if (!response.ok) return null;
    const data = (await response.json()) as { publicKey: string };
    return data.publicKey;
  } catch {
    return null;
  }
};

export const fetchPushDevices = async (): Promise<PushDeviceSummary[] | null> => {
  try {
    const response = await fetch(apiUrl('/api/push/subscriptions'));
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

export interface PushActionResult {
  ok: boolean;
  error?: string;
}

export const subscribeWebPush = async (
  name: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<PushActionResult> => {
  try {
    const response = await fetch(apiUrl('/api/push/subscribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transport: 'webpush', name, subscription }),
    });
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: body?.error };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
};

export const unsubscribePush = async (
  transport: 'webpush' | 'expo',
  key: string,
): Promise<PushActionResult> => {
  try {
    const response = await fetch(apiUrl('/api/push/subscribe'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        transport === 'webpush' ? { transport, endpoint: key } : { transport, token: key },
      ),
    });
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: body?.error };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
};
