import { Button } from '@dendelion/paper-ui';

export interface LogOutputLinesProps {
  lines: string[] | null;
  failed: boolean;
  onRetry?: () => void;
  tail?: number;
}

export const LogOutputLinesView = ({ lines, failed, onRetry, tail }: LogOutputLinesProps) => {
  if (lines === null) return <p className="opacity-50 m-0">Loading…</p>;

  const retryButton = onRetry && (
    <Button variant="ghost" size="small" onClick={onRetry}>
      Retry
    </Button>
  );

  if (failed)
    return (
      <div className="flex items-center gap-2">
        <p className="opacity-50 m-0">Couldn't load this run's output.</p>
        {retryButton}
      </div>
    );
  if (lines.length === 0)
    return (
      <div className="flex items-center gap-2">
        <p className="opacity-50 m-0">No output recorded.</p>
        {retryButton}
      </div>
    );

  const shown = tail ? lines.slice(-tail) : lines;
  return (
    <pre className="font-mono text-xs m-0 max-h-[320px] overflow-y-auto whitespace-pre-wrap">
      {shown.join('\n')}
    </pre>
  );
};
