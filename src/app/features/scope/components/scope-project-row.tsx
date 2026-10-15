import { CheckboxFilterRow } from '@/app/components';
import { Stamp } from '@dendelion/paper-ui';
import type { ScopeRow } from '../hooks/use-scope';

export interface ScopeProjectRowProps {
  row: ScopeRow;
  asleep: boolean;
  showCount: boolean;
  onToggle: (key: ScopeRow['key']) => void;
}

export const ScopeProjectRow = ({ row, asleep, showCount, onToggle }: ScopeProjectRowProps) => (
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
