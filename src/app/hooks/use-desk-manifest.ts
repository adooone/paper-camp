import { fetchConfig } from '@/app/services/system';
import type { DeskConfig } from '@/types/index';
import { useEffect, useState } from 'react';

export interface DeskManifest {
  desk: DeskConfig | null;
  loading: boolean;
}

export const useDeskManifest = (): DeskManifest => {
  const [desk, setDesk] = useState<DeskConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchConfig().then((config) => {
      if (cancelled) return;
      setDesk(config?.desk ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { desk, loading };
};
