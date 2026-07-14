export const fetchConfigs = async (): Promise<string[]> => {
  try {
    const response = await fetch('/api/configs');
    const data = (await response.json()) as { files: string[] };
    return data.files;
  } catch {
    return [];
  }
};

export const fetchConfigFile = async (name: string): Promise<string | null> => {
  try {
    const response = await fetch(`/api/configs?name=${encodeURIComponent(name)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { name: string; content: string };
    return data.content;
  } catch {
    return null;
  }
};
