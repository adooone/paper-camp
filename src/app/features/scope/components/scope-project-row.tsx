import type { ScopeColorToken } from '@/app/services/scope';
import { Button, Checkbox, Stamp } from '@dendelion/paper-ui';
import type { ScopeRow } from '../hooks/use-scope';

const DOT_CLASS: Record<ScopeColorToken, string> = {
  blue: 'bg-watercolor-blue',
  green: 'bg-watercolor-green',
  amber: 'bg-watercolor-amber',
  rose: 'bg-watercolor-rose',
  purple: 'bg-watercolor-purple',
  slate: 'bg-watercolor-slate',
};

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
}: ScopeProjectRowProps) => (
  <div
    className={`flex items-center gap-2 px-3 py-1 ${asleep ? 'cursor-not-allowed opacity-50' : ''}`}
  >
    {mode === 'list' && (
      <Checkbox
        checked={row.checked}
        disabled={row.isCurrent || asleep}
        onChange={() => onToggle(row.key)}
        aria-label={`Include ${row.name} in view`}
      />
    )}
    <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[row.color]}`} />
    <Button
      variant="link"
      size="small"
      disabled={asleep}
      onClick={() => onOpen(row)}
      className="min-w-0 flex-1 truncate text-left font-handwritten !text-sm"
    >
      {row.name}
    </Button>
    {asleep && (
      <Stamp size="small" variant="neutral">
        Asleep
      </Stamp>
    )}
    {!asleep && showCount && row.count !== null && (
      <span className="shrink-0 font-mono text-2xs opacity-60">{row.count}</span>
    )}
  </div>
);
