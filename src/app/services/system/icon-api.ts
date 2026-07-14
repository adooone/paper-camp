export const fetchIconDataUri = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/icon');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const uploadIcon = async (dataUri: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/icon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUri }),
    });
    return response.ok;
  } catch {
    return false;
  }
};
