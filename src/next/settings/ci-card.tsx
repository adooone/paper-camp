import { scoutSecretsValue } from '@/app/features/settings/views/desk-ci-editor';
import { TextFieldCell } from '@/app/features/settings/views/desk-table-cells';
import { useCiRelease } from '@/app/hooks/use-ci-release';
import type { DeskCi } from '@/types/index';
import { ListRow } from '../ui/list';
import { Switch } from '../ui/switch';
import styles from './settings.module.css';

interface CiCardProps {
  ci: DeskCi;
  onSave: (ci: DeskCi) => void;
}

const Field = ({ value, onCommit }: { value: string; onCommit: (value: string) => void }) => (
  <span className={styles.field}>
    <TextFieldCell value={value} onCommit={onCommit} />
  </span>
);

export const CiCard = ({ ci, onSave }: CiCardProps) => {
  const { ci: release } = useCiRelease();
  return (
    <>
      <ListRow
        title="Repo"
        trailing={<Field value={ci.repo} onCommit={(repo) => onSave({ ...ci, repo })} />}
      />
      <ListRow
        title="Branch"
        trailing={
          <Field
            value={ci.branch ?? ''}
            onCommit={(branch) => onSave({ ...ci, branch: branch || undefined })}
          />
        }
      />
      <ListRow
        title="Release Please"
        trailing={
          <Switch
            value={ci.releasePlease ?? false}
            label="Release Please"
            onChange={(releasePlease) => onSave({ ...ci, releasePlease })}
          />
        }
      />
      <ListRow
        title="Draft PR"
        trailing={
          <Switch
            value={ci.draftPr ?? false}
            label="Draft PR"
            onChange={(draftPr) => onSave({ ...ci, draftPr })}
          />
        }
      />
      {ci.draftPr ? (
        <ListRow title="Scout secrets" detail={scoutSecretsValue(release?.draftPr ?? null)} />
      ) : null}
    </>
  );
};
