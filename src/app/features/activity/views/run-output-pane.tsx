import { Button, Skeleton } from '@dendelion/paper-ui';
import { useEffect, useRef } from 'react';

export interface LogOutputPaneProps {
  lines: string[] | null;
  failed: boolean;
  onRetry?: () => void;
  /** The run is still going: the pane says so and keeps its newest line in view. */
  live?: boolean;
}

const paneClass =
  'flex flex-col overflow-hidden rounded-[10px] border border-paper-950/[12%] text-desk-text bg-desk-bg bg-chalkboard [background-repeat:repeat,no-repeat] [background-size:200px_200px,auto]';

const headerClass =
  'flex shrink-0 items-center justify-between border-b border-desk-border px-4 py-2 font-handwritten text-xs text-desk-text-muted';

// Within this many px of the bottom counts as "following" — a reader who scrolled
// up to look at something keeps their place while new lines arrive.
const FOLLOW_SLACK_PX = 48;

export const LogOutputPane = ({ lines, failed, onRetry, live = false }: LogOutputPaneProps) => {
  const scrollRef = useRef<HTMLPreElement>(null);
  const followingRef = useRef(true);
  const lineCount = lines?.length ?? 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (live && el && followingRef.current && lineCount > 0) el.scrollTop = el.scrollHeight;
  }, [live, lineCount]);

  const retryButton = onRetry && !live && (
    <Button variant="ghost" size="small" surface="chalkboard" onClick={onRetry}>
      Retry
    </Button>
  );

  return (
    <section className={paneClass} aria-label="Run output">
      <div className={headerClass}>
        <span className="flex items-center gap-2">
          Output
          {live && (
            <span className="flex items-center gap-1 text-desk-chalk">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-desk-chalk motion-reduce:animate-none" />
              Live
            </span>
          )}
        </span>
        <span>{lines ? `${lineCount} ${lineCount === 1 ? 'line' : 'lines'}` : ''}</span>
      </div>
      {lines === null ? (
        <div className="flex flex-col gap-2 p-4" aria-hidden="true">
          <Skeleton variant="text" width="48%" />
          <Skeleton variant="text" width="64%" />
          <Skeleton variant="text" width="36%" />
        </div>
      ) : failed && lineCount === 0 ? (
        <div className="flex items-center gap-2 p-4 font-handwritten text-sm text-desk-text-muted">
          <span>Couldn't load this run's output.</span>
          {retryButton}
        </div>
      ) : lineCount === 0 ? (
        <div className="flex items-center gap-2 p-4 font-handwritten text-sm text-desk-text-muted">
          <span>{live ? "Waiting for the agent's first output…" : 'No output recorded.'}</span>
          {retryButton}
        </div>
      ) : (
        <pre
          ref={scrollRef}
          onScroll={(event) => {
            const el = event.currentTarget;
            followingRef.current =
              el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_SLACK_PX;
          }}
          aria-live={live ? 'polite' : undefined}
          className="m-0 max-h-[70vh] overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-relaxed text-desk-chalk"
        >
          {lines.join('\n')}
        </pre>
      )}
    </section>
  );
};
