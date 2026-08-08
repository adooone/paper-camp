import type { ParkedQuestion } from '@/types/index';
import { apiUrl } from '../api-base';

export const fetchParkedQuestions = async () => {
  const res = await fetch(apiUrl('/api/parked-questions'));
  if (!res.ok) throw new Error(`Failed to fetch parked questions: ${res.status}`);
  return res.json() as Promise<ParkedQuestion[]>;
};
