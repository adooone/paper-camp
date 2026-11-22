import type { LogRow } from '@/types/index';
import { useNow } from '../hooks/use-now';
import { formatElapsed } from '../shell/projects-copy';
import { earnsStamp, formatTime, outcomeLabel, outcomeMeaning, rowTitle } from '../shell/run-model';
import { Hand } from '../ui/hand';
import { ListRow } from '../ui/list';
import { Stamp } from '../ui/stamp';

function RunningTicker({ startedAt }: { startedAt: string }) {
  const now = useNow(1000);
  return (
    <Hand size="sm" color="inkSoft">
      {formatElapsed(startedAt, now)}
    </Hand>
  );
}

interface LogListRowProps {
  row: LogRow;
  selected: boolean;
  onPress: () => void;
}

export function LogListRow({ row, selected, onPress }: LogListRowProps) {
  const meaning = outcomeMeaning[row.outcome];
  return (
    <ListRow
      eyebrow={formatTime(row.timestamp)}
      title={rowTitle(row)}
      muted={!row.unread}
      selected={selected}
      accessibilityLabel={`Open ${rowTitle(row)}`}
      onPress={onPress}
      trailing={
        <>
          {row.source.kind === 'running' ? (
            <RunningTicker startedAt={row.source.task.startedAt} />
          ) : null}
          {earnsStamp(meaning) ? (
            <Stamp meaning={meaning}>{outcomeLabel[row.outcome]}</Stamp>
          ) : null}
        </>
      }
    />
  );
}
