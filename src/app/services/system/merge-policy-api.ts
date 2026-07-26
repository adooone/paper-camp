import type { MergePolicyResult } from '@/types/index';

export const fetchMergePolicy = async (): Promise<MergePolicyResult | null> => {
  const response = await fetch('/api/merge-policy');
  if (!response.ok) return null;
  return (await response.json()) as MergePolicyResult;
};

export const applyMergePolicy = async (): Promise<MergePolicyResult | null> => {
  const response = await fetch('/api/merge-policy/apply', { method: 'POST' });
  if (!response.ok) return null;
  return (await response.json()) as MergePolicyResult;
};
