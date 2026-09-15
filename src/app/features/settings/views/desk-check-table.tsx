import type { DeskCheck } from '@/types/index';
import { Button, CloseIcon, IconButton, PlusIcon, Table } from '@dendelion/paper-ui';
import type { KeyedDeskCheck } from '../hooks/use-desk-section';
import { TextFieldCell } from './desk-table-cells';

interface DeskCheckTableProps {
  checks: KeyedDeskCheck[];
  onAdd: () => void;
  onSave: (id: string, check: DeskCheck) => void;
  onRemove: (id: string) => void;
}

export const DeskCheckTable = ({ checks, onAdd, onSave, onRemove }: DeskCheckTableProps) => (
  <Table
    data={checks}
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
        key: 'fixCmd',
        header: 'Fix command',
        cell: (row) => (
          <TextFieldCell
            value={row.fixCmd ?? ''}
            onCommit={(v) => onSave(row.id, { ...row, fixCmd: v || undefined })}
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
            label={`Remove ${row.name || 'check'}`}
          />
        ),
      },
    ]}
  />
);
