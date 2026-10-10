import { Button, Skeleton } from '@dendelion/paper-ui';

export interface LogOutputPaneProps {
  lines: string[] | null;
  failed: boolean;
  onRetry?: () => void;
}

const paneClass =
  'flex flex-col overflow-hidden rounded-[10px] border border-paper-950/[12%] text-desk-text bg-desk-bg bg-chalkboard [background-repeat:repeat,no-repeat] [background-size:200px_200px,auto]';

const headerClass =
  'flex shrink-0 items-center justify-between border-b border-desk-border px-4 py-2 font-handwritten text-xs text-desk-text-muted';

export const LogOutputPane = ({ lines, failed, onRetry }: LogOutputPaneProps) => {
  const retryButton = onRetry && (
    <Button variant="ghost" size="small" surface="chalkboard" onClick={onRetry}>
      Retry
    </Button>
  );

  return (
    <section className={paneClass} aria-label="Run output">
      <div className={headerClass}>
        <span>Output</span>
        <span>{lines ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}` : ''}</span>
      </div>
      {lines === null ? (
        <div className="flex flex-col gap-2 p-4" aria-hidden="true">
          <Skeleton variant="text" width="48%" />
          <Skeleton variant="text" width="64%" />
          <Skeleton variant="text" width="36%" />
        </div>
      ) : failed ? (
        <div className="flex items-center gap-2 p-4 font-handwritten text-sm text-desk-text-muted">
          <span>Couldn't load this run's output.</span>
          {retryButton}
        </div>
      ) : lines.length === 0 ? (
        <div className="flex items-center gap-2 p-4 font-handwritten text-sm text-desk-text-muted">
          <span>No output recorded.</span>
          {retryButton}
        </div>
      ) : (
        <pre className="m-0 overflow-x-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-relaxed text-desk-chalk">
          {lines.join('\n')}
        </pre>
      )}
    </section>
  );
};
