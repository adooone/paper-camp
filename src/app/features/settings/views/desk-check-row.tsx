import { CloseIcon, Divider, IconButton, Input } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import type { KeyedDeskCheck } from '../hooks/use-desk-section';

interface DeskCheckRowProps {
  check: KeyedDeskCheck;
  onSave: (check: KeyedDeskCheck) => void;
  onRemove: () => void;
  isLast: boolean;
}

export const DeskCheckRow = ({ check, onSave, onRemove, isLast }: DeskCheckRowProps) => {
  const [local, setLocal] = useState(check);

  useEffect(() => setLocal(check), [check]);

  const commit = () => {
    if (local.name === check.name && local.cmd === check.cmd) return;
    onSave(local);
  };

  return (
    <>
      <div className="flex items-end gap-3 pb-2 pt-2">
        <Input
          size="small"
          label="Name"
          value={local.name}
          onChange={(e) => setLocal({ ...local, name: e.target.value })}
          onBlur={commit}
        />
        <Input
          size="small"
          label="Command"
          value={local.cmd}
          onChange={(e) => setLocal({ ...local, cmd: e.target.value })}
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
      {!isLast && <Divider />}
    </>
  );
};
