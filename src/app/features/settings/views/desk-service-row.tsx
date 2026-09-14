import { CloseIcon, IconButton, Input } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import type { KeyedDeskService } from '../hooks/use-desk-section';
import { DESK_SERVICE_GRID_CLASS } from './desk-service-row-header';

interface DeskServiceRowProps {
  service: KeyedDeskService;
  onSave: (service: KeyedDeskService) => void;
  onRemove: () => void;
}

export const DeskServiceRow = ({ service, onSave, onRemove }: DeskServiceRowProps) => {
  const [local, setLocal] = useState(service);

  useEffect(() => setLocal(service), [service]);

  const commit = () => {
    if (
      local.name === service.name &&
      local.cmd === service.cmd &&
      (local.port ?? undefined) === (service.port ?? undefined) &&
      (local.healthcheck ?? undefined) === (service.healthcheck ?? undefined)
    ) {
      return;
    }
    onSave(local);
  };

  return (
    <div className="pc-setting-row">
      <div className="overflow-x-auto">
        <div className={DESK_SERVICE_GRID_CLASS}>
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
            type="number"
            value={local.port ?? ''}
            onChange={(e) =>
              setLocal({ ...local, port: e.target.value ? Number(e.target.value) : undefined })
            }
            onBlur={commit}
          />
          <Input
            size="small"
            value={local.healthcheck ?? ''}
            onChange={(e) => setLocal({ ...local, healthcheck: e.target.value || undefined })}
            onBlur={commit}
          />
          <IconButton
            icon={<CloseIcon size={16} />}
            variant="danger"
            size="small"
            onClick={onRemove}
            label={`Remove ${service.name || 'service'}`}
          />
        </div>
      </div>
    </div>
  );
};
