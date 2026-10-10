import { SidebarItem, Stamp } from '@dendelion/paper-ui';
import type { ScopeRow } from '../hooks/use-scope';

export interface ScopeProjectRowProps {
  row: ScopeRow;
  mode: 'list' | 'switcher';
  asleep: boolean;
  showCount: boolean;
  onToggle: (key: ScopeRow['key']) => void;
  onOpen: (row: ScopeRow) => void;
}

export const ScopeProjectRow = ({
  row,
  mode,
  asleep,
  showCount,
  onToggle,
  onOpen,
}: ScopeProjectRowProps) => {
  const isList = mode === 'list';
  const onClick = asleep
    ? undefined
    : isList
      ? row.isCurrent
        ? undefined
        : () => onToggle(row.key)
      : row.isCurrent
        ? undefined
        : () => onOpen(row);

  return (
    <SidebarItem
      active={isList ? row.checked : row.isCurrent}
      disabled={asleep}
      onClick={onClick}
      ariaLabel={isList ? `${row.checked ? 'Hide' : 'Show'} ${row.name}` : `Open ${row.name}`}
      count={!asleep && showCount && row.count !== null ? row.count : undefined}
      action={
        asleep ? (
          <Stamp size="small" variant="neutral">
            Asleep
          </Stamp>
        ) : undefined
      }
    >
      {row.name}
    </SidebarItem>
  );
};
