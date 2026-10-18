import { fetchTaskLogLines } from '@/app/services/content/docs-api';
import { useCallback } from 'react';
import { type LiveLines, useLiveLines } from './use-live-lines';

export type TaskOutput = LiveLines;

/** A run's output file. While `live`, it is re-read every 1.5s — the server appends each
 *  streamed line to it — and the lines already shown stay up between reads. */
export const useTaskOutput = (id: string, live = false): TaskOutput => {
  const fetcher = useCallback(() => fetchTaskLogLines(id).then((data) => data.lines ?? []), [id]);
  return useLiveLines(fetcher, live);
};
