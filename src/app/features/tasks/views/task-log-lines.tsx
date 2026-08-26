import { fetchTaskLogLines } from '@/app/services/content/docs-api';
import { Button } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

export interface TaskLogLinesProps {
  id: string;
}

export const TaskLogLines = ({ id }: TaskLogLinesProps) => {
  const [lines, setLines] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is the retry trigger (re-runs the fetch), not a value read in the body.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLines(null);
    setFailed(false);
    // Auto-retry first (dev server briefly drops requests on hot reload); manual Retry only if it stays down.
    const load = (remaining: number) => {
      fetchTaskLogLines(id)
        .then((data) => {
          if (cancelled) return;
          setLines(data.lines ?? []);
        })
        .catch(() => {
          if (cancelled) return;
          if (remaining > 0) {
            timer = setTimeout(() => load(remaining - 1), 700);
            return;
          }
          // Empty result != failed request: conflating them mislabels a fetch error as "no output".
          setFailed(true);
          setLines([]);
        });
    };
    load(3);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, attempt]);

  const retry = (
    <Button variant="ghost" size="small" onClick={() => setAttempt((n) => n + 1)}>
      Retry
    </Button>
  );

  if (lines === null) return <p className="opacity-50 m-0">Loading…</p>;
  if (failed)
    return (
      <div className="flex items-center gap-2">
        <p className="opacity-50 m-0">Couldn't load this task's output.</p>
        {retry}
      </div>
    );
  if (lines.length === 0)
    return (
      <div className="flex items-center gap-2">
        <p className="opacity-50 m-0">No output recorded.</p>
        {retry}
      </div>
    );
  return (
    <pre className="font-mono text-xs m-0 max-h-[320px] overflow-y-auto whitespace-pre-wrap">
      {lines.join('\n')}
    </pre>
  );
};
