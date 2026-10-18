import { useEffect, useRef, useState } from 'react';

const LIVE_POLL_MS = 1500;

export interface LiveLines {
  lines: string[] | null;
  failed: boolean;
  retry: () => void;
}

interface Loaded {
  key: () => Promise<string[]>;
  lines: string[];
  failed: boolean;
}

/** Lines from a polled fetcher. While `live`, it is re-read every 1.5s and the
 *  lines already shown stay up between reads. */
export const useLiveLines = (fetcher: () => Promise<string[]>, live = false): LiveLines => {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const restartRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = (remaining: number) => {
      fetcher()
        .then((lines) => {
          if (cancelled) return;
          setLoaded({ key: fetcher, lines, failed: false });
          if (live) timer = setTimeout(() => run(3), LIVE_POLL_MS);
        })
        .catch(() => {
          if (cancelled) return;
          if (remaining > 0) {
            timer = setTimeout(() => run(remaining - 1), 700);
            return;
          }
          setLoaded((current) => ({
            key: fetcher,
            lines: current?.key === fetcher ? current.lines : [],
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
  }, [fetcher, live]);

  const current = loaded?.key === fetcher ? loaded : null;
  return {
    lines: current ? current.lines : null,
    failed: current?.failed ?? false,
    retry: () => restartRef.current(),
  };
};
