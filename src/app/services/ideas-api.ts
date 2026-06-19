export const fetchIdeas = async (): Promise<string> => {
  const response = await fetch('/api/ideas');
  const data = await response.json();
  return data.content ?? '';
};
