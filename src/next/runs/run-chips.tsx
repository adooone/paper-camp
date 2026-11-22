import type { LogRowOutcome, LogRowType } from '@/types/index';
import { type LogFilterState, OUTCOME_CHIPS, TYPE_CHIPS } from '../shell/run-model';
import { Hand } from '../ui/hand';
import type { StampMeaning } from '../ui/stamp';
import styles from './runs.module.css';

interface ChipProps {
  label: string;
  active: boolean;
  tone: StampMeaning;
  onPress: () => void;
}

function Chip({ label, active, tone, onPress }: ChipProps) {
  const classes = [styles.chip, active && styles.chipActive, styles[tone]];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPress}
      className={classes.filter(Boolean).join(' ')}
    >
      <Hand size="sm" bold>
        {label}
      </Hand>
    </button>
  );
}

interface LogChipsProps {
  filters: LogFilterState;
  onToggleOutcome: (id: LogRowOutcome) => void;
  onToggleType: (id: LogRowType) => void;
}

export function LogChips({ filters, onToggleOutcome, onToggleType }: LogChipsProps) {
  return (
    <div className={styles.chips}>
      {OUTCOME_CHIPS.map((chip) => (
        <Chip
          key={`outcome:${chip.id}`}
          label={chip.label}
          tone={chip.meaning}
          active={filters.outcomes.includes(chip.id)}
          onPress={() => onToggleOutcome(chip.id)}
        />
      ))}
      {TYPE_CHIPS.map((chip) => (
        <Chip
          key={`type:${chip.id}`}
          label={chip.label}
          tone="idle"
          active={filters.types.includes(chip.id)}
          onPress={() => onToggleType(chip.id)}
        />
      ))}
    </div>
  );
}
