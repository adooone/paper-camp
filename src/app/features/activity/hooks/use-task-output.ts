import { fetchTaskLogLines } from '@/app/services/content/docs-api';
import { useEffect, useRef, useState } from 'react';

const LIVE_POLL_MS = 1500;

export interface TaskOutput {
  lines: string[] | null;
  failed: boolean;
  retry: () => void;
}

interface Loaded {
  id: string;
  lines: string[];
  failed: boolean;
}

/** A run's output file. While `live`, it is re-read every 1.5s — the server appends each
 *  streamed line to it — and the lines already shown stay up between reads. */
export const useTaskOutput = (id: string, live = false): TaskOutput => {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const restartRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = (remaining: number) => {
      fetchTaskLogLines(id)
        .then((data) => {
          if (cancelled) return;
          setLoaded({ id, lines: data.lines ?? [], failed: false });
          if (live) timer = setTimeout(() => run(3), LIVE_POLL_MS);
        })
        .catch(() => {
          if (cancelled) return;
          if (remaining > 0) {
            timer = setTimeout(() => run(remaining - 1), 700);
            return;
          }
          setLoaded((current) => ({
            id,
            lines: current?.id === id ? current.lines : [],
            failed: true,
          }));
        });
    };

    restartRef.current = () => {
      if (timer) clearTimeout(timer);
      run(3);
    };
    run(3);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, live]);

  const current = loaded?.id === id ? loaded : null;
  return {
    lines: current ? current.lines : null,
    failed: current?.failed ?? false,
    retry: () => restartRef.current(),
  };
};
