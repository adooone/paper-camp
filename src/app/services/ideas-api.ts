export const fetchIdeas = async (): Promise<string> => {
  const response = await fetch('/api/ideas');
  const data = await response.json();
  return data.content ?? '';
};

export const createIdea = async (idea: { title: string; content?: string }): Promise<string> => {
  const response = await fetch('/api/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(idea),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Failed to create idea');
  return data.id as string;
};
