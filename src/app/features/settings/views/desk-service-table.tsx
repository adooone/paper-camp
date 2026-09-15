import type { DeskService } from '@/types/index';
import { Button, CloseIcon, IconButton, PlusIcon, Table } from '@dendelion/paper-ui';
import type { KeyedDeskService } from '../hooks/use-desk-section';
import { TextFieldCell } from './desk-table-cells';

interface DeskServiceTableProps {
  services: KeyedDeskService[];
  onAdd: () => void;
  onSave: (id: string, service: DeskService) => void;
  onRemove: (id: string) => void;
}

export const DeskServiceTable = ({ services, onAdd, onSave, onRemove }: DeskServiceTableProps) => (
  <Table
    data={services}
    rowKey={(row) => row.id}
    density="compact"
    toolbar={{
      actions: (
        <Button size="small" icon={<PlusIcon size={16} />} onClick={onAdd}>
          Add
        </Button>
      ),
    }}
    columns={[
      {
        key: 'name',
        header: 'Name',
        cell: (row) => (
          <TextFieldCell value={row.name} onCommit={(v) => onSave(row.id, { ...row, name: v })} />
        ),
      },
      {
        key: 'cmd',
        header: 'Command',
        cell: (row) => (
          <TextFieldCell value={row.cmd} onCommit={(v) => onSave(row.id, { ...row, cmd: v })} />
        ),
      },
      {
        key: 'port',
        header: 'Port',
        cell: (row) => (
          <TextFieldCell
            type="number"
            value={row.port !== undefined ? String(row.port) : ''}
            onCommit={(v) => onSave(row.id, { ...row, port: v ? Number(v) : undefined })}
          />
        ),
      },
      {
        key: 'healthcheck',
        header: 'Healthcheck',
        cell: (row) => (
          <TextFieldCell
            value={row.healthcheck ?? ''}
            onCommit={(v) => onSave(row.id, { ...row, healthcheck: v || undefined })}
          />
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'end',
        cell: (row) => (
          <IconButton
            icon={<CloseIcon size={16} />}
            variant="danger"
            size="small"
            onClick={() => onRemove(row.id)}
            label={`Remove ${row.name || 'service'}`}
          />
        ),
      },
    ]}
  />
);
