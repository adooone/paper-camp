import { markRead } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';

export const stopTask = (taskId: string): Promise<void> => useAppStore.getState().stopAgent(taskId);

export const stopQueue = (): Promise<void> => useAppStore.getState().controlBatch('stop');

export const dismissQueueSummary = (): void => useAppStore.getState().dismissBatchSummary();

export const dismissOwnNotice = (entryId: string): Promise<void> => markRead(entryId);
