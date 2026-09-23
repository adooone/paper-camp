import type { LogRow } from '@/types/index';
import { Button, Row } from '@dendelion/paper-ui';
import { LOG_ROW_COLUMNS, LogRowView } from './run-row';

const headerLabelClassName = 'font-handwritten text-sm font-semibold whitespace-nowrap opacity-60';

export interface LogListProps {
  rows: LogRow[];
  hasMore: boolean;
  onLoadMore: () => void;
}

export const LogList = ({ rows, hasMore, onLoadMore }: LogListProps) => (
  <div className="flex flex-col gap-1">
    <Row
      surface="card"
      columns={LOG_ROW_COLUMNS}
      id={<span className={headerLabelClassName} />}
      title={<span className={headerLabelClassName}>Entry</span>}
      meta={<span className={headerLabelClassName}>Time · Type · Agent · Duration</span>}
      trailing={<span className={headerLabelClassName}>Outcome</span>}
    />
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
