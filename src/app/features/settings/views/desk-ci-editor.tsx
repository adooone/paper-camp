import type { DeskCi } from '@/types/index';
import { Divider, Input, Switch } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface DeskCiEditorProps {
  ci: DeskCi;
  onSave: (ci: DeskCi) => void;
}

export const DeskCiEditor = ({ ci, onSave }: DeskCiEditorProps) => {
  const [local, setLocal] = useState(ci);

  useEffect(() => setLocal(ci), [ci]);

  const commit = () => {
    if (
      local.repo === ci.repo &&
      (local.branch ?? '') === (ci.branch ?? '') &&
      (local.releasePlease ?? false) === (ci.releasePlease ?? false)
    ) {
      return;
    }
    onSave(local);
  };

  return (
    <>
      <div className="flex items-end gap-3 pb-3">
        <Input
          size="small"
          label="Repo (owner/name)"
          value={local.repo}
          onChange={(e) => setLocal({ ...local, repo: e.target.value })}
          onBlur={commit}
        />
        <Input
          size="small"
          label="Branch"
          value={local.branch ?? ''}
          onChange={(e) => setLocal({ ...local, branch: e.target.value || undefined })}
          onBlur={commit}
        />
      </div>
      <Divider />
      <div className="flex items-center justify-between pt-3">
        <span>Release Please</span>
        <Switch
          checked={local.releasePlease ?? false}
          onChange={(e) => {
            const next = { ...local, releasePlease: e.target.checked };
            setLocal(next);
            onSave(next);
          }}
        />
      </div>
    </>
  );
};
