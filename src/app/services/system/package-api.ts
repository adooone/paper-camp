export const fetchPackageName = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/package-name');
    return response.json();
  } catch {
    return null;
  }
};
