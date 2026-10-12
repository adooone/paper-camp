import { CheckboxFilterRow } from '@/app/components';
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
  if (mode === 'list') {
    return (
      <CheckboxFilterRow
        label={row.name}
        checked={row.checked}
        disabled={asleep || row.isCurrent}
        count={!asleep && showCount && row.count !== null ? row.count : null}
        ariaLabel={`${row.checked ? 'Hide' : 'Show'} ${row.name}`}
        onChange={() => onToggle(row.key)}
        trailing={
          asleep ? (
            <Stamp size="small" variant="neutral">
              Asleep
            </Stamp>
          ) : undefined
        }
      />
    );
  }

  const onClick = asleep || row.isCurrent ? undefined : () => onOpen(row);

  return (
    <SidebarItem
      active={row.isCurrent}
      disabled={asleep}
      onClick={onClick}
      ariaLabel={`Open ${row.name}`}
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
