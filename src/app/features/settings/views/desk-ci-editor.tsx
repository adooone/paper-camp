import type { DeskCi } from '@/types/index';
import { Input, SettingRow, Switch } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface DeskCiEditorProps {
  ci: DeskCi;
  onSave: (ci: DeskCi) => void;
}

export const DeskCiEditor = ({ ci, onSave }: DeskCiEditorProps) => {
  const [local, setLocal] = useState(ci);

  useEffect(() => setLocal(ci), [ci]);

  const commit = () => {
    if (local.repo === ci.repo && (local.branch ?? '') === (ci.branch ?? '')) return;
    onSave(local);
  };

  return (
    <>
      <SettingRow
        label="Repo"
        control={
          <Input
            size="small"
            value={local.repo}
            onChange={(e) => setLocal({ ...local, repo: e.target.value })}
            onBlur={commit}
          />
        }
      />
      <SettingRow
        label="Branch"
        control={
          <Input
            size="small"
            value={local.branch ?? ''}
            onChange={(e) => setLocal({ ...local, branch: e.target.value || undefined })}
            onBlur={commit}
          />
        }
      />
      <SettingRow
        label="Release Please"
        control={
          <Switch
            size="small"
            checked={local.releasePlease ?? false}
            onChange={(e) => {
              const next = { ...local, releasePlease: e.target.checked };
              setLocal(next);
              onSave(next);
            }}
          />
        }
      />
    </>
  );
};
