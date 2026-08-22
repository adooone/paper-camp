import { apiUrl } from '../api-base';

// Drops the npm scope and title-cases the rest, so `@dendelion/paper-camp` reads as
// the project's own name wherever it is shown.
export const projectDisplayName = (packageName: string): string =>
  packageName
    .replace(/^@[^/]+\//, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

// The registry holds runtimes this client is not currently pointed at, so the base
// URL is explicit rather than taken from `apiUrl`.
export const fetchPackageNameAt = async (baseUrl: string): Promise<string | null> => {
  try {
    const response = await fetch(`${baseUrl}/api/package-name`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};
export const fetchPackageName = async (): Promise<string | null> => {
  try {
    const response = await fetch(apiUrl('/api/package-name'));
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};
