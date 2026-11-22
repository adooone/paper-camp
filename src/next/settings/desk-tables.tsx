import { Table } from '@dendelion/folk-ui';
import type {
  KeyedDeskCheck,
  KeyedDeskService,
} from '@/app/features/settings/hooks/use-desk-section';
import { TextFieldCell } from '@/app/features/settings/views/desk-table-cells';
import type { DeskCheck, DeskService } from '@/types/index';
import { Button } from '../ui/button';
import styles from './settings.module.css';

interface RowTableProps<Keyed, Row> {
  rows: Keyed[];
  onSave: (id: string, row: Row) => void;
  onRemove: (id: string) => void;
}

const RemoveButton = ({ name, onPress }: { name: string; onPress: () => void }) => (
  <Button
    label="Remove"
    variant="ghost"
    size="xs"
    accessibilityLabel={`Remove ${name}`}
    onPress={onPress}
  />
);

export const ServiceTable = ({
  rows,
  onSave,
  onRemove,
}: RowTableProps<KeyedDeskService, DeskService>) => (
  <div className={styles.tableWrap}>
    <Table
      data={rows}
      rowKey={(row) => row.id}
      density="compact"
      phoneLayout="stacked"
      columns={[
        {
          key: 'name',
          width: 3,
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
          width: 2,
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
          width: 1,
          header: '',
          align: 'end',
          cell: (row) => (
            <RemoveButton name={row.name || 'service'} onPress={() => onRemove(row.id)} />
          ),
        },
      ]}
    />
  </div>
);

export const CheckTable = ({
  rows,
  onSave,
  onRemove,
}: RowTableProps<KeyedDeskCheck, DeskCheck>) => (
  <div className={styles.tableWrap}>
    <Table
      data={rows}
      rowKey={(row) => row.id}
      density="compact"
      phoneLayout="stacked"
      columns={[
        {
          key: 'name',
          width: 3,
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
          width: 1,
          header: '',
          align: 'end',
          cell: (row) => (
            <RemoveButton name={row.name || 'check'} onPress={() => onRemove(row.id)} />
          ),
        },
      ]}
    />
  </div>
);
