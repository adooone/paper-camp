import type { ParkedQuestion } from '@/types/index';

export const fetchParkedQuestions = async () => {
  const res = await fetch('/api/parked-questions');
  if (!res.ok) throw new Error(`Failed to fetch parked questions: ${res.status}`);
  return res.json() as Promise<ParkedQuestion[]>;
};
