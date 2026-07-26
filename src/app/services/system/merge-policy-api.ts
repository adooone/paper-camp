import type { MergePolicyResult } from '@/types/index';

export const fetchMergePolicy = async (): Promise<MergePolicyResult | null> => {
  try {
    const response = await fetch('/api/merge-policy');
    if (!response.ok) return null;
    return (await response.json()) as MergePolicyResult;
  } catch {
    return null;
  }
};

export const applyMergePolicy = async (): Promise<MergePolicyResult | null> => {
  try {
    const response = await fetch('/api/merge-policy/apply', { method: 'POST' });
    if (!response.ok) return null;
    return (await response.json()) as MergePolicyResult;
  } catch {
    return null;
  }
};
