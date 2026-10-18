import { useCiRelease } from '@/app/hooks/use-ci-release';
import type { DeskCi, DraftPrReadiness } from '@/types/index';
import { Input, SettingRow, Switch } from '@dendelion/folk-ui';
import { useEffect, useState } from 'react';

interface DeskCiEditorProps {
  ci: DeskCi;
  onSave: (ci: DeskCi) => void;
}

export const scoutSecretsValue = (draftPr: DraftPrReadiness | null): string => {
  if (!draftPr || !draftPr.secretsChecked) return "couldn't check — needs admin on the repo";
  const missing = [
    !draftPr.scoutAppId && 'SCOUT_APP_ID',
    !draftPr.scoutPrivateKey && 'SCOUT_PRIVATE_KEY',
  ].filter((name): name is string => Boolean(name));
  return missing.length > 0
    ? `missing: ${missing.join(', ')}`
    : 'SCOUT_APP_ID and SCOUT_PRIVATE_KEY present';
};

const ScoutSecretsRow = () => {
  const { ci } = useCiRelease();
  const draftPr = ci?.draftPr ?? null;
  return (
    <SettingRow
      label="Scout secrets"
      hint={
        draftPr?.secretsChecked && (
          <>
            <div>Install the Scout GitHub App on the repo.</div>
            <div>Add the secrets.</div>
          </>
        )
      }
      control={<span className="text-sm text-desk-text-muted">{scoutSecretsValue(draftPr)}</span>}
    />
  );
};

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
      <SettingRow
        label="Draft PR"
        control={
          <Switch
            size="small"
            checked={local.draftPr ?? false}
            onChange={(e) => {
              const next = { ...local, draftPr: e.target.checked };
              setLocal(next);
              onSave(next);
            }}
          />
        }
      />
      {local.draftPr && <ScoutSecretsRow />}
    </>
  );
};
