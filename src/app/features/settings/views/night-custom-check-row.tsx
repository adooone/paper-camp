import { CloseIcon, Divider, IconButton, Input, Textarea } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import type { KeyedNightCustomCheck } from '../hooks/use-night-section';

interface NightCustomCheckRowProps {
  check: KeyedNightCustomCheck;
  onSave: (check: KeyedNightCustomCheck) => void;
  onRemove: () => void;
  isLast: boolean;
}

export const NightCustomCheckRow = ({
  check,
  onSave,
  onRemove,
  isLast,
}: NightCustomCheckRowProps) => {
  const [local, setLocal] = useState(check);

  useEffect(() => setLocal(check), [check]);

  const commit = () => {
    if (local.name === check.name && local.prompt === check.prompt) return;
    onSave(local);
  };

  return (
    <>
      <div className="flex flex-col gap-2 pb-3 pt-3">
        <div className="flex items-end gap-3">
          <Input
            size="small"
            label="Name"
            value={local.name}
            onChange={(e) => setLocal({ ...local, name: e.target.value })}
            onBlur={commit}
          />
          <IconButton
            icon={<CloseIcon size={16} />}
            variant="danger"
            size="small"
            onClick={onRemove}
            label={`Remove ${check.name || 'check'}`}
          />
        </div>
        <Textarea
          size="small"
          label="Prompt"
          value={local.prompt}
          onChange={(e) => setLocal({ ...local, prompt: e.target.value })}
          onBlur={commit}
        />
      </div>
      {!isLast && <Divider />}
    </>
  );
};
