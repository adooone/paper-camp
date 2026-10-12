import { fetchTaskLogLines } from '@/app/services/content/docs-api';
import { useEffect, useRef, useState } from 'react';

const LIVE_POLL_MS = 1500;

export interface TaskOutput {
  lines: string[] | null;
  failed: boolean;
  retry: () => void;
}

/** A run's output file. While `live`, it is re-read every 1.5s — the server appends each
 *  streamed line to it — and the lines already shown stay up between reads. */
export const useTaskOutput = (id: string, live = false): TaskOutput => {
  const [lines, setLines] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const restartRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = (remaining: number) => {
      fetchTaskLogLines(id)
        .then((data) => {
          if (cancelled) return;
          setFailed(false);
          setLines(data.lines ?? []);
          if (live) timer = setTimeout(() => run(3), LIVE_POLL_MS);
        })
        .catch(() => {
          if (cancelled) return;
          if (remaining > 0) {
            timer = setTimeout(() => run(remaining - 1), 700);
            return;
          }
          setFailed(true);
          setLines((current) => current ?? []);
        });
    };

    restartRef.current = () => {
      if (timer) clearTimeout(timer);
      setFailed(false);
      run(3);
    };
    run(3);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, live]);

  useEffect(() => {
    setLines(null);
    setFailed(false);
  }, [id]);

  return { lines, failed, retry: () => restartRef.current() };
};
