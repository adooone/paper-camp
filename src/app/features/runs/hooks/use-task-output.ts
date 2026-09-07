import { fetchTaskLogLines } from '@/app/services/content/docs-api';
import { useEffect, useRef, useState } from 'react';

export interface TaskOutput {
  lines: string[] | null;
  failed: boolean;
  retry: () => void;
}

export const useTaskOutput = (id: string): TaskOutput => {
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
          setLines(data.lines ?? []);
        })
        .catch(() => {
          if (cancelled) return;
          if (remaining > 0) {
            timer = setTimeout(() => run(remaining - 1), 700);
            return;
          }
          setFailed(true);
          setLines([]);
        });
    };

    const start = () => {
      setLines(null);
      setFailed(false);
      run(3);
    };
    restartRef.current = start;
    start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  return { lines, failed, retry: () => restartRef.current() };
};
