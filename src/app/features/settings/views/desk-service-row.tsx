import { CloseIcon, Divider, IconButton, Input } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import type { KeyedDeskService } from '../hooks/use-desk-section';

interface DeskServiceRowProps {
  service: KeyedDeskService;
  onSave: (service: KeyedDeskService) => void;
  onRemove: () => void;
  isLast: boolean;
}

export const DeskServiceRow = ({ service, onSave, onRemove, isLast }: DeskServiceRowProps) => {
  const [local, setLocal] = useState(service);

  useEffect(() => setLocal(service), [service]);

  const commit = () => onSave(local);

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
        <Input
          size="small"
          type="number"
          label="Port"
          className="w-[100px]"
          value={local.port ?? ''}
          onChange={(e) =>
            setLocal({ ...local, port: e.target.value ? Number(e.target.value) : undefined })
          }
          onBlur={commit}
        />
        <Input
          size="small"
          label="Healthcheck URL"
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
      {!isLast && <Divider />}
    </>
  );
};
