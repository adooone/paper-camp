import { Button } from '@dendelion/paper-ui';
import type { GroupMode } from '../helpers';

const GROUP_LABEL: Record<GroupMode, string> = {
  plain: 'Plain',
  subject: 'Subject',
  horizon: 'Horizon',
};

const GROUP_ORDER: GroupMode[] = ['plain', 'subject', 'horizon'];

interface GroupByControlProps {
  group: GroupMode;
  onChange: (group: GroupMode) => void;
}

export const GroupByControl = ({ group, onChange }: GroupByControlProps) => (
  <div className="flex items-center gap-1">
    <span className="font-handwritten text-xs font-semibold opacity-55 leading-none mr-1">
      Group by
    </span>
    {GROUP_ORDER.map((mode) => (
      <Button
        key={mode}
        type="button"
        variant="ghost"
        size="small"
        isActive={group === mode}
        aria-pressed={group === mode}
        onClick={() => onChange(mode)}
      >
        {GROUP_LABEL[mode]}
      </Button>
    ))}
  </div>
);
