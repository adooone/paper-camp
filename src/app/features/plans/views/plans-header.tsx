import { Button } from '@dendelion/paper-ui';
import { NewIdeaButton, WorklistActionsMenu } from '../actions';
import type { GroupMode } from '../helpers';

interface PlansHeaderProps {
  group?: GroupMode;
  canAddItem?: boolean;
  onAddItem?: () => void;
}

export const PlansHeader = ({
  group = 'subject',
  canAddItem = false,
  onAddItem,
}: PlansHeaderProps) => {
  return (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      <h1 className="text-4xl flex-1 font-display-luminari font-semibold text-ink-900 m-0 leading-[1.1]">
        Ideas
      </h1>

      {group === 'horizon' && (
        <Button
          type="button"
          variant="primary"
          size="small"
          onClick={onAddItem}
          disabled={!canAddItem}
        >
          + Add item
        </Button>
      )}
      <NewIdeaButton />
      <WorklistActionsMenu />
    </div>
  );
};
