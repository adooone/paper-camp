import type { LogRow } from '@/types/index';
import { Button, Card } from '@dendelion/paper-ui';
import { LOG_ROW_GRID_CLASS, LogRowView } from './run-row';

const headerLabelClassName = 'font-handwritten text-sm font-semibold whitespace-nowrap opacity-60';

export interface LogListProps {
  rows: LogRow[];
  hasMore: boolean;
  onLoadMore: () => void;
}

export const LogList = ({ rows, hasMore, onLoadMore }: LogListProps) => (
  <div className="flex flex-col gap-1">
    <Card size="small" texture="kraft" className="plan-row-card">
      <div className={LOG_ROW_GRID_CLASS}>
        <span className={headerLabelClassName}>Time</span>
        <span className={headerLabelClassName}>Type</span>
        <span className={headerLabelClassName}>Entry</span>
        <span className={headerLabelClassName}>Outcome</span>
      </div>
    </Card>
    {rows.map((row) => (
      <LogRowView key={row.id} row={row} />
    ))}
    {hasMore && (
      <div className="flex justify-center pt-2">
        <Button variant="ghost" size="small" onClick={onLoadMore}>
          Load more
        </Button>
      </div>
    )}
  </div>
);
