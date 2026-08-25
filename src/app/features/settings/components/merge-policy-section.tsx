import { applyMergePolicy, fetchMergePolicy } from '@/app/services/system';
import type { MergePolicy, MergePolicyResult } from '@/types/index';
import { Alert, Button, Card, Divider, Stamp, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { MERGE_POLICY_STAMP } from '../constants';

const RECOMMENDED: MergePolicy = {
  allowSquashMerge: true,
  allowMergeCommit: false,
  allowRebaseMerge: false,
  squashMergeCommitTitle: 'PR_TITLE',
  squashMergeCommitMessage: 'PR_BODY',
};

const POLICY_ROWS: { key: keyof MergePolicy; label: string }[] = [
  { key: 'allowSquashMerge', label: 'Allow squash merge' },
  { key: 'allowMergeCommit', label: 'Allow merge commit' },
  { key: 'allowRebaseMerge', label: 'Allow rebase merge' },
  { key: 'squashMergeCommitTitle', label: 'Squash commit title' },
  { key: 'squashMergeCommitMessage', label: 'Squash commit message' },
];

function formatValue(value: boolean | string): string {
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
}

function matchesRecommended(policy: MergePolicy): boolean {
  return POLICY_ROWS.every((row) => policy[row.key] === RECOMMENDED[row.key]);
}

interface PolicyRowProps {
  label: string;
  current: boolean | string;
  recommended: boolean | string;
  isLast: boolean;
}

const PolicyRow = ({ label, current, recommended, isLast }: PolicyRowProps) => {
  const matches = current === recommended;
  return (
    <>
      <div className="flex items-center gap-3 pb-2 pt-2">
        <span className="flex-1">{label}</span>
        <span className={matches ? 'opacity-[0.65] font-normal' : 'font-semibold'}>
          {formatValue(current)}
        </span>
        {!matches && <span className="opacity-[0.45]">→ {formatValue(recommended)}</span>}
      </div>
      {!isLast && <Divider />}
    </>
  );
};

export const MergePolicySection = () => {
  const [result, setResult] = useState<MergePolicyResult | null | undefined>(undefined);
  const [applying, setApplying] = useState(false);
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

  const upToDate = result?.status === 'ok' && matchesRecommended(result.policy);

  return (
    <div>
      <div className="mb-6">
        <h2 className="m-0">Merge Policy</h2>
        <p className="opacity-50 mt-1">
          Paper Camp's canonical policy: squash-only merges, with the commit title and body taken
          from the PR.
        </p>
      </div>
      {result === undefined && <p>Loading…</p>}
      {result === null && <Alert variant="warning">Failed to load merge policy.</Alert>}
      {result?.status === 'unavailable' && <Alert variant="warning">{result.reason}</Alert>}
      {result?.status === 'ok' && (
        <>
          <div className="flex items-center gap-3 mb-3">
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
          </div>
          <Card size="small" texture="kraft">
            {POLICY_ROWS.map((row, idx) => (
              <PolicyRow
                key={row.key}
                label={row.label}
                current={result.policy[row.key]}
                recommended={RECOMMENDED[row.key]}
                isLast={idx === POLICY_ROWS.length - 1}
              />
            ))}
          </Card>
          <div className="mt-4">
            <Button size="small" onClick={handleApply} disabled={applying || upToDate}>
              {applying ? 'Applying…' : 'Apply recommended policy'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
