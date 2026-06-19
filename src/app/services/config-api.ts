import type { PaperCampConfig } from '@/types/index';

export const fetchConfig = async (): Promise<PaperCampConfig | null> => {
  try {
    const response = await fetch('/api/config');
    return response.json();
  } catch {
    return null;
  }
};
