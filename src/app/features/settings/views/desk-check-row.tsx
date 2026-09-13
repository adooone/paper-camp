import { Card, CloseIcon, IconButton, Input } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import type { KeyedDeskCheck } from '../hooks/use-desk-section';
import { DESK_CHECK_GRID_CLASS } from './desk-check-row-header';

interface DeskCheckRowProps {
  check: KeyedDeskCheck;
  onSave: (check: KeyedDeskCheck) => void;
  onRemove: () => void;
}

export const DeskCheckRow = ({ check, onSave, onRemove }: DeskCheckRowProps) => {
  const [local, setLocal] = useState(check);

  useEffect(() => setLocal(check), [check]);

  const commit = () => {
    if (
      local.name === check.name &&
      local.cmd === check.cmd &&
      (local.fixCmd ?? undefined) === (check.fixCmd ?? undefined)
    ) {
      return;
    }
    onSave(local);
  };

  return (
    <Card size="small" texture="kraft" className="plan-row-card">
      <div className="overflow-x-auto">
        <div className={DESK_CHECK_GRID_CLASS}>
          <Input
            size="small"
            value={local.name}
            onChange={(e) => setLocal({ ...local, name: e.target.value })}
            onBlur={commit}
          />
          <Input
            size="small"
            value={local.cmd}
            onChange={(e) => setLocal({ ...local, cmd: e.target.value })}
            onBlur={commit}
          />
          <Input
            size="small"
            value={local.fixCmd ?? ''}
            onChange={(e) => setLocal({ ...local, fixCmd: e.target.value || undefined })}
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
      </div>
    </Card>
  );
};
