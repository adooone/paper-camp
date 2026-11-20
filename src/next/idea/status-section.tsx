import type { PlanStatus } from '@/types/index';
import { ALLOWED_TRANSITIONS } from '../shell/idea-model';
import { STATUS_LABEL } from '../shell/ideas-model';
import { Button } from '../ui/button';
import { Hand } from '../ui/hand';
import { ListLabel } from '../ui/list';
import styles from './idea.module.css';

interface StatusSectionProps {
  status: PlanStatus;
  busy: PlanStatus | null;
  disabled: boolean;
  onSelect: (status: PlanStatus) => void;
}

export function StatusSection({ status, busy, disabled, onSelect }: StatusSectionProps) {
  const transitions = ALLOWED_TRANSITIONS[status];
  return (
    <div className={styles.section}>
      <ListLabel>Status</ListLabel>
      {transitions.length === 0 ? (
        <Hand size="sm" color="inkSoft">
          {`Nothing to transition to from ${STATUS_LABEL[status]}.`}
        </Hand>
      ) : (
        <div className={styles.buttons}>
          {transitions.map((target) => (
            <Button
              key={target}
              label={busy === target ? 'Working…' : `→ ${STATUS_LABEL[target]}`}
              variant="secondary"
              size="sm"
              onPress={() => onSelect(target)}
              disabled={disabled || busy !== null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
