import { RowSkeleton } from '@/app/components';
import { applyMergePolicy, fetchMergePolicy } from '@/app/services/system';
import type { MergePolicy, MergePolicyResult } from '@/types/index';
import { Alert, Button, Stamp, Switch, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { MERGE_POLICY_STAMP } from '../constants';
import { SettingRow } from './setting-row';
import { SettingsHeader } from './settings-header';

const RECOMMENDED: MergePolicy = {
  allowSquashMerge: true,
  allowMergeCommit: false,
  allowRebaseMerge: false,
  squashMergeCommitTitle: 'PR_TITLE',
  squashMergeCommitMessage: 'PR_BODY',
};

const SWITCH_ROWS: {
  key: 'allowSquashMerge' | 'allowMergeCommit' | 'allowRebaseMerge';
  label: string;
}[] = [
  { key: 'allowSquashMerge', label: 'Allow squash merge' },
  { key: 'allowMergeCommit', label: 'Allow merge commit' },
  { key: 'allowRebaseMerge', label: 'Allow rebase merge' },
];

const VALUE_ROWS: { key: 'squashMergeCommitTitle' | 'squashMergeCommitMessage'; label: string }[] =
  [
    { key: 'squashMergeCommitTitle', label: 'Squash commit title' },
    { key: 'squashMergeCommitMessage', label: 'Squash commit message' },
  ];

function matchesRecommended(policy: MergePolicy): boolean {
  return (Object.keys(RECOMMENDED) as (keyof MergePolicy)[]).every(
    (key) => policy[key] === RECOMMENDED[key],
  );
}

export const MergePolicySection = () => {
  const [result, setResult] = useState<MergePolicyResult | null | undefined>(undefined);
  const [applying, setApplying] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMergePolicy().then(setResult);
  }, []);

  const handleApply = async () => {
    setApplying(true);
    const applied = await applyMergePolicy();
    setApplying(false);
    if (applied?.status === 'ok') {
      setResult(applied);
      toast({ title: 'Merge policy applied', variant: 'success' });
    } else {
      toast({
        title: 'Failed to apply merge policy',
        description: applied?.status === 'unavailable' ? applied.reason : undefined,
        variant: 'error',
      });
    }
  };

  const handleToggle = async (key: (typeof SWITCH_ROWS)[number]['key']) => {
    if (result?.status !== 'ok') return;
    const next = !result.policy[key];
    setTogglingKey(key);
    const applied = await applyMergePolicy({ [key]: next });
    setTogglingKey(null);
    if (applied?.status === 'ok') {
      setResult(applied);
      toast({ title: 'Saved', variant: 'success' });
    } else {
      toast({
        title: 'Failed to save',
        description: applied?.status === 'unavailable' ? applied.reason : undefined,
        variant: 'error',
      });
    }
  };

  const upToDate = result?.status === 'ok' && matchesRecommended(result.policy);

  return (
    <div>
      <SettingsHeader title="Merge Policy">
        {result?.status === 'ok' && (
          <>
            <span className="font-medium">{result.repo}</span>
            <Stamp
              size="small"
              fillColor={
                upToDate ? MERGE_POLICY_STAMP.upToDate.fill : MERGE_POLICY_STAMP.outdated.fill
              }
              textColor={
                upToDate ? MERGE_POLICY_STAMP.upToDate.text : MERGE_POLICY_STAMP.outdated.text
              }
            >
              {upToDate ? 'Matches recommended policy' : 'Differs from recommended policy'}
            </Stamp>
            <Button size="small" onClick={handleApply} disabled={applying || upToDate}>
              {applying ? 'Applying…' : 'Apply recommended'}
            </Button>
          </>
        )}
      </SettingsHeader>

      <p className="opacity-50 text-sm mt-0 mb-4">
        Paper Camp's canonical policy: squash-only merges, with the commit title and body taken from
        the PR.
      </p>

      {result === undefined && <RowSkeleton />}
      {result === null && <Alert variant="warning">Failed to load merge policy.</Alert>}
      {result?.status === 'unavailable' && <Alert variant="warning">{result.reason}</Alert>}
      {result?.status === 'ok' && (
        <div className="flex flex-col gap-1">
          {SWITCH_ROWS.map(({ key, label }) => {
            const current = result.policy[key];
            const recommended = RECOMMENDED[key];
            return (
              <SettingRow
                key={key}
                label={label}
                hint={
                  current !== recommended ? `recommended: ${recommended ? 'on' : 'off'}` : undefined
                }
              >
                <Switch
                  size="small"
                  checked={current}
                  disabled={togglingKey === key}
                  onChange={() => handleToggle(key)}
                />
              </SettingRow>
            );
          })}
          {VALUE_ROWS.map(({ key, label }) => (
            <SettingRow key={key} label={label}>
              <span className="text-sm opacity-[0.65]">{result.policy[key]}</span>
            </SettingRow>
          ))}
        </div>
      )}
    </div>
  );
};
