import type { ToolbarHostState } from '@/types/index';
import { apiUrl } from '../api-base';

export const fetchToolbarHostState = async (): Promise<ToolbarHostState | null> => {
  try {
    const response = await fetch(apiUrl('/api/toolbar/host-app'));
    if (!response.ok) return null;
    return (await response.json()) as ToolbarHostState;
  } catch {
    return null;
  }
};
