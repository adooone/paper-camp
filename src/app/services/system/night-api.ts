import { apiUrl } from '../api-base';

export interface NightStatus {
  enabled: boolean;
  pausedUntil: number | null;
}

async function postJson<T>(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
    if (response.ok) return { ok: true, data: data ?? undefined };
    return { ok: false, error: data?.error };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export const fetchNightStatus = async (): Promise<NightStatus | null> => {
  try {
    const response = await fetch(apiUrl('/api/night/status'));
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

export const toggleNightShift = (enabled: boolean) =>
  postJson<{ ok: true }>('/api/night/toggle', { enabled });

export const pauseNightShift = (paused: boolean) =>
  postJson<{ ok: true; pausedUntil: number | null }>('/api/night/pause', { paused });

export const runNightPassNow = () =>
  postJson<{ ok: true; chunkPath: string }>('/api/night/run', {});
