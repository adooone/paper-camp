import { apiUrl } from '../api-base';
export const fetchPackageName = async (): Promise<string | null> => {
  try {
    const response = await fetch(apiUrl('/api/package-name'));
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};
