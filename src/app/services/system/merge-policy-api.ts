import type { MergePolicy, MergePolicyResult } from '@/types/index';
import { apiUrl } from '../api-base';

export const fetchMergePolicy = async (): Promise<MergePolicyResult | null> => {
  try {
    const response = await fetch(apiUrl('/api/merge-policy'));
    if (!response.ok) return null;
    return (await response.json()) as MergePolicyResult;
  } catch {
    return null;
  }
};

export const applyMergePolicy = async (
  partial?: Partial<MergePolicy>,
): Promise<MergePolicyResult | null> => {
  try {
    const response = await fetch(apiUrl('/api/merge-policy/apply'), {
      method: 'POST',
      ...(partial && {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      }),
    });
    if (!response.ok) return null;
    return (await response.json()) as MergePolicyResult;
  } catch {
    return null;
  }
};
